<script lang="ts">
  import ApiList from '$lib/components/apis/ApiList.svelte';
</script>

<div class="p-6">
  <div class="mb-6">
    <h1 class="text-2xl font-bold text-gray-900">API Management</h1>
    <p class="mt-1 text-sm text-gray-600">
      Manage your OpenAPI specifications and endpoints
    </p>
  </div>

  <ApiList />
</div>
