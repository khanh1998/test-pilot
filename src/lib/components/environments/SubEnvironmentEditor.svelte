<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import type { SubEnvironment, VariableDefinition } from '$lib/types/environment';

  export let subEnvironments: Record<string, SubEnvironment> = {};
  export let variableDefinitions: Record<string, VariableDefinition> = {};
  export let disabled: boolean = false;

  const dispatch = createEventDispatcher<{
    change: { subEnvironments: Record<string, SubEnvironment> };
  }>();

  let newSubEnvName = '';
  let showAddForm = false;

  // Confirm dialog state
  let showConfirmDialog = false;
  let pendingDeleteSubEnv: string | null = null;

  const commonSubEnvNames = ['dev', 'sit', 'uat', 'staging', 'prod'];

  function addSubEnvironment() {
    if (!newSubEnvName.trim()) return;
    
    const name = newSubEnvName.trim().toLowerCase();
    if (name in subEnvironments) {
      alert('Sub-environment with this name already exists');
      return;
    }

    subEnvironments = {
      ...subEnvironments,
      [name]: {
        name: newSubEnvName.trim(),
        description: '',
        variables: {},
        api_hosts: {}
      }
    };

    newSubEnvName = '';
    showAddForm = false;
    
    dispatch('change', { subEnvironments });
  }

  function removeSubEnvironment(name: string) {
    pendingDeleteSubEnv = name;
    showConfirmDialog = true;
  }

  function confirmDeleteSubEnv() {
    if (!pendingDeleteSubEnv) return;
    
    const { [pendingDeleteSubEnv]: removed, ...rest } = subEnvironments;
    subEnvironments = rest;
    dispatch('change', { subEnvironments });
    
    pendingDeleteSubEnv = null;
    showConfirmDialog = false;
  }

  function cancelDeleteSubEnv() {
    pendingDeleteSubEnv = null;
    showConfirmDialog = false;
  }

  function updateSubEnvironments() {
    dispatch('change', { subEnvironments });
  }

  function toggleAddForm() {
    showAddForm = !showAddForm;
    if (!showAddForm) {
      newSubEnvName = '';
    }
  }

  function addCommonSubEnv(name: string) {
    if (name in subEnvironments) return;
    
    const displayName = name.charAt(0).toUpperCase() + name.slice(1);
    subEnvironments = {
      ...subEnvironments,
      [name]: {
        name: displayName,
        description: `${displayName} environment`,
        variables: {},
        api_hosts: {}
      }
    };
    
    dispatch('change', { subEnvironments });
  }

  $: subEnvEntries = Object.entries(subEnvironments);
  $: availableCommonEnvs = commonSubEnvNames.filter(name => !(name in subEnvironments));
</script>

<div class="border border-gray-200 rounded-lg bg-white" class:opacity-60={disabled} class:pointer-events-none={disabled}>
  <div class="flex justify-between items-center p-6 border-b border-gray-100">
    <h3 class="text-lg font-semibold text-gray-900 m-0">Sub-Environments</h3>
    <button 
      class="inline-flex items-center gap-2 bg-blue-600 text-white border-0 px-4 py-2 rounded-md font-medium cursor-pointer transition-colors text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed" 
      on:click={toggleAddForm}
      {disabled}
      type="button"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      Add Sub-Environment
    </button>
  </div>

  <div class="p-4 bg-gray-50 border-b border-gray-100 text-sm text-gray-600">
    Configure different deployment environments (dev, staging, production) with specific settings for each.
  </div>

  <!-- Quick Add Common Environments -->
  {#if availableCommonEnvs.length > 0}
    <div class="p-4 bg-blue-50 border-b border-gray-100 flex items-center gap-3">
      <span class="text-sm font-medium text-blue-700">Quick add:</span>
      <div class="flex gap-2">
        {#each availableCommonEnvs as envName}
          <button 
            class="px-3 py-1 bg-blue-100 text-blue-700 border border-blue-300 rounded text-sm font-medium cursor-pointer transition-colors hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed" 
            on:click={() => addCommonSubEnv(envName)}
            {disabled}
            type="button"
          >
            {envName}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  {#if showAddForm}
    <form class="p-6 border-b border-gray-100 bg-gray-50" on:submit|preventDefault={addSubEnvironment}>
      <div class="flex gap-4 items-center">
        <input
          type="text"
          bind:value={newSubEnvName}
          placeholder="Sub-environment name (e.g., staging, qa)"
          class="flex-1 px-3 py-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]"
          required
          {disabled}
        />
        <button type="submit" class="px-4 py-3 rounded-md font-medium cursor-pointer transition-all border-0 text-sm bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed" {disabled}>Add</button>
        <button type="button" class="px-4 py-3 rounded-md font-medium cursor-pointer transition-all text-sm bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed" on:click={toggleAddForm} {disabled}>Cancel</button>
      </div>
    </form>
  {/if}

  {#if subEnvEntries.length > 0}
    <div class="p-6">
      {#each subEnvEntries as [subEnvKey, subEnv]}
        <div class="border border-gray-200 rounded-md mb-4 bg-gray-50 last:mb-0">
          <div class="flex justify-between items-center p-4 bg-gray-50 border-b border-gray-200">
            <div class="flex items-center gap-2">
              <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-mono">{subEnvKey}</span>
              <span class="text-gray-600">({subEnv.name})</span>
            </div>
            <button 
              class="p-2 bg-red-50 text-red-600 border-0 rounded cursor-pointer transition-all hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed" 
              on:click={() => removeSubEnvironment(subEnvKey)}
              {disabled}
              type="button"
              aria-label="Remove sub-environment {subEnvKey}"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"></polyline>
                <path d="m19,6v14a2,2 0 0 1-2,2H7a2,2 0 0 1-2-2V6m3,0V4a2,2 0 0 1 2-2h4a2,2 0 0 1 2,2v2"></path>
              </svg>
            </button>
          </div>

          <div class="p-4 flex flex-col gap-4">
            <div class="flex flex-col gap-2">
              <label for="display-name-{subEnvKey}" class="text-sm font-medium text-gray-700">Display Name</label>
              <input
                id="display-name-{subEnvKey}"
                type="text"
                bind:value={subEnv.name}
                on:input={updateSubEnvironments}
                placeholder="Environment display name"
                class="px-2 py-2 border border-gray-300 rounded text-sm transition-colors focus:outline-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]"
                {disabled}
              />
            </div>

            <div class="flex flex-col gap-2">
              <label for="description-{subEnvKey}" class="text-sm font-medium text-gray-700">Description</label>
              <input
                id="description-{subEnvKey}"
                type="text"
                bind:value={subEnv.description}
                on:input={updateSubEnvironments}
                placeholder="Describe this environment..."
                class="px-2 py-2 border border-gray-300 rounded text-sm transition-colors focus:outline-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]"
                {disabled}
              />
            </div>

            <!-- Variable Values Section -->
            <div class="mt-4">
              <h4 class="text-base font-semibold text-gray-700 mb-3">Variable Values</h4>
              {#if Object.keys(variableDefinitions).length > 0}
                <div class="space-y-3">
                  {#each Object.entries(variableDefinitions) as [varName, varDef]}
                    <div class="grid grid-cols-[200px_1fr] gap-3 items-center">
                      <label for="var-{subEnvKey}-{varName}" class="flex items-center gap-2">
                        <code class="bg-gray-200 px-2 py-1 rounded text-xs font-mono">{varName}</code>
                        {#if !varDef.required}
                          <span class="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs font-medium">optional</span>
                        {/if}
                      </label>
                      <div>
                        {#if varDef.type === 'boolean'}
                          <select
                            id="var-{subEnvKey}-{varName}"
                            bind:value={subEnv.variables[varName]}
                            on:change={updateSubEnvironments}
                            class="w-full px-2 py-2 border border-gray-300 rounded text-sm transition-colors focus:outline-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]"
                            {disabled}
                          >
                            <option value={undefined}>Use default ({varDef.default_value})</option>
                            <option value={true}>true</option>
                            <option value={false}>false</option>
                          </select>
                        {:else if varDef.type === 'number'}
                          <input
                            id="var-{subEnvKey}-{varName}"
                            type="number"
                            bind:value={subEnv.variables[varName]}
                            on:input={updateSubEnvironments}
                            placeholder={`Default: ${varDef.default_value}`}
                            class="w-full px-2 py-2 border border-gray-300 rounded text-sm transition-colors focus:outline-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]"
                            {disabled}
                          />
                        {:else}
                          <input
                            id="var-{subEnvKey}-{varName}"
                            type="text"
                            bind:value={subEnv.variables[varName]}
                            on:input={updateSubEnvironments}
                            placeholder={`Default: ${varDef.default_value}`}
                            class="w-full px-2 py-2 border border-gray-300 rounded text-sm transition-colors focus:outline-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]"
                            {disabled}
                          />
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              {:else}
                <p class="text-sm text-gray-400 italic">No variable definitions found. Add variable definitions first.</p>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="p-8 text-center text-gray-600">
      <p class="mb-4">No sub-environments configured yet.</p>
      <p class="text-sm text-gray-400">
        Sub-environments represent different deployment stages (like dev, staging, production) 
        where your API might be hosted with different configurations.
      </p>
    </div>
  {/if}
</div>

<!-- Confirm Delete Dialog -->
<ConfirmDialog
  bind:isOpen={showConfirmDialog}
  title="Remove Sub-environment"
  message={pendingDeleteSubEnv ? `Are you sure you want to remove sub-environment "${pendingDeleteSubEnv}"?` : ''}
  confirmText="Remove"
  cancelText="Cancel"
  confirmVariant="danger"
  on:confirm={confirmDeleteSubEnv}
  on:cancel={cancelDeleteSubEnv}
/>

