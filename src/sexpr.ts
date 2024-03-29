import { Token } from 'tinypratt'

export interface SExpr extends Array<string | (string & Token) | SExpr> {
  [n: number]: string | (string & Token) | SExpr
}

export const S = (p: string | (string & Token) | SExpr, x = 0): string => {
  return Array.isArray(p)
    ? p.length
      ? Array.isArray(p[0])
        ? p.map(e => '\n' + S(e, x + 2)).join(' ') // TODO: ident
        : `${' '.repeat(x)}(${p[0]} ${
          p
            .slice(1)
            .map(e => (Array.isArray(e) ? '\n' : '') + S(e, x + 2))
            .join(' ')
        })`
      : ''
    : p
}

export const S0 = (p: string | (string & Token) | SExpr): string => {
  return Array.isArray(p)
    ? p.length
      ? Array.isArray(p[0])
        ? p.map(x => S0(x)).join(' ')
        : `(${p[0]} ${
          p
            .slice(1)
            .map(e => S0(e))
            .join(' ')
        })`
      : ''
    : p
}
