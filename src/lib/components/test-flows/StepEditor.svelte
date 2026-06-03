<script lang="ts">
  import type { Endpoint, StepEndpoint, ExecutionState } from './types';
  import type { TemplateContext } from '$lib/template/types';
  import type { TemplatePreviewContext } from '$lib/template/preview';
  import EndpointCard from './EndpointCard.svelte';
  import ParameterEditor from './ParameterEditor.svelte';
  import ResponseViewer from './ResponseViewer.svelte';
  import TransformationEditor from './TransformationEditor.svelte';
  import AssertionEditor from './AssertionEditor.svelte';

  interface Props {
    [key: string]: unknown;
    step: {
      step_id: string;
      label: string;
      endpoints: StepEndpoint[];
      clearCookiesBeforeExecution?: boolean;
    };
    endpoints?: Endpoint[];
    apiHosts?: Record<string | number, { url: string; name?: string; description?: string }>;
    stepIndex: number;
    isFirstStep?: boolean;
    isLastStep?: boolean;
    isRunning?: boolean; // Flag from parent to indicate if test flow execution is in progress
    executionStore?: ExecutionState; // Store from parent for better reactivity
    templateContext?: TemplateContext | null; // Template context for resolving template expressions
    previewTemplateContext?: TemplatePreviewContext | null;
    endpointSelector?: import('svelte').Snippet;
  }

  type EndpointIndexPayload = { endpointIndex: number };
  type EndpointDragPayload = { event: DragEvent };

  let {
    step = $bindable(),
    endpoints = [],
    apiHosts = {},
    stepIndex,
    isFirstStep = false,
    isLastStep = false,
    isRunning = false,
    executionStore = {},
    templateContext = null,
    previewTemplateContext = null,
    endpointSelector,
    ...callbackProps
  }: Props = $props();

  // Emitted events will be handled by the parent component

  function dispatch(eventName: string, detail?: unknown) {
    const handler = callbackProps['on' + eventName.charAt(0).toUpperCase() + eventName.slice(1)];
    if (typeof handler === 'function') {
      if (arguments.length > 1) {
        handler(detail);
      } else {
        handler();
      }
    }
  }

  // Parameter editor state
  let isParamEditorOpen = $state(false);
  let isParamEditorMounted = $state(false);
  let activeEndpointIndex: number | null = $state(null);

  // Response viewer state
  let isResponseViewerOpen = $state(false);
  let isResponseViewerMounted = $state(false);
  let activeResponseEndpointIndex: number | null = $state(null);

  // Transformation editor state
  let isTransformationEditorOpen = $state(false);
  let isTransformationEditorMounted = $state(false);
  let activeTransformationEndpointIndex: number | null = $state(null);

  // Assertion editor state
  let isAssertionEditorOpen = $state(false);
  let isAssertionEditorMounted = $state(false);
  let activeAssertionEndpointIndex: number | null = $state(null);

  // Drag and drop state
  let draggedEndpointIndex = $state(-1);
  let dropTargetIndex = $state(-1);

  let stepLabel = $state(step.label || '');

  // Helper to find an endpoint by ID
  function findEndpoint(id: string | number): Endpoint | undefined {
    return endpoints.find((e) => e.id === id);
  }

  // Helper to calculate endpoint metrics
  function getEndpointMetrics(endpointId: string | number, currentIndex: number) {
    const duplicateCount = step.endpoints.filter((e) => e.endpoint_id === endpointId).length;

    const instanceIndex = step.endpoints
      .slice(0, currentIndex + 1)
      .filter((e) => e.endpoint_id === endpointId).length;

    return { duplicateCount, instanceIndex };
  }

  // Helper to get editor props for a specific endpoint
  function getEditorProps(endpointIndex: number) {
    const stepEndpoint = step.endpoints[endpointIndex];
    const endpoint = findEndpoint(stepEndpoint.endpoint_id);
    const { duplicateCount, instanceIndex } = getEndpointMetrics(
      stepEndpoint.endpoint_id,
      endpointIndex
    );

    return {
      endpoint,
      stepEndpoint,
      duplicateCount,
      instanceIndex,
      endpointIndex
    };
  }

  function removeEndpoint(endpointIndex: number) {
    dispatch('removeEndpoint', { stepIndex, endpointIndex });
  }

  function moveStepUp() {
    dispatch('moveStep', { stepIndex, direction: 'up' });
  }

  function moveStepDown() {
    dispatch('moveStep', { stepIndex, direction: 'down' });
  }

  // Compute the current execution state for the step
  function computeStepExecutionState(executionStore: ExecutionState, step: any) {
    if (!step || !step.endpoints || step.endpoints.length === 0) {
      return { status: 'none' };
    }

    // Check if all endpoints have been processed
    const endpointStates = step.endpoints.map((stepEndpoint: StepEndpoint, index: number) => {
      // IMPORTANT: We've updated the endpointId format in FlowRunner to use stepId-endpointIndex
      // instead of endpoint.endpoint_id-endpointIndex for better user reference
      const endpointId = `${step.step_id}-${index}`;
      return executionStore[endpointId]?.status || 'none';
    });

    // Check if any endpoints are currently running
    if (endpointStates.some((state: string) => state === 'running')) {
      return { status: 'running' };
    }

    // Check if all endpoints have completed successfully
    if (endpointStates.every((state: string) => state === 'completed')) {
      return { status: 'completed' };
    }

    // Check if any endpoints have failed
    if (endpointStates.some((state: string) => state === 'failed')) {
      return { status: 'failed' };
    }

    // Some endpoints have been executed but not all
    if (endpointStates.some((state: string) => state === 'completed')) {
      return { status: 'partial' };
    }

    return { status: 'none' };
  }

  // Open parameter editor panel for a specific endpoint
  function openParamEditor(payload: EndpointIndexPayload) {
    const { endpointIndex } = payload;
    activeEndpointIndex = endpointIndex;

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

  // Handle parameter changes
  function handleParamChange() {
    dispatch('change');
  }

  // Open response viewer panel for a specific endpoint
  function openResponseViewer(payload: EndpointIndexPayload) {
    const { endpointIndex } = payload;
    activeResponseEndpointIndex = endpointIndex;

    // First set the panel as mounted but with transform to the right
    isResponseViewerMounted = true;
    isResponseViewerOpen = false;

    // Add a class to the body to prevent scrolling while modal is open
    document.body.classList.add('overflow-hidden');

    // Use requestAnimationFrame to ensure the DOM is updated before applying the animation
    requestAnimationFrame(() => {
      // Then in the next frame, trigger the animation by setting open to true
      isResponseViewerOpen = true;
    });
  }

  // Close response viewer panel
  function closeResponseViewer() {
    isResponseViewerOpen = false;

    // Add a small delay to allow for animation to complete before unmounting
    setTimeout(() => {
      isResponseViewerMounted = false;
      activeResponseEndpointIndex = null;

      // Remove the class from body to re-enable scrolling
      document.body.classList.remove('overflow-hidden');
    }, 300);
  }

  // Open transformation editor panel for a specific endpoint
  function openTransformationEditor(payload: EndpointIndexPayload) {
    const { endpointIndex } = payload;
    activeTransformationEndpointIndex = endpointIndex;

    // First set the panel as mounted but with transform to the right
    isTransformationEditorMounted = true;
    isTransformationEditorOpen = false;

    // Add a class to the body to prevent scrolling while modal is open
    document.body.classList.add('overflow-hidden');

    // Use requestAnimationFrame to ensure the DOM is updated before applying the animation
    requestAnimationFrame(() => {
      // Then in the next frame, trigger the animation by setting open to true
      isTransformationEditorOpen = true;
    });
  }

  // Close transformation editor panel
  function closeTransformationEditor() {
    isTransformationEditorOpen = false;

    // Add a small delay to allow for animation to complete before unmounting
    setTimeout(() => {
      isTransformationEditorMounted = false;
      activeTransformationEndpointIndex = null;

      // Remove the class from body to re-enable scrolling
      document.body.classList.remove('overflow-hidden');
    }, 300);
  }

  // Open assertion editor panel for a specific endpoint
  function openAssertionEditor(payload: EndpointIndexPayload) {
    const { endpointIndex } = payload;
    activeAssertionEndpointIndex = endpointIndex;

    // First set the panel as mounted but with transform to the right
    isAssertionEditorMounted = true;
    isAssertionEditorOpen = false;

    // Add a class to the body to prevent scrolling while modal is open
    document.body.classList.add('overflow-hidden');

    // Use requestAnimationFrame to ensure the DOM is updated before applying the animation
    requestAnimationFrame(() => {
      // Then in the next frame, trigger the animation by setting open to true
      isAssertionEditorOpen = true;
    });
  }

  // Close assertion editor panel
  function closeAssertionEditor() {
    isAssertionEditorOpen = false;

    // Add a small delay to allow for animation to complete before unmounting
    setTimeout(() => {
      isAssertionEditorMounted = false;
      activeAssertionEndpointIndex = null;

      // Remove the class from body to re-enable scrolling
      document.body.classList.remove('overflow-hidden');
    }, 300);
  }

  // Handle transformation changes
  function handleTransformationChange() {
    dispatch('change');
  }

  // Drag and drop handlers
  function handleEndpointDragStart(payload: EndpointIndexPayload) {
    draggedEndpointIndex = payload.endpointIndex;
    console.log('Endpoint drag started:', { draggedEndpointIndex });
  }

  function handleEndpointDragEnd() {
    console.log('Endpoint drag ended:', { draggedEndpointIndex, dropTargetIndex });
    draggedEndpointIndex = -1;
    dropTargetIndex = -1;
  }

  function handleEndpointDragOver(event: DragEvent, index: number) {
    event.preventDefault();
    if (draggedEndpointIndex !== -1 && draggedEndpointIndex !== index) {
      dropTargetIndex = index;
      console.log('Endpoint drag over:', { draggedEndpointIndex, dropTargetIndex, index });
    }
  }

  function handleEndpointDrop(event: DragEvent, index: number) {
    event.preventDefault();
    console.log('Endpoint drop event:', { draggedEndpointIndex, index });
    if (draggedEndpointIndex !== -1 && draggedEndpointIndex !== index) {
      // Reorder endpoints
      reorderEndpoint(draggedEndpointIndex, index);
    }
    dropTargetIndex = -1;
    draggedEndpointIndex = -1;
  }

  function reorderEndpoint(fromIndex: number, toIndex: number) {
    const sortedEndpointsList = sortedEndpoints;
    const fromOriginalIndex = sortedEndpointsList[fromIndex].originalIndex;
    const toOriginalIndex = sortedEndpointsList[toIndex].originalIndex;

    // Create a new array with reordered endpoints
    const newEndpoints = [...step.endpoints];
    const [movedEndpoint] = newEndpoints.splice(fromOriginalIndex, 1);
    newEndpoints.splice(toOriginalIndex, 0, movedEndpoint);

    // Update order property for all endpoints to maintain consistent ordering
    newEndpoints.forEach((endpoint, index) => {
      endpoint.order = index;
    });

    // Update the step endpoints
    step.endpoints = newEndpoints;
    dispatch('change');
  }

  // Keyboard navigation handlers
  function handleMoveLeft(payload: EndpointIndexPayload) {
    const currentIndex = sortedEndpoints.findIndex(
      (item) => item.originalIndex === payload.endpointIndex
    );
    if (currentIndex > 0) {
      reorderEndpoint(currentIndex, currentIndex - 1);
    }
  }

  function handleMoveRight(payload: EndpointIndexPayload) {
    const currentIndex = sortedEndpoints.findIndex(
      (item) => item.originalIndex === payload.endpointIndex
    );
    if (currentIndex < sortedEndpoints.length - 1) {
      reorderEndpoint(currentIndex, currentIndex + 1);
    }
  }

  function commitStepLabel() {
    const label = stepLabel.trim() || `Step ${stepIndex + 1}`;
    stepLabel = label;
    step.label = label;
    dispatch('change');
  }

  function updateClearCookies(event: Event) {
    if (!(event.target instanceof HTMLInputElement)) return;

    step.clearCookiesBeforeExecution = event.target.checked;
    dispatch('change');
  }

  $effect(() => {
    stepLabel = step.label || '';
  });

  // Computed property to handle undefined clearCookiesBeforeExecution values
  let clearCookiesEnabled = $derived(step.clearCookiesBeforeExecution === true);
  // Sort endpoints by order field, fallback to array index
  let sortedEndpoints = $derived(
    step.endpoints
      .map((endpoint, index) => ({ endpoint, originalIndex: index }))
      .sort((a, b) => {
        const orderA = a.endpoint.order ?? a.originalIndex;
        const orderB = b.endpoint.order ?? b.originalIndex;
        return orderA - orderB;
      })
  );
  // Ensure all endpoints have order values (migration for old flows)
  $effect(() => {
    let needsUpdate = false;
    step.endpoints.forEach((endpoint, index) => {
      if (endpoint.order === undefined) {
        endpoint.order = index;
        needsUpdate = true;
      }
    });
    if (needsUpdate) {
      dispatch('change');
    }
  });
  // Helper to determine step execution state
  let stepExecutionState = $derived(computeStepExecutionState(executionStore, step));
</script>

<div
  class="rounded-lg border bg-white p-4 shadow-sm
  {stepExecutionState.status === 'completed' ? 'border-2 border-green-300' : ''} 
  {stepExecutionState.status === 'failed' ? 'border-2 border-red-300' : ''}
  {stepExecutionState.status === 'running' ? 'border-2 border-blue-300' : ''}>"
>
  <div class="mb-4 flex items-center justify-between">
    <h3 class="flex items-center text-lg font-medium">
      <span class="mr-2 rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">
        {step.step_id}
      </span>

      <!-- Editable step label -->
      <span class="group relative">
        <input
          type="text"
          bind:value={stepLabel}
          class="border-b border-transparent bg-transparent px-1 py-0 pr-6 text-lg font-medium group-hover:border-gray-300 focus:border-blue-500 focus:outline-none"
          title="Click to edit step name"
          placeholder={`Step ${stepIndex + 1}`}
          class:text-gray-400={!stepLabel || stepLabel.trim() === ''}
          onfocus={(e) => {
            if (e.target && e.target instanceof HTMLInputElement) {
              e.target.select();
            }
          }}
          onblur={commitStepLabel}
          onkeydown={(e: KeyboardEvent) => {
            if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
              e.target.blur();
            }
          }}
        />
        <span
          class="absolute top-1/2 right-0 -translate-y-1/2 transform text-gray-400 opacity-0 transition-opacity group-hover:opacity-100"
        >
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
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
        </span>
      </span>

      <!-- Step execution status indicator -->
      {#if stepExecutionState.status === 'running'}
        <span class="ml-2 inline-flex items-center">
          <svg
            class="h-4 w-4 animate-spin text-blue-500"
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
          <span class="ml-1 text-xs text-blue-500">Running...</span>
        </span>
      {:else if stepExecutionState.status === 'completed'}
        <span class="ml-2 inline-flex items-center text-xs text-green-500">
          <svg class="mr-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd"
            ></path>
          </svg>
          Completed
        </span>
      {:else if stepExecutionState.status === 'failed'}
        <span class="ml-2 inline-flex items-center text-xs text-red-500">
          <svg class="mr-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clip-rule="evenodd"
            ></path>
          </svg>
          Failed
        </span>
      {/if}

      <!-- Run step button - always visible, disabled during execution -->
      <button
        class="ml-2 inline-flex items-center rounded-md px-2 py-1 text-xs transition-colors
          {stepExecutionState.status === 'running'
          ? 'cursor-not-allowed bg-gray-100 text-gray-400'
          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}"
        onclick={() => dispatch('runStep', { stepIndex })}
        disabled={stepExecutionState.status === 'running'}
        title={stepExecutionState.status === 'running'
          ? 'Step is currently running'
          : 'Run this step'}
      >
        <svg class="mr-1 h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
            clip-rule="evenodd"
          />
        </svg>
        Run Step
      </button>

      <!-- Clear Cookies Toggle - only show from step 2 onwards -->
      {#if stepIndex >= 1}
        <div class="ml-3 flex items-center">
          <label class="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={clearCookiesEnabled}
              class="peer sr-only"
              disabled={isRunning}
              onchange={updateClearCookies}
            />
            <div
              class="peer h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-orange-500 peer-focus:ring-2 peer-focus:ring-orange-300 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"
              class:opacity-50={isRunning}
              class:cursor-not-allowed={isRunning}
            ></div>
            <span
              class="ml-2 text-xs text-gray-600"
              title="Clear all stored cookies before this step executes. Useful when you need to test different user roles (e.g., Step 1: Login as customer, Step 2: Clear cookies + Login as admin)"
            >
              🍪 Clear
            </span>
          </label>
        </div>
      {/if}
    </h3>
    <div class="flex items-center space-x-2">
      {#if !isFirstStep}
        <button
          class="p-1 text-gray-600 hover:text-gray-800"
          onclick={moveStepUp}
          aria-label="Move Step Up"
          title="Move Step Up"
          disabled={isRunning}
          class:opacity-50={isRunning}
          class:cursor-not-allowed={isRunning}
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"
            ></path>
          </svg>
        </button>
      {/if}

      {#if !isLastStep}
        <button
          class="p-1 text-gray-600 hover:text-gray-800"
          onclick={moveStepDown}
          aria-label="Move Step Down"
          title="Move Step Down"
          disabled={isRunning}
          class:opacity-50={isRunning}
          class:cursor-not-allowed={isRunning}
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"
            ></path>
          </svg>
        </button>
      {/if}

      <button
        class="p-1 text-red-600 hover:text-red-800"
        onclick={() => dispatch('removeStep', { stepIndex })}
        aria-label="Remove Step"
        disabled={isRunning}
        class:opacity-50={isRunning}
        class:cursor-not-allowed={isRunning}
      >
        <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fill-rule="evenodd"
            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
            clip-rule="evenodd"
          ></path>
        </svg>
      </button>
    </div>
  </div>

  <!-- Endpoints in this step -->
  <div class="mb-4">
    <div class="mb-2 flex items-center justify-between">
      <h4 class="text-sm font-medium text-gray-500">Endpoints:</h4>
      <div class="group relative">
        <button
          class="text-gray-400 hover:text-gray-600 focus:outline-none"
          aria-label="Information about adding endpoints"
        >
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
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>
        <div
          class="invisible absolute right-0 z-10 w-64 translate-y-2 transform rounded bg-gray-800 p-2 text-xs text-white opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100"
        >
          All endpoints in the same step are executed concurrently by default
        </div>
      </div>
    </div>

    {#if step.endpoints.length === 0}
      <!-- When no endpoints, show selector and message side by side -->
      <div class="flex flex-row gap-3">
        <div class="flex-shrink-0">
          {@render endpointSelector?.()}
        </div>
        <div class="flex items-center text-sm text-gray-400 italic">
          No endpoints in this step yet
        </div>
      </div>
    {:else}
      <!-- Show selector on the left (sticky), then all endpoint cards (scrollable) -->
      <div class="flex flex-row gap-3">
        <div class="sticky left-0 z-10 flex-shrink-0 bg-white">
          {@render endpointSelector?.()}
        </div>
        <div class="flex flex-1 flex-row gap-3 overflow-x-auto pb-2">
          {#each sortedEndpoints as { endpoint: stepEndpoint, originalIndex }, sortedIndex (`${stepEndpoint.endpoint_id}-${originalIndex}`)}
            {@const endpoint = findEndpoint(stepEndpoint.endpoint_id)}
            {@const { duplicateCount, instanceIndex } = getEndpointMetrics(
              stepEndpoint.endpoint_id,
              originalIndex
            )}

            {#if endpoint}
              <EndpointCard
                {endpoint}
                {stepEndpoint}
                endpointIndex={originalIndex}
                {stepIndex}
                stepId={step.step_id}
                executionState={executionStore}
                {duplicateCount}
                {instanceIndex}
                {apiHosts}
                isDragging={draggedEndpointIndex === sortedIndex}
                isDropTarget={dropTargetIndex === sortedIndex}
                onOpenParamEditor={openParamEditor}
                onOpenTransformationEditor={openTransformationEditor}
                onOpenResponseViewer={openResponseViewer}
                onOpenAssertionEditor={openAssertionEditor}
                onRemoveEndpoint={() => removeEndpoint(originalIndex)}
                onDragstart={handleEndpointDragStart}
                onDragend={handleEndpointDragEnd}
                onDragover={(payload: EndpointDragPayload) =>
                  handleEndpointDragOver(payload.event, sortedIndex)}
                onDrop={(payload: EndpointDragPayload) =>
                  handleEndpointDrop(payload.event, sortedIndex)}
                onMoveLeft={handleMoveLeft}
                onMoveRight={handleMoveRight}
              />
            {:else}
              <!-- Show error card for missing endpoint -->
              <div class="w-80 flex-shrink-0 rounded-lg border-2 border-red-200 bg-red-50 p-4">
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="flex items-center">
                      <svg
                        class="mr-2 h-4 w-4 text-red-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                          clip-rule="evenodd"
                        />
                      </svg>
                      <span class="text-sm font-medium text-red-800">Missing Endpoint</span>
                    </div>
                    <p class="mt-1 text-xs text-red-700">
                      Endpoint ID: <code class="rounded bg-red-100 px-1"
                        >{stepEndpoint.endpoint_id}</code
                      >
                    </p>
                    <p class="mt-1 text-xs text-red-600">
                      This endpoint no longer exists in the API specification. It may have been
                      removed or renamed.
                    </p>
                    {#if duplicateCount > 1}
                      <p class="mt-1 text-xs text-red-600">
                        Instance {instanceIndex} of {duplicateCount}
                      </p>
                    {/if}
                  </div>
                  <button
                    class="ml-2 rounded p-1 text-red-600 hover:bg-red-100 hover:text-red-800"
                    onclick={() => removeEndpoint(originalIndex)}
                    title="Remove this missing endpoint"
                    aria-label="Remove missing endpoint"
                  >
                    <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fill-rule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <!-- Remove the separate endpoint selector section -->
</div>

<!-- Parameter Editor Slide-out Panel -->
{#if isParamEditorMounted && activeEndpointIndex !== null}
  {@const { endpoint, stepEndpoint, duplicateCount, instanceIndex, endpointIndex } =
    getEditorProps(activeEndpointIndex)}

  {#if endpoint}
    <ParameterEditor
      isOpen={isParamEditorOpen}
      isMounted={true}
      {endpoint}
      {stepEndpoint}
      {stepIndex}
      {endpointIndex}
      {duplicateCount}
      {instanceIndex}
      {previewTemplateContext}
      onClose={closeParamEditor}
      onChange={handleParamChange}
    />
  {/if}
{/if}

<!-- Response Viewer Slide-out Panel -->
{#if isResponseViewerMounted && activeResponseEndpointIndex !== null}
  {@const { endpoint, stepEndpoint, duplicateCount, instanceIndex, endpointIndex } = getEditorProps(
    activeResponseEndpointIndex
  )}

  {#if endpoint}
    <ResponseViewer
      isOpen={isResponseViewerOpen}
      {endpoint}
      {endpointIndex}
      stepId={step.step_id}
      {duplicateCount}
      {instanceIndex}
      executionState={executionStore}
      onClose={closeResponseViewer}
    />
  {/if}
{/if}

<!-- Transformation Editor Slide-out Panel -->
{#if isTransformationEditorMounted && activeTransformationEndpointIndex !== null}
  {@const { endpoint, stepEndpoint, duplicateCount, instanceIndex, endpointIndex } = getEditorProps(
    activeTransformationEndpointIndex
  )}

  {#if endpoint}
    <TransformationEditor
      isOpen={isTransformationEditorOpen}
      isMounted={true}
      {endpoint}
      {stepEndpoint}
      {duplicateCount}
      {instanceIndex}
      transformationResults={executionStore[`${step.step_id}-${endpointIndex}`]?.transformations ||
        {}}
      rawResponse={executionStore[`${step.step_id}-${endpointIndex}`]?.response?.body}
      hasExecutionData={!!executionStore[`${step.step_id}-${endpointIndex}`]?.response}
      previewResponse={previewTemplateContext?.responses[`${step.step_id}-${endpointIndex}`]}
      hasPreviewData={!!previewTemplateContext?.responses[`${step.step_id}-${endpointIndex}`]}
      previewSourceLabel={previewTemplateContext?.responseSources[
        `${step.step_id}-${endpointIndex}`
      ]?.label || 'schema sample'}
      {templateContext}
      onClose={closeTransformationEditor}
      onChange={handleTransformationChange}
    />
  {/if}
{/if}

<!-- Assertion Editor Slide-out Panel -->
{#if isAssertionEditorMounted && activeAssertionEndpointIndex !== null}
  {@const { endpoint, stepEndpoint, duplicateCount, instanceIndex, endpointIndex } = getEditorProps(
    activeAssertionEndpointIndex
  )}

  {#if endpoint}
    <AssertionEditor
      isOpen={isAssertionEditorOpen}
      isMounted={true}
      {endpoint}
      {stepEndpoint}
      {stepIndex}
      {endpointIndex}
      {duplicateCount}
      {instanceIndex}
      assertionResults={executionStore[`${step.step_id}-${endpointIndex}`]?.assertions || {
        passed: true,
        results: []
      }}
      hasExecutionData={!!executionStore[`${step.step_id}-${endpointIndex}`]?.response}
      onClose={closeAssertionEditor}
      onChange={handleParamChange}
    />
  {/if}
{/if}
