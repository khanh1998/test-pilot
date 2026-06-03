<script lang="ts">
    
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import type { SubEnvironment, VariableDefinition } from '$lib/types/environment';

  interface Props {
    [key: string]: unknown;
    subEnvironments?: Record<string, SubEnvironment>;
    variableDefinitions?: Record<string, VariableDefinition>;
    disabled?: boolean;
  }

  let { subEnvironments = $bindable({}), variableDefinitions = {}, disabled = false , ...callbackProps
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

  let newSubEnvName = $state('');
  let showAddForm = $state(false);

  // Confirm dialog state
  let showConfirmDialog = $state(false);
  let pendingDeleteSubEnv: string | null = $state(null);

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

  let subEnvEntries = $derived(Object.entries(subEnvironments));
  let availableCommonEnvs = $derived(commonSubEnvNames.filter((name) => !(name in subEnvironments)));
</script>

<div
  class="rounded-lg border border-gray-200 bg-white"
  class:opacity-60={disabled}
  class:pointer-events-none={disabled}
>
  <div class="flex items-center justify-between border-b border-gray-100 p-6">
    <h3 class="m-0 text-lg font-semibold text-gray-900">Sub-Environments</h3>
    <button
      class="inline-flex cursor-pointer items-center gap-2 rounded-md border-0 bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      onclick={toggleAddForm}
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
      Add Sub-Environment
    </button>
  </div>

  <div class="border-b border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
    Configure different deployment environments (dev, staging, production) with specific settings
    for each.
  </div>

  <!-- Quick Add Common Environments -->
  {#if availableCommonEnvs.length > 0}
    <div class="flex items-center gap-3 border-b border-gray-100 bg-blue-50 p-4">
      <span class="text-sm font-medium text-blue-700">Quick add:</span>
      <div class="flex gap-2">
        {#each availableCommonEnvs as envName}
          <button
            class="cursor-pointer rounded border border-blue-300 bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
            onclick={() => addCommonSubEnv(envName)}
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
    <form
      class="border-b border-gray-100 bg-gray-50 p-6"
      onsubmit={(event) => { event.preventDefault(); addSubEnvironment(); }}
    >
      <div class="flex items-center gap-4">
        <input
          type="text"
          bind:value={newSubEnvName}
          placeholder="Sub-environment name (e.g., staging, qa)"
          class="flex-1 rounded-md border border-gray-300 px-3 py-3 text-sm focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] focus:outline-none"
          required
          {disabled}
        />
        <button
          type="submit"
          class="cursor-pointer rounded-md border-0 bg-green-600 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          {disabled}>Add</button
        >
        <button
          type="button"
          class="cursor-pointer rounded-md border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          onclick={toggleAddForm}
          {disabled}>Cancel</button
        >
      </div>
    </form>
  {/if}

  {#if subEnvEntries.length > 0}
    <div class="p-6">
      {#each subEnvEntries as [subEnvKey, subEnv]}
        <div class="mb-4 rounded-md border border-gray-200 bg-gray-50 last:mb-0">
          <div class="flex items-center justify-between border-b border-gray-200 bg-gray-50 p-4">
            <div class="flex items-center gap-2">
              <span class="rounded bg-blue-100 px-2 py-1 font-mono text-sm text-blue-800"
                >{subEnvKey}</span
              >
              <span class="text-gray-600">({subEnv.name})</span>
            </div>
            <button
              class="cursor-pointer rounded border-0 bg-red-50 p-2 text-red-600 transition-all hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50"
              onclick={() => removeSubEnvironment(subEnvKey)}
              {disabled}
              type="button"
              aria-label="Remove sub-environment {subEnvKey}"
            >
              <svg
                width="16"
                height="16"
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
          </div>

          <div class="flex flex-col gap-4 p-4">
            <div class="grid grid-cols-1 gap-4 md:grid-cols-[200px_1fr]">
              <div class="flex flex-col gap-2">
                <label for="key-{subEnvKey}" class="text-sm font-medium text-gray-700">Key</label>
                <input
                  id="key-{subEnvKey}"
                  type="text"
                  value={subEnvKey}
                  placeholder="dev"
                  class="rounded border border-gray-200 bg-gray-100 px-2 py-2 font-mono text-sm text-gray-600"
                  readonly
                />
                <p class="m-0 text-xs text-gray-500">
                  Stable ID used by saved flows and run settings.
                </p>
              </div>

              <div class="flex flex-col gap-2">
                <label for="display-name-{subEnvKey}" class="text-sm font-medium text-gray-700"
                  >Display Name</label
                >
                <input
                  id="display-name-{subEnvKey}"
                  type="text"
                  bind:value={subEnv.name}
                  oninput={updateSubEnvironments}
                  placeholder="Environment display name"
                  class="rounded border border-gray-300 px-2 py-2 text-sm transition-colors focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] focus:outline-none"
                  {disabled}
                />
              </div>
            </div>

            <div class="flex flex-col gap-2">
              <label for="description-{subEnvKey}" class="text-sm font-medium text-gray-700"
                >Description</label
              >
              <input
                id="description-{subEnvKey}"
                type="text"
                bind:value={subEnv.description}
                oninput={updateSubEnvironments}
                placeholder="Describe this environment..."
                class="rounded border border-gray-300 px-2 py-2 text-sm transition-colors focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] focus:outline-none"
                {disabled}
              />
            </div>

            <!-- Variable Values Section -->
            <div class="mt-4">
              <h4 class="mb-3 text-base font-semibold text-gray-700">Variable Values</h4>
              {#if Object.keys(variableDefinitions).length > 0}
                <div class="space-y-3">
                  {#each Object.entries(variableDefinitions) as [varName, varDef]}
                    <div class="grid grid-cols-[200px_1fr] items-center gap-3">
                      <label for="var-{subEnvKey}-{varName}" class="flex items-center gap-2">
                        <code class="rounded bg-gray-200 px-2 py-1 font-mono text-xs"
                          >{varName}</code
                        >
                        {#if !varDef.required}
                          <span
                            class="rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700"
                            >optional</span
                          >
                        {/if}
                      </label>
                      <div>
                        {#if varDef.type === 'boolean'}
                          <select
                            id="var-{subEnvKey}-{varName}"
                            bind:value={subEnv.variables[varName]}
                            onchange={updateSubEnvironments}
                            class="w-full rounded border border-gray-300 px-2 py-2 text-sm transition-colors focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] focus:outline-none"
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
                            oninput={updateSubEnvironments}
                            placeholder={`Default: ${varDef.default_value}`}
                            class="w-full rounded border border-gray-300 px-2 py-2 text-sm transition-colors focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] focus:outline-none"
                            {disabled}
                          />
                        {:else}
                          <input
                            id="var-{subEnvKey}-{varName}"
                            type="text"
                            bind:value={subEnv.variables[varName]}
                            oninput={updateSubEnvironments}
                            placeholder={`Default: ${varDef.default_value}`}
                            class="w-full rounded border border-gray-300 px-2 py-2 text-sm transition-colors focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] focus:outline-none"
                            {disabled}
                          />
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              {:else}
                <p class="text-sm text-gray-400 italic">
                  No variable definitions found. Add variable definitions first.
                </p>
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
        Sub-environments represent different deployment stages (like dev, staging, production) where
        your API might be hosted with different configurations.
      </p>
    </div>
  {/if}
</div>

<!-- Confirm Delete Dialog -->
<ConfirmDialog
  bind:isOpen={showConfirmDialog}
  title="Remove Sub-environment"
  message={pendingDeleteSubEnv
    ? `Are you sure you want to remove sub-environment "${pendingDeleteSubEnv}"?`
    : ''}
  confirmText="Remove"
  cancelText="Cancel"
  confirmVariant="danger"
  onConfirm={confirmDeleteSubEnv}
  onCancel={cancelDeleteSubEnv}
/>
