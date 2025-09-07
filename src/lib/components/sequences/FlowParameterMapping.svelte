<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Sequence, FlowParameterMapping } from '$lib/http_client/sequences';

  export let sequenceFlow: any;
  export let sequence: Sequence;
  export let flowParameters: any[] = [];
  export let flowName: string = '';
  export let onSave: (orderIndex: number, parameters: any, parameterMappings: any) => void;
  export let onCancel: () => void;

  const dispatch = createEventDispatcher();

  // Initialize parameter mappings
  let parameterMappings = { ...sequenceFlow.parameter_mappings };
  
  // State for managing previous flow outputs
  let loadingPreviousFlows = false;
  let previousFlowsData: Array<{ flow: any; orderIndex: number; flowName: string; outputs: any[] }> = [];
  
  // Reactive computation for available options
  $: availableSequenceParameters = Object.keys(sequence.config.parameters);
  $: previousFlowsInSequence = sequence.config.flows.filter(flow => flow.order_index < sequenceFlow.order_index);
  
  // Load previous flows data when component mounts or when previous flows change
  $: if (previousFlowsInSequence.length > 0) {
    loadPreviousFlowsData();
  }

  async function loadPreviousFlowsData() {
    if (loadingPreviousFlows) return;
    
    try {
      loadingPreviousFlows = true;
      
      const flowsWithData = await Promise.all(
        previousFlowsInSequence.map(async (sequenceFlow) => {
          try {
            // Import the flows client dynamically to avoid circular imports
            const flowClient = await import('$lib/http_client/flows');
            const flowResult = await flowClient.getFlow(sequenceFlow.test_flow_id);
            
            if (flowResult?.testFlow) {
              return {
                flow: flowResult.testFlow,
                orderIndex: sequenceFlow.order_index,
                flowName: flowResult.testFlow.name || `Flow ${sequenceFlow.order_index + 1}`,
                outputs: flowResult.testFlow.flowJson?.outputs || []
              };
            }
            return null;
          } catch (error) {
            console.error(`Error loading flow ${sequenceFlow.test_flow_id}:`, error);
            return null;
          }
        })
      );
      
      previousFlowsData = flowsWithData.filter((item): item is { flow: any; orderIndex: number; flowName: string; outputs: any[] } => item !== null);
    } catch (error) {
      console.error('Error loading previous flows data:', error);
      previousFlowsData = [];
    } finally {
      loadingPreviousFlows = false;
    }
  }
  
  function handleSave() {
    onSave(sequenceFlow.order_index, {}, parameterMappings);
  }

  function handleCancel() {
    onCancel();
  }

  function updateParameterMapping(paramName: string, mapping: FlowParameterMapping) {
    parameterMappings = {
      ...parameterMappings,
      [paramName]: mapping
    };
  }

  function removeParameterMapping(paramName: string) {
    const { [paramName]: removed, ...rest } = parameterMappings;
    parameterMappings = rest;
  }
</script>

<div class="fixed inset-0 z-50 overflow-y-auto">
  <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
    <div 
      class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
      on:click={handleCancel}
      on:keydown={(e) => e.key === 'Escape' && handleCancel()}
      role="button"
      tabindex="-1"
    ></div>
    
    <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:p-6 max-h-[90vh] overflow-y-auto">
      <div>
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
          <svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div class="mt-3 text-center sm:mt-5">
          <h3 class="text-base font-semibold leading-6 text-gray-900">Configure Flow Parameters</h3>
          <div class="mt-2">
            <p class="text-sm text-gray-500">
              Map parameters for <strong>{flowName || 'Unknown Flow'}</strong> to sequence parameters or outputs from previous flows.
            </p>
          </div>
        </div>
      </div>
      
      <div class="mt-6">
        {#if flowParameters.length === 0}
          <div class="text-center py-8 bg-gray-50 rounded-lg">
            <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
            <h3 class="mt-2 text-sm font-semibold text-gray-900">No parameters</h3>
            <p class="mt-1 text-sm text-gray-500">This flow does not have any configurable parameters.</p>
          </div>
        {:else}
          <div class="space-y-6">
            {#each flowParameters as parameter (parameter.name)}
              <div class="bg-gray-50 rounded-lg p-4">
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <h4 class="text-sm font-medium text-gray-900">
                      {parameter.name}
                      {#if parameter.required}
                        <span class="text-red-500">*</span>
                      {/if}
                    </h4>
                    {#if parameter.description}
                      <p class="mt-1 text-sm text-gray-600">{parameter.description}</p>
                    {/if}
                    <div class="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                      <span class="px-2 py-1 bg-gray-200 rounded">Type: {parameter.type}</span>
                      {#if parameter.defaultValue !== undefined}
                        <span>Default: {JSON.stringify(parameter.defaultValue)}</span>
                      {/if}
                    </div>
                  </div>
                  
                  {#if parameterMappings[parameter.name]}
                    <button
                      type="button"
                      class="ml-4 text-red-600 hover:text-red-800"
                      on:click={() => removeParameterMapping(parameter.name)}
                      aria-label="Remove mapping"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  {/if}
                </div>
                
                <div class="mt-4">
                  {#if parameterMappings[parameter.name]}
                    <!-- Show current mapping -->
                    <div class="p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <div class="flex items-center">
                        <svg class="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        <span class="text-sm font-medium text-blue-900">
                          Mapped to {parameterMappings[parameter.name].source_type === 'sequence_parameter' ? 'sequence parameter' : 'previous flow output'}:
                        </span>
                      </div>
                      <div class="mt-1 text-sm text-blue-800 font-mono">
                        {#if parameterMappings[parameter.name].source_type === 'previous_flow_output'}
                          {(() => {
                            const ref = parameterMappings[parameter.name].source_reference;
                            const parts = ref.split('.');
                            if (parts.length >= 3) {
                              const flowIndex = parseInt(parts[0]);
                              const outputField = parts.slice(2).join('.');
                              const flowData = previousFlowsData.find(f => f.orderIndex === flowIndex);
                              return `Flow ${flowIndex + 1}${flowData ? ` (${flowData.flowName})` : ''} → ${outputField}`;
                            }
                            return ref;
                          })()}
                        {:else}
                          {parameterMappings[parameter.name].source_reference}
                        {/if}
                      </div>
                    </div>
                  {:else}
                    <!-- Show mapping options -->
                    <div class="space-y-3">
                      <!-- Sequence Parameters -->
                      {#if availableSequenceParameters.length > 0}
                        <div>
                          <label for="seq-param-{parameter.name}" class="block text-sm font-medium text-gray-700 mb-2">Map to Sequence Parameter</label>
                          <select
                            id="seq-param-{parameter.name}"
                            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            on:change={(e) => {
                              const target = e.target as HTMLSelectElement;
                              if (target.value) {
                                updateParameterMapping(parameter.name, {
                                  source_type: 'sequence_parameter',
                                  source_reference: target.value
                                });
                              }
                            }}
                          >
                            <option value="">Select a sequence parameter...</option>
                            {#each availableSequenceParameters as seqParam}
                              <option value={seqParam}>{seqParam}</option>
                            {/each}
                          </select>
                        </div>
                      {:else}
                        <div class="text-center py-3 px-4 bg-yellow-50 border border-yellow-200 rounded-md">
                          <p class="text-sm text-yellow-800">
                            No sequence parameters defined yet. Create sequence parameters first to map them here.
                          </p>
                        </div>
                      {/if}
                      
                      <!-- Previous Flow Outputs -->
                      {#if previousFlowsData.length > 0}
                        <div>
                          <label for="flow-output-{parameter.name}" class="block text-sm font-medium text-gray-700 mb-2">Map to Previous Flow Output</label>
                          
                          <!-- Two-step selection: First select flow, then select output field -->
                          <div class="space-y-3">
                            <!-- Step 1: Select Previous Flow -->
                            <div>
                              <label for="prev-flow-{parameter.name}" class="block text-xs font-medium text-gray-600 mb-1">1. Select Previous Flow</label>
                              <select
                                id="prev-flow-{parameter.name}"
                                class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                on:change={(e) => {
                                  const target = e.target as HTMLSelectElement;
                                  const selectedFlowIndex = target.value;
                                  
                                  // Reset any existing mapping for this parameter
                                  if (parameterMappings[parameter.name]) {
                                    removeParameterMapping(parameter.name);
                                  }
                                  
                                  // Hide all output field selectors for this parameter
                                  previousFlowsData.forEach((_, index) => {
                                    const outputFieldDiv = document.getElementById(`output-fields-${parameter.name}-${index}`);
                                    if (outputFieldDiv) {
                                      outputFieldDiv.classList.add('hidden');
                                    }
                                  });
                                  
                                  // Show the selected flow's output field selector
                                  if (selectedFlowIndex !== '') {
                                    const outputFieldDiv = document.getElementById(`output-fields-${parameter.name}-${selectedFlowIndex}`);
                                    if (outputFieldDiv) {
                                      outputFieldDiv.classList.remove('hidden');
                                    }
                                  }
                                }}
                              >
                                <option value="">Select a previous flow...</option>
                                {#each previousFlowsData as flowData, index}
                                  <option value={index}>
                                    Flow {flowData.orderIndex + 1}: {flowData.flowName}
                                    {#if flowData.outputs.length > 0}
                                      ({flowData.outputs.length} output{flowData.outputs.length !== 1 ? 's' : ''})
                                    {:else}
                                      (no outputs defined)
                                    {/if}
                                  </option>
                                {/each}
                              </select>
                            </div>
                            
                            <!-- Step 2: Select Output Field (shown only when a flow is selected) -->
                            {#each previousFlowsData as flowData, index}
                              <div id="output-fields-{parameter.name}-{index}" class="hidden">
                                <label for="output-field-{parameter.name}-{index}" class="block text-xs font-medium text-gray-600 mb-1">2. Select Output Field</label>
                                {#if flowData.outputs.length > 0}
                                  <select
                                    id="output-field-{parameter.name}-{index}"
                                    class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                    on:change={(e) => {
                                      const target = e.target as HTMLSelectElement;
                                      if (target.value) {
                                        updateParameterMapping(parameter.name, {
                                          source_type: 'previous_flow_output',
                                          source_reference: `${flowData.orderIndex}.output.${target.value}`
                                        });
                                      }
                                    }}
                                  >
                                    <option value="">Select an output field...</option>
                                    {#each flowData.outputs as output}
                                      <option value={output.name}>
                                        {output.name}
                                        {#if output.description}
                                          - {output.description}
                                        {/if}
                                      </option>
                                    {/each}
                                  </select>
                                {:else}
                                  <div class="text-sm text-gray-500 py-2 px-3 bg-gray-50 border border-gray-200 rounded-md">
                                    This flow has no output fields defined. Define outputs in the flow to use them here.
                                  </div>
                                {/if}
                              </div>
                            {/each}
                          </div>
                        </div>
                      {:else if loadingPreviousFlows}
                        <div class="text-center py-4">
                          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                          <p class="text-sm text-gray-500 mt-2">Loading previous flow outputs...</p>
                        </div>
                      {:else}
                        <div class="text-center py-3 px-4 bg-gray-50 border border-gray-200 rounded-md">
                          <p class="text-sm text-gray-600">
                            No previous flows in this sequence.
                          </p>
                        </div>
                      {/if}
                      
                      {#if availableSequenceParameters.length === 0 && previousFlowsData.length === 0 && !loadingPreviousFlows}
                        <div class="text-center py-4 text-sm text-gray-500">
                          <p class="mb-2">No sequence parameters or previous flow outputs available for mapping.</p>
                          <p class="text-xs">Create sequence parameters first to map them to flow parameters.</p>
                        </div>
                      {/if}
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
      
      <div class="mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
        <button
          type="button"
          class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
          on:click={handleSave}
        >
          Save Configuration
        </button>
        <button
          type="button"
          class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0"
          on:click={handleCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</div>
