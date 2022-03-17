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
  MagicText?: IToken[];
};

export interface FormulaCstNode extends CstNode {
  name: "formula";
  children: FormulaCstChildren;
}

export type FormulaCstChildren = {
  EnterFormula: IToken[];
  body: CalcExpressionCstNode[];
};

export interface CalcExpressionCstNode extends CstNode {
  name: "calcExpression";
  children: CalcExpressionCstChildren;
}

export type CalcExpressionCstChildren = {
  lhs: AtomicExpressionCstNode[];
  ops?: IToken[];
  rhs?: AtomicExpressionCstNode[];
};

export interface AtomicExpressionCstNode extends CstNode {
  name: "atomicExpression";
  children: AtomicExpressionCstChildren;
}

export type AtomicExpressionCstChildren = {
  parenExpression?: ParenExpressionCstNode[];
  functionExpression?: FunctionExpressionCstNode[];
  atomicNumber?: AtomicNumberCstNode[];
  CellName?: IToken[];
  StringLiteral?: IToken[];
  Boolean?: IToken[];
};

export interface AtomicNumberCstNode extends CstNode {
  name: "atomicNumber";
  children: AtomicNumberCstChildren;
}

export type AtomicNumberCstChildren = {
  ops?: IToken[];
  number: IToken[];
};

export interface ParenExpressionCstNode extends CstNode {
  name: "parenExpression";
  children: ParenExpressionCstChildren;
}

export type ParenExpressionCstChildren = {
  LParen: IToken[];
  inner: CalcExpressionCstNode[];
  RParen: IToken[];
};

export interface FunctionExpressionCstNode extends CstNode {
  name: "functionExpression";
  children: FunctionExpressionCstChildren;
}

export type FunctionExpressionCstChildren = {
  fn: IToken[];
  LParen: IToken[];
  args?: CalcExpressionCstNode[];
  Comma?: IToken[];
  RParen: IToken[];
};

export interface ICstNodeVisitor<IN, OUT> extends ICstVisitor<IN, OUT> {
  parseInput(children: ParseInputCstChildren, param?: IN): OUT;
  plain(children: PlainCstChildren, param?: IN): OUT;
  text(children: TextCstChildren, param?: IN): OUT;
  magicText(children: MagicTextCstChildren, param?: IN): OUT;
  formula(children: FormulaCstChildren, param?: IN): OUT;
  calcExpression(children: CalcExpressionCstChildren, param?: IN): OUT;
  atomicExpression(children: AtomicExpressionCstChildren, param?: IN): OUT;
  atomicNumber(children: AtomicNumberCstChildren, param?: IN): OUT;
  parenExpression(children: ParenExpressionCstChildren, param?: IN): OUT;
  functionExpression(children: FunctionExpressionCstChildren, param?: IN): OUT;
}
