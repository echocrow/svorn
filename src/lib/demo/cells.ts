const aCharCode = 'A'.charCodeAt(0)
const zCharCode = 'Z'.charCodeAt(0)
const azBase = zCharCode - aCharCode + 1

const nameColRec = (col: number, acc = ''): string => {
  if (col < 0) return acc
  const c = col % azBase
  const next = (col - c) / azBase - 1
  const name = String.fromCharCode(aCharCode + c)
  return nameColRec(next, name + acc)
}
export const nameCol = (col: number): string => nameColRec(col)

export const nameRow = (row: number): string => `${row + 1}`

export const joinNames = (rowName: string, colName: string): string =>
  `${colName}${rowName}`

export const nameCell = (row: number, col: number): string =>
  joinNames(nameRow(row), nameCol(col))

export const parseCellName = (name: string): readonly [number, number] => {
  let colName = ''
  let rowName = ''
  for (const c of name) {
    if (!rowName) {
      if (c >= 'A' && c <= 'Z') colName += c
      else if (c >= '1' && c <= '9') rowName += c
      else throw new Error('todo: invalid token')
    } else {
      if (c >= '0' && c <= '9') rowName += c
      else throw new Error('todo: invalid token')
    }
  }

  const row = (parseInt(rowName, 10) || 0) - 1

  let col = 0
  for (const c of colName) {
    const v = c.charCodeAt(0) - aCharCode + 1
    col *= azBase
    col += v
  }
  col -= 1

  return [row, col]
}
