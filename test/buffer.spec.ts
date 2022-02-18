import { S } from '../src/sexpr'
import { VM } from '../src/vm'

const run = (code: string) => {
  const vm = new VM()
  vm.setCode(code)
  let a_type, a_source
  if (vm.linker.module.funcs.a) {
    a_type = vm.linker.module.typeOf(vm.linker.module.funcs.a.body.at(-1))
    a_source = S(vm.linker.module.funcs.a.source)
  }
  return {
    vm,
    typeOf: vm.linker.module.typeOf,
    funcs: vm.linker.module.funcs,
    a_type,
    a_source,
    start_type: vm.linker.module.typeOf(vm.linker.module.funcs.__start__.body.at(-1)),
    start_source: S(vm.linker.module.funcs.__start__.source),
    f_type: vm.linker.module.typeOf(vm.linker.module.funcs.f.body.at(-1)),
    f_source: S(vm.linker.module.funcs.f.source),
    a: vm.exports.a,
    f: (...params: any) => {
      // simulate start of loop
      vm.exports.global_mem_ptr.value = 0
      return vm.exports.f.call(this, ...params)
    },
  }
}

describe('buffer', () => {
  it('allocate local', () => {
    const m = run('f()=(#:4;0.0)')
    expect(m.f()).toEqual(0)
  })

  it('allocate global', () => {
    const m = run('#:4,2;f()=(0.0)')
    expect(m.f()).toEqual(0)
  })

  it('buffer write', () => {
    const m = run('f()=(#:4;#=2;0.0)')
    expect(m.f()).toEqual(0)
  })

  it('buffer read', () => {
    const m = run('f()=(#:1;#=42;#(0))')
    expect(m.f()).toEqual(42)
  })

  it('buffer negative index read', () => {
    const m = run('f()=(#:2;y=#(-1);#=y+1;y)')
    expect(m.f()).toEqual(0)
    expect(m.f()).toEqual(1)
  })

  it('call function with internal buffer', () => {
    const m = run('v()=(#:1;y=#(0);#=y+1;y);f()=v()')
    expect(m.f()).toEqual(0)
    expect(m.f()).toEqual(1)
    expect(m.f()).toEqual(2)
    expect(m.f()).toEqual(3)
    expect(m.f()).toEqual(4)
  })

  it('map/reduce', () => {
    {
      const m = run('add(a,b)=(a+b);f()=(#:4,2;#=(2,3);#::add)')
      expect(m.f()).toEqual(5)
    }
    {
      const m = run('add(a,b)=(a+b);f()=(#:4,2;#=(1,2);#=(3,4);#=(5,6);#=(7,8);#::add)')
      expect(m.f()).toEqual(36)
    }
    {
      const m = run('add(a,b)=(a+b);f()=(#:4,2;#=(1,2);#=(3,4);#=(5,6);#=(7,8);#=(9,10);#::add)')
      expect(m.f()).toEqual(52)
    }
  })

  it('global tuple', () => {
    const m = run('#:(2,2); a(x,y)=(#=(x,y);0); b(x,y)=(x+y); f()=(#::b)')
    m.a(1, 1)
    expect(m.f()).toEqual(2)
    m.a(2, 2)
    expect(m.f()).toEqual(6)
    expect(m.f()).toEqual(6)
    m.a(2, 2)
    expect(m.f()).toEqual(8)
    expect(m.f()).toEqual(8)
    expect(m.f()).toEqual(8)
    m.a(2, 2)
    expect(m.f()).toEqual(8)
    expect(m.f()).toEqual(8)
    expect(m.f()).toEqual(8)
    m.a(1, 1)
    expect(m.f()).toEqual(6)
    expect(m.f()).toEqual(6)
    expect(m.f()).toEqual(6)
  })
})
