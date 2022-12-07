(func $main (export "main") (param $x f32) (result f32)
  (f32.mul
    (local.get $x)
    (f32.const 0.5)
  )
)
