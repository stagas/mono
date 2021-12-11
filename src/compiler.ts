import { Node } from './parser'
import { SExpr } from './sexpr'
import { Typed, Type } from './typed'

interface OpTable {
  [k: string]: (...elements: SExpr[]) => SExpr
}

export { Type }

export const compile = (node: Node, type = Type.any) => {
  // const symbols = {}

  const panic = (node as any).panic

  const { infer, top, min, hi, cast } = Typed(panic)

  const bin = (minType: Type, op: string) => (lhs: SExpr, rhs: SExpr) => top(min(minType, hi(lhs, rhs)), [op, lhs, rhs])

  const todo = () => []

  const Op: OpTable = {
    ',': todo,
    ';': todo,
    '..': todo,

    '=': todo,
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

    '+': bin(Type.i32, 'add'),
    '-': bin(Type.i32, 'sub'),

    '*': bin(Type.i32, 'mul'),
    '/': bin(Type.i32, 'div'),
    '%': todo,

    '!': todo,
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

  const build = (node: Node, type = Type.any): SExpr => {
    if (Array.isArray(node)) {
      const [sym, ...nodes] = node
      return cast(type, Op[sym](...nodes.map(x => build(x))))
    } else {
      return top(infer(node), ['const', node]) // literal
    }
  }

  return build(node, type)
}
