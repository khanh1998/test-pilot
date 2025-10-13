<script lang="ts">
  import StepList from './StepList.svelte';
  import FlowOutputsPanel from './FlowOutputsPanel.svelte';
  import ParameterInputModal from './ParameterInputModal.svelte';
  import FlowOutputEditor from './FlowOutputEditor.svelte';
  import FlowLogsViewer from './FlowLogsViewer.svelte';
  import FlowExecutionControls from './FlowExecutionControls.svelte';
  import ExecutionOptionsPanel from './ExecutionOptionsPanel.svelte';
  import FlowParameterEditor from './FlowParameterEditor.svelte';
  import type { TestFlowData, Endpoint, ExecutionState, EndpointExecutionState, Parameter, FlowParameter, FlowStep } from './types';
  import { getEndpointById, type EndpointDetails } from '$lib/http_client/endpoints';
  import type { Environment } from '$lib/types/environment';
  import { createTemplateContextFromFlowRunner } from '$lib/template/utils';
  import { createTemplateFunctions } from '$lib/template/functions';
  import type { TemplateContext } from '$lib/template/types';
  import { projectStore } from '$lib/store/project';
  import * as stepManagement from './step-management';
  import { FlowRunner, type FlowRunnerOptions, type ExecutionPreferences } from '$lib/flow-runner';

  import { writable } from 'svelte/store';
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { isDesktop } from '$lib/environment';

  // flowData includes settings.api_hosts which contains multiple API host configurations
  export let flowData: TestFlowData;
  export let endpoints: Endpoint[] = [];
  
  // Environment props passed from parent
  export let environment: Environment | null = null;
  export let selectedSubEnvironment: string | null = null;

  // Sync endpoints into flowData so FlowRunner can access them
  $: if (flowData && endpoints) {
    flowData.endpoints = endpoints;
  }

  // Initialize outputs if not present
  $: if (flowData && !flowData.outputs) {
    flowData.outputs = [];
  }

  // Compute template context from current execution state
  $: templateContext = (() => {
    try {
      // Extract stored responses and transformations from execution store
      const storedResponses: Record<string, unknown> = {};
      const storedTransformations: Record<string, Record<string, unknown>> = {};

      Object.entries($executionStore).forEach(([key, state]) => {
        // Skip non-endpoint entries (progress, currentStep)
        if (typeof state === 'object' && state !== null && !Array.isArray(state)) {
          if (state.response?.body) {
            storedResponses[key] = state.response.body;
          }
          if (state.transformations) {
            storedTransformations[key] = state.transformations;
          }
        }
      });

      // Compute parameter values - use current values from FlowRunner if available, otherwise use defaults
      const parameterValues: Record<string, unknown> = { ...currentParameterValues };
      
      // Fill in any missing values with defaults from flow definition
      (flowData.parameters || []).forEach(param => {
        if (!(param.name in parameterValues) && param.defaultValue !== undefined && param.defaultValue !== null) {
          parameterValues[param.name] = param.defaultValue;
        }
      });

      // Compute environment variables from selected environment
      const environmentVariables: Record<string, unknown> = {};
      // Use environment prop directly
      if (environment && selectedSubEnvironment) {
        if (environment.config.environments[selectedSubEnvironment]) {
          const subEnvConfig = environment.config.environments[selectedSubEnvironment];
          
          // Add variable values from the selected sub-environment
          Object.entries(environment.config.variable_definitions).forEach(([varName, varDef]) => {
            const value = subEnvConfig.variables[varName];
            if (value !== undefined) {
              environmentVariables[varName] = value;
            } else if (varDef.default_value !== undefined) {
              environmentVariables[varName] = varDef.default_value;
            }
          });

          // Add API hosts from the sub-environment
          if (subEnvConfig.api_hosts) {
            Object.entries(subEnvConfig.api_hosts).forEach(([apiId, hostUrl]) => {
              environmentVariables[`api_host_${apiId}`] = hostUrl;
            });
          }
          
          console.log('Template context computed with environment variables:', {
            environmentId: environment.id,
            selectedSubEnvironment,
            environmentName: environment.name,
            subEnvironmentName: subEnvConfig.name,
            variableCount: Object.keys(environmentVariables).length,
            variables: Object.keys(environmentVariables)
          });
        } else {
          console.warn('Selected sub-environment not found:', {
            selectedSubEnvironment,
            availableSubEnvs: environment ? Object.keys(environment.config.environments) : []
          });
        }
      } else {
        console.log('Template context computed without environment variables:', {
          hasEnvironment: !!environment,
          selectedSubEnvironment
        });
      }

      // Create template functions
      const templateFunctions = createTemplateFunctions({
        responses: storedResponses,
        transformedData: storedTransformations,
        parameters: parameterValues,
        environment: environmentVariables
      });

      // Create full template context
      return createTemplateContextFromFlowRunner(
        storedResponses,
        storedTransformations,
        parameterValues,
        templateFunctions,
        environmentVariables
      );
    } catch (error) {
      console.warn('Failed to create template context:', error);
      return null;
    }
  })() as TemplateContext | null;

  let isRunning = false;
  let flowRunner: FlowRunner;
  let isLoadingEndpointDetails = false; // Add loading state for endpoint fetching
  
  // Bind to FlowRunner's current parameter values to use in template context
  let currentParameterValues: Record<string, unknown> = {};

  // Parameter input modal state
  let showParameterInputModal = false;
  let parametersWithMissingValues: Array<FlowParameter> = [];
  
  // Track pending single step execution
  let pendingSingleStepExecution: { step: FlowStep; stepIndex?: number } | null = null;

  // Local state derived from flow runner
  let currentStep = 0;
  let totalSteps = 0;
  let progress = 0;
  let error: unknown = null;
  let previousEnvironmentVariables: Record<string, unknown> = {};

  // Loading state for environment operations
  let isLoadingEnvironment = false;
  let selectedProject: import('$lib/store/project').Project | null = null;

  // Create a store to track execution state changes - we'll use this directly
  // instead of maintaining a separate executionState variable
  const executionStore = writable<ExecutionState>({});

  // Execution options panel
  let showExecutionOptions = false;

  // parameters panel control
  let showParametersPanel = false;

  // Flow output editor state
  let isOutputEditorOpen = false;
  let isOutputEditorMounted = false;
  let outputResults: Record<string, unknown> = {};
  let outputExecutionError: unknown = null;

  // Flow logs viewer state
  let isLogsViewerOpen = false;
  let isLogsViewerMounted = false;
  let executionLogs: Array<{
    level: 'info' | 'debug' | 'error' | 'warning';
    message: string;
    details?: string;
    timestamp: Date;
  }> = [];

  // Execution preferences - default values
  let preferences: ExecutionPreferences = {
    parallelExecution: true,
    stopOnError: true,
    serverCookieHandling: !isDesktop,
    retryCount: 0,
    timeout: 30000
  };

  // Computed environment variables for template resolution
  $: environmentVariables = computeEnvironmentVariables(environment, selectedSubEnvironment);

  function computeEnvironmentVariables(env: Environment | null, subEnv: string | null): Record<string, unknown> {
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

  // Function to handle endpoint selection for a specific step
  async function handleEndpointSelected(event: CustomEvent<Endpoint & { stepIndex: number }>) {
    const { stepIndex, ...selectedEndpoint } = event.detail;

    // Set loading state
    isLoadingEndpointDetails = true;

    try {
      // Fetch detailed endpoint information from the API
      console.log(`Fetching details for endpoint ${selectedEndpoint.id}...`);
      const endpointDetails = await getEndpointById(selectedEndpoint.id);
      console.log('Endpoint details fetched successfully:', endpointDetails);
      
      // Add endpoint to the step with the fetched details
      const stepEndpoints = flowData.steps[stepIndex].endpoints;
      const nextOrder = stepEndpoints.length > 0 
        ? Math.max(...stepEndpoints.map(ep => ep.order ?? 0)) + 1 
        : 0;
      
      flowData.steps[stepIndex].endpoints.push({
        endpoint_id: selectedEndpoint.id,
        api_id: selectedEndpoint.apiId, // Include API ID for multi-API support
        order: nextOrder, // Assign order for drag and drop
        pathParams: {},
        queryParams: {}
      });

      // Store the detailed endpoint information in the flowData.endpoints array
      // This ensures the endpoint details are available for other components
      if (!flowData.endpoints) {
        flowData.endpoints = [];
      }
      
      // Check if endpoint already exists in the array to avoid duplicates
      const existingEndpointIndex = flowData.endpoints.findIndex(ep => ep.id === selectedEndpoint.id);
      if (existingEndpointIndex === -1) {
        // Convert the API response (EndpointDetails) to match our Endpoint type
        const endpointData: Endpoint = {
          id: endpointDetails.id,
          apiId: endpointDetails.apiId,
          path: endpointDetails.path,
          method: endpointDetails.method,
          operationId: endpointDetails.operationId,
          summary: endpointDetails.summary,
          description: endpointDetails.description,
          tags: endpointDetails.tags,
          // Include the detailed schema and parameter information
          requestSchema: endpointDetails.requestSchema,
          responseSchema: endpointDetails.responseSchema,
          parameters: endpointDetails.parameters as Parameter[] | undefined
        };
        flowData.endpoints.push(endpointData);
        console.log('Full endpoint details stored in flowData.endpoints:', {
          id: endpointData.id,
          path: endpointData.path,
          method: endpointData.method,
          hasRequestSchema: !!endpointData.requestSchema,
          hasResponseSchema: !!endpointData.responseSchema,
          hasParameters: !!endpointData.parameters
        });
      } else {
        console.log('Endpoint already exists in flowData.endpoints, skipping duplicate');
      }

      // Trigger change event to save
      handleChange();
    } catch (error) {
      console.error('Failed to fetch endpoint details:', error);
      // Still add the endpoint to the step with basic information
      // This ensures the UI doesn't break if the API call fails
      const stepEndpoints = flowData.steps[stepIndex].endpoints;
      const nextOrder = stepEndpoints.length > 0 
        ? Math.max(...stepEndpoints.map(ep => ep.order ?? 0)) + 1 
        : 0;
        
      flowData.steps[stepIndex].endpoints.push({
        endpoint_id: selectedEndpoint.id,
        api_id: selectedEndpoint.apiId,
        order: nextOrder, // Assign order for drag and drop
        pathParams: {},
        queryParams: {}
      });
      
      // Trigger change event to save even with partial data
      handleChange();
      
      // You could add a toast notification here to inform the user
      // For now, we'll just log the error and continue
      console.warn('Continuing with basic endpoint information due to API error');
    } finally {
      // Clear loading state
      isLoadingEndpointDetails = false;
    }
  }

  const dispatch = createEventDispatcher();

  // Create event handlers for external triggers
  function handleshowParametersPanel() {
    showParametersPanel = true;
  }

  // Subscribe to project store to get current project
  const unsubscribeProject = projectStore.subscribe((state) => {
    selectedProject = state.selectedProject;
  });

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

  // Add a log entry to the execution logs
  function addLog(level: 'info' | 'debug' | 'error' | 'warning', message: string, details?: string) {
    dispatch('log', { level, message, details });
  }

  function initializeFlowRunner() {
    const options: FlowRunnerOptions = {
      flowData,
      preferences,
      selectedEnvironment: environment,
      environmentVariables,
      onLog: addLog,
      onExecutionStateUpdate: (state) => {
        executionStore.set(state);
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
        currentParameterValues = data.parameterValues;
        
        // Handle flow outputs from execution
        if (data.flowOutputs) {
          outputResults = data.flowOutputs;
          outputExecutionError = null;
        } else if (data.error) {
          outputResults = {};
          outputExecutionError = data.error;
        }
        
        // Force an update of all components that depend on the execution state
        executionStore.update((state) => ({ ...state }));

        dispatch('executionComplete', data);
      }
    };

    flowRunner = new FlowRunner(options);
    
    // Store current environment variables for comparison
    previousEnvironmentVariables = { ...environmentVariables };
  }

    // Add event listener on mount
  onMount(async () => {
    // Listen for custom events on the component's node
    const node = document.querySelector('svelte-component[this="TestFlowEditor"]');
    if (node) {
      node.addEventListener('showParametersPanel', handleshowParametersPanel as EventListener);

      onDestroy(() => {
        node.removeEventListener('showParametersPanel', handleshowParametersPanel as EventListener);
        unsubscribeProject();
      });
    }
  });

  function handleEnvironmentSelection(event: CustomEvent<{ environmentId: number | null; subEnvironment: string | null }>) {
    const { environmentId, subEnvironment } = event.detail;
    selectedSubEnvironment = subEnvironment;
    
    // Update flowData with environment selection
    if (!flowData.settings.environment) {
      flowData.settings.environment = {
        environmentId,
        subEnvironment
      };
    } else {
      flowData.settings.environment.environmentId = environmentId;
      flowData.settings.environment.subEnvironment = subEnvironment;
    }
    
    handleChange();
  }

  function handleChange(event?: CustomEvent<{ flowData: TestFlowData }>) {
    // If event has flowData in detail, use it
    if (event && event.detail && event.detail.flowData) {
      flowData = { ...event.detail.flowData };
    } else {
      // Otherwise update the local variable
      flowData = { ...flowData };
    }

    // Dispatch an event to notify the parent component
    dispatch('change', flowData);
  }

  // Handle removing a step from the flow
  function handleRemoveStep(event: CustomEvent) {
    const { stepIndex } = event.detail;
    flowData = stepManagement.removeStep(flowData, stepIndex);
    handleChange();
  }

  // Handle removing an endpoint from a step
  function handleRemoveEndpoint(event: CustomEvent) {
    const { stepIndex, endpointIndex } = event.detail;
    flowData = stepManagement.removeEndpoint(flowData, stepIndex, endpointIndex);
    handleChange();
  }

  // Handle moving a step up or down
  function handleMoveStep(event: CustomEvent) {
    const { stepIndex, direction } = event.detail;
    flowData = stepManagement.moveStep(flowData, stepIndex, direction);
    handleChange();
  }

  // Add a new step to the flow
  function addNewStep() {
    flowData = stepManagement.addNewStep(flowData);
    handleChange();
  }

  // Insert a new step after a specific step index
  function insertStepAfter(event: CustomEvent) {
    const { stepIndex } = event.detail;
    flowData = stepManagement.insertStepAfter(flowData, stepIndex);
    handleChange();
  }

  // Insert a new step before the first step
  function insertStepAtBeginning() {
    flowData = stepManagement.insertStepAtBeginning(flowData);
    handleChange();
  }

  // Handle execution state reset
  function handleReset() {
    if (flowRunner) {
      flowRunner.resetExecution();
      isRunning = false;
      currentStep = 0;
      progress = 0;
      error = null;
      currentParameterValues = {};
      showParameterInputModal = false;
      pendingSingleStepExecution = null;
    }
    
    // Reset the execution state store
    executionStore.set({});

    // Reset output results
    outputResults = {};
    outputExecutionError = null;

    // Clear execution logs
    executionLogs = [];

    // Dispatch reset event to parent
    dispatch('reset');
  }

  // Run the entire flow
  async function runFlow() {
    // Check for API hosts before running
    if (!hasValidApiHosts()) {
      dispatch('error', { message: 'Please configure at least one API host before running the flow.' });
      return;
    }

    // Check for steps
    if (flowData.steps.length === 0) {
      dispatch('error', { message: 'Please add at least one step to the flow before running.' });
      return;
    }

    if (!flowRunner) {
      console.error('Flow runner not initialized');
      return;
    }

    // Reset the execution state before starting a new run
    executionStore.set({});

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
    executionStore.set(flowRunner.executionState);
    currentParameterValues = flowRunner.parameterValues;
  }

  // Execute a single step from the UI
  async function executeStep(event: CustomEvent) {
    const { stepIndex } = event.detail;
    const step = flowData.steps[stepIndex];

    if (!flowRunner) {
      console.error('Flow runner not initialized');
      return;
    }

    if (step) {
      // We're not resetting the execution state so that previous results remain visible
      isRunning = true;

      const result = await flowRunner.executeSingleStep(step, stepIndex);
      
      // Check if parameters are missing - same handling as runFlow
      if (result.parametersWithMissingValues && result.parametersWithMissingValues.length > 0) {
        parametersWithMissingValues = result.parametersWithMissingValues;
        pendingSingleStepExecution = { step, stepIndex }; // Store for later continuation
        showParameterInputModal = true;
        isRunning = false;
        return;
      }
      
      isRunning = flowRunner.isRunning;
      
      // Update parameter values from flow runner after execution
      currentParameterValues = flowRunner.parameterValues;
    }
  }

  // Stop the flow execution
  function handleStop() {
    if (flowRunner) {
      flowRunner.stopExecution();
      isRunning = false;
    }
  }

  // Check if there are valid API hosts configured
  function hasValidApiHosts(): boolean {
    // Check if we have api_hosts structure with at least one valid host
    if (flowData.settings.api_hosts && Object.keys(flowData.settings.api_hosts).length > 0) {
      // Check if at least one API host has a valid URL
      return Object.values(flowData.settings.api_hosts).some(
        (hostInfo) => hostInfo && hostInfo.url && hostInfo.url.trim() !== ''
      );
    }
    
    return false;
  }

  // Flow output editor functions
  function openOutputEditor() {
    isOutputEditorMounted = true;
    isOutputEditorOpen = false;

    // Add a class to the body to prevent scrolling while modal is open
    document.body.classList.add('overflow-hidden');

    // Use requestAnimationFrame to ensure the DOM is updated before applying the animation
    requestAnimationFrame(() => {
      isOutputEditorOpen = true;
    });
  }

  function closeOutputEditor() {
    isOutputEditorOpen = false;

    // Add a small delay to allow for animation to complete before unmounting
    setTimeout(() => {
      isOutputEditorMounted = false;

      // Remove the class from body to re-enable scrolling
      document.body.classList.remove('overflow-hidden');
    }, 300);
  }

  function handleOutputSave(event: CustomEvent<{ outputs: import('./types').FlowOutput[] }>) {
    const { outputs } = event.detail;
    
    if (!flowData.outputs) {
      flowData.outputs = [];
    }
    
    flowData.outputs = [...outputs];
    handleChange();
  }

  // Flow logs viewer functions
  function openLogsViewer() {
    isLogsViewerMounted = true;
    isLogsViewerOpen = false;

    // Add a class to the body to prevent scrolling while modal is open
    document.body.classList.add('overflow-hidden');

    // Use requestAnimationFrame to ensure the DOM is updated before applying the animation
    requestAnimationFrame(() => {
      isLogsViewerOpen = true;
    });
  }

  function closeLogsViewer() {
    isLogsViewerOpen = false;

    // Add a small delay to allow for animation to complete before unmounting
    setTimeout(() => {
      isLogsViewerMounted = false;

      // Remove the class from body to re-enable scrolling
      document.body.classList.remove('overflow-hidden');
    }, 300);
  }

  // Parameter input modal handlers
  function handleParameterModalClose() {
    showParameterInputModal = false;
    pendingSingleStepExecution = null;
  }

  async function handleParameterModalSubmit(event: CustomEvent<{ parameters: FlowParameter[] }>) {
    if (!flowRunner) return;

    flowRunner.updateParameterValues(event.detail.parameters);
    showParameterInputModal = false;

    // Check if we're continuing a single step execution or full flow
    if (pendingSingleStepExecution) {
      // Continue with single step execution
      const { step, stepIndex } = pendingSingleStepExecution;
      pendingSingleStepExecution = null; // Clear pending execution
      
      isRunning = true;
      const result = await flowRunner.executeSingleStep(step, stepIndex);
      
      // Update local state
      isRunning = flowRunner.isRunning;
      currentParameterValues = flowRunner.parameterValues;
      executionStore.set(flowRunner.executionState);
    } else {
      // Continue with full flow execution
      isRunning = true;
      await flowRunner.executeFlowAfterParameterCheck();
      
      // Update local state
      isRunning = flowRunner.isRunning;
      currentStep = flowRunner.currentStep;
      progress = flowRunner.progress;
      error = flowRunner.error;
      executionStore.set(flowRunner.executionState);
      currentParameterValues = flowRunner.parameterValues;
    }
  }

  // Flow parameter editor handlers
  function handleParameterSave(event: CustomEvent) {
    const parameter = event.detail;
    if (!flowData.parameters) flowData.parameters = [];
    
    if (parameter.isNew) {
      delete parameter.isNew;
      flowData.parameters = [...flowData.parameters, parameter];
    } else {
      const index = flowData.parameters.findIndex(p => p.name === parameter.name);
      if (index !== -1) {
        flowData.parameters[index] = parameter;
        flowData.parameters = [...flowData.parameters];
      }
    }
    handleChange();
  }

  function handleParameterRemove(event: CustomEvent) {
    flowData.parameters = flowData.parameters.filter(p => p.name !== event.detail.name);
    handleChange();
  }

  function handleParametersSaveAll(event: CustomEvent) {
    flowData.parameters = [...event.detail];
    handleChange();
  }

  // No longer needed - we use progress and currentStep directly from executionStore
  // This function was previously calculating progress and current step
  // but those values are already available in the executionStore
  
  // No need for manual subscription anymore as we're using the $ syntax directly
</script>

<div class="space-y-4">
  <!-- Top Control Bar with Run Button -->
  <FlowExecutionControls
    {environment}
    {selectedSubEnvironment}
    {isRunning}
    {isLoadingEnvironment}
    executionStore={$executionStore}
    {executionLogs}
    hasValidApiHosts={hasValidApiHosts()}
    hasSteps={flowData.steps.length > 0}
    totalSteps={flowData.steps.length}
    on:environmentSelect={handleEnvironmentSelection}
    on:toggleOptions={() => (showExecutionOptions = !showExecutionOptions)}
    on:reset={() => {
      handleReset();
    }}
    on:toggleParameters={() => (showParametersPanel = !showParametersPanel)}
    on:openLogs={openLogsViewer}
    on:runFlow={runFlow}
    on:stop={handleStop}
  />

  <!-- Execution Options Panel (Sliding) -->
  <ExecutionOptionsPanel bind:preferences isVisible={showExecutionOptions} />

  <!-- Steps Section -->
  {#if templateContext}
    <StepList
      steps={flowData.steps}
      {endpoints}
      apiHosts={flowData?.settings?.api_hosts || {}}
      {isRunning}
      {isLoadingEndpointDetails}
      executionStore={$executionStore}
      {templateContext}
      on:removeStep={handleRemoveStep}
      on:removeEndpoint={handleRemoveEndpoint}
      on:moveStep={handleMoveStep}
      on:change={handleChange}
      on:runStep={executeStep}
      on:endpointSelected={handleEndpointSelected}
      on:insertStepAtBeginning={insertStepAtBeginning}
      on:insertStepAfter={insertStepAfter}
      on:addNewStep={addNewStep}
    />
  {:else}
    <div class="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">
      Loading template context...
    </div>
  {/if}

  <!-- Flow Outputs Section -->
  <FlowOutputsPanel
    outputs={flowData.outputs || []}
    {isRunning}
    on:openOutputEditor={openOutputEditor}
  />
</div>

<!-- Flow Output Editor Slide-out Panel -->
{#if isOutputEditorMounted}
  <FlowOutputEditor
    isOpen={isOutputEditorOpen}
    isMounted={true}
    outputs={flowData.outputs || []}
    {outputResults}
    executionError={outputExecutionError}
    hasExecutionData={Object.keys(outputResults).length > 0 || outputExecutionError !== null}
    on:close={closeOutputEditor}
    on:save={handleOutputSave}
  />
{/if}

<!-- Flow Logs Viewer Slide-out Panel -->
{#if isLogsViewerMounted}
  <FlowLogsViewer
    isOpen={isLogsViewerOpen}
    isMounted={true}
    logs={executionLogs}
    on:close={closeLogsViewer}
  />
{/if}

<!-- Flow Parameters Editor Slide-out Panel -->
{#if showParametersPanel}
  <FlowParameterEditor
    isOpen={showParametersPanel}
    parameters={flowData.parameters || []}
    currentValues={currentParameterValues}
    on:save={handleParameterSave}
    on:remove={handleParameterRemove}
    on:saveAll={handleParametersSaveAll}
    on:close={() => (showParametersPanel = false)}
  />
{/if}

<!-- Parameter Input Modal - Only shown when required parameters are missing -->
<ParameterInputModal
  isOpen={showParameterInputModal}
  parameters={parametersWithMissingValues}
  isPendingSingleStepExecution={pendingSingleStepExecution !== null}
  on:close={handleParameterModalClose}
  on:submit={handleParameterModalSubmit}
/>
