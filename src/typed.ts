import { SExpr } from './sexpr'

export enum Type {
  any = 'any',
  bool = 'bool',
  i32 = 'i32',
  f32 = 'f32',
}

export const Types: Type[] = [Type.any, Type.bool, Type.i32, Type.f32]

export const Typed = (panic: (s: string, t: string) => string) => {
  const types = new Map<object | string, Type>()

  const OpTypeCast: Record<Type, Partial<Record<Type, string>>> = {
    [Type.any]: {},
    [Type.f32]: {
      [Type.i32]: 'f32.convert_i32_u',
      [Type.bool]: 'f32.convert_i32_s',
    },
    [Type.i32]: {
      [Type.f32]: 'i32.trunc_f32_u',
    },
    [Type.bool]: {
      [Type.f32]: 'i32.trunc_f32_s',
    },
  }

  const cast = (type: Type, x: SExpr) => {
    const childType = types.get(x)
    if (childType && childType != type) {
      const castOp = OpTypeCast[type][childType]
      if (!castOp) return x
      x = [castOp, x]
      types.set(x, type)
      return x
    } else {
      types.set(x, type)
      return x
    }
  }

  const hi = (...children: SExpr): Type => {
    const weights = children.map(x => Types.indexOf(types.get(x) as Type))
    return Types[Math.max(...weights)]
  }

  const min = (type: Type, ...types: Type[]): Type => {
    return Types[Math.max(Types.indexOf(type), ...types.map(x => Types.indexOf(x)))]
  }

  const top = (type: Type, ops: SExpr): SExpr => {
    const prefix = type == Type.f32 ? 'f32' : 'i32'
    let [op, ...children] = ops // eslint-disable-line prefer-const
    children = children.map(x => cast(type, x as SExpr))
    const result = [prefix + '.' + op, ...children]
    types.set(result, type)
    return result
  }

  const infer = (x: string): Type => {
    if (x == '0' || x == '1') return Type.bool
    else if (!x.includes('.')) return Type.i32
    else if (x.includes('.')) return Type.f32
    else throw new TypeError(panic('cannot infer type for', x))
  }

  return { infer, top, min, hi, cast }
}
