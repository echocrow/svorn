<script lang="ts">
  import { nameCell } from '$lib/cells'
  import { outputCells, setCurrCellCoords } from '$lib/store'

  export let row: number
  export let col: number

  const name = nameCell(col, row)
  const val = outputCells.get(name)

  const onClick = () => {
    setCurrCellCoords(col, row)
  }
</script>

<button on:click|preventDefault={onClick}>
  {$val}
</button>

<style>
  button {
    width: 100%;
    line-height: 1;
    height: auto;
    padding: 0.5em;
    border: 0;
    background: none;
    color: inherit;
  }
</style>
