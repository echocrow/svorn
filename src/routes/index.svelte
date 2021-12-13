<script lang="ts">
  import Sheet from '$demo/components/Sheet.svelte'
</script>

<Sheet />

<style>
  :global(html, body) {
    min-height: 100vh;
    margin: 0;
    padding: 0;
  }
  :global(body) {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #112;
    color: #ffe;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
      Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji',
      'Segoe UI Symbol';
  }
  :global(a) {
    color: #fb0;
  }

  :global(table, th, td) {
    border: 1px solid currentColor;
    padding: 0.25em;
  }
  :global(table) {
    border-collapse: collapse;
  }
</style>
