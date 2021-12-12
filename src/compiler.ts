import { Typed, Type } from './typed'
import { SExpr } from './sexpr'
import { Node, Token } from './parser'
import { flatten } from './util'

interface NodeOp {
  (node: Node, ctx: Context, ops: OpTable): SExpr
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

type Scope = Record<string, Type>

interface Arg {
  id: Token
  default?: SExpr
  range?: SExpr
}

type Args = Record<string, Arg>

interface Context {
  scope: Scope
  args: Args
}

type Func = [SExpr, SExpr]

export { Type }

export const compile = (node: Node, global: Context = { scope: {}, args: {} }) => {
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
          const [sym, args] = [lhs[1], flatten(',', lhs[2])] as [Token, Node[]]
          const scope = Object.fromEntries(args.map(x => [x, Type.f32]))
          const ctx = { scope, args: {} }
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

    '?': todo,

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
      (sym: Token, args): SExpr => {
        const func = funcs[sym]
        if (!func) throw new ReferenceError(panic('function not found', sym))
        // TODO: validate op args against func.args
        // pass defaults when missing args
        return ['call', '$' + sym, ...map(flatten(',', args), local, ops).map(x => cast(Type.f32, x))]
      }),
    '.': todo,

    num: <NodeOp>((node: Token) => top(infer(node), ['const', node])),
  }

  const OpArgs: OpTable = {
    ...Op,

    '=': <RawOp>(() => (local, ops) => (id: Token, value) => {
      local.args[id] = {
        id,
        default: build(value, local, ops),
      }
      return [id]
    }),

    ids: <NodeOp>((id: Token, local: Context) => {
      local.args[id] = {
        id,
      }
      return [id]
    }),
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
    mod.body.push([
      'func',
      '$' + sym,
      ['export', `"${sym}"`],
      ...args.map(x => ['param', '$' + x, 'f32']), // TODO: handle range, defaults
      ['result', max(Type.i32, typeOf(body))],
      ...body,
    ])
  }

  return mod
}
