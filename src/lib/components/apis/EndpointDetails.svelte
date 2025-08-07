<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ApiEndpoint } from '$lib/types/api';
  import { generateSampleBody } from '../test-flows/utils';

  export let isOpen = false;
  export let endpoint: ApiEndpoint | null = null;

  const dispatch = createEventDispatcher();

  // Active tab state
  let activeTab: 'overview' | 'parameters' | 'request' | 'response' = 'overview';
  
  // Toggle between schema and sample for request/response tabs
  let requestView: 'schema' | 'sample' = 'schema';
  let responseView: 'schema' | 'sample' = 'schema';

  function closeDetails() {
    dispatch('close');
  }

  function getMethodColor(method: string) {
    const colors = {
      GET: 'bg-green-100 text-green-800 border-green-200',
      POST: 'bg-blue-100 text-blue-800 border-blue-200',
      PUT: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      DELETE: 'bg-red-100 text-red-800 border-red-200',
      PATCH: 'bg-purple-100 text-purple-800 border-purple-200'
    };
    return colors[method as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200';
  }

  function formatJson(obj: any): string {
    if (!obj) return '{}';
    try {
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return '{}';
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      // You could add a toast notification here
      console.log('Copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  }

  function generateSamplePayload(schema: any): string {
    if (!schema) return '{}';
    try {
      const sample = generateSampleBody(schema);
      return JSON.stringify(sample, null, 2);
    } catch (e) {
      return '{}';
    }
  }

  // Set the active tab based on available data when endpoint changes
  $: if (endpoint) {
    // Reset view states when endpoint changes
    requestView = 'schema';
    responseView = 'schema';
    
    // Set default tab based on what data is available
    if (endpoint.summary || endpoint.description) {
      activeTab = 'overview';
    } else if (endpoint.parameters && Array.isArray(endpoint.parameters) && endpoint.parameters.length > 0) {
      activeTab = 'parameters';
    } else if (endpoint.requestSchema) {
      activeTab = 'request';
    } else if (endpoint.responseSchema) {
      activeTab = 'response';
    } else {
      activeTab = 'overview';
    }
  }
</script>

{#if isOpen}
<div
  class="fixed inset-0 z-40 flex justify-end transition-opacity duration-200 ease-in-out opacity-100"
  on:keydown={(e) => e.key === 'Escape' && closeDetails()}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
>
  <!-- Transparent overlay for the left side -->
  <div
    class="absolute inset-y-0 right-0 left-0 bg-transparent transition-opacity duration-300 ease-in-out sm:right-[75%] md:right-[700px] lg:right-[600px]"
    on:click={closeDetails}
    role="presentation"
    aria-hidden="true"
  ></div>

  <!-- The panel itself -->
  <div
    class="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white shadow-xl transition-transform duration-300 ease-in-out sm:w-[75%] md:w-[700px] lg:w-[600px]"
    style="transform: translateX(0);"
    aria-hidden="false"
  >
    {#if endpoint}
      <!-- Header -->
      <div class="sticky top-0 z-10 flex w-full items-center justify-between border-b bg-gray-50 px-6 py-4 shadow-sm">
        <div class="flex-1">
          <div class="flex items-center space-x-3">
            <span class="inline-flex rounded-md border px-3 py-1 text-sm font-semibold {getMethodColor(endpoint.method)}">
              {endpoint.method}
            </span>
            <span class="font-mono text-sm text-gray-700">{endpoint.path}</span>
          </div>
          {#if endpoint.summary}
            <h3 class="mt-1 text-lg font-medium text-gray-900">{endpoint.summary}</h3>
          {/if}
          {#if endpoint.operationId}
            <p class="mt-1 text-sm text-gray-500">Operation ID: {endpoint.operationId}</p>
          {/if}
        </div>
        <button
          class="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
          on:click={closeDetails}
          aria-label="Close"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- Tabs -->
      <div class="border-b bg-gray-50 px-6">
        <div class="-mb-px flex overflow-x-auto">
          <button
            class="border-b-2 px-4 py-3 text-sm font-medium transition-colors {activeTab === 'overview'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
            on:click={() => (activeTab = 'overview')}
          >
            <div class="flex items-center">
              <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              Overview
            </div>
          </button>

          {#if endpoint.parameters && Array.isArray(endpoint.parameters) && endpoint.parameters.length > 0}
            <button
              class="border-b-2 px-4 py-3 text-sm font-medium transition-colors {activeTab === 'parameters'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
              on:click={() => (activeTab = 'parameters')}
            >
              <div class="flex items-center">
                <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                Parameters
              </div>
            </button>
          {/if}

          {#if endpoint.requestSchema}
            <button
              class="border-b-2 px-4 py-3 text-sm font-medium transition-colors {activeTab === 'request'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
              on:click={() => (activeTab = 'request')}
            >
              <div class="flex items-center">
                <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                </svg>
                Request
              </div>
            </button>
          {/if}

          {#if endpoint.responseSchema}
            <button
              class="border-b-2 px-4 py-3 text-sm font-medium transition-colors {activeTab === 'response'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
              on:click={() => (activeTab = 'response')}
            >
              <div class="flex items-center">
                <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                Response
              </div>
            </button>
          {/if}
        </div>
      </div>

      <!-- Tab Content -->
      <div class="p-6">
        <!-- Overview Tab -->
        {#if activeTab === 'overview'}
          <div class="space-y-6">
            <div>
              <h4 class="text-lg font-medium text-gray-900">Endpoint Information</h4>
              <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt class="text-sm font-medium text-gray-500">Method</dt>
                  <dd class="mt-1">
                    <span class="inline-flex rounded-md border px-2 py-1 text-xs font-semibold {getMethodColor(endpoint.method)}">
                      {endpoint.method}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt class="text-sm font-medium text-gray-500">Path</dt>
                  <dd class="mt-1 font-mono text-sm text-gray-900">{endpoint.path}</dd>
                </div>
                {#if endpoint.operationId}
                  <div>
                    <dt class="text-sm font-medium text-gray-500">Operation ID</dt>
                    <dd class="mt-1 font-mono text-sm text-gray-900">{endpoint.operationId}</dd>
                  </div>
                {/if}
                {#if endpoint.tags && endpoint.tags.length > 0}
                  <div>
                    <dt class="text-sm font-medium text-gray-500">Tags</dt>
                    <dd class="mt-1">
                      <div class="flex flex-wrap gap-1">
                        {#each endpoint.tags as tag}
                          <span class="inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                            {tag}
                          </span>
                        {/each}
                      </div>
                    </dd>
                  </div>
                {/if}
              </div>
            </div>

            {#if endpoint.summary}
              <div>
                <h5 class="text-sm font-medium text-gray-500">Summary</h5>
                <p class="mt-1 text-sm text-gray-900">{endpoint.summary}</p>
              </div>
            {/if}

            {#if endpoint.description}
              <div>
                <h5 class="text-sm font-medium text-gray-500">Description</h5>
                <p class="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{endpoint.description}</p>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Parameters Tab -->
        {#if activeTab === 'parameters' && endpoint.parameters && Array.isArray(endpoint.parameters)}
          <div class="space-y-6">
            <h4 class="text-lg font-medium text-gray-900">Parameters</h4>
            
            <!-- Group parameters by type -->
            {#each ['path', 'query', 'header', 'cookie'] as paramType}
              {@const paramsOfType = endpoint.parameters.filter(p => p.in === paramType)}
              {#if paramsOfType.length > 0}
                <div>
                  <h5 class="mb-3 text-sm font-medium text-gray-700 capitalize">{paramType} Parameters</h5>
                  <div class="overflow-hidden rounded-lg border border-gray-200">
                    <table class="min-w-full divide-y divide-gray-200">
                      <thead class="bg-gray-50">
                        <tr>
                          <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Name</th>
                          <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                          <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Required</th>
                          <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Description</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-200 bg-white">
                        {#each paramsOfType as param}
                          <tr>
                            <td class="px-4 py-3 font-mono text-sm text-gray-900">{param.name}</td>
                            <td class="px-4 py-3 text-sm text-gray-500">
                              {param.schema?.type || param.type || 'string'}
                              {#if param.schema?.format}
                                <span class="text-gray-400">({param.schema.format})</span>
                              {/if}
                            </td>
                            <td class="px-4 py-3 text-sm">
                              {#if param.required}
                                <span class="inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">Required</span>
                              {:else}
                                <span class="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800">Optional</span>
                              {/if}
                            </td>
                            <td class="px-4 py-3 text-sm text-gray-500">
                              {param.description || 'No description provided'}
                              {#if param.example}
                                <div class="mt-1 font-mono text-xs text-gray-400">Example: {param.example}</div>
                              {/if}
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        {/if}

        <!-- Request Tab -->
        {#if activeTab === 'request' && endpoint.requestSchema}
          <div class="space-y-6">
            <div class="flex items-center justify-between">
              <h4 class="text-lg font-medium text-gray-900">Request {requestView === 'schema' ? 'Schema' : 'Sample'}</h4>
              <div class="flex items-center space-x-2">
                <!-- Toggle buttons -->
                <div class="inline-flex rounded-md border border-gray-300 bg-white">
                  <button
                    class="px-3 py-1 text-xs font-medium transition-colors {requestView === 'schema'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-50'} rounded-l-md"
                    on:click={() => (requestView = 'schema')}
                  >
                    Schema
                  </button>
                  <button
                    class="px-3 py-1 text-xs font-medium transition-colors {requestView === 'sample'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-50'} rounded-r-md border-l border-gray-300"
                    on:click={() => (requestView = 'sample')}
                  >
                    Sample
                  </button>
                </div>
                <button
                  class="rounded bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200"
                  on:click={() => copyToClipboard(requestView === 'schema' ? formatJson(endpoint.requestSchema) : generateSamplePayload(endpoint.requestSchema))}
                >
                  Copy JSON
                </button>
              </div>
            </div>
            <div class="overflow-hidden rounded-lg border border-gray-200">
              <div class="bg-gray-50 px-3 py-2">
                <span class="text-xs font-medium text-gray-700">
                  {requestView === 'schema' ? 'JSON Schema' : 'Sample Payload'}
                </span>
              </div>
              <div class="p-4">
                <pre class="text-sm text-gray-800 overflow-x-auto"><code>{requestView === 'schema' ? formatJson(endpoint.requestSchema) : generateSamplePayload(endpoint.requestSchema)}</code></pre>
              </div>
            </div>
          </div>
        {/if}

        <!-- Response Tab -->
        {#if activeTab === 'response' && endpoint.responseSchema}
          <div class="space-y-6">
            <div class="flex items-center justify-between">
              <h4 class="text-lg font-medium text-gray-900">Response {responseView === 'schema' ? 'Schema' : 'Sample'}</h4>
              <div class="flex items-center space-x-2">
                <!-- Toggle buttons -->
                <div class="inline-flex rounded-md border border-gray-300 bg-white">
                  <button
                    class="px-3 py-1 text-xs font-medium transition-colors {responseView === 'schema'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-50'} rounded-l-md"
                    on:click={() => (responseView = 'schema')}
                  >
                    Schema
                  </button>
                  <button
                    class="px-3 py-1 text-xs font-medium transition-colors {responseView === 'sample'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-50'} rounded-r-md border-l border-gray-300"
                    on:click={() => (responseView = 'sample')}
                  >
                    Sample
                  </button>
                </div>
                <button
                  class="rounded bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200"
                  on:click={() => copyToClipboard(responseView === 'schema' ? formatJson(endpoint.responseSchema) : generateSamplePayload(endpoint.responseSchema))}
                >
                  Copy JSON
                </button>
              </div>
            </div>
            <div class="overflow-hidden rounded-lg border border-gray-200">
              <div class="bg-gray-50 px-3 py-2">
                <span class="text-xs font-medium text-gray-700">
                  {responseView === 'schema' ? 'JSON Schema' : 'Sample Payload'}
                </span>
              </div>
              <div class="p-4">
                <pre class="text-sm text-gray-800 overflow-x-auto"><code>{responseView === 'schema' ? formatJson(endpoint.responseSchema) : generateSamplePayload(endpoint.responseSchema)}</code></pre>
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
{/if}
