import { cheapRandomId } from 'everyday-utils'
import rfdc from 'rfdc'
import * as wat from 'wat-compiler'
import { compile, CompStep, Includes, Module, Scope, Type } from './compiler'
import { parse } from './parser'
import { S, SExpr } from './sexpr'

const copy = rfdc({ proto: true, circles: false })

const VERBOSE = 2

export interface LinkerConfig {
  memory: WebAssembly.MemoryDescriptor
  metrics: boolean | number
}

export class Linker {
  id = cheapRandomId()

  // mono
  config: LinkerConfig
  module?: Module
  sexpr: (linker: Linker) => SExpr = () => []
  lib?: { context: wat.Context; scope: Scope; includes: Includes }
  mono: Record<string, string> = {}

  // wasm
  binary?: Uint8Array
  memory: WebAssembly.Memory
  instance?: WebAssembly.Instance

  constructor(config: LinkerConfig) {
    this.config = config
    this.memory = new WebAssembly.Memory(this.config.memory)
  }

  async make() {
    //!time `[${this.id}] make`

    //!? `[${this.id}] binary size: %d bytes`, this.binary.length

    this.instance = (await WebAssembly.instantiate(this.binary!, { env: { memory: this.memory } })).instance

    // const wasmModule = new WebAssembly.Module(this.binary!)
    // this.instance = new WebAssembly.Instance(wasmModule, { env: { memory: this.memory } })

    //!timeEnd `[${this.id}] make`
    return
  }

  link(src: string) {
    //!time `[${this.id}] link`

    if (!this.lib) this.linkLib({})
    const lib = this.lib!

    //!time `[${this.id}] parse`
    const ast = parse(src)
    //!timeEnd `[${this.id}] parse`

    //!time `[${this.id}] compile`
    this.module = compile(ast, copy(lib.scope), lib.includes, CompStep.User)
    //!timeEnd `[${this.id}] compile`

    //!time `[${this.id}] binary`
    const sexpr = ['module', ...this.sexpr(this), ...this.module.body]

    // debugger
    // console.log(S(sexpr))

    this.binary = wat.default(S(sexpr), this.config as wat.Options, copy(lib.context))
    //!timeEnd `[${this.id}] binary`

    //!timeEnd `[${this.id}] link`
    return
  }

  linkLib(lib: Record<string, string | ((config: LinkerConfig) => string)>) {
    //!time `[${this.id}] lib`

    const includes: Includes = {}

    const source = Object.values(lib)
      .map(x => (typeof x === 'function' ? x(this.config) : x))
      .join('\n')

    const context = wat.compile(wat.parse(wat.tokenize('(module ' + source + ')')))

    for (const code of context.module.codes) {
      const [params, result] = context.module.types[code.type_idx].split(',')
      includes[code.name] = { params: params.split(' '), result: result.split(' ')[0] }
    }

    const scope = Object.fromEntries(context.global.globals.map(x => [x.name, x.type as Type]))

    this.lib = { context, scope, includes }

    //!timeEnd `[${this.id}] lib`
    return
  }

  linkSExpr(fn: (linker: Linker) => SExpr) {
    this.sexpr = fn
  }

  linkMono(monolib: Record<string, string>) {
    this.mono = monolib

    if (!this.lib) this.linkLib({})
    const lib = this.lib!

    //!time `[${this.id}] lib mono parse`
    const ast = parse([...Object.values(this.mono)].join(';').replace(/;{1,}/g, ';'))
    //!timeEnd `[${this.id}] lib mono parse`

    //!time `[${this.id}] lib mono compile`
    const module = compile(ast, lib.scope, lib.includes, CompStep.Lib)
    lib.includes = Object.assign(
      lib.includes,
      Object.fromEntries(Object.entries(module.funcs).filter(([name]) => !(name in lib.includes)))
    )
    //!timeEnd `[${this.id}] lib mono compile`

    //!time `[${this.id}] lib mono binary`
    const sexpr = ['module', ...module.body]
    wat.default(S(sexpr), this.config as wat.Options, lib.context)
    //!timeEnd `[${this.id}] lib mono binary`

    return
  }
}
