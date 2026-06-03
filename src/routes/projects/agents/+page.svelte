<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  onMount(() => {
    goto('/projects/agents/setup');
  });
</script>

<div class="py-12 text-center text-gray-600">Opening agent setup...</div>
