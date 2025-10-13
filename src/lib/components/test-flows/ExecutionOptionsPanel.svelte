<script lang="ts">
  import { fade } from 'svelte/transition';
  import type { ExecutionPreferences } from '$lib/flow-runner';

  export let preferences: ExecutionPreferences;
  export let isVisible: boolean = false;
</script>

{#if isVisible}
  <div class="rounded-lg border bg-white p-4 shadow-sm" transition:fade={{ duration: 150 }}>
    <h4 class="mb-3 text-sm font-medium text-gray-700">Execution Options</h4>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <!-- Checkbox Options Column -->
      <div class="space-y-3">
        <div>
          <div class="flex items-center">
            <input
              type="checkbox"
              id="parallelExecution"
              class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              bind:checked={preferences.parallelExecution}
            />
            <label for="parallelExecution" class="ml-2 block text-sm text-gray-700">
              Parallel Execution
            </label>
          </div>
        </div>

        <div>
          <div class="flex items-center">
            <input
              type="checkbox"
              id="stopOnError"
              class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              bind:checked={preferences.stopOnError}
            />
            <label for="stopOnError" class="ml-2 block text-sm text-gray-700">
              Stop On Error
            </label>
          </div>
        </div>

        <div>
          <div class="flex items-center">
            <input
              type="checkbox"
              id="serverCookieHandling"
              class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              bind:checked={preferences.serverCookieHandling}
            />
            <label for="serverCookieHandling" class="ml-2 block text-sm text-gray-700">
              Use Server Proxy (Bypass CORS)
            </label>
          </div>
          <p class="ml-6 mt-1 text-xs text-gray-500">
            Recommended for browser use. Desktop app handles CORS automatically.
          </p>
        </div>
      </div>

      <!-- Numeric Options Column -->
      <div class="space-y-4">
        <div>
          <label for="retryCount" class="block text-sm font-medium text-gray-700">
            Retry Count
          </label>
          <input
            type="number"
            id="retryCount"
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            min="0"
            max="5"
            bind:value={preferences.retryCount}
          />
        </div>

        <div>
          <label for="timeout" class="block text-sm font-medium text-gray-700">
            Timeout (ms)
          </label>
          <input
            type="number"
            id="timeout"
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            min="1000"
            max="60000"
            step="1000"
            bind:value={preferences.timeout}
          />
        </div>
      </div>
    </div>
  </div>
{/if}
