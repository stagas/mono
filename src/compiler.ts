// import rfdc from 'rfdc'
import * as CompilerErrorCauses from './causes'
import { CtxOp, NodeOp, Op, Ops, OpTable, opTables } from './optables'
import { Node, Token } from './parser'
// @ts-ignore
// eslint-disable-next-line
import { S, SExpr } from './sexpr'
import { Type, Typed, TypesMap } from './typed'
import { flatten } from './util'

export { Token }
export type { Node, SExpr }

export { CompilerErrorCauses }

export interface CompilerError extends Error {
  cause:
  | CompilerErrorCauses.ReferenceErrorCause
  | CompilerErrorCauses.SyntaxErrorCause
  | CompilerErrorCauses.TypeErrorCause
  | CompilerErrorCauses.InvalidErrorCause
}

export class CompilerError extends Error {
  name = 'CompilerError'
  constructor(cause: Error) {
    super(cause.message, { cause })
  }
}

export class Struct {
  static Buffer = {
    Needle: 0,
    Current: 1,
    Size: 2,
    Size_m1: 3,
    Length: 4,
    Contents: 5,
  } as const

  constructor(public context: Context, public sym: Sym) { }

  read = (type: Type, index: number) => {
    const { typeAs, cast } = this.context.module
    return typeAs(type, [
      `${type}.load offset=${index << 2}`,
      cast(Type.i32, this.sym.get()),
    ])
  }

  write = (type: Type, index: number, value: SExpr) => {
    const { typeAs, cast, denan } = this.context.module
    return typeAs(Type.none, [
      `${type}.store offset=${index << 2}`,
      cast(Type.i32, this.sym.get()),
      cast(type, denan(value)),
    ])
  }
}

export class Buffer extends Struct {
  get scope() {
    return this.context.scope
  }

  get pointer() {
    return this.sym.get()
  }
  set_pointer(value: SExpr) {
    return this.sym.set(value)
  }

  get needle() {
    return this.read(Type.i32, Struct.Buffer.Needle)
  }
  set_needle(value: SExpr) {
    return this.write(Type.i32, Struct.Buffer.Needle, value)
  }

  get current() {
    return this.read(Type.i32, Struct.Buffer.Current)
  }
  set_current(value: SExpr) {
    return this.write(Type.i32, Struct.Buffer.Current, value)
  }

  get size() {
    return this.read(Type.i32, Struct.Buffer.Size)
  }
  set_size(value: SExpr) {
    return this.write(Type.i32, Struct.Buffer.Size, value)
  }

  get size_m1() {
    return this.read(Type.i32, Struct.Buffer.Size_m1)
  }
  set_size_m1(value: SExpr) {
    return this.write(Type.i32, Struct.Buffer.Size_m1, value)
  }

  get elements() {
    return this.context.get_elements(this.sym) ?? 1
  }
  get elements_const() {
    const { i32 } = this.context.module.ops
    return i32.const(this.elements)
  }

  get length() {
    return this.read(Type.i32, Struct.Buffer.Length)
  }
  set_length(value: SExpr) {
    return this.write(Type.i32, Struct.Buffer.Length, value)
  }

  write_at = (i: number, val: SExpr) =>
    this.write(Type.f32, Struct.Buffer.Contents + i, val)

  get_pos = (offset?: SExpr, useNeedle?: boolean) => {
    const { typeAs, castAll } = this.context.module
    const { i32 } = this.context.module.ops

    const pos = useNeedle ? this.needle : this.current

    // dprint-ignore
    return i32.add( // buffer_ptr +
      this.pointer,
      typeAs(Type.i32, [
        'call', '$modwrapi', ...castAll(Type.i32, // %% buffer_length
          i32.shl( // << 2
            i32.mul( // (offset+current)*elements
              offset ? i32.add(offset, pos) : pos,
              this.elements_const
            ),
            i32.const(2)
          ),
          this.length
        )
      ]),
    )
  }

  write_at_pos = (pos: SExpr, elementOffset: number, value: SExpr) => {
    const { typeAs, cast, denan } = this.context.module
    return typeAs(Type.none, [
      `f32.store offset=${(Struct.Buffer.Contents + elementOffset) << 2}`,
      cast(Type.i32, pos),
      cast(Type.f32, denan(value)),
    ])
  }

  read_at_pos = (pos: SExpr, elementOffset = 0) => {
    const { typeAs, cast } = this.context.module
    return typeAs(Type.f32, [
      `f32.load offset=${(Struct.Buffer.Contents + elementOffset) << 2}`,
      cast(Type.i32, pos),
    ])
  }

  read_at = (pos?: SExpr, elementOffset = 0) => {
    return this.read_at_pos(this.get_pos(pos), elementOffset)
  }
}

export class Arg {
  export?: boolean
  default?: SExpr
  originalDefault?: SExpr
  range?: SExpr

  constructor(
    public id: Token & string,
    public type: Type,
  ) { }
}

export interface Includes {
  [k: string]: Func | { params: Type[]; result: Type }
}

export { Type }

export enum CompStep {
  Lib = 'lib',
  User = 'user',
}

export class Sym {
  constructor(
    public type: Type,
    public id: string,
    public scope: Scope,
    public token: Token = scope.context.module.root.lexer!.unknown.as(id),
  ) { }

  get $id() {
    return `$${this.id}`
  }

  export_id() {
    return ['export', `"${this.id}"`]
  }

  export_mut(value: string | number): SExpr {
    const t = Typed.max(Type.i32, this.type)
    const s = ['global', this.$id, this.export_id(), ['mut', t], [
      `${t}.const`,
      `${value}`,
    ]]
    return s
  }

  declare_mut(value: string | number): SExpr {
    const t = Typed.max(Type.i32, this.type)
    return ['global', this.$id, ['mut', t], [`${t}.const`, `${value}`]]
  }

  get = () => {
    const { typeAs, scoped } = this.scope.context.module
    return typeAs(this.type, [scoped(this.scope, 'get'), this.$id])
  }

  set = (value: SExpr) => {
    const { typeAs, scoped, cast, denan } = this.scope.context.module
    return typeAs(Type.none, [
      scoped(this.scope, 'set'),
      this.$id,
      cast(this.type, denan(value)),
    ])
  }

  tee = (value: SExpr) => {
    const { typeAs, scoped, cast, denan } = this.scope.context.module

    if (this.scope === this.scope.context.module.global.scope) {
      return typeAs(this.type, [this.set(value), this.get()])
    } else {
      return typeAs(this.type, [
        scoped(this.scope, 'tee'),
        this.$id,
        cast(this.type, denan(value)),
      ])
    }
  }
}

export class Scope {
  symbols: Map<string, Sym> = new Map()

  constructor(public context: Context) { }

  add(type: Type, id: Token | string) {
    if (this.symbols.has('' + id)) {
      // we don't create a new symbol object but
      // we update the type because it is coming late
      // so it is updated.
      const sym = this.symbols.get('' + id)!
      sym.type = type
      return sym
    }

    const sym = new Sym(
      type,
      '' + id,
      this,
      (id as any) instanceof Token
        ? id as Token
        : this.context.module.root.lexer!.unknown.as(id as string)
    )

    this.symbols.set(sym.id, sym)

    return sym
  }

  has(id: Token | string) {
    return this.symbols.has('' + id)
  }

  lookup = (id: Token | string): Scope => {
    const global_scope = this.context.module.global.scope
    return this.has(id) ? this : global_scope.has(id) ? global_scope : this
  }

  ensure_sym = (id: Token | string) => {
    const { forId } = this.context.module
    const scope = this.lookup(id)

    if (!(scope.has(id))) {
      throw new CompilerError(
        new CompilerErrorCauses.ReferenceErrorCause(
          forId(id),
          'Symbol not found in scope'
        )
      )
    }

    const sym = scope.symbols.get('' + id)!
    return { scope, sym }
  }

  get(id: Token | string) {
    const { sym } = this.ensure_sym(id)
    return sym.get()
  }

  set(id: Token | string, value: SExpr) {
    const { typeOf } = this.context.module
    const scope = this.lookup(id)

    // lazy add symbol
    if (!scope.has(id)) scope.add(typeOf(value), id)

    const { sym } = this.ensure_sym(id)

    return sym.set(value)
  }

  tee(id: Token & string, value: SExpr) {
    const { typeOf } = this.context.module
    const scope = this.lookup(id)

    // lazy add symbol
    if (!scope.has(id)) scope.add(typeOf(value), id)

    const { sym } = this.ensure_sym(id)

    return sym.tee(value)
  }
}

export class Func {
  body?: SExpr
  source?: SExpr

  constructor(public context: Context, public id: Token) { }

  get params() {
    return this.context.params
  }

  get result() {
    const { typeOf } = this.context.module
    return typeOf(this.body)
  }
}

export class Context {
  params: Arg[] = []
  scope: Scope = new Scope(this)
  offsets: Record<string, number> = {}
  elements: Record<string, Token> = {}
  refs: string[] = []
  constructor(public module: Module) { }

  get_elements = (
    sym: Sym,
  ) => (sym.id in this.elements
    ? this.elements[sym.id]
    : this.module.global.elements[sym.id])

  get_buffer = (id: Token | string) => {
    // const { scope, sym } = this.scope.ensure_sym(id)
    const scope = this.scope.lookup(id)
    const sym = scope.add(Type.i32, id)
    // console.log(id, scope)
    const buffer = new Buffer(scope.context, sym)
    return buffer
  }

  build = (node: Node, ops: OpTable): SExpr => {
    if (Array.isArray(node)) {
      const [sym, ...nodes] = node as [Token & string, Node[]]
      if (!sym || !nodes.length) return []
      let op = ops[sym]
      if (!op)
        throw new CompilerError(
          new CompilerErrorCauses.InvalidErrorCause(sym, 'not implemented')
        )
      if (Array.isArray(op))
        op = op.find((x) => x.length === nodes.length || x.length === 0)
          || op[0]
      return op.length
        ? (<Op>op)(...this.map(nodes, ops))
        : (<() => NodeOp>op)()(this, ops)(...nodes)
    } else {
      const op = ops[node.group]
      if (!op)
        throw new CompilerError(
          new CompilerErrorCauses.InvalidErrorCause(node, 'not implemented')
        )
      return (<() => CtxOp>op)()(this, ops)(node)
    }
  }

  map = (nodes: Node[], ops: OpTable): SExpr[] =>
    nodes
      .filter(Boolean)
      .map((x) => this.build(x, ops))
      .filter((x) => x.length > 0)

  /** defines a function */
  funcDef = (id: Token | string, params: Node[], body: Node) => {
    this.map(params, this.module.OpTables.OpParams)
    const func = this.module.funcs[`${id}`] = new Func(this, id as Token)
    this.module.bodies.set(func, body)
  }
}

export class Module extends Typed {
  body: SExpr = []
  bodies: Map<Func, Node> = new Map()
  funcs: Record<string, Func> = {}

  exported_id = 0
  exported: Map<SExpr, number> = new Map()
  exported_params: Map<Arg, Set<string>> = new Map()
  exported_params_map: Map<string, SExpr> = new Map()

  init_body?: SExpr

  fill_body: SExpr = []

  constructor(
    public root: Node,
    public types = new Map<object | string, Type>(),
  ) {
    super(types)
  }

  get f_type(): Type {
    return this.typeOf(this.funcs.f?.body)
  }

  get f_params(): Arg[] {
    return this.funcs.f?.params ?? []
  }

  funcCall = (id: Node | Token | string, args: SExpr[]) => {
    const { exported, exported_params, exported_params_map } = this

    if (Array.isArray(id))
      throw new CompilerError(
        new CompilerErrorCauses.TypeErrorCause(
          id[0] as Token,
          'invalid function passed to map/reduce'
        )
      )

    const sym = id as string
    const func = this.funcs[sym]
    if (!func)
      throw new CompilerError(
        new CompilerErrorCauses.ReferenceErrorCause(
          id as Token,
          'function not defined'
        )
      )

    // const origArgs = [...args]

    // examine function argument declarations against passed arguments
    func.params.forEach((param, i) => {
      if (exported.has(args[i])) {
        const sexpr = args[i]
        const export_id = `export/${sym}/${param.id}/${exported.get(args[i])}`
        args[i] = this.typeAs(param.type, ['global.get', `$${export_id}`])

        let exported_params_args = exported_params.get(param)
        if (!exported_params_args)
          exported_params.set(param, exported_params_args = new Set())
        exported_params_args.add(export_id)

        exported_params_map.set(export_id, sexpr)
      }
      // const isRest = origArgs[Math.min(i, origArgs.length - 1)]?.[0] == '...'

      // if (isRest) {
      //   param.export = true
      //   // @ts-ignore
      //   args[i] = void 0
      // }

      let param_default
      if (param.export) {
        const export_default_$id = `$export/${sym}/${param.id}`
        param_default = this.typeAs(param.type, [
          'global.get',
          export_default_$id,
        ])
      } else {
        if (param.default)
          param_default = param.default
        else if (param.range)
          param_default = param.range[0] as SExpr
        else
          param_default = this.typeAs(Type.f32, ['f32.const', '0'])
      }
      // param_default = cast(Type.f32, param_default)

      // function argument declaration has default value
      if (param.default) {
        // missing passed argument becomes the default value
        if (!args[i]) args[i] = param_default
        // has passed argument but cast it to correct type
        // else args[i] = cast(Type.f32, args[i])
        else args[i] = this.cast(param.type, args[i])
      } // function argument declaration has range
      else if (param.range) {
        // missing passed argument becomes the start of range value
        if (!args[i]) args[i] = param_default
        // has passed argument but cast it to correct type
        // else args[i] = cast(Type.f32, args[i])
        else {
          args[i] = this.cast(param.type, args[i])

          if (param.type === Type.f32) {
            args[i] = this.typeAs(Type.f32, [
              'call',
              '$clamp',
              args[i],
              param.range[0],
              param.range[1],
            ])
          } else {
            args[i] = this.typeAs(Type.i32, [
              'call',
              '$clampi',
              args[i],
              param.range[0],
              param.range[1],
            ])
          }
        }
      } // has passed argument but no default, it is cast implicitly to f32
      else if (args[i]) args[i] = this.cast(param.type ?? Type.f32, args[i])
      // did not pass argument and no default, so implicitly push a zero f32 (0.0)
      else args[i] = param_default
      // TODO: call $limit_range(args[i], param.range[0], param.range[1])
    })
    // truncate number of passed arguments down to the accepted function arguments
    args.length = func.params.length
    // call the function
    return this.typeAs(func.result, ['call', '$' + sym, ...args])
  }

  /** returns a scoped op (`local.xxx` or `global.xxx`) */
  scoped = (scope: Scope, op: string) =>
    `${(scope === this.global.scope ? 'global' : 'local')}.${op}`

  /** zeroifies inf and nan */
  denan = (body: SExpr) =>
    this.typeOf(body) !== Type.f32
      ? body
      : this.typeAs(Type.f32, ['call', '$denan', body])

  /** infers the type of a token literal string: bool for 0 or 1, i32 for integers and f32 for floats */
  infer = (x: Token & string): Type => {
    if ('01'.includes(x)) return Type.bool
    else if (x.endsWith('f')) return Type.f32
    else if (!x.includes('.')) return Type.i32
    else if (x.includes('.')) return Type.f32
    else
      throw new CompilerError(
        new CompilerErrorCauses.TypeErrorCause(
          this.forId(x),
          'cannot infer type for'
        )
      )
  }

  forId = (id: Token | string) => {
    return (id as any) instanceof Token
      ? id as Token
      : this.root.lexer!.unknown.as('' + id)
  }

  global: Context = new Context(this)
  ops = Ops(this)
  OpTables = opTables(this)

  valueOf() {
    return this.body
  }
}

export const compile = (
  root: Node,
  scope_record: Record<string, Type> = {},
  includes: Includes = {},
  init_body: Module['init_body'] = [],
  fill_body: Module['fill_body'] = [],
  types: TypesMap = new Map(),
  step: CompStep = CompStep.User,
) => {
  // implementations need to provide global scopeRecord: `global_mem_ptr: Type.i32`

  const externalScopeKeys = Object.keys(scope_record)
  const unknown = root.lexer!.unknown

  const mod = new Module(root, types)
  mod.fill_body = [...fill_body]

  const { global, funcs, bodies, typeOf, typeAs, max, top } = mod

  for (const [id, type] of Object.entries(scope_record)) {
    global.scope.add(type, id)
  }

  // included ambient functions (declared elsewhere or from a previous step)
  for (const [name, func] of Object.entries(includes)) {
    if (!('context' in func)) {
      const context = new Context(mod)

      context.params = func.params.map((x: string, i) =>
        Object.assign(
          new Arg(unknown.as(`${i}`) as Token & string, x as Type),
          {
            default: top(x as Type, ['const', '0']),
          }
        )
      )

      const f = funcs[name] = new Func(context, unknown.as(name))
      f.body = typeAs(func.result, [])
    } else {
      funcs[name] = func
      // func.body = typeAs(func.result, func.body!)
      // console.log('yes', name, func.result, typeOf(func.body))
    }
  }

  // ==================================================================================
  // init

  if (step === CompStep.Lib)
    global.funcDef('__drop__', [], root)
  else {
    global.funcDef('__begin__', [], root)
    global.funcDef('__start__', [], [])
    global.funcDef('update_exports', [], [])
  }

  // compile function bodies
  for (const [func, body] of bodies) {
    const b = func.context.map(flatten(';', body), mod.OpTables.Op)
    func.body = typeAs(typeOf(b.at(-1)), b)
  }

  mod.body = []
  // mod.body = step === CompStep.Lib ? [] : ([['start', '$__start__']] as SExpr)

  if (step === CompStep.User) {
    funcs.__start__.body!.push(
      ...(init_body || []),
      ...mod.fill_body
    )
    // console.log(funcs.__start__.body)
    // console.log(S(funcs.__start__.body))
    // funcs.__start__.body!.push([
    //   'global.set',
    //   '$start_ptr',
    //   ['global.get', '$global_mem_ptr'],
    // ])
  } else {
    mod.init_body = funcs.__drop__.body
    delete funcs.__drop__
  }

  // create globals
  for (const [id, sym] of global.scope.symbols) {
    if (externalScopeKeys.includes(id)) continue

    // const t = max(Type.i32, sym.type)
    // if (sym.id.includes('export/')) mod.body.push(sym.export_mut(0))
    if (sym.id.includes('temp')) mod.body.push(sym.declare_mut(0))
    else mod.body.push(sym.export_mut(0))
  }

  // create exported params as globals
  for (const [id, func] of Object.entries(funcs)) {
    // if (id in includes) continue

    func.params
      .filter((param) => param.export || mod.exported_params.has(param))
      .forEach((param) => {
        const { sym } = func.context.scope.ensure_sym(param.id)

        // let export_default: Sym

        const export_id = `export/${id}/${param.id}`

        const t = max(Type.i32, sym.type)

        const export_min = global.scope.add(sym.type, `${export_id}/min`)
        const export_max = global.scope.add(sym.type, `${export_id}/max`)

        if (param.range) {
          funcs.update_exports.body!.push(export_min.set(param.range[0] as SExpr))
          funcs.update_exports.body!.push(export_max.set(param.range[1] as SExpr))
        }

        if (param.range || !param.default) {
          // put the ranges in globals so they can be read from the client after they've evaluated
          mod.body.push(export_min.export_mut(0))
          mod.body.push(export_max.export_mut(1))
        }

        const init_default = (export_id: string, value?: SExpr) => {
          const export_default = global.scope.add(sym.type, export_id)

          mod.body.push(export_default.export_mut(0)) // ['global', export_default.$id, ['export', `"${export_id}"`], ['mut', t], [t + '.const', '0']])

          if (value) {
            param.originalDefault = value
            funcs.update_exports.body!.push(export_default.set(value))
          } else {
            // dprint-ignore
            funcs.update_exports.body!.push(export_default.set(
              top(t, ['add',
                export_min.get(),
                [t + '.div' + (t === 'i32' ? '_s' : ''),
                [t + '.sub',
                export_max.get(),
                export_min.get(),
                ],
                [t + '.const', '2']
                ]
              ])
            ))
          }

          return export_default
        }

        // put the default value in global scope
        if (param.export) {
          param.default = init_default(export_id, param.default).get()
        }

        const exported_params_args = mod.exported_params.get(param)
        if (exported_params_args) {
          for (const id of exported_params_args) {
            // console.log('found', id)
            init_default(id, mod.exported_params_map.get(id))
          }
        }

        // change the default value to use the global one, but keep reference to previous value
        // for later use. TODO: find cleaner way to pass exported params
      })
  }

  // create functions
  for (const [id, func] of Object.entries(funcs)) {
    if (id in includes) continue

    func.source = [
      'func',
      '$' + id,
      ['export', `"${id}"`],
      ...func.params.map(
        (
          param,
        ) => [
            'param',
            '$' + param.id,
            max(Type.i32, func.context.scope.ensure_sym(param.id).sym.type),
          ]
      ),
      ...(func.body!.length && !['update_exports', '__start__', '__begin__'].includes(id)
        ? [
          func.result === Type.multi
            ? [
              'result',
              ...(func.body!.at(-1)! as any).map((x: any) =>
                max(Type.i32, typeOf(x))
              ),
            ]
            : ['result', max(Type.i32, func.result)],
        ]
        : []),
      ...(!['update_exports', '__start__', '__begin__'].includes(id)
        ? [...func.context.scope.symbols]
          .filter(([x]) => !func.params.find((param) => param.id == x))
          .map(([x, sym]) => ['local', '$' + x, max(Type.i32, sym.type)])
        : []),
      // TODO: how to determine if start needs to drop? below was: [...func.body!, 'drop']
      ...(['update_exports', '__start__', '__begin__'].includes(id)
        ? (func.body!.length ? [...func.body!] : [])
        : func.body!),
    ]

    mod.body.push(func.source)
  }

  // console.log(S(mod.body))
  return mod
}
