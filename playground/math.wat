;; INFO asc module.ts --textFile module.wast --outFile module.wasm --bindings raw -O3 --noAssert --runtime stub
(module
 (type $f32_=>_f32 (func (param f32) (result f32)))
 (global $~lib/math/rempio2f_y (mut f64) (f64.const 0))
 (memory $0 1)
 (data (i32.const 1024) ")\15DNn\83\f9\a2\c0\dd4\f5\d1W\'\fcA\90C<\99\95b\dba\c5\bb\de\abcQ\fe")
 (export "sin" (func $module/sin))
 (export "memory" (memory $0))
 (func $~lib/math/NativeMathf.sin (param $0 f32) (result f32)
  (local $1 f64)
  (local $2 f64)
  (local $3 i32)
  (local $4 f64)
  (local $5 i64)
  (local $6 i32)
  (local $7 i32)
  (local $8 i64)
  (local $9 i64)
  (local.set $6
   (i32.shr_u
    (local.tee $3
     (i32.reinterpret_f32
      (local.get $0)
     )
    )
    (i32.const 31)
   )
  )
  (block $folding-inner0
   (if
    (i32.le_u
     (local.tee $3
      (i32.and
       (local.get $3)
       (i32.const 2147483647)
      )
     )
     (i32.const 1061752794)
    )
    (block
     (if
      (i32.lt_u
       (local.get $3)
       (i32.const 964689920)
      )
      (return
       (local.get $0)
      )
     )
     (local.set $4
      (f64.mul
       (local.tee $1
        (f64.mul
         (local.tee $2
          (f64.promote_f32
           (local.get $0)
          )
         )
         (local.get $2)
        )
       )
       (local.get $2)
      )
     )
     (br $folding-inner0)
    )
   )
   (if
    (i32.le_u
     (local.get $3)
     (i32.const 1081824209)
    )
    (block
     (if
      (i32.le_u
       (local.get $3)
       (i32.const 1075235811)
      )
      (return
       (if (result f32)
        (local.get $6)
        (block (result f32)
         (local.set $2
          (f64.mul
           (local.tee $1
            (f64.mul
             (local.tee $1
              (f64.add
               (f64.promote_f32
                (local.get $0)
               )
               (f64.const 1.5707963267948966)
              )
             )
             (local.get $1)
            )
           )
           (local.get $1)
          )
         )
         (f32.neg
          (f32.demote_f64
           (f64.add
            (f64.add
             (f64.add
              (f64.mul
               (local.get $1)
               (f64.const -0.499999997251031)
              )
              (f64.const 1)
             )
             (f64.mul
              (local.get $2)
              (f64.const 0.04166662332373906)
             )
            )
            (f64.mul
             (f64.mul
              (local.get $2)
              (local.get $1)
             )
             (f64.add
              (f64.mul
               (local.get $1)
               (f64.const 2.439044879627741e-05)
              )
              (f64.const -0.001388676377460993)
             )
            )
           )
          )
         )
        )
        (block (result f32)
         (local.set $2
          (f64.mul
           (local.tee $1
            (f64.mul
             (local.tee $1
              (f64.sub
               (f64.promote_f32
                (local.get $0)
               )
               (f64.const 1.5707963267948966)
              )
             )
             (local.get $1)
            )
           )
           (local.get $1)
          )
         )
         (f32.demote_f64
          (f64.add
           (f64.add
            (f64.add
             (f64.mul
              (local.get $1)
              (f64.const -0.499999997251031)
             )
             (f64.const 1)
            )
            (f64.mul
             (local.get $2)
             (f64.const 0.04166662332373906)
            )
           )
           (f64.mul
            (f64.mul
             (local.get $2)
             (local.get $1)
            )
            (f64.add
             (f64.mul
              (local.get $1)
              (f64.const 2.439044879627741e-05)
             )
             (f64.const -0.001388676377460993)
            )
           )
          )
         )
        )
       )
      )
     )
     (local.set $4
      (f64.mul
       (local.tee $1
        (f64.mul
         (local.tee $2
          (f64.neg
           (select
            (f64.add
             (local.tee $1
              (f64.promote_f32
               (local.get $0)
              )
             )
             (f64.const 3.141592653589793)
            )
            (f64.sub
             (local.get $1)
             (f64.const 3.141592653589793)
            )
            (local.get $6)
           )
          )
         )
         (local.get $2)
        )
       )
       (local.get $2)
      )
     )
     (br $folding-inner0)
    )
   )
   (if
    (i32.le_u
     (local.get $3)
     (i32.const 1088565717)
    )
    (block
     (if
      (i32.le_u
       (local.get $3)
       (i32.const 1085271519)
      )
      (return
       (if (result f32)
        (local.get $6)
        (block (result f32)
         (local.set $2
          (f64.mul
           (local.tee $1
            (f64.mul
             (local.tee $1
              (f64.add
               (f64.promote_f32
                (local.get $0)
               )
               (f64.const 4.71238898038469)
              )
             )
             (local.get $1)
            )
           )
           (local.get $1)
          )
         )
         (f32.demote_f64
          (f64.add
           (f64.add
            (f64.add
             (f64.mul
              (local.get $1)
              (f64.const -0.499999997251031)
             )
             (f64.const 1)
            )
            (f64.mul
             (local.get $2)
             (f64.const 0.04166662332373906)
            )
           )
           (f64.mul
            (f64.mul
             (local.get $2)
             (local.get $1)
            )
            (f64.add
             (f64.mul
              (local.get $1)
              (f64.const 2.439044879627741e-05)
             )
             (f64.const -0.001388676377460993)
            )
           )
          )
         )
        )
        (block (result f32)
         (local.set $2
          (f64.mul
           (local.tee $1
            (f64.mul
             (local.tee $1
              (f64.sub
               (f64.promote_f32
                (local.get $0)
               )
               (f64.const 4.71238898038469)
              )
             )
             (local.get $1)
            )
           )
           (local.get $1)
          )
         )
         (f32.neg
          (f32.demote_f64
           (f64.add
            (f64.add
             (f64.add
              (f64.mul
               (local.get $1)
               (f64.const -0.499999997251031)
              )
              (f64.const 1)
             )
             (f64.mul
              (local.get $2)
              (f64.const 0.04166662332373906)
             )
            )
            (f64.mul
             (f64.mul
              (local.get $2)
              (local.get $1)
             )
             (f64.add
              (f64.mul
               (local.get $1)
               (f64.const 2.439044879627741e-05)
              )
              (f64.const -0.001388676377460993)
             )
            )
           )
          )
         )
        )
       )
      )
     )
     (local.set $4
      (f64.mul
       (local.tee $1
        (f64.mul
         (local.tee $2
          (select
           (f64.add
            (local.tee $1
             (f64.promote_f32
              (local.get $0)
             )
            )
            (f64.const 6.283185307179586)
           )
           (f64.sub
            (local.get $1)
            (f64.const 6.283185307179586)
           )
           (local.get $6)
          )
         )
         (local.get $2)
        )
       )
       (local.get $2)
      )
     )
     (br $folding-inner0)
    )
   )
   (if
    (i32.ge_u
     (local.get $3)
     (i32.const 2139095040)
    )
    (return
     (f32.sub
      (local.get $0)
      (local.get $0)
     )
    )
   )
   (local.set $3
    (block $~lib/math/rempio2f|inlined.0 (result i32)
     (if
      (i32.lt_u
       (local.get $3)
       (i32.const 1305022427)
      )
      (block
       (local.set $2
        (f64.nearest
         (f64.mul
          (local.tee $1
           (f64.promote_f32
            (local.get $0)
           )
          )
          (f64.const 0.6366197723675814)
         )
        )
       )
       (global.set $~lib/math/rempio2f_y
        (f64.sub
         (f64.sub
          (local.get $1)
          (f64.mul
           (local.get $2)
           (f64.const 1.5707963109016418)
          )
         )
         (f64.mul
          (local.get $2)
          (f64.const 1.5893254773528196e-08)
         )
        )
       )
       (br $~lib/math/rempio2f|inlined.0
        (i32.trunc_sat_f64_s
         (local.get $2)
        )
       )
      )
     )
     (local.set $8
      (i64.extend_i32_s
       (i32.and
        (local.tee $7
         (i32.sub
          (i32.shr_s
           (local.get $3)
           (i32.const 23)
          )
          (i32.const 152)
         )
        )
        (i32.const 63)
       )
      )
     )
     (local.set $5
      (i64.load offset=8
       (local.tee $7
        (i32.add
         (i32.shl
          (i32.shr_s
           (local.get $7)
           (i32.const 6)
          )
          (i32.const 3)
         )
         (i32.const 1024)
        )
       )
      )
     )
     (global.set $~lib/math/rempio2f_y
      (f64.mul
       (f64.copysign
        (f64.const 8.515303950216386e-20)
        (f64.promote_f32
         (local.get $0)
        )
       )
       (f64.convert_i64_s
        (local.tee $8
         (i64.shl
          (local.tee $5
           (i64.add
            (i64.mul
             (local.tee $9
              (i64.extend_i32_s
               (i32.or
                (i32.and
                 (local.get $3)
                 (i32.const 8388607)
                )
                (i32.const 8388608)
               )
              )
             )
             (i64.or
              (i64.shl
               (i64.load
                (local.get $7)
               )
               (local.get $8)
              )
              (i64.shr_u
               (local.get $5)
               (i64.sub
                (i64.const 64)
                (local.get $8)
               )
              )
             )
            )
            (i64.shr_u
             (i64.mul
              (if (result i64)
               (i64.gt_u
                (local.get $8)
                (i64.const 32)
               )
               (i64.or
                (i64.shl
                 (local.get $5)
                 (i64.sub
                  (local.get $8)
                  (i64.const 32)
                 )
                )
                (i64.shr_u
                 (i64.load offset=16
                  (local.get $7)
                 )
                 (i64.sub
                  (i64.const 96)
                  (local.get $8)
                 )
                )
               )
               (i64.shr_u
                (local.get $5)
                (i64.sub
                 (i64.const 32)
                 (local.get $8)
                )
               )
              )
              (local.get $9)
             )
             (i64.const 32)
            )
           )
          )
          (i64.const 2)
         )
        )
       )
      )
     )
     (select
      (i32.sub
       (i32.const 0)
       (local.tee $3
        (i32.wrap_i64
         (i64.add
          (i64.shr_u
           (local.get $5)
           (i64.const 62)
          )
          (i64.shr_u
           (local.get $8)
           (i64.const 63)
          )
         )
        )
       )
      )
      (local.get $3)
      (local.get $6)
     )
    )
   )
   (local.set $1
    (global.get $~lib/math/rempio2f_y)
   )
   (return
    (select
     (f32.neg
      (local.tee $0
       (if (result f32)
        (i32.and
         (local.get $3)
         (i32.const 1)
        )
        (block (result f32)
         (local.set $2
          (f64.mul
           (local.tee $1
            (f64.mul
             (local.get $1)
             (local.get $1)
            )
           )
           (local.get $1)
          )
         )
         (f32.demote_f64
          (f64.add
           (f64.add
            (f64.add
             (f64.mul
              (local.get $1)
              (f64.const -0.499999997251031)
             )
             (f64.const 1)
            )
            (f64.mul
             (local.get $2)
             (f64.const 0.04166662332373906)
            )
           )
           (f64.mul
            (f64.mul
             (local.get $2)
             (local.get $1)
            )
            (f64.add
             (f64.mul
              (local.get $1)
              (f64.const 2.439044879627741e-05)
             )
             (f64.const -0.001388676377460993)
            )
           )
          )
         )
        )
        (f32.demote_f64
         (f64.add
          (f64.add
           (local.get $1)
           (f64.mul
            (local.tee $1
             (f64.mul
              (local.tee $2
               (f64.mul
                (local.get $1)
                (local.get $1)
               )
              )
              (local.get $1)
             )
            )
            (f64.add
             (f64.mul
              (local.get $2)
              (f64.const 0.008333329385889463)
             )
             (f64.const -0.16666666641626524)
            )
           )
          )
          (f64.mul
           (f64.mul
            (local.get $1)
            (f64.mul
             (local.get $2)
             (local.get $2)
            )
           )
           (f64.add
            (f64.mul
             (local.get $2)
             (f64.const 2.718311493989822e-06)
            )
            (f64.const -1.9839334836096632e-04)
           )
          )
         )
        )
       )
      )
     )
     (local.get $0)
     (i32.and
      (local.get $3)
      (i32.const 2)
     )
    )
   )
  )
  (f32.demote_f64
   (f64.add
    (f64.add
     (local.get $2)
     (f64.mul
      (local.get $4)
      (f64.add
       (f64.mul
        (local.get $1)
        (f64.const 0.008333329385889463)
       )
       (f64.const -0.16666666641626524)
      )
     )
    )
    (f64.mul
     (f64.mul
      (local.get $4)
      (f64.mul
       (local.get $1)
       (local.get $1)
      )
     )
     (f64.add
      (f64.mul
       (local.get $1)
       (f64.const 2.718311493989822e-06)
      )
      (f64.const -1.9839334836096632e-04)
     )
    )
   )
  )
 )
 (func $module/sin (param $0 f32) (result f32)
  (call $~lib/math/NativeMathf.sin
   (local.get $0)
  )
 )
)
