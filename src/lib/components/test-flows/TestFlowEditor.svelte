<script lang="ts">
  import StepEditor from './StepEditor.svelte';
  import SmartEndpointSelector from './SmartEndpointSelector.svelte';
  import FlowRunner from './FlowRunner.svelte';
  import { fade } from 'svelte/transition';
  import type { TestFlowData, Endpoint, ExecutionState, EndpointExecutionState, Parameter } from './types';
  import { getEndpointById, type EndpointDetails } from '$lib/http_client/endpoints';

  import { writable } from 'svelte/store';
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';

  // flowData includes settings.api_hosts which contains multiple API host configurations
  export let flowData: TestFlowData;
  export let endpoints: Endpoint[] = [];

  let isRunning = false;
  let flowRunner: FlowRunner;
  let isLoadingEndpointDetails = false; // Add loading state for endpoint fetching

  // Create a store to track execution state changes - we'll use this directly
  // instead of maintaining a separate executionState variable
  const executionStore = writable<ExecutionState>({});

  // Execution options panel
  let showExecutionOptions = false;

  // parameters panel control
  let showParametersPanel = false;

  // Execution preferences - default values
  let preferences = {
    parallelExecution: true,
    stopOnError: true,
    serverCookieHandling: false,
    retryCount: 0,
    timeout: 30000
  };

  // Function to handle endpoint selection for a specific step
  async function handleEndpointSelected(event: CustomEvent<Endpoint>, stepIndex: number) {
    const selectedEndpoint = event.detail;

    // Set loading state
    isLoadingEndpointDetails = true;

    try {
      // Fetch detailed endpoint information from the API
      console.log(`Fetching details for endpoint ${selectedEndpoint.id}...`);
      const endpointDetails = await getEndpointById(selectedEndpoint.id);
      console.log('Endpoint details fetched successfully:', endpointDetails);
      
      // Add endpoint to the step with the fetched details
      flowData.steps[stepIndex].endpoints.push({
        endpoint_id: selectedEndpoint.id,
        api_id: selectedEndpoint.apiId, // Include API ID for multi-API support
        pathParams: {},
        queryParams: {}
      });

      // Store the detailed endpoint information in the flowData.endpoints array
      // This ensures the endpoint details are available for other components
      if (!flowData.endpoints) {
        flowData.endpoints = [];
      }
      
      // Check if endpoint already exists in the array to avoid duplicates
      const existingEndpointIndex = flowData.endpoints.findIndex(ep => ep.id === selectedEndpoint.id);
      if (existingEndpointIndex === -1) {
        // Convert the API response (EndpointDetails) to match our Endpoint type
        const endpointData: Endpoint = {
          id: endpointDetails.id,
          apiId: endpointDetails.apiId,
          path: endpointDetails.path,
          method: endpointDetails.method,
          operationId: endpointDetails.operationId,
          summary: endpointDetails.summary,
          description: endpointDetails.description,
          tags: endpointDetails.tags,
          // Include the detailed schema and parameter information
          requestSchema: endpointDetails.requestSchema,
          responseSchema: endpointDetails.responseSchema,
          parameters: endpointDetails.parameters as Parameter[] | undefined
        };
        flowData.endpoints.push(endpointData);
        console.log('Full endpoint details stored in flowData.endpoints:', {
          id: endpointData.id,
          path: endpointData.path,
          method: endpointData.method,
          hasRequestSchema: !!endpointData.requestSchema,
          hasResponseSchema: !!endpointData.responseSchema,
          hasParameters: !!endpointData.parameters
        });
      } else {
        console.log('Endpoint already exists in flowData.endpoints, skipping duplicate');
      }

      // Trigger change event to save
      handleChange();
    } catch (error) {
      console.error('Failed to fetch endpoint details:', error);
      // Still add the endpoint to the step with basic information
      // This ensures the UI doesn't break if the API call fails
      flowData.steps[stepIndex].endpoints.push({
        endpoint_id: selectedEndpoint.id,
        api_id: selectedEndpoint.apiId,
        pathParams: {},
        queryParams: {}
      });
      
      // Trigger change event to save even with partial data
      handleChange();
      
      // You could add a toast notification here to inform the user
      // For now, we'll just log the error and continue
      console.warn('Continuing with basic endpoint information due to API error');
    } finally {
      // Clear loading state
      isLoadingEndpointDetails = false;
    }
  }

  const dispatch = createEventDispatcher();

  // Create event handlers for external triggers
  function handleshowParametersPanel() {
    showParametersPanel = true;
  }

  // Add event listener on mount
  onMount(() => {
    // Listen for custom events on the component's node
    const node = document.querySelector('svelte-component[this="TestFlowEditor"]');
    if (node) {
      node.addEventListener('showParametersPanel', handleshowParametersPanel as EventListener);

      return () => {
        node.removeEventListener('showParametersPanel', handleshowParametersPanel as EventListener);
      };
    }
  });

  function handleChange(event?: CustomEvent<{ flowData: TestFlowData }>) {
    // If event has flowData in detail, use it
    if (event && event.detail && event.detail.flowData) {
      flowData = { ...event.detail.flowData };
    } else {
      // Otherwise update the local variable
      flowData = { ...flowData };
    }

    // Dispatch an event to notify the parent component
    dispatch('change', flowData);
  }

  // Handle removing a step from the flow
  function handleRemoveStep(event: CustomEvent) {
    const { stepIndex } = event.detail;
    flowData.steps.splice(stepIndex, 1);
    handleChange();
  }

  // Handle removing an endpoint from a step
  function handleRemoveEndpoint(event: CustomEvent) {
    const { stepIndex, endpointIndex } = event.detail;
    flowData.steps[stepIndex].endpoints.splice(endpointIndex, 1);
    handleChange();
  }

  // Handle moving a step up or down
  function handleMoveStep(event: CustomEvent) {
    const { stepIndex, direction } = event.detail;

    if (direction === 'up' && stepIndex > 0) {
      const temp = flowData.steps[stepIndex - 1];
      flowData.steps[stepIndex - 1] = flowData.steps[stepIndex];
      flowData.steps[stepIndex] = temp;
    } else if (direction === 'down' && stepIndex < flowData.steps.length - 1) {
      const temp = flowData.steps[stepIndex + 1];
      flowData.steps[stepIndex + 1] = flowData.steps[stepIndex];
      flowData.steps[stepIndex] = temp;
    }

    handleChange();
  }

  // Add a new step to the flow
  function addNewStep() {
    // Use consistent step ID format matching the parent component
    // This step_id is important as it's used to create the endpointId (${stepId}-${endpointIndex})
    // which is used for referencing responses in templates
    const newStepId = `step${flowData.steps.length + 1}`;

    flowData.steps.push({
      step_id: newStepId,
      label: `Step ${flowData.steps.length + 1}`,
      endpoints: []
    });

    handleChange();
  }

  // Handle execution state reset
  function handleReset() {
    // Reset the execution state store
    executionStore.set({});
    isRunning = false;

    // Dispatch reset event to parent
    dispatch('reset');
  }

  // Handle execution completion
  function handleExecutionComplete(event: CustomEvent) {
    console.log('Execution completed:', event.detail);
    isRunning = false;
    // Force an update of all components that depend on the execution state
    // This maintains the updated endpoint ID format (stepId-endpointIndex)
    executionStore.update((state) => ({ ...state }));

    // Dispatch event to parent
    dispatch('executionComplete', event.detail);
  }

  // Handle execution state update from FlowRunner
  function handleExecutionStateUpdate(event: CustomEvent) {
    // Update the execution state with the new state from FlowRunner
    // The execution state now uses stepId-endpointIndex as keys instead of endpoint_id-endpointIndex
    // Update the store to trigger reactivity across all components
    executionStore.set(event.detail);
  }

  function handleLog(event: CustomEvent) {
    dispatch('log', event.detail);
  }

  // Run the entire flow
  function runFlow() {
    // Check for API hosts before running
    if (!hasValidApiHosts()) {
      dispatch('error', { message: 'Please configure at least one API host before running the flow.' });
      return;
    }

    // Check for steps
    if (flowData.steps.length === 0) {
      dispatch('error', { message: 'Please add at least one step to the flow before running.' });
      return;
    }

    if (flowRunner) {
      // Reset the execution state before starting a new run
      executionStore.set({});

      flowRunner.runFlow().catch((err: unknown) => {
        console.error('Error running flow:', err);
        isRunning = false;
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred while running the flow.';
        dispatch('error', { message: errorMessage });
      });
    }
  }

  // Execute a single step from the UI
  function executeStep(event: CustomEvent) {
    const { stepIndex } = event.detail;
    const step = flowData.steps[stepIndex];

    if (flowRunner && step) {
      // We're not resetting the execution state so that previous results remain visible
      isRunning = true;

      flowRunner.executeSingleStep(step, stepIndex).catch((err: unknown) => {
        console.error(`Error executing step ${step.step_id}:`, err);
        isRunning = false;
      });
    }
  }

  // Stop the flow execution
  function handleStop() {
    if (flowRunner) {
      flowRunner.stopExecution();
      isRunning = false;
    }
  }

  // Check if there are valid API hosts configured
  function hasValidApiHosts(): boolean {
    // Check if we have api_hosts structure with at least one valid host
    if (flowData.settings.api_hosts && Object.keys(flowData.settings.api_hosts).length > 0) {
      // Check if at least one API host has a valid URL
      return Object.values(flowData.settings.api_hosts).some(
        (hostInfo) => hostInfo && hostInfo.url && hostInfo.url.trim() !== ''
      );
    }
    
    return false;
  }

  // No longer needed - we use progress and currentStep directly from executionStore
  // This function was previously calculating progress and current step
  // but those values are already available in the executionStore
  
  // No need for manual subscription anymore as we're using the $ syntax directly
</script>

<div class="space-y-4">
  <!-- Top Control Bar with Run Button -->
  <div class="rounded-lg border bg-white p-4 shadow-sm">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center">
        <h3 class="text-lg font-medium">Test Flow Execution</h3>
      </div>

      <div class="flex items-center space-x-3">
        <!-- Run Options Button -->
        <button
          class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          on:click={() => (showExecutionOptions = !showExecutionOptions)}
          disabled={isRunning}
        >
          <svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
            />
          </svg>
          Options
        </button>

        <!-- Reset Button -->
        <button
          class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          on:click={() => {
            if (flowRunner) {
              flowRunner.handleReset(); // Use handleReset in FlowRunner directly
            } else {
              handleReset(); // Fallback to local reset
            }
          }}
          disabled={isRunning || Object.keys($executionStore).length === 0}
        >
          <svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Reset
        </button>

        <!-- parameters Button -->
        <button
          class="mr-2 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          on:click={() => {
            // Toggle parameters panel using the local state
            showParametersPanel = !showParametersPanel;
          }}
          disabled={isRunning}
        >
          <svg class="mr-1.5 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
              clip-rule="evenodd"
            />
          </svg>
          Parameters
        </button>

        <!-- Run Flow Button -->
        <button
          class="inline-flex items-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm {isRunning
            ? 'bg-red-600 hover:bg-red-700'
            : !hasValidApiHosts() || flowData.steps.length === 0
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700'}"
          on:click={isRunning ? handleStop : runFlow}
          disabled={isRunning || !hasValidApiHosts() || flowData.steps.length === 0}
        >
          {#if isRunning}
            <svg
              class="mr-2 -ml-1 h-4 w-4 animate-spin text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Stop
          {:else if !hasValidApiHosts()}
            <svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            Configure API Hosts
          {:else if flowData.steps.length === 0}
            <svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Add Steps First
          {:else}
            <svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Run Flow
          {/if}
        </button>
      </div>
    </div>

    <!-- Progress Bar (only visible when running) -->
    {#if isRunning}
      <div class="mt-4">
        <div class="h-2 w-full rounded-full bg-gray-200">
          <div
            class="h-2 rounded-full bg-blue-600"
            style="width: {$executionStore.progress || 0}%"
          ></div>
        </div>
        <div class="mt-1 text-right text-xs text-gray-500">
          Step {$executionStore.currentStep !== undefined ? $executionStore.currentStep + 1 : 1} of {flowData.steps.length}
        </div>
      </div>
    {/if}
  </div>

  <!-- Execution Options Panel (Sliding) -->
  {#if showExecutionOptions}
    <div class="rounded-lg border bg-white p-4 shadow-sm" transition:fade={{ duration: 150 }}>
      <h4 class="mb-3 text-sm font-medium text-gray-700">Execution Options</h4>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div class="space-y-2">
          <div class="flex items-center">
            <input
              type="checkbox"
              id="parallelExecution"
              class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              bind:checked={preferences.parallelExecution}
            />
            <label for="parallelExecution" class="ml-2 block text-sm text-gray-700"
              >Parallel Execution</label
            >
          </div>

          <div class="flex items-center">
            <input
              type="checkbox"
              id="stopOnError"
              class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              bind:checked={preferences.stopOnError}
            />
            <label for="stopOnError" class="ml-2 block text-sm text-gray-700">Stop On Error</label>
          </div>

          <div class="flex items-center">
            <input
              type="checkbox"
              id="serverCookieHandling"
              class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              bind:checked={preferences.serverCookieHandling}
            />
            <label for="serverCookieHandling" class="ml-2 block text-sm text-gray-700"
              >Handle Cookies</label
            >
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <label for="retryCount" class="block text-sm font-medium text-gray-700"
              >Retry Count</label
            >
            <input
              type="number"
              id="retryCount"
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              min="0"
              max="5"
              bind:value={preferences.retryCount}
            />
          </div>

          <div>
            <label for="timeout" class="block text-sm font-medium text-gray-700">Timeout (ms)</label
            >
            <input
              type="number"
              id="timeout"
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              min="1000"
              max="60000"
              step="1000"
              bind:value={preferences.timeout}
            />
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Hidden Flow Runner Component (bind to access its methods) -->
  <div>
    <FlowRunner
      bind:this={flowRunner}
      {flowData}
      bind:isRunning
      executionState={$executionStore}
      bind:preferences
      bind:showParametersPanel
      showButtons={false}
      on:reset={handleReset}
      on:change={(event: CustomEvent<{ flowData: TestFlowData }>) => {
        console.log('Change event from FlowRunner:', event.detail);
        if (event.detail && event.detail.flowData) {
          // Handle case when parameters are updated
          if (event.detail.flowData.parameters) {
            console.log('parameters updated in FlowRunner:', event.detail.flowData.parameters);
          }

          flowData = { ...event.detail.flowData };
          handleChange();
        }
      }}
      on:executionComplete={handleExecutionComplete}
      on:executionStateUpdate={handleExecutionStateUpdate}
      on:log={handleLog}
      on:endpointStateUpdate={(
        event: CustomEvent<{ endpointId: string; state: EndpointExecutionState }>
      ) => {
        const { endpointId, state } = event.detail;
        // Force the store to update for better reactivity
        // endpointId is now using the format `${stepId}-${endpointIndex}` for better user reference
        executionStore.update((store) => {
          return { ...store, [endpointId]: state };
        });
      }}
    />
  </div>

  <!-- Existing Steps -->
  {#if flowData && flowData.steps && flowData.steps.length > 0}
    {#each flowData.steps as step, stepIndex (step.step_id)}
            <div class="mb-4">
        <StepEditor
          {step}
          {endpoints}
          apiHosts={flowData?.settings?.api_hosts || {}}
          {stepIndex}
          isFirstStep={stepIndex === 0}
          isLastStep={stepIndex === flowData.steps.length - 1}
          {isRunning}
          executionStore={$executionStore}
          on:removeStep={handleRemoveStep}
          on:removeEndpoint={handleRemoveEndpoint}
          on:moveStep={handleMoveStep}
          on:change={handleChange}
          on:runStep={executeStep}
        >
          <div slot="endpoint-selector">
            <SmartEndpointSelector
              apiHosts={flowData?.settings?.api_hosts || {}}
              on:select={(e) => handleEndpointSelected(e, stepIndex)}
              disabled={isRunning || isLoadingEndpointDetails}
            />
            {#if isLoadingEndpointDetails}
              <div class="mt-2 flex items-center text-sm text-blue-600">
                <svg class="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading endpoint details...
              </div>
            {/if}
          </div>
        </StepEditor>
      </div>
    {/each}
  {:else}
    <div class="mb-4 rounded-lg border border-yellow-100 bg-yellow-50 p-4 text-center">
      <p class="text-yellow-700">No steps in this flow yet. Add a step to get started.</p>
    </div>
  {/if}

  <!-- Add Step Button -->
  <div class="mt-6">
    <button
      class="flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
      on:click={addNewStep}
      disabled={isRunning}
    >
      <svg class="mr-2 h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
        />
      </svg>
      Add New Step
    </button>
  </div>
</div>
