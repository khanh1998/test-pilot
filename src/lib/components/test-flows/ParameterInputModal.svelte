<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { FlowParameter } from './types';

  export let isOpen = false;
  export let parameters: FlowParameter[] = [];
  export let isPendingSingleStepExecution = false;

  const dispatch = createEventDispatcher();

  function handleClose() {
    dispatch('close');
  }

  function handleSubmit() {
    dispatch('submit', { parameters });
  }
</script>

{#if isOpen}
  <div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
    <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-lg font-medium">Required Parameters</h3>
        <button
          class="text-gray-500 hover:text-gray-700"
          on:click={handleClose}
          aria-label="Close modal"
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

      <p class="mb-4 text-sm text-gray-600">The following parameters need values to run the flow:</p>

      <div class="mb-6 max-h-96 overflow-y-auto">
        {#each parameters as parameter (parameter.name)}
          <div class="mb-4">
            <label
              for={`var-${parameter.name}`}
              class="mb-1 block text-sm font-medium text-gray-700"
            >
              {parameter.name}
              {parameter.required ? '*' : ''}
            </label>

            {#if parameter.description}
              <p class="mb-2 text-xs text-gray-500">{parameter.description}</p>
            {/if}

            {#if parameter.type === 'string'}
              <input
                id={`var-${parameter.name}`}
                type="text"
                class="block w-full rounded-md border border-gray-300 p-2 shadow-sm"
                bind:value={parameter.value}
              />
            {:else if parameter.type === 'number'}
              <input
                id={`var-${parameter.name}`}
                type="number"
                class="block w-full rounded-md border border-gray-300 p-2 shadow-sm"
                bind:value={parameter.value}
              />
            {:else if parameter.type === 'boolean'}
              <label class="flex items-center" for={`var-${parameter.name}`}>
                <input
                  id={`var-${parameter.name}`}
                  type="checkbox"
                  class="h-4 w-4 rounded border-gray-300 text-blue-600"
                  checked={Boolean(parameter.value)}
                  on:change={(e) => (parameter.value = e.currentTarget.checked)}
                />
                <span class="ml-2 text-sm">Enabled</span>
              </label>
            {:else if parameter.type === 'object' || parameter.type === 'array'}
              <div>
                <textarea
                  id={`var-${parameter.name}`}
                  class="block w-full rounded-md border border-gray-300 p-2 font-mono shadow-sm"
                  rows="4"
                  value={parameter.value ? JSON.stringify(parameter.value, null, 2) : ''}
                  on:input={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    try {
                      parameter.value = JSON.parse(target.value);
                    } catch (_error: unknown) {
                      // Don't update if invalid JSON
                    }
                  }}
                ></textarea>
                <p class="mt-1 text-xs text-gray-500">Enter a valid JSON {parameter.type}</p>
              </div>
            {:else}
              <div class="rounded-md bg-gray-100 p-2">
                <span class="text-gray-700 italic">No input required for {parameter.type} type</span>
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <div class="flex justify-end space-x-3">
        <button
          class="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          on:click={handleClose}
        >
          Cancel
        </button>
        <button
          class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          on:click={handleSubmit}
        >
          {isPendingSingleStepExecution ? 'Run Step' : 'Run Flow'}
        </button>
      </div>
    </div>
  </div>
{/if}
