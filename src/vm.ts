import { Token } from 'lexer-next'
import { Arg } from './compiler'
import { Module } from './compiler'
import * as libmono from './lib/mono'
import * as libvm from './lib/vm'
import * as libwat from './lib/wat'
import { Linker, LinkerConfig } from './linker'
import { Type } from './typed'

const defaultConfig: LinkerConfig = {
  memory: {
    initial: 32, // TODO: autocalculate page size
    maximum: 32,
  },
  metrics: false,
}

const parseArg =
  /(?<arg>\.?\s*(?<id>[a-zA-Z_$][a-zA-Z0-9_$]*)(?<range>\[[^\]]*?\])?(=.*?(?<default>[^\s,)]+)?)?).*?(,|\)\s*=)/s

export class MonoParam {
  id!: Token
  sourceIndex!: number
  source!: {
    arg: string
    id: string
    range: string
    default: string
  }
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

  scale(normal: number) {
    return normal * this.scaleValue + this.minValue
  }
}

export class VM {
  isReady = false
  skipMono = false

  code = ''

  config: LinkerConfig

  linker: Linker
  module?: Module
  instance?: WebAssembly.Instance

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
    return this.instance?.exports as {
      [k: string]: ((...args: number[]) => number) | WebAssembly.Global | any
    } & libvm.VM
  }

  get funcs() {
    return this.linker.module!.funcs
  }

  get params(): MonoParam[] {
    return Object.values(this.module?.funcs ?? {})
      .map(f => [f.id, f.params.filter(p => p.export)])
      .filter(x => x[1].length)
      .map(
        ([id, params]: any) =>
          params.map((p: Arg) => {
            const export_id = p.id.as('export/' + id + '/' + p.id) as Token
            const export_id_min = p.id.as('export/' + id + '/' + p.id + '/min') as Token
            const export_id_max = p.id.as('export/' + id + '/' + p.id + '/max') as Token

            const minValue = (this.instance!.exports[export_id_min] as any)?.value ?? 0
            const maxValue = (this.instance!.exports[export_id_max] as any)?.value ?? 1
            const defaultValue = (this.instance!.exports[export_id] as any)?.value
              ?? (maxValue - minValue) * 0.5 + minValue

            // find the index of the dot `.` that made the param export by moving
            // backwards from the id index that we have access to here
            const code = p.id.source.input
            const sourceIndex = code.lastIndexOf('.', export_id.source.index)
            const source = code.slice(sourceIndex).match(parseArg)!.groups as MonoParam['source']

            return new MonoParam({
              id: export_id,
              sourceIndex,
              source,
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
    return this.linker.module!.typeOf(this.funcs.f?.body)
  }

  get f_params(): Arg[] {
    return this.funcs.f?.params ?? [] // .map(argToMonoParam)
  }

  async setCode(code: string) {
    this.linker.link(code)
    await this.linker.make()

    // update code only after linker has been successful
    this.code = code

    // we copy these because they are instantiated at two async steps
    // before the linker is ready, and "module" and "instance" can diverge
    // if we were to access them directly from the linker, leading to errors
    this.module = this.linker.module
    this.instance = this.linker.instance

    this.isReady = true
    this.config.metrics && console.log('mono: ready')
  }
}
