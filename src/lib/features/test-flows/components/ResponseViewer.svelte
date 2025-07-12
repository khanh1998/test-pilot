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

<div
  class="fixed inset-0 z-40 flex justify-end transition-opacity duration-200 ease-in-out {isOpen
    ? 'opacity-100'
    : 'opacity-0'}"
  on:keydown={(e) => e.key === 'Escape' && closeResponseViewer()}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
>
  <!-- Transparent clickable overlay -->
  <div
    class="absolute inset-y-0 right-0 left-0 bg-transparent transition-opacity duration-300 ease-in-out sm:right-[75%] md:right-[600px] lg:right-[500px]"
    on:click={closeResponseViewer}
    role="presentation"
    aria-hidden="true"
  ></div>

  <!-- The panel itself - responsive sizing -->
  <div
    class="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white shadow-xl transition-transform duration-300 ease-in-out sm:w-[75%] md:w-[600px] lg:w-[500px] {!isOpen
      ? 'pointer-events-none'
      : ''}"
    style="transform: {isOpen ? 'translateX(0)' : 'translateX(100%)'};"
    aria-hidden={!isOpen}
  >
    <!-- Header -->
    <div
      class="sticky top-0 z-10 flex w-full items-center justify-between border-b bg-gray-100 px-4 py-3 shadow-sm"
    >
      <div>
        <h3 class="flex items-center font-medium">
          <span class="mr-2 rounded bg-green-100 px-2 py-1 text-xs text-green-800">
            {endpoint?.method}
          </span>
          <span class="font-mono text-sm">{endpoint?.path}</span>
          {#if duplicateCount > 1}
            <span class="ml-2 rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">
              Instance #{instanceIndex}
            </span>
          {/if}
          {#if executionData.response?.status}
            <span
              class="ml-2 rounded-full px-1.5 py-0.5 text-xs font-medium {getStatusColor(
                executionData.response.status || 0
              )} text-white"
            >
              {executionData.response.status}
            </span>
          {/if}
        </h3>
      </div>
      <div>
        <button
          class="rounded-full p-1 text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-800"
          on:click={closeResponseViewer}
          aria-label="Close"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            ></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="border-b bg-gray-50 px-4">
      <div class="-mb-px flex overflow-x-auto">
        <button
          class="border-b-2 px-4 py-2 text-sm font-medium transition-colors {activeTab === 'request'
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
          on:click={() => (activeTab = 'request')}
        >
          <div class="flex items-center">
            <span class="mr-1.5 text-blue-600">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M7 16l-4-4m0 0l4-4m-4 4h18"
                />
              </svg>
            </span>
            Request
          </div>
        </button>

        <button
          class="border-b-2 px-4 py-2 text-sm font-medium transition-colors {activeTab ===
          'response'
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
          on:click={() => (activeTab = 'response')}
        >
          <div class="flex items-center">
            <span class="mr-1.5 text-green-600">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </span>
            Response
          </div>
        </button>

        <button
          class="border-b-2 px-4 py-2 text-sm font-medium transition-colors {activeTab === 'headers'
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
          on:click={() => (activeTab = 'headers')}
        >
          <div class="flex items-center">
            <span class="mr-1.5 text-yellow-600">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
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
          <h4 class="mb-2 text-sm font-medium text-gray-700">Request Details</h4>

          <!-- URL -->
          <div class="mb-4">
            <h5 class="mb-1 text-xs font-medium text-gray-500">URL:</h5>
            <div class="rounded border bg-gray-50 p-2 font-mono text-sm break-all">
              {executionData.request?.url || 'N/A'}
            </div>
          </div>

          <!-- Request Body -->
          {#if executionData.request?.body}
            <div class="mb-4">
              <h5 class="mb-1 text-xs font-medium text-gray-500">Body:</h5>
              <div class="max-h-80 overflow-auto rounded border bg-gray-50 p-2">
                <pre class="font-mono text-xs whitespace-pre-wrap">{formatJson(
                    executionData.request.body
                  )}</pre>
              </div>
            </div>
          {/if}

          <!-- Path Params -->
          {#if executionData.request?.pathParams && Object.keys(executionData.request.pathParams).length > 0}
            <div class="mb-4">
              <h5 class="mb-1 text-xs font-medium text-gray-500">Path Parameters:</h5>
              <div class="max-h-60 overflow-auto rounded border bg-gray-50 p-2">
                <pre class="font-mono text-xs whitespace-pre-wrap">{formatJson(
                    executionData.request.pathParams
                  )}</pre>
              </div>
            </div>
          {/if}

          <!-- Query Params -->
          {#if executionData.request?.queryParams && Object.keys(executionData.request.queryParams).length > 0}
            <div class="mb-4">
              <h5 class="mb-1 text-xs font-medium text-gray-500">Query Parameters:</h5>
              <div class="max-h-60 overflow-auto rounded border bg-gray-50 p-2">
                <pre class="font-mono text-xs whitespace-pre-wrap">{formatJson(
                    executionData.request.queryParams
                  )}</pre>
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Response Tab -->
      {#if activeTab === 'response'}
        <div class="space-y-4">
          <h4 class="mb-2 text-sm font-medium text-gray-700">Response Details</h4>

          <!-- Status -->
          <div class="mb-4">
            <h5 class="mb-1 text-xs font-medium text-gray-500">Status:</h5>
            <div class="flex items-center">
              <span
                class="rounded px-2 py-1 text-sm font-medium {getStatusColor(
                  executionData.response?.status || 0
                )} text-white"
              >
                {executionData.response?.status || 'N/A'}
              </span>
              <span class="ml-2 text-sm">{executionData.response?.statusText || ''}</span>
            </div>
          </div>

          <!-- Timing -->
          {#if executionData.timing}
            <div class="mb-4">
              <h5 class="mb-1 text-xs font-medium text-gray-500">Timing:</h5>
              <div class="text-sm">
                {executionData.timing}ms
              </div>
            </div>
          {/if}

          <!-- Response Body -->
          {#if executionData.response?.body}
            <div>
              <h5 class="mb-1 text-xs font-medium text-gray-500">Body:</h5>
              <div class="max-h-96 overflow-auto rounded border bg-gray-50 p-2">
                <pre class="font-mono text-xs whitespace-pre-wrap">{formatJson(
                    executionData.response.body
                  )}</pre>
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Headers Tab -->
      {#if activeTab === 'headers'}
        <div class="space-y-4">
          <div class="mb-4">
            <h4 class="mb-2 text-sm font-medium text-gray-700">Request Headers</h4>
            {#if executionData.request?.headers && Object.keys(executionData.request.headers).length > 0}
              <div class="rounded border bg-gray-50">
                <table class="w-full text-sm">
                  <thead class="border-b bg-gray-100">
                    <tr>
                      <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">Name</th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each Object.entries(executionData.request.headers) as [name, value]}
                      <tr class="border-b border-gray-200 last:border-0">
                        <td class="px-3 py-2 font-medium">{name}</td>
                        <td class="px-3 py-2 font-mono text-xs break-all">{value}</td>
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
            <h4 class="mb-2 text-sm font-medium text-gray-700">Response Headers</h4>
            {#if executionData.response?.headers && Object.keys(executionData.response.headers).length > 0}
              <div class="rounded border bg-gray-50">
                <table class="w-full text-sm">
                  <thead class="border-b bg-gray-100">
                    <tr>
                      <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">Name</th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each Object.entries(executionData.response.headers) as [name, value] (name)}
                      <tr class="border-b border-gray-200 last:border-0">
                        <td class="px-3 py-2 font-medium">{name}</td>
                        <td class="px-3 py-2 font-mono text-xs break-all">{value}</td>
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
