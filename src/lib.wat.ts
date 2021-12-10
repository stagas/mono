export const cos = `;;wasm
(func $cos
  (param $angle f32)
  (result f32)
  (local $x f32)
  (f32.const 0.15915494309189535)
  (get_local $angle)
  (f32.mul)
  (tee_local $x)
  (f32.const 0.25)
  (f32.sub)
  (get_local $x)
  (f32.const 0.25)
  (f32.add)
  (f32.floor)
  (f32.sub)
  (tee_local $x)
  (f32.abs)
  (f32.const 0.5)
  (f32.sub)
  (f32.const 16)
  (f32.mul)
  (get_local $x)
  (f32.mul)
  (tee_local $x)
  (f32.abs)
  (f32.const 1)
  (f32.sub)
  (get_local $x)
  (f32.mul)
  (f32.const 0.225)
  (f32.mul)
  (get_local $x)
  (f32.add)
)
`

export const sin = `;;wasm
(func $sin
  (param $angle f32)
  (result f32)
  (f32.const 1.5707963267948966)
  (get_local $angle)
  (f32.sub)
  (call $cos)
)
`

// generated using AssemblyScript Mathf.exp => wat2wasm => wasm2wat
export const exp = `;;wasm
(func $exp (param $0 f32) (result f32)
  (local $1 f32) (local $2 i32) (local $3 i32) (local $4 f32) (local $5 i32)
  (local.set $3
    (i32.shr_u
      (local.tee $5
        (i32.reinterpret_f32
          (local.get $0)))
      (i32.const 31)))
  (if $I0
    (i32.ge_u
      (local.tee $5
        (i32.and
          (local.get $5)
          (i32.const 2147483647)))
      (i32.const 1118743632))
    (then
      (if $I1
        (i32.gt_u
          (local.get $5)
          (i32.const 2139095040))
        (then
          (return
            (local.get $0))))
      (if $I2
        (i32.ge_u
          (local.get $5)
          (i32.const 1118925336))
        (then
          (if $I3
            (local.get $3)
            (then
              (if $I4
                (i32.ge_u
                  (local.get $5)
                  (i32.const 1120924085))
                (then
                  (return
                    (f32.const 0x0p+0 (;=0;))))))
            (else
              (return
                (f32.mul
                  (local.get $0)
                  (f32.const 0x1p+127 (;=1.70141e+38;))))))))))
  (if $I5
    (i32.gt_u
      (local.get $5)
      (i32.const 1051816472))
    (then
      (local.set $0
        (f32.sub
          (local.tee $1
            (f32.sub
              (local.get $0)
              (f32.mul
                (f32.convert_i32_s
                  (local.tee $2
                    (if $I6 (result i32)
                      (i32.gt_u
                        (local.get $5)
                        (i32.const 1065686418))
                      (then
                        (i32.trunc_f32_s
                          (f32.add
                            (f32.mul
                              (local.get $0)
                              (f32.const 0x1.715476p+0 (;=1.4427;)))
                            (f32.copysign
                              (f32.const 0x1p-1 (;=0.5;))
                              (local.get $0)))))
                      (else
                        (i32.sub
                          (i32.const 1)
                          (i32.shl
                            (local.get $3)
                            (i32.const 1)))))))
                (f32.const 0x1.62e4p-1 (;=0.693146;)))))
          (local.tee $4
            (f32.mul
              (f32.convert_i32_s
                (local.get $2))
              (f32.const 0x1.7f7d1cp-20 (;=1.42861e-06;)))))))
    (else
      (if $I7
        (i32.le_u
          (local.get $5)
          (i32.const 956301312))
        (then
          (return
            (f32.add
              (local.get $0)
              (f32.const 0x1p+0 (;=1;))))))
      (local.set $1
        (local.get $0))))
  (local.set $0
    (f32.add
      (f32.add
        (f32.sub
          (f32.div
            (f32.mul
              (local.get $0)
              (local.tee $0
                (f32.sub
                  (local.get $0)
                  (f32.mul
                    (local.tee $0
                      (f32.mul
                        (local.get $0)
                        (local.get $0)))
                    (f32.add
                      (f32.mul
                        (local.get $0)
                        (f32.const -0x1.6aa42ap-9 (;=-0.00276673;)))
                      (f32.const 0x1.55551ep-3 (;=0.166666;)))))))
            (f32.sub
              (f32.const 0x1p+1 (;=2;))
              (local.get $0)))
          (local.get $4))
        (local.get $1))
      (f32.const 0x1p+0 (;=1;))))
  (if $I8 (result f32)
    (local.get $2)
    (then
      (f32.mul
        (if $I9 (result f32)
          (i32.gt_s
            (local.get $2)
            (i32.const 127))
          (then
            (local.set $0
              (f32.mul
                (local.get $0)
                (f32.const 0x1p+127 (;=1.70141e+38;))))
            (if $I10 (result f32)
              (i32.gt_s
                (local.tee $2
                  (i32.sub
                    (local.get $2)
                    (i32.const 127)))
                (i32.const 127))
              (then
                (local.set $2
                  (select
                    (local.tee $2
                      (i32.sub
                        (local.get $2)
                        (i32.const 127)))
                    (i32.const 127)
                    (i32.lt_s
                      (local.get $2)
                      (i32.const 127))))
                (f32.mul
                  (local.get $0)
                  (f32.const 0x1p+127 (;=1.70141e+38;))))
              (else
                (local.get $0))))
          (else
            (if $I11 (result f32)
              (i32.lt_s
                (local.get $2)
                (i32.const -126))
              (then
                (local.set $0
                  (f32.mul
                    (local.get $0)
                    (f32.const 0x1p-102 (;=1.97215e-31;))))
                (if $I12 (result f32)
                  (i32.lt_s
                    (local.tee $2
                      (i32.add
                        (local.get $2)
                        (i32.const 102)))
                    (i32.const -126))
                  (then
                    (local.set $2
                      (select
                        (local.tee $2
                          (i32.add
                            (local.get $2)
                            (i32.const 102)))
                        (i32.const -126)
                        (i32.gt_s
                          (local.get $2)
                          (i32.const -126))))
                    (f32.mul
                      (local.get $0)
                      (f32.const 0x1p-102 (;=1.97215e-31;))))
                  (else
                    (local.get $0))))
              (else
                (local.get $0)))))
        (f32.reinterpret_i32
          (i32.shl
            (i32.add
              (local.get $2)
              (i32.const 127))
            (i32.const 23)))))
    (else
      (local.get $0))))
`

export const mod = `;;wasm
(func $mod (param $0 f32) (param $1 f32) (result f32)
  (local $2 i32) (local $3 i32) (local $4 i32) (local $5 i32) (local $6 i32) (local $7 i32) (local $8 i32)
  (if $I0
    (f32.eq
      (f32.abs
        (local.get $1))
      (f32.const 0x1p+0 (;=1;)))
    (then
      (return
        (f32.copysign
          (f32.sub
            (local.get $0)
            (f32.trunc
              (local.get $0)))
          (local.get $0)))))
  (local.set $7
    (i32.and
      (i32.shr_u
        (local.tee $4
          (i32.reinterpret_f32
            (local.get $1)))
        (i32.const 23))
      (i32.const 255)))
  (if $I1
    (select
      (i32.const 1)
      (f32.ne
        (local.get $1)
        (local.get $1))
      (select
        (i32.eq
          (local.tee $8
            (i32.and
              (i32.shr_u
                (local.tee $6
                  (i32.reinterpret_f32
                    (local.get $0)))
                (i32.const 23))
              (i32.const 255)))
          (i32.const 255))
        (i32.const 1)
        (local.tee $3
          (i32.shl
            (local.get $4)
            (i32.const 1)))))
    (then
      (return
        (f32.div
          (local.tee $0
            (f32.mul
              (local.get $0)
              (local.get $1)))
          (local.get $0)))))
  (if $I2
    (i32.ge_u
      (local.get $3)
      (local.tee $2
        (i32.shl
          (local.get $6)
          (i32.const 1))))
    (then
      (return
        (f32.mul
          (local.get $0)
          (f32.convert_i32_u
            (i32.ne
              (local.get $2)
              (local.get $3)))))))
  (i32.and
    (local.get $6)
    (i32.const -2147483648))
  (local.set $2
    (if $I3 (result i32)
      (local.get $8)
      (then
        (i32.or
          (i32.and
            (local.get $6)
            (i32.const 8388607))
          (i32.const 8388608)))
      (else
        (i32.shl
          (local.get $6)
          (i32.sub
            (i32.const 1)
            (local.tee $8
              (i32.sub
                (local.get $8)
                (i32.clz
                  (i32.shl
                    (local.get $6)
                    (i32.const 9))))))))))
  (local.set $3
    (if $I4 (result i32)
      (local.get $7)
      (then
        (i32.or
          (i32.and
            (local.get $4)
            (i32.const 8388607))
          (i32.const 8388608)))
      (else
        (i32.shl
          (local.get $4)
          (i32.sub
            (i32.const 1)
            (local.tee $7
              (i32.sub
                (local.get $7)
                (i32.clz
                  (i32.shl
                    (local.get $4)
                    (i32.const 9))))))))))
  (loop $L5
    (if $I6
      (i32.lt_s
        (local.get $7)
        (local.get $8))
      (then
        (local.set $2
          (i32.shl
            (if $I7 (result i32)
              (i32.ge_u
                (local.get $2)
                (local.get $3))
              (then
                (if $I8
                  (i32.eq
                    (local.get $2)
                    (local.get $3))
                  (then
                    (return
                      (f32.mul
                        (local.get $0)
                        (f32.const 0x0p+0 (;=0;))))))
                (i32.sub
                  (local.get $2)
                  (local.get $3)))
              (else
                (local.get $2)))
            (i32.const 1)))
        (local.set $8
          (i32.sub
            (local.get $8)
            (i32.const 1)))
        (br $L5))))
  (if $I9
    (i32.ge_u
      (local.get $2)
      (local.get $3))
    (then
      (if $I10
        (i32.eq
          (local.get $2)
          (local.get $3))
        (then
          (return
            (f32.mul
              (local.get $0)
              (f32.const 0x0p+0 (;=0;))))))
      (local.set $2
        (i32.sub
          (local.get $2)
          (local.get $3)))))
  (local.set $3
    (i32.sub
      (local.get $8)
      (local.tee $4
        (i32.clz
          (i32.shl
            (local.get $2)
            (i32.const 8))))))
  (select
    (i32.or
      (i32.sub
        (local.tee $2
          (i32.shl
            (local.get $2)
            (local.get $4)))
        (i32.const 8388608))
      (i32.shl
        (local.get $3)
        (i32.const 23)))
    (i32.shr_u
      (local.get $2)
      (i32.sub
        (i32.const 1)
        (local.get $3)))
    (i32.gt_s
      (local.get $3)
      (i32.const 0)))
  (f32.reinterpret_i32
    (i32.or)))
`
