<script>
  import { goto } from '$app/navigation';
  import FlowGeneratorPage from '$lib/components/test-flows/FlowGeneratorPage.svelte';
  
  function handleBack() {
    goto('/dashboard/test-flows');
  }
  
  function handleSuccess() {
    goto('/dashboard/test-flows');
  }
</script>

<main class="container mx-auto px-4 py-8 max-w-7xl">
  <!-- Header -->
  <div class="flex items-center justify-between border-b pb-4 mb-6">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Generate Test Flow with AI</h1>
      <p class="text-sm text-gray-600 mt-1">Create a test flow based on your description using AI assistance</p>
    </div>
  </div>

  <FlowGeneratorPage on:back={handleBack} on:success={handleSuccess} />
</main>
