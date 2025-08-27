<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Environment } from '$lib/types/environment';
  
  export let environments: Environment[] = [];
  export let selectedEnvironmentId: number | null = null;
  export let selectedSubEnvironment: string | null = null;
  export let placeholder: string = 'Select environment...';
  export let disabled: boolean = false;
  export let id: string = 'environment-selector';

  const dispatch = createEventDispatcher<{
    select: { environmentId: number | null; subEnvironment: string | null };
  }>();

  let isOpen = false;
  let selectedEnvironment: Environment | null = null;

  $: {
    if (selectedEnvironmentId) {
      selectedEnvironment = environments.find(env => env.id === selectedEnvironmentId) || null;
    } else {
      selectedEnvironment = null;
    }
  }

  $: availableSubEnvironments = selectedEnvironment 
    ? Object.keys(selectedEnvironment.config.environments)
    : [];

  function toggleDropdown() {
    if (!disabled) {
      isOpen = !isOpen;
    }
  }

  function selectEnvironment(environmentId: number | null) {
    selectedEnvironmentId = environmentId;
    selectedSubEnvironment = null;
    
    if (environmentId) {
      const env = environments.find(e => e.id === environmentId);
      if (env) {
        const subEnvs = Object.keys(env.config.environments);
        if (subEnvs.length > 0) {
          selectedSubEnvironment = subEnvs[0]; // Auto-select first sub-environment
        }
      }
    }

    dispatch('select', { 
      environmentId: selectedEnvironmentId, 
      subEnvironment: selectedSubEnvironment 
    });
    
    isOpen = false;
  }

  function selectSubEnvironment(subEnvName: string) {
    selectedSubEnvironment = subEnvName;
    dispatch('select', { 
      environmentId: selectedEnvironmentId, 
      subEnvironment: selectedSubEnvironment 
    });
  }

  function clearSelection() {
    selectEnvironment(null);
  }

  // Close dropdown when clicking outside
  function handleClickOutside(event: MouseEvent) {
    if (!event.target || !(event.target as Element).closest('.environment-selector')) {
      isOpen = false;
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="w-full {disabled ? 'opacity-60 pointer-events-none' : ''}" class:disabled>
  <div class="flex gap-4 items-end flex-wrap">
    <!-- Environment Selection -->
    <div class="flex-1 min-w-[200px] relative">
      <span class="block text-sm font-medium text-gray-700 mb-2">Environment</span>
      <button 
        {id}
        class="w-full flex justify-between items-center px-3 py-2 border border-gray-300 rounded-md bg-white cursor-pointer transition-all text-sm hover:border-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed {isOpen ? 'border-blue-500 ring-1 ring-blue-500' : ''}" 
        onclick={toggleDropdown}
        {disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span class="text-left {selectedEnvironment ? 'text-gray-900' : 'text-gray-500'}">
          {selectedEnvironment ? selectedEnvironment.name : placeholder}
        </span>
        <svg class="w-5 h-5 text-gray-400 transition-transform {isOpen ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6,9 12,15 18,9"></polyline>
        </svg>
      </button>

      {#if isOpen}
        <div class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto" role="listbox">
          <button 
            class="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 focus:outline-none focus:bg-gray-50 {selectedEnvironmentId === null ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}" 
            onclick={() => selectEnvironment(null)}
            role="option"
            aria-selected={selectedEnvironmentId === null}
          >
            <span>No environment (use defaults)</span>
          </button>
          {#each environments as environment}
            <button 
              class="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 focus:outline-none focus:bg-gray-50 {selectedEnvironmentId === environment.id ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}" 
              onclick={() => selectEnvironment(environment.id)}
              role="option"
              aria-selected={selectedEnvironmentId === environment.id}
            >
              <div>
                <span class="block font-medium">{environment.name}</span>
                <span class="block text-xs text-gray-500">
                  {Object.keys(environment.config.environments).length} sub-environments
                </span>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Sub-Environment Selection -->
    {#if selectedEnvironment && availableSubEnvironments.length > 0}
      <div class="flex-1 min-w-[200px]">
        <span class="block text-sm font-medium text-gray-700 mb-2">Sub-Environment</span>
        <div class="flex flex-wrap gap-2" role="tablist">
          {#each availableSubEnvironments as subEnvName}
            <button 
              class="px-3 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed {selectedSubEnvironment === subEnvName ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}" 
              onclick={() => selectSubEnvironment(subEnvName)}
              {disabled}
              role="tab"
              aria-selected={selectedSubEnvironment === subEnvName}
            >
              {subEnvName}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Clear Selection Button -->
    {#if selectedEnvironmentId}
      <button class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed" onclick={clearSelection} {disabled}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
        Clear
      </button>
    {/if}
  </div>

  <!-- Selection Summary -->
  {#if selectedEnvironment && selectedSubEnvironment}
    <div class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium text-blue-900">Selected:</span>
        <span class="text-sm text-blue-800">{selectedEnvironment.name} → {selectedSubEnvironment}</span>
      </div>
      {#if selectedEnvironment.config.variable_definitions}
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-blue-900">Variables:</span>
          <span class="text-sm text-blue-800">
            {Object.keys(selectedEnvironment.config.variable_definitions).join(', ')}
          </span>
        </div>
      {/if}
    </div>
  {/if}
</div>


