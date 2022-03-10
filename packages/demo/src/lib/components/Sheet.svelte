<script lang="ts">
  import { nameCol, nameRow } from '$lib/cells'
  import { colsLen, rowsLen } from '$lib/store'

  import Cell from './Cell.svelte'

  $: cols = $colsLen
  $: rows = $rowsLen
</script>

<table>
  <tr>
    <th />
    {#each Array(cols) as _, col}
      <th scope="col">{nameCol(col)}</th>
    {/each}
  </tr>

  {#each Array(rows) as _, row}
    <tr>
      <th scope="row">{nameRow(row)}</th>
      {#each Array(cols) as _, col}
        <td>
          <Cell {col} {row} />
        </td>
      {/each}
    </tr>
  {/each}
</table>

<style>
  table {
    border-collapse: collapse;
  }
  td {
    border: 1px solid currentColor;
    padding: 0.25em;
    min-width: 10ch;
    padding: 0;
  }
</style>
