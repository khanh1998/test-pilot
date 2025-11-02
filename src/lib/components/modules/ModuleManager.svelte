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
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
    <h3 class="mt-4 text-lg font-medium text-gray-900">Module Management</h3>
    <p class="mt-2 text-gray-500">
      {#if selectedProject}
        Module management for project "{selectedProject.name}" is coming soon.
      {:else}
        Please select a project to manage modules.
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