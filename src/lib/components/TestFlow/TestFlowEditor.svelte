<script lang="ts">
  import StepEditor from './StepEditor.svelte';
  import EndpointSelector from './EndpointSelector.svelte';
  import FlowRunner from './FlowRunner.svelte';
  import { fade } from 'svelte/transition';
  
  export let flowData: any;
  export let endpoints: any[] = [];
  export let apiHost: string = '';
  
  let isRunning = false;
  let executionState: Record<string, any> = {};
  let flowRunner: FlowRunner;
  
  // Execution options panel
  let showExecutionOptions = false;
  
  // Execution preferences - default values
  let preferences = {
    parallelExecution: true,
    stopOnError: true,
    serverCookieHandling: false,
    retryCount: 0,
    timeout: 30000
  };
  
  // Function to handle endpoint selection for a specific step
  function handleEndpointSelected(event: CustomEvent, stepIndex: number) {
    const selectedEndpoint = event.detail;
    
    // Add endpoint to the step
    flowData.steps[stepIndex].endpoints.push({
      endpoint_id: selectedEndpoint.id,
      store_response_as: '',
      pathParams: {},
      queryParams: {},
    });
    
    // Trigger change event to save
    handleChange();
  }
  
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  function handleChange() {
    // Update the local variable 
    flowData = { ...flowData };
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
    // Directly reset the state instead of calling flowRunner.resetExecution() to avoid infinite recursion
    executionState = {};
    isRunning = false;
  }
  
  // Handle execution completion
  function handleExecutionComplete(event: CustomEvent) {
    console.log('Execution completed:', event.detail);
    // Additional handling could be done here
  }
  
  // Run the entire flow
  function runFlow() {
    if (flowRunner) {
      flowRunner.runFlow().catch(err => {
        console.error('Error running flow:', err);
      });
    }
  }
  
  // Stop the flow execution
  function handleStop() {
    if (flowRunner) {
      flowRunner.stopExecution();
    }
    isRunning = false;
  }
</script>

<div class="space-y-4">
  <!-- Top Control Bar with Run Button -->
  <div class="bg-white border rounded-lg shadow-sm p-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center">
        <h3 class="text-lg font-medium">Test Flow Execution</h3>
      </div>
      
      <div class="flex items-center space-x-3">
        <!-- Run Options Button -->
        <button
          class="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          on:click={() => showExecutionOptions = !showExecutionOptions}
          disabled={isRunning}
        >
          <svg class="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          Options
        </button>
        
        <!-- Reset Button -->
        <button
          class="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          on:click={() => {
            if (flowRunner) {
              flowRunner.handleReset();  // Use handleReset in FlowRunner directly
            } else {
              handleReset(); // Fallback to local reset
            }
          }}
          disabled={isRunning || Object.keys(executionState).length === 0}
        >
          <svg class="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reset
        </button>
        
        <!-- Run Flow Button -->
        <button
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white {isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}"
          on:click={isRunning ? handleStop : runFlow}
          disabled={!apiHost || flowData.steps.length === 0}
        >
          {#if isRunning}
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Stop
          {:else}
            <svg class="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Run Flow
          {/if}
        </button>
      </div>
    </div>
    
    <!-- Progress Bar (only visible when running) -->
    {#if isRunning}
      <div class="mt-4">
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div class="bg-blue-600 h-2 rounded-full" style="width: {flowRunner?.progress || 0}%"></div>
        </div>
        <div class="mt-1 text-xs text-gray-500 text-right">
          Step {flowRunner?.currentStep !== undefined ? flowRunner.currentStep + 1 : 0} of {flowData.steps.length}
        </div>
      </div>
    {/if}
  </div>

  <!-- Execution Options Panel (Sliding) -->
  {#if showExecutionOptions}
    <div class="bg-white border rounded-lg shadow-sm p-4" transition:fade={{ duration: 150 }}>
      <h4 class="text-sm font-medium text-gray-700 mb-3">Execution Options</h4>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="space-y-2">
          <div class="flex items-center">
            <input 
              type="checkbox" 
              id="parallelExecution" 
              class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              bind:checked={preferences.parallelExecution}
            />
            <label for="parallelExecution" class="ml-2 block text-sm text-gray-700">Parallel Execution</label>
          </div>
          
          <div class="flex items-center">
            <input 
              type="checkbox" 
              id="stopOnError" 
              class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              bind:checked={preferences.stopOnError}
            />
            <label for="stopOnError" class="ml-2 block text-sm text-gray-700">Stop On Error</label>
          </div>
          
          <div class="flex items-center">
            <input 
              type="checkbox" 
              id="serverCookieHandling" 
              class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              bind:checked={preferences.serverCookieHandling}
            />
            <label for="serverCookieHandling" class="ml-2 block text-sm text-gray-700">Handle Cookies</label>
          </div>
        </div>
        
        <div class="space-y-4">
          <div>
            <label for="retryCount" class="block text-sm font-medium text-gray-700">Retry Count</label>
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
            <label for="timeout" class="block text-sm font-medium text-gray-700">Timeout (ms)</label>
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
  <div class="hidden">
    <FlowRunner 
      bind:this={flowRunner}
      {flowData}
      {apiHost}
      bind:isRunning
      bind:executionState
      bind:preferences
      on:reset={handleReset}
      on:executionComplete={handleExecutionComplete}
    />
  </div>
  
  <!-- Existing Steps -->
  {#if flowData && flowData.steps && flowData.steps.length > 0}
    {#each flowData.steps as step, stepIndex}
      <div class="mb-4">
        <StepEditor 
          {step}
          {endpoints}
          {stepIndex}
          isFirstStep={stepIndex === 0}
          isLastStep={stepIndex === flowData.steps.length - 1}
          {isRunning}
          {executionState}
          on:removeStep={handleRemoveStep}
          on:removeEndpoint={handleRemoveEndpoint}
          on:moveStep={handleMoveStep}
          on:change={handleChange}
        >
          <div slot="endpoint-selector">
            <EndpointSelector 
              {endpoints} 
              on:select={(e) => handleEndpointSelected(e, stepIndex)} 
              disabled={isRunning}
            />
          </div>
        </StepEditor>
      </div>
    {/each}
  {:else}
    <div class="bg-yellow-50 border border-yellow-100 rounded-lg p-4 mb-4 text-center">
      <p class="text-yellow-700">No steps in this flow yet. Add a step to get started.</p>
    </div>
  {/if}
  
  <!-- Add Step Button -->
  <div class="mt-6">
    <button 
      class="flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      on:click={addNewStep}
      disabled={isRunning}
    >
      <svg class="h-5 w-5 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
      Add New Step
    </button>
  </div>
</div>
