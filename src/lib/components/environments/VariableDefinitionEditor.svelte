<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import type { VariableDefinition } from '$lib/types/environment';

  export let variableDefinitions: Record<string, VariableDefinition> = {};
  export let disabled: boolean = false;

  const dispatch = createEventDispatcher<{
    change: { variableDefinitions: Record<string, VariableDefinition> };
  }>();

  let newVariableName = '';
  let showAddForm = false;

  // Confirm dialog state
  let showConfirmDialog = false;
  let pendingDeleteVariable: string | null = null;

  function addVariable() {
    if (!newVariableName.trim()) return;
    
    const name = newVariableName.trim();
    if (name in variableDefinitions) {
      alert('Variable with this name already exists');
      return;
    }

    variableDefinitions = {
      ...variableDefinitions,
      [name]: {
        type: 'string',
        description: '',
        required: false,
        default_value: ''
      }
    };

    newVariableName = '';
    showAddForm = false;
    
    dispatch('change', { variableDefinitions });
  }

  function removeVariable(name: string) {
    pendingDeleteVariable = name;
    showConfirmDialog = true;
  }

  function confirmDeleteVariable() {
    if (!pendingDeleteVariable) return;
    
    const { [pendingDeleteVariable]: removed, ...rest } = variableDefinitions;
    variableDefinitions = rest;
    dispatch('change', { variableDefinitions });
    
    pendingDeleteVariable = null;
    showConfirmDialog = false;
  }

  function cancelDeleteVariable() {
    pendingDeleteVariable = null;
    showConfirmDialog = false;
  }

  function updateVariableDefinitions() {
    dispatch('change', { variableDefinitions });
  }

  function toggleAddForm() {
    showAddForm = !showAddForm;
    if (!showAddForm) {
      newVariableName = '';
    }
  }

  $: variableEntries = Object.entries(variableDefinitions);
</script>

<div class="border border-gray-200 rounded-lg bg-white" class:opacity-60={disabled} class:pointer-events-none={disabled}>
  <div class="flex justify-between items-center p-6 border-b border-gray-100">
    <h3 class="text-lg font-semibold text-gray-900 m-0">Variable Definitions</h3>
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
      Add Variable
    </button>
  </div>

  <div class="p-4 bg-gray-50 border-b border-gray-100 text-sm text-gray-600">
    Define variables that can be used in test flows with <code class="bg-gray-200 px-1 py-0.5 rounded text-xs">&#123;&#123;env:variable_name&#125;&#125;</code> expressions.
  </div>

  {#if showAddForm}
    <form class="p-6 border-b border-gray-100 bg-gray-50" on:submit|preventDefault={addVariable}>
      <div class="flex gap-4 items-center">
        <input
          type="text"
          bind:value={newVariableName}
          placeholder="Variable name (e.g., username, api_key)"
          class="flex-1 px-3 py-3 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]"
          required
          {disabled}
        />
        <button type="submit" class="px-4 py-3 rounded-md font-medium cursor-pointer transition-all border-0 text-sm bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed" {disabled}>Add</button>
        <button type="button" class="px-4 py-3 rounded-md font-medium cursor-pointer transition-all text-sm bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed" on:click={toggleAddForm} {disabled}>Cancel</button>
      </div>
    </form>
  {/if}

  {#if variableEntries.length > 0}
    <div class="p-6">
      {#each variableEntries as [name, definition]}
        <div class="border border-gray-200 rounded-md mb-4 bg-gray-50 last:mb-0">
          <div class="flex justify-between items-center p-4 bg-gray-50 border-b border-gray-200">
            <div class="font-semibold">
              <code class="bg-gray-200 px-2 py-1 rounded text-sm">{name}</code>
            </div>
            <button 
              class="p-2 bg-red-50 text-red-600 border-0 rounded cursor-pointer transition-all hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed" 
              on:click={() => removeVariable(name)}
              {disabled}
              type="button"
              aria-label="Remove variable {name}"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"></polyline>
                <path d="m19,6v14a2,2 0 0 1-2,2H7a2,2 0 0 1-2-2V6m3,0V4a2,2 0 0 1 2-2h4a2,2 0 0 1 2,2v2"></path>
              </svg>
            </button>
          </div>

          <div class="p-4 flex flex-col gap-4">
            <div class="flex flex-col gap-2">
              <label for="description-{name}" class="text-sm font-medium text-gray-700">Description</label>
              <input
                id="description-{name}"
                type="text"
                bind:value={definition.description}
                on:input={updateVariableDefinitions}
                placeholder="Describe this variable..."
                class="px-2 py-2 border border-gray-300 rounded text-sm transition-colors focus:outline-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]"
                {disabled}
              />
            </div>

            <div class="grid grid-cols-[1fr_auto] gap-4">
              <div class="flex flex-col gap-2">
                <label for="type-{name}" class="text-sm font-medium text-gray-700">Type</label>
                <select
                  id="type-{name}"
                  bind:value={definition.type}
                  on:change={updateVariableDefinitions}
                  class="px-2 py-2 border border-gray-300 rounded text-sm transition-colors focus:outline-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]"
                  {disabled}
                >
                  <option value="string">String</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                  <option value="object">Object</option>
                  <option value="array">Array</option>
                </select>
              </div>

              <div class="flex flex-row items-center gap-2 cursor-pointer">
                <label class="flex flex-row items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    bind:checked={definition.required}
                    on:change={updateVariableDefinitions}
                    class="w-auto m-0"
                    {disabled}
                  />
                  Required
                </label>
              </div>
            </div>

            <div class="flex flex-col gap-2">
              <label for="default-{name}" class="text-sm font-medium text-gray-700">Default Value</label>
              {#if definition.type === 'boolean'}
                <select
                  id="default-{name}"
                  bind:value={definition.default_value}
                  on:change={updateVariableDefinitions}
                  class="px-2 py-2 border border-gray-300 rounded text-sm transition-colors focus:outline-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]"
                  {disabled}
                >
                  <option value={false}>false</option>
                  <option value={true}>true</option>
                </select>
              {:else if definition.type === 'number'}
                <input
                  id="default-{name}"
                  type="number"
                  bind:value={definition.default_value}
                  on:input={updateVariableDefinitions}
                  placeholder="0"
                  class="px-2 py-2 border border-gray-300 rounded text-sm transition-colors focus:outline-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]"
                  {disabled}
                />
              {:else if definition.type === 'object' || definition.type === 'array'}
                <textarea
                  id="default-{name}"
                  bind:value={definition.default_value}
                  on:input={updateVariableDefinitions}
                  placeholder={definition.type === 'object' ? '{}' : '[]'}
                  rows="3"
                  class="px-2 py-2 border border-gray-300 rounded text-sm transition-colors resize-y min-h-[60px] font-mono focus:outline-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]"
                  {disabled}
                ></textarea>
              {:else}
                <input
                  id="default-{name}"
                  type="text"
                  bind:value={definition.default_value}
                  on:input={updateVariableDefinitions}
                  placeholder="Default value..."
                  class="px-2 py-2 border border-gray-300 rounded text-sm transition-colors focus:outline-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]"
                  {disabled}
                />
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="p-8 text-center text-gray-600">
      <p class="mb-4">No variables defined yet.</p>
      <p class="text-sm text-gray-400">
        Variables allow you to define reusable values that can be set differently for each environment 
        (dev, staging, prod) and referenced in your test flows.
      </p>
    </div>
  {/if}
</div>

<!-- Confirm Delete Dialog -->
<ConfirmDialog
  bind:isOpen={showConfirmDialog}
  title="Remove Variable"
  message={pendingDeleteVariable ? `Are you sure you want to remove variable "${pendingDeleteVariable}"?` : ''}
  confirmText="Remove"
  cancelText="Cancel"
  confirmVariant="danger"
  on:confirm={confirmDeleteVariable}
  on:cancel={cancelDeleteVariable}
/>


