<!-- ProjectCard.svelte - Display project information in a card format -->
<script lang="ts">
  import type { Project } from '../../types/project.js';
  import { formatDate } from '$lib/utils/date.js';

  export let project: Project;
  export let href: string = `/dashboard/projects/${project.id}`;
  export let showActions: boolean = true;
  export let onEdit: ((project: Project) => void) | null = null;
  export let onDelete: ((project: Project) => void) | null = null;

  function handleEdit() {
    if (onEdit) {
      onEdit(project);
    }
  }

  function handleDelete() {
    if (onDelete && confirm(`Are you sure you want to delete "${project.name}"?`)) {
      onDelete(project);
    }
  }
</script>

<div class="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
  <div class="flex items-start justify-between">
    <div class="flex-1">
      <a {href} class="block group">
        <h3 class="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
          {project.name}
        </h3>
        {#if project.description}
          <p class="text-sm text-gray-600 mt-1 line-clamp-2">
            {project.description}
          </p>
        {/if}
      </a>
      
      <div class="flex items-center gap-4 mt-3 text-sm text-gray-500">
        <span>Created {formatDate(project.createdAt)}</span>
        {#if project.updatedAt !== project.createdAt}
          <span>Updated {formatDate(project.updatedAt)}</span>
        {/if}
      </div>

      <!-- Project Stats -->
      <div class="flex items-center gap-4 mt-3">
        <div class="flex items-center text-sm text-gray-600">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
          </svg>
          {project.moduleCount || 0} modules
        </div>
        <div class="flex items-center text-sm text-gray-600">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
          {project.sequenceCount || 0} sequences
        </div>
        <div class="flex items-center text-sm text-gray-600">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
          </svg>
          {project.environmentCount || 0} environments
        </div>
      </div>
    </div>

    {#if showActions && (onEdit || onDelete)}
      <div class="flex items-center gap-2 ml-4">
        {#if onEdit}
          <button
            on:click={handleEdit}
            class="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Edit project"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
        {/if}
        {#if onDelete}
          <button
            on:click={handleDelete}
            class="p-2 text-gray-400 hover:text-red-600 transition-colors"
            aria-label="Delete project"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        {/if}
      </div>
    {/if}
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
