<script lang="ts">
  import { goto } from '$app/navigation';
  import { projectStore } from '$lib/store/project';
  import ProjectCard from '$lib/components/projects/ProjectCard.svelte';
  import CreateProjectModal from '$lib/components/projects/CreateProjectModal.svelte';
  import type { Project } from '$lib/store/project';

  let projects: Project[] = $state([]);
  let isLoading = $state(true);
  let error: string | null = $state(null);
  let showCreateModal = $state(false);

  // Subscribe to project store
  const unsubscribe = projectStore.subscribe((state) => {
    projects = state.projects;
    isLoading = state.isLoading;
    error = state.error;
  });



  function handleProjectSelect(project: Project) {
    projectStore.selectProject(project);
    goto(`/projects/apis`);
  }

  function openCreateModal() {
    showCreateModal = true;
  }

  function closeCreateModal() {
    showCreateModal = false;
  }

  async function handleProjectCreated(project: Project) {
    closeCreateModal();
    // Project is already added to store and selected by the store's createProject method
    goto(`/projects/apis`);
  }
</script>

<svelte:head>
  <title>Projects - Test Pilot</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <!-- Header -->
  <header class="bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center h-16">
        <div class="flex items-center">
          <h1 class="text-2xl font-bold text-gray-900">Test Pilot</h1>
        </div>
        
        <div class="flex items-center space-x-4">
          <button
            type="button"
            onclick={openCreateModal}
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </button>
        </div>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
    <div class="mb-8">
      <h2 class="text-3xl font-bold text-gray-900">Your Projects</h2>
      <p class="mt-2 text-gray-600">
        Manage your API testing projects. Select a project to start testing your APIs.
      </p>
    </div>

    {#if isLoading}
      <div class="flex justify-center items-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span class="ml-3 text-gray-600">Loading projects...</span>
      </div>
    {:else if error}
      <div class="bg-red-50 border border-red-200 rounded-md p-4">
        <div class="flex">
          <svg class="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-800">Error loading projects</h3>
            <p class="mt-1 text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    {:else if projects.length === 0}
      <!-- Empty state -->
      <div class="text-center py-12">
        <svg class="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <h3 class="mt-4 text-lg font-medium text-gray-900">No projects yet</h3>
        <p class="mt-2 text-gray-500">
          Create your first project to start testing your APIs.
        </p>
        <div class="mt-6">
          <button
            type="button"
            onclick={openCreateModal}
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Create Your First Project
          </button>
        </div>
      </div>
    {:else}
      <!-- Projects Grid -->
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {#each projects as project (project.id)}
          <ProjectCard 
            {project} 
            onSelect={() => handleProjectSelect(project)}
          />
        {/each}
      </div>
    {/if}
  </main>
</div>

<!-- Create Project Modal -->
{#if showCreateModal}
  <CreateProjectModal 
    onClose={closeCreateModal}
    onProjectCreated={handleProjectCreated}
  />
{/if}