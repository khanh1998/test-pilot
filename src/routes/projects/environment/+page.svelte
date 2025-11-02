<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { projectStore } from '$lib/store/project';
  import { getProjectEnvironment } from '$lib/http_client/projects';
  import type { ProjectEnvironmentLink } from '$lib/types/project_environment';
  
  let environment = $state<ProjectEnvironmentLink | null>(null);
  let isLoading = $state(true);
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
</script>

<div class="max-w-6xl mx-auto p-8">
  {#if isLoading}
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <div class="w-8 h-8 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
      <p class="text-gray-600">Loading environment...</p>
    </div>
  {:else if error}
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <h1 class="text-2xl font-semibold text-gray-700 mb-2">Error Loading Environment</h1>
      <p class="text-gray-600 mb-6">{error}</p>
      <a href="/dashboard/projects" class="text-blue-600 hover:underline font-medium">← Back to Projects</a>
    </div>
  {:else if !selectedProject}
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <svg class="h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
      <h1 class="text-2xl font-semibold text-gray-700 mb-2">No Project Selected</h1>
      <p class="text-gray-600 mb-6">Please select a project from the sidebar to view its environment.</p>
      <a href="/dashboard/projects" class="text-blue-600 hover:underline font-medium">← Back to Projects</a>
    </div>
  {:else if !environment}
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <svg class="h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
      <h1 class="text-2xl font-semibold text-gray-700 mb-2">No Environment Configured</h1>
      <p class="text-gray-600 mb-6">This project doesn't have an environment configured yet.</p>
      <a href="/dashboard/environments" class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
        <svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Create Environment
      </a>
    </div>
  {:else}
    <div class="flex justify-between items-start mb-8 gap-8">
      <div class="flex-1">
        <div class="flex items-center gap-3 mb-4">
          <h1 class="text-3xl font-bold text-gray-900">{selectedProject.name}</h1>
          <span class="text-gray-400">•</span>
          <span class="text-xl text-gray-600">Environment</span>
        </div>
        
        <h2 class="text-2xl font-semibold text-gray-800 mb-2">{environment.environment?.name || 'Unnamed Environment'}</h2>
        {#if environment.environment?.description}
          <p class="text-lg text-gray-600 mb-4">{environment.environment.description}</p>
        {/if}
        
        <div class="flex gap-8 text-sm">
          <span class="text-gray-600">
            <strong>Type:</strong> {environment.environment?.config?.type?.replace('_', ' ') || 'Unknown'}
          </span>
          <span class="text-gray-600">
            <strong>Linked:</strong> {new Date(environment.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
      
      <div class="flex gap-4">
        <a href="/dashboard/environment/{environment.environment?.id}/edit" class="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md font-medium text-sm hover:bg-gray-50 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
            <h2 class="text-2xl font-semibold text-gray-900 mb-6">Sub-Environments</h2>
            <div class="grid gap-6 grid-cols-1 lg:grid-cols-2">
              {#each subEnvironments as [subEnvName, subEnvConfig]}
                <div class="border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
                  <h3 class="text-xl font-semibold text-gray-900 mb-2">{subEnvName}</h3>
                  {#if (subEnvConfig as any)?.name !== subEnvName}
                    <p class="text-gray-600 mb-2">{(subEnvConfig as any).name}</p>
                  {/if}
                  {#if (subEnvConfig as any)?.description}
                    <p class="text-sm text-gray-600 mb-4">{(subEnvConfig as any).description}</p>
                  {/if}
                  
                  <div class="grid gap-4">
                    <div>
                      <h4 class="text-sm font-semibold text-gray-700 mb-2">Variables</h4>
                      {#if (subEnvConfig as any)?.variables && Object.keys((subEnvConfig as any).variables).length > 0}
                        <ul class="space-y-2">
                          {#each Object.entries((subEnvConfig as any).variables) as [varName, varValue]}
                            <li class="flex justify-between items-center py-2 border-b border-gray-100 text-sm last:border-b-0">
                              <span class="font-medium text-gray-700">{varName}:</span>
                              <code class="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{varValue}</code>
                            </li>
                          {/each}
                        </ul>
                      {:else}
                        <p class="text-sm text-gray-500 italic">Using default values</p>
                      {/if}
                    </div>
                    
                    <div>
                      <h4 class="text-sm font-semibold text-gray-700 mb-2">API Hosts</h4>
                      {#if (subEnvConfig as any)?.api_hosts && Object.keys((subEnvConfig as any).api_hosts).length > 0}
                        <ul class="space-y-2">
                          {#each Object.entries((subEnvConfig as any).api_hosts) as [apiId, hostUrl]}
                            <li class="flex justify-between items-center py-2 border-b border-gray-100 text-sm last:border-b-0">
                              <span class="font-medium text-gray-700">API {apiId}:</span>
                              <code class="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{hostUrl}</code>
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
            <h2 class="text-2xl font-semibold text-gray-900 mb-6">Variable Definitions</h2>
            <div class="border border-gray-200 rounded-lg overflow-hidden bg-white">
              <div class="grid grid-cols-5 bg-gray-50 border-b border-gray-200">
                <div class="px-3 py-3 font-semibold text-gray-700 text-sm">Name</div>
                <div class="px-3 py-3 font-semibold text-gray-700 text-sm">Type</div>
                <div class="px-3 py-3 font-semibold text-gray-700 text-sm">Required</div>
                <div class="px-3 py-3 font-semibold text-gray-700 text-sm">Default Value</div>
                <div class="px-3 py-3 font-semibold text-gray-700 text-sm">Description</div>
              </div>
              {#each variableDefinitions as [varName, varDef]}
                <div class="grid grid-cols-5 border-b border-gray-100 last:border-b-0">
                  <div class="px-3 py-3 flex items-center">
                    <code class="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-900">{varName}</code>
                  </div>
                  <div class="px-3 py-3 flex items-center">
                    <span class="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium uppercase">{(varDef as any).type}</span>
                  </div>
                  <div class="px-3 py-3 flex items-center">
                    <span class="px-2 py-1 rounded text-xs font-medium {(varDef as any).required ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}">
                      {(varDef as any).required ? 'Required' : 'Optional'}
                    </span>
                  </div>
                  <div class="px-3 py-3 flex items-center">
                    <code class="bg-gray-100 px-2 py-1 rounded text-xs font-mono text-gray-800">{JSON.stringify((varDef as any).default_value)}</code>
                  </div>
                  <div class="px-3 py-3 flex items-center">
                    <span class="text-gray-600 text-sm">{(varDef as any).description || '-'}</span>
                  </div>
                </div>
              {/each}
            </div>
          </section>
        {/if}

        <!-- Variable Mappings Section -->
        {#if Object.keys(environment.variableMappings || {}).length > 0}
          <section>
            <h2 class="text-2xl font-semibold text-gray-900 mb-6">Variable Mappings</h2>
            <div class="border border-gray-200 rounded-lg overflow-hidden bg-white">
              <div class="grid grid-cols-2 bg-gray-50 border-b border-gray-200">
                <div class="px-3 py-3 font-semibold text-gray-700 text-sm">Project Variable</div>
                <div class="px-3 py-3 font-semibold text-gray-700 text-sm">Environment Variable</div>
              </div>
              {#each Object.entries(environment.variableMappings) as [projectVar, envVar]}
                <div class="grid grid-cols-2 border-b border-gray-100 last:border-b-0">
                  <div class="px-3 py-3 flex items-center">
                    <code class="bg-blue-50 text-blue-800 px-2 py-1 rounded text-sm font-mono">{projectVar}</code>
                  </div>
                  <div class="px-3 py-3 flex items-center">
                    <code class="bg-green-50 text-green-800 px-2 py-1 rounded text-sm font-mono">{envVar}</code>
                  </div>
                </div>
              {/each}
            </div>
          </section>
        {/if}
      </div>
    {/if}
  {/if}
</div>
