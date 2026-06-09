<script lang="ts">
  import { onDestroy } from 'svelte';
  import { projectStore } from '$lib/store/project';
  import EnvironmentCreator from '$lib/components/environments/EnvironmentCreator.svelte';
  import { getProjectEnvironment, linkEnvironment } from '$lib/http_client/projects';
  import type { ProjectEnvironmentLink } from '$lib/types/project_environment';
  import type { Environment } from '$lib/types/environment';
  import { formatEnvironmentValueForInput } from '$lib/components/environments/value-format';

  let environment = $state<ProjectEnvironmentLink | null>(null);
  let isLoading = $state(true);
  let isLinkingEnvironment = $state(false);
  let showCreateEnvironment = $state(false);
  let error = $state<string | null>(null);
  let selectedProject = $state<any>(null);

  // Subscribe to project store
  const unsubscribe = projectStore.subscribe((state) => {
    selectedProject = state.selectedProject;
  });

  onDestroy(() => {
    unsubscribe();
  });

  $effect(() => {
    loadEnvironment();
  });

  async function loadEnvironment() {
    if (!selectedProject) {
      environment = null;
      error = null;
      isLoading = false;
      return;
    }

    try {
      isLoading = true;
      error = null;
      const response = await getProjectEnvironment(selectedProject.id);
      environment = response.environment;
    } catch (err) {
      console.error('Error loading project environment:', err);
      error = err instanceof Error ? err.message : 'Failed to load environment';
    } finally {
      isLoading = false;
    }
  }

  async function handleEnvironmentCreated(payload: { environment: Environment }) {
    if (!selectedProject) return;

    isLinkingEnvironment = true;
    error = null;

    try {
      const linkedEnvironment = await linkEnvironment(selectedProject.id, {
        environmentId: payload.environment.id,
        variableMappings: {}
      });

      environment = linkedEnvironment.link;
      showCreateEnvironment = false;
    } catch (err) {
      console.error('Error linking environment to project:', err);
      error =
        err instanceof Error
          ? err.message
          : 'Environment was created, but could not be linked to this project';
      showCreateEnvironment = false;
    } finally {
      isLinkingEnvironment = false;
    }
  }
</script>

<div class="mx-auto max-w-6xl p-8">
  {#if isLoading}
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <div
        class="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600"
      ></div>
      <p class="text-gray-600">Loading environment...</p>
    </div>
  {:else if error}
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <h1 class="mb-2 text-2xl font-semibold text-gray-700">Error Loading Environment</h1>
      <p class="mb-6 text-gray-600">{error}</p>
      <a href="/projects" class="font-medium text-blue-600 hover:underline">← Back to Projects</a>
    </div>
  {:else if !selectedProject}
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <svg
        class="mb-4 h-16 w-16 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
        />
      </svg>
      <h1 class="mb-2 text-2xl font-semibold text-gray-700">No Project Selected</h1>
      <p class="mb-6 text-gray-600">
        Please select a project from the sidebar to view its environment.
      </p>
      <a href="/projects" class="font-medium text-blue-600 hover:underline">← Back to Projects</a>
    </div>
  {:else if !environment}
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <svg
        class="mb-4 h-16 w-16 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
        />
      </svg>
      <h1 class="mb-2 text-2xl font-semibold text-gray-700">No Environment Configured</h1>
      <p class="mb-6 text-gray-600">This project doesn't have an environment configured yet.</p>
      <button
        type="button"
        onclick={() => (showCreateEnvironment = true)}
        disabled={isLinkingEnvironment}
        class="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4v16m8-8H4"
          />
        </svg>
        {isLinkingEnvironment ? 'Linking Environment...' : 'Create Environment'}
      </button>
    </div>
  {:else}
    <div class="mb-8 flex items-start justify-between gap-8">
      <div class="flex-1">
        <div class="mb-4 flex items-center gap-3">
          <h1 class="text-3xl font-bold text-gray-900">{selectedProject.name}</h1>
          <span class="text-gray-400">•</span>
          <span class="text-xl text-gray-600">Environment</span>
        </div>

        <h2 class="mb-2 text-2xl font-semibold text-gray-800">
          {environment.environment?.name || 'Unnamed Environment'}
        </h2>
        {#if environment.environment?.description}
          <p class="mb-4 text-lg text-gray-600">{environment.environment.description}</p>
        {/if}

        <div class="flex gap-8 text-sm">
          <span class="text-gray-600">
            <strong>Type:</strong>
            {environment.environment?.config?.type?.replace('_', ' ') || 'Unknown'}
          </span>
          <span class="text-gray-600">
            <strong>Linked:</strong>
            {new Date(environment.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div class="flex gap-4">
        <a
          href="/projects/environment/{environment.environment?.id}/edit"
          class="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="m18.5 2.5 a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          Edit Environment
        </a>
      </div>
    </div>

    <!-- Environment Details -->
    {#if environment.environment?.config}
      {@const envConfig = environment.environment.config}
      {@const subEnvironments = Object.entries(envConfig.environments || {})}
      {@const variableDefinitions = Object.entries(envConfig.variable_definitions || {})}

      <div class="flex flex-col gap-8">
        <!-- Sub-Environments Section -->
        {#if subEnvironments.length > 0}
          <section class="mb-12">
            <h2 class="mb-6 text-2xl font-semibold text-gray-900">Sub-Environments</h2>
            <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {#each subEnvironments as [subEnvName, subEnvConfig]}
                <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                  <h3 class="mb-2 text-xl font-semibold text-gray-900">{subEnvName}</h3>
                  {#if (subEnvConfig as any)?.name !== subEnvName}
                    <p class="mb-2 text-gray-600">{(subEnvConfig as any).name}</p>
                  {/if}
                  {#if (subEnvConfig as any)?.description}
                    <p class="mb-4 text-sm text-gray-600">{(subEnvConfig as any).description}</p>
                  {/if}

                  <div class="grid gap-4">
                    <div>
                      <h4 class="mb-2 text-sm font-semibold text-gray-700">Variables</h4>
                      {#if (subEnvConfig as any)?.variables && Object.keys((subEnvConfig as any).variables).length > 0}
                        <ul class="space-y-2">
                          {#each Object.entries((subEnvConfig as any).variables) as [varName, varValue]}
                            <li
                              class="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] items-start gap-3 border-b border-gray-100 py-2 text-sm last:border-b-0"
                            >
                              <span class="min-w-0 font-medium break-words text-gray-700"
                                >{varName}:</span
                              >
                              <code
                                class="max-w-full min-w-0 justify-self-end overflow-x-auto rounded bg-gray-100 px-2 py-1 font-mono text-xs break-all whitespace-pre-wrap text-gray-800"
                                >{formatEnvironmentValueForInput(varValue)}</code
                              >
                            </li>
                          {/each}
                        </ul>
                      {:else}
                        <p class="text-sm text-gray-500 italic">Using default values</p>
                      {/if}
                    </div>

                    <div>
                      <h4 class="mb-2 text-sm font-semibold text-gray-700">API Hosts</h4>
                      {#if (subEnvConfig as any)?.api_hosts && Object.keys((subEnvConfig as any).api_hosts).length > 0}
                        <ul class="space-y-2">
                          {#each Object.entries((subEnvConfig as any).api_hosts) as [apiId, hostUrl]}
                            <li
                              class="flex items-center justify-between border-b border-gray-100 py-2 text-sm last:border-b-0"
                            >
                              <span class="font-medium text-gray-700">API {apiId}:</span>
                              <code class="rounded bg-gray-100 px-2 py-1 font-mono text-xs"
                                >{hostUrl}</code
                              >
                            </li>
                          {/each}
                        </ul>
                      {:else}
                        <p class="text-sm text-gray-500 italic">No custom hosts configured</p>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </section>
        {/if}

        <!-- Variable Definitions Section -->
        {#if variableDefinitions.length > 0}
          <section>
            <h2 class="mb-6 text-2xl font-semibold text-gray-900">Variable Definitions</h2>
            <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div
                class="grid grid-cols-[minmax(8rem,1fr)_6rem_7rem_minmax(0,1.5fr)_minmax(0,1.2fr)] border-b border-gray-200 bg-gray-50"
              >
                <div class="px-3 py-3 text-sm font-semibold text-gray-700">Name</div>
                <div class="px-3 py-3 text-sm font-semibold text-gray-700">Type</div>
                <div class="px-3 py-3 text-sm font-semibold text-gray-700">Required</div>
                <div class="px-3 py-3 text-sm font-semibold text-gray-700">Default Value</div>
                <div class="px-3 py-3 text-sm font-semibold text-gray-700">Description</div>
              </div>
              {#each variableDefinitions as [varName, varDef]}
                <div
                  class="grid grid-cols-[minmax(8rem,1fr)_6rem_7rem_minmax(0,1.5fr)_minmax(0,1.2fr)] border-b border-gray-100 last:border-b-0"
                >
                  <div class="flex items-center px-3 py-3">
                    <code class="rounded bg-gray-100 px-2 py-1 font-mono text-sm text-gray-900"
                      >{varName}</code
                    >
                  </div>
                  <div class="flex items-center px-3 py-3">
                    <span
                      class="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 uppercase"
                      >{(varDef as any).type}</span
                    >
                  </div>
                  <div class="flex items-center px-3 py-3">
                    <span
                      class="rounded px-2 py-1 text-xs font-medium {(varDef as any).required
                        ? 'bg-red-50 text-red-700'
                        : 'bg-blue-50 text-blue-700'}"
                    >
                      {(varDef as any).required ? 'Required' : 'Optional'}
                    </span>
                  </div>
                  <div class="flex min-w-0 items-center px-3 py-3">
                    <code
                      class="max-w-full min-w-0 overflow-x-auto rounded bg-gray-100 px-2 py-1 font-mono text-xs break-all whitespace-pre-wrap text-gray-800"
                      >{formatEnvironmentValueForInput((varDef as any).default_value)}</code
                    >
                  </div>
                  <div class="flex items-center px-3 py-3">
                    <span class="text-sm text-gray-600">{(varDef as any).description || '-'}</span>
                  </div>
                </div>
              {/each}
            </div>
          </section>
        {/if}

        <!-- Variable Mappings Section -->
        {#if Object.keys(environment.variableMappings || {}).length > 0}
          <section>
            <h2 class="mb-6 text-2xl font-semibold text-gray-900">Variable Mappings</h2>
            <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div class="grid grid-cols-2 border-b border-gray-200 bg-gray-50">
                <div class="px-3 py-3 text-sm font-semibold text-gray-700">Project Variable</div>
                <div class="px-3 py-3 text-sm font-semibold text-gray-700">
                  Environment Variable
                </div>
              </div>
              {#each Object.entries(environment.variableMappings) as [projectVar, envVar]}
                <div class="grid grid-cols-2 border-b border-gray-100 last:border-b-0">
                  <div class="flex items-center px-3 py-3">
                    <code class="rounded bg-blue-50 px-2 py-1 font-mono text-sm text-blue-800"
                      >{projectVar}</code
                    >
                  </div>
                  <div class="flex items-center px-3 py-3">
                    <code class="rounded bg-green-50 px-2 py-1 font-mono text-sm text-green-800"
                      >{envVar}</code
                    >
                  </div>
                </div>
              {/each}
            </div>
          </section>
        {/if}
      </div>
    {/if}
  {/if}

  {#if showCreateEnvironment}
    <EnvironmentCreator
      onCreated={handleEnvironmentCreated}
      onClose={() => (showCreateEnvironment = false)}
    />
  {/if}
</div>
