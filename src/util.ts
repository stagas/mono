import { Node } from './parser'

/** flattens a node that is left hand side recursing on symbol `sym` */
export const flatten = (sym: string, x: Node): Node[] =>
  Array.isArray(x)
    ? x[0] == sym //
      ? [...flatten(sym, x[1]), x[2]]
      : [x]
    : [x]

/** merges or pUSHes `obj` to array `arr` */
export const mush = (arr: (unknown & { id: string })[], obj: Record<string, unknown> & { id: string }) => {
  const el = arr.find(x => x.id == obj.id)
  if (el) Object.assign(el, obj)
  else arr.push(obj)
}
