<script lang="ts">
  import { currCellName, currCol, currRow } from '$lib/store'

  import CellInput from './CellInput.svelte'
  import Sheet from './Sheet.svelte'

  let sheetRef: HTMLElement
  const onCurrCellInputDone = () => {
    sheetRef?.focus()
  }
</script>

<div class="grid grid-rows-[auto,auto,1fr] min-h-100vh">
  <header>
    <h1 class="text-4xl my-6">Demo</h1>
  </header>

  <nav class="flex">
    <label for="cell" class="min-w-6ch">{$currCellName}</label>
    <CellInput
      col={$currCol}
      row={$currRow}
      resumeEdit
      on:done={onCurrCellInputDone}
    />
  </nav>

  <main>
    <Sheet bind:ref={sheetRef} />
  </main>
</div>
