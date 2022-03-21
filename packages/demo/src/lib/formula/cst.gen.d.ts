// Code generated by "generateParserTypes.ts"; DO NOT EDIT.
import type { CstNode, ICstVisitor, IToken } from "chevrotain";

export interface ParseInputCstNode extends CstNode {
  name: "parseInput";
  children: ParseInputCstChildren;
}

export type ParseInputCstChildren = {
  formula?: FormulaCstNode[];
  plain?: PlainCstNode[];
  magicText?: MagicTextCstNode[];
  text?: TextCstNode[];
};

export interface PlainCstNode extends CstNode {
  name: "plain";
  children: PlainCstChildren;
}

export type PlainCstChildren = {
  EnterPlainText: IToken[];
  text: TextCstNode[];
};

export interface TextCstNode extends CstNode {
  name: "text";
  children: TextCstChildren;
}

export type TextCstChildren = {
  PlainText?: IToken[];
};

export interface MagicTextCstNode extends CstNode {
  name: "magicText";
  children: MagicTextCstChildren;
}

export type MagicTextCstChildren = {
  magicNumber?: MagicNumberCstNode[];
  financeNumber?: FinanceNumberCstNode[];
  Boolean?: IToken[];
  EOF: IToken[];
};

export interface MagicNumberCstNode extends CstNode {
  name: "magicNumber";
  children: MagicNumberCstChildren;
}

export type MagicNumberCstChildren = {
  ops?: IToken[];
  number: IToken[];
};

export interface FinanceNumberCstNode extends CstNode {
  name: "financeNumber";
  children: FinanceNumberCstChildren;
}

export type FinanceNumberCstChildren = {
  LParen: IToken[];
  number: IToken[];
  RParen: IToken[];
};

export interface FormulaCstNode extends CstNode {
  name: "formula";
  children: FormulaCstChildren;
}

export type FormulaCstChildren = {
  EnterFormula: IToken[];
  body: OperationCstNode[];
};

export interface OperationCstNode extends CstNode {
  name: "operation";
  children: OperationCstChildren;
}

export type OperationCstChildren = {
  lhs: AtomicExpressionCstNode[];
  ops?: IToken[];
  rhs?: AtomicExpressionCstNode[];
};

export interface AtomicExpressionCstNode extends CstNode {
  name: "atomicExpression";
  children: AtomicExpressionCstChildren;
}

export type AtomicExpressionCstChildren = {
  ops?: IToken[];
  parenExpression?: ParenExpressionCstNode[];
  funcExpression?: FuncExpressionCstNode[];
  CellName?: IToken[];
  NumberLiteral?: IToken[];
  StringLiteral?: IToken[];
  Boolean?: IToken[];
};

export interface ParenExpressionCstNode extends CstNode {
  name: "parenExpression";
  children: ParenExpressionCstChildren;
}

export type ParenExpressionCstChildren = {
  LParen: IToken[];
  inner: OperationCstNode[];
  RParen: IToken[];
};

export interface FuncExpressionCstNode extends CstNode {
  name: "funcExpression";
  children: FuncExpressionCstChildren;
}

export type FuncExpressionCstChildren = {
  fn: IToken[];
  LParen: IToken[];
  args?: OperationCstNode[];
  Comma?: IToken[];
  RParen: IToken[];
};

export interface ICstNodeVisitor<IN, OUT> extends ICstVisitor<IN, OUT> {
  parseInput(children: ParseInputCstChildren, param?: IN): OUT;
  plain(children: PlainCstChildren, param?: IN): OUT;
  text(children: TextCstChildren, param?: IN): OUT;
  magicText(children: MagicTextCstChildren, param?: IN): OUT;
  magicNumber(children: MagicNumberCstChildren, param?: IN): OUT;
  financeNumber(children: FinanceNumberCstChildren, param?: IN): OUT;
  formula(children: FormulaCstChildren, param?: IN): OUT;
  operation(children: OperationCstChildren, param?: IN): OUT;
  atomicExpression(children: AtomicExpressionCstChildren, param?: IN): OUT;
  parenExpression(children: ParenExpressionCstChildren, param?: IN): OUT;
  funcExpression(children: FuncExpressionCstChildren, param?: IN): OUT;
}
