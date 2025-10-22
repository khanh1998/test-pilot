<!-- FlowCard.svelte - Compact flow card for sequence rows -->
<script lang="ts">
  import type { TestFlow } from '../../types/test-flow.js';
  import type { SequenceFlowResult } from '$lib/sequence-runner/types';
  import { createEventDispatcher } from 'svelte';

  export let flow: TestFlow;
  export let stepOrder: number;
  export let isDragging: boolean = false;
  export let isDropTarget: boolean = false;
  export let executionResults: SequenceFlowResult[] = [];
  export let isFirst: boolean = false;
  export let isLast: boolean = false;
  export let isMoving: boolean = false;

  // State for toggling between inputs and outputs
  let activeTab: 'outputs' | 'inputs' = 'outputs';

  const dispatch = createEventDispatcher<{
    click: { flow: TestFlow; stepOrder: number };
    dragstart: { flow: TestFlow; stepOrder: number };
    dragend: void;
    remove: { stepOrder: number };
    showResults: { flow: TestFlow; stepOrder: number; executionResult: SequenceFlowResult };
    moveLeft: { stepOrder: number };
    moveRight: { stepOrder: number };
  }>();

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
        event.dataTransfer.setDragImage(dragImage, cardElement.offsetWidth / 2, cardElement.offsetHeight / 2);
        
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
    window.location.href = `/dashboard/test-flows/${flow.id}`;
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

  // Find execution result for this flow and step
  $: executionResult = executionResults.find(result => {
    const flowIdNum = parseInt(flow.id);
    const match = result.flowId === flowIdNum && result.stepOrder === stepOrder;
    return match;
  }) || null;

  // Determine execution status for visual indicators
  $: executionStatus = executionResult ? (executionResult.success ? 'success' : 'error') : 'none';
  $: hasResults = executionResult !== null;
  
  // Debug logging
  $: {
    const flowIdNum = parseInt(flow.id);
    console.log(`🎯 FlowCard ${flow.name} (flowId=${flowIdNum}, stepOrder=${stepOrder}): executionResult=`, executionResult);
    console.log(`🎯 FlowCard ${flow.name}: hasResults=${hasResults}, executionStatus=${executionStatus}`);
    if (executionResults.length > 0) {
      console.log(`🎯 FlowCard ${flow.name}: Available results:`, executionResults.map(r => ({ flowId: r.flowId, stepOrder: r.stepOrder, success: r.success })));
    }
  }
</script>

<div
  class="flow-card group relative bg-white border rounded-lg overflow-hidden hover:shadow-md transition-all duration-200 w-80 h-[240px] flex flex-col {executionStatus === 'success' 
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
    <div class="h-1 w-full flex-shrink-0 {executionStatus === 'success' ? 'bg-green-500' : 'bg-red-500'}"></div>
  {:else}
    <div class="h-1 w-full flex-shrink-0"></div>
  {/if}

  <!-- Card Content -->
  <div class="p-4 flex-1 flex flex-col min-h-0">
    <!-- Header Section -->
    <div class="mb-3 flex-shrink-0">
      <!-- Flow Name -->
      <div class="flex items-start justify-between gap-2 mb-1">
        <h4 class="text-base font-semibold text-gray-900 truncate flex-1" title={flow.name}>
          {flow.name}
        </h4>
      </div>
      
      <!-- Folder Tabs and Action Buttons -->
      <div class="flex items-end justify-between gap-3 -mb-3">
        <!-- Folder Tabs -->
        <div class="flex items-end gap-1 text-xs">
          <button
            type="button"
            class="folder-tab px-3 py-1.5 cursor-pointer transition-all {activeTab === 'inputs' ? 'folder-tab-active' : 'folder-tab-inactive'}"
            on:click={(e) => { e.stopPropagation(); activeTab = 'inputs'; }}
            title="Click to view input parameters"
          >
            Inputs
          </button>
          <button
            type="button"
            class="folder-tab px-3 py-1.5 cursor-pointer transition-all {activeTab === 'outputs' ? 'folder-tab-active' : 'folder-tab-inactive'}"
            on:click={(e) => { e.stopPropagation(); activeTab = 'outputs'; }}
            title="Click to view outputs"
          >
            Outputs
          </button>
        </div>

        <!-- Action Buttons - Horizontal Row -->
        <div class="flex items-center gap-1 flex-shrink-0 mb-1">
          <button
            type="button"
            class="w-7 h-7 bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors flex items-center justify-center shadow-sm"
            on:click={handleEdit}
            aria-label="Edit flow parameters"
            title="Edit Parameters"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>

          <button
            type="button"
            class="w-7 h-7 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center justify-center shadow-sm"
            on:click={handleViewDetails}
            aria-label="View flow details"
            title="View Details"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
              <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
            </svg>
          </button>
          
          <button
            type="button"
            class="w-7 h-7 bg-red-500 text-white rounded hover:bg-red-600 transition-colors flex items-center justify-center shadow-sm"
            on:click={handleRemove}
            aria-label="Remove flow"
            title="Remove from Sequence"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Scrollable Content Area - Show either Inputs or Outputs based on active tab -->
    <div class="flex-1 overflow-y-auto min-h-0 scrollable-content pt-3 border-t-2 border-blue-200">
      {#if activeTab === 'outputs'}
        <!-- Outputs Section -->
        {#if flow.flowJson?.outputs && flow.flowJson.outputs.length > 0}
          <div class="space-y-1.5">
            {#each flow.flowJson.outputs as output}
              <div class="text-xs text-gray-700 truncate flex items-center gap-1.5" title={output.name}>
                <span class="text-blue-500">→</span>
                <span class="font-mono">{output.name}</span>
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
              <div class="text-xs text-gray-700 truncate flex items-center gap-1.5" title={param.name}>
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
          <button
            type="button"
            class="w-full py-2 px-3 {executionStatus === 'success' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white rounded-md transition-colors flex items-center justify-center gap-2 font-medium text-sm shadow-sm"
            on:click={handleShowResults}
            aria-label="View execution results"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            View Results
          </button>
        </div>
      {/if}

      <!-- Drag Handle and Move Buttons -->
      <div class="pt-2 border-t border-gray-100">
        <div class="flex items-center justify-center gap-2">
          <!-- Move Left Button -->
          {#if !isFirst}
            <button
              type="button"
              class="move-btn px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 rounded transition-all flex items-center gap-1 text-xs font-medium"
              on:click={handleMoveLeft}
              aria-label="Move left"
              title="Move left"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
          {/if}
          
          <!-- Drag Handle -->
          <div 
            class="drag-handle text-gray-400 hover:text-gray-600 transition-colors cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-100"
            draggable="true"
            on:dragstart={handleDragStart}
            on:dragend={handleDragEnd}
            role="button"
            tabindex="0"
            aria-label="Drag to reorder"
            title="Drag to reorder"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/>
            </svg>
          </div>
          
          <!-- Move Right Button -->
          {#if !isLast}
            <button
              type="button"
              class="move-btn px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 rounded transition-all flex items-center gap-1 text-xs font-medium"
              on:click={handleMoveRight}
              aria-label="Move right"
              title="Move right"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
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
