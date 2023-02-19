const KB = 1024
const MB = 1024 * KB
export const BYTES_PAGE = 64 * KB
export const BYTES_PADDING = 1 * BYTES_PAGE
export const BYTES_USER = MB * 5
export const EVENTS_SIZE = 128
export const BYTES_EVENTS = 4 * EVENTS_SIZE * Int32Array.BYTES_PER_ELEMENT

export const eventsPtr = BYTES_PADDING

export const MAX_CHANNELS = 2
export const MAX_SIZE_BLOCK = 128

export const SAMPLE_SAMPLE_RATE = 44100
export const SAMPLE_SECONDS = 4
export const SAMPLE_CHANNELS = 2
export const SAMPLE_MAX_COUNT = 1

// input + output
export const SIZE_CHANNEL_ONE = (MAX_SIZE_BLOCK + 5)
export const SIZE_CHANNEL_IO = SIZE_CHANNEL_ONE * 2
export const BYTES_CHANNELS = ((SIZE_CHANNEL_IO * MAX_CHANNELS) << 2)

export const SAMPLE_SIZES = (() => {
  const channel = SAMPLE_SAMPLE_RATE * SAMPLE_SECONDS + 5
  const one = channel * SAMPLE_CHANNELS
  const bytes = one * SAMPLE_MAX_COUNT * Float32Array.BYTES_PER_ELEMENT
  const pages = bytes / BYTES_PAGE
  return { one, channel, bytes, pages }
})()

export const BYTES_SAMPLES = SAMPLE_SIZES.bytes

export const channelsPtr =
  BYTES_PADDING
  + BYTES_EVENTS
  + BYTES_SAMPLES

export const setupPtr = channelsPtr + BYTES_CHANNELS
export const userPtr = setupPtr + BYTES_USER

const MEM_PAGES = Math.ceil(
  (userPtr + BYTES_USER) / BYTES_PAGE
)

export const memory = {
  initial: MEM_PAGES,
  maximum: MEM_PAGES,
}
