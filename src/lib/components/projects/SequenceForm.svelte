<!-- SequenceForm.svelte - Form for creating/editin  function toggleFlow(flowId: string) {
    if (selectedFlows.has(flowId)) {
      selectedFlows.delete(flowId);
    } else {
      selectedFlows.add(flowId);
    }
    selectedFlows = new Set(selectedFlows); // Trigger reactivity
  }equences -->
<script lang="ts">
  import type { FlowSequence, FlowSequenceStep } from '../../types/flow_sequence.js';
  import type { TestFlow } from '../../types/test-flow.js';
  import { createEventDispatcher } from 'svelte';

  export let sequence: Partial<FlowSequence> = {};
  export let availableFlows: TestFlow[] = [];
  export let selectedFlowIds: string[] = [];
  export let isLoading: boolean = false;
  export let mode: 'create' | 'edit' = 'create';

  const dispatch = createEventDispatcher<{
    submit: { sequence: Partial<FlowSequence>; flowIds: string[] };
    cancel: void;
  }>();

  let name = sequence.name || '';
  let description = sequence.description || '';
  let selectedFlows = new Set(selectedFlowIds);
  let globalSettings = {
    timeout: sequence.sequenceConfig?.global_settings?.timeout || 30000,
    continue_on_error: sequence.sequenceConfig?.global_settings?.continue_on_error || false,
    parallel_execution: sequence.sequenceConfig?.global_settings?.parallel_execution || false
  };

  $: isValid = name.trim().length > 0;

  function handleSubmit() {
    if (!isValid) return;

    const sequenceConfig = {
      steps: [], // Steps will be created after sequence creation
      global_settings: globalSettings
    };

    dispatch('submit', {
      sequence: {
        ...sequence,
        name: name.trim(),
        description: description.trim() || undefined,
        sequenceConfig
      },
      flowIds: Array.from(selectedFlows)
    });
  }

  function handleCancel() {
    dispatch('cancel');
  }

  function toggleFlow(flowId: string) {
    if (selectedFlows.has(flowId)) {
      selectedFlows.delete(flowId);
    } else {
      selectedFlows.add(flowId);
    }
    selectedFlows = selectedFlows; // Trigger reactivity
  }
</script>

<form on:submit|preventDefault={handleSubmit} class="space-y-6">
  <!-- Sequence Name -->
  <div>
    <label for="sequence-name" class="block text-sm font-medium text-gray-700 mb-2">
      Sequence Name *
    </label>
    <input
      id="sequence-name"
      type="text"
      bind:value={name}
      required
      maxlength="255"
      class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
      placeholder="Enter sequence name"
      disabled={isLoading}
    />
    {#if name.trim().length === 0 && name.length > 0}
      <p class="mt-1 text-sm text-red-600">Sequence name is required</p>
    {/if}
  </div>

  <!-- Sequence Description -->
  <div>
    <label for="sequence-description" class="block text-sm font-medium text-gray-700 mb-2">
      Description
    </label>
    <textarea
      id="sequence-description"
      bind:value={description}
      rows="3"
      maxlength="1000"
      class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
      placeholder="Enter sequence description (optional)"
      disabled={isLoading}
    ></textarea>
    <p class="mt-1 text-sm text-gray-500">{description.length}/1000 characters</p>
  </div>

  <!-- Global Settings -->
  <div class="bg-gray-50 rounded-lg p-4">
    <h3 class="text-sm font-medium text-gray-700 mb-3">Execution Settings</h3>
    
    <div class="space-y-4">
      <!-- Timeout -->
      <div>
        <label for="timeout" class="block text-sm font-medium text-gray-700 mb-2">
          Timeout (milliseconds)
        </label>
        <input
          id="timeout"
          type="number"
          bind:value={globalSettings.timeout}
          min="1000"
          max="300000"
          step="1000"
          class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          disabled={isLoading}
        />
        <p class="mt-1 text-sm text-gray-500">Maximum time to wait for sequence completion</p>
      </div>

      <!-- Continue on Error -->
      <div class="flex items-center">
        <input
          id="continue-on-error"
          type="checkbox"
          bind:checked={globalSettings.continue_on_error}
          class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          disabled={isLoading}
        />
        <label for="continue-on-error" class="ml-2 block text-sm text-gray-700">
          Continue execution even if a test flow fails
        </label>
      </div>

      <!-- Parallel Execution -->
      <div class="flex items-center">
        <input
          id="parallel-execution"
          type="checkbox"
          bind:checked={globalSettings.parallel_execution}
          class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          disabled={isLoading}
        />
        <label for="parallel-execution" class="ml-2 block text-sm text-gray-700">
          Execute test flows in parallel (when possible)
        </label>
      </div>
    </div>
  </div>

  <!-- Test Flow Selection -->
  {#if availableFlows.length > 0}
    <fieldset>
      <legend class="block text-sm font-medium text-gray-700 mb-3">
        Test Flows to Include
      </legend>
      <div class="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-3">
        {#each availableFlows as flow (flow.id)}
          <label class="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedFlows.has(flow.id)}
              on:change={() => toggleFlow(flow.id)}
              class="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              disabled={isLoading}
            />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900">{flow.name}</p>
              {#if flow.description}
                <p class="text-sm text-gray-500">{flow.description}</p>
              {/if}
              <div class="flex items-center gap-2 mt-1 text-xs text-gray-400">
                <span>{flow.steps?.length || 0} steps</span>
                <span>API: {flow.apiId}</span>
              </div>
            </div>
          </label>
        {/each}
      </div>
      <p class="mt-2 text-sm text-gray-500">
        {selectedFlows.size} of {availableFlows.length} test flows selected
      </p>
    </fieldset>
  {:else}
    <div class="bg-yellow-50 border border-yellow-200 rounded-md p-4">
      <div class="flex">
        <svg class="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
        </svg>
        <div>
          <h3 class="text-sm font-medium text-yellow-800">No Test Flows Available</h3>
          <p class="text-sm text-yellow-700 mt-1">
            You need to create test flows before adding them to a sequence.
            <a href="/dashboard/test-flows" class="font-medium underline hover:text-yellow-900">
              Create test flows now
            </a>
          </p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Form Actions -->
  <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200">
    <button
      type="button"
      on:click={handleCancel}
      class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      disabled={isLoading}
    >
      Cancel
    </button>
    <button
      type="submit"
      class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={!isValid || isLoading}
    >
      {#if isLoading}
        <svg class="w-4 h-4 mr-2 animate-spin inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
      {/if}
      {mode === 'create' ? 'Create Sequence' : 'Save Changes'}
    </button>
  </div>
</form>
