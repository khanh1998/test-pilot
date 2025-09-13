<!-- ModuleCard.svelte - Display module information in a card format -->
<script lang="ts">
  import type { ProjectModule } from '../../types/project.js';
  import { formatDate } from '../../utils/date.js';

  export let module: ProjectModule;
  export let href: string = `/dashboard/projects/${module.projectId}/modules/${module.id}`;
  export let showActions: boolean = true;
  export let onEdit: ((module: ProjectModule) => void) | null = null;
  export let onDelete: ((module: ProjectModule) => void) | null = null;
  export let isDragging: boolean = false;

  function handleEdit() {
    if (onEdit) {
      onEdit(module);
    }
  }

  function handleDelete() {
    if (onDelete && confirm(`Are you sure you want to delete module "${module.name}"?`)) {
      onDelete(module);
    }
  }
</script>

<div 
  class="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all duration-200"
  class:opacity-50={isDragging}
  class:shadow-lg={isDragging}
>
  <div class="flex items-start justify-between">
    <div class="flex-1">
      <a {href} class="block group">
        <h4 class="text-md font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
          {module.name}
        </h4>
        {#if module.description}
          <p class="text-sm text-gray-600 mt-1 line-clamp-2">
            {module.description}
          </p>
        {/if}
      </a>
      
      <div class="flex items-center gap-4 mt-3 text-sm text-gray-500">
        <span>Created {formatDate(module.createdAt)}</span>
        {#if module.updatedAt !== module.createdAt}
          <span>Updated {formatDate(module.updatedAt)}</span>
        {/if}
      </div>

      <!-- Module Stats -->
      <div class="flex items-center gap-3 mt-2">
        <div class="flex items-center text-sm text-gray-600">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
          {module.sequenceCount || 0} sequences
        </div>
        <div class="flex items-center text-sm text-gray-600">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2h4a1 1 0 011 1v1a1 1 0 01-1 1h-1v9a2 2 0 01-2 2H6a2 2 0 01-2-2V7H3a1 1 0 01-1-1V5a1 1 0 011-1h4z"/>
          </svg>
          Order: {module.displayOrder}
        </div>
      </div>
    </div>

    <div class="flex items-center gap-2 ml-4">
      <!-- Drag Handle -->
      <div class="drag-handle p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-move">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4"/>
        </svg>
      </div>

      {#if showActions && (onEdit || onDelete)}
        {#if onEdit}
          <button
            on:click={handleEdit}
            class="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Edit module"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
        {/if}
        {#if onDelete}
          <button
            on:click={handleDelete}
            class="p-1 text-gray-400 hover:text-red-600 transition-colors"
            aria-label="Delete module"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
