<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Endpoint, StepEndpoint } from './types';
  import { generateSampleBody } from './utils';
  
  export let isOpen = false;
  export let isMounted = false;
  export let endpoint: Endpoint;
  export let stepEndpoint: StepEndpoint;
  export let stepIndex: number;
  export let endpointIndex: number;
  export let duplicateCount: number = 1;
  export let instanceIndex: number = 1;
  
  const dispatch = createEventDispatcher();
  
  // Parameter editor state
  let activeTab: 'path' | 'query' | 'body' | 'headers' = 'path';
  let jsonBodyContent = '{}';
  let headers: {name: string; value: string; enabled: boolean}[] = [];
  
  // Initialize state when component mounts
  $: if (isMounted && endpoint) {
    // Initialize headers if needed
    if (!stepEndpoint.headers) {
      stepEndpoint.headers = [];
    }
    headers = [...(stepEndpoint.headers || [])];
    
    // Add Content-Type header if not present and has body
    if (endpoint?.requestSchema && !headers.some(h => h.name.toLowerCase() === 'content-type')) {
      headers.push({
        name: 'Content-Type',
        value: 'application/json',
        enabled: true
      });
    }
    
    // Initialize JSON body if needed
    if (endpoint?.requestSchema) {
      try {
        if (stepEndpoint.body) {
          // Use existing body if available
          jsonBodyContent = JSON.stringify(stepEndpoint.body, null, 2);
        } else {
          // Generate sample body from schema
          const sampleBody = generateSampleBody(endpoint.requestSchema);
          jsonBodyContent = JSON.stringify(sampleBody, null, 2);
        }
      } catch (e) {
        jsonBodyContent = '{}';
      }
    } else {
      jsonBodyContent = '{}';
    }
    
    // Set the active tab to the first one that has content
    if (endpoint?.parameters?.some(p => p.in === 'path')) {
      activeTab = 'path';
    } else if (endpoint?.parameters?.some(p => p.in === 'query')) {
      activeTab = 'query';
    } else if (endpoint?.requestSchema) {
      activeTab = 'body';
    } else {
      activeTab = 'headers';
    }
  }
  
  // Save changes from parameter editor
  function saveParamChanges() {
    try {
      // Parse and save JSON body
      if (activeTab === 'body') {
        const parsedJson = JSON.parse(jsonBodyContent);
        stepEndpoint.body = parsedJson;
      }
      
      // Save headers
      stepEndpoint.headers = [...headers];
      
      dispatch('change');
      closeParamEditor();
    } catch (e) {
      console.error('Error saving parameter changes:', e);
      // You might want to show an error message here
    }
  }
  
  // Add a new header
  function addHeader() {
    headers = [...headers, { name: '', value: '', enabled: true }];
  }
  
  // Remove a header
  function removeHeader(index: number) {
    headers = headers.filter((_, i) => i !== index);
  }
  
  function closeParamEditor() {
    dispatch('close');
  }
</script>

<div class="fixed inset-0 z-40 flex justify-end transition-opacity duration-200 ease-in-out {isOpen ? 'opacity-100' : 'opacity-0'}"
     on:keydown={(e) => e.key === 'Escape' && closeParamEditor()}
     role="dialog" 
     aria-modal="true" 
     tabindex="-1">
  <!-- Completely transparent clickable overlay for the left side -->
  <div 
    class="absolute inset-y-0 left-0 right-0 sm:right-[75%] md:right-[600px] lg:right-[500px] bg-transparent transition-opacity duration-300 ease-in-out"
    on:click={closeParamEditor}
    role="presentation"
    aria-hidden="true"
  ></div>
  
  <!-- The panel itself - responsive sizing for different screens -->
  <div class="fixed inset-y-0 right-0 w-full sm:w-[75%] md:w-[600px] lg:w-[500px] bg-white shadow-xl overflow-y-auto z-50 transition-transform duration-300 ease-in-out {!isOpen ? 'pointer-events-none' : ''}"
       style="transform: {isOpen ? 'translateX(0)' : 'translateX(100%)'};"
       aria-hidden={!isOpen}>
    
    <!-- Header - with added width to ensure it fills full panel width -->
    <div class="bg-gray-100 px-4 py-3 flex justify-between items-center sticky top-0 z-10 border-b shadow-sm w-full">
      <div>
        <h3 class="font-medium">
          <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded mr-2">
            {endpoint?.method}
          </span>
          <span class="font-mono text-sm">{endpoint?.path}</span>
          {#if duplicateCount > 1}
            <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded ml-2">
              Instance #{instanceIndex}
            </span>
          {/if}
        </h3>
      </div>
      <div class="flex items-center gap-2">
        <button 
          class="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
          on:click={saveParamChanges}
        >
          Save
        </button>
        <button 
          class="text-gray-600 hover:text-gray-800 p-1 rounded-full hover:bg-gray-200 transition-colors"
          on:click={closeParamEditor}
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
      {#if duplicateCount > 1}
        <div class="bg-blue-50 text-blue-700 text-xs py-1.5 px-3 mb-2 rounded border border-blue-100">
          <span class="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            This endpoint appears {duplicateCount} times in this step. Changes here only affect instance #{instanceIndex}.
          </span>
        </div>
      {/if}
      <div class="flex -mb-px overflow-x-auto">
        {#if endpoint?.parameters?.some(p => p.in === 'path')}
          <button 
            class="px-4 py-2 border-b-2 text-sm font-medium transition-colors {activeTab === 'path' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            on:click={() => activeTab = 'path'}
          >
            <div class="flex items-center">
              <span class="mr-1.5 text-purple-600">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
              </span>
              Path
            </div>
          </button>
        {/if}
        
        {#if endpoint?.parameters?.some(p => p.in === 'query')}
          <button 
            class="px-4 py-2 border-b-2 text-sm font-medium transition-colors {activeTab === 'query' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            on:click={() => activeTab = 'query'}
          >
            <div class="flex items-center">
              <span class="mr-1.5 text-blue-600">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              Query
            </div>
          </button>
        {/if}
        
        {#if endpoint?.requestSchema}
          <button 
            class="px-4 py-2 border-b-2 text-sm font-medium transition-colors {activeTab === 'body' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            on:click={() => activeTab = 'body'}
          >
            <div class="flex items-center">
              <span class="mr-1.5 text-green-600">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </span>
              Body
            </div>
          </button>
        {/if}
        
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
      <!-- Path Parameters Tab -->
      {#if activeTab === 'path' && endpoint?.parameters?.some(p => p.in === 'path')}
        <div class="space-y-4">
          <h4 class="font-medium text-sm text-gray-700 mb-2">Path Parameters</h4>
          {#each endpoint.parameters.filter(p => p.in === 'path') as param, paramIndex}
            <div class="flex flex-col mb-4">
              <label class="text-sm mb-1" for="path-param-{stepIndex}-{endpointIndex}-{paramIndex}-{instanceIndex}">
                {param.name} {param.required ? '*' : ''}
                {#if param.description}
                  <span class="text-xs text-gray-500 ml-1">({param.description})</span>
                {/if}
              </label>
              <input 
                id="path-param-{stepIndex}-{endpointIndex}-{paramIndex}-{instanceIndex}"
                type="text" 
                class="px-3 py-2 border rounded-md text-sm"
                placeholder={param.example || param.name}
                value={stepEndpoint.pathParams?.[param.name] || ''}
                on:input={(e) => {
                  if (!stepEndpoint.pathParams) stepEndpoint.pathParams = {};
                  stepEndpoint.pathParams[param.name] = e.currentTarget.value;
                }}
              />
            </div>
          {/each}
        </div>
      {/if}
      
      <!-- Query Parameters Tab -->
      {#if activeTab === 'query' && endpoint?.parameters?.some(p => p.in === 'query')}
        <div class="space-y-4">
          <h4 class="font-medium text-sm text-gray-700 mb-2">Query Parameters</h4>
          {#each endpoint.parameters.filter(p => p.in === 'query') as param, paramIndex}
            <div class="flex flex-col mb-4">
              <div class="flex items-center justify-between">
                <label class="text-sm mb-1" for="query-param-checkbox-{stepIndex}-{endpointIndex}-{paramIndex}-{instanceIndex}">
                  {param.name} {param.required ? '*' : ''}
                  {#if param.description}
                    <span class="text-xs text-gray-500 ml-1">({param.description})</span>
                  {/if}
                </label>
                <input 
                  id="query-param-checkbox-{stepIndex}-{endpointIndex}-{paramIndex}-{instanceIndex}"
                  type="checkbox"
                  checked={stepEndpoint.queryParams?.[param.name] !== undefined}
                  on:change={(e) => {
                    if (!stepEndpoint.queryParams) stepEndpoint.queryParams = {};
                    if (e.currentTarget.checked) {
                      stepEndpoint.queryParams[param.name] = param.example || '';
                    } else {
                      delete stepEndpoint.queryParams[param.name];
                    }
                  }}
                />
              </div>
              {#if stepEndpoint.queryParams?.[param.name] !== undefined}
                <input 
                  id="query-param-{stepIndex}-{endpointIndex}-{paramIndex}-{instanceIndex}"
                  type="text" 
                  class="px-3 py-2 border rounded-md text-sm"
                  placeholder={param.example || param.name}
                  value={stepEndpoint.queryParams[param.name] || ''}
                  on:input={(e) => {
                    if (!stepEndpoint.queryParams) stepEndpoint.queryParams = {};
                    stepEndpoint.queryParams[param.name] = e.currentTarget.value;
                  }}
                />
              {/if}
            </div>
          {/each}
        </div>
      {/if}
      
      <!-- Body Parameters Tab -->
      {#if activeTab === 'body' && endpoint?.requestSchema}
        <div class="space-y-4">
          <h4 class="font-medium text-sm text-gray-700 mb-2">Request Body (JSON)</h4>
          <div class="border rounded-md overflow-hidden shadow-sm">
            <div class="bg-gray-50 px-3 py-2 border-b flex justify-between">
              <div class="flex items-center text-xs text-gray-700">
                <span class="font-medium">JSON</span>
              </div>
              <div class="flex items-center space-x-2">
                <button 
                  class="text-xs text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors"
                  on:click={() => {
                    try {
                      const parsed = JSON.parse(jsonBodyContent);
                      const formatted = JSON.stringify(parsed, null, 2);
                      jsonBodyContent = formatted;
                    } catch (e) {
                      console.error('Failed to format JSON:', e);
                    }
                  }}
                >
                  Format
                </button>
              </div>
            </div>
            <div class="relative">
              <textarea 
                class="w-full h-80 p-3 font-mono text-sm bg-gray-50 focus:bg-white transition-colors"
                bind:value={jsonBodyContent}
                placeholder="Enter JSON body here"
                spellcheck="false"
              ></textarea>
              <div class="absolute bottom-2 right-2 text-xs text-gray-400">
                JSON
              </div>
            </div>
          </div>
        </div>
      {/if}
      
      <!-- Headers Tab -->
      {#if activeTab === 'headers'}
        <div class="space-y-4">
          <div class="flex justify-between items-center mb-2">
            <h4 class="font-medium text-sm text-gray-700">Headers</h4>
            <button 
              class="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-xs rounded flex items-center"
              on:click={addHeader}
            >
              <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
              </svg>
              Add Header
            </button>
          </div>
          
          <div class="space-y-3">
            {#each headers as header, headerIndex}
              <div class="flex items-center space-x-2 group">
                <input 
                  type="checkbox"
                  bind:checked={header.enabled}
                  class="w-4 h-4 accent-blue-600"
                  id="header-checkbox-{stepIndex}-{endpointIndex}-{headerIndex}-{instanceIndex}"
                />
                <input 
                  type="text" 
                  placeholder="Header Name"
                  bind:value={header.name}
                  class="flex-1 px-2 py-1 border rounded-md text-sm bg-gray-50 focus:bg-white focus:border-blue-500 transition-colors"
                  aria-label="Header name"
                />
                <input 
                  type="text" 
                  placeholder="Value"
                  bind:value={header.value}
                  class="flex-1 px-2 py-1 border rounded-md text-sm bg-gray-50 focus:bg-white focus:border-blue-500 transition-colors"
                  aria-label="Header value"
                />
                <button 
                  class="text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                  on:click={() => removeHeader(headerIndex)}
                  aria-label="Remove Header"
                >
                  <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                  </svg>
                </button>
              </div>
            {/each}
            
            {#if headers.length === 0}
              <p class="text-gray-500 text-sm">No headers added yet.</p>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
