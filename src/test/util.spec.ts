import { flatten } from '../util'
import { parse } from '../parser'
import { S0 } from '../sexpr'

describe('util', () => {
  it('flattten', () => {
    expect(S0(flatten(',', parse('1,2,3,4')))).toEqual('(1 2 3 4)')
    expect(S0(['@', ...flatten(',', parse('1[a],2,3[c],4'))])).toEqual('(@ ([ 1 a) 2 ([ 3 c) 4)')
  })
})
