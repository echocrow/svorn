<script lang="ts">
  import { nameCell, nameCol, nameRow } from '$lib/cells'
  import {
    cells,
    colsLen,
    currCellCoords,
    moveCurrCellCoords,
    rowsLen,
  } from '$lib/store'

  import Cell from './Cell.svelte'
  import CellInput from './CellInput.svelte'

  $: cols = $colsLen
  $: rows = $rowsLen
  $: [currCol, currRow] = $currCellCoords

  let self: HTMLElement

  let isEditing = false
  let resumeEdit = false
  const onEditstart = () => {
    resumeEdit = true
    isEditing = true
  }
  const onEditend = () => {
    isEditing = false
    resumeEdit = false
    self?.focus()
  }

  const keyMoves: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  }
  const onKeydown = (e: KeyboardEvent) => {
    let { key } = e

    // Handle movement.
    if (key === 'Tab') key = e.shiftKey ? 'ArrowLeft' : 'ArrowRight'
    const move = keyMoves[key]
    if (move) {
      e.preventDefault()
      moveCurrCellCoords(...move)
      return
    }

    // Handle deletion.
    if (key === 'Delete' || key === 'Backspace') {
      if (isEditing) return
      e.preventDefault()
      cells.reset(nameCell(currCol, currRow))
      return
    }

    // Handle edit start.
    if (key === 'Enter') {
      if (isEditing) return
      e.preventDefault()
      resumeEdit = true
      isEditing = true
      return
    }

    // Handle edit end.
    if (key === 'Escape') {
      e.preventDefault()
      isEditing = false
      return
    }

    // Handle simple keys
    if (key.length === 1) {
      isEditing = true
    }
  }
</script>

<table
  on:keydown={onKeydown}
  bind:this={self}
  tabindex="-1"
  class="outline-none"
>
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
        {@const isSelected = col === currCol && row === currRow}
        <td>
          <Cell {col} {row} {isSelected} on:editstart={onEditstart} />

          {#if isSelected}
            <div
              class="absolute inset-0 border-width-2 border-current pointer-events-none"
            />
            {#if isEditing}
              <CellInput {col} {row} {resumeEdit} on:editend={onEditend} />
            {/if}
          {/if}
        </td>
      {/each}
    </tr>
  {/each}
</table>

<style>
  td {
    position: relative;
    border: 1px solid currentColor;
    padding: 0;
    min-width: 10ch;
  }
</style>
