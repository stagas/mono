(func $and (export "main") (param $x f32) (param $y f32) (param $z f32) (result f32)
  (if (result f32)
    (f32.ne (f32.const 0) (local.get $x))
    (then
      (if (result f32)
        (f32.ne (f32.const 0) (local.get $y))
        (then
          (local.get $z))
        (else
          (f32.const 0))
      )
    )
    (else
      (f32.const 0))
  )
)
