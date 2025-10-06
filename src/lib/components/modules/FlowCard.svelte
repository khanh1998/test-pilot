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

  const dispatch = createEventDispatcher<{
    click: { flow: TestFlow; stepOrder: number };
    dragstart: { flow: TestFlow; stepOrder: number };
    dragend: void;
    remove: { stepOrder: number };
    showResults: { flow: TestFlow; stepOrder: number; executionResult: SequenceFlowResult };
  }>();

  function handleClick() {
    dispatch('click', { flow, stepOrder });
  }

  function handleDragStart(event: DragEvent) {
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', JSON.stringify({ flowId: flow.id, stepOrder }));
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
  class="flow-card group relative bg-white border rounded-lg p-3 cursor-pointer hover:shadow-md transition-all duration-200 w-72 h-40 {executionStatus === 'success' 
    ? 'border-green-300 bg-green-50' 
    : executionStatus === 'error' 
    ? 'border-red-300 bg-red-50' 
    : 'border-gray-200'}"
  class:opacity-50={isDragging}
  class:border-blue-400={isDropTarget}
  class:bg-blue-50={isDropTarget}
  class:shadow-lg={isDragging}
  class:cursor-grabbing={isDragging}
  class:cursor-grab={!isDragging}
  draggable="true"
  on:click={handleClick}
  on:dragstart={handleDragStart}
  on:dragend={handleDragEnd}
  role="button"
  tabindex="0"
  on:keydown={(e) => e.key === 'Enter' && handleClick()}
>
  <!-- Flow Content -->
  <div class="h-full flex flex-col">
    <!-- Execution Status Indicator -->
    {#if executionStatus !== 'none'}
      <div class="absolute top-2 right-2 flex items-center gap-1">
        {#if executionStatus === 'success'}
          <div class="w-3 h-3 bg-green-500 rounded-full flex items-center justify-center">
            <svg class="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
          </div>
        {:else if executionStatus === 'error'}
          <div class="w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
            <svg class="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Header with Flow Name and Action Buttons -->
    <div class="flex items-start justify-between mb-2">
      <h4 class="text-sm font-medium text-gray-900 line-clamp-1 flex-1 pr-2" title={flow.name}>
        {flow.name}
      </h4>
      
      <!-- Action Buttons -->
      <div class="flex-shrink-0 flex items-center gap-1">
        <!-- Results Button (only show if has execution results) -->
        {#if hasResults}
          <button
            type="button"
            class="w-5 h-5 {executionStatus === 'success' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white text-xs rounded-full transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center"
            on:click={handleShowResults}
            aria-label="View execution results"
            title="View execution results"
          >
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </button>
        {/if}
        
        <!-- View Details Button -->
        <button
          type="button"
          class="w-5 h-5 bg-blue-500 text-white text-xs rounded-full hover:bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          on:click={handleViewDetails}
          aria-label="View flow details"
          title="View flow details"
        >
          <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
            <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
          </svg>
        </button>
        
        <!-- Remove Button -->
        <button
          type="button"
          class="w-5 h-5 bg-red-500 text-white text-xs rounded-full hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          on:click={handleRemove}
          aria-label="Remove flow"
          title="Remove flow from sequence"
        >
          ×
        </button>
      </div>
    </div>
    
    <!-- Side-by-side Parameters & Outputs -->
    <div class="flex-1 flex gap-3">
      <!-- Left Half - Parameters Section -->
      <div class="flex-1 border-r border-gray-100 pr-3">
        <div class="flex items-center gap-1 mb-2">
          <div class="w-2 h-2 bg-blue-400 rounded-full"></div>
          <span class="text-xs font-medium text-gray-600">Inputs ({flow.flowJson?.parameters?.length || 0})</span>
        </div>
        {#if flow.flowJson?.parameters && flow.flowJson.parameters.length > 0}
          <div class="scrollable-list text-xs text-gray-700 space-y-1 h-20 overflow-y-auto relative group/scroll">
            {#each flow.flowJson.parameters as param}
              <div class="truncate" title={param.name}>
                • {param.name}
              </div>
            {/each}
            {#if flow.flowJson.parameters.length > 8}
              <div class="absolute bottom-0 right-0 text-xs text-blue-400 opacity-0 group-hover/scroll:opacity-100 transition-opacity bg-white px-1">
                ↕
              </div>
            {/if}
          </div>
        {:else}
          <div class="text-xs text-gray-400 italic h-20 flex items-center">
            No inputs
          </div>
        {/if}
      </div>

      <!-- Right Half - Outputs Section -->
      <div class="flex-1 pl-3">
        <div class="flex items-center gap-1 mb-2">
          <div class="w-2 h-2 bg-green-400 rounded-full"></div>
          <span class="text-xs font-medium text-gray-600">Outputs ({flow.flowJson?.outputs?.length || 0})</span>
        </div>
        {#if flow.flowJson?.outputs && flow.flowJson.outputs.length > 0}
          <div class="scrollable-list text-xs text-gray-700 space-y-1 h-20 overflow-y-auto relative group/scroll">
            {#each flow.flowJson.outputs as output}
              <div class="truncate" title={output.name}>
                • {output.name}
              </div>
            {/each}
            {#if flow.flowJson.outputs.length > 8}
              <div class="absolute bottom-0 right-0 text-xs text-green-400 opacity-0 group-hover/scroll:opacity-100 transition-opacity bg-white px-1">
                ↕
              </div>
            {/if}
          </div>
        {:else}
          <div class="text-xs text-gray-400 italic h-20 flex items-center">
            No outputs
          </div>
        {/if}
      </div>
    </div>

    <!-- Drag Handle -->
    <div class="flex justify-end mt-1">
      <div class="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4"/>
        </svg>
      </div>
    </div>
  </div>
</div>

<style>
  .line-clamp-1 {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .scrollable-list {
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 transparent;
  }

  .scrollable-list::-webkit-scrollbar {
    width: 4px;
  }

  .scrollable-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .scrollable-list::-webkit-scrollbar-thumb {
    background-color: #cbd5e1;
    border-radius: 2px;
  }

  .scrollable-list::-webkit-scrollbar-thumb:hover {
    background-color: #94a3b8;
  }
</style>