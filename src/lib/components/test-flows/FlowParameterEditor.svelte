<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import type { FlowParameter } from './types';
  
  export let isOpen = false;
  export let parameters: FlowParameter[] = [];
  export let currentValues: Record<string, unknown> = {};
  
  const dispatch = createEventDispatcher();
  
  // Working copy of parameters
  let workingParameters: FlowParameter[] = [];
  let editingIndex: number | null = null;
  let isAddingNew = false;
  let initialized = false;

  // Confirm dialog state
  let showConfirmDialog = false;
  let pendingDeleteIndex: number | null = null;

  // Default value input state
  let newParameterIsNullSet = false;
  let editingParameterIsNullSet: Record<number, boolean> = {};
  let defaultValueErrors: Record<string, string> = {};

  // New parameter template
  let newParameter: FlowParameter = {
    name: '',
    type: 'string',
    defaultValue: '',
    description: '',
    required: false
  };

  // Helper function to get appropriate default value for a type
  function getDefaultValueForType(type: string): unknown {
    switch (type) {
      case 'string': return '';
      case 'number': return 0;
      case 'boolean': return false;
      case 'object': return {};
      case 'array': return [];
      case 'null': return null;
      default: return '';
    }
  }

  // Helper function to handle null checkbox change
  function handleNullToggle(isNull: boolean, param: FlowParameter, paramType: 'new' | number) {
    if (isNull) {
      param.defaultValue = null;
    } else {
      param.defaultValue = getDefaultValueForType(param.type);
    }
    
    if (paramType === 'new') {
      delete defaultValueErrors['new'];
    } else {
      delete defaultValueErrors[`edit-${paramType}`];
    }
  }

  // Helper function to handle JSON input validation
  function validateJsonInput(value: string, type: 'object' | 'array', errorKey: string): boolean {
    try {
      JSON.parse(value);
      delete defaultValueErrors[errorKey];
      return true;
    } catch (e) {
      defaultValueErrors[errorKey] = `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`;
      return false;
    }
  }
  
  // Initialize working copy when parameters change, but only if not already modified locally
  $: if (!initialized || (parameters.length !== workingParameters.length)) {
    workingParameters = [...parameters];
    // Reset editing states when parameters change
    editingParameterIsNullSet = {};
    defaultValueErrors = {};
    initialized = true;
  }
  
  function startAddingNew() {
    isAddingNew = true;
    newParameter = {
      name: '',
      type: 'string',
      defaultValue: '',
      description: '',
      required: false
    };
    newParameterIsNullSet = false;
    delete defaultValueErrors['new'];
  }
  
  function cancelAddingNew() {
    isAddingNew = false;
    newParameter = {
      name: '',
      type: 'string',
      defaultValue: '',
      description: '',
      required: false
    };
    newParameterIsNullSet = false;
    delete defaultValueErrors['new'];
  }

  // Handle type change for new parameter
  function handleNewParameterTypeChange() {
    if (!newParameterIsNullSet) {
      newParameter.defaultValue = getDefaultValueForType(newParameter.type);
    }
    delete defaultValueErrors['new'];
  }

  // Handle type change for editing parameter
  function handleEditingParameterTypeChange(index: number) {
    const isNullSet = editingParameterIsNullSet[index] || false;
    if (!isNullSet) {
      workingParameters[index].defaultValue = getDefaultValueForType(workingParameters[index].type);
    }
    delete defaultValueErrors[`edit-${index}`];
  }
  
  function saveNewParameter() {
    if (!newParameter.name.trim()) {
      alert('Parameter name is required');
      return;
    }
    
    if (!newParameter.type.trim()) {
      alert('Parameter type is required');
      return;
    }
    
    if (workingParameters.some(p => p.name === newParameter.name)) {
      alert('Parameter name already exists');
      return;
    }

    // Set default value (null if checkbox is checked)
    if (newParameterIsNullSet) {
      newParameter.defaultValue = null;
    }
    // Note: For non-null values, the value is already set by direct binding to newParameter.defaultValue
    
    const paramToSave = { ...newParameter, isNew: true };
    workingParameters = [...workingParameters, paramToSave];
    dispatch('save', paramToSave);
    cancelAddingNew();
  }
  
  function startEditing(index: number) {
    editingIndex = index;
    editingParameterIsNullSet[index] = workingParameters[index].defaultValue === null;
    delete defaultValueErrors[`edit-${index}`];
  }
  
  function cancelEditing() {
    if (editingIndex !== null) {
      delete editingParameterIsNullSet[editingIndex];
      delete defaultValueErrors[`edit-${editingIndex}`];
    }
    editingIndex = null;
  }
  
  function saveParameter(index: number) {
    const param = workingParameters[index];
    if (!param.name.trim()) {
      alert('Parameter name is required');
      return;
    }
    
    if (!param.type.trim()) {
      alert('Parameter type is required');
      return;
    }

    // Set default value (null if checkbox is checked)
    if (editingParameterIsNullSet[index]) {
      param.defaultValue = null;
    }
    // Note: For non-null values, the value is already set by direct binding to param.defaultValue
    
    dispatch('save', param);
    editingIndex = null;
    delete editingParameterIsNullSet[index];
  }
  
  function removeParameter(index: number) {
    pendingDeleteIndex = index;
    showConfirmDialog = true;
  }

  function confirmDeleteParameter() {
    if (pendingDeleteIndex === null) return;
    
    const param = workingParameters[pendingDeleteIndex];
    workingParameters = workingParameters.filter((_, i) => i !== pendingDeleteIndex);
    dispatch('remove', param);
    
    pendingDeleteIndex = null;
    showConfirmDialog = false;
  }

  function cancelDeleteParameter() {
    pendingDeleteIndex = null;
    showConfirmDialog = false;
  }
  
  function closeEditor() {
    dispatch('close');
  }
</script>

<div 
  class="fixed inset-0 z-40 flex justify-end {isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}"
  on:keydown={(e) => e.key === 'Escape' && closeEditor()}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
>
  <!-- Panel -->
  <div
    class="relative z-50 w-full max-w-2xl bg-white shadow-xl transition-transform duration-300 ease-in-out flex flex-col h-full {isOpen ? 'translate-x-0' : 'translate-x-full'}"
  >
    <!-- Header -->
    <div class="flex items-center justify-between border-b px-6 py-4 flex-shrink-0">
      <h2 class="text-lg font-semibold">Flow Parameters</h2>
      <div class="flex items-center space-x-2">
        <button
          class="rounded bg-green-500 px-3 py-1.5 text-sm text-white hover:bg-green-600"
          on:click={() => {
            dispatch('saveAll', workingParameters);
            closeEditor();
          }}
        >
          Save All
        </button>
        <button
          class="rounded-full p-2 hover:bg-gray-100"
          on:click={closeEditor}
          aria-label="Close parameters panel"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-6 min-h-0">
      <!-- Add Parameter Button -->
      <div class="mb-6">
        <button
          class="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          on:click={startAddingNew}
          disabled={isAddingNew}
        >
          Add Parameter
        </button>
      </div>

      <!-- New Parameter Form -->
      {#if isAddingNew}
        <div class="mb-6 rounded-lg border border-gray-200 p-4">
          <h3 class="mb-4 font-medium">New Parameter</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <div class="block text-sm font-medium text-gray-700 mb-1">Name <span class="text-red-500">*</span></div>
              <input
                type="text"
                bind:value={newParameter.name}
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="parameter_name"
              />
            </div>
            <div>
              <div class="block text-sm font-medium text-gray-700 mb-1">Type <span class="text-red-500">*</span></div>
              <select
                bind:value={newParameter.type}
                on:change={handleNewParameterTypeChange}
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="string">String</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
                <option value="object">Object</option>
                <option value="array">Array</option>
                <option value="null">Null</option>
              </select>
            </div>
            <div class="col-span-2">
              <div class="block text-sm font-medium text-gray-700 mb-1">Default Value</div>
              <div class="space-y-2">
                <div class="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="new-param-null-checkbox"
                    bind:checked={newParameterIsNullSet}
                    on:change={() => handleNullToggle(newParameterIsNullSet, newParameter, 'new')}
                    class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label for="new-param-null-checkbox" class="text-sm text-gray-700">Set to null/undefined</label>
                </div>
                
                {#if !newParameterIsNullSet}
                  {#if newParameter.type === 'boolean'}
                    <div class="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="new-param-boolean-input"
                        checked={Boolean(newParameter.defaultValue)}
                        on:change={(e) => {
                          newParameter.defaultValue = (e.target as HTMLInputElement).checked;
                        }}
                        class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label for="new-param-boolean-input" class="text-sm text-gray-700">True/False</label>
                    </div>
                  {:else if newParameter.type === 'number'}
                    <input
                      type="number"
                      bind:value={newParameter.defaultValue}
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Enter number"
                      step="any"
                    />
                  {:else if newParameter.type === 'object' || newParameter.type === 'array'}
                    <textarea
                      bind:value={newParameter.defaultValue}
                      on:input={(e) => {
                        const value = (e.target as HTMLTextAreaElement).value;
                        if (value.trim()) {
                          validateJsonInput(value, newParameter.type as 'object' | 'array', 'new');
                        }
                      }}
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono text-sm"
                      placeholder={`Enter valid JSON for ${newParameter.type}`}
                      rows="3"
                    ></textarea>
                  {:else}
                    <input
                      type="text"
                      bind:value={newParameter.defaultValue}
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Enter string value"
                    />
                  {/if}
                {:else}
                  <div class="text-sm text-gray-500 italic p-2 bg-gray-50 rounded">Value will be set to null</div>
                {/if}

                {#if defaultValueErrors['new']}
                  <p class="text-sm text-red-600">{defaultValueErrors['new']}</p>
                {/if}
              </div>
            </div>
            <div class="col-span-2">
              <div class="block text-sm font-medium text-gray-700 mb-1">Description</div>
              <textarea
                bind:value={newParameter.description}
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                rows="2"
                placeholder="Parameter description"
              ></textarea>
            </div>
            <div class="col-span-2 flex items-center">
              <input
                type="checkbox"
                bind:checked={newParameter.required}
                class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div class="ml-2 text-sm text-gray-700">Required</div>
            </div>
          </div>
          <div class="mt-4 flex space-x-2">
            <button
              class="rounded bg-green-500 px-3 py-1 text-white hover:bg-green-600"
              on:click={saveNewParameter}
            >
              Save
            </button>
            <button
              class="rounded bg-gray-500 px-3 py-1 text-white hover:bg-gray-600"
              on:click={cancelAddingNew}
            >
              Cancel
            </button>
          </div>
        </div>
      {/if}

      <!-- Parameters List -->
      {#if workingParameters.length === 0}
        <div class="rounded-md border border-gray-200 bg-gray-50 p-8 text-center">
          <h3 class="mb-2 text-lg font-medium text-gray-700">No parameters</h3>
          <p class="text-gray-500">Add your first parameter to get started.</p>
        </div>
      {:else}
        <div class="space-y-4">
          {#each workingParameters as param, index (param.name)}
            <div class="rounded-lg border border-gray-200 p-4 shadow-sm">
              {#if editingIndex === index}
                <!-- Edit Mode -->
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <div class="block text-sm font-medium text-gray-700 mb-1">Name <span class="text-red-500">*</span></div>
                    <input
                      type="text"
                      bind:value={param.name}
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <div class="block text-sm font-medium text-gray-700 mb-1">Type <span class="text-red-500">*</span></div>
                    <select
                      bind:value={param.type}
                      on:change={() => handleEditingParameterTypeChange(index)}
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="string">String</option>
                      <option value="number">Number</option>
                      <option value="boolean">Boolean</option>
                      <option value="object">Object</option>
                      <option value="array">Array</option>
                      <option value="null">Null</option>
                    </select>
                  </div>
                  <div class="col-span-2">
                    <div class="block text-sm font-medium text-gray-700 mb-1">Default Value</div>
                    <div class="space-y-2">
                      <div class="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="edit-param-null-checkbox-{index}"
                          bind:checked={editingParameterIsNullSet[index]}
                          on:change={() => handleNullToggle(editingParameterIsNullSet[index], param, index)}
                          class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label for="edit-param-null-checkbox-{index}" class="text-sm text-gray-700">Set to null/undefined</label>
                      </div>
                      
                      {#if !editingParameterIsNullSet[index]}
                        {#if param.type === 'boolean'}
                          <div class="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="edit-param-boolean-input-{index}"
                              checked={Boolean(param.defaultValue)}
                              on:change={(e) => {
                                param.defaultValue = (e.target as HTMLInputElement).checked;
                              }}
                              class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label for="edit-param-boolean-input-{index}" class="text-sm text-gray-700">True/False</label>
                          </div>
                        {:else if param.type === 'number'}
                          <input
                            type="number"
                            bind:value={param.defaultValue}
                            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            placeholder="Enter number"
                            step="any"
                          />
                        {:else if param.type === 'object' || param.type === 'array'}
                          <textarea
                            bind:value={param.defaultValue}
                            on:input={(e) => {
                              const value = (e.target as HTMLTextAreaElement).value;
                              if (value.trim()) {
                                validateJsonInput(value, param.type as 'object' | 'array', `edit-${index}`);
                              }
                            }}
                            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono text-sm"
                            placeholder={`Enter valid JSON for ${param.type}`}
                            rows="3"
                          ></textarea>
                        {:else}
                          <input
                            type="text"
                            bind:value={param.defaultValue}
                            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            placeholder="Enter string value"
                          />
                        {/if}
                      {:else}
                        <div class="text-sm text-gray-500 italic p-2 bg-gray-50 rounded">Value will be set to null</div>
                      {/if}

                      {#if defaultValueErrors[`edit-${index}`]}
                        <p class="text-sm text-red-600">{defaultValueErrors[`edit-${index}`]}</p>
                      {/if}
                    </div>
                  </div>
                  <div class="col-span-2">
                    <div class="block text-sm font-medium text-gray-700 mb-1">Description</div>
                    <textarea
                      bind:value={param.description}
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      rows="2"
                    ></textarea>
                  </div>
                  <div class="col-span-2 flex items-center justify-between">
                    <div class="flex items-center">
                      <input
                        type="checkbox"
                        bind:checked={param.required}
                        class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div class="ml-2 text-sm text-gray-700">Required</div>
                    </div>
                    <div class="flex space-x-2">
                      <button
                        class="rounded bg-green-500 px-3 py-1 text-white hover:bg-green-600"
                        on:click={() => saveParameter(index)}
                      >
                        Save
                      </button>
                      <button
                        class="rounded bg-gray-500 px-3 py-1 text-white hover:bg-gray-600"
                        on:click={cancelEditing}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              {:else}
                <!-- View Mode -->
                <div class="grid grid-cols-3 gap-4 items-start">
                  <div>
                    <h3 class="font-medium text-sm">{param.name}</h3>
                    <p class="text-xs text-gray-600">{param.type}</p>
                    {#if param.required}
                      <span class="mt-1 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                        Required
                      </span>
                    {/if}
                  </div>
                  <div>
                    <div class="text-xs text-gray-600 mt-1">Current Value:</div>
                    <div class="text-sm font-mono break-all text-blue-700 bg-blue-50 px-2 py-1 rounded">
                      {currentValues[param.name] !== undefined ? JSON.stringify(currentValues[param.name]) : 'Not evaluated'}
                    </div>
                    <div class="text-xs text-gray-600 mt-2">Default:</div>
                    <div class="text-sm font-mono break-all">
                      {#if param.defaultValue === null}
                        <span class="text-gray-500 italic">null</span>
                      {:else if param.defaultValue === undefined}
                        <span class="text-gray-500 italic">undefined</span>
                      {:else if param.defaultValue === ''}
                        <span class="text-gray-500 italic">empty string</span>
                      {:else}
                        {typeof param.defaultValue === 'string' ? param.defaultValue : JSON.stringify(param.defaultValue)}
                      {/if}
                    </div>
                    {#if param.description}
                      <div class="text-xs text-gray-600 mt-1">Description:</div>
                      <p class="text-xs text-gray-500">{param.description}</p>
                    {/if}
                  </div>
                  <div class="flex justify-end space-x-1">
                    <button
                      class="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                      on:click={() => startEditing(index)}
                      aria-label="Edit parameter"
                    >
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      class="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      on:click={() => removeParameter(index)}
                      aria-label="Remove parameter"
                    >
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Confirm Delete Dialog -->
<ConfirmDialog
  bind:isOpen={showConfirmDialog}
  title="Remove Parameter"
  message={pendingDeleteIndex !== null && workingParameters[pendingDeleteIndex] ? `Remove parameter "${workingParameters[pendingDeleteIndex].name}"?` : ''}
  confirmText="Remove"
  cancelText="Cancel"
  confirmVariant="danger"
  on:confirm={confirmDeleteParameter}
  on:cancel={cancelDeleteParameter}
/>
