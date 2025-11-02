<script lang="ts">
  import { projectStore } from '$lib/store/project';
  import type { Project } from '$lib/store/project';

  interface Props {
    onClose: () => void;
    onProjectCreated: (project: Project) => void;
  }

  let { onClose, onProjectCreated }: Props = $props();

  let createProjectForm = $state({
    name: '',
    description: ''
  });
  let isCreating = $state(false);
  let createError: string | null = $state(null);
  let nameInputElement = $state<HTMLInputElement>();

  // Focus the name input when modal opens
  $effect(() => {
    setTimeout(() => {
      if (nameInputElement) {
        nameInputElement.focus();
      }
    }, 100);
  });

  async function handleCreateProject(event?: Event) {
    if (event) {
      event.preventDefault();
    }

    // Client-side validation
    const name = createProjectForm.name.trim();
    const description = createProjectForm.description.trim();

    if (!name) {
      createError = 'Project name is required';
      return;
    }

    if (name.length > 100) {
      createError = 'Project name cannot exceed 100 characters';
      return;
    }

    if (description.length > 500) {
      createError = 'Description cannot exceed 500 characters';
      return;
    }

    isCreating = true;
    createError = null;

    try {
      const projectData = {
        name: name,
        description: description || undefined,
        apiIds: [] // Empty array for now - user can add APIs later
      };

      const project = await projectStore.createProject(projectData);
      onProjectCreated(project);
    } catch (error: any) {
      createError = error.message || 'Failed to create project';
    } finally {
      isCreating = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose();
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleCreateProject(event);
    }
  }
</script>

<!-- Modal backdrop -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  class="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4"
  onclick={(e) => {
    if (e.target === e.currentTarget) onClose();
  }}
>
  <!-- Modal content -->
  <div 
    class="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
    onkeydown={handleKeydown}
  >
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-gray-900">Create New Project</h2>
      <button
        type="button"
        onclick={onClose}
        class="text-gray-400 hover:text-gray-600"
        aria-label="Close modal"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    
    <form onsubmit={handleCreateProject}>
      <div class="space-y-4">
        <!-- Project Name -->
        <div>
          <div class="flex justify-between items-center mb-1">
            <label for="project-name" class="block text-sm font-medium text-gray-700">
              Project Name <span class="text-red-500">*</span>
            </label>
            <span class="text-xs text-gray-500">
              {createProjectForm.name.length}/100
            </span>
          </div>
          <input
            id="project-name"
            type="text"
            bind:this={nameInputElement}
            bind:value={createProjectForm.name}
            placeholder="Enter project name"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {createProjectForm.name.length > 100 ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}"
            maxlength="255"
            required
            disabled={isCreating}
          />
          {#if createProjectForm.name.length > 100}
            <p class="mt-1 text-xs text-red-600">
              Project name cannot exceed 100 characters
            </p>
          {/if}
        </div>
        
        <!-- Project Description -->
        <div>
          <div class="flex justify-between items-center mb-1">
            <label for="project-description" class="block text-sm font-medium text-gray-700">
              Description
            </label>
            <span class="text-xs text-gray-500">
              {createProjectForm.description.length}/500
            </span>
          </div>
          <textarea
            id="project-description"
            bind:value={createProjectForm.description}
            placeholder="Enter project description (optional)"
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none {createProjectForm.description.length > 500 ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}"
            maxlength="1000"
            disabled={isCreating}
          ></textarea>
          {#if createProjectForm.description.length > 500}
            <p class="mt-1 text-xs text-red-600">
              Description cannot exceed 500 characters
            </p>
          {/if}
        </div>
      </div>
      
      <!-- Error message -->
      {#if createError}
        <div class="mt-3 text-sm text-red-600">
          {createError}
        </div>
      {/if}
      
      <!-- Modal actions -->
      <div class="flex justify-end space-x-3 mt-6">
        <button
          type="button"
          onclick={onClose}
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
          disabled={isCreating}
        >
          Cancel
        </button>
        <button
          type="submit"
          class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isCreating || !createProjectForm.name.trim() || createProjectForm.name.length > 100 || createProjectForm.description.length > 500}
        >
          {#if isCreating}
            <div class="flex items-center">
              <svg class="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating...
            </div>
          {:else}
            Create Project
          {/if}
        </button>
      </div>
    </form>
  </div>
</div>