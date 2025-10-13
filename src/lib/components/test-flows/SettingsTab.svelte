<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import FlowInfoEditor from './FlowInfoEditor.svelte';
  import ApiHostManager from './ApiHostManager.svelte';
  import EnvironmentLinkingManager from '../environments/EnvironmentLinkingManager.svelte';
  import type { TestFlowData } from './types';
  import type { Environment } from '$lib/types/environment';

  export let name: string;
  export let description: string | null;
  export let flowJson: TestFlowData;
  export let environment: Environment | null = null;
  export let disabled: boolean = false;

  const dispatch = createEventDispatcher();

  function handleNameChange(event: CustomEvent<{ name: string }>) {
    dispatch('nameChange', event.detail);
  }

  function handleDescriptionChange(event: CustomEvent<{ description: string | null }>) {
    dispatch('descriptionChange', event.detail);
  }

  function handleApiHostsChange(event: CustomEvent<{ apiHosts: TestFlowData['settings']['api_hosts'] }>) {
    dispatch('apiHostsChange', event.detail);
  }

  function handleEnvironmentChange(event: CustomEvent<{ linkedEnvironment: any }>) {
    dispatch('environmentChange', event.detail);
  }
</script>

<div class="space-y-8">
  <!-- Flow Information and API Hosts in one row -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
    <!-- Flow Information -->
    <div>
      <FlowInfoEditor
        {name}
        {description}
        {disabled}
        on:nameChange={handleNameChange}
        on:descriptionChange={handleDescriptionChange}
      />
    </div>

    <!-- API Hosts Settings -->
    <div>
      <ApiHostManager
        apiHosts={flowJson.settings.api_hosts || {}}
        {disabled}
        on:change={handleApiHostsChange}
      />
    </div>
  </div>

  <!-- Environment Links Settings -->
  <div>
    <EnvironmentLinkingManager
      {environment}
      linkedEnvironment={flowJson.settings.linkedEnvironment || null}
      flowParameters={flowJson.parameters || []}
      {disabled}
      on:change={handleEnvironmentChange}
    />
  </div>
</div>
