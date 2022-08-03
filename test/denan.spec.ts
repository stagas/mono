import { compile } from '../src/compiler'
import { parse } from '../src/parser'
import { S } from '../src/sexpr'

// helpers
// const deepToString = (x: string | SExpr): string | SExpr => (Array.isArray(x) ? x.map(deepToString) : '' + x)
// const func = (sym: string, s: string) => deepToString([...compile(parse(s)).funcs[sym].body!])
const fc = (sym: string, s: string, global?: any) => S(compile(parse(s), global).funcs[sym].body!)
const c = (s: string, global?: any) => fc('__begin__', s, global)
const bodyOf = (s: string) => S(compile(parse(s)).body)

describe('denan', () => {
  it('ignores', () => {
    expect(c('x=0/0')).toMatchSnapshot()
  })

  it('works', () => {
    expect(c('x=0f/0f')).toMatchSnapshot()
  })

  it('func', () => {
    expect(bodyOf('denan(x=0f)=x-x!=0?0f:x')).toMatchSnapshot()
  })
})
