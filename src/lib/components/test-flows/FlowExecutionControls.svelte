<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import SimplifiedEnvironmentSelector from '../environments/SimplifiedEnvironmentSelector.svelte';
  import type { Environment } from '$lib/types/environment';
  import type { ExecutionState } from './types';

  export let environment: Environment | null = null;
  export let selectedSubEnvironment: string | null = null;
  export let isRunning: boolean = false;
  export let isLoadingEnvironment: boolean = false;
  export let executionStore: ExecutionState;
  export let executionLogs: Array<{
    level: 'info' | 'debug' | 'error' | 'warning';
    message: string;
    details?: string;
    timestamp: Date;
  }> = [];
  export let hasValidApiHosts: boolean = false;
  export let hasSteps: boolean = false;
  export let totalSteps: number = 0;

  const dispatch = createEventDispatcher();

  function handleEnvironmentSelection(event: CustomEvent<{ environmentId: number | null; subEnvironment: string | null }>) {
    dispatch('environmentSelect', event.detail);
  }

  function handleToggleOptions() {
    dispatch('toggleOptions');
  }

  function handleReset() {
    dispatch('reset');
  }

  function handleToggleParameters() {
    dispatch('toggleParameters');
  }

  function handleOpenLogs() {
    dispatch('openLogs');
  }

  function handleRunFlow() {
    dispatch('runFlow');
  }

  function handleStop() {
    dispatch('stop');
  }
</script>

<div class="rounded-lg border bg-white p-4 shadow-sm">
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div class="flex items-center">
      <h3 class="text-lg font-medium">Test Flow Execution</h3>
    </div>

    <!-- Environment Selection -->
    <div class="flex items-center space-x-4">
      <div class="min-w-0 flex-1">
        <div class="w-32">
          <SimplifiedEnvironmentSelector
            id="environment-selector"
            {environment}
            {selectedSubEnvironment}
            placeholder={isLoadingEnvironment ? "Loading environment..." : "Select sub-environment..."}
            disabled={isRunning || isLoadingEnvironment}
            on:select={handleEnvironmentSelection}
          />
        </div>
      </div>

      <div class="flex items-center space-x-3">
        <!-- Run Options Button -->
        <button
          class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          on:click={handleToggleOptions}
          disabled={isRunning}
        >
          <svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
            />
          </svg>
          Options
        </button>

        <!-- Reset Button -->
        <button
          class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          on:click={handleReset}
          disabled={isRunning || Object.keys(executionStore).length === 0}
        >
          <svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Reset
        </button>

        <!-- Parameters Button -->
        <button
          class="mr-2 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          on:click={handleToggleParameters}
          disabled={isRunning}
        >
          <svg class="mr-1.5 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
              clip-rule="evenodd"
            />
          </svg>
          Parameters
        </button>

        <!-- View Logs Button (only show when logs are available) -->
        {#if executionLogs.length > 0}
          <button
            class="mr-2 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            on:click={handleOpenLogs}
            disabled={isRunning}
          >
            <svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            View Logs
            <span class="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
              {executionLogs.length}
            </span>
          </button>
        {/if}

        <!-- Run Flow Button -->
        <button
          class="inline-flex items-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm {isRunning
            ? 'bg-red-600 hover:bg-red-700'
            : !hasValidApiHosts || !hasSteps
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700'}"
          on:click={isRunning ? handleStop : handleRunFlow}
          disabled={isRunning || !hasValidApiHosts || !hasSteps}
        >
          {#if isRunning}
            <svg
              class="mr-2 -ml-1 h-4 w-4 animate-spin text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Stop
          {:else if !hasValidApiHosts}
            <svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            Configure API Hosts
          {:else if !hasSteps}
            <svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Add Steps First
          {:else}
            <svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Run Flow
          {/if}
        </button>
      </div>
    </div>
  </div>

  <!-- Progress Bar (only visible when running) -->
  {#if isRunning}
    <div class="mt-4">
      <div class="h-2 w-full rounded-full bg-gray-200">
        <div
          class="h-2 rounded-full bg-blue-600"
          style="width: {executionStore.progress || 0}%"
        ></div>
      </div>
      <div class="mt-1 text-right text-xs text-gray-500">
        Step {executionStore.currentStep !== undefined ? executionStore.currentStep + 1 : 1} of {totalSteps}
      </div>
    </div>
  {/if}
</div>
