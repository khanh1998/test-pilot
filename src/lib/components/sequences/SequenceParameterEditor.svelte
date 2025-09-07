<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { SequenceParameter } from '$lib/http_client/sequences';

  export let isOpen = false;
  export let parameters: Record<string, SequenceParameter> = {};
  export let onSave: (parameters: Record<string, SequenceParameter>) => void;
  export let onCancel: () => void;

  const dispatch = createEventDispatcher();

  // Local copy of parameters for editing
  let editingParameters = { ...parameters };
  let newParameterName = '';
  let showingNewParameter = false;

  // Reset when modal opens
  $: if (isOpen) {
    editingParameters = { ...parameters };
    newParameterName = '';
    showingNewParameter = false;
  }

  function handleSave() {
    onSave(editingParameters);
  }

  function handleCancel() {
    onCancel();
  }

  function addNewParameter() {
    if (!newParameterName.trim()) return;
    
    const paramName = newParameterName.trim();
    if (editingParameters[paramName]) {
      alert('Parameter with this name already exists');
      return;
    }

    editingParameters[paramName] = {
      type: 'string',
      description: '',
      required: false,
      value_source: 'hardcoded',
      project_variable: null,
      hardcoded_value: ''
    };
    
    editingParameters = { ...editingParameters };
    newParameterName = '';
    showingNewParameter = false;
  }

  function removeParameter(paramName: string) {
    const { [paramName]: removed, ...rest } = editingParameters;
    editingParameters = rest;
  }

  function updateParameter(paramName: string, updates: Partial<SequenceParameter>) {
    editingParameters[paramName] = {
      ...editingParameters[paramName],
      ...updates
    };
    editingParameters = { ...editingParameters };
  }

  function cancelNewParameter() {
    newParameterName = '';
    showingNewParameter = false;
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 overflow-y-auto">
    <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
      <div 
        class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
        on:click={handleCancel}
        on:keydown={(e) => e.key === 'Escape' && handleCancel()}
        role="button"
        tabindex="-1"
      ></div>
      
      <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:p-6 max-h-[90vh] overflow-y-auto">
        <div>
          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
          </div>
          <div class="mt-3 text-center sm:mt-5">
            <h3 class="text-base font-semibold leading-6 text-gray-900">Manage Sequence Parameters</h3>
            <div class="mt-2">
              <p class="text-sm text-gray-500">
                Define parameters that can be used across all flows in this sequence.
              </p>
            </div>
          </div>
        </div>
        
        <div class="mt-6">
          <!-- Add New Parameter Button -->
          <div class="mb-4">
            {#if !showingNewParameter}
              <button
                type="button"
                class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                on:click={() => showingNewParameter = true}
              >
                <svg class="-ml-0.5 mr-1.5 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd" />
                </svg>
                Add Parameter
              </button>
            {:else}
              <!-- New Parameter Form -->
              <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div class="flex items-center space-x-3">
                  <div class="flex-1">
                    <input
                      type="text"
                      placeholder="Parameter name (e.g., base_url, api_key)"
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      bind:value={newParameterName}
                      on:keydown={(e) => e.key === 'Enter' && addNewParameter()}
                    />
                  </div>
                  <button
                    type="button"
                    class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                    on:click={addNewParameter}
                    disabled={!newParameterName.trim()}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    class="inline-flex items-center rounded-md bg-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-300"
                    on:click={cancelNewParameter}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            {/if}
          </div>

          <!-- Parameters List -->
          {#if Object.keys(editingParameters).length === 0}
            <div class="text-center py-8 bg-gray-50 rounded-lg">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
              <h3 class="mt-2 text-sm font-semibold text-gray-900">No parameters</h3>
              <p class="mt-1 text-sm text-gray-500">Add a parameter to get started.</p>
            </div>
          {:else}
            <div class="space-y-4">
              {#each Object.entries(editingParameters) as [paramName, parameter] (paramName)}
                <div class="bg-gray-50 rounded-lg p-4 border">
                  <div class="flex items-start justify-between mb-4">
                    <div class="flex-1">
                      <h4 class="text-sm font-medium text-gray-900 flex items-center">
                        {paramName}
                        {#if parameter.required}
                          <span class="ml-1 text-red-500">*</span>
                        {/if}
                      </h4>
                    </div>
                    <button
                      type="button"
                      class="text-red-600 hover:text-red-800"
                      on:click={() => removeParameter(paramName)}
                      aria-label="Remove parameter"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <!-- Description -->
                    <div class="md:col-span-2">
                      <label for="desc-{paramName}" class="block text-sm font-medium text-gray-700">Description</label>
                      <textarea
                        id="desc-{paramName}"
                        rows="2"
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        placeholder="Describe this parameter..."
                        value={parameter.description}
                        on:input={(e) => updateParameter(paramName, { description: (e.target as HTMLTextAreaElement).value })}
                      ></textarea>
                    </div>

                    <!-- Type -->
                    <div>
                      <label for="type-{paramName}" class="block text-sm font-medium text-gray-700">Type</label>
                      <select
                        id="type-{paramName}"
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        value={parameter.type}
                        on:change={(e) => updateParameter(paramName, { type: (e.target as HTMLSelectElement).value as 'string' | 'number' | 'boolean' })}
                      >
                        <option value="string">String</option>
                        <option value="number">Number</option>
                        <option value="boolean">Boolean</option>
                      </select>
                    </div>

                    <!-- Required -->
                    <div class="flex items-center pt-6">
                      <input
                        id="required-{paramName}"
                        type="checkbox"
                        class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={parameter.required}
                        on:change={(e) => updateParameter(paramName, { required: (e.target as HTMLInputElement).checked })}
                      />
                      <label for="required-{paramName}" class="ml-2 block text-sm text-gray-900">
                        Required parameter
                      </label>
                    </div>

                    <!-- Value Source -->
                    <div>
                      <label for="source-{paramName}" class="block text-sm font-medium text-gray-700">Value Source</label>
                      <select
                        id="source-{paramName}"
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        value={parameter.value_source}
                        on:change={(e) => updateParameter(paramName, { value_source: (e.target as HTMLSelectElement).value as 'hardcoded' | 'project_variable' })}
                      >
                        <option value="hardcoded">Hardcoded Value</option>
                        <option value="project_variable">Project Variable</option>
                      </select>
                    </div>

                    <!-- Value Input -->
                    <div>
                      {#if parameter.value_source === 'hardcoded'}
                        <label for="value-{paramName}" class="block text-sm font-medium text-gray-700">Default Value</label>
                        {#if parameter.type === 'boolean'}
                          <select
                            id="value-{paramName}"
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            value={parameter.hardcoded_value}
                            on:change={(e) => updateParameter(paramName, { hardcoded_value: (e.target as HTMLSelectElement).value === 'true' })}
                          >
                            <option value="true">True</option>
                            <option value="false">False</option>
                          </select>
                        {:else}
                          <input
                            id="value-{paramName}"
                            type={parameter.type === 'number' ? 'number' : 'text'}
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            placeholder="Enter default value..."
                            value={parameter.hardcoded_value || ''}
                            on:input={(e) => {
                              const target = e.target as HTMLInputElement;
                              const value = parameter.type === 'number' ? 
                                (target.value ? Number(target.value) : '') : 
                                target.value;
                              updateParameter(paramName, { hardcoded_value: value });
                            }}
                          />
                        {/if}
                      {:else}
                        <label for="var-{paramName}" class="block text-sm font-medium text-gray-700">Project Variable</label>
                        <input
                          id="var-{paramName}"
                          type="text"
                          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          placeholder="Enter project variable name..."
                          value={parameter.project_variable || ''}
                          on:input={(e) => updateParameter(paramName, { project_variable: (e.target as HTMLInputElement).value })}
                        />
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
        
        <div class="mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
          <button
            type="button"
            class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
            on:click={handleSave}
          >
            Save Parameters
          </button>
          <button
            type="button"
            class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0"
            on:click={handleCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
