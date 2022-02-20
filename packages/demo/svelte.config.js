import adapter from '@sveltejs/adapter-auto'
import preprocess from 'svelte-preprocess'

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: preprocess(),
  compilerOptions: {
    immutable: true,
  },
  kit: {
    adapter: adapter(),
  },
}

export default config
