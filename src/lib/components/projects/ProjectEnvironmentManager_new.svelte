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
  let variableMappings: Record<string, string> = {};
  let environmentLoading = false;

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
    } finally {
      environmentLoading = false;
    }
  }

  async function loadLinkedEnvironments() {
    try {
      const response = await projectClient.getProjectEnvironments(projectId);
      linkedEnvironments = response.environments;
    } catch (error) {
      console.error('Failed to load linked environments:', error);
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

  // Get project variable names
  $: projectVariableNames = projectVariables.map(v => v.name).sort();

  // Filter out already linked environments
  $: filteredEnvironments = availableEnvironments.filter(env => 
    !linkedEnvironments.some(link => link.environmentId === env.id)
  );

  // Update selected environment when selection changes
  $: if (selectedEnvironmentId) {
    selectedEnvironment = availableEnvironments.find(env => env.id === selectedEnvironmentId) || null;
  } else {
    selectedEnvironment = null;
  }

  function handleLink() {
    if (!selectedEnvironmentId || Object.keys(variableMappings).length === 0) return;
    
    dispatch('link', { 
      environmentId: selectedEnvironmentId, 
      variableMappings 
    });
    
    resetLinkForm();
    showLinkModal = false;
  }

  function handleEdit(envMapping: ProjectEnvironment) {
    editingMapping = { ...envMapping };
  }

  function handleUpdateMapping() {
    if (!editingMapping) return;
    
    dispatch('updateMapping', { 
      id: editingMapping.id, 
      variableMappings: editingMapping.variableMappings 
    });
    editingMapping = null;
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
    variableMappings = {};
  }

  function addVariableMapping() {
    // Add empty mapping - user will fill in both sides
    const newKey = `mapping_${Date.now()}`;
    variableMappings[newKey] = '';
    variableMappings = { ...variableMappings };
  }

  function removeVariableMapping(key: string) {
    delete variableMappings[key];
    variableMappings = { ...variableMappings };
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
              <!-- Edit Mode -->
              <div class="space-y-4">
                <div class="flex items-center justify-between">
                  <h4 class="text-lg font-medium text-gray-900">
                    {envMapping.environment?.name || `Environment ${envMapping.environmentId}`}
                  </h4>
                  <span class="text-sm text-gray-500">Variable Mappings</span>
                </div>
                
                <div class="space-y-3">
                  {#each Object.entries(editingMapping.variableMappings) as [projectVar, envVar], index}
                    <div class="grid grid-cols-5 gap-3 items-center">
                      <div class="col-span-2">
                        <label for="project-var-{index}" class="sr-only">Project Variable</label>
                        <input
                          id="project-var-{index}"
                          type="text"
                          bind:value={projectVar}
                          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          placeholder="Project variable"
                        />
                      </div>
                      <div class="flex justify-center">
                        <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                        </svg>
                      </div>
                      <div class="col-span-2">
                        <label for="env-var-{index}" class="sr-only">Environment Variable</label>
                        <input
                          id="env-var-{index}"
                          type="text"
                          bind:value={envVar}
                          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          placeholder="Environment variable"
                        />
                      </div>
                    </div>
                  {/each}
                </div>
                
                <div class="flex justify-end space-x-3">
                  <button
                    type="button"
                    on:click={() => (editingMapping = null)}
                    class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    on:click={handleUpdateMapping}
                    class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
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
          <div>
            <div class="flex items-center justify-between mb-3">
              <span class="block text-sm font-medium text-gray-700">
                Variable Mappings
              </span>
              <button
                type="button"
                on:click={addVariableMapping}
                class="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
                Add Mapping
              </button>
            </div>
            
            <div class="space-y-3">
              <div class="grid grid-cols-6 gap-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <div class="col-span-2">Project Variable</div>
                <div class="flex justify-center">→</div>
                <div class="col-span-2">Environment Variable</div>
                <div></div>
              </div>
              
              {#each Object.entries(variableMappings) as [projectVar, envVar], index}
                <div class="grid grid-cols-6 gap-3 items-center">
                  <div class="col-span-2">
                    <label for="project-var-{index}" class="sr-only">Project Variable</label>
                    <select
                      id="project-var-{index}"
                      value={projectVar}
                      on:change={(e) => updateMappingKey(projectVar, e.currentTarget.value)}
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    >
                      <option value="">Select project variable...</option>
                      {#each projectVariableNames as varName}
                        <option value={varName}>{varName}</option>
                      {/each}
                    </select>
                  </div>
                  <div class="flex justify-center">
                    <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                    </svg>
                  </div>
                  <div class="col-span-2">
                    <label for="env-var-{index}" class="sr-only">Environment Variable</label>
                    <select
                      id="env-var-{index}"
                      bind:value={envVar}
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    >
                      <option value="">Select environment variable...</option>
                      {#each getEnvironmentVariables(selectedEnvironment) as varName}
                        <option value={varName}>{varName}</option>
                      {/each}
                    </select>
                  </div>
                  <div class="flex justify-center">
                    <button
                      type="button"
                      on:click={() => removeVariableMapping(projectVar)}
                      class="p-1 text-gray-400 hover:text-red-600"
                      aria-label="Remove variable mapping"
                    >
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                </div>
              {/each}
              
              {#if Object.keys(variableMappings).length === 0}
                <div class="text-center py-4 text-gray-500 text-sm border-2 border-dashed border-gray-300 rounded-md">
                  No variable mappings yet. Click "Add Mapping" to create one.
                </div>
              {/if}
            </div>

            <!-- Environment Info -->
            {#if selectedEnvironment}
              <div class="mt-4 p-3 bg-gray-50 rounded-md">
                <h6 class="text-xs font-medium text-gray-700 mb-2">Environment Details</h6>
                <div class="text-xs text-gray-600 space-y-1">
                  <div><strong>Available Variables:</strong> {getEnvironmentVariables(selectedEnvironment).length}</div>
                  {#if selectedEnvironment.config.linked_apis?.length}
                    <div><strong>Linked APIs:</strong> {selectedEnvironment.config.linked_apis.length}</div>
                  {/if}
                  <div><strong>Sub-environments:</strong> {Object.keys(selectedEnvironment.config.environments).join(', ')}</div>
                </div>
              </div>
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
          disabled={!selectedEnvironmentId || Object.keys(variableMappings).length === 0}
          class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Link Environment
        </button>
      </div>
    </div>
  </div>
{/if}
