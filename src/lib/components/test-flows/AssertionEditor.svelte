<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { AssertionDataSource, AssertionOperator, AssertionType, Endpoint, StepEndpoint } from './types';

  // Sliding panel props
  export let isOpen = false;
  export let isMounted = false;
  export let endpoint: Endpoint;
  export let stepEndpoint: StepEndpoint;
  export let stepIndex: number;
  export let endpointIndex: number;
  export let duplicateCount: number = 1;
  export let instanceIndex: number = 1;

  const dispatch = createEventDispatcher();

  // Assertion editor state
  let assertions: Array<{
    id: string;
    data_source: AssertionDataSource;
    assertion_type: AssertionType;
    data_id: string;
    operator: AssertionOperator;
    expected_value: unknown;
    enabled: boolean;
  }> = [];
  
  // New assertion template
  let newAssertion: {
    id: string;
    data_source: AssertionDataSource;
    assertion_type: AssertionType;
    data_id: string;
    operator: AssertionOperator;
    expected_value: unknown;
    enabled: boolean;
  } = {
    id: crypto.randomUUID(),
    data_source: 'response' as AssertionDataSource,
    assertion_type: 'status_code' as AssertionType,
    data_id: 'status_code',
    operator: 'equals' as AssertionOperator,
    expected_value: 200,
    enabled: true
  };
  
  // Define available operators for each assertion type
  const operatorsByType: Record<AssertionType, AssertionOperator[]> = {
    status_code: ['equals', 'not_equals', 'greater_than', 'less_than'],
    response_time: ['less_than', 'greater_than', 'equals'],
    header: ['equals', 'not_equals', 'contains', 'exists'],
    json_body: ['equals', 'not_equals', 'contains', 'exists', 'greater_than', 'less_than']
  };
  
  // Initialize state when component mounts
  $: if (isMounted && endpoint && stepEndpoint) {
    // Initialize assertions if needed
    if (!stepEndpoint.assertions) {
      stepEndpoint.assertions = [];
    }
    assertions = [...(stepEndpoint.assertions || [])];
  }
  
  // Get transformations for transformed_data source
  $: hasTransformations = stepEndpoint?.transformations && stepEndpoint.transformations.length > 0;
  $: transformations = stepEndpoint?.transformations || [];
  
  // Save changes from assertion editor
  function saveAssertionChanges() {
    try {
      // Filter out invalid assertions
      const validAssertions = assertions.filter(a => 
        (a.assertion_type === 'status_code' || a.assertion_type === 'response_time' || 
         (a.data_id && (a.operator === 'exists' || a.expected_value !== undefined)))
      );
      
      // Save assertions back to step endpoint
      stepEndpoint.assertions = [...validAssertions];
      
      dispatch('change');
      closeAssertionEditor();
    } catch (e: unknown) {
      console.error('Error saving assertion changes:', e);
    }
  }
  
  // Add a new assertion
  function addAssertion() {
    assertions = [...assertions, { ...newAssertion, id: crypto.randomUUID() }];
    newAssertion = {
      id: crypto.randomUUID(),
      data_source: 'response' as AssertionDataSource,
      assertion_type: 'status_code' as AssertionType,
      data_id: 'status_code',
      operator: 'equals' as AssertionOperator,
      expected_value: 200,
      enabled: true
    };
  }
  
  // Remove an assertion
  function removeAssertion(index: number) {
    assertions = assertions.filter((_, i) => i !== index);
  }
  
  // Handle assertion change
  function handleAssertionChange() {
    // Just need to trigger reactivity
  }
  
  function closeAssertionEditor() {
    dispatch('close');
  }
</script>

<div
  class="fixed inset-0 z-40 flex justify-end transition-opacity duration-200 ease-in-out {isOpen
    ? 'opacity-100'
    : 'opacity-0'}"
  on:keydown={(e) => e.key === 'Escape' && closeAssertionEditor()}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
>
  <!-- Transparent clickable overlay for the left side -->
  <div
    class="absolute inset-y-0 right-0 left-0 bg-transparent transition-opacity duration-300 ease-in-out sm:right-[75%] md:right-[600px] lg:right-[500px]"
    on:click={closeAssertionEditor}
    role="presentation"
    aria-hidden="true"
  ></div>

  <!-- Sliding panel -->
  <div
    class="h-full w-full overflow-y-auto bg-white transition-transform duration-300 ease-in-out {isOpen
      ? 'translate-x-0'
      : 'translate-x-full'} max-w-full shadow-2xl sm:max-w-[75%] md:max-w-[600px] lg:max-w-[500px]"
  >
    <!-- Header -->
    <div class="sticky top-0 z-10 flex items-center justify-between border-b bg-white py-2 px-3 shadow-sm">
      <div>
        <h2 class="font-medium text-sm flex items-center">
          <span class="rounded bg-green-100 px-1 py-0.5 mr-1.5 text-xs text-green-800">
            {endpoint.method}
          </span>
          <span class="truncate max-w-[200px] inline-block">{endpoint.path}</span>
          {#if duplicateCount > 1}
            <span class="ml-1 rounded bg-blue-100 px-1 py-0.5 text-xs text-blue-800">#{instanceIndex}</span>
          {/if}
        </h2>
        <p class="text-xs text-gray-500">
          Step {stepIndex + 1}, Endpoint {endpointIndex + 1}
        </p>
      </div>
      
      <div class="flex space-x-1.5">
        <button
          class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700"
          on:click={saveAssertionChanges}
        >
          Save
        </button>
        <button
          class="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-800 hover:bg-gray-300"
          on:click={closeAssertionEditor}
        >
          Cancel
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="p-2 sm:p-3">
      <div class="mb-3">
        <h3 class="mb-2 font-medium flex items-center">
          <svg class="w-4 h-4 mr-1 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
          </svg>
          Current Assertions
        </h3>
        
        {#if assertions.length === 0}
          <p class="mb-3 rounded bg-gray-50 p-2 text-xs text-gray-600">
            No assertions configured. Add assertions to validate response data.
          </p>
        {:else}
          <div class="space-y-2">
            {#each assertions as assertion, i (assertion.id)}
              <div class="rounded-lg border bg-white p-2 shadow-sm text-sm">
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center">
                    <input 
                      type="checkbox" 
                      bind:checked={assertion.enabled} 
                      class="mr-1 h-3 w-3 rounded" 
                      on:change={handleAssertionChange}
                    />
                    <span class="font-medium">#{i + 1}</span>
                    <span class="ml-2 text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded">
                      {assertion.assertion_type.replace('_', ' ')}
                    </span>
                  </div>
                  <button
                    class="text-red-600 hover:text-red-800"
                    on:click={() => removeAssertion(i)}
                    aria-label="Remove Assertion"
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

                <div class="grid grid-cols-2 gap-x-3 gap-y-2">
                  <div>
                    <label for="data-source-{i}" class="block text-xs font-medium text-gray-500">
                      Data Source:
                    </label>
                    <select
                      id="data-source-{i}"
                      bind:value={assertion.data_source}
                      class="w-full rounded border px-1.5 py-0.5 text-xs"
                      on:change={handleAssertionChange}
                    >
                      <option value="response">Response</option>
                      {#if hasTransformations}
                        <option value="transformed_data">Transformed Data</option>
                      {/if}
                    </select>
                  </div>

                  <div>
                    <label for="assertion-type-{i}" class="block text-xs font-medium text-gray-500">
                      Assertion Type:
                    </label>
                    <select
                      id="assertion-type-{i}"
                      bind:value={assertion.assertion_type}
                      class="w-full rounded border px-1.5 py-0.5 text-xs"
                      on:change={() => {
                        // Reset data_id when assertion type changes
                        if (assertion.assertion_type === 'status_code') {
                          assertion.data_id = 'status_code';
                        } else if (assertion.assertion_type === 'response_time') {
                          assertion.data_id = 'response_time';
                        } else if (assertion.assertion_type === 'header') {
                          assertion.data_id = '';
                        } else if (assertion.assertion_type === 'json_body') {
                          assertion.data_id = '';
                        }
                        handleAssertionChange();
                      }}
                    >
                      <option value="status_code">Status Code</option>
                      <option value="response_time">Response Time</option>
                      <option value="header">Header</option>
                      <option value="json_body">JSON Body</option>
                    </select>
                  </div>

                  {#if assertion.assertion_type === 'header' || assertion.assertion_type === 'json_body'}
                    <div class="col-span-2">
                      <label for="data-id-{i}" class="block text-xs font-medium text-gray-500">
                        {assertion.assertion_type === 'header' ? 'Header Name' : 'JSONPath Expression'}:
                      </label>
                      <input
                        id="data-id-{i}"
                        type="text"
                        bind:value={assertion.data_id}
                        class="w-full rounded border px-1.5 py-0.5 text-xs"
                        placeholder={assertion.assertion_type === 'header' ? 'content-type' : '$.data.user.id'}
                        on:change={handleAssertionChange}
                      />
                      {#if assertion.assertion_type === 'json_body'}
                        <p class="mt-0.5 text-xs text-gray-500">JSONPath from {assertion.data_source}</p>
                      {/if}
                    </div>
                  {/if}

                  <div>
                    <label for="operator-{i}" class="block text-xs font-medium text-gray-500">
                      Operator:
                    </label>
                    <select
                      id="operator-{i}"
                      bind:value={assertion.operator}
                      class="w-full rounded border px-1.5 py-0.5 text-xs"
                      on:change={handleAssertionChange}
                    >
                      {#each operatorsByType[assertion.assertion_type] as op}
                        <option value={op}>{op.replace('_', ' ')}</option>
                      {/each}
                    </select>
                  </div>

                  {#if assertion.operator !== 'exists'}
                    <div>
                      <label for="expected-value-{i}" class="block text-xs font-medium text-gray-500">
                        Expected Value:
                      </label>
                      <input
                        id="expected-value-{i}"
                        type={assertion.assertion_type === 'status_code' || assertion.assertion_type === 'response_time' ? 'number' : 'text'}
                        bind:value={assertion.expected_value}
                        class="w-full rounded border px-1.5 py-0.5 text-xs"
                        on:change={handleAssertionChange}
                      />
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Add new assertion section -->
      <div class="mt-4 rounded-lg border bg-white p-3 shadow-sm">
        <h3 class="mb-3 font-medium flex items-center">
          <svg class="w-4 h-4 mr-1 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
          </svg>
          Add New Assertion
        </h3>
        
        <div class="grid grid-cols-2 gap-x-3 gap-y-2">
          <!-- New assertion form fields -->
          <div>
            <label for="new-data-source" class="block text-xs font-medium text-gray-500">
              Data Source:
            </label>
            <select
              id="new-data-source"
              bind:value={newAssertion.data_source}
              class="w-full rounded border px-1.5 py-0.5 text-xs"
            >
              <option value="response">Response</option>
              {#if hasTransformations}
                <option value="transformed_data">Transformed Data</option>
              {/if}
            </select>
          </div>

          <div>
            <label for="new-assertion-type" class="block text-xs font-medium text-gray-500">
              Assertion Type:
            </label>
            <select
              id="new-assertion-type"
              bind:value={newAssertion.assertion_type}
              class="w-full rounded border px-1.5 py-0.5 text-xs"
              on:change={() => {
                // Reset data_id when assertion type changes
                if (newAssertion.assertion_type === 'status_code') {
                  newAssertion.data_id = 'status_code';
                } else if (newAssertion.assertion_type === 'response_time') {
                  newAssertion.data_id = 'response_time';
                } else if (newAssertion.assertion_type === 'header') {
                  newAssertion.data_id = '';
                } else if (newAssertion.assertion_type === 'json_body') {
                  newAssertion.data_id = '';
                }
              }}
            >
              <option value="status_code">Status Code</option>
              <option value="response_time">Response Time</option>
              <option value="header">Header</option>
              <option value="json_body">JSON Body</option>
            </select>
          </div>

          {#if newAssertion.assertion_type === 'header' || newAssertion.assertion_type === 'json_body'}
            <div class="col-span-2">
              <label for="new-data-id" class="block text-xs font-medium text-gray-500">
                {newAssertion.assertion_type === 'header' ? 'Header Name' : 'JSONPath Expression'}:
              </label>
              <input
                id="new-data-id"
                type="text"
                bind:value={newAssertion.data_id}
                class="w-full rounded border px-1.5 py-0.5 text-xs"
                placeholder={newAssertion.assertion_type === 'header' ? 'content-type' : '$.data.user.id'}
              />
              {#if newAssertion.assertion_type === 'json_body'}
                <p class="mt-0.5 text-2xs text-gray-500">JSONPath from {newAssertion.data_source}</p>
              {/if}
            </div>
          {/if}

          <div>
            <label for="new-operator" class="block text-xs font-medium text-gray-500">
              Operator:
            </label>
            <select
              id="new-operator"
              bind:value={newAssertion.operator}
              class="w-full rounded border px-1.5 py-0.5 text-xs"
            >
              {#each operatorsByType[newAssertion.assertion_type] as op}
                <option value={op}>{op.replace('_', ' ')}</option>
              {/each}
            </select>
          </div>

          {#if newAssertion.operator !== 'exists'}
            <div>
              <label for="new-expected-value" class="block text-xs font-medium text-gray-500">
                Expected Value:
              </label>
              <input
                id="new-expected-value"
                type={newAssertion.assertion_type === 'status_code' || newAssertion.assertion_type === 'response_time' ? 'number' : 'text'}
                bind:value={newAssertion.expected_value}
                class="w-full rounded border px-1.5 py-0.5 text-xs"
              />
            </div>
          {/if}
        </div>
        
        <div class="mt-3">
          <button
            class="w-full rounded bg-green-600 py-1 text-sm font-medium text-white hover:bg-green-700"
            on:click={addAssertion}
          >
            Add Assertion
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
