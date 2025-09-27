<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import JsonViewer from '../ui/JsonViewer.svelte';
  import type { SequenceFlowResult } from '$lib/sequence-runner/types';

  export let isOpen = false;
  export let flowResult: SequenceFlowResult | null = null;
  export let flowName: string = '';

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  let activeTab: 'overview' | 'outputs' | 'responses' | 'parameters' = 'overview';

  function closePanel() {
    dispatch('close');
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closePanel();
    }
  }

  function formatExecutionTime(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function getStatusIcon(success: boolean) {
    if (success) {
      return {
        icon: 'M5 13l4 4L19 7',
        class: 'text-green-500'
      };
    } else {
      return {
        icon: 'M6 18L18 6M6 6l12 12',
        class: 'text-red-500'
      };
    }
  }

  $: statusInfo = flowResult ? getStatusIcon(flowResult.success) : null;
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
  <!-- Panel -->
  <div
    class="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white shadow-xl transition-transform duration-300 ease-in-out sm:w-[90%] md:w-[800px] lg:w-[900px]"
    transition:fly={{ x: 400, duration: 300 }}
    aria-hidden="false"
  >
    <!-- Header -->
    <div class="sticky top-0 z-10 flex w-full items-center justify-between border-b bg-white px-6 py-4 shadow-sm">
      <div class="flex-1">
        <div class="flex items-center gap-3">
          <h2 class="text-lg font-medium text-gray-900">Flow Execution Results</h2>
          {#if statusInfo}
            <div class="flex items-center gap-2">
              <svg class="w-5 h-5 {statusInfo.class}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="{statusInfo.icon}" />
              </svg>
              <span class="text-sm font-medium {flowResult?.success ? 'text-green-700' : 'text-red-700'}">
                {flowResult?.success ? 'Success' : 'Failed'}
              </span>
            </div>
          {/if}
        </div>
        <p class="mt-1 text-sm text-gray-500">
          {flowName} - Step {flowResult?.stepOrder || 'Unknown'}
        </p>
      </div>
      <button
        type="button"
        class="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
        on:click={closePanel}
        aria-label="Close"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>

    <!-- Tabs -->
    <div class="border-b bg-gray-50 px-6">
      <div class="-mb-px flex overflow-x-auto">
        <button
          class="border-b-2 px-4 py-3 text-sm font-medium transition-colors {activeTab === 'overview'
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
          on:click={() => (activeTab = 'overview')}
        >
          <div class="flex items-center">
            <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
            Overview
          </div>
        </button>

        <button
          class="border-b-2 px-4 py-3 text-sm font-medium transition-colors {activeTab === 'outputs'
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
          on:click={() => (activeTab = 'outputs')}
        >
          <div class="flex items-center">
            <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            Outputs ({Object.keys(flowResult?.outputs || {}).length})
          </div>
        </button>

        <button
          class="border-b-2 px-4 py-3 text-sm font-medium transition-colors {activeTab === 'responses'
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
          on:click={() => (activeTab = 'responses')}
        >
          <div class="flex items-center">
            <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
            </svg>
            Responses ({Object.keys(flowResult?.responses || {}).length})
          </div>
        </button>

        <button
          class="border-b-2 px-4 py-3 text-sm font-medium transition-colors {activeTab === 'parameters'
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
          on:click={() => (activeTab = 'parameters')}
        >
          <div class="flex items-center">
            <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path>
            </svg>
            Parameters ({Object.keys(flowResult?.parameterValues || {}).length})
          </div>
        </button>
      </div>
    </div>

    <!-- Tab Content -->
    <div class="p-6">
      {#if activeTab === 'overview'}
        <!-- Overview Tab -->
        <div class="space-y-6">
          <!-- Execution Summary -->
          <div class="bg-gray-50 rounded-lg p-4">
            <h3 class="text-sm font-medium text-gray-900 mb-3">Execution Summary</h3>
            <dl class="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-3">
              <div>
                <dt class="text-xs font-medium text-gray-500">Status</dt>
                <dd class="mt-1 flex items-center gap-2">
                  {#if statusInfo}
                    <svg class="w-4 h-4 {statusInfo.class}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="{statusInfo.icon}" />
                    </svg>
                  {/if}
                  <span class="text-sm text-gray-900 {flowResult?.success ? 'text-green-700' : 'text-red-700'}">
                    {flowResult?.success ? 'Success' : 'Failed'}
                  </span>
                </dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-gray-500">Execution Time</dt>
                <dd class="mt-1 text-sm text-gray-900">{flowResult ? formatExecutionTime(flowResult.executionTime) : 'N/A'}</dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-gray-500">Step Order</dt>
                <dd class="mt-1 text-sm text-gray-900">{flowResult?.stepOrder || 'N/A'}</dd>
              </div>
            </dl>
          </div>

          <!-- Error Details (if any) -->
          {#if flowResult && !flowResult.success && flowResult.error}
            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 class="text-sm font-medium text-red-800 mb-2">Error Details</h3>
              <div class="text-sm text-red-700">
                {flowResult.error instanceof Error ? flowResult.error.message : String(flowResult.error)}
              </div>
            </div>
          {/if}

          <!-- Quick Stats -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                </div>
                <div class="ml-3">
                  <p class="text-sm font-medium text-blue-800">Outputs</p>
                  <p class="text-lg font-semibold text-blue-900">{Object.keys(flowResult?.outputs || {}).length}</p>
                </div>
              </div>
            </div>

            <div class="bg-green-50 border border-green-200 rounded-lg p-4">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                  </svg>
                </div>
                <div class="ml-3">
                  <p class="text-sm font-medium text-green-800">Responses</p>
                  <p class="text-lg font-semibold text-green-900">{Object.keys(flowResult?.responses || {}).length}</p>
                </div>
              </div>
            </div>

            <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path>
                  </svg>
                </div>
                <div class="ml-3">
                  <p class="text-sm font-medium text-purple-800">Parameters</p>
                  <p class="text-lg font-semibold text-purple-900">{Object.keys(flowResult?.parameterValues || {}).length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      {:else if activeTab === 'outputs'}
        <!-- Outputs Tab -->
        <div class="space-y-4">
          {#if flowResult?.outputs && Object.keys(flowResult.outputs).length > 0}
            {#each Object.entries(flowResult.outputs) as [key, value]}
              <JsonViewer 
                data={value} 
                title={key}
                maxHeight="300px"
              />
            {/each}
          {:else}
            <div class="text-center py-8">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <h3 class="mt-2 text-sm font-medium text-gray-900">No outputs</h3>
              <p class="mt-1 text-sm text-gray-500">This flow execution did not produce any outputs.</p>
            </div>
          {/if}
        </div>

      {:else if activeTab === 'responses'}
        <!-- Responses Tab -->
        <div class="space-y-4">
          {#if flowResult?.responses && Object.keys(flowResult.responses).length > 0}
            {#each Object.entries(flowResult.responses) as [endpointId, response]}
              <JsonViewer 
                data={response} 
                title="Endpoint {endpointId}"
                maxHeight="400px"
              />
            {/each}
          {:else}
            <div class="text-center py-8">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
              </svg>
              <h3 class="mt-2 text-sm font-medium text-gray-900">No responses</h3>
              <p class="mt-1 text-sm text-gray-500">This flow execution did not capture any responses.</p>
            </div>
          {/if}
        </div>

      {:else if activeTab === 'parameters'}
        <!-- Parameters Tab -->
        <div class="space-y-4">
          {#if flowResult?.parameterValues && Object.keys(flowResult.parameterValues).length > 0}
            <JsonViewer 
              data={flowResult.parameterValues} 
              title="Parameter Values"
              maxHeight="500px"
            />
          {:else}
            <div class="text-center py-8">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path>
              </svg>
              <h3 class="mt-2 text-sm font-medium text-gray-900">No parameters</h3>
              <p class="mt-1 text-sm text-gray-500">This flow execution did not use any parameters.</p>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}
