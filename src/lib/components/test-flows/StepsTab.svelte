<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import TestFlowEditor from './TestFlowEditor.svelte';
  import type { TestFlowData, Endpoint } from './types';
  import type { Environment } from '$lib/types/environment';

  export let testFlowId: string | number | undefined = undefined; // Pass through test flow ID
  export let flowData: TestFlowData;
  export let endpoints: Endpoint[] = [];
  export let environment: Environment | null = null;
  export let selectedSubEnvironment: string | null = null;

  const dispatch = createEventDispatcher();

  // Check if there are valid API hosts configured
  $: hasValidApiHosts = flowData.settings.api_hosts && 
    Object.keys(flowData.settings.api_hosts).length > 0 &&
    Object.values(flowData.settings.api_hosts).some(
      (hostInfo) => hostInfo && hostInfo.url && hostInfo.url.trim() !== ''
    );

  function handleTestFlowChange(event: CustomEvent) {
    dispatch('change', event.detail);
  }

  function handleReset(event: CustomEvent) {
    dispatch('reset', event.detail);
  }

  function handleExecutionComplete(event: CustomEvent) {
    dispatch('executionComplete', event.detail);
  }

  function handleLog(event: CustomEvent) {
    dispatch('log', event.detail);
  }
</script>

<div class="space-y-4">
  {#if !hasValidApiHosts}
    <div class="mb-4 rounded border border-yellow-300 bg-yellow-100 px-4 py-3 text-yellow-800">
      <p class="font-medium">API Hosts Not Configured</p>
      <p>
        Please configure at least one API host in the Settings tab before running the test flow.
      </p>
    </div>
  {/if}

  <!-- Use the TestFlowEditor component for a cleaner implementation -->
  <TestFlowEditor
    {testFlowId}
    {flowData}
    {endpoints}
    {environment}
    {selectedSubEnvironment}
    on:change={handleTestFlowChange}
    on:reset={handleReset}
    on:executionComplete={handleExecutionComplete}
    on:log={handleLog}
  />

  <!-- Empty state when there are no steps -->
  {#if flowData.steps.length === 0}
    <div class="mt-4 rounded-lg bg-gray-50 p-8 text-center">
      <h3 class="mb-2 text-xl font-semibold">No Steps Yet</h3>
      <p class="mb-6 text-gray-600">Add steps to define your test flow sequence.</p>
      <p class="text-sm text-gray-500">
        Steps will appear here once you add them using the "Add New Step" button below.
      </p>
    </div>
  {/if}
</div>
