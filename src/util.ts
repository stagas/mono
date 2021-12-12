import { Node } from './parser'

export const flatten = (sym: string, x: Node): Node[] =>
  Array.isArray(x)
    ? x[0] == sym //
      ? [...flatten(sym, x[1]), x[2]]
      : [x]
    : [x]

// mush is like upsert for arrays: Merge or pUSH -> mush :)
export const mush = (arr: (unknown & { id: string })[], obj: Record<string, unknown> & { id: string }) => {
  const el = arr.find(x => x.id == obj.id)
  if (el) Object.assign(el, obj)
  else arr.push(obj)
}
