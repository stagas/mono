(func $add (export "add") (param $x f32) (param $y f32) (result f32)
  (f32.add (local.get $x) (local.get $y))
)
