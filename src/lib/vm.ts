import { Module } from '../compiler'
import { S } from '../sexpr'
import { Type, W } from '../typed'

import { userPtr, channelsPtr, SIZE_CHANNEL_IO, SIZE_CHANNEL_ONE } from '../const'

export const env = ({
  memory,
  setupPtr,
  eventsPtr: eventsPointer,
  sampleRate,
}: {
  memory: WebAssembly.MemoryDescriptor
  setupPtr: number
  eventsPtr: number
  sampleRate: number
}) =>
  `;;wasm
  (import "env" "memory"
    (memory
      ${memory.initial}
      ${memory.maximum}
      ${memory.shared ? 'shared' : ''}
    )
  )

  (global $global_mem_ptr (export "global_mem_ptr") (mut i32) (i32.const ${setupPtr}))

  ;; set the max number of loop iterations per sample
  (global $infinite_loop_guard (mut i32) (i32.const 0))
  (global $max_loop (mut i32) (i32.const 128))

  (global $sr (export "sampleRate") (mut f32) (f32.const ${sampleRate}))
  (global $nyq (export "nyquistFreq") (mut f32) (f32.const ${(sampleRate / 2) | 0}))
  (global $t (export "currentTime") (mut f32) (f32.const 0))
  (global $t64 (mut f64) (f64.const 0))
  (global $coeff64 (export "coeff") (mut f64) (f64.const 1.0))
  (global $co (mut f32) (f32.const 1.0))
  (global $pi (f32) (f32.const 3.1415927410125732))
  (global $pi2 (f32) (f32.const 6.2831854820251465))
  (global $tau (f32) (f32.const 6.2831854820251465))
  (global $hpi (f32) (f32.const 1.5707963705062866))
  (global $cf (export "cf") (mut i32) (i32.const 0))
  (global $bf (export "bf") (mut i32) (i32.const 0))

  (global $mathseed (mut f32) (f32.const 0))
  (global $$x (mut f32) (f32.const 0))
  (global $ch (mut i32) (i32.const 0))

  (global $events (i32) (i32.const ${eventsPointer}))
`

// TODO: length should be the global_buffer_length

export interface VM {
  process(
    events: number,
  ): void

  fill(
    frame: number,
    offset: number,
    end: number,
  ): void

  midi_in?(
    op: number,
    x: number,
    y: number
  ): void
}

// export const reset_mem = (
//   { memPadding, channelBytes }: { memPadding: number; channelBytes: number },
// ) =>
//   `;;wasm
// (func $reset_mem (export "reset_mem")
//   (global.set $global_mem_ptr (i32.const ${memPadding}))
// )
// (func $clear_mem (export "clear_mem")
//   (local $i i32)

//   (global.set $global_mem_ptr (i32.const ${memPadding}))

//   (loop $loop
//     (i32.store (i32.add (global.get $global_mem_ptr) (local.get $i)) (i32.const 0))

//     (br_if $loop
//       (i32.ne
//         (local.tee $i (i32.add (local.get $i) (i32.const 1)))
//         (i32.const ${channelBytes >> 2})
//       )
//     )
//   )
// )
// `

export const process = (mod: Module) =>
  `;;wasm
(func $process (export "process")
  (param $events i32)

  (local $eventsIndex i32)
  (local $pos i32)

  (loop $eventsLoop
    (local.set $pos
      (i32.add
        (i32.shl
          (local.get $eventsIndex)
          (i32.const 4)
        )
        (global.get $events)
      )
    )

    (if (i32.eqz (i32.load offset=0 (local.get $pos)))
      (then
        (call $fill
          (i32.load offset=4 (local.get $pos))
          (i32.load offset=8 (local.get $pos))
          (i32.load offset=12 (local.get $pos))
        )
      )
      (else
        (drop ${S(('midi_in' in mod.funcs) ?
    mod.funcCall('midi_in', [
      mod.typeAs(Type.i32, ['i32.load offset=4', ['local.get', '$pos']]),
      mod.typeAs(Type.i32, ['i32.load offset=8', ['local.get', '$pos']]),
      mod.typeAs(Type.i32, ['i32.load offset=12', ['local.get', '$pos']]),
    ]) : ['i32.const', '0'])}
        )
      )
    )

    (br_if $eventsLoop (i32.ne
      (local.tee $eventsIndex (i32.add (i32.const 1) (local.get $eventsIndex)))
      (local.get $events)
    ))
  )
)
`

export const fill = (
  mod: Module,
  {
    inputChannels,
    outputChannels,
  }: { inputChannels: number, outputChannels: number },
) =>
  `;;wasm
  (func $fill (export "fill")
    ;; song position starting frame
    (param $frame i32)
    ;; buffer offset
    (param $offset i32)
    ;; buffer end index exclusive
    (param $end i32)

    (local $sample_time f64)

    (local $user_mem_ptr i32)

    (local $channels_ptr i32)
    (local $buffer_ptr i32)
    (local $sample f32)

    ${mod.f_type === Type.multi ? `;;wasm
    (local $channels_R_ptr i32)
    (local $buffer_R_ptr i32)
    (local $sample_R f32)
    ` : ''}

    (local.set $channels_ptr (i32.const ${channelsPtr}))

    ${mod.f_type === Type.multi ? `;;wasm
    (local.set $channels_R_ptr (i32.const ${channelsPtr + (SIZE_CHANNEL_IO << 2)
    }))
    ` : ''}

    (local.set $user_mem_ptr (i32.const ${userPtr}))

    (; sample_time = 1.0 / sampleRate ;)
    (local.set $sample_time (f64.div (f64.const 1.0)
      (f64.promote_f32 (global.get $sr))
    ))

    (; userland coefficient ;)
    (global.set $co (f32.demote_f64 (global.get $coeff64) ))

    (; DON'T DELETE NEXT LINE: used for troubleshooting frame/time issues ;)
    (; local.set $frame (i32.add (local.get $frame) (i32.const 0xffffffff)) ;)

    (; t64 = frame / sampleRate ;)
    (global.set $t64 (f64.div (f64.convert_i32_s (local.get $frame))
      (f64.promote_f32 (global.get $sr))
    ))

    (; userland time ;)
    (global.set $t (f32.demote_f64 (global.get $t64)))

    (if
      (i32.eq
        (i32.const 0)
        (local.get $end)
      )
      (then
        (global.set $global_mem_ptr (local.get $user_mem_ptr))

        (global.set $infinite_loop_guard (i32.const 0))

        (global.set $cf (local.get $frame))
        (global.set $bf (local.get $offset))

        ;; run initializers
        (call $__begin__)

        return
      )
    )

    ${Array.from({ length: inputChannels }, (_, i) => `;;wasm
    (i32.store offset=0 (global.get $#i${i}) (i32.const 0))
    (i32.store offset=4 (global.get $#i${i}) (i32.const 0))
    ;; todo: zero out #zero
    `).join('\n')}

    ${Array.from({ length: outputChannels }, (_, i) => `;;wasm
    (i32.store offset=0 (global.get $#o${i}) (i32.const 0))
    (i32.store offset=4 (global.get $#o${i}) (i32.const 0))
    `).join('\n')}

    ;; do
    (loop $loop
      (global.set $global_mem_ptr (local.get $user_mem_ptr))

      (global.set $infinite_loop_guard (i32.const 0))

      (global.set $cf (local.get $frame))
      (global.set $bf (local.get $offset))

      ;; run initializers
      (call $__begin__)

      (local.set $buffer_ptr
        (i32.add
          (local.get $channels_ptr)
          (i32.shl (local.get $offset) (i32.const 2))
        )
      )

      ${mod.f_type === Type.multi ? `;;wasm
      (local.set $buffer_R_ptr
        (i32.add
          (local.get $channels_R_ptr)
          (i32.shl (local.get $offset) (i32.const 2))
        )
      )
      ` : ''}

      ;; read input
      ;;(global.set $$x
      ;;  (f32.load offset=20 (local.get $buffer_ptr))
      ;;)

      ${mod.f_type === Type.multi ? '(local.set $sample_R' : ''}
        (local.set $sample
          ${W(mod.f_type) < W(Type.f32) ? '(f32.convert_i32_s ' : ''}
            ${S(mod.funcCall('f', []))}
          ${W(mod.f_type) < W(Type.f32) ? ')' : ''}
        )
      ${mod.f_type === Type.multi ? ')' : ''}

      ;; buffer[$offset] =
      (f32.store offset=${(SIZE_CHANNEL_ONE << 2) + 20} (local.get $buffer_ptr)
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

      ${mod.f_type === Type.multi ? `;;wasm
      ;; buffer_R[$offset] =
      (f32.store offset=${(SIZE_CHANNEL_ONE << 2) + 20} (local.get $buffer_R_ptr)
        ;; if $sample is finite return $sample else return 0
        (select
          (local.get $sample_R)
          (f32.const 0)
          (f32.eq
            (f32.const 0)
            (f32.sub
              (local.get $sample_R)
              (local.get $sample_R)
            )
          )
        )
      )
      ` : ''}

      ;; $t64 += $sample_time
      (global.set $t64 (f64.add (global.get $t64) (local.get $sample_time)))
      (global.set $t (f32.demote_f64 (global.get $t64)))

      ;; $offset++
      (local.set $offset (i32.add (local.get $offset) (i32.const 1)))

      ${Array.from({ length: inputChannels }, (_, i) => `;;wasm
      (i32.store offset=0 (global.get $#i${i}) (local.get $offset))
      (i32.store offset=4 (global.get $#i${i}) (local.get $offset))
      `).join('\n')}

      ${Array.from({ length: outputChannels }, (_, i) => `;;wasm
      (i32.store offset=0 (global.get $#o${i}) (local.get $offset))
      (i32.store offset=4 (global.get $#o${i}) (local.get $offset))
      `).join('\n')}

      ;; $frame++
      (local.set $frame (i32.add (local.get $frame) (i32.const 1)))

      ;; if ($offset !== $end) continue $loop
      (br_if $loop (i32.ne (local.get $offset) (local.get $end)))
    )
  )
`
