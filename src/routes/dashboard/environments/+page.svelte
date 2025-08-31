<!--
Environments management page
-->
<script lang="ts">
  import EnvironmentList from '$lib/components/environments/EnvironmentList.svelte';
</script>

<svelte:head>
  <title>Environments - Test Pilot</title>
</svelte:head>

<div class="max-w-6xl mx-auto p-8">
  <header class="mb-8">
    <h1 class="text-3xl font-bold text-gray-900 mb-2">Environments</h1>
    <p class="text-gray-600">Manage your test environments and configurations</p>
  </header>

  <main>
    <EnvironmentList />
  </main>
</div>
