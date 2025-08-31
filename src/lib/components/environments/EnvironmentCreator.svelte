<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { createEnvironment } from '$lib/http_client/environments';
  import type { CreateEnvironmentData } from '$lib/types/environment';

  const dispatch = createEventDispatcher<{
    created: { environment: any };
    close: void;
  }>();

  let name = '';
  let description = '';
  let isCreating = false;
  let error: string | null = null;

  async function handleSubmit() {
    if (!name.trim()) return;

    isCreating = true;
    error = null;

    try {
      // Create a basic environment set with dev and prod sub-environments
      const environmentData: CreateEnvironmentData = {
        name: name.trim(),
        description: description.trim() || undefined,
        config: {
          type: 'environment_set',
          environments: {
            dev: {
              name: 'Development',
              description: 'Development environment',
              variables: {},
              api_hosts: {}
            },
            prod: {
              name: 'Production',
              description: 'Production environment',
              variables: {},
              api_hosts: {}
            }
          },
          variable_definitions: {
            username: {
              type: 'string',
              description: 'Login username',
              required: true,
              default_value: 'default_user'
            },
            password: {
              type: 'string',
              description: 'Login password',
              required: false,
              default_value: 'changeme123'
            }
          },
          linked_apis: []
        }
      };

      const environment = await createEnvironment(environmentData);
      dispatch('created', { environment });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create environment';
    } finally {
      isCreating = false;
    }
  }

  function handleCancel() {
    dispatch('close');
  }
</script>

<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <div class="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
    <header class="flex justify-between items-center p-6 border-b border-gray-200">
      <h2 id="modal-title" class="text-xl font-semibold text-gray-900">Create New Environment</h2>
      <button class="p-2 hover:bg-gray-100 text-gray-500 hover:text-gray-900 rounded transition-colors" onclick={handleCancel} aria-label="Close">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </header>

    <form onsubmit={handleSubmit} class="p-6">
      <div class="mb-6">
        <label for="name" class="block mb-2 font-medium text-gray-700">Environment Name *</label>
        <input
          id="name"
          type="text"
          bind:value={name}
          placeholder="e.g., Hero Project"
          required
          disabled={isCreating}
          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm transition-colors focus:outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100 disabled:bg-gray-50 disabled:cursor-not-allowed"
        />
      </div>

      <div class="mb-6">
        <label for="description" class="block mb-2 font-medium text-gray-700">Description</label>
        <textarea
          id="description"
          bind:value={description}
          placeholder="Describe this environment set..."
          rows="3"
          disabled={isCreating}
          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm transition-colors focus:outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100 disabled:bg-gray-50 disabled:cursor-not-allowed"
        ></textarea>
      </div>

      <div class="bg-sky-50 border border-sky-200 rounded-md p-4 mb-6">
        <h4 class="text-sm font-semibold text-sky-900 mb-2">What will be created:</h4>
        <ul class="pl-5 text-sm text-sky-900 space-y-1">
          <li>Environment set with <strong>dev</strong> and <strong>prod</strong> sub-environments</li>
          <li>Basic variable definitions (username, password)</li>
          <li>Empty API host configurations ready for setup</li>
        </ul>
      </div>

      {#if error}
        <div class="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md mb-6 text-sm">
          {error}
        </div>
      {/if}

      <div class="flex gap-3 justify-end">
        <button type="button" onclick={handleCancel} disabled={isCreating} class="px-6 py-2 bg-white text-gray-700 border border-gray-300 rounded-md font-medium text-sm transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
          Cancel
        </button>
        <button type="submit" disabled={isCreating || !name.trim()} class="px-6 py-2 bg-blue-600 text-white rounded-md font-medium text-sm transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
          {#if isCreating}
            Creating...
          {:else}
            Create Environment
          {/if}
        </button>
      </div>
    </form>
  </div>
</div>


