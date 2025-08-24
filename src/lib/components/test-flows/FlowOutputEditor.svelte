<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { FlowOutput } from './types';

  export let isOpen = false;
  export let isMounted = false;
  export let outputs: FlowOutput[] = [];
  
  // Add props for displaying output results
  export let outputResults: Record<string, unknown> = {}; // Results from last execution
  export let executionError: unknown = null; // Error from last execution
  export let hasExecutionData: boolean = false; // Whether we have execution data to show

  const dispatch = createEventDispatcher();

  // Output editor state
  let localOutputs: FlowOutput[] = [];
  let editingOutputIndex: number | null = null;
  let newOutput: FlowOutput = { name: '', description: '', value: '', isTemplate: false };
  
  // UI state for showing/hiding results
  let showResults = false;

  // Initialize state when component mounts
  $: if (isMounted) {
    localOutputs = [...(outputs || [])];
  }

  // Auto-show results if we have execution data
  $: if (hasExecutionData && (Object.keys(outputResults).length > 0 || executionError)) {
    showResults = true;
  }

  // Save changes from output editor
  function saveOutputChanges() {
    try {
      // Validate each output
      const validOutputs = localOutputs.filter(o => {
        return o.name && o.value;
      });
      
      dispatch('save', { outputs: validOutputs });
      closeOutputEditor();
    } catch (e: unknown) {
      console.error('Error saving output changes:', e);
    }
  }

  // Add a new output
  function addOutput() {
    if (!newOutput.name || !newOutput.value) {
      return;
    }

    localOutputs = [...localOutputs, { ...newOutput }];
    newOutput = { name: '', description: '', value: '', isTemplate: false };
  }

  // Edit an output
  function editOutput(index: number) {
    editingOutputIndex = index;
    newOutput = { ...localOutputs[index] };
  }

  // Update an output
  function updateOutput() {
    if (editingOutputIndex === null) {
      return;
    }

    if (!newOutput.name || !newOutput.value) {
      editingOutputIndex = null;
      newOutput = { name: '', description: '', value: '', isTemplate: false };
      return;
    }

    localOutputs = localOutputs.map((o, i) => 
      i === editingOutputIndex ? { ...newOutput } : o
    );
    
    editingOutputIndex = null;
    newOutput = { name: '', description: '', value: '', isTemplate: false };
  }

  // Remove an output
  function removeOutput(index: number) {
    localOutputs = localOutputs.filter((_, i) => i !== index);
  }

  function cancelEdit() {
    editingOutputIndex = null;
    newOutput = { name: '', description: '', value: '', isTemplate: false };
  }

  function closeOutputEditor() {
    dispatch('close');
  }

  // Helper function to safely stringify values for display
  function formatValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  // Helper function to get the data type of a value
  function getValueType(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return typeof value;
  }

  // Get the result for a specific output
  function getOutputResult(name: string): unknown {
    return outputResults[name];
  }

  // Check if an output has a result
  function hasResult(name: string): boolean {
    return name in outputResults;
  }

  // Example template expressions for reference
  const exampleExpressions = [
    '{{res:step1-0.$.id}}',
    '{{res:step2-0.$.data.token}}',
    '{{trans:step1-0.user_id}}',
    '{{param:test_email}}',
    '{{func:now()}}',
    '"hardcoded value"'
  ];
</script>

<div
  class="fixed inset-0 z-40 flex justify-end transition-opacity duration-200 ease-in-out {isOpen
    ? 'opacity-100'
    : 'pointer-events-none opacity-0'}"
  on:keydown={(e) => e.key === 'Escape' && closeOutputEditor()}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
>
  <!-- Transparent overlay for the left side -->
  <div
    class="absolute inset-y-0 right-0 left-0 bg-transparent transition-opacity duration-300 ease-in-out sm:right-[75%] md:right-[700px] lg:right-[600px]"
    on:click={closeOutputEditor}
    role="presentation"
    aria-hidden="true"
  ></div>

  <!-- The panel itself -->
  <div
    class="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white shadow-xl transition-transform duration-300 ease-in-out sm:w-[75%] md:w-[700px] lg:w-[600px] {!isOpen
      ? 'translate-x-full'
      : 'translate-x-0'}"
    aria-hidden="false"
  >
    <!-- Header -->
    <div class="sticky top-0 z-10 flex w-full items-center justify-between border-b bg-gray-50 px-6 py-4 shadow-sm">
      <div class="flex-1">
        <h2 class="text-lg font-medium text-gray-900">Flow Outputs</h2>
        <p class="mt-1 text-sm text-gray-500">
          Define values that will be output from the flow execution
        </p>
      </div>
      <button
        class="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
        on:click={closeOutputEditor}
        aria-label="Close"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>

    <!-- Tabs -->
    <div class="border-b bg-gray-50 px-6">
      <div class="-mb-px flex overflow-x-auto">
        <button
          class="border-b-2 px-4 py-3 text-sm font-medium transition-colors {!showResults
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
          on:click={() => (showResults = false)}
        >
          <div class="flex items-center">
            <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            Configuration
          </div>
        </button>

        {#if hasExecutionData}
          <button
            class="border-b-2 px-4 py-3 text-sm font-medium transition-colors {showResults
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
            on:click={() => (showResults = true)}
          >
            <div class="flex items-center">
              <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              Results
              {#if executionError}
                <span class="ml-1 inline-flex h-2 w-2 rounded-full bg-red-500"></span>
              {:else if Object.keys(outputResults).length > 0}
                <span class="ml-1 inline-flex h-2 w-2 rounded-full bg-green-500"></span>
              {/if}
            </div>
          </button>
        {/if}
      </div>
    </div>

    <!-- Tab Content -->
    <div class="p-6">
      {#if !showResults}
        <!-- Configuration Tab -->
        <div class="space-y-6">
          <!-- Add/Edit Output Form -->
          <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h4 class="mb-3 text-sm font-medium text-gray-700">
              {editingOutputIndex !== null ? 'Edit Output' : 'Add New Output'}
            </h4>

            <div class="space-y-4">
              <div>
                <label for="outputName" class="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  id="outputName"
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="e.g., user_id, token"
                  bind:value={newOutput.name}
                />
              </div>

              <div>
                <label for="outputDescription" class="block text-sm font-medium text-gray-700">Description (optional)</label>
                <input
                  type="text"
                  id="outputDescription"
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="Describe what this output represents"
                  bind:value={newOutput.description}
                />
              </div>

              <div>
                <label for="outputValue" class="block text-sm font-medium text-gray-700">Value</label>
                <div class="mt-1">
                  <textarea
                    id="outputValue"
                    rows="3"
                    class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Enter a value or template expression"
                    bind:value={newOutput.value}
                  ></textarea>
                </div>
                <div class="mt-2">
                  <label class="flex items-center">
                    <input
                      type="checkbox"
                      class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      bind:checked={newOutput.isTemplate}
                    />
                    <span class="ml-2 text-sm text-gray-600">This is a template expression</span>
                  </label>
                </div>
              </div>

              <div class="flex gap-2">
                {#if editingOutputIndex !== null}
                  <button
                    type="button"
                    class="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    on:click={updateOutput}
                  >
                    Update Output
                  </button>
                  <button
                    type="button"
                    class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    on:click={cancelEdit}
                  >
                    Cancel
                  </button>
                {:else}
                  <button
                    type="button"
                    class="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    on:click={addOutput}
                  >
                    Add Output
                  </button>
                {/if}
              </div>
            </div>
          </div>

          <!-- Template Expression Examples -->
          <div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h4 class="mb-2 text-sm font-medium text-blue-800">Template Expression Examples</h4>
            <div class="space-y-1 text-sm text-blue-700">
              {#each exampleExpressions as example}
                <div class="font-mono">{example}</div>
              {/each}
            </div>
            <p class="mt-2 text-xs text-blue-600">
              Use template expressions to reference response data, transformations, parameters, or functions.
            </p>
          </div>

          <!-- Current Outputs -->
          {#if localOutputs.length > 0}
            <div>
              <h4 class="mb-3 text-sm font-medium text-gray-700">Current Outputs</h4>
              <div class="space-y-3">
                {#each localOutputs as output, index}
                  <div class="rounded-lg border border-gray-200 bg-white p-4">
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <div class="flex items-center gap-2">
                          <h5 class="font-medium text-gray-900">{output.name}</h5>
                          {#if output.isTemplate}
                            <span class="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">Template</span>
                          {:else}
                            <span class="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800">Static</span>
                          {/if}
                        </div>
                        {#if output.description}
                          <p class="mt-1 text-sm text-gray-600">{output.description}</p>
                        {/if}
                        <div class="mt-2 rounded bg-gray-100 p-2 text-sm text-gray-800">
                          <pre class="whitespace-pre-wrap">{output.value}</pre>
                        </div>
                      </div>
                      <div class="ml-4 flex gap-2">
                        <button
                          class="text-blue-600 hover:text-blue-800"
                          on:click={() => editOutput(index)}
                          aria-label="Edit output"
                        >
                          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                          </svg>
                        </button>
                        <button
                          class="text-red-600 hover:text-red-800"
                          on:click={() => removeOutput(index)}
                          aria-label="Remove output"
                        >
                          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {:else}
            <div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center">
              <svg class="mx-auto h-12 w-12 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <p class="mt-2 text-sm text-yellow-800">No outputs defined yet</p>
              <p class="text-xs text-yellow-600">Add outputs above to get started</p>
            </div>
          {/if}
        </div>
      {:else}
        <!-- Results Tab -->
        <div class="space-y-6">
          <div class="flex items-center justify-between">
            <h4 class="text-lg font-medium text-gray-900">Flow Output Results</h4>
          </div>

          {#if executionError}
            <div class="rounded-lg border border-red-200 bg-red-50 p-4">
              <div class="flex items-start">
                <svg class="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
                <div class="ml-3">
                  <h3 class="text-sm font-medium text-red-800">Flow Execution Error</h3>
                  <p class="mt-1 text-sm text-red-700">
                    {typeof executionError === 'string' ? executionError : 'An error occurred during flow execution'}
                  </p>
                </div>
              </div>
            </div>
          {/if}

          {#if Object.keys(outputResults).length > 0}
            <div class="space-y-4">
              {#each Object.entries(outputResults) as [name, value]}
                <div class="rounded-lg border border-gray-200 bg-white p-4">
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <h5 class="font-medium text-gray-900">{name}</h5>
                      <div class="mt-2 flex items-center gap-2">
                        <span class="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800">
                          {getValueType(value)}
                        </span>
                      </div>
                      <div class="mt-3 rounded bg-gray-100 p-3">
                        <pre class="whitespace-pre-wrap text-sm text-gray-800">{formatValue(value)}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {:else if !executionError}
            <div class="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <p class="mt-2 text-sm text-gray-500">No output results available</p>
              <p class="text-xs text-gray-400">Run the flow to see output results</p>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="sticky bottom-0 border-t bg-gray-50 px-6 py-4">
      <div class="flex justify-end gap-3">
        <button
          class="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          on:click={closeOutputEditor}
        >
          Cancel
        </button>
        <button
          class="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          on:click={saveOutputChanges}
        >
          Save Changes
        </button>
      </div>
    </div>
  </div>
</div>
