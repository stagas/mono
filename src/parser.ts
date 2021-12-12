import { createParser, joinRegExp, Node, Token } from 'tinypratt'

export { Node, Token }

export const parse: (input: string) => Node & {
  panic: (message: string, token: Token) => string
} = createParser(
  joinRegExp(
    [
      /(?<ids>[a-zA-Z_$][a-zA-Z0-9_$]*)/,
      /(?<num>inf|nan|\d[\d_]*(\.((e[+\-]?)?[\d]+)+[kBb]*|(e[+\-]?[\d]+)?[kBb]*))/,
      /(?<ops>\+\+|\-\-|\+=|-=|\*=|\/=|%=|<<=|>>=|&=|\^=|\|=|&&|!&|\|\||!=|==|>=|<=|>>|<<|\.\.|[\[\]\(\)\{\}\\\"'`,\-~+*\/%=<>?!:;.|&^@]{1})/,
      /(?<nul>\s+)/,
      /(?<err>.)/,
    ],
    'g'
  ),
  ({ never, pass, bin, pre, post, until, expr }) => ({
    ops: [[], never],
    eof: [[], never],
    ids: [[], pass],
    num: [[], pass],

    ',': [[1, 1], { led: bin }],
    ';': [[1, 1], { led: bin }],
    '..': [[1, 1], { led: bin }],

    '=': [[2, 1], { led: bin }],
    '+=': [[2, 1], { led: bin }],
    '-=': [[2, 1], { led: bin }],
    '*=': [[2, 1], { led: bin }],
    '/=': [[2, 1], { led: bin }],
    '%=': [[2, 1], { led: bin }],
    '<<=': [[2, 1], { led: bin }],
    '>>=': [[2, 1], { led: bin }],
    '&=': [[2, 1], { led: bin }],
    '^=': [[2, 1], { led: bin }],
    '|=': [[2, 1], { led: bin }],

    '?': [[3, 1], { led: until(':', 0, (t, L, M, r) => [t, L, M, expr(r)]) }],

    '||': [[4, 3], { led: bin }],

    '&&': [[5, 4], { led: bin }],

    '|': [[6, 5], { led: bin }],

    '^': [[7, 6], { led: bin }],

    '&': [[8, 7], { led: bin }],

    '==': [[9, 8], { led: bin }],
    '!=': [[9, 8], { led: bin }],

    '<': [[10, 9], { led: bin }],
    '>': [[10, 9], { led: bin }],
    '<=': [[10, 9], { led: bin }],
    '>=': [[10, 9], { led: bin }],

    '>>': [[11, 10], { led: bin }],
    '<<': [[11, 10], { led: bin }],

    '+': [[12, 12], { led: bin, nud: post(14) }],
    '-': [[12, 12], { led: bin, nud: post(14) }],

    '*': [[13, 13], { led: bin }],
    '/': [[13, 13], { led: bin }],
    '%': [[13, 13], { led: bin }],

    '!': [[14, 1], { led: pre, nud: post(14) }],
    '~': [[14, 1], { led: pre, nud: post(14) }],

    '++': [[15, 1], { led: (t, _, x) => [t.as('=+'), x], nud: post(14) }],
    '--': [[15, 1], { led: (t, _, x) => [t.as('=-'), x], nud: post(14) }],
    '[': [[15, 15], { led: until(']', 0, (t, L, R) => [t, L, R]) }],
    '(': [[15, 0], { led: until(')', 0, (t, L, R) => [t.as('@'), L, R].filter(Boolean)), nud: until(')', 0, (_, __, x) => x) }],
    '.': [[15, 16], { led: bin }],
  })
)
