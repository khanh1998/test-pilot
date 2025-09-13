<!-- ProjectVariableManager.svelte - Manage project variables -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ProjectVariable } from '../../types/project.js';

  export let variables: ProjectVariable[] = [];
  export let loading = false;

  const dispatch = createEventDispatcher<{
    create: { variable: ProjectVariable };
    update: { index: number; variable: ProjectVariable };
    delete: { index: number };
    reorder: { fromIndex: number; toIndex: number };
  }>();

  let showCreateModal = false;
  let editingIndex: number | null = null;
  let newVariable: ProjectVariable = {
    name: '',
    description: '',
    default_value: '',
    type: 'string'
  };

  const variableTypes = [
    { value: 'string', label: 'String' },
    { value: 'number', label: 'Number' },
    { value: 'boolean', label: 'Boolean' },
    { value: 'object', label: 'Object (JSON)' }
  ];

  function resetNewVariable() {
    newVariable = {
      name: '',
      description: '',
      default_value: '',
      type: 'string'
    };
  }

  function handleCreate() {
    if (!newVariable.name?.trim()) return;
    
    const variable: ProjectVariable = {
      ...newVariable,
      name: newVariable.name.trim(),
      description: newVariable.description?.trim() || undefined
    };
    
    dispatch('create', { variable });
    resetNewVariable();
    showCreateModal = false;
  }

  function handleEdit(index: number) {
    editingIndex = index;
  }

  function handleUpdate() {
    if (editingIndex === null || !variables[editingIndex].name?.trim()) return;
    
    const variable = {
      ...variables[editingIndex],
      name: variables[editingIndex].name.trim(),
      description: variables[editingIndex].description?.trim() || undefined
    };
    
    dispatch('update', { index: editingIndex, variable });
    editingIndex = null;
  }

  function handleDelete(index: number) {
    const variable = variables[index];
    if (confirm(`Are you sure you want to delete variable "${variable.name}"?`)) {
      dispatch('delete', { index });
    }
  }

  function formatDefaultValue(value: any, type: string): string {
    if (value === null || value === undefined) return '';
    if (type === 'object') {
      try {
        return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  function parseDefaultValue(value: string, type: string): any {
    if (!value.trim()) return null;
    
    switch (type) {
      case 'number':
        const num = Number(value);
        return isNaN(num) ? null : num;
      case 'boolean':
        return value.toLowerCase() === 'true';
      case 'object':
        try {
          return JSON.parse(value);
        } catch {
          return value; // Keep as string if invalid JSON
        }
      default:
        return value;
    }
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h3 class="text-lg font-medium text-gray-900">Project Variables</h3>
      <p class="mt-1 text-sm text-gray-500">
        Define reusable variables that can be used across test flows in this project.
      </p>
    </div>
    
    <button
      type="button"
      on:click={() => (showCreateModal = true)}
      class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
    >
      <svg class="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
      </svg>
      Add Variable
    </button>
  </div>

  <!-- Variables List -->
  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
    </div>
  {:else if variables.length === 0}
    <div class="text-center py-12">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.79 4 8 4s8-1.79 8-4V7c0 2.21-3.79 4-8 4s-8-1.79-8-4z M4 7c0-2.21 3.79-4 8-4s8 1.79 8 4"/>
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">No Variables</h3>
      <p class="mt-1 text-sm text-gray-500">Get started by creating your first project variable.</p>
      <div class="mt-6">
        <button
          type="button"
          on:click={() => (showCreateModal = true)}
          class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          Add Variable
        </button>
      </div>
    </div>
  {:else}
    <div class="bg-white shadow overflow-hidden sm:rounded-md">
      <ul class="divide-y divide-gray-200">
        {#each variables as variable, index}
          <li class="px-6 py-4">
            {#if editingIndex === index}
              <!-- Edit Mode -->
              <div class="space-y-4">
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label for="edit-var-name-{index}" class="block text-sm font-medium text-gray-700">Name *</label>
                    <input
                      id="edit-var-name-{index}"
                      type="text"
                      bind:value={variable.name}
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="Variable name"
                    />
                  </div>
                  
                  <div>
                    <label for="edit-var-type-{index}" class="block text-sm font-medium text-gray-700">Type</label>
                    <select
                      id="edit-var-type-{index}"
                      bind:value={variable.type}
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    >
                      {#each variableTypes as type}
                        <option value={type.value}>{type.label}</option>
                      {/each}
                    </select>
                  </div>
                </div>
                
                <div>
                  <label for="edit-var-desc-{index}" class="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    id="edit-var-desc-{index}"
                    bind:value={variable.description}
                    rows="2"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Optional description"
                  ></textarea>
                </div>
                
                <div>
                  <label for="edit-var-value-{index}" class="block text-sm font-medium text-gray-700">Default Value</label>
                  {#if variable.type === 'object'}
                    <textarea
                      id="edit-var-value-{index}"
                      value={formatDefaultValue(variable.default_value, variable.type)}
                      on:input={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        variable.default_value = parseDefaultValue(target.value, variable.type);
                      }}
                      rows="4"
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm font-mono"
                      placeholder="JSON object"
                    ></textarea>
                  {:else if variable.type === 'boolean'}
                    <select
                      id="edit-var-value-{index}"
                      bind:value={variable.default_value}
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    >
                      <option value={null}>No default value</option>
                      <option value={true}>true</option>
                      <option value={false}>false</option>
                    </select>
                  {:else}
                    <input
                      id="edit-var-value-{index}"
                      type={variable.type === 'number' ? 'number' : 'text'}
                      value={formatDefaultValue(variable.default_value, variable.type)}
                      on:input={(e) => {
                        const target = e.target as HTMLInputElement;
                        variable.default_value = parseDefaultValue(target.value, variable.type);
                      }}
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="Default value (optional)"
                    />
                  {/if}
                </div>
                
                <div class="flex justify-end space-x-3">
                  <button
                    type="button"
                    on:click={() => (editingIndex = null)}
                    class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    on:click={handleUpdate}
                    class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                    disabled={!variable.name?.trim()}
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
                      <div class="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                        <svg class="h-4 w-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.79 4 8 4s8-1.79 8-4V7c0 2.21-3.79 4-8 4s-8-1.79-8-4z M4 7c0-2.21 3.79-4 8-4s8 1.79 8 4"/>
                        </svg>
                      </div>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center space-x-2">
                        <p class="text-sm font-medium text-gray-900 truncate">{variable.name}</p>
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          {variableTypes.find(t => t.value === variable.type)?.label || variable.type}
                        </span>
                      </div>
                      {#if variable.description}
                        <p class="text-sm text-gray-500 mt-1">{variable.description}</p>
                      {/if}
                      {#if variable.default_value !== null && variable.default_value !== undefined}
                        <div class="mt-1">
                          <span class="text-xs text-gray-500">Default: </span>
                          <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">
                            {formatDefaultValue(variable.default_value, variable.type)}
                          </code>
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>
                
                <div class="flex items-center space-x-2">
                  <button
                    type="button"
                    on:click={() => handleEdit(index)}
                    class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                    aria-label="Edit variable {variable.name}"
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                  </button>
                  
                  <button
                    type="button"
                    on:click={() => handleDelete(index)}
                    class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                    aria-label="Delete variable {variable.name}"
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

<!-- Create Variable Modal -->
{#if showCreateModal}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div class="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
      <h3 class="text-lg font-bold text-gray-900 mb-4">Create New Variable</h3>
      
      <div class="space-y-4">
        <div>
          <label for="new-var-name" class="block text-sm font-medium text-gray-700">Name *</label>
          <input
            id="new-var-name"
            type="text"
            bind:value={newVariable.name}
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="my_variable"
          />
        </div>
        
        <div>
          <label for="new-var-type" class="block text-sm font-medium text-gray-700">Type</label>
          <select
            id="new-var-type"
            bind:value={newVariable.type}
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            {#each variableTypes as type}
              <option value={type.value}>{type.label}</option>
            {/each}
          </select>
        </div>
        
        <div>
          <label for="new-var-desc" class="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            id="new-var-desc"
            bind:value={newVariable.description}
            rows="2"
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="Optional description"
          ></textarea>
        </div>
        
        <div>
          <label for="new-var-value" class="block text-sm font-medium text-gray-700">Default Value</label>
          {#if newVariable.type === 'object'}
            <textarea
              id="new-var-value"
              bind:value={newVariable.default_value}
              rows="4"
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm font-mono"
              placeholder="JSON object"
            ></textarea>
          {:else if newVariable.type === 'boolean'}
            <select
              id="new-var-value"
              bind:value={newVariable.default_value}
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">No default value</option>
              <option value={true}>true</option>
              <option value={false}>false</option>
            </select>
          {:else}
            <input
              id="new-var-value"
              type={newVariable.type === 'number' ? 'number' : 'text'}
              bind:value={newVariable.default_value}
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Default value (optional)"
            />
          {/if}
        </div>
      </div>
      
      <div class="flex justify-end space-x-3 mt-6">
        <button
          type="button"
          on:click={() => {
            showCreateModal = false;
            resetNewVariable();
          }}
          class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          on:click={handleCreate}
          disabled={!newVariable.name?.trim()}
          class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Create Variable
        </button>
      </div>
    </div>
  </div>
{/if}
