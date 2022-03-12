<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  import { nameCell } from '$lib/cells'
  import { outputCells, setCurrCellCoords } from '$lib/store'

  const DOUBLE_CLICK_THRESHOLD = 300

  export let row: number
  export let col: number
  export let isSelected: boolean

  const dispatch = createEventDispatcher()

  const name = nameCell(col, row)
  const val = outputCells.get(name)

  let btn: HTMLButtonElement

  $: isSelected && btn?.focus()

  let lastClick = 0
  const onClick = () => {
    const click = Date.now()
    setCurrCellCoords(col, row)

    if (click - lastClick <= DOUBLE_CLICK_THRESHOLD) {
      dispatch('editstart')
    }

    lastClick = click
  }
</script>

<button bind:this={btn} on:click|preventDefault={onClick}>
  {$val}
</button>

<style>
  button {
    display: block;
    width: 100%;
    height: auto;
    padding: 0.5em;
    border: 0;
    background: none;
    color: inherit;
    line-height: 1;
    cursor: pointer;
  }
</style>
