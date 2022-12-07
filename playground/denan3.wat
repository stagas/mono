(func $main (export "main") (param $x f32) (result f32)
  (local $result f32)

  (local.set $result (f32.sub
    (local.get $x)
    (local.get $x)
  ))

  (if
    (result f32)

    (i32.eqz (i32.reinterpret_f32 (local.get $result)))

    (then
      (local.get $x)
    )
    (else
      (f32.const 0)
    )
  )
)
