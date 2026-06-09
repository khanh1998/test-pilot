<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import JsonViewer from '../ui/JsonViewer.svelte';
  import type { SequenceFlowResult } from '$lib/sequence-runner/types';

  interface Props {
    [key: string]: unknown;
    isOpen?: boolean;
    flowResult?: SequenceFlowResult | null;
    flowName?: string;
  }

  let {
    isOpen = false,
    flowResult = null,
    flowName = '',
    ...callbackProps
  }: Props & Record<string, unknown> = $props();

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

  let activeTab: 'overview' | 'outputs' | 'responses' | 'parameters' = $state('overview');
  let selectedIterationIndex: number | null = $state(null);

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

  function getIterationStatusClass(success: boolean, matchedExpectation: boolean): string {
    if (matchedExpectation) {
      return success
        ? 'border-green-200 bg-green-50 text-green-700'
        : 'border-orange-200 bg-orange-50 text-orange-700';
    }

    return 'border-red-200 bg-red-50 text-red-700';
  }

  let statusInfo = $derived(flowResult ? getStatusIcon(flowResult.success) : null);
  let selectedIteration = $derived(
    selectedIterationIndex === null
      ? null
      : flowResult?.loop?.iterations.find(
          (iteration) => iteration.index === selectedIterationIndex
        ) || null
  );
  let displayedOutputs = $derived(selectedIteration?.outputs || flowResult?.outputs || {});
  let displayedResponses = $derived(selectedIteration?.responses || flowResult?.responses || {});
  let displayedParameterValues = $derived(
    selectedIteration?.parameterValues || flowResult?.parameterValues || {}
  );
  let displayedExecutionTime = $derived(
    selectedIteration?.executionTime ?? flowResult?.executionTime
  );
  let displayedSuccess = $derived(selectedIteration?.success ?? flowResult?.success ?? false);
  let displayedError = $derived(selectedIteration?.error ?? flowResult?.error);
  let displayedStatusInfo = $derived(flowResult ? getStatusIcon(displayedSuccess) : null);

  $effect(() => {
    if (!flowResult?.loop && selectedIterationIndex !== null) {
      selectedIterationIndex = null;
    }

    if (flowResult?.loop && selectedIterationIndex === null) {
      selectedIterationIndex = flowResult.loop.iterations[0]?.index ?? null;
    }
  });
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <!-- Panel -->
  <div
    class="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white shadow-xl transition-transform duration-300 ease-in-out sm:w-[90%] md:w-[800px] lg:w-[900px]"
    transition:fly={{ x: 400, duration: 300 }}
    aria-hidden="false"
  >
    <!-- Header -->
    <div
      class="sticky top-0 z-10 flex w-full items-center justify-between border-b bg-white px-6 py-4 shadow-sm"
    >
      <div class="flex-1">
        <div class="flex items-center gap-3">
          <h2 class="text-lg font-medium text-gray-900">Flow Execution Results</h2>
          {#if statusInfo}
            <div class="flex items-center gap-2">
              <svg
                class="h-5 w-5 {statusInfo.class}"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d={statusInfo.icon}
                />
              </svg>
              <span
                class="text-sm font-medium {flowResult?.success
                  ? 'text-green-700'
                  : 'text-red-700'}"
              >
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
        onclick={closePanel}
        aria-label="Close"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          ></path>
        </svg>
      </button>
    </div>

    {#if flowResult?.loop}
      <div class="border-b bg-white px-6 py-3">
        <div class="mb-2 flex items-center justify-between gap-3">
          <div>
            <h3 class="text-sm font-medium text-gray-900">Iterations</h3>
            <p class="text-xs text-gray-500">
              Choose an iteration to inspect the same result tabs for that run.
            </p>
          </div>
          {#if selectedIteration}
            <span class="text-xs text-gray-500">
              <span class="font-mono">{selectedIteration.label}</span>
            </span>
          {/if}
        </div>
        <div class="flex gap-2 overflow-x-auto pb-1">
          {#each flowResult.loop.iterations as iteration}
            <button
              type="button"
              class="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors {selectedIterationIndex ===
              iteration.index
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : getIterationStatusClass(iteration.success, iteration.matchedExpectation)}"
              onclick={() => (selectedIterationIndex = iteration.index)}
              title={iteration.label}
            >
              #{iteration.index + 1}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Tabs -->
    <div class="border-b bg-gray-50 px-6">
      <div class="-mb-px flex overflow-x-auto">
        <button
          class="border-b-2 px-4 py-3 text-sm font-medium transition-colors {activeTab ===
          'overview'
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
          onclick={() => (activeTab = 'overview')}
        >
          <div class="flex items-center">
            <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              ></path>
            </svg>
            Overview
          </div>
        </button>

        <button
          class="border-b-2 px-4 py-3 text-sm font-medium transition-colors {activeTab === 'outputs'
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
          onclick={() => (activeTab = 'outputs')}
        >
          <div class="flex items-center">
            <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              ></path>
            </svg>
            Outputs ({Object.keys(displayedOutputs).length})
          </div>
        </button>

        <button
          class="border-b-2 px-4 py-3 text-sm font-medium transition-colors {activeTab ===
          'responses'
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
          onclick={() => (activeTab = 'responses')}
        >
          <div class="flex items-center">
            <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              ></path>
            </svg>
            Responses ({Object.keys(displayedResponses).length})
          </div>
        </button>

        <button
          class="border-b-2 px-4 py-3 text-sm font-medium transition-colors {activeTab ===
          'parameters'
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
          onclick={() => (activeTab = 'parameters')}
        >
          <div class="flex items-center">
            <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
              ></path>
            </svg>
            Parameters ({Object.keys(displayedParameterValues).length})
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
          <div class="rounded-lg bg-gray-50 p-4">
            <h3 class="mb-3 text-sm font-medium text-gray-900">Execution Summary</h3>
            <dl class="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-3">
              <div>
                <dt class="text-xs font-medium text-gray-500">Status</dt>
                <dd class="mt-1 flex items-center gap-2">
                  {#if displayedStatusInfo}
                    <svg
                      class="h-4 w-4 {displayedStatusInfo.class}"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d={displayedStatusInfo.icon}
                      />
                    </svg>
                  {/if}
                  <span
                    class="text-sm text-gray-900 {displayedSuccess
                      ? 'text-green-700'
                      : 'text-red-700'}"
                  >
                    {displayedSuccess ? 'Success' : 'Failed'}
                  </span>
                </dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-gray-500">Execution Time</dt>
                <dd class="mt-1 text-sm text-gray-900">
                  {displayedExecutionTime !== undefined
                    ? formatExecutionTime(displayedExecutionTime)
                    : 'N/A'}
                </dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-gray-500">Step Order</dt>
                <dd class="mt-1 text-sm text-gray-900">{flowResult?.stepOrder || 'N/A'}</dd>
              </div>
            </dl>
          </div>

          {#if flowResult?.loop}
            <div class="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
              <h3 class="mb-3 text-sm font-medium text-indigo-900">Loop Summary</h3>
              <dl class="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-3">
                <div>
                  <dt class="text-xs font-medium text-indigo-600">Iterations</dt>
                  <dd class="mt-1 text-sm text-indigo-900">
                    {flowResult.loop.completedIterations}/{flowResult.loop.totalIterations}
                  </dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-indigo-600">Failed Index</dt>
                  <dd class="mt-1 text-sm text-indigo-900">
                    {flowResult.loop.failedIterationIndex ?? 'None'}
                  </dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-indigo-600">Loops</dt>
                  <dd class="mt-1 text-sm text-indigo-900">
                    {Object.keys(flowResult.loop.loopNames).length}
                  </dd>
                </div>
              </dl>
            </div>
          {/if}

          <!-- Error Details (if any) -->
          {#if flowResult && !displayedSuccess && displayedError}
            <div class="rounded-lg border border-red-200 bg-red-50 p-4">
              <h3 class="mb-2 text-sm font-medium text-red-800">Error Details</h3>
              <div class="text-sm text-red-700">
                {displayedError instanceof Error ? displayedError.message : String(displayedError)}
              </div>
            </div>
          {/if}

          <!-- Quick Stats -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <svg
                    class="h-5 w-5 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    ></path>
                  </svg>
                </div>
                <div class="ml-3">
                  <p class="text-sm font-medium text-blue-800">Outputs</p>
                  <p class="text-lg font-semibold text-blue-900">
                    {Object.keys(displayedOutputs).length}
                  </p>
                </div>
              </div>
            </div>

            <div class="rounded-lg border border-green-200 bg-green-50 p-4">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <svg
                    class="h-5 w-5 text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    ></path>
                  </svg>
                </div>
                <div class="ml-3">
                  <p class="text-sm font-medium text-green-800">Responses</p>
                  <p class="text-lg font-semibold text-green-900">
                    {Object.keys(displayedResponses).length}
                  </p>
                </div>
              </div>
            </div>

            <div class="rounded-lg border border-purple-200 bg-purple-50 p-4">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <svg
                    class="h-5 w-5 text-purple-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                    ></path>
                  </svg>
                </div>
                <div class="ml-3">
                  <p class="text-sm font-medium text-purple-800">Parameters</p>
                  <p class="text-lg font-semibold text-purple-900">
                    {Object.keys(displayedParameterValues).length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      {:else if activeTab === 'outputs'}
        <!-- Outputs Tab -->
        <div class="space-y-4">
          {#if Object.keys(displayedOutputs).length > 0}
            {#each Object.entries(displayedOutputs) as [key, value]}
              <JsonViewer data={value} title={key} maxHeight="300px" />
            {/each}
          {:else}
            <div class="py-8 text-center">
              <svg
                class="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                ></path>
              </svg>
              <h3 class="mt-2 text-sm font-medium text-gray-900">No outputs</h3>
              <p class="mt-1 text-sm text-gray-500">
                This flow execution did not produce any outputs.
              </p>
            </div>
          {/if}
        </div>
      {:else if activeTab === 'responses'}
        <!-- Responses Tab -->
        <div class="space-y-4">
          {#if Object.keys(displayedResponses).length > 0}
            {#each Object.entries(displayedResponses) as [endpointId, response]}
              <JsonViewer data={response} title="Endpoint {endpointId}" maxHeight="400px" />
            {/each}
          {:else}
            <div class="py-8 text-center">
              <svg
                class="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                ></path>
              </svg>
              <h3 class="mt-2 text-sm font-medium text-gray-900">No responses</h3>
              <p class="mt-1 text-sm text-gray-500">
                This flow execution did not capture any responses.
              </p>
            </div>
          {/if}
        </div>
      {:else if activeTab === 'parameters'}
        <!-- Parameters Tab -->
        <div class="space-y-4">
          {#if Object.keys(displayedParameterValues).length > 0}
            <JsonViewer
              data={displayedParameterValues}
              title="Parameter Values"
              maxHeight="500px"
            />
          {:else}
            <div class="py-8 text-center">
              <svg
                class="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                ></path>
              </svg>
              <h3 class="mt-2 text-sm font-medium text-gray-900">No parameters</h3>
              <p class="mt-1 text-sm text-gray-500">
                This flow execution did not use any parameters.
              </p>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}
