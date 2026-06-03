<script lang="ts">
  import { onDestroy } from 'svelte';
  import { projectStore, type Project } from '$lib/store/project';

  let selectedProject = $state<Project | null>(null);
  let agentContext = $state('');
  let isSaving = $state(false);
  let error = $state<string | null>(null);
  let savedMessage = $state<string | null>(null);

  const unsubscribe = projectStore.subscribe((state) => {
    selectedProject = state.selectedProject;
    agentContext = state.selectedProject?.agentContext ?? '';
  });

  onDestroy(() => {
    unsubscribe();
  });

  async function saveGuidelines() {
    if (!selectedProject) return;

    try {
      isSaving = true;
      error = null;
      savedMessage = null;

      await projectStore.updateProject(selectedProject.id, {
        agentContext
      });

      savedMessage = 'Agent guidelines saved.';
      setTimeout(() => {
        savedMessage = null;
      }, 2500);
    } catch (err) {
      console.error('Error saving agent guidelines:', err);
      error = err instanceof Error ? err.message : 'Failed to save agent guidelines';
    } finally {
      isSaving = false;
    }
  }
</script>

<svelte:head>
  <title>Agent Guidelines - Test Pilot</title>
</svelte:head>

{#if !selectedProject}
  <div class="flex flex-col items-center justify-center py-16 text-center">
    <svg class="mb-4 h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      />
    </svg>
    <h2 class="text-2xl font-semibold text-gray-700">No Project Selected</h2>
    <p class="mt-2 text-gray-600">
      Select a project from the sidebar to edit its agent guidelines.
    </p>
  </div>
{:else}
  <div class="mb-6 flex items-start justify-between gap-6">
    <div>
      <h2 class="text-2xl font-semibold text-gray-900">{selectedProject.name}</h2>
      <p class="mt-2 max-w-3xl text-gray-600">
        Write Markdown context that MCP agents should read before searching endpoints, building
        flows, or running sequences.
      </p>
    </div>
    <button
      type="button"
      onclick={saveGuidelines}
      disabled={isSaving}
      class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isSaving ? 'Saving...' : 'Save'}
    </button>
  </div>

  {#if error}
    <div class="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {error}
    </div>
  {/if}

  {#if savedMessage}
    <div class="mb-6 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-700">
      {savedMessage}
    </div>
  {/if}

  <div class="grid gap-6 lg:grid-cols-[1fr_320px]">
    <div>
      <label for="agent-context" class="mb-2 block text-sm font-medium text-gray-700"
        >Agent Guidelines</label
      >
      <textarea
        id="agent-context"
        bind:value={agentContext}
        rows="22"
        class="block w-full resize-y rounded-md border-gray-300 font-mono text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
        placeholder={`# Business context\n\n# Authentication\n\n# Test data conventions\n\n# Endpoints or operations to avoid\n`}
      ></textarea>
    </div>

    <aside class="rounded-lg border border-gray-200 bg-gray-50 p-5">
      <h3 class="text-lg font-semibold text-gray-900">Suggested Sections</h3>
      <ul class="mt-4 space-y-3 text-sm text-gray-700">
        <li>
          <span class="font-medium text-gray-900">Business:</span> what this API does and key user journeys.
        </li>
        <li>
          <span class="font-medium text-gray-900">Auth:</span> required headers, login flow, token variables.
        </li>
        <li>
          <span class="font-medium text-gray-900">Data:</span> IDs, fixtures, naming conventions, cleanup
          rules.
        </li>
        <li>
          <span class="font-medium text-gray-900">Safety:</span> destructive endpoints or production-like
          constraints.
        </li>
      </ul>
    </aside>
  </div>
{/if}
