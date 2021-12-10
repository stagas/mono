import { Node } from './parser'
import { SExpr } from './sexpr'

interface OpTable {
  [k: string]: (...elements: Node[]) => SExpr
}

export const compile = (node: Node) => {
  // const symbols = {}

  const Op: OpTable = {
    '+': (lhs, rhs) => ['f32.add', build(lhs), build(rhs)],
  }

  const build = (node: Node): SExpr => {
    if (Array.isArray(node)) {
      const [op, ...rest] = node
      return Op[op](...rest)
    } else {
      // literal
      return ['f32.const', node]
    }
  }

  return build(node)
}
