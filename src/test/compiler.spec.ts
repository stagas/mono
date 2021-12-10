import { compile } from '../compiler'
import { parse, Node } from '../parser'
import { S0 } from '../sexpr'

describe('compile', () => {
  it('literal', () => {
    expect(compile('1' as Node)).toEqual(['f32.const', '1'])
  })

  it('parser node', () => {
    expect(S0(compile(parse('1')))).toEqual('(f32.const 1)')
  })

  it('simple operation', () => {
    expect(S0(compile(parse('1+2')))).toEqual('(f32.add (f32.const 1) (f32.const 2))')
  })
})
