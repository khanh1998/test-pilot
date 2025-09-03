<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import type { TestFlowData, FlowParameter, ExecutionState, FlowStep } from './types';
  import FlowParameterEditor from './FlowParameterEditor.svelte';
  import { FlowRunner, type FlowRunnerOptions, type ExecutionPreferences } from '$lib/flow-runner';

  // Props
  export let flowData: TestFlowData = {
    parameters: [],
    outputs: [],
    settings: { 
      api_hosts: {},
      environment: {
        environmentId: null,
        subEnvironment: null
      }
    },
    steps: [],
  };
  export let isRunning: boolean = false;
  export let executionState: ExecutionState = {};

  // Environment context for template resolution
  export let environments: import('$lib/types/environment').Environment[] = [];
  export let selectedEnvironment: import('$lib/types/environment').Environment | null = null;

  // Ensure environments is used (prevent Svelte warning)
  $: void environments;

  // Parameter input modal state
  let showParameterInputModal = false;
  let parametersWithMissingValues: Array<FlowParameter> = [];

  // Parameters management panel
  export let showParametersPanel = false;

  // Control visibility of buttons - set to false when used by TestFlowEditor
  export let showButtons = true;

  // Execution preferences
  export let preferences: ExecutionPreferences = {
    parallelExecution: true,
    stopOnError: true,
    serverCookieHandling: false,
    retryCount: 0,
    timeout: 30000
  };

  // Local state derived from flow runner
  let currentStep = 0;
  let totalSteps = 0;
  let progress = 0;
  let error: unknown = null;
  
  // Export parameterValues so parent components can access current parameter values
  export let parameterValues: Record<string, unknown> = {};

  // Computed environment variables for template resolution
  $: environmentVariables = computeEnvironmentVariables(selectedEnvironment, flowData.settings.environment?.subEnvironment || null);

  function computeEnvironmentVariables(env: import('$lib/types/environment').Environment | null, subEnv: string | null): Record<string, unknown> {
    if (!env || !subEnv || !env.config.environments[subEnv]) {
      return {};
    }

    const envData: Record<string, unknown> = {};
    const subEnvironment = env.config.environments[subEnv];

    Object.entries(env.config.variable_definitions).forEach(([varName, varDef]) => {
      const value = subEnvironment.variables[varName];
      if (value !== undefined) {
        envData[varName] = value;
      } else if (varDef.default_value !== undefined) {
        envData[varName] = varDef.default_value;
      }
    });

    if (subEnvironment.api_hosts) {
      Object.entries(subEnvironment.api_hosts).forEach(([apiId, hostUrl]) => {
        envData[`api_host_${apiId}`] = hostUrl;
      });
    }

    return envData;
  }

  // Flow runner instance
  let flowRunner: FlowRunner;
  let previousEnvironmentVariables: Record<string, unknown> = {};

  // Emitted events will be handled by the parent component
  const dispatch = createEventDispatcher();

  // Add a log entry to the execution logs
  function addLog(level: 'info' | 'debug' | 'error' | 'warning', message: string, details?: string) {
    dispatch('log', { level, message, details });
  }

  // Initialize when component mounts or when flowData or environment changes
  $: if (flowData && flowData.steps) {
    totalSteps = flowData.steps.length;
    initializeFlowRunner();
  }

  // Re-initialize when environment variables change (but not on initial load)
  $: if (flowRunner && environmentVariables) {
    // Only reinitialize if environment variables actually changed
    const envVarsChanged = JSON.stringify(previousEnvironmentVariables) !== JSON.stringify(environmentVariables);
    
    if (envVarsChanged && Object.keys(environmentVariables).length > 0) {
      console.log('Environment variables changed, reinitializing FlowRunner');
      previousEnvironmentVariables = { ...environmentVariables };
      initializeFlowRunner();
    }
  }

  // Ensure endpoints are available
  $: if (!flowData.endpoints) {
    flowData.endpoints = [];
    console.warn('No endpoints provided in flowData. The flow may not execute correctly.');
  }

  // Ensure parameters array exists
  $: if (!flowData.parameters) {
    flowData.parameters = [];
  }

  // Watch executionState for changes and emit update events
  $: if (Object.keys(executionState).length > 0) {
    if (isRunning) {
      dispatch('executionStateUpdate', executionState);
    }
  }

  // Make progress and current step available in the executionState for external components
  $: executionState.progress = progress;
  $: executionState.currentStep = currentStep;

  function initializeFlowRunner() {
    const options: FlowRunnerOptions = {
      flowData,
      preferences,
      environments,
      selectedEnvironment,
      environmentVariables,
      onLog: addLog,
      onExecutionStateUpdate: (state) => {
        executionState = state;
        currentStep = state.currentStep || 0;
        progress = state.progress || 0;
        dispatch('executionStateUpdate', state);
      },
      onEndpointStateUpdate: (data) => {
        dispatch('endpointStateUpdate', data);
      },
      onStepExecutionComplete: (data) => {
        dispatch('stepExecutionComplete', data);
      },
      onExecutionStart: () => {
        dispatch('executionStart');
      },
      onExecutionComplete: (data) => {
        isRunning = false;
        error = data.error;
        parameterValues = data.parameterValues;
        dispatch('executionComplete', data);
      }
    };

    flowRunner = new FlowRunner(options);
    
    // Store current environment variables for comparison
    previousEnvironmentVariables = { ...environmentVariables };
  }

  // Global event handlers
  function handleRunFlowEvent() {
    console.log('Received runFlow event, starting flow execution');
    runFlow();
  }

  function handleStopFlowEvent() {
    console.log('Received stopFlow event, stopping execution');
    stopExecution();
  }

  onMount(() => {
    window.addEventListener('runFlow', handleRunFlowEvent);
    window.addEventListener('stopFlow', handleStopFlowEvent);
  });

  onDestroy(() => {
    window.removeEventListener('runFlow', handleRunFlowEvent);
    window.removeEventListener('stopFlow', handleStopFlowEvent);
  });

  // Public methods
  export async function executeSingleStep(step: FlowStep, stepIndex?: number) {
    if (!flowRunner) {
      console.error('Flow runner not initialized');
      return;
    }

    isRunning = true;
    const result = await flowRunner.executeSingleStep(step, stepIndex);
    isRunning = flowRunner.isRunning;
    
    return result;
  }

  export function stopExecution() {
    if (flowRunner) {
      flowRunner.stopExecution();
    }
  }

  export async function runFlow() {
    if (!flowRunner) {
      console.error('Flow runner not initialized');
      return;
    }

    isRunning = true;
    const result = await flowRunner.runFlow();
    
    if (result.parametersWithMissingValues) {
      parametersWithMissingValues = result.parametersWithMissingValues;
      showParameterInputModal = true;
      isRunning = false;
      return;
    }

    // Update local state from flow runner
    isRunning = flowRunner.isRunning;
    currentStep = flowRunner.currentStep;
    progress = flowRunner.progress;
    error = flowRunner.error;
    executionState = flowRunner.executionState;
    parameterValues = flowRunner.parameterValues;
  }

  export function resetExecution() {
    if (flowRunner) {
      flowRunner.resetExecution();
      isRunning = false;
      currentStep = 0;
      progress = 0;
      error = null;
      executionState = {};
      parameterValues = {};
      showParameterInputModal = false;
    }
  }

  export function handleReset() {
    resetExecution();
    dispatch('reset');
  }

  // Handle parameter form submission
  async function handleParameterFormSubmit() {
    if (!flowRunner) return;

    flowRunner.updateParameterValues(parametersWithMissingValues);
    showParameterInputModal = false;

    // Continue with flow execution
    isRunning = true;
    await flowRunner.executeFlowAfterParameterCheck();
    
    // Update local state
    isRunning = flowRunner.isRunning;
    currentStep = flowRunner.currentStep;
    progress = flowRunner.progress;
    error = flowRunner.error;
    executionState = flowRunner.executionState;
    parameterValues = flowRunner.parameterValues;
  }
</script>

<!-- Parameter Input Modal - Only shown when required parameters are missing -->
{#if showParameterInputModal}
  <div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
    <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-lg font-medium">Required Parameters</h3>
        <button
          class="text-gray-500 hover:text-gray-700"
          on:click={() => (showParameterInputModal = false)}
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
        {#each parametersWithMissingValues as parameter (parameter.name)}
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
          on:click={() => (showParameterInputModal = false)}
        >
          Cancel
        </button>
        <button
          class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          on:click={handleParameterFormSubmit}
        >
          Run Flow
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Parameters Management Panel -->
{#if showParametersPanel}
  <FlowParameterEditor
    isOpen={showParametersPanel}
    parameters={flowData.parameters || []}
    currentValues={parameterValues}
    on:save={(e) => {
      // Handle saving a parameter
      const parameter = e.detail;
      
      // Initialize parameters array if it doesn't exist
      if (!flowData.parameters) {
        flowData.parameters = [];
      }
      
      // Check if this is a new parameter or existing one
      if (parameter.isNew) {
        // Remove the isNew flag
        delete parameter.isNew;
        // Add to parameters array
        flowData.parameters = [...flowData.parameters, parameter];
      } else {
        // Update existing parameter
        const index = flowData.parameters.findIndex(p => p.name === parameter.name);
        if (index !== -1) {
          flowData.parameters[index] = parameter;
          flowData.parameters = [...flowData.parameters];
        }
      }
      
      // Dispatch change event to notify parent components
      dispatch('change', { flowData });
    }}
    on:remove={(e) => {
      // Handle removing a parameter
      const parameter = e.detail;
      flowData.parameters = flowData.parameters.filter(p => p.name !== parameter.name);
      
      // Dispatch change event to notify parent components
      dispatch('change', { flowData });
    }}
    on:saveAll={(e) => {
      // Handle saving all parameters at once
      const parameters = e.detail;
      
      // Initialize parameters array if it doesn't exist
      if (!flowData.parameters) {
        flowData.parameters = [];
      }
      
      // Replace all parameters with the new ones
      flowData.parameters = [...parameters];
      
      // Dispatch change event to notify parent components
      dispatch('change', { flowData });
    }}
    on:close={() => (showParametersPanel = false)}
  />
{/if}

<!-- Only show these controls if showButtons is true (independent mode) -->
{#if showButtons !== false}
  <div class="mb-4 flex justify-between">
    <div class="space-x-2">
      <button
        class="btn btn-primary"
        disabled={isRunning || !flowData.steps.length}
        on:click={() => runFlow()}
      >
        {#if isRunning}
          Running...
        {:else}
          Run Flow
        {/if}
      </button>
      <button
        class="btn btn-outline"
        on:click={() => (showParametersPanel = !showParametersPanel)}
        class:btn-active={showParametersPanel}
      >
        {showParametersPanel ? 'Hide Parameters' : 'Parameters'}
      </button>
    </div>
    {#if currentStep !== null}
      <button class="btn btn-outline btn-error" on:click={() => stopExecution()}>Stop</button>
    {/if}
  </div>
{/if}
