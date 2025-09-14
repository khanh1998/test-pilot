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
    { id: 'environments', name: 'Environments', icon: 'server', count: environments.length },
    { id: 'variables', name: 'Variables', icon: 'variable', count: variables.length },
    { id: 'settings', name: 'Settings', icon: 'settings' }
  ];

  function getIconPath(icon: string): string {
    const icons: Record<string, string> = {
      info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      collection: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
      globe: "M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
      server: "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01",
      variable: "M4 7v10c0 2.21 3.79 4 8 4s8-1.79 8-4V7c0 2.21-3.79 4-8 4s-8-1.79-8-4z M4 7c0-2.21 3.79-4 8-4s8 1.79 8 4",
      settings: "M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
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
