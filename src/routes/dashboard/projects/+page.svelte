<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import * as projectClient from '$lib/http_client/projects';
  import * as apiClient from '$lib/http_client/apis';
  import ProjectCard from '$lib/components/projects/ProjectCard.svelte';
  import ProjectForm from '$lib/components/projects/ProjectForm.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import type { Project } from '$lib/types/project';
  import type { Api } from '$lib/types/api';

  let projects: Project[] = [];
  let loading = true;
  let error: string | null = null;
  let showCreateModal = false;

  // Available APIs for project creation
  let availableApis: Api[] = [];
  
  // Form state
  let isSubmitting = false;
  
  // Confirm dialog state
  let showConfirmDialog = false;
  let pendingDeleteProject: { id: number; name: string } | null = null;

  onMount(async () => {
    await loadProjects();
    await loadAvailableApis();
  });

  async function loadProjects() {
    try {
      loading = true;
      error = null;
      const response = await projectClient.getProjects();
      projects = response.projects;
    } catch (err) {
      console.error('Failed to load projects:', err);
      error = err instanceof Error ? err.message : 'Failed to load projects';
    } finally {
      loading = false;
    }
  }

  async function loadAvailableApis() {
    try {
      const response = await apiClient.getApiList();
      if (response) {
        availableApis = response.apis;
      }
    } catch (err) {
      console.error('Failed to load APIs:', err);
    }
  }

  async function handleCreateProject(event: CustomEvent<{ project: Partial<Project>; apiIds: number[] }>) {
    const { project: projectData, apiIds } = event.detail;
    
    try {
      isSubmitting = true;
      const response = await projectClient.createProject({
        name: projectData.name!,
        description: projectData.description,
        apiIds
      });
      
      projects = [...projects, response.project];
      showCreateModal = false;
      
      // Navigate to the new project
      goto(`/dashboard/projects/${response.project.id}`);
    } catch (err) {
      console.error('Failed to create project:', err);
      error = err instanceof Error ? err.message : 'Failed to create project';
    } finally {
      isSubmitting = false;
    }
  }

  function handleEditProject(project: Project) {
    goto(`/dashboard/projects/${project.id}`);
  }

  function handleDeleteProject(project: Project) {
    pendingDeleteProject = { id: project.id, name: project.name };
    showConfirmDialog = true;
  }

  async function confirmDelete() {
    if (!pendingDeleteProject) return;
    
    try {
      await projectClient.deleteProject(pendingDeleteProject.id);
      projects = projects.filter(p => p.id !== pendingDeleteProject!.id);
      showConfirmDialog = false;
      pendingDeleteProject = null;
    } catch (err) {
      console.error('Failed to delete project:', err);
      error = err instanceof Error ? err.message : 'Failed to delete project';
    }
  }

  function cancelDelete() {
    showConfirmDialog = false;
    pendingDeleteProject = null;
  }

  function openCreateModal() {
    showCreateModal = true;
  }

  function closeCreateModal() {
    showCreateModal = false;
  }
</script>

<svelte:head>
  <title>Projects - Test Pilot</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Header -->
    <div class="mb-8">
      <div class="md:flex md:items-center md:justify-between">
        <div class="flex-1 min-w-0">
          <h1 class="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            Projects
          </h1>
          <p class="mt-1 text-sm text-gray-500">
            Organize your test flows into reusable projects and modules
          </p>
        </div>
        <div class="mt-4 flex md:mt-0 md:ml-4">
          <button
            type="button"
            on:click={openCreateModal}
            class="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            New Project
          </button>
        </div>
      </div>
    </div>

    <!-- Error Message -->
    {#if error}
      <div class="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
        <div class="flex">
          <svg class="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
          </svg>
          <p class="text-sm text-red-700">{error}</p>
        </div>
      </div>
    {/if}

    <!-- Loading State -->
    {#if loading}
      <div class="flex justify-center items-center py-12">
        <div class="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
      </div>
    {:else if projects.length === 0}
      <!-- Empty State -->
      <div class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900">No projects yet</h3>
        <p class="mt-1 text-sm text-gray-500">Get started by creating your first project.</p>
        <div class="mt-6">
          <button
            type="button"
            on:click={openCreateModal}
            class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            New Project
          </button>
        </div>
      </div>
    {:else}
      <!-- Projects Grid -->
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {#each projects as project (project.id)}
          <ProjectCard
            {project}
            href="/dashboard/projects/{project.id}"
            onEdit={handleEditProject}
            onDelete={handleDeleteProject}
          />
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Create Project Modal -->
{#if showCreateModal}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div class="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
      <div class="mb-4">
        <h3 class="text-lg font-medium text-gray-900">Create New Project</h3>
        <p class="text-sm text-gray-500 mt-1">
          Set up a new project to organize your test flows and modules.
        </p>
      </div>
      
      <ProjectForm
        {availableApis}
        isLoading={isSubmitting}
        mode="create"
        on:submit={handleCreateProject}
        on:cancel={closeCreateModal}
      />
    </div>
  </div>
{/if}

<!-- Confirm Delete Dialog -->
{#if showConfirmDialog && pendingDeleteProject}
  <ConfirmDialog
    isOpen={showConfirmDialog}
    title="Delete Project"
    message="Are you sure you want to delete '{pendingDeleteProject.name}'? This action cannot be undone and will delete all modules and sequences in this project."
    confirmText="Delete"
    cancelText="Cancel"
    confirmVariant="danger"
    on:confirm={confirmDelete}
    on:cancel={cancelDelete}
  />
{/if}
