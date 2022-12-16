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

import {
  CHANNEL_BYTES,
  config,
  EVENTS,
  MEM_PADDING,
  memory,
  memPadding,
  sampleBufferSizes,
  samplePointers,
} from './config'

export type PostData = {
  success: true,
  id: string,
  binary: Uint8Array,
  params: ExportParam[]
} | {
  success: false,
  id: string,
  error: Error,
}

// const copy = rfdc({ proto: true, circles: false })

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

const includes: Includes = {}

const source = Object.values({
  env: libvm.env,
  ...libwat,
  ...libmath,
}).map((x) => (
  typeof x === 'function'
    ? x({
      memory,
      memPadding,
      eventsPointer: config.eventsPointer,
      samplePointers,
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
    default: string
  }
}

// @ts-ignore
self.onconnect = ({ ports: [port] }) => {
  port.onmessage = ({ data }: any) => {
    if (data.code) {
      try {
        const ast = parse(data.code)
        if (!ast) {
          throw new Error('No ast produced.')
        }
        if (!ast.lexer) {
          throw new Error('No lexer')
        }

        const scope = copy(lib.scope) as any
        // console.log(lib)
        const monoBufferGlobals = data.monoBuffers.map((
          [id, pos]: [string, number],
        ) => {
          scope[`#${id}`] = Type.i32
          return `(global $#${id} (i32) (i32.const ${pos}))`
        })

        const fill_body = [...lib.fill_body]

        for (let i = data.config.channels; i < data.config.maxChannels; i++) {
          scope[`#i${i}`] = Type.i32
          scope[`#o${i}`] = Type.i32
          monoBufferGlobals.push(`(global $#i${i} (mut i32) (i32.const 0))`)
          monoBufferGlobals.push(`(global $#o${i} (mut i32) (i32.const 0))`)
          fill_body.push([`global.set`, `$#i${i}`, [`global.get`, `$#zero`]])
          fill_body.push([`global.set`, `$#o${i}`, [`global.get`, `$#zero`]])
        }

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

        const sexpr = [
          'module',
          ...monoBufferGlobals,
          libvm.process(mod),
          libvm.fill({
            type: mod.f_type,
            params: mod.f_params,
            blockSize: data.config.blockSize,
            channels: data.config.channels,
            maxChannels: data.config.maxChannels,
            channelBytes: CHANNEL_BYTES,
            memPadding: MEM_PADDING + EVENTS + sampleBufferSizes.bytes
              + CHANNEL_BYTES,
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
                const parseArg =
                  /(?<arg>'?\s*(?<id>[a-zA-Z_$][a-zA-Z0-9_$]*)(?<range>\[[^\]]*?\])?(=.*?(?<default>[^\s,)]+)?)?).*?(,|\)\s*=)/s

                const source = code.slice(sourceIndex).match(parseArg)!
                  .groups as {
                    arg: string
                    id: string
                    range: string
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
                      default: '0'
                    },
                  })
                }
              }

              return exported
            })
          ).flat(Infinity)

        const postData: {
          success: boolean,
          id: string,
          binary: Uint8Array,
          params: ExportParam[]
        } = {
          success: true,
          id: data.id,
          binary,
          params,
        }
        port.postMessage(postData, [binary.buffer])
      } catch (error) {
        port.postMessage({ id: data.id, error })
      }
    }
  }
}

