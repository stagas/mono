// @env browser
import { compile } from '../src/compiler'
import { parse } from '../src/parser'
import { S, S0 } from '../src/sexpr'

const default_global = { global_mem_ptr: 'i32' }
// helpers
// const deepToString = (x: string | SExpr): string | SExpr => (Array.isArray(x) ? x.map(deepToString) : '' + x)
// const func = (sym: string, s: string) => deepToString([...compile(parse(s)).funcs[sym].body!])
const fc = (sym: string, s: string, global: any = default_global) =>
  S(compile(parse(s), global).funcs[sym].body!)
const c = (s: string, global: any = default_global) =>
  fc('__begin__', s, global)
const bodyOf = (s: string, global: any = default_global) =>
  S(compile(parse(s), global).body)

describe('compile', () => {
  // it('literal', () => {
  //   expect(compile('1' as Node).funcs['__start__'].pop()).toMatchSnapshot()
  // })

  it('parser node', () => {
    expect(c('1')).toMatchSnapshot()
  })

  it('x+y add op', () => {
    expect(c('1+2')).toMatchSnapshot()
  })

  it('x+y add op float', () => {
    expect(c('1.5+1')).toMatchSnapshot()
  })

  // it('op w/ type cast i32 -> f32', () => {
  //   expect(c('1+2', {}, Type.f32)).toMatchSnapshot()
  // })

  it('x+y add w/ type cast i32 -> i32', () => {
    expect(c('1+2')).toMatchSnapshot()
  })

  it('x+y add w/ type cast i32 -> bool', () => {
    expect(c('1+2')).toMatchSnapshot()
  })

  it('x+y add w/ type cast bool -> i32', () => {
    expect(c('1+1')).toMatchSnapshot()
  })

  // it('op w/ type cast bool -> f32', () => {
  //   expect(c('1+1', {}, Type.f32)).toMatchSnapshot()
  // })

  it('!x logical Not', () => {
    expect(c('!1')).toMatchSnapshot()
  })

  it('!x logical Not w/ f32', () => {
    expect(c('!1.0')).toMatchSnapshot()
  })

  it('-x negate i32', () => {
    expect(c('-1')).toMatchSnapshot()
  })

  it('-x negate f32', () => {
    expect(c('-1.0')).toMatchSnapshot()
  })

  it('-x negate bool', () => {
    expect(c('-!1')).toMatchSnapshot()
  })

  // it('function declaration', () => {
  //   expect(func('a', 'a(b)=1')).toMatchSnapshot()
  //   expect(func('a', 'a(b,c)=1')).toMatchSnapshot()
  // })

  it('function declaration with arg default literal', () => {
    const mod = compile(parse('a(b=1)=1'))
    const ctx = mod.funcs.a.context
    expect(ctx.params).toMatchSnapshot()
  })

  it('function declaration with exported arguments', () => {
    const mod = compile(parse('a(\'b=1)=1'))
    const ctx = mod.funcs.a.context
    expect(ctx.params).toMatchSnapshot()
  })

  it('function declaration with exported arguments, arg range and slope', () => {
    const mod = compile(parse('a(\'b[1..2]**.3=1)=1'))
    const ctx = mod.funcs.a.context
    expect(ctx.params).toMatchSnapshot()
  })

  it('function declaration with arg range', () => {
    const mod = compile(parse('a(b[1..2])=1'))
    const ctx = mod.funcs.a.context
    expect(ctx.params).toMatchSnapshot()
  })

  it('function declaration with multiple args ranges', () => {
    const mod = compile(parse('a(b[1..2],c,y[3..5])=1'))
    const ctx = mod.funcs.a.context
    expect(ctx.params).toMatchSnapshot()
  })

  it('function declaration with arg range expression', () => {
    const mod = compile(parse('a(b[1+2..2+3])=1'))
    const ctx = mod.funcs.a.context
    expect(ctx.params).toMatchSnapshot()
  })

  it('function declaration with arg range expression and default', () => {
    const mod = compile(parse('a(b[1+2..2+3]=4)=1'))
    const ctx = mod.funcs.a.context
    expect(ctx.params).toMatchSnapshot()
  })

  it('function declaration with arg range expression and default expression', () => {
    const mod = compile(parse('a(b[1+2..2+3]=1.5+2.5)=1'))
    const ctx = mod.funcs.a.context
    expect(ctx.params).toMatchSnapshot()
  })

  it('function declaration with arg range and default', () => {
    const mod = compile(parse('a(b[1..2]=1.5)=1'))
    const ctx = mod.funcs.a.context
    expect(ctx.params).toMatchSnapshot()
  })

  it('function declaration with arg range and default expression', () => {
    const mod = compile(parse('a(b[1..2]=1.5+2.5)=1'))
    const ctx = mod.funcs.a.context
    expect(ctx.params).toMatchSnapshot()
  })

  it('function declaration with expression referencing variables', () => {
    const mod = compile(parse('x=10;a(b[1..2]=x/2)=1;f()=a()'))
    const ctx = mod.funcs.a.context
    expect(ctx.params).toMatchSnapshot()
    expect(S0(mod.body)).toMatchSnapshot()
  })

  it('function declaration with range referencing variables', () => {
    const mod = compile(parse('x=10;a(b[1..x]=x/2)=1;f()=a()'))
    const ctx = mod.funcs.a.context
    expect(ctx.params).toMatchSnapshot()
    expect(S0(mod.body)).toMatchSnapshot()
  })

  it('function declaration with arg default expression', () => {
    const mod = compile(parse('a(b=1+2)=1'))
    const ctx = mod.funcs.a.context
    expect(ctx.params).toMatchSnapshot()
  })

  describe('assignment', () => {
    it('global', () => {
      expect(c('a=1')).toMatchSnapshot()
      expect(c('a=1;b=2')).toMatchSnapshot()
    })

    it('multi value', () => {
      expect(c('(a,b)=(1,2)')).toMatchSnapshot()
    })

    it('local', () => {
      expect(fc('f', 'f()=(a=1)')).toMatchSnapshot()
    })

    it('find scope', () => {
      expect(fc('f', 'a=1;f()=(a=2;b=3)')).toMatchSnapshot()
    })
  })

  it('parameters', () => {
    expect(fc('f', 'f(a)=(a=1)')).toMatchSnapshot()
  })

  it('parameters shadow globals', () => {
    expect(fc('f', 'a=1;f()=(a=2)')).toMatchSnapshot()
    expect(fc('f', 'a=1;f(a)=(a=2)')).toMatchSnapshot()
  })

  it('function call', () => {
    expect(c('a()=1;a(1,2)')).toMatchSnapshot()
    expect(c('a(x,y)=1;a(1,2)')).toMatchSnapshot()
    expect(c('a()=1;a()')).toMatchSnapshot()
    expect(c('a(x)=1;a(1.0)')).toMatchSnapshot()
  })

  it('function call arg missing use default', () => {
    expect(c('a(b=1)=1;a()')).toMatchSnapshot()
    expect(c('a(b=1.5)=1;a()')).toMatchSnapshot()
  })

  it('function call arg missing no default, use argument range', () => {
    expect(c('a(b[1..2])=1;a()')).toMatchSnapshot()
  })

  it('function call arg passed, use argument range for type cast', () => {
    expect(c('a(b[1.5..2.5])=1;a(1)')).toMatchSnapshot()
  })

  it('variable get global', () => {
    expect(c('a=1;a')).toMatchSnapshot()
  })

  it('variable get local', () => {
    expect(fc('f', 'f()=(a=1;a)')).toMatchSnapshot()
    const mod = compile(parse('f()=(a=1;a)'))
    expect(S0(mod.body)).toMatchSnapshot()
    // expect(S0(mod.body)).toMatchSnapshot()
    //   '(start $__start__) (func $f (export "f") (result i32) (local $a i32) (local.set $a (i32.const 1)) (local.get $a)) (func $__start__ (export "__start__"))'
    // )
  })

  it('variable get global from within local context', () => {
    expect(fc('f', 'a=2.0;f()=a')).toMatchSnapshot()
  })

  // it('weird global case', () => {
  //   expect(
  //     fc(
  //       'f',
  //       `
  //   t=1.0;
  //   st=1.0;
  //   f(x[300..500]=440)=-(t-st)
  // `
  //     )
  //   ).toMatchSnapshot()
  // })

  it('parameter shadow global variable', () => {
    expect(fc('f', 'a=2.0;f(a)=a')).toMatchSnapshot()
  })

  it('x?y:z ternary', () => {
    expect(c('0?1:2')).toMatchSnapshot()
    expect(c('1?1:2')).toMatchSnapshot()
    expect(c('1?1.2:2')).toMatchSnapshot()
    expect(c('1.5?1.2:2')).toMatchSnapshot()
  })

  it('x%y modulo', () => {
    expect(c('1%2')).toMatchSnapshot()
    expect(c('0%1')).toMatchSnapshot()
    expect(c('1.2%1')).toMatchSnapshot()
    expect(c('1.2%2')).toMatchSnapshot()
  })

  it('x<<y bitwise shift left', () => {
    expect(c('1<<2')).toMatchSnapshot()
    expect(c('1.2<<2')).toMatchSnapshot()
  })

  it('x>>y bitwise shift right', () => {
    expect(c('1>>2')).toMatchSnapshot()
    expect(c('1.2>>2')).toMatchSnapshot()
  })

  it('x&y bitwise AND', () => {
    expect(c('1&2')).toMatchSnapshot()
    expect(c('1.2&2')).toMatchSnapshot()
  })

  it('x^y bitwise XOR', () => {
    expect(c('1^2')).toMatchSnapshot()
    expect(c('1.2^2')).toMatchSnapshot()
  })

  it('x|y bitwise OR', () => {
    expect(c('1|2')).toMatchSnapshot()
    expect(c('1.2|2')).toMatchSnapshot()
  })

  it('~y bitwise NOT', () => {
    expect(c('~1')).toMatchSnapshot()
    expect(c('~1.2')).toMatchSnapshot()
  })

  it('x&&y logical And', () => {
    expect(c('1&&2')).toMatchSnapshot()
    expect(c('1&&2&&3')).toMatchSnapshot()
    expect(c('1&&2.5&&3')).toMatchSnapshot()
  })

  it('x||y logical Or', () => {
    expect(c('1||2')).toMatchSnapshot()
    expect(c('1||2||3')).toMatchSnapshot()
    expect(c('1||2.5||3')).toMatchSnapshot()
  })

  it('x||y logical Or quirky', () => {
    expect(bodyOf('f()=(a=-2f;a<-1||a>1?1:0)')).toMatchSnapshot()
  })

  it('x==y equality', () => {
    expect(c('1==2')).toMatchSnapshot()
    expect(c('1.2==2.2')).toMatchSnapshot()
  })

  it('x!=y non-equality', () => {
    expect(c('1!=2')).toMatchSnapshot()
    expect(c('1.2!=2.2')).toMatchSnapshot()
  })

  it('x<y less than', () => {
    expect(c('1<2')).toMatchSnapshot()
    expect(c('1.2<2.2')).toMatchSnapshot()
  })

  it('x>y greater than', () => {
    expect(c('1>2')).toMatchSnapshot()
    expect(c('1.2>2.2')).toMatchSnapshot()
  })

  it('x<=y less than or equal', () => {
    expect(c('1<=2')).toMatchSnapshot()
    expect(c('1.2<=2.2')).toMatchSnapshot()
  })

  it('x>=y greater than or equal', () => {
    expect(c('1>=2')).toMatchSnapshot()
    expect(c('1.2>=2.2')).toMatchSnapshot()
  })

  it('x+=y variable add', () => {
    expect(c('a=1;a+=1')).toMatchSnapshot()
    expect(c('a=1.5;a+=2.5')).toMatchSnapshot()
  })

  it('x-=y variable sub', () => {
    expect(c('a=1;a-=1')).toMatchSnapshot()
    expect(c('a=1.5;a-=2.5')).toMatchSnapshot()
  })

  it('x*=y variable mul', () => {
    expect(c('a=1;a*=1')).toMatchSnapshot()
    expect(c('a=1.5;a*=2.5')).toMatchSnapshot()
  })

  it('x/=y variable div', () => {
    expect(c('a=1;a/=1')).toMatchSnapshot()
    expect(c('a=1.5;a/=2.5')).toMatchSnapshot()
  })

  it('x%=y variable mod', () => {
    expect(c('a=1;a%=1')).toMatchSnapshot()
    expect(c('a=1.5;a%=2.5')).toMatchSnapshot()
  })

  it('x<<=y variable shift left', () => {
    expect(c('a=1;a<<=1')).toMatchSnapshot()
    expect(c('a=1.5;a<<=2.5')).toMatchSnapshot()
  })

  it('x>>=y variable shift right', () => {
    expect(c('a=1;a>>=1')).toMatchSnapshot()
    expect(c('a=1.5;a>>=2.5')).toMatchSnapshot()
  })

  it('x&=y variable bitwise AND', () => {
    expect(c('a=1;a&=1')).toMatchSnapshot()
    expect(c('a=1.5;a&=2.5')).toMatchSnapshot()
  })

  // it('x^=y variable bitwise XOR', () => {
  //   expect(c('a=1;a^=1')).toMatchSnapshot()
  //   expect(c('a=1.5;a^=2.5')).toMatchSnapshot()
  //     '(global.set $a (f32.const 1.5)) (global.set $a (f32.convert_i32_u (i32.xor (i32.trunc_f32_u (global.get $a)) (i32.trunc_f32_u (f32.const 2.5)))))'
  //   )
  // })

  it('x|=y variable bitwise OR', () => {
    expect(c('a=1;a|=1')).toMatchSnapshot()
    expect(c('a=1.5;a|=2.5')).toMatchSnapshot()
  })

  it('++x variable add 1 pre', () => {
    expect(c('a=1;++a')).toMatchSnapshot()
    expect(c('a=1.5;++a')).toMatchSnapshot()
  })

  it('x++ variable add 1 post', () => {
    expect(c('a=1;a++')).toMatchSnapshot()
    expect(c('a=1.5;a++')).toMatchSnapshot()
  })

  it('--x variable sub 1 pre', () => {
    expect(c('a=1;--a')).toMatchSnapshot()
    expect(c('a=1.5;--a')).toMatchSnapshot()
  })

  it('x-- variable sub 1 post', () => {
    expect(c('a=1;a--')).toMatchSnapshot()
    expect(c('a=1.5;a--')).toMatchSnapshot()
  })

  it('load operations', () => {
    expect(fc('f', 'f()={x}')).toMatchSnapshot()
    expect(fc('f', 'f()={x,y}')).toMatchSnapshot()
  })

  it('store operations', () => {
    expect(fc('f', 'f()=({x};{x}=1.5)')).toMatchSnapshot()
    expect(fc('f', 'f()=({x,y};{x,y}=(1.5,2))')).toMatchSnapshot()
    expect(fc('f', 'f()=({x,y};{y,x}=(1.5,2))')).toMatchSnapshot()
  })

  it('multiple load/store operations', () => {
    expect(fc('f', 'f()=({x};{y};{x}=1;{y}=2)')).toMatchSnapshot()
  })

  describe('buffer', () => {
    it('allocate', () => {
      expect(fc('f', 'f()=(#:4,2)')).toMatchSnapshot()
      expect(c('#:4,2')).toMatchSnapshot()
      expect(c('#foo:4,2')).toMatchSnapshot()
      expect(c('#:4')).toMatchSnapshot()
      expect(fc('f', 'f()=(#:4;0.0)')).toMatchSnapshot()
    })

    it('expression', () => {
      expect(c('#foo:(3+4)')).toMatchSnapshot()
    })

    it('float expression', () => {
      expect(c('#foo:(3.5+4.5)')).toMatchSnapshot()
    })

    it('fn call expression', () => {
      expect(bodyOf('fn(x)=3.5+x;#foo:(fn(4.5))')).toMatchSnapshot()
    })

    it('pass reference', () => {
      expect(bodyOf('fn(#x)=#x;f()=(#x:1; fn(*#x); 0)')).toMatchSnapshot()
    })

    it('read', () => {
      expect(fc('f', 'f()=(#:4;#(2))')).toMatchSnapshot()
    })

    it('negative index read', () => {
      expect(bodyOf('f()=(#:1;#=42;#(-1))')).toMatchSnapshot()
    })

    it('read tuple', () => {
      expect(fc('f', 'f()=(#:4,2;(a,b)=#(2))')).toMatchSnapshot()
      expect(fc('f', 'f()=(#:4,3;(a,b)=#(2))')).toMatchSnapshot()
      expect(() => fc('f', 'f()=(#:4,2;(a,b,c)=#(2))')).toThrow('are greater')
    })

    it('write', () => {
      expect(fc('f', 'f()=(#:4;#=2)')).toMatchSnapshot()
    })

    it('write tuple', () => {
      expect(fc('f', 'f()=(#:4,2;#=(2,3))')).toMatchSnapshot()
    })

    it('map/call/reduce', () => {
      expect(() => fc('f', 'add(a,b)=(a+b);f()=(#:4,2;#=(2,3);foo::add:add)'))
        .toThrow('must be a buffer')
      expect(fc('f', 'add(a,b)=(a+b);f()=(#:4,2;#=(2,3);#::add:add*555)'))
        .toMatchSnapshot()
    })

    it('function with internal buffer', () => {
      expect(bodyOf('v()=(#:2;y=#(0);#=1;y);f()=v()')).toMatchSnapshot()
    })
  })

  describe('quirky cases', () => {
    it('works', () => {
      expect(bodyOf('a(\'x)=x;f()=a()')).toMatchSnapshot()
    })

    it('negate then convert', () => {
      expect(bodyOf('f()=(-1+1.0)')).toMatchSnapshot()
    })
  })

  describe('keywords', () => {
    it('while', () => {
      expect(c('i=0;while i<5 i++;i')).toMatchSnapshot()
    })
  })
})
