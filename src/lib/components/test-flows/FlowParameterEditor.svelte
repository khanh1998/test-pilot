<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import type { FlowParameter } from './types';

  export let isOpen = false;
  export let parameters: FlowParameter[] = [];
  export let currentValues: Record<string, unknown> = {};

  const dispatch = createEventDispatcher();

  let workingParameters: FlowParameter[] = [];
  let initialized = false;

  let showConfirmDialog = false;
  let pendingDeleteIndex: number | null = null;

  let defaultValueIsNullSet: Record<number, boolean> = {};
  let defaultValueErrors: Record<string, string> = {};

  function createEmptyParameter(): FlowParameter {
    return {
      name: '',
      type: 'string',
      defaultValue: '',
      description: '',
      required: false
    };
  }

  function getDefaultValueForType(type: string): unknown {
    switch (type) {
      case 'string':
        return '';
      case 'number':
        return 0;
      case 'boolean':
        return false;
      case 'object':
        return {};
      case 'array':
        return [];
      case 'null':
        return null;
      default:
        return '';
    }
  }

  function initializeNullStates(params: FlowParameter[]) {
    defaultValueIsNullSet = Object.fromEntries(
      params.map((parameter, index) => [index, parameter.defaultValue === null])
    );
  }

  function handleNullToggle(isNull: boolean, param: FlowParameter, index: number) {
    param.defaultValue = isNull ? null : getDefaultValueForType(param.type);
    delete defaultValueErrors[`default-${index}`];
  }

  function validateJsonInput(value: string, errorKey: string): boolean {
    try {
      JSON.parse(value);
      delete defaultValueErrors[errorKey];
      return true;
    } catch (e) {
      defaultValueErrors[errorKey] = `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`;
      return false;
    }
  }

  function serializeParameters(): FlowParameter[] {
    return workingParameters.map((parameter) => ({ ...parameter }));
  }

  function formatValue(value: unknown): string {
    if (value === undefined) return 'Not evaluated';
    if (value === '') return 'empty string';
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  }

  $: if (!initialized) {
    workingParameters = parameters.map((parameter) => ({ ...parameter }));
    initializeNullStates(workingParameters);
    defaultValueErrors = {};
    initialized = true;
  }

  function addParameter() {
    const nextParameters = [...workingParameters, createEmptyParameter()];
    workingParameters = nextParameters;
    initializeNullStates(nextParameters);
  }

  function handleParameterTypeChange(index: number) {
    const parameter = workingParameters[index];
    if (!defaultValueIsNullSet[index]) {
      parameter.defaultValue = getDefaultValueForType(parameter.type);
    }
    delete defaultValueErrors[`default-${index}`];
  }

  function validateParameters(): boolean {
    const names = new Set<string>();

    for (const [index, parameter] of workingParameters.entries()) {
      const name = parameter.name.trim();

      if (!name) {
        alert(`Parameter #${index + 1} needs a name`);
        return false;
      }

      if (!parameter.type.trim()) {
        alert(`Parameter "${name}" needs a type`);
        return false;
      }

      if (names.has(name)) {
        alert(`Parameter name "${name}" is duplicated`);
        return false;
      }

      names.add(name);

      if (defaultValueErrors[`default-${index}`]) {
        alert(`Parameter "${name}" has an invalid default value`);
        return false;
      }
    }

    return true;
  }

  function saveAllAndClose() {
    if (!validateParameters()) return;

    dispatch('saveAll', serializeParameters());
    closeEditor();
  }

  function removeParameter(index: number) {
    pendingDeleteIndex = index;
    showConfirmDialog = true;
  }

  function confirmDeleteParameter() {
    if (pendingDeleteIndex === null) return;

    const nextParameters = workingParameters.filter((_, index) => index !== pendingDeleteIndex);
    workingParameters = nextParameters;
    initializeNullStates(nextParameters);

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
  class="fixed inset-0 z-40 flex justify-end {isOpen
    ? 'opacity-100'
    : 'pointer-events-none opacity-0'}"
  on:keydown={(e) => e.key === 'Escape' && closeEditor()}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
>
  <div
    class="relative z-50 flex h-full w-full max-w-4xl flex-col bg-white shadow-xl transition-transform duration-300 ease-in-out {isOpen
      ? 'translate-x-0'
      : 'translate-x-full'}"
  >
    <div class="flex flex-shrink-0 items-center justify-between border-b px-6 py-4">
      <h2 class="text-lg font-semibold">Flow Parameters</h2>
      <div class="flex items-center space-x-2">
        <button
          class="rounded bg-green-500 px-3 py-1.5 text-sm text-white hover:bg-green-600"
          on:click={saveAllAndClose}
        >
          Save All
        </button>
        <button
          class="rounded-full p-2 hover:bg-gray-100"
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

    <div class="min-h-0 flex-1 overflow-y-auto p-6">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-medium text-gray-900">Parameters</h3>
          <p class="text-xs text-gray-500">Edit flow inputs directly in the list.</p>
        </div>
        <button
          class="shrink-0 rounded bg-blue-500 px-3 py-2 text-sm text-white hover:bg-blue-600"
          on:click={addParameter}
        >
          Add Parameter
        </button>
      </div>

      {#if workingParameters.length === 0}
        <div class="rounded-md border border-gray-200 bg-gray-50 p-8 text-center">
          <h3 class="mb-2 text-lg font-medium text-gray-700">No parameters</h3>
          <p class="text-gray-500">Add your first parameter to get started.</p>
        </div>
      {:else}
        <div
          class="grid grid-cols-[12rem_minmax(0,1fr)] overflow-hidden rounded-lg border border-gray-200"
        >
          <div class="border-r border-gray-200 bg-white shadow-[8px_0_8px_-8px_rgba(0,0,0,0.16)]">
            <div
              class="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium tracking-wide text-gray-500 uppercase"
            >
              Name
            </div>
            {#each workingParameters as param, index (index)}
              <div class="h-[59px] border-b border-gray-200 px-3 py-2.5 last:border-b-0">
                <label class="sr-only" for="param-name-{index}">Name</label>
                <input
                  id="param-name-{index}"
                  type="text"
                  bind:value={param.name}
                  class="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="parameter_name"
                />
              </div>
            {/each}
          </div>

          <div class="overflow-x-auto">
            <div class="min-w-[660px]">
              <div
                class="grid grid-cols-[7rem_minmax(13rem,1fr)_minmax(12rem,1fr)_4.75rem_minmax(8rem,0.8fr)_2rem] gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium tracking-wide text-gray-500 uppercase"
              >
                <div>Type</div>
                <div>Default</div>
                <div>Description</div>
                <div>Required</div>
                <div>Current</div>
                <div></div>
              </div>

              {#each workingParameters as param, index (index)}
                <div
                  class="grid h-[59px] grid-cols-[7rem_minmax(13rem,1fr)_minmax(12rem,1fr)_4.75rem_minmax(8rem,0.8fr)_2rem] items-start gap-2 border-b border-gray-200 px-3 py-2.5 last:border-b-0"
                >
                  <div>
                    <label class="sr-only" for="param-type-{index}">Type</label>
                    <select
                      id="param-type-{index}"
                      bind:value={param.type}
                      on:change={() => handleParameterTypeChange(index)}
                      class="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="string">String</option>
                      <option value="number">Number</option>
                      <option value="boolean">Boolean</option>
                      <option value="object">Object</option>
                      <option value="array">Array</option>
                      <option value="null">Null</option>
                    </select>
                  </div>

                  <div>
                    <div class="flex gap-2">
                      <label class="sr-only" for="param-default-{index}">Default Value</label>
                      {#if !defaultValueIsNullSet[index]}
                        {#if param.type === 'boolean'}
                          <label
                            class="flex h-[38px] flex-1 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm text-gray-700"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(param.defaultValue)}
                              on:change={(e) => {
                                param.defaultValue = (e.target as HTMLInputElement).checked;
                              }}
                              class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            True
                          </label>
                        {:else if param.type === 'number'}
                          <input
                            id="param-default-{index}"
                            type="number"
                            bind:value={param.defaultValue}
                            class="block min-w-0 flex-1 rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            placeholder="0"
                            step="any"
                          />
                        {:else if param.type === 'object' || param.type === 'array'}
                          <textarea
                            id="param-default-{index}"
                            bind:value={param.defaultValue}
                            on:input={(e) => {
                              const value = (e.target as HTMLTextAreaElement).value;
                              if (value.trim()) {
                                validateJsonInput(value, `default-${index}`);
                              } else {
                                delete defaultValueErrors[`default-${index}`];
                              }
                            }}
                            class:border-red-500={defaultValueErrors[`default-${index}`]}
                            class="block h-[38px] min-w-0 flex-1 resize-none rounded-md border-gray-300 font-mono text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            placeholder="Valid JSON"
                            rows="1"
                            title={defaultValueErrors[`default-${index}`] || undefined}
                          ></textarea>
                        {:else}
                          <input
                            id="param-default-{index}"
                            type="text"
                            bind:value={param.defaultValue}
                            class="block min-w-0 flex-1 rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            placeholder="Default"
                          />
                        {/if}
                      {:else}
                        <div
                          class="flex h-[38px] flex-1 items-center rounded-md bg-gray-50 px-3 text-sm text-gray-500 italic"
                        >
                          null
                        </div>
                      {/if}
                      <label
                        class="flex h-[38px] shrink-0 items-center gap-1 rounded-md border border-gray-200 px-2 text-xs text-gray-600"
                        title="Set default value to null"
                      >
                        <input
                          type="checkbox"
                          bind:checked={defaultValueIsNullSet[index]}
                          on:change={() =>
                            handleNullToggle(defaultValueIsNullSet[index], param, index)}
                          class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        Null
                      </label>
                    </div>
                  </div>

                  <div>
                    <label class="sr-only" for="param-description-{index}">Description</label>
                    <input
                      id="param-description-{index}"
                      type="text"
                      bind:value={param.description}
                      class="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Description"
                    />
                  </div>

                  <label class="flex h-[38px] items-center justify-center">
                    <span class="sr-only">Required</span>
                    <input
                      type="checkbox"
                      bind:checked={param.required}
                      class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </label>

                  <div
                    class="flex h-[38px] items-center overflow-hidden rounded bg-blue-50 px-2 font-mono text-xs text-blue-700"
                    title={formatValue(currentValues[param.name])}
                  >
                    <span class="truncate">{formatValue(currentValues[param.name])}</span>
                  </div>

                  <div class="flex h-[38px] items-center justify-end">
                    <button
                      class="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      on:click={() => removeParameter(index)}
                      aria-label="Remove parameter"
                    >
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<ConfirmDialog
  bind:isOpen={showConfirmDialog}
  title="Remove Parameter"
  message={pendingDeleteIndex !== null && workingParameters[pendingDeleteIndex]?.name
    ? `Remove parameter "${workingParameters[pendingDeleteIndex].name}"?`
    : 'Remove this parameter?'}
  confirmText="Remove"
  cancelText="Cancel"
  confirmVariant="danger"
  on:confirm={confirmDeleteParameter}
  on:cancel={cancelDeleteParameter}
/>
