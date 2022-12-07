import { Node, Token } from './parser'

/** flattens a node that is left hand side recursing on symbol `sym` */
export const flatten = (sym: string, x: Node): Node[] =>
  Array.isArray(x)
    ? x[0] == sym as any //
      ? [...flatten(sym, x[1]), x[2]]
      : [x]
    : [x]

export const unflatten = (sym: Token, x: Node): Node[] =>
  x.length > 1 ? ([sym, unflatten(sym, x.slice(0, -1) as Node[]), x.at(-1)] as Node[]) : (x[0] as Node[])

/** Merges or pUSHes `obj` to array `arr` */
export const mush = (arr: (unknown & { id: string })[], obj: Record<string, unknown> & { id: string }) => {
  const el = arr.find((x) => x.id == obj.id)
  if (el) Object.assign(el, obj)
  else arr.push(obj)
  return el ?? obj
}

const X = RegExp
export const join = (s: string | undefined, ...r: RegExp[]) => X(`(${r.map((x) => `(${x.source})`).join(s)})`)
export const split = (s: string) =>
  X(
    `(${
      s
        .split(' ')
        .map((x: string) => x.replace(/[\^$\\()[\]?*+\-.|]/g, '\\$&').trim())
        .filter((x: string | any[]) => x.length)
        .join('|')
    })`
  )
export const modify = (m: string, x: RegExp) => X(`(${x.source})${m}`)
