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
    <button 
      class="px-3 py-1 flex items-center text-sm text-gray-600 hover:text-gray-900"
      on:click={handleBack}
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
      Back to Test Flows
    </button>
  </div>

  <FlowGeneratorPage on:back={handleBack} on:success={handleSuccess} />
</main>
