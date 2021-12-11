import { Node } from './parser'
import { SExpr } from './sexpr'
import { Typed, Type } from './typed'

interface Op {
  (...elements: SExpr[]): SExpr
}

interface OpTable {
  [k: string]: Op | Op[]
}

export { Type }

export const compile = (node: Node, type = Type.any) => {
  // const symbols = {}
  const panic = (node as any).panic

  const { typeOf, infer, top, max, hi, cast } = Typed(panic)

  const bin = (maxType: Type, op: string) => (lhs: SExpr, rhs: SExpr) => top(max(maxType, hi(lhs, rhs)), [op, lhs, rhs])

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

    // !x  : logical not
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

  const build = (node: Node, type = Type.any): SExpr => {
    if (Array.isArray(node)) {
      const [sym, ...nodes] = node
      let op = Op[sym]
      if (Array.isArray(op)) {
        op = op.find(x => x.length === nodes.length) || op[0]
      }
      return cast(type, op(...nodes.map(x => build(x))))
    } else {
      return top(infer(node), ['const', node]) // literal
    }
  }

  return build(node, type)
}
