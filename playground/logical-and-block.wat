(func $and (export "main") (param $x f32) (param $y f32) (param $z f32) (result f32)
  (block (result f32)
    (f32.const 0)
    (br_if 0 (f32.eq (f32.const 0) (local.get $x)))
    (br_if 0 (f32.eq (f32.const 0) (local.get $y)))
    (return (local.get $z))
  )
)
