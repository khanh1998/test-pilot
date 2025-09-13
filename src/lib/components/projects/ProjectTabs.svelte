<!-- ProjectTabs.svelte - Tab-based navigation for project configuration -->
<script lang="ts">
  import type { Project, ProjectModule, ProjectApi, ProjectEnvironment } from '../../types/project.js';

  export let modules: ProjectModule[] = [];
  export let apis: ProjectApi[] = [];
  export let environments: ProjectEnvironment[] = [];
  export let variables: any[] = [];
  export let activeTab: string = 'modules';

  const tabs = [
    { id: 'modules', name: 'Modules', icon: 'collection', count: modules.length },
    { id: 'apis', name: 'APIs', icon: 'globe', count: apis.length },
    { id: 'environments', name: 'Environments', icon: 'cog', count: environments.length },
    { id: 'variables', name: 'Variables', icon: 'variable', count: variables.length },
    { id: 'settings', name: 'Settings', icon: 'settings' }
  ];

  function getIconPath(icon: string): string {
    const icons: Record<string, string> = {
      info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      collection: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
      globe: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9",
      cog: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
      variable: "M4 7v10c0 2.21 3.79 4 8 4s8-1.79 8-4V7c0 2.21-3.79 4-8 4s-8-1.79-8-4z M4 7c0-2.21 3.79-4 8-4s8 1.79 8 4",
      settings: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
    };
    return icons[icon] || icons.info;
  }

  function setActiveTab(tabId: string) {
    activeTab = tabId;
  }
</script>

<div class="bg-white shadow">
  <div class="border-b border-gray-200">
    <nav class="-mb-px flex space-x-8" aria-label="Tabs">
      {#each tabs as tab}
        <button
          on:click={() => setActiveTab(tab.id)}
          class="group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap"
          class:border-blue-500={activeTab === tab.id}
          class:text-blue-600={activeTab === tab.id}
          class:border-transparent={activeTab !== tab.id}
          class:text-gray-500={activeTab !== tab.id}
          class:hover:text-gray-700={activeTab !== tab.id}
          class:hover:border-gray-300={activeTab !== tab.id}
        >
          <svg 
            class="w-5 h-5 mr-2"
            class:text-blue-500={activeTab === tab.id}
            class:text-gray-400={activeTab !== tab.id}
            class:group-hover:text-gray-500={activeTab !== tab.id}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              stroke-linecap="round" 
              stroke-linejoin="round" 
              stroke-width="2" 
              d={getIconPath(tab.icon)}
            />
          </svg>
          {tab.name}
          {#if tab.count !== undefined}
            <span 
              class="ml-2 py-0.5 px-2 rounded-full text-xs font-medium"
              class:bg-blue-100={activeTab === tab.id}
              class:text-blue-600={activeTab === tab.id}
              class:bg-gray-100={activeTab !== tab.id}
              class:text-gray-900={activeTab !== tab.id}
            >
              {tab.count}
            </span>
          {/if}
        </button>
      {/each}
    </nav>
  </div>
</div>

<!-- Tab Content -->
<div class="mt-6">
  <slot name="tab-content" {activeTab} />
</div>
