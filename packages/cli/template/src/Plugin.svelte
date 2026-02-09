<svelte:options customElement="my-plugin" />

<script lang="ts">
  // Minimal placeholder component. Extend as needed.
  export let message: string = 'Hello World';
</script>

<div class="hello-root">{message}</div>

<style>
  .hello-root { font: 14px system-ui, sans-serif; padding: .5rem; }
</style>
