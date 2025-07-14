<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Endpoint, StepEndpoint } from './types';

  export let isOpen = false;
  export let isMounted = false;
  export let endpoint: Endpoint;
  export let stepEndpoint: StepEndpoint;
  export let stepIndex: number;
  export let endpointIndex: number;
  export let duplicateCount: number = 1;
  export let instanceIndex: number = 1;

  const dispatch = createEventDispatcher();

  // Transformation editor state
  type Transformation = {
    alias: string;
    expression: string;
  };

  let transformations: Transformation[] = [];
  let editingTransformationIndex: number | null = null;
  let newTransformation: Transformation = { alias: '', expression: '' };

  // Initialize state when component mounts
  $: if (isMounted && endpoint && stepEndpoint) {
    // Initialize transformations if needed
    if (!stepEndpoint.transformations) {
      stepEndpoint.transformations = [];
    }
    transformations = [...(stepEndpoint.transformations || [])];
  }

  // Save changes from transformation editor
  function saveTransformationChanges() {
    try {
      // Validate each transformation
      const validTransformations = transformations.filter(t => t.alias && t.expression);
      
      // Save transformations
      stepEndpoint.transformations = [...validTransformations];

      dispatch('change');
      closeTransformationEditor();
    } catch (e: unknown) {
      console.error('Error saving transformation changes:', e);
      // You might want to show an error message here
    }
  }

  // Add a new transformation
  function addTransformation() {
    if (!newTransformation.alias || !newTransformation.expression) {
      // Skip adding empty transformations
      return;
    }

    transformations = [...transformations, { ...newTransformation }];
    newTransformation = { alias: '', expression: '' };
  }

  // Edit a transformation
  function editTransformation(index: number) {
    editingTransformationIndex = index;
    newTransformation = { ...transformations[index] };
  }

  // Update a transformation
  function updateTransformation() {
    if (editingTransformationIndex === null) {
      return;
    }

    if (!newTransformation.alias || !newTransformation.expression) {
      // Skip updating with empty values
      editingTransformationIndex = null;
      newTransformation = { alias: '', expression: '' };
      return;
    }

    transformations = transformations.map((t, i) => 
      i === editingTransformationIndex ? { ...newTransformation } : t
    );
    
    editingTransformationIndex = null;
    newTransformation = { alias: '', expression: '' };
  }

  // Remove a transformation
  function removeTransformation(index: number) {
    transformations = transformations.filter((_, i) => i !== index);
  }

  function cancelEdit() {
    editingTransformationIndex = null;
    newTransformation = { alias: '', expression: '' };
  }

  function closeTransformationEditor() {
    dispatch('close');
  }
</script>

<div
  class="fixed inset-0 z-40 flex justify-end transition-opacity duration-200 ease-in-out {isOpen
    ? 'opacity-100'
    : 'opacity-0'}"
  on:keydown={(e) => e.key === 'Escape' && closeTransformationEditor()}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
>
  <!-- Completely transparent clickable overlay for the left side -->
  <div
    class="absolute inset-y-0 right-0 left-0 bg-transparent transition-opacity duration-300 ease-in-out sm:right-[75%] md:right-[600px] lg:right-[500px]"
    on:click={closeTransformationEditor}
    role="presentation"
    aria-hidden="true"
  ></div>

  <!-- The panel itself - responsive sizing for different screens -->
  <div
    class="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white shadow-xl transition-transform duration-300 ease-in-out sm:w-[75%] md:w-[600px] lg:w-[500px] {!isOpen
      ? 'pointer-events-none'
      : ''}"
    style="transform: {isOpen ? 'translateX(0)' : 'translateX(100%)'};"
    aria-hidden={!isOpen}
  >
    <!-- Header -->
    <div
      class="sticky top-0 z-10 flex w-full items-center justify-between border-b bg-gray-100 px-4 py-3 shadow-sm"
    >
      <div>
        <h3 class="font-medium">
          <span class="mr-2 rounded bg-purple-100 px-2 py-1 text-xs text-purple-800">
            Transformation
          </span>
          <span class="font-mono text-sm">{endpoint?.path}</span>
          {#if duplicateCount > 1}
            <span class="ml-2 rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">
              Instance #{instanceIndex}
            </span>
          {/if}
        </h3>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="rounded bg-blue-600 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-700"
          on:click={saveTransformationChanges}
        >
          Save
        </button>
        <button
          class="rounded-full p-1 text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-800"
          on:click={closeTransformationEditor}
          aria-label="Close"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            ></path>
          </svg>
        </button>
      </div>
    </div>

    <div class="p-4">
      {#if duplicateCount > 1}
        <div
          class="mb-4 rounded border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs text-blue-700"
        >
          <span class="flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="mr-1 h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            This endpoint appears {duplicateCount} times in this step. Changes here only affect instance
            #{instanceIndex}.
          </span>
        </div>
      {/if}

      <!-- Transformation Description -->
      <div class="mb-4 rounded border border-gray-100 bg-gray-50 p-3 text-sm text-gray-600">
        <p class="mb-2">
          <strong>Phase 1:</strong> Configure transformations that will be applied to the response.
        </p>
        <p>
          Define an <strong>alias</strong> and an <strong>expression</strong> for each transformation.
          In Phase 1, expressions are stored but not evaluated - the raw response will be available under each alias.
        </p>
        <p class="mt-2">
          Reference transformed values in later steps using:
          <code class="rounded bg-gray-200 px-1 py-0.5 text-xs">{'{{proc:step1-1.$.alias.path}}'}</code>
        </p>
      </div>

      <!-- Add/Edit Transformation Form -->
      <div class="mb-6 rounded border border-gray-200 p-4">
        <h4 class="mb-3 text-sm font-medium text-gray-700">
          {editingTransformationIndex !== null ? 'Edit Transformation' : 'Add New Transformation'}
        </h4>
        
        <!-- Alias input -->
        <div class="mb-3">
          <label for="alias" class="mb-1 block text-sm font-medium text-gray-700">Alias</label>
          <input
            type="text"
            id="alias"
            class="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="e.g., userId, totalAmount"
            bind:value={newTransformation.alias}
          />
        </div>
        
        <!-- Expression input -->
        <div class="mb-3">
          <label for="expression" class="mb-1 block text-sm font-medium text-gray-700">
            Expression (Phase 2)
          </label>
          <textarea
            id="expression"
            rows="3"
            class="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="e.g., sum(map(response.items, 'price'))"
            bind:value={newTransformation.expression}
          ></textarea>
        </div>
        
        <div class="flex justify-end gap-2">
          {#if editingTransformationIndex !== null}
            <button
              class="rounded border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
              on:click={cancelEdit}
            >
              Cancel
            </button>
            <button
              class="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
              on:click={updateTransformation}
            >
              Update
            </button>
          {:else}
            <button
              class="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
              on:click={addTransformation}
            >
              Add
            </button>
          {/if}
        </div>
      </div>

      <!-- Transformations List -->
      <div class="mb-4">
        <h4 class="mb-2 text-sm font-medium text-gray-700">Configured Transformations</h4>
        
        {#if transformations.length === 0}
          <div class="rounded border border-gray-200 p-4 text-center text-sm text-gray-500">
            No transformations configured yet.
          </div>
        {:else}
          <div class="space-y-3">
            {#each transformations as transformation, i}
              <div class="rounded border border-gray-200 bg-white p-3">
                <div class="flex items-center justify-between">
                  <div class="font-medium text-gray-700">
                    {transformation.alias}
                  </div>
                  <div class="flex items-center gap-1">
                    <button
                      class="rounded p-1 text-blue-600 hover:bg-blue-50"
                      on:click={() => editTransformation(i)}
                      title="Edit transformation"
                      aria-label="Edit transformation"
                    >
                      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      class="rounded p-1 text-red-600 hover:bg-red-50"
                      on:click={() => removeTransformation(i)}
                      title="Remove transformation"
                      aria-label="Remove transformation"
                    >
                      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                <div class="mt-1 text-sm text-gray-500">
                  <span class="font-mono">{transformation.expression}</span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="mt-6 flex justify-end">
        <button
          class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          on:click={saveTransformationChanges}
        >
          Save All Transformations
        </button>
      </div>
    </div>
  </div>
</div>
