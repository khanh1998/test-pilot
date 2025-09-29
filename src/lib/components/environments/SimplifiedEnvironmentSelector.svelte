<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Environment } from '$lib/types/environment';

  export let id: string = 'simplified-environment-selector';
  export let environment: Environment | null = null;
  export let selectedSubEnvironment: string | null = null;
  export let placeholder: string = 'Select sub-environment...';
  export let disabled: boolean = false;

  const dispatch = createEventDispatcher<{
    select: { environmentId: number | null; subEnvironment: string | null };
  }>();

  // Use the provided environment directly
  $: projectEnvironment = environment;

  // Generate sub-environment options for the single project environment
  $: subEnvironmentOptions = generateSubEnvironmentOptions(projectEnvironment);

  function generateSubEnvironmentOptions(
    environment: Environment | null
  ): Array<{ value: string; label: string; subEnvironment: string }> {
    if (!environment) return [];
    
    const options: Array<{ value: string; label: string; subEnvironment: string }> = [];
    
    // Add options for each sub-environment
    const subEnvs = Object.keys(environment.config.environments || {});
    subEnvs.forEach(subEnv => {
      const subEnvConfig = environment.config.environments[subEnv];
      const label = subEnvConfig.name || subEnv;
      
      options.push({
        value: subEnv,
        label,
        subEnvironment: subEnv
      });
    });
    
    return options;
  }

  // Handle selection change
  function handleSelectionChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const subEnv = target.value;
    
    if (!subEnv || !projectEnvironment) {
      dispatch('select', { environmentId: null, subEnvironment: null });
      return;
    }
    
    dispatch('select', { environmentId: projectEnvironment.id, subEnvironment: subEnv });
  }

  // Check if there's a project environment available
  $: hasProjectEnvironment = projectEnvironment !== null;
  $: environmentName = projectEnvironment?.name || 'Project Environment';
</script>

<div class="w-full">
  {#if !hasProjectEnvironment}
    <div class="block w-full rounded-md border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
      No project environment configured
    </div>
    <p class="mt-1 text-xs text-gray-500">
      Configure an environment for this project in project settings to enable execution.
    </p>
  {:else}
    <div class="space-y-2">
      <!-- Sub-environment selector -->
      {#if subEnvironmentOptions.length > 0}
        <select
          {id}
          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm {disabled ? 'bg-gray-50 cursor-not-allowed' : ''}"
          value={selectedSubEnvironment || ''}
          on:change={handleSelectionChange}
          {disabled}
        >
          <option value="">{placeholder}</option>
          
          {#each subEnvironmentOptions as option}
            <option value={option.value}>
              {option.label}
            </option>
          {/each}
        </select>
      {:else}
        <div class="block w-full rounded-md border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
          No sub-environments configured
        </div>
        <p class="mt-1 text-xs text-yellow-600">
          Add sub-environments to the project environment configuration to enable execution.
        </p>
      {/if}
    </div>
  {/if}
</div>
