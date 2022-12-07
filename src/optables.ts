import {
  Arg,
  CompilerError,
  CompilerErrorCauses,
  Context,
  Module,
  Node,
  SExpr,
  Struct,
  Token,
} from './compiler'
// @ts-ignore
// eslint-disable-next-line
import { S } from './sexpr'
import { Type } from './typed'
import { flatten, mush } from './util'

export interface Op {
  (...sexprs: SExpr[]): SExpr
}

export type CtxOp = TokenOp | NodeOp

export interface TokenOp {
  (local: Context, ops: OpTable): RawTokenOp
}

export interface NodeOp {
  (local: Context, ops: OpTable): RawNodeOp
}

export interface RawTokenOp {
  (lhs: Token | Node, ...nodes: Node[]): SExpr
}

export interface RawNodeOp {
  (...nodes: Node[]): SExpr
}

export interface OpTable {
  [k: string]: null | (() => CtxOp) | Op | (Op | (() => CtxOp))[]
}

export const Ops = (mod: Module) => {
  const { typeAs, hi, max, top } = mod

  /** todo is a "not implemented" marker for ops */
  const todo = null

  /** constructs a binary op of least type `type` */
  const bin = (type: Type, op: string): Op =>
    (lhs, rhs) => top(max(type, hi(lhs, rhs)), [op, lhs, rhs])

  /** constructs a binary op of exact type `type` */
  const typebin = (type: Type, op: string): Op =>
    (lhs, rhs) => top(type, [op, lhs, rhs])

  /** constructs an equality op */
  const eq = (op: string): Op =>
    (lhs, rhs) => {
      const type = max(Type.i32, hi(lhs, rhs))
      if (type === Type.f32)
        return typeAs(
          Type.bool,
          top(Type.f32, [op, lhs, rhs])
        )
      return typeAs(Type.bool, top(Type.i32, [op, lhs, rhs]))
    }

  const createWasmOps = (type: Type) => ({
    const: (value: string | number | Token) => top(type, ['const', `${value}`]),
    add: typebin(type, 'add'),
    sub: typebin(type, 'sub'),
    mul: typebin(type, 'mul'),
    shl: typebin(type, 'shl'),
    ne: typebin(type, 'ne'),
    eq: typebin(type, 'eq'),
  })

  const i32 = createWasmOps(Type.i32)
  const f32 = createWasmOps(Type.f32)

  return { i32, f32, todo, bin, typebin, eq }
}

export const opTables = (mod: Module) => {
  const {
    typeOf,
    typeAs,
    cast,
    castAll,
    hi,
    max,
    top,
    infer,
    denan,
    global,
    exported,
    funcCall,
  } = mod

  const { i32, typebin, bin, eq, todo } = mod.ops

  let while_loop_id = 0

  /** primary optable */
  const Op: OpTable = {
    ',': (lhs, rhs) =>
      typeAs(Type.multi, [...(Array.isArray(lhs[0]) ? [...lhs] : [lhs]), rhs]),
    ';': (): CtxOp =>
      (local, ops) => (lhs, rhs) => local.map([...flatten(';', lhs), rhs], ops),
    '..': (lhs, rhs) => [lhs, rhs],

    // #b:x | #b:x,y | #b:[1,2,3] : buffer declare allocate or static global buffer with specified values
    ':': (): CtxOp =>
      (local, ops) =>
        (lhs, rhs) => {
          const id = lhs as Token
          if (id[0] !== '#') {
            throw new CompilerError(
              new CompilerErrorCauses.SyntaxErrorCause(
                lhs as Token,
                'buffer variables must begin with a hash(`#`) symbol'
              )
            )
          }

          let size: SExpr
          let elements: Token | undefined

          let store: SExpr = []

          const buffer = local.get_buffer(id)
          const { sym } = buffer

          if (rhs[0] == '[') {
            const vals = local.map(flatten(',', rhs[1] as Node), ops)
            size = i32.const(vals.length)

            store = vals.map((val, i) => buffer.write_at(i, val))
          } else {
            // get size,elements (elements default to 1)
            const result = flatten(',', rhs) as [Node, Token]
            const size_raw = result[0]
            elements = result[1]

            // size can be an expression
            size = cast(Type.i32, local.build(size_raw, ops))
          }

          // elements are a constant so we store them as compiler meta, elements default to 1
          local.elements[sym.id] = elements
            || ((lhs as Token).as('1', 'num') as Token)

          // advance the global memory pointer using the buffer length
          // let advance_ptr: SExpr

          // dprint-ignore
          const buffer_create_body = typeAs(Type.none, [
            // store the global memory pointer for the buffer
            buffer.set_pointer(global.scope.get('global_mem_ptr')),
            // advance current to needle's position
            buffer.set_current(buffer.needle),
            // write data if any
            ...store,
            // store the buffer size in indexes
            buffer.set_size(size),
            // store the buffer size in indexes minus 1
            buffer.set_size_m1(i32.sub(buffer.size, i32.const(1))),
            // store the buffer length (size * elements) << 2 === size * elements * 4 (f32 is 4 bytes per element)
            buffer.set_length(
              i32.shl(
                i32.mul(
                  buffer.size,
                  buffer.elements_const
                  // i32.const(local.elements[sym.id])
                ),
                i32.const(2)
              )
            ),
            global.scope.set('global_mem_ptr',
              i32.add(
                global.scope.get('global_mem_ptr'),
                i32.add(
                  i32.const((Object.keys(Struct.Buffer).length - 1) << 2),
                  buffer.length
                )
              )
            )
          ]) as SExpr

          if (global.scope === local.scope) {
            // a global buffer is initialized once in the fill_body which is written in __start__
            mod.fill_body.push(...buffer_create_body)

            // writes and read pointers work separately. the write[aka needle] pointer is advanced
            // whenever anything is written, the read[aka current] pointer is advanced only at the beginning
            // of every loop to the needle's position. This way it remains constant for the reads e.g #(-1)
            // while the write pointer can do its writes.
            // so returning here will write it in __begin__ which is called once every loop.
            return buffer.set_current(buffer.needle)
          } else {
            // a local buffer is initialized every time.
            // TODO: this is wasteful. if there is store operation, write it once somewhere and point there
            //  maybe need to differentiate between read/writable and read-only buffers.
            return buffer_create_body
          }

          // return buffer_create_body
        },

    // x::y:z map/reduce buffer `x` with map function `y` and reducer `z`.
    // map function can be omitted like this `x:::z` in which case it only reduces,
    // but has to be a 1 element buffer (so linear memory/array)
    '::': (): CtxOp =>
      (local) =>
        (lhs, map_fn, reduce_fn) => {
          const id = lhs as Token
          if (id[0] !== '#') {
            throw new CompilerError(
              new CompilerErrorCauses.SyntaxErrorCause(
                lhs as Token,
                'map/reduce `::` operator\'s left hand side must be a buffer variable'
              )
            )
          }

          const buffer = local.get_buffer(id)
          // const { scope } = buffer

          const temp_index = local.scope.add(Type.i32, 'temp_index')
          const temp_sum = local.scope.add(Type.f32, 'temp_sum')
          const temp_pos = local.scope.add(Type.i32, 'temp_pos')

          // dprint-ignore
          const loop = typeAs(Type.f32, [
            temp_index.set(i32.const(0)),
            temp_sum.set(i32.const(0)),
            ['loop $map_reduce_loop',
              temp_pos.set(buffer.get_pos(temp_index.get())),
              temp_sum.set(
                funcCall(reduce_fn, [
                  temp_sum.get(),
                  // map function defaults to identity of element 1 `#buf:::x`
                  map_fn
                    ? funcCall(map_fn,
                      Array.from({ length: +buffer.elements }).map((_, i) =>
                        buffer.read_at_pos(temp_pos.get(), i)
                      )
                    )
                    : buffer.read_at_pos(temp_pos.get())
                ])
              ),
              // if (++i !== buffer_size) continue $loop
              ['br_if $map_reduce_loop',
                i32.ne(
                  temp_index.tee(i32.add(temp_index.get(), i32.const(1))),
                  buffer.size
                )
              ],
            ],
            temp_sum.get()
          ])

          // console.log(S(loop))
          return loop
        },

    // #:=x : fill memory `#` with function body `x`
    ':=': (): CtxOp =>
      (local, _ops) =>
        (lhs, rhs) => {
          const id = lhs as Token
          if (id[0] == '#') {
            const context = new Context(mod)
            const fill_fn_id = id.as(`${id}_fill`)
            context.funcDef(fill_fn_id, [], rhs)

            const buffer = local.get_buffer(lhs as Token)
            const temp_mem_pos = local.scope.add(Type.i32, 'temp_mem_pos')
            const temp_index = local.scope.add(Type.i32, 'temp_index')
            const temp_pos = local.scope.add(Type.i32, 'temp_pos')

            const global_mem_ptr = global.scope.ensure_sym('global_mem_ptr').sym

            // dprint-ignore
            const fill_body = typeAs(Type.none, [
              temp_mem_pos.set(global_mem_ptr.get()),
              temp_index.set(i32.const(0)),
              ['loop $fill_loop',
                global_mem_ptr.set(temp_mem_pos.get()),
                temp_pos.set(buffer.get_pos(temp_index.get())),
                buffer.write_at_pos(temp_pos.get(), 0, ['call', `$${fill_fn_id}`]),
                // if (++i !== buffer_size) continue $loop
                ['br_if $fill_loop',
                  i32.ne(
                    temp_index.tee(i32.add(temp_index.get(), i32.const(1))),
                    buffer.size
                  )
                ],
              ],
            ])

            mod.fill_body.push(...fill_body)

            return []
          }
          throw new CompilerError(
            new CompilerErrorCauses.TypeErrorCause(
              lhs as Token,
              'not a buffer'
            )
          )
        },

    '=': (): CtxOp =>
      (local, ops) =>
        (lhs, rhs) => {
          if (Array.isArray(lhs)) {
            const id = lhs[0] as Token
            // f()=x : function declaration / declare func
            if (id[0] == '@') {
              const [id, params] = [
                lhs[1],
                flatten(',', lhs[2]).filter(Boolean),
              ] as [Token, Node[]]
              const context = new Context(mod)
              context.funcDef(id, params, rhs)
              return []
            } // {x,y}=(z,w) : store / write operation
            else if (id[0] == '{') {
              const vars = flatten(',', lhs[1]) as Token[]

              if (rhs[0] == '@') {
                const sym = rhs[1] as Token
                const func = local.module.funcs[`${sym}`]
                const last = func.body!.at(-1)!
                const returnType = typeOf(last)

                if (returnType === Type.multi) {
                  if (vars.length > last.length) {
                    throw new CompilerError(
                      new CompilerErrorCauses.TypeErrorCause(
                        lhs[0] as Token,
                        `Too many vars (\`${vars.length}\`) - must be equal or less than the values returned by \`${sym}\`: ${last.length}`
                      )
                    )
                  }

                  const global_mem_ptr =
                    global.scope.ensure_sym('global_mem_ptr').sym
                  const local_mem_ptr = local.scope.add(
                    Type.i32,
                    'local_mem_ptr'
                  )

                  let added = 0
                  const result = typeAs(Type.none, [
                    local.build(rhs, ops), // function call
                    ...Array.from(
                      { length: last.length - vars.length },
                      () => 'drop'
                    ),
                    vars.map((id: Token | string, i) => {
                      const result = []
                      const sym = local.scope.add(Type.f32, id)
                      // console.log(sym.id, sym.type)

                      if (!(sym.id in local.offsets)) {
                        // result.push(local_mem_ptr.set(global_mem_ptr.get()))
                        added++

                        const current = Object.keys(local.offsets).length
                        local.offsets[sym.id] = current << 2
                      }
                      // const offset = local.offsets[sym.id]
                      // console.log(typeOf(last[i]))
                      result.push([
                        sym.set(typeAs(typeOf(last[i]), [])),
                      ])
                      return typeAs(Type.none, result)
                    }).reverse().concat(vars.map((id) => {
                      const { sym } = local.scope.ensure_sym(id)
                      const offset = local.offsets[sym.id]
                      return typeAs(Type.none, [
                        `f32.store offset=${offset}`,
                        local_mem_ptr.get(),
                        cast(Type.f32, denan(sym.get())),
                      ])
                    })), // consume stack in reverse
                  ])
                  if (added) {
                    result.unshift(
                      local_mem_ptr.set(global_mem_ptr.get())
                    )
                    result.push(global_mem_ptr.set(
                      i32.add(
                        i32.const(added << 2),
                        global_mem_ptr.get()
                      )
                    ))
                  }
                  // console.log(S(result))
                  return result
                } else if (vars.length === 1) {
                  const v = vars[0] as unknown as string
                  return typeAs(Type.none, [
                    local.build(rhs, ops), // function call
                    [`f32.store offset=${local.offsets[v]}`, [
                      'local.get',
                      '$local_mem_ptr',
                    ], [
                      'local.tee',
                      '$' + v,
                      cast(Type.f32, denan([])),
                    ]],
                  ])
                } else {
                  throw new CompilerError(
                    new CompilerErrorCauses.InvalidErrorCause(
                      sym,
                      'not implemented'
                    )
                  )
                }
              }

              const vals = local.map(flatten(',', rhs), ops)
              if (vals.length !== vars.length) {
                throw new CompilerError(
                  new CompilerErrorCauses.TypeErrorCause(
                    id,
                    `number of variables(\`${vars.length}\`) do not match number of values(\`${vals.length}\`)`
                  )
                )
              }
              return typeAs(
                Type.none,
                vars.map((sym: Token | string, i) => [
                  `f32.store offset=${local.offsets[sym as string]}`,
                  ['local.get', '$local_mem_ptr'],
                  ['local.tee', '$' + sym, cast(Type.f32, denan(vals[i]))],
                ])
              )
            } // (x,y)=(z,w) : multivalue assignment
            else if (id[0] == ',') {
              const ids = flatten(',', lhs) as Token[]

              // if function call or buffer read
              if (rhs[0] == '@') {
                const sym = rhs[1] as Token

                // (x,y)=#(z) : buffer read at offset `z` and expand/destructure tuple values to variables `x,y`
                if (sym[0] == '#') {
                  const buffer = local.get_buffer(sym)

                  if (ids.length > +buffer.elements) {
                    throw new CompilerError(
                      new CompilerErrorCauses.TypeErrorCause(
                        ids.at(-1)!,
                        `number of variables(\`${ids.length}\`) are greater than the number of buffer elements(\`${buffer.elements}\`)`
                      )
                    )
                  }

                  const offset = local.build(rhs[2] as Token, ops)

                  const temp_buffer_pos = local.scope.add(
                    Type.i32,
                    'temp_buffer_pos'
                  )

                  return typeAs(Type.none, [
                    temp_buffer_pos.set(buffer.get_pos(offset)),
                    ids.map((id, i) =>
                      local.scope.set(
                        id,
                        buffer.read_at_pos(temp_buffer_pos.get(), i)
                      )
                    ),
                  ])
                } // (a,b)=f() : TODO: function call multi-value return assignment
                else {
                  const func = local.module.funcs[`${sym}`]
                  // console.log(sym, func)
                  const last = func.body!.at(-1)!
                  const returnType = typeOf(last)

                  if (returnType === Type.multi) {
                    if (ids.length > last.length) {
                      throw new CompilerError(
                        new CompilerErrorCauses.TypeErrorCause(
                          lhs[0] as Token,
                          `Too many values (\`${ids.length}\`) - must be equal or less than the values returned by \`${sym}\`: ${last.length}`
                        )
                      )
                    }

                    const result = typeAs(Type.none, [
                      local.build(rhs, ops), // function call
                      ...Array.from(
                        { length: last.length - ids.length },
                        () => 'drop'
                      ),
                      ids.map((id, i) =>
                        local.scope.set(id, typeAs(typeOf(last[i]), []))
                      ).reverse(), // consume stack in reverse
                    ])
                    return result
                  } else {
                    throw new CompilerError(
                      new CompilerErrorCauses.InvalidErrorCause(
                        sym,
                        'not implemented'
                      )
                    )
                  }
                }
              } // else try regular var=value assignment
              else {
                const ids_raw = flatten(',', rhs)
                if (ids.length != ids_raw.length) {
                  throw new CompilerError(
                    new CompilerErrorCauses.TypeErrorCause(
                      rhs[0] as Token,
                      `number of values(\`${ids_raw.length}\`) do not match number of variables(\`${ids.length}\`)`
                    )
                  )
                }
                const vals = local.map(ids_raw, ops)
                return ids.map((id, i) => local.scope.set(id, vals[i]))
              }
            } // invalid
            else {
              throw new CompilerError(
                new CompilerErrorCauses.SyntaxErrorCause(
                  lhs[0] as Token,
                  'invalid assignment'
                )
              )
            }
          } else {
            // #x=y | #x=(y,z): buffer write and advance needle
            if (lhs[0] === '#') {
              const buffer = local.get_buffer(lhs)
              const rhs_raw = flatten(',', rhs)
              if (+buffer.elements != rhs_raw.length) {
                throw new CompilerError(
                  new CompilerErrorCauses.TypeErrorCause(
                    lhs,
                    `number of values(\`${rhs_raw.length}\`) do not match number of elements(\`${buffer.elements}\`)`
                  )
                )
              }

              // map build values
              const vals = local.map(rhs_raw, ops)

              const temp_buffer_pos = local.scope.add(
                Type.i32,
                'temp_buffer_pos'
              )

              // dprint-ignore
              return typeAs(Type.none, [
                // write buffer position in temporary variable
                temp_buffer_pos.set(buffer.get_pos(void 0, true)),
                ...vals.map((val, i) =>
                  buffer.write_at_pos(temp_buffer_pos.get(), i, val)
                ),
                // needle = (needle + 1) % size
                buffer.set_needle(
                  ['select',
                    i32.const(0),
                    i32.add(i32.const(1), buffer.needle),
                    i32.eq(buffer.needle, buffer.size_m1)
                  ],
                ),
              ])
            } // x=y : variable assignment
            else {
              const value = local.build(rhs, ops)
              const scope = local.scope.lookup(lhs)
              const sym = scope.add(typeOf(value), lhs)
              return sym.set(value)
            }
          }
        },

    // x?y:z : ternary conditional
    '?': (cond, then_body, else_body) => {
      const type = hi(then_body, else_body)
      return typeAs(type, [
        'if',
        ['result', max(Type.i32, type)],
        cast(Type.bool, cond),
        ['then', cast(type, then_body)],
        ['else', cast(type, else_body)],
      ])
    },

    // x?=y:z : ternary conditional using select
    // TODO: testing to see if select works for everything
    // '?': (cond, then_body, else_body) => {
    //   const type = hi(then_body, else_body)
    //   return typeAs(type, [
    //     'select',
    //     cast(type, then_body),
    //     cast(type, else_body),
    //     cond,
    //   ])
    // },

    // logical Or
    '||': (): NodeOp =>
      (local, ops) =>
        (...nodes) => {
          const [lhs, rhs] = local.map(nodes, ops)
          const type = hi(lhs, rhs)
          const temp = local.scope.add(type, '__lhs__' + type)
          const zero = top(type, ['const', '0'])

          return typeAs(type, [
            'if',
            ['result', max(Type.i32, type)],
            top(type, ['ne', zero, temp.tee(lhs)]),
            ['then', temp.get()],
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

    '**': (lhs, rhs) =>
      typeAs(Type.f32, ['call', '$pow', ...castAll(Type.f32, lhs, rhs)]),

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
    // x>>y : bitwise shift right
    '>>>': typebin(Type.i32, 'shr_u'),
    // x<<y : bitwise shift left
    '<<': typebin(Type.i32, 'shl'),

    '+': [
      // x+y : arithmetic add
      bin(Type.i32, 'add'),
      // +x  : cast to number
      (x) => cast(max(Type.i32, typeOf(x)), x),
    ],
    '-': [
      // x-y : arithmetic subtract
      bin(Type.i32, 'sub'),
      // -x  : arithmetic negate
      (x) =>
        bin(Type.i32, 'mul')(top(max(Type.i32, typeOf(x)), ['const', '-1']), x),
    ],

    '*': [
      // x*y : arithmetic multiply
      bin(Type.i32, 'mul'),
      // *x  : send reference (currently only for buffer *#b)
      (): CtxOp =>
        (local) =>
          (id) => {
            if (id[0] !== '#')
              throw new CompilerError(
                new CompilerErrorCauses.SyntaxErrorCause(
                  id as Token,
                  'buffer variables must begin with a hash(`#`) symbol'
                )
              )

            const buffer = local.get_buffer(id as Token)
            const { sym } = buffer

            if (+buffer.elements > 1)
              throw new CompilerError(
                new CompilerErrorCauses.TypeErrorCause(
                  id as Token,
                  `passed by reference buffers can only be single(\`1\`) element, instead found "${buffer.elements}" elements in "${sym}"`
                )
              )

            return buffer.pointer
          },
    ],
    // x/y : arithmetic divide
    //  note: division casts to float, this way it doesn't trap and
    //    also makes more sense: 1/2==0.5
    '/': bin(Type.f32, 'div'),
    // x%y : modulo/remainder
    '%': (lhs, rhs) => {
      const type = hi(lhs, rhs)
      if (type === Type.f32)
        return typeAs(Type.f32, [
          'call',
          '$mod',
          ...castAll(Type.f32, lhs, rhs),
        ])
      if (type === Type.bool) return top(Type.i32, ['rem_s', lhs, rhs])
      return top(Type.i32, ['rem_u', lhs, rhs])
    },
    // x%%y : modulo wrap (wraps negative numbers around)
    '%%': (lhs, rhs) =>
      typeAs(Type.f32, ['call', '$modwrap', ...castAll(Type.f32, lhs, rhs)]),
    // !x : logical Not
    '!': (x) => top(Type.bool, ['eqz', x]),
    // ~x : bitwise NOT
    '~': (x) => top(Type.i32, ['not', x]),

    '\'': (x) => {
      const id = mod.exported_id++
      exported.set(x, id)
      return x
    },

    // {x,y,z} : load / read operations
    '{': (): CtxOp =>
      (local) =>
        (rhs) => {
          const local_mem_ptr = local.scope.add(Type.i32, 'local_mem_ptr')
          const global_mem_ptr = global.scope.ensure_sym('global_mem_ptr').sym

          const vars = (<Token[]>flatten(',', rhs)).map((id: Token, i) => {
            const offset = i << 2
            const op = typeAs(Type.f32, [
              `f32.load offset=${offset}`,
              cast(Type.i32, local_mem_ptr.get()),
            ])
            const sym = local.scope.add(typeOf(op), id)
            local.offsets[sym.id] = offset
            return sym.set(op)
          })
          // dprint-ignore
          return [
            // store the global memory pointer for our context for later writes
            local_mem_ptr.set(global_mem_ptr.get()),
            ...vars,
            // advance the global memory pointer
            global_mem_ptr.set(
              i32.add(
                i32.const(vars.length << 2),
                global_mem_ptr.get()
              )
            )
          ]
        },
    '[': todo,
    '(': todo,
    '@': (): CtxOp =>
      (local, ops) =>
        (lhs, rhs) => {
          const id = lhs as Token
          // #b(x) : buffer read `b` at offset `x`
          if (id[0] === '#') {
            const offset = local.build(rhs, ops)
            // if (typeOf(offset) === Type.f32) {
            //   return funcCall('cubic', [
            //     local.get_buffer(id).pointer,
            //     offset
            //   ])
            // } else {
            // console.log(id, offset, local.get_buffer(id))
            return local.get_buffer(id).read_at(offset)
            // }
          } // f() : function call
          else {
            // evaluate argument expressions
            const args = local.map(flatten(',', rhs), ops)
            return funcCall(id, args)
          }
        },
    '.': todo,

    // dprint-ignore
    while: (cond, body) =>
      ['loop $while_loop_' + ++while_loop_id, body, ['br_if $while_loop_' + while_loop_id, [
        ['select',
          ['i32.const', '0'],
          cond,
          [ // why no global.tee :(
            ['global.set', '$infinite_loop_guard', ['i32.add', ['i32.const', '1'],
              ['global.get', '$infinite_loop_guard']]],

            ['i32.ge_s',
              ['global.get', '$infinite_loop_guard'],
              ['global.get', '$max_loop']
            ]
          ]
        ]
      ]]],

    drop: () => ['drop'],

    num: (): CtxOp =>
      () => (lit) => top(infer(lit as any), ['const', lit as any]),

    kwd: (): CtxOp => () => (x) => [x] as SExpr,

    ids: (): CtxOp =>
      (local) =>
        (lhs) => {
          const id = lhs as Token
          // #b : buffer read at current position (not the needle's position)
          if (lhs[0] === '#') {
            return local.get_buffer(id).read_at()
          }

          return local.scope.ensure_sym(id).sym.get()
        },
  }

  /** arguments optable */
  const OpParams: OpTable = {
    ...Op,
    '\'': (): CtxOp =>
      (local, ops) =>
        (lhs) => {
          let id = lhs as Token & string
          if (Array.isArray(id)) id = local.build(id, ops)[0] as Token & string
          const param = mush(local.params, { id, export: true }) as Arg
          local.scope.add(param.type ??= Type.f32, id)
          return [id]
        },
    '=': (): CtxOp =>
      (local, ops) =>
        (lhs, value) => {
          let id = lhs as Token & string

          // if it's not an atom then it has ranges
          if (Array.isArray(id)) id = local.build(id, ops)[0] as Token & string

          const defaultValue = local.build(value, Op)
          const param = mush(local.params, { id, default: defaultValue }) as Arg

          const type = hi(param.default!, ...(param.range ?? []))
          param.default = cast(type, param.default!)

          local.scope.add(param.type = type, id)

          if (param.range) {
            param.range[0] = cast(type, param.range[0] as SExpr)
            param.range[1] = cast(type, param.range[1] as SExpr)
          }

          return [id]
        },
    '[': (): CtxOp =>
      (local) =>
        (lhs, rhs) => {
          const id = lhs as Token & string

          if (rhs == null) {
            throw new CompilerError(
              new CompilerErrorCauses.InvalidErrorCause(
                id,
                'Invalid parameter range for'
              )
            )
          }

          const range = local.build(rhs, Op) as [SExpr, SExpr]
          if (!Array.isArray(range[0]) || !Array.isArray(range[1])) {
            throw new CompilerError(
              new CompilerErrorCauses.InvalidErrorCause(
                id,
                'Invalid parameter range for'
              )
            )
          }

          const param = mush(local.params, { id, range }) as Arg
          const type = hi(param.default!, ...range)

          if (param.default) param.default = cast(type, param.default)

          local.scope.add(param.type = type, id)

          range[0] = cast(type, range[0])
          range[1] = cast(type, range[1])

          return [id] as SExpr
        },
    ids: (): CtxOp =>
      (local) =>
        (lhs) => {
          const id = lhs as Token & string
          if (id[0] === '#') {
            const type = Type.i32
            mush(local.params, { id, type })
            local.scope.add(type, id)
            // passed by reference buffers can only be single (1) element i.e linear memory, not structs
            local.elements[id] = id.as('1', 'num') as Token
          } else {
            const type = Type.f32
            mush(local.params, { id, type })
            local.scope.add(type, id)
          }
          return [id]
        },
  }

  return { Op, OpParams }
}
