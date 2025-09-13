<!-- ProjectForm.svelte - Form for creating/editing projects -->
<script lang="ts">
  import type { Project } from '../../types/project.js';
  import type { Api } from '../../types/api.js';
  import { createEventDispatcher } from 'svelte';

  export let project: Partial<Project> = {};
  export let availableApis: Api[] = [];
  export let selectedApiIds: number[] = [];
  export let isLoading: boolean = false;
  export let mode: 'create' | 'edit' = 'create';

  const dispatch = createEventDispatcher<{
    submit: { project: Partial<Project>; apiIds: number[] };
    cancel: void;
  }>();

  let name = project.name || '';
  let description = project.description || '';
  let selectedApis = new Set(selectedApiIds);

  $: isValid = name.trim().length > 0;

  function handleSubmit() {
    if (!isValid) return;

    dispatch('submit', {
      project: {
        ...project,
        name: name.trim(),
        description: description.trim() || undefined,
      },
      apiIds: Array.from(selectedApis)
    });
  }

  function handleCancel() {
    dispatch('cancel');
  }

  function toggleApi(apiId: number) {
    if (selectedApis.has(apiId)) {
      selectedApis.delete(apiId);
    } else {
      selectedApis.add(apiId);
    }
    selectedApis = selectedApis; // Trigger reactivity
  }
</script>

<form on:submit|preventDefault={handleSubmit} class="space-y-6">
  <!-- Project Name -->
  <div>
    <label for="project-name" class="block text-sm font-medium text-gray-700 mb-2">
      Project Name *
    </label>
    <input
      id="project-name"
      type="text"
      bind:value={name}
      required
      maxlength="255"
      class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
      placeholder="Enter project name"
      disabled={isLoading}
    />
    {#if name.trim().length === 0 && name.length > 0}
      <p class="mt-1 text-sm text-red-600">Project name is required</p>
    {/if}
  </div>

  <!-- Project Description -->
  <div>
    <label for="project-description" class="block text-sm font-medium text-gray-700 mb-2">
      Description
    </label>
    <textarea
      id="project-description"
      bind:value={description}
      rows="3"
      maxlength="1000"
      class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
      placeholder="Enter project description (optional)"
      disabled={isLoading}
    ></textarea>
    <p class="mt-1 text-sm text-gray-500">{description.length}/1000 characters</p>
  </div>

  <!-- API Selection -->
  {#if availableApis.length > 0}
    <fieldset>
      <legend class="block text-sm font-medium text-gray-700 mb-3">
        APIs to Include
      </legend>
      <div class="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-3">
        {#each availableApis as api (api.id)}
          <label class="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedApis.has(api.id)}
              on:change={() => toggleApi(api.id)}
              class="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              disabled={isLoading}
            />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900">{api.name}</p>
              {#if api.description}
                <p class="text-sm text-gray-500">{api.description}</p>
              {/if}
              {#if api.host}
                <p class="text-xs text-gray-400 font-mono">{api.host}</p>
              {/if}
            </div>
          </label>
        {/each}
      </div>
      <p class="mt-2 text-sm text-gray-500">
        {selectedApis.size} of {availableApis.length} APIs selected
      </p>
    </fieldset>
  {:else}
    <div class="bg-yellow-50 border border-yellow-200 rounded-md p-4">
      <div class="flex">
        <svg class="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
        </svg>
        <div>
          <h3 class="text-sm font-medium text-yellow-800">No APIs Available</h3>
          <p class="text-sm text-yellow-700 mt-1">
            You need to import API specifications before creating a project.
            <a href="/dashboard/apis" class="font-medium underline hover:text-yellow-900">
              Import APIs now
            </a>
          </p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Form Actions -->
  <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200">
    <button
      type="button"
      on:click={handleCancel}
      class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      disabled={isLoading}
    >
      Cancel
    </button>
    <button
      type="submit"
      class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={!isValid || isLoading}
    >
      {#if isLoading}
        <svg class="w-4 h-4 mr-2 animate-spin inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
      {/if}
      {mode === 'create' ? 'Create Project' : 'Save Changes'}
    </button>
  </div>
</form>
