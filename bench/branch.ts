import { VM } from '../src/vm'

const vm = new VM()
vm.setCode('a(x)=x>0?=lp(4*2):2*5;f(x)=x>0?lp(4*2):2*5')

export const cases = {
  select: () => {
    vm.exports.global_mem_ptr.value = 0x80000
    vm.exports.__begin__()
    vm.exports.a(Math.random() * 0.5 - 0.5)
  },
  branch: () => {
    vm.exports.global_mem_ptr.value = 0x80000
    vm.exports.__begin__()
    vm.exports.f(Math.random() * 0.5 - 0.5)
  },
}
