<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Endpoint, StepEndpoint, ExecutionState } from './types';
  import { formatJson, getStatusColor, getEndpointDisplayId } from './utils';
  
  export let isOpen = false;
  // isMounted prop is passed from parent but not used in this component
  // Kept for API compatibility
  export let isMounted = false; 
  export let endpoint: Endpoint;
  export let stepEndpoint: StepEndpoint;
  // stepIndex is passed from parent but not directly used in this component
  // Kept for API compatibility and potential event handling
  export let stepIndex: number;
  export let endpointIndex: number;
  export let duplicateCount: number = 1;
  export let instanceIndex: number = 1;
  export let executionState: ExecutionState = {};
  
  const dispatch = createEventDispatcher();
  
  let activeTab: 'request' | 'response' | 'headers' = 'response';
  
  // Additional prop needed for the new endpointId format
  export let stepId: string;

  // Get the endpoint ID - using stepId-endpointIndex format now instead of endpointId-endpointIndex
  $: endpointId = `${stepId}-${endpointIndex}`;
  $: executionData = executionState[endpointId] || {};
  
  function closeResponseViewer() {
    dispatch('close');
  }
</script>

<div class="fixed inset-0 z-40 flex justify-end transition-opacity duration-200 ease-in-out {isOpen ? 'opacity-100' : 'opacity-0'}"
     on:keydown={(e) => e.key === 'Escape' && closeResponseViewer()}
     role="dialog" 
     aria-modal="true" 
     tabindex="-1">
  <!-- Transparent clickable overlay -->
  <div 
    class="absolute inset-y-0 left-0 right-0 sm:right-[75%] md:right-[600px] lg:right-[500px] bg-transparent transition-opacity duration-300 ease-in-out"
    on:click={closeResponseViewer}
    role="presentation"
    aria-hidden="true"
  ></div>
  
  <!-- The panel itself - responsive sizing -->
  <div class="fixed inset-y-0 right-0 w-full sm:w-[75%] md:w-[600px] lg:w-[500px] bg-white shadow-xl overflow-y-auto z-50 transition-transform duration-300 ease-in-out {!isOpen ? 'pointer-events-none' : ''}"
       style="transform: {isOpen ? 'translateX(0)' : 'translateX(100%)'};"
       aria-hidden={!isOpen}>
    
    <!-- Header -->
    <div class="bg-gray-100 px-4 py-3 flex justify-between items-center sticky top-0 z-10 border-b shadow-sm w-full">
      <div>
        <h3 class="font-medium flex items-center">
          <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded mr-2">
            {endpoint?.method}
          </span>
          <span class="font-mono text-sm">{endpoint?.path}</span>
          {#if duplicateCount > 1}
            <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded ml-2">
              Instance #{instanceIndex}
            </span>
          {/if}
          {#if executionData.response?.status}
            <span class="ml-2 text-xs font-medium px-1.5 py-0.5 rounded-full {getStatusColor(executionData.response.status || 0)} text-white">
              {executionData.response.status}
            </span>
          {/if}
        </h3>
      </div>
      <div>
        <button 
          class="text-gray-600 hover:text-gray-800 p-1 rounded-full hover:bg-gray-200 transition-colors"
          on:click={closeResponseViewer}
          aria-label="Close"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    </div>
    
    <!-- Tabs -->
    <div class="border-b px-4 bg-gray-50">
      <div class="flex -mb-px overflow-x-auto">
        <button 
          class="px-4 py-2 border-b-2 text-sm font-medium transition-colors {activeTab === 'request' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          on:click={() => activeTab = 'request'}
        >
          <div class="flex items-center">
            <span class="mr-1.5 text-blue-600">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
              </svg>
            </span>
            Request
          </div>
        </button>
        
        <button 
          class="px-4 py-2 border-b-2 text-sm font-medium transition-colors {activeTab === 'response' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          on:click={() => activeTab = 'response'}
        >
          <div class="flex items-center">
            <span class="mr-1.5 text-green-600">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </span>
            Response
          </div>
        </button>
        
        <button 
          class="px-4 py-2 border-b-2 text-sm font-medium transition-colors {activeTab === 'headers' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          on:click={() => activeTab = 'headers'}
        >
          <div class="flex items-center">
            <span class="mr-1.5 text-yellow-600">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            Headers
          </div>
        </button>
      </div>
    </div>
    
    <!-- Tab Content -->
    <div class="p-4">
      <!-- Request Tab -->
      {#if activeTab === 'request'}
        <div class="space-y-4">
          <h4 class="font-medium text-sm text-gray-700 mb-2">Request Details</h4>
          
          <!-- URL -->
          <div class="mb-4">
            <h5 class="text-xs font-medium text-gray-500 mb-1">URL:</h5>
            <div class="bg-gray-50 p-2 rounded border text-sm font-mono break-all">
              {executionData.request?.url || 'N/A'}
            </div>
          </div>
          
          <!-- Request Body -->
          {#if executionData.request?.body}
            <div class="mb-4">
              <h5 class="text-xs font-medium text-gray-500 mb-1">Body:</h5>
              <div class="bg-gray-50 p-2 rounded border overflow-auto max-h-80">
                <pre class="text-xs font-mono whitespace-pre-wrap">{formatJson(executionData.request.body)}</pre>
              </div>
            </div>
          {/if}
          
          <!-- Path Params -->
          {#if executionData.request?.pathParams && Object.keys(executionData.request.pathParams).length > 0}
            <div class="mb-4">
              <h5 class="text-xs font-medium text-gray-500 mb-1">Path Parameters:</h5>
              <div class="bg-gray-50 p-2 rounded border overflow-auto max-h-60">
                <pre class="text-xs font-mono whitespace-pre-wrap">{formatJson(executionData.request.pathParams)}</pre>
              </div>
            </div>
          {/if}
          
          <!-- Query Params -->
          {#if executionData.request?.queryParams && Object.keys(executionData.request.queryParams).length > 0}
            <div class="mb-4">
              <h5 class="text-xs font-medium text-gray-500 mb-1">Query Parameters:</h5>
              <div class="bg-gray-50 p-2 rounded border overflow-auto max-h-60">
                <pre class="text-xs font-mono whitespace-pre-wrap">{formatJson(executionData.request.queryParams)}</pre>
              </div>
            </div>
          {/if}
        </div>
      {/if}
      
      <!-- Response Tab -->
      {#if activeTab === 'response'}
        <div class="space-y-4">
          <h4 class="font-medium text-sm text-gray-700 mb-2">Response Details</h4>
          
          <!-- Status -->
          <div class="mb-4">
            <h5 class="text-xs font-medium text-gray-500 mb-1">Status:</h5>
            <div class="flex items-center">
              <span class="text-sm px-2 py-1 rounded font-medium {getStatusColor(executionData.response?.status || 0)} text-white">
                {executionData.response?.status || 'N/A'}
              </span>
              <span class="ml-2 text-sm">{executionData.response?.statusText || ''}</span>
            </div>
          </div>
          
          <!-- Timing -->
          {#if executionData.timing}
            <div class="mb-4">
              <h5 class="text-xs font-medium text-gray-500 mb-1">Timing:</h5>
              <div class="text-sm">
                {executionData.timing}ms
              </div>
            </div>
          {/if}
          
          <!-- Response Body -->
          {#if executionData.response?.body}
            <div>
              <h5 class="text-xs font-medium text-gray-500 mb-1">Body:</h5>
              <div class="bg-gray-50 p-2 rounded border overflow-auto max-h-96">
                <pre class="text-xs font-mono whitespace-pre-wrap">{formatJson(executionData.response.body)}</pre>
              </div>
            </div>
          {/if}
        </div>
      {/if}
      
      <!-- Headers Tab -->
      {#if activeTab === 'headers'}
        <div class="space-y-4">
          <div class="mb-4">
            <h4 class="font-medium text-sm text-gray-700 mb-2">Request Headers</h4>
            {#if executionData.request?.headers && Object.keys(executionData.request.headers).length > 0}
              <div class="bg-gray-50 rounded border">
                <table class="w-full text-sm">
                  <thead class="bg-gray-100 border-b">
                    <tr>
                      <th class="text-left py-2 px-3 text-xs font-medium text-gray-600">Name</th>
                      <th class="text-left py-2 px-3 text-xs font-medium text-gray-600">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each Object.entries(executionData.request.headers) as [name, value]}
                      <tr class="border-b border-gray-200 last:border-0">
                        <td class="py-2 px-3 font-medium">{name}</td>
                        <td class="py-2 px-3 font-mono text-xs break-all">{value}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {:else}
              <p class="text-sm text-gray-500">No request headers</p>
            {/if}
          </div>
          
          <div>
            <h4 class="font-medium text-sm text-gray-700 mb-2">Response Headers</h4>
            {#if executionData.response?.headers && Object.keys(executionData.response.headers).length > 0}
              <div class="bg-gray-50 rounded border">
                <table class="w-full text-sm">
                  <thead class="bg-gray-100 border-b">
                    <tr>
                      <th class="text-left py-2 px-3 text-xs font-medium text-gray-600">Name</th>
                      <th class="text-left py-2 px-3 text-xs font-medium text-gray-600">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each Object.entries(executionData.response.headers) as [name, value]}
                      <tr class="border-b border-gray-200 last:border-0">
                        <td class="py-2 px-3 font-medium">{name}</td>
                        <td class="py-2 px-3 font-mono text-xs break-all">{value}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {:else}
              <p class="text-sm text-gray-500">No response headers</p>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
