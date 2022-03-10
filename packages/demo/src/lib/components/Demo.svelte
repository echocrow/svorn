<script lang="ts">
  import { currCell, currCellName } from '$lib/store'

  import Sheet from './Sheet.svelte'

  $: cell = $currCell
</script>

<div class="demo">
  <header>
    <h1>Demo</h1>
  </header>

  <nav>
    <label for="cell">{$currCellName}</label>
    <input type="text" name="cell" bind:value={$cell} />
  </nav>

  <main>
    <Sheet />
  </main>
</div>

<style>
  .demo {
    display: grid;
    grid-template:
      'header' auto
      'nav' auto
      'main' 1fr / 1fr;
    flex-direction: column;
    min-height: 100vh;
  }

  header {
    grid-area: header;
  }

  nav {
    display: flex;
    grid-area: nav;
  }
  label[for='cell'] {
    min-width: 6ch;
  }
  input[name='cell'] {
    width: 100%;
  }

  main {
    grid-area: main;
  }
</style>
