import baseConfig from '../../jest.config.js'

/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
const config = {
  ...baseConfig,
  moduleNameMapper: {
    '^#lib/(.*)$': '<rootDir>/src/lib/$1',
  },
}

export default config
