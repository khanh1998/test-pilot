<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { FlowParameter } from './types';
  import { fade } from 'svelte/transition';
  
  export let isOpen = false;
  export let parameters: FlowParameter[] = [];
  
  const dispatch = createEventDispatcher();
  
  // Parameter editor state
  interface ExtendedFlowParameter extends FlowParameter {
    isNew?: boolean;
    editing?: boolean;
    tempName?: string;
    tempType?: string;
    tempDefaultValue?: unknown;
    tempDescription?: string;
    tempRequired?: boolean;
  }
  
  // Track if we've made any changes that need saving
  let hasChanges = false;
  
  // Working copy of parameters to allow in-place editing
  let workingParameters: ExtendedFlowParameter[] = [];
  
  // New parameter row for direct table input
  let newParameter: ExtendedFlowParameter | null = null;
  
  // Initialize working copy of parameters when the component mounts or parameters change
  $: if (parameters) {
    workingParameters = parameters.map(p => ({ 
      ...p, 
      editing: false,
      tempName: p.name,
      tempType: p.type,
      tempDefaultValue: p.defaultValue,
      tempDescription: p.description,
      tempRequired: p.required
    }));
  }
  
  // Add a new parameter row to the table for direct editing
  function addParameterRow() {
    newParameter = {
      name: '',
      type: 'string',
      value: undefined,
      defaultValue: undefined,
      description: '',
      required: false,
      isNew: true,
      editing: true,
      tempName: '',
      tempType: 'string',
      tempDefaultValue: undefined,
      tempDescription: '',
      tempRequired: false
    };
    hasChanges = true;
  }
  
  // Edit an existing parameter
  function startEditing(parameter: ExtendedFlowParameter) {
    // Find the parameter in the working array and update it to trigger reactivity
    const paramIndex = workingParameters.findIndex(p => p === parameter);
    
    if (paramIndex !== -1) {
      workingParameters[paramIndex] = {
        ...workingParameters[paramIndex],
        editing: true,
        tempName: parameter.name,
        tempType: parameter.type,
        tempDefaultValue: parameter.defaultValue,
        tempDescription: parameter.description || '',
        tempRequired: parameter.required
      };
      // Trigger reactivity
      workingParameters = workingParameters;
    }
  }
  
  // Cancel editing a parameter
  function cancelEditing(parameter: ExtendedFlowParameter) {
    if (parameter.isNew) {
      newParameter = null;
    } else {
      // Find the parameter in the working array and update it to trigger reactivity
      const paramIndex = workingParameters.findIndex(p => p === parameter);
      if (paramIndex !== -1) {
        workingParameters[paramIndex] = {
          ...workingParameters[paramIndex],
          editing: false
        };
        // Trigger reactivity
        workingParameters = workingParameters;
      }
    }
  }
  
  // Apply changes to a parameter
  function applyChanges(parameter: ExtendedFlowParameter): boolean {
    // Validate parameter name
    if (!parameter.tempName || parameter.tempName.trim() === '') {
      alert('Parameter name cannot be empty');
      return false;
    }
    
    // Check for duplicate names (except for the current parameter being edited)
    const duplicateName = workingParameters.find(p => 
      p !== parameter && p.name === parameter.tempName
    );
    
    if (duplicateName) {
      alert(`A parameter with name "${parameter.tempName}" already exists`);
      return false;
    }
    
    // For object/array types, validate the JSON
    if ((parameter.tempType === 'object' || parameter.tempType === 'array') && parameter.tempDefaultValue) {
      try {
        // If it's a string, try to parse it
        if (typeof parameter.tempDefaultValue === 'string') {
          JSON.parse(parameter.tempDefaultValue as string);
        }
      } catch (e) {
        alert('Invalid JSON in default value');
        return false;
      }
    }
    
    // Check if this is a new parameter or if changes were made (before updating the parameter)
    const isNewParam = parameter.isNew;
    const parameterHasChanges = !isNewParam && (
      parameter.tempName !== parameter.name ||
      parameter.tempType !== parameter.type ||
      parameter.tempDefaultValue !== parameter.defaultValue ||
      parameter.tempDescription !== parameter.description ||
      parameter.tempRequired !== parameter.required
    );
    
    // Apply the changes
    const paramIndex = workingParameters.findIndex(p => p === parameter);
    if (paramIndex !== -1) {
      workingParameters[paramIndex] = {
        ...workingParameters[paramIndex],
        name: parameter.tempName || '',
        type: parameter.tempType as any,
        defaultValue: parameter.tempDefaultValue,
        description: parameter.tempDescription,
        required: parameter.tempRequired === true,
        editing: false
      };
    } else {
      // For direct assignment fallback
      parameter.name = parameter.tempName || '';
      parameter.type = parameter.tempType as any;
      parameter.defaultValue = parameter.tempDefaultValue;
      parameter.description = parameter.tempDescription;
      parameter.required = parameter.tempRequired === true;
      parameter.editing = false;
    }
    
    // If it's a new parameter, add it to the working list
    if (isNewParam && newParameter === parameter) {
      workingParameters = [...workingParameters, parameter];
      newParameter = null;
      
      // Dispatch save event immediately for new parameters
      const { editing, tempName, tempType, tempDefaultValue, tempDescription, tempRequired, ...cleanParam } = parameter;
      dispatch('save', { ...cleanParam, isNew: true });
      hasChanges = true;
    } else {
      // Trigger reactivity for existing parameters
      workingParameters = workingParameters;
      
      // Dispatch save event immediately for modified existing parameters
      if (parameterHasChanges) {
        const { editing, tempName, tempType, tempDefaultValue, tempDescription, tempRequired, ...cleanParam } = parameter;
        dispatch('save', cleanParam);
        hasChanges = true;
      }
    }
    
    return true;
  }
  
  // Remove a parameter
  function removeParameter(parameter: ExtendedFlowParameter, index: number) {
    if (confirm(`Are you sure you want to remove parameter "${parameter.name}"?`)) {
      workingParameters = workingParameters.filter((_, i) => i !== index);
      hasChanges = true;
    }
  }
  
  // Save all changes
  function saveAllChanges() {
    // For new parameters, dispatch save events
    for (const parameter of workingParameters) {
      if (parameter.isNew) {
        // Remove temporary editing fields but keep isNew flag
        const { editing, tempName, tempType, tempDefaultValue, tempDescription, tempRequired, ...cleanParam } = parameter;
        // Keep the isNew flag for the FlowRunner to identify new parameters
        dispatch('save', { ...cleanParam, isNew: true });
      } 
      else if (hasParameterChanged(parameter)) {
        // For modified parameters, dispatch save events
        const { editing, tempName, tempType, tempDefaultValue, tempDescription, tempRequired, ...cleanParam } = parameter;
        dispatch('save', cleanParam);
      }
    }
    
    // For removed parameters, dispatch remove events
    for (const originalParam of parameters) {
      if (!workingParameters.some(wp => wp.name === originalParam.name)) {
        dispatch('remove', originalParam);
      }
    }
    
    hasChanges = false;
  }
  
  // Check if a parameter has been modified from its original state
  function hasParameterChanged(parameter: ExtendedFlowParameter): boolean {
    const originalParam = parameters.find(p => p.name === parameter.name);
    if (!originalParam) return true;
    
    return (
      parameter.type !== originalParam.type ||
      parameter.defaultValue !== originalParam.defaultValue ||
      parameter.description !== originalParam.description ||
      parameter.required !== originalParam.required
    );
  }
  
  // Close the parameter editor
  function closeEditor() {
    if (hasChanges) {
      if (confirm("You have unsaved changes. Do you want to save them before closing?")) {
        saveAllChanges();
      }
    }
    dispatch('close');
  }
</script>

<div 
  class="fixed inset-0 z-40 flex justify-end transition-opacity duration-200 ease-in-out {isOpen 
    ? 'opacity-100' 
    : 'opacity-0'}"
  on:keydown={(e) => e.key === 'Escape' && closeEditor()}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
>
  <!-- Completely transparent clickable overlay for the left side -->
  <div
    class="absolute inset-y-0 right-0 left-0 bg-transparent transition-opacity duration-300 ease-in-out sm:right-[85%] md:right-[750px] lg:right-[650px]"
    on:click={closeEditor}
    role="presentation"
    aria-hidden="true"
  ></div>

  <!-- The panel itself - responsive sizing for different screens -->
  <div
    class="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white shadow-xl transition-transform duration-300 ease-in-out sm:w-[85%] md:w-[750px] lg:w-[650px] {!isOpen
      ? 'pointer-events-none'
      : ''}"
    style="transform: {isOpen ? 'translateX(0)' : 'translateX(100%)'};"
    aria-hidden={!isOpen}
  >
    <!-- Header -->
    <div
      class="sticky top-0 z-10 flex w-full items-center justify-between border-b bg-gray-100 px-4 py-3 shadow-sm"
    >
      <h3 class="text-lg font-semibold">Flow Parameters</h3>
      <div class="flex items-center gap-2">
        {#if hasChanges}
          <button
            class="rounded bg-blue-600 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-700"
            on:click={saveAllChanges}
            transition:fade={{duration: 150}}
          >
            Save Changes
          </button>
        {/if}
        <button
          class="rounded-full p-2 hover:bg-gray-200"
          on:click={closeEditor}
          aria-label="Close parameters panel"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- Main content -->
    <div class="p-4">
      <!-- Parameters List -->
      <div class="mb-4">
        <div class="mb-2 flex justify-between">
          <h4 class="font-medium">Flow Parameters</h4>
        </div>

        <div class="space-y-3">
          {#if workingParameters.length === 0 && !newParameter}
            <div class="flex flex-col items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-center">
              <svg class="mb-2 h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <p class="text-sm text-gray-500">No parameters added yet.</p>
              <p class="mt-1 text-xs text-gray-400">Parameters allow you to define reusable values for your test flow</p>
              <button
                class="mt-3 flex items-center rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
                on:click={addParameterRow}
              >
                <svg class="mr-1 h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  ></path>
                </svg>
                Add First Parameter
              </button>
            </div>
          {:else}
            <div class="rounded-md border border-gray-200 bg-gray-50 shadow-sm overflow-x-auto">
              <table class="w-full min-w-[600px] border-collapse">
                <thead>
                  <tr class="border-b bg-gray-100 text-left">
                    <th class="px-3 py-2 text-xs font-medium text-gray-600 min-w-[120px]">Name</th>
                    <th class="px-3 py-2 text-xs font-medium text-gray-600 min-w-[80px]">Type</th>
                    <th class="px-3 py-2 text-xs font-medium text-gray-600 min-w-[120px]">Default Value</th>
                    <th class="w-16 px-3 py-2 text-xs font-medium text-gray-600 text-center">Required</th>
                    <th class="w-24 px-3 py-2 text-xs font-medium text-gray-600 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {#each workingParameters as parameter, index (index)}
                    <tr class="group border-b border-gray-200 last:border-0 hover:bg-gray-50">
                      {#if parameter.editing}
                        <td class="px-3 py-2">
                          <input
                            type="text"
                            placeholder="Parameter Name"
                            bind:value={parameter.tempName}
                            class="w-full rounded-md border-0 bg-transparent px-0 py-0 text-sm transition-colors focus:border-b-2 focus:border-blue-500 focus:outline-none focus:ring-0"
                            aria-label="Parameter name"
                          />
                        </td>
                        <td class="px-3 py-2">
                          <select 
                            bind:value={parameter.tempType}
                            class="w-full rounded-md border-0 bg-transparent px-0 py-0 text-sm transition-colors focus:border-b-2 focus:border-blue-500 focus:outline-none focus:ring-0"
                          >
                            <option value="string">String</option>
                            <option value="number">Number</option>
                            <option value="boolean">Boolean</option>
                            <option value="object">Object</option>
                            <option value="array">Array</option>
                            <option value="null">Null</option>
                          </select>
                        </td>
                        <td class="px-3 py-2">
                          {#if parameter.tempType === 'string'}
                            <input
                              type="text"
                              placeholder="Default Value"
                              bind:value={parameter.tempDefaultValue}
                              class="w-full rounded-md border-0 bg-transparent px-0 py-0 text-sm transition-colors focus:border-b-2 focus:border-blue-500 focus:outline-none focus:ring-0"
                            />
                          {:else if parameter.tempType === 'number'}
                            <input
                              type="number"
                              placeholder="Default Value"
                              bind:value={parameter.tempDefaultValue}
                              class="w-full rounded-md border-0 bg-transparent px-0 py-0 text-sm transition-colors focus:border-b-2 focus:border-blue-500 focus:outline-none focus:ring-0"
                            />
                          {:else if parameter.tempType === 'boolean'}
                            <select
                              bind:value={parameter.tempDefaultValue}
                              class="w-full rounded-md border-0 bg-transparent px-0 py-0 text-sm transition-colors focus:border-b-2 focus:border-blue-500 focus:outline-none focus:ring-0"
                            >
                              <option value={undefined}>No default</option>
                              <option value={true}>True</option>
                              <option value={false}>False</option>
                            </select>
                          {:else if parameter.tempType === 'object' || parameter.tempType === 'array'}
                            <input
                              type="text"
                              placeholder="JSON Value"
                              bind:value={parameter.tempDefaultValue}
                              class="w-full rounded-md border-0 bg-transparent px-0 py-0 text-sm transition-colors focus:border-b-2 focus:border-blue-500 focus:outline-none focus:ring-0"
                            />
                          {/if}
                        </td>
                        <td class="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            bind:checked={parameter.tempRequired}
                            class="h-4 w-4 cursor-pointer rounded accent-blue-600"
                            aria-label="Required parameter"
                          />
                        </td>
                        <td class="px-3 py-2 text-right whitespace-nowrap">
                          <div class="flex justify-end space-x-1">
                            <button
                              type="button"
                              class="text-blue-600 hover:text-blue-800 p-1"
                              on:click={(e) => {
                                e.stopPropagation();
                                applyChanges(parameter);
                              }}
                              aria-label="Apply changes"
                            >
                              <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fill-rule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clip-rule="evenodd"
                                ></path>
                              </svg>
                            </button>
                            <button
                              type="button"
                              class="text-gray-400 hover:text-gray-600 p-1"
                              on:click={(e) => {
                                e.stopPropagation();
                                cancelEditing(parameter);
                              }}
                              aria-label="Cancel editing"
                            >
                              <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fill-rule="evenodd"
                                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                  clip-rule="evenodd"
                                ></path>
                              </svg>
                            </button>
                          </div>
                        </td>
                      {:else}
                        <td class="px-3 py-2">
                          <div class="font-medium">{parameter.name}</div>
                          {#if parameter.description}
                            <div class="text-xs text-gray-500">{parameter.description}</div>
                          {/if}
                        </td>
                        <td class="px-3 py-2">{parameter.type || 'string'}</td>
                        <td class="px-3 py-2">
                          {#if parameter.defaultValue !== undefined && parameter.defaultValue !== null}
                            {#if typeof parameter.defaultValue === 'object'}
                              <span class="font-mono text-xs">{JSON.stringify(parameter.defaultValue)}</span>
                            {:else}
                              <span>{String(parameter.defaultValue)}</span>
                            {/if}
                          {:else}
                            <span class="text-gray-400 italic text-xs">No default</span>
                          {/if}
                        </td>
                        <td class="px-3 py-2 text-center">
                          {#if parameter.required}
                            <svg class="inline-block h-4 w-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                            </svg>
                          {:else}
                            <span class="text-gray-300">–</span>
                          {/if}
                        </td>
                        <td class="px-3 py-2 text-right">
                          <div class="flex justify-end space-x-1">
                            <button
                              type="button"
                              class="text-gray-400 hover:text-blue-600 p-1"
                              on:click={(e) => {
                                e.stopPropagation();
                                startEditing(parameter);
                              }}
                              aria-label="Edit parameter"
                            >
                              <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path>
                              </svg>
                            </button>
                            <button
                              type="button"
                              class="text-gray-400 hover:text-red-600 p-1"
                              on:click={(e) => {
                                e.stopPropagation();
                                removeParameter(parameter, index);
                              }}
                              aria-label="Remove parameter"
                            >
                              <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fill-rule="evenodd"
                                  d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                  clip-rule="evenodd"
                                ></path>
                              </svg>
                            </button>
                          </div>
                        </td>
                      {/if}
                    </tr>
                  {/each}
                  
                  <!-- New parameter row -->
                  {#if newParameter}
                    <tr class="group border-b border-gray-200 last:border-0 bg-gray-50" transition:fade={{duration: 150}}>
                      <td class="px-3 py-2">
                        <input
                          type="text"
                          placeholder="Parameter Name"
                          bind:value={newParameter.tempName}
                          class="w-full rounded-md border-0 bg-transparent px-0 py-0 text-sm transition-colors focus:border-b-2 focus:border-blue-500 focus:outline-none focus:ring-0"
                          aria-label="Parameter name"
                        />
                      </td>
                      <td class="px-3 py-2">
                        <select 
                          bind:value={newParameter.tempType}
                          class="w-full rounded-md border-0 bg-transparent px-0 py-0 text-sm transition-colors focus:border-b-2 focus:border-blue-500 focus:outline-none focus:ring-0"
                        >
                          <option value="string">String</option>
                          <option value="number">Number</option>
                          <option value="boolean">Boolean</option>
                          <option value="object">Object</option>
                          <option value="array">Array</option>
                          <option value="null">Null</option>
                        </select>
                      </td>
                      <td class="px-3 py-2">
                        {#if newParameter.tempType === 'string'}
                          <input
                            type="text"
                            placeholder="Default Value"
                            bind:value={newParameter.tempDefaultValue}
                            class="w-full rounded-md border-0 bg-transparent px-0 py-0 text-sm transition-colors focus:border-b-2 focus:border-blue-500 focus:outline-none focus:ring-0"
                          />
                        {:else if newParameter.tempType === 'number'}
                          <input
                            type="number"
                            placeholder="Default Value"
                            bind:value={newParameter.tempDefaultValue}
                            class="w-full rounded-md border-0 bg-transparent px-0 py-0 text-sm transition-colors focus:border-b-2 focus:border-blue-500 focus:outline-none focus:ring-0"
                          />
                        {:else if newParameter.tempType === 'boolean'}
                          <select
                            bind:value={newParameter.tempDefaultValue}
                            class="w-full rounded-md border-0 bg-transparent px-0 py-0 text-sm transition-colors focus:border-b-2 focus:border-blue-500 focus:outline-none focus:ring-0"
                          >
                            <option value={undefined}>No default</option>
                            <option value={true}>True</option>
                            <option value={false}>False</option>
                          </select>
                        {:else if newParameter.tempType === 'object' || newParameter.tempType === 'array'}
                          <input
                            type="text"
                            placeholder="JSON Value"
                            bind:value={newParameter.tempDefaultValue}
                            class="w-full rounded-md border-0 bg-transparent px-0 py-0 text-sm transition-colors focus:border-b-2 focus:border-blue-500 focus:outline-none focus:ring-0"
                          />
                        {/if}
                      </td>
                      <td class="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          bind:checked={newParameter.tempRequired}
                          class="h-4 w-4 cursor-pointer rounded accent-blue-600"
                          aria-label="Required parameter"
                        />
                      </td>
                      <td class="px-3 py-2 text-right whitespace-nowrap">
                        <div class="flex justify-end space-x-1">
                          <button
                            type="button"
                            class="text-blue-600 hover:text-blue-800 p-1"
                            on:click={(e) => {
                              e.stopPropagation();
                              newParameter && applyChanges(newParameter);
                            }}
                            aria-label="Apply changes"
                          >
                            <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fill-rule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clip-rule="evenodd"
                              ></path>
                            </svg>
                          </button>
                          <button
                            type="button"
                            class="text-gray-400 hover:text-gray-600 p-1"
                            on:click={(e) => {
                              e.stopPropagation();
                              newParameter && cancelEditing(newParameter);
                            }}
                            aria-label="Cancel"
                          >
                            <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fill-rule="evenodd"
                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                clip-rule="evenodd"
                              ></path>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  {/if}
                </tbody>
              </table>
            </div>
            
            <!-- Add parameter button -->
            <div class="mt-2 text-right">
              <button
                class="inline-flex items-center rounded bg-gray-100 px-3 py-1.5 text-xs hover:bg-gray-200"
                on:click={addParameterRow}
              >
                <svg class="mr-1 h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  ></path>
                </svg>
                Add Parameter
              </button>
            </div>
          {/if}
        </div>
      </div>

      <!-- Parameter description popover could be added here if needed -->
    </div>
  </div>
</div>
