import { Arg } from '..'
import { Module } from '../compiler'
import { S } from '../sexpr'
import { Type, Typed, W } from '../typed'

export const env = ({
  memory,
  memPadding,
  eventsPointer,
  // samplePointers,
}: {
  memory: WebAssembly.MemoryDescriptor
  samplePointers: number[][]
  eventsPointer: number
  memPadding: number
}) =>
  `;;wasm
  (import "env" "memory"
    (memory
      ${memory.initial}
      ${memory.maximum}
      ${memory.shared ? 'shared' : ''}
    )
  )

  (global $global_mem_ptr (export "global_mem_ptr") (mut i32) (i32.const ${memPadding}))
  (global $start_ptr (export "start_ptr") (mut i32) (i32.const 0))

  ;; set the max number of loop iterations per sample
  (global $infinite_loop_guard (mut i32) (i32.const 0))
  (global $max_loop (mut i32) (i32.const 128))

  (global $sr (export "sampleRate") (mut f32) (f32.const 44100.0))
  (global $nyq (export "nyquistFreq") (mut f32) (f32.const 22050.0))
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
    channels: number,
    events: number,
  ): void

  fill(
    channel: number,
    frame: number,
    offset: number,
    end: number,
    ...args: number[]
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
  (param $channels i32)
  (param $events i32)

  (local $channelsIndex i32)
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

        (local.set $channelsIndex (i32.const 0))
        (loop $channelsLoop
          (call $fill (local.get $channelsIndex)
            (i32.load offset=4 (local.get $pos))
            (i32.load offset=8 (local.get $pos))
            (i32.load offset=12 (local.get $pos))
          )
          (br_if $channelsLoop (i32.ne
            (local.tee $channelsIndex (i32.add (i32.const 1) (local.get $channelsIndex)))
            (local.get $channels)
          ))
        )

      )
      (else

        (drop ${S(
    ('midi_in' in mod.funcs)
      ? mod.funcCall('midi_in', [
        mod.typeAs(Type.i32, ['i32.load offset=4', ['local.get', '$pos']]),
        mod.typeAs(Type.i32, ['i32.load offset=8', ['local.get', '$pos']]),
        mod.typeAs(Type.i32, ['i32.load offset=12', ['local.get', '$pos']]),
      ])
      : ['i32.const', '0']
  )
  }
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
  { type, params, blockSize, channels, channelBytes, memPadding }: {
    type: Type
    params: Arg[]
    blockSize: number
    channels: number
    maxChannels: number
    channelBytes: number
    memPadding: number
  },
) =>
  `;;wasm
  (func $fill (export "fill")
    ;; channel
    (param $channel i32)
    ;; song position starting frame
    (param $frame i32)
    ;; buffer offset
    (param $offset i32)
    ;; buffer end index exclusive
    (param $end i32)
    ;; ...params
    ${params.map((x) => `(param $${x.id} ${Typed.max(Type.i32, x.type!)})`).join(
    ' '
  )
  }

    (local $start_mem_ptr i32)
    (local $user_mem_ptr i32)
    (local $buffer_ptr i32)
    (local $sample f32)
    (local $sample_time f64)

    (local.set $start_mem_ptr (i32.add
      (i32.const ${memPadding})
      (i32.mul (i32.const ${channelBytes}) (local.get $channel)))
    )

    (local.set $user_mem_ptr (i32.add
      (i32.const ${((blockSize + 5) * 2) << 2})
      (local.get $start_mem_ptr))
    )

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

    (global.set $ch (local.get $channel))

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

    ${Array.from({ length: channels }, (_, i) =>
    `;;wasm
      (i32.store offset=0 (global.get $#i${i}) (i32.const 0))
      (i32.store offset=4 (global.get $#i${i}) (i32.const 0))
      (i32.store offset=0 (global.get $#o${i}) (i32.const 0))
      (i32.store offset=4 (global.get $#o${i}) (i32.const 0))
      ;; todo: zero out #zero
    `).join('\n')
  }

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
          (local.get $start_mem_ptr)
          (i32.shl (local.get $offset) (i32.const 2))
        )
      )

      ;; read input
      ;;(global.set $$x
      ;;  (f32.load offset=20 (local.get $buffer_ptr))
      ;;)

      ;; $sample = f(...params)
      (local.set $sample
        ${W(type) < W(Type.f32) ? '(f32.convert_i32_s ' : ''}
        (call $f ${params.map((x) => `(local.get $${x.id})`).join(' ')})
        ${W(type) < W(Type.f32) ? ')' : ''}
      )

      ;; buffer[$offset] =
      (f32.store offset=${((blockSize + 5) << 2) + 20} (local.get $buffer_ptr)
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

      ;; $t64 += $sample_time
      (global.set $t64 (f64.add (global.get $t64) (local.get $sample_time)))
      (global.set $t (f32.demote_f64 (global.get $t64)))

      ;; $offset++
      (local.set $offset (i32.add (local.get $offset) (i32.const 1)))

      ${Array.from({ length: channels }, (_, i) =>
    `;;wasm
        (i32.store offset=0 (global.get $#i${i}) (local.get $offset))
        (i32.store offset=4 (global.get $#i${i}) (local.get $offset))
        (i32.store offset=0 (global.get $#o${i}) (local.get $offset))
        (i32.store offset=4 (global.get $#o${i}) (local.get $offset))
      `).join('\n')
  }

      ;; $frame++
      (local.set $frame (i32.add (local.get $frame) (i32.const 1)))

      ;; if ($offset !== $end) continue $loop
      (br_if $loop (i32.ne (local.get $offset) (local.get $end)))
    )
  )
`
