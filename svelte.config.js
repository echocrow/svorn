import path from 'path'
import { readFileSync } from 'fs'
import JSON5 from 'json5'
import adapter from '@sveltejs/adapter-auto'
import preprocess from 'svelte-preprocess'

// JSON imports are currently unavailable, so we need to JSON-parse directly.
/** @type {import('./tsconfig.json')} */
// eslint-disable-next-line import/no-named-as-default-member
const tsconfig = JSON5.parse(readFileSync('./tsconfig.json', 'utf8'))
const tsAlias = Object.entries(tsconfig.compilerOptions.paths)
  .map(([from, [to]]) => [from, to])
  .filter(([from, _]) => !from.endsWith('*'))
  .reduce((alias, [from, to]) => ({ ...alias, [from]: path.resolve(to) }), {})

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: preprocess(),

  compilerOptions: { immutable: true },

  kit: {
    adapter: adapter(),

    target: '#svelte',

    package: {
      files: (id) => !id.startsWith('demo'),
    },

    vite: {
      resolve: {
        alias: { ...tsAlias },
      },
    },
  },
}

export default config
