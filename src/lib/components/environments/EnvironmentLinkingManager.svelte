<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import EnvironmentParameterMapper from './EnvironmentParameterMapper.svelte';
  import type { Environment } from '$lib/types/environment';
  import type { EnvironmentMapping, FlowParameter } from '../test-flows/types';

  export let environments: Environment[] = [];
  export let linkedEnvironments: EnvironmentMapping[] = [];
  export let flowParameters: FlowParameter[] = [];
  export let disabled: boolean = false;

  const dispatch = createEventDispatcher<{
    change: { linkedEnvironments: EnvironmentMapping[] };
  }>();

  let selectedEnvironmentId: number | null = null;
  let showAddForm = false;

  // Add new environment link
  function handleAddEnvironment() {
    if (!selectedEnvironmentId) return;

    const selectedEnv = environments.find(env => env.id === selectedEnvironmentId);
    if (!selectedEnv) return;

    // Check if environment is already linked
    const isAlreadyLinked = linkedEnvironments.some(link => link.environmentId === selectedEnvironmentId);
    if (isAlreadyLinked) {
      alert('This environment is already linked to the flow.');
      return;
    }

    // Get the first sub-environment as default
    const subEnvironments = Object.keys(selectedEnv.config.environments || {});
    const defaultSubEnv = subEnvironments.length > 0 ? subEnvironments[0] : undefined;

    const newMapping: EnvironmentMapping = {
      environmentId: selectedEnvironmentId,
      environmentName: selectedEnv.name,
      selectedSubEnvironment: defaultSubEnv,
      parameterMappings: {}
    };

    linkedEnvironments = [...linkedEnvironments, newMapping];
    selectedEnvironmentId = null;
    showAddForm = false;
    
    dispatch('change', { linkedEnvironments });
  }

  // Remove environment link
  function handleRemoveEnvironment(environmentId: number) {
    linkedEnvironments = linkedEnvironments.filter(link => link.environmentId !== environmentId);
    dispatch('change', { linkedEnvironments });
  }

  // Handle parameter mapping changes
  function handleParameterMappingChange(event: CustomEvent<{ environmentId: number; parameterMappings: Record<string, string> }>) {
    const { environmentId, parameterMappings } = event.detail;
    
    linkedEnvironments = linkedEnvironments.map(link => 
      link.environmentId === environmentId 
        ? { ...link, parameterMappings }
        : link
    );
    
    dispatch('change', { linkedEnvironments });
  }

  // Handle sub-environment selection change
  function handleSubEnvironmentChange(environmentId: number, selectedSubEnvironment: string) {
    linkedEnvironments = linkedEnvironments.map(link => 
      link.environmentId === environmentId 
        ? { ...link, selectedSubEnvironment }
        : link
    );
    
    dispatch('change', { linkedEnvironments });
  }

  // Get available environments (not already linked)
  $: availableEnvironments = environments.filter(env => 
    !linkedEnvironments.some(link => link.environmentId === env.id)
  );
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h3 class="text-lg font-medium text-gray-900">Environment Links</h3>
      <p class="mt-1 text-sm text-gray-500">
        Link environments to this flow and map flow parameters to environment variables
      </p>
    </div>
    
    {#if !showAddForm && availableEnvironments.length > 0}
      <button
        class="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        on:click={() => showAddForm = true}
        {disabled}
      >
        <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
        </svg>
        Link Environment
      </button>
    {/if}
  </div>

  <!-- Add Environment Form -->
  {#if showAddForm}
    <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h4 class="text-sm font-medium text-gray-900 mb-3">Add Environment Link</h4>
      
      <div class="flex items-center space-x-4">
        <div class="flex-1">
          <select
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            bind:value={selectedEnvironmentId}
            {disabled}
          >
            <option value={null}>Select environment...</option>
            {#each availableEnvironments as env}
              <option value={env.id}>{env.name}</option>
            {/each}
          </select>
        </div>
        
        <div class="flex space-x-2">
          <button
            class="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            on:click={handleAddEnvironment}
            disabled={disabled || !selectedEnvironmentId}
          >
            Add
          </button>
          
          <button
            class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            on:click={() => {
              showAddForm = false;
              selectedEnvironmentId = null;
            }}
            {disabled}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Linked Environments List -->
  {#if linkedEnvironments.length > 0}
    <div class="space-y-4">
      {#each linkedEnvironments as link, index}
        {@const environment = environments.find(env => env.id === link.environmentId)}
        {#if environment}
          {@const subEnvironments = Object.keys(environment.config.environments || {})}
          {@const selectedSubEnv = link.selectedSubEnvironment || (subEnvironments.length > 0 ? subEnvironments[0] : undefined)}
          <!-- Initialize selectedSubEnvironment if not set -->
          {#if subEnvironments.length > 0 && !link.selectedSubEnvironment}
            {(link.selectedSubEnvironment = subEnvironments[0], '')}
          {/if}
          <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h4 class="text-lg font-medium text-gray-900">{environment.name}</h4>
                {#if environment.description}
                  <p class="text-sm text-gray-500">{environment.description}</p>
                {/if}
              </div>
              
              <div class="flex space-x-2">
                <a
                  href="/dashboard/environments/{environment.id}"
                  class="inline-flex items-center rounded-md border border-blue-300 bg-white px-3 py-2 text-sm font-medium text-blue-700 shadow-sm hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <svg class="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                  </svg>
                  View Details
                </a>
                
                <button
                  class="inline-flex items-center rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  on:click={() => handleRemoveEnvironment(link.environmentId)}
                  {disabled}
                >
                  <svg class="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                  </svg>
                  Remove
                </button>
              </div>
            </div>

            <!-- Sub-Environment Selection -->
            {#if subEnvironments.length > 0}
              <div class="mb-4 flex items-center gap-3">
                <span class="text-sm font-medium text-gray-700">Sub-Environment:</span>
                <div class="flex gap-1">
                  {#each subEnvironments as subEnv}
                    <button
                      class="px-2 py-1 text-xs font-medium rounded transition-colors {selectedSubEnv === subEnv 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
                      on:click={() => handleSubEnvironmentChange(link.environmentId, subEnv)}
                      {disabled}
                    >
                      {environment.config.environments[subEnv]?.name || subEnv}
                    </button>
                  {/each}
                </div>
              </div>
            {:else}
              <div class="mb-4 flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 px-3 py-2 rounded">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
                No sub-environments configured
              </div>
            {/if}

            <!-- Parameter Mapping Component -->
            <EnvironmentParameterMapper
              {environment}
              {flowParameters}
              parameterMappings={link.parameterMappings}
              selectedSubEnvironment={selectedSubEnv}
              {disabled}
              on:change={handleParameterMappingChange}
            />
          </div>
        {/if}
      {/each}
    </div>
  {:else}
    <div class="text-center py-8">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">No Environment Links</h3>
      <p class="mt-1 text-sm text-gray-500">
        Link environments to enable parameter mapping for execution.
      </p>
      {#if availableEnvironments.length > 0}
        <div class="mt-4">
          <button
            class="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            on:click={() => showAddForm = true}
            {disabled}
          >
            <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>
            Link First Environment
          </button>
        </div>
      {:else}
        <p class="mt-2 text-xs text-gray-400">
          Create environments first to link them to this flow.
        </p>
      {/if}
    </div>
  {/if}
</div>
