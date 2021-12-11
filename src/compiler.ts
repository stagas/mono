import { Typed, Type } from './typed'
import { SExpr } from './sexpr'
import { Node } from './parser'
import { flatten } from './util'

interface Op {
  (...elements: SExpr[]): SExpr
}

interface RawOp {
  (): (scope: Scope) => (...nodes: Node[]) => SExpr
}

interface OpTable {
  [k: string]: null | RawOp | Op | Op[]
}

type Scope = Record<string, Type>

type Func = [SExpr, SExpr, SExpr | string]

export { Type }

export const compile = (node: Node, global: Scope = {}, type = Type.any) => {
  const scopes = new Map<Func, Scope>()
  const funcs: Record<string, Func> = {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const panic = (node as any).panic // TODO: resolve this in tinypratt

  const { typeOf, typeAs, cast, hi, max, top, infer } = Typed(panic)

  const bin = (maxType: Type, op: string) => (lhs: SExpr, rhs: SExpr) => top(max(maxType, hi(lhs, rhs)), [op, lhs, rhs])

  const todo = null

  const parseFunc = (scope: Scope, sym: string, args: SExpr, rhs: Node) => {
    const body = flatten(';', rhs)
    const last = body.pop()
    // console.log('BODY', body)
    // console.log('LAST', last)
    const func: Func = [args, body.map(x => build(x as Node, scope)), build(last as Node, scope)]
    funcs[sym] = func
    scopes.set(func, scope)
    return func
  }

  const Op: OpTable = {
    ',': todo,
    ';': todo,
    '..': todo,

    '=': () => (local: Scope) => (lhs: Node, rhs: Node) => {
      // f()=x : function declaration
      if (Array.isArray(lhs)) {
        if (lhs[0] != '@') {
          throw new SyntaxError(panic('invalid assignment', lhs[0]))
        }
        const [sym, args] = [lhs[1], flatten(',', lhs[2])]
        const scope = Object.fromEntries(args.map(x => [x, Type.f32]))
        parseFunc(scope, sym, args, rhs)
        return []
      }
      // x=y : variable assignment
      else {
        const symbol = lhs
        const value = build(rhs, local)
        const scope = symbol in local ? local : symbol in global ? global : local
        const type = symbol in scope ? scope[symbol] : (scope[symbol] = typeOf(value))
        return typeAs(type, [(scope === global ? 'global' : 'local') + '.set', '$' + symbol, cast(type, value)])
      }
    },
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
    '!': x => top(Type.bool, ['eqz', x]),
    '~': todo,

    '++': todo,
    '=+': todo,
    '--': todo,
    '=-': todo,
    '[': todo,
    '(': todo,
    '@': todo,
    '.': todo,
  }

  const build = (node: Node, scope: Scope, type = Type.any): SExpr => {
    if (Array.isArray(node)) {
      const [sym, ...nodes] = node
      if (!sym || !nodes.length) return []
      let op = Op[sym]
      if (!op) throw new Error(panic('not implemented', sym))
      if (Array.isArray(op)) op = op.find(x => x.length === nodes.length) || op[0]
      return cast(type, (op.length ? op(...nodes.map(x => build(x, scope))) : (op as RawOp)()(scope)(...nodes)) as SExpr)
    } else {
      return top(infer(node), ['const', node]) // literal
    }
  }

  parseFunc(global, '__start__', [], node)

  const mod = {
    body: [['start', '$__start__']] as SExpr,
    funcs,
    scopes,
    valueOf() {
      return this.body
    },
  }

  for (const [sym, func] of Object.entries(funcs)) {
    const [args, body, last] = func
    mod.body.push([
      'func',
      '$' + sym,
      ['export', `"${sym}"`],
      ...args.map(x => ['param', '$' + x, 'f32']),
      ['result', max(Type.i32, typeOf(last))],
      ...body,
      ...last,
    ])
  }

  return mod
}
