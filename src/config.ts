import { Struct } from './compiler'

const KB = 1024
const MB = 1024 * KB

export const PAGE_BYTES = 64 * KB
export const MEM_PADDING = 1 * PAGE_BYTES
const MB_PER_CHANNEL = 5
export const CHANNEL_BYTES = MB * MB_PER_CHANNEL
export const EVENTS_SIZE = 128
export const EVENTS = 4 * EVENTS_SIZE * Int32Array.BYTES_PER_ELEMENT

export const config = {
  /** Number of initial channels (default: `1`) */
  channels: 1,
  /** Maximum number of channels (default: `6`) */
  maxChannels: 6,
  /** Block size in number of elements (default: `128`) */
  blockSize: 128,
  /** Sample rate */
  sampleRate: 44100,
  /** Number of sample buffers. */
  sampleCount: 6,
  /** Sample channels (mono=1 stereo=2). */
  sampleChannels: 2,
  /** Sample duration. */
  sampleSeconds: 4,
  /** Sample pointers. */
  samplePointers: [],

  eventsPointer: MEM_PADDING,
  eventsSize: EVENTS_SIZE,
}

export const sampleBufferSizes = (() => {
  const channel = config.sampleRate * config.sampleSeconds
    + Object.keys(Struct.Buffer).length - 1
  const one = channel * config.sampleChannels
  const bytes = one * config.sampleCount * Float32Array.BYTES_PER_ELEMENT
  const pages = bytes / PAGE_BYTES
  return { one, channel, bytes, pages }
})()

export const memory = {
  initial: Math.ceil(
    (MEM_PADDING
      + EVENTS
      + sampleBufferSizes.bytes
      + CHANNEL_BYTES
      + config.channels * CHANNEL_BYTES) / PAGE_BYTES
  ),
  maximum: Math.ceil(
    (MEM_PADDING
      + EVENTS
      + sampleBufferSizes.bytes
      + CHANNEL_BYTES
      + config.maxChannels * CHANNEL_BYTES) / PAGE_BYTES
  ),
}

export const memPadding = (MEM_PADDING + EVENTS + sampleBufferSizes.bytes)

// create sample pointers
const { sampleCount, sampleChannels } = config
const sizes = sampleBufferSizes
const startPos = MEM_PADDING + EVENTS
export const samplePointers = [] as number[][]
for (let i = 0; i < sampleCount; i++) {
  const ptrs = [] as number[]
  samplePointers.push(ptrs)
  for (let c = 0; c < sampleChannels; c++) {
    const ptr = startPos + (
      (i * sizes.one + c * sizes.channel)
      * Float32Array.BYTES_PER_ELEMENT
    )
    ptrs.push(ptr)
  }
}
