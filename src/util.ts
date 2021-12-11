import { SExpr } from './sexpr'

export const flatten = (sym: string, x: string | SExpr): SExpr => (Array.isArray(x) ? (x[0] == sym ? [...flatten(sym, x[1]), x[2]] : [x]) : [x])
