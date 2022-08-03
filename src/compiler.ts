// import rfdc from 'rfdc'
import * as CompilerErrorCauses from './causes'
import { Node, Token } from './parser'
import { SExpr } from './sexpr'
import { Type, Typed } from './typed'
import { flatten, mush } from './util'

export { CompilerErrorCauses }
// const copy = rfdc({ proto: true, circles: false })

export type { Token }

export interface CompilerError extends Error {
  cause:
    | CompilerErrorCauses.ReferenceErrorCause
    | CompilerErrorCauses.SyntaxErrorCause
    | CompilerErrorCauses.TypeErrorCause
    | CompilerErrorCauses.InvalidErrorCause
}

export class CompilerError extends Error {
  name = 'CompilerError'
  constructor(cause: Error) {
    super(cause.message, { cause })
  }
}

interface Op {
  (...sexprs: SExpr[]): SExpr
}

type CtxOp = TokenOp | NodeOp

interface TokenOp {
  (local: Context, ops: OpTable): RawTokenOp
}

interface NodeOp {
  (local: Context, ops: OpTable): RawNodeOp
}

interface RawTokenOp {
  (lhs: Token, ...nodes: Node[]): SExpr
}

interface RawNodeOp {
  (...nodes: Node[]): SExpr
}

interface OpTable {
  [k: string]: null | (() => CtxOp) | Op | Op[]
}

export interface Scope {
  [k: string]: Type
}

export interface Arg {
  id: Token
  type: Type
  export?: boolean
  default?: SExpr
  originalDefault?: SExpr
  range?: SExpr
}

export interface Context {
  params: Arg[]
  scope: Scope
  offsets: Record<string, number>
  elements: Record<string, Token>
}

export interface Func {
  id: Token
  params: Arg[]
  result: Type
  context: Context
  body?: SExpr
  source?: SExpr
}

// export type Func = [SExpr, SExpr]

export interface Includes {
  [k: string]: Func | { params: Type[]; result: Type }
}

export interface Module {
  body: SExpr
  funcs: Record<string, Func>
  typeOf: (x: any) => Type
  valueOf: () => SExpr
}

export { Type }

export enum CompStep {
  Lib = 'lib',
  User = 'user',
}

export const compile = (node: Node, scope: Scope = {}, includes: Includes = {}, step: CompStep = CompStep.User) => {
  const externalScopeKeys = Object.keys(scope)

  // implementations need to provide global scope: `global_mem_ptr: Type.i32`
  const global: Context = { scope, offsets: {}, elements: {}, params: [] }
  const funcs: Module['funcs'] = {}
  const bodies: Map<Func, Node> = new Map()

  // create types
  const { typeOf, typeAs, cast, castAll, hi, max, top, infer } = Typed()

  // included ambient functions (declared elsewhere or from a previous step)
  for (const [name, func] of Object.entries(includes)) {
    if (!('context' in func)) {
      funcs[name] = {
        id: name as Token,
        get params() {
          return this.context.params
        },
        result: func.result,
        context: {
          params: func.params.map((x: string, i) => ({
            id: i.toString(),
            type: x,
            default: typeAs(x as Type, [x + '.const', '0']),
          })) as Arg[],
          scope: {},
          offsets: {},
          elements: {},
        },
        body: [],
      }
    } else {
      funcs[name] = func
    }
  }

  /** todo is a "not implemented" marker for ops */
  const todo = null

  /** zeroifies inf and nan */
  const denan = (body: SExpr | Node) =>
    typeOf(body) !== Type.f32
      ? body
      : ['call', '$denan', body]

  /** constructs a binary op of least type `type` */
  const bin = (type: Type, op: string): Op => (lhs, rhs) => top(max(type, hi(lhs, rhs)), [op, lhs, rhs])

  /** constructs a binary op of exact type `type` */
  const typebin = (type: Type, op: string): Op => (lhs, rhs) => top(type, [op, lhs, rhs])

  /** constructs an equality op */
  const eq = (op: string): Op =>
    (lhs, rhs) => {
      const type = max(Type.i32, hi(lhs, rhs))
      if (type === Type.f32) return typeAs(Type.bool, top(Type.f32, [op, lhs, rhs]))
      return typeAs(Type.bool, top(Type.i32, [op + '_s', lhs, rhs]))
    }

  /** returns a scoped op (`local.xxx` or `global.xxx`) */
  const scoped = (scope: Scope, op: string) => (scope === global.scope ? 'global' : 'local') + '.' + op

  /** looks up symbol `sym` in context and returns `scope` */
  const lookup = (local: Context, sym: Token): Scope =>
    sym in local.scope ? local.scope : sym in global.scope ? global.scope : local.scope

  /** returns number of elements for buffer symbol `sym` */
  const get_elements = (
    local: Context,
    sym: Token,
  ): Token => (sym in local.elements ? local.elements[sym] : global.elements[sym])

  /** assigns `value` to variable `sym` in context `local` i.e: x=y */
  const assign_single = (local: Context, sym: Token, value: SExpr) => {
    const scope = lookup(local, sym)
    // if symbol is not found in scope, we create it (lazy variable declaration)
    const type = sym in scope ? scope[sym] : (scope[sym] = typeOf(value))
    return typeAs(type, [scoped(scope, 'set'), '$' + sym, denan(cast(type, value))])
  }

  /** returns buffer position for `offset` for buffer `id` in `scope` */
  const buffer_pos = (local: Context, scope: Scope, sym: Token, offset?: SExpr) => {
    // get needle
    const needle = typeAs(Type.i32, [scoped(scope, 'get'), '$' + sym + '_needle'])
    // buffer_ptr + ((((offset+needle)*elements) << 2) %% buffer_length)
    // dprint-ignore
    return top(Type.i32, ['add',
      typeAs(Type.i32, [scoped(scope, 'get'), '$' + sym]),
      typeAs(Type.f32, ['call', '$modwrap', ...castAll(Type.f32,
        typeAs(Type.i32, ['i32.shl',
          ['i32.mul',
            offset ? top(Type.i32, ['add', offset, needle]) : needle,
            ['i32.const', get_elements(local, sym)],
          ],
          ['i32.const', '2']
        ]),
        typeAs(Type.i32, [scoped(scope, 'get'), '$' + sym + '_length']))
      ]),
    ])
  }

  /** defines a function */
  const funcDef = (context: Context, id: Token, params: Node[], body: Node) => {
    map(params, context, OpParams)
    const func = (funcs[id] = {
      id,
      get params() {
        return this.context.params
      },
      get result() {
        return typeOf(this.body)
      },
      context,
      // body: typeAs(typeOf(body.at(-1)), body),
    })
    bodies.set(func, body)
  }

  /** function call */
  const funcCall = (sym: Token, args: SExpr[]) => {
    const func = funcs[sym]
    if (!func) throw new CompilerError(new CompilerErrorCauses.ReferenceErrorCause(sym, 'function not defined'))
    // console.log('CALLING', sym, 'TYPE', body, type)

    // examine function argument declarations against passed arguments
    func.params.forEach((param, i) => {
      // console.log(sym, param)
      let param_default
      if (param.export) {
        const export_id = '$export/' + sym + '/' + param.id
        param_default = typeAs(global.scope[export_id], ['global.get', export_id])
      } else {
        if (param.default)
          param_default = param.default
        else if (param.range)
          param_default = param.range[0] as SExpr
        else
          param_default = typeAs(Type.f32, ['f32.const', '0'])
      }
      // param_default = cast(Type.f32, param_default)

      // function argument declaration has default value
      if (param.default) {
        // missing passed argument becomes the default value
        if (!args[i]) args[i] = param_default
        // has passed argument but cast it to correct type
        // else args[i] = cast(Type.f32, args[i])
        else args[i] = cast(param.type, args[i])
      } // function argument declaration has range
      else if (param.range) {
        // missing passed argument becomes the start of range value
        if (!args[i]) args[i] = param_default
        // has passed argument but cast it to correct type
        // else args[i] = cast(Type.f32, args[i])
        else args[i] = cast(param.type, args[i])
      } // has passed argument but no default, it is cast implicitly to f32
      else if (args[i]) args[i] = cast(Type.f32, args[i])
      // did not pass argument and no default, so implicitly push a zero f32 (0.0)
      else args[i] = param_default
      // TODO: call $limit_range(args[i], param.range[0], param.range[1])
    })
    // truncate number of passed arguments down to the accepted function arguments
    args.length = func.params.length
    // call the function
    return typeAs(func.result, ['call', '$' + sym, ...args])
  }

  /** primary optable */
  const Op: OpTable = {
    ',': todo,
    ';': (): CtxOp => (local, ops) => (lhs, rhs) => map([...flatten(';', lhs), rhs], local, ops),
    '..': (lhs, rhs) => [lhs, rhs],

    // x:y | x:y,z : buffer declare allocate
    ':': (): CtxOp =>
      (local, ops) =>
        (lhs, rhs) => {
          const sym = lhs
          if (sym[0] !== '#') {
            throw new CompilerError(
              new CompilerErrorCauses.SyntaxErrorCause(lhs, 'buffer variables must begin with a hash(`#`) symbol')
            )
          }

          // get size,elements (elements default to 1)
          const [size_raw, elements] = flatten(',', rhs) as [Node, Token]

          // size can be an expression
          const size = cast(Type.i32, build(size_raw, local, ops))

          // elements are a constant so we store them as compiler meta, elements default to 1
          local.elements[sym] = elements || ((rhs as Token).as('1', 'num') as Token)

          // buffer info
          // offset 0: needle i32
          // offset 4: ...contents...
          const { scope } = local
          scope[sym] = Type.i32 // pointer
          scope[sym + '_size'] = Type.i32 // size in indexes
          scope[sym + '_length'] = Type.i32 // length in bytes (size * elements)
          scope[sym + '_needle'] = Type.i32 // needle index

          // dprint-ignore
          return [
        // store the global memory pointer for the buffer
        [scoped(scope, 'set'), '$' + sym, ['global.get', '$global_mem_ptr']],
        // store the buffer size in indexes
        [scoped(scope, 'set'), '$' + sym + '_size', size],
        // store the buffer length (size * elements) << 2 === size * elements * 4 (f32 is 4 bytes per element)
        [scoped(scope, 'set'), '$' + sym + '_length',
          ['i32.shl',
            ['i32.mul', [
              scoped(scope, 'get'), '$' + sym + '_size'],
              ['i32.const', local.elements[sym]]
            ],
            ['i32.const', '2']
          ]
        ],
        // read needle from memory and store in local
        [scoped(scope, 'set'), '$' + sym + '_needle', ['i32.load', [scoped(local.scope, 'get'), '$' + sym]]],
        // advance the global memory pointer using the buffer length
        ['global.set', '$global_mem_ptr',
          ['i32.add',
            ['global.get', '$global_mem_ptr'],
            ['i32.add',
              ['i32.const', '4'], // +1 i32 element for the needle
              [scoped(scope, 'get'), '$' + sym + '_length'],
            ]
          ]
        ],
      ]
        },

    // x::y map/reduce buffer `x` with map function `y`, reduces by summing
    '::': (): CtxOp =>
      local =>
        (lhs, rhs) => {
          const sym = lhs
          if (sym[0] !== '#') {
            throw new CompilerError(
              new CompilerErrorCauses.SyntaxErrorCause(
                lhs,
                'map/reduce `::` operator\'s left hand side must be a buffer variable'
              )
            )
          }

          const buffer_scope = lookup(local, sym)
          if (!(sym in buffer_scope))
            throw new CompilerError(new CompilerErrorCauses.ReferenceErrorCause(sym, 'symbol not defined'))

          const elements = get_elements(local, sym)

          local.scope['temp_index'] = Type.i32
          local.scope['temp_sum'] = Type.f32
          local.scope['temp_buffer_pos'] = Type.i32
          local.scope['temp_buffer_one_index_length'] = Type.i32

          // dprint-ignore
          return typeAs(Type.f32, [
            [scoped(local.scope, 'set'), '$temp_index', ['i32.const', '0']],
            [scoped(local.scope, 'set'), '$temp_sum', ['f32.const', '0']],
            [scoped(local.scope, 'set'), '$temp_buffer_pos', [scoped(buffer_scope, 'get'), '$' + sym]],
            [scoped(local.scope, 'set'), '$temp_buffer_one_index_length',
              ['i32.shl',
                ['i32.const', elements],
                ['i32.const', '2']
              ]
            ],
            ['loop $loop',
              [scoped(local.scope, 'set'), '$temp_sum',
                ['f32.add',
                  [scoped(local.scope, 'get'), '$temp_sum'],
                  funcCall(rhs as Token, Array.from({ length: +elements }).map((_, i) =>
                    typeAs(Type.f32, [`f32.load offset=${(i+1) * 4}`,
                      [scoped(local.scope, 'get'), '$temp_buffer_pos'],
                    ])
                  )),
                ]
              ],
              [scoped(local.scope, 'set'), '$temp_buffer_pos',
                ['i32.add',
                  [scoped(local.scope, 'get'), '$temp_buffer_pos'],
                  [scoped(local.scope, 'get'), '$temp_buffer_one_index_length'],
                ]
              ],
              // i++
              [scoped(local.scope, 'set'), '$temp_index',
                ['i32.add', [scoped(local.scope, 'get'), '$temp_index'], ['i32.const', '1']]],
              // if (i !== buffer_size) continue $loop
              ['br_if $loop',
                ['i32.ne',
                  [scoped(local.scope, 'get'), '$temp_index'],
                  [scoped(buffer_scope, 'get'), '$' + sym + '_size']
                ]
              ],
            ],
            [scoped(local.scope, 'get'), '$temp_sum']
          ])
        },

    '=': (): CtxOp =>
      (local, ops) =>
        (lhs, rhs) => {
          if (Array.isArray(lhs)) {
            // f()=x : function declaration
            if (lhs[0] == '@') {
              const [id, params] = [lhs[1], flatten(',', lhs[2]).filter(Boolean)] as [Token, Node[]]
              // const scope = Object.fromEntries(
              //   params.map(x => {
              //     if (Array.isArray(x)) x = x.flat(Infinity).find(x => x.group === 'ids')
              //     return [x, Type.f32]
              //   })
              // )
              const context: Context = { scope: {}, offsets: {}, elements: {}, params: [] }
              funcDef(context, id, params, rhs)
              return []
            } // {x,y}=(z,w) : store operation
            else if (lhs[0] == '{') {
              const vars = flatten(',', lhs[1]) as Token[]
              const vals = map(flatten(',', rhs), local, ops)
              return vars.map((sym, i) => [
                `f32.store offset=${local.offsets[sym]}`,
                ['local.get', '$local_mem_ptr'],
                cast(Type.f32, vals[i]),
              ])
            } // (x,y)=(z,w) : multivalue assignment
            else if (lhs[0] == ',') {
              const vars = flatten(',', lhs) as Token[]

              // if function call or buffer read
              if (rhs[0] == '@') {
                const sym = rhs[1] as Token

                // (x,y)=#(z) : buffer read at offset `z` and expand/destructure tuple values to variables `x,y`
                if (sym[0] == '#') {
                  const scope = lookup(local, sym)
                  if (!(sym in scope))
                    throw new CompilerError(new CompilerErrorCauses.ReferenceErrorCause(sym, 'symbol not defined'))

                  const elements = get_elements(local, sym)
                  if (vars.length > +elements) {
                    throw new CompilerError(
                      new CompilerErrorCauses.TypeErrorCause(
                        vars.at(-1)!,
                        `number of variables(\`${vars.length}\`) are greater than the number of elements(\`${elements}\`)`
                      )
                    )
                  }

                  const offset = build(rhs[2] as Token, local, ops)

                  scope['temp_buffer_pos'] = Type.i32

                  return [
                    // write buffer position at offset in temporary variable
                    [scoped(scope, 'set'), '$temp_buffer_pos', buffer_pos(local, scope, sym, offset)],
                    // assign buffer elements in variables (i+1 because 1 byte for needle)
                    ...vars.map((sym, i) =>
                      assign_single(
                        local,
                        sym,
                        typeAs(Type.f32, [`f32.load offset=${(i + 1) * 4}`, [scoped(scope, 'get'), '$temp_buffer_pos']])
                      )
                    ),
                  ]
                } // (a,b)=f() : TODO: function call multi-value return assignment
                else {
                  throw new CompilerError(new CompilerErrorCauses.InvalidErrorCause(sym, 'not implemented'))
                }
              } // else try regular var=value assignment
              else {
                const vals_raw = flatten(',', rhs)
                if (vars.length != vals_raw.length) {
                  throw new CompilerError(
                    new CompilerErrorCauses.TypeErrorCause(
                      rhs[0] as Token,
                      `number of values(\`${vals_raw.length}\`) do not match number of variables(\`${vars.length}\`)`
                    )
                  )
                }
                const vals = map(vals_raw, local, ops)
                return vars.map((sym, i) => assign_single(local, sym, vals[i]))
              }
            } // invalid
            else {
              throw new CompilerError(
                new CompilerErrorCauses.SyntaxErrorCause(lhs[0], 'invalid assignment')
              )
            }
          } else {
            // #x=y | #x=(y,z): buffer write and advance needle
            if (lhs[0] === '#') {
              const sym = lhs
              const scope = lookup(local, sym)
              if (!(sym in scope))
                throw new CompilerError(new CompilerErrorCauses.ReferenceErrorCause(sym, 'symbol not defined'))

              const elements = get_elements(local, sym)
              const rhs_raw = flatten(',', rhs)
              if (+elements != rhs_raw.length) {
                throw new CompilerError(
                  new CompilerErrorCauses.TypeErrorCause(
                    lhs,
                    `number of values(\`${rhs_raw.length}\`) do not match number of elements(\`${elements}\`)`
                  )
                )
              }

              // map build values
              const vals = map(rhs_raw, local, ops)

              // get needle position
              const needle = typeAs(Type.i32, [scoped(scope, 'get'), '$' + sym + '_needle'])

              // holds the calculated buffer position at needle
              scope['temp_buffer_pos'] = Type.i32

              // dprint-ignore
              return [
                // write buffer position in temporary variable
                [scoped(scope, 'set'), '$temp_buffer_pos', buffer_pos(local, scope, sym)],
                // write vals at current needle position (offset i+1 because of needle 1 byte)
                ...vals.map((val, i) => [
                  `f32.store offset=${(i+1) * 4}`,
                  [scoped(scope, 'get'), '$temp_buffer_pos'],
                  denan(cast(Type.f32, val))
                ]),
                // advance needle
                [scoped(scope, 'set'), '$' + sym + '_needle', ['i32.add', ['i32.const', '1'], needle]],
                // write needle
                ['i32.store', [scoped(scope, 'get'), '$' + sym], needle],
              ]
            } // x=y : variable assignment
            else {
              const sym = lhs
              const value = build(rhs, local, ops)
              return assign_single(local, sym, value)
            }
          }
        },

    // // x?y:z : ternary conditional
    // '?': (cond, then_body, else_body) => {
    //   const type = hi(then_body, else_body)
    //   return typeAs(type, [
    //     'if',
    //     ['result', max(Type.i32, type)],
    //     cast(Type.bool, cond),
    //     ['then', cast(type, then_body)],
    //     ['else', cast(type, else_body)],
    //   ])
    // },
    // x?=y:z : ternary conditional using select
    // TODO: testing to see if select works for everything
    '?': (cond, then_body, else_body) => {
      const type = hi(then_body, else_body)
      // dprint-ignore
      return typeAs(type, [
        'select',
        cast(type, then_body),
        cast(type, else_body),
        cast(Type.bool, cond),
      ])
    },

    // logical Or
    '||': (): NodeOp =>
      (local, ops) =>
        (...nodes) => {
          const [lhs, rhs] = map(nodes, local, ops)
          const type = hi(lhs, rhs)
          const temp = '__lhs__' + type
          const zero = top(type, ['const', '0'])
          if (!(temp in local.scope)) local.scope[temp] = type
          return typeAs(type, [
            'if',
            ['result', max(Type.i32, type)],
            top(type, ['ne', zero, ['local.tee', temp, cast(type, lhs)]]),
            ['then', ['local.get', temp]],
            ['else', cast(type, rhs)],
          ])
        },

    // logical And
    // commented out because it's implemented as an AST rewrite
    // in parser as a ternary: lhs!=0?rhs:0, also it was wrong.
    // '&&': (lhs, rhs) => {
    //   const type = hi(lhs, rhs)
    //   const zero = top(type, ['const', '0'])
    //   return typeAs(type, [
    //     'if',
    //     ['result', max(Type.i32, type)],
    //     top(type, ['ne', zero, cast(type, lhs)]),
    //     ['then', cast(type, rhs)],
    //     ['else', zero],
    //   ])
    // },

    // x|y : bitwise OR
    '|': typebin(Type.i32, 'or'),

    // x^y : bitwise XOR
    '^': typebin(Type.i32, 'xor'),

    '**': (lhs, rhs) => typeAs(Type.f32, ['call', '$pow', ...castAll(Type.f32, lhs, rhs)]),

    // x&y : bitwise AND
    '&': typebin(Type.i32, 'and'),

    '==': (lhs, rhs) => typeAs(Type.bool, bin(Type.i32, 'eq')(lhs, rhs)),
    '!=': (lhs, rhs) => typeAs(Type.bool, bin(Type.i32, 'ne')(lhs, rhs)),

    '<': eq('lt'),
    '>': eq('gt'),
    '<=': eq('le'),
    '>=': eq('ge'),

    // x>>y : bitwise shift right
    '>>': typebin(Type.i32, 'shr_s'),
    // x<<y : bitwise shift left
    '<<': typebin(Type.i32, 'shl'),

    '+': [
      // x+y : arithmetic add
      bin(Type.i32, 'add'),
      // +x  : cast to number
      x => cast(max(Type.i32, typeOf(x)), x),
    ],
    '-': [
      // x-y : arithmetic subtract
      bin(Type.i32, 'sub'),
      // -x  : arithmetic negate
      x => bin(Type.i32, 'mul')(top(max(Type.i32, typeOf(x)), ['const', '-1']), x),
    ],

    // x*y : arithmetic multiply
    '*': bin(Type.i32, 'mul'),
    // x/y : arithmetic divide
    '/': bin(Type.i32, 'div'),
    // x%y : modulo/remainder
    '%': (lhs, rhs) => {
      const type = hi(lhs, rhs)
      if (type === Type.f32) return typeAs(Type.f32, ['call', '$mod', ...castAll(Type.f32, lhs, rhs)])
      if (type === Type.bool) return top(Type.i32, ['rem_s', lhs, rhs])
      return top(Type.i32, ['rem_u', lhs, rhs])
    },
    // x%%y : modulo wrap (wraps negative numbers around)
    '%%': (lhs, rhs) => typeAs(Type.f32, ['call', '$modwrap', ...castAll(Type.f32, lhs, rhs)]),
    // !x : logical Not
    '!': x => top(Type.bool, ['eqz', x]),
    // ~x : bitwise NOT
    '~': x => top(Type.i32, ['not', x]),
    // // #x : buffer read position x
    // '#': (): CtxOp => (local, ops) => rhs => {
    //   const x = build(rhs, local, ops)
    //   return typeAs(Type.f32, ['f32.load', buffer_pos(x)])
    // },

    // {x,y,z} : load operations
    '{': (): CtxOp =>
      local =>
        rhs => {
          local.scope['local_mem_ptr'] = Type.i32
          const vars = (<Token[]> flatten(',', rhs)).map((sym: Token, i) => {
            const offset = i * 4
            const op = typeAs(Type.f32, [`f32.load offset=${offset}`, ['local.get', '$local_mem_ptr']])
            local.scope[sym] = typeOf(op)
            local.offsets[sym] = offset
            return typeAs(Type.f32, ['local.set', '$' + sym, op])
          })
          // dprint-ignore
          return [
        // store the global memory pointer for our context for later writes
        ['local.set', '$local_mem_ptr', ['global.get', '$global_mem_ptr']],
        ...vars,
        // update the global memory pointer
        ['global.set', '$global_mem_ptr', ['i32.add', ['i32.const', '' + vars.length * 4],
        ['global.get', '$global_mem_ptr']]]
      ]
        },
    '[': todo,
    '(': todo,
    '@': (): CtxOp =>
      (local, ops) =>
        (sym, rhs) => {
          // #b(x) : buffer read `b` at offset `x`
          if (sym[0] === '#') {
            const scope = lookup(local, sym)
            if (!(sym in scope))
              throw new CompilerError(new CompilerErrorCauses.ReferenceErrorCause(sym, 'symbol not defined'))
            const offset = build(rhs, local, ops)
            return typeAs(Type.f32, ['f32.load offset=4', buffer_pos(local, scope, sym, offset)])
          } // f() : function call
          else {
            // evaluate argument expressions
            const args = map(flatten(',', rhs), local, ops)
            return funcCall(sym, args)
          }
        },
    '.': todo,

    num: (): CtxOp => () => lit => top(infer(lit), ['const', lit]),

    ids: (): CtxOp =>
      local =>
        sym => {
          const scope = lookup(local, sym) // sym in local.scope ? local.scope : sym in global.scope ? global.scope : local.scope
          if (!(sym in scope))
            throw new CompilerError(new CompilerErrorCauses.ReferenceErrorCause(sym, 'symbol not defined'))
          const type = scope[sym]
          return typeAs(type, [scoped(scope, 'get'), '$' + sym])
        },
  }

  /** arguments optable */
  const OpParams: OpTable = {
    ...Op,
    '.': (): CtxOp =>
      (local, ops) =>
        id => {
          if (Array.isArray(id)) id = build(id, local, ops)[0] as Token
          const param = mush(local.params, { id, export: true }) as Arg
          if (!param.type)
            local.scope[id] = param.type = Type.f32
          return [id]
        },
    '=': (): CtxOp =>
      (local, ops) =>
        (id, value) => {
          // if it's not an atom then it has ranges
          if (Array.isArray(id)) id = build(id, local, ops)[0] as Token

          const defaultValue = build(value, local, Op)
          const param = mush(local.params, { id, default: defaultValue }) as Arg

          const type = hi(param.default!, ...(param.range ?? []))

          param.default = cast(type, param.default!)

          local.scope[id] = param.type = type

          if (param.range) {
            param.range[0] = cast(type, param.range[0] as SExpr)
            param.range[1] = cast(type, param.range[1] as SExpr)
          }

          return [id]
        },
    '[': (): CtxOp =>
      local =>
        (id, rhs) => {
          if (rhs == null) {
            throw new CompilerError(
              new CompilerErrorCauses.InvalidErrorCause(id, 'Invalid parameter range for')
            )
          }

          const range = build(rhs, local, Op) as [SExpr, SExpr]
          if (!Array.isArray(range[0]) || !Array.isArray(range[1])) {
            throw new CompilerError(
              new CompilerErrorCauses.InvalidErrorCause(id, 'Invalid parameter range for')
            )
          }

          const param = mush(local.params, { id, range }) as Arg
          const type = hi(param.default!, ...range)

          if (param.default) param.default = cast(type, param.default)

          local.scope[id] = param.type = type

          range[0] = cast(type, range[0])
          range[1] = cast(type, range[1])

          return [id]
        },
    ids: (): CtxOp =>
      local =>
        id => {
          const type = Type.f32
          mush(local.params, { id, type })
          local.scope[id] = type
          return [id]
        },
  }

  /** builds a `node` under context `ctx` and optable `ops` */
  const build = (node: Node, ctx: Context, ops: OpTable): SExpr => {
    if (Array.isArray(node)) {
      const [sym, ...nodes] = node as [Token, Node[]]
      if (!sym || !nodes.length) return []
      let op = ops[sym]
      if (!op) throw new CompilerError(new CompilerErrorCauses.InvalidErrorCause(sym, 'not implemented'))
      if (Array.isArray(op)) op = op.find(x => x.length === nodes.length) || op[0]
      return op.length ? (<Op> op)(...map(nodes, ctx, ops)) : (<() => NodeOp> op)()(ctx, ops)(...nodes)
    } else {
      const op = ops[node.group]
      if (!op) throw new CompilerError(new CompilerErrorCauses.InvalidErrorCause(node, 'not implemented'))
      return (<() => CtxOp> op)()(ctx, ops)(node)
    }
  }

  /** builds an array of `nodes` under context `ctx` and optable `ops` */
  const map = (nodes: Node[], ctx: Context, ops: OpTable): SExpr[] =>
    nodes
      .filter(Boolean)
      .map(x => build(x, ctx, ops))
      .filter(x => x.length > 0)

  // ==================================================================================
  // init

  if (step === CompStep.Lib)
    funcDef(global, '__drop__' as Token, [], node)
  else {
    // create begin function
    funcDef(global, '__begin__' as Token, [], node)
    // create start function
    funcDef({ scope: {}, offsets: {}, elements: {}, params: [] }, '__start__' as Token, [], [])
    // funcDef({ scope, offsets: {}, elements: {}, params: [] }, '__start__' as Token, [], node)
  }

  // compile function bodies
  for (const [func, body] of bodies) {
    const b = map(flatten(';', body), func.context, Op)
    // console.log(func.id, b.at(-1), typeOf(b.at(-1)))
    // func.body = typeAs(Type.f32, b) // TODO: defer type evaluation for fn calls
    func.body = typeAs(typeOf(b.at(-1)), b)
  }

  // create module
  const mod: Module = {
    body: step === CompStep.Lib ? [] : ([['start', '$__start__']] as SExpr),
    funcs,
    typeOf,
    valueOf() {
      return this.body
    },
  }

  if (step === CompStep.User)
    funcs.__start__.body!.push(['call', '$__begin__'])
  else
    delete funcs.__drop__

  // create globals
  for (const [id, type] of Object.entries(global.scope)) {
    if (externalScopeKeys.includes(id)) continue

    const t = max(Type.i32, type)
    mod.body.push(['global', '$' + id, ['mut', t], [t + '.const', '0']])
  }

  // create exported params as globals
  for (const [id, func] of Object.entries(funcs)) {
    if (id in includes) continue

    func.params
      .filter(param => param.export)
      .forEach(param => {
        const export_id = 'export/' + id + '/' + param.id
        const type = (global.scope[export_id] = func.context.scope[param.id])
        const t = max(Type.i32, type)

        // put the default value in global scope
        mod.body.push(['global', '$' + export_id, ['export', `"${export_id}"`], ['mut', t], [t + '.const', '0']])

        if (param.range || !param.default) {
          // put the ranges in globals so they can be read from the client after they've evaluated
          mod.body.push(['global', '$' + export_id + '/min', ['export', `"${export_id}/min"`], ['mut', t], [
            t + '.const',
            '0',
          ]])
          mod.body.push(['global', '$' + export_id + '/max', ['export', `"${export_id}/max"`], ['mut', t], [
            t + '.const',
            '1',
          ]])
          global.scope[export_id + '/min'] = type
          global.scope[export_id + '/max'] = type
        }

        // change the default value to use the global one, but keep reference to previous value
        // for later use. TODO: find cleaner way to pass exported params

        if (param.range) {
          funcs.__start__.body!.push(['global.set', '$' + export_id + '/min', param.range[0]])
          funcs.__start__.body!.push(['global.set', '$' + export_id + '/max', param.range[1]])
        }

        if (param.default) {
          param.originalDefault = param.default
          funcs.__start__.body!.push(['global.set', '$' + export_id, param.default])
        } else {
          // dprint-ignore
          funcs.__start__.body!.push(['global.set', '$' + export_id,
            [t + '.add',
              ['global.get', '$' + export_id + '/min'],
              [t + '.div' + (t === 'i32' ? '_u' : ''), // TODO: _u or _s ??
                [t + '.sub',
                  ['global.get', '$' + export_id + '/max'],
                  ['global.get', '$' + export_id + '/min']
                ],
                [t + '.const', '2']
              ]
            ]
          ])
        }

        param.default = typeAs(t, ['global.get', '$' + export_id])
      })
  }

  // create functions
  for (const [id, func] of Object.entries(funcs)) {
    if (id in includes) continue

    func.source = [
      'func',
      '$' + id,
      ['export', `"${id}"`],
      ...func.params.map(param => ['param', '$' + param.id, max(Type.i32, func.context.scope[param.id])]),
      ...(func.body!.length && !['__start__', '__begin__'].includes(id)
        ? [['result', max(Type.i32, func.result)]]
        : []),
      ...(!['__start__', '__begin__'].includes(id)
        ? Object.entries(func.context.scope)
          .filter(([x]) => !func.params.find(param => param.id == x))
          .map(([x, type]) => ['local', '$' + x, max(Type.i32, type)])
        : []),
      // TODO: how to determine if start needs to drop? below was: [...func.body!, 'drop']
      ...(['__start__', '__begin__'].includes(id) ? (func.body!.length ? [...func.body!] : []) : func.body!),
    ]

    // console.log(func.source, typeOf(func.body))
    mod.body.push(func.source)
  }

  return mod
}
