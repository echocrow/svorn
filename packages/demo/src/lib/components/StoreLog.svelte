<script lang="ts">
  import { sheet } from '$lib/store'

  const sheetSnap = sheet.snap()
</script>

<pre>
  {JSON.stringify($sheetSnap)}
</pre>
