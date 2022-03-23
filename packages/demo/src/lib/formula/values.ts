export class CellError extends Error {
  label: string
  constructor(label: string, message: string) {
    super(message)
    this.label = label
  }
  toString(): string {
    return `#${this.label}`
  }
}

export type CellValue = string | number | boolean | null | CellError
export type CellValues = Record<string, CellValue>

export const ValErr = new CellError('VALUE!', 'Value not supported')
export const DivZeroErr = new CellError('DIV/0!', 'Cannot divide by zero')
export const RuntimeErr = new CellError('ERROR!', 'Unexpected runtime error')
export const ParseErr = new CellError('ERROR!', 'Invalid input')
export const FuncNameErr = new CellError('NAME?', 'Unknown function')
export const FuncArgsErr = new CellError('N/A', 'Wrong number of arguments')
export const CircularDepErr = new CellError('REF!', 'Circular dependency')
