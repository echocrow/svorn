export const IS_DEV_ENV =
  typeof process !== 'undefined' &&
  (process.env?.NODE_ENV === 'development' || process.env?.NODE_ENV === 'test')
