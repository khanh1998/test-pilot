<!-- SequenceCard.svelte - Display sequence information in a card format -->
<script lang="ts">
  import type { FlowSequence } from '../../types/flow_sequence.js';
  import { formatDate } from '../../utils/date.js';

  export let sequence: FlowSequence;
  export let href: string = `/projects/sequences/${sequence.id}`;
  export let showActions: boolean = true;
  export let showFlows: boolean = false; // New prop to show detailed flows
  export let onEdit: ((sequence: FlowSequence) => void) | null = null;
  export let onDelete: ((sequence: FlowSequence) => void) | null = null;
  export let onExecute: ((sequence: FlowSequence) => void) | null = null;
  export let isDragging: boolean = false;

  function handleEdit() {
    if (onEdit) {
      onEdit(sequence);
    }
  }

  function handleDelete() {
    if (onDelete && confirm(`Are you sure you want to delete sequence "${sequence.name}"?`)) {
      onDelete(sequence);
    }
  }

  function handleExecute() {
    if (onExecute) {
      onExecute(sequence);
    }
  }

  // Get status color and text (placeholder for future execution tracking)
  function getStatusInfo() {
    // For now, default to 'not run' since execution tracking isn't implemented yet
    return { color: 'text-gray-600 bg-gray-100', text: 'Not Run' };
  }

  $: statusInfo = getStatusInfo();
  $: flowCount = sequence.sequenceConfig?.steps?.length || 0;
</script>

<div 
  class="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all duration-200"
  class:opacity-50={isDragging}
  class:shadow-lg={isDragging}
>
  <div class="flex items-start justify-between">
    <div class="flex-1">
      <div class="flex items-start gap-3">
        <a {href} class="block group flex-1">
          <h4 class="text-md font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
            {sequence.name}
          </h4>
          {#if sequence.description}
            <p class="text-sm text-gray-600 mt-1 line-clamp-2">
              {sequence.description}
            </p>
          {/if}
        </a>

        <!-- Status Badge -->
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {statusInfo.color}">
          {statusInfo.text}
        </span>
      </div>
      
      <div class="flex items-center gap-4 mt-3 text-sm text-gray-500">
        <span>Created {formatDate(sequence.createdAt)}</span>
        {#if sequence.updatedAt !== sequence.createdAt}
          <span>Updated {formatDate(sequence.updatedAt)}</span>
        {/if}
      </div>

      <!-- Sequence Stats -->
      <div class="flex items-center gap-4 mt-2">
        <div class="flex items-center text-sm text-gray-600">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
          {flowCount} test flows
        </div>
        <div class="flex items-center text-sm text-gray-600">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2h4a1 1 0 011 1v1a1 1 0 01-1 1h-1v9a2 2 0 01-2 2H6a2 2 0 01-2-2V7H3a1 1 0 01-1-1V5a1 1 0 011-1h4z"/>
          </svg>
          Order: {sequence.displayOrder}
        </div>
      </div>

      <!-- Flow Preview -->
      {#if showFlows && flowCount > 0}
        <div class="mt-4 border-t border-gray-200 pt-4">
          <h5 class="text-sm font-medium text-gray-700 mb-3">Flow Sequence ({flowCount} flows):</h5>
          <div class="space-y-2">
            {#each sequence.sequenceConfig?.steps || [] as step, index}
              <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-md">
                <div class="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
                  {index + 1}
                </div>
                <div class="flex-1">
                  <div class="text-sm font-medium text-gray-900">
                    Test Flow #{step.test_flow_id}
                  </div>
                  {#if step.parameter_mappings && step.parameter_mappings.length > 0}
                    <div class="text-xs text-gray-500 mt-1">
                      {step.parameter_mappings.length} parameter mapping(s)
                    </div>
                  {/if}
                </div>
                <div class="flex items-center text-xs text-gray-500">
                  <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                  </svg>
                  Step {step.step_order}
                </div>
              </div>
            {/each}
          </div>
          
          <!-- Global Settings Display -->
          {#if sequence.sequenceConfig?.global_settings}
            <div class="mt-3 p-3 bg-blue-50 rounded-md">
              <h6 class="text-xs font-medium text-blue-700 mb-2">Global Settings</h6>
              <div class="flex gap-4 text-xs text-blue-600">
                <span>Timeout: {sequence.sequenceConfig.global_settings.timeout}ms</span>
                <span>Continue on Error: {sequence.sequenceConfig.global_settings.continue_on_error ? 'Yes' : 'No'}</span>
                <span>Parallel: {sequence.sequenceConfig.global_settings.parallel_execution ? 'Yes' : 'No'}</span>
              </div>
            </div>
          {/if}
        </div>
      {:else if flowCount > 0}
        <div class="mt-3 flex items-center gap-2">
          <span class="text-xs text-gray-500">Flows:</span>
          <div class="flex items-center gap-1 flex-wrap">
            {#each sequence.sequenceConfig?.steps?.slice(0, 3) || [] as step, index}
              <span class="inline-flex items-center px-2 py-1 rounded-md text-xs bg-gray-100 text-gray-700">
                {index + 1}. Flow #{step.test_flow_id}
              </span>
            {/each}
            {#if flowCount > 3}
              <span class="text-xs text-gray-500">+{flowCount - 3} more</span>
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <div class="flex items-center gap-2 ml-4">
      <!-- Execute Button -->
      {#if onExecute && flowCount > 0}
        <button
          on:click={handleExecute}
          class="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-md transition-colors"
          aria-label="Execute sequence"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m-9 5a9 9 0 1118 0 9 9 0 01-18 0z"/>
          </svg>
        </button>
      {/if}

      <!-- Drag Handle -->
      <div class="drag-handle p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-move">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4"/>
        </svg>
      </div>

      {#if showActions && (onEdit || onDelete)}
        {#if onEdit}
          <button
            on:click={handleEdit}
            class="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Edit sequence"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
        {/if}
        {#if onDelete}
          <button
            on:click={handleDelete}
            class="p-1 text-gray-400 hover:text-red-600 transition-colors"
            aria-label="Delete sequence"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
