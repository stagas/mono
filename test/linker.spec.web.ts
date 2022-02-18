import * as libvm from '../src/lib/vm'
import * as libwat from '../src/lib/wat'
import { Linker } from '../src/linker'

const memory = {
  initial: 64,
  maximum: 64,
}

let linker: Linker
let floats: Float32Array

const b = (s: string) => {
  linker.link(s)
  linker.make()
  return linker.instance.exports as { [k: string]: (...args: number[]) => number } & libvm.VM
}

xdescribe('build', () => {
  beforeEach(() => {
    linker = new Linker({
      memory,
      metrics: false,
    })
    floats = new Float32Array(linker.memory.buffer, 0, 5)
  })

  it('libwat', () => {
    linker.linkLib(libwat)
    expect(b('a(x,y)=sin(x%y+cos(y%4))').a(10, 2)).toEqual(-0.40341752767562866)
    expect(b('a(x[1..2],y)=sin(x%y+cos(y%4))').a(10, 2)).toEqual(-0.40341752767562866)
    expect(b('a(x[1..2]=1.5,y)=sin(x%y+cos(y%4))').a(10, 2)).toEqual(-0.40341752767562866)
  })

  it('vm', () => {
    linker.linkLib({ env: libvm.env, ...libwat })

    linker.linkSExpr(() => {
      const params: string[] = linker.module.funcs.f.params.map(x => x.id.toString())
      return [libvm.fill({ params })]
    })

    b('f(x)=x').fill(0, 3, 42)

    expect([...floats]).toEqual([42, 42, 42, 0, 0])
  })
})
