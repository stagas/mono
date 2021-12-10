export interface SExpr extends Array<null | string | SExpr> {
  [n: number]: null | string | SExpr
}

export const S = (p: SExpr, x = 0): string => {
  return `${' '.repeat(x)}(${p[0]} ${p
    .slice(1)
    .map(e => (Array.isArray(e) ? '\n' + S(e, x + 2) : e))
    .join(' ')})`
}

export const S0 = (p: SExpr): string => {
  return `(${p[0]} ${p
    .slice(1)
    .map(e => (Array.isArray(e) ? S(e) : e))
    .join(' ')})`
}
