import { Imports, compile } from './compiler'
import { parse } from './parser'
import make, * as wat from 'wat-compiler'
import * as lib from './lib.wat'

export const build = (s: string) => {
  console.time('build')
  const libsrc = Object.values(lib).join('\n')
  const modlib = wat.compile(wat.parse(wat.tokenize('(module ' + libsrc + ')')))
  const imports: Imports = {}

  for (const code of modlib.codes) {
    const [params, result] = modlib.types[code.type_idx].split(',')
    imports[code.name] = { params: params.split(' '), result: result.split(' ')[0] }
  }

  const mod = compile(parse(s), imports).toString([libsrc])
  const buffer = make(libsrc + '\n' + mod)
  const wasmMod = new WebAssembly.Module(buffer)
  const instance = new WebAssembly.Instance(wasmMod)
  console.timeEnd('build')

  return instance.exports as Record<string, (...args: unknown[]) => unknown>
}
