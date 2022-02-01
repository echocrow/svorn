import adapter from '@sveltejs/adapter-auto'
import preprocess from 'svelte-preprocess'
import tsconfigPaths from 'vite-tsconfig-paths'

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: preprocess(),
  compilerOptions: {
    immutable: true,
  },
  kit: {
    adapter: adapter(),
    target: '#svelte',
    vite: {
      plugins: [tsconfigPaths({ root: '../../' })],
    },
  },
}

export default config
