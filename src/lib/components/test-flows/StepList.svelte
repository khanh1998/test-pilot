<script lang="ts">
  import StepEditor from './StepEditor.svelte';
  import SmartEndpointSelector from './SmartEndpointSelector.svelte';
  import type { FlowStep, Endpoint, ExecutionState, TestFlowData } from './types';
  import type { TemplateContext } from '$lib/template/types';
  import { onMount } from 'svelte';

  
  interface Props {
    [key: string]: unknown;
    // Props
    testFlowId?: string | number | undefined; // Test flow ID for localStorage
    steps?: FlowStep[];
    endpoints?: Endpoint[];
    apiHosts?: TestFlowData['settings']['api_hosts'];
    isRunning?: boolean;
    isLoadingEndpointDetails?: boolean;
    executionStore: ExecutionState;
    templateContext: TemplateContext;
  }

  let {
    testFlowId = undefined,
    steps = [],
    endpoints = [],
    apiHosts = {},
    isRunning = false,
    isLoadingEndpointDetails = false,
    executionStore,
    templateContext
  , ...callbackProps
  }: Props & Record<string, unknown> = $props();

  function dispatch(eventName: string, detail?: unknown) {
    const handler = callbackProps["on" + eventName.charAt(0).toUpperCase() + eventName.slice(1)];
    if (typeof handler === "function") {
      if (arguments.length > 1) {
        handler(detail);
      } else {
        handler();
      }
    }
  }

  // Track global collapsed state for all endpoint selectors
  let areSelectorsCollapsed = $state(false);
  
  // LocalStorage key for this test flow
  let storageKey = $derived(testFlowId ? `testflow-${testFlowId}-selectors-collapsed` : null);

  // Load collapsed state from localStorage on mount
  onMount(() => {
    if (storageKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) {
        areSelectorsCollapsed = saved === 'true';
      }
    }
  });

  function toggleSelectorCollapse() {
    areSelectorsCollapsed = !areSelectorsCollapsed;
    
    // Save to localStorage
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(storageKey, String(areSelectorsCollapsed));
    }
  }

  // Event handlers that forward to parent
  function handleRemoveStep(payload: unknown) {
    dispatch('removeStep', payload);
  }

  function handleRemoveEndpoint(payload: unknown) {
    dispatch('removeEndpoint', payload);
  }

  function handleMoveStep(payload: unknown) {
    dispatch('moveStep', payload);
  }

  function handleChange() {
    dispatch('change');
  }

  function executeStep(payload: unknown) {
    dispatch('runStep', payload);
  }

  function handleEndpointSelected(endpoint: Endpoint, stepIndex: number) {
    dispatch('endpointSelected', { ...endpoint, stepIndex });
  }

  function insertStepAtBeginning() {
    dispatch('insertStepAtBeginning');
  }

  function insertStepAfter(stepIndex: number) {
    dispatch('insertStepAfter', { stepIndex });
  }

  function addNewStep() {
    dispatch('addNewStep');
  }
</script>

<!-- Existing Steps -->
{#if steps && steps.length > 0}
  <!-- Add Step Button (before first step) -->
  <div class="mb-4 flex justify-center">
    <button
      aria-label="Insert step before"
      class="group flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-400 shadow-sm hover:bg-gray-50 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      onclick={insertStepAtBeginning}
      disabled={isRunning}
      title="Insert step before {steps[0].step_id}"
      class:opacity-50={isRunning}
      class:cursor-not-allowed={isRunning}
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
        />
      </svg>
    </button>
  </div>
  
  {#each steps as step, stepIndex (step.step_id)}
    <div class="mb-4">
      <StepEditor
        {step}
        {endpoints}
        {apiHosts}
        {stepIndex}
        isFirstStep={stepIndex === 0}
        isLastStep={stepIndex === steps.length - 1}
        {isRunning}
        {executionStore}
        {templateContext}
        onRemoveStep={handleRemoveStep}
        onRemoveEndpoint={handleRemoveEndpoint}
        onMoveStep={handleMoveStep}
        onChange={handleChange}
        onRunStep={executeStep}
      >
          {#snippet endpointSelector()}
                <div  class="relative flex-shrink-0 transition-all duration-500 ease-in-out" style={areSelectorsCollapsed ? 'width: 48px;' : 'width: 260px;'}>
            <!-- Animated container with width transition -->
            <div 
              class="overflow-hidden"
            >
              {#if areSelectorsCollapsed}
                <!-- Collapsed state - vertical bar with search icon -->
                <div class="flex flex-col items-center justify-start rounded-md border border-gray-300 bg-white h-full">
                  <button
                    class="flex w-full items-center justify-center p-3 text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
                    onclick={toggleSelectorCollapse}
                    disabled={isRunning}
                    title="Expand endpoint selector"
                    aria-label="Expand endpoint selector"
                  >
                    <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                </div>
              {:else}
                <!-- Expanded state - show full selector -->
                <div class="transition-opacity duration-300" class:opacity-0={areSelectorsCollapsed} class:opacity-100={!areSelectorsCollapsed}>
                  <SmartEndpointSelector
                    {apiHosts}
                    onSelect={(endpoint: Endpoint) => handleEndpointSelected(endpoint, stepIndex)}
                    disabled={isRunning || isLoadingEndpointDetails}
                  />
                  {#if isLoadingEndpointDetails}
                    <div class="mt-2 flex items-center text-sm text-blue-600">
                      <svg class="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Loading endpoint details...
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
            
            <!-- Collapse/Expand toggle button -->
            <div class="mt-2 flex justify-center">
              <button
                class="text-xs text-gray-500 hover:text-gray-700 focus:outline-none transition-opacity duration-200"
                onclick={toggleSelectorCollapse}
                disabled={isRunning}
                title={areSelectorsCollapsed ? "Expand selector" : "Collapse selector"}
              >
                {#if areSelectorsCollapsed}
                  <span class="flex items-center">
                    <svg class="mr-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                    Expand
                  </span>
                {:else}
                  <span class="flex items-center">
                    <svg class="mr-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    Collapse
                  </span>
                {/if}
              </button>
            </div>
          </div>
              {/snippet}
      </StepEditor>
    </div>
    
    <!-- Add Step Button (between steps) -->
    {#if stepIndex < steps.length - 1}
      <div class="mb-4 flex justify-center">
        <button
          aria-label="Insert step after"
          class="group flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-400 shadow-sm hover:bg-gray-50 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          onclick={() => insertStepAfter(stepIndex)}
          disabled={isRunning}
          title="Insert step after {step.step_id}"
          class:opacity-50={isRunning}
          class:cursor-not-allowed={isRunning}
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
        </button>
      </div>
    {/if}
  {/each}
{:else}
  <div class="mb-4 rounded-lg border border-yellow-100 bg-yellow-50 p-4 text-center">
    <p class="text-yellow-700">No steps in this flow yet. Add a step to get started.</p>
  </div>
{/if}

<!-- Add Step Button -->
<div class="mt-6">
  <button
    class="flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
    onclick={addNewStep}
    disabled={isRunning}
  >
    <svg class="mr-2 h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
      />
    </svg>
    Add New Step
  </button>
</div>
