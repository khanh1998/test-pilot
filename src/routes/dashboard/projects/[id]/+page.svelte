<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { setBreadcrumbOverride, clearBreadcrumbOverride } from '$lib/store/breadcrumb';
  import * as projectClient from '$lib/http_client/projects';
  import * as testFlowClient from '$lib/http_client/test-flow';
  import ProjectTabs from '$lib/components/projects/ProjectTabs.svelte';
  import ModuleCard from '$lib/components/projects/ModuleCard.svelte';
  import ModuleForm from '$lib/components/projects/ModuleForm.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import ProjectApiLinkManager from '$lib/components/projects/ProjectApiLinkManager.svelte';
  import ProjectEnvironmentManager from '$lib/components/projects/ProjectEnvironmentManager.svelte';
  import ProjectVariableManager from '$lib/components/projects/ProjectVariableManager.svelte';
  import type { Project, ProjectModule, ProjectApi, ProjectEnvironment } from '$lib/types/project';
  import type { TestFlow } from '$lib/types/test-flow';

  let projectId: number;
  let project: Project | null = null;
  let modules: ProjectModule[] = [];
  let apis: ProjectApi[] = [];
  let environments: ProjectEnvironment[] = [];
  let testFlows: TestFlow[] = [];
  
  let loading = true;
  let error: string | null = null;
  let activeTab = 'modules';
  let variableLoading = false;
  let isSaving = false;
  let hasUnsavedChanges = false;

  // Modal states
  let showCreateModuleModal = false;
  let showConfirmDialog = false;
  let isSubmitting = false;

  // Delete state
  let pendingDeleteModule: { id: number; name: string } | null = null;
  let pendingDeleteSequence: { id: number; name: string; moduleId: number } | null = null;

  $: projectId = parseInt($page.params.id);

    onMount(async () => {
    await loadProject();
  });

  onDestroy(() => {
    // Clean up breadcrumb overrides when leaving the page
    clearBreadcrumbOverride(projectId.toString());
  });

    async function loadProject() {
    try {
      loading = true;
      const projectDetail = await projectClient.getProject(projectId);
      project = projectDetail.project;
      modules = projectDetail.modules || [];
      environments = projectDetail.environments || [];
      
      // Initialize projectJson if it doesn't exist
      if (!project.projectJson) {
        project.projectJson = {
          variables: [],
          api_hosts: {},
          environment_mappings: []
        };
      }
      if (!project.projectJson.variables) {
        project.projectJson.variables = [];
      }
      if (!project.projectJson.environment_mappings) {
        project.projectJson.environment_mappings = [];
      }
      
      // Load APIs
      const apiResult = await projectClient.getProjectApis(projectId);
      apis = apiResult.projectApis || [];
      
      // Load test flows
      await loadTestFlows();

      // Set breadcrumb override for this project
      if (project?.name) {
        setBreadcrumbOverride(projectId.toString(), project.name);
      }
    } catch (err) {
      console.error('Failed to load project:', err);
      error = err instanceof Error ? err.message : 'Failed to load project';
    } finally {
      loading = false;
    }
  }

  async function loadTestFlows() {
    try {
      const response = await testFlowClient.getTestFlows();
      if (response) {
        testFlows = response.testFlows || [];
      }
    } catch (err) {
      console.error('Failed to load test flows:', err);
    }
  }

  async function handleCreateModule(event: CustomEvent<{ module: Partial<ProjectModule> }>) {
    const { module: moduleData } = event.detail;
    
    try {
      isSubmitting = true;
      const response = await projectClient.createModule(projectId, {
        name: moduleData.name!,
        description: moduleData.description
      });
      
      modules = [...modules, response.module];
      showCreateModuleModal = false;
    } catch (err) {
      console.error('Failed to create module:', err);
      error = err instanceof Error ? err.message : 'Failed to create module';
    } finally {
      isSubmitting = false;
    }
  }

  function handleEditProject() {
    // Switch to settings tab for project editing
    activeTab = 'settings';
  }

  function handleEditModule(module: ProjectModule) {
    goto(`/dashboard/projects/${projectId}/modules/${module.id}`);
  }

  function handleDeleteModule(module: ProjectModule) {
    pendingDeleteModule = { id: module.id, name: module.name };
    showConfirmDialog = true;
  }

  async function confirmDeleteModule() {
    if (!pendingDeleteModule) return;
    
    try {
      await projectClient.deleteModule(projectId, pendingDeleteModule.id);
      modules = modules.filter(m => m.id !== pendingDeleteModule!.id);
      showConfirmDialog = false;
      pendingDeleteModule = null;
    } catch (err) {
      console.error('Failed to delete module:', err);
      error = err instanceof Error ? err.message : 'Failed to delete module';
    }
  }

  function cancelDelete() {
    showConfirmDialog = false;
    pendingDeleteModule = null;
    pendingDeleteSequence = null;
  }

  function openCreateModuleModal() {
    showCreateModuleModal = true;
  }

  function closeCreateModuleModal() {
    showCreateModuleModal = false;
  }

  // Variable management handlers
  async function handleCreateVariable(event: CustomEvent<{ variable: any }>) {
    if (!project) return;
    
    const newVariable = event.detail.variable;
    
    // Initialize projectJson.variables if it doesn't exist
    if (!project.projectJson) {
      project.projectJson = { variables: [], api_hosts: {}, environment_mappings: [] };
    }
    if (!project.projectJson.variables) {
      project.projectJson.variables = [];
    }
    
    // Add the new variable
    project.projectJson.variables = [...project.projectJson.variables, newVariable];
    
    // Trigger reactivity
    project = { ...project };

    // Save to database
    try {
      variableLoading = true;
      await projectClient.updateProject(projectId, {
        projectJson: project.projectJson
      });
    } catch (err) {
      console.error('Failed to save variable:', err);
      error = err instanceof Error ? err.message : 'Failed to save variable';
      
      // Rollback on error
      project.projectJson.variables = project.projectJson.variables.filter(v => v !== newVariable);
      project = { ...project };
    } finally {
      variableLoading = false;
    }
  }

  async function handleUpdateVariable(event: CustomEvent<{ index: number; variable: any }>) {
    if (!project?.projectJson?.variables) return;
    
    const { index, variable } = event.detail;
    const originalVariable = project.projectJson.variables[index];
    
    // Update the variable at the specified index
    project.projectJson.variables[index] = variable;
    
    // Trigger reactivity
    project = { ...project };

    // Save to database
    try {
      variableLoading = true;
      await projectClient.updateProject(projectId, {
        projectJson: project.projectJson
      });
    } catch (err) {
      console.error('Failed to update variable:', err);
      error = err instanceof Error ? err.message : 'Failed to update variable';
      
      // Rollback on error
      project.projectJson.variables[index] = originalVariable;
      project = { ...project };
    } finally {
      variableLoading = false;
    }
  }

  async function handleDeleteVariable(event: CustomEvent<{ index: number }>) {
    if (!project?.projectJson?.variables) return;
    
    const { index } = event.detail;
    const deletedVariable = project.projectJson.variables[index];
    
    // Remove the variable at the specified index
    project.projectJson.variables = project.projectJson.variables.filter((_, i) => i !== index);
    
    // Trigger reactivity
    project = { ...project };

    // Save to database
    try {
      variableLoading = true;
      await projectClient.updateProject(projectId, {
        projectJson: project.projectJson
      });
    } catch (err) {
      console.error('Failed to delete variable:', err);
      error = err instanceof Error ? err.message : 'Failed to delete variable';
      
      // Rollback on error
      project.projectJson.variables.splice(index, 0, deletedVariable);
      project = { ...project };
    } finally {
      variableLoading = false;
    }
  }

  async function handleReorderVariable(event: CustomEvent<{ fromIndex: number; toIndex: number }>) {
    if (!project?.projectJson?.variables) return;
    
    const { fromIndex, toIndex } = event.detail;
    const originalVariables = [...project.projectJson.variables];
    const variables = [...project.projectJson.variables];
    
    // Reorder the variables
    const [movedVariable] = variables.splice(fromIndex, 1);
    variables.splice(toIndex, 0, movedVariable);
    
    project.projectJson.variables = variables;
    
    // Trigger reactivity
    project = { ...project };

    // Save to database
    try {
      variableLoading = true;
      await projectClient.updateProject(projectId, {
        projectJson: project.projectJson
      });
    } catch (err) {
      console.error('Failed to reorder variables:', err);
      error = err instanceof Error ? err.message : 'Failed to reorder variables';
      
      // Rollback on error
      project.projectJson.variables = originalVariables;
      project = { ...project };
    } finally {
      variableLoading = false;
    }
  }

  // Environment management handlers
  async function handleLinkEnvironment(event: CustomEvent<{ environmentId: number; variableMappings: Record<string, string> }>) {
    try {
      const { environmentId, variableMappings } = event.detail;
      
      await projectClient.linkEnvironmentMapping(projectId, {
        environmentId,
        variableMappings
      });
      
      // Reload project data to get updated environments
      await loadProject();
    } catch (err) {
      console.error('Failed to link environment:', err);
      error = err instanceof Error ? err.message : 'Failed to link environment';
    }
  }

  async function handleUpdateEnvironmentMapping(event: CustomEvent<{ id: number; variableMappings: Record<string, string> }>) {
    try {
      const { id, variableMappings } = event.detail;
      
      // Find the environment mapping in the environments array (to get environmentId)
      const envMapping = environments.find(env => env.id === id);
      if (!envMapping) {
        throw new Error('Environment mapping not found');
      }
      
      await projectClient.updateEnvironmentMappingInProject(projectId, envMapping.environmentId, {
        variableMappings
      });
      
      // Reload project data
      await loadProject();
    } catch (err) {
      console.error('Failed to update environment mapping:', err);
      error = err instanceof Error ? err.message : 'Failed to update environment mapping';
    }
  }

  async function handleUnlinkEnvironment(event: CustomEvent<{ id: number }>) {
    try {
      const { id } = event.detail;
      
      // Find the environment mapping to get the environmentId
      const envMapping = environments.find(env => env.id === id);
      if (!envMapping) {
        throw new Error('Environment mapping not found');
      }
      
      await projectClient.unlinkEnvironmentMapping(projectId, envMapping.environmentId);
      
      // Reload project data
      await loadProject();
    } catch (err) {
      console.error('Failed to unlink environment:', err);
      error = err instanceof Error ? err.message : 'Failed to unlink environment';
    }
  }

  // API management handlers
  async function handleLinkApi(event: CustomEvent<{ apiId: number; defaultHost?: string }>) {
    try {
      const { apiId, defaultHost } = event.detail;
      await projectClient.linkApiToProject(projectId, { apiId, defaultHost });
      await loadProject(); // Reload to get updated data
    } catch (err) {
      console.error('Failed to link API:', err);
      error = err instanceof Error ? err.message : 'Failed to link API';
    }
  }

  async function handleUpdateApiHost(event: CustomEvent<{ id: number; defaultHost: string }>) {
    try {
      const { id, defaultHost } = event.detail;
      
      // Find the project API to get the apiId
      const projectApi = apis.find(api => api.id === id);
      if (!projectApi) {
        throw new Error('Project API not found');
      }
      
      await projectClient.updateProjectApiHost(projectId, projectApi.apiId, { defaultHost });
      await loadProject(); // Reload to get updated data
    } catch (err) {
      console.error('Failed to update API host:', err);
      error = err instanceof Error ? err.message : 'Failed to update API host';
    }
  }

  async function handleUnlinkApi(event: CustomEvent<{ id: number }>) {
    try {
      const { id } = event.detail;
      
      // Find the project API to get the apiId
      const projectApi = apis.find(api => api.id === id);
      if (!projectApi) {
        throw new Error('Project API not found');
      }
      
      await projectClient.unlinkApiFromProject(projectId, projectApi.apiId);
      await loadProject(); // Reload to get updated data
    } catch (err) {
      console.error('Failed to unlink API:', err);
      error = err instanceof Error ? err.message : 'Failed to unlink API';
    }
  }

  // Mark changes as needing save
  function markDirty() {
    hasUnsavedChanges = true;
  }

  // Save project changes
  async function saveProject() {
    if (!project || !hasUnsavedChanges) return;
    
    try {
      isSaving = true;
      
      await projectClient.updateProject(projectId, {
        name: project.name,
        description: project.description,
        projectJson: project.projectJson
      });
      
      hasUnsavedChanges = false;
    } catch (err) {
      console.error('Failed to save project:', err);
      error = err instanceof Error ? err.message : 'Failed to save project';
    } finally {
      isSaving = false;
    }
  }
</script>

<svelte:head>
  <title>{project?.name || 'Project'} - Test Pilot</title>
</svelte:head>

{#if loading}
  <div class="flex justify-center items-center py-12">
    <div class="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
  </div>
{:else if error}
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="bg-red-50 border border-red-200 rounded-md p-4">
      <div class="flex">
        <svg class="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
        </svg>
        <p class="text-sm text-red-700">{error}</p>
      </div>
    </div>
  </div>
{:else if project}
  <div class="min-h-screen bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Project Tabs -->
      <ProjectTabs {modules} {apis} {environments} variables={project?.projectJson?.variables || []} bind:activeTab>
        <div slot="tab-content">
          
          <!-- Save button (shown on settings tab) -->
          {#if activeTab === 'settings' || activeTab === 'variables'}
            <div class="mb-6 flex justify-between items-center">
              <div>
                {#if hasUnsavedChanges}
                  <p class="text-sm text-amber-600">You have unsaved changes</p>
                {/if}
              </div>
              <button
                type="button"
                on:click={saveProject}
                disabled={isSaving || !hasUnsavedChanges}
                class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {#if isSaving}
                  <div class="w-4 h-4 mr-2 animate-spin rounded-full border-t-2 border-b-2 border-white"></div>
                  Saving...
                {:else}
                  Save Changes
                {/if}
              </button>
            </div>
          {/if}
          
          <!-- Modules Tab -->
          {#if activeTab === 'modules'}
            <div>
              <div class="mb-6 flex justify-between items-center">
                <h3 class="text-lg font-medium text-gray-900">Modules</h3>
                <button
                  type="button"
                  on:click={openCreateModuleModal}
                  class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                  </svg>
                  New Module
                </button>
              </div>

              {#if modules.length === 0}
                <div class="text-center py-12 bg-white rounded-lg shadow">
                  <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                  </svg>
                  <h3 class="mt-2 text-sm font-medium text-gray-900">No modules yet</h3>
                  <p class="mt-1 text-sm text-gray-500">Get started by creating your first module.</p>
                  <div class="mt-6">
                    <button
                      type="button"
                      on:click={openCreateModuleModal}
                      class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                      </svg>
                      New Module
                    </button>
                  </div>
                </div>
              {:else}
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {#each modules as module (module.id)}
                    <ModuleCard
                      {module}
                      href="/dashboard/projects/{projectId}/modules/{module.id}"
                      onEdit={handleEditModule}
                      onDelete={handleDeleteModule}
                    />
                  {/each}
                </div>
              {/if}
            </div>

          <!-- Other tabs content placeholder -->
          {:else if activeTab === 'apis'}
            <ProjectApiLinkManager 
              linkedApis={apis} 
              {loading}
              disabled={isSaving}
              on:link={handleLinkApi}
              on:updateHost={handleUpdateApiHost}
              on:unlink={handleUnlinkApi}
            />
          
          {:else if activeTab === 'environments'}
            <ProjectEnvironmentManager 
              {environments} 
              {loading}
              {projectId}
              projectVariables={project?.projectJson?.variables || []}
              on:link={handleLinkEnvironment}
              on:updateMapping={handleUpdateEnvironmentMapping}
              on:unlink={handleUnlinkEnvironment}
            />
            
          {:else if activeTab === 'variables'}
            <ProjectVariableManager 
              variables={project?.projectJson?.variables || []} 
              {loading}
              on:create={handleCreateVariable}
              on:update={handleUpdateVariable}
              on:delete={handleDeleteVariable}
              on:reorder={handleReorderVariable}
            />
          
          {:else if activeTab === 'settings'}
            <div class="bg-white shadow rounded-lg p-6">
              <h3 class="text-lg font-medium text-gray-900 mb-4">Project Settings</h3>
              
              <div class="space-y-6">
                <!-- Project Information -->
                <div>
                  <h4 class="text-md font-medium text-gray-900 mb-3">Project Information</h4>
                  <div class="grid grid-cols-1 gap-4">
                    <div>
                      <label for="project-name" class="block text-sm font-medium text-gray-700">Name</label>
                      <input
                        id="project-name"
                        type="text"
                        bind:value={project.name}
                        on:input={markDirty}
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        placeholder="Project name"
                      />
                    </div>
                    
                    <div>
                      <label for="project-description" class="block text-sm font-medium text-gray-700">Description</label>
                      <textarea
                        id="project-description"
                        rows="3"
                        bind:value={project.description}
                        on:input={markDirty}
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        placeholder="Project description"
                      ></textarea>
                    </div>
                  </div>
                </div>
                
                <!-- Danger Zone -->
                <div class="border-t border-gray-200 pt-6">
                  <h4 class="text-md font-medium text-red-600 mb-3">Danger Zone</h4>
                  <div class="bg-red-50 border border-red-200 rounded-md p-4">
                    <div class="flex">
                      <div class="flex-shrink-0">
                        <svg class="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L3.316 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                        </svg>
                      </div>
                      <div class="ml-3">
                        <h5 class="text-sm font-medium text-red-800">Delete Project</h5>
                        <div class="mt-2 text-sm text-red-700">
                          <p>Once you delete a project, there is no going back. Please be certain.</p>
                        </div>
                        <div class="mt-4">
                          <button
                            type="button"
                            class="bg-red-600 border border-transparent rounded-md py-2 px-4 inline-flex justify-center text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          >
                            Delete Project
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
          {:else}
            <div class="bg-white shadow rounded-lg p-6">
              <h3 class="text-lg font-medium text-gray-900 mb-4">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h3>
              <p class="text-gray-500">This tab content is coming soon...</p>
            </div>
          {/if}
          
        </div>
      </ProjectTabs>
    </div>
  </div>
{/if}

<!-- Create Module Modal -->
{#if showCreateModuleModal}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div class="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
      <div class="mb-4">
        <h3 class="text-lg font-medium text-gray-900">Create New Module</h3>
        <p class="text-sm text-gray-500 mt-1">
          Create a module to organize related test flow sequences.
        </p>
      </div>
      
      <ModuleForm
        isLoading={isSubmitting}
        mode="create"
        on:submit={handleCreateModule}
        on:cancel={closeCreateModuleModal}
      />
    </div>
  </div>
{/if}

<!-- Confirm Delete Dialog -->
{#if showConfirmDialog && pendingDeleteModule}
  <ConfirmDialog
    isOpen={showConfirmDialog}
    title="Delete Module"
    message="Are you sure you want to delete '{pendingDeleteModule.name}'? This action cannot be undone and will delete all sequences in this module."
    confirmText="Delete"
    cancelText="Cancel"
    confirmVariant="danger"
    on:confirm={confirmDeleteModule}
    on:cancel={cancelDelete}
  />
{/if}
