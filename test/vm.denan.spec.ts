import { VM } from '../src/vm'

describe('VM denan', () => {
  describe('memory', async () => {
    it('division by zero', async () => {
      const vm = new VM()
      await vm.setCode('f()=({p};{p}+=1/0;p)')
      expect(vm.exports.f()).toEqual(0)
    })
  })

  describe('buffer', () => {
    it('float division by zero', async () => {
      const vm = new VM()
      await vm.setCode('f()=(#:1;#=42.0/0;#(0))')
      expect(vm.exports.f()).toEqual(0)
    })

    it('int division by zero', async () => {
      const vm = new VM()
      await vm.setCode('f()=(#:1;#=42/0;#(0))')
      expect(vm.exports.f()).toEqual(0)
    })

    // it('buffer infinity read', async () => {
    //   const vm = new VM()
    //   await vm.setCode('f()=(#:2;y=#(-1/0);#=y+1;y)')
    //   vm.exports.global_mem_ptr.value = 0
    //   expect(vm.exports.f()).toEqual(0)
    //   vm.exports.global_mem_ptr.value = 0
    //   expect(vm.exports.f()).toEqual(1)
    // })

    it('map/reduce denan', async () => {
      {
        const vm = new VM()
        await vm.setCode('add(a,b)=(a+b);f()=(#:4,2;#=(2,3/0);#::add)')
        expect(vm.exports.f()).toEqual(2)
      }
      {
        const vm = new VM()
        await vm.setCode('add(a,b)=(a+b);f()=(#:4,2;#=(1,2);#=(3/0,4);#=(5,6);#=(7,8);#::add)')
        expect(vm.exports.f()).toEqual(33)
      }
      {
        const vm = new VM()
        await vm.setCode('add(a,b)=(a+b);f()=(#:4,2;#=(1,2/0);#=(3,4/0);#=(5,6);#=(7,8);#=(9,10);#::add)')
        expect(vm.exports.f()).toEqual(48)
      }
    })
  })
})
