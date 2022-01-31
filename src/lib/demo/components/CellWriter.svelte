<script lang="ts">
  import { writableFromRx } from 'rxcoil/svelte'

  import { nameCol, nameRow } from '$demo/cells'
  import { currCell, currCol, currRow } from '$demo/store'
  import { range } from '$demo/utilssvelte'

  export let cols: number
  export let rows: number

  $: colOps = range(cols).map(nameCol)
  $: rowOps = range(rows).map(nameRow)

  const col = writableFromRx(currCol)
  const row = writableFromRx(currRow)
  $: cellVal = writableFromRx($currCell)

  const getRandomInt = (max: number) => Math.floor(Math.random() * max)

  const randoCell = () => {
    const col = getRandomInt(cols)
    const row = getRandomInt(rows)
    currCol.next(col)
    currRow.next(row)
  }
</script>

<select name="col" bind:value={$col}>
  {#each colOps as colOp, col}
    <option value={col}>{colOp}</option>
  {/each}
</select>

<select name="row" bind:value={$row}>
  {#each rowOps as rowOp, row}
    <option value={row}>{rowOp}</option>
  {/each}
</select>

<button on:click={randoCell}>?</button>

<input type="text" bind:value={$cellVal} />
