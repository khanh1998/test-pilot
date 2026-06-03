<script lang="ts">
  import {
    createAgentToken,
    deleteAgentToken,
    listAgentTokens,
    revokeAgentToken,
    type AgentToken
  } from '$lib/http_client/agents';

  let tokens = $state<AgentToken[]>([]);
  let isLoading = $state(true);
  let isCreating = $state(false);
  let error = $state<string | null>(null);
  let createdToken = $state<string | null>(null);
  let name = $state('');
  let expiresAt = $state('');

  $effect(() => {
    loadTokens();
  });

  async function loadTokens() {
    try {
      isLoading = true;
      error = null;
      const result = await listAgentTokens();
      tokens = result.tokens;
    } catch (err) {
      console.error('Error loading agent tokens:', err);
      error = err instanceof Error ? err.message : 'Failed to load agent tokens';
    } finally {
      isLoading = false;
    }
  }

  async function handleCreateToken() {
    try {
      isCreating = true;
      error = null;
      createdToken = null;

      const result = await createAgentToken({
        name,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
      });

      createdToken = result.plainTextToken;
      name = '';
      expiresAt = '';
      await loadTokens();
    } catch (err) {
      console.error('Error creating agent token:', err);
      error = err instanceof Error ? err.message : 'Failed to create agent token';
    } finally {
      isCreating = false;
    }
  }

  async function handleRevokeToken(token: AgentToken) {
    if (
      !confirm(
        `Revoke agent token "${token.name}"? Existing MCP clients using this token will stop working.`
      )
    ) {
      return;
    }

    try {
      error = null;
      await revokeAgentToken(token.id);
      await loadTokens();
    } catch (err) {
      console.error('Error revoking agent token:', err);
      error = err instanceof Error ? err.message : 'Failed to revoke agent token';
    }
  }

  async function handleDeleteToken(token: AgentToken) {
    if (!confirm(`Delete agent token "${token.name}"? This removes it from the management list.`)) {
      return;
    }

    try {
      error = null;
      await deleteAgentToken(token.id);
      await loadTokens();
    } catch (err) {
      console.error('Error deleting agent token:', err);
      error = err instanceof Error ? err.message : 'Failed to delete agent token';
    }
  }

  async function copyCreatedToken() {
    if (!createdToken) return;

    try {
      await navigator.clipboard.writeText(createdToken);
    } catch (err) {
      console.error('Error copying token:', err);
      error = 'Could not copy token to clipboard';
    }
  }

  function tokenStatus(token: AgentToken): { label: string; className: string } {
    if (token.revokedAt) {
      return { label: 'Revoked', className: 'bg-gray-100 text-gray-700' };
    }

    if (token.expiresAt && new Date(token.expiresAt) <= new Date()) {
      return { label: 'Expired', className: 'bg-red-50 text-red-700' };
    }

    return { label: 'Active', className: 'bg-green-50 text-green-700' };
  }

  function formatDate(value: string | null): string {
    return value ? new Date(value).toLocaleString() : '-';
  }
</script>

<svelte:head>
  <title>Agent Tokens - Test Pilot</title>
</svelte:head>

{#if error}
  <div class="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
    {error}
  </div>
{/if}

{#if createdToken}
  <div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-5">
    <div class="mb-3 flex items-start justify-between gap-4">
      <div>
        <h2 class="text-lg font-semibold text-blue-950">Copy this token now</h2>
        <p class="mt-1 text-sm text-blue-800">For security, the full token is only shown once.</p>
      </div>
      <button
        type="button"
        onclick={copyCreatedToken}
        class="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        Copy
      </button>
    </div>
    <code class="block overflow-x-auto rounded-md bg-white p-3 font-mono text-sm text-blue-950"
      >{createdToken}</code
    >
  </div>
{/if}

<div class="mb-8 rounded-lg border border-gray-200 bg-white p-5">
  <h2 class="text-xl font-semibold text-gray-900">Create Agent Token</h2>
  <div class="mt-5 grid gap-4 md:grid-cols-[1fr_220px_auto] md:items-end">
    <div>
      <label for="name" class="mb-2 block text-sm font-medium text-gray-700">Name</label>
      <input
        id="name"
        bind:value={name}
        type="text"
        placeholder="Claude Desktop"
        class="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
      />
    </div>
    <div>
      <label for="expires" class="mb-2 block text-sm font-medium text-gray-700">Expiration</label>
      <input
        id="expires"
        bind:value={expiresAt}
        type="datetime-local"
        class="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
      />
    </div>
    <button
      type="button"
      onclick={handleCreateToken}
      disabled={isCreating || !name.trim()}
      class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isCreating ? 'Creating...' : 'Create'}
    </button>
  </div>
</div>

{#if isLoading}
  <div class="flex items-center justify-center py-16">
    <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
    <span class="ml-3 text-gray-600">Loading tokens...</span>
  </div>
{:else if tokens.length === 0}
  <div class="rounded-lg border border-gray-200 bg-gray-50 p-10 text-center">
    <h2 class="text-lg font-semibold text-gray-900">No agent tokens yet</h2>
    <p class="mt-2 text-sm text-gray-600">Create a token to connect an MCP client to Test-Pilot.</p>
  </div>
{:else}
  <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
    <div
      class="grid grid-cols-[1.4fr_1fr_1fr_1fr_auto] bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700"
    >
      <div>Name</div>
      <div>Status</div>
      <div>Expires</div>
      <div>Last Used</div>
      <div class="text-right">Actions</div>
    </div>
    {#each tokens as token}
      {@const status = tokenStatus(token)}
      <div
        class="grid grid-cols-[1.4fr_1fr_1fr_1fr_auto] items-center border-t border-gray-100 px-4 py-4 text-sm"
      >
        <div>
          <div class="font-medium text-gray-900">{token.name}</div>
          <div class="mt-1 font-mono text-xs text-gray-500">{token.tokenPrefix}</div>
        </div>
        <div>
          <span class="rounded-full px-2.5 py-1 text-xs font-medium {status.className}"
            >{status.label}</span
          >
        </div>
        <div class="text-gray-600">{formatDate(token.expiresAt)}</div>
        <div class="text-gray-600">{formatDate(token.lastUsedAt)}</div>
        <div class="flex justify-end gap-2">
          {#if !token.revokedAt}
            <button
              type="button"
              onclick={() => handleRevokeToken(token)}
              class="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Revoke
            </button>
          {/if}
          <button
            type="button"
            onclick={() => handleDeleteToken(token)}
            class="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>
    {/each}
  </div>
{/if}
