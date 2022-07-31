import { createParser, joinRegExp, Node, Token } from 'tinypratt'
import { flatten, unflatten } from './util'

export type { Node, Token }

export const parse = (input: string) => Parse(input.replace(/[;\s]*$/g, '')) // [input].join(';').replace(/;{1,}/g, ';'))

export const Parse = createParser(
  joinRegExp(
    [
      /(?<ids>[#a-zA-Z_$][a-zA-Z0-9_$]*)/,
      // TODO: support .5 .3 ...
      // TODO: support 1k(1000) 2k 1K(1024) ...
      // TODO: support 1s .5s 100ms ...
      // TODO: support 1b(beat) 1m(measure)
      /(?<num>inf|nan|\.\.|\d*\.?\d*e[+-]?\d+|(\d*\.((e[+-]?)?[\d]+)*\d+|\.\d+|\d+)(ms|[skKBbf])?)/,
      /(?<nul>\s+|\\\*[^]*?\*\\|\\.*)/,
      /(?<ops>\*\*|%%|::|\?=|\+\+|--|\+=|-=|\*=|\/=|%=|<<=|>>=|&=|\^=|\|=|&&|!&|\|\||!=|==|>=|<=|>>|<<|\.\.|[[\](){}\\"'`,\-~+*/%=<>?!:;.|&^@]{1})/,
      /(?<err>.)/,
    ],
    'g'
  ),
  ({ never, pass, bin, pre, post, until, expr }) => {
    const varbin = (op: string): typeof bin =>
      (t, r, x: any) => {
        // unroll aggregate expressions: (a,b,c) += x
        // TODO: simd
        if (x[0] == '{') {
          x = x[1]
          const lhs = flatten(',', x as Node[])
          const rhs = expr(r)
          const res = lhs.map(x => [t.as('='), [t.as('{'), x], [t.as(op), x, rhs]])
          return unflatten(t.as(';') as Token, res as Node[])
        } else {
          const lhs = flatten(',', x as Node[])
          const rhs = expr(r)
          const res = lhs.map(x => [t.as('='), x, [t.as(op), x, rhs]])
          return unflatten(t.as(';') as Token, res as Node[])
        }
      }

    const parseNumber = (t: Token) => {
      const isFloat = t.includes('.') || t.at(-1) == 'f'
      let parsed = parseFloat(t).toString()
      if (isFloat && !parsed.includes('.')) parsed += '.0'
      const number = t.as(parsed)
      const lastTwo = t.slice(-2)
      const lastOne = t.at(-1)
      if (lastTwo === 'ms')
        return [t.as('*', 'ops'), [t.as('*', 'ops'), number, t.as('sr', 'ids')], t.as('0.001')]
      else if (lastOne === 's')
        return [t.as('*', 'ops'), number, t.as('sr', 'ids')]
      else if (lastOne === 'k')
        return [t.as('*', 'ops'), number, t.as('1000')]
      else if (lastOne === 'K')
        return [t.as('*', 'ops'), number, t.as('1024')]
      else if (lastOne === 'b')
        return [t.as('*', 'ops'), number, t.as('br', 'ids')]
      else if (lastOne === 'B')
        return [t.as('*', 'ops'), [t.as('*', 'ops'), number, t.as('br', 'ids')], t.as('mr', 'ids')]
      return number
    }

    return {
      ops: [[], never],
      eof: [[], never],
      ids: [[], pass],
      num: [[], { nud: t => parseNumber(t), led: (t, _, x) => [x, parseNumber(t)] }],

      ';': [[1, 1], { led: bin, nud: (_, __, x: any) => expr(x) }],

      ',': [[2, 2], { led: bin }],
      '..': [[2, 2], { led: bin }],

      ':': [[3, 1], { led: bin }],
      '::': [[3, 2], { led: bin }],
      '=': [[3, 3], { led: bin }],
      '+=': [[3, 2], { led: varbin('+') }],
      '-=': [[3, 2], { led: varbin('-') }],
      '*=': [[3, 2], { led: varbin('*') }],
      '/=': [[3, 2], { led: varbin('/') }],
      '%=': [[3, 2], { led: varbin('%') }],
      '<<=': [[3, 2], { led: varbin('<<') }],
      '>>=': [[3, 2], { led: varbin('>>') }],
      '&=': [[3, 2], { led: varbin('&') }],
      '^=': [[3, 2], { led: varbin('^') }],
      '|=': [[3, 2], { led: varbin('|') }],

      '?': [[4, 2], { led: until(':', 3, (t, L, M, r) => [t, L, M, expr(r)]) }],
      // '?=': [[4, 2], { led: until(':', 3, (t, L, M, r) => [t, L, M, expr(r)]) }],

      '||': [[5, 4], { led: bin }],

      '&&': [[6, 5], { led: (t, r, x) => [t.as('?'), [t.as('!='), t.as('0', 'num'), x], expr(r), t.as('0', 'num')] }],

      '|': [[7, 6], { led: bin }],

      '^': [[7, 6], { led: bin }],

      '&': [[9, 8], { led: bin }],

      '==': [[10, 9], { led: bin }],
      '!=': [[10, 9], { led: bin }],

      '<': [[11, 10], { led: bin }],
      '>': [[11, 10], { led: bin }],
      '<=': [[11, 10], { led: bin }],
      '>=': [[11, 10], { led: bin }],

      '>>': [[12, 11], { led: bin }],
      '<<': [[12, 11], { led: bin }],

      '+': [[13, 13], { led: bin, nud: post(15) }],
      '-': [[13, 13], { led: bin, nud: post(15) }],

      '*': [[14, 14], { led: bin }],
      '/': [[14, 14], { led: bin }],
      '%': [[14, 14], { led: bin }],
      '%%': [[14, 14], { led: bin }],

      '!': [[15, 2], { led: pre, nud: post(15) }],
      '~': [[15, 2], { led: pre, nud: post(15) }],
      // '#': [[15, 2], { led: pre, nud: post(15) }],
      '.': [[15, 2], { led: pre, nud: post(15) }],
      '**': [[15, 15], { led: bin }],

      '++': [
        [16, 2],
        {
          led: (t, _, x) => [t.as('='), x, [t.as('+'), x, t.as('1', 'num')]],
          nud: t => {
            const x = expr(15)
            return [t.as('='), x, [t.as('+'), x, t.as('1', 'num')]]
          },
        },
      ],
      '--': [
        [16, 2],
        {
          led: (t, _, x) => [t.as('='), x, [t.as('-'), x, t.as('1', 'num')]],
          nud: t => {
            const x = expr(15)
            return [t.as('='), x, [t.as('-'), x, t.as('1', 'num')]]
          },
        },
      ],
      '{': [[16, 0], { nud: until('}', 0, (t, _, x) => [t, x]) }],
      '[': [[16, 16], { led: until(']', 0, (t, L, R) => [t, L, R]) }],
      '(': [[16, 0], {
        led: until(')', 0, (t, L, R) => [t.as('@'), L, R].filter(Boolean)),
        nud: until(')', 0, (_, __, x) => x),
      }],
    }
  }
)
