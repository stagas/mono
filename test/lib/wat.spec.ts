// @env browser
import { VM } from '../../src/vm'

const b = async (s: string) => {
  const vm = new VM()
  await vm.setCode(s)
  return vm.exports
}

describe('lib', () => {
  describe('cos', () => {
    it('works', async () => {
      const e = await b('f(x)=cos(x)')
      const x = [-2, -1, 0, 1, 2]
      expect(x.map(x => e.f(x))).toMatchSnapshot()
      expect(x.map(Math.cos)).toMatchSnapshot()
    })
  })

  describe('sin', () => {
    it('works', async () => {
      const e = await b('f(x)=sin(x)')
      const x = [-2, -1, 0, 1, 2]
      expect(x.map(x => e.f(x))).toMatchSnapshot()
      expect(x.map(Math.sin)).toMatchSnapshot()
    })
  })

  describe('exp', () => {
    it('works', async () => {
      const e = await b('f(x)=exp(x)')
      const x = [-2, -1, 0, 1, 2]
      expect(x.map(x => e.f(x))).toMatchSnapshot()
      expect(x.map(Math.exp)).toMatchSnapshot()
    })
  })

  describe('mod', () => {
    it('works', async () => {
      const e = await b('f(x)=mod(x,3)')
      const x = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]
      expect(x.map(x => e.f(x))).toMatchSnapshot()
      expect(x.map(x => x % 3)).toMatchSnapshot()
    })

    it('floats', async () => {
      const e = await b('f(x)=mod(x,1.5)')
      const x = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]
      expect(x.map(x => e.f(x))).toMatchSnapshot()
      expect(x.map(x => x % 1.5)).toMatchSnapshot()
    })
  })

  describe('pow', () => {
    it('works', async () => {
      const e = await b('f(x)=pow(x,2)')
      const x = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]
      expect(x.map(x => e.f(x))).toMatchSnapshot()
      expect(x.map(x => Math.pow(x, 2))).toMatchSnapshot()
    })
  })
})
