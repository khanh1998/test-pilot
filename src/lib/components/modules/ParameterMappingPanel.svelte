<!-- ParameterMappingPanel.svelte - Sliding panel for flow parameter configuration -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { TestFlow } from '../../types/test-flow.js';
  import type { Environment } from '$lib/types/environment.js';

  export let isOpen: boolean = false;
  export let flow: TestFlow | null = null;
  export let sequence: any = null; // Using any for now since FlowSequence type doesn't exist
  export let stepOrder: number = 1;
  export let previousFlowOutputs: FlowOutput[] = [];
  export let selectedEnvironment: Environment | null = null; // Environment with variables
  export let selectedSubEnvironment: string | null = null;

  const dispatch = createEventDispatcher<{
    close: void;
    save: { 
      stepOrder: number; 
      parameterMappings: ParameterMapping[];
    };
  }>();

  interface FlowOutput {
    flowName: string;
    stepOrder: number;
    outputs: {
      name: string;
      type: 'string' | 'number' | 'boolean' | 'object' | 'unknown' | 'array' | 'null';
      source: 'flow_output' | 'response';
    }[];
  }

  interface ParameterMapping {
    flow_parameter_name: string;
    source_type: 'previous_output' | 'static_value' | 'environment_variable' | 'function';
    source_value: string; // For previous_output: output field name, for static_value: the actual value, for environment_variable: variable name, for function: function call expression
    data_type?: 'string' | 'number' | 'boolean' | 'array' | 'null'; // Only used for static_value
    source_flow_step?: number; // Only used for previous_output
    source_output_field?: string; // Only used for previous_output
  }

  // Extract flow parameters from the actual flow JSON
  $: flowParameters = flow ? getFlowParameters(flow) : [];
  
  // Initialize parameter mappings
  let parameterMappings: ParameterMapping[] = [];
  
  $: availableFlowOutputs = previousFlowOutputs.filter(output => {
    return output.stepOrder < stepOrder;
  });

  // Get environment variables from the selected environment and sub-environment
  $: environmentVariables = getEnvironmentVariables(selectedEnvironment, selectedSubEnvironment);
  
  $: if (flow && isOpen) {
    initializeParameterMappings();
  }

  function getFlowParameters(flow: TestFlow) {
    if (!flow.flowJson?.parameters) {
      return [];
    }

    return flow.flowJson.parameters.map((param: any) => ({
      name: param.name,
      type: param.type,
      description: param.description,
      required: param.required,
      in: 'parameter', // Flow parameters are user-defined parameters
      example: typeof param.value === 'string' ? param.value : 
               typeof param.value === 'number' ? param.value.toString() :
               typeof param.value === 'boolean' ? param.value.toString() :
               param.defaultValue ? String(param.defaultValue) : ''
    }));
  }

  function getEnvironmentVariables(environment: Environment | null, subEnvironmentName: string | null) {
    if (!environment || !environment.config) {
      return [];
    }
    
    // Always get variable list from environment.config.variable_definitions
    const variableDefinitions = environment.config.variable_definitions || {};
    
    // If no sub-environment is selected, return variables without preview values
    if (!subEnvironmentName) {
      return Object.entries(variableDefinitions).map(([name, definition]) => ({
        name,
        value: null, // No preview value when no sub-env selected
        type: definition.type
      }));
    }
    
    // With sub-environment selected, get concrete values for preview
    const subEnv = environment.config.environments?.[subEnvironmentName];
    const subEnvVariables = subEnv?.variables || {};
    
    return Object.entries(variableDefinitions).map(([name, definition]) => ({
      name,
      value: subEnvVariables[name] ?? definition.default_value ?? null, // Preview value from sub-env or default
      type: definition.type
    }));
  }

  function initializeParameterMappings() {
    if (!flow || !sequence) return;
    
    // Get existing mappings from sequence config
    const existingStep = sequence.sequenceConfig?.steps?.find((s: any) => s.step_order === stepOrder);
    const existingMappings = existingStep?.parameter_mappings || [];
    
    // Initialize mappings for all parameters
    parameterMappings = flowParameters.map((param: any) => {
      const existing = existingMappings.find((m: any) => m.flow_parameter_name === param.name);
      
      if (existing) {
        return {
          flow_parameter_name: param.name,
          source_type: existing.source_type || 'static_value',
          source_value: existing.source_value || '',
          data_type: existing.data_type,
          source_flow_step: existing.source_flow_step,
          source_output_field: existing.source_output_field
        };
      }
      
      return {
        flow_parameter_name: param.name,
        source_type: 'static_value',
        source_value: param.example || '',
        data_type: param.type === 'string' || param.type === 'number' || param.type === 'boolean' || param.type === 'array' || param.type === 'null'
          ? param.type 
          : 'string'
      };
    });
  }

  function updateParameterMapping(index: number, field: keyof ParameterMapping, value: any) {
    parameterMappings[index] = { ...parameterMappings[index], [field]: value };
    
    // Clear related fields when source_type changes
    if (field === 'source_type') {
      if (value !== 'previous_output') {
        parameterMappings[index].source_flow_step = undefined;
        parameterMappings[index].source_output_field = undefined;
      }
      if (value !== 'static_value') {
        parameterMappings[index].data_type = undefined;
      }
      if (value !== 'environment_variable') {
        parameterMappings[index].source_value = '';
      }
    }
    
    // Set source_value to "null" when data_type is null
    if (field === 'data_type' && value === 'null') {
      parameterMappings[index].source_value = 'null';
    }
  }

  function handleSelectChange(event: Event, index: number, field: keyof ParameterMapping) {
    const target = event.target as HTMLSelectElement;
    if (target) {
      const value = field === 'source_flow_step' ? parseInt(target.value) : target.value;
      updateParameterMapping(index, field, value);
    }
  }

  function handleInputChange(event: Event, index: number, field: keyof ParameterMapping) {
    const target = event.target as HTMLInputElement;
    if (target) {
      updateParameterMapping(index, field, target.value);
    }
  }

  function handleSave() {
    dispatch('save', {
      stepOrder,
      parameterMappings: parameterMappings.filter(m => 
        m.source_value || 
        (m.source_type === 'previous_output' && m.source_flow_step && m.source_output_field)
      )
    });
  }

  function handleClose() {
    dispatch('close');
  }
</script>

<!-- Backdrop -->
{#if isOpen}
  <div 
    class="fixed inset-0 bg-transparent z-40 transition-opacity"
    on:click={handleClose}
    role="button"
    tabindex="0"
    on:keydown={(e) => e.key === 'Escape' && handleClose()}
  ></div>
{/if}

<!-- Sliding Panel -->
<div 
  class="fixed top-0 right-0 h-full w-[800px] bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto"
  class:translate-x-full={!isOpen}
  class:translate-x-0={isOpen}
>
  {#if isOpen && flow}
    <div class="p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6 border-b border-gray-200 pb-4">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">Configure Parameters</h2>
          <p class="text-sm text-gray-600">{flow.name} (Step {stepOrder})</p>
        </div>
        <button
          type="button"
          on:click={handleClose}
          class="text-gray-400 hover:text-gray-600 focus:outline-none"
          aria-label="Close parameter configuration panel"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Parameters List -->
      {#if flowParameters.length > 0}
        <div class="space-y-6">
          {#each flowParameters as param, index}
            <div class="border border-gray-200 rounded-lg p-4">
              <!-- Parameter Info -->
              <div class="mb-3">
                <div class="flex items-center gap-2 mb-1">
                  <h3 class="font-medium text-gray-900">{param.name}</h3>
                  {#if param.required}
                    <span class="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Required</span>
                  {/if}
                  <span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{param.type}</span>
                  <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">{param.in}</span>
                </div>
                {#if param.description}
                  <p class="text-sm text-gray-600">{param.description}</p>
                {/if}
              </div>

              <!-- Value Configuration - All in one line -->
              <div class="flex gap-3 mb-3">
                <!-- Value Source Selection -->
                <div class="flex-1">
                  <label for="sourceType-{index}" class="block text-sm font-medium text-gray-700 mb-2">Value Source</label>
                  <select
                    id="sourceType-{index}"
                    bind:value={parameterMappings[index].source_type}
                    on:change={(e) => handleSelectChange(e, index, 'source_type')}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="static_value">Fixed Value</option>
                    <option value="environment_variable">Environment Variable</option>
                    <option value="function">Function Call</option>
                    {#if availableFlowOutputs.length > 0}
                      <option value="previous_output">Previous Flow Output</option>
                    {/if}
                  </select>
                </div>

                <!-- Dynamic fields based on source type -->
                {#if parameterMappings[index].source_type === 'static_value'}
                  <div class="flex-1">
                    <label for="dataType-{index}" class="block text-sm font-medium text-gray-700 mb-2">Data Type</label>
                    <select
                      id="dataType-{index}"
                      bind:value={parameterMappings[index].data_type}
                      on:change={(e) => handleSelectChange(e, index, 'data_type')}
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      <option value="string">String</option>
                      <option value="number">Number</option>
                      <option value="boolean">Boolean</option>
                      <option value="array">Array</option>
                      <option value="null">Null</option>
                    </select>
                  </div>
                  <div class="flex-1">
                    <label for="value-{index}" class="block text-sm font-medium text-gray-700 mb-2">Value</label>
                    {#if parameterMappings[index].data_type === 'boolean'}
                      <select
                        id="value-{index}"
                        bind:value={parameterMappings[index].source_value}
                        on:change={(e) => handleSelectChange(e, index, 'source_value')}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      >
                        <option value="">Select...</option>
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    {:else if parameterMappings[index].data_type === 'number'}
                      <input
                        id="value-{index}"
                        type="number"
                        bind:value={parameterMappings[index].source_value}
                        on:input={(e) => handleInputChange(e, index, 'source_value')}
                        placeholder="Enter number..."
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    {:else if parameterMappings[index].data_type === 'array'}
                      <textarea
                        id="value-{index}"
                        bind:value={parameterMappings[index].source_value}
                        on:input={(e) => handleInputChange(e, index, 'source_value')}
                        placeholder='Enter JSON array: [1, 2, 3] or ["item1", "item2"] or [true, false]'
                        rows="3"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      ></textarea>
                    {:else if parameterMappings[index].data_type === 'null'}
                      <input
                        id="value-{index}"
                        type="text"
                        bind:value={parameterMappings[index].source_value}
                        placeholder="null"
                        readonly
                        class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 text-sm"
                      />
                    {:else}
                      <input
                        id="value-{index}"
                        type="text"
                        bind:value={parameterMappings[index].source_value}
                        on:input={(e) => handleInputChange(e, index, 'source_value')}
                        placeholder="Enter text..."
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    {/if}
                  </div>

                {:else if parameterMappings[index].source_type === 'environment_variable'}
                  <div class="flex-1">
                    <label for="envVar-{index}" class="block text-sm font-medium text-gray-700 mb-2">Environment Variable</label>
                    <select
                      id="envVar-{index}"
                      bind:value={parameterMappings[index].source_value}
                      on:change={(e) => handleSelectChange(e, index, 'source_value')}
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      <option value="">Select variable...</option>
                      {#each environmentVariables as envVar}
                        <option value={envVar.name}>{envVar.name} ({envVar.type})</option>
                      {/each}
                    </select>
                  </div>
                  <!-- Show preview value if selected and sub-environment is chosen -->
                  {#if parameterMappings[index].source_value && selectedSubEnvironment}
                    {@const selectedEnvVar = environmentVariables.find(v => v.name === parameterMappings[index].source_value)}
                    {#if selectedEnvVar && selectedEnvVar.value !== null}
                      <div class="flex-1">
                        <span class="block text-sm font-medium text-gray-700 mb-2">Preview Value</span>
                        <div class="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm text-gray-600">
                          {typeof selectedEnvVar.value === 'object' ? JSON.stringify(selectedEnvVar.value) : String(selectedEnvVar.value)}
                        </div>
                      </div>
                    {:else}
                      <div class="flex-1"></div>
                    {/if}
                  {:else}
                    <div class="flex-1"></div>
                  {/if}
                {:else if parameterMappings[index].source_type === 'function'}
                  <div class="flex-1">
                    <label for="functionCall-{index}" class="block text-sm font-medium text-gray-700 mb-2">Function Expression</label>
                    <input
                      id="functionCall-{index}"
                      type="text"
                      bind:value={parameterMappings[index].source_value}
                      on:input={(e) => handleInputChange(e, index, 'source_value')}
                      placeholder="e.g., uuid(), dateISO(), randomString(10), dateFormat(1, 'yyyy-MM-dd')"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
                    />
                  </div>
                  <div class="flex-1">
                    <span class="block text-sm font-medium text-gray-700 mb-2">Available Functions</span>
                    <div class="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-xs text-gray-600 overflow-y-auto max-h-20">
                      <div class="space-y-1">
                        <div><strong>Date/Time:</strong> isoDate(), dateISO(), timestamp(), dateFormat(), dateAdd(), dateSubtract()</div>
                        <div><strong>IDs:</strong> uuid(), randomString(), randomInt()</div>
                        <div><strong>Encoding:</strong> base64Encode(), urlEncode()</div>
                      </div>
                    </div>
                  </div>
                {:else if parameterMappings[index].source_type === 'previous_output'}
                  <div class="flex-1">
                    <label for="sourceFlow-{index}" class="block text-sm font-medium text-gray-700 mb-2">Source Flow</label>
                    <select
                      id="sourceFlow-{index}"
                      bind:value={parameterMappings[index].source_flow_step}
                      on:change={(e) => handleSelectChange(e, index, 'source_flow_step')}
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      <option value="">Select flow...</option>
                      {#each availableFlowOutputs as flowOutput}
                        <option value={flowOutput.stepOrder}>Step {flowOutput.stepOrder}: {flowOutput.flowName}</option>
                      {/each}
                    </select>
                  </div>
                  
                  {#if parameterMappings[index].source_flow_step}
                    {@const selectedFlowOutput = availableFlowOutputs.find(f => f.stepOrder === parameterMappings[index].source_flow_step)}
                    {#if selectedFlowOutput}
                      <div class="flex-1">
                        <label for="outputField-{index}" class="block text-sm font-medium text-gray-700 mb-2">Output Field</label>
                        <select
                          id="outputField-{index}"
                          bind:value={parameterMappings[index].source_output_field}
                          on:change={(e) => handleSelectChange(e, index, 'source_output_field')}
                          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        >
                          <option value="">Select output field...</option>
                          {#each selectedFlowOutput.outputs as output}
                            <option value={output.name}>{output.name} ({output.type})</option>
                          {/each}
                        </select>
                      </div>
                    {:else}
                      <!-- Empty flex item when no flow is selected -->
                      <div class="flex-1"></div>
                    {/if}
                  {:else}
                    <!-- Empty flex item when no flow is selected -->
                    <div class="flex-1"></div>
                  {/if}
                {/if}
              </div>

              <!-- Status/Info Messages -->
              {#if parameterMappings[index].source_type === 'function'}
                {#if parameterMappings[index].source_value}
                  <p class="text-xs text-gray-500 mb-3">
                    Function call: <strong class="font-mono">{parameterMappings[index].source_value}</strong>
                  </p>
                {:else}
                  <p class="text-xs text-amber-600 mb-3">
                    Select a function or enter a custom function expression
                  </p>
                {/if}
              {:else if parameterMappings[index].source_type === 'environment_variable'}
                {#if environmentVariables.length === 0}
                  <p class="text-xs text-gray-500 mb-3">
                    {#if !selectedEnvironment}
                      No environment selected
                    {:else}
                      No environment variables available in current environment
                    {/if}
                  </p>
                {:else if parameterMappings[index].source_value}
                  {@const selectedEnvVar = environmentVariables.find(v => v.name === parameterMappings[index].source_value)}
                  {#if selectedEnvVar}
                    {#if selectedSubEnvironment && selectedEnvVar.value !== null}
                      <p class="text-xs text-gray-500 mb-3">
                        Selected: <strong>{parameterMappings[index].source_value}</strong> = <span class="font-mono">{typeof selectedEnvVar.value === 'object' ? JSON.stringify(selectedEnvVar.value) : String(selectedEnvVar.value)}</span>
                      </p>
                    {:else}
                      <p class="text-xs text-gray-500 mb-3">
                        Selected: <strong>{parameterMappings[index].source_value}</strong> 
                        {#if !selectedSubEnvironment}
                          <span class="text-amber-600">(select sub-environment to see preview value)</span>
                        {/if}
                      </p>
                    {/if}
                  {/if}
                {:else if !selectedSubEnvironment && environmentVariables.length > 0}
                  <p class="text-xs text-amber-600 mb-3">
                    Select a sub-environment to see preview values for variables
                  </p>
                {/if}
              {:else if parameterMappings[index].source_type === 'previous_output' && parameterMappings[index].source_flow_step && parameterMappings[index].source_output_field}
                <p class="text-xs text-gray-500 mb-3">
                  Selected: <strong>Step {parameterMappings[index].source_flow_step}</strong> → <strong>{parameterMappings[index].source_output_field}</strong>
                </p>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <div class="text-center py-8">
          <svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <h3 class="text-lg font-medium text-gray-900 mb-2">No Parameters</h3>
          <p class="text-gray-600">This flow doesn't have any configurable parameters.</p>
        </div>
      {/if}

      <!-- Actions -->
      <div class="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
        <button
          type="button"
          on:click={handleClose}
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="button"
          on:click={handleSave}
          class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Save Parameters
        </button>
      </div>
    </div>
  {/if}
</div>
