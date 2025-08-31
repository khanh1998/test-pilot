<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Environment } from '$lib/types/environment';
  import type { FlowParameter } from '../test-flows/types';

  export let environment: Environment;
  export let flowParameters: FlowParameter[] = [];
  export let parameterMappings: Record<string, string> = {};
  export let disabled: boolean = false;

  const dispatch = createEventDispatcher<{
    change: { environmentId: number; parameterMappings: Record<string, string> };
  }>();

  // Get available environment variables from the environment config
  $: environmentVariables = getEnvironmentVariables(environment);

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

  // Handle parameter mapping change
  function handleMappingChange(parameterName: string, variableName: string) {
    const updatedMappings = { ...parameterMappings };
    
    if (variableName === '') {
      // Remove mapping if empty
      delete updatedMappings[parameterName];
    } else {
      updatedMappings[parameterName] = variableName;
    }
    
    dispatch('change', { 
      environmentId: environment.id, 
      parameterMappings: updatedMappings 
    });
  }

  // Get the sub-environments for display
  $: subEnvironments = Object.keys(environment.config.environments || {});
</script>

<div class="space-y-4">
<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
  <!-- Parameter Mapping Section -->
  <div>
    <h5 class="text-sm font-medium text-gray-900 mb-3">Parameter Mapping</h5>
    
    {#if flowParameters.length === 0}
      <div class="text-center py-4">
        <p class="text-sm text-gray-500">No flow parameters defined yet.</p>
        <p class="text-xs text-gray-400">Add parameters to your flow to enable environment mapping.</p>
      </div>
    {:else if environmentVariables.length === 0}
      <div class="text-center py-4">
        <p class="text-sm text-gray-500">No environment variables available.</p>
        <p class="text-xs text-gray-400">Configure variables in the environment to enable mapping.</p>
      </div>
    {:else}
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-6 text-xs font-medium text-gray-500 uppercase tracking-wide">
          <div>Flow Parameter</div>
          <div>Environment Variable</div>
        </div>
        
        {#each flowParameters as parameter}
          <div class="grid grid-cols-2 gap-6 items-start">
            <div>
              <div class="flex items-center space-x-2">
                <span class="inline-flex items-center rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">
                  {parameter.name}
                </span>
                {#if parameter.required}
                  <span class="text-red-500 text-xs">*</span>
                {/if}
              </div>
              {#if parameter.description}
                <p class="text-xs text-gray-500 mt-1">{parameter.description}</p>
              {/if}
            </div>
            
            <div>
              <select
                class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                value={parameterMappings[parameter.name] || ''}
                on:change={(e) => handleMappingChange(parameter.name, e.currentTarget.value)}
                {disabled}
              >
                <option value="">Select environment variable...</option>
                {#each environmentVariables as variable}
                  <option value={variable}>{variable}</option>
                {/each}
              </select>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Environment Details Section -->
  <div>
    <h5 class="text-sm font-medium text-gray-900 mb-3">Environment Details</h5>
    
    <div class="space-y-4 text-sm">
      <div>
        <span class="font-medium text-gray-700">Sub-environments & API hosts:</span>
        {#if subEnvironments.length > 0}
          <div class="mt-2 space-y-3">
            {#each subEnvironments as subEnv}
              {@const subEnvConfig = environment.config.environments[subEnv]}
              <div class="border border-gray-200 rounded-md p-3 bg-gray-50">
                <div class="flex items-center justify-between mb-2">
                  <span class="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                    {subEnv}
                  </span>
                  <span class="text-xs text-gray-600">{subEnvConfig?.name || subEnv}</span>
                </div>
                
                {#if subEnvConfig?.api_hosts && Object.keys(subEnvConfig.api_hosts).length > 0}
                  <div class="space-y-1">
                    <span class="text-xs font-medium text-gray-600">API hosts:</span>
                    <div class="space-y-1">
                      {#each Object.entries(subEnvConfig.api_hosts) as [apiId, hostUrl]}
                        <div class="flex items-center justify-between text-xs">
                          <span class="font-mono text-purple-700">api_host_{apiId}</span>
                          <span class="text-gray-600 truncate ml-2">{hostUrl}</span>
                        </div>
                      {/each}
                    </div>
                  </div>
                {:else}
                  <div class="text-xs text-gray-500">No API hosts configured</div>
                {/if}
              </div>
            {/each}
          </div>
        {:else}
          <span class="text-gray-500">None configured</span>
        {/if}
      </div>
    </div>
  </div>
</div>
</div>
