import rfdc from 'rfdc'
import make, * as wat from 'wat-compiler'
import { Imports, Module, compile } from './compiler'
import * as lib from './lib.wat'
import { parse } from './parser'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let modlib: any
const copy = rfdc({ proto: true, circles: false })
const imports: Imports = {}

export const build = (s: string, scope = {}, extraLib = {}, extraRun = (_mod: Module) => []) => {
  console.time('build')

  if (!modlib) {
    console.time('lib')
    const libsrc = Object.values(lib).join('\n') + '\n' + Object.values(extraLib).join('\n')
    modlib = wat.compile(wat.parse(wat.tokenize('(module ' + libsrc + ')')))
    for (const code of modlib.module.codes) {
      const [params, result] = modlib.module.types[code.type_idx].split(',')
      imports[code.name] = { params: params.split(' '), result: result.split(' ')[0] }
    }
    console.timeEnd('lib')
  }

  // console.time('parse')
  const ast = parse(s)
  // console.timeEnd('parse')

  // console.time('compile')
  const mod = compile(ast, scope, imports)
  // console.timeEnd('compile')

  // console.time('make')
  const buffer = make(mod.toString(extraRun(mod)), { metrics: false }, copy(modlib))
  // console.timeEnd('make')

  console.timeEnd('build')

  return {
    module: mod,
    buffer,
  }
}
