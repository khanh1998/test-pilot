<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import type { TestFlowData } from '$lib/components/test-flows/types';

  // Import the components we created
  import TestFlowEditor from '$lib/components/test-flows/TestFlowEditor.svelte';

  $: testFlowId = parseInt($page.params.id || '0');

  let testFlow: any = null;
  let endpoints: any[] = [];
  let selectedEndpoint: any = null;
  let loading = true;
  let error: string | null = null;
  let currentTab: 'steps' | 'settings' = 'steps';
  let flowJson: TestFlowData = {
    settings: { 
      api_hosts: {}  // Multi-API host configuration
    },
    steps: [],
    parameters: []
  };
  let isDirty = false;
  let isSaving = false;

  // New step related state
  let showNewStepModal = false;
  let newStepLabel = '';

  onMount(async () => {
    await fetchTestFlow();

    // Initialize api_hosts if not existing
    if (!flowJson.settings.api_hosts) {
      flowJson.settings.api_hosts = {};
    }

    // Initialize API hosts from API information
    await fetchApiHosts();
  });

  async function fetchTestFlow() {
    try {
      loading = true;
      error = null;

      const response = await fetch(`/api/test-flows/${testFlowId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`
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
          api_hosts: {}
        },
        steps: [],
        parameters: []
      };

      // Make sure settings object has all required properties
      if (!flowJson.settings) {
        flowJson.settings = { api_hosts: {} };
      } else {
        // Ensure api_hosts is initialized
        if (!flowJson.settings.hasOwnProperty('api_hosts')) {
          flowJson.settings.api_hosts = {};
        }
      }

      // Ensure parameters array exists
      if (!flowJson.parameters) {
        console.log('Initializing empty parameters array');
        flowJson.parameters = [];
      } else {
        console.log('Loaded Flow Parameters:', flowJson.parameters);
      }

      isDirty = false;
    } catch (err: any) {
      console.error('Error fetching test flow:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function fetchApiHosts() {
    try {
      // First, ensure we have a valid settings.api_hosts object
      if (!flowJson.settings.api_hosts) {
        flowJson.settings.api_hosts = {};
      }
      
      // Get all APIs related to this test flow
      const response = await fetch(`/api/apis`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (response.ok) {
        const apisData = await response.json();
        console.log('APIs data fetched:', apisData); // Debug log
        
        if (apisData && apisData.apis && Array.isArray(apisData.apis)) {
          // For each API found, add it to the api_hosts if not already there
          apisData.apis.forEach((api: {id: number, host?: string, name?: string}) => {
            const apiIdStr = String(api.id);
            
            // If this API isn't in our hosts yet, add it
            if (api.host && flowJson.settings.api_hosts && !flowJson.settings.api_hosts[apiIdStr]) {
              flowJson.settings.api_hosts[apiIdStr] = {
                name: api.name || `API ${api.id}`,
                url: api.host
              };
              console.log(`Added API host from API ${api.id}:`, api.host);
              markDirty();
            }
          });
        }
        
        // If we have a primary API in the testFlow, make sure it's in our hosts
        if (testFlow && testFlow.apiId) {
          const primaryApiId = String(testFlow.apiId);
          
          // If we don't have the primary API in our hosts, fetch it specifically
          if (!flowJson.settings.api_hosts[primaryApiId]) {
            await fetchPrimaryApiHost();
          }
        }
      }
    } catch (err) {
      console.error('Error fetching API hosts:', err);
    }
  }
  
  // Fetch the primary API host for this test flow
  async function fetchPrimaryApiHost() {
    if (!testFlow || !testFlow.apiId) return;

    try {
      const response = await fetch(`/api/apis/${testFlow.apiId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (response.ok) {
        const apiData = await response.json();
        console.log('Primary API data fetched:', apiData);

        // Get the host from the API data
        const hostFromApi = apiData.host || '';
        const apiId = String(apiData.id);

        if (hostFromApi) {
          // Make sure we have an api_hosts object
          if (!flowJson.settings.api_hosts) {
            flowJson.settings.api_hosts = {};
          }
          
          // Add the primary API to our hosts
          flowJson.settings.api_hosts[apiId] = {
            name: apiData.name || `API ${apiData.id}`,
            url: hostFromApi
          };
          console.log(`Added primary API host: ${hostFromApi}`);
          
          markDirty();
        }
      }
    } catch (err) {
      console.error('Error fetching primary API host:', err);
    }
  }

  // Reset execution state
  function handleReset() {
    console.log('FlowRunner reset event received');
    // Simply log the event, no need to propagate further
    // Execution state is managed by TestFlowEditor
  }

  // Handle execution completion
  function handleLog(event: CustomEvent) {
    const { level, message, details } = event.detail;
    console.log(`[LOG] ${level.toUpperCase()}: ${message}`, details || '');
    if (level === 'error') {
      error = message;
    }
  }

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
          Authorization: `Bearer ${localStorage.getItem('authToken')}`
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
</script>

<div class="container mx-auto px-4 py-8">
  <div class="mb-6 flex items-center justify-between">
    <div>
      <a
        href="/dashboard/test-flows"
        class="inline-flex items-center text-blue-600 hover:underline"
      >
        <svg class="mr-1 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fill-rule="evenodd"
            d="M7.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l2.293 2.293a1 1 0 010 1.414z"
            clip-rule="evenodd"
          ></path>
        </svg>
        Back to Test Flows
      </a>
      <h1 class="mt-2 text-3xl font-bold">
        {#if testFlow}
          {testFlow.name}
        {:else}
          Test Flow Editor
        {/if}
      </h1>
    </div>

    <button
      class="rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:opacity-50"
      disabled={!isDirty || isSaving}
      on:click={saveTestFlow}
    >
      {isSaving ? 'Saving...' : 'Save Changes'}
    </button>
  </div>

  {#if error}
    <div class="relative mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
      <span class="block sm:inline">{error}</span>
      <button class="absolute top-0 right-0 bottom-0 px-4" on:click={() => (error = null)}>
        ×
      </button>
    </div>
  {/if}

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
    </div>
  {:else if testFlow}
    <div class="mb-6">
      <div class="rounded-lg bg-white shadow">
        <div class="border-b border-gray-200">
          <nav class="flex flex-wrap">
            <button
              class="border-b-2 px-6 py-3 text-sm font-medium text-gray-700
                    {currentTab === 'steps'
                ? 'border-blue-500 text-blue-500'
                : 'border-transparent hover:border-gray-300'}"
              on:click={() => (currentTab = 'steps')}
            >
              Steps
            </button>
            <button
              class="border-b-2 px-6 py-3 text-sm font-medium text-gray-700
                    {currentTab === 'settings'
                ? 'border-blue-500 text-blue-500'
                : 'border-transparent hover:border-gray-300'}"
              on:click={() => (currentTab = 'settings')}
            >
              Settings
            </button>
          </nav>
        </div>

        <div class="p-6">
          <!-- Steps Tab -->
          {#if currentTab === 'steps'}
            <div class="mb-6">
              <h2 class="mb-4 text-xl font-semibold">Test Flow Steps</h2>

              {#if !flowJson.settings.api_hosts || Object.keys(flowJson.settings.api_hosts).length === 0}
                <div
                  class="mb-4 rounded border border-yellow-300 bg-yellow-100 px-4 py-3 text-yellow-800"
                >
                  <p class="font-medium">API Hosts Not Configured</p>
                  <p>
                    Please configure at least one API host in the Settings tab before running the test flow.
                  </p>
                </div>
              {/if}

              <!-- Use the TestFlowEditor component for a cleaner implementation -->
              <TestFlowEditor
                flowData={{ ...flowJson, endpoints }}
                {endpoints}
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

                    flowJson = {
                      settings: updatedFlowData.settings || flowJson.settings,
                      steps: normalizedSteps,
                      parameters: updatedFlowData.parameters || flowJson.parameters || []
                    };
                  }
                  markDirty();
                }}
                on:reset={handleReset}
                on:executionComplete={handleExecutionComplete}
                on:log={handleLog}
              />

              <!-- Empty state when there are no steps -->
              {#if flowJson.steps.length === 0}
                <div class="mt-4 rounded-lg bg-gray-50 p-8 text-center">
                  <h3 class="mb-2 text-xl font-semibold">No Steps Yet</h3>
                  <p class="mb-6 text-gray-600">Add steps to define your test flow sequence.</p>
                  <button
                    class="rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
                    on:click={() => (showNewStepModal = true)}
                  >
                    Add First Step
                  </button>
                </div>
              {/if}
            </div>
          {/if}

          <!-- Settings Tab -->
          {#if currentTab === 'settings'}
            <div class="mb-6">
              <h2 class="text-xl font-semibold">Test Flow Settings</h2>
            </div>

            <div class="max-w-lg">
              <!-- API Hosts Settings -->
              <div class="mb-6">
                <div class="flex items-center justify-between mb-3">
                  <h3 class="text-lg font-medium text-gray-800">API Hosts</h3>
                  <button
                    class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 flex items-center"
                    on:click={() => {
                      // Initialize api_hosts if not existing
                      if (!flowJson.settings.api_hosts) {
                        flowJson.settings.api_hosts = {};
                      }
                      
                      // Generate a unique ID for the new API host
                      const newApiId = `api-${Date.now()}`;
                      
                      // Add the new API host
                      flowJson.settings.api_hosts[newApiId] = {
                        name: `API ${Object.keys(flowJson.settings.api_hosts).length + 1}`,
                        url: ''
                      };
                      
                      markDirty();
                    }}
                  >
                    <svg class="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                    </svg>
                    Add API Host
                  </button>
                </div>
                
                <p class="mb-4 text-sm text-gray-600">
                  Configure the hosts for each API used in this test flow. Each endpoint in your flow will use its corresponding API host.
                </p>
                
                <!-- API Hosts List -->
                {#if flowJson.settings.api_hosts && Object.keys(flowJson.settings.api_hosts).length > 0}
                  <div class="rounded-lg border border-gray-200 overflow-hidden">
                    <table class="min-w-full divide-y divide-gray-200">
                      <thead class="bg-gray-50">
                        <tr>
                          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">API Name</th>
                          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Host URL</th>
                          <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Actions</th>
                        </tr>
                      </thead>
                      <tbody class="bg-white divide-y divide-gray-200">
                        {#each Object.entries(flowJson.settings.api_hosts || {}) as [apiId, apiInfo], index}
                          <tr class={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td class="px-4 py-3 whitespace-nowrap">
                              <div class="flex items-center">
                                <input
                                  type="text"
                                  bind:value={apiInfo.name}
                                  on:input={markDirty}
                                  class="rounded border border-gray-300 px-3 py-1.5 text-sm w-full"
                                  placeholder="API Name"
                                />
                              </div>
                              <div class="text-xs text-gray-500 mt-1">ID: {apiId}</div>
                            </td>
                            <td class="px-4 py-3 whitespace-nowrap">
                              <input
                                type="text"
                                bind:value={apiInfo.url}
                                on:input={markDirty}
                                class="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                                placeholder="https://api.example.com"
                              />
                            </td>
                            <td class="px-4 py-3 whitespace-nowrap text-right">
                              <button
                                class="inline-flex items-center justify-center p-1.5 rounded-full text-red-600 hover:text-white hover:bg-red-600 transition-colors"
                                on:click={() => {
                                  if (flowJson.settings.api_hosts) {
                                    delete flowJson.settings.api_hosts[apiId];
                                    flowJson.settings.api_hosts = {...flowJson.settings.api_hosts};
                                    markDirty();
                                  }
                                }}
                                aria-label="Delete API host"
                                title="Delete this API host"
                              >
                                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                              </button>
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                  <div class="mt-2 text-xs text-gray-500 flex items-center">
                    <svg class="h-4 w-4 mr-1 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    API hosts can be referenced in test steps by their ID
                  </div>
                {:else}
                  <div class="flex flex-col items-center justify-center bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                    <svg class="h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path>
                    </svg>
                    <p class="mb-4 text-gray-600">No API hosts configured yet</p>
                    <button
                      class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center text-sm"
                      on:click={() => {
                        if (!flowJson.settings.api_hosts) {
                          flowJson.settings.api_hosts = {};
                        }
                        const newApiId = `api-${Date.now()}`;
                        flowJson.settings.api_hosts[newApiId] = {
                          name: "Primary API",
                          url: ''
                        };
                        markDirty();
                      }}
                    >
                      <svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                      </svg>
                      Add Your First API Host
                    </button>
                  </div>
                {/if}
              </div>

              <!-- Flow Parameters -->
              <div class="mt-8 mb-6 border-t pt-6">
                <div class="mb-4 flex items-center justify-between">
                  <h3 class="text-lg font-medium">Flow Parameters</h3>
                  <button
                    class="rounded-md bg-blue-600 px-3 py-1 text-sm text-white transition hover:bg-blue-700"
                    on:click={() => {
                      // Open parameters panel in TestFlowEditor/FlowRunner
                      const testFlowEditor = document.querySelector(
                        'svelte-component[this="TestFlowEditor"]'
                      );
                      if (testFlowEditor) {
                        // Dispatch a custom event to show parameters panel
                        testFlowEditor.dispatchEvent(new CustomEvent('showParametersPanel'));
                      }
                    }}
                  >
                    Manage parameters
                  </button>
                </div>

                {#if !flowJson.parameters || flowJson.parameters.length === 0}
                  <div class="rounded-lg bg-gray-50 p-4 text-center">
                    <p class="text-gray-600">
                      No parameters defined yet. Click "Manage parameters" to add some.
                    </p>
                  </div>
                {:else}
                  <div class="rounded-lg bg-gray-50 p-4">
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
                        {#each flowJson.parameters as parameter}
                          <tr class="border-t border-gray-200">
                            <td class="py-2 text-sm">{parameter.name}</td>
                            <td class="py-2 text-sm">{parameter.type}</td>
                            <td class="py-2 text-sm">{parameter.required ? 'Yes' : 'No'}</td>
                            <td class="py-2 text-sm"
                              >{parameter.defaultValue !== undefined
                                ? String(parameter.defaultValue)
                                : '-'}</td
                            >
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
  <div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
    <div class="mx-4 w-full max-w-md rounded-lg bg-white p-6">
      <h2 class="mb-4 text-xl font-bold">Add New Step</h2>

      <div class="mb-4">
        <label for="stepLabel" class="mb-1 block text-sm font-medium text-gray-700"
          >Step Label</label
        >
        <input
          id="stepLabel"
          type="text"
          bind:value={newStepLabel}
          class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          placeholder="Enter a descriptive label for this step"
        />
      </div>

      <div class="flex justify-end">
        <button
          class="mr-2 rounded-md bg-gray-200 px-4 py-2 text-gray-800 transition hover:bg-gray-300"
          on:click={() => {
            showNewStepModal = false;
            error = null;
          }}
        >
          Cancel
        </button>
        <button
          class="rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:opacity-50"
          on:click={addStep}
          disabled={!newStepLabel.trim()}
        >
          Add Step
        </button>
      </div>
    </div>
  </div>
{/if}
