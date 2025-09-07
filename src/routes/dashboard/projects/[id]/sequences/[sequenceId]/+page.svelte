<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import * as projectClient from '$lib/http_client/projects';
  import * as sequenceClient from '$lib/http_client/sequences';
  import * as flowClient from '$lib/http_client/flows';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import FlowCard from '$lib/components/flows/FlowCard.svelte';
  import SequenceFlowList from '$lib/components/sequences/SequenceFlowList.svelte';
  import FlowParameterMapping from '$lib/components/sequences/FlowParameterMapping.svelte';
  import FlowSelectionModal from '$lib/components/sequences/FlowSelectionModal.svelte';
  import SequenceParameterEditor from '$lib/components/sequences/SequenceParameterEditor.svelte';
  import type { Project } from '$lib/http_client/projects';
  import type { Sequence } from '$lib/http_client/sequences';
  import type { Flow } from '$lib/http_client/flows';

  let project: Project | null = null;
  let sequence: Sequence | null = null;
  let loading = true;
  let error: string | null = null;

  // Component state
  let showFlowSelection = false;
  let showParameterMapping = false;
  let showParameterEditor = false;
  let selectedFlowForMapping: any = null;
  let selectedFlowDetails: any = null;

  // Get IDs from URL
  $: projectId = parseInt($page.params.id || '');
  $: sequenceId = parseInt($page.params.sequenceId || '');

  onMount(async () => {
    if (isNaN(projectId) || isNaN(sequenceId)) {
      error = 'Invalid project or sequence ID';
      loading = false;
      return;
    }
    
    await fetchData();
  });

  async function fetchData() {
    try {
      loading = true;
      error = null;

      // Only fetch project and sequence - load flows on demand when needed
      const [projectResult, sequenceResult] = await Promise.all([
        projectClient.getProject(projectId),
        sequenceClient.getSequence(sequenceId)
      ]);

      if (projectResult?.project) {
        project = projectResult.project;
      } else {
        error = 'Project not found';
        return;
      }

      if (sequenceResult?.sequence) {
        sequence = sequenceResult.sequence;
      } else {
        error = 'Sequence not found';
        return;
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      error = 'Failed to fetch data';
    } finally {
      loading = false;
    }
  }

  // Flow management
  async function handleAddFlowToSequence(flowId: number, order?: number) {
    if (!sequence) return;

    try {
      const updatedFlows = [...sequence.config.flows];
      
      // If order not specified, add to end
      const flowOrder = order ?? updatedFlows.length;
      
      // Add the flow reference
      updatedFlows.splice(flowOrder, 0, {
        test_flow_id: flowId,
        order_index: flowOrder,
        parameter_mappings: {}
      });

      // Update order for subsequent flows
      updatedFlows.forEach((flow, index) => {
        flow.order_index = index;
      });

      // Update sequence
      const updateData = {
        name: sequence.name,
        parameters: sequence.config.parameters,
        flows: updatedFlows
      };

      const result = await sequenceClient.updateSequence(sequence.id, updateData);
      if (result?.sequence) {
        sequence = result.sequence;
        showFlowSelection = false; // Close the selection modal
      }
    } catch (err) {
      console.error('Error adding flow to sequence:', err);
      error = err instanceof Error ? err.message : 'Failed to add flow to sequence';
    }
  }

  async function handleRemoveFlowFromSequence(flowOrderIndex: number) {
    if (!sequence) return;

    try {
      const updatedFlows = sequence.config.flows.filter(flow => flow.order_index !== flowOrderIndex);
      
      // Update order for remaining flows
      updatedFlows.forEach((flow, index) => {
        flow.order_index = index;
      });

      // Update sequence
      const updateData = {
        name: sequence.name,
        parameters: sequence.config.parameters,
        flows: updatedFlows
      };

      const result = await sequenceClient.updateSequence(sequence.id, updateData);
      if (result?.sequence) {
        sequence = result.sequence;
      }
    } catch (err) {
      console.error('Error removing flow from sequence:', err);
      error = err instanceof Error ? err.message : 'Failed to remove flow from sequence';
    }
  }

  async function handleMoveFlow(fromOrderIndex: number, toOrderIndex: number) {
    if (!sequence) return;

    try {
      const updatedFlows = [...sequence.config.flows];
      const [movedFlow] = updatedFlows.splice(fromOrderIndex, 1);
      updatedFlows.splice(toOrderIndex, 0, movedFlow);

      // Update order for all flows
      updatedFlows.forEach((flow, index) => {
        flow.order_index = index;
      });

      // Update sequence
      const updateData = {
        name: sequence.name,
        parameters: sequence.config.parameters,
        flows: updatedFlows
      };

      const result = await sequenceClient.updateSequence(sequence.id, updateData);
      if (result?.sequence) {
        sequence = result.sequence;
      }
    } catch (err) {
      console.error('Error moving flow:', err);
      error = err instanceof Error ? err.message : 'Failed to move flow';
    }
  }

  // Parameter mapping
  async function handleConfigureParameters(sequenceFlow: any) {
    try {
      selectedFlowForMapping = sequenceFlow;
      
      // Fetch the specific flow details
      const flowResult = await flowClient.getFlow(sequenceFlow.test_flow_id);
      console.log('Flow API response:', flowResult);
      
      if (flowResult?.testFlow) {
        selectedFlowDetails = flowResult.testFlow;
        console.log('Selected flow details:', {
          selectedFlowDetails,
          flowJson: selectedFlowDetails.flowJson,
          parameters: selectedFlowDetails.flowJson?.parameters,
          name: selectedFlowDetails.name
        });
        showParameterMapping = true;
      } else {
        error = 'Failed to load flow details';
      }
    } catch (err) {
      console.error('Error loading flow details:', err);
      error = 'Failed to load flow details';
    }
  }

  // Sequence parameter management
  async function handleUpdateSequenceParameters(parameters: Record<string, import('$lib/http_client/sequences').SequenceParameter>) {
    if (!sequence) return;

    try {
      const updateData = {
        name: sequence.name,
        parameters: parameters,
        flows: sequence.config.flows
      };

      const result = await sequenceClient.updateSequence(sequence.id, updateData);
      if (result?.sequence) {
        sequence = result.sequence;
        showParameterEditor = false;
      }
    } catch (err) {
      console.error('Error updating sequence parameters:', err);
      error = err instanceof Error ? err.message : 'Failed to update sequence parameters';
    }
  }

  async function handleUpdateFlowParameters(flowOrderIndex: number, parameters: any, parameterMappings: any) {
    if (!sequence) return;

    try {
      const updatedFlows = sequence.config.flows.map(flow => {
        if (flow.order_index === flowOrderIndex) {
          return {
            ...flow,
            parameter_mappings: parameterMappings
          };
        }
        return flow;
      });

      // Update sequence
      const updateData = {
        name: sequence.name,
        parameters: sequence.config.parameters,
        flows: updatedFlows
      };

      const result = await sequenceClient.updateSequence(sequence.id, updateData);
      if (result?.sequence) {
        sequence = result.sequence;
        showParameterMapping = false;
        selectedFlowForMapping = null;
        selectedFlowDetails = null;
      }
    } catch (err) {
      console.error('Error updating flow parameters:', err);
      error = err instanceof Error ? err.message : 'Failed to update flow parameters';
    }
  }

  // Debug reactive statement for component props
  $: if (showParameterMapping && selectedFlowDetails) {
    console.log('About to pass to FlowParameterMapping:', {
      flowParameters: selectedFlowDetails.flowJson?.parameters || [],
      flowParametersLength: (selectedFlowDetails.flowJson?.parameters || []).length,
      flowName: selectedFlowDetails.name || 'Unknown Flow',
      selectedFlowDetails: selectedFlowDetails,
      flowJson: selectedFlowDetails.flowJson,
      flowJsonExists: !!selectedFlowDetails.flowJson,
      parametersExists: !!selectedFlowDetails.flowJson?.parameters
    });
  }

  // Navigation
  function goBackToProject() {
    goto(`/dashboard/projects/${projectId}`);
  }

  function clearError() {
    error = null;
  }
</script>

<svelte:head>
  <title>{sequence?.name || 'Sequence'} | {project?.name || 'Project'} | Test Pilot</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
    <div class="flex-1">
      <div class="flex items-center space-x-2 mb-2">
        <button 
          class="text-blue-600 hover:text-blue-800 transition-colors"
          on:click={goBackToProject}
          aria-label="Back to project"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <nav class="flex" aria-label="Breadcrumb">
          <ol class="flex items-center space-x-2">
            <li>
              <button 
                class="text-sm text-gray-500 hover:text-gray-700"
                on:click={goBackToProject}
              >
                {project?.name || 'Project'}
              </button>
            </li>
            <li>
              <svg class="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
              </svg>
            </li>
            <li>
              <span class="text-sm text-gray-900 font-medium">
                {sequence?.name || 'Loading...'}
              </span>
            </li>
          </ol>
        </nav>
      </div>
      
      <h1 class="text-2xl font-bold text-gray-900">
        {sequence?.name || 'Loading...'}
      </h1>
      
      <!-- Sequence Stats -->
      {#if sequence}
        <div class="flex items-center space-x-4 text-sm text-gray-500 mt-2">
          <span class="flex items-center">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            {sequence.config.flows.length} flow{sequence.config.flows.length !== 1 ? 's' : ''}
          </span>
          {#if Object.keys(sequence.config.parameters).length > 0}
            <span class="flex items-center">
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
              {Object.keys(sequence.config.parameters).length} parameter{Object.keys(sequence.config.parameters).length !== 1 ? 's' : ''}
            </span>
          {/if}
        </div>
      {/if}
    </div>
    
    <div class="mt-4 sm:mt-0 flex space-x-3">
      <button
        type="button"
        class="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        on:click={() => showParameterEditor = true}
      >
        <svg class="-ml-0.5 mr-1.5 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
        </svg>
        Sequence Parameters
      </button>
      <button
        type="button"
        class="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        on:click={() => showFlowSelection = true}
      >
        <svg class="-ml-0.5 mr-1.5 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd" />
        </svg>
        Add Flow
      </button>
    </div>
  </div>

  <!-- Error Alert -->
  {#if error}
    <div class="rounded-md bg-red-50 p-4">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800">Error</h3>
          <div class="mt-2 text-sm text-red-700">
            <p>{error}</p>
          </div>
          <div class="mt-4">
            <button
              type="button"
              class="rounded-md bg-red-50 px-2 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-red-50"
              on:click={clearError}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Loading State -->
  {#if loading}
    <div class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  {:else if sequence}
    <!-- Sequence Flow List -->
    <SequenceFlowList
      {sequence}
      onAddFlow={handleAddFlowToSequence}
      onRemoveFlow={handleRemoveFlowFromSequence}
      onMoveFlow={handleMoveFlow}
      onConfigureParameters={handleConfigureParameters}
      onOpenFlowSelector={() => showFlowSelection = true}
    />
  {/if}
</div>

<!-- Flow Parameter Mapping Modal -->
{#if showParameterMapping && selectedFlowForMapping && selectedFlowDetails && sequence}
  <FlowParameterMapping
    sequenceFlow={selectedFlowForMapping}
    {sequence}
    flowParameters={selectedFlowDetails.flowJson?.parameters || []}
    flowName={selectedFlowDetails.name || 'Unknown Flow'}
    onSave={handleUpdateFlowParameters}
    onCancel={() => {
      showParameterMapping = false;
      selectedFlowForMapping = null;
      selectedFlowDetails = null;
    }}
  />
{/if}

<!-- Flow Selection Modal -->
<FlowSelectionModal
  isOpen={showFlowSelection}
  on:select={(event) => handleAddFlowToSequence(event.detail.flowId)}
  on:close={() => showFlowSelection = false}
/>

<!-- Sequence Parameter Editor Modal -->
<SequenceParameterEditor
  isOpen={showParameterEditor}
  parameters={sequence?.config?.parameters || {}}
  onSave={handleUpdateSequenceParameters}
  onCancel={() => showParameterEditor = false}
/>
