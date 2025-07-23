<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import * as apiClient from '$lib/http_client/apis';
  import * as testFlowClient from '$lib/http_client/test-flow';
  import * as endpointClient from '$lib/http_client/endpoints';
  import EndpointSelector from './EndpointSelector.svelte';

  export let isOpen = false;

  let availableEndpoints: Array<{
    id: number;
    apiId: number;
    path: string;
    method: string;
    operationId?: string;
    summary?: string;
    description?: string;
    tags?: string[];
  }> = [];
  let apiHosts: Record<number, { url: string; name: string; description?: string }> = {};
  let selectedEndpoints: Array<typeof availableEndpoints[0]> = [];
  let description = '';
  let isGenerating = false;
  let error: string | null = null;
  let success = false;
  let isRecommending = false;
  let recommendationError: string | null = null;

  const dispatch = createEventDispatcher();

  function close() {
    isOpen = false;
    dispatch('close');
  }

  async function loadEndpoints() {
    try {
      error = null;
      const apisResult = await apiClient.getApiList();
      
      if (apisResult && apisResult.apis) {
        // Build API hosts mapping
        apiHosts = Object.fromEntries(
          apisResult.apis.map(api => [
            api.id, 
            { 
              url: api.host || '', 
              name: api.name,
              description: api.description || undefined
            }
          ])
        );
        
        // Fetch endpoints for each API
        const endpoints: typeof availableEndpoints = [];
        
        for (const api of apisResult.apis) {
          const result = await apiClient.getApiEndpoints(api.id);
          if (result && result.endpoints) {
            endpoints.push(...result.endpoints.map(endpoint => ({
              id: endpoint.id,
              apiId: endpoint.apiId,
              path: endpoint.path,
              method: endpoint.method,
              operationId: endpoint.operationId || undefined,
              summary: endpoint.summary || undefined,
              description: endpoint.description || undefined,
              tags: endpoint.tags || undefined
            })));
          }
        }
        
        availableEndpoints = endpoints;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load APIs and endpoints';
    }
  }

  async function generateFlow() {
    if (selectedEndpoints.length === 0) {
      error = 'Please select at least one endpoint';
      return;
    }

    if (!description.trim()) {
      error = 'Please provide a description for the flow';
      return;
    }

    try {
      isGenerating = true;
      error = null;
      success = false;
      
      const result = await testFlowClient.generateTestFlow({
        endpointIds: selectedEndpoints.map(e => e.id),
        description: description
      });

      if (result) {
        success = true;
        dispatch('flowGenerated', { flow: result.flow });
        
        // Reset form after successful generation
        setTimeout(() => {
          success = false;
          description = '';
          // Don't reset selections to allow for quick iterations
        }, 3000);
      }
    } catch (err) {
      console.error('Error generating flow:', err);
      error = err instanceof Error ? err.message : 'An unknown error occurred';
    } finally {
      isGenerating = false;
    }
  }

  // Load endpoints when component is mounted and panel is opened
  $: if (isOpen && availableEndpoints.length === 0) {
    loadEndpoints();
  }
  
  // Handle endpoint selection
  function handleEndpointSelect(event: CustomEvent) {
    const endpoint = event.detail;
    if (!selectedEndpoints.some(e => e.id === endpoint.id)) {
      selectedEndpoints = [...selectedEndpoints, endpoint];
    }
  }
  
  // Remove an endpoint from selection
  function removeEndpoint(id: number) {
    selectedEndpoints = selectedEndpoints.filter(e => e.id !== id);
  }

  async function recommendEndpoints() {
    if (!description.trim()) {
      error = 'Please provide a description for endpoint recommendation';
      return;
    }

    try {
      isRecommending = true;
      recommendationError = null;
      
      const result = await endpointClient.getRecommendedEndpoints({
        description: description,
        limit: 2,
        similarityThreshold: 0.7 // Use a lower threshold for more results
      });

      if (result && result.endpoints && result.endpoints.length > 0) {
        // Replace current selections with recommended endpoints
        selectedEndpoints = result.endpoints
          .filter((ep: any) => availableEndpoints.some(ae => ae.id === ep.id))
          .map((ep: any) => {
            const fullEndpoint = availableEndpoints.find(ae => ae.id === ep.id);
            return fullEndpoint || {
              id: ep.id,
              apiId: ep.apiId,
              path: ep.path,
              method: ep.method,
              operationId: ep.operationId,
              summary: ep.summary,
              description: ep.description,
              tags: ep.tags
            };
          });

        if (selectedEndpoints.length === 0) {
          recommendationError = 'No relevant endpoints found for your description. Try modifying it or select endpoints manually.';
        }
      } else {
        recommendationError = 'No endpoints matched your description. Try different keywords or select endpoints manually.';
      }
    } catch (err) {
      console.error('Error recommending endpoints:', err);
      recommendationError = err instanceof Error ? err.message : 'Failed to recommend endpoints';
    } finally {
      isRecommending = false;
    }
  }
</script>

{#if isOpen}
  <div
    class="fixed inset-0 z-40 flex justify-end transition-opacity duration-200 ease-in-out"
    on:keydown={(e) => e.key === 'Escape' && close()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- Completely transparent clickable overlay for the left side -->
    <div
      class="absolute inset-y-0 right-0 left-0 bg-transparent transition-opacity duration-300 ease-in-out sm:right-[75%] lg:right-[700px]"
      on:click={close}
      role="presentation"
      aria-hidden="true"
    ></div>
    
    <!-- The panel itself - responsive sizing for different screens, now wider -->
    <div
      class="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white shadow-xl transition-transform duration-300 ease-in-out sm:w-[75%] lg:w-[700px]"
      style={isOpen ? 'transform: translateX(0)' : 'transform: translateX(100%)'}
      aria-hidden={!isOpen}
    >
      <!-- Header -->
      <div class="sticky top-0 z-10 flex w-full items-center justify-between border-b pb-2 mb-4 px-4 pt-4">
        <h2 class="text-xl font-semibold">Generate Test Flow with AI</h2>
        <button 
          class="rounded-full p-1 text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-800"
          on:click={close}
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="space-y-5 px-4">
        <!-- Flow Description with Recommend Button -->
        <div>
          <label for="flow-description" class="block text-sm font-medium text-gray-700 mb-1">Flow Description</label>
          <textarea
            id="flow-description"
            class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50"
            rows="3"
            placeholder="Describe what this test flow should do. For example: 'Create a new user, then verify the user can login, then update their profile.'"
            bind:value={description}
          ></textarea>
          
          <div class="mt-2 flex justify-between items-center">
            <p class="text-xs text-gray-500">
              Describe the test scenario in detail to help the AI generate accurate flows.
            </p>
            <button
              class="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              on:click={recommendEndpoints}
              disabled={isRecommending || !description.trim()}
            >
              {#if isRecommending}
                <div class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                <span>Recommending...</span>
              {:else}
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
                <span>Recommend Endpoints</span>
              {/if}
            </button>
          </div>
          
          <!-- Recommendation error message -->
          {#if recommendationError}
            <div class="mt-2 p-2 bg-yellow-50 text-yellow-700 rounded-md text-sm">
              {recommendationError}
            </div>
          {/if}
        </div>
        
        <!-- Panel with horizontal layout for endpoints section -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <!-- Endpoint Selector (Left side on large screens) -->
          <div>
            <label for="endpoint-selector" class="block text-sm font-medium text-gray-700 mb-1">Select Endpoints</label>
            <div id="endpoint-selector" class="h-[250px] overflow-y-auto border border-gray-200 rounded-md bg-gray-50 p-2">
              <EndpointSelector
                endpoints={availableEndpoints}
                apiHosts={apiHosts}
                showSelector={true}
                on:select={handleEndpointSelect}
              />
            </div>
            <p class="mt-1 text-xs text-gray-500">
              Search and select endpoints to include in your test flow.
            </p>
          </div>
          
          <!-- Selected Endpoints (Right side on large screens) -->
          <div>
            <div class="mb-1 flex items-center justify-between">
              <h4 class="text-sm font-medium text-gray-700">Selected Endpoints</h4>
              <span class="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{selectedEndpoints.length} selected</span>
            </div>
            
            <div class="h-[250px] overflow-y-auto border border-gray-200 rounded-md">
              {#if selectedEndpoints.length === 0}
                <div class="p-4 h-full flex items-center justify-center border border-dashed border-gray-300 rounded-md text-center bg-gray-50">
                  <div>
                    <svg class="mx-auto h-8 w-8 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p class="mt-2 text-sm text-gray-500">No endpoints selected yet.<br />Use the selector on the left or the recommend button.</p>
                  </div>
                </div>
              {:else}
                <div class="divide-y divide-gray-200">
                  {#each selectedEndpoints as endpoint (endpoint.id)}
                    <div class="flex items-center justify-between p-2 hover:bg-gray-50">
                      <div class="flex items-start gap-2 overflow-hidden">
                        <span class={`rounded px-2 py-0.5 text-xs font-medium
                          ${endpoint.method === 'GET' ? 'bg-green-100 text-green-800' : 
                            endpoint.method === 'POST' ? 'bg-blue-100 text-blue-800' : 
                            endpoint.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                            endpoint.method === 'DELETE' ? 'bg-red-100 text-red-800' : 
                            'bg-gray-100 text-gray-800'}`}
                        >
                          {endpoint.method}
                        </span>
                        <div class="overflow-hidden">
                          <div class="font-mono text-xs truncate">{endpoint.path}</div>
                          <div class="text-xs text-gray-500 truncate">
                            {apiHosts[endpoint.apiId]?.name || `API #${endpoint.apiId}`}
                          </div>
                        </div>
                      </div>
                      <button 
                        class="ml-2 text-gray-400 hover:text-red-600"
                        on:click={() => removeEndpoint(endpoint.id)}
                        aria-label="Remove endpoint"
                      >
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </div>        </div>
        
        <!-- Error and Success Messages -->
        <div class="mt-4">
          {#if error}
            <div class="p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {error}
            </div>
          {/if}

          {#if success}
            <div class="p-3 bg-green-50 text-green-700 rounded-md text-sm">
              Test flow successfully generated!
            </div>
          {/if}
        </div>

        <!-- Generate Button -->
        <div class="flex justify-end space-x-3 pt-2 pb-6 mt-2">
          <button
            class="px-5 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
            on:click={close}
            disabled={isGenerating}
          >
            Cancel
          </button>
          <button
            class="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            on:click={generateFlow}
            disabled={isGenerating || selectedEndpoints.length === 0 || !description.trim()}
          >
            {#if isGenerating}
              <div class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
              <span>Generating...</span>
            {:else}
              <span>Generate Flow</span>
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
