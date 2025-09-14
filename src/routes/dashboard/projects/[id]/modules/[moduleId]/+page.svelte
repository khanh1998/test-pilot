<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { setBreadcrumbOverride, clearBreadcrumbOverride } from '$lib/store/breadcrumb';
  import * as projectClient from '$lib/http_client/projects';
  import * as testFlowClient from '$lib/http_client/test-flow';
  import * as environmentClient from '$lib/http_client/environments';
  import FlowSearch from '$lib/components/projects/FlowSearch.svelte';
  import SequenceRow from '$lib/components/projects/SequenceRow.svelte';
  import SequenceCreator from '$lib/components/projects/SequenceCreator.svelte';
  import ParameterMappingPanel from '$lib/components/projects/ParameterMappingPanel.svelte';
  import SimplifiedEnvironmentSelector from '$lib/components/environments/SimplifiedEnvironmentSelector.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import { formatDate } from '$lib/utils/date';
  import type { ProjectModule } from '$lib/types/project';
  import type { FlowSequence } from '$lib/types/flow_sequence';
  import type { TestFlow } from '$lib/types/test-flow';
  import type { Environment } from '$lib/types/environment';
  import type { EnvironmentMapping } from '$lib/components/test-flows/types';

  let projectId: number;
  let moduleId: number;
  let project: any = null; // Add project state
  let module: ProjectModule | null = null;
  let sequences: FlowSequence[] = [];
  let sequenceFlowsMap: Map<number, TestFlow[]> = new Map(); // Map sequence ID to flows
  let environments: Environment[] = [];
  let linkedEnvironments: EnvironmentMapping[] = [];
  
  let loading = true;
  let error: string | null = null;

  // Modal states
  let showConfirmDialog = false;
  let isSubmitting = false;

  // Environment and execution states
  let selectedEnvironmentId: number | null = null;
  let selectedSubEnvironment: string | null = null;
  let isRunningAll = false;
  let runningSequences = new Set<number>(); // Track which sequences are running

  // Delete state
  let pendingDeleteSequence: { id: number; name: string } | null = null;
  
  // Parameter mapping panel state
  let showParameterPanel = false;
  let selectedFlow: TestFlow | null = null;
  let selectedSequence: any = null;
  let selectedStepOrder = 1;

  // Reactive statements to calculate data for parameter mapping
  $: projectVariables = project ? getProjectVariables() : [];
  
  // Reactive statement to calculate previous flow outputs
  $: previousFlowOutputs = getPreviousFlowOutputs(selectedSequence, selectedStepOrder, sequenceFlowsMap);

  // Reactive statement to check if we can run all sequences
  $: canRunAll = sequences.length > 0 && selectedEnvironmentId && selectedSubEnvironment;

  $: projectId = parseInt($page.params.id);
  $: moduleId = parseInt($page.params.moduleId);

  onMount(async () => {
    if (projectId && moduleId) {
      try {
        await Promise.all([
          loadModule(),
          loadSequences(),
          loadEnvironments() // Still need this for all environments
        ]);
      } catch (err) {
        console.error('Error during initial load:', err);
        if (!error) {
          error = 'Failed to load page data';
        }
      } finally {
        loading = false;
      }
    }
  });

  onDestroy(() => {
    // Clean up breadcrumb overrides when leaving the page
    clearBreadcrumbOverride(projectId.toString());
    clearBreadcrumbOverride(moduleId.toString());
  });

  async function loadModule() {
    try {
      // For now, we'll get module info from the project detail endpoint
      // In a real implementation, you might want a dedicated module endpoint
      const response = await projectClient.getProject(projectId);
      project = response.project; // Store project data
      module = response.modules.find(m => m.id === moduleId) || null;
      
      if (!module) {
        error = 'Module not found';
      } else {
        // Set breadcrumb overrides for both project and module
        if (project?.name) {
          setBreadcrumbOverride(projectId.toString(), project.name);
        }
        if (module?.name) {
          setBreadcrumbOverride(moduleId.toString(), module.name);
        }
      }

      // Extract linked environments from project data
      if (response.environments && Array.isArray(response.environments)) {
        linkedEnvironments = response.environments.map(projectEnv => ({
          environmentId: projectEnv.environment?.id || 0,
          environmentName: projectEnv.environment?.name || 'Unknown Environment',
          selectedSubEnvironment: undefined, // Will be set when user selects
          parameterMappings: projectEnv.variableMappings || {}
        })).filter(env => env.environmentId > 0); // Filter out invalid environments
      }
      
    } catch (err) {
      console.error('Failed to load module:', err);
      error = err instanceof Error ? err.message : 'Failed to load module';
    }
  }

  async function loadSequences() {
    try {
      const response = await projectClient.getModuleSequences(projectId, moduleId);
      sequences = Array.isArray(response.sequences) ? response.sequences : [];
      
      // Load flows for each sequence
      await loadSequenceFlows();
    } catch (err) {
      console.error('Failed to load sequences:', err);
      sequences = []; // Ensure it's always an array on error
      error = err instanceof Error ? err.message : 'Failed to load sequences';
    }
  }

  async function loadEnvironments() {
    try {
      // Load all environments for the user (needed for the environment selector)
      environments = await environmentClient.getEnvironments();
    } catch (err) {
      console.error('Failed to load environments:', err);
      environments = [];
      // Don't set error here as environments are optional
    }
  }

    async function loadSequenceFlows() {
    
    // Step 1: Collect all unique flow IDs from all sequences
    const uniqueFlowIds = new Set<number>();
    for (const sequence of sequences) {
      const steps = sequence.sequenceConfig?.steps || [];
      for (const step of steps) {
        uniqueFlowIds.add(step.test_flow_id);
      }
    }
    
    // Step 2: Fetch all unique flows in parallel (batch optimization)
    const flowCache = new Map<number, TestFlow>();
    const flowPromises = Array.from(uniqueFlowIds).map(async (flowId) => {
      try {
        const flowResponse = await testFlowClient.getTestFlow(flowId.toString());
        if (flowResponse?.testFlow) {
          flowCache.set(flowId, flowResponse.testFlow);
        }
      } catch (err) {
        console.error(`Failed to load flow ${flowId}:`, err);
      }
    });
    
    await Promise.all(flowPromises);
    
    // Step 3: Build sequence flows map using cached flows
    const flowsMap = new Map<number, TestFlow[]>();
    for (const sequence of sequences) {
      const flows: TestFlow[] = [];
      const steps = sequence.sequenceConfig?.steps || [];
      
      for (const step of steps) {
        const cachedFlow = flowCache.get(step.test_flow_id);
        if (cachedFlow) {
          flows.push(cachedFlow);
        }
      }
      
      flowsMap.set(sequence.id, flows);
    }
    
    sequenceFlowsMap = flowsMap;
  }

  // New event handlers for the redesigned interface
  async function handleCreateSequence(event: CustomEvent<{ name: string }>) {
    try {
      isSubmitting = true;
      const response = await projectClient.createSequence(projectId, moduleId, {
        name: event.detail.name,
        sequenceConfig: {
          steps: [],
          global_settings: {
            timeout: 30000,
            continue_on_error: false,
            parallel_execution: false
          }
        }
      });
      
      sequences = [...sequences, response.sequence];
      sequenceFlowsMap.set(response.sequence.id, []);
    } catch (err) {
      console.error('Failed to create sequence:', err);
      error = err instanceof Error ? err.message : 'Failed to create sequence';
    } finally {
      isSubmitting = false;
    }
  }

  async function handleEditSequenceName(event: CustomEvent<{ sequence: FlowSequence; newName: string }>) {
    try {
      await projectClient.updateSequence(projectId, moduleId, event.detail.sequence.id, {
        name: event.detail.newName
      });
      
      // Update local state
      sequences = sequences.map(seq => 
        seq.id === event.detail.sequence.id 
          ? { ...seq, name: event.detail.newName }
          : seq
      );
    } catch (err) {
      console.error('Failed to update sequence name:', err);
      error = err instanceof Error ? err.message : 'Failed to update sequence name';
    }
  }

  async function handleAddFlowToSequence(event: CustomEvent<{ sequence: FlowSequence; flow: TestFlow }>) {
    try {
      const { sequence, flow } = event.detail;
      const currentFlows = sequenceFlowsMap.get(sequence.id) || [];
      const nextStepOrder = currentFlows.length + 1;
      
      await projectClient.addFlowToSequence(projectId, moduleId, sequence.id, {
        test_flow_id: parseInt(flow.id),
        step_order: nextStepOrder
      });
      
      // Update local state
      sequenceFlowsMap.set(sequence.id, [...currentFlows, flow]);
      sequenceFlowsMap = new Map(sequenceFlowsMap); // Trigger reactivity
      
      // Update sequence steps
      const updatedSequences = sequences.map(seq => {
        if (seq.id === sequence.id) {
          const newSteps = [...(seq.sequenceConfig?.steps || []), {
            id: `step-${nextStepOrder}`,
            test_flow_id: parseInt(flow.id),
            step_order: nextStepOrder,
            parameter_mappings: []
          }];
          return {
            ...seq,
            sequenceConfig: {
              ...seq.sequenceConfig,
              steps: newSteps
            }
          };
        }
        return seq;
      });
      sequences = updatedSequences;
    } catch (err) {
      console.error('Failed to add flow to sequence:', err);
      error = err instanceof Error ? err.message : 'Failed to add flow to sequence';
    }
  }

  async function handleRemoveFlowFromSequence(event: CustomEvent<{ sequence: FlowSequence; stepOrder: number }>) {
    try {
      const { sequence, stepOrder } = event.detail;
      const steps = sequence.sequenceConfig?.steps || [];
      const stepToRemove = steps.find(s => s.step_order === stepOrder);
      
      if (stepToRemove) {
        await projectClient.removeFlowFromSequence(projectId, moduleId, sequence.id, stepToRemove.id);
        
        // Update local state
        const currentFlows = sequenceFlowsMap.get(sequence.id) || [];
        const updatedFlows = currentFlows.filter((_, index) => index !== stepOrder - 1);
        sequenceFlowsMap.set(sequence.id, updatedFlows);
        sequenceFlowsMap = new Map(sequenceFlowsMap);
        
        // Update sequence steps
        const updatedSequences = sequences.map(seq => {
          if (seq.id === sequence.id) {
            const newSteps = (seq.sequenceConfig?.steps || [])
              .filter(s => s.step_order !== stepOrder)
              .map((step, index) => ({ ...step, step_order: index + 1 })); // Reorder
            
            return {
              ...seq,
              sequenceConfig: {
                ...seq.sequenceConfig,
                steps: newSteps
              }
            };
          }
          return seq;
        });
        sequences = updatedSequences;
      }
    } catch (err) {
      console.error('Failed to remove flow from sequence:', err);
      error = err instanceof Error ? err.message : 'Failed to remove flow from sequence';
    }
  }

  function handleFlowClick(event: CustomEvent<{ sequence: FlowSequence; flow: TestFlow; stepOrder: number }>) {
    const { sequence, flow, stepOrder } = event.detail;
    selectedFlow = flow;
    selectedSequence = sequence;
    selectedStepOrder = stepOrder;
    showParameterPanel = true;
  }

  async function handleReorderFlow(event: CustomEvent<{ sequence: FlowSequence; fromIndex: number; toIndex: number }>) {
    try {
      const { sequence, fromIndex, toIndex } = event.detail;
      
      if (fromIndex === toIndex) return;
      
      // Get current flows and reorder them
      const currentFlows = sequenceFlowsMap.get(sequence.id) || [];
      const reorderedFlows = [...currentFlows];
      const [movedFlow] = reorderedFlows.splice(fromIndex, 1);
      reorderedFlows.splice(toIndex, 0, movedFlow);
      
      // Update the sequence steps with new order
      const newSteps = reorderedFlows.map((flow, index) => {
        const originalStep = sequence.sequenceConfig?.steps?.find(s => s.test_flow_id === parseInt(flow.id));
        return {
          ...originalStep,
          id: originalStep?.id || `step-${index + 1}`,
          test_flow_id: parseInt(flow.id),
          step_order: index + 1,
          parameter_mappings: originalStep?.parameter_mappings || []
        };
      });
      
      // Update the sequence on the server
      await projectClient.updateSequence(projectId, moduleId, sequence.id, {
        sequenceConfig: {
          ...sequence.sequenceConfig,
          steps: newSteps
        }
      });
      
      // Update local state
      sequenceFlowsMap.set(sequence.id, reorderedFlows);
      sequenceFlowsMap = new Map(sequenceFlowsMap); // Trigger reactivity
      
      // Update sequences array
      sequences = sequences.map(seq => 
        seq.id === sequence.id 
          ? {
              ...seq,
              sequenceConfig: {
                ...seq.sequenceConfig,
                steps: newSteps
              }
            }
          : seq
      );
      
    } catch (err) {
      console.error('Failed to reorder flows:', err);
      error = err instanceof Error ? err.message : 'Failed to reorder flows';
    }
  }

  function handleDeleteSequence(event: CustomEvent<{ sequence: FlowSequence }>) {
    pendingDeleteSequence = { id: event.detail.sequence.id, name: event.detail.sequence.name };
    showConfirmDialog = true;
  }

  function handleEnvironmentSelect(event: CustomEvent<{ environmentId: number | null; subEnvironment: string | null }>) {
    selectedEnvironmentId = event.detail.environmentId;
    selectedSubEnvironment = event.detail.subEnvironment;
  }

  async function handleRunAllSequences() {
    if (!selectedEnvironmentId || !selectedSubEnvironment) {
      alert('Please select an environment first');
      return;
    }

    if (sequences.length === 0) {
      alert('No sequences to run');
      return;
    }

    isRunningAll = true;
    console.log('Running all sequences with environment:', {
      environmentId: selectedEnvironmentId,
      subEnvironment: selectedSubEnvironment,
      sequences: sequences.map(s => s.name)
    });

    // TODO: Implement actual execution logic
    // For now, just simulate the execution
    try {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate execution time
      console.log('All sequences execution completed');
    } catch (err) {
      console.error('Failed to run all sequences:', err);
      error = err instanceof Error ? err.message : 'Failed to run sequences';
    } finally {
      isRunningAll = false;
    }
  }

  async function handleRunSequence(event: CustomEvent<{ sequence: FlowSequence }>) {
    const sequence = event.detail.sequence;
    
    if (!selectedEnvironmentId || !selectedSubEnvironment) {
      alert('Please select an environment first');
      return;
    }

    const flows = sequenceFlowsMap.get(sequence.id) || [];
    if (flows.length === 0) {
      alert('This sequence has no flows to run');
      return;
    }

    runningSequences.add(sequence.id);
    runningSequences = new Set(runningSequences); // Trigger reactivity

    console.log('Running sequence:', {
      sequenceName: sequence.name,
      environmentId: selectedEnvironmentId,
      subEnvironment: selectedSubEnvironment,
      flows: flows.map(f => f.name)
    });

    // TODO: Implement actual execution logic
    // For now, just simulate the execution
    try {
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate execution time
      console.log(`Sequence "${sequence.name}" execution completed`);
    } catch (err) {
      console.error(`Failed to run sequence "${sequence.name}":`, err);
      error = err instanceof Error ? err.message : `Failed to run sequence "${sequence.name}"`;
    } finally {
      runningSequences.delete(sequence.id);
      runningSequences = new Set(runningSequences); // Trigger reactivity
    }
  }

  function handleParameterPanelClose() {
    showParameterPanel = false;
    selectedFlow = null;
    selectedSequence = null;
    selectedStepOrder = 1;
  }

  async function handleParameterPanelSave(event: CustomEvent<{ stepOrder: number; parameterMappings: any[] }>) {
    try {
      const { stepOrder, parameterMappings } = event.detail;
      
      if (!selectedSequence) return;
      
      // Update the sequence with new parameter mappings
      await projectClient.updateSequence(projectId, moduleId, selectedSequence.id, {
        sequenceConfig: {
          ...selectedSequence.sequenceConfig,
          steps: selectedSequence.sequenceConfig?.steps?.map((step: any) => 
            step.step_order === stepOrder 
              ? { ...step, parameter_mappings: parameterMappings }
              : step
          ) || []
        }
      });
      
      // Update local state
      sequences = sequences.map(seq => 
        seq.id === selectedSequence.id 
          ? {
              ...seq,
              sequenceConfig: {
                ...seq.sequenceConfig,
                steps: seq.sequenceConfig?.steps?.map((step: any) =>
                  step.step_order === stepOrder
                    ? { ...step, parameter_mappings: parameterMappings }
                    : step
                ) || []
              }
            }
          : seq
      );
      
      showParameterPanel = false;
      selectedFlow = null;
      selectedSequence = null;
      selectedStepOrder = 1;
      
    } catch (err) {
      console.error('Failed to save parameter mappings:', err);
      error = err instanceof Error ? err.message : 'Failed to save parameter mappings';
    }
  }

  async function confirmDeleteSequence() {
    if (!pendingDeleteSequence) return;
    
    try {
      await projectClient.deleteSequence(projectId, moduleId, pendingDeleteSequence.id);
      sequences = Array.isArray(sequences) ? sequences.filter(s => s.id !== pendingDeleteSequence!.id) : [];
      showConfirmDialog = false;
      pendingDeleteSequence = null;
    } catch (err) {
      console.error('Failed to delete sequence:', err);
      error = err instanceof Error ? err.message : 'Failed to delete sequence';
    }
  }

  function cancelDelete() {
    showConfirmDialog = false;
    pendingDeleteSequence = null;
  }

  function getProjectVariables() {
    if (!project?.projectJson?.variables) {
      return [];
    }

    const variables = project.projectJson.variables.map((variable: any) => ({
      name: variable.name,
      type: variable.type,
      description: variable.description || `Project variable of type ${variable.type}`
    }));
    
    return variables;
  }

  function getPreviousFlowOutputs(currentSelectedSequence: any, currentSelectedStepOrder: number, currentSequenceFlowsMap: Map<number, TestFlow[]>) {
    if (!currentSelectedSequence || !currentSelectedStepOrder || currentSelectedStepOrder <= 1) {
      return [];
    }

    const outputs = [];
    const currentSequenceFlows = currentSequenceFlowsMap.get(currentSelectedSequence.id) || [];
    
    // Only include flows from previous steps in the sequence
    for (let i = 0; i < currentSelectedStepOrder - 1; i++) {
      const flow = currentSequenceFlows[i];
      if (!flow) continue;

      const flowOutputs = [];
      
      // Extract outputs from flow's output definition
      if (flow.flowJson?.outputs && Array.isArray(flow.flowJson.outputs) && flow.flowJson.outputs.length > 0) {
        for (const output of flow.flowJson.outputs) {
          flowOutputs.push({
            name: output.name,
            type: 'unknown' as const, // We don't have type info, so default to unknown
            source: 'flow_output' as const
          });
        }
      }

      // Only include flows that have outputs
      if (flowOutputs.length > 0) {
        outputs.push({
          flowName: flow.name,
          stepOrder: i + 1,
          outputs: flowOutputs
        });
      }
    }

    return outputs;
  }
</script>

<svelte:head>
  <title>{module?.name || 'Module'} - Test Pilot</title>
</svelte:head>

{#if loading}
  <div class="flex justify-center items-center py-12">
    <div class="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
  </div>
{:else if error}
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="bg-red-50 border border-red-200 rounded-md p-4">
      <div class="flex">
        <svg class="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
        </svg>
        <p class="text-sm text-red-700">{error}</p>
      </div>
    </div>
  </div>
{:else if module}
  <div class="min-h-screen bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Environment Selector and Run All Button -->
      <div class="bg-white shadow rounded-lg p-6 mb-6">
        <div class="flex items-center justify-between">
          <div class="flex-1 max-w-md">
            <label for="environment-selector" class="block text-sm font-medium text-gray-700 mb-2">
              Execution Environment
            </label>
            <SimplifiedEnvironmentSelector
              id="environment-selector"
              {environments}
              {linkedEnvironments}
              {selectedEnvironmentId}
              {selectedSubEnvironment}
              placeholder="Select environment for execution..."
              on:select={handleEnvironmentSelect}
            />
          </div>
          
          <div class="ml-6">
            <button
              type="button"
              on:click={handleRunAllSequences}
              disabled={!canRunAll || isRunningAll}
              class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              title={!canRunAll ? 'Select an environment and ensure all sequences have flows' : 'Run all sequences in this module'}
            >
              {#if isRunningAll}
                <svg class="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Running All...
              {:else}
                <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8.056v3.888a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
                </svg>
                Run All Sequences
              {/if}
            </button>
          </div>
        </div>
        
        {#if selectedEnvironmentId && selectedSubEnvironment}
          <div class="mt-3 text-xs text-green-600">
            ✓ Ready to execute with selected environment
          </div>
        {:else if linkedEnvironments.length === 0}
          <div class="mt-3 text-xs text-yellow-600">
            ⚠ No environments linked to this project. Link environments in project settings to enable execution.
          </div>
        {:else}
          <div class="mt-3 text-xs text-gray-500">
            Select an environment to enable sequence execution
          </div>
        {/if}
      </div>

      <!-- Excel-like sequence management interface -->
      <div class="space-y-6">
        <!-- Create new sequence -->
        <div class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Create New Sequence</h3>
          <SequenceCreator 
            on:create={handleCreateSequence}
            isCreating={isSubmitting}
          />
        </div>

        <!-- Existing sequences -->
        {#if Array.isArray(sequences) && sequences.length > 0}
          <div class="bg-white shadow rounded-lg p-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Test Sequences</h3>
            <div class="space-y-4">
              {#each sequences as sequence (sequence.id)}
                <SequenceRow 
                  {sequence}
                  sequenceFlows={sequenceFlowsMap.get(sequence.id) || []}
                  {selectedEnvironmentId}
                  {selectedSubEnvironment}
                  isRunning={runningSequences.has(sequence.id)}
                  on:editName={handleEditSequenceName}
                  on:addFlow={handleAddFlowToSequence}
                  on:removeFlow={handleRemoveFlowFromSequence}
                  on:clickFlow={handleFlowClick}
                  on:reorderFlow={handleReorderFlow}
                  on:delete={handleDeleteSequence}
                  on:runSequence={handleRunSequence}
                />
              {/each}
            </div>
          </div>
        {:else}
          <div class="bg-white shadow rounded-lg p-6">
            <div class="text-center py-12">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 class="mt-2 text-sm font-medium text-gray-900">No sequences</h3>
              <p class="mt-1 text-sm text-gray-500">Get started by creating your first test sequence.</p>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Parameter Mapping Panel -->
<ParameterMappingPanel
  isOpen={showParameterPanel}
  flow={selectedFlow}
  sequence={selectedSequence}
  stepOrder={selectedStepOrder}
  projectVariables={projectVariables}
  previousFlowOutputs={previousFlowOutputs}
  on:close={handleParameterPanelClose}
  on:save={handleParameterPanelSave}
/>

<!-- Confirm Delete Dialog -->
{#if showConfirmDialog && pendingDeleteSequence}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div class="relative top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-lg shadow-xl max-w-md">
      <h3 class="text-lg font-medium text-gray-900 mb-4">Delete Sequence</h3>
      <p class="text-sm text-gray-500 mb-6">
        Are you sure you want to delete "{pendingDeleteSequence.name}"? This action cannot be undone.
      </p>
      <div class="flex space-x-3 justify-end">
        <button
          type="button"
          on:click={cancelDelete}
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          on:click={confirmDeleteSequence}
          class="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
{/if}
