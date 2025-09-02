<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  interface LogEntry {
    level: 'info' | 'debug' | 'error' | 'warning';
    message: string;
    details?: string;
    timestamp?: Date;
  }

  export let isOpen = false;
  export let isMounted = false;
  export let logs: LogEntry[] = [];

  const dispatch = createEventDispatcher();

  // UI state for filtering logs
  let selectedLevels: Set<string> = new Set(['info', 'debug', 'error', 'warning']);
  let searchFilter = '';

  // Filter logs based on selected levels and search filter
  $: filteredLogs = logs.filter(log => {
    const levelMatch = selectedLevels.has(log.level);
    const searchMatch = searchFilter === '' || 
      log.message.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (log.details && log.details.toLowerCase().includes(searchFilter.toLowerCase()));
    
    return levelMatch && searchMatch;
  });

  // Get log counts for each level
  $: logCounts = logs.reduce((counts, log) => {
    counts[log.level] = (counts[log.level] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);

  function toggleLevel(level: string) {
    if (selectedLevels.has(level)) {
      selectedLevels.delete(level);
    } else {
      selectedLevels.add(level);
    }
    selectedLevels = new Set(selectedLevels); // Trigger reactivity
  }

  function clearLogs() {
    logs = [];
  }

  function exportLogs() {
    const logData = logs.map(log => ({
      timestamp: log.timestamp?.toISOString() || new Date().toISOString(),
      level: log.level,
      message: log.message,
      details: log.details
    }));

    const dataStr = JSON.stringify(logData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `flow-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function closeLogsViewer() {
    dispatch('close');
  }

  function getLevelIcon(level: string): string {
    switch (level) {
      case 'error':
        return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z';
      case 'warning':
        return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z';
      case 'info':
        return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
      case 'debug':
        return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
      default:
        return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    }
  }

  function getLevelColorClasses(level: string): { text: string; bg: string; border: string; badge: string } {
    switch (level) {
      case 'error':
        return {
          text: 'text-red-700',
          bg: 'bg-red-50',
          border: 'border-red-200',
          badge: 'bg-red-100 text-red-800'
        };
      case 'warning':
        return {
          text: 'text-yellow-700',
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          badge: 'bg-yellow-100 text-yellow-800'
        };
      case 'info':
        return {
          text: 'text-blue-700',
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          badge: 'bg-blue-100 text-blue-800'
        };
      case 'debug':
        return {
          text: 'text-gray-700',
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          badge: 'bg-gray-100 text-gray-800'
        };
      default:
        return {
          text: 'text-gray-700',
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          badge: 'bg-gray-100 text-gray-800'
        };
    }
  }

  function formatTimestamp(timestamp?: Date): string {
    if (!timestamp) return '';
    return timestamp.toLocaleTimeString();
  }
</script>

<div
  class="fixed inset-0 z-40 flex justify-end transition-opacity duration-200 ease-in-out {isOpen
    ? 'opacity-100'
    : 'pointer-events-none opacity-0'}"
  on:keydown={(e) => e.key === 'Escape' && closeLogsViewer()}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
>
  <!-- Transparent overlay for the left side -->
  <div
    class="absolute inset-y-0 right-0 left-0 bg-transparent transition-opacity duration-300 ease-in-out sm:right-[75%] md:right-[700px] lg:right-[600px]"
    on:click={closeLogsViewer}
    role="presentation"
    aria-hidden="true"
  ></div>

  <!-- The panel itself -->
  <div
    class="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white shadow-xl transition-transform duration-300 ease-in-out sm:w-[75%] md:w-[700px] lg:w-[600px] {!isOpen
      ? 'translate-x-full'
      : 'translate-x-0'}"
    aria-hidden="false"
  >
    <!-- Header -->
    <div class="sticky top-0 z-10 flex w-full items-center justify-between border-b bg-gray-50 px-6 py-4 shadow-sm">
      <div class="flex-1">
        <h2 class="text-lg font-medium text-gray-900">Flow Execution Logs</h2>
        <p class="mt-1 text-sm text-gray-500">
          View detailed logs from the flow execution process
        </p>
      </div>
      <button
        class="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
        on:click={closeLogsViewer}
        aria-label="Close"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>

    <!-- Filters and Controls -->
    <div class="border-b bg-gray-50 px-6 py-4">
      <!-- Log Level Filters -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">Log Levels</label>
        <div class="flex flex-wrap gap-2">
          {#each ['error', 'warning', 'info', 'debug'] as level}
            {@const colors = getLevelColorClasses(level)}
            <button
              class="flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors {selectedLevels.has(level)
                ? `${colors.badge} border border-gray-300`
                : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'}"
              on:click={() => toggleLevel(level)}
            >
              <span class="capitalize">{level}</span>
              {#if logCounts[level]}
                <span class="ml-1 rounded-full bg-white bg-opacity-50 px-1.5 py-0.5 text-xs">
                  {logCounts[level]}
                </span>
              {/if}
            </button>
          {/each}
        </div>
      </div>

      <!-- Search Filter -->
      <div class="mb-4">
        <label for="search" class="block text-sm font-medium text-gray-700 mb-2">Search Logs</label>
        <input
          type="text"
          id="search"
          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="Search messages and details..."
          bind:value={searchFilter}
        />
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-2">
        <button
          class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          on:click={exportLogs}
          disabled={logs.length === 0}
        >
          <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          Export
        </button>
        <button
          class="inline-flex items-center rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          on:click={clearLogs}
          disabled={logs.length === 0}
        >
          <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
          Clear
        </button>
      </div>
    </div>

    <!-- Log Content -->
    <div class="p-6">
      {#if logs.length === 0}
        <div class="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          <p class="mt-2 text-sm text-gray-500">No logs available</p>
          <p class="text-xs text-gray-400">Execute a flow to see logs here</p>
        </div>
      {:else if filteredLogs.length === 0}
        <div class="rounded-lg border border-yellow-200 bg-yellow-50 p-8 text-center">
          <svg class="mx-auto h-12 w-12 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          <p class="mt-2 text-sm text-yellow-800">No logs match your filters</p>
          <p class="text-xs text-yellow-600">Try adjusting your search or log level filters</p>
        </div>
      {:else}
        <div class="space-y-3">
          {#each filteredLogs as log, index (index)}
            {@const colors = getLevelColorClasses(log.level)}
            <div class="rounded-lg border p-4 {colors.bg} {colors.border}">
              <div class="flex items-start gap-3">
                <!-- Log Level Icon -->
                <div class="flex-shrink-0 mt-0.5">
                  <svg class="h-5 w-5 {colors.text}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={getLevelIcon(log.level)}></path>
                  </svg>
                </div>

                <!-- Log Content -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between">
                    <div class="flex items-center gap-2">
                      <span class="inline-flex rounded-full px-2 py-1 text-xs font-semibold {colors.badge}">
                        {log.level.toUpperCase()}
                      </span>
                      {#if log.timestamp}
                        <span class="text-xs text-gray-500">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      {/if}
                    </div>
                  </div>

                  <div class="mt-2">
                    <p class="text-sm font-medium {colors.text}">
                      {log.message}
                    </p>
                    {#if log.details}
                      <div class="mt-2 rounded bg-white bg-opacity-50 p-2">
                        <pre class="whitespace-pre-wrap text-xs {colors.text} opacity-80">{log.details}</pre>
                      </div>
                    {/if}
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="sticky bottom-0 border-t bg-gray-50 px-6 py-4">
      <div class="flex justify-between items-center">
        <div class="text-sm text-gray-500">
          {#if logs.length > 0}
            Showing {filteredLogs.length} of {logs.length} logs
          {:else}
            No logs collected
          {/if}
        </div>
        <button
          class="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          on:click={closeLogsViewer}
        >
          Close
        </button>
      </div>
    </div>
  </div>
</div>
