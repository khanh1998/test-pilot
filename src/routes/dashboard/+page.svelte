<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/store/auth';
  import type { User } from '$lib/store/auth';

  // State
  let loading = false;
  let error: string | null = null;

  // Get current user from auth store
  let user: User | null = null;

  // Subscribe to the auth store
  const unsubscribe = authStore.subscribe((state) => {
    user = state.user;
  });

  // Unsubscribe when component is destroyed
  onDestroy(() => {
    unsubscribe();
  });

  // Handle sign out
  async function handleSignOut() {
    try {
      await authStore.signOut();
      goto('/');
    } catch (err: any) {
      error = err?.message || 'An error occurred during sign out';
    }
  }

  onMount(() => {
    // Component initialization
  });
</script>

<div class="bg-white">
  <!-- Header -->
  <header class="bg-white shadow">
    <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
        <nav class="mt-2">
          <ul class="flex space-x-6">
            <li>
              <a href="/dashboard" class="text-sm text-gray-700 hover:text-blue-600">Home</a>
            </li>
            <li>
              <a href="/dashboard/apis" class="text-sm text-gray-700 hover:text-blue-600">APIs</a>
            </li>
            <li>
              <a href="/dashboard/test-flows" class="text-sm text-gray-700 hover:text-blue-600"
                >Test Flows</a
              >
            </li>
          </ul>
        </nav>
      </div>
      <div class="flex items-center space-x-4">
        {#if user}
          <span class="text-sm text-gray-700">
            {user.email || 'User'}
          </span>
        {/if}
        <button
          type="button"
          on:click={handleSignOut}
          class="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
        >
          Sign out
        </button>
      </div>
    </div>
  </header>

  <!-- Main content -->
  <main>
    <div class="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
      <div class="px-4 py-6 sm:px-0">
        <!-- Add any main content here if needed in the future -->
      </div>
    </div>
  </main>
</div>
