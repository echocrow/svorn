import adapter from '@sveltejs/adapter-auto'
import { resolve } from 'path'
import preprocess from 'svelte-preprocess'
import WindiCSS from 'vite-plugin-windicss'

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: preprocess(),
  compilerOptions: {
    immutable: true,
  },
  kit: {
    adapter: adapter(),
    vite: {
      plugins: [WindiCSS()],
      resolve: {
        alias: {
          '#lib': resolve('./src/lib'),
        },
      },
    },
  },
}

export default config
