<!-- SequenceRow.svelte - Horizontal row displaying a sequence with flow cards -->
<script lang="ts">
  import type { FlowSequence } from '../../types/flow_sequence.js';
  import type { TestFlow } from '../../types/test-flow.js';
  import { createEventDispatcher } from 'svelte';
  import FlowCard from './FlowCard.svelte';
  import FlowSearch from './FlowSearch.svelte';

  export let sequence: FlowSequence;
  export let sequenceFlows: TestFlow[] = []; // Populated flows from sequence steps
  export let isEditing: boolean = false;
  export let selectedEnvironmentId: number | null = null;
  export let selectedSubEnvironment: string | null = null;
  export let isRunning: boolean = false;

  const dispatch = createEventDispatcher<{
    editName: { sequence: FlowSequence; newName: string };
    addFlow: { sequence: FlowSequence; flow: TestFlow };
    removeFlow: { sequence: FlowSequence; stepOrder: number };
    reorderFlow: { sequence: FlowSequence; fromIndex: number; toIndex: number };
    deleteSequence: { sequence: FlowSequence };
    clickFlow: { sequence: FlowSequence; flow: TestFlow; stepOrder: number };
    runSequence: { sequence: FlowSequence };
  }>();

  let editingName = sequence.name;
  let draggedIndex = -1;
  let dropTargetIndex = -1;
  let showFlowSearch = false;

  function handleNameEdit() {
    if (editingName.trim() && editingName !== sequence.name) {
      dispatch('editName', { sequence, newName: editingName.trim() });
    }
    isEditing = false;
  }

  function handleNameKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handleNameEdit();
    } else if (event.key === 'Escape') {
      editingName = sequence.name;
      isEditing = false;
    }
  }

  function handleAddFlow(event: CustomEvent<{ flow: TestFlow }>) {
    dispatch('addFlow', { sequence, flow: event.detail.flow });
    showFlowSearch = false;
  }

  function handleFlowClick(event: CustomEvent<{ flow: TestFlow; stepOrder: number }>) {
    dispatch('clickFlow', { sequence, flow: event.detail.flow, stepOrder: event.detail.stepOrder });
  }

  function handleFlowRemove(event: CustomEvent<{ stepOrder: number }>) {
    dispatch('removeFlow', { sequence, stepOrder: event.detail.stepOrder });
  }

  function handleDragStart(event: CustomEvent<{ flow: TestFlow; stepOrder: number }>) {
    draggedIndex = event.detail.stepOrder - 1; // Convert to 0-based index
    console.log('Drag started:', { draggedIndex, stepOrder: event.detail.stepOrder });
  }

  function handleDragEnd() {
    console.log('Drag ended:', { draggedIndex, dropTargetIndex });
    draggedIndex = -1;
    dropTargetIndex = -1;
  }

  function handleDragOver(event: DragEvent, index: number) {
    event.preventDefault();
    if (draggedIndex !== -1 && draggedIndex !== index) {
      dropTargetIndex = index;
      console.log('Drag over:', { draggedIndex, dropTargetIndex, index });
    }
  }

  function handleDrop(event: DragEvent, index: number) {
    event.preventDefault();
    console.log('Drop event:', { draggedIndex, index, sequence: sequence.name });
    if (draggedIndex !== -1 && draggedIndex !== index) {
      console.log('Dispatching reorderFlow:', { sequence, fromIndex: draggedIndex, toIndex: index });
      dispatch('reorderFlow', { sequence, fromIndex: draggedIndex, toIndex: index });
    }
    dropTargetIndex = -1;
    draggedIndex = -1;
  }

  function handleDeleteSequence() {
    if (confirm(`Are you sure you want to delete sequence "${sequence.name}"?`)) {
      dispatch('deleteSequence', { sequence });
    }
  }

  function handleRunSequence() {
    dispatch('runSequence', { sequence });
  }

  $: steps = sequence.sequenceConfig?.steps || [];
  $: canRun = sequenceFlows.length > 0 && selectedEnvironmentId && selectedSubEnvironment;
</script>

<div class="sequence-row bg-white border border-gray-200 rounded-lg p-4 mb-4 {isRunning ? 'ring-2 ring-green-500 ring-opacity-50 bg-green-50' : ''}" class:animate-pulse={isRunning}>
  <!-- Sequence Header -->
  <div class="flex items-center justify-between mb-4">
    <div class="flex items-center gap-3 flex-1">
      {#if isEditing}
        <input
          bind:value={editingName}
          on:blur={handleNameEdit}
          on:keydown={handleNameKeydown}
          class="text-lg font-semibold bg-transparent border-b border-blue-500 focus:outline-none focus:border-blue-600 px-1"
        />
      {:else}
        <button
          type="button"
          class="text-lg font-semibold text-gray-900 hover:text-blue-600 text-left"
          on:click={() => (isEditing = true)}
        >
          {sequence.name}
        </button>
      {/if}
      
      <span class="text-sm text-gray-500">
        {steps.length} flow{steps.length !== 1 ? 's' : ''}
      </span>
      
      {#if isRunning}
        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <svg class="w-3 h-3 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Running
        </span>
      {/if}
    </div>

    <!-- Sequence Actions -->
    <div class="flex items-center gap-2">
      <!-- Run Sequence Button -->
      <button
        type="button"
        on:click={handleRunSequence}
        disabled={!canRun || isRunning}
        class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        title={!canRun ? 'Select an environment to run this sequence' : 'Run this sequence'}
      >
        {#if isRunning}
          <svg class="w-3 h-3 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Running...
        {:else}
          <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8.056v3.888a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
          </svg>
          Run
        {/if}
      </button>
      
      <button
        type="button"
        on:click={handleDeleteSequence}
        class="p-2 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
        aria-label="Delete sequence"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
      </button>
    </div>
  </div>

  <!-- Flow Cards Container -->
  <div class="flex items-center gap-3 overflow-x-auto py-2" style="min-height: 11rem;">
    {#each sequenceFlows as flow, index (`${flow.id}-${index}`)}
      <div
        class="drop-zone transition-all duration-200"
        class:border-2={dropTargetIndex === index}
        class:border-blue-400={dropTargetIndex === index}
        class:border-dashed={dropTargetIndex === index}
        class:bg-blue-50={dropTargetIndex === index}
        class:rounded-lg={dropTargetIndex === index}
        class:p-1={dropTargetIndex === index}
        on:dragover={(e) => handleDragOver(e, index)}
        on:drop={(e) => handleDrop(e, index)}
        role="button"
        tabindex="0"
      >
        <FlowCard
          {flow}
          stepOrder={index + 1}
          isDragging={draggedIndex === index}
          isDropTarget={dropTargetIndex === index}
          on:click={handleFlowClick}
          on:dragstart={handleDragStart}
          on:dragend={handleDragEnd}
          on:remove={handleFlowRemove}
        />
      </div>
    {/each}

    <!-- Add Flow Search -->
    <div class="flex-shrink-0">
      <FlowSearch
        bind:isOpen={showFlowSearch}
        on:select={handleAddFlow}
        on:close={() => (showFlowSearch = false)}
      />
    </div>
  </div>

  <!-- Sequence Description -->
  {#if sequence.description}
    <div class="mt-3 text-sm text-gray-600 border-t border-gray-100 pt-3">
      {sequence.description}
    </div>
  {/if}
</div>

<style>
  .sequence-row {
    transition: all 0.2s ease-in-out;
  }
  
  .sequence-row:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .drop-zone {
    min-height: 10rem; /* Match the fixed height of flow cards (h-40) */
    min-width: 18rem;  /* Match the fixed width of flow cards (w-72) */
  }
  
  .drop-zone:global(.dragging-over) {
    background-color: #dbeafe;
    border: 2px dashed #3b82f6;
  }
</style>
