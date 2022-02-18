import { VM } from '../src/vm'

const vm_hot = new VM()
vm_hot.setCode('f(x)=x')

export const cases = {
  cold: () => {
    const vm = new VM()
    vm.setCode('f(x)=x')
  },
  hot: () => {
    vm_hot.setCode('f(x)=x')
  },
}
