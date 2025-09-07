<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import * as environmentClient from '$lib/http_client/environments';
  import * as apiClient from '$lib/http_client/apis';
  import * as projectClient from '$lib/http_client/projects';
  import type { Project, ProjectVariable } from '$lib/http_client/projects';
  import type { Environment } from '$lib/types/environment';
  import type { GetApisResponse } from '$lib/types/api';

  // Props
  export let isOpen = false;
  export let project: Project | null = null;

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    close: void;
    saved: { project: Project };
  }>();

  // State
  let loading = false;
  let error: string | null = null;
  let availableEnvironments: Environment[] = [];
  let availableApis: GetApisResponse | null = null;
  let activeTab: 'variables' | 'apis' = 'variables';
  let showApiModal = false;

  // Configuration form data
  let selectedEnvironmentId: number | null = null;
  let selectedApiIds: number[] = [];
  let projectVariables: Record<string, ProjectVariable> = {};

  // Initialize form data when project changes
  $: if (project && isOpen) {
    selectedEnvironmentId = project.config.environment_id;
    selectedApiIds = [...project.config.api_dependencies];
    projectVariables = { ...project.config.variables };
    loadConfigurationData();
  }

  async function loadConfigurationData() {
    loading = true;
    error = null;
    
    try {
      // Load environments and APIs in parallel
      const [environments, apis] = await Promise.all([
        environmentClient.getEnvironments(),
        apiClient.getApiList()
      ]);
      
      availableEnvironments = environments;
      availableApis = apis;
    } catch (err) {
      console.error('Error loading configuration data:', err);
      error = 'Failed to load configuration data';
    } finally {
      loading = false;
    }
  }

  async function saveConfiguration() {
    if (!project) return;

    try {
      loading = true;
      error = null;

      const updateData = {
        variables: projectVariables,
        api_dependencies: selectedApiIds,
        environment_id: selectedEnvironmentId
      };

      const result = await projectClient.updateProject(project.id, updateData);
      if (result) {
        dispatch('saved', { project: result.project });
        handleClose();
      }
    } catch (err) {
      console.error('Error saving project configuration:', err);
      error = err instanceof Error ? err.message : 'Failed to save configuration';
    } finally {
      loading = false;
    }
  }

  function handleClose() {
    dispatch('close');
    error = null;
    activeTab = 'variables';
  }

  // Variable management
  function addVariable() {
    const varName = `variable_${Object.keys(projectVariables).length + 1}`;
    projectVariables = {
      ...projectVariables,
      [varName]: {
        type: 'string',
        description: '',
        required: false,
        value_source: 'hardcoded',
        hardcoded_value: '',
        environment_variable: null
      }
    };
  }

  function removeVariable(varName: string) {
    const { [varName]: removed, ...rest } = projectVariables;
    projectVariables = rest;
  }

  function updateVariable(varName: string, updates: Partial<ProjectVariable>) {
    projectVariables = {
      ...projectVariables,
      [varName]: { ...projectVariables[varName], ...updates }
    };
  }

  function updateVariableName(oldName: string, newName: string) {
    if (oldName === newName || !newName.trim() || newName in projectVariables) return;
    
    const variable = projectVariables[oldName];
    const { [oldName]: removed, ...rest } = projectVariables;
    projectVariables = {
      ...rest,
      [newName]: variable
    };
  }

  // API dependencies management
  function toggleApiDependency(apiId: number) {
    if (selectedApiIds.includes(apiId)) {
      selectedApiIds = selectedApiIds.filter(id => id !== apiId);
    } else {
      selectedApiIds = [...selectedApiIds, apiId];
    }
  }

  // Tab switching
  function switchTab(tab: 'variables' | 'apis') {
    activeTab = tab;
  }

  // Get environment variable value (similar to EnvironmentParameterMapper)
  function getEnvironmentVariableValue(environment: Environment, variableName: string): string {
    if (!environment.config.environments) {
      return 'No environments configured';
    }

    // Check if it's an API host variable
    if (variableName.startsWith('api_host_')) {
      const apiId = variableName.replace('api_host_', '');
      // Check all sub-environments for this API host
      const subEnvs = Object.entries(environment.config.environments);
      for (const [subEnvKey, subEnv] of subEnvs) {
        if (subEnv.api_hosts?.[apiId]) {
          return `${subEnv.api_hosts[apiId]} (${subEnvKey})`;
        }
      }
      return 'Not configured';
    }
    
    // Check variable definitions for default value
    if (environment.config.variable_definitions?.[variableName]) {
      const varDef = environment.config.variable_definitions[variableName];
      const defaultValue = varDef.default_value;
      
      // Check if any sub-environment overrides this value
      const subEnvs = Object.entries(environment.config.environments);
      for (const [subEnvKey, subEnv] of subEnvs) {
        if (subEnv.variables && variableName in subEnv.variables) {
          const value = subEnv.variables[variableName];
          const displayValue = typeof value === 'string' ? value : JSON.stringify(value);
          return `${displayValue} (${subEnvKey})`;
        }
      }
      
      // Return default value if no override
      if (defaultValue !== undefined && defaultValue !== null) {
        const displayValue = typeof defaultValue === 'string' ? defaultValue : JSON.stringify(defaultValue);
        return `${displayValue} (default)`;
      }
    }
    
    return 'Not configured';
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 overflow-y-auto">
    <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
      <div 
        class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
        on:click={handleClose}
        on:keydown={(e) => e.key === 'Escape' && handleClose()}
        role="button"
        tabindex="-1"
      ></div>
      
      <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:p-6">
        <div>
          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <svg class="h-6 w-6 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M8.34 1.804A1 1 0 019.32 1h1.36a1 1 0 01.98.804l.295 1.473c.497.144.971.342 1.416.587l1.25-.834a1 1 0 011.262.125l.962.962a1 1 0 01.125 1.262l-.834 1.25c.245.445.443.919.587 1.416l1.473.294a1 1 0 01.804.98v1.361a1 1 0 01-.804.98l-1.473.295a6.95 6.95 0 01-.587 1.416l.834 1.25a1 1 0 01-.125 1.262l-.962.962a1 1 0 01-1.262.125l-1.25-.834a6.953 6.953 0 01-1.416.587l-.294 1.473a1 1 0 01-.98.804H9.32a1 1 0 01-.98-.804l-.295-1.473a6.957 6.957 0 01-1.416-.587l-1.25.834a1 1 0 01-1.262-.125l-.962-.962a1 1 0 01-.125-1.262l.834-1.25a6.957 6.957 0 01-.587-1.416l-1.473-.294A1 1 0 011 10.68V9.32a1 1 0 01.804-.98l1.473-.295c.144-.497.342-.971.587-1.416l-.834-1.25a1 1 0 01.125-1.262l.962-.962A1 1 0 015.38 3.03l1.25.834a6.957 6.957 0 011.416-.587l.294-1.473zM13 10a3 3 0 11-6 0 3 3 0 016 0z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="mt-3 text-center sm:mt-5">
            <h3 class="text-lg font-semibold leading-6 text-gray-900">Project Configuration</h3>
            <div class="mt-2">
              <p class="text-sm text-gray-500">
                Configure project variables, API dependencies, and environment settings.
              </p>
            </div>
          </div>
        </div>

        <!-- Error Alert -->
        {#if error}
          <div class="mt-4 rounded-md bg-red-50 p-4">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        {/if}

        <!-- Loading State -->
        {#if loading}
          <div class="mt-4 flex justify-center py-4">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600"></div>
          </div>
        {:else}
          <!-- Configuration Tabs -->
          <div class="mt-6">
            <div class="border-b border-gray-200">
              <nav class="-mb-px flex space-x-8">
                <button 
                  type="button"
                  class="whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'variables' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
                  on:click={() => switchTab('variables')}
                >
                  Variables
                </button>
                <button 
                  type="button"
                  class="whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'apis' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
                  on:click={() => switchTab('apis')}
                >
                  APIs & Environment
                </button>
              </nav>
            </div>

            <!-- Tab Content -->
            <div class="mt-6">
              {#if activeTab === 'variables'}
                <!-- Variables Tab -->
                <div class="space-y-4">
                  <div class="flex justify-between items-center">
                    <h4 class="text-sm font-medium text-gray-900">Project Variables</h4>
                    <button
                      type="button"
                      class="inline-flex items-center rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-blue-500"
                      on:click={addVariable}
                    >
                      <svg class="-ml-0.5 mr-1 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd" />
                      </svg>
                      Add Variable
                    </button>
                  </div>

                  <!-- Variables List -->
                  <div class="space-y-3 max-h-96 overflow-y-auto">
                    {#if Object.keys(projectVariables).length === 0}
                      <div class="text-center py-8 text-gray-500">
                        <p class="text-sm">No variables defined yet. Click "Add Variable" to get started.</p>
                      </div>
                    {:else}
                      <!-- Variables Table Header -->
                      <div class="grid grid-cols-5 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-2">
                        <div>Variable Name</div>
                        <div>Type</div>
                        <div>Value Source</div>
                        <div>Value/Mapping</div>
                        <div>Actions</div>
                      </div>

                      <!-- Variables List -->
                      {#each Object.entries(projectVariables) as [varName, variable] (varName)}
                        <div class="grid grid-cols-5 gap-4 items-start border border-gray-200 rounded-lg p-3 bg-gray-50">
                          <!-- Variable Name -->
                          <div>
                            <input
                              id="var-name-{varName}"
                              type="text"
                              class="block w-full rounded-md border-0 py-1.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600"
                              value={varName}
                              on:blur={(e) => {
                                const target = e.target as HTMLInputElement;
                                if (target) {
                                  updateVariableName(varName, target.value);
                                }
                              }}
                            />
                            {#if variable.description}
                              <p class="text-xs text-gray-500 mt-1">{variable.description}</p>
                            {:else}
                              <input
                                type="text"
                                class="block w-full mt-1 rounded-md border-0 py-1 text-xs text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600"
                                placeholder="Description..."
                                bind:value={variable.description}
                                on:input={(e) => {
                                  const target = e.target as HTMLInputElement;
                                  if (target) {
                                    updateVariable(varName, { description: target.value });
                                  }
                                }}
                              />
                            {/if}
                          </div>

                          <!-- Variable Type -->
                          <div>
                            <select
                              id="var-type-{varName}"
                              class="block w-full rounded-md border-0 py-1.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600"
                              bind:value={variable.type}
                              on:change={(e) => {
                                const target = e.target as HTMLSelectElement;
                                if (target) {
                                  updateVariable(varName, { type: target.value as 'string' | 'number' | 'boolean' });
                                }
                              }}
                            >
                              <option value="string">String</option>
                              <option value="number">Number</option>
                              <option value="boolean">Boolean</option>
                            </select>
                            <div class="flex items-center mt-1">
                              <input
                                id="var-required-{varName}"
                                type="checkbox"
                                class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                                bind:checked={variable.required}
                                on:change={(e) => {
                                  const target = e.target as HTMLInputElement;
                                  if (target) {
                                    updateVariable(varName, { required: target.checked });
                                  }
                                }}
                              />
                              <label for="var-required-{varName}" class="ml-1 text-xs text-gray-600">Required</label>
                            </div>
                          </div>

                          <!-- Value Source -->
                          <div>
                            <select
                              id="var-source-{varName}"
                              class="block w-full rounded-md border-0 py-1.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600"
                              bind:value={variable.value_source}
                              on:change={(e) => {
                                const target = e.target as HTMLSelectElement;
                                if (target) {
                                  updateVariable(varName, { value_source: target.value as 'hardcoded' | 'environment' });
                                }
                              }}
                            >
                              <option value="hardcoded">Hardcoded</option>
                              <option value="environment">Environment</option>
                            </select>
                          </div>

                          <!-- Value/Mapping -->
                          <div>
                            {#if variable.value_source === 'environment'}
                              <select
                                id="var-env-{varName}"
                                class="block w-full rounded-md border-0 py-1.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600"
                                bind:value={variable.environment_variable}
                                on:change={(e) => {
                                  const target = e.target as HTMLSelectElement;
                                  if (target) {
                                    updateVariable(varName, { environment_variable: target.value });
                                  }
                                }}
                              >
                                <option value="">Select environment variable...</option>
                                {#if selectedEnvironmentId && availableEnvironments}
                                  {@const linkedEnv = availableEnvironments.find(env => env.id === selectedEnvironmentId)}
                                  {#if linkedEnv}
                                    <!-- Environment variables from variable definitions -->
                                    {#if linkedEnv.config.variable_definitions}
                                      {#each Object.keys(linkedEnv.config.variable_definitions) as envVar}
                                        <option value={envVar}>{envVar}</option>
                                      {/each}
                                    {/if}
                                    <!-- API host variables -->
                                    {#if linkedEnv.config.linked_apis}
                                      {#each linkedEnv.config.linked_apis as apiId}
                                        <option value="api_host_{apiId}">api_host_{apiId}</option>
                                      {/each}
                                    {/if}
                                  {/if}
                                {/if}
                              </select>
                              <!-- Show current value if environment variable is selected -->
                              {#if variable.environment_variable && selectedEnvironmentId}
                                {@const linkedEnv = availableEnvironments.find(env => env.id === selectedEnvironmentId)}
                                {#if linkedEnv}
                                  {@const currentValue = getEnvironmentVariableValue(linkedEnv, variable.environment_variable)}
                                  <div class="mt-1">
                                    <span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium {currentValue === 'Not configured' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}">
                                      {currentValue}
                                    </span>
                                  </div>
                                {/if}
                              {/if}
                            {:else}
                              <!-- Hardcoded value input -->
                              {#if variable.type === 'boolean'}
                                <select
                                  id="var-value-{varName}"
                                  class="block w-full rounded-md border-0 py-1.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600"
                                  bind:value={variable.hardcoded_value}
                                  on:change={(e) => {
                                    const target = e.target as HTMLSelectElement;
                                    if (target) {
                                      updateVariable(varName, { hardcoded_value: target.value === 'true' });
                                    }
                                  }}
                                >
                                  <option value={true}>True</option>
                                  <option value={false}>False</option>
                                </select>
                              {:else if variable.type === 'number'}
                                <input
                                  id="var-value-{varName}"
                                  type="number"
                                  class="block w-full rounded-md border-0 py-1.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600"
                                  bind:value={variable.hardcoded_value}
                                  on:input={(e) => {
                                    const target = e.target as HTMLInputElement;
                                    if (target) {
                                      updateVariable(varName, { hardcoded_value: parseFloat(target.value) || 0 });
                                    }
                                  }}
                                />
                              {:else}
                                <input
                                  id="var-value-{varName}"
                                  type="text"
                                  class="block w-full rounded-md border-0 py-1.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600"
                                  placeholder="Variable value"
                                  bind:value={variable.hardcoded_value}
                                  on:input={(e) => {
                                    const target = e.target as HTMLInputElement;
                                    if (target) {
                                      updateVariable(varName, { hardcoded_value: target.value });
                                    }
                                  }}
                                />
                              {/if}
                            {/if}
                          </div>

                          <!-- Actions -->
                          <div class="flex justify-end">
                            <button
                              type="button"
                              class="text-red-600 hover:text-red-800 text-sm"
                              on:click={() => removeVariable(varName)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      {/each}
                    {/if}
                  </div>
                </div>
              {:else if activeTab === 'apis'}
                <!-- APIs & Environment Tab -->
                <div class="space-y-8">
                  <!-- Environment and API Dependencies in one row -->
                  <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <!-- Environment Integration -->
                    <div>
                      <h4 class="text-lg font-medium text-gray-800 mb-4">Environment Integration</h4>
                      <div class="space-y-4">
                        <div>
                          <label for="linked-environment" class="block text-sm font-medium text-gray-700 mb-2">
                            Linked Environment
                          </label>
                          <select
                            id="linked-environment"
                            class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                            bind:value={selectedEnvironmentId}
                          >
                            <option value={null}>No environment linked</option>
                            {#each availableEnvironments as env (env.id)}
                              <option value={env.id}>{env.name}</option>
                            {/each}
                          </select>
                          <p class="mt-1 text-xs text-gray-500">
                            Link an environment to enable variable resolution from environment values
                          </p>
                        </div>
                        
                        <!-- Environment Summary -->
                        {#if selectedEnvironmentId}
                          {@const linkedEnv = availableEnvironments.find(env => env.id === selectedEnvironmentId)}
                          {#if linkedEnv}
                            <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
                              <h5 class="text-sm font-medium text-gray-700 mb-2">Environment Details</h5>
                              <div class="space-y-2 text-sm text-gray-600">
                                <div><span class="font-medium">Name:</span> {linkedEnv.name}</div>
                                {#if linkedEnv.description}
                                  <div><span class="font-medium">Description:</span> {linkedEnv.description}</div>
                                {/if}
                                {#if linkedEnv.config.environments && Object.keys(linkedEnv.config.environments).length > 0}
                                  <div><span class="font-medium">Sub-environments:</span> {Object.keys(linkedEnv.config.environments).join(', ')}</div>
                                {/if}
                                {#if linkedEnv.config.variable_definitions && Object.keys(linkedEnv.config.variable_definitions).length > 0}
                                  <div><span class="font-medium">Variables:</span> {Object.keys(linkedEnv.config.variable_definitions).length}</div>
                                {/if}
                              </div>
                              <div class="mt-3">
                                <a
                                  href="/dashboard/environments/{linkedEnv.id}"
                                  class="inline-flex items-center text-xs text-blue-600 hover:text-blue-800"
                                  target="_blank"
                                >
                                  <svg class="mr-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                                  </svg>
                                  View Environment Details
                                </a>
                              </div>
                            </div>
                          {/if}
                        {:else}
                          <div class="flex flex-col items-center justify-center bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                            <svg class="h-8 w-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                            </svg>
                            <p class="text-sm text-gray-600">No environment linked</p>
                            <p class="text-xs text-gray-500 mt-1">Select an environment above to enable variable resolution</p>
                          </div>
                        {/if}
                      </div>
                    </div>

                    <!-- API Dependencies -->
                    <div>
                      <div class="flex items-center justify-between mb-3">
                        <h4 class="text-lg font-medium text-gray-800">API Dependencies</h4>
                        <button
                          type="button"
                          class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 flex items-center"
                          on:click={() => showApiModal = true}
                        >
                          <svg class="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                          </svg>
                          Add API
                        </button>
                      </div>
                      
                      <p class="mb-4 text-sm text-gray-600">
                        Select APIs that this project depends on. This helps with variable resolution and integration.
                      </p>
                      
                      <!-- Selected APIs List -->
                      {#if selectedApiIds.length > 0}
                        <div class="rounded-lg border border-gray-200 overflow-hidden">
                          <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                              <tr>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">API Name</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Host</th>
                                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Actions</th>
                              </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                              {#each selectedApiIds as apiId, index}
                                {@const api = availableApis?.apis.find(a => a.id === apiId)}
                                {#if api}
                                  <tr class={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td class="px-4 py-3 whitespace-nowrap">
                                      <div class="flex items-center space-x-2">
                                        <span class="text-sm font-medium text-gray-900">{api.name}</span>
                                        <span class="text-xs text-gray-500">ID: {api.id}</span>
                                      </div>
                                    </td>
                                    <td class="px-4 py-3 whitespace-nowrap">
                                      <span class="text-sm text-gray-600">{api.host || 'Not configured'}</span>
                                    </td>
                                    <td class="px-4 py-3 whitespace-nowrap text-right">
                                      <button
                                        type="button"
                                        class="inline-flex items-center justify-center p-1.5 rounded-full text-red-600 hover:text-white hover:bg-red-600 transition-colors"
                                        on:click={() => toggleApiDependency(apiId)}
                                        aria-label="Remove API dependency"
                                        title="Remove this API dependency"
                                      >
                                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                        </svg>
                                      </button>
                                    </td>
                                  </tr>
                                {/if}
                              {/each}
                            </tbody>
                          </table>
                        </div>
                      {:else}
                        <div class="flex flex-col items-center justify-center bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                          <svg class="h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path>
                          </svg>
                          <p class="mb-4 text-gray-600">No API dependencies configured yet</p>
                          <button
                            type="button"
                            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center text-sm"
                            on:click={() => showApiModal = true}
                          >
                            <svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                            </svg>
                            Add Your First API Dependency
                          </button>
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Modal Actions -->
        <div class="mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
          <button
            type="button"
            class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2 disabled:opacity-50"
            disabled={loading}
            on:click={saveConfiguration}
          >
            {#if loading}
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            {/if}
            Save Configuration
          </button>
          <button
            type="button"
            class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0"
            on:click={handleClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- API Selection Modal -->
{#if showApiModal}
  <div class="fixed inset-0 z-50 overflow-y-auto">
    <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
      <div 
        class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
        on:click={() => showApiModal = false}
        on:keydown={(e) => e.key === 'Escape' && (showApiModal = false)}
        role="button"
        tabindex="-1"
      ></div>
      
      <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
        <div>
          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path>
            </svg>
          </div>
          <div class="mt-3 text-center sm:mt-5">
            <h3 class="text-lg font-semibold leading-6 text-gray-900">Add API Dependency</h3>
            <div class="mt-2">
              <p class="text-sm text-gray-500">
                Select APIs that this project depends on for configuration and testing.
              </p>
            </div>
          </div>
        </div>

        {#if availableApis && availableApis.apis && availableApis.apis.length > 0}
          <div class="mt-6">
            <h4 class="text-sm font-medium text-gray-900 mb-3">Available APIs</h4>
            <div class="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
              {#each availableApis.apis as api (api.id)}
                {@const isAlreadySelected = selectedApiIds.includes(api.id)}
                <div class="border-b border-gray-100 last:border-b-0">
                  <div class="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div class="flex-1">
                      <h4 class="font-medium text-gray-900">{api.name}</h4>
                      <p class="text-sm text-gray-500 mt-1">{api.host || 'No host configured'}</p>
                      {#if api.description}
                        <p class="text-xs text-gray-400 mt-1">{api.description}</p>
                      {/if}
                      <p class="text-xs text-gray-400 mt-1">ID: {api.id}</p>
                    </div>
                    <button
                      type="button"
                      class="ml-4 rounded-md px-3 py-1.5 text-sm transition
                             {isAlreadySelected 
                               ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                               : 'bg-blue-600 text-white hover:bg-blue-700'}"
                      disabled={isAlreadySelected}
                      on:click={() => {
                        if (!isAlreadySelected) {
                          toggleApiDependency(api.id);
                        }
                      }}
                    >
                      {isAlreadySelected ? 'Already Added' : 'Add'}
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {:else}
          <div class="mt-6 text-center">
            <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path>
              </svg>
            </div>
            <h3 class="mt-2 text-sm font-medium text-gray-900">No APIs Available</h3>
            <p class="mt-1 text-sm text-gray-500">
              No APIs found in your workspace. Create APIs first to add them as dependencies.
            </p>
            <div class="mt-4">
              <a
                href="/dashboard/apis"
                class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
              >
                <svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
                Create Your First API
              </a>
            </div>
          </div>
        {/if}

        <div class="mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
          <button
            type="button"
            class="inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0"
            on:click={() => showApiModal = false}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
