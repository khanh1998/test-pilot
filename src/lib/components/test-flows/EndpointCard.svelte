<script lang="ts">
  import type { Endpoint, StepEndpoint, ExecutionState } from './types';
  import { getEndpointDisplayId } from './utils';

  export let endpoint: Endpoint;
  export let stepEndpoint: StepEndpoint;
  export let endpointIndex: number;
  // stepIndex not directly used in this component, but needed for event handlers
  export let stepIndex: number;
  export let executionState: ExecutionState = {};
  export let duplicateCount: number = 1;
  export let instanceIndex: number = 1;
  export let apiHosts: Record<string | number, { url: string; name?: string; description?: string }> = {};

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
      console.debug(
        `[EndpointCard] executionState updated for ${endpointDisplayId}`,
        executionState[endpointDisplayId]
      );
    }
  }

  $: currentExecutionState = executionState[endpointDisplayId] || {};
  $: executionStatus = currentExecutionState?.status;
  $: executionResponse = currentExecutionState?.response;
  $: executionTiming = currentExecutionState?.timing || null;
  $: transformationResults = currentExecutionState?.transformations || {};

  // Check if an endpoint is currently running
  $: isRunning = executionStatus === 'running';

  // Check if an endpoint has completed execution
  $: isCompleted = executionStatus === 'completed';

  // Check if an endpoint has failed
  $: isFailed = executionStatus === 'failed';

  // Check if transformation results are available
  $: hasTransformationResults = Object.keys(transformationResults).length > 0;

  // Get the response status code for an endpoint
  $: statusCode = executionResponse?.status || null;

  // Get a stylized class for the response status
  function getResponseStatusClass(): string {
    const status = statusCode;
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

  function openTransformationEditor() {
    dispatch('openTransformationEditor', { endpointIndex });
  }
  
  function openAssertionEditor() {
    dispatch('openAssertionEditor', { endpointIndex });
  }

  function removeEndpoint() {
    dispatch('removeEndpoint', { endpointIndex });
  }
</script>

<div
  class="relative max-w-[290px] min-w-[260px] flex-shrink-0 rounded-md border p-2 {isRunning
    ? 'border-blue-400 bg-blue-50 shadow-md shadow-blue-100'
    : 'border-gray-200 bg-gray-50'} {isCompleted ? 'border-green-500 bg-green-50' : ''} {isFailed
    ? 'border-red-500 bg-red-50'
    : ''} {getResponseStatusClass()}"
>
  <div class="mb-2 flex items-start justify-between">
    <div class="flex items-center">
      <span
        class="mr-1.5 rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800 uppercase"
      >
        {endpoint.method}
      </span>
      {#if stepEndpoint.api_id && stepEndpoint.api_id !== endpoint.apiId}
        <span class="ml-1 rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-800">
          {apiHosts[stepEndpoint.api_id]?.name || `API ${stepEndpoint.api_id}`}
        </span>
      {/if}
      {#if duplicateCount > 1}
        <span class="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800">
          #{instanceIndex}
        </span>
      {/if}

      {#if statusCode}
        <span
          class="ml-1 rounded-full px-1.5 py-0.5 text-xs {statusCode >= 200 && statusCode < 300
            ? 'bg-green-500'
            : statusCode >= 400 && statusCode < 500
              ? 'bg-yellow-500'
              : statusCode >= 500
                ? 'bg-red-500'
                : 'bg-gray-500'} text-white"
        >
          {statusCode}
        </span>
      {/if}
    </div>
    <button
      class="text-red-500 hover:text-red-700"
      on:click={removeEndpoint}
      aria-label="Remove endpoint"
    >
      <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
        <path
          fill-rule="evenodd"
          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
          clip-rule="evenodd"
        ></path>
      </svg>
    </button>
  </div>

  <!-- Enhanced Execution Status Indicator -->
  {#if isRunning}
    <div class="absolute top-0 right-0 mt-1 mr-1">
      <div
        class="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
      ></div>
    </div>
    <!-- Visual indicator for the entire card when running -->
    <div
      class="pointer-events-none absolute inset-0 animate-pulse rounded-md bg-blue-50 opacity-20"
    ></div>
  {:else if isCompleted || isFailed}
    <div
      class="absolute top-0 right-0 mt-1 mr-1 rounded-full p-0.5 {isCompleted
        ? 'bg-green-100'
        : 'bg-red-100'}"
    >
      {#if isCompleted}
        <svg class="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
          <path
            fill-rule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clip-rule="evenodd"
          ></path>
        </svg>
      {:else}
        <svg class="h-4 w-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path
            fill-rule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clip-rule="evenodd"
          ></path>
        </svg>
      {/if}
    </div>
  {/if}

  <div class="mb-1">
    <div class="font-mono text-[10px] truncate text-gray-700" title="{endpoint.path}">
      {endpoint.path}
    </div>
  </div>

  <!-- Parameter configuration summary -->
  <div class="mt-2">
    <!-- Button row 1: Primary actions -->
    <div class="mb-1 grid grid-cols-2 gap-1">
      <button
        class="flex items-center justify-center rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700 transition-colors hover:bg-blue-100"
        on:click={openParamEditor}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="mr-1 h-3 w-3"
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
        Edit Request
      </button>

      <!-- Response Viewer Button -->
      <button
        class="flex items-center justify-center rounded border px-1.5 py-0.5 text-xs {executionResponse
          ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
          : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'} transition-colors"
        on:click={openResponseViewer}
        disabled={!executionResponse}
        title={executionResponse
          ? 'View complete request and response details'
          : 'Run endpoint to view response'}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="mr-1 h-3 w-3"
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
        Response
      </button>
    
      <!-- Transformation Editor Button -->
      <button
        class="flex items-center justify-center rounded border px-1.5 py-0.5 text-xs transition-colors {hasTransformationResults
          ? 'border-purple-300 bg-purple-100 text-purple-800 hover:bg-purple-200'
          : 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100'}"
        on:click={openTransformationEditor}
        title={hasTransformationResults
          ? `Transform results available (${Object.keys(transformationResults).length} aliases)`
          : 'Configure response transformations'}
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          class="mr-1 h-3 w-3"
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2" 
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" 
          />
        </svg>
        Transform
      </button>
      
      <!-- Assertion Editor Button -->
      <button
        class="flex items-center justify-center rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700 transition-colors hover:bg-amber-100"
        on:click={openAssertionEditor}
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          class="mr-1 h-3 w-3"
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2" 
            d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" 
          />
        </svg>
        {#if stepEndpoint.assertions && stepEndpoint.assertions.length > 0}
          ({stepEndpoint.assertions.length})
        {/if}
      </button>
    </div>

    <!-- Execution time and status if available -->
    <div class="mt-0.5 flex items-center gap-1 text-[10px]">
      {#if executionTiming}
        <span class="inline-flex items-center text-gray-500 bg-gray-50 rounded px-0.5 py-px">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="mr-0.5 h-2 w-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {executionTiming}ms
        </span>
      {/if}

      {#if isRunning}
        <span class="inline-flex items-center text-blue-500 bg-blue-50 rounded px-0.5 py-px">
          <svg
            class="mr-0.5 h-2 w-2 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          Run
        </span>
      {:else if isCompleted}
        <span class="inline-flex items-center text-green-500 bg-green-50 rounded px-0.5 py-px">
          <svg class="mr-0.5 h-2 w-2" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd"
            ></path>
          </svg>
          OK
        </span>
      {:else if isFailed}
        <span class="inline-flex items-center text-red-500 bg-red-50 rounded px-0.5 py-px">
          <svg class="mr-0.5 h-2 w-2" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clip-rule="evenodd"
            ></path>
          </svg>
          Fail
        </span>
      {/if}
    </div>

    <!-- Combined parameter indicators -->
    <div class="mt-0.5 flex flex-wrap gap-0.5 text-[10px]">
      <!-- Path & query parameters -->
      {#if endpoint.parameters && endpoint.parameters.length > 0}
        {#each endpoint.parameters.filter((p) => p.in === 'path') as param, index (`path-${param.name}-${index}`)}
          {#if stepEndpoint.pathParams && stepEndpoint.pathParams[param.name]}
            <span
              class="rounded bg-purple-100 px-0.5 py-px text-purple-800"
              title="{param.name}: {stepEndpoint.pathParams[param.name]}"
            >
              {param.name}
            </span>
          {/if}
        {/each}
        {#each endpoint.parameters.filter((p) => p.in === 'query') as param, index (`query-${param.name}-${index}`)}
          {#if stepEndpoint.queryParams && stepEndpoint.queryParams[param.name]}
            <span
              class="rounded bg-blue-100 px-0.5 py-px text-blue-800"
              title="{param.name}: {stepEndpoint.queryParams[param.name]}"
            >
              {param.name}
            </span>
          {/if}
        {/each}
      {/if}

      <!-- Body indicator -->
      {#if endpoint.requestSchema && stepEndpoint.body && Object.keys(stepEndpoint.body).length > 0}
        <span
          class="inline-flex items-center rounded bg-green-100 px-0.5 py-px text-green-800"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="mr-px h-2 w-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          Body
        </span>
      {/if}

      <!-- Headers indicator -->
      {#if stepEndpoint.headers && stepEndpoint.headers.filter((h) => h.enabled).length > 0}
        <span
          class="inline-flex items-center rounded bg-yellow-100 px-0.5 py-px text-yellow-800"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="mr-px h-2 w-2"
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
          {stepEndpoint.headers.filter((h) => h.enabled).length}H
        </span>
      {/if}
    </div>
  </div>
</div>
