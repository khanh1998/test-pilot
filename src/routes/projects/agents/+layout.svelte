<script lang="ts">
  import { page } from '$app/stores';
  import type { Snippet } from 'svelte';

  interface Props {
    [key: string]: unknown;
    children: Snippet;
  }

  let { children }: Props = $props();

  const tabs = [
    { name: 'MCP Setup', href: '/projects/agents/setup' },
    { name: 'Tokens', href: '/projects/agents/tokens' },
    { name: 'Guidelines', href: '/projects/agents/guidelines' }
  ];

  function isActive(href: string): boolean {
    return $page.url.pathname === href;
  }
</script>

<div class="mx-auto max-w-6xl p-8">
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-gray-900">Agents</h1>
    <p class="mt-2 text-gray-600">Manage MCP access and project context for AI agents.</p>
  </div>

  <div class="mb-8 border-b border-gray-200">
    <nav class="-mb-px flex gap-6" aria-label="Agent settings">
      {#each tabs as tab}
        <a
          href={tab.href}
          class="border-b-2 px-1 py-3 text-sm font-medium transition-colors {isActive(tab.href)
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
        >
          {tab.name}
        </a>
      {/each}
    </nav>
  </div>

  {@render children()}
</div>
