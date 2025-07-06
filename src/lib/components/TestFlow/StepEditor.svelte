<script lang="ts">
  export let step: any;
  export let endpoints: any[] = [];
  export let stepIndex: number;
  export let isFirstStep: boolean = false;
  export let isLastStep: boolean = false;
  
  // Emitted events will be handled by the parent component
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  
  // Define types for parameters and endpoints
  type Parameter = {
    name: string;
    in: string;
    required?: boolean;
    description?: string;
    example?: string;
    type?: string;
  };

  type Endpoint = {
    id: string | number;
    path: string;
    method: string;
    parameters?: Parameter[];
    requestSchema?: any;
    responseSchema?: any;
  };

  type StepEndpoint = {
    endpoint_id: string | number;
    store_response_as?: string;
    pathParams?: Record<string, string>;
    queryParams?: Record<string, string>;
    body?: any;
    headers?: {name: string; value: string; enabled: boolean}[];
  };

  // Parameter editor state
  let isParamEditorOpen = false;
  let isParamEditorMounted = false;
  let activeEndpointIndex: number | null = null;
  let activeTab: 'path' | 'query' | 'body' | 'headers' = 'path';
  let jsonBodyContent = '{}';
  let headers: {name: string; value: string; enabled: boolean}[] = [];
  
  // Helper to find an endpoint by ID
  function findEndpoint(id: string | number) {
    return endpoints.find(e => e.id === id);
  }
  
  function removeEndpoint(endpointIndex: number) {
    dispatch('removeEndpoint', { stepIndex, endpointIndex });
  }
  
  function updateParam(endpointIndex: number, paramType: string, paramIndex: number, field: string, value: any) {
    dispatch('updateParam', { stepIndex, endpointIndex, paramType, paramIndex, field, value });
  }
  
  function moveStepUp() {
    dispatch('moveStep', { stepIndex, direction: 'up' });
  }
  
  function moveStepDown() {
    dispatch('moveStep', { stepIndex, direction: 'down' });
  }

  // Generate a sample request body based on the schema
  function generateSampleBody(schema: any): any {
    if (!schema) return {};
    
    // Handle different types of schemas
    if (schema.type === 'object') {
      const result: Record<string, any> = {};
      if (schema.properties) {
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          result[propName] = generateSampleValueForProperty(propSchema as any, propName);
        }
      }
      return result;
    } else if (schema.type === 'array') {
      return [generateSampleValueForProperty(schema.items, 'item')];
    } else {
      return generateSampleValueForProperty(schema, 'value');
    }
  }
  
  // Generate a sample value for a specific property based on its schema
  function generateSampleValueForProperty(propSchema: any, propName: string): any {
    if (!propSchema) return null;
    
    // If schema has an example, use it
    if (propSchema.example !== undefined) {
      return propSchema.example;
    }
    
    // Based on type, generate appropriate sample value
    switch (propSchema.type) {
      case 'string':
        if (propSchema.enum) return propSchema.enum[0];
        if (propSchema.format === 'date-time') return new Date().toISOString();
        if (propSchema.format === 'date') return new Date().toISOString().split('T')[0];
        if (propSchema.format === 'email') return `user@example.com`;
        if (propSchema.format === 'uuid') return '00000000-0000-0000-0000-000000000000';
        if (propName.toLowerCase().includes('name')) return 'Sample Name';
        if (propName.toLowerCase().includes('email')) return 'user@example.com';
        if (propName.toLowerCase().includes('description')) return 'Sample description';
        return `Sample ${propName}`;
      
      case 'number':
      case 'integer':
        if (propSchema.minimum !== undefined && propSchema.maximum !== undefined) {
          return Math.floor((propSchema.minimum + propSchema.maximum) / 2);
        }
        if (propName.toLowerCase().includes('age')) return 30;
        if (propName.toLowerCase().includes('count')) return 5;
        if (propName.toLowerCase().includes('id')) return 1;
        return 0;
      
      case 'boolean':
        return true;
      
      case 'object':
        return generateSampleBody(propSchema);
      
      case 'array':
        if (propSchema.items) {
          return [generateSampleValueForProperty(propSchema.items, 'item')];
        }
        return [];
      
      default:
        return null;
    }
  }

  // Open parameter editor panel for a specific endpoint
  function openParamEditor(endpointIndex: number) {
    activeEndpointIndex = endpointIndex;
    const endpoint = findEndpoint(step.endpoints[endpointIndex].endpoint_id);
    
    // Initialize JSON body if needed
    if (endpoint?.requestSchema) {
      try {
        if (step.endpoints[endpointIndex].body) {
          // Use existing body if available
          jsonBodyContent = JSON.stringify(step.endpoints[endpointIndex].body, null, 2);
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
    
    // Initialize headers if needed
    if (!step.endpoints[endpointIndex].headers) {
      step.endpoints[endpointIndex].headers = [];
    }
    headers = [...(step.endpoints[endpointIndex].headers || [])];
    
    // Add Content-Type header if not present and has body
    if (endpoint?.requestSchema && !headers.some(h => h.name.toLowerCase() === 'content-type')) {
      headers.push({
        name: 'Content-Type',
        value: 'application/json',
        enabled: true
      });
    }
    
    // Set the active tab to the first one that has content
    if (endpoint?.parameters?.some((p: Parameter) => p.in === 'path')) {
      activeTab = 'path';
    } else if (endpoint?.parameters?.some((p: Parameter) => p.in === 'query')) {
      activeTab = 'query';
    } else if (endpoint?.requestSchema) {
      activeTab = 'body';
    } else {
      activeTab = 'headers';
    }
    
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
  
  // Save changes from parameter editor
  function saveParamChanges() {
    if (activeEndpointIndex !== null) {
      try {
        // Parse and save JSON body
        if (activeTab === 'body') {
          const parsedJson = JSON.parse(jsonBodyContent);
          step.endpoints[activeEndpointIndex].body = parsedJson;
        }
        
        // Save headers
        step.endpoints[activeEndpointIndex].headers = [...headers];
        
        dispatch('change');
      } catch (e) {
        console.error('Error saving parameter changes:', e);
        // You might want to show an error message here
      }
    }
    closeParamEditor();
  }
  
  // Add a new header
  function addHeader() {
    headers = [...headers, { name: '', value: '', enabled: true }];
  }
  
  // Remove a header
  function removeHeader(index: number) {
    headers = headers.filter((_, i) => i !== index);
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
    <h4 class="text-sm font-medium text-gray-500 mb-2">Endpoints:</h4>
    
    {#if step.endpoints.length === 0}
      <p class="text-gray-400 italic text-sm">No endpoints in this step yet</p>
    {:else}
      <div class="flex flex-row gap-3 overflow-x-auto pb-2">
        {#each step.endpoints as stepEndpoint, endpointIndex}
          {@const endpoint = findEndpoint(stepEndpoint.endpoint_id)}
          {#if endpoint}
            <div class="bg-gray-50 rounded-md p-3 min-w-[280px] max-w-[300px] flex-shrink-0">
              <div class="flex justify-between items-start mb-2">
                <div>
                  <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded mr-2">
                    {endpoint.method}
                  </span>
                  <span class="font-mono text-sm">{endpoint.path}</span>
                </div>
                <button 
                  class="text-red-600 hover:text-red-800"
                  on:click={() => removeEndpoint(endpointIndex)}
                  aria-label="Remove Endpoint"
                >
                  <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                  </svg>
                </button>
              </div>
              
              <div class="mb-2">
                <label for="response-{stepIndex}-{endpointIndex}" class="block text-xs font-medium text-gray-500 mb-1">
                  Store Response As:
                </label>
                <input 
                  id="response-{stepIndex}-{endpointIndex}"
                  type="text" 
                  bind:value={stepEndpoint.store_response_as}
                  class="text-sm px-2 py-1 border rounded w-full"
                  on:change={() => dispatch('change')}
                />
              </div>
              
              <!-- Parameter configuration summary -->
              <div class="mt-3">
                <!-- Edit Parameters Button -->
                <button 
                  class="text-blue-600 hover:text-blue-800 text-xs flex items-center mb-2"
                  on:click={() => openParamEditor(endpointIndex)}
                >
                  <svg class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  Configure Parameters
                </button>
                
                <!-- Parameter summary -->
                {#if endpoint.parameters && endpoint.parameters.length > 0}
                  <div>
                    <h5 class="text-xs font-medium text-gray-500 mb-1">Parameters:</h5>
                    <div class="text-xs text-gray-600">
                      {#if endpoint.parameters.filter((p: Parameter) => p.in === 'path').length > 0}
                        <div class="flex items-center gap-1 mb-1">
                          <span class="bg-purple-100 text-purple-800 px-1 py-0.5 rounded">Path</span>
                          <span>{endpoint.parameters.filter((p: Parameter) => p.in === 'path').length} params</span>
                        </div>
                      {/if}
                      {#if endpoint.parameters.filter((p: Parameter) => p.in === 'query').length > 0}
                        <div class="flex items-center gap-1 mb-1">
                          <span class="bg-blue-100 text-blue-800 px-1 py-0.5 rounded">Query</span>
                          <span>{endpoint.parameters.filter((p: Parameter) => p.in === 'query').length} params</span>
                        </div>
                      {/if}
                    </div>
                  </div>
                {/if}
                
                <!-- Body indicator -->
                {#if endpoint.requestSchema}
                  <div class="mt-1">
                    <div class="flex items-center gap-1">
                      <span class="bg-green-100 text-green-800 text-xs px-1 py-0.5 rounded">Body</span>
                      <span class="text-xs">{stepEndpoint.body ? 'Configured' : 'Not configured'}</span>
                    </div>
                  </div>
                {/if}
                
                <!-- Headers indicator -->
                {#if stepEndpoint.headers && stepEndpoint.headers.length > 0}
                  <div class="mt-1">
                    <div class="flex items-center gap-1">
                      <span class="bg-yellow-100 text-yellow-800 text-xs px-1 py-0.5 rounded">Headers</span>
                      <span class="text-xs">{stepEndpoint.headers.filter((h: {enabled: boolean}) => h.enabled).length} headers</span>
                    </div>
                  </div>
                {/if}
              </div>
            </div>
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
  {@const activeEndpoint = findEndpoint(step.endpoints[activeEndpointIndex].endpoint_id)}
  <div class="fixed inset-0 z-40 flex justify-end transition-opacity duration-200 ease-in-out {isParamEditorOpen ? 'opacity-100' : 'opacity-0'}"
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
    <div class="fixed inset-y-0 right-0 w-full sm:w-[75%] md:w-[600px] lg:w-[500px] bg-white shadow-xl overflow-y-auto z-50 transition-transform duration-300 ease-in-out"
         style="transform: {isParamEditorOpen ? 'translateX(0)' : 'translateX(100%)'};"
         aria-hidden={!isParamEditorOpen ? 'true' : 'false'}>
      
      <!-- Header - with added width to ensure it fills full panel width -->
      <div class="bg-gray-100 px-4 py-3 flex justify-between items-center sticky top-0 z-10 border-b shadow-sm w-full">
        <div>
          <h3 class="font-medium">
            <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded mr-2">
              {activeEndpoint?.method}
            </span>
            <span class="font-mono text-sm">{activeEndpoint?.path}</span>
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
        <div class="flex -mb-px overflow-x-auto">
          {#if activeEndpoint?.parameters?.some((p: Parameter) => p.in === 'path')}
            <button 
              class="px-4 py-2 border-b-2 text-sm font-medium transition-colors {activeTab === 'path' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
              on:click={() => activeTab = 'path'}
            >
              <div class="flex items-center">
                <span class="mr-1.5 text-purple-600">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                  </svg>
                </span>
                Path
              </div>
            </button>
          {/if}
          
          {#if activeEndpoint?.parameters?.some((p: Parameter) => p.in === 'query')}
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
          
          {#if activeEndpoint?.requestSchema}
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
        {#if activeTab === 'path' && activeEndpoint?.parameters?.some((p: Parameter) => p.in === 'path')}
          <div class="space-y-4">
            <h4 class="font-medium text-sm text-gray-700 mb-2">Path Parameters</h4>
            {#each activeEndpoint.parameters.filter((p: Parameter) => p.in === 'path') as param, paramIndex}
              <div class="flex flex-col mb-4">
                <label class="text-sm mb-1" for="path-param-{stepIndex}-{activeEndpointIndex}-{paramIndex}">
                  {param.name} {param.required ? '*' : ''}
                  {#if param.description}
                    <span class="text-xs text-gray-500 ml-1">({param.description})</span>
                  {/if}
                </label>
                <input 
                  id="path-param-{stepIndex}-{activeEndpointIndex}-{paramIndex}"
                  type="text" 
                  class="px-3 py-2 border rounded-md text-sm"
                  placeholder={param.example || param.name}
                  value={step.endpoints[activeEndpointIndex!]?.pathParams?.[param.name] || ''}
                  on:input={(e) => {
                    if (activeEndpointIndex !== null) {
                      if (!step.endpoints[activeEndpointIndex].pathParams) {
                        step.endpoints[activeEndpointIndex].pathParams = {};
                      }
                      step.endpoints[activeEndpointIndex].pathParams[param.name] = e.currentTarget.value;
                    }
                  }}
                />
              </div>
            {/each}
          </div>
        {/if}
        
        <!-- Query Parameters Tab -->
        {#if activeTab === 'query' && activeEndpoint?.parameters?.some((p: Parameter) => p.in === 'query')}
          <div class="space-y-4">
            <h4 class="font-medium text-sm text-gray-700 mb-2">Query Parameters</h4>
            {#each activeEndpoint.parameters.filter((p: Parameter) => p.in === 'query') as param, paramIndex}
              <div class="flex flex-col mb-4">
                <div class="flex items-center justify-between">
                  <label class="text-sm mb-1" for="query-param-checkbox-{stepIndex}-{activeEndpointIndex}-{paramIndex}">
                    {param.name} {param.required ? '*' : ''}
                    {#if param.description}
                      <span class="text-xs text-gray-500 ml-1">({param.description})</span>
                    {/if}
                  </label>
                  <input 
                    id="query-param-checkbox-{stepIndex}-{activeEndpointIndex}-{paramIndex}"
                    type="checkbox"
                    checked={step.endpoints[activeEndpointIndex!]?.queryParams?.[param.name] !== undefined}
                    on:change={(e) => {
                      if (activeEndpointIndex !== null) {
                        if (!step.endpoints[activeEndpointIndex].queryParams) {
                          step.endpoints[activeEndpointIndex].queryParams = {};
                        }
                        if (!e.currentTarget.checked) {
                          delete step.endpoints[activeEndpointIndex].queryParams[param.name];
                        } else if (step.endpoints[activeEndpointIndex].queryParams[param.name] === undefined) {
                          step.endpoints[activeEndpointIndex].queryParams[param.name] = '';
                        }
                      }
                    }}
                  />
                </div>
                {#if activeEndpointIndex !== null && step.endpoints[activeEndpointIndex]?.queryParams?.[param.name] !== undefined}
                  <input 
                    id="query-param-{stepIndex}-{activeEndpointIndex}-{paramIndex}"
                    type="text" 
                    class="px-3 py-2 border rounded-md text-sm"
                    placeholder={param.example || param.name}
                    value={step.endpoints[activeEndpointIndex]?.queryParams?.[param.name] || ''}
                    on:input={(e) => {
                      if (activeEndpointIndex !== null) {
                        if (!step.endpoints[activeEndpointIndex].queryParams) {
                          step.endpoints[activeEndpointIndex].queryParams = {};
                        }
                        step.endpoints[activeEndpointIndex].queryParams[param.name] = e.currentTarget.value;
                      }
                    }}
                  />
                {/if}
              </div>
            {/each}
          </div>
        {/if}
        
        <!-- Body Parameters Tab -->
        {#if activeTab === 'body' && activeEndpoint?.requestSchema}
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
                        // Format JSON with proper indentation
                        const formatted = JSON.stringify(JSON.parse(jsonBodyContent), null, 2);
                        jsonBodyContent = formatted;
                      } catch (e) {
                        // If parsing fails, do nothing
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
                    id="header-checkbox-{headerIndex}"
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
{/if}
