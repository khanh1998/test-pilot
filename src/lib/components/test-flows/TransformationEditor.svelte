<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';
  import type { Endpoint, StepEndpoint } from './types';
  import { transformResponse } from '$lib/transform';
  import type { TemplateContext } from '$lib/template/types';

  export let isOpen = false;
  export let isMounted = false;
  export let endpoint: Endpoint;
  export let stepEndpoint: StepEndpoint;
  export let duplicateCount: number = 1;
  export let instanceIndex: number = 1;
  
  // Add props for displaying transformation results
  export let transformationResults: Record<string, unknown> = {}; // Results from last execution
  export let rawResponse: unknown = null; // Raw response data for preview
  export let hasExecutionData: boolean = false; // Whether we have execution data to show
  export let templateContext: TemplateContext | null = null; // Template context for resolving template expressions

  const dispatch = createEventDispatcher();

  // Transformation editor state
  type Transformation = {
    alias: string;
    expression: string;
  };

  let transformations: Transformation[] = [];
  let editingTransformationIndex: number | null = null;
  let newTransformation: Transformation = { alias: '', expression: '' };
  
  // UI state for showing/hiding results
  let showResults = false;
  
  // Live evaluation state
  let liveResults: Record<string, { result: unknown; error: string | null; type: string }> = {};

  // Initialize state when component mounts
  $: if (isMounted && endpoint && stepEndpoint) {
    // Initialize transformations if needed
    if (!stepEndpoint.transformations) {
      stepEndpoint.transformations = [];
    }
    transformations = [...(stepEndpoint.transformations || [])];
  }

  // Auto-show results if we have execution data
  $: if (hasExecutionData && Object.keys(transformationResults).length > 0) {
    showResults = true;
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
    
    // Immediately evaluate the transformation when editing if we have execution data
    if (hasExecutionData && newTransformation.alias && newTransformation.expression) {
      evaluateExpression(newTransformation.expression, `new-${newTransformation.alias}`);
    }
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

  // Helper function to safely stringify values for display
  function formatValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
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

  // Get the result for a specific transformation
  function getTransformationResult(alias: string): unknown {
    return transformationResults[alias];
  }

  // Check if a transformation has a result
  function hasResult(alias: string): boolean {
    return alias in transformationResults;
  }

  // Live evaluation functions - immediate evaluation, no debouncing
  function evaluateExpression(expression: string, alias: string) {
    if (!hasExecutionData || !rawResponse || !expression.trim()) {
      // Clear any existing result
      if (alias in liveResults) {
        const { [alias]: _, ...rest } = liveResults;
        liveResults = rest;
      }
      return;
    }

    try {
      // Immediate evaluation - no timeout
      // Pass template context if available to support template expressions
      // If templateContext is null, provide a default empty context with empty parameters
      const defaultContext = {
        responses: {},
        transformedData: {},
        parameters: {},
        environment: {},
        functions: {}
      };
      const contextToUse = templateContext || defaultContext;
      
      // Debug logging to understand what parameters are available
      if (expression.includes('{{param:')) {
        console.log('Evaluating expression with parameters:', {
          expression,
          alias,
          hasTemplateContext: !!templateContext,
          availableParameters: Object.keys(contextToUse.parameters),
          parameterValues: contextToUse.parameters
        });
      }
      
      const result = transformResponse(rawResponse, expression.trim(), contextToUse);
      liveResults = {
        ...liveResults,
        [alias]: {
          result,
          error: null,
          type: getValueType(result)
        }
      };
    } catch (error) {
      liveResults = {
        ...liveResults,
        [alias]: {
          result: null,
          error: error instanceof Error ? error.message : String(error),
          type: 'error'
        }
      };
    }
  }

  // Function to handle input changes and trigger live evaluation
  function handleExpressionInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    const currentExpression = target.value;
    
    if (newTransformation.alias) {
      evaluateExpression(currentExpression, `new-${newTransformation.alias}`);
    }
  }

  function handleAliasInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const currentAlias = target.value;
    
    if (newTransformation.expression && currentAlias) {
      evaluateExpression(newTransformation.expression, `new-${currentAlias}`);
    }
  }

  // Reactive evaluation for existing transformations when they change
  $: if (hasExecutionData) {
    transformations.forEach((transformation, index) => {
      if (transformation.expression && transformation.alias) {
        evaluateExpression(transformation.expression, `existing-${index}-${transformation.alias}`);
      }
    });
  }

  // Reactive evaluation for new transformation when execution data becomes available
  $: if (hasExecutionData && newTransformation.alias && newTransformation.expression) {
    evaluateExpression(newTransformation.expression, `new-${newTransformation.alias}`);
  }

  // Get live result for a transformation
  function getLiveResult(alias: string, index?: number): { result: unknown; error: string | null; type: string } | null {
    // Try different key formats
    const keys = [
      `new-${alias}`,        // For new transformations being typed
      `existing-${index}-${alias}`, // For existing transformations
      alias                  // Fallback
    ].filter(Boolean);

    for (const key of keys) {
      if (key in liveResults) {
        return liveResults[key];
      }
    }
    return null;
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
          {#if hasExecutionData}
            <span class="ml-2 rounded bg-green-100 px-2 py-1 text-xs text-green-800">
              Has Results
            </span>
          {/if}
        </h3>
      </div>
      <div class="flex items-center gap-2">
        {#if hasExecutionData}
          <button
            class="rounded px-3 py-1 text-sm transition-colors {showResults
              ? 'bg-gray-600 text-white hover:bg-gray-700'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
            on:click={() => (showResults = !showResults)}
          >
            {showResults ? 'Hide Results' : 'Show Results'}
          </button>
        {/if}
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
            on:input={handleAliasInput}
          />
        </div>
        
        <!-- Expression input -->
        <div class="mb-3">
          <label for="expression" class="mb-1 block text-sm font-medium text-gray-700">
            Expression
          </label>
          <textarea
            id="expression"
            rows="3"
            class="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
            placeholder="e.g., $.data[*].id or $.users | where($.active == true) | map($.name)"
            bind:value={newTransformation.expression}
            on:input={handleExpressionInput}
          ></textarea>
          <p class="mt-1 text-xs text-gray-500">
            Use JSONPath ($.field.path) or functional pipeline syntax (data | filter | transform)
          </p>
          
          <!-- Live preview for new transformation -->
          {#if hasExecutionData && newTransformation.alias && newTransformation.expression}
            {@const liveResult = getLiveResult(newTransformation.alias)}
            {#if liveResult}
              <div class="mt-2 rounded-lg border-2 {liveResult.error ? 'border-red-300 bg-red-50' : 'border-blue-300 bg-blue-50'} p-3">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-semibold {liveResult.error ? 'text-red-800' : 'text-blue-800'} flex items-center">
                    {#if liveResult.error}
                      <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                      </svg>
                      Error
                    {:else}
                      <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                      </svg>
                      Live Preview
                    {/if}
                  </span>
                  {#if !liveResult.error}
                    <span class="text-xs font-medium {liveResult.error ? 'text-red-700 bg-red-200 border-red-300' : 'text-blue-700 bg-blue-200 border-blue-300'} px-2 py-1 rounded-full border">
                      {liveResult.type}
                    </span>
                  {/if}
                </div>
                <div class="rounded-md border {liveResult.error ? 'border-red-200 bg-white' : 'border-blue-200 bg-white'} p-2">
                  <pre class="text-xs {liveResult.error ? 'text-red-800' : 'text-blue-800'} overflow-x-auto max-h-24 font-mono">{liveResult.error || formatValue(liveResult.result)}</pre>
                </div>
              </div>
            {/if}
          {/if}
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
              <div class="rounded border border-gray-200 bg-white p-3 {hasResult(transformation.alias) ? 'border-green-300 bg-green-50' : ''}">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-gray-700">{transformation.alias}</span>
                    {#if hasResult(transformation.alias)}
                      <span class="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
                        ✓ Result Available
                      </span>
                    {/if}
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
                  <span class="font-mono text-xs">{transformation.expression}</span>
                </div>
                
                <!-- Show live preview if available and different from saved results -->
                {#if hasExecutionData && transformation.expression}
                  {@const liveResult = getLiveResult(transformation.alias, i)}
                  {#if liveResult && (!hasResult(transformation.alias) || !showResults)}
                    <div class="mt-2 rounded-lg border-2 {liveResult.error ? 'border-red-300 bg-red-50' : 'border-blue-300 bg-blue-50'} p-3">
                      <div class="flex items-center justify-between mb-2">
                        <span class="text-xs font-semibold {liveResult.error ? 'text-red-800' : 'text-blue-800'} flex items-center">
                          {#if liveResult.error}
                            <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                            </svg>
                            Expression Error
                          {:else}
                            <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                            </svg>
                            Live Preview
                          {/if}
                        </span>
                        {#if !liveResult.error}
                          <span class="text-xs font-medium text-blue-700 bg-blue-200 px-2 py-1 rounded-full border border-blue-300">
                            {liveResult.type}
                          </span>
                        {/if}
                      </div>
                      <div class="rounded-md border {liveResult.error ? 'border-red-200 bg-white' : 'border-blue-200 bg-white'} p-2">
                        <pre class="text-xs {liveResult.error ? 'text-red-800' : 'text-blue-800'} overflow-x-auto max-h-24 font-mono">{liveResult.error || formatValue(liveResult.result)}</pre>
                      </div>
                    </div>
                  {/if}
                {/if}
                
                <!-- Show transformation result inline if available -->
                {#if hasResult(transformation.alias) && showResults}
                  <div class="mt-2 rounded-lg border-2 border-green-300 bg-gradient-to-r from-green-50 to-green-100 p-3 shadow-sm">
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-xs font-semibold text-green-800 flex items-center">
                        <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                        </svg>
                        Result
                      </span>
                      <span class="text-xs font-medium text-green-700 bg-green-200 px-2 py-1 rounded-full border border-green-300">
                        {getValueType(getTransformationResult(transformation.alias))}
                      </span>
                    </div>
                    <div class="rounded-md border border-green-200 bg-white p-2">
                      <pre class="text-xs text-green-800 overflow-x-auto max-h-24 font-mono">{formatValue(getTransformationResult(transformation.alias))}</pre>
                    </div>
                  </div>
                {/if}
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
