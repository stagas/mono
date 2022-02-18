import { VM } from '../src/vm'

describe('VM', () => {
  it('creates a VM instance', () => {
    const vm = new VM()
    expect(vm).toBeInstanceOf(VM)
  })

  it('can load code', () => {
    const vm = new VM()
    vm.setCode('f(x)=x')
    expect(typeof vm.exports.f).toBe('function')
  })

  it('can export params', () => {
    const vm = new VM()
    vm.setCode('f(.x)=x')
    expect(typeof vm.exports.f).toBe('function')
    expect(vm.exports.f(42)).toBe(42)
    expect(vm.params).toMatchSnapshot()
  })

  it('exported params with ranges and default values are accessible', () => {
    const vm = new VM()
    vm.setCode('f(.x[0..1]=0.5)=x')
    expect(typeof vm.exports.f).toBe('function')
    expect(vm.exports.f(42)).toBe(42)
  })

  it('can modify exported params from globals', () => {
    const vm = new VM()
    vm.setCode('a(.x)=x;f()=a()')
    expect(typeof vm.exports.f).toBe('function')
    expect(vm.exports.f()).toBe(0.5)
    ;(vm.exports[vm.params[0].name] as WebAssembly.Global).value = 42
    expect(vm.exports.f()).toBe(42)
  })

  it('can produce output', () => {
    const vm = new VM()
    vm.setCode('f(x)=x')
    vm.exports.fill(0, 3, 42)
    expect([...vm.outputs[0].slice(0, 3)]).toEqual([42, 42, 42])
  })

  describe('hot swap', () => {
    it('can hot swap code', () => {
      const vm = new VM()
      vm.setCode('f(x)=x')
      vm.exports.fill(0, 3, 42)
      expect([...vm.outputs[0].slice(0, 3)]).toEqual([42, 42, 42])
      vm.setCode('f(x)=x+27')
      vm.exports.fill(0, 3, 42)
      expect([...vm.outputs[0].slice(0, 3)]).toEqual([69, 69, 69])
    })

    it('can be called many times without crashing', () => {
      const vm = new VM()
      vm.setCode('f(x)=x')
      for (let i = 0; i < 1000; i++) {
        vm.exports.fill(0, 44100, 42)
      }
      expect([...vm.outputs[0].slice(0, 3)]).toEqual([42, 42, 42])
    })

    it('can be called many times after hot swapping without crashing', () => {
      const vm = new VM()
      vm.setCode('f(x)=x')
      for (let i = 0; i < 1000; i++) {
        vm.exports.fill(0, 44100, 42)
      }
      expect([...vm.outputs[0].slice(0, 3)]).toEqual([42, 42, 42])
      vm.setCode('f(x)=x+27')
      for (let i = 0; i < 1000; i++) {
        vm.exports.fill(0, 44100, 42)
      }
      expect([...vm.outputs[0].slice(0, 3)]).toEqual([69, 69, 69])
    })

    it('can hot swap with complex code', () => {
      const vm = new VM()
      vm.setCode(`\
        #voices:(16,2); // voices (time,hz)
        note_to_hz(x)=440*2^((x-33)/12);
        note_on(x)=(hz=note_to_hz(x);#voices=(t,hz);0);
        sine(hz=330.0)=({p};{p}+=(pi2*hz/sr)+(p>pi2?-pi2:0);sin(p));
        sqr(hz=330.0)=(sine(hz)>0?1:-1);
        play(vt,hz,.a[0.5..100],.r[0.5..20]=10.0,.v[1..40.0]=5.0,.va[5..50.0]=10)=(
          dt=t-vt;
          A=1-exp(-dt*a);
          R=exp(-dt*r);
          s=sine(hz+sqr(v)*va)*A*R;
          s
        );
        f()=(#voices::play)*0.1
      `)
      vm.exports.fill(0, 44100)
      expect([...vm.outputs[0].slice(0, 10)]).toMatchSnapshot()

      vm.setCode(`\
        #voices:(16,2); // voices (time,hz)
        note_to_hz(x)=440*2^((x-33)/12);
        note_on(x)=(hz=note_to_hz(x);#voices=(t,hz);0);
        sine(hz=330.0)=({p};{p}+=(pi2*hz/sr)+(p>pi2?-pi2:0);sin(p));
        sqr(hz=330.0)=(sine(hz)>0?1:-1);
        play(vt,hz,.a[0.5..100],.r[0.5..20]=10.0,.v[1..40.0]=5.0,.va[5..50.0]=10)=(
          dt=t-vt;
          A=1-exp(-dt*a);
          R=exp(-dt*r);
          s=sine(hz+sqr(v)*va)*A*R;
          s
        );
        f()=(#voices::play)*0.1
      `)
      vm.exports.fill(0, 44100)

      expect([...vm.outputs[0].slice(0, 10)]).toMatchSnapshot()
    })
  })

  describe('modulo wrap', () => {
    it('modulo wrap positive', () => {
      const vm = new VM()
      vm.setCode('f(x)=x%%5')
      expect(vm.exports.f(7)).toEqual(2)
    })

    it('modulo wrap negative', () => {
      const vm = new VM()
      vm.setCode('f(x)=x%%5')
      expect(vm.exports.f(-1)).toEqual(4)
      expect(vm.exports.f(-2)).toEqual(3)
      expect(vm.exports.f(-3)).toEqual(2)
      expect(vm.exports.f(-4)).toEqual(1)
      expect(vm.exports.f(-5)).toEqual(0)
      expect(vm.exports.f(-6)).toEqual(4)
    })

    it('modulo wrap const negative', () => {
      const vm = new VM()
      vm.setCode('f()=-2%%5')
      expect(vm.exports.f()).toEqual(3)
    })
  })

  describe('buffer', () => {
    it('allocate local', () => {
      const vm = new VM()
      vm.setCode('f()=(#:4;0.0)')
      expect(vm.exports.f()).toEqual(0)
    })

    it('allocate global', () => {
      const vm = new VM()
      vm.setCode('#:4,2;f()=(0.0)')
      expect(vm.exports.f()).toEqual(0)
    })

    it('buffer write', () => {
      const vm = new VM()
      vm.setCode('f()=(#:4;#=2;0.0)')
      expect(vm.exports.f()).toEqual(0)
    })

    it('buffer read', () => {
      const vm = new VM()
      vm.setCode('f()=(#:1;#=42;#(0))')
      expect(vm.exports.f()).toEqual(42)
    })

    it('buffer negative index read', () => {
      const vm = new VM()
      vm.setCode('f()=(#:2;y=#(-1);#=y+1;y)')
      vm.exports.global_mem_ptr.value = 0
      expect(vm.exports.f()).toEqual(0)
      vm.exports.global_mem_ptr.value = 0
      expect(vm.exports.f()).toEqual(1)
    })

    it('call function with internal buffer', () => {
      const vm = new VM()
      vm.setCode('v()=(#:1;y=#(0);#=y+1;y);f()=v()')
      vm.exports.global_mem_ptr.value = 0
      expect(vm.exports.f()).toEqual(0)
      vm.exports.global_mem_ptr.value = 0
      expect(vm.exports.f()).toEqual(1)
      vm.exports.global_mem_ptr.value = 0
      expect(vm.exports.f()).toEqual(2)
      vm.exports.global_mem_ptr.value = 0
      expect(vm.exports.f()).toEqual(3)
      vm.exports.global_mem_ptr.value = 0
      expect(vm.exports.f()).toEqual(4)
    })

    it('map/reduce', () => {
      {
        const vm = new VM()
        vm.setCode('add(a,b)=(a+b);f()=(#:4,2;#=(2,3);#::add)')
        expect(vm.exports.f()).toEqual(5)
      }
      {
        const vm = new VM()
        vm.setCode('add(a,b)=(a+b);f()=(#:4,2;#=(1,2);#=(3,4);#=(5,6);#=(7,8);#::add)')
        expect(vm.exports.f()).toEqual(36)
      }
      {
        const vm = new VM()
        vm.setCode('add(a,b)=(a+b);f()=(#:4,2;#=(1,2);#=(3,4);#=(5,6);#=(7,8);#=(9,10);#::add)')
        expect(vm.exports.f()).toEqual(52)
      }
    })
  })
})
