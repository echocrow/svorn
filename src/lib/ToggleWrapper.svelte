<script lang="ts">
  export let isOpen = false
</script>

<input type="checkbox" bind:checked={isOpen} />

{#if isOpen}
  <br />
  <slot />
{/if}
