import { arg, decarg } from 'decarg'
import * as fs from 'fs'
import * as path from 'path'
import watCompile from 'wat-compiler'

import { compile } from './compiler'
import { parse } from './parser'
import { S } from './sexpr'

const default_global = { global_mem_ptr: 'i32' }

function bodyOf(s: string, global: any = default_global) {
  return S(compile(parse(s), global).body)
}

export class Options {
  @arg('<file>', 'The .mono file to run') file!: string
  @arg('--', '[...args]', 'The arguments to pass to the function') args: (string | number)[] = []
  @arg('-n', '--name', 'The exported function name to use') name = 'f'
  @arg('-i', '--iterations', 'Bench iterations') iterations = 0

  static examples = {
    'my-app.mono': 'Runs my-app.mono',
    'my-app.mono -n add -- 1 2': 'Runs export `add` with arguments `(1,2)`',
    'my-app.mono -n add -i 100 -- 1 2': 'Runs the same 100 times and prints the result',
  }

  constructor(opts: Partial<Options> = {}) {
    Object.assign(this, opts)
  }

  get code() {
    return fs.readFileSync(path.resolve(process.cwd(), this.file), 'utf-8')
  }

  get parsedArgs() {
    return this.args.map(parseArgNumber)
  }
}

/**
 * Runs a function in a .wat file with the given arguments.
 */
export const run = (options: Options) => {
  const { name, code, parsedArgs } = options
  const instance = getInstance(code)
  const fn = instance.exports[name] as (...args: unknown[]) => unknown
  if (!fn) throw new Error(`Export "${name}" was not found.`)

  return fn(...parsedArgs)
}

export const bench = (options: Options) => {
  const { name, code, args } = options

  const instance = getInstance(`
    ${code}
    ${benchWat(
    name,
    args.map(x => `(${('' + x).includes('.') ? 'f32' : 'i32'}.const ${x})`).join(''),
    options.iterations
  )
    }
  `)

  const fn = instance.exports.bench as () => void

  console.time('bench')
  fn()
  console.timeEnd('bench')
}

export const getInstance = (code: string) => {
  console.log(code)
  const wat = bodyOf(code)
  console.log(wat)
  const buffer = watCompile(wat)
  const mod = new WebAssembly.Module(buffer)
  return new WebAssembly.Instance(mod, {})
}

export const benchWat = (fnName: string, params: string, iterations: number) =>
  `;;wasm
  (func $bench (export "bench")
    (local $index i32)

    ;; do
    (loop $loop
      (drop
        (call $${fnName} ${params})
      )

      ;; $index++
      (local.set $index (i32.add (local.get $index) (i32.const 1)))

      ;; if ($index !== iterations) continue $loop
      (br_if $loop (i32.ne (local.get $index) (i32.const ${iterations})))
    )
  )
`

const parseArgNumber = (x: string | number) => {
  if (typeof x === 'number') return x
  const n = parseFloat(x)
  if (n.toString() !== x) return x
  return n
}

const options = decarg(new Options())!

try {
  if (options.iterations) {
    bench(options)
  } else {
    console.log(run(options))
  }
} catch (error) {
  if (error) console.error(error)
  process.exit(1)
}
