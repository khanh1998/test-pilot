<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import type { TestFlowData, FlowVariable, FlowStep, FlowAssertion } from '$lib/components/TestFlow/components/types';
  
  // Import the components we created
  import EndpointSelector from '$lib/components/TestFlow/EndpointSelector.svelte';
  import StepEditor from '$lib/components/TestFlow/StepEditor.svelte';
  import FlowRunner from '$lib/components/TestFlow/FlowRunner.svelte';
  import TestFlowEditor from '$lib/components/TestFlow/TestFlowEditor.svelte';
  
  $: testFlowId = parseInt($page.params.id || '0');
  
  let testFlow: any = null;
  let endpoints: any[] = [];
  let selectedEndpoint: any = null;
  let loading = true;
  let error: string | null = null;
  let currentTab: 'steps' | 'assertions' | 'settings' = 'steps';
  let flowJson: TestFlowData = { 
    settings: { api_host: "" }, 
    steps: [], 
    assertions: [],
    variables: []
  };
  let isDirty = false;
  let isSaving = false;
  
  // API host for the flow
  let apiHost = '';
  
  // New step related state
  let showNewStepModal = false;
  let newStepLabel = '';
  
  onMount(async () => {
    await fetchTestFlow();
    
    // Try to get API host from settings first if available
    if (flowJson?.settings?.api_host && flowJson.settings.api_host.trim() !== '') {
      console.log('Setting initial API host from settings:', flowJson.settings.api_host);
      apiHost = flowJson.settings.api_host;
      // TODO: each API will have their own Host, need new approach here.
    }
    
    // Then fetch the API host from the API (will use settings value if it exists)
    await fetchApiHost();
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
      
      // Initialize flowJson with proper defaults if not provided from backend
      flowJson = testFlow.flowJson || { 
        settings: { 
          api_host: ""
        }, 
        steps: [], 
        assertions: [],
        variables: []
      };
      
      // Make sure settings object has all required properties
      if (!flowJson.settings) {
        flowJson.settings = { api_host: "" };
      } else {
        // Ensure api_host is initialized
        if (!flowJson.settings.hasOwnProperty('api_host')) {
          flowJson.settings.api_host = "";
        } else if (flowJson.settings.api_host && flowJson.settings.api_host.trim() !== '') {
          // If we have an API host in settings, update our local variable
          apiHost = flowJson.settings.api_host;
          console.log('Setting apiHost from loaded flowJson:', apiHost);
        }
      }
      
      // Ensure variables array exists
      if (!flowJson.variables) {
        console.log('Initializing empty variables array');
        flowJson.variables = [];
      } else {
        console.log('Loaded flow variables:', flowJson.variables);
      }
      
      isDirty = false;
      
    } catch (err: any) {
      console.error('Error fetching test flow:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  }
  
  async function fetchApiHost() {
    if (!testFlow || !testFlow.apiId) return;
    
    try {
      const response = await fetch(`/api/apis/${testFlow.apiId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const apiData = await response.json();
        console.log('API data fetched:', apiData); // Debug log
        
        // Set the API host from the 'host' column in the apis table
        const hostFromApi = apiData.host || '';
        
        // Store the host in the flow settings if not already set or if empty
        if (hostFromApi && (!flowJson.settings.api_host || flowJson.settings.api_host === '')) {
          console.log(`Setting API host from API: ${hostFromApi}`); // Debug log
          flowJson.settings.api_host = hostFromApi;
          apiHost = hostFromApi;
        } else if (flowJson.settings.api_host && flowJson.settings.api_host.trim() !== '') {
          // If flow settings already has a non-empty host, prefer that one
          console.log(`Using API host from settings: ${flowJson.settings.api_host}`); // Debug log
          apiHost = flowJson.settings.api_host;
        } else if (hostFromApi) {
          // Last resort: if we have a host from the API but somehow didn't handle it above
          console.log(`Fallback to API host: ${hostFromApi}`); // Debug log
          apiHost = hostFromApi;
          flowJson.settings.api_host = hostFromApi;
        }
      }
    } catch (err) {
      console.error('Error fetching API host:', err);
    }
    
    console.log('Final apiHost value:', apiHost); // Debug log
  }
  
  // Reset execution state
  function handleReset() {
    console.log('FlowRunner reset event received');
    // Simply log the event, no need to propagate further
    // Execution state is managed by TestFlowEditor
  }
  
  // Handle execution completion
  function handleExecutionComplete(event: CustomEvent) {
    console.log('Flow execution complete:', event.detail);
    const { success, error: executionError, storedResponses } = event.detail;
    
    if (!success && executionError) {
      // Show error message to user
      error = executionError.message || 'An error occurred during flow execution';
    }
    
    // Store responses for potential reuse
    if (storedResponses) {
      console.log('Stored responses:', storedResponses);
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
  
  function addAssertion() {
    // TODO: will do it later
    flowJson.assertions = [];
    
    markDirty();
  }
  
  function removeAssertion(assertionIndex: number) {
    if (confirm('Are you sure you want to remove this assertion?')) {
      flowJson.assertions = flowJson.assertions.filter((_: any, i: number) => i !== assertionIndex);
      markDirty();
    }
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
            <div class="mb-6">
              <h2 class="text-xl font-semibold mb-4">Test Flow Steps</h2>
              
              {#if !apiHost || apiHost.trim() === ''}
                <div class="bg-yellow-100 border border-yellow-300 text-yellow-800 px-4 py-3 rounded mb-4">
                  <p class="font-medium">API Host is not configured</p>
                  <p>Please set the API host URL in the Settings tab before running the test flow.</p>
                </div>
              {/if}
              
              <!-- Use the TestFlowEditor component for a cleaner implementation -->
              <TestFlowEditor
                flowData={{...flowJson, endpoints}}
                {endpoints}
                apiHost={apiHost || ''}
                on:change={(event) => {
                  // Extract and update the flow data from the event
                  const updatedFlowData = event.detail;
                  if (updatedFlowData) {
                    // Update flowJson with the changes, preserving endpoints reference
                    const updatedSteps = updatedFlowData.steps || [];
                    
                    // Create a mapping from old step IDs to new ones
                    const stepIdMap = new Map();
                    
                    // Normalize step IDs to ensure they follow the format "step1", "step2", etc.
                    const normalizedSteps = updatedSteps.map((step: any, index: number) => {
                      // If the step ID uses the timestamp format (step-12345), convert it
                      if (step.step_id && step.step_id.startsWith('step-')) {
                        const oldId = step.step_id;
                        const newId = `step${index + 1}`;
                        stepIdMap.set(oldId, newId);
                        
                        return {
                          ...step,
                          step_id: newId
                        };
                      }
                      return step;
                    });
                    
                    // Update any assertions that reference the old step IDs
                    const updatedAssertions = (updatedFlowData.assertions || []).map((assertion: any) => {
                      if (assertion.step_id && stepIdMap.has(assertion.step_id)) {
                        return {
                          ...assertion,
                          step_id: stepIdMap.get(assertion.step_id)
                        };
                      }
                      return assertion;
                    });
                    
                    flowJson = {
                      settings: updatedFlowData.settings || flowJson.settings,
                      steps: normalizedSteps,
                      assertions: updatedAssertions.length > 0 ? updatedAssertions : (updatedFlowData.assertions || flowJson.assertions),
                      variables: updatedFlowData.variables || flowJson.variables || []
                    };
                  }
                  markDirty();
                }}
                on:reset={handleReset}
                on:executionComplete={handleExecutionComplete}
              />
              
              <!-- Empty state when there are no steps -->
              {#if flowJson.steps.length === 0}
                <div class="bg-gray-50 rounded-lg p-8 text-center mt-4">
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
              {/if}
            </div>
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
                          bind:value={assertion.target}
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
              <!-- API Host Setting -->
              <div class="mb-6">
                <label for="settings-api-host" class="block text-sm font-medium text-gray-700 mb-1">API Host URL</label>
                <div class="flex items-center">
                  <input 
                    id="settings-api-host"
                    type="text" 
                    bind:value={flowJson.settings.api_host}
                    on:input={() => {
                      apiHost = flowJson.settings.api_host;
                      markDirty();
                    }}
                    class="px-3 py-2 border border-gray-300 rounded-md flex-1"
                    placeholder="https://api.example.com"
                  />
                </div>
                <p class="text-sm text-gray-500 mt-1">
                  The base URL for API requests. Will be automatically populated from the API's host setting if available.
                </p>
              </div>
              
              <!-- Flow Variables -->
              <div class="mb-6 mt-8 border-t pt-6">
                <div class="flex justify-between items-center mb-4">
                  <h3 class="text-lg font-medium">Flow Variables</h3>
                  <button 
                    class="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 transition text-sm"
                    on:click={() => {
                      // Open variables panel in TestFlowEditor/FlowRunner
                      const testFlowEditor = document.querySelector('svelte-component[this="TestFlowEditor"]');
                      if (testFlowEditor) {
                        // Dispatch a custom event to show variables panel
                        testFlowEditor.dispatchEvent(new CustomEvent('showVariablesPanel'));
                      }
                    }}
                  >
                    Manage Variables
                  </button>
                </div>
                
                {#if !flowJson.variables || flowJson.variables.length === 0}
                  <div class="bg-gray-50 rounded-lg p-4 text-center">
                    <p class="text-gray-600">
                      No variables defined yet. Click "Manage Variables" to add some.
                    </p>
                  </div>
                {:else}
                  <div class="bg-gray-50 rounded-lg p-4">
                    <table class="w-full">
                      <thead>
                        <tr class="text-left">
                          <th class="pb-2 text-sm font-semibold text-gray-600">Name</th>
                          <th class="pb-2 text-sm font-semibold text-gray-600">Type</th>
                          <th class="pb-2 text-sm font-semibold text-gray-600">Required</th>
                          <th class="pb-2 text-sm font-semibold text-gray-600">Default</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each flowJson.variables as variable}
                          <tr class="border-t border-gray-200">
                            <td class="py-2 text-sm">{variable.name}</td>
                            <td class="py-2 text-sm">{variable.type}</td>
                            <td class="py-2 text-sm">{variable.required ? 'Yes' : 'No'}</td>
                            <td class="py-2 text-sm">{variable.defaultValue !== undefined ? String(variable.defaultValue) : '-'}</td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                {/if}
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
