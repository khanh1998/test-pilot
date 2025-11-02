<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { projectStore, type Project } from '$lib/store/project';
  import * as projectClient from '$lib/http_client/projects';
  import ModuleCard from '$lib/components/modules/ModuleCard.svelte';
  import ModuleForm from '$lib/components/modules/ModuleForm.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import type { ProjectModule } from '$lib/types/project';

  let modules = $state<ProjectModule[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Modal states
  let showCreateModuleModal = $state(false);
  let showConfirmDialog = $state(false);
  let isSubmitting = $state(false);

  // Delete state
  let pendingDeleteModule = $state<{ id: number; name: string } | null>(null);

  // Get current project from store
  let selectedProject = $state<Project | null>(null);
  let storeError = $state<string | null>(null);
  let storeLoading = $state(false);

  // Subscribe to project store
  const unsubscribe = projectStore.subscribe((state) => {
    selectedProject = state.selectedProject;
    storeError = state.error;
    storeLoading = state.isLoading;
  });

  onMount(async () => {
    // Ensure projects are loaded
    if (!selectedProject && !storeLoading) {
      await projectStore.loadProjects();
    }
  });

  $effect(() => {
    // Reactive effect to reload modules when selected project changes
    if (selectedProject) {
      loadModules();
    } else {
      modules = [];
      loading = false;
    }
  });

  async function loadModules() {
    if (!selectedProject) {
      loading = false;
      return;
    }

    try {
      loading = true;
      error = null;
      const response = await projectClient.getProjectModules(selectedProject.id);
      modules = response.modules || [];
    } catch (err) {
      console.error('Failed to load modules:', err);
      error = err instanceof Error ? err.message : 'Failed to load modules';
    } finally {
      loading = false;
    }
  }

  async function handleCreateModule(event: CustomEvent<{ module: Partial<ProjectModule> }>) {
    if (!selectedProject) return;
    
    const { module: moduleData } = event.detail;
    
    try {
      isSubmitting = true;
      const response = await projectClient.createModule(selectedProject.id, {
        name: moduleData.name!,
        description: moduleData.description
      });
      
      modules = [...modules, response.module];
      showCreateModuleModal = false;
    } catch (err) {
      console.error('Failed to create module:', err);
      error = err instanceof Error ? err.message : 'Failed to create module';
    } finally {
      isSubmitting = false;
    }
  }

  function handleEditModule(module: ProjectModule) {
    if (!selectedProject) return;
    goto(`/projects/modules/${module.id}`);
  }

  function handleDeleteModule(module: ProjectModule) {
    pendingDeleteModule = { id: module.id, name: module.name };
    showConfirmDialog = true;
  }

  async function confirmDeleteModule() {
    if (!pendingDeleteModule || !selectedProject) return;
    
    try {
      await projectClient.deleteModule(selectedProject.id, pendingDeleteModule.id);
      modules = modules.filter(m => m.id !== pendingDeleteModule!.id);
      showConfirmDialog = false;
      pendingDeleteModule = null;
    } catch (err) {
      console.error('Failed to delete module:', err);
      error = err instanceof Error ? err.message : 'Failed to delete module';
    }
  }

  function cancelDelete() {
    showConfirmDialog = false;
    pendingDeleteModule = null;
  }

  function openCreateModuleModal() {
    showCreateModuleModal = true;
  }

  function closeCreateModuleModal() {
    showCreateModuleModal = false;
  }
</script>

<svelte:head>
  <title>Modules - Test Pilot</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    
    <!-- Page Header -->
    <div class="mb-8">
      <div class="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Modules
          </h1>
          <p class="mt-1 text-sm text-gray-500">
            {#if selectedProject}
              Modules in <span class="font-medium">{selectedProject.name}</span>
            {:else}
              Select a project to view its modules
            {/if}
          </p>
        </div>
        {#if selectedProject}
          <div class="mt-4 sm:ml-4 sm:mt-0">
            <button
              type="button"
              onclick={openCreateModuleModal}
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <svg class="-ml-0.5 mr-1.5 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Module
            </button>
          </div>
        {/if}
      </div>
    </div>

    <!-- Content -->
    {#if storeLoading}
      <div class="flex justify-center items-center py-12">
        <div class="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
      </div>
    {:else if storeError}
      <div class="bg-red-50 border border-red-200 rounded-md p-4">
        <div class="flex">
          <svg class="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
          </svg>
          <p class="text-sm text-red-700">{storeError}</p>
        </div>
      </div>
    {:else if !selectedProject}
      <!-- No project selected -->
      <div class="text-center py-12 bg-white rounded-lg shadow">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-4.5B6 6.75 6 9.375v1.875m13.5 2.25a2.625 2.625 0 0 1-2.625 2.625H6.375A2.625 2.625 0 0 1 3.75 12V9.375a2.625 2.625 0 0 1 2.625-2.625h1.5c0-1.036.84-1.875 1.875-1.875h3.75c1.035 0 1.875.84 1.875 1.875h1.5A2.625 2.625 0 0 1 19.5 9.375v2.25Z" />
        </svg>
        <h3 class="mt-2 text-sm font-semibold text-gray-900">No project selected</h3>
        <p class="mt-1 text-sm text-gray-500">Please select a project from the sidebar to view its modules.</p>
        <div class="mt-6">
          <a
            href="/projects"
            class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <svg class="-ml-0.5 mr-1.5 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create Project
          </a>
        </div>
      </div>
    {:else if loading}
      <!-- Loading modules -->
      <div class="flex justify-center items-center py-12">
        <div class="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
      </div>
    {:else if error}
      <!-- Error loading modules -->
      <div class="bg-red-50 border border-red-200 rounded-md p-4">
        <div class="flex">
          <svg class="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
          </svg>
          <p class="text-sm text-red-700">{error}</p>
        </div>
      </div>
    {:else if modules.length === 0}
      <!-- No modules -->
      <div class="text-center py-12 bg-white rounded-lg shadow">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6A1.125 1.125 0 0 1 2.25 10.875v-3.75ZM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 0 1-1.125-1.125v-8.25ZM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25A1.125 1.125 0 0 1 3.75 18.375v-2.25Z" />
        </svg>
        <h3 class="mt-2 text-sm font-semibold text-gray-900">No modules yet</h3>
        <p class="mt-1 text-sm text-gray-500">
          Get started by creating your first module in <span class="font-medium">{selectedProject.name}</span>.
        </p>
        <div class="mt-6">
          <button
            type="button"
            onclick={openCreateModuleModal}
            class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <svg class="-ml-0.5 mr-1.5 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Module
          </button>
        </div>
      </div>
    {:else}
      <!-- Module grid -->
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {#each modules as module (module.id)}
          <ModuleCard
            {module}
            href="/projects/modules/{module.id}"
            onEdit={handleEditModule}
            onDelete={handleDeleteModule}
          />
        {/each}
      </div>
    {/if}
    
  </div>
</div>

<!-- Create Module Modal -->
{#if showCreateModuleModal}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div class="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
      <div class="mb-4">
        <h3 class="text-lg font-medium text-gray-900">Create New Module</h3>
        <p class="text-sm text-gray-500 mt-1">
          Create a module to organize related test flow sequences.
        </p>
      </div>
      
      <ModuleForm
        isLoading={isSubmitting}
        mode="create"
        on:submit={handleCreateModule}
        on:cancel={closeCreateModuleModal}
      />
    </div>
  </div>
{/if}

<!-- Confirm Delete Dialog -->
{#if showConfirmDialog && pendingDeleteModule}
  <ConfirmDialog
    isOpen={showConfirmDialog}
    title="Delete Module"
    message="Are you sure you want to delete '{pendingDeleteModule.name}'? This action cannot be undone and will delete all sequences in this module."
    confirmText="Delete"
    cancelText="Cancel"
    confirmVariant="danger"
    on:confirm={confirmDeleteModule}
    on:cancel={cancelDelete}
  />
{/if}
