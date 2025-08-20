<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Endpoint, StepEndpoint } from './types';
  // Import assertion types from our new assertion module
  import type { AssertionDataSource, AssertionOperator, AssertionType, Assertion } from '$lib/assertions/types';
  import { getAllOperators, isValidOperator } from '$lib/assertions';

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
    expected_value_type?: ExpectedValueType;
    enabled: boolean;
    is_template_expression?: boolean; // Add template expression support
  }> = [];
  
  // Value types for assertion expected values
  type ExpectedValueType = 'string' | 'number' | 'boolean' | 'object' | 'array';

  // New assertion template
  let newAssertion: {
    id: string;
    data_source: AssertionDataSource;
    assertion_type: AssertionType;
    data_id: string;
    operator: AssertionOperator;
    expected_value: unknown;
    expected_value_type?: ExpectedValueType;
    enabled: boolean;
    is_template_expression?: boolean; // Add template expression support
  } = {
    id: crypto.randomUUID(),
    data_source: 'response' as AssertionDataSource,
    assertion_type: 'status_code' as AssertionType,
    data_id: 'status_code',
    operator: 'equals' as AssertionOperator,
    expected_value: 200,
    expected_value_type: 'number',
    enabled: true,
    is_template_expression: false
  };
  
  // Define available operators for each assertion type
  const operatorsByType: Record<AssertionType, AssertionOperator[]> = {
    status_code: [
      'equals', 'not_equals', 'greater_than', 'less_than',
      'greater_than_or_equal', 'less_than_or_equal',
      'between', 'not_between'
    ],
    response_time: [
      'less_than', 'greater_than', 'equals',
      'greater_than_or_equal', 'less_than_or_equal',
      'between', 'not_between'
    ],
    header: [
      'equals', 'not_equals', 'contains', 'exists', 'not_contains',
      'starts_with', 'ends_with', 'matches_regex',
      'is_empty', 'is_not_empty'
    ],
    json_body: [
      // Basic comparison
      'equals', 'not_equals', 'exists', 
      // Numeric
      'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal',
      'between', 'not_between',
      // String
      'contains', 'not_contains', 'starts_with', 'ends_with', 'matches_regex',
      'is_empty', 'is_not_empty',
      // Array
      'has_length', 'length_greater_than', 'length_less_than',
      'contains_all', 'contains_any', 'not_contains_any',
      'one_of', 'not_one_of',
      // Type
      'is_type', 'is_null', 'is_not_null'
    ]
  };
  
  // Get all available operators from our registry
  const allOperators = getAllOperators();
  
  // Helper function to get a human-readable name for an operator
  function getOperatorDisplayName(operator: string): string {
    return operator
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }
  
  // Helper functions to check operator types
  function isRangeOperator(op: string): boolean {
    return op === 'between' || op === 'not_between';
  }
  
  function isArrayOperator(op: string): boolean {
    return ['contains_all', 'contains_any', 'not_contains_any', 'one_of', 'not_one_of'].includes(op);
  }
  
  function isTypeOperator(op: string): boolean {
    return op === 'is_type';
  }
  
  function isNoValueOperator(op: string): boolean {
    return op === 'exists' || op === 'is_null' || op === 'is_not_null' || op === 'is_empty' || op === 'is_not_empty';
  }
  
  // Get operators suitable for a given data type
  function getOperatorsForType(assertionType: AssertionType, valueType?: ExpectedValueType): AssertionOperator[] {
    // If no specific value type or not json_body, return all operators for the assertion type
    if (!valueType || assertionType !== 'json_body') {
      return operatorsByType[assertionType];
    }
    
    // Filter operators based on value type
    switch (valueType) {
      case 'number':
        return [
          'equals', 'not_equals', 'exists',
          'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal',
          'between', 'not_between', 'is_null', 'is_not_null'
        ] as AssertionOperator[];
      
      case 'string':
        return [
          'equals', 'not_equals', 'exists', 'contains', 'not_contains',
          'starts_with', 'ends_with', 'matches_regex', 'is_empty', 'is_not_empty',
          'is_null', 'is_not_null'
        ] as AssertionOperator[];
      
      case 'boolean':
        return [
          'equals', 'not_equals', 'exists', 'is_null', 'is_not_null'
        ] as AssertionOperator[];
      
      case 'array':
        return [
          'exists', 'has_length', 'length_greater_than', 'length_less_than',
          'contains_all', 'contains_any', 'not_contains_any', 'is_empty', 'is_not_empty',
          'is_null', 'is_not_null', 'is_type'
        ] as AssertionOperator[];
      
      case 'object':
        return [
          'exists', 'is_empty', 'is_not_empty', 'is_null', 'is_not_null', 'is_type'
        ] as AssertionOperator[];
      
      default:
        return operatorsByType[assertionType];
    }
  }
  
  // Initialize state when component mounts
  $: if (isMounted && endpoint && stepEndpoint) {
    // Initialize assertions if needed
    if (!stepEndpoint.assertions) {
      stepEndpoint.assertions = [];
    }
    assertions = [...(stepEndpoint.assertions || [])];
    
    // Initialize skipDefaultStatusCheck if not set
    if (stepEndpoint.skipDefaultStatusCheck === undefined) {
      stepEndpoint.skipDefaultStatusCheck = false;
    }
  }
  
  // Get transformations for transformed_data source
  $: hasTransformations = stepEndpoint?.transformations && stepEndpoint.transformations.length > 0;
  $: transformations = stepEndpoint?.transformations || [];
  
  // Save changes from assertion editor
  function saveAssertionChanges() {
    try {
      // Process assertions before saving
      const processedAssertions = assertions.map(a => {
        // Create a copy to avoid mutating the original
        const assertion = { ...a };
        
        // Handle special operators that require array values
        if (isRangeOperator(assertion.operator)) {
          // Make sure between/not_between have an array of two numbers
          if (!Array.isArray(assertion.expected_value) || assertion.expected_value.length !== 2) {
            const value = Number(assertion.expected_value) || 0;
            assertion.expected_value = [value, value + 10];
          } else {
            // Ensure both values are numbers
            assertion.expected_value = [
              Number(assertion.expected_value[0]), 
              Number(assertion.expected_value[1])
            ];
          }
        }
        // Handle other array-based operators
        else if (isArrayOperator(assertion.operator)) {
          if (!Array.isArray(assertion.expected_value)) {
            try {
              if (typeof assertion.expected_value === 'string') {
                assertion.expected_value = JSON.parse(assertion.expected_value);
              } else {
                assertion.expected_value = [assertion.expected_value];
              }
            } catch (e) {
              console.error('Invalid array value in assertion:', e);
              assertion.expected_value = [];
            }
          }
        }
        // Convert string values to their proper types for object/array
        else if (assertion.expected_value_type === 'object' || assertion.expected_value_type === 'array') {
          if (typeof assertion.expected_value === 'string') {
            try {
              assertion.expected_value = JSON.parse(assertion.expected_value as string);
            } catch (e) {
              console.error('Invalid JSON in assertion:', e);
              // Use default empty object/array
              assertion.expected_value = assertion.expected_value_type === 'object' ? {} : [];
            }
          }
        } else if (assertion.expected_value_type === 'number') {
          // Convert number strings to actual numbers
          assertion.expected_value = Number(assertion.expected_value);
        } else if (assertion.expected_value_type === 'boolean') {
          // Convert boolean strings to actual booleans
          assertion.expected_value = assertion.expected_value === 'true' || assertion.expected_value === true;
        }
        
        return assertion;
      });
      
      // Filter out invalid assertions
      const validAssertions = processedAssertions.filter(a => 
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
    // Process the expected value based on operator and type
    const processedAssertion = { ...newAssertion, id: crypto.randomUUID() };
    
    // Handle special operator cases
    if (processedAssertion.operator === 'between' || processedAssertion.operator === 'not_between') {
      // Make sure it's a valid array of two numbers
      if (!Array.isArray(processedAssertion.expected_value) || processedAssertion.expected_value.length !== 2) {
        processedAssertion.expected_value = [0, 10]; // Default range
      } else {
        // Ensure both values are numbers
        processedAssertion.expected_value = [
          Number(processedAssertion.expected_value[0]), 
          Number(processedAssertion.expected_value[1])
        ];
      }
    } else if (['contains_all', 'contains_any', 'not_contains_any', 'one_of', 'not_one_of'].includes(processedAssertion.operator)) {
      // Make sure it's a valid array
      if (!Array.isArray(processedAssertion.expected_value)) {
        try {
          if (typeof processedAssertion.expected_value === 'string') {
            processedAssertion.expected_value = JSON.parse(processedAssertion.expected_value);
          } else {
            processedAssertion.expected_value = [processedAssertion.expected_value];
          }
        } catch (e) {
          console.error('Invalid JSON array in assertion:', e);
          processedAssertion.expected_value = []; // Default empty array
        }
      }
    } else if (processedAssertion.operator === 'is_type') {
      // Make sure it's a valid type string
      if (!['string', 'number', 'boolean', 'array', 'object', 'null'].includes(String(processedAssertion.expected_value))) {
        processedAssertion.expected_value = 'string'; // Default type
      }
    } else if (processedAssertion.expected_value_type === 'object' || processedAssertion.expected_value_type === 'array') {
      // Parse JSON objects and arrays
      if (typeof processedAssertion.expected_value === 'string') {
        try {
          processedAssertion.expected_value = JSON.parse(processedAssertion.expected_value);
        } catch (e) {
          console.error('Invalid JSON in new assertion:', e);
          // Use default empty object/array
          processedAssertion.expected_value = processedAssertion.expected_value_type === 'object' ? {} : [];
        }
      }
    } else if (processedAssertion.expected_value_type === 'number') {
      // Convert to number
      processedAssertion.expected_value = Number(processedAssertion.expected_value);
    } else if (processedAssertion.expected_value_type === 'boolean') {
      // Convert to boolean
      processedAssertion.expected_value = processedAssertion.expected_value === 'true' || processedAssertion.expected_value === true;
    }
    
    // Add the assertion to the list
    assertions = [...assertions, processedAssertion];
    
    // Reset the new assertion form with defaults
    newAssertion = {
      id: crypto.randomUUID(),
      data_source: 'response' as AssertionDataSource,
      assertion_type: 'status_code' as AssertionType,
      data_id: 'status_code',
      operator: 'equals' as AssertionOperator,
      expected_value: 200,
      expected_value_type: 'number',
      enabled: true,
      is_template_expression: false
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
  
  // Helper to determine the appropriate type for expected value based on assertion type
  function getDefaultValueType(assertionType: AssertionType): ExpectedValueType {
    switch (assertionType) {
      case 'status_code':
      case 'response_time':
        return 'number';
      case 'header':
        return 'string';
      case 'json_body':
        return 'string'; // Default to string, but user can change
      default:
        return 'string';
    }
  }
  
  // Convert value from string based on type
  function convertValueByType(value: string, type: ExpectedValueType): unknown {
    switch (type) {
      case 'number':
        return value === '' ? null : Number(value);
      case 'boolean':
        return value.toLowerCase() === 'true';
      case 'object':
      case 'array':
        try {
          return JSON.parse(value);
        } catch (e) {
          console.error('Invalid JSON for expected value:', e);
          return value;
        }
      case 'string':
      default:
        return value;
    }
  }
  
  // Handle expected value type change
  function handleExpectedValueTypeChange(assertion: any, newType: ExpectedValueType) {
    // Store current value
    const currentValue = assertion.expected_value;
    
    // Set the new type
    assertion.expected_value_type = newType;
    
    // Convert the value to a string representation for the input
    if (currentValue !== null && currentValue !== undefined) {
      if (newType === 'object' || newType === 'array') {
        try {
          // If it's not already a string, try to stringify it
          if (typeof currentValue !== 'string') {
            assertion.expected_value = JSON.stringify(currentValue);
          }
          // Validate if current string is valid JSON
          JSON.parse(assertion.expected_value as string);
        } catch (e) {
          // Reset to empty valid JSON if invalid
          assertion.expected_value = newType === 'object' ? '{}' : '[]';
        }
      } else if (newType === 'boolean') {
        assertion.expected_value = Boolean(currentValue).toString();
      } else if (newType === 'number') {
        assertion.expected_value = isNaN(Number(currentValue)) ? 0 : Number(currentValue);
      } else {
        // For string, convert to string representation
        assertion.expected_value = String(currentValue);
      }
    }
    
    // Check if the current operator is compatible with the new type
    const validOperators = getOperatorsForType(assertion.assertion_type, newType);
    
    // If the current operator isn't valid for the new type, select a compatible one
    if (!validOperators.includes(assertion.operator)) {
      assertion.operator = validOperators[0];
      
      // Set appropriate default values based on the new operator
      updateOperator(assertion, assertion.operator);
    }
    
    // Handle special case for range operators when switching to number type
    if (newType === 'number' && (assertion.operator === 'between' || assertion.operator === 'not_between')) {
      // Ensure expected_value is an array with two numbers
      if (!Array.isArray(assertion.expected_value)) {
        const defaultValue = Number(assertion.expected_value) || 0;
        assertion.expected_value = [defaultValue, defaultValue + 10];
      }
    }
    
    handleAssertionChange();
  }
  
  // Update assertion type with appropriate value type
  function updateAssertionType(assertion: any, newType: AssertionType) {
    assertion.assertion_type = newType;
    
    // Reset data_id when assertion type changes
    if (newType === 'status_code') {
      assertion.data_id = 'status_code';
      // Set default operator and value for status code
      assertion.operator = 'equals';
      assertion.expected_value = 200;
    } else if (newType === 'response_time') {
      assertion.data_id = 'response_time';
      // Set default operator and value for response time
      assertion.operator = 'less_than';
      assertion.expected_value = 1000; // 1 second
    } else if (newType === 'header') {
      assertion.data_id = '';
      // Set default operator for header
      assertion.operator = 'exists';
      assertion.expected_value = '';
    } else if (newType === 'json_body') {
      assertion.data_id = '';
      // Set default operator for json body
      assertion.operator = 'exists';
      assertion.expected_value = '';
    }
    
    // Set first operator from available ones
    assertion.operator = operatorsByType[newType][0];
    
    // Update expected value type based on new assertion type
    const defaultType = getDefaultValueType(newType);
    handleExpectedValueTypeChange(assertion, defaultType);
  }
  
  // Update operator and set appropriate default values
  function updateOperator(assertion: any, newOperator: AssertionOperator) {
    assertion.operator = newOperator;
    
    // Set appropriate default values based on the operator
    if (newOperator === 'between' || newOperator === 'not_between') {
      assertion.expected_value = [0, 10]; // Default range
    } else if (['contains_all', 'contains_any', 'not_contains_any', 'one_of', 'not_one_of'].includes(newOperator)) {
      assertion.expected_value = []; // Empty array
    } else if (newOperator === 'is_type') {
      assertion.expected_value = 'string'; // Default type
    } else if (newOperator === 'exists' || newOperator === 'is_null' || newOperator === 'is_not_null') {
      // These operators don't need expected values
      assertion.expected_value = null;
    }
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
      <!-- Default Status Check Settings -->
      <div class="mb-4 rounded-lg border bg-white p-3 shadow-sm">
        <h3 class="mb-2 font-medium flex items-center">
          <svg class="w-4 h-4 mr-1 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
          </svg>
          Default Checks
        </h3>
        
        <div class="flex items-center justify-between">
          <div>
            <label class="flex items-center text-sm">
              <input
                type="checkbox"
                bind:checked={stepEndpoint.skipDefaultStatusCheck}
                class="mr-2 rounded border-gray-300"
                on:change={() => dispatch('change')}
              />
              Skip automatic 2xx status check
            </label>
            <p class="mt-1 text-xs text-gray-500">
              When enabled, non-2xx responses (like 404, 500) won't be treated as failures automatically. 
              Useful for testing error scenarios.
            </p>
          </div>
          
          {#if stepEndpoint.skipDefaultStatusCheck}
            <span class="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
              Error Testing Mode
            </span>
          {:else}
            <span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
              Success Testing Mode
            </span>
          {/if}
        </div>
      </div>

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
                      class="mr-2 rounded border-gray-300"
                      on:change={handleAssertionChange}
                    />
                    <span class="font-medium">#{i + 1}</span>
                    <span class="ml-2 text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded">
                      {assertion.assertion_type}
                    </span>
                    {#if assertion.data_source === 'transformed_data'}
                      <span class="ml-1 text-xs bg-purple-100 text-purple-800 px-1 py-0.5 rounded">
                        transformed
                      </span>
                    {/if}
                  </div>
                  <button
                    class="text-red-600 hover:text-red-800"
                    on:click={() => removeAssertion(i)}
                    aria-label="Remove Assertion"
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
                <!-- Show summary of the assertion -->
                <div class="text-xs text-gray-700 mb-2">
                  <span class="font-semibold">{assertion.data_id}</span>
                  <span class="mx-1">{getOperatorDisplayName(assertion.operator)}</span>
                  {#if assertion.is_template_expression}
                    <span class="font-mono bg-yellow-100 px-1 py-0.5 rounded text-amber-800 border border-yellow-200">
                      {assertion.expected_value}
                    </span>
                    <span class="ml-1 text-xs bg-amber-100 text-amber-700 px-1 py-0.5 rounded">template</span>
                  {:else}
                    <span class="font-mono bg-gray-100 px-1 py-0.5 rounded">
                      {#if Array.isArray(assertion.expected_value)}
                        {JSON.stringify(assertion.expected_value)}
                      {:else if typeof assertion.expected_value === 'object' && assertion.expected_value !== null}
                        {JSON.stringify(assertion.expected_value)}
                      {:else}
                        {assertion.expected_value}
                      {/if}
                    </span>
                  {/if}
                </div>                <div class="grid grid-cols-2 gap-x-3 gap-y-2">
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
                        updateAssertionType(assertion, assertion.assertion_type);
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
                      on:change={(e) => {
                        if (e.target && 'value' in e.target) {
                          updateOperator(assertion, e.target.value as AssertionOperator);
                        }
                        handleAssertionChange();
                      }}
                    >
                      {#each getOperatorsForType(assertion.assertion_type, assertion.expected_value_type) as op}
                        <option value={op}>{getOperatorDisplayName(op)}</option>
                      {/each}
                    </select>
                  </div>

                  {#if assertion.operator !== 'exists'}
                    <div>
                      <div class="flex items-center justify-between mb-1">
                        <label for="expected-value-{i}" class="block text-xs font-medium text-gray-500">
                          Expected Value:
                        </label>
                        
                        <!-- Template Expression Toggle -->
                        <div class="flex items-center gap-2">
                          <label class="flex items-center text-xs text-gray-600">
                            <input
                              type="checkbox"
                              bind:checked={assertion.is_template_expression}
                              class="mr-1 rounded border-gray-300"
                              on:change={() => {
                                // Reset expected value when toggling template mode
                                if (assertion.is_template_expression) {
                                  assertion.expected_value = '';
                                } else {
                                  // Set appropriate default based on type
                                  if (assertion.expected_value_type === 'number') {
                                    assertion.expected_value = 0;
                                  } else if (assertion.expected_value_type === 'boolean') {
                                    assertion.expected_value = false;
                                  } else {
                                    assertion.expected_value = '';
                                  }
                                }
                                handleAssertionChange();
                              }}
                            />
                            Use Template
                          </label>
                          
                          {#if assertion.assertion_type === 'json_body' && !assertion.is_template_expression}
                            <div class="flex items-center">
                              <span class="text-xs text-gray-500 mr-1">Type:</span>
                              <select
                                class="text-xs border rounded px-1 py-0 bg-gray-50"
                                value={assertion.expected_value_type || getDefaultValueType(assertion.assertion_type)}
                                on:change={(e) => handleExpectedValueTypeChange(assertion, (e.target as HTMLSelectElement).value as ExpectedValueType)}
                              >
                                <option value="string">String</option>
                                <option value="number">Number</option>
                                <option value="boolean">Boolean</option>
                                <option value="object">Object</option>
                                <option value="array">Array</option>
                              </select>
                            </div>
                          {/if}
                        </div>
                      </div>
                      
                      {#if assertion.is_template_expression}
                        <!-- Template Expression Input -->
                        <div>
                          <textarea
                            id="expected-value-{i}"
                            bind:value={assertion.expected_value}
                            class="w-full rounded border px-1.5 py-0.5 text-xs font-mono bg-yellow-50 border-yellow-200"
                            rows="2"
                            placeholder="{`{{res:step1-0.$.data.id}} or {{{res:step1-0.$.user.active}}}`}"
                            on:change={handleAssertionChange}
                          ></textarea>
                        </div>
                      {:else}
                        <!-- Existing fixed value inputs -->
                        {#if isRangeOperator(assertion.operator)}
                        <!-- Special handling for between/not_between which need array of two numbers -->
                        <div class="flex items-center gap-2">
                          {#if true}
                            {@const minValue = Array.isArray(assertion.expected_value) && assertion.expected_value.length > 0 
                              ? assertion.expected_value[0] : 0}
                            {@const maxValue = Array.isArray(assertion.expected_value) && assertion.expected_value.length > 1 
                              ? assertion.expected_value[1] : 10}
                          
                          <input
                            type="number"
                            placeholder="Min"
                            class="w-1/2 rounded border px-1.5 py-0.5 text-xs"
                            value={minValue}
                            on:change={(e) => {
                              // Convert to a number and handle NaN
                              const min = Number(e.currentTarget.value);
                              const max = Array.isArray(assertion.expected_value) && assertion.expected_value.length > 1 
                                ? Number(assertion.expected_value[1])
                                : min + 10;
                                
                              // Always ensure expected_value is an array with two numbers
                              assertion.expected_value = [min, max];
                              handleAssertionChange();
                            }}
                          />
                          <span class="text-xs text-gray-500">to</span>
                          <input
                            type="number"
                            placeholder="Max"
                            class="w-1/2 rounded border px-1.5 py-0.5 text-xs"
                            value={maxValue}
                            on:change={(e) => {
                              // Convert to a number and handle NaN
                              const max = Number(e.currentTarget.value);
                              const min = Array.isArray(assertion.expected_value) && assertion.expected_value.length > 0 
                                ? Number(assertion.expected_value[0])
                                : 0;
                                
                              // Always ensure expected_value is an array with two numbers
                              assertion.expected_value = [min, max];
                              handleAssertionChange();
                              handleAssertionChange();
                            }}
                          />
                          {/if}
                        </div>
                      {:else if isArrayOperator(assertion.operator)}
                        <!-- Array of values -->
                        <textarea
                          id="expected-value-{i}"
                          value={typeof assertion.expected_value === 'string' ? assertion.expected_value : JSON.stringify(assertion.expected_value)}
                          class="w-full rounded border px-1.5 py-0.5 text-xs font-mono"
                          rows="3"
                          placeholder='[1, 2, 3] or ["a", "b", "c"]'
                          on:change={(e) => {
                            try {
                              assertion.expected_value = JSON.parse(e.currentTarget.value);
                            } catch (err) {
                              // If not valid JSON, keep as string
                              assertion.expected_value = e.currentTarget.value;
                            }
                            handleAssertionChange();
                          }}
                        ></textarea>
                        <p class="mt-0.5 text-2xs text-gray-500">Enter valid JSON array</p>
                      {:else if isTypeOperator(assertion.operator)}
                        <!-- Type selection -->
                        <select 
                          id="expected-value-{i}" 
                          bind:value={assertion.expected_value} 
                          class="w-full rounded border px-1.5 py-0.5 text-xs"
                          on:change={handleAssertionChange}
                        >
                          <option value="string">String</option>
                          <option value="number">Number</option>
                          <option value="boolean">Boolean</option>
                          <option value="array">Array</option>
                          <option value="object">Object</option>
                          <option value="null">Null</option>
                        </select>
                      {:else if assertion.expected_value_type === 'boolean' || getDefaultValueType(assertion.assertion_type) === 'boolean'}
                        <select 
                          id="expected-value-{i}" 
                          value={String(assertion.expected_value)}
                          class="w-full rounded border px-1.5 py-0.5 text-xs"
                          on:change={(e) => {
                            assertion.expected_value = e.currentTarget.value === 'true';
                            handleAssertionChange();
                          }}
                        >
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      {:else if assertion.expected_value_type === 'object' || assertion.expected_value_type === 'array' || 
                               getDefaultValueType(assertion.assertion_type) === 'object' || getDefaultValueType(assertion.assertion_type) === 'array'}
                        <textarea
                          id="expected-value-{i}"
                          bind:value={assertion.expected_value}
                          class="w-full rounded border px-1.5 py-0.5 text-xs font-mono"
                          rows="3"
                          placeholder={assertion.expected_value_type === 'object' ? '{"key": "value"}' : '[1,2,3]'}
                          on:change={handleAssertionChange}
                        ></textarea>
                        <p class="mt-0.5 text-2xs text-gray-500">Enter valid JSON</p>
                      {:else}
                        <input
                          id="expected-value-{i}"
                          type={(assertion.expected_value_type || getDefaultValueType(assertion.assertion_type)) === 'number' ? 'number' : 'text'}
                          bind:value={assertion.expected_value}
                          class="w-full rounded border px-1.5 py-0.5 text-xs"
                          on:change={handleAssertionChange}
                        />
                      {/if}
                      {/if}
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
                updateAssertionType(newAssertion, newAssertion.assertion_type);
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
              on:change={(e) => {
                if (e.target && 'value' in e.target) {
                  updateOperator(newAssertion, e.target.value as AssertionOperator);
                }
              }}
            >
              {#each getOperatorsForType(newAssertion.assertion_type, newAssertion.expected_value_type) as op}
                <option value={op}>{getOperatorDisplayName(op)}</option>
              {/each}
            </select>
          </div>

          {#if newAssertion.operator !== 'exists'}
            <div>
              <div class="flex items-center justify-between mb-1">
                <label for="new-expected-value" class="block text-xs font-medium text-gray-500">
                  Expected Value:
                </label>
                
                <!-- Template Expression Toggle -->
                <div class="flex items-center gap-2">
                  <label class="flex items-center text-xs text-gray-600">
                    <input
                      type="checkbox"
                      bind:checked={newAssertion.is_template_expression}
                      class="mr-1 rounded border-gray-300"
                      on:change={() => {
                        // Reset expected value when toggling template mode
                        if (newAssertion.is_template_expression) {
                          newAssertion.expected_value = '';
                        } else {
                          // Set appropriate default based on type
                          if (newAssertion.expected_value_type === 'number') {
                            newAssertion.expected_value = 0;
                          } else if (newAssertion.expected_value_type === 'boolean') {
                            newAssertion.expected_value = false;
                          } else {
                            newAssertion.expected_value = '';
                          }
                        }
                      }}
                    />
                    Use Template
                  </label>
                  
                  {#if newAssertion.assertion_type === 'json_body' && !newAssertion.is_template_expression}
                    <div class="flex items-center">
                      <span class="text-xs text-gray-500 mr-1">Type:</span>
                      <select
                        class="text-xs border rounded px-1 py-0 bg-gray-50"
                        bind:value={newAssertion.expected_value_type}
                        on:change={(e) => {
                          if (e.target && 'value' in e.target) {
                            const newType = e.target.value as ExpectedValueType;
                            
                            // Reset the expected value based on the new type
                            if (newType === 'number') {
                              newAssertion.expected_value = 0;
                            } else if (newType === 'boolean') {
                              newAssertion.expected_value = true;
                            } else if (newType === 'object') {
                              newAssertion.expected_value = '{}';
                            } else if (newType === 'array') {
                              newAssertion.expected_value = '[]';
                            } else {
                              newAssertion.expected_value = '';
                            }
                            
                            // Check if the current operator is compatible with the new type
                            const validOperators = getOperatorsForType(newAssertion.assertion_type, newType);
                            
                            // If the current operator isn't valid for the new type, select a compatible one
                            if (!validOperators.includes(newAssertion.operator)) {
                              newAssertion.operator = validOperators[0];
                            }
                          }
                        }}
                      >
                        <option value="string">String</option>
                        <option value="number">Number</option>
                        <option value="boolean">Boolean</option>
                        <option value="object">Object</option>
                        <option value="array">Array</option>
                      </select>
                    </div>
                  {/if}
                </div>
              </div>
              
              {#if newAssertion.is_template_expression}
                <!-- Template Expression Input -->
                <div>
                  <textarea
                    id="new-expected-value"
                    bind:value={newAssertion.expected_value}
                    class="w-full rounded border px-1.5 py-0.5 text-xs font-mono bg-yellow-50 border-yellow-200"
                    rows="2"
                    placeholder="{`{{res:step1-0.$.data.id}} or {{{res:step1-0.$.user.active}}}`}"
                  ></textarea>
                </div>
              {:else}
                <!-- Existing fixed value inputs -->
                {#if isRangeOperator(newAssertion.operator)}
                <!-- Special handling for between/not_between which need array of two numbers -->
                <div class="flex items-center gap-2">
                  {#if true}
                    {@const minValue = Array.isArray(newAssertion.expected_value) && newAssertion.expected_value.length > 0 
                      ? Number(newAssertion.expected_value[0]) : 0}
                    {@const maxValue = Array.isArray(newAssertion.expected_value) && newAssertion.expected_value.length > 1 
                    ? Number(newAssertion.expected_value[1]) : 10}
                    
                  <!-- When the component initializes, make sure it has a proper array value -->
                  {#if !Array.isArray(newAssertion.expected_value)}
                    {@const _ = (newAssertion.expected_value = [0, 10])}
                  {/if}
                    
                  <input
                    type="number"
                    placeholder="Min"
                    class="w-1/2 rounded border px-1.5 py-0.5 text-xs"
                    value={minValue}
                    on:change={(e) => {
                      const min = Number(e.currentTarget.value);
                      const max = Array.isArray(newAssertion.expected_value) && newAssertion.expected_value.length > 1 
                        ? Number(newAssertion.expected_value[1]) : min + 10;
                      // Always ensure expected_value is an array with two numbers
                      newAssertion.expected_value = [min, max];
                    }}
                  />
                  <span class="text-xs text-gray-500">to</span>
                  <input
                    type="number"
                    placeholder="Max"
                    class="w-1/2 rounded border px-1.5 py-0.5 text-xs"
                    value={maxValue}
                    on:change={(e) => {
                      const max = Number(e.currentTarget.value);
                      const min = Array.isArray(newAssertion.expected_value) && newAssertion.expected_value.length > 0 
                        ? Number(newAssertion.expected_value[0]) : 0;
                      // Always ensure expected_value is an array with two numbers
                      newAssertion.expected_value = [min, max];
                    }}
                  />
                  {/if}
                </div>
              {:else if isArrayOperator(newAssertion.operator)}
                <!-- Array of values -->
                <textarea
                  id="new-expected-value"
                  value={typeof newAssertion.expected_value === 'string' 
                    ? newAssertion.expected_value 
                    : JSON.stringify(newAssertion.expected_value)}
                  class="w-full rounded border px-1.5 py-0.5 text-xs font-mono"
                  rows="3"
                  placeholder='[1, 2, 3] or ["a", "b", "c"]'
                  on:change={(e) => {
                    try {
                      newAssertion.expected_value = JSON.parse(e.currentTarget.value);
                    } catch (err) {
                      // If not valid JSON, keep as string
                      newAssertion.expected_value = e.currentTarget.value;
                    }
                  }}
                ></textarea>
                <p class="mt-0.5 text-2xs text-gray-500">Enter valid JSON array</p>
              {:else if isTypeOperator(newAssertion.operator)}
                <!-- Type selection -->
                <select 
                  id="new-expected-value"
                  bind:value={newAssertion.expected_value}
                  class="w-full rounded border px-1.5 py-0.5 text-xs"
                >
                  <option value="string">String</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                  <option value="array">Array</option>
                  <option value="object">Object</option>
                  <option value="null">Null</option>
                </select>
              {:else if newAssertion.expected_value_type === 'boolean'}
                <select 
                  id="new-expected-value"
                  value={String(newAssertion.expected_value)}
                  class="w-full rounded border px-1.5 py-0.5 text-xs"
                  on:change={(e) => {
                    newAssertion.expected_value = e.currentTarget.value === 'true';
                  }}
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              {:else if newAssertion.expected_value_type === 'object' || newAssertion.expected_value_type === 'array'}
                <textarea
                  id="new-expected-value"
                  bind:value={newAssertion.expected_value}
                  class="w-full rounded border px-1.5 py-0.5 text-xs font-mono"
                  rows="3"
                  placeholder={newAssertion.expected_value_type === 'object' ? '{"key": "value"}' : '[1,2,3]'}
                ></textarea>
                <p class="mt-0.5 text-2xs text-gray-500">Enter valid JSON</p>
              {:else}
                <input
                  id="new-expected-value"
                  type={newAssertion.expected_value_type === 'number' ? 'number' : 'text'}
                  bind:value={newAssertion.expected_value}
                  class="w-full rounded border px-1.5 py-0.5 text-xs"
                />
              {/if}
              {/if}
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
