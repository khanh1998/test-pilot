<!-- FlowCard.svelte - Compact flow card for sequence rows -->
<script lang="ts">
  function stopPropagation<T extends Event>(handler: (event: T) => unknown) {
    return (event: T) => {
      event.stopPropagation();
      return handler(event);
    };
  }

  import type { TestFlow } from '../../types/test-flow.js';
  import type { SequenceFlowResult } from '$lib/sequence-runner/types';
  import type { FlowSequenceStep } from '../../types/flow_sequence.js';
  import { normalizeFlowLoopConfig } from '../../types/flow_sequence.js';

  interface Props {
    [key: string]: unknown;
    flow: TestFlow;
    stepOrder: number;
    isDragging?: boolean;
    isDropTarget?: boolean;
    executionResults?: SequenceFlowResult[];
    isFirst?: boolean;
    isLast?: boolean;
    isMoving?: boolean;
    sequenceStep?: FlowSequenceStep | undefined;
  }

  let {
    flow,
    stepOrder,
    isDragging = false,
    isDropTarget = false,
    executionResults = [],
    isFirst = false,
    isLast = false,
    isMoving = false,
    sequenceStep = undefined,
    ...callbackProps
  }: Props & Record<string, unknown> = $props();

  // State for toggling between inputs and outputs
  let activeTab: 'outputs' | 'inputs' = $state('outputs');

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

  function handleClick() {
    dispatch('click', { flow, stepOrder });
  }

  function handleDragStart(event: DragEvent) {
    // Only allow drag if it originated from the drag handle
    const target = event.target as HTMLElement;
    if (!target.closest('.drag-handle')) {
      event.preventDefault();
      return;
    }

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', JSON.stringify({ flowId: flow.id, stepOrder }));

      // Set the entire card as the drag image instead of just the handle
      const cardElement = target.closest('.flow-card') as HTMLElement;
      if (cardElement) {
        // Create a clone for the drag image to avoid affecting the original
        const dragImage = cardElement.cloneNode(true) as HTMLElement;
        dragImage.style.position = 'absolute';
        dragImage.style.top = '-9999px';
        document.body.appendChild(dragImage);

        // Set the drag image to the card clone
        event.dataTransfer.setDragImage(
          dragImage,
          cardElement.offsetWidth / 2,
          cardElement.offsetHeight / 2
        );

        // Clean up the clone after a brief delay
        setTimeout(() => {
          document.body.removeChild(dragImage);
        }, 0);
      }
    }
    console.log('FlowCard drag start:', { flowId: flow.id, stepOrder });
    dispatch('dragstart', { flow, stepOrder });
  }

  function handleDragEnd() {
    console.log('FlowCard drag end:', { flowId: flow.id, stepOrder });
    dispatch('dragend');
  }

  function handleRemove(event: MouseEvent) {
    event.stopPropagation();
    dispatch('remove', { stepOrder });
  }

  function handleEdit(event: MouseEvent) {
    event.stopPropagation();
    dispatch('click', { flow, stepOrder });
  }

  function handleViewDetails(event: MouseEvent) {
    event.stopPropagation();
    window.location.href = `/projects/test-flows/${flow.id}`;
  }

  function handleShowResults(event: MouseEvent) {
    event.stopPropagation();
    if (executionResult) {
      dispatch('showResults', { flow, stepOrder, executionResult });
    }
  }

  function handleMoveLeft(event: MouseEvent) {
    event.stopPropagation();
    dispatch('moveLeft', { stepOrder });
  }

  function handleMoveRight(event: MouseEvent) {
    event.stopPropagation();
    dispatch('moveRight', { stepOrder });
  }

  function handleToggleExpectsError(event: MouseEvent) {
    event.stopPropagation();
    const newExpectsError = !expectsError;
    dispatch('toggleExpectsError', { stepOrder, expectsError: newExpectsError });
  }

  function getLoopSummary(step: FlowSequenceStep | undefined): string {
    const loopConfig = normalizeFlowLoopConfig(step?.loop_config);
    if (!loopConfig?.enabled) return '';

    const formatLoop = (loop: NonNullable<typeof loopConfig.root>): string => {
      const aliases = (loop.sources || []).map((source) => source.alias || '?').join(',');
      const current = `${loop.name || 'loop'}[${aliases || '?'}]`;
      const child = loop.children?.[0];
      return child ? `${current} -> ${formatLoop(child)}` : current;
    };

    if (loopConfig.root) {
      return `Loop: ${formatLoop(loopConfig.root)}`;
    }

    return 'Loop';
  }

  // Find execution result for this flow and step
  let executionResult = $derived(
    executionResults.find((result) => {
      const flowIdNum = parseInt(flow.id);
      const match = result.flowId === flowIdNum && result.stepOrder === stepOrder;
      return match;
    }) || null
  );

  // Get expects error state from sequence step
  let expectsError = $derived(sequenceStep?.expects_error ?? false);
  let loopSummary = $derived(getLoopSummary(sequenceStep));

  // Determine execution status for visual indicators
  let executionStatus = $derived(
    executionResult
      ? executionResult.matchedExpectation !== undefined
        ? executionResult.matchedExpectation
          ? 'expected'
          : 'unexpected'
        : executionResult.success
          ? 'success'
          : 'error'
      : 'none'
  );
  let hasResults = $derived(executionResult !== null);
  let loopResult = $derived(executionResult?.loop || null);

  // Debug logging
  $effect(() => {
    const flowIdNum = parseInt(flow.id);
    console.log(
      `🎯 FlowCard ${flow.name} (flowId=${flowIdNum}, stepOrder=${stepOrder}): executionResult=`,
      executionResult
    );
    console.log(
      `🎯 FlowCard ${flow.name}: hasResults=${hasResults}, executionStatus=${executionStatus}`
    );
    if (executionResults.length > 0) {
      console.log(
        `🎯 FlowCard ${flow.name}: Available results:`,
        executionResults.map((r) => ({
          flowId: r.flowId,
          stepOrder: r.stepOrder,
          success: r.success
        }))
      );
    }
  });
</script>

<div
  class="flow-card group relative flex h-[240px] w-80 flex-col overflow-hidden rounded-lg border bg-white transition-all duration-200 hover:shadow-md {executionStatus ===
  'expected'
    ? 'border-green-300 bg-green-50'
    : executionStatus === 'unexpected'
      ? 'border-red-300 bg-red-50'
      : executionStatus === 'success'
        ? 'border-green-300 bg-green-50'
        : executionStatus === 'error'
          ? 'border-red-300 bg-red-50'
          : 'border-gray-200'}"
  class:opacity-50={isDragging}
  class:border-blue-400={isDropTarget}
  class:bg-blue-50={isDropTarget}
  class:shadow-lg={isDragging}
  class:moving-highlight={isMoving}
  role="region"
  aria-label="Flow card"
>
  <!-- Status Bar at Top -->
  {#if executionStatus !== 'none'}
    <div
      class="h-1 w-full flex-shrink-0 {executionStatus === 'expected'
        ? 'bg-green-500'
        : executionStatus === 'unexpected'
          ? 'bg-red-500'
          : executionStatus === 'success'
            ? 'bg-green-500'
            : 'bg-red-500'}"
    ></div>
  {:else}
    <div class="h-1 w-full flex-shrink-0"></div>
  {/if}

  <!-- Card Content -->
  <div class="flex min-h-0 flex-1 flex-col p-4">
    <!-- Header Section -->
    <div class="mb-3 flex-shrink-0">
      <!-- Flow Name -->
      <div class="mb-1 flex items-start justify-between gap-2">
        <h4 class="flex-1 truncate text-base font-semibold text-gray-900" title={flow.name}>
          {flow.name}
        </h4>
        {#if expectsError}
          <span
            class="inline-flex flex-shrink-0 items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800"
            title="This step is expected to fail"
          >
            <svg class="mr-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Expects Error
          </span>
        {/if}
        {#if loopSummary}
          <span
            class="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-800"
            title={loopSummary}
            aria-label={loopSummary}
          >
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4m14-2v2a4 4 0 01-4 4H3"
              />
            </svg>
          </span>
        {/if}
      </div>

      <!-- Folder Tabs and Action Buttons -->
      <div class="-mb-3 flex items-end justify-between gap-3">
        <!-- Folder Tabs -->
        <div class="flex items-end gap-1 text-xs">
          <button
            type="button"
            class="folder-tab cursor-pointer px-3 py-1.5 transition-all {activeTab === 'inputs'
              ? 'folder-tab-active'
              : 'folder-tab-inactive'}"
            onclick={(e) => {
              e.stopPropagation();
              activeTab = 'inputs';
            }}
            title="Click to view input parameters"
          >
            Inputs
          </button>
          <button
            type="button"
            class="folder-tab cursor-pointer px-3 py-1.5 transition-all {activeTab === 'outputs'
              ? 'folder-tab-active'
              : 'folder-tab-inactive'}"
            onclick={(e) => {
              e.stopPropagation();
              activeTab = 'outputs';
            }}
            title="Click to view outputs"
          >
            Outputs
          </button>
        </div>

        <!-- Action Buttons - Horizontal Row -->
        <div class="mb-1 flex flex-shrink-0 items-center gap-1">
          <!-- Expects Error Toggle -->
          <button
            type="button"
            class="hover:bg-opacity-80 flex h-7 w-7 items-center justify-center rounded shadow-sm transition-colors {expectsError
              ? 'bg-orange-500 text-white hover:bg-orange-600'
              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}"
            onclick={handleToggleExpectsError}
            aria-label="Toggle expects error"
            title={expectsError
              ? 'Currently expecting this step to fail/return error. Click to expect success.'
              : 'Currently expecting this step to succeed. Click to expect failure/error.'}
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>

          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded bg-amber-500 text-white shadow-sm transition-colors hover:bg-amber-600"
            onclick={handleEdit}
            aria-label="Edit flow parameters"
            title="Edit Parameters"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>

          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded bg-blue-500 text-white shadow-sm transition-colors hover:bg-blue-600"
            onclick={handleViewDetails}
            aria-label="View flow details"
            title="View Details"
          >
            <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path
                fill-rule="evenodd"
                d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                clip-rule="evenodd"
              />
            </svg>
          </button>

          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded bg-red-500 text-white shadow-sm transition-colors hover:bg-red-600"
            onclick={handleRemove}
            aria-label="Remove flow"
            title="Remove from Sequence"
          >
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Scrollable Content Area - Show either Inputs or Outputs based on active tab -->
    <div class="scrollable-content min-h-0 flex-1 overflow-y-auto border-t-2 border-blue-200 pt-3">
      {#if activeTab === 'outputs'}
        <!-- Outputs Section -->
        {#if flow.flowJson?.outputs && flow.flowJson.outputs.length > 0}
          <div class="space-y-1.5">
            {#each flow.flowJson.outputs as output}
              <div
                class="flex items-center gap-1.5 truncate text-xs text-gray-700"
                title={output.name}
              >
                <span class="text-blue-500">→</span>
                <span class="font-mono">{output.name}{loopSummary ? '[]' : ''}</span>
              </div>
            {/each}
          </div>
        {:else}
          <div class="text-xs text-gray-400 italic">No outputs defined</div>
        {/if}
      {:else}
        <!-- Parameters Section -->
        {#if flow.flowJson?.parameters && flow.flowJson.parameters.length > 0}
          <div class="space-y-1.5">
            {#each flow.flowJson.parameters as param}
              <div
                class="flex items-center gap-1.5 truncate text-xs text-gray-700"
                title={param.name}
              >
                <span class="text-blue-500">←</span>
                <span class="font-mono">{param.name}</span>
              </div>
            {/each}
          </div>
        {:else}
          <div class="text-xs text-gray-400 italic">No input parameters</div>
        {/if}
      {/if}
    </div>

    <!-- Bottom Section - Fixed at bottom -->
    <div class="flex-shrink-0">
      <!-- View Results Button (shown after execution) -->
      {#if hasResults}
        <div class="mb-3">
          {#if loopResult}
            <div
              class="mb-1 text-center text-xs font-medium {executionStatus === 'expected' ||
              executionStatus === 'success'
                ? 'text-green-700'
                : 'text-red-700'}"
            >
              {loopResult.completedIterations}/{loopResult.totalIterations} iterations
            </div>
          {/if}
          <button
            type="button"
            class="w-full px-3 py-2 {executionStatus === 'expected'
              ? 'bg-green-500 hover:bg-green-600'
              : executionStatus === 'unexpected'
                ? 'bg-red-500 hover:bg-red-600'
                : executionStatus === 'success'
                  ? 'bg-green-500 hover:bg-green-600'
                  : 'bg-red-500 hover:bg-red-600'} flex items-center justify-center gap-2 rounded-md text-sm font-medium text-white shadow-sm transition-colors"
            onclick={handleShowResults}
            aria-label="View execution results"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            {#if executionStatus === 'expected'}
              Behaved as Expected
            {:else if executionStatus === 'unexpected'}
              Unexpected Result
            {:else}
              View Results
            {/if}
          </button>
        </div>
      {/if}

      <!-- Drag Handle and Move Buttons -->
      <div class="border-t border-gray-100 pt-2">
        <div class="flex items-center justify-center gap-2">
          <!-- Move Left Button -->
          {#if !isFirst}
            <button
              type="button"
              class="move-btn flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 transition-all hover:bg-gray-200 hover:text-gray-800"
              onclick={handleMoveLeft}
              aria-label="Move left"
              title="Move left"
            >
              <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          {/if}

          <!-- Drag Handle -->
          <div
            class="drag-handle cursor-grab rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing"
            draggable="true"
            ondragstart={handleDragStart}
            ondragend={handleDragEnd}
            role="button"
            tabindex="0"
            aria-label="Drag to reorder"
            title="Drag to reorder"
          >
            <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"
              />
            </svg>
          </div>

          <!-- Move Right Button -->
          {#if !isLast}
            <button
              type="button"
              class="move-btn flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 transition-all hover:bg-gray-200 hover:text-gray-800"
              onclick={handleMoveRight}
              aria-label="Move right"
              title="Move right"
            >
              <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .scrollable-content {
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 transparent;
  }

  .scrollable-content::-webkit-scrollbar {
    width: 4px;
  }

  .scrollable-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .scrollable-content::-webkit-scrollbar-thumb {
    background-color: #cbd5e1;
    border-radius: 2px;
  }

  .scrollable-content::-webkit-scrollbar-thumb:hover {
    background-color: #94a3b8;
  }

  .move-btn {
    animation: fadeIn 0.2s ease-in;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .moving-highlight {
    border-color: #3b82f6 !important;
    border-width: 3px !important;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2) !important;
    animation: pulse-border 1.2s ease-in-out;
  }

  @keyframes pulse-border {
    0% {
      border-color: #3b82f6;
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
    }
    50% {
      border-color: #3b82f6;
      box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
    }
    100% {
      border-color: #3b82f6;
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
    }
  }

  /* Folder Tab Styles */
  .folder-tab {
    border-top-left-radius: 6px;
    border-top-right-radius: 6px;
    border: 1px solid transparent;
    border-bottom: none;
    position: relative;
  }

  .folder-tab-active {
    background: white;
    color: #1d4ed8;
    font-weight: 600;
    border-color: #bfdbfe;
    border-bottom: 2px solid white;
    z-index: 2;
    margin-bottom: -2px;
  }

  .folder-tab-inactive {
    background: #f3f4f6;
    color: #6b7280;
    border-color: transparent;
  }

  .folder-tab-inactive:hover {
    background: #e5e7eb;
    color: #374151;
  }
</style>
