<script lang="ts">
  export let data: unknown;
  export let maxHeight: string = '400px';
  export let title: string = '';
  
  let isCollapsed = false;
  
  function formatJson(value: unknown): string {
    try {
      if (typeof value === 'string') {
        // Try to parse if it's a JSON string
        try {
          const parsed = JSON.parse(value);
          return JSON.stringify(parsed, null, 2);
        } catch {
          return value;
        }
      }
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  
  function toggleCollapse() {
    isCollapsed = !isCollapsed;
  }
</script>

<div class="json-viewer border border-gray-200 rounded-lg overflow-hidden">
  <!-- Header -->
  <div class="bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center justify-between">
    <div class="flex items-center gap-2">
      {#if title}
        <h4 class="text-sm font-medium text-gray-700">{title}</h4>
      {/if}
      <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">JSON</span>
    </div>
    <button
      type="button"
      on:click={toggleCollapse}
      class="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
    >
      {isCollapsed ? 'Expand' : 'Collapse'}
      <svg 
        class="w-3 h-3 transition-transform {isCollapsed ? 'rotate-180' : ''}" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  </div>
  
  <!-- Content -->
  {#if !isCollapsed}
    <div class="json-content bg-gray-50" style="max-height: {maxHeight}; overflow-y: auto;">
      <pre class="p-3 text-xs font-mono text-gray-800 whitespace-pre-wrap break-words">{formatJson(data)}</pre>
    </div>
  {/if}
</div>

<style>
  .json-content {
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 transparent;
  }

  .json-content::-webkit-scrollbar {
    width: 6px;
  }

  .json-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .json-content::-webkit-scrollbar-thumb {
    background-color: #cbd5e1;
    border-radius: 3px;
  }

  .json-content::-webkit-scrollbar-thumb:hover {
    background-color: #94a3b8;
  }
</style>
