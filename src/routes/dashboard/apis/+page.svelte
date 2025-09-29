<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { projectStore, type Project } from '$lib/store/project';
  import ApiList from '$lib/components/apis/ApiList.svelte';

  let selectedProject: Project | null = $state(null);
  let isProjectLoading = $state(false);
  let projectError: string | null = $state(null);

  // Subscribe to project store
  const unsubscribe = projectStore.subscribe((state) => {
    selectedProject = state.selectedProject;
    isProjectLoading = state.isLoading;
    projectError = state.error;
  });

  onDestroy(() => {
    unsubscribe();
  });
</script>

<div class="p-6">
  <div class="mb-6">
    <h1 class="text-2xl font-bold text-gray-900">API Management</h1>
    <p class="mt-1 text-sm text-gray-600">
      Manage your OpenAPI specifications and endpoints
    </p>
  </div>

  <ApiList {selectedProject} />
</div>
