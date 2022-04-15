import { VM } from '../../src/vm'

const b = async (s: string) => {
  const vm = new VM()
  await vm.setCode(s)
  floats = new Float32Array(vm.linker.memory.buffer, 0, 5)
  return vm.exports
}

let floats: Float32Array

describe('mono', () => {
  it('lp', async () => {
    ;(await b('f(x)=lp(sin(t*x*pi2), 333.0, 2.5)')).fill(0, 5, 666)

    expect([...floats]).toMatchSnapshot()

    const bq = { x1: 0, x2: 0, y1: 0, y2: 0 }
    expect(
      Array.from({ length: 5 })
        .fill(0)
        .map((_, i) => lp(bq, Math.sin((i / 44100) * 666 * Math.PI * 2), 333, 2.5))
    ).toMatchSnapshot()
  })
})

const pi2 = 6.2831854820251465
const sampleRate = 44100

const lp = (b: any, x0: any, freq = 1000, Q = 1) => {
  const { y1, y2, x1, x2 } = b,
    w0 = (pi2 * freq) / sampleRate,
    sin_w0 = Math.sin(w0),
    cos_w0 = Math.cos(w0),
    alpha = sin_w0 / (2.0 * Q),
    b0 = (1.0 - cos_w0) / 2.0,
    b1 = 1.0 - cos_w0,
    b2 = b0,
    a0 = 1.0 + alpha,
    a1 = -2.0 * cos_w0,
    a2 = 1.0 - alpha,
    y0 = (x0 * b0 + x1 * b1 + x2 * b2 - y1 * a1 - y2 * a2) / a0
  b.y1 = y0
  b.y2 = y1
  b.x1 = x0
  b.x2 = x1

  return y0
}
