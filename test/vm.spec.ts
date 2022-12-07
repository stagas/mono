// @env browser
import { getSharedWorkerPort, VM } from '..'

const createVM = (config?: any) => {
  const vm = new VM(config)
  vm.setPort(getSharedWorkerPort())
  return vm
}

describe('VM', () => {
  it('creates a VM instance', () => {
    const vm = createVM()
    expect(vm).toBeInstanceOf(VM)
  })

  it('can load code', async () => {
    const vm = createVM()
    await vm.setCode('f()=1')
    expect(typeof vm.exports.f).toBe('function')
  })

  it('can export params', async () => {
    const vm = createVM()
    await vm.setCode('f(\'x)=x')
    expect(typeof vm.exports.f).toBe('function')
    expect(vm.exports.f(42)).toBe(42)
    expect(vm.params).toMatchSnapshot()
  })

  it('globals have the right type', async () => {
    const vm = createVM()
    await vm.setCode('#:2,3;a=42;z(\'v[0..1]=0.5)=({x};{x}=a;x);f()=z()')
    await vm.setCode('#:2,3;a=24;z(\'v[0..1]=0.5)=({x};{x}=a;x);f()=z()')
    expect(typeof vm.exports.f).toBe('function')
    expect(vm.exports.f()).toBe(42)
  })

  it('exported params with ranges and default values are accessible', async () => {
    const vm = createVM()
    await vm.setCode('z(\'x[0..1]=0.5)=x;f()=z()')
    expect(typeof vm.exports.z).toBe('function')
    // @ts-ignore
    expect(vm.exports.z(42)).toBe(42)
  })

  it('can modify exported params from globals', async () => {
    const vm = createVM()
    await vm.setCode('a(\'x)=x;f()=a()')
    expect(typeof vm.exports.f).toBe('function')
    expect(vm.exports.f()).toBe(0.5)
      ; (vm.exports[vm.params[0].name] as WebAssembly.Global).value = 42
    expect(vm.exports.f()).toBe(42)
  })

  it('can produce output', async () => {
    const vm = createVM()
    await vm.setCode('f(x)=x')
    vm.exports.fill(0, 0, 0, 3, 42)
    expect([...vm.outputs[0].slice(0, 3)]).toEqual([42, 42, 42])
  })

  describe('hot swap', () => {
    it('can hot swap code', async () => {
      const vm = createVM()
      await vm.setCode('f(x)=x')
      vm.exports.fill(0, 0, 0, 3, 42)
      expect([...vm.outputs[0].slice(0, 3)]).toEqual([42, 42, 42])
      await vm.setCode('f(x)=x+27')
      vm.exports.fill(0, 0, 0, 3, 42)
      expect([...vm.outputs[0].slice(0, 3)]).toEqual([69, 69, 69])
    })

    it('can be called many times without crashing', async () => {
      const vm = createVM()
      await vm.setCode('f(x)=x')
      for (let i = 0; i < 1000; i++)
        vm.exports.fill(0, 0, 0, 2048, 42)
      expect([...vm.outputs[0].slice(0, 3)]).toEqual([42, 42, 42])
    })

    it('can be called many times after hot swapping without crashing', async () => {
      const vm = createVM()
      await vm.setCode('f(x)=x')
      for (let i = 0; i < 1000; i++)
        vm.exports.fill(0, 0, 0, 2048, 42)
      expect([...vm.outputs[0].slice(0, 3)]).toEqual([42, 42, 42])
      await vm.setCode('f(x)=x+27')
      for (let i = 0; i < 1000; i++)
        vm.exports.fill(0, 0, 0, 2048, 42)
      expect([...vm.outputs[0].slice(0, 3)]).toEqual([69, 69, 69])
    })

    it('can hot swap with complex code', async () => {
      const vm = createVM({ blockSize: 44100 })
      await vm.setCode(String.raw`\
        #voices:(16,2); \ voices (time,hz)
        note_to_hz(x)=440*2**((x-33)/12);
        note_on(x)=(hz=note_to_hz(x);#voices=(t,hz);0);
        play(vt,hz,'a[0.5..100],'r[0.5..20]=10.0,'v[1..40.0]=5.0,'va[5..50.0]=10)=(
          dt=t-vt;
          A=1-exp(-dt*a);
          R=exp(-dt*r);
          s=sine(hz+sqr(v)*va)*A*R;
          s
        );
        f()=(#voices::play:sum)*0.1
      `)
      vm.exports.fill(0, 0, 0, 44100)
      expect([...vm.outputs[0].slice(0, 10)]).toMatchSnapshot()
      await vm.setCode(String.raw`\
        #voices:(16,2); \ voices (time,hz)
        note_to_hz(x)=440*2**((x-33)/12);
        note_on(x)=(hz=note_to_hz(x);#voices=(t,hz);0);
        play(vt,hz,'a[0.5..100],'r[0.5..20]=10.0,'v[1..40.0]=5.0,'va[5..50.0]=10)=(
          dt=t-vt;
          A=1-exp(-dt*a);
          R=exp(-dt*r);
          s=sine(hz+sqr(v)*va)*A*R;
          s
        );
        f()=(#voices::play:sum)*0.1
      `)
      vm.exports.currentTime.value = 1
      vm.exports.fill(0, 0, 0, 44100)
      expect([...vm.outputs[0].slice(0, 10)]).toMatchSnapshot()
    })

    it('can hot swap adding lp', async () => {
      const vm = createVM({ blockSize: 44100 })
      await vm.setCode(String.raw`\
        #voices:(16,2); \ voices (time,hz)
        note_to_hz(x)=440*2**((x-33)/12);
        note_on(x)=(hz=note_to_hz(x);#voices=(t,hz);0);
        play(vt,hz,'a[0.5..100],'r[0.5..20]=10.0,'v[1..40.0]=5.0,'va[5..50.0]=10)=(
          dt=t-vt;
          A=1-exp(-dt*a);
          R=exp(-dt*r);
          s=sine(hz+sqr(v)*va)*A*R;
          s
        );
        f()=(#voices::play:sum)*0.1
      `)
      vm.exports.fill(0, 0, 0, 44100)
      expect([...vm.outputs[0].slice(0, 10)]).toMatchSnapshot()

      await vm.setCode(String.raw`\
        #voices:(16,2); \ voices (time,hz)
        note_to_hz(x)=440*2**((x-33)/12);
        note_on(x)=(hz=note_to_hz(x);#voices=(t,hz);0);
        play(vt,hz,'a[0.5..100],'r[0.5..20]=10.0,'v[1..40.0]=5.0,'va[5..50.0]=10)=(
          dt=t-vt;
          A=1-exp(-dt*a);
          R=exp(-dt*r);
          s=lp(sine(hz+sqr(v)*va))*A*R;
          s
        );
        f()=(#voices::play:sum)*0.1
      `)
      vm.exports.currentTime.value = 1
      vm.exports.fill(0, 0, 0, 44100)

      expect([...vm.outputs[0].slice(0, 10)]).toMatchSnapshot()
    })
  })

  describe('modulo wrap', () => {
    it('modulo wrap positive', async () => {
      const vm = createVM()
      await vm.setCode('f(x)=x%%5')
      expect(vm.exports.f(7)).toEqual(2)
    })

    it('modulo wrap negative', async () => {
      const vm = createVM()
      await vm.setCode('f(x)=x%%5')
      expect(vm.exports.f(-1)).toEqual(4)
      expect(vm.exports.f(-2)).toEqual(3)
      expect(vm.exports.f(-3)).toEqual(2)
      expect(vm.exports.f(-4)).toEqual(1)
      expect(vm.exports.f(-5)).toEqual(0)
      expect(vm.exports.f(-6)).toEqual(4)
    })

    it('modulo wrap const negative', async () => {
      const vm = createVM()
      await vm.setCode('f()=-2%%5')
      expect(vm.exports.f()).toEqual(3)
    })
  })

  describe('buffer', () => {
    it('allocate local', async () => {
      const vm = createVM()
      await vm.setCode('f()=(#:4;0.0)')
      expect(vm.exports.f()).toEqual(0)
    })

    it('allocate global', async () => {
      const vm = createVM()
      await vm.setCode('#:4,2;f()=(0.0)')
      expect(vm.exports.f()).toEqual(0)
    })

    it('global 3 elements', async () => {
      const vm = createVM()
      await vm.setCode('#:4,3;p(x,y,z)=(x+y+z);f()=(#=(1,2,3);#::p:sum)')
      expect(vm.exports.f()).toEqual(6)
    })

    it('array global', async () => {
      const vm = createVM()
      await vm.setCode('#:[1,2,3,4];f()=(__begin__();#:::sum)')
      expect(vm.exports.f()).toEqual(10)
    })

    it('array read', async () => {
      const vm = createVM()
      await vm.setCode('#:[1,2,3,4];f()=(__begin__();#+#(-1))')
      expect(vm.exports.f()).toEqual(5)
    })

    it('array local', async () => {
      const vm = createVM()
      await vm.setCode('f()=(#:[1,2,3,4];#:::sum)')
      expect(vm.exports.f()).toEqual(10)
    })

    it('buffer write', async () => {
      const vm = createVM()
      await vm.setCode('f()=(#:4;#=2;0.0)')
      expect(vm.exports.f()).toEqual(0)
    })

    it('buffer read', async () => {
      const vm = createVM()
      await vm.setCode('f()=(#:1;#=42;#(0))')
      expect(vm.exports.f()).toEqual(42)
    })

    it('buffer negative index read', async () => {
      const vm = createVM()
      await vm.setCode('f()=(#:2;y=#(-1);#=y+1;y)')
      vm.exports.global_mem_ptr.value = 0x10000
      expect(vm.exports.f()).toEqual(0)
      vm.exports.global_mem_ptr.value = 0x10000
      expect(vm.exports.f()).toEqual(1)
    })

    it('fill', async () => {
      const vm = createVM()
      await vm.setCode('#w:441;#w:=sine(1/100);f()=#w(cf)')
      // vm.exports.global_mem_ptr.value = 0x10000
      // expect(vm.exports.f()).toEqual(0)
      // vm.exports.global_mem_ptr.value = 0x10000
      // expect(vm.exports.f()).toEqual(1)
      vm.exports.currentTime.value = 1
      vm.exports.fill(0, 0, 0, 10)
      expect([...vm.outputs[0].slice(0, 10)]).toMatchSnapshot()

      // expect(vm.outputs[0][0]).toEqual(0)
    })

    it('global buffer negative index read', async () => {
      const vm = createVM()
      await vm.setCode('#:2;f()=(y=#(-1);#=y+1;y)')
      vm.exports.currentTime.value = 1
      vm.exports.fill(0, 0, 0, 1)
      expect(vm.outputs[0][0]).toEqual(0)
      vm.exports.fill(0, 0, 0, 1)
      expect(vm.outputs[0][0]).toEqual(1)
      vm.exports.fill(0, 0, 0, 1)
      expect(vm.outputs[0][0]).toEqual(2)
      vm.exports.fill(0, 0, 0, 1)
      expect(vm.outputs[0][0]).toEqual(3)
    })

    it('call function with internal buffer', async () => {
      const vm = createVM()
      await vm.setCode('v()=(#:1;y=#(0);#=y+1;y);f()=v()')
      vm.exports.global_mem_ptr.value = 0x10000
      expect(vm.exports.f()).toEqual(0)
      vm.exports.global_mem_ptr.value = 0x10000
      expect(vm.exports.f()).toEqual(1)
      vm.exports.global_mem_ptr.value = 0x10000
      expect(vm.exports.f()).toEqual(2)
      vm.exports.global_mem_ptr.value = 0x10000
      expect(vm.exports.f()).toEqual(3)
      vm.exports.global_mem_ptr.value = 0x10000
      expect(vm.exports.f()).toEqual(4)
    })

    it('map/reduce', async () => {
      {
        const vm = createVM()
        await vm.setCode('add(a,b)=(a+b);f()=(#:4,2;#=(2,3);#::add:sum)')
        expect(vm.exports.f()).toEqual(5)
      }
      {
        const vm = createVM()
        await vm.setCode(
          'add(a,b)=(a+b);f()=(#:4,2;#=(1,2);#=(3,4);#=(5,6);#=(7,8);#::add:sum)'
        )
        expect(vm.exports.f()).toEqual(36)
      }
      {
        const vm = createVM()
        await vm.setCode(
          'add(a,b)=(a+b);f()=(#:4,2;#=(1,2);#=(3,4);#=(5,6);#=(7,8);#=(9,10);#::add:sum)'
        )
        expect(vm.exports.f()).toEqual(52)
      }
    })
  })

  describe('keywords', () => {
    it('while', async () => {
      const vm = createVM()
      await vm.setCode('f()=(i=0;(while i<5 i++);i)')
      expect(vm.exports.f()).toEqual(5)
    })

    it('while nested', async () => {
      const vm = createVM()
      await vm.setCode(
        'f()=(x=0;y=0;i=0;(while i<5 y=0; (while y<5 y++); x+=y; i++);x)'
      )
      expect(vm.exports.f()).toEqual(25)
    })

    it('while breaker', async () => {
      const vm = createVM()
      await vm.setCode('f()=(i=0;(while i<500 i++);i)')
      expect(vm.exports.f()).toEqual(128)
    })

    it('while breaker multiple times', async () => {
      const vm = createVM()
      await vm.setCode('f()=(i=0;(while i<500 i++);y=0;(while y<500 y++);y+i)')
      expect(vm.exports.f()).toEqual(129)
    })

    it('while breaker custom max_loop', async () => {
      const vm = createVM()
      await vm.setCode('max_loop=333;f()=(__begin__();i=0;(while i<500 i++);i)')
      expect(vm.exports.f()).toEqual(333)
    })

    it('while nested breaker', async () => {
      const vm = createVM()
      await vm.setCode(
        'f()=(x=0;y=0;i=0;(while i<50000 y=0; (while y<50000 y++); x+=y; i++);x)'
      )
      expect(vm.exports.f()).toEqual(128)
    })
  })

  describe('functions', () => {
    it('multiple return value assignment', async () => {
      const vm = createVM()
      await vm.setCode('z()=(1,2,3);f()=((a,b,c)=z();a+b*c)')
      expect(vm.exports.f()).toEqual(7)
    })

    it('multiple return value assign less', async () => {
      const vm = createVM()
      await vm.setCode('z()=(1,2,3);f()=((a,b)=z();a/b)')
      expect(vm.exports.f()).toEqual(0.5)
    })

    it('multiple return memory assignment', async () => {
      const vm = createVM()
      await vm.setCode('z()=(1,2,3);f()=({a,b,c}=z();a+b*c)')
      expect(vm.exports.f()).toEqual(7)
    })

    it('multiple return memory assign less', async () => {
      const vm = createVM()
      await vm.setCode('z()=(1,2,3);f()=({a,b}=z();a/b)')
      expect(vm.exports.f()).toEqual(0.5)
    })
  })
})
