<script lang="ts">
  import parse from '$lib/formula/parse'
  import resolve from '$lib/formula/resolve'
  import { currCellName } from '$lib/store'

  import CurrCellInput from './CurrCellInput.svelte'
  import Sheet from './Sheet.svelte'

  let sheetRef: HTMLElement

  let inputTxt = ''
  $: res = parse(inputTxt)
  const testCellValues = {
    A1: 1,
    A2: 2,
    B1: 'someText',
    B2: 'moreText',
    C1: true,
    C2: false,
    D1: '',
  }
  $: resolved =
    res.lexErrors.length || res.parseErrors.length
      ? undefined
      : resolve(res.cst, testCellValues)
  $: resolvedStr =
    resolved === undefined
      ? '...'
      : resolved instanceof Error
      ? `${resolved}`
      : JSON.stringify(resolved, null, 2)
</script>

<div class="grid grid-rows-[auto,auto,auto,1fr] min-h-100vh">
  <header>
    <h1 class="text-4xl my-6">Demo</h1>
  </header>

  <nav class="flex">
    <label for="cell" class="min-w-6ch">{$currCellName}</label>
    <CurrCellInput on:done={() => sheetRef?.focus()} />
  </nav>

  <main>
    <Sheet bind:ref={sheetRef} />
  </main>

  <footer>
    <div class="flex">
      <input type="text" bind:value={inputTxt} class="bg-white text-black" />
      <pre class="w-full">{resolvedStr}</pre>
    </div>
    <div class="flex min-h-10em items-stretch text-size-0.75rem leading-1.25em">
      <pre class="w-full">{JSON.stringify(res.cst, null, 2)}</pre>
      <pre class="w-full">{JSON.stringify([...res.cells], null, 2)}</pre>
      <pre class="w-full">{JSON.stringify(res.lexErrors, null, 2)}</pre>
      <pre class="w-full">{JSON.stringify(res.parseErrors, null, 2)}</pre>
    </div>
  </footer>
</div>
