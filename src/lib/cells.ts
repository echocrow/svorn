const aCharCode = 'A'.charCodeAt(0)

const nameColRec = (col: number, acc = ''): string => {
  if (col < 0) return acc
  const c = col % 26
  const next = (col - c) / 26 - 1
  const name = String.fromCharCode(aCharCode + c)
  return nameColRec(next, name + acc)
}
export const nameCol = (col: number): string => nameColRec(col)

export const nameRow = (row: number): string => `${row + 1}`

export const joinNames = (rowName: string, colName: string): string =>
  `${colName}${rowName}`

export const nameCell = (row: number, col: number): string =>
  joinNames(nameRow(row), nameCol(col))
