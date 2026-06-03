<script lang="ts">
  
  import FlowInfoEditor from './FlowInfoEditor.svelte';
  import ApiHostManager from './ApiHostManager.svelte';
  import EnvironmentLinkingManager from '../environments/EnvironmentLinkingManager.svelte';
  import type { TestFlowData } from './types';
  import type { Environment } from '$lib/types/environment';

  interface Props {
    [key: string]: unknown;
    name: string;
    description: string | null;
    flowJson: TestFlowData;
    environment?: Environment | null;
    disabled?: boolean;
  }

  let {
    name,
    description,
    flowJson,
    environment = null,
    disabled = false
  , ...callbackProps
  }: Props & Record<string, unknown> = $props();

  function dispatch(eventName: string, detail?: unknown) {
    const handler = callbackProps["on" + eventName.charAt(0).toUpperCase() + eventName.slice(1)];
    if (typeof handler === "function") {
      if (arguments.length > 1) {
        handler(detail);
      } else {
        handler();
      }
    }
  }

  function handleNameChange(payload: { name: string }) {
    dispatch('nameChange', payload);
  }

  function handleDescriptionChange(payload: { description: string | null }) {
    dispatch('descriptionChange', payload);
  }

  function handleApiHostsChange(payload: { apiHosts: TestFlowData['settings']['api_hosts'] }) {
    dispatch('apiHostsChange', payload);
  }

  function handleEnvironmentChange(payload: { linkedEnvironment: any }) {
    dispatch('environmentChange', payload);
  }

  function handleSubEnvironmentChange(payload: { environmentId: number; subEnvironment: string }) {
    dispatch('environmentSubEnvironmentChange', payload);
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
        onNameChange={handleNameChange}
        onDescriptionChange={handleDescriptionChange}
      />
    </div>

    <!-- API Hosts Settings -->
    <div>
      <ApiHostManager
        apiHosts={flowJson.settings.api_hosts || {}}
        {disabled}
        onChange={handleApiHostsChange}
      />
    </div>
  </div>

  <!-- Environment Links Settings -->
  <div>
    <EnvironmentLinkingManager
      {environment}
      linkedEnvironment={flowJson.settings.linkedEnvironment || null}
      flowParameters={flowJson.parameters || []}
      selectedSubEnvironment={flowJson.settings.environment?.subEnvironment || null}
      {disabled}
      onChange={handleEnvironmentChange}
      onSubEnvironmentChange={handleSubEnvironmentChange}
    />
  </div>
</div>
