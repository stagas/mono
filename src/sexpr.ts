export interface SExpr extends Array<string | SExpr> {
  [n: number]: string | SExpr
}

export const S = (p: string | SExpr, x = 0): string => {
  return Array.isArray(p)
    ? `${' '.repeat(x)}(${p[0]} ${p
        .slice(1)
        .map(e => (Array.isArray(e) ? '\n' : '') + S(e, x + 2))
        .join(' ')})`
    : p
}

export const S0 = (p: string | SExpr): string => {
  return Array.isArray(p)
    ? `(${p[0]} ${p
        .slice(1)
        .map(e => S0(e))
        .join(' ')})`
    : p
}
