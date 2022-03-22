const aCharCode = 'A'.charCodeAt(0)
const zCharCode = 'Z'.charCodeAt(0)
const azBase = zCharCode - aCharCode + 1

export type CellCoord = readonly [col: number, row: number]

export class CellError extends Error {
  label: string
  constructor(label: string, message: string) {
    super(message)
    this.label = label
  }
  toString(): string {
    return `#${this.label}!`
  }
}

export type CellValue = string | number | boolean | null | CellError
export type CellValues = Record<string, CellValue>

const nameColRec = (col: number, acc = ''): string => {
  if (col < 0) return acc
  const c = col % azBase
  const next = (col - c) / azBase - 1
  const name = String.fromCharCode(aCharCode + c)
  return nameColRec(next, name + acc)
}
export const nameCol = (col: number): string => nameColRec(col)

export const nameRow = (row: number): string => `${row + 1}`

export const nameCell = (col: number, row: number): string =>
  `${nameCol(col)}${nameRow(row)}`

const parseRow = (rowName: string): number => (parseInt(rowName, 10) || 0) - 1

const parseCol = (colName: string): number => {
  let col = 0
  for (const c of colName) {
    const v = c.charCodeAt(0) - aCharCode + 1
    col *= azBase
    col += v
  }
  col -= 1
  return col
}

export const parseCellName = (name: string): CellCoord => {
  let colName = ''
  let rowName = ''
  for (const c of name) {
    if (!rowName) {
      if (c >= 'A' && c <= 'Z') colName += c
      else if (c >= '1' && c <= '9') rowName += c
      else throw new Error('Invalid token')
    } else {
      if (c >= '0' && c <= '9') rowName += c
      else throw new Error('Invalid token')
    }
  }
  return [parseRow(rowName), parseCol(colName)]
}
