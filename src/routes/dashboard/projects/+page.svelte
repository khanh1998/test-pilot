<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import * as projectClient from '$lib/http_client/projects';
  import * as apiClient from '$lib/http_client/apis';
  import * as environmentClient from '$lib/http_client/environments';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import ProjectCard from '$lib/components/projects/ProjectCard.svelte';
  import type { Project, CreateProjectData } from '$lib/http_client/projects';

  let projects: Project[] = [];
  let loading = true;
  let error: string | null = null;
  let showCreateModal = false;

  // Pagination state
  let currentPage = 1;
  let pageSize = 12;
  let totalItems = 0;
  let totalPages = 0;

  // Search/filter state
  let searchTerm = '';
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  // Form data for creating a new project
  let newProjectName = '';
  let newProjectDescription = '';
  let selectedApiIds: number[] = [];
  let selectedEnvironmentId: number | null = null;
  
  // Available APIs and environments
  let availableApis: { id: number; name: string; host: string; selected?: boolean }[] = [];
  let availableEnvironments: { id: number; name: string; description?: string }[] = [];

  // Confirm dialog state
  let showConfirmDialog = false;
  let pendingDeleteProject: { id: number; name: string } | null = null;

  // Edit modal state
  let showEditModal = false;
  let editingProject: Project | null = null;

  onMount(async () => {
    await fetchProjects();
    await fetchAvailableApis();
    await fetchAvailableEnvironments();
  });

  async function fetchProjects() {
    try {
      loading = true;
      error = null;

      const result = await projectClient.getProjects({
        page: currentPage,
        limit: pageSize,
        search: searchTerm.trim() || undefined
      });
      
      if (result) {
        projects = result.projects || [];
        currentPage = result.page;
        totalItems = result.total;
        totalPages = result.totalPages;
      } else {
        projects = [];
        totalItems = 0;
        totalPages = 0;
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      error = 'Failed to fetch projects';
    } finally {
      loading = false;
    }
  }

  async function fetchAvailableApis() {
    try {
      const result = await apiClient.getApiList();
      if (result && result.apis) {
        availableApis = result.apis.map((api: any) => ({
          id: api.id,
          name: api.name,
          host: api.host || '',
          selected: false
        }));
      }
    } catch (err) {
      console.error('Error fetching APIs:', err);
    }
  }

  async function fetchAvailableEnvironments() {
    try {
      const result = await environmentClient.getEnvironments();
      if (result) {
        availableEnvironments = result;
      }
    } catch (err) {
      console.error('Error fetching environments:', err);
    }
  }

  // Search functionality
  function handleSearch() {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    searchTimeout = setTimeout(() => {
      currentPage = 1;
      fetchProjects();
    }, 300);
  }

  // Pagination
  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
      fetchProjects();
    }
  }

  function nextPage() {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  }

  function prevPage() {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  }

  // Create project modal
  function openCreateModal() {
    newProjectName = '';
    newProjectDescription = '';
    selectedApiIds = [];
    selectedEnvironmentId = null;
    // Reset API selections
    availableApis = availableApis.map(api => ({ ...api, selected: false }));
    showCreateModal = true;
  }

  function closeCreateModal() {
    showCreateModal = false;
  }

  function handleApiToggle(apiId: number) {
    const apiIndex = availableApis.findIndex(api => api.id === apiId);
    if (apiIndex !== -1) {
      availableApis[apiIndex].selected = !availableApis[apiIndex].selected;
      selectedApiIds = availableApis.filter(api => api.selected).map(api => api.id);
    }
  }

  async function createProject() {
    if (!newProjectName.trim()) {
      error = 'Project name is required';
      return;
    }

    try {
      const createData: CreateProjectData = {
        name: newProjectName.trim(),
        description: newProjectDescription.trim() || undefined,
        api_dependencies: selectedApiIds,
        environment_id: selectedEnvironmentId
      };

      const result = await projectClient.createProject(createData);
      if (result) {
        closeCreateModal();
        await fetchProjects();
      }
    } catch (err) {
      console.error('Error creating project:', err);
      error = err instanceof Error ? err.message : 'Failed to create project';
    }
  }

  // Edit project
  function handleEdit(project: Project) {
    editingProject = project;
    newProjectName = project.name;
    newProjectDescription = project.description || '';
    selectedApiIds = [...project.config.api_dependencies];
    selectedEnvironmentId = project.config.environment_id;
    
    // Set API selections
    availableApis = availableApis.map(api => ({
      ...api,
      selected: selectedApiIds.includes(api.id)
    }));
    
    showEditModal = true;
  }

  function closeEditModal() {
    showEditModal = false;
    editingProject = null;
  }

  async function updateProject() {
    if (!editingProject || !newProjectName.trim()) {
      error = 'Project name is required';
      return;
    }

    try {
      const updateData = {
        name: newProjectName.trim(),
        description: newProjectDescription.trim() || undefined,
        api_dependencies: selectedApiIds,
        environment_id: selectedEnvironmentId
      };

      const result = await projectClient.updateProject(editingProject.id, updateData);
      if (result) {
        closeEditModal();
        await fetchProjects();
      }
    } catch (err) {
      console.error('Error updating project:', err);
      error = err instanceof Error ? err.message : 'Failed to update project';
    }
  }

  // Delete project
  function handleDelete(id: number, name: string) {
    pendingDeleteProject = { id, name };
    showConfirmDialog = true;
  }

  async function confirmDelete() {
    if (!pendingDeleteProject) return;

    try {
      await projectClient.deleteProject(pendingDeleteProject.id);
      await fetchProjects();
    } catch (err) {
      console.error('Error deleting project:', err);
      error = err instanceof Error ? err.message : 'Failed to delete project';
    } finally {
      showConfirmDialog = false;
      pendingDeleteProject = null;
    }
  }

  function cancelDelete() {
    showConfirmDialog = false;
    pendingDeleteProject = null;
  }

  // Navigate to project detail
  function viewProject(projectId: number) {
    goto(`/dashboard/projects/${projectId}`);
  }

  // Clear error
  function clearError() {
    error = null;
  }
</script>

<svelte:head>
  <title>Projects | Test Pilot</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Projects</h1>
      <p class="mt-1 text-sm text-gray-500">
        Manage your test projects and their configurations
      </p>
    </div>
    <div class="mt-4 sm:mt-0">
      <button
        type="button"
        class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        on:click={openCreateModal}
      >
        <svg class="-ml-0.5 mr-1.5 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd" />
        </svg>
        New Project
      </button>
    </div>
  </div>

  <!-- Error Alert -->
  {#if error}
    <div class="rounded-md bg-red-50 p-4">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800">Error</h3>
          <div class="mt-2 text-sm text-red-700">
            <p>{error}</p>
          </div>
          <div class="mt-4">
            <button
              type="button"
              class="rounded-md bg-red-50 px-2 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-red-50"
              on:click={clearError}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Search -->
  <div class="flex flex-col sm:flex-row gap-4">
    <div class="flex-1">
      <div class="relative">
        <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <svg class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="Search projects..."
          class="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
          bind:value={searchTerm}
          on:input={handleSearch}
        />
      </div>
    </div>
  </div>

  <!-- Loading State -->
  {#if loading}
    <div class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  {:else if projects.length === 0}
    <!-- Empty State -->
    <div class="text-center py-12">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
      <h3 class="mt-2 text-sm font-semibold text-gray-900">No projects</h3>
      <p class="mt-1 text-sm text-gray-500">Get started by creating your first project.</p>
      <div class="mt-6">
        <button
          type="button"
          class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          on:click={openCreateModal}
        >
          <svg class="-ml-0.5 mr-1.5 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd" />
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
          onDelete={handleDelete}
          onEdit={handleEdit}
          sequenceCount={0}
          apiCount={project.config.api_dependencies.length}
        />
      {/each}
    </div>

    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div class="flex flex-1 justify-between sm:hidden">
          <button
            class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            disabled={currentPage <= 1}
            on:click={prevPage}
          >
            Previous
          </button>
          <button
            class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            disabled={currentPage >= totalPages}
            on:click={nextPage}
          >
            Next
          </button>
        </div>
        <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p class="text-sm text-gray-700">
              Showing
              <span class="font-medium">{(currentPage - 1) * pageSize + 1}</span>
              to
              <span class="font-medium">{Math.min(currentPage * pageSize, totalItems)}</span>
              of
              <span class="font-medium">{totalItems}</span>
              results
            </p>
          </div>
          <div>
            <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
              <button
                class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                disabled={currentPage <= 1}
                on:click={prevPage}
              >
                <span class="sr-only">Previous</span>
                <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" />
                </svg>
              </button>
              
              {#each Array.from({ length: totalPages }, (_, i) => i + 1) as page}
                {#if page <= 3 || page > totalPages - 3 || Math.abs(page - currentPage) <= 1}
                  <button
                    class="relative inline-flex items-center px-4 py-2 text-sm font-semibold {page === currentPage ? 'z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600' : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'}"
                    on:click={() => goToPage(page)}
                  >
                    {page}
                  </button>
                {:else if page === 4 && currentPage > 6}
                  <span class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">...</span>
                {:else if page === totalPages - 3 && currentPage < totalPages - 5}
                  <span class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">...</span>
                {/if}
              {/each}
              
              <button
                class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                disabled={currentPage >= totalPages}
                on:click={nextPage}
              >
                <span class="sr-only">Next</span>
                <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
                </svg>
              </button>
            </nav>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<!-- Create Project Modal -->
{#if showCreateModal}
  <div class="fixed inset-0 z-50 overflow-y-auto">
    <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
      <div 
        class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
        on:click={closeCreateModal}
        on:keydown={(e) => e.key === 'Escape' && closeCreateModal()}
        role="button"
        tabindex="-1"
      ></div>
      
      <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
        <div>
          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div class="mt-3 text-center sm:mt-5">
            <h3 class="text-base font-semibold leading-6 text-gray-900">Create New Project</h3>
            <div class="mt-2">
              <p class="text-sm text-gray-500">
                Create a project to group related sequences with shared variables and API dependencies.
              </p>
            </div>
          </div>
        </div>
        
        <div class="mt-5 space-y-4">
          <!-- Project Name -->
          <div>
            <label for="project-name" class="block text-sm font-medium leading-6 text-gray-900">Project Name</label>
            <div class="mt-2">
              <input
                type="text"
                id="project-name"
                class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                placeholder="Enter project name"
                bind:value={newProjectName}
              />
            </div>
          </div>

          <!-- Project Description -->
          <div>
            <label for="project-description" class="block text-sm font-medium leading-6 text-gray-900">Description (Optional)</label>
            <div class="mt-2">
              <textarea
                id="project-description"
                rows="3"
                class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                placeholder="Enter project description"
                bind:value={newProjectDescription}
              ></textarea>
            </div>
          </div>

          <!-- Environment Selection -->
          <div>
            <label for="project-environment" class="block text-sm font-medium leading-6 text-gray-900">Environment (Optional)</label>
            <div class="mt-2">
              <select
                id="project-environment"
                class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                bind:value={selectedEnvironmentId}
              >
                <option value={null}>No environment</option>
                {#each availableEnvironments as env}
                  <option value={env.id}>{env.name}</option>
                {/each}
              </select>
            </div>
          </div>

          <!-- API Dependencies -->
          <fieldset>
            <legend class="block text-sm font-medium leading-6 text-gray-900">API Dependencies (Optional)</legend>
            <div class="mt-2 max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2">
              {#each availableApis as api}
                <div class="flex items-center">
                  <input
                    id="api-{api.id}"
                    type="checkbox"
                    class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                    checked={api.selected}
                    on:change={() => handleApiToggle(api.id)}
                  />
                  <label for="api-{api.id}" class="ml-3 text-sm font-medium text-gray-700">
                    {api.name}
                    {#if api.host}
                      <span class="text-gray-500">({api.host})</span>
                    {/if}
                  </label>
                </div>
              {/each}
            </div>
          </fieldset>
        </div>
        
        <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
          <button
            type="button"
            class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
            on:click={createProject}
          >
            Create Project
          </button>
          <button
            type="button"
            class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0"
            on:click={closeCreateModal}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Project Modal -->
{#if showEditModal && editingProject}
  <div class="fixed inset-0 z-50 overflow-y-auto">
    <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
      <div 
        class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
        on:click={closeEditModal}
        on:keydown={(e) => e.key === 'Escape' && closeEditModal()}
        role="button"
        tabindex="-1"
      ></div>
      
      <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
        <div>
          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
          <div class="mt-3 text-center sm:mt-5">
            <h3 class="text-base font-semibold leading-6 text-gray-900">Edit Project</h3>
            <div class="mt-2">
              <p class="text-sm text-gray-500">
                Update project details, environment and API dependencies.
              </p>
            </div>
          </div>
        </div>
        
        <div class="mt-5 space-y-4">
          <!-- Project Name -->
          <div>
            <label for="edit-project-name" class="block text-sm font-medium leading-6 text-gray-900">Project Name</label>
            <div class="mt-2">
              <input
                type="text"
                id="edit-project-name"
                class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                placeholder="Enter project name"
                bind:value={newProjectName}
              />
            </div>
          </div>

          <!-- Project Description -->
          <div>
            <label for="edit-project-description" class="block text-sm font-medium leading-6 text-gray-900">Description (Optional)</label>
            <div class="mt-2">
              <textarea
                id="edit-project-description"
                rows="3"
                class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                placeholder="Enter project description"
                bind:value={newProjectDescription}
              ></textarea>
            </div>
          </div>

          <!-- Environment Selection -->
          <div>
            <label for="edit-project-environment" class="block text-sm font-medium leading-6 text-gray-900">Environment (Optional)</label>
            <div class="mt-2">
              <select
                id="edit-project-environment"
                class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                bind:value={selectedEnvironmentId}
              >
                <option value={null}>No environment</option>
                {#each availableEnvironments as env}
                  <option value={env.id}>{env.name}</option>
                {/each}
              </select>
            </div>
          </div>

          <!-- API Dependencies -->
          <fieldset>
            <legend class="block text-sm font-medium leading-6 text-gray-900">API Dependencies (Optional)</legend>
            <div class="mt-2 max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2">
              {#each availableApis as api}
                <div class="flex items-center">
                  <input
                    id="edit-api-{api.id}"
                    type="checkbox"
                    class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                    checked={api.selected}
                    on:change={() => handleApiToggle(api.id)}
                  />
                  <label for="edit-api-{api.id}" class="ml-3 text-sm font-medium text-gray-700">
                    {api.name}
                    {#if api.host}
                      <span class="text-gray-500">({api.host})</span>
                    {/if}
                  </label>
                </div>
              {/each}
            </div>
          </fieldset>
        </div>
        
        <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
          <button
            type="button"
            class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
            on:click={updateProject}
          >
            Update Project
          </button>
          <button
            type="button"
            class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0"
            on:click={closeEditModal}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Confirm Delete Dialog -->
{#if showConfirmDialog && pendingDeleteProject}
  <ConfirmDialog
    isOpen={showConfirmDialog}
    title="Delete Project"
    message="Are you sure you want to delete '{pendingDeleteProject.name}'? This action cannot be undone and will also delete all sequences in this project."
    confirmText="Delete"
    confirmVariant="danger"
    on:confirm={confirmDelete}
    on:cancel={cancelDelete}
  />
{/if}
