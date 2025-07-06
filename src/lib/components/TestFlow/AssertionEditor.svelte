<script lang="ts">
  export let assertion: any;
  export let steps: any[] = [];
  export let assertionIndex: number;
  
  // Emitted events will be handled by the parent component
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  
  function getEndpointsForStep(stepId: string) {
    const step = steps.find(s => s.step_id === stepId);
    return step ? step.endpoints : [];
  }
  
  function updateAssertion(field: string, value: any) {
    dispatch('update', { assertionIndex, field, value });
  }
</script>

<div class="bg-white border rounded-lg shadow-sm p-4">
  <div class="flex justify-between items-center mb-4">
    <h3 class="text-lg font-medium">Assertion {assertionIndex + 1}</h3>
    <button 
      class="text-red-600 hover:text-red-800"
      on:click={() => dispatch('remove', { assertionIndex })}
      aria-label="Remove Assertion"
    >
      <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
      </svg>
    </button>
  </div>
  
  <div class="grid grid-cols-1 gap-4">
    <div>
      <label for="step-{assertionIndex}" class="block text-xs font-medium text-gray-500 mb-1">
        Step:
      </label>
      <select 
        id="step-{assertionIndex}"
        bind:value={assertion.step_id}
        class="text-sm px-2 py-1 border rounded w-full"
        on:change={() => {
          // Reset endpoint when step changes
          assertion.endpoint_id = '';
          dispatch('change');
        }}
      >
        <option value="">Select Step</option>
        {#each steps as step}
          <option value={step.step_id}>{step.label}</option>
        {/each}
      </select>
    </div>
    
    {#if assertion.step_id}
      <div>
        <label for="endpoint-{assertionIndex}" class="block text-xs font-medium text-gray-500 mb-1">
          Endpoint:
        </label>
        <select 
          id="endpoint-{assertionIndex}"
          bind:value={assertion.endpoint_id}
          class="text-sm px-2 py-1 border rounded w-full"
          on:change={() => dispatch('change')}
        >
          <option value="">Select Endpoint</option>
          {#each getEndpointsForStep(assertion.step_id) as endpoint}
            <option value={endpoint.endpoint_id}>{endpoint.store_response_as}</option>
          {/each}
        </select>
      </div>
    {/if}
    
    <div>
      <label for="path-{assertionIndex}" class="block text-xs font-medium text-gray-500 mb-1">
        Target Path:
      </label>
      <input 
        id="path-{assertionIndex}"
        type="text" 
        bind:value={assertion.target_path}
        class="text-sm px-2 py-1 border rounded w-full"
        placeholder="$.response.data.id"
        on:change={() => dispatch('change')}
      />
      <p class="text-xs text-gray-500 mt-1">
        JSONPath expression to select data from the response
      </p>
    </div>
    
    <div>
      <label for="condition-{assertionIndex}" class="block text-xs font-medium text-gray-500 mb-1">
        Condition:
      </label>
      <select 
        id="condition-{assertionIndex}"
        bind:value={assertion.condition}
        class="text-sm px-2 py-1 border rounded w-full"
        on:change={() => dispatch('change')}
      >
        <option value="equals">Equals</option>
        <option value="not_equals">Not Equals</option>
        <option value="contains">Contains</option>
        <option value="greater_than">Greater Than</option>
        <option value="less_than">Less Than</option>
      </select>
    </div>
    
    <div>
      <label for="source-{assertionIndex}" class="block text-xs font-medium text-gray-500 mb-1">
        Expected Value Source:
      </label>
      <select 
        id="source-{assertionIndex}"
        bind:value={assertion.expected_value.source}
        class="text-sm px-2 py-1 border rounded w-full"
        on:change={() => dispatch('change')}
      >
        <option value="fixed">Fixed Value</option>
        <option value="response">From Response</option>
      </select>
    </div>
    
    {#if assertion.expected_value.source === 'fixed'}
      <div>
        <label for="value-{assertionIndex}" class="block text-xs font-medium text-gray-500 mb-1">
          Expected Value:
        </label>
        <input 
          id="value-{assertionIndex}"
          type="text" 
          bind:value={assertion.expected_value.value}
          class="text-sm px-2 py-1 border rounded w-full"
          on:change={() => dispatch('change')}
        />
      </div>
    {:else if assertion.expected_value.source === 'response'}
      <div>
        <label for="resp-step-{assertionIndex}" class="block text-xs font-medium text-gray-500 mb-1">
          Response Step:
        </label>
        <select 
          id="resp-step-{assertionIndex}"
          bind:value={assertion.expected_value.from.step_id}
          class="text-sm px-2 py-1 border rounded w-full"
          on:change={() => {
            assertion.expected_value.from.endpoint_id = '';
            dispatch('change');
          }}
        >
          <option value="">Select Step</option>
          {#each steps as step}
            <option value={step.step_id}>{step.label}</option>
          {/each}
        </select>
      </div>
      
      {#if assertion.expected_value.from && assertion.expected_value.from.step_id}
        <div>
          <label for="resp-endpoint-{assertionIndex}" class="block text-xs font-medium text-gray-500 mb-1">
            Response Endpoint:
          </label>
          <select 
            id="resp-endpoint-{assertionIndex}"
            bind:value={assertion.expected_value.from.endpoint_id}
            class="text-sm px-2 py-1 border rounded w-full"
            on:change={() => dispatch('change')}
          >
            <option value="">Select Endpoint</option>
            {#each getEndpointsForStep(assertion.expected_value.from.step_id) as endpoint}
              <option value={endpoint.endpoint_id}>{endpoint.store_response_as}</option>
            {/each}
          </select>
        </div>
      {/if}
      
      <div>
        <label for="resp-path-{assertionIndex}" class="block text-xs font-medium text-gray-500 mb-1">
          JSONPath:
        </label>
        <input 
          id="resp-path-{assertionIndex}"
          type="text" 
          bind:value={assertion.expected_value.from.path}
          class="text-sm px-2 py-1 border rounded w-full"
          placeholder="$.data.id"
          on:change={() => dispatch('change')}
        />
      </div>
    {/if}
  </div>
</div>
