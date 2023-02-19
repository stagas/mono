import { cheapRandomId, checksum, Deferred } from 'everyday-utils'
import { Token, TokenJson } from 'lexer-next'
import type * as libvm from './lib/vm'
import type { ExportParam, LinkerWorkerRequest, LinkerWorkerResponse } from './linker-worker'

import {
  BYTES_EVENTS, BYTES_PADDING, channelsPtr, MAX_CHANNELS, MAX_SIZE_BLOCK, memory, SAMPLE_CHANNELS, SAMPLE_MAX_COUNT, SAMPLE_SIZES
} from './const'

import { config as defaultConfig } from './config'

interface ModuleResponse {
  module: WebAssembly.Module
  params: ExportParam[]
  inputChannels: number
  outputChannels: number
  accessTime: number
}

interface Task {
  checksum: number
  deferred: Deferred<ModuleResponse>
}

const MAX_MODULE_RESPONSES = 30
const cachedModuleResponses = new Map<number, ModuleResponse>()

export type InstanceExports =
  & {
    [k: string]: WebAssembly.Global
  }
  & libvm.VM
  & {
    __start__(): void
    f(...args: number[]): number
  }

export class MonoParam {
  id!: Token & string
  fnId!: Token & string
  paramId!: Token & string
  sourceIndex!: number
  source!: {
    arg: string
    id: string
    range: string
    default: string
  }
  code!: string
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
    return Math.max(0, Math.min(1, (value - this.minValue) / this.scaleValue))
  }

  scale(normal: number) {
    return normal * this.scaleValue + this.minValue
  }
}

const pending = new Map<string, Task>()

export interface MonoBuffer extends Float32Array {
  id: string
  pos: number
  size: number
  structData: Int32Array
  bufferSize: number
}

export class VM {
  id = cheapRandomId()
  memory: WebAssembly.Memory
  instance?: WebAssembly.Instance
  params: MonoParam[] = []
  inputChannels = 0
  outputChannels = 1

  floats!: Float32Array
  ints!: Int32Array
  inputs!: Float32Array[]
  outputs!: Float32Array[]
  samples!: MonoBuffer[][]

  monoBuffers = new Map<string, MonoBuffer>()

  port?: MessagePort

  //   #:1,1;

  // midi_in(x=1,y=1,z=1)=
  //  (#=note_to_hz(y);0);

  // f()=sine(#(0))

  constructor(public config: typeof defaultConfig = { ...defaultConfig }) {
    this.memory = new WebAssembly.Memory(memory)
    this.makeSampleBuffers()
    this.makeFloats()
  }

  setPort(port: MessagePort) {
    this.port = port

    port.onmessage = async ({ data }: { data: LinkerWorkerResponse }) => {
      const task = pending.get(data.id)

      if (!task) {
        console.error('Task not found', data.id)
        return
      }

      pending.delete(data.id)

      if (data.success) {
        try {
          // const instance = (await WebAssembly.instantiate(data.binary, {
          //   env: { memory: task.owner.memory },
          // })).instance
          const module = await WebAssembly.compile(data.binary)
          const moduleResponse: ModuleResponse = {
            module,
            params: data.params as ExportParam[],
            inputChannels: data.inputChannels,
            outputChannels: data.outputChannels,
            accessTime: Date.now()
          }
          cachedModuleResponses.set(task.checksum, moduleResponse)
          task.deferred.resolve(moduleResponse)
        } catch (error) {
          task.deferred.reject(error as Error)
        }
      } else {
        task.deferred.reject(data.error)
      }
    }
  }

  // setNumberOfChannels(numberOfChannels: number) {
  //   const diff = numberOfChannels - this.inputs.length
  //   if (diff > 0) {
  //     console.log(
  //       'memory grow by',
  //       diff,
  //       'channels. was:',
  //       this.config.config.channels,
  //       'now:',
  //       numberOfChannels
  //     )
  //     // console.log(this.code)
  //     this.memory.grow(Math.ceil((diff * BYTES_CHANNEL) / BYTES_PAGE))
  //     this.config.config.channels = numberOfChannels
  //     this.makeSampleBuffers()
  //     this.makeFloats()
  //     this.setCode(this.code!)
  //   }
  //   // if (diff) {
  //   // for (let i = 0; i < this.inputs.length; i++) {
  //   //   this.inputs[i].fill(0)
  //   // }
  //   // }
  // }

  createMonoBuffer(id: string, pos: number, size: number) {
    const structData = new Int32Array(this.memory.buffer, pos, 5)

    structData.set([
      0,
      0,
      size,
      size - 1,
      size * Float32Array.BYTES_PER_ELEMENT,
    ])

    const bufferSize = size + 5
    const monoBuffer = Object.assign(
      new Float32Array(
        this.memory.buffer,
        pos + 5 * Int32Array.BYTES_PER_ELEMENT,
        size
      ),
      { id, pos, size, structData, bufferSize }
    ) as MonoBuffer

    this.monoBuffers.set(id, monoBuffer)

    return monoBuffer
  }

  makeSampleBuffers() {
    const sizes = SAMPLE_SIZES

    this.samples = Array.from(
      { length: SAMPLE_MAX_COUNT },
      () => Array.from({ length: SAMPLE_CHANNELS })
    )

    let pos = BYTES_PADDING + BYTES_EVENTS

    let buffer: MonoBuffer

    for (let i = 0; i < SAMPLE_MAX_COUNT; i++) {
      this.samples[i] = []

      for (let c = 0; c < SAMPLE_CHANNELS; c++) {
        buffer = this.samples[i][c] = this.createMonoBuffer(
          `s${i}_${c}`,
          pos,
          sizes.channel - 5
        )
        pos += buffer.bufferSize << 2
      }
    }
  }

  makeFloats() {
    this.floats = new Float32Array(this.memory.buffer)
    this.ints = new Int32Array(this.memory.buffer)
    this.inputs = Array.from({ length: MAX_CHANNELS })
    this.outputs = Array.from({ length: MAX_CHANNELS })

    // MEM_PADDING + EVENTS + SAMPLES + [INPUT + OUTPUT][] + USER_MEM
    let pos = channelsPtr

    let buffer: MonoBuffer
    for (let i = 0; i < MAX_CHANNELS; i++) {
      buffer = this.inputs[i] = this.createMonoBuffer(`i${i}`, pos, MAX_SIZE_BLOCK)
      pos += buffer.bufferSize << 2
      buffer = this.outputs[i] = this.createMonoBuffer(`o${i}`, pos, MAX_SIZE_BLOCK)
      pos += buffer.bufferSize << 2
    }
  }

  sampleBuffers: Float32Array[][] = []

  setSampleBuffer(
    index: number,
    buffer: Float32Array[],
    range: [number, number],
  ) {
    this.sampleBuffers[index] = buffer
    this.sampleBufferRanges[index] = range = range || [0, buffer[0].length]

    const sample = this.samples[index]
    for (let c = 0; c < sample.length; c++) {
      const channel = buffer[Math.min(c, buffer.length - 1)]
      const len = Math.min(sample[c].length, range[1] - range[0])

      sample[c].structData.set([
        0,
        0,
        len,
        len - 1,
        len * Float32Array.BYTES_PER_ELEMENT,
      ])

      sample[c].set(channel.subarray(range[0], range[1]))

      // console.log('SET', index, c, sample[c].structData)
      if (len < sample[c].length) {
        sample[c].fill(0, len)
      }
    }
  }

  sampleBufferRanges: [number, number][] = []

  setSampleBufferRange(index: number, range: [number, number]) {
    this.sampleBufferRanges[index] = range
    this.setSampleBuffer(index, this.sampleBuffers[index], range)
  }

  get exports() {
    return this.instance?.exports as InstanceExports
  }

  exportEntries: Record<string, number> = {}

  async setCode(code: string) {
    code = !code.trim() ? 'f()=0' : code

    if (this.isReady) {
      for (
        const [key, global] of Object.entries(this.exports)
      ) {
        if (key.startsWith('export/') && global instanceof WebAssembly.Global) {
          this.exportEntries[key] = global.value
        }
      }
    }

    const { module: wasmModule, params, inputChannels, outputChannels } = await this.link(code)

    this.instance = await WebAssembly.instantiate(wasmModule, {
      env: { memory: this.memory },
    })

    this.code = code

    if (!this.isReady) {
      for (const [i, b] of this.sampleBuffers.entries()) {
        if (b) this.setSampleBuffer(i, b, this.sampleBufferRanges[i])
      }

      this.exports.__start__() // ;(this.instance as any).exports.__begin__()
      // @ts-ignore
      this.exports.update_exports()

      this.exports.fill(0, 0, 0)
      this.exportEntries = {}
      for (
        const [key, global] of Object.entries(this.exports)
      ) {
        if (global instanceof WebAssembly.Global) {
          this.exportEntries[key] = global.value
        }
      }
      // console.log(this.exportEntries)

      // const global_mem_ptr = (this.instance as any).exports.global_mem_ptr.value
      // new Uint8Array(this.linker.memory.buffer, 0, global_mem_ptr).fill(0)

      // ;(this.instance as any).exports.__begin__()
    } else {
      // else {
      // @ts-ignore
      this.exports.update_exports()
      // }

      // console.log('WRITE', this.exportEntries)
      for (const [key, value] of Object.entries(this.exportEntries)) {
        try {
          if (!key.startsWith('export/')) {
            this.exports[key].value = value
          }
          // console.log('WRITE', key, value)
        } catch { }
      }
      // this.exports.__start__() // ;(this.instance as any).exports.__begin__()
      // this.exports.fill(0, 0, 0, 0)
      // ;(this.instance as any).exports.__begin__()
      // ;(this.instance as any).exports.__begin__()
    }

    this.params = params.map((param) => {
      const id = new Token(param.id as TokenJson) as Token & string
      const minValue = this.exports[param.exportIdMin].value ?? 0
      const maxValue = this.exports[param.exportIdMax].value ?? 1
      const defaultValue = this.exports[param.name].value
        ?? (maxValue - minValue) * 0.5 + minValue

      const monoParam = new MonoParam({
        ...param,
        id,
        fnId: new Token(param.fnId as TokenJson) as Token & string,
        paramId: new Token(param.paramId as TokenJson) as Token & string,
        code,
        minValue,
        maxValue,
        defaultValue,
      })

      return monoParam
    })

    // console.log(this.params)
    this.isReady = true

    return {
      inputChannels,
      outputChannels
    }
  }

  isReady = false
  code?: string

  async link(code: string) {
    const deferred = Deferred<ModuleResponse>()

    const moduleChecksum = checksum(code)
    if (cachedModuleResponses.has(moduleChecksum)) {
      const moduleResponse = cachedModuleResponses.get(moduleChecksum)!
      moduleResponse.accessTime = Date.now()
      deferred.resolve(moduleResponse)
      return deferred.promise
    }

    if (cachedModuleResponses.size > MAX_MODULE_RESPONSES) {
      const [lruKey] = [...cachedModuleResponses].sort(([, a], [, b]) => a.accessTime - b.accessTime)[0]

      cachedModuleResponses.delete(lruKey)
    }

    const id = cheapRandomId()
    pending.set(id, {
      checksum: moduleChecksum,
      deferred
    })

    this.port!.postMessage(<LinkerWorkerRequest>{
      id,
      code,
      sampleRate: this.config.sampleRate,
      monoBuffers: [...this.monoBuffers].map(([id, monoBuffer]) => [
        id,
        monoBuffer.pos,
      ]),
    })

    return deferred.promise
  }
}
