<!-- ParameterMappingPanel.svelte - Sliding panel for flow parameter configuration -->
<script lang="ts">
  import type { TestFlow } from '../../types/test-flow.js';
  import type { Environment } from '$lib/types/environment.js';
  import type { FlowLoopConfig } from '$lib/types/flow_sequence.js';

  interface Props {
    [key: string]: unknown;
    isOpen?: boolean;
    flow?: TestFlow | null;
    sequence?: any; // Using any for now since FlowSequence type doesn't exist
    stepOrder?: number;
    previousFlowOutputs?: FlowOutput[];
    selectedEnvironment?: Environment | null; // Environment with variables
    selectedSubEnvironment?: string | null;
  }

  let {
    isOpen = false,
    flow = null,
    sequence = null,
    stepOrder = 1,
    previousFlowOutputs = [],
    selectedEnvironment = null,
    selectedSubEnvironment = null,
    ...callbackProps
  }: Props & Record<string, unknown> = $props();

  function dispatch(eventName: string, detail?: unknown) {
    const handler = callbackProps['on' + eventName.charAt(0).toUpperCase() + eventName.slice(1)];
    if (typeof handler === 'function') {
      if (arguments.length > 1) {
        handler(detail);
      } else {
        handler();
      }
    }
  }

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
    source_type:
      | 'previous_output'
      | 'static_value'
      | 'environment_variable'
      | 'function'
      | 'loop_value';
    source_value: string; // For previous_output: output field name, for static_value: the actual value, for environment_variable: variable name, for function: function call expression
    data_type?: 'string' | 'number' | 'boolean' | 'array' | 'null'; // Only used for static_value
    source_flow_step?: number; // Only used for previous_output
    source_output_field?: string; // Only used for previous_output
  }

  // Initialize parameter mappings
  let parameterMappings: ParameterMapping[] = $state([]);
  let loopConfig: FlowLoopConfig = $state(createDefaultLoopConfig());

  function createDefaultLoopConfig(): FlowLoopConfig {
    return {
      enabled: false,
      source_type: 'fixed_count',
      count: 1
    };
  }

  function isPrimitiveValue(value: unknown): value is string | number | boolean {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
  }

  function getPrimitiveArrayPreview(value: unknown) {
    if (!Array.isArray(value)) {
      return { valid: false, values: [] as Array<string | number | boolean> };
    }

    if (!value.every(isPrimitiveValue)) {
      return { valid: false, values: [] as Array<string | number | boolean> };
    }

    return { valid: true, values: value as Array<string | number | boolean> };
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
      example:
        typeof param.value === 'string'
          ? param.value
          : typeof param.value === 'number'
            ? param.value.toString()
            : typeof param.value === 'boolean'
              ? param.value.toString()
              : param.defaultValue
                ? String(param.defaultValue)
                : ''
    }));
  }

  function getEnvironmentVariables(
    environment: Environment | null,
    subEnvironmentName: string | null
  ) {
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
    const existingStep = sequence.sequenceConfig?.steps?.find(
      (s: any) => s.step_order === stepOrder
    );
    const existingMappings = existingStep?.parameter_mappings || [];
    loopConfig = existingStep?.loop_config
      ? { ...createDefaultLoopConfig(), ...existingStep.loop_config }
      : createDefaultLoopConfig();

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
        data_type:
          param.type === 'string' ||
          param.type === 'number' ||
          param.type === 'boolean' ||
          param.type === 'array' ||
          param.type === 'null'
            ? param.type
            : 'string'
      };
    });
  }

  function updateParameterMapping(index: number, field: keyof ParameterMapping, value: any) {
    if (!parameterMappings[index]) {
      return;
    }

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
      if (value === 'loop_value') {
        parameterMappings[index].source_value = 'value';
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
      loopConfig: loopConfig.enabled
        ? {
            ...loopConfig,
            count:
              loopConfig.source_type === 'fixed_count' ? Number(loopConfig.count || 1) : undefined
          }
        : { ...loopConfig, enabled: false },
      parameterMappings: parameterMappings.filter(
        (m) =>
          m.source_value ||
          (m.source_type === 'previous_output' && m.source_flow_step && m.source_output_field) ||
          (m.source_type === 'loop_value' && loopConfig.enabled)
      )
    });
  }

  function handleClose() {
    dispatch('close');
  }
  // Extract flow parameters from the actual flow JSON
  let flowParameters = $derived(flow ? getFlowParameters(flow) : []);
  let availableFlowOutputs = $derived(
    previousFlowOutputs.filter((output) => {
      return output.stepOrder < stepOrder;
    })
  );
  // Get environment variables from the selected environment and sub-environment
  let environmentVariables = $derived(
    getEnvironmentVariables(selectedEnvironment, selectedSubEnvironment)
  );
  let environmentArrayVariables = $derived(
    environmentVariables.filter((envVar) => envVar.type === 'array')
  );
  let availableArrayOutputs = $derived(
    availableFlowOutputs
      .map((flowOutput) => ({
        ...flowOutput,
        outputs: flowOutput.outputs.filter((output) => output.type === 'array')
      }))
      .filter((flowOutput) => flowOutput.outputs.length > 0)
  );
  let loopPreview = $derived.by(() => {
    if (!loopConfig.enabled) return null;

    if (loopConfig.source_type === 'fixed_count') {
      const count = Number(loopConfig.count || 0);
      if (!Number.isInteger(count) || count < 1) {
        return { type: 'error', message: 'Loop count must be a positive integer.' };
      }

      return {
        type: 'values',
        message: `${count} iteration${count === 1 ? '' : 's'}`,
        values: Array.from({ length: Math.min(count, 5) }, (_, index) => index),
        total: count
      };
    }

    if (loopConfig.source_type === 'environment_variable_array') {
      const selectedEnvVar = environmentVariables.find(
        (variable) => variable.name === loopConfig.source_value
      );
      if (!selectedEnvVar) {
        return { type: 'warning', message: 'Select an array environment variable.' };
      }

      if (!selectedSubEnvironment || selectedEnvVar.value === null) {
        return { type: 'warning', message: 'Select a sub-environment to preview values.' };
      }

      const preview = getPrimitiveArrayPreview(selectedEnvVar.value);
      if (!preview.valid) {
        return {
          type: 'error',
          message: 'Selected variable must be an array of strings, numbers, or booleans.'
        };
      }

      return {
        type: 'values',
        message: `${preview.values.length} iteration${preview.values.length === 1 ? '' : 's'}`,
        values: preview.values.slice(0, 5),
        total: preview.values.length
      };
    }

    if (loopConfig.source_type === 'previous_output_array') {
      if (!loopConfig.source_flow_step || !loopConfig.source_output_field) {
        return { type: 'warning', message: 'Select a previous array output.' };
      }

      return {
        type: 'warning',
        message: `Runtime loop source: Step ${loopConfig.source_flow_step}.${loopConfig.source_output_field}[]`
      };
    }

    return null;
  });
  let selectedLoopFlow = $derived(
    availableArrayOutputs.find((flowOutput) => flowOutput.stepOrder === loopConfig.source_flow_step)
  );
  let loopPreviewValues = $derived(loopPreview?.type === 'values' ? loopPreview.values || [] : []);
  let loopPreviewTotal = $derived(loopPreview?.type === 'values' ? loopPreview.total || 0 : 0);
  let hasInitializedMappings = $derived(
    flowParameters.length === 0 || parameterMappings.length === flowParameters.length
  );
  $effect(() => {
    if (flow && isOpen) {
      initializeParameterMappings();
    }
  });
</script>

<!-- Backdrop -->
{#if isOpen}
  <div
    class="fixed inset-0 z-40 bg-transparent transition-opacity"
    onclick={handleClose}
    role="button"
    tabindex="0"
    onkeydown={(e) => e.key === 'Escape' && handleClose()}
  ></div>
{/if}

<!-- Sliding Panel -->
<div
  class="fixed top-0 right-0 z-50 h-full w-[800px] transform overflow-y-auto bg-white shadow-xl transition-transform duration-300 ease-in-out"
  class:translate-x-full={!isOpen}
  class:translate-x-0={isOpen}
>
  {#if isOpen && flow}
    <div class="p-6">
      <!-- Header -->
      <div class="mb-6 flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">Configure Parameters</h2>
          <p class="text-sm text-gray-600">{flow.name} (Step {stepOrder})</p>
        </div>
        <button
          type="button"
          onclick={handleClose}
          class="text-gray-400 hover:text-gray-600 focus:outline-none"
          aria-label="Close parameter configuration panel"
        >
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <!-- Loop Configuration -->
      <div class="mb-6 rounded-lg border border-gray-200 p-4">
        <div class="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 class="text-sm font-semibold text-gray-900">Loop</h3>
            <p class="text-xs text-gray-500">
              Run this flow multiple times from a primitive value list.
            </p>
          </div>
          <label
            class="flex items-center gap-2 text-sm font-medium text-gray-700"
            for="loop-enabled"
          >
            <input
              id="loop-enabled"
              type="checkbox"
              class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              bind:checked={loopConfig.enabled}
            />
            Enable loop
          </label>
        </div>

        {#if loopConfig.enabled}
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label for="loop-source" class="mb-2 block text-sm font-medium text-gray-700"
                >Loop Source</label
              >
              <select
                id="loop-source"
                bind:value={loopConfig.source_type}
                onchange={() => {
                  loopConfig = {
                    ...loopConfig,
                    count:
                      loopConfig.source_type === 'fixed_count' ? loopConfig.count || 1 : undefined,
                    source_value: undefined,
                    source_flow_step: undefined,
                    source_output_field: undefined
                  };
                }}
                class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="fixed_count">Fixed Count</option>
                <option value="environment_variable_array">Environment Array</option>
                {#if availableArrayOutputs.length > 0}
                  <option value="previous_output_array">Previous Output Array</option>
                {/if}
              </select>
            </div>

            {#if loopConfig.source_type === 'fixed_count'}
              <div>
                <label for="loop-count" class="mb-2 block text-sm font-medium text-gray-700"
                  >Count</label
                >
                <input
                  id="loop-count"
                  type="number"
                  min="1"
                  step="1"
                  bind:value={loopConfig.count}
                  class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            {:else if loopConfig.source_type === 'environment_variable_array'}
              <div>
                <label for="loop-env-var" class="mb-2 block text-sm font-medium text-gray-700"
                  >Environment Array</label
                >
                <select
                  id="loop-env-var"
                  bind:value={loopConfig.source_value}
                  class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Select variable...</option>
                  {#each environmentArrayVariables as envVar}
                    <option value={envVar.name}>{envVar.name}</option>
                  {/each}
                </select>
              </div>
            {:else if loopConfig.source_type === 'previous_output_array'}
              <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label for="loop-source-flow" class="mb-2 block text-sm font-medium text-gray-700"
                    >Source Flow</label
                  >
                  <select
                    id="loop-source-flow"
                    bind:value={loopConfig.source_flow_step}
                    onchange={(event) => {
                      const target = event.currentTarget;
                      loopConfig = {
                        ...loopConfig,
                        source_flow_step: target.value ? Number(target.value) : undefined,
                        source_output_field: undefined,
                        source_value: undefined
                      };
                    }}
                    class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">Select flow...</option>
                    {#each availableArrayOutputs as flowOutput}
                      <option value={flowOutput.stepOrder}
                        >Step {flowOutput.stepOrder}: {flowOutput.flowName}</option
                      >
                    {/each}
                  </select>
                </div>

                <div>
                  <label
                    for="loop-output-field"
                    class="mb-2 block text-sm font-medium text-gray-700">Array Output</label
                  >
                  <select
                    id="loop-output-field"
                    bind:value={loopConfig.source_output_field}
                    onchange={() => {
                      loopConfig = {
                        ...loopConfig,
                        source_value: loopConfig.source_output_field
                      };
                    }}
                    disabled={!selectedLoopFlow}
                    class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-gray-100"
                  >
                    <option value="">Select output...</option>
                    {#if selectedLoopFlow}
                      {#each selectedLoopFlow.outputs as output}
                        <option value={output.name}>{output.name}</option>
                      {/each}
                    {/if}
                  </select>
                </div>
              </div>
            {/if}
          </div>

          {#if loopPreview}
            <div
              class="mt-3 rounded-md border px-3 py-2 text-xs {loopPreview.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-700'
                : loopPreview.type === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-blue-200 bg-blue-50 text-blue-700'}"
            >
              <div class="font-medium">{loopPreview.message}</div>
              {#if loopPreview.type === 'values'}
                <div class="mt-1 flex flex-wrap gap-1">
                  {#each loopPreviewValues as value, index}
                    <span class="rounded bg-white px-2 py-0.5 font-mono text-gray-700"
                      >[{index}] {String(value)}</span
                    >
                  {/each}
                  {#if loopPreviewTotal > loopPreviewValues.length}
                    <span class="px-2 py-0.5 text-gray-500"
                      >+{loopPreviewTotal - loopPreviewValues.length} more</span
                    >
                  {/if}
                </div>
              {/if}
            </div>
          {/if}
        {/if}
      </div>

      <!-- Parameters List -->
      {#if flowParameters.length > 0 && hasInitializedMappings}
        <div class="space-y-6">
          {#each flowParameters as param, index}
            <div class="rounded-lg border border-gray-200 p-4">
              <!-- Parameter Info -->
              <div class="mb-3">
                <div class="mb-1 flex items-center gap-2">
                  <h3 class="font-medium text-gray-900">{param.name}</h3>
                  {#if param.required}
                    <span class="rounded bg-red-100 px-2 py-1 text-xs text-red-800">Required</span>
                  {/if}
                  <span class="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600"
                    >{param.type}</span
                  >
                  <span class="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">{param.in}</span
                  >
                </div>
                {#if param.description}
                  <p class="text-sm text-gray-600">{param.description}</p>
                {/if}
              </div>

              <!-- Value Configuration - All in one line -->
              <div class="mb-3 flex gap-3">
                <!-- Value Source Selection -->
                <div class="flex-1">
                  <label
                    for="sourceType-{index}"
                    class="mb-2 block text-sm font-medium text-gray-700">Value Source</label
                  >
                  <select
                    id="sourceType-{index}"
                    bind:value={parameterMappings[index].source_type}
                    onchange={(e) => handleSelectChange(e, index, 'source_type')}
                    class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="static_value">Fixed Value</option>
                    <option value="environment_variable">Environment Variable</option>
                    <option value="function">Function Call</option>
                    {#if loopConfig.enabled}
                      <option value="loop_value">Current Loop Value</option>
                    {/if}
                    {#if availableFlowOutputs.length > 0}
                      <option value="previous_output">Previous Flow Output</option>
                    {/if}
                  </select>
                </div>

                <!-- Dynamic fields based on source type -->
                {#if parameterMappings[index].source_type === 'static_value'}
                  <div class="flex-1">
                    <label
                      for="dataType-{index}"
                      class="mb-2 block text-sm font-medium text-gray-700">Data Type</label
                    >
                    <select
                      id="dataType-{index}"
                      bind:value={parameterMappings[index].data_type}
                      onchange={(e) => handleSelectChange(e, index, 'data_type')}
                      class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="string">String</option>
                      <option value="number">Number</option>
                      <option value="boolean">Boolean</option>
                      <option value="array">Array</option>
                      <option value="null">Null</option>
                    </select>
                  </div>
                  <div class="flex-1">
                    <label for="value-{index}" class="mb-2 block text-sm font-medium text-gray-700"
                      >Value</label
                    >
                    {#if parameterMappings[index].data_type === 'boolean'}
                      <select
                        id="value-{index}"
                        bind:value={parameterMappings[index].source_value}
                        onchange={(e) => handleSelectChange(e, index, 'source_value')}
                        class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                        oninput={(e) => handleInputChange(e, index, 'source_value')}
                        placeholder="Enter number..."
                        class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    {:else if parameterMappings[index].data_type === 'array'}
                      <textarea
                        id="value-{index}"
                        bind:value={parameterMappings[index].source_value}
                        oninput={(e) => handleInputChange(e, index, 'source_value')}
                        placeholder="Enter JSON array: [1, 2, 3] or [&quot;item1&quot;, &quot;item2&quot;] or [true, false]"
                        rows="3"
                        class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      ></textarea>
                    {:else if parameterMappings[index].data_type === 'null'}
                      <input
                        id="value-{index}"
                        type="text"
                        bind:value={parameterMappings[index].source_value}
                        placeholder="null"
                        readonly
                        class="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                      />
                    {:else}
                      <input
                        id="value-{index}"
                        type="text"
                        bind:value={parameterMappings[index].source_value}
                        oninput={(e) => handleInputChange(e, index, 'source_value')}
                        placeholder="Enter text..."
                        class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    {/if}
                  </div>
                {:else if parameterMappings[index].source_type === 'environment_variable'}
                  <div class="flex-1">
                    <label for="envVar-{index}" class="mb-2 block text-sm font-medium text-gray-700"
                      >Environment Variable</label
                    >
                    <select
                      id="envVar-{index}"
                      bind:value={parameterMappings[index].source_value}
                      onchange={(e) => handleSelectChange(e, index, 'source_value')}
                      class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="">Select variable...</option>
                      {#each environmentVariables as envVar}
                        <option value={envVar.name}>{envVar.name} ({envVar.type})</option>
                      {/each}
                    </select>
                  </div>
                  <!-- Show preview value if selected and sub-environment is chosen -->
                  {#if parameterMappings[index].source_value && selectedSubEnvironment}
                    {@const selectedEnvVar = environmentVariables.find(
                      (v) => v.name === parameterMappings[index].source_value
                    )}
                    {#if selectedEnvVar && selectedEnvVar.value !== null}
                      <div class="flex-1">
                        <span class="mb-2 block text-sm font-medium text-gray-700"
                          >Preview Value</span
                        >
                        <div
                          class="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600"
                        >
                          {typeof selectedEnvVar.value === 'object'
                            ? JSON.stringify(selectedEnvVar.value)
                            : String(selectedEnvVar.value)}
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
                    <label
                      for="functionCall-{index}"
                      class="mb-2 block text-sm font-medium text-gray-700"
                      >Function Expression</label
                    >
                    <input
                      id="functionCall-{index}"
                      type="text"
                      bind:value={parameterMappings[index].source_value}
                      oninput={(e) => handleInputChange(e, index, 'source_value')}
                      placeholder="e.g., uuid(), dateISO(), randomString(10), dateFormat(1, 'yyyy-MM-dd')"
                      class="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div class="flex-1">
                    <span class="mb-2 block text-sm font-medium text-gray-700"
                      >Available Functions</span
                    >
                    <div
                      class="max-h-20 w-full overflow-y-auto rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600"
                    >
                      <div class="space-y-1">
                        <div>
                          <strong>Date/Time:</strong> isoDate(), dateISO(), timestamp(), dateFormat(),
                          dateAdd(), dateSubtract()
                        </div>
                        <div><strong>IDs:</strong> uuid(), randomString(), randomInt()</div>
                        <div><strong>Encoding:</strong> base64Encode(), urlEncode()</div>
                      </div>
                    </div>
                  </div>
                {:else if parameterMappings[index].source_type === 'loop_value'}
                  <div class="flex-1">
                    <span class="mb-2 block text-sm font-medium text-gray-700">Loop Value</span>
                    <div
                      class="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600"
                    >
                      Current iteration value
                    </div>
                  </div>
                  <div class="flex-1">
                    <span class="mb-2 block text-sm font-medium text-gray-700">Preview</span>
                    <div
                      class="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600"
                    >
                      {#if loopPreviewValues.length > 0}
                        <span class="font-mono">{String(loopPreviewValues[0])}</span>
                      {:else}
                        Resolved at runtime
                      {/if}
                    </div>
                  </div>
                {:else if parameterMappings[index].source_type === 'previous_output'}
                  <div class="flex-1">
                    <label
                      for="sourceFlow-{index}"
                      class="mb-2 block text-sm font-medium text-gray-700">Source Flow</label
                    >
                    <select
                      id="sourceFlow-{index}"
                      bind:value={parameterMappings[index].source_flow_step}
                      onchange={(e) => handleSelectChange(e, index, 'source_flow_step')}
                      class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="">Select flow...</option>
                      {#each availableFlowOutputs as flowOutput}
                        <option value={flowOutput.stepOrder}
                          >Step {flowOutput.stepOrder}: {flowOutput.flowName}</option
                        >
                      {/each}
                    </select>
                  </div>

                  {#if parameterMappings[index].source_flow_step}
                    {@const selectedFlowOutput = availableFlowOutputs.find(
                      (f) => f.stepOrder === parameterMappings[index].source_flow_step
                    )}
                    {#if selectedFlowOutput}
                      <div class="flex-1">
                        <label
                          for="outputField-{index}"
                          class="mb-2 block text-sm font-medium text-gray-700">Output Field</label
                        >
                        <select
                          id="outputField-{index}"
                          bind:value={parameterMappings[index].source_output_field}
                          onchange={(e) => handleSelectChange(e, index, 'source_output_field')}
                          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                  <p class="mb-3 text-xs text-gray-500">
                    Function call: <strong class="font-mono"
                      >{parameterMappings[index].source_value}</strong
                    >
                  </p>
                {:else}
                  <p class="mb-3 text-xs text-amber-600">
                    Select a function or enter a custom function expression
                  </p>
                {/if}
              {:else if parameterMappings[index].source_type === 'environment_variable'}
                {#if environmentVariables.length === 0}
                  <p class="mb-3 text-xs text-gray-500">
                    {#if !selectedEnvironment}
                      No environment selected
                    {:else}
                      No environment variables available in current environment
                    {/if}
                  </p>
                {:else if parameterMappings[index].source_value}
                  {@const selectedEnvVar = environmentVariables.find(
                    (v) => v.name === parameterMappings[index].source_value
                  )}
                  {#if selectedEnvVar}
                    {#if selectedSubEnvironment && selectedEnvVar.value !== null}
                      <p class="mb-3 text-xs text-gray-500">
                        Selected: <strong>{parameterMappings[index].source_value}</strong> =
                        <span class="font-mono"
                          >{typeof selectedEnvVar.value === 'object'
                            ? JSON.stringify(selectedEnvVar.value)
                            : String(selectedEnvVar.value)}</span
                        >
                      </p>
                    {:else}
                      <p class="mb-3 text-xs text-gray-500">
                        Selected: <strong>{parameterMappings[index].source_value}</strong>
                        {#if !selectedSubEnvironment}
                          <span class="text-amber-600"
                            >(select sub-environment to see preview value)</span
                          >
                        {/if}
                      </p>
                    {/if}
                  {/if}
                {:else if !selectedSubEnvironment && environmentVariables.length > 0}
                  <p class="mb-3 text-xs text-amber-600">
                    Select a sub-environment to see preview values for variables
                  </p>
                {/if}
              {:else if parameterMappings[index].source_type === 'previous_output' && parameterMappings[index].source_flow_step && parameterMappings[index].source_output_field}
                <p class="mb-3 text-xs text-gray-500">
                  Selected: <strong>Step {parameterMappings[index].source_flow_step}</strong> →
                  <strong>{parameterMappings[index].source_output_field}</strong>
                </p>
              {:else if parameterMappings[index].source_type === 'loop_value'}
                <p class="mb-3 text-xs text-gray-500">
                  Uses the current primitive value for each loop iteration.
                </p>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <div class="py-8 text-center">
          <svg
            class="mx-auto mb-4 h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 class="mb-2 text-lg font-medium text-gray-900">No Parameters</h3>
          <p class="text-gray-600">This flow doesn't have any configurable parameters.</p>
        </div>
      {/if}

      <!-- Actions -->
      <div class="mt-8 flex justify-end space-x-3 border-t border-gray-200 pt-6">
        <button
          type="button"
          onclick={handleClose}
          class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
        >
          Cancel
        </button>
        <button
          type="button"
          onclick={handleSave}
          class="rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
        >
          Save Parameters
        </button>
      </div>
    </div>
  {/if}
</div>
