<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Environment } from '$lib/types/environment';
  import type { EnvironmentMapping } from '../test-flows/types';

  export let id: string = 'simplified-environment-selector';
  export let environments: Environment[] = [];
  export let linkedEnvironments: EnvironmentMapping[] = [];
  export let selectedEnvironmentId: number | null = null;
  export let selectedSubEnvironment: string | null = null;
  export let placeholder: string = 'Select environment...';
  export let disabled: boolean = false;

  const dispatch = createEventDispatcher<{
    select: { environmentId: number | null; subEnvironment: string | null };
  }>();

  // Generate options for the dropdown
  $: environmentOptions = generateEnvironmentOptions(environments, linkedEnvironments);

  function generateEnvironmentOptions(
    envs: Environment[], 
    linked: EnvironmentMapping[]
  ): Array<{ value: string; label: string; environmentId: number; subEnvironment: string }> {
    const options: Array<{ value: string; label: string; environmentId: number; subEnvironment: string }> = [];
    
    // Only show linked environments
    linked.forEach(link => {
      const environment = envs.find(env => env.id === link.environmentId);
      if (!environment) return;
      
      // Add options for each sub-environment
      const subEnvs = Object.keys(environment.config.environments || {});
      subEnvs.forEach(subEnv => {
        const subEnvConfig = environment.config.environments[subEnv];
        const label = `${environment.name} (${subEnvConfig.name || subEnv})`;
        const value = `${environment.id}:${subEnv}`;
        
        options.push({
          value,
          label,
          environmentId: environment.id,
          subEnvironment: subEnv
        });
      });
    });
    
    return options;
  }

  // Get the current selection value
  $: currentValue = selectedEnvironmentId && selectedSubEnvironment 
    ? `${selectedEnvironmentId}:${selectedSubEnvironment}` 
    : '';

  // Handle selection change
  function handleSelectionChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const value = target.value;
    
    if (!value) {
      dispatch('select', { environmentId: null, subEnvironment: null });
      return;
    }
    
    const [envIdStr, subEnv] = value.split(':');
    const envId = parseInt(envIdStr, 10);
    
    dispatch('select', { environmentId: envId, subEnvironment: subEnv });
  }

  // Check if there are any linked environments
  $: hasLinkedEnvironments = linkedEnvironments.length > 0;
</script>

<div class="w-full">
  <select
    {id}
    class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm {disabled ? 'bg-gray-50 cursor-not-allowed' : ''}"
    value={currentValue}
    on:change={handleSelectionChange}
    {disabled}
  >
    <option value="">
      {#if !hasLinkedEnvironments}
        No linked environments
      {:else}
        {placeholder}
      {/if}
    </option>
    
    {#each environmentOptions as option}
      <option value={option.value}>
        {option.label}
      </option>
    {/each}
  </select>
  
  {#if !hasLinkedEnvironments}
    <p class="mt-1 text-xs text-gray-500">
      Link environments in the Flow Settings to enable execution with environment variables.
    </p>
  {:else if environmentOptions.length === 0}
    <p class="mt-1 text-xs text-yellow-600">
      Linked environments have no sub-environments configured.
    </p>
  {/if}
</div>
