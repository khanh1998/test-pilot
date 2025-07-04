<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth';
  import { fetchWithAuth } from '$lib/api';
  import type { User } from '$lib/stores/auth';

  interface Post {
    post: {
      id: string;
      title: string;
      content: string | null;
      authorId: string;
      createdAt: string;
    };
    author?: {
      id: string;
      name: string;
      email: string;
    };
  }

  // State
  let posts: Post[] = [];
  let loading = false;
  let error: string | null = null;
  
  // Get current user from auth store
  let user: User | null = null;
  
  // Subscribe to the auth store
  const unsubscribe = authStore.subscribe(state => {
    user = state.user;
  });

  // Unsubscribe when component is destroyed
  onDestroy(() => {
    unsubscribe();
  });

  // Fetch posts with their authors using the API
  async function fetchPostsWithAuthors() {
    try {
      loading = true;
      error = null;
      
      // Call the endpoint with auth headers
      const response = await fetchWithAuth('/api/posts-with-authors');
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      posts = await response.json();
    } catch (e: any) {
      error = e?.message || 'Failed to fetch posts';
    } finally {
      loading = false;
    }
  }

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
    // Fetch data on component mount
    fetchPostsWithAuthors();
  });
</script>

<div class="bg-white">
  <!-- Header -->
  <header class="bg-white shadow">
    <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
      <h1 class="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
      <div class="flex items-center space-x-4">
        {#if user}
          <span class="text-sm text-gray-700">
            {user.email || 'User'}
          </span>
        {/if}
        <button 
          type="button" 
          on:click={handleSignOut}
          class="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">
          Sign out
        </button>
      </div>
    </div>
  </header>

  <!-- Main content -->
  <main>
    <div class="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
      <div class="px-4 py-6 sm:px-0">
        <div class="mb-6 flex justify-between items-center">
          <h2 class="text-xl font-semibold text-gray-900">Posts</h2>
          <button 
            on:click={fetchPostsWithAuthors}
            class="rounded-md bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
            Refresh Posts
          </button>
        </div>

        {#if loading}
          <div class="flex justify-center py-12">
            <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        {:else if error}
          <div class="rounded-md bg-red-50 p-4">
            <div class="flex">
              <div class="ml-3">
                <h3 class="text-sm font-medium text-red-800">Error</h3>
                <div class="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        {:else if posts.length > 0}
          <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            {#each posts as post}
              <div class="bg-white rounded-lg border border-gray-200 shadow-md overflow-hidden">
                <div class="p-5">
                  <h3 class="text-lg font-medium text-gray-900">{post.post.title}</h3>
                  <p class="mt-2 text-gray-600 italic">{post.post.content || 'No content'}</p>
                  <div class="mt-4 pt-4 border-t border-gray-100">
                    <div class="flex items-center">
                      <div class="flex-shrink-0">
                        <span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-500">
                          <span class="text-xs font-medium text-white">
                            {post.author?.name?.[0].toUpperCase() || '?'}
                          </span>
                        </span>
                      </div>
                      <div class="ml-3">
                        <p class="text-sm font-medium text-gray-700">
                          {post.author?.name || 'Unknown author'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="bg-white shadow rounded-lg">
            <div class="py-10 px-6 text-center">
              <h3 class="text-lg font-medium text-gray-900">No posts found</h3>
              <p class="mt-1 text-sm text-gray-500">Click the button above to fetch posts.</p>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </main>
</div>
