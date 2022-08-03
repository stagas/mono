(func $main (export "main") (param $0 f32) (result i32)
  local.get $0
  f32.const inf
  f32.ne
  local.get $0
  f32.const -inf
  f32.ne
  i32.and
  local.get $0
  local.get $0
  f32.ne
  i32.and
)
