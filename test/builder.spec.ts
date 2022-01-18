import { build } from '../src/builder'

const b = (s: string) => {
  const result = build(s)
  const wasmMod = new WebAssembly.Module(result.buffer)
  const instance = new WebAssembly.Instance(wasmMod)
  return instance.exports as Record<string, (...args: unknown[]) => unknown>
}

describe('build', () => {
  it('builds', () => {
    expect(b('a(x,y)=sin(x%y+cos(y%4))').a(10, 2)).toEqual(-0.40341752767562866)
  })
})
