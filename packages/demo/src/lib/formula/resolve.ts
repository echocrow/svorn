import { type CstNode, type IToken, tokenMatcher } from 'chevrotain'

import { IS_DEV_ENV } from '#lib/utils'

import type {
  AtomicExpressionCstChildren,
  FinanceNumberCstChildren,
  FormulaCstChildren,
  FuncExpressionCstChildren,
  MagicNumberCstChildren,
  MagicTextCstChildren,
  OperationCstChildren,
  ParenExpressionCstChildren,
  ParseInputCstChildren,
  PlainCstChildren,
  TextCstChildren,
} from './cst.gen'
import funcs from './functions'
import { type ParseResult, parser } from './parse'
import {
  opPhases,
  resolveAdditionValue,
  resolveBoolean,
  resolveNumberLiteral,
} from './resolveUtils'
import {
  type CellValue,
  type CellValues,
  FuncArgsErr,
  FuncNameErr,
  ParseErr,
  RuntimeErr,
} from './values'

class Interpreter extends parser.getBaseCstVisitorConstructor() {
  #cellValues: CellValues = {}

  constructor() {
    super()
    if (IS_DEV_ENV) this.validateVisitor()
  }

  interpret(cst: CstNode, cellValues: CellValues): CellValue {
    this.#cellValues = cellValues
    return this.visit(cst)
  }

  protected parseInput(ctx: ParseInputCstChildren): CellValue {
    return this.visit(
      ctx.formula ?? ctx.plain ?? ctx.magicText ?? ctx.text ?? [],
    )
  }

  protected plain(ctx: PlainCstChildren): CellValue {
    return this.visit(ctx.text)
  }

  protected text(ctx: TextCstChildren): CellValue {
    return (ctx.PlainText ?? []).map((t) => t.image).join('')
  }

  protected magicText(ctx: MagicTextCstChildren): CellValue {
    if (ctx.magicNumber) return this.visit(ctx.magicNumber)
    if (ctx.financeNumber) return this.visit(ctx.financeNumber)
    if (ctx.Boolean) return resolveBoolean(ctx.Boolean[0])
    return RuntimeErr
  }
  protected magicNumber(ctx: MagicNumberCstChildren): CellValue {
    return resolveAdditionValue(ctx.ops, resolveNumberLiteral(ctx.number[0]))
  }
  protected financeNumber(ctx: FinanceNumberCstChildren): CellValue {
    return -resolveNumberLiteral(ctx.number[0])
  }

  protected formula(ctx: FormulaCstChildren): CellValue {
    return this.visit(ctx.body)
  }

  protected operation(ctx: OperationCstChildren): CellValue {
    const left = this.visit(ctx.lhs) as CellValue
    const rights = (ctx.rhs ?? []).map((r) => this.visit(r) as CellValue)

    const ops = ctx.ops ?? []
    if (ops.length !== rights.length) return RuntimeErr

    // Serialize values and operators.
    let items = ops.reduce<(CellValue | IToken)[]>(
      (items, op, i) => items.concat([op, rights[i] as CellValue]),
      [left],
    )

    for (const opPhase of opPhases) {
      const newItems: typeof items = []
      let buffer = items[0] as CellValue
      for (let i = 1; i < items.length; i += 2) {
        const op = items[i] as IToken
        const val = items[i + 1] as CellValue
        const [_, opFn] = opPhase.find(([tkn]) => tokenMatcher(op, tkn)) ?? []
        if (opFn) {
          buffer = opFn(buffer, val)
        } else {
          newItems.push(buffer, op)
          buffer = val
        }
      }
      newItems.push(buffer)
      items = newItems
    }
    if (items.length !== 1) return RuntimeErr
    return items[0] as CellValue
  }

  protected atomicExpression(ctx: AtomicExpressionCstChildren): CellValue {
    return resolveAdditionValue(ctx.ops, this.resolveAtomicExpression(ctx))
  }
  private resolveAtomicExpression(ctx: AtomicExpressionCstChildren): CellValue {
    if (ctx.parenExpression) return this.visit(ctx.parenExpression)

    if (ctx.funcExpression) return this.visit(ctx.funcExpression)

    if (ctx.CellName) {
      const cellName = ctx.CellName?.[0]?.image ?? ''
      return this.#cellValues[cellName] ?? null
    }

    if (ctx.NumberLiteral) return resolveNumberLiteral(ctx.NumberLiteral[0])

    if (ctx.StringLiteral) {
      return (ctx.StringLiteral?.[0]?.image ?? '')
        .slice(1, -1)
        .replace(/""/g, '"')
    }

    if (ctx.Boolean) return resolveBoolean(ctx.Boolean[0])

    return RuntimeErr
  }

  protected parenExpression(ctx: ParenExpressionCstChildren): CellValue {
    return this.visit(ctx.inner)
  }

  protected funcExpression(ctx: FuncExpressionCstChildren): CellValue {
    const fnName = ctx.fn[0]?.image ?? ''
    const func = funcs[fnName]
    if (!func) return FuncNameErr

    const args = ctx.args ?? []
    if (args.length < func.minArgs) return FuncArgsErr
    if (args.length > func.maxArgs) return FuncArgsErr

    const visit = (ctx: CstNode) => this.visit(ctx)

    const namedArgs = func.argNames.reduce((namedArgs, argName, i) => {
      namedArgs[argName] = args[i]
      return namedArgs
    }, {} as Record<string, CstNode | undefined>)
    const restArgs = args.slice(func.argNames.length)

    return func.resolve(visit, namedArgs, restArgs)
  }
}

const interpreter = new Interpreter()

const resolve = (
  parsed: ParseResult,
  cellValues: Record<string, CellValue>,
): CellValue =>
  parsed.lexErrors.length || parsed.parseErrors.length
    ? ParseErr
    : interpreter.interpret(parsed.cst, cellValues)

export default resolve
