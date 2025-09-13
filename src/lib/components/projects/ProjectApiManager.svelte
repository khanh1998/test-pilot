<!-- ProjectApiManager.svelte - Manage APIs for a project -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ProjectApi } from '../../types/project.js';
  import { formatDate } from '../../utils/date.js';

  export let apis: ProjectApi[] = [];
  export let loading = false;

  const dispatch = createEventDispatcher<{
    create: { name: string; description?: string; host: string; version?: string };
    update: { id: number; api: Partial<ProjectApi> };
    delete: { id: number };
    upload: { file: File };
  }>();

  let showCreateModal = false;
  let showUploadModal = false;
  let editingApi: ProjectApi | null = null;
  let newApi = {
    name: '',
    description: '',
    host: '',
    version: '1.0.0'
  };

  function resetNewApi() {
    newApi = {
      name: '',
      description: '',
      host: '',
      version: '1.0.0'
    };
  }

  function handleCreate() {
    if (!newApi.name?.trim() || !newApi.host?.trim()) return;
    
    dispatch('create', { 
      name: newApi.name.trim(),
      description: newApi.description?.trim() || undefined,
      host: newApi.host.trim(),
      version: newApi.version?.trim() || undefined
    });
    resetNewApi();
    showCreateModal = false;
  }

  function handleEdit(api: ProjectApi) {
    editingApi = { 
      ...api,
      api: api.api ? { ...api.api } : { id: 0, name: '', description: '', host: '' }
    };
  }

  function handleUpdate() {
    if (!editingApi?.api?.name?.trim() || !editingApi?.defaultHost?.trim()) return;
    
    dispatch('update', { id: editingApi.id, api: editingApi });
    editingApi = null;
  }

  function handleDelete(api: ProjectApi) {
    const apiName = api.api?.name || `API ${api.id}`;
    if (confirm(`Are you sure you want to delete "${apiName}"?`)) {
      dispatch('delete', { id: api.id });
    }
  }

  function handleFileUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (file && (file.name.endsWith('.yaml') || file.name.endsWith('.yml') || file.name.endsWith('.json'))) {
      dispatch('upload', { file });
      showUploadModal = false;
      target.value = ''; // Reset file input
    }
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h3 class="text-lg font-medium text-gray-900">API Management</h3>
      <p class="mt-1 text-sm text-gray-500">
        Manage OpenAPI specifications for this project. Upload YAML/JSON files or create APIs manually.
      </p>
    </div>
    
    <div class="flex items-center space-x-3">
      <button
        type="button"
        on:click={() => (showUploadModal = true)}
        class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <svg class="-ml-1 mr-2 h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
        </svg>
        Upload OpenAPI
      </button>
      
      <button
        type="button"
        on:click={() => (showCreateModal = true)}
        class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <svg class="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
        </svg>
        Create API
      </button>
    </div>
  </div>

  <!-- APIs List -->
  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
    </div>
  {:else if apis.length === 0}
    <div class="text-center py-12">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9 3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">No APIs</h3>
      <p class="mt-1 text-sm text-gray-500">Get started by uploading an OpenAPI specification or creating an API manually.</p>
      <div class="mt-6 flex justify-center space-x-3">
        <button
          type="button"
          on:click={() => (showUploadModal = true)}
          class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Upload OpenAPI
        </button>
        <button
          type="button"
          on:click={() => (showCreateModal = true)}
          class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          Create API
        </button>
      </div>
    </div>
  {:else}
    <div class="bg-white shadow overflow-hidden sm:rounded-md">
      <ul class="divide-y divide-gray-200">
        {#each apis as api}
          <li class="px-6 py-4">
            {#if editingApi && editingApi.id === api.id}
              <!-- Edit Mode -->
              <div class="space-y-4">
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label for="edit-api-name-{api.id}" class="block text-sm font-medium text-gray-700">Name</label>
                    <input
                      id="edit-api-name-{api.id}"
                      type="text"
                      bind:value={editingApi.api!.name}
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="API Name"
                    />
                  </div>
                  
                  <div>
                    <label for="edit-api-host-{api.id}" class="block text-sm font-medium text-gray-700">Host URL</label>
                    <input
                      id="edit-api-host-{api.id}"
                      type="url"
                      bind:value={editingApi.defaultHost}
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="https://api.example.com"
                    />
                  </div>
                  
                  <div>
                    <label for="edit-api-version-{api.id}" class="block text-sm font-medium text-gray-700">Version</label>
                    <input
                      id="edit-api-version-{api.id}"
                      type="text"
                      value=""
                      readonly
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-50 sm:text-sm"
                      placeholder="Not available"
                    />
                  </div>
                </div>
                
                <div>
                  <label for="edit-api-desc-{api.id}" class="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    id="edit-api-desc-{api.id}"
                    bind:value={editingApi.api!.description}
                    rows="2"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Optional description"
                  ></textarea>
                </div>
                
                <div class="flex justify-end space-x-3">
                  <button
                    type="button"
                    on:click={() => (editingApi = null)}
                    class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    on:click={handleUpdate}
                    class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                    disabled={!editingApi?.api?.name?.trim() || !editingApi?.defaultHost?.trim()}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            {:else}
              <!-- View Mode -->
              <div class="flex items-center justify-between">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center space-x-3">
                    <div class="flex-shrink-0">
                      <svg class="h-8 w-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9 3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
                      </svg>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-900 truncate">{api.api?.name || `API ${api.id}`}</p>
                      <div class="flex items-center space-x-4 mt-1">
                        <p class="text-sm text-gray-500 truncate">{api.defaultHost || api.api?.host || 'No host configured'}</p>
                      </div>
                      {#if api.api?.description}
                        <p class="text-sm text-gray-500 mt-1">{api.api.description}</p>
                      {/if}
                      <p class="text-xs text-gray-400 mt-1">
                        Created {formatDate(api.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div class="flex items-center space-x-2">
                  <button
                    type="button"
                    on:click={() => handleEdit(api)}
                    class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                    aria-label="Edit API {api.api?.name || `API ${api.id}`}"
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                  </button>
                  
                  <button
                    type="button"
                    on:click={() => handleDelete(api)}
                    class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                    aria-label="Delete API {api.api?.name || `API ${api.id}`}"
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<!-- Create API Modal -->
{#if showCreateModal}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div class="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
      <h3 class="text-lg font-bold text-gray-900 mb-4">Create New API</h3>
      
      <div class="space-y-4">
        <div>
          <label for="new-api-name" class="block text-sm font-medium text-gray-700">Name *</label>
          <input
            id="new-api-name"
            type="text"
            bind:value={newApi.name}
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="My API"
          />
        </div>
        
        <div>
          <label for="new-api-host" class="block text-sm font-medium text-gray-700">Host URL *</label>
          <input
            id="new-api-host"
            type="url"
            bind:value={newApi.host}
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="https://api.example.com"
          />
        </div>
        
        <div>
          <label for="new-api-version" class="block text-sm font-medium text-gray-700">Version</label>
          <input
            id="new-api-version"
            type="text"
            bind:value={newApi.version}
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="1.0.0"
          />
        </div>
        
        <div>
          <label for="new-api-description" class="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            id="new-api-description"
            bind:value={newApi.description}
            rows="2"
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="Optional description"
          ></textarea>
        </div>
      </div>
      
      <div class="flex justify-end space-x-3 mt-6">
        <button
          type="button"
          on:click={() => {
            showCreateModal = false;
            resetNewApi();
          }}
          class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          on:click={handleCreate}
          disabled={!newApi.name?.trim() || !newApi.host?.trim()}
          class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Create API
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Upload OpenAPI Modal -->
{#if showUploadModal}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div class="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
      <h3 class="text-lg font-bold text-gray-900 mb-4">Upload OpenAPI Specification</h3>
      
      <div class="space-y-4">
        <div>
          <label for="openapi-file-upload" class="block text-sm font-medium text-gray-700 mb-2">
            Select OpenAPI file (YAML or JSON)
          </label>
          <input
            id="openapi-file-upload"
            type="file"
            accept=".yaml,.yml,.json"
            on:change={handleFileUpload}
            class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <p class="mt-1 text-xs text-gray-500">
            Supported formats: .yaml, .yml, .json
          </p>
        </div>
      </div>
      
      <div class="flex justify-end space-x-3 mt-6">
        <button
          type="button"
          on:click={() => (showUploadModal = false)}
          class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}
