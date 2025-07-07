<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Endpoint, StepEndpoint, ExecutionState } from './components/types';
  import { getEndpointDisplayId } from './components/utils';
  import { EndpointCard, ParameterEditor, ResponseViewer } from './components';
  
  export let step: any;
  export let endpoints: Endpoint[] = [];
  export let stepIndex: number;
  export let isFirstStep: boolean = false;
  export let isLastStep: boolean = false;
  export let isRunning: boolean = false; // Flag from parent to indicate if test flow execution is in progress
  export let executionState: ExecutionState = {}; // Tracks execution status for each endpoint
  
  // Emitted events will be handled by the parent component
  const dispatch = createEventDispatcher();
  
  // Parameter editor state
  let isParamEditorOpen = false;
  let isParamEditorMounted = false;
  let activeEndpointIndex: number | null = null;
  
  // Response viewer state
  let isResponseViewerOpen = false;
  let isResponseViewerMounted = false;
  let activeResponseEndpointIndex: number | null = null;
  
  // Helper to find an endpoint by ID
  function findEndpoint(id: string | number): Endpoint | undefined {
    return endpoints.find(e => e.id === id);
  }
  
  function removeEndpoint(endpointIndex: number) {
    dispatch('removeEndpoint', { stepIndex, endpointIndex });
  }
  
  function moveStepUp() {
    dispatch('moveStep', { stepIndex, direction: 'up' });
  }
  
  function moveStepDown() {
    dispatch('moveStep', { stepIndex, direction: 'down' });
  }

  // Open parameter editor panel for a specific endpoint
  function openParamEditor(event: CustomEvent<{endpointIndex: number}>) {
    const { endpointIndex } = event.detail;
    activeEndpointIndex = endpointIndex;
    
    // First set the panel as mounted but with transform to the right
    isParamEditorMounted = true;
    isParamEditorOpen = false;
    
    // Add a class to the body to prevent scrolling while modal is open
    document.body.classList.add('overflow-hidden');
    
    // Use requestAnimationFrame to ensure the DOM is updated before applying the animation
    requestAnimationFrame(() => {
      // Then in the next frame, trigger the animation by setting open to true
      isParamEditorOpen = true;
    });
  }
  
  // Close parameter editor panel
  function closeParamEditor() {
    isParamEditorOpen = false;
    
    // Add a small delay to allow for animation to complete before unmounting
    setTimeout(() => {
      isParamEditorMounted = false;
      activeEndpointIndex = null;
      
      // Remove the class from body to re-enable scrolling
      document.body.classList.remove('overflow-hidden');
    }, 300);
  }
  
  // Handle parameter changes
  function handleParamChange() {
    dispatch('change');
  }
  
  // Open response viewer panel for a specific endpoint
  function openResponseViewer(event: CustomEvent<{endpointIndex: number}>) {
    const { endpointIndex } = event.detail;
    activeResponseEndpointIndex = endpointIndex;
    
    // First set the panel as mounted but with transform to the right
    isResponseViewerMounted = true;
    isResponseViewerOpen = false;
    
    // Add a class to the body to prevent scrolling while modal is open
    document.body.classList.add('overflow-hidden');
    
    // Use requestAnimationFrame to ensure the DOM is updated before applying the animation
    requestAnimationFrame(() => {
      // Then in the next frame, trigger the animation by setting open to true
      isResponseViewerOpen = true;
    });
  }
  
  // Close response viewer panel
  function closeResponseViewer() {
    isResponseViewerOpen = false;
    
    // Add a small delay to allow for animation to complete before unmounting
    setTimeout(() => {
      isResponseViewerMounted = false;
      activeResponseEndpointIndex = null;
      
      // Remove the class from body to re-enable scrolling
      document.body.classList.remove('overflow-hidden');
    }, 300);
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
    <div class="flex justify-between items-center mb-2">
      <h4 class="text-sm font-medium text-gray-500">Endpoints:</h4>
      <div class="relative group">
        <button class="text-gray-400 hover:text-gray-600 focus:outline-none" aria-label="Information about adding endpoints">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        <div class="absolute right-0 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg transform translate-y-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
          You can add the same endpoint multiple times to test different scenarios or parameter combinations.
        </div>
      </div>
    </div>
    
    {#if step.endpoints.length === 0}
      <p class="text-gray-400 italic text-sm">No endpoints in this step yet</p>
    {:else}
      <div class="flex flex-row gap-3 overflow-x-auto pb-2">
        {#each step.endpoints as stepEndpoint, endpointIndex}
          {@const endpoint = findEndpoint(stepEndpoint.endpoint_id)}
          {@const duplicateCount = step.endpoints.filter((e: StepEndpoint) => e.endpoint_id === stepEndpoint.endpoint_id).length}
          {@const instanceIndex = step.endpoints.slice(0, endpointIndex + 1).filter((e: StepEndpoint) => e.endpoint_id === stepEndpoint.endpoint_id).length}
          {#if endpoint}
            <EndpointCard 
              {endpoint}
              stepEndpoint={stepEndpoint}
              {endpointIndex}
              {stepIndex}
              {executionState}
              {duplicateCount}
              {instanceIndex}
              on:openParamEditor={openParamEditor}
              on:openResponseViewer={openResponseViewer}
              on:removeEndpoint={() => removeEndpoint(endpointIndex)}
            />
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

<!-- Parameter Editor Slide-out Panel -->
{#if isParamEditorMounted && activeEndpointIndex !== null}
  {@const safeIndex = activeEndpointIndex!}
  {@const activeEndpoint = findEndpoint(step.endpoints[safeIndex].endpoint_id)}
  {@const duplicateCount = step.endpoints.filter((e: StepEndpoint) => e.endpoint_id === step.endpoints[safeIndex].endpoint_id).length}
  {@const instanceIndex = step.endpoints.slice(0, safeIndex + 1).filter((e: StepEndpoint) => e.endpoint_id === step.endpoints[safeIndex].endpoint_id).length}
  
  {#if activeEndpoint}
    <ParameterEditor 
      isOpen={isParamEditorOpen}
      isMounted={true}
      endpoint={activeEndpoint}
      stepEndpoint={step.endpoints[safeIndex]}
      {stepIndex}
      endpointIndex={safeIndex}
      {duplicateCount}
      {instanceIndex}
      on:close={closeParamEditor}
      on:change={handleParamChange}
    />
  {/if}
{/if}

<!-- Response Viewer Slide-out Panel -->
{#if isResponseViewerMounted && activeResponseEndpointIndex !== null}
  {@const safeIndex = activeResponseEndpointIndex!}
  {@const activeEndpoint = findEndpoint(step.endpoints[safeIndex].endpoint_id)}
  {@const duplicateCount = step.endpoints.filter((e: StepEndpoint) => e.endpoint_id === step.endpoints[safeIndex].endpoint_id).length}
  {@const instanceIndex = step.endpoints.slice(0, safeIndex + 1).filter((e: StepEndpoint) => e.endpoint_id === step.endpoints[safeIndex].endpoint_id).length}
  
  {#if activeEndpoint}
    <ResponseViewer 
      isOpen={isResponseViewerOpen}
      isMounted={true}
      endpoint={activeEndpoint}
      stepEndpoint={step.endpoints[safeIndex]}
      {stepIndex}
      endpointIndex={safeIndex}
      {duplicateCount}
      {instanceIndex}
      {executionState}
      on:close={closeResponseViewer}
    />
  {/if}
{/if}
