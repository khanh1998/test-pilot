<script lang="ts">
  
  import type { Environment } from '$lib/types/environment';

  interface Props {
    [key: string]: unknown;
    id?: string;
    environment?: Environment | null;
    selectedSubEnvironment?: string | null;
    placeholder?: string;
    disabled?: boolean;
  }

  let {
    id = 'simplified-environment-selector',
    environment = null,
    selectedSubEnvironment = null,
    placeholder = 'Select sub-environment...',
    disabled = false
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

  // Use the provided environment directly
  let projectEnvironment = $derived(environment);
  // Generate sub-environment options for the single project environment
  let subEnvironmentOptions = $derived(generateSubEnvironmentOptions(projectEnvironment));
  // Check if there's a project environment available
  let hasProjectEnvironment = $derived(projectEnvironment !== null);
  let environmentName = $derived(projectEnvironment?.name || 'Project Environment');
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
        <div class="relative">
          <!-- Sub-environment indicator -->
          <div class="absolute left-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none flex items-center gap-1">
            <svg class="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span class="text-xs text-gray-400 font-medium">env</span>
          </div>
          <select
            {id}
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm pl-14 {disabled ? 'bg-gray-50 cursor-not-allowed' : ''}"
            value={selectedSubEnvironment || ''}
            onchange={handleSelectionChange}
            {disabled}
          >
            <option value="">{placeholder}</option>
            
            {#each subEnvironmentOptions as option}
              <option value={option.value}>
                {option.label}
              </option>
            {/each}
          </select>
        </div>
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
