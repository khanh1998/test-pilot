<script lang="ts">
  import { onDestroy } from 'svelte';
  import { projectStore } from '$lib/store/project';
  import { listAgentTokens, type AgentToken } from '$lib/http_client/agents';

  let tokens = $state<AgentToken[]>([]);
  let selectedTokenId = $state<number | null>(null);
  let selectedProject = $state<any>(null);
  let origin = $state('');
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let copied = $state<string | null>(null);

  const unsubscribe = projectStore.subscribe((state) => {
    selectedProject = state.selectedProject;
  });

  onDestroy(() => {
    unsubscribe();
  });

  $effect(() => {
    if (typeof window !== 'undefined') {
      origin = window.location.origin;
    }
    loadTokens();
  });

  let activeTokens = $derived(
    tokens.filter(
      (token) => !token.revokedAt && (!token.expiresAt || new Date(token.expiresAt) > new Date())
    )
  );

  let selectedToken = $derived(
    activeTokens.find((token) => token.id === selectedTokenId) ?? activeTokens[0] ?? null
  );

  let mcpUrl = $derived(`${origin}/mcp`);
  let tokenPlaceholder = $derived(
    selectedToken ? `<${selectedToken.tokenPrefix}>` : '<agent-token>'
  );
  let claudeConfig = $derived(
    JSON.stringify(
      {
        mcpServers: {
          'test-pilot': {
            url: mcpUrl,
            headers: {
              Authorization: `Bearer ${tokenPlaceholder}`
            }
          }
        }
      },
      null,
      2
    )
  );
  let codexConfig = $derived(
    JSON.stringify(
      {
        name: 'test-pilot',
        url: mcpUrl,
        headers: {
          Authorization: `Bearer ${tokenPlaceholder}`
        }
      },
      null,
      2
    )
  );
  let handoffPrompt = $derived(
    selectedProject
      ? `You are connected to Test-Pilot MCP. First call list_projects, then get_project_context for project ${selectedProject.id} (${selectedProject.name}). Read the project agentContext before searching endpoints, creating flows, or running sequences.`
      : 'You are connected to Test-Pilot MCP. First call list_projects, then get_project_context for the relevant project. Read the project agentContext before searching endpoints, creating flows, or running sequences.'
  );

  async function loadTokens() {
    try {
      isLoading = true;
      error = null;
      const result = await listAgentTokens();
      tokens = result.tokens;
      selectedTokenId = activeTokens[0]?.id ?? null;
    } catch (err) {
      console.error('Error loading agent tokens:', err);
      error = err instanceof Error ? err.message : 'Failed to load agent tokens';
    } finally {
      isLoading = false;
    }
  }

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      copied = label;
      setTimeout(() => {
        if (copied === label) copied = null;
      }, 2000);
    } catch (err) {
      console.error('Error copying text:', err);
      error = 'Could not copy to clipboard';
    }
  }
</script>

<svelte:head>
  <title>Agent MCP Setup - Test Pilot</title>
</svelte:head>

{#if isLoading}
  <div class="flex items-center justify-center py-16">
    <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
    <span class="ml-3 text-gray-600">Loading setup...</span>
  </div>
{:else}
  {#if error}
    <div class="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {error}
    </div>
  {/if}

  <div class="grid gap-8 lg:grid-cols-[1fr_360px]">
    <section>
      <div class="mb-6">
        <h2 class="text-2xl font-semibold text-gray-900">MCP Connection</h2>
        <p class="mt-2 text-gray-600">
          Use an agent token as the bearer credential for your MCP client.
        </p>
      </div>

      <div class="mb-6 rounded-lg border border-gray-200 bg-white p-5">
        <label for="token" class="mb-2 block text-sm font-medium text-gray-700">Token</label>
        {#if activeTokens.length > 0}
          <select
            id="token"
            bind:value={selectedTokenId}
            class="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            {#each activeTokens as token}
              <option value={token.id}>{token.name} ({token.tokenPrefix})</option>
            {/each}
          </select>
          <p class="mt-2 text-sm text-gray-500">
            The full token is only shown when it is created. Use the token value you copied from the
            Tokens tab.
          </p>
        {:else}
          <p class="text-sm text-gray-600">No active agent tokens yet.</p>
          <a
            href="/projects/agents/tokens"
            class="mt-3 inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create Token
          </a>
        {/if}
      </div>

      <div class="space-y-6">
        <div>
          <div class="mb-2 flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900">Claude Desktop / Cursor</h3>
            <button
              type="button"
              onclick={() => copyText('claude', claudeConfig)}
              class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              {copied === 'claude' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre class="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100"><code
              >{claudeConfig}</code
            ></pre>
        </div>

        <div>
          <div class="mb-2 flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900">Codex</h3>
            <button
              type="button"
              onclick={() => copyText('codex', codexConfig)}
              class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              {copied === 'codex' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre class="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100"><code
              >{codexConfig}</code
            ></pre>
        </div>

        <div>
          <div class="mb-2 flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900">Agent Handoff Prompt</h3>
            <button
              type="button"
              onclick={() => copyText('prompt', handoffPrompt)}
              class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              {copied === 'prompt' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div class="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
            {handoffPrompt}
          </div>
        </div>
      </div>
    </section>

    <aside class="rounded-lg border border-gray-200 bg-gray-50 p-5">
      <h3 class="text-lg font-semibold text-gray-900">Project Readiness</h3>
      <ul class="mt-4 space-y-3 text-sm text-gray-700">
        <li class="flex gap-2">
          <span class="font-medium text-gray-900">1.</span>
          Create an active agent token.
        </li>
        <li class="flex gap-2">
          <span class="font-medium text-gray-900">2.</span>
          Add project guidelines for auth, business rules, and test data conventions.
        </li>
        <li class="flex gap-2">
          <span class="font-medium text-gray-900">3.</span>
          Ask the agent to call
          <code class="rounded bg-white px-1 py-0.5 font-mono text-xs">get_project_context</code> before
          changing flows.
        </li>
      </ul>
    </aside>
  </div>
{/if}
