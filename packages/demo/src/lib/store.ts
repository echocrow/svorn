import { writable, writableFamily } from 'svorn'

export const sheet = writableFamily<string | number>('', {
  B2: '!',
})

export const currCol = writable(1)
export const currRow = writable(0)
