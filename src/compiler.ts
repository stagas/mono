import { Typed, Type } from './typed'
import { Node, Token } from './parser'
import { SExpr } from './sexpr'
import { flatten, mush } from './util'

interface NodeOp {
  (node: Node, local: Context, ops: OpTable): SExpr
}

interface Op {
  (...sexprs: SExpr[]): SExpr
}

interface RawOp {
  (): (local: Context, ops: OpTable) => (...nodes: Node[]) => SExpr
}

interface OpTable {
  [k: string]: null | RawOp | NodeOp | Op | Op[]
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

export { Type }

export const compile = (node: Node, global: Context = { scope: {}, args: [] }) => {
  const contexts = new Map<Func, Context>()
  const funcs: Record<string, Func> = {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const panic = (node as any).panic // TODO: resolve this in tinypratt

  const { typeOf, typeAs, cast, hi, max, top, infer } = Typed(panic)

  const bin =
    (maxType: Type, op: string) =>
    (lhs: SExpr, rhs: SExpr): SExpr =>
      top(max(maxType, hi(lhs, rhs)), [op, lhs, rhs])

  const todo = null

  const parseFunc = (ctx: Context, ops: OpTable, sym: string, args: Node[], rhs: Node) => {
    const body = map(flatten(';', rhs), ctx, ops)
    const func: Func = [map(args, ctx, OpArgs), typeAs(typeOf(body.at(-1)), body)]
    funcs[sym] = func
    contexts.set(func, ctx)
    return func
  }

  const Op: OpTable = {
    ',': todo,
    ';': todo,
    '..': todo,

    '=': <RawOp>(() =>
      (local, ops) =>
      (lhs, rhs): SExpr => {
        // f()=x : function declaration
        if (Array.isArray(lhs)) {
          if (lhs[0] != '@') throw new SyntaxError(panic('invalid assignment', lhs[0]))
          const [sym, args] = [lhs[1], flatten(',', lhs[2]).filter(Boolean)] as [Token, Node[]]
          const scope = Object.fromEntries(args.map(x => [x, Type.f32]))
          const ctx = { scope, args: [] }
          parseFunc(ctx, ops, sym, args, rhs)
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
      }),
    '+=': todo,
    '-=': todo,
    '*=': todo,
    '/=': todo,
    '%=': todo,
    '<<=': todo,
    '>>=': todo,
    '&=': todo,
    '^=': todo,
    '|=': todo,

    '?': [
      (cond, if_body, else_body) => {
        const type = hi(if_body, else_body)
        return [
          'if', //
          ['result', type],
          cast(Type.bool, cond),
          ['then', cast(type, if_body)],
          ['else', cast(type, else_body)],
        ]
      },
    ],

    '||': todo,

    '&&': todo,

    '|': todo,

    '^': todo,

    '&': todo,

    '==': todo,
    '!=': todo,

    '<': todo,
    '>': todo,
    '<=': todo,
    '>=': todo,

    '>>': todo,
    '<<': todo,

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
    '%': todo,

    // !x : logical not
    '!': [x => top(Type.bool, ['eqz', x])],
    '~': todo,

    '++': todo,
    '=+': todo,
    '--': todo,
    '=-': todo,
    '[': todo,
    '(': todo,
    '@': <RawOp>(() =>
      (local, ops) =>
      (sym: Token, rhs): SExpr => {
        const func = funcs[sym]
        if (!func) throw new ReferenceError(panic('function not found', sym))
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
        return ['call', '$' + sym, ...args]
      }),
    '.': todo,

    num: <NodeOp>((lit: Token): SExpr => top(infer(lit), ['const', lit])),

    ids: <NodeOp>((symbol: Token, local): SExpr => {
      const scope = symbol in local.scope ? local.scope : symbol in global.scope ? global.scope : local.scope
      if (!(symbol in scope)) throw new ReferenceError(panic('symbol not defined', symbol))
      return [(scope === global.scope ? 'global' : 'local') + '.get', '$' + symbol]
    }),
  }

  const OpArgs: OpTable = {
    ...Op,
    '..': [(lhs, rhs) => [lhs, rhs]],
    '=': <RawOp>(() => (local, ops) => (id: Token, value) => {
      // if it's not an atom then it has ranges
      if (Array.isArray(id)) id = build(id, local, ops)[0] as Token
      mush(local.args, { id, default: build(value, local, ops) })
      return [id]
    }),
    '[': <RawOp>(() => (local, ops) => (id: Token, range) => (mush(local.args, { id, range: build(range, local, ops) }), [id])),
    ids: <NodeOp>((id: Token, local: Context) => (mush(local.args, { id }), [id])),
  }

  const build = (node: Node, ctx: Context, ops: OpTable): SExpr => {
    if (Array.isArray(node)) {
      const [sym, ...nodes] = node as [Token, Node[]]
      if (!sym || !nodes.length) return []
      let op = ops[sym]
      if (!op) throw new Error(panic('not implemented', sym))
      if (Array.isArray(op)) op = op.find(x => x.length === nodes.length) || op[0]
      return <SExpr>(op.length ? (<Op>op)(...map(nodes, ctx, ops)) : (<RawOp>op)()(ctx, ops)(...nodes))
    } else {
      const op = ops[node.group]
      if (!op) throw new Error(panic ? panic('not implemented', node) : 'not implemented: ' + node)
      return (<NodeOp>op)(node, ctx, ops)
    }
  }

  const map = (nodes: Node[], ctx: Context, ops: OpTable): SExpr[] =>
    nodes
      .filter(Boolean)
      .map(x => build(x, ctx, ops))
      .filter(x => x.length > 0)

  parseFunc(global, Op, '__start__', [], node)

  const mod = {
    body: [['start', '$__start__']] as SExpr,
    funcs,
    contexts,
    valueOf() {
      return this.body
    },
  }

  for (const [sym, func] of Object.entries(funcs)) {
    const [args, body] = func
    const ctx = contexts.get(func)!
    mod.body.push([
      'func',
      '$' + sym,
      ['export', `"${sym}"`],
      ...args.map(x => ['param', '$' + x, 'f32']),
      ...(body.length ? [['result', max(Type.i32, typeOf(body))]] : []),
      ...Object.entries(ctx.scope).map(([x, type]) => ['local', '$' + x, max(Type.i32, type)]),
      ...body,
    ])
  }

  return mod
}
