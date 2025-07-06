<script lang="ts">
  import StepEditor from './StepEditor.svelte';
  import EndpointSelector from './EndpointSelector.svelte';
  import FlowRunner from './FlowRunner.svelte';
  
  export let flowData: any;
  export let endpoints: any[] = [];
  export let apiHost: string = '';
  
  let isRunning = false;
  let executionState: Record<string, any> = {};
  
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
  
  function handleChange() {
    // Could emit an event to save the flow data
    // In this case we just update the local variable
    flowData = { ...flowData };
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
    // Generate a unique ID based on timestamp
    const newStepId = `step-${Date.now()}`;
    
    flowData.steps.push({
      step_id: newStepId,
      label: `Step ${flowData.steps.length + 1}`,
      endpoints: []
    });
    
    handleChange();
  }
  
  // Handle execution state reset
  function handleReset() {
    executionState = {};
  }
  
  // Handle execution completion
  function handleExecutionComplete(event: CustomEvent) {
    console.log('Execution completed:', event.detail);
    // Additional handling could be done here
  }
</script>

<div>
  <!-- Flow Runner Component -->
  <FlowRunner 
    {flowData}
    {apiHost}
    bind:isRunning
    bind:executionState
    on:reset={handleReset}
    on:executionComplete={handleExecutionComplete}
  />
  
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
