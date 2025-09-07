<script lang="ts">
  import type { Project } from '$lib/http_client/projects';
  
  export let project: Project;
  export let onDelete: (id: number, name: string) => void;
  export let onEdit: (project: Project) => void;
  export let sequenceCount: number = 0;
  export let apiCount: number = 0;
</script>

<div class="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
  <div class="p-4">
    <div class="flex items-start justify-between mb-2">
      <h3 class="truncate text-lg font-semibold text-gray-900 flex-1 mr-2">
        <a href="/dashboard/projects/{project.id}" class="hover:text-blue-600 transition-colors">
          {project.name}
        </a>
      </h3>
      <div class="flex items-center space-x-1">
        <button
          class="p-1 rounded hover:bg-gray-100 transition-colors"
          on:click={() => onEdit(project)}
          title="Edit project"
          aria-label="Edit project"
        >
          <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button
          class="p-1 rounded hover:bg-red-100 transition-colors"
          on:click={() => onDelete(project.id, project.name)}
          title="Delete project"
          aria-label="Delete project"
        >
          <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
    
    <p class="mb-3 line-clamp-2 text-sm text-gray-600 min-h-[2.5rem]">
      {project.description || 'No description'}
    </p>

    <!-- Stats Section -->
    <div class="flex items-center space-x-4 mb-3">
      <div class="flex items-center text-xs text-gray-500">
        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        {sequenceCount} sequence{sequenceCount !== 1 ? 's' : ''}
      </div>
      <div class="flex items-center text-xs text-gray-500">
        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2v0a2 2 0 01-2-2v-2a2 2 0 00-2-2H8z" />
        </svg>
        {apiCount} API{apiCount !== 1 ? 's' : ''}
      </div>
    </div>

    <!-- Variables Section -->
    {#if Object.keys(project.config.variables).length > 0}
      <div class="mb-3">
        <div class="flex flex-wrap gap-1">
          {#each Object.keys(project.config.variables).slice(0, 3) as varName}
            <span class="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
              {varName}
            </span>
          {/each}
          {#if Object.keys(project.config.variables).length > 3}
            <span class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              +{Object.keys(project.config.variables).length - 3} more variables
            </span>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Environment Badge -->
    {#if project.config.environment_id}
      <div class="mb-3">
        <span class="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
          <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Environment linked
        </span>
      </div>
    {/if}

    <!-- Date -->
    <div class="flex items-center justify-between text-xs text-gray-500">
      <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
      <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
    </div>
  </div>
</div>
