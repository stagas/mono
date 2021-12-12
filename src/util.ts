import { Node } from './parser'

export const flatten = (sym: string, x: Node): Node[] =>
  Array.isArray(x)
    ? x[0] == sym //
      ? [...flatten(sym, x[1]), x[2]]
      : [x]
    : [x]
