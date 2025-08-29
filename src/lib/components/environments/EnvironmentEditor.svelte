<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import VariableDefinitionEditor from './VariableDefinitionEditor.svelte';
  import SubEnvironmentEditor from './SubEnvironmentEditor.svelte';
  import ApiHostEditor from './ApiHostEditor.svelte';
  import type { Environment, CreateEnvironmentData, EnvironmentConfig } from '$lib/types/environment';

  export let environment: Environment | null = null;
  export let isEditing: boolean = false;
  export let disabled: boolean = false;

  const dispatch = createEventDispatcher<{
    save: { environmentData: CreateEnvironmentData };
    cancel: void;
  }>();

  // Form data
  let name = environment?.name || '';
  let description = environment?.description || '';
  let environmentType: 'environment_set' | 'single_environment' = 
    environment?.config.type || 'environment_set';

  // Configuration data
  let variableDefinitions = environment?.config.variable_definitions || {};
  let subEnvironments = environment?.config.environments || {};
  let linkedApis = environment?.config.linked_apis || [];

  // Form state
  let activeTab: 'basic' | 'variables' | 'environments' | 'hosts' = 'basic';
  let isSubmitting = false;
  let validationErrors: string[] = [];

  function validateForm(): boolean {
    validationErrors = [];
    
    if (!name.trim()) {
      validationErrors.push('Environment name is required');
    }
    
    if (Object.keys(subEnvironments).length === 0) {
      validationErrors.push('At least one sub-environment is required');
    }
    
    // Validate that all required variables have values or defaults
    Object.entries(variableDefinitions).forEach(([varName, varDef]) => {
      if (varDef.required && !varDef.default_value) {
        // Check if any sub-environment has a value for this variable
        const hasValueInAnySubEnv = Object.values(subEnvironments).some(
          subEnv => subEnv.variables[varName] !== undefined && subEnv.variables[varName] !== ''
        );
        
        if (!hasValueInAnySubEnv) {
          validationErrors.push(`Required variable "${varName}" must have a default value or be set in at least one sub-environment`);
        }
      }
    });
    
    return validationErrors.length === 0;
  }

  async function handleSubmit() {
    if (!validateForm()) return;
    
    isSubmitting = true;
    
    try {
      const environmentData: CreateEnvironmentData = {
        name: name.trim(),
        description: description.trim() || undefined,
        config: {
          type: environmentType,
          environments: subEnvironments,
          variable_definitions: variableDefinitions,
          linked_apis: linkedApis
        }
      };
      
      dispatch('save', { environmentData });
    } catch (error) {
      console.error('Error saving environment:', error);
      validationErrors = ['Failed to save environment. Please try again.'];
    } finally {
      isSubmitting = false;
    }
  }

  function handleCancel() {
    dispatch('cancel');
  }

  function handleVariableDefinitionsChange(event: CustomEvent<{ variableDefinitions: any }>) {
    variableDefinitions = event.detail.variableDefinitions;
  }

  function handleSubEnvironmentsChange(event: CustomEvent<{ subEnvironments: any }>) {
    subEnvironments = event.detail.subEnvironments;
  }

  function handleLinkedApisChange(event: CustomEvent<{ linkedApis: number[] }>) {
    linkedApis = event.detail.linkedApis;
  }

  function setActiveTab(tab: typeof activeTab) {
    activeTab = tab;
  }

  // Auto-create basic sub-environments if none exist
  function createDefaultSubEnvironments() {
    if (Object.keys(subEnvironments).length === 0) {
      subEnvironments = {
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
      };
    }
  }

  // Initialize default sub-environments if creating new environment
  if (!isEditing && Object.keys(subEnvironments).length === 0) {
    createDefaultSubEnvironments();
  }
</script>

<div class="max-w-4xl mx-auto bg-white rounded-lg shadow-md overflow-hidden {disabled ? 'opacity-60 pointer-events-none' : ''}" class:disabled>
  <div class="flex justify-between items-center p-8 border-b border-gray-200 bg-gray-50">
    <h2 class="text-2xl font-semibold text-gray-900">
      {isEditing ? `Edit ${environment?.name}` : 'Create New Environment'}
    </h2>
    
    <div class="flex gap-4">
      <button 
        class="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-md font-medium text-sm transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed" 
        on:click={handleCancel}
        {disabled}
        type="button"
      >
        Cancel
      </button>
      <button 
        class="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-md font-medium text-sm transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed" 
        on:click={handleSubmit}
        disabled={disabled || isSubmitting}
        type="button"
      >
        {#if isSubmitting}
          Saving...
        {:else}
          {isEditing ? 'Save Changes' : 'Create Environment'}
        {/if}
      </button>
    </div>
  </div>

  <!-- Validation Errors -->
  {#if validationErrors.length > 0}
    <div class="bg-red-50 border border-red-200 p-4">
      <h4 class="text-sm font-semibold text-red-800 mb-2">Please fix the following errors:</h4>
      <ul class="pl-5 text-sm text-red-700 space-y-1">
        {#each validationErrors as error}
          <li>{error}</li>
        {/each}
      </ul>
    </div>
  {/if}

  <!-- Tab Navigation -->
  <div class="border-b border-gray-200">
    <nav class="flex space-x-8 px-8" aria-label="Tabs">
    <button 
      class="flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors {activeTab === 'basic' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}" 
      on:click={() => setActiveTab('basic')}
      type="button"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14,2 14,8 20,8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
      </svg>
      Basic Info
    </button>
    
    <button 
      class="flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors {activeTab === 'variables' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}" 
      on:click={() => setActiveTab('variables')}
      type="button"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
      </svg>
      Variables
      <span class="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs font-medium">{Object.keys(variableDefinitions).length}</span>
    </button>
    
    <button 
      class="flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors {activeTab === 'environments' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}" 
      on:click={() => setActiveTab('environments')}
      type="button"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
      Sub-Environments
      <span class="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs font-medium">{Object.keys(subEnvironments).length}</span>
    </button>
    
    <button 
      class="flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors {activeTab === 'hosts' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}" 
      on:click={() => setActiveTab('hosts')}
      type="button"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M12 1v6m0 6v6"></path>
        <path d="m15.5 3.5-3 3 3 3"></path>
        <path d="m6.5 15.5 3-3-3-3"></path>
      </svg>
      API Hosts
      <span class="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs font-medium">
        {Object.values(subEnvironments).reduce((total, subEnv) => 
          total + Object.keys(subEnv.api_hosts || {}).length, 0
        )}
      </span>
    </button>
    </nav>
  </div>

  <!-- Tab Content -->
  <div class="p-8">
    {#if activeTab === 'basic'}
      <div class="space-y-6">
        <div>
          <label for="env-name" class="block text-sm font-medium text-gray-700 mb-2">Environment Name *</label>
          <input
            id="env-name"
            type="text"
            bind:value={name}
            placeholder="e.g., Hero Project, Customer Portal"
            required
            {disabled}
            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm transition-colors focus:outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100 disabled:bg-gray-50 disabled:cursor-not-allowed"
          />
          <p class="mt-1 text-sm text-gray-500">A descriptive name for this environment set</p>
        </div>

        <div>
          <label for="env-description" class="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea
            id="env-description"
            bind:value={description}
            placeholder="Describe the purpose of this environment set..."
            rows="3"
            {disabled}
            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm transition-colors focus:outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100 disabled:bg-gray-50 disabled:cursor-not-allowed"
          ></textarea>
          <p class="mt-1 text-sm text-gray-500">Optional description to help team members understand this environment</p>
        </div>

        <div>
          <label for="env-type" class="block text-sm font-medium text-gray-700 mb-2">Environment Type</label>
          <select
            id="env-type"
            bind:value={environmentType}
            {disabled}
            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm transition-colors focus:outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100 disabled:bg-gray-50 disabled:cursor-not-allowed"
          >
            <option value="environment_set">Environment Set (Multiple environments like dev, staging, prod)</option>
            <option value="single_environment">Single Environment (One configuration only)</option>
          </select>
          <p class="mt-1 text-sm text-gray-500">
            Choose "Environment Set" for multiple deployment environments, 
            or "Single Environment" for a simple one-time configuration
          </p>
        </div>
      </div>
    {:else if activeTab === 'variables'}
      <div>
        <VariableDefinitionEditor 
          bind:variableDefinitions
          on:change={handleVariableDefinitionsChange}
          {disabled}
        />
      </div>
    {:else if activeTab === 'environments'}
      <div>
        <SubEnvironmentEditor 
          bind:subEnvironments
          {variableDefinitions}
          on:change={handleSubEnvironmentsChange}
          {disabled}
        />
      </div>
    {:else if activeTab === 'hosts'}
      <div>
        <ApiHostEditor 
          bind:subEnvironments
          {linkedApis}
          on:change={handleSubEnvironmentsChange}
          on:updateLinkedApis={handleLinkedApisChange}
          {disabled}
        />
      </div>
    {/if}
  </div>
</div>


