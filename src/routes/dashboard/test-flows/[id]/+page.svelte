<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  
  // Import the components we created
  import EndpointSelector from '$lib/components/TestFlow/EndpointSelector.svelte';
  
  $: testFlowId = parseInt($page.params.id || '0');
  
  let testFlow: any = null;
  let endpoints: any[] = [];
  let selectedEndpoint: any = null;
  let loading = true;
  let error: string | null = null;
  let currentTab: 'steps' | 'assertions' | 'settings' = 'steps';
  let flowJson: any = { settings: { cookie_mode: "auto" }, steps: [], assertions: [] };
  let isDirty = false;
  let isSaving = false;
  
  // New step related state
  let showNewStepModal = false;
  let newStepLabel = '';
  
  onMount(async () => {
    await fetchTestFlow();
  });
  
  async function fetchTestFlow() {
    try {
      loading = true;
      error = null;
      
      const response = await fetch(`/api/test-flows/${testFlowId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch test flow: ${response.statusText}`);
      }
      
      const data = await response.json();
      testFlow = data.testFlow;
      endpoints = testFlow.endpoints || [];
      flowJson = testFlow.flowJson || { settings: { cookie_mode: "auto" }, steps: [], assertions: [] };
      isDirty = false;
      
    } catch (err: any) {
      console.error('Error fetching test flow:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  }
  
  function markDirty() {
    isDirty = true;
  }
  
  async function saveTestFlow() {
    try {
      isSaving = true;
      error = null;
      
      const response = await fetch(`/api/test-flows/${testFlowId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          name: testFlow.name,
          description: testFlow.description,
          flowJson
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update test flow: ${response.statusText}`);
      }
      
      isDirty = false;
      
    } catch (err: any) {
      console.error('Error updating test flow:', err);
      error = err.message;
    } finally {
      isSaving = false;
    }
  }
  
  function addStep() {
    if (!newStepLabel.trim()) {
      error = 'Step label is required';
      return;
    }
    
    const stepId = `step${flowJson.steps.length + 1}`;
    
    flowJson.steps = [
      ...flowJson.steps,
      {
        step_id: stepId,
        label: newStepLabel,
        endpoints: []
      }
    ];
    
    newStepLabel = '';
    showNewStepModal = false;
    markDirty();
  }
  
  function removeStep(stepIndex: number) {
    if (confirm('Are you sure you want to remove this step?')) {
      flowJson.steps = flowJson.steps.filter((_: any, i: number) => i !== stepIndex);
      markDirty();
    }
  }
  
  function addEndpointToStep(stepIndex: number, endpoint: any) {
    if (!endpoint) return;
    
    const step = flowJson.steps[stepIndex];
    if (!step) return;
    
    // Check if endpoint already exists in this step
    const exists = step.endpoints.some((e: any) => e.endpoint_id === endpoint.id);
    if (exists) {
      error = 'This endpoint already exists in this step';
      return;
    }
    
    // Add endpoint to the step
    step.endpoints = [
      ...step.endpoints,
      {
        endpoint_id: endpoint.id,
        input_params: [],
        path_params: [],
        headers: [],
        store_response_as: `${endpoint.operationId || endpoint.path.replace(/\//g, '_')}_response`
      }
    ];
    
    flowJson.steps = [...flowJson.steps];
    markDirty();
  }
  
  function removeEndpointFromStep(stepIndex: number, endpointIndex: number) {
    if (!confirm('Are you sure you want to remove this endpoint from the step?')) return;
    
    const step = flowJson.steps[stepIndex];
    if (!step) return;
    
    step.endpoints = step.endpoints.filter((_: any, i: number) => i !== endpointIndex);
    flowJson.steps = [...flowJson.steps];
    markDirty();
  }
  
  function addAssertion() {
    flowJson.assertions = [
      ...flowJson.assertions,
      {
        step_id: flowJson.steps.length > 0 ? flowJson.steps[flowJson.steps.length - 1].step_id : '',
        endpoint_id: '',
        target_path: '$.response',
        condition: 'equals',
        expected_value: {
          source: 'fixed',
          value: ''
        }
      }
    ];
    
    markDirty();
  }
  
  function removeAssertion(assertionIndex: number) {
    if (confirm('Are you sure you want to remove this assertion?')) {
      flowJson.assertions = flowJson.assertions.filter((_: any, i: number) => i !== assertionIndex);
      markDirty();
    }
  }
  
  // Helper to find an endpoint by ID
  function findEndpoint(id: string | number) {
    return endpoints.find(e => e.id === id);
  }
  
  function getStepById(stepId: string) {
    return flowJson.steps.find((step: any) => step.step_id === stepId);
  }
  
  // Helper to get possible input sources for parameters
  function getPossibleSources(currentStepIndex: number) {
    const sources = [
      { id: 'fixed', name: 'Fixed Value' },
      { id: 'function', name: 'Function' },
      { id: 'ai', name: 'AI Generated' }
    ];
    
    // Add previous responses as sources
    for (let i = 0; i < currentStepIndex; i++) {
      const step = flowJson.steps[i];
      if (!step) continue;
      
      for (const endpoint of step.endpoints) {
        if (!endpoint.store_response_as) continue;
        
        sources.push({
          id: `response:${step.step_id}:${endpoint.endpoint_id}`,
          name: `${step.label} > ${findEndpoint(endpoint.endpoint_id)?.operationId || 'Response'}`
        });
      }
    }
    
    return sources;
  }
  
  // Update a parameter source in a step's endpoint
  function updateParameterSource(stepIndex: number, endpointIndex: number, paramType: string, paramIndex: number, source: string, value: any) {
    const step = flowJson.steps[stepIndex];
    if (!step) return;
    
    const endpoint = step.endpoints[endpointIndex];
    if (!endpoint) return;
    
    const params = endpoint[paramType] || [];
    if (!params[paramIndex]) return;
    
    params[paramIndex].source = source;
    
    if (source === 'fixed') {
      params[paramIndex].value = value;
      delete params[paramIndex].from;
    } else if (source === 'function') {
      params[paramIndex].function = value;
      delete params[paramIndex].value;
      delete params[paramIndex].from;
    } else if (source === 'ai') {
      params[paramIndex].ai_prompt = value;
      delete params[paramIndex].value;
      delete params[paramIndex].from;
    } else if (source.startsWith('response:')) {
      const [, stepId, endpointId] = source.split(':');
      params[paramIndex].from = {
        step_id: stepId,
        endpoint_id: endpointId,
        path: value
      };
      delete params[paramIndex].value;
    }
    
    endpoint[paramType] = [...params];
    markDirty();
  }
  
  // Update assertion
  function updateAssertion(index: number, changes: any) {
    flowJson.assertions[index] = {
      ...flowJson.assertions[index],
      ...changes
    };
    
    markDirty();
  }
  
  // Update settings
  function updateSettings(settings: any) {
    flowJson.settings = settings;
    markDirty();
  }
</script>

<div class="container mx-auto px-4 py-8">
  <div class="flex justify-between items-center mb-6">
    <div>
      <a href="/dashboard/test-flows" class="text-blue-600 hover:underline inline-flex items-center">
        <svg class="h-5 w-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M7.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l2.293 2.293a1 1 0 010 1.414z" clip-rule="evenodd"></path>
        </svg>
        Back to Test Flows
      </a>
      <h1 class="text-3xl font-bold mt-2">
        {#if testFlow}
          {testFlow.name}
        {:else}
          Test Flow Editor
        {/if}
      </h1>
    </div>
    
    <button 
      class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
      disabled={!isDirty || isSaving}
      on:click={saveTestFlow}
    >
      {isSaving ? 'Saving...' : 'Save Changes'}
    </button>
  </div>
  
  {#if error}
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 relative">
      <span class="block sm:inline">{error}</span>
      <button 
        class="absolute top-0 bottom-0 right-0 px-4"
        on:click={() => error = null}
      >
        ×
      </button>
    </div>
  {/if}
  
  {#if loading}
    <div class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  {:else if testFlow}
    <div class="mb-6">
      <div class="bg-white rounded-lg shadow">
        <div class="border-b border-gray-200">
          <nav class="flex flex-wrap">
            <button 
              class="px-6 py-3 text-gray-700 border-b-2 font-medium text-sm 
                    {currentTab === 'steps' ? 'border-blue-500 text-blue-500' : 'border-transparent hover:border-gray-300'}"
              on:click={() => currentTab = 'steps'}
            >
              Steps
            </button>
            <button 
              class="px-6 py-3 text-gray-700 border-b-2 font-medium text-sm 
                    {currentTab === 'assertions' ? 'border-blue-500 text-blue-500' : 'border-transparent hover:border-gray-300'}"
              on:click={() => currentTab = 'assertions'}
            >
              Assertions
            </button>
            <button 
              class="px-6 py-3 text-gray-700 border-b-2 font-medium text-sm 
                    {currentTab === 'settings' ? 'border-blue-500 text-blue-500' : 'border-transparent hover:border-gray-300'}"
              on:click={() => currentTab = 'settings'}
            >
              Settings
            </button>
          </nav>
        </div>
        
        <div class="p-6">
          <!-- Steps Tab -->
          {#if currentTab === 'steps'}
            <div class="flex justify-between items-center mb-6">
              <h2 class="text-xl font-semibold">Test Flow Steps</h2>
              <button 
                class="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 transition text-sm"
                on:click={() => showNewStepModal = true}
              >
                Add Step
              </button>
            </div>
            
            {#if flowJson.steps.length === 0}
              <div class="bg-gray-50 rounded-lg p-8 text-center">
                <h3 class="text-xl font-semibold mb-2">No Steps Yet</h3>
                <p class="text-gray-600 mb-6">
                  Add steps to define your test flow sequence.
                </p>
                <button
                  class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
                  on:click={() => showNewStepModal = true}
                >
                  Add First Step
                </button>
              </div>
            {:else}
              <div class="space-y-8">
                {#each flowJson.steps as step, stepIndex}
                  <div class="bg-white border rounded-lg shadow-sm p-4">
                    <div class="flex justify-between items-center mb-4">
                      <h3 class="text-lg font-medium flex items-center">
                        <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mr-2">
                          {step.step_id}
                        </span>
                        {step.label}
                      </h3>
                      <div>
                        <button 
                          class="text-red-600 hover:text-red-800"
                          on:click={() => removeStep(stepIndex)}
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
                        <div class="space-y-4">
                          {#each step.endpoints as stepEndpoint, endpointIndex}
                            {@const endpoint = findEndpoint(stepEndpoint.endpoint_id)}
                            {#if endpoint}
                              <div class="bg-gray-50 rounded-md p-3">
                                <div class="flex justify-between items-start mb-2">
                                  <div>
                                    <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded mr-2">
                                      {endpoint.method}
                                    </span>
                                    <span class="font-mono text-sm">{endpoint.path}</span>
                                  </div>
                                  <button 
                                    class="text-red-600 hover:text-red-800"
                                    on:click={() => removeEndpointFromStep(stepIndex, endpointIndex)}
                                    aria-label="Remove Endpoint"
                                  >
                                    <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                                    </svg>
                                  </button>
                                </div>
                                
                                <div class="mb-2">
                                  <label for="store-response-{stepIndex}-{endpointIndex}" class="block text-xs font-medium text-gray-500 mb-1">
                                    Store Response As:
                                  </label>
                                  <input 
                                    id="store-response-{stepIndex}-{endpointIndex}"
                                    type="text" 
                                    bind:value={stepEndpoint.store_response_as}
                                    class="text-sm px-2 py-1 border rounded w-full"
                                    on:change={markDirty}
                                  />
                                </div>
                                
                                <!-- Parameter configuration would go here -->
                                <!-- Will be implemented in StepEditor component -->
                              </div>
                            {/if}
                          {/each}
                        </div>
                      {/if}
                    </div>
                    
                    <!-- Add endpoint button -->
                    <div>
                      <EndpointSelector
                        {endpoints}
                        on:select={(e: CustomEvent) => addEndpointToStep(stepIndex, e.detail)}
                      />
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          {/if}
          
          <!-- Assertions Tab -->
          {#if currentTab === 'assertions'}
            <div class="flex justify-between items-center mb-6">
              <h2 class="text-xl font-semibold">Test Flow Assertions</h2>
              <button 
                class="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 transition text-sm"
                on:click={addAssertion}
              >
                Add Assertion
              </button>
            </div>
            
            {#if !flowJson.assertions || flowJson.assertions.length === 0}
              <div class="bg-gray-50 rounded-lg p-8 text-center">
                <h3 class="text-xl font-semibold mb-2">No Assertions Yet</h3>
                <p class="text-gray-600 mb-6">
                  Add assertions to verify your test flow results.
                </p>
                <button
                  class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
                  on:click={addAssertion}
                >
                  Add First Assertion
                </button>
              </div>
            {:else}
              <div class="space-y-4">
                {#each flowJson.assertions as assertion, assertionIndex}
                  <div class="bg-white border rounded-lg shadow-sm p-4">
                    <div class="flex justify-between items-center mb-4">
                      <h3 class="text-lg font-medium">Assertion {assertionIndex + 1}</h3>
                      <button 
                        class="text-red-600 hover:text-red-800"
                        on:click={() => removeAssertion(assertionIndex)}
                        aria-label="Remove Assertion"
                      >
                        <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                      </button>
                    </div>
                    
                    <!-- Assertion configuration will be handled by AssertionEditor component -->
                    <div class="grid grid-cols-1 gap-4">
                      <div>
                        <label for="assertion-step-{assertionIndex}" class="block text-xs font-medium text-gray-500 mb-1">
                          Step:
                        </label>
                        <select 
                          id="assertion-step-{assertionIndex}"
                          bind:value={assertion.step_id}
                          class="text-sm px-2 py-1 border rounded w-full"
                          on:change={markDirty}
                        >
                          <option value="">Select Step</option>
                          {#each flowJson.steps as step}
                            <option value={step.step_id}>{step.label}</option>
                          {/each}
                        </select>
                      </div>
                      
                      <div>
                        <label for="assertion-path-{assertionIndex}" class="block text-xs font-medium text-gray-500 mb-1">
                          Target Path:
                        </label>
                        <input 
                          id="assertion-path-{assertionIndex}"
                          type="text" 
                          bind:value={assertion.target_path}
                          class="text-sm px-2 py-1 border rounded w-full"
                          placeholder="$.response.data.id"
                          on:change={markDirty}
                        />
                      </div>
                      
                      <div>
                        <label for="assertion-condition-{assertionIndex}" class="block text-xs font-medium text-gray-500 mb-1">
                          Condition:
                        </label>
                        <select 
                          id="assertion-condition-{assertionIndex}"
                          bind:value={assertion.condition}
                          class="text-sm px-2 py-1 border rounded w-full"
                          on:change={markDirty}
                        >
                          <option value="equals">Equals</option>
                          <option value="not_equals">Not Equals</option>
                          <option value="contains">Contains</option>
                          <option value="greater_than">Greater Than</option>
                          <option value="less_than">Less Than</option>
                        </select>
                      </div>
                      
                      <div>
                        <label for="assertion-value-{assertionIndex}" class="block text-xs font-medium text-gray-500 mb-1">
                          Expected Value:
                        </label>
                        <input 
                          id="assertion-value-{assertionIndex}"
                          type="text" 
                          bind:value={assertion.expected_value.value}
                          class="text-sm px-2 py-1 border rounded w-full"
                          on:change={markDirty}
                        />
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          {/if}
          
          <!-- Settings Tab -->
          {#if currentTab === 'settings'}
            <div class="mb-6">
              <h2 class="text-xl font-semibold">Test Flow Settings</h2>
            </div>
            
            <div class="max-w-lg">
              <div class="mb-4">
                <label class="flex items-center">
                  <input 
                    type="checkbox" 
                    checked={flowJson.settings?.cookie_mode === 'auto'}
                    on:change={(e) => {
                      if (e.target) {
                        const target = e.target as HTMLInputElement;
                        flowJson.settings.cookie_mode = target.checked ? 'auto' : 'none';
                        markDirty();
                      }
                    }}
                    class="mr-2"
                  />
                  <span>Automatically store and use cookies between requests</span>
                </label>
                <p class="text-sm text-gray-500 mt-1 ml-6">
                  When enabled, cookies set by responses will be automatically sent in subsequent requests.
                </p>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Modal for adding a new step -->
{#if showNewStepModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 w-full max-w-md mx-4">
      <h2 class="text-xl font-bold mb-4">Add New Step</h2>
      
      <div class="mb-4">
        <label for="stepLabel" class="block text-sm font-medium text-gray-700 mb-1">Step Label</label>
        <input
          id="stepLabel"
          type="text"
          bind:value={newStepLabel}
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter a descriptive label for this step"
        />
      </div>
      
      <div class="flex justify-end">
        <button
          class="mr-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition"
          on:click={() => {
            showNewStepModal = false;
            error = null;
          }}
        >
          Cancel
        </button>
        <button
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
          on:click={addStep}
          disabled={!newStepLabel.trim()}
        >
          Add Step
        </button>
      </div>
    </div>
  </div>
{/if}
