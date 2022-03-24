<script lang="ts">
  import { currCellName } from '$lib/store'

  import CurrCellInput from './CurrCellInput.svelte'
  import Sheet from './Sheet.svelte'

  let sheetRef: HTMLElement
</script>

<div class="grid grid-rows-[auto,auto,1fr] min-h-100vh">
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
</div>
