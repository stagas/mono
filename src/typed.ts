import { CompilerError, CompilerErrorCauses } from './compiler'
import { Token } from './parser'
import { SExpr } from './sexpr'

export enum Type {
  any = 'any',
  bool = 'bool',
  i32 = 'i32',
  f32 = 'f32',
}

export const Types: Type[] = [Type.any, Type.bool, Type.i32, Type.f32]

export const W = (x: Type) => Types.indexOf(x)

/** returns at least the precision of the given type among the given types */
export const max = (type: Type, ...types: Type[]): Type => {
  return Types[Math.max(Types.indexOf(type), ...types.map(x => Types.indexOf(x)))]
}

export const Typed = () => {
  const types = new Map<object | string, Type>()

  const OpTypeCast: Record<Type, Partial<Record<Type, string>>> = {
    [Type.any]: {},
    [Type.f32]: {
      [Type.i32]: 'f32.convert_i32_s',
      [Type.bool]: 'f32.convert_i32_u',
    },
    [Type.i32]: {
      [Type.f32]: 'i32.trunc_f32_s',
    },
    [Type.bool]: {
      [Type.f32]: 'i32.trunc_f32_u',
    },
  }

  /** looks up and returns the type of `x`, if found, otherwise returns type `any` */
  const typeOf = (x: undefined | string | SExpr): Type => ((x && types.get(x)) ?? Type.any) as Type

  /** marks sexpr `x` to be of type `type` */
  const typeAs = (type: Type, x: SExpr) => {
    if (typeof x === 'string') return x // TODO: why are tokens infected with typeAs? only SExpressions should
    types.set(x, type)
    return x
  }

  /** creates a cast operation if the given value `x` doesn't satisfy `type` */
  const cast = (targetType: Type, x: SExpr) => {
    const sourceType = typeOf(x)
    if (sourceType != targetType) {
      const castOp = OpTypeCast[targetType][sourceType]
      if (!castOp) return typeAs(targetType, x) // noop cast, but change the type for x
      return typeAs(targetType, [castOp, x])
    } else {
      return typeAs(targetType, x) // x is any or unknown, so set the type for x
    }
  }

  /** casts all `values` to be of type `type` */
  const castAll = (type: Type, ...values: SExpr): SExpr => values.map(x => cast(type, x as SExpr))

  /** returns the highest precision type of the given values */
  const hi = (...values: SExpr): Type => {
    const weights = values.filter(Boolean).map(x => W(typeOf(x)))
    return Types[Math.max(...weights)]
  }

  /** types an operation with the correct prefix (f32 or i32) and type casts the values to satisfy the op */
  const top = (type: Type, ops: SExpr): SExpr => {
    const prefix = type == Type.f32 ? 'f32' : 'i32'
    const [op, ...values] = ops
    return typeAs(type, [prefix + '.' + op, ...castAll(type, ...values)])
  }

  /** infers the type of a token literal string: bool for 0 or 1, i32 for integers and f32 for floats */
  const infer = (x: Token): Type => {
    if (x == '0' || x == '1') return Type.bool
    else if (!x.includes('.')) return Type.i32
    else if (x.includes('.')) return Type.f32
    else throw new CompilerError(new CompilerErrorCauses.TypeErrorCause(x, 'cannot infer type for'))
  }

  return { typeOf, typeAs, cast, castAll, hi, max, top, infer }
}
