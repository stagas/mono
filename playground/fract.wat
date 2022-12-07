(func $main (export "main") (param $x f32) (result f32)
  (f32.sub
    (local.get $x)
    (f32.floor (local.get $x))
  )
)
