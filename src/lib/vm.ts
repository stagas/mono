import { Arg } from '..'
import type { LinkerConfig } from '../linker'
import { max, Type, W } from '../typed'

export const env = (config: LinkerConfig) =>
  `;;wasm
  (import "env" "memory"
    (memory
      ${config.memory.initial}
      ${config.memory.maximum}
      ${config.memory.shared ? 'shared' : ''}
    )
  )

  (global $output_mem_ptr (i32) (i32.const 0))
  (global $input_mem_ptr (i32) (i32.const 0x40000))
  (global $global_mem_ptr (export "global_mem_ptr") (mut i32) (i32.const 0x80000))
  (global $sr (export "sampleRate") (mut f32) (f32.const 44100.0))
  (global $t (export "currentTime") (mut f32) (f32.const 0))
  (global $pi (f32) (f32.const 3.1415927410125732))
  (global $pi2 (f32) (f32.const 6.2831854820251465))
`

// TODO: length should be the global_buffer_length

export interface VM {
  fill(frame: number, offset: number, end: number, ...args: number[]): void
}

export const fill = ({ type, params }: { type: Type; params: Arg[] }) =>
  `;;wasm
  (func $fill (export "fill")
    ;; song position starting frame
    (param $frame i32)
    ;; buffer offset
    (param $offset i32)
    ;; buffer end index exclusive
    (param $end i32)
    ;; ...params
    ${params.map(x => `(param $${x.id} ${max(Type.i32, x.type!)})`).join(' ')}

    (local $sample f32)
    (local $sample_time f32)

    (local.set $sample_time
      (f32.div
        (f32.const 1.0)
        (global.get $sr)
      )
    )

    ;; t = $frame / $sr
    ;;(global.set $t
    ;;  (f32.div
    ;;    (f32.convert_i32_u (local.get $frame))
    ;;    (global.get $sr)
    ;;  )
    ;;)

    ;; do
    (loop $loop
      (global.set $global_mem_ptr (i32.const 0x80000))

      ;; run initializers
      (call $__begin__)

      ;; $sample = f(...params)
      (local.set $sample
        ${W(type) < W(Type.f32) ? '(f32.convert_i32_s ' : ''}
        (call $f ${params.map(x => `(local.get $${x.id})`).join(' ')})
        ${W(type) < W(Type.f32) ? ')' : ''}
      )

      ;; buffer[$offset] =
      (f32.store (i32.shl (local.get $offset) (i32.const 2))
        ;; if $sample is finite return $sample else return 0
        (select
          (local.get $sample)
          (f32.const 0)
          (f32.eq
            (f32.const 0)
            (f32.sub
              (local.get $sample)
              (local.get $sample)
            )
          )
        )
      )

      ;; $t += $sample_time
      (global.set $t (f32.add (global.get $t) (local.get $sample_time)))

      ;; $offset++
      (local.set $offset (i32.add (local.get $offset) (i32.const 1)))

      ;; $frame++
      (local.set $frame (i32.add (local.get $frame) (i32.const 1)))

      ;; if ($offset !== $end) continue $loop
      (br_if $loop (i32.ne (local.get $offset) (local.get $end)))
    )
  )
`
