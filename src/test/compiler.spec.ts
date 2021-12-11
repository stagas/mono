import { compile, Type } from '../compiler'
import { parse, Node } from '../parser'
import { S0 } from '../sexpr'

const c = (s: string, type = Type.any) => S0(compile(parse(s), type))

describe('compile', () => {
  it('literal', () => {
    expect(compile('1' as Node)).toEqual(['i32.const', '1'])
  })

  it('parser node', () => {
    expect(c('1')).toEqual('(i32.const 1)')
  })

  it('op', () => {
    expect(c('1+2')).toEqual('(i32.add (i32.const 1) (i32.const 2))')
  })

  it('op w/ type cast i32 -> f32', () => {
    expect(c('1+2', Type.f32)).toEqual('(f32.convert_i32_u (i32.add (i32.const 1) (i32.const 2)))')
  })

  it('op w/ type cast i32 -> i32', () => {
    expect(c('1+2', Type.i32)).toEqual('(i32.add (i32.const 1) (i32.const 2))')
  })

  it('op w/ type cast i32 -> bool', () => {
    expect(c('1+2', Type.bool)).toEqual('(i32.add (i32.const 1) (i32.const 2))')
  })

  it('op w/ type cast bool -> i32', () => {
    expect(c('1+1', Type.i32)).toEqual('(i32.add (i32.const 1) (i32.const 1))')
  })

  it('op w/ type cast bool -> f32', () => {
    expect(c('1+1', Type.f32)).toEqual('(f32.convert_i32_u (i32.add (i32.const 1) (i32.const 1)))')
  })

  it('logical not', () => {
    expect(c('!1')).toEqual('(i32.eqz (i32.const 1))')
  })

  it('logical not w/ f32', () => {
    expect(c('!1.0')).toEqual('(i32.eqz (i32.trunc_f32_s (f32.const 1.0)))')
  })

  it('negate i32', () => {
    expect(c('-1')).toEqual('(i32.mul (i32.const -1) (i32.const 1))')
  })

  it('negate f32', () => {
    expect(c('-1.0')).toEqual('(f32.mul (f32.const -1) (f32.const 1.0))')
  })

  it('negate bool', () => {
    expect(c('-!1')).toEqual('(i32.mul (i32.const -1) (i32.eqz (i32.const 1)))')
  })
})
