import { Node } from './parser'
import { SExpr } from './sexpr'

export enum Type {
  any = 'any',
  bool = 'bool',
  i32 = 'i32',
  f32 = 'f32',
  multi = 'multi',
  none = 'none',
}

const I32Suffixed = `
  load8 load16
  lt gt le ge
  div rem shr
  trunc_f32 trunc_f64 extend_i32
  convert_i32 convert_i64
`.split(/\s+/)

export const Types: Type[] = [Type.any, Type.bool, Type.i32, Type.f32, Type.multi, Type.none]

export const W = (x: Type) => Types.indexOf(x)

export const OpTypeCast: Record<Type, Partial<Record<Type, string>>> = {
  [Type.any]: {},
  [Type.multi]: {},
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
  [Type.none]: {
    [Type.bool]: 'i32.const 0',
    [Type.i32]: 'i32.const 0',
    [Type.f32]: 'f32.const 0',
  },
}

export type TypesMap = Map<object | string, Type>

export class Typed {
  static Type = Type
  static Types = Types
  static OpTypeCast = OpTypeCast
  static W = W

  static max = (type: Type, ...types: Type[]): Type => {
    return Types[Math.max(W(type), ...types.map(W))]
  }

  W = Typed.W
  max = Typed.max

  constructor(public types: TypesMap = new Map()) { }

  /** looks up and returns the type of `x`, if found, otherwise returns type `any` */
  typeOf = (x: undefined | string | Node | SExpr): Type => ((x && this.types.get(x)) ?? Type.any) as Type

  /** marks sexpr `x` to be of type `type` */
  typeAs = (type: Type, x: SExpr) => {
    if (typeof x === 'string') return x // TODO: why are tokens infected with typeAs? only SExpressions should
    this.types.set(x, type)
    return x
  }

  /** creates a cast operation if the given value `x` doesn't satisfy `type` */
  cast = (targetType: Type, x: SExpr) => {
    const sourceType = this.typeOf(x)
    if (sourceType != targetType) {
      const castOp = OpTypeCast[targetType]?.[sourceType]
      if (!castOp) return this.typeAs(targetType, x) // noop cast, but change the type for x
      return this.typeAs(targetType, [castOp, x])
    } else {
      return this.typeAs(targetType, x) // x is any or unknown, so set the type for x
    }
  }

  /** casts all `values` to be of type `type` */
  castAll = (type: Type, ...values: SExpr): SExpr => values.map((x) => this.cast(type, x as SExpr))

  /** returns the highest precision type of the given values */
  hi = (...values: SExpr): Type => {
    const weights = values.filter(Boolean).map((x) => W(this.typeOf(x)))
    return Types[Math.max(...weights)]
  }

  /** types an operation with the correct prefix (f32 or i32) and type casts the values to satisfy the op */
  top = (type: Type, ops: SExpr): SExpr => {
    const prefix = type == Type.f32 ? 'f32' : 'i32'
    const [op, ...values] = ops

    // add suffix to specific i32 operations
    // TODO: cleaner way to do this
    let suffix = ''
    if (type === 'i32' && I32Suffixed.includes('' + op)) suffix = '_s'

    return this.typeAs(type, [`${prefix}.${op}${suffix}`, ...this.castAll(type, ...values)])
  }
}
