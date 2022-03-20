<script lang="ts">
  import { currCell } from '#lib/store'

  import CellInput from './CellInput.svelte'

  $: cell = $currCell
</script>

<CellInput
  defaultText={$cell}
  aria-label="Current cell input"
  on:done
  on:submit={(e) => cell.next(e.detail)}
/>
