<script lang="ts">
  import { nameCell, nameCol, nameRow } from '$lib/cells'
  import {
    cells,
    colsLen,
    currCellCoords,
    currCellName,
    moveCurrCellCoords,
    rowsLen,
  } from '$lib/store'

  import Cell from './Cell.svelte'
  import CellInput from './CellInput.svelte'

  export let ref: HTMLElement | null = null

  $: cols = $colsLen
  $: rows = $rowsLen
  $: [currCol, currRow] = $currCellCoords
  $: currName = $currCellName

  let isEditing = false
  let resumeEdit = false
  const onEditstart = () => {
    resumeEdit = true
    isEditing = true
  }
  const onEditDone = () => {
    isEditing = false
    resumeEdit = false
    ref?.focus()
  }
  const onEditSubmit = (col: number, row: number, value: string) => {
    cells.next(nameCell(col, row), value)
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
      cells.reset(currName)
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
    if (key.length === 1 && !e.metaKey && !e.ctrlKey) {
      isEditing = true
    }
  }
</script>

<section
  on:keydown={onKeydown}
  bind:this={ref}
  tabindex="-1"
  class="outline-none min-h-full"
>
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
          {@const isSelected = col === currCol && row === currRow}
          <td>
            <Cell {col} {row} {isSelected} on:editstart={onEditstart} />

            {#if isSelected}
              <div
                class="absolute inset-0 border-width-2 border-current pointer-events-none"
              />
              {#if isEditing}
                <div class="absolute inset-0">
                  <CellInput
                    defaultText={resumeEdit ? cells.getValue(currName) : ''}
                    autofocus
                    aria-label="Cell input"
                    on:done={onEditDone}
                    on:submit={(e) => onEditSubmit(col, row, e.detail)}
                  />
                </div>
              {/if}
            {/if}
          </td>
        {/each}
      </tr>
    {/each}
  </table>
</section>

<style>
  td {
    position: relative;
    border: 1px solid currentColor;
    padding: 0;
    min-width: 10ch;
  }
</style>
