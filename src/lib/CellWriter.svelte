<script lang="ts">
  import { readable } from 'svelte/store'

  import { joinNames, nameCol, nameRow } from './cells'
  import { range } from './utils'
  import { sheet } from './store'

  const writableCell = (cell: string) => {
    const c = readable<string | number>('', (set) => {
      const subscription = sheet.get(cell).subscribe((v) => set(v))
      return () => subscription.unsubscribe()
    })
    const set = (v: string | number) => sheet.set(cell, v)
    return { ...c, set }
  }

  export let cols: number
  export let rows: number

  let col = nameCol(0)
  let row = nameRow(0)

  $: colOps = range(cols).map(nameCol)
  $: rowOps = range(rows).map(nameRow)

  $: cell = joinNames(row, col)
  $: cellVal = writableCell(cell)
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
