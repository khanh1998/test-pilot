<script lang="ts">
  import { onMount } from 'svelte';

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

  let posts: Post[] = [];
  let loading = false;
  let error: string | null = null;

  // Fetch posts with their authors using the API
  async function fetchPostsWithAuthors() {
    try {
      loading = true;
      error = null;
      
      // This would call a server endpoint that uses Drizzle's relation capabilities
      const response = await fetch('/api/posts-with-authors');
      
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

  onMount(() => {
    // Fetch data on component mount
    fetchPostsWithAuthors();
  });
</script>

<div>
  <h2 class="text-xl font-semibold mb-4">Posts from Database</h2>
  
  <button 
    on:click={fetchPostsWithAuthors}
    class="mb-6 rounded-md bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
    Refresh Posts
  </button>
  
  {#if loading}
    <div class="flex justify-center py-8">
      <div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
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
