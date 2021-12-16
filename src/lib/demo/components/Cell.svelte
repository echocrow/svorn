<script lang="ts">
  import { interval } from 'rxjs'
  import { onMount } from 'svelte'
  import { nameCell } from '$demo/cells'
  import { derivedSheet, sheet } from '$demo/store'

  export let row: number
  export let col: number
  export let src: typeof sheet | typeof derivedSheet = sheet

  const name = nameCell(row, col)
  const val = src.get(name)

  const inc = (val: string | number) =>
    (typeof val === 'string' ? parseInt(val, 10) || 0 : val) + 1

  if (row === 0 && col === 0 && src === sheet) {
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
