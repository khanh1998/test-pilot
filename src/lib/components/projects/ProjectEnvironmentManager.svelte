<!-- ProjectEnvironmentManager.svelte - Manage environments for a project -->
<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { ProjectEnvironment } from '../../types/project.js';
  import type { Environment } from '../../types/environment.js';
  import type { ProjectEnvironmentLink } from '../../types/project_environment.js';
  import * as environmentClient from '../../http_client/environments.js';
  import * as projectClient from '../../http_client/projects.js';
  import { formatDate } from '../../utils/date.js';

  export let environments: ProjectEnvironment[] = [];
  export let loading = false;
  export let projectId: number;
  export let projectVariables: any[] = []; // Project variables for mapping

  const dispatch = createEventDispatcher<{
    link: { environmentId: number; variableMappings: Record<string, string> };
    updateMapping: { id: number; variableMappings: Record<string, string> };
    unlink: { id: number };
  }>();

  let showLinkModal = false;
  let editingMapping: ProjectEnvironment | null = null;
  let availableEnvironments: Environment[] = [];
  let linkedEnvironments: ProjectEnvironmentLink[] = [];
  let selectedEnvironmentId: number | null = null;
  let selectedEnvironment: Environment | null = null;
  let selectedSubEnvironment: string | null = null;
  let variableMappings: Record<string, string> = {};
  let environmentLoading = false;

  // Edit mode state
  let editSelectedSubEnvironment: string | null = null;
  let editVariableMappings: Record<string, string> = {};

  // Load available environments and linked environments on mount
  onMount(async () => {
    await loadAvailableEnvironments();
    await loadLinkedEnvironments();
  });

  async function loadAvailableEnvironments() {
    try {
      environmentLoading = true;
      availableEnvironments = await environmentClient.getEnvironments();
    } catch (error) {
      console.error('Failed to load environments:', error);
      availableEnvironments = [];
    } finally {
      environmentLoading = false;
    }
  }

  async function loadLinkedEnvironments() {
    try {
      const response = await projectClient.getProjectEnvironments(projectId);
      linkedEnvironments = response.environments || [];
    } catch (error) {
      console.error('Failed to load linked environments:', error);
      linkedEnvironments = [];
    }
  }

  // Get environment variables from selected environment
  function getEnvironmentVariables(env: Environment): string[] {
    const variables = new Set<string>();
    
    // Add variables from variable definitions
    if (env.config.variable_definitions) {
      Object.keys(env.config.variable_definitions).forEach(varName => {
        variables.add(varName);
      });
    }
    
    // Add API host variables (api_host_1, api_host_2, etc.)
    if (env.config.linked_apis && env.config.linked_apis.length > 0) {
      env.config.linked_apis.forEach(apiId => {
        variables.add(`api_host_${apiId}`);
      });
    }
    
    return Array.from(variables).sort();
  }

  // Get the current value of an environment variable for the selected sub-environment
  function getEnvironmentVariablePreview(env: Environment, variableName: string, subEnv: string | null): string {
    if (!subEnv || !env.config.environments[subEnv]) {
      return 'No sub-environment selected';
    }

    const subEnvConfig = env.config.environments[subEnv];
    
    // Check if it's an API host variable
    if (variableName.startsWith('api_host_')) {
      const apiId = variableName.replace('api_host_', '');
      return subEnvConfig.api_hosts?.[apiId] || 'Not configured';
    }
    
    // Check sub-environment variables
    if (subEnvConfig.variables && variableName in subEnvConfig.variables) {
      const value = subEnvConfig.variables[variableName];
      return typeof value === 'string' ? value : JSON.stringify(value);
    }
    
    // Check default value from variable definitions
    if (env.config.variable_definitions?.[variableName]) {
      const defaultValue = env.config.variable_definitions[variableName].default_value;
      return defaultValue ? (typeof defaultValue === 'string' ? defaultValue : JSON.stringify(defaultValue)) : 'No default value';
    }
    
    return 'Not configured';
  }

  // Get available sub-environments
  function getSubEnvironments(env: Environment): Array<{key: string, name: string}> {
    if (!env.config.environments) return [];
    
    return Object.entries(env.config.environments).map(([key, config]) => ({
      key,
      name: config.name || key
    }));
  }

  // Get project variable names
  $: projectVariableNames = projectVariables.map(v => v.name).sort();

  // Filter out already linked environments (based on environments prop from project_environments table)
  $: filteredEnvironments = availableEnvironments.filter(env => 
    !environments.some(linkedEnv => linkedEnv.environmentId === env.id)
  );

  // Update selected environment when selection changes
  $: {
    if (selectedEnvironmentId) {
      const newSelectedEnvironment = availableEnvironments.find(env => env.id === selectedEnvironmentId) || null;
      if (newSelectedEnvironment !== selectedEnvironment) {
        selectedEnvironment = newSelectedEnvironment;
        // Reset sub-environment selection when environment changes
        selectedSubEnvironment = null;
        
        // Initialize variable mappings for all project variables when environment is selected
        if (selectedEnvironment && projectVariableNames.length > 0) {
          const newMappings: Record<string, string> = {};
          projectVariableNames.forEach(varName => {
            newMappings[varName] = variableMappings[varName] || '';
          });
          variableMappings = newMappings;
        }
      }
    } else if (selectedEnvironment !== null) {
      selectedEnvironment = null;
      selectedSubEnvironment = null;
      variableMappings = {};
    }
  }

  // Auto-select first sub-environment when environment is first selected
  $: if (selectedEnvironment && selectedSubEnvironment === null) {
    const subEnvs = getSubEnvironments(selectedEnvironment);
    if (subEnvs.length > 0) {
      selectedSubEnvironment = subEnvs[0].key;
    }
  }

  function handleLink() {
    if (!selectedEnvironmentId) return;
    
    // Filter out empty mappings
    const filteredMappings = Object.fromEntries(
      Object.entries(variableMappings).filter(([_, envVar]) => envVar !== '')
    );
    
    dispatch('link', { 
      environmentId: selectedEnvironmentId, 
      variableMappings: filteredMappings 
    });
    
    resetLinkForm();
    showLinkModal = false;
  }

  function handleEdit(envMapping: ProjectEnvironment) {
    editingMapping = { ...envMapping };
    
    // Initialize edit state with all project variables
    editVariableMappings = {};
    projectVariableNames.forEach(varName => {
      editVariableMappings[varName] = envMapping.variableMappings[varName] || '';
    });
    
    // Find the full environment data and auto-select first sub-environment if available
    const fullEnvironment = availableEnvironments.find(env => env.id === envMapping.environmentId);
    if (fullEnvironment) {
      const subEnvs = getSubEnvironments(fullEnvironment);
      if (subEnvs.length > 0) {
        editSelectedSubEnvironment = subEnvs[0].key;
      }
    }
  }

  function handleUpdateMapping() {
    if (!editingMapping) return;
    
    // Filter out empty mappings
    const filteredMappings = Object.fromEntries(
      Object.entries(editVariableMappings).filter(([_, envVar]) => envVar !== '')
    );
    
    dispatch('updateMapping', { 
      id: editingMapping.id, 
      variableMappings: filteredMappings 
    });
    
    // Reset edit state
    editingMapping = null;
    editSelectedSubEnvironment = null;
    editVariableMappings = {};
  }

  function handleUnlink(envMapping: ProjectEnvironment) {
    const envName = envMapping.environment?.name || `Environment ${envMapping.environmentId}`;
    if (confirm(`Are you sure you want to unlink "${envName}"?`)) {
      dispatch('unlink', { id: envMapping.id });
    }
  }

  function resetLinkForm() {
    selectedEnvironmentId = null;
    selectedEnvironment = null;
    selectedSubEnvironment = null;
    variableMappings = {};
  }

  function updateMappingKey(oldKey: string, newKey: string) {
    if (oldKey === newKey) return;
    const value = variableMappings[oldKey];
    delete variableMappings[oldKey];
    variableMappings[newKey] = value;
    variableMappings = { ...variableMappings };
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h3 class="text-lg font-medium text-gray-900">Environment Management</h3>
      <p class="mt-1 text-sm text-gray-500">
        Link environments to this project and configure variable mappings.
      </p>
    </div>
    
    <button
      type="button"
      on:click={() => (showLinkModal = true)}
      class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
    >
      <svg class="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
      </svg>
      Link Environment
    </button>
  </div>

  <!-- Environments List -->
  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
    </div>
  {:else if environments.length === 0}
    <div class="text-center py-12">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">No Environments Linked</h3>
      <p class="mt-1 text-sm text-gray-500">Get started by linking an environment to this project.</p>
      <div class="mt-6">
        <button
          type="button"
          on:click={() => (showLinkModal = true)}
          class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          Link Environment
        </button>
      </div>
    </div>
  {:else}
    <div class="bg-white shadow overflow-hidden sm:rounded-md">
      <ul class="divide-y divide-gray-200">
        {#each environments as envMapping}
          <li class="px-6 py-4">
            {#if editingMapping && editingMapping.id === envMapping.id}
              <!-- Enhanced Edit Mode -->
              {@const fullEnvironment = availableEnvironments.find(env => env.id === envMapping.environmentId)}
              <div class="space-y-6">
                <div class="flex items-center justify-between">
                  <h4 class="text-lg font-medium text-gray-900">
                    Edit Environment Link: {envMapping.environment?.name || `Environment ${envMapping.environmentId}`}
                  </h4>
                </div>

                {#if fullEnvironment}
                  <!-- Sub-environment Selection -->
                  <div>
                    <h5 class="block text-sm font-medium text-gray-700 mb-2">
                      Sub-environment
                    </h5>
                    <div class="flex flex-wrap gap-2">
                      {#each getSubEnvironments(fullEnvironment) as subEnv}
                        <button
                          type="button"
                          on:click={() => editSelectedSubEnvironment = subEnv.key}
                          class="px-3 py-1 text-xs font-medium rounded-md border transition-colors"
                          class:bg-blue-100={editSelectedSubEnvironment === subEnv.key}
                          class:text-blue-800={editSelectedSubEnvironment === subEnv.key}
                          class:border-blue-300={editSelectedSubEnvironment === subEnv.key}
                          class:bg-gray-50={editSelectedSubEnvironment !== subEnv.key}
                          class:text-gray-700={editSelectedSubEnvironment !== subEnv.key}
                          class:border-gray-300={editSelectedSubEnvironment !== subEnv.key}
                          class:hover:bg-gray-100={editSelectedSubEnvironment !== subEnv.key}
                        >
                          {subEnv.name}
                        </button>
                      {/each}
                    </div>
                  </div>

                  <!-- Variable Mappings -->
                  <div>
                    <h5 class="block text-sm font-medium text-gray-700 mb-3">
                      Variable Mappings
                    </h5>
                    <div class="overflow-x-auto">
                      <div class="inline-block min-w-full align-middle">
                        <div class="grid grid-cols-7 gap-3 text-xs font-medium text-gray-500 mb-2">
                          <div class="col-span-2">Project Variable</div>
                          <div class="text-center">→</div>
                          <div class="col-span-2">Environment Variable</div>
                          <div class="col-span-2">Preview Value</div>
                        </div>
                        <div class="space-y-2">
                          {#each projectVariableNames as projectVar}
                            <div class="grid grid-cols-7 gap-3 items-center">
                              <div class="col-span-2">
                                <span class="text-sm font-medium text-gray-900">{projectVar}</span>
                              </div>
                              <div class="flex justify-center">
                                <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                                </svg>
                              </div>
                              <div class="col-span-2">
                                <select
                                  bind:value={editVariableMappings[projectVar]}
                                  class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                >
                                  <option value="">Select variable...</option>
                                  {#each getEnvironmentVariables(fullEnvironment) as envVar}
                                    <option value={envVar}>{envVar}</option>
                                  {/each}
                                </select>
                              </div>
                              <div class="col-span-2">
                                {#if editVariableMappings[projectVar] && editSelectedSubEnvironment}
                                  {@const previewValue = getEnvironmentVariablePreview(fullEnvironment, editVariableMappings[projectVar], editSelectedSubEnvironment)}
                                  <span class="text-xs font-mono px-2 py-1 rounded {previewValue === 'Not configured' || previewValue === 'No sub-environment selected' ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-700'}">
                                    {previewValue}
                                  </span>
                                {:else}
                                  <span class="text-xs text-gray-400">No mapping</span>
                                {/if}
                              </div>
                            </div>
                          {/each}
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- API Hosts Display -->
                  {#if editSelectedSubEnvironment}
                    {@const currentSubEnv = fullEnvironment.config.environments[editSelectedSubEnvironment]}
                    {#if currentSubEnv?.api_hosts && Object.keys(currentSubEnv.api_hosts).length > 0}
                      <div class="p-3 bg-gray-50 rounded-md">
                        <h6 class="text-xs font-medium text-gray-700 mb-2">
                          API Hosts ({getSubEnvironments(fullEnvironment).find(s => s.key === editSelectedSubEnvironment)?.name || editSelectedSubEnvironment})
                        </h6>
                        <div class="text-xs text-gray-600 space-y-1">
                          {#each Object.entries(currentSubEnv.api_hosts) as [apiId, host]}
                            <div class="flex justify-between">
                              <span class="font-medium">{apiId}:</span>
                              <span class="text-blue-600 font-mono">{host}</span>
                            </div>
                          {/each}
                        </div>
                      </div>
                    {/if}
                  {/if}
                {:else}
                  <div class="text-center py-8 text-gray-500">
                    Environment data not available for editing
                  </div>
                {/if}
                
                <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    on:click={() => {
                      editingMapping = null;
                      editSelectedSubEnvironment = null;
                      editVariableMappings = {};
                    }}
                    class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    on:click={handleUpdateMapping}
                    disabled={!fullEnvironment}
                    class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            {:else}
              <!-- View Mode -->
              <div class="flex items-center justify-between">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center space-x-3">
                    <div class="flex-shrink-0">
                      <svg class="h-8 w-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                      </svg>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-900 truncate">
                        {envMapping.environment?.name || `Environment ${envMapping.environmentId}`}
                      </p>
                      {#if envMapping.environment?.description}
                        <p class="text-sm text-gray-500 mt-1">{envMapping.environment.description}</p>
                      {/if}
                      <div class="mt-2">
                        <span class="text-xs text-gray-500">
                          {Object.keys(envMapping.variableMappings).length} variable mapping{Object.keys(envMapping.variableMappings).length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <p class="text-xs text-gray-400 mt-1">
                        Linked {formatDate(envMapping.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div class="flex items-center space-x-2">
                  <button
                    type="button"
                    on:click={() => handleEdit(envMapping)}
                    class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                    aria-label="Edit environment mapping for {envMapping.environment?.name || `Environment ${envMapping.environmentId}`}"
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                  </button>
                  
                  <button
                    type="button"
                    on:click={() => handleUnlink(envMapping)}
                    class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                    aria-label="Unlink environment {envMapping.environment?.name || `Environment ${envMapping.environmentId}`}"
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<!-- Link Environment Modal -->
{#if showLinkModal}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div class="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
      <h3 class="text-lg font-bold text-gray-900 mb-4">Link Environment</h3>
      
      <div class="space-y-6">
        <div>
          <label for="environment-select" class="block text-sm font-medium text-gray-700 mb-2">
            Select Environment *
          </label>
          <select
            id="environment-select"
            bind:value={selectedEnvironmentId}
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            disabled={environmentLoading}
          >
            <option value={null}>
              {#if environmentLoading}
                Loading environments...
              {:else if filteredEnvironments.length === 0}
                No available environments
              {:else}
                Choose an environment...
              {/if}
            </option>
            {#each filteredEnvironments as env}
              <option value={env.id}>{env.name}</option>
            {/each}
          </select>
          {#if filteredEnvironments.length === 0 && !environmentLoading}
            <p class="mt-1 text-xs text-gray-500">
              All available environments are already linked to this project.
            </p>
          {/if}
        </div>
        
        {#if selectedEnvironment}
          <!-- Sub-environment selector -->
          <div>
            <label for="sub-environment-select" class="block text-sm font-medium text-gray-700 mb-2">
              Select Sub-Environment *
            </label>
            <div class="flex flex-wrap gap-2">
              {#each getSubEnvironments(selectedEnvironment) as subEnv}
                <button
                  type="button"
                  on:click={() => selectedSubEnvironment = subEnv.key}
                  class="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium border transition-colors"
                  class:bg-blue-100={selectedSubEnvironment === subEnv.key}
                  class:text-blue-800={selectedSubEnvironment === subEnv.key}
                  class:border-blue-300={selectedSubEnvironment === subEnv.key}
                  class:bg-white={selectedSubEnvironment !== subEnv.key}
                  class:text-gray-700={selectedSubEnvironment !== subEnv.key}
                  class:border-gray-300={selectedSubEnvironment !== subEnv.key}
                  class:hover:bg-gray-50={selectedSubEnvironment !== subEnv.key}
                >
                  {subEnv.name}
                </button>
              {/each}
            </div>
            {#if getSubEnvironments(selectedEnvironment).length === 0}
              <p class="mt-1 text-xs text-yellow-600">
                This environment has no sub-environments configured.
              </p>
            {/if}
          </div>

          <div>
            <div class="mb-3">
              <span class="block text-sm font-medium text-gray-700">
                Variable Mappings
              </span>
              <p class="text-xs text-gray-500 mt-1">
                Map your project variables to environment variables. Leave environment variable empty to skip mapping.
                {#if selectedSubEnvironment}
                  Preview values are shown for <strong>{getSubEnvironments(selectedEnvironment).find(s => s.key === selectedSubEnvironment)?.name || selectedSubEnvironment}</strong>.
                {/if}
              </p>
            </div>
            
            {#if projectVariableNames.length === 0}
              <div class="text-center py-4 text-gray-500 text-sm border-2 border-dashed border-gray-300 rounded-md">
                No project variables found. Add variables to your project first.
              </div>
            {:else}
              <div class="space-y-3">
                <div class="grid grid-cols-7 gap-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <div class="col-span-2">Project Variable</div>
                  <div class="flex justify-center">→</div>
                  <div class="col-span-2">Environment Variable</div>
                  <div class="col-span-2">Preview Value</div>
                </div>
                
                {#each projectVariableNames as projectVar, index}
                  <div class="grid grid-cols-7 gap-3 items-center">
                    <div class="col-span-2">
                      <div class="flex items-center space-x-2">
                        <span class="inline-flex items-center rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                          {projectVar}
                        </span>
                      </div>
                    </div>
                    <div class="flex justify-center">
                      <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                      </svg>
                    </div>
                    <div class="col-span-2">
                      <label for="env-var-{index}" class="sr-only">Environment Variable for {projectVar}</label>
                      <select
                        id="env-var-{index}"
                        bind:value={variableMappings[projectVar]}
                        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      >
                        <option value="">Optional - select environment variable...</option>
                        {#each getEnvironmentVariables(selectedEnvironment) as varName}
                          <option value={varName}>{varName}</option>
                        {/each}
                      </select>
                    </div>
                    <div class="col-span-2">
                      {#if variableMappings[projectVar] && selectedSubEnvironment}
                        {@const previewValue = getEnvironmentVariablePreview(selectedEnvironment, variableMappings[projectVar], selectedSubEnvironment)}
                        <div class="flex items-center space-x-2">
                          <span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium {previewValue === 'Not configured' || previewValue === 'No sub-environment selected' || previewValue === 'No default value' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'} max-w-full">
                            <span class="truncate" title={previewValue}>
                              {previewValue.length > 30 ? previewValue.substring(0, 30) + '...' : previewValue}
                            </span>
                          </span>
                        </div>
                      {:else}
                        <span class="text-xs text-gray-400">No mapping selected</span>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}

            <!-- API Hosts per Sub-environment -->
            {#if selectedEnvironment && selectedSubEnvironment}
              {@const currentSubEnv = selectedEnvironment.config.environments[selectedSubEnvironment]}
              {#if currentSubEnv?.api_hosts && Object.keys(currentSubEnv.api_hosts).length > 0}
                <div class="mt-4 p-3 bg-gray-50 rounded-md">
                  <h6 class="text-xs font-medium text-gray-700 mb-2">
                    API Hosts ({getSubEnvironments(selectedEnvironment).find(s => s.key === selectedSubEnvironment)?.name || selectedSubEnvironment})
                  </h6>
                  <div class="text-xs text-gray-600 space-y-1">
                    {#each Object.entries(currentSubEnv.api_hosts) as [apiId, host]}
                      <div class="flex justify-between">
                        <span class="font-medium">{apiId}:</span>
                        <span class="text-blue-600 font-mono">{host}</span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            {/if}
          </div>
        {/if}
      </div>
      
      <div class="flex justify-end space-x-3 mt-6">
        <button
          type="button"
          on:click={() => {
            showLinkModal = false;
            resetLinkForm();
          }}
          class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          on:click={handleLink}
          disabled={!selectedEnvironmentId || !selectedSubEnvironment}
          class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Link Environment
        </button>
      </div>
    </div>
  </div>
{/if}
