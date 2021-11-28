<script lang="ts">
  import { sheet } from './store'
  const sheetSnap = sheet.snap()
</script>

<pre>
  {JSON.stringify($sheetSnap)}
</pre>
