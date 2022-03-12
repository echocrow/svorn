<script lang="ts">
  import { currCell, currCellName } from '$lib/store'

  import Sheet from './Sheet.svelte'

  $: cell = $currCell
</script>

<div class="grid grid-rows-[auto,auto,1fr] min-h-100vh">
  <header>
    <h1 class="text-4xl my-6">Demo</h1>
  </header>

  <nav class="flex">
    <label for="cell" class="min-w-6ch">{$currCellName}</label>
    <input type="text" name="cell" class="w-full" bind:value={$cell} />
  </nav>

  <main>
    <Sheet />
  </main>
</div>
