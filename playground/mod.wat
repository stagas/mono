(func $main (export "main") (param $x i32) (param $y i32) (result i32)
  (local $rem i32)

  (local.set $rem (i32.rem_s
    (local.get $x)
    (local.get $y)
  ))

  (select
    (i32.add
      (local.get $y)
      (local.get $rem)
    )
    (local.get $rem)
    (i32.lt_s
      (local.get $rem)
      (i32.const 0)
    )
  )
)
