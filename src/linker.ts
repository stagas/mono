import rfdc from 'rfdc'
import * as wat from 'wat-compiler'
import { CompStep, Includes, Module, Scope, Type, compile } from './compiler'
import { parse } from './parser'
import { S, SExpr } from './sexpr'

const copy = rfdc({ proto: true, circles: false })

const VERBOSE = 2

export interface LinkerConfig {
  memory: WebAssembly.MemoryDescriptor
  metrics: boolean | number
}

export class Linker {
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
    this.config.metrics && console.time('mono: make')
    this.instance = (await WebAssembly.instantiate(this.binary!, { env: { memory: this.memory } })).instance
    // const wasmModule = new WebAssembly.Module(this.binary!)
    // this.instance = new WebAssembly.Instance(wasmModule, { env: { memory: this.memory } })
    this.config.metrics && console.timeEnd('mono: make')
  }

  link(src: string) {
    this.config.metrics && console.time('mono: link')

    if (!this.lib) this.linkLib({})
    const lib = this.lib!

    this.config.metrics === VERBOSE && console.time('mono: parse')
    const ast = parse([src].join(';').replace(/;{1,}/g, ';'))
    this.config.metrics === VERBOSE && console.timeEnd('mono: parse')

    this.config.metrics === VERBOSE && console.time('mono: compile')
    this.module = compile(ast, copy(lib.scope), lib.includes, CompStep.User)
    this.config.metrics === VERBOSE && console.timeEnd('mono: compile')

    // console.log(this.module)

    // return
    this.config.metrics === VERBOSE && console.time('mono: wat binary')
    const sexpr = ['module', ...this.sexpr(this), ...this.module.body]
    // debugger
    // console.log(S(sexpr))
    this.binary = wat.default(S(sexpr), this.config as wat.Options, copy(lib.context))
    this.config.metrics === VERBOSE && console.timeEnd('mono: wat binary')

    this.config.metrics && console.timeEnd('mono: link')
  }

  linkLib(lib: Record<string, string | ((config: LinkerConfig) => string)>) {
    this.config.metrics && console.time('mono: lib')

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

    this.config.metrics && console.timeEnd('mono: lib')
  }

  linkSExpr(fn: (linker: Linker) => SExpr) {
    this.sexpr = fn
  }

  linkMono(monolib: Record<string, string>) {
    this.mono = monolib

    if (!this.lib) this.linkLib({})
    const lib = this.lib!

    this.config.metrics === VERBOSE && console.time('mono: lib mono: parse')
    const ast = parse([...Object.values(this.mono)].join(';').replace(/;{1,}/g, ';'))
    this.config.metrics === VERBOSE && console.timeEnd('mono: lib mono: parse')

    this.config.metrics === VERBOSE && console.time('mono: lib mono: compile')
    const module = compile(ast, lib.scope, lib.includes, CompStep.Lib)
    lib.includes = Object.assign(
      lib.includes,
      Object.fromEntries(Object.entries(module.funcs).filter(([name]) => !(name in lib.includes)))
    )
    this.config.metrics === VERBOSE && console.timeEnd('mono: lib mono: compile')

    this.config.metrics === VERBOSE && console.time('mono: lib mono: wat binary')
    const sexpr = ['module', ...module.body]
    wat.default(S(sexpr), this.config as wat.Options, lib.context)
    this.config.metrics === VERBOSE && console.timeEnd('mono: lib mono: wat binary')
  }
}
