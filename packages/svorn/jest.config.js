import baseConfig from '../../jest.config.js'

/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
const config = {
  ...baseConfig,
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^spec/(.*)$': '<rootDir>/spec/$1',
  },
}

export default config
