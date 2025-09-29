<script lang="ts">
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import type { TestFlowData } from '$lib/components/test-flows/types';
  import { getTestFlow, saveTestFlow as saveTestFlowFn } from '$lib/http_client/test-flow';
  import { getApiList, getApiDetails } from '$lib/http_client/apis';
  import { setBreadcrumbOverride, clearBreadcrumbOverride } from '$lib/store/breadcrumb';

  // Import the components we created
  import TestFlowEditor from '$lib/components/test-flows/TestFlowEditor.svelte';
  import EnvironmentLinkingManager from '$lib/components/environments/EnvironmentLinkingManager.svelte';
  import { getProjectEnvironment } from '$lib/http_client/projects';
  import { projectStore } from '$lib/store/project';
  import type { Environment } from '$lib/types/environment';

  let testFlowId = $derived(parseInt($page.params.id || '0'));

  let testFlow: any = $state(null);
  let endpoints: any[] = $state([]);
  let selectedEndpoint: any = $state(null);
  let loading = $state(true);
  let error: string | null = $state(null);
  let currentTab: 'steps' | 'settings' = $state('steps');
  let flowJson: TestFlowData = $state({
    settings: { 
      api_hosts: {}  // Multi-API host configuration
    },
    steps: [],
    parameters: [],
    outputs: []
  });
  let isDirty = $state(false);
  let isSaving = $state(false);

  // New step related state
  let showNewStepModal = $state(false);
  let newStepLabel = $state('');

  // Available APIs for dropdown
  let availableApis: any[] = $state([]);
  let showAddApiModal = $state(false);

  // Environment for linking (single environment per project)
  let environment: Environment | null = $state(null);

  // Load projects on mount if not already loaded
  onMount(async () => {
    await fetchTestFlow();

    // Initialize api_hosts if not existing
    if (!flowJson.settings.api_hosts) {
      flowJson.settings.api_hosts = {};
    }

    // Initialize linkedEnvironment if not existing (single environment per project)
    if (!flowJson.settings.linkedEnvironment) {
      flowJson.settings.linkedEnvironment = null;
    }

    // Load available APIs for the dropdown
    await loadAvailableApis();

    // Load project environment for linking
    await loadEnvironment();
  });

  // Update document title and breadcrumb when testFlow is loaded
  $effect(() => {
    if (testFlow?.name && typeof document !== 'undefined') {
      document.title = `${testFlow.name} - Test Pilot`;
      setBreadcrumbOverride(testFlowId.toString(), testFlow.name);
    }
  });

  // Clean up breadcrumb override when component is destroyed
  onDestroy(() => {
    clearBreadcrumbOverride(testFlowId.toString());
  });

  async function fetchTestFlow() {
    try {
      loading = true;
      error = null;

      const data = await getTestFlow(testFlowId.toString());
      if (!data) {
        throw new Error(`Failed to fetch test flow`);
      }
      
      testFlow = data.testFlow;
      endpoints = testFlow.endpoints || [];

      // Initialize flowJson with proper defaults if not provided from backend
      flowJson = testFlow.flowJson || {
        settings: {
          api_hosts: {}
        },
        steps: [],
        parameters: [],
        outputs: []
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
        flowJson.parameters = [];
      }

      // Ensure outputs array exists
      if (!flowJson.outputs) {
        flowJson.outputs = [];
      }

      isDirty = false;
    } catch (err: any) {
      console.error('Error fetching test flow:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function loadAvailableApis() {
    try {
      // Get selected project from store
      const selectedProject = $projectStore.selectedProject;
      if (!selectedProject) {
        console.warn('No project selected, cannot load APIs');
        availableApis = [];
        return;
      }

      const apisData = await getApiList(selectedProject.id);
      if (apisData && apisData.apis && Array.isArray(apisData.apis)) {
        availableApis = apisData.apis;
        console.log('Available APIs loaded for project:', selectedProject.id, availableApis);
      }
    } catch (err) {
      console.error('Error loading available APIs:', err);
    }
  }

  async function loadEnvironment() {
    try {
      // Get selected project from store
      const selectedProject = $projectStore.selectedProject;
      if (!selectedProject) {
        console.warn('No project selected, cannot load environment');
        return;
      }

      const response = await getProjectEnvironment(selectedProject.id);
      // Convert ProjectEnvironmentLink.environment to Environment type
      if (response.environment?.environment) {
        const envData = response.environment.environment;
        environment = {
          id: envData.id,
          name: envData.name,
          description: envData.description,
          config: envData.config,
          userId: 0, // Not needed for display purposes
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      } else {
        environment = null;
      }
      console.log('Environment loaded:', environment);
    } catch (err) {
      console.error('Error loading environment:', err);
      environment = null;
    }
  }
  
  function addApiFromList(api: any) {
    if (!flowJson.settings.api_hosts) {
      flowJson.settings.api_hosts = {};
    }
    
    const apiId = String(api.id);
    
    // Check if this API is already added
    if (flowJson.settings.api_hosts[apiId]) {
      error = 'This API is already added to the flow';
      return;
    }
    
    // Add the API host
    flowJson.settings.api_hosts[apiId] = {
      name: api.name || `API ${api.id}`,
      url: api.host || ''
    };
    
    showAddApiModal = false;
    markDirty();
  }

  function addCustomApiHost() {
    if (!flowJson.settings.api_hosts) {
      flowJson.settings.api_hosts = {};
    }
    
    const newApiId = `api-${Date.now()}`;
    flowJson.settings.api_hosts[newApiId] = {
      name: `API ${Object.keys(flowJson.settings.api_hosts).length + 1}`,
      url: ''
    };
    
    showAddApiModal = false;
    markDirty();
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

      // Validate required fields
      if (!testFlow.name || !testFlow.name.trim()) {
        error = 'Flow name is required';
        return;
      }

      await saveTestFlowFn(testFlowId, {
        name: testFlow.name.trim(),
        description: testFlow.description?.trim() || null,
        flowJson
      });
      
      isDirty = false;
    } catch (err: any) {
      console.error('Error updating test flow:', err);
      error = err.message;
    } finally {
      isSaving = false;
    }
  }

  function handleTestFlowChange(event: CustomEvent) {
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

      // Ensure parameters are properly updated - prioritize updatedFlowData.parameters
      const updatedParameters = updatedFlowData.parameters || flowJson.parameters || [];

      flowJson = {
        settings: updatedFlowData.settings || flowJson.settings,
        steps: normalizedSteps,
        parameters: updatedParameters,
        outputs: updatedFlowData.outputs || flowJson.outputs || []
      };
    }
    markDirty();
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

<div class="container mx-auto px-4 py-4">
  {#if error}
    <div class="relative mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
      <span class="block sm:inline">{error}</span>
      <button class="absolute top-0 right-0 bottom-0 px-4" onclick={() => (error = null)}>
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
          <nav class="flex flex-wrap justify-between items-center">
            <div class="flex">
              <button
                class="border-b-2 px-6 py-3 text-sm font-medium text-gray-700
                      {currentTab === 'steps'
                  ? 'border-blue-500 text-blue-500'
                  : 'border-transparent hover:border-gray-300'}"
                onclick={() => (currentTab = 'steps')}
              >
                Steps
              </button>
              <button
                class="border-b-2 px-6 py-3 text-sm font-medium text-gray-700
                      {currentTab === 'settings'
                  ? 'border-blue-500 text-blue-500'
                  : 'border-transparent hover:border-gray-300'}"
                onclick={() => (currentTab = 'settings')}
              >
                Settings
              </button>
            </div>
            
            {#if testFlow}
              <div class="px-6 py-3">
                <button
                  class="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white shadow-md transition-all hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSaving || !testFlow.name?.trim()}
                  onclick={saveTestFlow}
                  title={isSaving ? 'Saving changes...' : (!testFlow.name?.trim() ? 'Flow name is required' : 'Save changes to test flow')}
                >
                  {#if isSaving}
                    <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span class="font-medium">Saving...</span>
                  {:else}
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12"></path>
                    </svg>
                    <span class="font-medium">Save Changes</span>
                  {/if}
                </button>
              </div>
            {/if}
          </nav>
        </div>

        <div class="p-6">
          <!-- Steps Tab -->
          {#if currentTab === 'steps'}
            <div class="mb-6">
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
                {environment}
                selectedSubEnvironment={flowJson.settings.environment?.subEnvironment || null}
                on:change={handleTestFlowChange}
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
                    onclick={() => (showNewStepModal = true)}
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

            <div class="space-y-8">
              <!-- Flow Information and API Hosts in one row -->
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <!-- Flow Information -->
                <div>
                  <h3 class="text-lg font-medium text-gray-800 mb-4">Flow Information</h3>
                  <div class="space-y-4">
                    <!-- Flow Name -->
                    <div>
                      <label for="flowName" class="block text-sm font-medium text-gray-700 mb-2">
                        Name <span class="text-red-500">*</span>
                      </label>
                      <input
                        id="flowName"
                        type="text"
                        bind:value={testFlow.name}
                        oninput={markDirty}
                        class="w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none
                               {(!testFlow.name || !testFlow.name.trim()) ? 'border-red-300 bg-red-50' : 'border-gray-300'}"
                        placeholder="Enter flow name"
                        required
                      />
                      {#if !testFlow.name || !testFlow.name.trim()}
                        <p class="mt-1 text-sm text-red-600">Flow name is required</p>
                      {/if}
                    </div>
                    
                    <!-- Flow Description -->
                    <div>
                      <label for="flowDescription" class="block text-sm font-medium text-gray-700 mb-2">
                        Description
                      </label>
                      <textarea
                        id="flowDescription"
                        bind:value={testFlow.description}
                        oninput={markDirty}
                        rows="3"
                        class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none resize-y"
                        placeholder="Enter a description for this test flow"
                      ></textarea>
                    </div>
                  </div>
                </div>

                <!-- API Hosts Settings -->
                <div>
                  <div class="flex items-center justify-between mb-3">
                    <h3 class="text-lg font-medium text-gray-800">API Hosts</h3>
                    <button
                      class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 flex items-center"
                      onclick={() => showAddApiModal = true}
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
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">API Name</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Host URL</th>
                            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Actions</th>
                          </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                          {#each Object.entries(flowJson.settings.api_hosts || {}) as [apiId, apiInfo], index}
                            <tr class={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td class="px-4 py-3 whitespace-nowrap">
                                <div class="flex items-center space-x-2">
                                  <input
                                    type="text"
                                    bind:value={apiInfo.name}
                                    oninput={markDirty}
                                    class="rounded border border-gray-300 px-3 py-1.5 text-sm flex-1"
                                    placeholder="API Name"
                                  />
                                  <span class="text-xs text-gray-500 whitespace-nowrap">ID: {apiId}</span>
                                </div>
                              </td>
                              <td class="px-4 py-3 whitespace-nowrap">
                                <input
                                  type="text"
                                  bind:value={apiInfo.url}
                                  oninput={markDirty}
                                  class="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                                  placeholder="https://api.example.com"
                                />
                              </td>
                              <td class="px-4 py-3 whitespace-nowrap text-right">
                                <button
                                  class="inline-flex items-center justify-center p-1.5 rounded-full text-red-600 hover:text-white hover:bg-red-600 transition-colors"
                                  onclick={() => {
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
                  {:else}
                    <div class="flex flex-col items-center justify-center bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                      <svg class="h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path>
                      </svg>
                      <p class="mb-4 text-gray-600">No API hosts configured yet</p>
                      <button
                        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center text-sm"
                        onclick={() => showAddApiModal = true}
                      >
                        <svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                        </svg>
                        Add Your First API Host
                      </button>
                    </div>
                  {/if}
                </div>
              </div>

              <!-- Environment Links Settings -->
              <div class="mb-6">
                <EnvironmentLinkingManager
                  {environment}
                  linkedEnvironment={flowJson.settings.linkedEnvironment || null}
                  flowParameters={flowJson.parameters || []}
                  disabled={isSaving}
                  on:change={(event) => {
                    const { linkedEnvironment } = event.detail;
                    flowJson.settings.linkedEnvironment = linkedEnvironment;
                    markDirty();
                  }}
                />
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
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-2xl border border-gray-200">
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
          onclick={() => {
            showNewStepModal = false;
            error = null;
          }}
        >
          Cancel
        </button>
        <button
          class="rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:opacity-50"
          onclick={addStep}
          disabled={!newStepLabel.trim()}
        >
          Add Step
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Modal for adding API host -->
{#if showAddApiModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl border border-gray-200">
      <h2 class="mb-4 text-xl font-bold">Add API Host</h2>

      {#if availableApis.length > 0}
        <div class="mb-6">
          <h3 class="mb-3 text-lg font-medium">Choose from Available APIs</h3>
          <div class="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
            {#each availableApis as api}
              {@const isAlreadyAdded = !!(flowJson.settings.api_hosts && flowJson.settings.api_hosts[String(api.id)])}
              <div class="border-b border-gray-100 last:border-b-0">
                <div class="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div class="flex-1">
                    <h4 class="font-medium text-gray-900">{api.name || `API ${api.id}`}</h4>
                    <p class="text-sm text-gray-500 mt-1">{api.host || 'No host configured'}</p>
                    <p class="text-xs text-gray-400 mt-1">ID: {api.id}</p>
                  </div>
                  <button
                    class="ml-4 rounded-md px-3 py-1.5 text-sm transition
                           {isAlreadyAdded 
                             ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                             : 'bg-blue-600 text-white hover:bg-blue-700'}"
                    disabled={isAlreadyAdded}
                    onclick={() => addApiFromList(api)}
                  >
                    {isAlreadyAdded ? 'Already Added' : 'Add'}
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <div class="border-t pt-4">
          <h3 class="mb-3 text-lg font-medium">Or Create Custom API Host</h3>
          <button
            class="w-full rounded-md bg-gray-100 border-2 border-dashed border-gray-300 px-4 py-3 text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition"
            onclick={addCustomApiHost}
          >
            <svg class="mx-auto h-6 w-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            Create Custom API Host
          </button>
        </div>
      {:else}
        <div class="mb-6 text-center">
          <p class="text-gray-600 mb-4">No APIs found in your workspace.</p>
          <button
            class="w-full rounded-md bg-blue-600 px-4 py-3 text-white hover:bg-blue-700 transition"
            onclick={addCustomApiHost}
          >
            <svg class="mx-auto h-6 w-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            Create Custom API Host
          </button>
        </div>
      {/if}

      <div class="flex justify-end">
        <button
          class="rounded-md bg-gray-200 px-4 py-2 text-gray-800 transition hover:bg-gray-300"
          onclick={() => {
            showAddApiModal = false;
            error = null;
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}
