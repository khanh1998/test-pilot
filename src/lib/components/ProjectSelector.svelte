<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { projectStore, type Project } from '$lib/store/project';
  
  interface Props {
    isCollapsed?: boolean;
  }
  
  let { isCollapsed = false }: Props = $props();
  
  let isOpen = $state(false);
  let projects: Project[] = $state([]);
  let selectedProject: Project | null = $state(null);
  let isLoading = $state(false);
  let error: string | null = $state(null);
  
  // Subscribe to project store
  const unsubscribe = projectStore.subscribe((state) => {
    projects = state.projects;
    selectedProject = state.selectedProject;
    isLoading = state.isLoading;
    error = state.error;
  });
  
  onMount(async () => {
    // Load projects when component mounts
    try {
      await projectStore.loadProjects();
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  });

  onDestroy(() => {
    unsubscribe();
  });
  
  function toggleDropdown() {
    isOpen = !isOpen;
  }
  
  function selectProject(project: Project) {
    projectStore.selectProject(project);
    isOpen = false;
  }
  
  function handleClickOutside(event: MouseEvent) {
    if (isOpen && event.target && !(event.target as Element).closest('.project-selector')) {
      isOpen = false;
    }
  }
</script>

<svelte:document on:click={handleClickOutside} />

<div class="project-selector relative">
  {#if isCollapsed}
    <!-- Collapsed view - just show icon -->
    <button
      type="button"
      onclick={toggleDropdown}
      class="flex h-8 w-8 items-center justify-center rounded-md bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
      title={selectedProject ? `Current project: ${selectedProject.name}` : 'Select project'}
      aria-label="Select project"
    >
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    </button>
  {:else}
    <!-- Expanded view -->
    <div class="mb-4">
      <div class="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Current Project
      </div>
      
      <button
        type="button"
        onclick={toggleDropdown}
        class="mt-1 flex w-full items-center justify-between rounded-md bg-gray-800 px-3 py-2 text-left text-sm text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <div class="flex items-center">
          <svg class="mr-2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          
          {#if isLoading}
            <span class="text-gray-400">Loading...</span>
          {:else if selectedProject}
            <span class="truncate">{selectedProject.name}</span>
          {:else if error}
            <span class="text-red-400">Error loading</span>
          {:else}
            <span class="text-gray-400">No project selected</span>
          {/if}
        </div>
        
        <svg class="ml-2 h-4 w-4 text-gray-400 transition-transform duration-200 {isOpen ? 'rotate-180' : ''}" 
             fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  {/if}

  <!-- Dropdown menu -->
  {#if isOpen}
    <div class="absolute {isCollapsed ? 'left-10 top-0' : 'left-0 top-full'} z-50 mt-1 w-64 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
      {#if isLoading}
        <div class="px-4 py-2 text-sm text-gray-500">
          Loading projects...
        </div>
      {:else if error}
        <div class="px-4 py-2 text-sm text-red-600">
          {error}
        </div>
      {:else if projects.length === 0}
        <div class="px-4 py-2 text-sm text-gray-500">
          No projects found
        </div>
        <div class="border-t border-gray-100">
          <a
            href="/dashboard/projects"
            class="block px-4 py-2 text-sm text-blue-600 hover:bg-gray-50"
            onclick={() => (isOpen = false)}
          >
            + Create your first project
          </a>
        </div>
      {:else}
        <div class="max-h-60 overflow-y-auto">
          {#each projects as project (project.id)}
            <button
              type="button"
              onclick={() => selectProject(project)}
              class="flex w-full items-center px-4 py-2 text-left text-sm hover:bg-gray-50 {selectedProject?.id === project.id ? 'bg-blue-50 text-blue-700' : 'text-gray-900'}"
            >
              <div class="flex-1 min-w-0">
                <div class="font-medium truncate">
                  {project.name}
                </div>
                {#if project.description}
                  <div class="text-xs text-gray-500 truncate">
                    {project.description}
                  </div>
                {/if}
              </div>
              
              {#if selectedProject?.id === project.id}
                <svg class="ml-2 h-4 w-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
              {/if}
            </button>
          {/each}
        </div>
        
        <div class="border-t border-gray-100">
          <a
            href="/dashboard/projects"
            class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onclick={() => (isOpen = false)}
          >
            <div class="flex items-center">
              <svg class="mr-2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Manage projects
            </div>
          </a>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Ensure dropdown appears above other elements */
  .project-selector {
    z-index: 10;
  }
</style>