<script lang="ts">
  import { joinNames, nameCol, nameRow } from './cells'
  import { range } from './utils'
  import { sheet } from './store'
  import { writableFromRx } from './svelte-rx'

  export let cols: number
  export let rows: number

  let col = nameCol(1)
  let row = nameRow(0)

  $: colOps = range(cols).map(nameCol)
  $: rowOps = range(rows).map(nameRow)

  $: cell = joinNames(row, col)
  $: cellVal = writableFromRx(sheet.get(cell))
</script>

<select name="col" bind:value={col}>
  {#each colOps as colOp}
    <option value={colOp}>{colOp}</option>
  {/each}
</select>

<select name="row" bind:value={row}>
  {#each rowOps as rowOp}
    <option value={rowOp}>{rowOp}</option>
  {/each}
</select>

<input type="text" bind:value={$cellVal} />
