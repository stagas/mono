import { ParserErrorCauses } from 'tinypratt'

export class CompilerErrorCause extends ParserErrorCauses.ParserErrorCause {
  name = 'CompilerUnknownError'
}
export class ReferenceErrorCause extends CompilerErrorCause {
  name = 'CompilerReferenceError'
}
export class TypeErrorCause extends CompilerErrorCause {
  name = 'CompilerTypeError'
}
export class SyntaxErrorCause extends CompilerErrorCause {
  name = 'CompilerSyntaxError'
}
export class InvalidErrorCause extends CompilerErrorCause {
  name = 'CompilerInvalidError'
}
