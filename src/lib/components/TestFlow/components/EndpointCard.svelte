<script lang="ts">
  import type { Endpoint, StepEndpoint, ExecutionState } from './types';
  import { getEndpointDisplayId, getStatusColor } from './utils';

  export let endpoint: Endpoint;
  export let stepEndpoint: StepEndpoint;
  export let endpointIndex: number;
  // stepIndex not directly used in this component, but needed for event handlers
  export let stepIndex: number;
  export let executionState: ExecutionState = {};
  export let duplicateCount: number = 1;
  export let instanceIndex: number = 1;

  // Emitted events will be handled by the parent component
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  
  // Additional prop for step ID
  export let stepId: string;

  // Generate a unique ID for this endpoint instance
  // Use the stepId-endpointIndex format that matches FlowRunner.svelte
  const endpointDisplayId = `${stepId}-${endpointIndex}`;

  // Create reactive derived values to ensure the component updates when executionState changes
  $: {
    // Log when executionState changes to help debug reactivity issues
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[EndpointCard] executionState updated for ${endpointDisplayId}`, executionState[endpointDisplayId]);
    }
  }
  
  $: currentExecutionState = executionState[endpointDisplayId] || {};
  $: executionStatus = currentExecutionState?.status;
  $: executionResponse = currentExecutionState?.response;
  $: executionTiming = currentExecutionState?.timing || null;

  // Check if an endpoint is currently running
  $: isRunning = executionStatus === 'running';
  
  // Check if an endpoint has completed execution
  $: isCompleted = executionStatus === 'completed';
  
  // Check if an endpoint has failed
  $: isFailed = executionStatus === 'failed';
  
  // Get the response status code for an endpoint
  $: statusCode = executionResponse?.status || null;
  
  // These helper functions simply return our reactive variables for legacy compatibility
  function isEndpointRunning(): boolean {
    // Use the reactive variable directly 
    return isRunning;
  }
  
  // Check if an endpoint has completed execution
  function isEndpointCompleted(): boolean {
    // Use the reactive variable directly
    return isCompleted;
  }
  
  // Check if an endpoint has failed
  function isEndpointFailed(): boolean {
    // Use the reactive variable directly
    return isFailed;
  }
  
  // Get the response status code for an endpoint
  function getEndpointStatusCode(): number | null {
    // Use the reactive variable directly
    return statusCode;
  }
  
  // Get execution time for an endpoint in ms
  function getExecutionTime(): number | null {
    // Use the reactive variable directly
    return executionTiming;
  }

  // Get a stylized class for the response status
  function getResponseStatusClass(): string {
    const status = getEndpointStatusCode();
    if (!status) return '';
    
    if (status >= 200 && status < 300) return 'bg-green-100 border-green-300';
    if (status >= 400 && status < 500) return 'bg-yellow-100 border-yellow-300';
    if (status >= 500) return 'bg-red-100 border-red-300';
    return 'bg-gray-100 border-gray-300';
  }

  function openParamEditor() {
    dispatch('openParamEditor', { endpointIndex });
  }

  function openResponseViewer() {
    dispatch('openResponseViewer', { endpointIndex });
  }

  function removeEndpoint() {
    dispatch('removeEndpoint', { endpointIndex });
  }
</script>

<div class="bg-gray-50 rounded-md p-3 min-w-[280px] max-w-[300px] flex-shrink-0 relative border {isRunning ? 'border-blue-400 shadow-md shadow-blue-100' : 'border-gray-200'} {isCompleted ? 'border-green-500' : ''} {isFailed ? 'border-red-500' : ''} {getResponseStatusClass()}">
  <div class="flex justify-between items-start mb-2">
    <div class="flex items-center">
      <span class="bg-green-100 text-green-800 text-xs px-1.5 py-0.5 rounded mr-1.5 uppercase font-medium">
        {endpoint.method}
      </span>
      {#if duplicateCount > 1}
        <span class="bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5 rounded ml-1 font-medium">
          #{instanceIndex}
        </span>
      {/if}
      
      {#if getEndpointStatusCode()}
        <span class="ml-1 px-1.5 py-0.5 text-xs rounded-full {getStatusColor(getEndpointStatusCode() || 0)} text-white">
          {getEndpointStatusCode()}
        </span>
      {/if}
    </div>
    <button
      class="text-red-500 hover:text-red-700"
      on:click={removeEndpoint}
      aria-label="Remove endpoint"
    >
      <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
      </svg>
    </button>
  </div>
  
  <!-- Enhanced Execution Status Indicator -->
  {#if isRunning}
    <div class="absolute top-0 right-0 mt-1 mr-1">
      <div class="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
    </div>
    <!-- Visual indicator for the entire card when running -->
    <div class="absolute inset-0 bg-blue-50 opacity-20 rounded-md animate-pulse pointer-events-none"></div>
  {:else if isCompleted || isFailed}
    <div class="absolute top-0 right-0 mt-1 mr-1 rounded-full p-0.5 {isCompleted ? 'bg-green-100' : 'bg-red-100'}">
      {#if isCompleted}
        <svg class="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
        </svg>
      {:else}
        <svg class="h-4 w-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
        </svg>
      {/if}
    </div>
  {/if}
  
  <div class="mb-2">
    <div class="font-mono text-xs text-gray-700 break-all">
      {endpoint.path}
    </div>
  </div>
  
  <!-- Parameter configuration summary -->
  <div class="mt-3">
    <div class="flex gap-2 mt-2">
      <button 
        class="text-xs flex-1 px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 transition-colors flex items-center justify-center"
        on:click={openParamEditor}
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        Edit Request
      </button>
      
      <!-- Response Viewer Button -->
      <button 
        class="text-xs flex-1 px-2 py-1 {executionResponse ? 'bg-green-50 hover:bg-green-100 text-green-700 border-green-200' : 'bg-gray-50 hover:bg-gray-100 text-gray-500 border-gray-200'} rounded border transition-colors flex items-center justify-center"
        on:click={openResponseViewer}
        disabled={!executionResponse}
        title={executionResponse ? 'View complete request and response details' : 'Run endpoint to view response'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Response
      </button>
    </div>
    
    <!-- Execution time and status if available -->
    <div class="mt-1 flex flex-wrap gap-1 text-xs">
      {#if getExecutionTime()}
        <span class="inline-flex items-center text-gray-500">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {getExecutionTime()}ms
        </span>
      {/if}
      
      {#if isRunning}
        <span class="inline-flex items-center text-blue-500">
          <svg class="animate-spin h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Executing...
        </span>
      {:else if isCompleted}
        <span class="inline-flex items-center text-green-500">
          <svg class="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
          </svg>
          Completed
        </span>
      {:else if isFailed}
        <span class="inline-flex items-center text-red-500">
          <svg class="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
          </svg>
          Failed
        </span>
      {/if}
    </div>
    
    <!-- Parameter summary -->
    {#if endpoint.parameters && endpoint.parameters.length > 0}
      <div class="mt-2 flex flex-wrap gap-1">
        {#each endpoint.parameters.filter(p => p.in === 'path') as param}
          {#if stepEndpoint.pathParams && stepEndpoint.pathParams[param.name]}
            <span class="bg-purple-100 text-purple-800 text-xs px-1 py-0.5 rounded" title="{param.name}: {stepEndpoint.pathParams[param.name]}">
              {param.name}
            </span>
          {/if}
        {/each}
        {#each endpoint.parameters.filter(p => p.in === 'query') as param}
          {#if stepEndpoint.queryParams && stepEndpoint.queryParams[param.name]}
            <span class="bg-blue-100 text-blue-800 text-xs px-1 py-0.5 rounded" title="{param.name}: {stepEndpoint.queryParams[param.name]}">
              {param.name}
            </span>
          {/if}
        {/each}
      </div>
    {/if}
    
    <!-- Body indicator -->
    {#if endpoint.requestSchema && stepEndpoint.body && Object.keys(stepEndpoint.body).length > 0}
      <div class="mt-1">
        <span class="bg-green-100 text-green-800 text-xs px-1 py-0.5 rounded inline-flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          Body
        </span>
      </div>
    {/if}
    
    <!-- Headers indicator -->
    {#if stepEndpoint.headers && stepEndpoint.headers.filter(h => h.enabled).length > 0}
      <div class="mt-1">
        <span class="bg-yellow-100 text-yellow-800 text-xs px-1 py-0.5 rounded inline-flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {stepEndpoint.headers.filter(h => h.enabled).length} Headers
        </span>
      </div>
    {/if}
  </div>
</div>
