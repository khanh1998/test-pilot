<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import * as projectClient from '$lib/http_client/projects';
  import * as sequenceClient from '$lib/http_client/sequences';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import SequenceCard from '$lib/components/sequences/SequenceCard.svelte';
  import ProjectConfigModal from '$lib/components/projects/ProjectConfigModal.svelte';
  import type { Project } from '$lib/http_client/projects';
  import type { Sequence, CreateSequenceData } from '$lib/http_client/sequences';

  let project: Project | null = null;
  let sequences: Sequence[] = [];
  let loading = true;
  let error: string | null = null;
  let showCreateSequenceModal = false;

  // Pagination state for sequences
  let currentPage = 1;
  let pageSize = 12;
  let totalItems = 0;
  let totalPages = 0;

  // Search/filter state
  let searchTerm = '';
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  // Form data for creating a new sequence
  let newSequenceName = '';

  // Confirm dialog state
  let showConfirmDialog = false;
  let pendingDeleteSequence: { id: number; name: string } | null = null;

  // Edit modal state
  let showEditSequenceModal = false;
  let editingSequence: Sequence | null = null;

  // Project configuration state
  let showConfigModal = false;

  // Get project ID from URL
  $: projectId = parseInt($page.params.id || '');

  onMount(async () => {
    if (isNaN(projectId)) {
      error = 'Invalid project ID';
      loading = false;
      return;
    }
    
    await fetchProject();
    await fetchSequences();
  });

  async function fetchProject() {
    try {
      const result = await projectClient.getProject(projectId);
      if (result && result.project) {
        project = result.project;
      } else {
        error = 'Project not found';
      }
    } catch (err) {
      console.error('Error fetching project:', err);
      error = 'Failed to fetch project';
    }
  }

  async function fetchSequences() {
    try {
      loading = true;
      error = null;

      const result = await sequenceClient.getSequences(projectId, {
        page: currentPage,
        limit: pageSize,
        search: searchTerm.trim() || undefined
      });
      
      if (result) {
        sequences = result.sequences || [];
        currentPage = result.page;
        totalItems = result.total;
        totalPages = result.totalPages;
      } else {
        sequences = [];
        totalItems = 0;
        totalPages = 0;
      }
    } catch (err) {
      console.error('Error fetching sequences:', err);
      error = 'Failed to fetch sequences';
    } finally {
      loading = false;
    }
  }

  // Search functionality
  function handleSearch() {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    searchTimeout = setTimeout(() => {
      currentPage = 1;
      fetchSequences();
    }, 300);
  }

  // Pagination
  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
      fetchSequences();
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

  // Create sequence modal
  function openCreateSequenceModal() {
    newSequenceName = '';
    showCreateSequenceModal = true;
  }

  function closeCreateSequenceModal() {
    showCreateSequenceModal = false;
  }

  async function createSequence() {
    if (!newSequenceName.trim()) {
      error = 'Sequence name is required';
      return;
    }

    try {
      const createData: CreateSequenceData = {
        name: newSequenceName.trim()
      };

      const result = await sequenceClient.createSequence(projectId, createData);
      if (result) {
        closeCreateSequenceModal();
        await fetchSequences();
      }
    } catch (err) {
      console.error('Error creating sequence:', err);
      error = err instanceof Error ? err.message : 'Failed to create sequence';
    }
  }

  // Edit sequence
  function handleEditSequence(sequence: Sequence) {
    editingSequence = sequence;
    newSequenceName = sequence.name;
    showEditSequenceModal = true;
  }

  function closeEditSequenceModal() {
    showEditSequenceModal = false;
    editingSequence = null;
  }

  async function updateSequence() {
    if (!editingSequence || !newSequenceName.trim()) {
      error = 'Sequence name is required';
      return;
    }

    try {
      const updateData = {
        name: newSequenceName.trim()
      };

      const result = await sequenceClient.updateSequence(editingSequence.id, updateData);
      if (result) {
        closeEditSequenceModal();
        await fetchSequences();
      }
    } catch (err) {
      console.error('Error updating sequence:', err);
      error = err instanceof Error ? err.message : 'Failed to update sequence';
    }
  }

  // Delete sequence
  function handleDeleteSequence(id: number, name: string) {
    pendingDeleteSequence = { id, name };
    showConfirmDialog = true;
  }

  async function confirmDeleteSequence() {
    if (!pendingDeleteSequence) return;

    try {
      await sequenceClient.deleteSequence(pendingDeleteSequence.id);
      await fetchSequences();
    } catch (err) {
      console.error('Error deleting sequence:', err);
      error = err instanceof Error ? err.message : 'Failed to delete sequence';
    } finally {
      showConfirmDialog = false;
      pendingDeleteSequence = null;
    }
  }

  function cancelDeleteSequence() {
    showConfirmDialog = false;
    pendingDeleteSequence = null;
  }

  // Clear error
  function clearError() {
    error = null;
  }

  // Navigate back to projects
  function goBackToProjects() {
    goto('/dashboard/projects');
  }

  // Project Configuration Modal handlers
  function openConfigModal() {
    showConfigModal = true;
  }

  function closeConfigModal() {
    showConfigModal = false;
  }

  function handleConfigSaved(event: CustomEvent<{ project: Project }>) {
    project = event.detail.project;
  }
</script>

<svelte:head>
  <title>{project?.name || 'Project'} | Test Pilot</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
    <div class="flex-1">
      <div class="flex items-center space-x-2 mb-2">
        <button 
          class="text-blue-600 hover:text-blue-800 transition-colors"
          on:click={goBackToProjects}
          aria-label="Back to projects"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 class="text-2xl font-bold text-gray-900">
          {project?.name || 'Loading...'}
        </h1>
      </div>
      
      {#if project?.description}
        <p class="text-sm text-gray-600 mb-2">{project.description}</p>
      {/if}
      
      <!-- Project Stats -->
      {#if project}
        <div class="flex items-center space-x-4 text-sm text-gray-500">
          <span class="flex items-center">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2v0a2 2 0 01-2-2v-2a2 2 0 00-2-2H8z" />
            </svg>
            {project.config.api_dependencies.length} API{project.config.api_dependencies.length !== 1 ? 's' : ''}
          </span>
          <span class="flex items-center">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
            {Object.keys(project.config.variables).length} variable{Object.keys(project.config.variables).length !== 1 ? 's' : ''}
          </span>
          {#if project.config.environment_id}
            <span class="flex items-center">
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Environment linked
            </span>
          {/if}
        </div>
      {/if}
    </div>
    
    <div class="mt-4 sm:mt-0 flex gap-2">
      <button
        type="button"
        class="inline-flex items-center rounded-md bg-gray-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600"
        on:click={openConfigModal}
      >
        <svg class="-ml-0.5 mr-1.5 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M8.34 1.804A1 1 0 019.32 1h1.36a1 1 0 01.98.804l.295 1.473c.497.144.971.342 1.416.587l1.25-.834a1 1 0 011.262.125l.962.962a1 1 0 01.125 1.262l-.834 1.25c.245.445.443.919.587 1.416l1.473.294a1 1 0 01.804.98v1.361a1 1 0 01-.804.98l-1.473.295a6.95 6.95 0 01-.587 1.416l.834 1.25a1 1 0 01-.125 1.262l-.962.962a1 1 0 01-1.262.125l-1.25-.834a6.953 6.953 0 01-1.416.587l-.294 1.473a1 1 0 01-.98.804H9.32a1 1 0 01-.98-.804l-.295-1.473a6.957 6.957 0 01-1.416-.587l-1.25.834a1 1 0 01-1.262-.125l-.962-.962a1 1 0 01-.125-1.262l.834-1.25a6.957 6.957 0 01-.587-1.416l-1.473-.294A1 1 0 011 10.68V9.32a1 1 0 01.804-.98l1.473-.295c.144-.497.342-.971.587-1.416l-.834-1.25a1 1 0 01.125-1.262l.962-.962A1 1 0 015.38 3.03l1.25.834a6.957 6.957 0 011.416-.587l.294-1.473zM13 10a3 3 0 11-6 0 3 3 0 016 0z" clip-rule="evenodd" />
        </svg>
        Configure
      </button>
      <button
        type="button"
        class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        on:click={openCreateSequenceModal}
      >
        <svg class="-ml-0.5 mr-1.5 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd" />
        </svg>
        New Sequence
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

  <!-- Sequences Section -->
  <div class="space-y-4">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
      <h2 class="text-lg font-semibold text-gray-900">Sequences</h2>
      
      <!-- Search -->
      <div class="mt-4 sm:mt-0 sm:w-64">
        <div class="relative">
          <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search sequences..."
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
    {:else if sequences.length === 0}
      <!-- Empty State -->
      <div class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <h3 class="mt-2 text-sm font-semibold text-gray-900">No sequences</h3>
        <p class="mt-1 text-sm text-gray-500">Get started by creating your first sequence.</p>
        <div class="mt-6">
          <button
            type="button"
            class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
            on:click={openCreateSequenceModal}
          >
            <svg class="-ml-0.5 mr-1.5 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd" />
            </svg>
            New Sequence
          </button>
        </div>
      </div>
    {:else}
      <!-- Sequences Grid -->
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {#each sequences as sequence (sequence.id)}
          <SequenceCard
            {sequence}
            onDelete={handleDeleteSequence}
            onEdit={handleEditSequence}
            flowCount={sequence.config?.flows?.length || 0}
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
</div>

<!-- Create Sequence Modal -->
{#if showCreateSequenceModal}
  <div class="fixed inset-0 z-50 overflow-y-auto">
    <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
      <div 
        class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
        on:click={closeCreateSequenceModal}
        on:keydown={(e) => e.key === 'Escape' && closeCreateSequenceModal()}
        role="button"
        tabindex="-1"
      ></div>
      
      <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
        <div>
          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div class="mt-3 text-center sm:mt-5">
            <h3 class="text-base font-semibold leading-6 text-gray-900">Create New Sequence</h3>
            <div class="mt-2">
              <p class="text-sm text-gray-500">
                Create a sequence to organize and execute test flows in order.
              </p>
            </div>
          </div>
        </div>
        
        <div class="mt-5">
          <label for="sequence-name" class="block text-sm font-medium leading-6 text-gray-900">Sequence Name</label>
          <div class="mt-2">
            <input
              type="text"
              id="sequence-name"
              class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              placeholder="Enter sequence name"
              bind:value={newSequenceName}
            />
          </div>
        </div>
        
        <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
          <button
            type="button"
            class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
            on:click={createSequence}
          >
            Create Sequence
          </button>
          <button
            type="button"
            class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0"
            on:click={closeCreateSequenceModal}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Sequence Modal -->
{#if showEditSequenceModal && editingSequence}
  <div class="fixed inset-0 z-50 overflow-y-auto">
    <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
      <div 
        class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
        on:click={closeEditSequenceModal}
        on:keydown={(e) => e.key === 'Escape' && closeEditSequenceModal()}
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
            <h3 class="text-base font-semibold leading-6 text-gray-900">Edit Sequence</h3>
            <div class="mt-2">
              <p class="text-sm text-gray-500">
                Update the sequence name and configuration.
              </p>
            </div>
          </div>
        </div>
        
        <div class="mt-5">
          <label for="edit-sequence-name" class="block text-sm font-medium leading-6 text-gray-900">Sequence Name</label>
          <div class="mt-2">
            <input
              type="text"
              id="edit-sequence-name"
              class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              placeholder="Enter sequence name"
              bind:value={newSequenceName}
            />
          </div>
        </div>
        
        <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
          <button
            type="button"
            class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
            on:click={updateSequence}
          >
            Update Sequence
          </button>
          <button
            type="button"
            class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0"
            on:click={closeEditSequenceModal}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Confirm Delete Dialog -->
{#if showConfirmDialog && pendingDeleteSequence}
  <ConfirmDialog
    isOpen={showConfirmDialog}
    title="Delete Sequence"
    message="Are you sure you want to delete '{pendingDeleteSequence.name}'? This action cannot be undone."
    confirmText="Delete"
    confirmVariant="danger"
    on:confirm={confirmDeleteSequence}
    on:cancel={cancelDeleteSequence}
  />
{/if}

<!-- Project Configuration Modal -->
<ProjectConfigModal
  isOpen={showConfigModal}
  {project}
  on:close={closeConfigModal}
  on:saved={handleConfigSaved}
/>
