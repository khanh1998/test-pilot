<script lang="ts">
  import { projectStore } from '$lib/store/project';
  import type { Project } from '$lib/store/project';

  interface Props {
    project: Project;
    onSelect: () => void;
  }

  let { project, onSelect }: Props = $props();

  let showDeleteConfirm = $state(false);
  let showEditModal = $state(false);
  let isDeleting = $state(false);
  let isUpdating = $state(false);
  let updateError: string | null = $state(null);
  let editForm = $state({
    name: project.name,
    description: project.description || ''
  });
  let nameInputElement = $state<HTMLInputElement>();

  function handleSelect() {
    onSelect();
  }

  function handleEdit(event: MouseEvent) {
    event.stopPropagation();
    // Reset form with current project data
    editForm = {
      name: project.name,
      description: project.description || ''
    };
    updateError = null;
    showEditModal = true;
    
    // Focus the name input after modal opens
    setTimeout(() => {
      if (nameInputElement) {
        nameInputElement.focus();
      }
    }, 100);
  }

  function closeEditModal() {
    showEditModal = false;
    updateError = null;
    isUpdating = false;
  }

  async function handleUpdateProject(event?: Event) {
    if (event) {
      event.preventDefault();
    }

    // Client-side validation
    const name = editForm.name.trim();
    const description = editForm.description.trim();

    if (!name) {
      updateError = 'Project name is required';
      return;
    }

    if (name.length > 100) {
      updateError = 'Project name cannot exceed 100 characters';
      return;
    }

    if (description.length > 500) {
      updateError = 'Description cannot exceed 500 characters';
      return;
    }

    isUpdating = true;
    updateError = null;

    try {
      await projectStore.updateProject(project.id, {
        name: name,
        description: description || undefined
      });
      closeEditModal();
    } catch (error: any) {
      updateError = error.message || 'Failed to update project';
    } finally {
      isUpdating = false;
    }
  }

  function handleEditKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeEditModal();
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleUpdateProject(event);
    }
  }

  function handleDelete(event: MouseEvent) {
    event.stopPropagation();
    showDeleteConfirm = true;
  }

  async function confirmDelete() {
    isDeleting = true;
    try {
      await projectStore.deleteProject(project.id);
      showDeleteConfirm = false;
    } catch (error) {
      console.error('Failed to delete project:', error);
    } finally {
      isDeleting = false;
    }
  }

  function formatDate(date: string | Date) {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
</script>

<div 
  class="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200 hover:shadow-md transition-shadow duration-200 cursor-pointer" 
  onclick={handleSelect}
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(); } }}
  role="button"
  tabindex="0"
  aria-label={`Select project ${project.name}`}
>
  <div class="px-6 py-4">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-medium text-gray-900 truncate">{project.name}</h3>
      <div class="flex space-x-2">
        <button
          type="button"
          onclick={handleEdit}
          class="p-1 text-gray-400 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded transition-colors"
          aria-label="Edit project"
          title="Edit project details"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          type="button"
          onclick={handleDelete}
          class="p-1 text-gray-400 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
          aria-label="Delete project"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
    
    {#if project.description}
      <p class="mt-2 text-sm text-gray-600 line-clamp-2">
        {project.description}
      </p>
    {:else}
      <p class="mt-2 text-sm text-gray-400 italic">
        No description
      </p>
    {/if}
    
    <div class="mt-4 flex items-center justify-between text-xs text-gray-500">
      <span>Created {formatDate(project.createdAt)}</span>
      <div class="flex items-center space-x-4">
        <span class="flex items-center text-gray-400">
          <svg class="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Click to edit
        </span>
        <span class="text-blue-600 font-medium">
          Select →
        </span>
      </div>
    </div>
  </div>
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4" onclick={(e) => { if (e.target === e.currentTarget) showDeleteConfirm = false; }}>
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
      <div class="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
        <svg class="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      
      <div class="text-center">
        <h3 class="text-lg font-medium text-gray-900 mb-2">Delete Project</h3>
        <p class="text-gray-600 mb-6">
          Are you sure you want to delete "<strong>{project.name}</strong>"? 
          This action cannot be undone and will permanently delete all associated data.
        </p>
        
        <div class="flex justify-end space-x-3">
          <button
            type="button"
            onclick={() => showDeleteConfirm = false}
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            onclick={confirmDelete}
            class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isDeleting}
          >
            {#if isDeleting}
              <div class="flex items-center">
                <svg class="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Deleting...
              </div>
            {:else}
              Delete Project
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Project Modal -->
{#if showEditModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
    class="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4"
    onclick={(e) => {
      if (e.target === e.currentTarget) closeEditModal();
    }}
  >
    <!-- Modal content -->
    <div 
      class="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
      onkeydown={handleEditKeydown}
    >
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-900">Edit Project</h2>
        <button
          type="button"
          onclick={closeEditModal}
          class="text-gray-400 hover:text-gray-600"
          aria-label="Close modal"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <form onsubmit={handleUpdateProject}>
        <div class="space-y-4">
          <!-- Project Name -->
          <div>
            <div class="flex justify-between items-center mb-1">
              <label for="edit-project-name" class="block text-sm font-medium text-gray-700">
                Project Name <span class="text-red-500">*</span>
              </label>
              <span class="text-xs text-gray-500">
                {editForm.name.length}/100
              </span>
            </div>
            <input
              id="edit-project-name"
              type="text"
              bind:this={nameInputElement}
              bind:value={editForm.name}
              placeholder="Enter project name"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {editForm.name.length > 100 ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}"
              maxlength="255"
              required
              disabled={isUpdating}
            />
            {#if editForm.name.length > 100}
              <p class="mt-1 text-xs text-red-600">
                Project name cannot exceed 100 characters
              </p>
            {/if}
          </div>
          
          <!-- Project Description -->
          <div>
            <div class="flex justify-between items-center mb-1">
              <label for="edit-project-description" class="block text-sm font-medium text-gray-700">
                Description
              </label>
              <span class="text-xs text-gray-500">
                {editForm.description.length}/500
              </span>
            </div>
            <textarea
              id="edit-project-description"
              bind:value={editForm.description}
              placeholder="Enter project description (optional)"
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none {editForm.description.length > 500 ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}"
              maxlength="1000"
              disabled={isUpdating}
            ></textarea>
            {#if editForm.description.length > 500}
              <p class="mt-1 text-xs text-red-600">
                Description cannot exceed 500 characters
              </p>
            {/if}
          </div>
        </div>
        
        <!-- Error message -->
        {#if updateError}
          <div class="mt-3 text-sm text-red-600">
            {updateError}
          </div>
        {/if}
        
        <!-- Modal actions -->
        <div class="flex justify-end space-x-3 mt-6">
          <button
            type="button"
            onclick={closeEditModal}
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
            disabled={isUpdating}
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isUpdating || !editForm.name.trim() || editForm.name.length > 100 || editForm.description.length > 500}
          >
            {#if isUpdating}
              <div class="flex items-center">
                <svg class="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Updating...
              </div>
            {:else}
              Update Project
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>