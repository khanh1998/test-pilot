<!-- ProjectApiLinkManager.svelte - Link existing APIs to a project and manage default hosts -->
<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { ProjectApi } from '../../types/project.js';
  import type { Api } from '../../types/api.js';
  import { getApiList } from '../../http_client/apis.js';
  import { formatDate } from '../../utils/date.js';

  export let linkedApis: ProjectApi[] = [];
  export let loading = false;
  export let disabled = false;

  const dispatch = createEventDispatcher<{
    link: { apiId: number; defaultHost?: string };
    updateHost: { id: number; defaultHost: string };
    unlink: { id: number };
  }>();

  let availableApis: Api[] = [];
  let loadingApis = false;
  let showLinkModal = false;
  let selectedApiId: number | null = null;
  let defaultHost = '';
  let editingHostId: number | null = null;
  let editingHost = '';

  // Get API IDs that are already linked
  $: linkedApiIds = new Set(linkedApis.map(pa => pa.apiId));
  $: unlinkedApis = availableApis.filter(api => !linkedApiIds.has(api.id));

  onMount(async () => {
    await loadAvailableApis();
  });

  async function loadAvailableApis() {
    try {
      loadingApis = true;
      const response = await getApiList();
      availableApis = response?.apis || [];
    } catch (error) {
      console.error('Failed to load available APIs:', error);
      availableApis = [];
    } finally {
      loadingApis = false;
    }
  }

  function openLinkModal() {
    selectedApiId = null;
    defaultHost = '';
    showLinkModal = true;
  }

  function closeLinkModal() {
    showLinkModal = false;
    selectedApiId = null;
    defaultHost = '';
  }

  function handleLinkApi() {
    if (selectedApiId === null) return;

    dispatch('link', {
      apiId: selectedApiId,
      defaultHost: defaultHost.trim() || undefined
    });

    closeLinkModal();
  }

  function startEditingHost(projectApi: ProjectApi) {
    editingHostId = projectApi.id;
    editingHost = projectApi.defaultHost || '';
  }

  function cancelEditingHost() {
    editingHostId = null;
    editingHost = '';
  }

  function saveHostUpdate() {
    if (editingHostId === null) return;

    dispatch('updateHost', {
      id: editingHostId,
      defaultHost: editingHost.trim()
    });

    editingHostId = null;
    editingHost = '';
  }

  function handleUnlinkApi(projectApi: ProjectApi) {
    const apiName = projectApi.api?.name || `API ${projectApi.apiId}`;
    if (confirm(`Are you sure you want to unlink "${apiName}" from this project?`)) {
      dispatch('unlink', { id: projectApi.id });
    }
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h3 class="text-lg font-medium text-gray-900">Project APIs</h3>
      <p class="mt-1 text-sm text-gray-500">
        Link existing APIs to this project and configure default host URLs.
      </p>
    </div>
    
    <button
      type="button"
      on:click={openLinkModal}
      {disabled}
      class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <svg class="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
      </svg>
      Link API
    </button>
  </div>

  <!-- Linked APIs List -->
  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
    </div>
  {:else if linkedApis.length === 0}
    <div class="text-center py-12">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">No APIs linked</h3>
      <p class="mt-1 text-sm text-gray-500">Get started by linking your first API to this project.</p>
      <div class="mt-6">
        <button
          type="button"
          on:click={openLinkModal}
          {disabled}
          class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg class="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
          </svg>
          Link API
        </button>
      </div>
    </div>
  {:else}
    <div class="bg-white shadow overflow-hidden sm:rounded-md">
      <ul class="divide-y divide-gray-200">
        {#each linkedApis as projectApi}
          <li class="px-6 py-4">
            <div class="flex items-center justify-between">
              <div class="flex-1 min-w-0">
                <div class="flex items-center space-x-3">
                  <div class="flex-shrink-0">
                    <svg class="h-8 w-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 truncate">
                      {projectApi.api?.name || `API ${projectApi.apiId}`}
                    </p>
                    {#if projectApi.api?.description}
                      <p class="text-sm text-gray-500 truncate">{projectApi.api.description}</p>
                    {/if}
                    
                    <!-- Default Host Configuration -->
                    <div class="mt-2">
                      {#if editingHostId === projectApi.id}
                        <div class="flex items-center space-x-2">
                          <span class="text-xs font-medium text-gray-700">Default Host:</span>
                          <input
                            type="url"
                            bind:value={editingHost}
                            class="flex-1 text-xs border border-gray-300 rounded px-2 py-1 focus:border-blue-500 focus:ring-blue-500"
                            placeholder="https://api.example.com"
                            aria-label="Default host URL"
                          />
                          <button
                            type="button"
                            on:click={saveHostUpdate}
                            class="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            on:click={cancelEditingHost}
                            class="text-xs bg-gray-300 text-gray-700 px-2 py-1 rounded hover:bg-gray-400"
                          >
                            Cancel
                          </button>
                        </div>
                      {:else}
                        <div class="flex items-center space-x-2">
                          <span class="text-xs font-medium text-gray-700">Default Host:</span>
                          <span class="text-xs text-gray-600">
                            {projectApi.defaultHost || 'Not configured'}
                          </span>
                          <button
                            type="button"
                            on:click={() => startEditingHost(projectApi)}
                            {disabled}
                            class="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
                          >
                            Edit
                          </button>
                        </div>
                      {/if}
                    </div>
                    
                    <p class="text-xs text-gray-400 mt-1">
                      Linked {formatDate(projectApi.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
              
              <div class="flex items-center space-x-2">
                <button
                  type="button"
                  on:click={() => handleUnlinkApi(projectApi)}
                  {disabled}
                  class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full disabled:opacity-50"
                  aria-label="Unlink API {projectApi.api?.name || `API ${projectApi.apiId}`}"
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<!-- Link API Modal -->
{#if showLinkModal}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div class="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
      <h3 class="text-lg font-bold text-gray-900 mb-4">Link API to Project</h3>
      
      {#if loadingApis}
        <div class="flex items-center justify-center py-8">
          <div class="h-6 w-6 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
          <span class="ml-2 text-sm text-gray-600">Loading APIs...</span>
        </div>
      {:else if unlinkedApis.length === 0}
        <div class="text-center py-8">
          <p class="text-sm text-gray-600 mb-4">All available APIs are already linked to this project.</p>
          <a 
            href="/dashboard/apis/upload" 
            class="text-blue-600 hover:text-blue-700 text-sm underline"
            on:click={closeLinkModal}
          >
            Upload a new API specification
          </a>
        </div>
      {:else}
        <div class="space-y-4">
          <div>
            <label for="api-select" class="block text-sm font-medium text-gray-700 mb-2">
              Select API *
            </label>
            <select
              id="api-select"
              bind:value={selectedApiId}
              class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value={null}>Choose an API...</option>
              {#each unlinkedApis as api}
                <option value={api.id}>
                  {api.name} {api.host ? `(${api.host})` : ''}
                </option>
              {/each}
            </select>
          </div>
          
          <div>
            <label for="default-host" class="block text-sm font-medium text-gray-700 mb-2">
              Default Host URL (optional)
            </label>
            <input
              id="default-host"
              type="url"
              bind:value={defaultHost}
              class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="https://api.example.com"
            />
            <p class="mt-1 text-xs text-gray-500">
              Override the API's default host for this project. Leave empty to use the API's original host.
            </p>
          </div>
        </div>
        
        <div class="flex justify-end space-x-3 mt-6">
          <button
            type="button"
            on:click={closeLinkModal}
            class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            on:click={handleLinkApi}
            disabled={selectedApiId === null}
            class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Link API
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
