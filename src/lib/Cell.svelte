<script lang="ts">
  import { interval } from 'rxjs'

  import { onMount } from 'svelte'

  import { nameCell } from './cells'
  import { sheet } from './store'

  export let row: number
  export let col: number

  const name = nameCell(row, col)
  const val = sheet.get(name)

  const inc = (val: string | number) =>
    (typeof val === 'string' ? parseInt(val, 10) || 0 : val) + 1

  if (row === 0 && col === 0) {
    onMount(() => {
      const timer = interval(1000)
      const sub = timer.subscribe(() =>
        sheet.set(name, inc(sheet.getValue(name))),
      )
      return () => sub.unsubscribe()
    })
  }
</script>

{$val}
