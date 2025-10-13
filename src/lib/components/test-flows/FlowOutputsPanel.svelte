<script lang="ts">
  import type { FlowOutput } from './types';
  import { createEventDispatcher } from 'svelte';

  // Props
  export let outputs: FlowOutput[] = [];
  export let isRunning: boolean = false;

  const dispatch = createEventDispatcher();

  function openOutputEditor() {
    dispatch('openOutputEditor');
  }
</script>

<!-- Flow Outputs Section -->
<div class="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-6">
  <div class="flex items-center justify-between">
    <div class="flex-1">
      <h3 class="text-lg font-medium text-gray-900">Flow Outputs</h3>
      <p class="mt-1 text-sm text-gray-500">
        Define values that will be extracted when the flow completes successfully
      </p>
      
      {#if outputs && outputs.length > 0}
        <div class="mt-3 flex flex-wrap gap-2">
          {#each outputs as output}
            <span class="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
              {output.name}
              {#if output.isTemplate}
                <svg class="ml-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                </svg>
              {/if}
            </span>
          {/each}
        </div>
      {/if}
    </div>
    
    <button
      class="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      on:click={openOutputEditor}
      disabled={isRunning}
    >
      <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
      </svg>
      {outputs && outputs.length > 0 ? 'Manage Outputs' : 'Define Outputs'}
    </button>
  </div>

  {#if !outputs || outputs.length === 0}
    <div class="mt-4 text-center">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
      </svg>
      <p class="mt-2 text-sm text-gray-500">No outputs defined</p>
      <p class="text-xs text-gray-400">Click "Define Outputs" to extract values from your flow execution</p>
    </div>
  {/if}
</div>
