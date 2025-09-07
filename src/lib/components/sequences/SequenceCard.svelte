<script lang="ts">
  import type { Sequence } from '$lib/http_client/sequences';
  
  export let sequence: Sequence;
  export let onDelete: (id: number, name: string) => void;
  export let onEdit: (sequence: Sequence) => void;
  export let flowCount: number = 0;
</script>

<div class="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
  <div class="p-4">
    <div class="flex items-start justify-between mb-2">
      <h3 class="truncate text-lg font-semibold text-gray-900 flex-1 mr-2">
        <a href="/dashboard/projects/{sequence.projectId}/sequences/{sequence.id}" class="hover:text-blue-600 transition-colors">
          {sequence.name}
        </a>
      </h3>
      <div class="flex items-center space-x-1">
        <button
          class="p-1 rounded hover:bg-gray-100 transition-colors"
          on:click={() => onEdit(sequence)}
          title="Edit sequence"
          aria-label="Edit sequence"
        >
          <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button
          class="p-1 rounded hover:bg-red-100 transition-colors"
          on:click={() => onDelete(sequence.id, sequence.name)}
          title="Delete sequence"
          aria-label="Delete sequence"
        >
          <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Stats Section -->
    <div class="flex items-center space-x-4 mb-3">
      <div class="flex items-center text-xs text-gray-500">
        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        {flowCount} flow{flowCount !== 1 ? 's' : ''}
      </div>
      <div class="flex items-center text-xs text-gray-500">
        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
        </svg>
        Order: {sequence.orderIndex}
      </div>
    </div>

    <!-- Parameters Section -->
    {#if sequence.config?.parameters && Object.keys(sequence.config.parameters).length > 0}
      <div class="mb-3">
        <div class="flex flex-wrap gap-1">
          {#each Object.keys(sequence.config.parameters).slice(0, 3) as paramName}
            <span class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
              {paramName}
            </span>
          {/each}
          {#if Object.keys(sequence.config.parameters).length > 3}
            <span class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              +{Object.keys(sequence.config.parameters).length - 3} more parameters
            </span>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Flows Preview -->
    {#if sequence.config?.flows && sequence.config.flows.length > 0}
      <div class="mb-3">
        <div class="text-xs text-gray-500 mb-1">Flow IDs:</div>
        <div class="flex flex-wrap gap-1">
          {#each sequence.config.flows.slice(0, 4) as flow}
            <span class="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
              {flow.test_flow_id}
            </span>
          {/each}
          {#if sequence.config.flows.length > 4}
            <span class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              +{sequence.config.flows.length - 4} more
            </span>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Date -->
    <div class="flex items-center justify-between text-xs text-gray-500">
      <span>Created {new Date(sequence.createdAt).toLocaleDateString()}</span>
      <span>Updated {new Date(sequence.updatedAt).toLocaleDateString()}</span>
    </div>
  </div>
</div>
