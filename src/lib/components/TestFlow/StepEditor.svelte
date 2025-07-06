<script lang="ts">
  export let step: any;
  export let endpoints: any[] = [];
  export let stepIndex: number;
  export let isFirstStep: boolean = false;
  export let isLastStep: boolean = false;
  
  // Emitted events will be handled by the parent component
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  
  // Helper to find an endpoint by ID
  function findEndpoint(id: string | number) {
    return endpoints.find(e => e.id === id);
  }
  
  function removeEndpoint(endpointIndex: number) {
    dispatch('removeEndpoint', { stepIndex, endpointIndex });
  }
  
  function updateParam(endpointIndex: number, paramType: string, paramIndex: number, field: string, value: any) {
    dispatch('updateParam', { stepIndex, endpointIndex, paramType, paramIndex, field, value });
  }
  
  function moveStepUp() {
    dispatch('moveStep', { stepIndex, direction: 'up' });
  }
  
  function moveStepDown() {
    dispatch('moveStep', { stepIndex, direction: 'down' });
  }
</script>

<div class="bg-white border rounded-lg shadow-sm p-4">
  <div class="flex justify-between items-center mb-4">
    <h3 class="text-lg font-medium flex items-center">
      <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mr-2">
        {step.step_id}
      </span>
      {step.label}
    </h3>
    <div class="flex items-center space-x-2">
      {#if !isFirstStep}
        <button 
          class="text-gray-600 hover:text-gray-800 p-1"
          on:click={moveStepUp}
          aria-label="Move Step Up"
          title="Move Step Up"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
          </svg>
        </button>
      {/if}
      
      {#if !isLastStep}
        <button 
          class="text-gray-600 hover:text-gray-800 p-1"
          on:click={moveStepDown}
          aria-label="Move Step Down"
          title="Move Step Down"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </button>
      {/if}
      
      <button 
        class="text-red-600 hover:text-red-800 p-1"
        on:click={() => dispatch('removeStep', { stepIndex })}
        aria-label="Remove Step"
      >
        <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path>
        </svg>
      </button>
    </div>
  </div>
  
  <!-- Endpoints in this step -->
  <div class="mb-4">
    <h4 class="text-sm font-medium text-gray-500 mb-2">Endpoints:</h4>
    
    {#if step.endpoints.length === 0}
      <p class="text-gray-400 italic text-sm">No endpoints in this step yet</p>
    {:else}
      <div class="flex flex-row gap-3 overflow-x-auto pb-2">
        {#each step.endpoints as stepEndpoint, endpointIndex}
          {@const endpoint = findEndpoint(stepEndpoint.endpoint_id)}
          {#if endpoint}
            <div class="bg-gray-50 rounded-md p-3 min-w-[280px] max-w-[300px] flex-shrink-0">
              <div class="flex justify-between items-start mb-2">
                <div>
                  <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded mr-2">
                    {endpoint.method}
                  </span>
                  <span class="font-mono text-sm">{endpoint.path}</span>
                </div>
                <button 
                  class="text-red-600 hover:text-red-800"
                  on:click={() => removeEndpoint(endpointIndex)}
                  aria-label="Remove Endpoint"
                >
                  <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                  </svg>
                </button>
              </div>
              
              <div class="mb-2">
                <label for="response-{stepIndex}-{endpointIndex}" class="block text-xs font-medium text-gray-500 mb-1">
                  Store Response As:
                </label>
                <input 
                  id="response-{stepIndex}-{endpointIndex}"
                  type="text" 
                  bind:value={stepEndpoint.store_response_as}
                  class="text-sm px-2 py-1 border rounded w-full"
                  on:change={() => dispatch('change')}
                />
              </div>
              
              <!-- Add parameter configuration here if needed -->
              {#if endpoint.parameters && endpoint.parameters.length > 0}
                <div class="mt-3">
                  <h5 class="text-xs font-medium text-gray-500 mb-1">Parameters:</h5>
                  <div class="space-y-2">
                    {#each endpoint.parameters as param}
                      <div class="flex flex-col">
                        <label class="text-xs">{param.name} {param.required ? '*' : ''}</label>
                        <input 
                          type="text" 
                          class="text-sm px-2 py-1 border rounded"
                          placeholder={param.description || param.name}
                        />
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
  
  <!-- Add endpoint button -->
  <div>
    <slot name="endpoint-selector"></slot>
  </div>
</div>
