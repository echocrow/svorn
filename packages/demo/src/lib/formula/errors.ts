import { CellError } from '#lib/cells'

export const ValErr = new CellError('VALUE', 'Value not supported')
export const DivZeroErr = new CellError('DIV/0', 'Cannot divide by zero')
export const RuntimeErr = new CellError('ERROR', 'Unexpected runtime error')
export const ParseErr = new CellError('ERROR', 'Invalid input')
export const FuncNameErr = new CellError('NAME', 'Unknown function')
export const FuncArgsErr = new CellError('N/A', 'Wrong number of arguments')
