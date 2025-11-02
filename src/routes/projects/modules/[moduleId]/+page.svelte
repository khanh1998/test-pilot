<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { fade } from 'svelte/transition';
  import { setBreadcrumbOverride, clearBreadcrumbOverride } from '$lib/store/breadcrumb';
  import { projectStore } from '$lib/store/project';
  import * as projectClient from '$lib/http_client/projects';
  import * as testFlowClient from '$lib/http_client/test-flow';
  import { SequenceRunner, type SequenceRunnerOptions } from '$lib/sequence-runner';
  import type { SequenceFlowResult } from '$lib/sequence-runner/types';
  import SequenceRow from '$lib/components/modules/SequenceRow.svelte';
  import SequenceCreator from '$lib/components/modules/SequenceCreator.svelte';
  import ParameterMappingPanel from '$lib/components/modules/ParameterMappingPanel.svelte';
  import SimplifiedEnvironmentSelector from '$lib/components/environments/SimplifiedEnvironmentSelector.svelte';
  import type { ProjectModule } from '$lib/types/project';
  import type { FlowSequence } from '$lib/types/flow_sequence';
  import type { TestFlow } from '$lib/types/test-flow';
  import type { Environment } from '$lib/types/environment';
  import type { ExecutionPreferences } from '$lib/flow-runner/execution-engine';
  import { isDesktop } from '$lib/environment';

  let projectId: number | null = null;
  let moduleId: number;
  let selectedProject: any = null;
  let module: ProjectModule | null = null;
  let sequences: FlowSequence[] = [];
  let sequenceFlowsMap: Map<number, TestFlow[]> = new Map(); // Map sequence ID to flows
  let sequenceResultsMap: Map<number, SequenceFlowResult[]> = new Map(); // Map sequence ID to execution results
  let projectEnvironment: Environment | null = null;
  
  let loading = true;
  let error: string | null = null;
  
  // Execution results state
  let executionResults: {
    show: boolean;
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
    details?: string;
  } | null = null;

  // Modal states
  let isSubmitting = false;

  // Environment and execution states
  let selectedSubEnvironment: string | null = null;
  let isRunningAll = false;
  let runningSequences = new Set<number>(); // Track which sequences are running
  
  // Local storage key for selected sub-environment per module
  $: localStorageKey = `selectedSubEnvironment_module_${moduleId}`;
  
  // Save selected sub-environment to local storage
  function saveSelectedSubEnvironment(moduleId: number, subEnv: string | null) {
    if (typeof window !== 'undefined') {
      const key = `selectedSubEnvironment_module_${moduleId}`;
      if (subEnv) {
        localStorage.setItem(key, subEnv);
      } else {
        localStorage.removeItem(key);
      }
    }
  }
  
  // Load selected sub-environment from local storage
  function loadSelectedSubEnvironment(moduleId: number): string | null {
    if (typeof window !== 'undefined') {
      const key = `selectedSubEnvironment_module_${moduleId}`;
      return localStorage.getItem(key);
    }
    return null;
  }
  
  // Reactive statement to save to local storage when selectedSubEnvironment changes
  $: {
    if (moduleId && selectedSubEnvironment !== null) {
      saveSelectedSubEnvironment(moduleId, selectedSubEnvironment);
    }
  }
  
  // Execution options state
  let showExecutionOptions = false;
  let executionPreferences: ExecutionPreferences = {
    parallelExecution: true,
    stopOnError: true,
    serverCookieHandling: !isDesktop,
    retryCount: 0,
    timeout: 30000
  };

  // Parameter mapping panel state
  let showParameterPanel = false;
  let selectedFlow: TestFlow | null = null;
  let selectedSequence: any = null;
  let selectedStepOrder = 1;

  // Reactive statement to calculate previous flow outputs
  $: previousFlowOutputs = getPreviousFlowOutputs(selectedSequence, selectedStepOrder, sequenceFlowsMap);

  // Reactive statement to check if we can run all sequences
  $: canRunAll = sequences.length > 0 && projectEnvironment && selectedSubEnvironment;
  
  // Debug execution results
  $: {
    if (sequenceResultsMap.size > 0) {
      console.log('Main page sequenceResultsMap updated:', sequenceResultsMap);
      for (const [sequenceId, results] of sequenceResultsMap.entries()) {
        console.log(`Sequence ${sequenceId} has ${results.length} execution results:`, results);
      }
    }
  }

  $: moduleId = parseInt($page.params.moduleId);

  // Subscribe to project store to get the selected project
  const unsubscribeProject = projectStore.subscribe((state) => {
    selectedProject = state.selectedProject;
    projectId = selectedProject?.id || null;
  });

  onMount(async () => {
    // Load projects first to get the selected project
    try {
      await projectStore.loadProjects();
    } catch (err) {
      console.error('Failed to load projects:', err);
      error = 'Failed to load projects';
      loading = false;
      return;
    }
  });

  // Use reactive statement to load data when projectId changes
  $: {
    if (projectId && moduleId) {
      loadData();
    }
  }

  async function loadData() {
    if (!projectId || !moduleId) return;
    
    loading = true;
    error = null;
    
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

  onDestroy(() => {
    // Clean up breadcrumb overrides when leaving the page
    if (projectId) {
      clearBreadcrumbOverride(projectId.toString());
    }
    clearBreadcrumbOverride(moduleId.toString());
    // Clean up project store subscription
    unsubscribeProject();
    // Save final state to localStorage if needed
    if (moduleId && selectedSubEnvironment) {
      saveSelectedSubEnvironment(moduleId, selectedSubEnvironment);
    }
  });

  async function loadModule() {
    if (!projectId) {
      throw new Error('No project selected');
    }
    
    try {
      // Use dedicated lightweight API to get just the module
      const response = await projectClient.getModule(projectId, moduleId);
      module = response.module;
      
      if (!module) {
        error = 'Module not found';
      } else {
        // Set breadcrumb overrides for both project and module
        if (selectedProject?.name) {
          setBreadcrumbOverride(projectId.toString(), selectedProject.name);
        }
        if (module?.name) {
          setBreadcrumbOverride(moduleId.toString(), module.name);
        }
      }
      
    } catch (err) {
      console.error('Failed to load module:', err);
      error = err instanceof Error ? err.message : 'Failed to load module';
    }
  }

  async function loadSequences() {
    if (!projectId) {
      throw new Error('No project selected');
    }
    
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
    if (!projectId) {
      projectEnvironment = null;
      selectedSubEnvironment = null;
      return;
    }
    
    try {
      // Load the single project environment (each project has maximum one environment)
      const response = await projectClient.getProjectEnvironment(projectId);
      if (response.environment) {
        // Convert ProjectEnvironmentLink to Environment format for compatibility
        const projectEnv = response.environment;
        projectEnvironment = {
          id: projectEnv.environmentId,
          name: projectEnv.environment?.name || 'Project Environment',
          description: projectEnv.environment?.description || 'Default project environment',
          config: projectEnv.environment?.config || { environments: {}, variable_definitions: {}, linked_apis: [] },
          createdAt: typeof projectEnv.createdAt === 'string' ? projectEnv.createdAt : new Date(projectEnv.createdAt).toISOString(),
          updatedAt: typeof projectEnv.createdAt === 'string' ? projectEnv.createdAt : new Date(projectEnv.createdAt).toISOString(), // Use same as createdAt since we don't have updatedAt
          userId: 0 // Not relevant for project environment
        };
        
        // Try to restore from local storage first, then auto-select the first sub-environment
        if (projectEnv.environment?.config?.environments) {
          const subEnvKeys = Object.keys(projectEnv.environment.config.environments);
          if (subEnvKeys.length > 0) {
            // Try to restore from local storage
            const savedSubEnv = loadSelectedSubEnvironment(moduleId);
            if (savedSubEnv && subEnvKeys.includes(savedSubEnv)) {
              selectedSubEnvironment = savedSubEnv;
            } else {
              // Auto-select the first sub-environment if no saved preference or saved preference is invalid
              selectedSubEnvironment = subEnvKeys[0];
            }
          }
        }
      } else {
        projectEnvironment = null;
        selectedSubEnvironment = null;
      }
    } catch (err) {
      console.error('Failed to load project environment:', err);
      projectEnvironment = null;
      selectedSubEnvironment = null;
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
    if (!projectId) {
      showExecutionResults('error', 'No Project Selected', 'Please select a project first');
      return;
    }
    
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
      const errorMessage = err instanceof Error ? err.message : 'Failed to create sequence';
      showExecutionResults('error', 'Creation Failed', 'Failed to create sequence', errorMessage);
    } finally {
      isSubmitting = false;
    }
  }

  async function handleEditSequenceName(event: CustomEvent<{ sequence: FlowSequence; newName: string }>) {
    if (!projectId) {
      showExecutionResults('error', 'No Project Selected', 'Please select a project first');
      return;
    }
    
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
      const errorMessage = err instanceof Error ? err.message : 'Failed to update sequence name';
      showExecutionResults('error', 'Update Failed', 'Failed to update sequence name', errorMessage);
    }
  }

  async function handleAddFlowToSequence(event: CustomEvent<{ sequence: FlowSequence; flow: TestFlow }>) {
    if (!projectId) {
      showExecutionResults('error', 'No Project Selected', 'Please select a project first');
      return;
    }
    
    try {
      const { sequence, flow } = event.detail;
      const currentFlows = sequenceFlowsMap.get(sequence.id) || [];
      const nextStepOrder = currentFlows.length + 1;
      
      // First, fetch the complete flow data from the API
      const fullFlowResponse = await testFlowClient.getTestFlow(flow.id);
      if (!fullFlowResponse?.testFlow) {
        throw new Error('Failed to fetch complete flow data');
      }
      const fullFlow = fullFlowResponse.testFlow;
      
      // Add flow to sequence via API
      const addResult = await projectClient.addFlowToSequence(projectId, moduleId, sequence.id, {
        test_flow_id: parseInt(fullFlow.id),
        step_order: nextStepOrder
      });
      
      // Update local state with complete flow data
      sequenceFlowsMap.set(sequence.id, [...currentFlows, fullFlow]);
      sequenceFlowsMap = new Map(sequenceFlowsMap); // Trigger reactivity
      
      // Update the sequence with the result from backend
      if (addResult.result) {
        sequences = sequences.map(seq => 
          seq.id === sequence.id ? addResult.result : seq
        );
      }
    } catch (err) {
      console.error('Failed to add flow to sequence:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to add flow to sequence';
      showExecutionResults('error', 'Add Flow Failed', 'Failed to add flow to sequence', errorMessage);
    }
  }

  async function handleRemoveFlowFromSequence(event: CustomEvent<{ sequence: FlowSequence; stepOrder: number }>) {
    if (!projectId) {
      showExecutionResults('error', 'No Project Selected', 'Please select a project first');
      return;
    }
    
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
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove flow from sequence';
      showExecutionResults('error', 'Remove Flow Failed', 'Failed to remove flow from sequence', errorMessage);
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
    if (!projectId) {
      showExecutionResults('error', 'No Project Selected', 'Please select a project first');
      return;
    }
    
    try {
      const { sequence, fromIndex, toIndex } = event.detail;
      
      if (fromIndex === toIndex) return;
      
      // Get current steps and reorder them by swapping positions
      const currentSteps = [...(sequence.sequenceConfig?.steps || [])];
      const [movedStep] = currentSteps.splice(fromIndex, 1);
      currentSteps.splice(toIndex, 0, movedStep);
      
      // Update only the step_order, keeping IDs and other properties intact
      const newSteps = currentSteps.map((step, index) => ({
        ...step,
        step_order: index + 1
      }));
      
      // Also update the flows map for display
      const currentFlows = sequenceFlowsMap.get(sequence.id) || [];
      const reorderedFlows = [...currentFlows];
      const [movedFlow] = reorderedFlows.splice(fromIndex, 1);
      reorderedFlows.splice(toIndex, 0, movedFlow);
      
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
      const errorMessage = err instanceof Error ? err.message : 'Failed to reorder flows';
      showExecutionResults('error', 'Reorder Failed', 'Failed to reorder flows', errorMessage);
    }
  }

  async function handleDeleteSequence(event: CustomEvent<{ sequence: FlowSequence }>) {
    if (!projectId) {
      showExecutionResults('error', 'No Project Selected', 'Please select a project first');
      return;
    }
    
    try {
      await projectClient.deleteSequence(projectId, moduleId, event.detail.sequence.id);
      sequences = Array.isArray(sequences) ? sequences.filter(s => s.id !== event.detail.sequence.id) : [];
    } catch (err) {
      console.error('Failed to delete sequence:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete sequence';
      showExecutionResults('error', 'Delete Failed', 'Failed to delete sequence', errorMessage);
    }
  }

  async function handleCloneSequence(event: CustomEvent<{ sequence: FlowSequence; name: string; description?: string }>) {
    if (!projectId) {
      showExecutionResults('error', 'No Project Selected', 'Please select a project first');
      return;
    }
    
    try {
      const { sequence, name, description } = event.detail;
      const response = await projectClient.cloneSequence(projectId, moduleId, sequence.id, {
        name,
        description
      });
      
      // Add the cloned sequence to our list
      sequences = [...sequences, response.sequence];
      
      // Initialize empty flows map for the new sequence
      sequenceFlowsMap.set(response.sequence.id, []);
      sequenceFlowsMap = new Map(sequenceFlowsMap); // Trigger reactivity
      
      // Load flows for the new sequence
      await loadSequenceFlows();
      
      showExecutionResults('success', 'Sequence Cloned', `Successfully cloned "${sequence.name}" as "${name}"`);
    } catch (err) {
      console.error('Failed to clone sequence:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to clone sequence';
      showExecutionResults('error', 'Clone Failed', 'Failed to clone sequence', errorMessage);
    }
  }

  async function handleToggleExpectsError(event: CustomEvent<{ sequence: FlowSequence; stepOrder: number; expectsError: boolean }>) {
    if (!projectId) {
      showExecutionResults('error', 'No Project Selected', 'Please select a project first');
      return;
    }
    
    try {
      const { sequence, stepOrder, expectsError } = event.detail;
      const steps = sequence.sequenceConfig?.steps || [];
      
      // Find the step to update
      const stepToUpdate = steps.find(s => s.step_order === stepOrder);
      if (!stepToUpdate) {
        throw new Error('Step not found');
      }
      
      // Update the step's expects_error field
      const updatedSteps = steps.map(step => 
        step.step_order === stepOrder 
          ? { ...step, expects_error: expectsError }
          : step
      );
      
      // Update the sequence configuration
      const updatedSequenceConfig = {
        ...sequence.sequenceConfig,
        steps: updatedSteps
      };
      
      // Call API to update the sequence
      await projectClient.updateSequence(projectId, moduleId, sequence.id, {
        sequenceConfig: updatedSequenceConfig
      });
      
      // Update local state
      sequences = sequences.map(seq => 
        seq.id === sequence.id 
          ? {
              ...seq,
              sequenceConfig: updatedSequenceConfig
            }
          : seq
      );
      
    } catch (err) {
      console.error('Failed to toggle expects error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle expects error';
      showExecutionResults('error', 'Update Failed', 'Failed to update expects error setting', errorMessage);
    }
  }

  function handleEnvironmentSelect(event: CustomEvent<{ environmentId: number | null; subEnvironment: string | null }>) {
    selectedSubEnvironment = event.detail.subEnvironment;
    // The reactive statement will handle saving to localStorage automatically
  }

  function showExecutionResults(type: 'success' | 'error' | 'warning', title: string, message: string, details?: string) {
    executionResults = {
      show: true,
      type,
      title,
      message,
      details
    };
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
      setTimeout(() => {
        if (executionResults?.type === 'success') {
          executionResults = null;
        }
      }, 5000);
    }
  }

  function hideExecutionResults() {
    executionResults = null;
  }

  async function handleRunAllSequences() {
    if (!projectEnvironment || !selectedSubEnvironment) {
      alert('Please select a sub-environment first');
      return;
    }

    if (sequences.length === 0) {
      alert('No sequences to run');
      return;
    }

    // Use the current project environment
    const selectedEnv = projectEnvironment;

    isRunningAll = true;
    console.log('Running all sequences with environment:', {
      environment: selectedEnv.name,
      subEnvironment: selectedSubEnvironment,
      sequences: sequences.map(s => s.name)
    });

    try {
      let successCount = 0;
      let failCount = 0;
      
      // Run each sequence sequentially
      for (const sequence of sequences) {
        const flows = sequenceFlowsMap.get(sequence.id) || [];
        if (flows.length === 0) {
          console.log(`Skipping sequence "${sequence.name}" - no flows`);
          continue;
        }

        console.log(`\n🚀 Running sequence: ${sequence.name}`);
        
        try {
          // Create sequence runner options
          const sequenceOptions: SequenceRunnerOptions = {
            sequence,
            flows,
            project: selectedProject, // Add project information
            selectedEnvironment: selectedEnv,
            selectedSubEnvironment: selectedSubEnvironment,
            preferences: executionPreferences,
            onLog: (level, message, details) => {
              console.log(`[${sequence.name}] [${level}] ${message}`, details);
            },
            onSequenceComplete: (data) => {
              const status = data.success ? '✅' : '❌';
              console.log(`${status} Sequence "${sequence.name}" completed: ${data.completedFlows}/${data.totalFlows} flows`);
            }
          };

          const sequenceRunner = new SequenceRunner(sequenceOptions);
          const result = await sequenceRunner.runSequence();

          // Store execution results for this sequence
          sequenceResultsMap.set(sequence.id, sequenceRunner.flowResults);
          sequenceResultsMap = new Map(sequenceResultsMap); // Trigger reactivity

          if (result.success) {
            successCount++;
          } else {
            failCount++;
            console.error(`Sequence "${sequence.name}" failed:`, result.error);
          }

        } catch (err) {
          failCount++;
          console.error(`Failed to run sequence "${sequence.name}":`, err);
        }
      }

      const totalSequences = sequences.length;
      const message = `Execution completed: ${successCount} successful, ${failCount} failed out of ${totalSequences} sequences`;
      
      if (failCount > 0) {
        showExecutionResults('warning', 'Some Sequences Failed', message, 
          `${failCount} sequence(s) encountered errors. Check the console for detailed error information.`);
      } else {
        showExecutionResults('success', 'All Sequences Completed', message, 
          `Successfully executed all ${successCount} sequences.`);
        console.log(`🎉 ${message}`);
      }

    } catch (err) {
      console.error('Failed to run all sequences:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to run sequences';
      showExecutionResults('error', 'Execution Failed', 'Failed to execute sequences', errorMessage);
    } finally {
      isRunningAll = false;
    }
  }

  async function handleRunSequence(event: CustomEvent<{ sequence: FlowSequence }>) {
    const sequence = event.detail.sequence;
    
    if (!projectEnvironment || !selectedSubEnvironment) {
      alert('Please select a sub-environment first');
      return;
    }

    const flows = sequenceFlowsMap.get(sequence.id) || [];
    if (flows.length === 0) {
      alert('This sequence has no flows to run');
      return;
    }

    // Use the current project environment
    const selectedEnv = projectEnvironment;

    runningSequences.add(sequence.id);
    runningSequences = new Set(runningSequences); // Trigger reactivity

    console.log('Running sequence:', {
      sequenceName: sequence.name,
      environment: selectedEnv.name,
      subEnvironment: selectedSubEnvironment,
      flows: flows.map(f => f.name),
    });

    try {
      // Create sequence runner options
      const sequenceOptions: SequenceRunnerOptions = {
        sequence,
        flows,
        project: selectedProject, // Add project information
        selectedEnvironment: selectedEnv,
        selectedSubEnvironment: selectedSubEnvironment,
        preferences: executionPreferences,
        onLog: (level, message, details) => {
          console.log(`[SEQUENCE ${sequence.name}] [${level}] ${message}`, details);
        },
        onSequenceStart: () => {
          console.log(`Sequence "${sequence.name}" started`);
        },
        onSequenceComplete: (data) => {
          console.log(`Sequence "${sequence.name}" completed:`, data);
          if (data.success) {
            console.log(`✅ Sequence completed successfully. Executed ${data.completedFlows}/${data.totalFlows} flows.`);
            showExecutionResults('success', 'Sequence Completed', 
              `"${sequence.name}" executed successfully`, 
              `Completed ${data.completedFlows}/${data.totalFlows} flows.`);
          } else {
            console.error(`❌ Sequence failed: ${data.error}`);
            const errorMsg = data.error instanceof Error ? data.error.message : String(data.error);
            showExecutionResults('error', 'Sequence Failed', 
              `"${sequence.name}" execution failed`, errorMsg);
          }
        },
        onFlowStart: (data) => {
          console.log(`Starting flow ${data.flow.name} (step ${data.stepOrder})`);
        },
        onFlowComplete: (data) => {
          const status = data.success ? '✅' : '❌';
          console.log(`${status} Flow ${data.flow.name} ${data.success ? 'completed' : 'failed'}${data.error ? `: ${data.error}` : ''}`);
        },
        onSequenceStateUpdate: (state) => {
          console.log(`Sequence progress: ${state.progress}% (${state.currentFlowIndex + 1}/${state.totalFlows})`);
        }
      };

      // Create and run the sequence
      const sequenceRunner = new SequenceRunner(sequenceOptions);
      const result = await sequenceRunner.runSequence();

      // Store execution results for this sequence
      sequenceResultsMap.set(sequence.id, sequenceRunner.flowResults);
      sequenceResultsMap = new Map(sequenceResultsMap); // Trigger reactivity
      
      console.log('Stored execution results for sequence:', sequence.id, sequenceRunner.flowResults);
      console.log('Updated sequenceResultsMap:', sequenceResultsMap);

      if (result.success) {
        console.log(`🎉 Sequence "${sequence.name}" execution completed successfully!`);
      } else {
        console.error(`💥 Sequence "${sequence.name}" execution failed:`, result.error);
        // Don't show error here as it's already handled in onSequenceComplete
      }

    } catch (err) {
      console.error(`Failed to run sequence "${sequence.name}":`, err);
      const errorMessage = err instanceof Error ? err.message : `Failed to run sequence "${sequence.name}"`;
      showExecutionResults('error', 'Execution Error', 
        `Failed to start sequence "${sequence.name}"`, errorMessage);
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
    if (!projectId) {
      showExecutionResults('error', 'No Project Selected', 'Please select a project first');
      return;
    }
    
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
      const errorMessage = err instanceof Error ? err.message : 'Failed to save parameter mappings';
      showExecutionResults('error', 'Save Failed', 'Failed to save parameter mappings', errorMessage);
    }
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
            type: output.type, // We don't have type info, so default to unknown
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
{:else if !projectId}
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="bg-yellow-50 border border-yellow-200 rounded-md p-4">
      <div class="flex">
        <svg class="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
        </svg>
        <div>
          <h3 class="text-sm font-medium text-yellow-800">No Project Selected</h3>
          <p class="text-sm text-yellow-700 mt-1">Please select a project from the sidebar to view module sequences.</p>
        </div>
      </div>
    </div>
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
  <!-- Execution Results Toast -->
  {#if executionResults}
    <div class="fixed top-4 right-4 z-50 max-w-md w-full" transition:fade={{ duration: 300 }}>
      <div class="bg-white rounded-lg shadow-lg border-l-4 {executionResults.type === 'success' ? 'border-green-400' : executionResults.type === 'error' ? 'border-red-400' : 'border-yellow-400'} p-4">
        <div class="flex items-start">
          <div class="flex-shrink-0">
            {#if executionResults.type === 'success'}
              <svg class="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
            {:else if executionResults.type === 'error'}
              <svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
              </svg>
            {:else}
              <svg class="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
              </svg>
            {/if}
          </div>
          <div class="ml-3 flex-1">
            <h4 class="text-sm font-medium {executionResults.type === 'success' ? 'text-green-800' : executionResults.type === 'error' ? 'text-red-800' : 'text-yellow-800'}">
              {executionResults.title}
            </h4>
            <p class="mt-1 text-sm {executionResults.type === 'success' ? 'text-green-700' : executionResults.type === 'error' ? 'text-red-700' : 'text-yellow-700'}">
              {executionResults.message}
            </p>
            {#if executionResults.details}
              <p class="mt-1 text-xs {executionResults.type === 'success' ? 'text-green-600' : executionResults.type === 'error' ? 'text-red-600' : 'text-yellow-600'}">
                {executionResults.details}
              </p>
            {/if}
          </div>
          <div class="ml-4 flex-shrink-0">
            <button
              type="button"
              on:click={hideExecutionResults}
              aria-label="Close notification"
              class="inline-flex {executionResults.type === 'success' ? 'text-green-400 hover:text-green-500' : executionResults.type === 'error' ? 'text-red-400 hover:text-red-500' : 'text-yellow-400 hover:text-yellow-500'}"
            >
              <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <div class="min-h-screen bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Environment Selector and Run All Button -->
      <div class="bg-white shadow rounded-lg p-6 mb-6">
        <div class="flex items-center justify-between">
          <div class="flex-1 max-w-md">
            <SimplifiedEnvironmentSelector
              id="environment-selector"
              environment={projectEnvironment}
              {selectedSubEnvironment}
              placeholder="Select sub-environment..."
              on:select={handleEnvironmentSelect}
            />
          </div>
          
          <div class="ml-6 flex items-center space-x-3">
            <!-- Execution Options Button -->
            <button
              type="button"
              on:click={() => (showExecutionOptions = !showExecutionOptions)}
              disabled={isRunningAll || runningSequences.size > 0}
              class="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path>
              </svg>
              Options
            </button>
            
            <!-- Run All Button -->
            <button
              type="button"
              on:click={handleRunAllSequences}
              disabled={!canRunAll || isRunningAll}
              class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              title={!canRunAll ? 'Ensure project environment is configured and sequences have flows' : 'Run all sequences in this module'}
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
        
        {#if projectEnvironment && selectedSubEnvironment}
          <div class="mt-3 text-xs text-green-600">
            ✓ Ready to execute with project environment
          </div>
        {:else if !projectEnvironment}
          <div class="mt-3 text-xs text-yellow-600">
            ⚠ No environment configured for this project. Configure an environment in project settings to enable execution.
          </div>
        {:else}
          <div class="mt-3 text-xs text-gray-500">
            Configuring project environment...
          </div>
        {/if}
      </div>

      <!-- Execution Options Panel (Collapsible) -->
      {#if showExecutionOptions}
        <div class="bg-white shadow rounded-lg p-6 mb-6" transition:fade={{ duration: 150 }}>
          <h4 class="text-sm font-medium text-gray-700 mb-4">Flow Execution Options</h4>
          <p class="text-xs text-gray-500 mb-4">These options will be applied to each flow within the sequences when they execute.</p>
          
          <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div class="space-y-4">
              <div class="flex items-center">
                <input
                  type="checkbox"
                  id="parallelExecution"
                  class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  bind:checked={executionPreferences.parallelExecution}
                />
                <label for="parallelExecution" class="ml-2 block text-sm text-gray-700">
                  Parallel Execution
                </label>
              </div>
              <p class="ml-6 text-xs text-gray-500">
                Execute endpoints within each flow in parallel when possible
              </p>

              <div class="flex items-center">
                <input
                  type="checkbox"
                  id="stopOnError"
                  class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  bind:checked={executionPreferences.stopOnError}
                />
                <label for="stopOnError" class="ml-2 block text-sm text-gray-700">
                  Stop Sequence On Flow Error
                </label>
              </div>
              <p class="ml-6 text-xs text-gray-500">
                Stop the entire sequence if any individual flow fails
              </p>

              <div class="flex items-center">
                <input
                  type="checkbox"
                  id="serverCookieHandling"
                  class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  bind:checked={executionPreferences.serverCookieHandling}
                />
                <label for="serverCookieHandling" class="ml-2 block text-sm text-gray-700">
                  Use Server Proxy (Bypass CORS)
                </label>
              </div>
              <p class="ml-6 text-xs text-gray-500">
                Recommended for browser use to bypass CORS restrictions and handle cookies. Desktop app doesn't need this.
              </p>
            </div>

            <div class="space-y-4">
              <div>
                <label for="retryCount" class="block text-sm font-medium text-gray-700">
                  Retry Count
                </label>
                <input
                  type="number"
                  id="retryCount"
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  min="0"
                  max="5"
                  bind:value={executionPreferences.retryCount}
                />
                <p class="mt-1 text-xs text-gray-500">
                  Number of times to retry failed requests within each flow (0-5)
                </p>
              </div>

              <div>
                <label for="timeout" class="block text-sm font-medium text-gray-700">
                  Request Timeout (ms)
                </label>
                <input
                  type="number"
                  id="timeout"
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  min="1000"
                  max="300000"
                  step="1000"
                  bind:value={executionPreferences.timeout}
                />
                <p class="mt-1 text-xs text-gray-500">
                  Request timeout for each endpoint call (1-300 seconds)
                </p>
              </div>
            </div>
          </div>
        </div>
      {/if}

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
                  executionResults={sequenceResultsMap.get(sequence.id) || []}
                  selectedEnvironment={projectEnvironment}
                  {selectedSubEnvironment}
                  isRunning={runningSequences.has(sequence.id)}
                  on:editName={handleEditSequenceName}
                  on:addFlow={handleAddFlowToSequence}
                  on:removeFlow={handleRemoveFlowFromSequence}
                  on:clickFlow={handleFlowClick}
                  on:reorderFlow={handleReorderFlow}
                  on:deleteSequence={handleDeleteSequence}
                  on:cloneSequence={handleCloneSequence}
                  on:runSequence={handleRunSequence}
                  on:toggleExpectsError={handleToggleExpectsError}
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
  previousFlowOutputs={previousFlowOutputs}
  selectedEnvironment={projectEnvironment}
  selectedSubEnvironment={selectedSubEnvironment}
  on:close={handleParameterPanelClose}
  on:save={handleParameterPanelSave}
/>
