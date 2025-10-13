<script lang="ts">
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import type { TestFlowData } from '$lib/components/test-flows/types';
  import { getTestFlow } from '$lib/http_client/test-flow';
  import { setBreadcrumbOverride, clearBreadcrumbOverride } from '$lib/store/breadcrumb';

  // Import the new container components
  import StepsTab from '$lib/components/test-flows/StepsTab.svelte';
  import SettingsTab from '$lib/components/test-flows/SettingsTab.svelte';
  import { getProjectEnvironment } from '$lib/http_client/projects';
  import { projectStore } from '$lib/store/project';
  import type { Environment } from '$lib/types/environment';

  // Import the test flow store
  import {
    initializeTestFlow,
    testFlow,
    testFlowName,
    testFlowDescription,
    flowJson,
    isDirty,
    isSaving,
    error,
    saveTestFlow,
    updateName,
    updateDescription,
    updateFlowJson,
    updateFlowSettings,
    clearError,
    markDirty
  } from '$lib/store/test-flow';

  let testFlowId = $derived(parseInt($page.params.id || '0'));

  let endpoints: any[] = $state([]);
  let loading = $state(true);
  let currentTab: 'steps' | 'settings' = $state('steps');

  // Environment for linking (single environment per project)
  let environment: Environment | null = $state(null);

  // Load projects on mount if not already loaded
  onMount(async () => {
    await fetchTestFlow();
    await loadEnvironment();
  });

  // Update document title and breadcrumb when testFlow is loaded
  $effect(() => {
    if ($testFlowName && typeof document !== 'undefined') {
      document.title = `${$testFlowName} - Test Pilot`;
      setBreadcrumbOverride(testFlowId.toString(), $testFlowName);
    }
  });

  // Clean up breadcrumb override when component is destroyed
  onDestroy(() => {
    clearBreadcrumbOverride(testFlowId.toString());
  });

  async function fetchTestFlow() {
    try {
      loading = true;
      clearError();

      const data = await getTestFlow(testFlowId.toString());
      if (!data) {
        throw new Error(`Failed to fetch test flow`);
      }
      
      endpoints = data.testFlow.endpoints || [];

      // Initialize the test flow store with the fetched data
      initializeTestFlow(
        data.testFlow.id,
        data.testFlow.name,
        data.testFlow.description,
        data.testFlow.flowJson || {
          settings: { api_hosts: {} },
          steps: [],
          parameters: [],
          outputs: []
        }
      );
    } catch (err: any) {
      console.error('Error fetching test flow:', err);
      $error = err.message;
    } finally {
      loading = false;
    }
  }

  async function loadEnvironment() {
    try {
      // Get selected project from store
      const selectedProject = $projectStore.selectedProject;
      if (!selectedProject) {
        console.warn('No project selected, cannot load environment');
        return;
      }

      const response = await getProjectEnvironment(selectedProject.id);
      // Convert ProjectEnvironmentLink.environment to Environment type
      if (response.environment?.environment) {
        const envData = response.environment.environment;
        environment = {
          id: envData.id,
          name: envData.name,
          description: envData.description,
          config: envData.config,
          userId: 0, // Not needed for display purposes
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      } else {
        environment = null;
      }
      console.log('Environment loaded:', environment);
    } catch (err) {
      console.error('Error loading environment:', err);
      environment = null;
    }
  }

  // Handle changes from child components
  function handleNameChange(event: CustomEvent<{ name: string }>) {
    updateName(event.detail.name);
  }

  function handleDescriptionChange(event: CustomEvent<{ description: string | null }>) {
    updateDescription(event.detail.description);
  }

  function handleApiHostsChange(event: CustomEvent<{ apiHosts: any }>) {
    const currentSettings = $flowJson.settings;
    updateFlowSettings({
      ...currentSettings,
      api_hosts: event.detail.apiHosts
    });
  }

  function handleEnvironmentChange(event: CustomEvent<{ linkedEnvironment: any }>) {
    const currentSettings = $flowJson.settings;
    updateFlowSettings({
      ...currentSettings,
      linkedEnvironment: event.detail.linkedEnvironment
    });
  }

  function handleTestFlowChange(event: CustomEvent) {
    const updatedFlowData = event.detail;
    if (updatedFlowData) {
      updateFlowJson(updatedFlowData);
    }
  }

  // Reset execution state
  function handleReset() {
    console.log('FlowRunner reset event received');
  }

  // Handle execution completion
  function handleLog(event: CustomEvent) {
    const { level, message, details } = event.detail;
    console.log(`[LOG] ${level.toUpperCase()}: ${message}`, details || '');
    if (level === 'error') {
      $error = message;
    }
  }

  function handleExecutionComplete(event: CustomEvent) {
    console.log('Flow execution complete:', event.detail);
    const { success, error: executionError } = event.detail;

    if (!success && executionError) {
      $error = executionError.message || 'An error occurred during flow execution';
    }
  }

  async function handleSave() {
    const result = await saveTestFlow();
    if (!result.success && result.error) {
      // Error is already set in the store by saveTestFlow
      console.error('Save failed:', result.error);
    }
  }
</script>

<div class="container mx-auto px-4 py-4">
  {#if $error}
    <div class="relative mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
      <span class="block sm:inline">{$error}</span>
      <button class="absolute top-0 right-0 bottom-0 px-4" onclick={() => clearError()}>
        ×
      </button>
    </div>
  {/if}

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
    </div>
  {:else if $testFlow}
    <div class="mb-6">
      <div class="rounded-lg bg-white shadow">
        <div class="border-b border-gray-200">
          <nav class="flex flex-wrap justify-between items-center">
            <div class="flex">
              <button
                class="border-b-2 px-6 py-3 text-sm font-medium text-gray-700
                      {currentTab === 'steps'
                  ? 'border-blue-500 text-blue-500'
                  : 'border-transparent hover:border-gray-300'}"
                onclick={() => (currentTab = 'steps')}
              >
                Steps
              </button>
              <button
                class="border-b-2 px-6 py-3 text-sm font-medium text-gray-700
                      {currentTab === 'settings'
                  ? 'border-blue-500 text-blue-500'
                  : 'border-transparent hover:border-gray-300'}"
                onclick={() => (currentTab = 'settings')}
              >
                Settings
              </button>
            </div>
            
            <div class="px-6 py-3">
              <button
                class="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white shadow-md transition-all hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={$isSaving || !$testFlowName?.trim()}
                onclick={handleSave}
                title={$isSaving ? 'Saving changes...' : (!$testFlowName?.trim() ? 'Flow name is required' : 'Save changes to test flow')}
              >
                {#if $isSaving}
                  <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span class="font-medium">Saving...</span>
                {:else}
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12"></path>
                  </svg>
                  <span class="font-medium">Save Changes</span>
                {/if}
              </button>
            </div>
          </nav>
        </div>

        <div class="p-6">
          <!-- Steps Tab -->
          {#if currentTab === 'steps'}
            <StepsTab
              flowData={$flowJson}
              {endpoints}
              {environment}
              selectedSubEnvironment={$flowJson.settings.environment?.subEnvironment || null}
              on:change={handleTestFlowChange}
              on:reset={handleReset}
              on:executionComplete={handleExecutionComplete}
              on:log={handleLog}
            />
          {/if}

          <!-- Settings Tab -->
          {#if currentTab === 'settings'}
            <SettingsTab
              name={$testFlowName}
              description={$testFlowDescription}
              flowJson={$flowJson}
              {environment}
              disabled={$isSaving}
              on:nameChange={handleNameChange}
              on:descriptionChange={handleDescriptionChange}
              on:apiHostsChange={handleApiHostsChange}
              on:environmentChange={handleEnvironmentChange}
            />
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
