import { Typed, Type } from './typed'
import { Node, Token } from './parser'
import { SExpr, S } from './sexpr'
import { flatten, mush } from './util'

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

interface Scope {
  [k: string]: Type
}

interface Arg {
  id: Token
  default?: SExpr
  range?: SExpr
}

interface Context {
  scope: Scope
  args: Arg[]
}

type Func = [SExpr, SExpr]

export interface Imports {
  [k: string]: { params: Type[]; result: Type }
}

export interface Module {
  body: SExpr
  funcs: Record<string, Func>
  contexts: Map<Func, Context>
  valueOf(): SExpr
  toString(include?: string[]): string
}

export { Type }

export const compile = (node: Node, imports: Imports = {}) => {
  const global = { scope: {}, args: [] }
  const contexts: Module['contexts'] = new Map()
  const funcs: Module['funcs'] = {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const panic = (node as any).panic // TODO: resolve this in tinypratt

  // create types
  const { typeOf, typeAs, cast, castAll, hi, max, top, infer } = Typed(panic)

  for (const [name, { params, result }] of Object.entries(imports)) {
    const func: Func = [[], typeAs(result as Type, [])]
    funcs[name] = func
    const ctx: Context = {
      scope: {},
      args: params.map((x: string, i) => ({
        id: i.toString(),
        default: typeAs(x as Type, [x + '.const', '0']),
      })) as Arg[],
    }
    contexts.set(func, ctx)
  }

  /** todo is a "not implemented" marker for ops */
  const todo = null

  /** constructs a binary op of least type `type` */
  const bin =
    (type: Type, op: string): Op =>
    (lhs, rhs) =>
      top(max(type, hi(lhs, rhs)), [op, lhs, rhs])

  /** constructs a binary op of exact type `type` */
  const typebin =
    (type: Type, op: string): Op =>
    (lhs, rhs) =>
      top(type, [op, lhs, rhs])

  /** constructs an equality op */
  const eq =
    (op: string): Op =>
    (lhs, rhs) => {
      const type = max(Type.i32, hi(lhs, rhs))
      if (type === Type.f32) return typeAs(Type.bool, top(Type.f32, [op, lhs, rhs]))
      return typeAs(Type.bool, top(Type.i32, [op + '_s', lhs, rhs]))
    }

  /** defines a function */
  const funcDef = (ctx: Context, ops: OpTable, sym: string, args: Node[], rhs: Node) => {
    const body = map(flatten(';', rhs), ctx, ops)
    const func: Func = [map(args, ctx, OpArgs), typeAs(typeOf(body.at(-1)), body)]
    funcs[sym] = func
    contexts.set(func, ctx)
    return func
  }

  /** primary optable */
  const Op: OpTable = {
    ',': todo,
    ';': todo,
    '..': todo,

    '=': (): CtxOp => (local, ops) => (lhs, rhs) => {
      // f()=x : function declaration
      if (Array.isArray(lhs)) {
        if (lhs[0] != '@') throw new SyntaxError(panic('invalid assignment', lhs[0]))
        const [sym, args] = [lhs[1], flatten(',', lhs[2]).filter(Boolean)] as [Token, Node[]]
        const scope = Object.fromEntries(args.map(x => [x, Type.f32]))
        const ctx = { scope, args: [] }
        funcDef(ctx, ops, sym, args, rhs)
        return []
      }
      // x=y : variable assignment
      else {
        const symbol = lhs
        const value = build(rhs, local, ops)
        const scope = symbol in local.scope ? local.scope : symbol in global.scope ? global.scope : local.scope
        const type = symbol in scope ? scope[symbol] : (scope[symbol] = typeOf(value))
        return typeAs(type, [(scope === global.scope ? 'global' : 'local') + '.set', '$' + symbol, cast(type, value)])
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

    // logical Or
    '||':
      (): NodeOp =>
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
    '%': (lhs, rhs) => {
      const type = hi(lhs, rhs)
      if (type === Type.f32) return ['call', '$mod', ...castAll(Type.f32, lhs, rhs)]
      if (type === Type.bool) return top(Type.i32, ['rem_s', lhs, rhs])
      return top(Type.i32, ['rem_u', lhs, rhs])
    },
    // !x : logical Not
    '!': x => top(Type.bool, ['eqz', x]),
    // ~x : bitwise NOT
    '~': x => top(Type.i32, ['not', x]),

    '[': todo,
    '(': todo,
    '@': (): CtxOp => (local, ops) => (sym, rhs) => {
      const func = funcs[sym]
      if (!func) throw new ReferenceError(panic('function not defined', sym))
      const body = func[1]
      const type = typeOf(body)
      const ctx = contexts.get(func)!
      // evaluate argument expressions
      const args = map(flatten(',', rhs), local, ops)
      // examine function argument declarations against passed arguments
      ctx.args.forEach((arg, i) => {
        // function argument declaration has default value
        if (arg.default) {
          // missing passed argument becomes the default value
          if (!args[i]) args[i] = arg.default
          // has passed argument but cast it to correct type
          else args[i] = cast(typeOf(arg.default), args[i])
        }
        // function argument declaration has range
        else if (arg.range) {
          // missing passed argument becomes the start of range value
          if (!args[i]) args[i] = arg.range[0] as SExpr
          // has passed argument but cast it to correct type
          else args[i] = cast(hi(...arg.range), args[i])
        }
        // has passed argument but no default, it is cast implicitly to f32
        else if (args[i]) args[i] = cast(Type.f32, args[i])
        // did not pass argument and no default, so implicitly push a zero f32 (0.0)
        else args[i] = ['f32.const', '0']
      })
      // truncate number of passed arguments down to the accepted function arguments
      args.length = ctx.args.length
      // call the function
      return typeAs(type, ['call', '$' + sym, ...args])
    },
    '.': todo,

    num: (): CtxOp => () => lit => top(infer(lit), ['const', lit]),

    ids: (): CtxOp => local => symbol => {
      const scope = symbol in local.scope ? local.scope : symbol in global.scope ? global.scope : local.scope
      if (!(symbol in scope)) throw new ReferenceError(panic('symbol not defined', symbol))
      const type = scope[symbol]
      return typeAs(type, [(scope === global.scope ? 'global' : 'local') + '.get', '$' + symbol])
    },
  }

  /** arguments optable */
  const OpArgs: OpTable = {
    ...Op,
    '..': (lhs, rhs) => [lhs, rhs],
    '=': (): CtxOp => (local, ops) => (id, value) => {
      // if it's not an atom then it has ranges
      if (Array.isArray(id)) id = build(id, local, ops)[0] as Token
      mush(local.args, { id, default: build(value, local, ops) })
      return [id]
    },
    '[': (): CtxOp => (local, ops) => (id, range) => (mush(local.args, { id, range: build(range, local, ops) }), [id]),
    ids: (): CtxOp => local => id => (mush(local.args, { id }), [id]),
  }

  /** builds a `node` under context `ctx` and optable `ops` */
  const build = (node: Node, ctx: Context, ops: OpTable): SExpr => {
    if (Array.isArray(node)) {
      const [sym, ...nodes] = node as [Token, Node[]]
      if (!sym || !nodes.length) return []
      let op = ops[sym]
      if (!op) throw new Error(panic('not implemented', sym))
      if (Array.isArray(op)) op = op.find(x => x.length === nodes.length) || op[0]
      return op.length ? (<Op>op)(...map(nodes, ctx, ops)) : (<() => NodeOp>op)()(ctx, ops)(...nodes)
    } else {
      const op = ops[node.group]
      if (!op) throw new Error(panic ? panic('not implemented', node) : 'not implemented: ' + node)
      return (<() => CtxOp>op)()(ctx, ops)(node)
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

  // create start function
  funcDef(global, Op, '__start__', [], node)

  // create module
  const mod: Module = {
    body: [['start', '$__start__']] as SExpr,
    funcs,
    contexts,
    valueOf() {
      return this.body
    },
    toString(include = []) {
      return S(['module', ...include, ...this.body])
    },
  }

  // create functions
  for (const [sym, func] of Object.entries(funcs)) {
    if (sym in imports) continue
    const [args, body] = func
    const ctx = contexts.get(func)!
    mod.body.push([
      'func',
      '$' + sym,
      ['export', `"${sym}"`],
      ...args.map(x => ['param', '$' + x, ctx.scope[x as Token]]),
      ...(body.length && sym !== '__start__' ? [['result', max(Type.i32, typeOf(body))]] : []),
      ...Object.entries(ctx.scope)
        .filter(([x]) => !args.find(y => y == x))
        .map(([x, type]) => ['local', '$' + x, max(Type.i32, type)]),
      ...(sym === '__start__' ? (body.length ? [...body, 'drop'] : []) : body),
    ])
  }

  return mod
}
