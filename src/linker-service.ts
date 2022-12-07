import { cheapRandomId, checksum, Deferred } from 'everyday-utils'
import type * as libvm from './lib/vm'
import type { ExportParam } from './linker-worker'

import { Token, TokenJson } from 'lexer-next'

import {
  CHANNEL_BYTES,
  config as defaultConfig,
  EVENTS,
  MEM_PADDING,
  memory,
  PAGE_BYTES,
  sampleBufferSizes,
} from './config'

interface ModuleResponse {
  module: WebAssembly.Module
  params: ExportParam[]
}

interface Task {
  checksum: number
  deferred: Deferred<ModuleResponse>
}

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
}

export class VM {
  id = cheapRandomId()
  memory: WebAssembly.Memory
  instance?: WebAssembly.Instance
  params: MonoParam[] = []

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
    console.log(this.memory)
    this.makeSampleBuffers()
    this.makeFloats()
  }

  setPort(port: MessagePort) {
    this.port = port

    port.onmessage = async ({ data }) => {
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
          const moduleResponse = {
            module,
            params: data.params as ExportParam[],
          }
          cachedModuleResponses.set(data.checksum, moduleResponse)
          task.deferred.resolve(moduleResponse)
        } catch (error) {
          task.deferred.reject(error as Error)
        }
      } else {
        task.deferred.reject(data.error)
      }
    }
  }

  setNumberOfChannels(numberOfChannels: number) {
    const diff = numberOfChannels - this.inputs.length
    if (diff > 0) {
      console.log(
        'memory grow by',
        diff,
        'channels. was:',
        this.config.channels,
        'now:',
        numberOfChannels
      )
      // console.log(this.code)
      this.memory.grow(Math.ceil((diff * CHANNEL_BYTES) / PAGE_BYTES))
      this.config.channels = numberOfChannels
      this.makeSampleBuffers()
      this.makeFloats()
      this.setCode(this.code!)
    }
    // if (diff) {
    // for (let i = 0; i < this.inputs.length; i++) {
    //   this.inputs[i].fill(0)
    // }
    // }
  }

  createMonoBuffer(id: string, pos: number, size: number) {
    const structData = new Int32Array(this.memory.buffer, pos, 5)

    structData.set([
      0,
      0,
      size,
      size - 1,
      size * Float32Array.BYTES_PER_ELEMENT,
    ])

    const monoBuffer = Object.assign(
      new Float32Array(
        this.memory.buffer,
        pos + 5 * Int32Array.BYTES_PER_ELEMENT,
        size
      ),
      { id, pos, size, structData }
    ) as MonoBuffer

    this.monoBuffers.set(id, monoBuffer)

    return monoBuffer
  }

  makeSampleBuffers() {
    const { sampleCount, sampleChannels } = this.config

    const sizes = sampleBufferSizes

    this.samples = Array.from(
      { length: sampleCount },
      () => Array.from({ length: sampleChannels })
    )

    // start where the input/output channels end
    const startPos = MEM_PADDING + EVENTS

    for (let i = 0; i < sampleCount; i++) {
      this.samples[i] = []

      for (let c = 0; c < sampleChannels; c++) {
        const pos = startPos + (
          (i * sizes.one + c * sizes.channel)
          * Float32Array.BYTES_PER_ELEMENT
        )

        this.samples[i][c] = this.createMonoBuffer(
          `s${i}_${c}`,
          pos,
          sizes.channel - 5
        )
      }
    }
  }

  makeFloats() {
    const { channels, blockSize } = this.config

    this.floats = new Float32Array(this.memory.buffer)
    this.ints = new Int32Array(this.memory.buffer)
    this.inputs = Array.from({ length: channels })
    this.outputs = Array.from({ length: channels })

    const startPos = MEM_PADDING + EVENTS + sampleBufferSizes.bytes
      + CHANNEL_BYTES
    for (let i = 0; i < channels; i++) {
      const pos = startPos + i * CHANNEL_BYTES
      this.inputs[i] = this.createMonoBuffer(`i${i}`, pos, blockSize)
      this.outputs[i] = this.createMonoBuffer(
        `o${i}`,
        pos + (blockSize * Float32Array.BYTES_PER_ELEMENT)
        + (5 * Int32Array.BYTES_PER_ELEMENT),
        blockSize
      )
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
    if (this.isReady) {
      for (
        const [key, global] of Object.entries(this.exports)
      ) {
        if (key.startsWith('export/') && global instanceof WebAssembly.Global) {
          this.exportEntries[key] = global.value
        }
      }
    }

    const { module: wasmModule, params } = await this.link(code)

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

      this.exports.fill(0, 0, 0, 0)
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
  }

  isReady = false
  code?: string

  async link(code: string) {
    const deferred = Deferred<{
      module: WebAssembly.Module
      params: ExportParam[]
    }>()

    const moduleChecksum = checksum(code)
    if (cachedModuleResponses.has(moduleChecksum)) {
      deferred.resolve(cachedModuleResponses.get(moduleChecksum)!)
      return deferred.promise
    }

    const id = cheapRandomId()
    pending.set(id, {
      checksum: moduleChecksum,
      deferred
    })

    this.port!.postMessage({
      id,
      code,
      monoBuffers: [...this.monoBuffers].map(([id, monoBuffer]) => [
        id,
        monoBuffer.pos,
      ]),
      config: this.config,
    })

    return deferred.promise
  }
}
