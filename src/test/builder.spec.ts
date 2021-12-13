import { build } from '../builder'

describe('build', () => {
  it('builds', () => {
    expect(build('a(x,y)=sin(x%y+cos(y%4))').a(10, 2)).toEqual(-0.40341752767562866)
  })
})
