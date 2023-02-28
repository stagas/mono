// import rfdc from 'rfdc'
import * as wat from 'wat-compiler'

import { deobjectify, objectify } from 'json-objectify'
import { replacer, reviver } from 'serialize-whatever'

import { Arg, compile, CompStep, Includes, Type } from './compiler'
import { parse, Token, TokenJson } from './parser'
import { S, SExpr } from './sexpr'

import * as libmath from './lib/math'
import libmono from './lib/mono'
import * as libvm from './lib/vm'
import * as libwat from './lib/wat'

import { eventsPtr, memory, setupPtr } from './const'
import { memoize } from 'everyday-utils'

export type LinkerWorkerRequest = {
  id: string
  code: string
  monoBuffers: [string, number][]
  sampleRate: number
}

export type LinkerWorkerResponse = {
  success: true
  id: string
  binary: Uint8Array
  params: ExportParam[]
  inputChannels: number
  outputChannels: number
} | {
  success: false
  id: string
  error: Error
}

// const copy = rfdc({ proto: true, circles: false })

// TODO: structuredClone?
const copy = (x: any) =>
  deobjectify(
    objectify(x, replacer(x)),
    reviver([
      Uint8Array,
      // @ts-ignore
      wat.ModuleBuilder,
      // @ts-ignore
      wat.FunctionContext,
      // @ts-ignore
      wat.GlobalContext,
    ])
  )

const precompile = memoize((sampleRate: number) => {
  const includes: Includes = {}
  console.log('precompile', sampleRate)
  const source = Object.values({
    env: libvm.env,
    ...libwat,
    ...libmath,
  }).map((x) => (
    typeof x === 'function'
      ? x({
        memory,
        setupPtr,
        eventsPtr,
        sampleRate,
      })
      : x
  )).join('\n')

  const context = wat.compile(
    wat.parse(wat.tokenize(`(module ${source})`))
  )

  // @ts-ignore
  for (const code of context.module.codes) {
    // @ts-ignore
    const [params, result] = context.module.types[code.type_idx].split(',')
    // console.log(code.name, params, result)
    // if (code.name === 'env.seed') continue
    includes[code.name] = {
      params: params.split(' '),
      result: result.split(' ')[0],
    }
  }

  const scope = Object.fromEntries(
    context.global.globals.map((x) => [
      x.name,
      x.type as Type,
    ])
  )
  console.log('SCOPE', scope)

  const lib = {
    context,
    scope,
    includes,
    init_body: [] as SExpr,
    fill_body: [] as SExpr,
    types: new Map(),
  }

  const ast = parse(libmono)

  const mod = compile(
    ast,
    lib.scope,
    lib.includes,
    [],
    [],
    lib.types,
    CompStep.Lib
  )

  lib.includes = Object.assign(
    lib.includes,
    Object.fromEntries(
      Object.entries(mod.funcs)
        .filter(([name]) => !(name in lib.includes))
    )
  )
  lib.init_body = mod.init_body!
  lib.fill_body = mod.fill_body

  const sexpr = ['module', ...mod.body]
  wat.default(S(sexpr), { metrics: false }, lib.context)

  return { lib }
})

export interface ExportParam {
  id: TokenJson | (Token & string)
  name: string
  fnId: TokenJson | (Token & string)
  paramId: TokenJson | (Token & string)
  exportIdMin: string
  exportIdMax: string
  sourceIndex: number
  source: {
    arg: string
    id: string
    range: string
    slope: string
    default: string
  }
}

// @ts-ignore
self.onconnect = ({ ports: [port] }) => {
  // TODO: let scope
  port.onmessage = ({ data }: { data: LinkerWorkerRequest }) => {
    if (data.code) {
      try {
        const { lib } = precompile(data.sampleRate)

        const ast = parse(data.code)
        if (!ast) {
          throw new Error('No ast produced.')
        }
        if (!ast.lexer) {
          throw new Error('No lexer')
        }

        // TODO: copy scope eagerly earlier so that it's available
        // immediately
        const scope = copy(lib.scope) as any

        // console.log(lib)
        const monoBufferGlobals = data.monoBuffers.map((
          [id, pos]: [string, number],
        ) => {
          scope[`#${id}`] = Type.i32
          return `(global $#${id} (i32) (i32.const ${pos}))`
        })

        const fill_body = [...lib.fill_body]

        // for (let i = data.config.maxCha; i < data.config.maxChannels; i++) {
        //   scope[`#i${i}`] = Type.i32
        //   scope[`#o${i}`] = Type.i32
        //   // point all buffers initially to #zero
        //   monoBufferGlobals.push(`(global $#i${i} (mut i32) (i32.const 0))`)
        //   monoBufferGlobals.push(`(global $#o${i} (mut i32) (i32.const 0))`)
        //   fill_body.push([`global.set`, `$#i${i}`, [`global.get`, `$#zero`]])
        //   fill_body.push([`global.set`, `$#o${i}`, [`global.get`, `$#zero`]])
        // }

        const inputChannels = data.code.includes('#i1')
          ? 2
          : data.code.includes('#i0')
            ? 1
            : 0

        const mod = compile(
          ast,
          scope,
          lib.includes,
          [...lib.init_body],
          fill_body,
          new Map(lib.types),
          CompStep.User
        )

        // console.log('MOD IS', mod.global)
        const outputChannels = mod.f_type === Type.multi ? 2 : 1

        const sexpr = [
          'module',
          ...monoBufferGlobals,
          libvm.process(mod),
          libvm.fill(mod, {
            inputChannels,
            outputChannels,
          }),
          ...mod.body,
        ]

        // debugger
        console.log(S(sexpr))

        const binary = wat.default(
          S(sexpr),
          { metrics: false },
          copy(lib.context) as any
        )

        const params: ExportParam[] = Object.values(mod.funcs)
          .map((f) => [
            f.id,
            f.params.filter((p) => p.export || mod.exported_params.has(p)),
          ])
          .filter((x) => x[1].length)
          .map(([fnId, params]: any) =>
            params.map((param: Arg) => {
              const exportIdMin = `export/${fnId}/${param.id}/min`
              const exportIdMax = `export/${fnId}/${param.id}/max`

              const exported: ExportParam[] = []

              if (param.export) {
                const exportId = param.id.as(`export/${fnId}/${param.id}`) as
                  & Token
                  & string

                const code = param.id.source.input
                const sourceIndex = code.lastIndexOf(
                  '\'',
                  exportId.source.index
                )
                // const parseArg =
                //   /(?<arg>'?\s*(?<id>[a-zA-Z_$][a-zA-Z0-9_$]*)(?<range>\[[^\]]*?\])?(=.*?(?<default>[^\s,)]+)?)?).*?(,|\)\s*=)/s

                const parseArg =
                  /(?<arg>'?\s*(?<id>[a-zA-Z_$][a-zA-Z0-9_$]*)(?<range>\[[^\]]*?\])?(\*\*(?<slope>[^=]+))?(=.*?(?<default>[^\s,)]+)?)?).*?(,|\)\s*=)/s

                const source = code.slice(sourceIndex).match(parseArg)!
                  .groups as {
                    arg: string
                    id: string
                    range: string
                    slope: string
                    default: string
                  }

                exported.push({
                  id: exportId.toJSON(),
                  name: exportId.toString(),
                  fnId: fnId.toJSON(),
                  paramId: param.id.toJSON(),
                  exportIdMin,
                  exportIdMax,
                  sourceIndex,
                  source,
                })
              }

              const exported_params_args = mod.exported_params.get(param)
              if (exported_params_args) {
                for (const id of exported_params_args) {
                  const token = mod.exported_params_map.get(id)![1] as Token
                  const sourceIndex = token.index
                  exported.push({
                    id: param.id.as(id).toJSON(),
                    name: id,
                    fnId: fnId.toJSON(),
                    paramId: param.id.toJSON(),
                    exportIdMin,
                    exportIdMax,
                    sourceIndex,
                    source: {
                      arg: token.source.input.slice(
                        sourceIndex,
                        sourceIndex + token.length
                      ),
                      id,
                      // TODO: we should be able to fill these details as well
                      range: `[0..1]`,
                      slope: '',
                      default: '0'
                    },
                  })
                }
              }

              return exported
            })
          ).flat(Infinity)

        const postData: LinkerWorkerResponse = {
          success: true,
          id: data.id,
          binary,
          params,
          inputChannels,
          outputChannels,
        }
        port.postMessage(postData, [binary.buffer])
      } catch (error) {
        port.postMessage({ id: data.id, error })
      }
    }
  }
}

