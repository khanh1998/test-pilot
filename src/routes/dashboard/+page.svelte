<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  
  // Redirect to modules page since we're removing the dashboard
  onMount(() => {
    goto('/dashboard/modules', { replaceState: true });
  });
</script>

<!-- This page redirects to modules immediately -->
