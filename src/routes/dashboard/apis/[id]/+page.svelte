<script lang="ts">
  import ApiEndpoints from '$lib/components/ApiEndpoints.svelte';
  import { page } from '$app/stores';
  
  $: apiId = parseInt($page.params.id || '0');
</script>

<ApiEndpoints {apiId} />
