<!-- ParameterMappingPanel.svelte - Sliding panel for flow parameter configuration -->
<script lang="ts">
  import type { TestFlow } from '../../types/test-flow.js';
  import type { Environment } from '$lib/types/environment.js';
  import type {
    FlowLoopConfig,
    FlowLoopDefinition,
    FlowLoopSource
  } from '$lib/types/flow_sequence.js';
  import { clonePlain, normalizeFlowLoopConfig } from '$lib/types/flow_sequence.js';

  interface Props {
    [key: string]: unknown;
    isOpen?: boolean;
    flow?: TestFlow | null;
    sequence?: any;
    stepOrder?: number;
    previousFlowOutputs?: FlowOutput[];
    selectedEnvironment?: Environment | null;
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
      if (arguments.length > 1) handler(detail);
      else handler();
    }
  }

  interface FlowOutput {
    flowName: string;
    stepOrder: number;
    outputs: {
      name: string;
      type: 'string' | 'number' | 'boolean' | 'object' | 'unknown' | 'array' | 'null';
      arrayItemType?: 'string' | 'number' | 'boolean' | 'object' | 'unknown';
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
    source_value: string;
    data_type?: 'string' | 'number' | 'boolean' | 'array' | 'null';
    source_flow_step?: number;
    source_output_field?: string;
    loop_id?: string;
    loop_source_id?: string;
  }

  type Primitive = string | number | boolean;

  let parameterMappings: ParameterMapping[] = $state([]);
  let loopConfig: FlowLoopConfig = $state(createDefaultLoopConfig());
  let initializedPanelKey = $state('');

  function createId(prefix: string) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  function createDefaultLoopConfig(): FlowLoopConfig {
    return { enabled: false };
  }

  function createLoop(name: string): FlowLoopDefinition {
    return {
      id: createId('loop'),
      name,
      sources: [createLoopSource('value')],
      children: []
    };
  }

  function createLoopSource(alias: string): FlowLoopSource {
    return {
      id: createId('source'),
      alias,
      source_type: 'fixed_count',
      count: 1
    };
  }

  function cloneLoopConfig() {
    loopConfig = clonePlain(loopConfig);
  }

  function ensureRootLoop() {
    if (!loopConfig.root) {
      loopConfig.root = createLoop('user');
      cloneLoopConfig();
    }
  }

  function toggleLoopEnabled(enabled: boolean) {
    loopConfig.enabled = enabled;
    if (enabled) ensureRootLoop();
    else loopConfig = { enabled: false };
  }

  function addInnerLoop() {
    ensureRootLoop();
    if (!loopConfig.root) return;
    loopConfig.root.children = [createLoop('item')];
    cloneLoopConfig();
  }

  function removeInnerLoop() {
    if (!loopConfig.root) return;
    loopConfig.root.children = [];
    parameterMappings = parameterMappings.map((mapping) =>
      mapping.source_type === 'loop_value' &&
      !flattenLoops(loopConfig.root).some((loop) => loop.id === mapping.loop_id)
        ? { ...mapping, source_type: 'static_value', source_value: '' }
        : mapping
    );
    cloneLoopConfig();
  }

  function addZipSource(loop: FlowLoopDefinition) {
    loop.sources = [...loop.sources, createLoopSource(`value_${loop.sources.length + 1}`)];
    cloneLoopConfig();
  }

  function removeLoopSource(loop: FlowLoopDefinition, sourceId: string) {
    if (loop.sources.length <= 1) return;
    loop.sources = loop.sources.filter((source) => source.id !== sourceId);
    parameterMappings = parameterMappings.map((mapping) =>
      mapping.source_type === 'loop_value' && mapping.loop_source_id === sourceId
        ? { ...mapping, source_type: 'static_value', source_value: '' }
        : mapping
    );
    cloneLoopConfig();
  }

  function handleLoopSourceTypeChange(source: FlowLoopSource) {
    source.count = source.source_type === 'fixed_count' ? source.count || 1 : undefined;
    source.source_value = undefined;
    source.source_flow_step = undefined;
    source.source_output_field = undefined;
    cloneLoopConfig();
  }

  function handleLoopSourceFlowChange(source: FlowLoopSource, value: string) {
    source.source_flow_step = value ? Number(value) : undefined;
    source.source_output_field = undefined;
    source.source_value = undefined;
    cloneLoopConfig();
  }

  function handleLoopOutputChange(source: FlowLoopSource) {
    source.source_value = source.source_output_field;
    cloneLoopConfig();
  }

  function isPrimitiveValue(value: unknown): value is Primitive {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
  }

  function isPrimitiveType(type: unknown): type is 'string' | 'number' | 'boolean' {
    return type === 'string' || type === 'number' || type === 'boolean';
  }

  function isPrimitiveArrayOutput(output: FlowOutput['outputs'][number]) {
    return output.type === 'array' && isPrimitiveType(output.arrayItemType);
  }

  function formatArrayOutputLabel(output: FlowOutput['outputs'][number]) {
    return `${output.name} (${output.arrayItemType || 'unknown'}[])`;
  }

  function getFlowParameters(flow: TestFlow) {
    if (!flow.flowJson?.parameters) return [];

    return flow.flowJson.parameters.map((param: any) => ({
      name: param.name,
      type: param.type,
      description: param.description,
      required: param.required,
      in: 'parameter',
      example:
        typeof param.value === 'string' ||
        typeof param.value === 'number' ||
        typeof param.value === 'boolean'
          ? String(param.value)
          : param.defaultValue
            ? String(param.defaultValue)
            : ''
    }));
  }

  function getEnvironmentVariables(
    environment: Environment | null,
    subEnvironmentName: string | null
  ) {
    if (!environment || !environment.config) return [];

    const variableDefinitions = environment.config.variable_definitions || {};
    const subEnv = subEnvironmentName
      ? environment.config.environments?.[subEnvironmentName]
      : undefined;
    const subEnvVariables = subEnv?.variables || {};

    return Object.entries(variableDefinitions).map(([name, definition]) => ({
      name,
      value: subEnvironmentName
        ? (subEnvVariables[name] ?? definition.default_value ?? null)
        : null,
      type: definition.type
    }));
  }

  function getPrimitiveArrayPreview(value: unknown) {
    if (!Array.isArray(value) || !value.every(isPrimitiveValue)) {
      return { valid: false, values: [] as Primitive[] };
    }

    return { valid: true, values: value as Primitive[] };
  }

  function flattenLoops(root?: FlowLoopDefinition): FlowLoopDefinition[] {
    if (!root) return [];
    return [root, ...(root.children ?? []).flatMap((child) => flattenLoops(child))];
  }

  function getSourceSelectedFlow(source: FlowLoopSource) {
    return availableArrayOutputs.find(
      (flowOutput) => flowOutput.stepOrder === source.source_flow_step
    );
  }

  function getLoopSourcePreview(source: FlowLoopSource) {
    if (source.source_type === 'fixed_count') {
      const count = Number(source.count || 0);
      if (!Number.isInteger(count) || count < 1) return 'Invalid count';
      return `${count} value${count === 1 ? '' : 's'}: ${Array.from({ length: Math.min(count, 3) }, (_, index) => index).join(', ')}`;
    }

    if (source.source_type === 'environment_variable_array') {
      const selected = environmentVariables.find(
        (variable) => variable.name === source.source_value
      );
      if (!selected) return 'Select environment array';
      if (!selectedSubEnvironment || selected.value === null) return 'Preview at runtime';
      const preview = getPrimitiveArrayPreview(selected.value);
      if (!preview.valid) return 'Must be primitive array';
      return `${preview.values.length} value${preview.values.length === 1 ? '' : 's'}: ${preview.values.map(String).join(', ')}`;
    }

    if (!source.source_flow_step || !source.source_output_field)
      return 'Select previous output array';
    return `Runtime: Step ${source.source_flow_step}.${source.source_output_field}[]`;
  }

  function initializeParameterMappings() {
    if (!flow || !sequence) return;

    const existingStep = sequence.sequenceConfig?.steps?.find(
      (s: any) => s.step_order === stepOrder
    );
    const existingMappings = existingStep?.parameter_mappings || [];
    loopConfig = existingStep?.loop_config
      ? normalizeFlowLoopConfig(existingStep.loop_config)
      : createDefaultLoopConfig();
    const normalizedLoops = flattenLoops(loopConfig.root);
    const firstLoop = normalizedLoops[0];
    const firstSource = firstLoop?.sources[0];

    parameterMappings = flowParameters.map((param: any) => {
      const existing = existingMappings.find((m: any) => m.flow_parameter_name === param.name);
      const isLegacyLoopMapping =
        existing?.source_type === 'loop_value' && (!existing.loop_id || !existing.loop_source_id);

      if (existing) {
        return {
          flow_parameter_name: param.name,
          source_type: existing.source_type || 'static_value',
          source_value: isLegacyLoopMapping
            ? firstSource?.alias || existing.source_value || ''
            : existing.source_value || '',
          data_type: existing.data_type,
          source_flow_step: existing.source_flow_step,
          source_output_field: existing.source_output_field,
          loop_id: existing.loop_id || (isLegacyLoopMapping ? firstLoop?.id : undefined),
          loop_source_id:
            existing.loop_source_id || (isLegacyLoopMapping ? firstSource?.id : undefined)
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
    if (!parameterMappings[index]) return;

    parameterMappings[index] = { ...parameterMappings[index], [field]: value };

    if (field === 'source_type') {
      if (value !== 'previous_output') {
        parameterMappings[index].source_flow_step = undefined;
        parameterMappings[index].source_output_field = undefined;
      }
      if (value !== 'static_value') parameterMappings[index].data_type = undefined;
      if (value !== 'environment_variable') parameterMappings[index].source_value = '';
      if (value !== 'loop_value') {
        parameterMappings[index].loop_id = undefined;
        parameterMappings[index].loop_source_id = undefined;
      }
      if (value === 'loop_value') {
        const firstLoop = loopOptions[0];
        const firstSource = firstLoop?.sources[0];
        parameterMappings[index].loop_id = firstLoop?.id;
        parameterMappings[index].loop_source_id = firstSource?.id;
        parameterMappings[index].source_value = firstSource?.alias || '';
      }
    }

    if (field === 'data_type' && value === 'null') {
      parameterMappings[index].source_value = 'null';
    }
  }

  function updateLoopSelection(index: number, loopId: string) {
    const loop = loopOptions.find((item) => item.id === loopId);
    const source = loop?.sources[0];
    parameterMappings[index] = {
      ...parameterMappings[index],
      loop_id: loopId,
      loop_source_id: source?.id,
      source_value: source?.alias || ''
    };
  }

  function updateLoopSourceSelection(index: number, sourceId: string) {
    const loop = loopOptions.find((item) => item.id === parameterMappings[index].loop_id);
    const source = loop?.sources.find((item) => item.id === sourceId);
    parameterMappings[index] = {
      ...parameterMappings[index],
      loop_source_id: sourceId,
      source_value: source?.alias || ''
    };
  }

  function getSelectedMappingLoop(index: number) {
    return loopOptions.find((item) => item.id === parameterMappings[index]?.loop_id);
  }

  function handleSelectChange(event: Event, index: number, field: keyof ParameterMapping) {
    const target = event.target as HTMLSelectElement;
    if (!target) return;

    const value = field === 'source_flow_step' ? parseInt(target.value) : target.value;
    updateParameterMapping(index, field, value);
  }

  function handleInputChange(event: Event, index: number, field: keyof ParameterMapping) {
    const target = event.target as HTMLInputElement;
    if (target) updateParameterMapping(index, field, target.value);
  }

  function handleSave() {
    dispatch('save', {
      stepOrder,
      loopConfig: loopConfig.enabled ? clonePlain(loopConfig) : { enabled: false },
      parameterMappings: parameterMappings.filter(
        (mapping) =>
          mapping.source_value ||
          (mapping.source_type === 'previous_output' &&
            mapping.source_flow_step &&
            mapping.source_output_field) ||
          (mapping.source_type === 'loop_value' &&
            loopConfig.enabled &&
            mapping.loop_id &&
            mapping.loop_source_id)
      )
    });
  }

  function handleClose() {
    dispatch('close');
  }

  let flowParameters = $derived(flow ? getFlowParameters(flow) : []);
  let availableFlowOutputs = $derived(
    previousFlowOutputs.filter((output) => output.stepOrder < stepOrder)
  );
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
        outputs: flowOutput.outputs.filter(isPrimitiveArrayOutput)
      }))
      .filter((flowOutput) => flowOutput.outputs.length > 0)
  );
  let loopOptions = $derived(flattenLoops(loopConfig.root));
  let hasInitializedMappings = $derived(
    flowParameters.length === 0 || parameterMappings.length === flowParameters.length
  );
  let panelInitializationKey = $derived(
    isOpen && flow && sequence ? `${sequence.id}:${flow.id}:${stepOrder}` : ''
  );

  $effect(() => {
    if (panelInitializationKey && panelInitializationKey !== initializedPanelKey) {
      initializedPanelKey = panelInitializationKey;
      initializeParameterMappings();
    }

    if (!panelInitializationKey) {
      initializedPanelKey = '';
    }
  });
</script>

{#if isOpen}
  <div
    class="fixed inset-0 z-40 bg-transparent transition-opacity"
    onclick={handleClose}
    role="button"
    tabindex="0"
    onkeydown={(e) => e.key === 'Escape' && handleClose()}
  ></div>
{/if}

<div
  class="fixed top-0 right-0 z-50 h-full w-[860px] transform overflow-y-auto bg-white shadow-xl transition-transform duration-300 ease-in-out"
  class:translate-x-full={!isOpen}
  class:translate-x-0={isOpen}
>
  {#if isOpen && flow}
    <div class="p-6">
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

      <div class="mb-6 rounded-lg border border-gray-200 p-4">
        <div class="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 class="text-sm font-semibold text-gray-900">Loop</h3>
            <p class="text-xs text-gray-500">
              Run this flow from zipped primitive arrays. Add one nested loop when needed.
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
              checked={loopConfig.enabled}
              onchange={(event) => toggleLoopEnabled(event.currentTarget.checked)}
            />
            Enable loop
          </label>
        </div>

        {#if loopConfig.enabled && loopConfig.root}
          {#each [loopConfig.root] as loop, loopIndex}
            <div class="mb-4 rounded-md border border-gray-200 p-3">
              <div class="mb-3 flex items-end justify-between gap-3">
                <div>
                  <label
                    for="loop-name-{loop.id}"
                    class="mb-1 block text-sm font-medium text-gray-700">Outer Loop Name</label
                  >
                  <input
                    id="loop-name-{loop.id}"
                    type="text"
                    bind:value={loop.name}
                    oninput={cloneLoopConfig}
                    class="w-56 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  class="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  onclick={() => addZipSource(loop)}
                >
                  Add Zip Source
                </button>
              </div>

              {#each loop.sources as source, sourceIndex}
                <div class="mb-3 grid grid-cols-12 gap-3 rounded-md bg-gray-50 p-3">
                  <div class="col-span-2">
                    <label
                      for="source-alias-{source.id}"
                      class="mb-1 block text-xs font-medium text-gray-700"
                      >{sourceIndex === 0 ? 'Primary Alias' : 'Zip Alias'}</label
                    >
                    <input
                      id="source-alias-{source.id}"
                      type="text"
                      bind:value={source.alias}
                      oninput={cloneLoopConfig}
                      class="w-full rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div class="col-span-3">
                    <label
                      for="source-type-{source.id}"
                      class="mb-1 block text-xs font-medium text-gray-700">Source</label
                    >
                    <select
                      id="source-type-{source.id}"
                      bind:value={source.source_type}
                      onchange={() => handleLoopSourceTypeChange(source)}
                      class="w-full rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="fixed_count">Fixed Count</option>
                      <option value="environment_variable_array">Environment Array</option>
                      {#if availableArrayOutputs.length > 0}
                        <option value="previous_output_array">Previous Output Array</option>
                      {/if}
                    </select>
                  </div>
                  <div class="col-span-5">
                    {#if source.source_type === 'fixed_count'}
                      <label
                        for="source-count-{source.id}"
                        class="mb-1 block text-xs font-medium text-gray-700">Count</label
                      >
                      <input
                        id="source-count-{source.id}"
                        type="number"
                        min="1"
                        step="1"
                        bind:value={source.count}
                        oninput={cloneLoopConfig}
                        class="w-full rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    {:else if source.source_type === 'environment_variable_array'}
                      <label
                        for="source-env-{source.id}"
                        class="mb-1 block text-xs font-medium text-gray-700"
                        >Environment Array</label
                      >
                      <select
                        id="source-env-{source.id}"
                        bind:value={source.source_value}
                        onchange={cloneLoopConfig}
                        class="w-full rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="">Select variable...</option>
                        {#each environmentArrayVariables as envVar}
                          <option value={envVar.name}>{envVar.name}</option>
                        {/each}
                      </select>
                    {:else}
                      <div class="grid grid-cols-2 gap-2">
                        <div>
                          <label
                            for="source-flow-{source.id}"
                            class="mb-1 block text-xs font-medium text-gray-700">Flow</label
                          >
                          <select
                            id="source-flow-{source.id}"
                            value={source.source_flow_step ?? ''}
                            onchange={(event) =>
                              handleLoopSourceFlowChange(source, event.currentTarget.value)}
                            class="w-full rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                            for="source-output-{source.id}"
                            class="mb-1 block text-xs font-medium text-gray-700">Output</label
                          >
                          <select
                            id="source-output-{source.id}"
                            bind:value={source.source_output_field}
                            onchange={() => handleLoopOutputChange(source)}
                            disabled={!getSourceSelectedFlow(source)}
                            class="w-full rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-gray-100"
                          >
                            <option value="">Select output...</option>
                            {#if getSourceSelectedFlow(source)}
                              {#each getSourceSelectedFlow(source)?.outputs || [] as output}
                                <option value={output.name}>{formatArrayOutputLabel(output)}</option
                                >
                              {/each}
                            {/if}
                          </select>
                        </div>
                      </div>
                    {/if}
                  </div>
                  <div class="col-span-2 flex items-end justify-end gap-2">
                    {#if sourceIndex > 0}
                      <button
                        type="button"
                        class="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        onclick={() => removeLoopSource(loop, source.id)}
                      >
                        Remove
                      </button>
                    {/if}
                  </div>
                  <div
                    class="col-span-12 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs break-words whitespace-normal text-gray-600"
                  >
                    {getLoopSourcePreview(source)}
                  </div>
                </div>
              {/each}

              {#if loopIndex === 0}
                {#if !loop.children?.length}
                  <button
                    type="button"
                    class="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    onclick={addInnerLoop}
                  >
                    Add Nested Loop
                  </button>
                {/if}
              {/if}
            </div>

            {#if loop.children?.[0]}
              {@const innerLoop = loop.children[0]}
              <div class="mb-4 rounded-md border border-blue-200 p-3">
                <div class="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <label
                      for="loop-name-{innerLoop.id}"
                      class="mb-1 block text-sm font-medium text-gray-700">Inner Loop Name</label
                    >
                    <input
                      id="loop-name-{innerLoop.id}"
                      type="text"
                      bind:value={innerLoop.name}
                      oninput={cloneLoopConfig}
                      class="w-56 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      onclick={() => addZipSource(innerLoop)}
                    >
                      Add Zip Source
                    </button>
                    <button
                      type="button"
                      class="rounded-md border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
                      onclick={removeInnerLoop}
                    >
                      Remove Nested Loop
                    </button>
                  </div>
                </div>

                {#each innerLoop.sources as source, sourceIndex}
                  <div class="mb-3 grid grid-cols-12 gap-3 rounded-md bg-blue-50 p-3">
                    <div class="col-span-2">
                      <label
                        for="source-alias-{source.id}"
                        class="mb-1 block text-xs font-medium text-gray-700"
                        >{sourceIndex === 0 ? 'Primary Alias' : 'Zip Alias'}</label
                      >
                      <input
                        id="source-alias-{source.id}"
                        type="text"
                        bind:value={source.alias}
                        oninput={cloneLoopConfig}
                        class="w-full rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div class="col-span-3">
                      <label
                        for="source-type-{source.id}"
                        class="mb-1 block text-xs font-medium text-gray-700">Source</label
                      >
                      <select
                        id="source-type-{source.id}"
                        bind:value={source.source_type}
                        onchange={() => handleLoopSourceTypeChange(source)}
                        class="w-full rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="fixed_count">Fixed Count</option>
                        <option value="environment_variable_array">Environment Array</option>
                        {#if availableArrayOutputs.length > 0}
                          <option value="previous_output_array">Previous Output Array</option>
                        {/if}
                      </select>
                    </div>
                    <div class="col-span-5">
                      {#if source.source_type === 'fixed_count'}
                        <label
                          for="source-count-{source.id}"
                          class="mb-1 block text-xs font-medium text-gray-700">Count</label
                        >
                        <input
                          id="source-count-{source.id}"
                          type="number"
                          min="1"
                          step="1"
                          bind:value={source.count}
                          oninput={cloneLoopConfig}
                          class="w-full rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      {:else if source.source_type === 'environment_variable_array'}
                        <label
                          for="source-env-{source.id}"
                          class="mb-1 block text-xs font-medium text-gray-700"
                          >Environment Array</label
                        >
                        <select
                          id="source-env-{source.id}"
                          bind:value={source.source_value}
                          onchange={cloneLoopConfig}
                          class="w-full rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                          <option value="">Select variable...</option>
                          {#each environmentArrayVariables as envVar}
                            <option value={envVar.name}>{envVar.name}</option>
                          {/each}
                        </select>
                      {:else}
                        <div class="grid grid-cols-2 gap-2">
                          <div>
                            <label
                              for="source-flow-{source.id}"
                              class="mb-1 block text-xs font-medium text-gray-700">Flow</label
                            >
                            <select
                              id="source-flow-{source.id}"
                              value={source.source_flow_step ?? ''}
                              onchange={(event) =>
                                handleLoopSourceFlowChange(source, event.currentTarget.value)}
                              class="w-full rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                              for="source-output-{source.id}"
                              class="mb-1 block text-xs font-medium text-gray-700">Output</label
                            >
                            <select
                              id="source-output-{source.id}"
                              bind:value={source.source_output_field}
                              onchange={() => handleLoopOutputChange(source)}
                              disabled={!getSourceSelectedFlow(source)}
                              class="w-full rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-gray-100"
                            >
                              <option value="">Select output...</option>
                              {#if getSourceSelectedFlow(source)}
                                {#each getSourceSelectedFlow(source)?.outputs || [] as output}
                                  <option value={output.name}
                                    >{formatArrayOutputLabel(output)}</option
                                  >
                                {/each}
                              {/if}
                            </select>
                          </div>
                        </div>
                      {/if}
                    </div>
                    <div class="col-span-2 flex items-end justify-end gap-2">
                      {#if sourceIndex > 0}
                        <button
                          type="button"
                          class="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                          onclick={() => removeLoopSource(innerLoop, source.id)}
                        >
                          Remove
                        </button>
                      {/if}
                    </div>
                    <div
                      class="col-span-12 rounded-md border border-blue-100 bg-white px-3 py-2 text-xs break-words whitespace-normal text-gray-600"
                    >
                      {getLoopSourcePreview(source)}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          {/each}
        {/if}
      </div>

      {#if flowParameters.length > 0 && hasInitializedMappings}
        <div class="space-y-6">
          {#each flowParameters as param, index}
            <div class="rounded-lg border border-gray-200 p-4">
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

              <div class="mb-3 flex gap-3">
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
                    {#if loopConfig.enabled && loopOptions.length > 0}
                      <option value="loop_value">Current Loop Value</option>
                    {/if}
                    {#if availableFlowOutputs.length > 0}
                      <option value="previous_output">Previous Flow Output</option>
                    {/if}
                  </select>
                </div>

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
                        placeholder="Enter JSON array"
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
                  <div class="flex-1">
                    {#if parameterMappings[index].source_value && selectedSubEnvironment}
                      {@const selectedEnvVar = environmentVariables.find(
                        (v) => v.name === parameterMappings[index].source_value
                      )}
                      {#if selectedEnvVar && selectedEnvVar.value !== null}
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
                      {/if}
                    {/if}
                  </div>
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
                      placeholder="e.g., uuid(), dateISO(), randomString(10)"
                      class="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div class="flex-1"></div>
                {:else if parameterMappings[index].source_type === 'loop_value'}
                  <div class="flex-1">
                    <label
                      for="loop-select-{index}"
                      class="mb-2 block text-sm font-medium text-gray-700">Loop</label
                    >
                    <select
                      id="loop-select-{index}"
                      bind:value={parameterMappings[index].loop_id}
                      onchange={(event) => updateLoopSelection(index, event.currentTarget.value)}
                      class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {#each loopOptions as loop}
                        <option value={loop.id}>{loop.name}</option>
                      {/each}
                    </select>
                  </div>
                  <div class="flex-1">
                    <label
                      for="loop-source-select-{index}"
                      class="mb-2 block text-sm font-medium text-gray-700">Value</label
                    >
                    <select
                      id="loop-source-select-{index}"
                      bind:value={parameterMappings[index].loop_source_id}
                      onchange={(event) =>
                        updateLoopSourceSelection(index, event.currentTarget.value)}
                      class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {#each getSelectedMappingLoop(index)?.sources || [] as source}
                        <option value={source.id}>{source.alias}</option>
                      {/each}
                    </select>
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

                  <div class="flex-1">
                    {#if parameterMappings[index].source_flow_step}
                      {@const selectedFlowOutput = availableFlowOutputs.find(
                        (f) => f.stepOrder === parameterMappings[index].source_flow_step
                      )}
                      {#if selectedFlowOutput}
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
                      {/if}
                    {/if}
                  </div>
                {/if}
              </div>

              {#if parameterMappings[index].source_type === 'loop_value'}
                <p class="mb-3 text-xs text-gray-500">
                  Uses the selected source value from the selected loop for each iteration.
                </p>
              {:else if parameterMappings[index].source_type === 'previous_output' && parameterMappings[index].source_flow_step && parameterMappings[index].source_output_field}
                <p class="mb-3 text-xs text-gray-500">
                  Selected: <strong>Step {parameterMappings[index].source_flow_step}</strong> →
                  <strong>{parameterMappings[index].source_output_field}</strong>
                </p>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <div class="py-8 text-center">
          <h3 class="mb-2 text-lg font-medium text-gray-900">No Parameters</h3>
          <p class="text-gray-600">This flow doesn't have any configurable parameters.</p>
        </div>
      {/if}

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
