<script lang="ts">
  import type { Project } from '$lib/store/project';

  interface Props {
    selectedProject: Project | null;
  }

  let { selectedProject }: Props = $props();
</script>

<div class="bg-white rounded-lg border border-gray-200 p-6">
  <div class="text-center py-12">
    <svg class="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
    <h3 class="mt-4 text-lg font-medium text-gray-900">Environment Management</h3>
    <p class="mt-2 text-gray-500">
      {#if selectedProject}
        Environment management for project "{selectedProject.name}" is coming soon.
      {:else}
        Please select a project to manage environments.
      {/if}
    </p>
    <div class="mt-6">
      <button
        type="button"
        class="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        disabled
      >
        Coming Soon
      </button>
    </div>
  </div>
</div>