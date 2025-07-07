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
  
  // Generate a unique ID for this endpoint instance
  const endpointDisplayId = getEndpointDisplayId(stepEndpoint.endpoint_id, endpointIndex);

  // Check if an endpoint is currently running
  function isEndpointRunning(): boolean {
    return executionState[endpointDisplayId]?.status === 'running';
  }
  
  // Check if an endpoint has completed execution
  function isEndpointCompleted(): boolean {
    return executionState[endpointDisplayId]?.status === 'completed';
  }
  
  // Check if an endpoint has failed
  function isEndpointFailed(): boolean {
    return executionState[endpointDisplayId]?.status === 'failed';
  }
  
  // Get the response status code for an endpoint
  function getEndpointStatusCode(): number | null {
    return executionState[endpointDisplayId]?.response?.status || null;
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

<div class="bg-gray-50 rounded-md p-3 min-w-[280px] max-w-[300px] flex-shrink-0 relative {isEndpointRunning() ? 'border-2 border-blue-400 animate-pulse' : ''} {isEndpointCompleted() ? 'border border-green-500' : ''} {isEndpointFailed() ? 'border border-red-500' : ''}">
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
  
  <!-- Execution Status Indicator -->
  {#if isEndpointRunning()}
    <div class="absolute top-0 right-0 mt-1 mr-1">
      <div class="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
    </div>
  {:else if isEndpointCompleted() || isEndpointFailed()}
    <div class="absolute top-0 right-0 mt-1 mr-1">
      {#if isEndpointCompleted()}
        <span class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-green-100">
          <svg class="h-3 w-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
          </svg>
        </span>
      {:else}
        <span class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-100">
          <svg class="h-3 w-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
          </svg>
        </span>
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
      
      <!-- Response Viewer Button (only visible when response exists) -->
      {#if executionState[endpointDisplayId]?.response}
        <button 
          class="text-xs flex-1 px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded border border-green-200 transition-colors flex items-center justify-center"
          on:click={openResponseViewer}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          View Response
          {#if getEndpointStatusCode()}
            <span class="ml-1 px-1 py-0.5 text-xs rounded-full {getStatusColor(getEndpointStatusCode() || 0)} text-white">
              {getEndpointStatusCode()}
            </span>
          {/if}
        </button>
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
