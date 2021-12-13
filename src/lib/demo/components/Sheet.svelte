<script lang="ts">
  import Cell from './Cell.svelte'
  import ToggleWrapper from './ToggleWrapper.svelte'
  import StoreLog from './StoreLog.svelte'
  import CellWriter from './CellWriter.svelte'

  export let cols = 9
  export let rows = 9
</script>

<table>
  {#each Array(rows) as _, row}
    <tr>
      {#each Array(cols) as _, col}
        <td>
          <ToggleWrapper>
            <Cell {row} {col} />
          </ToggleWrapper>
        </td>
      {/each}
    </tr>
  {/each}
</table>

<hr />

<ToggleWrapper>
  <StoreLog />
</ToggleWrapper>

<hr />

<ToggleWrapper>
  <CellWriter {cols} {rows} />
</ToggleWrapper>

<style>
  table {
    border-collapse: collapse;
  }
  td {
    border: 1px solid currentColor;
    padding: 0.25em;
  }
</style>
