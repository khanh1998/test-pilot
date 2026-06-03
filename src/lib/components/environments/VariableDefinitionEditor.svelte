<script lang="ts">
  
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import type { VariableDefinition } from '$lib/types/environment';

  interface Props {
    [key: string]: unknown;
    variableDefinitions?: Record<string, VariableDefinition>;
    disabled?: boolean;
  }

  let { variableDefinitions = $bindable({}), disabled = false , ...callbackProps
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

  let showAddRow = $state(false);
  let newVariableName = $state('');
  let newVariableType: VariableDefinition['type'] = $state('string');
  let newVariableDescription = $state('');
  let newVariableRequired = $state(false);
  let newVariableDefaultValue: unknown = $state('');

  let showConfirmDialog = $state(false);
  let pendingDeleteVariable: string | null = $state(null);

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
        type: newVariableType,
        description: newVariableDescription.trim(),
        required: newVariableRequired,
        default_value: newVariableDefaultValue
      }
    };

    resetAddRow();
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

  function toggleAddRow() {
    showAddRow = !showAddRow;
    if (!showAddRow) resetAddRow();
  }

  function resetAddRow() {
    showAddRow = false;
    newVariableName = '';
    newVariableType = 'string';
    newVariableDescription = '';
    newVariableRequired = false;
    newVariableDefaultValue = '';
  }

  function handleNewVariableTypeChange() {
    newVariableDefaultValue = newVariableType === 'boolean' ? false : '';
  }

  let variableEntries = $derived(Object.entries(variableDefinitions));
</script>

<div
  class="rounded-lg border border-gray-200 bg-white"
  class:opacity-60={disabled}
  class:pointer-events-none={disabled}
>
  <div class="flex items-center justify-between gap-4 border-b border-gray-100 p-4">
    <div>
      <h3 class="m-0 text-lg font-semibold text-gray-900">Variable Definitions</h3>
      <p class="mt-1 text-sm text-gray-500">
        Define values that can be mapped into flow or sequence parameters when an environment is
        linked.
      </p>
    </div>
    <button
      class="inline-flex cursor-pointer items-center gap-2 rounded-md border-0 bg-blue-600 px-3 py-2 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      onclick={toggleAddRow}
      {disabled}
      type="button"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      Add Variable
    </button>
  </div>

  {#if variableEntries.length > 0 || showAddRow}
    <div class="overflow-x-auto">
      <table class="w-full min-w-[980px] border-collapse text-sm">
        <thead
          class="bg-gray-50 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase"
        >
          <tr>
            <th class="w-[180px] border-b border-gray-200 px-3 py-2">Name</th>
            <th class="w-[140px] border-b border-gray-200 px-3 py-2">Type</th>
            <th class="w-[110px] border-b border-gray-200 px-3 py-2">Required</th>
            <th class="border-b border-gray-200 px-3 py-2">Default Value</th>
            <th class="border-b border-gray-200 px-3 py-2">Description</th>
            <th class="w-[100px] border-b border-gray-200 px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          {#each variableEntries as [name, definition]}
            <tr class="bg-white hover:bg-gray-50">
              <td class="px-3 py-2 align-middle">
                <code class="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-900"
                  >{name}</code
                >
              </td>
              <td class="px-3 py-2 align-middle">
                <select
                  id="type-{name}"
                  bind:value={definition.type}
                  onchange={updateVariableDefinitions}
                  class="w-full rounded border border-gray-300 px-2 py-1.5 text-sm transition-colors focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] focus:outline-none"
                  {disabled}
                >
                  <option value="string">String</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                  <option value="object">Object</option>
                  <option value="array">Array</option>
                </select>
              </td>
              <td class="px-3 py-2 align-middle">
                <label class="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    bind:checked={definition.required}
                    onchange={updateVariableDefinitions}
                    class="m-0"
                    {disabled}
                  />
                  Required
                </label>
              </td>
              <td class="px-3 py-2 align-middle">
                {#if definition.type === 'boolean'}
                  <select
                    id="default-{name}"
                    bind:value={definition.default_value}
                    onchange={updateVariableDefinitions}
                    class="w-full rounded border border-gray-300 px-2 py-1.5 text-sm transition-colors focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] focus:outline-none"
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
                    oninput={updateVariableDefinitions}
                    placeholder="0"
                    class="w-full rounded border border-gray-300 px-2 py-1.5 text-sm transition-colors focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] focus:outline-none"
                    {disabled}
                  />
                {:else}
                  <input
                    id="default-{name}"
                    type="text"
                    bind:value={definition.default_value}
                    oninput={updateVariableDefinitions}
                    placeholder={definition.type === 'object'
                      ? '{}'
                      : definition.type === 'array'
                        ? '[]'
                        : 'Default value...'}
                    class="w-full rounded border border-gray-300 px-2 py-1.5 text-sm transition-colors focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] focus:outline-none {definition.type ===
                      'object' || definition.type === 'array'
                      ? 'font-mono'
                      : ''}"
                    {disabled}
                  />
                {/if}
              </td>
              <td class="px-3 py-2 align-middle">
                <input
                  id="description-{name}"
                  type="text"
                  bind:value={definition.description}
                  oninput={updateVariableDefinitions}
                  placeholder="Describe this variable..."
                  class="w-full rounded border border-gray-300 px-2 py-1.5 text-sm transition-colors focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] focus:outline-none"
                  {disabled}
                />
              </td>
              <td class="px-3 py-2 text-right align-middle">
                <button
                  class="inline-flex h-8 w-8 items-center justify-center rounded border-0 bg-red-50 text-red-600 transition-all hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  onclick={() => removeVariable(name)}
                  {disabled}
                  type="button"
                  aria-label="Remove variable {name}"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <polyline points="3,6 5,6 21,6"></polyline>
                    <path
                      d="m19,6v14a2,2 0 0 1-2,2H7a2,2 0 0 1-2-2V6m3,0V4a2,2 0 0 1 2-2h4a2,2 0 0 1 2,2v2"
                    ></path>
                  </svg>
                </button>
              </td>
            </tr>
          {/each}

          {#if showAddRow}
            <tr class="bg-blue-50/60">
              <td class="px-3 py-2 align-middle">
                <input
                  type="text"
                  bind:value={newVariableName}
                  placeholder="variable_name"
                  class="w-full rounded border border-blue-200 px-2 py-1.5 font-mono text-sm transition-colors focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] focus:outline-none"
                  required
                  {disabled}
                />
              </td>
              <td class="px-3 py-2 align-middle">
                <select
                  bind:value={newVariableType}
                  onchange={handleNewVariableTypeChange}
                  class="w-full rounded border border-blue-200 px-2 py-1.5 text-sm transition-colors focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] focus:outline-none"
                  {disabled}
                >
                  <option value="string">String</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                  <option value="object">Object</option>
                  <option value="array">Array</option>
                </select>
              </td>
              <td class="px-3 py-2 align-middle">
                <label class="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    bind:checked={newVariableRequired}
                    class="m-0"
                    {disabled}
                  />
                  Required
                </label>
              </td>
              <td class="px-3 py-2 align-middle">
                {#if newVariableType === 'boolean'}
                  <select
                    bind:value={newVariableDefaultValue}
                    class="w-full rounded border border-blue-200 px-2 py-1.5 text-sm transition-colors focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] focus:outline-none"
                    {disabled}
                  >
                    <option value={false}>false</option>
                    <option value={true}>true</option>
                  </select>
                {:else if newVariableType === 'number'}
                  <input
                    type="number"
                    bind:value={newVariableDefaultValue}
                    placeholder="0"
                    class="w-full rounded border border-blue-200 px-2 py-1.5 text-sm transition-colors focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] focus:outline-none"
                    {disabled}
                  />
                {:else}
                  <input
                    type="text"
                    bind:value={newVariableDefaultValue}
                    placeholder={newVariableType === 'object'
                      ? '{}'
                      : newVariableType === 'array'
                        ? '[]'
                        : 'Default value...'}
                    class="w-full rounded border border-blue-200 px-2 py-1.5 text-sm transition-colors focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] focus:outline-none {newVariableType ===
                      'object' || newVariableType === 'array'
                      ? 'font-mono'
                      : ''}"
                    {disabled}
                  />
                {/if}
              </td>
              <td class="px-3 py-2 align-middle">
                <input
                  type="text"
                  bind:value={newVariableDescription}
                  placeholder="Describe this variable..."
                  class="w-full rounded border border-blue-200 px-2 py-1.5 text-sm transition-colors focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] focus:outline-none"
                  {disabled}
                />
              </td>
              <td class="px-3 py-2 align-middle">
                <div class="flex justify-end gap-2">
                  <button
                    type="button"
                    class="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                    onclick={addVariable}
                    disabled={disabled || !newVariableName.trim()}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    class="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    onclick={resetAddRow}
                    {disabled}
                  >
                    Cancel
                  </button>
                </div>
              </td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="p-8 text-center text-gray-600">
      <p class="mb-4">No variables defined yet.</p>
      <p class="text-sm text-gray-400">
        Variables allow you to define reusable values that can be set differently for each
        environment (dev, staging, prod) and passed into flows through parameter mappings.
      </p>
    </div>
  {/if}
</div>

<ConfirmDialog
  bind:isOpen={showConfirmDialog}
  title="Remove Variable"
  message={pendingDeleteVariable
    ? `Are you sure you want to remove variable "${pendingDeleteVariable}"?`
    : ''}
  confirmText="Remove"
  cancelText="Cancel"
  confirmVariant="danger"
  onConfirm={confirmDeleteVariable}
  onCancel={cancelDeleteVariable}
/>
