<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import * as projectClient from '$lib/http_client/projects';
  import type { Project } from '$lib/http_client/projects';

  let project: Project | null = null;
  let loading = true;
  let error: string | null = null;

  $: projectId = parseInt($page.params.id || '');

  onMount(async () => {
    if (isNaN(projectId)) {
      error = 'Invalid project ID';
      loading = false;
      return;
    }
    
    await fetchProject();
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
    } finally {
      loading = false;
    }
  }

  function goToSequences() {
    goto(`/dashboard/projects/${projectId}`);
  }
</script>

<svelte:head>
  <title>{project?.name || 'Project'} Sequences | Test Pilot</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
    <div class="flex-1">
      <h1 class="text-2xl font-bold text-gray-900">
        {project?.name || 'Loading...'} - Sequences
      </h1>
      
      {#if project?.description}
        <p class="text-sm text-gray-600 mt-1">{project.description}</p>
      {/if}
    </div>
  </div>

  <!-- Loading State -->
  {#if loading}
    <div class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  {:else if error}
    <!-- Error State -->
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
        </div>
      </div>
    </div>
  {:else}
    <!-- Content -->
    <div class="text-center py-12">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
      <h3 class="mt-2 text-sm font-semibold text-gray-900">Manage Project Sequences</h3>
      <p class="mt-1 text-sm text-gray-500">
        This page would show sequence management tools for the project. 
        For now, you can manage sequences from the main project page.
      </p>
      <div class="mt-6">
        <button
          type="button"
          class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          on:click={goToSequences}
        >
          <svg class="-ml-0.5 mr-1.5 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" />
          </svg>
          Go to Project Page
        </button>
      </div>
    </div>
  {/if}
</div>
