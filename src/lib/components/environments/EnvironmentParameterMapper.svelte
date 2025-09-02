<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Environment } from '$lib/types/environment';
  import type { FlowParameter } from '../test-flows/types';

  export let environment: Environment;
  export let flowParameters: FlowParameter[] = [];
  export let parameterMappings: Record<string, string> = {};
  export let selectedSubEnvironment: string | undefined = undefined;
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

  // Get the current value of an environment variable for the selected sub-environment
  // Make this reactive to selectedSubEnvironment changes
  $: getEnvironmentVariableValue = (variableName: string): string => {
    if (!selectedSubEnvironment || !environment.config.environments[selectedSubEnvironment]) {
      return 'No sub-environment selected';
    }

    const subEnv = environment.config.environments[selectedSubEnvironment];
    
    // Check if it's an API host variable
    if (variableName.startsWith('api_host_')) {
      const apiId = variableName.replace('api_host_', '');
      return subEnv.api_hosts?.[apiId] || 'Not configured';
    }
    
    // Check sub-environment variables
    if (subEnv.variables && variableName in subEnv.variables) {
      const value = subEnv.variables[variableName];
      return typeof value === 'string' ? value : JSON.stringify(value);
    }
    
    // Check default value from variable definitions
    if (environment.config.variable_definitions?.[variableName]) {
      const defaultValue = environment.config.variable_definitions[variableName].default_value;
      return defaultValue ? (typeof defaultValue === 'string' ? defaultValue : JSON.stringify(defaultValue)) : 'No default value';
    }
    
    return 'Not configured';
  };

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
        <div class="grid grid-cols-3 gap-6 text-xs font-medium text-gray-500 uppercase tracking-wide">
          <div>Flow Parameter</div>
          <div>Environment Variable</div>
          <div>Current Value</div>
        </div>
        
        {#each flowParameters as parameter}
          <div class="grid grid-cols-3 gap-6 items-start">
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
            
            <div>
              {#if parameterMappings[parameter.name]}
                {@const mappedVariable = parameterMappings[parameter.name]}
                {@const currentValue = getEnvironmentVariableValue(mappedVariable)}
                <div class="flex items-center space-x-2">
                  <span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium {currentValue === 'Not configured' || currentValue === 'No sub-environment selected' || currentValue === 'No default value' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}">
                    {currentValue}
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
  </div>

  <!-- Environment Details Section -->
  <div>
    <h5 class="text-sm font-medium text-gray-900 mb-3">API Hosts</h5>
    
    <div class="space-y-4 text-sm">
      {#if selectedSubEnvironment && environment.config.environments[selectedSubEnvironment]}
        {@const subEnvConfig = environment.config.environments[selectedSubEnvironment]}
        <div>
          <div class="flex items-center gap-2">
            <span class="font-medium text-gray-700">Active Environment:</span>
            <div class="group relative">
              <svg class="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                API hosts in this environment will override the default API hosts of the flow
                <div class="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>
          </div>
          <div class="mt-2">
            <div class="border border-gray-200 rounded-md p-3 bg-gray-50">
              <div class="flex items-center justify-between mb-2">
                <span class="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                  {selectedSubEnvironment}
                </span>
                <span class="text-xs text-gray-600">{subEnvConfig?.name || selectedSubEnvironment}</span>
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
          </div>
        </div>
      {:else}
        <div class="text-center py-4">
          <span class="text-gray-500">No sub-environment selected</span>
        </div>
      {/if}
    </div>
  </div>
</div>
</div>
