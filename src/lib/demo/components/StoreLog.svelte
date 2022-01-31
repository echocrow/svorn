<script lang="ts">
  import { sheet } from '$demo/store'

  const sheetSnap = sheet.snap()
</script>

<pre>
  {JSON.stringify($sheetSnap)}
</pre>
