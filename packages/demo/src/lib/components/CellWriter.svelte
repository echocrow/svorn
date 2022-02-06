<script lang="ts">
  import { nameCol, nameRow } from '$lib/cells'
  import { currCol, currRow } from '$lib/store'
  import { range } from '$lib/utils'

  export let cols: number
  export let rows: number

  $: colOps = range(cols).map(nameCol)
  $: rowOps = range(rows).map(nameRow)

  // $: cellVal = $currCell

  const getRandomInt = (max: number) => Math.floor(Math.random() * max)

  const randoCell = () => {
    const col = getRandomInt(cols)
    const row = getRandomInt(rows)
    currCol.next(col)
    currRow.next(row)
  }
</script>

<select name="col" bind:value={$currCol}>
  {#each colOps as colOp, col}
    <option value={col}>{colOp}</option>
  {/each}
</select>

<select name="row" bind:value={$currRow}>
  {#each rowOps as rowOp, row}
    <option value={row}>{rowOp}</option>
  {/each}
</select>

<button on:click={randoCell}>?</button>

<!-- <input type="text" bind:value={$cellVal} /> -->
