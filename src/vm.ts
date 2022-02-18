import { Token } from 'lexer-next'
import { Arg } from './compiler'
import * as libmono from './lib/mono'
import * as libvm from './lib/vm'
import * as libwat from './lib/wat'
import { Linker, LinkerConfig } from './linker'
import { Type } from './typed'

const defaultConfig: LinkerConfig = {
  memory: {
    initial: 256, // TODO: autocalculate page size
    maximum: 256,
  },
  metrics: false,
}

export class MonoParam {
  id!: string
  name!: string
  minValue!: number
  maxValue!: number
  defaultValue!: number
  normalValue!: number
  scaleValue!: number

  constructor(data: Partial<MonoParam>) {
    Object.assign(this, data)
    this.scaleValue = this.maxValue - this.minValue
    this.normalValue = this.normalize(this.defaultValue)
  }

  normalize(value: number) {
    return (value - this.minValue) / this.scaleValue
  }
}

export class VM {
  isReady = false
  skipMono = false

  config: LinkerConfig

  linker: Linker

  inputs: Float32Array[]
  outputs: Float32Array[]

  constructor(config: Partial<LinkerConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
    this.linker = new Linker(this.config)
    this.inputs = [new Float32Array(this.linker.memory.buffer, 0x40000, 0x10000)] // TODO: config size
    this.outputs = [new Float32Array(this.linker.memory.buffer, 0, 0x10000)]
    this.linkLib()
  }

  linkLib() {
    this.linker.linkLib({ env: libvm.env, ...libwat })
    if (!this.skipMono) this.linker.linkMono(libmono)
    this.linker.linkSExpr(() => [libvm.fill({ type: this.f_type, params: this.f_params })])
  }

  get exports() {
    return this.linker.instance!.exports as {
      [k: string]: ((...args: number[]) => number) | WebAssembly.Global | any
    } & libvm.VM
  }

  get funcs() {
    return this.linker.module!.funcs
  }

  get params(): MonoParam[] {
    return Object.values(this.linker.module!.funcs)
      .map(f => [f.id, f.params.filter(p => p.export)])
      .filter(x => x[1].length)
      .map(
        ([id, params]: any) =>
          params.map((p: Arg) => {
            const export_id = p.id.as('export/' + id + '/' + p.id) as Token
            const export_id_min = p.id.as('export/' + id + '/' + p.id + '/min') as Token
            const export_id_max = p.id.as('export/' + id + '/' + p.id + '/max') as Token

            const minValue = (this.linker.instance!.exports[export_id_min] as any)?.value ?? 0
            const maxValue = (this.linker.instance!.exports[export_id_max] as any)?.value ?? 1
            const defaultValue =
              (this.linker.instance!.exports[export_id] as any)?.value ?? (maxValue - minValue) * 0.5 + minValue

            return new MonoParam({
              id: export_id,
              name: export_id.toString(),
              minValue,
              maxValue,
              defaultValue,
            })
          })
        // argToMonoParam({ ...p, default: p.originalDefault, id: p.id.as('export/' + id + '/' + p.id) as Token })
        // )
      )
      .flat()
  }

  get f_type(): Type {
    return this.linker.module!.typeOf(this.funcs.f.body)
  }

  get f_params(): Arg[] {
    return this.funcs.f.params //.map(argToMonoParam)
  }

  setCode(code: string) {
    this.linker.link(code)
    this.linker.make()
    this.isReady = true
    this.config.metrics && console.log('mono: ready')
  }
}
