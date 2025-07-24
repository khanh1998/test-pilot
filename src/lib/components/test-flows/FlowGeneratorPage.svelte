<script lang="ts">
  import { createEventDispatcher, onMount, afterUpdate } from 'svelte';
  import { goto } from '$app/navigation';
  import * as apiClient from '$lib/http_client/apis';
  import * as testFlowClient from '$lib/http_client/test-flow';
  import * as assistantClient from '$lib/http_client/assistant';
  import EndpointSelector from './EndpointSelector.svelte';
  import type { EnrichedSkeletonTestFlow } from '$lib/http_client/assistant';
  import FlowEditor from './FlowEditor.svelte';

  const dispatch = createEventDispatcher();

  // Data structures
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
  let description = '';

  // UI state
  let isGenerating = false;
  let isGeneratingSkeletonFlow = false;
  let error: string | null = null;
  let success = false;

  // Skeleton flow state
  let skeletonTestFlow: EnrichedSkeletonTestFlow | null = null;
  let isEditingMode = false;

  // State for endpoint selector sliding window
  let isEndpointSelectorOpen = false;
  let isSelectorMounted = false;
  let currentAddEndpointStep: number | null = null;
  let replacingEndpointInfo: { stepIndex: number; itemIndex: number } | null = null;
  // This can be removed as we've added currentStepIndex and currentItemIndex above

  function navigateBack() {
    dispatch('back');
  }

  async function loadEndpoints() {
    try {
      error = null;
      const apisResult = await apiClient.getApiList();

      if (apisResult && apisResult.apis) {
        // Build API hosts mapping
        apiHosts = Object.fromEntries(
          apisResult.apis.map((api) => [
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
            endpoints.push(
              ...result.endpoints.map((endpoint) => ({
                id: endpoint.id,
                apiId: endpoint.apiId,
                path: endpoint.path,
                method: endpoint.method,
                operationId: endpoint.operationId || undefined,
                summary: endpoint.summary || undefined,
                description: endpoint.description || undefined,
                tags: endpoint.tags || undefined
              }))
            );
          }
        }

        availableEndpoints = endpoints;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load APIs and endpoints';
    }
  }

  // Generate a skeleton test flow based on the description
  async function generateSkeletonFlow() {
    if (!description.trim()) {
      error = 'Please provide a detailed description for the test flow';
      return;
    }

    try {
      isGeneratingSkeletonFlow = true;
      error = null;

      const result = await assistantClient.generateSkeletonTestFlow(description);

      if (result) {
        skeletonTestFlow = result;
        isEditingMode = true;
      } else {
        error = 'Failed to generate skeleton test flow';
      }
    } catch (err) {
      console.error('Error generating skeleton flow:', err);
      error = err instanceof Error ? err.message : 'An unknown error occurred';
    } finally {
      isGeneratingSkeletonFlow = false;
    }
  }

  // Generate the final test flow using the skeleton
  async function generateFlow() {
    if (!skeletonTestFlow) {
      error = 'Please generate a skeleton test flow first';
      return;
    }

    // Collect all endpoint IDs from the skeleton test flow
    const endpointIds: number[] = [];

    skeletonTestFlow.steps.forEach((step) => {
      step.apiInfoItems.forEach((item) => {
        if (item.endpoint?.id) {
          endpointIds.push(item.endpoint.id);
        }
      });
    });

    if (endpointIds.length === 0) {
      error = 'No valid endpoints found in the skeleton flow';
      return;
    }

    try {
      isGenerating = true;
      error = null;
      success = false;

      const result = await testFlowClient.generateTestFlow({
        endpointIds: endpointIds,
        description: description
      });

      if (result) {
        success = true;

        // Emit success event and navigate back after a delay
        setTimeout(() => {
          dispatch('success');
        }, 1500);
      }
    } catch (err) {
      console.error('Error generating flow:', err);
      error = err instanceof Error ? err.message : 'An unknown error occurred';
    } finally {
      isGenerating = false;
    }
  }

  // Load endpoints when component is mounted
  $: if (availableEndpoints.length === 0) {
    loadEndpoints();
  }

  // Toggle editing mode
  function toggleEditMode() {
    isEditingMode = !isEditingMode;
  }

  // Add an endpoint to a step
  function addEndpointToStep(stepIndex: number, endpoint: any) {
    if (!skeletonTestFlow) return;

    const updatedSteps = [...skeletonTestFlow.steps];
    const step = updatedSteps[stepIndex];

    if (step) {
      // Generate a unique ID for this API info item
      const apiInfoItemId = `${step.id}-${step.apiInfoItems.length}`;
      
      const newApiInfoItem = {
        id: apiInfoItemId,
        apiSignature: endpoint.path,
        transforms: [],
        assertions: [],
        note: null,
        dependsOn: [],
        endpoint: {
          id: endpoint.id,
          apiId: endpoint.apiId,
          path: endpoint.path,
          method: endpoint.method,
          operationId: endpoint.operationId || null,
          summary: endpoint.summary || null,
          description: endpoint.description || null,
          tags: endpoint.tags || null,
          similarity: 1.0
        }
      };

      updatedSteps[stepIndex] = {
        ...step,
        apiInfoItems: [...step.apiInfoItems, newApiInfoItem]
      };

      skeletonTestFlow = {
        ...skeletonTestFlow,
        steps: updatedSteps
      };
    }
  }

  // Remove an endpoint from a step
  function removeEndpointFromStep(stepIndex: number, itemIndex: number) {
    if (!skeletonTestFlow) return;

    const updatedSteps = [...skeletonTestFlow.steps];
    const step = updatedSteps[stepIndex];

    if (step) {
      const updatedApiInfoItems = step.apiInfoItems.filter((_, idx) => idx !== itemIndex);

      updatedSteps[stepIndex] = {
        ...step,
        apiInfoItems: updatedApiInfoItems
      };

      skeletonTestFlow = {
        ...skeletonTestFlow,
        steps: updatedSteps
      };
    }
  }

  // Start adding an endpoint to a step
  function startAddEndpointToStep(stepIndex: number) {
    isSelectorMounted = true;
    currentAddEndpointStep = stepIndex;
    replacingEndpointInfo = null;
    // Add a small delay to ensure the DOM is updated before showing the panel
    setTimeout(() => {
      isEndpointSelectorOpen = true;
    }, 10);
  }

  // Handle endpoint selection for adding to a step
  function handleEndpointSelect(event: CustomEvent, stepIndex: number | null) {
    const endpoint = event.detail;

    if (replacingEndpointInfo) {
      // Replace an endpoint
      replaceEndpointInStep(
        replacingEndpointInfo.stepIndex,
        replacingEndpointInfo.itemIndex,
        endpoint
      );
      replacingEndpointInfo = null;
    } else if (stepIndex !== null) {
      // Add a new endpoint
      addEndpointToStep(stepIndex, endpoint);
    }

    // Close the selector after selection
    closeEndpointSelector();
  }

  // Start replacing an endpoint
  function startReplaceEndpoint(stepIndex: number, itemIndex: number) {
    isSelectorMounted = true;
    currentAddEndpointStep = null;
    replacingEndpointInfo = { stepIndex, itemIndex };
    // Add a small delay to ensure the DOM is updated before showing the panel
    setTimeout(() => {
      isEndpointSelectorOpen = true;
    }, 10);
  }

  // Close the endpoint selector sliding window
  function closeEndpointSelector() {
    isEndpointSelectorOpen = false;
    // Match the duration of the animation (300ms)
    setTimeout(() => {
      isSelectorMounted = false;
      currentAddEndpointStep = null;
      replacingEndpointInfo = null;
    }, 300);
  }

  // Cancel endpoint operation
  function cancelEndpointOperation() {
    closeEndpointSelector();
  }

  // Replace an endpoint in a step
  function replaceEndpointInStep(stepIndex: number, itemIndex: number, endpoint: any) {
    if (!skeletonTestFlow) return;

    const updatedSteps = [...skeletonTestFlow.steps];
    const step = updatedSteps[stepIndex];

    if (step && step.apiInfoItems[itemIndex]) {
      const currentItem = step.apiInfoItems[itemIndex];
      
      const newApiInfoItem = {
        id: currentItem.id, // Keep the same ID
        apiSignature: endpoint.path,
        transforms: currentItem.transforms || [], // Preserve existing transforms
        assertions: currentItem.assertions || [], // Preserve existing assertions
        note: currentItem.note,
        dependsOn: currentItem.dependsOn || [], // Preserve existing dependencies
        endpoint: {
          id: endpoint.id,
          apiId: endpoint.apiId,
          path: endpoint.path,
          method: endpoint.method,
          operationId: endpoint.operationId || null,
          summary: endpoint.summary || null,
          description: endpoint.description || null,
          tags: endpoint.tags || null,
          similarity: 1.0
        }
      };

      // Replace the item at the given index
      const updatedApiInfoItems = [...step.apiInfoItems];
      updatedApiInfoItems[itemIndex] = newApiInfoItem;

      updatedSteps[stepIndex] = {
        ...step,
        apiInfoItems: updatedApiInfoItems
      };

      skeletonTestFlow = {
        ...skeletonTestFlow,
        steps: updatedSteps
      };
    }
  }

  // Remove a parameter from the flow
  function removeParameter(paramName: string) {
    if (!skeletonTestFlow || !skeletonTestFlow.parameters) return;

    // Filter out the parameter with the given name
    skeletonTestFlow = {
      ...skeletonTestFlow,
      parameters: skeletonTestFlow.parameters.filter((p) => p.name !== paramName)
    };
  }
</script>

<div class="grid grid-cols-1 gap-8">
  <!-- Description input section -->
  <section class="rounded-lg bg-white p-6 shadow">
    <h2 class="mb-4 text-lg font-semibold text-gray-800">Describe Your Test Flow</h2>

    <div>
      <label for="flow-description" class="mb-2 block text-sm font-medium text-gray-700">
        Test Flow Description
      </label>
      <FlowEditor bind:description={description}/>

      <div class="mt-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p class="text-sm text-gray-500">
          Provide a detailed description of your test flow scenario. The AI will extract a skeleton
          flow based on this description.
        </p>
        <button
          class="focus:ring-opacity-50 flex items-center justify-center space-x-2 rounded-md bg-blue-600 px-5 py-2 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          on:click={generateSkeletonFlow}
          disabled={isGeneratingSkeletonFlow || !description.trim()}
        >
          {#if isGeneratingSkeletonFlow}
            <div
              class="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"
            ></div>
            <span>Generating Skeleton...</span>
          {:else}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="mr-1 h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <span>Generate Skeleton Test Flow</span>
          {/if}
        </button>
      </div>
    </div>
  </section>

  <!-- Error message -->
  {#if error}
    <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <div class="flex">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="mr-2 h-5 w-5 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>{error}</span>
      </div>
    </div>
  {/if}

  <!-- Success message -->
  {#if success}
    <div class="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
      <div class="flex">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="mr-2 h-5 w-5 text-green-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 13l4 4L19 7"
          />
        </svg>
        <span>Test flow successfully generated! Redirecting...</span>
      </div>
    </div>
  {/if}

  <!-- Skeleton Test Flow Preview -->
  {#if skeletonTestFlow}
    <div class="rounded-lg bg-white shadow">
      <!-- Header -->
      <header class="border-b p-4">
        <div class="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 class="text-xl font-medium text-gray-900">{skeletonTestFlow.name}</h2>
            <p class="mt-1 text-sm text-gray-600">{skeletonTestFlow.description}</p>
          </div>

          <div class="flex space-x-3">
            <button
              class="flex items-center rounded bg-blue-100 px-3 py-1 text-sm text-blue-700 hover:bg-blue-200"
              on:click={toggleEditMode}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="mr-1 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
              {isEditingMode ? 'Done Editing' : 'Edit Flow'}
            </button>

            <button
              class="flex items-center rounded bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              on:click={generateFlow}
              disabled={isGenerating ||
                skeletonTestFlow.steps.some((step) => step.apiInfoItems.length === 0)}
            >
              {#if isGenerating}
                <div
                  class="mr-1 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                ></div>
                <span>Generating...</span>
              {:else}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="mr-1 h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                <span>Generate Complete Flow</span>
              {/if}
            </button>
          </div>
        </div>
      </header>

      <!-- Main content -->
      <div class="p-4">
        <!-- Note about the flow if available -->
        {#if skeletonTestFlow.note}
          <div class="mb-6 border-l-4 border-yellow-400 bg-yellow-50 p-3 text-sm text-yellow-700">
            <strong>Note:</strong>
            {skeletonTestFlow.note}
          </div>
        {/if}

        <!-- Steps with endpoints -->
        <div class="space-y-6">
          {#each skeletonTestFlow.steps as step, stepIndex}
            <div class="rounded-md border border-gray-200">
              <!-- Step Header -->
              <div class="flex items-center justify-between rounded-t-md bg-gray-100 px-4 py-3">
                <div>
                  <div class="flex items-center gap-2">
                    <h3 class="font-medium">Step {stepIndex + 1}</h3>
                    {#if step.id}
                      <span class="text-xs font-mono bg-purple-100 text-purple-800 px-1 py-0.5 rounded">
                        {step.id}
                      </span>
                    {/if}
                  </div>
                  <p class="text-sm text-gray-600">{step.description}</p>
                </div>
                <span class="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">
                  {step.apiInfoItems.length}
                  {step.apiInfoItems.length === 1 ? 'endpoint' : 'endpoints'}
                </span>
              </div>

              <!-- Endpoints in this step -->
              <div class="p-3">
                <div class="flex flex-wrap gap-2">
                  {#each step.apiInfoItems as apiInfoItem, itemIndex}
                    <div class="flex-grow-0 rounded border bg-gray-50 p-2 min-w-[280px]">
                      {#if apiInfoItem.endpoint}
                        <!-- Header with method and similarity -->
                        <div class="flex items-center justify-between">
                          <span
                            class={`rounded px-2 py-0.5 text-xs font-medium
                              ${
                                apiInfoItem.endpoint.method === 'GET'
                                  ? 'bg-green-100 text-green-800'
                                  : apiInfoItem.endpoint.method === 'POST'
                                    ? 'bg-blue-100 text-blue-800'
                                    : apiInfoItem.endpoint.method === 'PUT'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : apiInfoItem.endpoint.method === 'DELETE'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-gray-100 text-gray-800'
                              }`}
                          >
                            {apiInfoItem.endpoint.method}
                          </span>
                          <span class="ml-2 text-xs text-gray-500">
                            {(apiInfoItem.endpoint.similarity * 100).toFixed(0)}% match
                          </span>
                        </div>

                        <!-- API ID and Path -->
                        <div class="mt-1 text-xs text-purple-600 font-mono">
                          ID: {apiInfoItem.id}
                        </div>

                        <div
                          class="mt-1 max-w-[250px] truncate font-mono text-xs"
                          title={apiInfoItem.endpoint.path}
                        >
                          {apiInfoItem.endpoint.path}
                        </div>

                        <div class="mt-1 text-xs text-gray-500">
                          {apiHosts[apiInfoItem.endpoint.apiId]?.name ||
                            `API ${apiInfoItem.endpoint.apiId}`}
                        </div>

                        <!-- Dependencies -->
                        {#if apiInfoItem.dependsOn && apiInfoItem.dependsOn.length > 0}
                          <div class="mt-1">
                            <div class="text-xs text-gray-600 font-medium">Depends on:</div>
                            <div class="flex flex-wrap gap-1 mt-1">
                              {#each apiInfoItem.dependsOn as dependency}
                                <span class="bg-orange-100 text-orange-800 text-xs px-1 py-0.5 rounded">
                                  {dependency}
                                </span>
                              {/each}
                            </div>
                          </div>
                        {/if}

                        <!-- Transforms -->
                        {#if apiInfoItem.transforms && apiInfoItem.transforms.length > 0}
                          <div class="mt-1">
                            <div class="text-xs text-gray-600 font-medium">Transforms:</div>
                            <div class="mt-1 space-y-0.5">
                              {#each apiInfoItem.transforms as transform}
                                <div class="bg-blue-50 text-blue-800 text-xs px-1 py-0.5 rounded">
                                  {transform}
                                </div>
                              {/each}
                            </div>
                          </div>
                        {/if}

                        <!-- Assertions -->
                        {#if apiInfoItem.assertions && apiInfoItem.assertions.length > 0}
                          <div class="mt-1">
                            <div class="text-xs text-gray-600 font-medium">Assertions:</div>
                            <div class="mt-1 space-y-0.5">
                              {#each apiInfoItem.assertions as assertion}
                                <div class="bg-green-50 text-green-800 text-xs px-1 py-0.5 rounded">
                                  {assertion}
                                </div>
                              {/each}
                            </div>
                          </div>
                        {/if}

                        <!-- Note -->
                        {#if apiInfoItem.note}
                          <div class="mt-1">
                            <div class="text-xs text-gray-600 font-medium">Note:</div>
                            <div class="text-xs text-gray-700 italic mt-0.5">
                              {apiInfoItem.note}
                            </div>
                          </div>
                        {/if}

                        {#if isEditingMode}
                          <div class="mt-2 flex space-x-1">
                            <button
                              class="flex-1 rounded px-1 py-0.5 text-xs text-blue-600 hover:bg-blue-50"
                              on:click={() => startReplaceEndpoint(stepIndex, itemIndex)}
                            >
                              Replace
                            </button>
                            <button
                              class="flex-1 rounded px-1 py-0.5 text-xs text-red-600 hover:bg-red-50"
                              on:click={() => removeEndpointFromStep(stepIndex, itemIndex)}
                            >
                              Remove
                            </button>
                          </div>
                        {/if}
                      {:else}
                        <div class="flex flex-col">
                          <span class="text-xs font-medium text-orange-600"
                            >Signature: {apiInfoItem.apiSignature}</span
                          >
                          <span class="text-xs text-gray-500 italic"
                            >No matching endpoint found</span
                          >

                          <!-- Show other info even without endpoint -->
                          {#if apiInfoItem.id}
                            <div class="mt-1 text-xs text-purple-600 font-mono">
                              ID: {apiInfoItem.id}
                            </div>
                          {/if}

                          {#if apiInfoItem.dependsOn && apiInfoItem.dependsOn.length > 0}
                            <div class="mt-1">
                              <div class="text-xs text-gray-600 font-medium">Depends on:</div>
                              <div class="flex flex-wrap gap-1 mt-1">
                                {#each apiInfoItem.dependsOn as dependency}
                                  <span class="bg-orange-100 text-orange-800 text-xs px-1 py-0.5 rounded">
                                    {dependency}
                                  </span>
                                {/each}
                              </div>
                            </div>
                          {/if}

                          {#if isEditingMode}
                            <button
                              class="mt-1 rounded px-1 py-0.5 text-xs text-red-600 hover:bg-red-50"
                              on:click={() => removeEndpointFromStep(stepIndex, itemIndex)}
                            >
                              Remove
                            </button>
                          {/if}
                        </div>
                      {/if}
                    </div>
                  {/each}

                  {#if isEditingMode}
                    <button
                      class="flex items-center justify-center rounded border border-dashed border-green-300 bg-green-50 p-2 hover:bg-green-100"
                      on:click={() => startAddEndpointToStep(stepIndex)}
                    >
                      <svg
                        class="mr-1 h-4 w-4 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                      <span class="text-xs text-green-600">Add Endpoint</span>
                    </button>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        </div>

        <!-- Parameters -->
        {#if skeletonTestFlow.parameters && skeletonTestFlow.parameters.length > 0}
          <div class="mt-8 border-t pt-6">
            <h4 class="mb-3 text-base font-medium">Flow Parameters</h4>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {#each skeletonTestFlow.parameters as param}
                <div class="rounded border bg-gray-50 p-3 text-sm">
                  <div class="flex items-center justify-between">
                    <span class="font-mono">{param.name}</span>
                    <span
                      class="rounded-full px-2 py-0.5 text-xs {param.required
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'}"
                    >
                      {param.required ? 'Required' : 'Optional'}
                    </span>
                  </div>
                  <div class="flex items-center justify-between">
                    <div class="mt-1 text-xs text-gray-600">Type: {param.type}</div>
                    {#if isEditingMode}
                      <button
                        class="mt-1 rounded px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50"
                        on:click={() => removeParameter(param.name)}
                      >
                        Remove
                      </button>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <!-- Placeholder for when no skeleton is generated yet -->
    <section class="rounded-lg bg-white p-10 text-center shadow">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="mx-auto h-16 w-16 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <h3 class="mt-6 text-xl font-medium text-gray-700">No Skeleton Flow Generated Yet</h3>
      <p class="mx-auto mt-3 max-w-md text-base text-gray-500">
        Enter a detailed description of your test scenario above and click "Generate Skeleton Test
        Flow" to create a flow outline.
      </p>
    </section>
  {/if}
</div>


<!-- Endpoint Selector Sliding Window -->
{#if isEndpointSelectorOpen || isSelectorMounted}
  <div
    class="fixed inset-0 z-40 flex justify-end transition-all duration-300 ease-in-out {isEndpointSelectorOpen
      ? 'opacity-100'
      : 'opacity-0'}"
    on:keydown={(e) => e.key === 'Escape' && closeEndpointSelector()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- Completely transparent clickable overlay for the left side -->
    <div
      class="absolute inset-y-0 right-0 left-0 bg-transparent transition-all duration-300 ease-in-out sm:right-[75%] md:right-[600px] lg:right-[500px]"
      on:click={closeEndpointSelector}
      role="presentation"
      aria-hidden="true"
      style="transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);"
    ></div>

    <!-- The panel itself - responsive sizing for different screens with enhanced transitions -->
    <div
      class="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white shadow-xl transition-all duration-300 ease-in-out sm:w-[75%] md:w-[600px] lg:w-[500px] {!isEndpointSelectorOpen
        ? 'pointer-events-none'
        : ''}"
      style="transform: {isEndpointSelectorOpen
        ? 'translateX(0)'
        : 'translateX(100%)'}; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);"
      aria-hidden={!isEndpointSelectorOpen}
    >
      <!-- Header -->
      <div
        class="sticky top-0 z-10 flex w-full items-center justify-between border-b bg-gray-100 px-4 py-3 shadow-sm"
      >
        <div>
          <h3 class="font-medium">
            {#if replacingEndpointInfo}
              Replace Endpoint
            {:else if currentAddEndpointStep !== null}
              Add Endpoint to Step {currentAddEndpointStep + 1}
            {:else}
              Select Endpoint
            {/if}
          </h3>
        </div>
        <button
          class="rounded-full p-1 text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-800"
          on:click={closeEndpointSelector}
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

      <!-- Endpoint Selector Content -->
      <div class="p-4">
        {#if currentAddEndpointStep !== null}
          <EndpointSelector
            endpoints={availableEndpoints}
            {apiHosts}
            showSelector={true}
            on:select={(event) => handleEndpointSelect(event, currentAddEndpointStep)}
          />
        {:else if replacingEndpointInfo}
          <EndpointSelector
            endpoints={availableEndpoints}
            {apiHosts}
            showSelector={true}
            on:select={(event) =>
              replacingEndpointInfo && handleEndpointSelect(event, replacingEndpointInfo.stepIndex)}
          />
        {/if}
      </div>
    </div>
  </div>
{/if}
