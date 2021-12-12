import { compile } from '../compiler'
import { parse } from '../parser'
import { S0, SExpr } from '../sexpr'

// helpers
const deepToString = (x: string | SExpr): string | SExpr => (Array.isArray(x) ? x.map(deepToString) : '' + x)
const func = (sym: string, s: string) => deepToString([...compile(parse(s)).funcs[sym]!])
const fc = (sym: string, s: string, global?: any) => S0(compile(parse(s), global).funcs[sym].pop()!)
const c = (s: string, global?: any) => fc('__start__', s, global)

describe('compile', () => {
  // it('literal', () => {
  //   expect(compile('1' as Node).funcs['__start__'].pop()).toEqual([['i32.const', '1']])
  // })

  it('parser node', () => {
    expect(c('1')).toEqual('(i32.const 1)')
  })

  it('op', () => {
    expect(c('1+2')).toEqual('(i32.add (i32.const 1) (i32.const 2))')
  })

  // it('op w/ type cast i32 -> f32', () => {
  //   expect(c('1+2', {}, Type.f32)).toEqual('(f32.convert_i32_u (i32.add (i32.const 1) (i32.const 2)))')
  // })

  it('op w/ type cast i32 -> i32', () => {
    expect(c('1+2')).toEqual('(i32.add (i32.const 1) (i32.const 2))')
  })

  it('op w/ type cast i32 -> bool', () => {
    expect(c('1+2')).toEqual('(i32.add (i32.const 1) (i32.const 2))')
  })

  it('op w/ type cast bool -> i32', () => {
    expect(c('1+1')).toEqual('(i32.add (i32.const 1) (i32.const 1))')
  })

  // it('op w/ type cast bool -> f32', () => {
  //   expect(c('1+1', {}, Type.f32)).toEqual('(f32.convert_i32_u (i32.add (i32.const 1) (i32.const 1)))')
  // })

  it('logical not', () => {
    expect(c('!1')).toEqual('(i32.eqz (i32.const 1))')
  })

  it('logical not w/ f32', () => {
    expect(c('!1.0')).toEqual('(i32.eqz (i32.trunc_f32_s (f32.const 1.0)))')
  })

  it('negate i32', () => {
    expect(c('-1')).toEqual('(i32.mul (i32.const -1) (i32.const 1))')
  })

  it('negate f32', () => {
    expect(c('-1.0')).toEqual('(f32.mul (f32.const -1) (f32.const 1.0))')
  })

  it('negate bool', () => {
    expect(c('-!1')).toEqual('(i32.mul (i32.const -1) (i32.eqz (i32.const 1)))')
  })

  it('function declaration', () => {
    expect(func('a', 'a(b)=1')).toEqual([[['b']], [['i32.const', '1']]])
    expect(func('a', 'a(b,c)=1')).toEqual([[['b'], ['c']], [['i32.const', '1']]])
  })

  it('function declaration with arg default literal', () => {
    expect(func('a', 'a(b=1)=1')).toEqual([[['b']], [['i32.const', '1']]])
    const mod = compile(parse('a(b=1)=1'))
    const ctx = mod.contexts.get(mod.funcs['a'])!
    expect(ctx.args).toMatchObject([
      {
        id: { value: 'b' },
        default: ['i32.const', { value: '1' }],
      },
    ])
  })

  it('function declaration with arg range', () => {
    expect(func('a', 'a(b[1..2])=1')).toEqual([[['b']], [['i32.const', '1']]])
    const mod = compile(parse('a(b[1..2])=1'))
    const ctx = mod.contexts.get(mod.funcs['a'])!
    expect(ctx.args).toMatchObject([
      {
        id: { value: 'b' },
        range: [
          ['i32.const', { value: '1' }],
          ['i32.const', { value: '2' }],
        ],
      },
    ])
  })

  it('function declaration with arg range expression', () => {
    expect(func('a', 'a(b[1+2..2+3])=1')).toEqual([[['b']], [['i32.const', '1']]])
    const mod = compile(parse('a(b[1+2..2+3])=1'))
    const ctx = mod.contexts.get(mod.funcs['a'])!
    expect(ctx.args).toMatchObject([
      {
        id: { value: 'b' },
        range: [
          ['i32.add', ['i32.const', { value: '1' }], ['i32.const', { value: '2' }]],
          ['i32.add', ['i32.const', { value: '2' }], ['i32.const', { value: '3' }]],
        ],
      },
    ])
  })

  it('function declaration with arg range expression and default', () => {
    expect(func('a', 'a(b[1+2..2+3]=4)=1')).toEqual([[['b']], [['i32.const', '1']]])
    const mod = compile(parse('a(b[1+2..2+3]=4)=1'))
    const ctx = mod.contexts.get(mod.funcs['a'])!
    expect(ctx.args).toMatchObject([
      {
        id: { value: 'b' },
        default: ['i32.const', { value: '4' }],
        range: [
          ['i32.add', ['i32.const', { value: '1' }], ['i32.const', { value: '2' }]],
          ['i32.add', ['i32.const', { value: '2' }], ['i32.const', { value: '3' }]],
        ],
      },
    ])
  })

  it('function declaration with arg range expression and default expression', () => {
    expect(func('a', 'a(b[1+2..2+3]=1.5+2.5)=1')).toEqual([[['b']], [['i32.const', '1']]])
    const mod = compile(parse('a(b[1+2..2+3]=1.5+2.5)=1'))
    const ctx = mod.contexts.get(mod.funcs['a'])!
    expect(ctx.args).toMatchObject([
      {
        id: { value: 'b' },
        default: ['f32.add', ['f32.const', { value: '1.5' }], ['f32.const', { value: '2.5' }]],
        range: [
          ['i32.add', ['i32.const', { value: '1' }], ['i32.const', { value: '2' }]],
          ['i32.add', ['i32.const', { value: '2' }], ['i32.const', { value: '3' }]],
        ],
      },
    ])
  })

  it('function declaration with arg range and default', () => {
    expect(func('a', 'a(b[1..2]=1.5)=1')).toEqual([[['b']], [['i32.const', '1']]])
    const mod = compile(parse('a(b[1..2]=1.5)=1'))
    const ctx = mod.contexts.get(mod.funcs['a'])!
    expect(ctx.args).toMatchObject([
      {
        id: { value: 'b' },
        default: ['f32.const', { value: '1.5' }],
        range: [
          ['i32.const', { value: '1' }],
          ['i32.const', { value: '2' }],
        ],
      },
    ])
  })

  it('function declaration with arg range and default expression', () => {
    expect(func('a', 'a(b[1..2]=1.5+2.5)=1')).toEqual([[['b']], [['i32.const', '1']]])
    const mod = compile(parse('a(b[1..2]=1.5+2.5)=1'))
    const ctx = mod.contexts.get(mod.funcs['a'])!
    expect(ctx.args).toMatchObject([
      {
        id: { value: 'b' },
        default: ['f32.add', ['f32.const', { value: '1.5' }], ['f32.const', { value: '2.5' }]],
        range: [
          ['i32.const', { value: '1' }],
          ['i32.const', { value: '2' }],
        ],
      },
    ])
  })

  it('function declaration with arg default expression', () => {
    expect(func('a', 'a(b=1)=1')).toEqual([[['b']], [['i32.const', '1']]])
    const mod = compile(parse('a(b=1+2)=1'))
    const ctx = mod.contexts.get(mod.funcs['a'])!
    expect(ctx.args).toMatchObject([
      {
        id: { value: 'b' },
        default: ['i32.add', ['i32.const', { value: '1' }], ['i32.const', { value: '2' }]],
      },
    ])
  })

  it('assignment global', () => {
    expect(c('a=1')).toEqual('(global.set $a (i32.const 1))')
    expect(c('a=1;b=2')).toEqual('(global.set $a (i32.const 1)) (global.set $b (i32.const 2))')
  })

  it('assignment local', () => {
    expect(fc('f', 'f()=a=1')).toEqual('(local.set $a (i32.const 1))')
  })

  it('assignment find scope', () => {
    expect(fc('f', 'a=1;f()=(a=2;b=3)')).toEqual('(global.set $a (i32.const 2)) (local.set $b (i32.const 3))')
  })

  it('parameters', () => {
    expect(fc('f', 'f(a)=a=1')).toEqual('(local.set $a (f32.convert_i32_s (i32.const 1)))')
  })

  it('parameters shadow globals', () => {
    expect(fc('f', 'a=1;f()=a=2')).toEqual('(global.set $a (i32.const 2))')
    expect(fc('f', 'a=1;f(a)=a=2')).toEqual('(local.set $a (f32.convert_i32_u (i32.const 2)))')
  })

  it('function call', () => {
    expect(c('a()=1;a(1,2)')).toEqual('(call $a)')
    expect(c('a(x,y)=1;a(1,2)')).toEqual('(call $a (f32.convert_i32_s (i32.const 1)) (f32.convert_i32_u (i32.const 2)))')
    expect(c('a()=1;a()')).toEqual('(call $a)')
    expect(c('a(x)=1;a(1.0)')).toEqual('(call $a (f32.const 1.0))')
  })

  it('function call arg default', () => {
    expect(c('a(b=1)=1;a()')).toEqual('(call $a (i32.const 1))')
    expect(c('a(b=1.5)=1;a()')).toEqual('(call $a (f32.const 1.5))')
  })

  it('variable get global', () => {
    expect(c('a=1;a')).toEqual('(global.set $a (i32.const 1)) (global.get $a)')
  })

  it('variable get local', () => {
    expect(fc('f', 'f()=(a=1;a)')).toEqual('(local.set $a (i32.const 1)) (local.get $a)')
    const mod = compile(parse('f()=(a=1;a)'))
    expect(S0(mod.body)).toEqual(
      '(start $__start__) (func $f (export "f") (result i32) (local $a i32) (local.set $a (i32.const 1)) (local.get $a)) (func $__start__ (export "__start__"))'
    )
  })

  it('variable get global from within local context', () => {
    expect(fc('f', 'a=2.0;f()=a')).toEqual('(global.get $a)')
  })

  it('parameter shadow global variable', () => {
    expect(fc('f', 'a=2.0;f(a)=a')).toEqual('(local.get $a)')
  })
})