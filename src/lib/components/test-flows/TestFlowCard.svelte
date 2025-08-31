<script lang="ts">
  interface FlowData {
    id: number;
    name: string;
    description: string;
    apis: { id: number; name: string }[];
    createdAt: string;
    updatedAt: string;
  }

  export let flow: FlowData;
  export let onDelete: (id: number, name: string) => void;
  export let onClone: (flow: FlowData) => void;
</script>

<div class="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
  <div class="p-4">
    <h3 class="mb-2 truncate text-lg font-semibold text-gray-900">{flow.name}</h3>
    <p class="mb-3 line-clamp-2 text-sm text-gray-600 min-h-[2.5rem]">
      {flow.description || 'No description'}
    </p>

    <!-- APIs Section - More Compact -->
    {#if flow.apis.length > 0}
      <div class="mb-3">
        <div class="flex flex-wrap gap-1">
          {#each flow.apis.slice(0, 3) as api (api.id)}
            <span class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
              {api.name}
            </span>
          {/each}
          {#if flow.apis.length > 3}
            <span class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              +{flow.apis.length - 3} more
            </span>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Date and Actions -->
    <div class="flex items-center justify-between text-xs text-gray-500 mb-3">
      <span>{new Date(flow.createdAt).toLocaleDateString()}</span>
    </div>

    <!-- Action Buttons - Compact -->
    <div class="flex justify-between gap-1">
      <div class="flex gap-1">
        <button
          class="inline-flex items-center rounded bg-red-50 px-2 py-1 text-xs text-red-700 transition hover:bg-red-100"
          on:click={() => onDelete(flow.id, flow.name)}
        >
          <svg class="mr-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
          Delete
        </button>
        <button
          class="inline-flex items-center rounded bg-green-50 px-2 py-1 text-xs text-green-700 transition hover:bg-green-100"
          on:click={() => onClone(flow)}
        >
          <svg class="mr-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
          </svg>
          Clone
        </button>
      </div>
      <a
        href="/dashboard/test-flows/{flow.id}"
        class="inline-flex items-center rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 transition hover:bg-blue-100"
      >
        <svg class="mr-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
        </svg>
        Edit
      </a>
    </div>
  </div>
</div>
