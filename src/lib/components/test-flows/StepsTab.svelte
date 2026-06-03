<script lang="ts">
  
  import TestFlowEditor from './TestFlowEditor.svelte';
  import type { TestFlowData, Endpoint } from './types';
  import type { Environment } from '$lib/types/environment';

  interface Props {
    [key: string]: unknown;
    testFlowId?: string | number | undefined; // Pass through test flow ID
    flowData: TestFlowData;
    endpoints?: Endpoint[];
    environment?: Environment | null;
    selectedSubEnvironment?: string | null;
  }

  let {
    testFlowId = undefined,
    flowData,
    endpoints = [],
    environment = null,
    selectedSubEnvironment = null
  , ...callbackProps
  }: Props & Record<string, unknown> = $props();

  function dispatch(eventName: string, detail?: unknown) {
    const handler = callbackProps["on" + eventName.charAt(0).toUpperCase() + eventName.slice(1)];
    if (typeof handler === "function") {
      if (arguments.length > 1) {
        handler(detail);
      } else {
        handler();
      }
    }
  }

  // Check if there are valid API hosts configured
  let hasValidApiHosts = $derived(flowData.settings.api_hosts && 
    Object.keys(flowData.settings.api_hosts).length > 0 &&
    Object.values(flowData.settings.api_hosts).some(
      (hostInfo) => hostInfo && hostInfo.url && hostInfo.url.trim() !== ''
    ));

  function handleTestFlowChange(payload: any) {
    dispatch('change', payload);
  }

  function handleReset(payload: any) {
    dispatch('reset', payload);
  }

  function handleExecutionComplete(payload: any) {
    dispatch('executionComplete', payload);
  }

  function handleLog(payload: any) {
    dispatch('log', payload);
  }

  function handleError(payload: any) {
    dispatch('error', payload);
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
    onChange={handleTestFlowChange}
    onReset={handleReset}
    onExecutionComplete={handleExecutionComplete}
    onLog={handleLog}
    onError={handleError}
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
