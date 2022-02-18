// import { SyntaxDefinition } from 'code-syntax'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { join, modify } from './util'

const ids = /[a-zA-Z_$][a-zA-Z0-9_$]*/
const num = /inf|nan|\d[\d_]*(\.((e[+-]?)?[\d]+)+[kBb]*|(e[+-]?[\d]+)?[kBb]*)/
const ops = /\+\+|--|\+=|-=|\*=|\/=|%=|<<=|>>=|&=|\^=|\|=|&&|!&|\|\||!=|==|>=|<=|>>|<<|\.\.|[{}\\"'`,\-~+*/%=<>?!:;.|&^@]{1}/

export const syntax = {
  // declare: [
  //   join(
  //     '',
  //     modify(
  //       '+', //
  //       join(
  //         '|', //
  //         ids,
  //         num,
  //         ops,
  //         /[[\](),.=\s+]/
  //       )
  //     ),
  //     /\)\s+=/
  //   ),
  //   {
  //     // arguments: [
  //     //   /(?<=\().*?(?=\))/,
  //     //   {
  //     //     declare: num,
  //     //     string: /[[\]]/,
  //     //     arguments: /\w+/,
  //     //     operator: ops,
  //     //   },
  //     // ],
  //     arrow: /=$/,
  //     declare: ids,
  //     operator: ops,
  //     punctuation: /[[\]()]/,
  //   },
  // ],

  comment: join('|', /(\/\*)[^]*?(\*\/)/, /(\s?(\/\/)[\S\s]*?(?=[\n\r]))/, /(\/\*)[^]*/),
  property: join('', ids, /(?=\()/),
  normal: ids,
  declare: /t|pi2?/,
  number: num,
  punctuation: /[[\](),]/,
  operator: ops,
} //as SyntaxDefinition
