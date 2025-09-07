<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { Sequence } from '$lib/http_client/sequences';
  import type { Flow } from '$lib/http_client/flows';
  import * as flowClient from '$lib/http_client/flows';
  import FlowCard from '$lib/components/flows/FlowCard.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';

  export let sequence: Sequence;
  export let onAddFlow: (flowId: number, order?: number) => void = () => {};
  export let onRemoveFlow: (orderIndex: number) => void = () => {};
  export let onMoveFlow: (fromOrder: number, toOrder: number) => void = () => {};
  export let onConfigureParameters: (sequenceFlow: any) => void = () => {};
  export let onOpenFlowSelector: () => void = () => {};

  let draggedItem: number | null = null;
  let dragOverItem: number | null = null;
  let showConfirmDelete = false;
  let pendingDeleteFlow: { orderIndex: number; flowName: string } | null = null;
  let sequenceFlowDetails: Record<number, Flow> = {}; // Cache for flow details

  // Fetch flow details for flows in the sequence
  async function fetchFlowDetails(flowIds: number[]) {
    try {
      // Only fetch flows we don't already have
      const missingFlowIds = flowIds.filter(id => !sequenceFlowDetails[id]);
      
      if (missingFlowIds.length === 0) return;

      // Fetch each flow individually
      const flowPromises = missingFlowIds.map(async (flowId) => {
        try {
          const result = await flowClient.getFlow(flowId);
          if (result?.testFlow) {
            return { id: flowId, flow: result.testFlow };
          }
          return null;
        } catch (error) {
          console.error(`Error fetching flow ${flowId}:`, error);
          return null;
        }
      });

      const results = await Promise.all(flowPromises);
      
      // Update our cache with the results
      results.forEach(result => {
        if (result) {
          sequenceFlowDetails[result.id] = result.flow;
        }
      });
      
      // Trigger reactivity
      sequenceFlowDetails = { ...sequenceFlowDetails };
    } catch (error) {
      console.error('Error fetching flow details:', error);
    }
  }

  // Load flow details when sequence changes
  $: if (sequence?.config?.flows) {
    const flowIds = sequence.config.flows.map(f => f.test_flow_id);
    fetchFlowDetails(flowIds);
  }

  // Get flows that are not already in the sequence
  // Note: availableFlows removed since flow selection is handled by separate modal

  // Get flow details for sequence flows
  $: sequenceFlowsWithDetails = sequence.config.flows
    .sort((a, b) => a.order_index - b.order_index)
    .map(seqFlow => {
      // Use cached flow details only
      const flowDetails = sequenceFlowDetails[seqFlow.test_flow_id] || null;
      return {
        ...seqFlow,
        flowDetails
      };
    });

  function handleAddFlow(flow: Flow) {
    onAddFlow(flow.id);
    // Modal handled by parent component
  }

  function handleRemoveFlow(orderIndex: number) {
    const sequenceFlow = sequence.config.flows.find(f => f.order_index === orderIndex);
    const flowDetails = sequenceFlowDetails[sequenceFlow?.test_flow_id || 0] || null;
    
    pendingDeleteFlow = {
      orderIndex,
      flowName: flowDetails?.name || 'Unknown Flow'
    };
    showConfirmDelete = true;
  }

  function confirmRemoveFlow() {
    if (pendingDeleteFlow) {
      onRemoveFlow(pendingDeleteFlow.orderIndex);
    }
    showConfirmDelete = false;
    pendingDeleteFlow = null;
  }

  function cancelRemoveFlow() {
    showConfirmDelete = false;
    pendingDeleteFlow = null;
  }

  function handleConfigureParameters(sequenceFlow: any) {
    onConfigureParameters(sequenceFlow);
  }

  // Drag and drop handlers
  function handleDragStart(event: DragEvent, orderIndex: number) {
    draggedItem = orderIndex;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  function handleDragOver(event: DragEvent, orderIndex: number) {
    event.preventDefault();
    dragOverItem = orderIndex;
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  function handleDragLeave() {
    dragOverItem = null;
  }

  function handleDrop(event: DragEvent, toOrderIndex: number) {
    event.preventDefault();
    
    if (draggedItem !== null && draggedItem !== toOrderIndex) {
      onMoveFlow(draggedItem, toOrderIndex);
    }
    
    draggedItem = null;
    dragOverItem = null;
  }

  function handleDragEnd() {
    draggedItem = null;
    dragOverItem = null;
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <h3 class="text-lg font-semibold text-gray-900">Test Flows</h3>
  </div>

  <!-- Sequence Flow List -->
  {#if sequenceFlowsWithDetails.length === 0}
    <div class="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
      <h3 class="mt-2 text-sm font-semibold text-gray-900">No flows in sequence</h3>
      <p class="mt-1 text-sm text-gray-500">Get started by adding your first test flow to this sequence.</p>
      <div class="mt-6">
        <button
          type="button"
          class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          on:click={onOpenFlowSelector}
        >
          <svg class="-ml-0.5 mr-1.5 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd" />
          </svg>
          Add Flow
        </button>
      </div>
    </div>
  {:else}
    <div class="space-y-4">
      {#each sequenceFlowsWithDetails as sequenceFlow, index (sequenceFlow.order_index)}
        <div
          class="bg-white rounded-lg border border-gray-200 p-4 {dragOverItem === sequenceFlow.order_index ? 'border-blue-500 bg-blue-50' : ''}"
          draggable="true"
          on:dragstart={(e) => handleDragStart(e, sequenceFlow.order_index)}
          on:dragover={(e) => handleDragOver(e, sequenceFlow.order_index)}
          on:dragleave={handleDragLeave}
          on:drop={(e) => handleDrop(e, sequenceFlow.order_index)}
          on:dragend={handleDragEnd}
          role="listitem"
        >
          <div class="flex items-center space-x-4">
            <!-- Drag Handle -->
            <div class="flex-shrink-0 cursor-move text-gray-400 hover:text-gray-600">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
              </svg>
            </div>

            <!-- Order Number -->
            <div class="flex-shrink-0">
              <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                {index + 1}
              </span>
            </div>

            <!-- Flow Info -->
            <div class="flex-1 min-w-0">
              {#if sequenceFlow.flowDetails}
                <div class="flex items-center justify-between">
                  <div>
                    <h4 class="text-lg font-medium text-gray-900 truncate">
                      {sequenceFlow.flowDetails.name}
                    </h4>
                    {#if sequenceFlow.flowDetails.description}
                      <p class="text-sm text-gray-600 truncate">
                        {sequenceFlow.flowDetails.description}
                      </p>
                    {/if}
                    <div class="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                      <span class="flex items-center">
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                        {sequenceFlow.flowDetails.flowJson?.steps?.length || 0} steps
                      </span>
                      <span class="flex items-center">
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                        </svg>
                        {Object.keys(sequenceFlow.parameter_mappings || {}).length} mappings
                      </span>
                    </div>
                  </div>
                </div>
              {:else}
                <div class="text-red-600">
                  <h4 class="text-lg font-medium">Flow not found (ID: {sequenceFlow.test_flow_id})</h4>
                  <p class="text-sm">This flow may have been deleted.</p>
                </div>
              {/if}
            </div>

            <!-- Actions -->
            <div class="flex items-center space-x-2">
              <button
                type="button"
                class="inline-flex items-center p-2 border border-transparent text-sm font-medium rounded text-gray-400 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                on:click={() => handleConfigureParameters(sequenceFlow)}
                aria-label="Configure parameters"
                title="Configure parameters"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <button
                type="button"
                class="inline-flex items-center p-2 border border-transparent text-sm font-medium rounded text-gray-400 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                on:click={() => handleRemoveFlow(sequenceFlow.order_index)}
                aria-label="Remove flow"
                title="Remove flow"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Confirm Delete Dialog -->
{#if showConfirmDelete && pendingDeleteFlow}
  <ConfirmDialog
    isOpen={showConfirmDelete}
    title="Remove Flow from Sequence"
    message="Are you sure you want to remove '{pendingDeleteFlow.flowName}' from this sequence? This will not delete the flow itself."
    confirmText="Remove"
    confirmVariant="danger"
    on:confirm={confirmRemoveFlow}
    on:cancel={cancelRemoveFlow}
  />
{/if}
