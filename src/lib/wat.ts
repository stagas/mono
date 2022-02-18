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

export const pow = `;;wasm
(func $pow (param $0 f32) (param $1 f32) (result f32)
  (local $2 f64) (local $3 i32) (local $4 i32) (local $5 i64) (local $6 f32) (local $7 i32) (local $8 i64) (local $9 i32) (local $10 f64) (local $11 f64)
  (if $I0
    (f32.le
      (f32.abs
        (local.get $1))
      (f32.const 0x1p+1 (;=2;)))
    (then
      (if $I1
        (f32.eq
          (local.get $1)
          (f32.const 0x1p+1 (;=2;)))
        (then
          (return
            (f32.mul
              (local.get $0)
              (local.get $0)))))
      (if $I2
        (f32.eq
          (local.get $1)
          (f32.const 0x1p-1 (;=0.5;)))
        (then
          (return
            (select
              (f32.abs
                (f32.sqrt
                  (local.get $0)))
              (f32.const inf (;=inf;))
              (f32.ne
                (local.get $0)
                (f32.const -inf (;=-inf;)))))))
      (if $I3
        (f32.eq
          (local.get $1)
          (f32.const -0x1p+0 (;=-1;)))
        (then
          (return
            (f32.div
              (f32.const 0x1p+0 (;=1;))
              (local.get $0)))))
      (if $I4
        (f32.eq
          (local.get $1)
          (f32.const 0x1p+0 (;=1;)))
        (then
          (return
            (local.get $0))))
      (if $I5
        (f32.eq
          (local.get $1)
          (f32.const 0x0p+0 (;=0;)))
        (then
          (return
            (f32.const 0x1p+0 (;=1;)))))))
  (if $I6
    (f32.eq
      (local.get $1)
      (f32.const 0x0p+0 (;=0;)))
    (then
      (return
        (f32.const 0x1p+0 (;=1;)))))
  (if $I7
    (i32.or
      (f32.ne
        (local.get $0)
        (local.get $0))
      (f32.ne
        (local.get $1)
        (local.get $1)))
    (then
      (return
        (f32.const nan (;=nan;)))))
  (if $I8
    (i32.and
      (local.tee $3
        (i32.shr_u
          (local.tee $9
            (i32.reinterpret_f32
              (local.get $0)))
          (i32.const 31)))
      (f32.eq
        (f32.nearest
          (local.get $1))
        (local.get $1)))
    (then
      (local.set $3
        (i32.const 0))
      (local.set $7
        (i32.shl
          (f32.ne
            (f32.nearest
              (local.tee $6
                (f32.mul
                  (local.get $1)
                  (f32.const 0x1p-1 (;=0.5;)))))
            (local.get $6))
          (i32.const 31)))
      (local.set $0
        (f32.neg
          (local.get $0)))))
  (local.set $4
    (i32.reinterpret_f32
      (local.get $1)))
  (f32.reinterpret_i32
    (i32.or
      (if $I9 (result i32)
        (i32.eq
          (local.tee $9
            (i32.and
              (local.get $9)
              (i32.const 2147483647)))
          (i32.const 1065353216))
        (then
          (select
            (i32.const 2143289344)
            (i32.const 1065353216)
            (i32.or
              (local.get $3)
              (i32.eq
                (i32.and
                  (local.get $4)
                  (i32.const 2147483647))
                (i32.const 2139095040)))))
        (else
          (if $I10 (result i32)
            (local.get $9)
            (then
              (if $I11 (result i32)
                (i32.eq
                  (local.get $9)
                  (i32.const 2139095040))
                (then
                  (select
                    (i32.const 0)
                    (i32.const 2139095040)
                    (i32.shr_u
                      (local.get $4)
                      (i32.const 31))))
                (else
                  (if $I12 (result i32)
                    (local.get $3)
                    (then
                      (i32.const 2143289344))
                    (else
                      (i32.reinterpret_f32
                        (f32.demote_f64
                          (block $B13 (result f64)
                            (local.set $5
                              (i64.shr_s
                                (i64.sub
                                  (local.tee $8
                                    (i64.reinterpret_f64
                                      (f64.promote_f32
                                        (local.get $0))))
                                  (i64.const 4604544271217802189))
                                (i64.const 52)))
                            (local.set $10
                              (f64.mul
                                (local.tee $2
                                  (f64.div
                                    (f64.sub
                                      (local.tee $2
                                        (f64.reinterpret_i64
                                          (i64.sub
                                            (local.get $8)
                                            (i64.shl
                                              (local.get $5)
                                              (i64.const 52)))))
                                      (f64.const 0x1p+0 (;=1;)))
                                    (f64.add
                                      (local.get $2)
                                      (f64.const 0x1p+0 (;=1;)))))
                                (local.get $2)))
                            (drop
                              (br_if $B13
                                (f64.const 0x0p+0 (;=0;))
                                (f64.lt
                                  (local.tee $2
                                    (f64.mul
                                      (f64.promote_f32
                                        (local.get $1))
                                      (f64.add
                                        (f64.mul
                                          (f64.add
                                            (local.get $2)
                                            (f64.mul
                                              (f64.mul
                                                (local.get $2)
                                                (local.get $10))
                                              (f64.add
                                                (f64.add
                                                  (f64.mul
                                                    (local.get $10)
                                                    (f64.const 0x1.999a7a8af4132p-3 (;=0.200002;)))
                                                  (f64.const 0x1.555554fd9caefp-2 (;=0.333333;)))
                                                (f64.mul
                                                  (f64.add
                                                    (f64.mul
                                                      (local.get $10)
                                                      (f64.const 0x1.e2f663b001c97p-4 (;=0.117911;)))
                                                    (f64.const 0x1.2438d7943703p-3 (;=0.142687;)))
                                                  (f64.mul
                                                    (local.get $10)
                                                    (local.get $10))))))
                                          (f64.const 0x1.71547652b82fep+1 (;=2.88539;)))
                                        (f64.convert_i64_s
                                          (local.get $5)))))
                                  (f64.const -0x1.ffp+9 (;=-1022;)))))
                            (drop
                              (br_if $B13
                                (f64.const inf (;=inf;))
                                (f64.ge
                                  (local.get $2)
                                  (f64.const 0x1p+10 (;=1024;)))))
                            (local.set $2
                              (f64.mul
                                (local.tee $11
                                  (f64.sub
                                    (local.get $2)
                                    (local.tee $10
                                      (f64.nearest
                                        (local.get $2)))))
                                (local.get $11)))
                            (f64.reinterpret_i64
                              (i64.add
                                (i64.reinterpret_f64
                                  (f64.add
                                    (f64.mul
                                      (local.get $11)
                                      (f64.add
                                        (f64.add
                                          (f64.add
                                            (f64.mul
                                              (local.get $11)
                                              (f64.const 0x1.ebfbe07d97b91p-3 (;=0.240227;)))
                                            (f64.const 0x1.62e4302fcc24ap-1 (;=0.693147;)))
                                          (f64.mul
                                            (f64.add
                                              (f64.mul
                                                (local.get $11)
                                                (f64.const 0x1.3b29e3ce9aef6p-7 (;=0.00961803;)))
                                              (f64.const 0x1.c6af6ccfc1a65p-5 (;=0.0555036;)))
                                            (local.get $2)))
                                        (f64.mul
                                          (f64.add
                                            (f64.mul
                                              (local.get $11)
                                              (f64.const 0x1.446c81e384864p-13 (;=0.000154697;)))
                                            (f64.const 0x1.5f0896145a89fp-10 (;=0.00133909;)))
                                          (f64.mul
                                            (local.get $2)
                                            (local.get $2)))))
                                    (f64.const 0x1p+0 (;=1;))))
                                (i64.shl
                                  (i64.trunc_f64_s
                                    (local.get $10))
                                  (i64.const 52))))))))))))
            (else
              (select
                (i32.const 2139095040)
                (i32.const 0)
                (i32.shr_u
                  (local.get $4)
                  (i32.const 31)))))))
      (local.get $7))))
`

// const inline_omega = (freq: string, sampleRate: string) => `;;wasm
//   ;; omega = (PI2 * freq) / sampleRate
//   (f32.div
//     (f32.mul (global.get $pi2) ${freq})
//     ${sampleRate}
//   )
// `

// const inline_alpha = (sin0: string, Q: string) => `;;wasm
//   ;; alpha = sin0 / (2.0 * Q)
//   (f32.div
//     ${sin0}
//     (f32.mul (f32.const 2.0) ${Q})
//   )
// `

// const inline_biquad_integrate = `;;wasm
//   ;; g = 1.0 / a0
//   (local.set $g (f32.div (f32.const 1.0) (local.get $a0)))

//   ;; {b0,b1,b2,a1,a2} *= g
//   (local.set $b0 (f32.mul (local.get $b0) (local.get $g)))
//   (local.set $b1 (f32.mul (local.get $b1) (local.get $g)))
//   (local.set $b2 (f32.mul (local.get $b2) (local.get $g)))
//   (local.set $a1 (f32.mul (local.get $a1) (local.get $g)))
//   (local.set $a2 (f32.mul (local.get $a2) (local.get $g)))
// `

// const inline_biquad_process = `;;wasm
//   ;; y0 = b0*x0 + b1*x1 + b2*x2  -  a1*y1 - a2*y2
//   ;; (- (- (+ (+ (* b0 x0) (* b1 x1)) (* b2 x2)) (* a1 y1)) (* a2 y2))
//   (local.set $y0
//     (f32.sub
//       (f32.sub
//         (f32.add
//           (f32.add
//             (f32.mul (local.get $b0) (local.get $x0))
//             (f32.mul (local.get $b1) (local.get $x1))
//           )
//           (f32.mul (local.get $b2) (local.get $x2))
//         )
//         (f32.mul (local.get $a1) (local.get $y1))
//       )
//       (f32.mul (local.get $a2) (local.get $y2))
//     )
//   )

//   ;; positions:
//   ;; x1=0, x2=4, y1=8, y2=12

//   ;; x2=x1
//   (f32.store offset=4 (local.get $mem_ptr) (local.get $x1))
//   ;; y2=y1
//   (f32.store offset=12 (local.get $mem_ptr) (local.get $y1))
//   ;; x1=x0
//   (f32.store offset=0 (local.get $mem_ptr) (local.get $x0))
//   ;; y1=y0
//   (f32.store offset=8 (local.get $mem_ptr) (local.get $y0))

//   (local.get $y0)
// `

/*

lp(x0, freq[1..1k]=100, Q[0.001..3]=1.0)=
  {x1,x2,y1,y2};

  w = (pi2 * freq) / sr;
  sin_w = sin(w);
  cos_w = cos(w);
  a = sin_w / (2.0 * Q);

  b0 = (1.0 - cos_w) / 2.0;
  b1 =  1.0 - cos_w;
  b2 = b0;
  a0 =  1.0 + a;
  a1 = -2.0 * cos_w;
  a2 =  1.0 - a;

  {b0,b1,b2,a1,a2} *= g;

  y0 = b0*x0 + b1*x1 + b2*x2 - a1*y1 - a2*y2;
  {y1,y2} = {y0,y1};
  {x1,x2} = {x0,x1};

  y0
;

*/

// export const lowpass = `;;wasm
//   (func $lowpass
//     (param $mem_ptr i32)
//     (param $x0 f32)
//     (param $freq f32)
//     (param $Q f32)
//     (result f32)

//     (local $a0 f32) (local $a1 f32) (local $a2 f32)
//     (local $b0 f32) (local $b1 f32) (local $b2 f32)

//     (local $omega f32)
//     (local $sin0 f32)
//     (local $cos0 f32)
//     (local $alpha f32)

//     (local $g f32)

//     ;; positions:
//     ;; x1=0, x2=4, y1=8, y2=12

//     (;;x0=input);;) (local $x1 f32) (local $x2 f32)
//     (local $y0 f32) (local $y1 f32) (local $y2 f32)

//     (local.set $x1 (f32.load offset=0 (local.get $mem_ptr)))
//     (local.set $x2 (f32.load offset=4 (local.get $mem_ptr)))
//     (local.set $y1 (f32.load offset=8 (local.get $mem_ptr)))
//     (local.set $y2 (f32.load offset=12 (local.get $mem_ptr)))

//     (local.set $omega ${inline_omega('(local.get $freq)', '(global.get $sr)')})
//     (local.set $sin0 (call $sin (local.get $omega)))
//     (local.set $cos0 (call $cos (local.get $omega)))
//     (local.set $alpha ${inline_alpha('(local.get $sin0)', '(local.get $Q)')})

//     ;; b0 = (1.0 - cos0) / 2.0
//     (local.set $b0 (f32.div (f32.sub (f32.const 1.0) (local.get $cos0)) (f32.const 2.0)))

//     ;; b1 = 1.0 - cos0
//     (local.set $b1 (f32.sub (f32.const 1.0) (local.get $cos0)))

//     ;; b2 = (1.0 - cos0) / 2.0
//     (local.set $b2 (f32.div (f32.sub (f32.const 1.0) (local.get $cos0)) (f32.const 2.0)))

//     ;; a0 = 1.0 + alpha
//     (local.set $a0 (f32.add (f32.const 1.0) (local.get $alpha)))

//     ;; a1 = -2.0 * cos0
//     (local.set $a1 (f32.mul (f32.const -2.0) (local.get $cos0)))

//     ;; a2 = 1.0 - alpha
//     (local.set $a2 (f32.sub (f32.const 1.0) (local.get $alpha)))

//     ${inline_biquad_integrate}

//     ${inline_biquad_process}
//   )
// `
