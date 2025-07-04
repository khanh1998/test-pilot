<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchWithAuth } from '$lib/api';

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

  onMount(() => {
    // Fetch data on component mount
    fetchPostsWithAuthors();
  });
</script>

<div class="p-4">
  <h2 class="text-xl font-semibold mb-4">Drizzle Relations Example</h2>
  
  <button 
    on:click={fetchPostsWithAuthors}
    class="mb-4 rounded-md bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
    Fetch Posts with Authors
  </button>
  
  {#if loading}
    <p class="py-4">Loading posts...</p>
  {:else if error}
    <p class="text-red-600 py-4">Error: {error}</p>
  {:else if posts.length > 0}
    <div class="grid grid-cols-1 gap-4 mt-4 md:grid-cols-2">
      {#each posts as post}
        <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 class="text-lg font-medium text-gray-900 mt-0">{post.post.title}</h3>
          <p class="italic text-gray-600">{post.post.content || 'No content'}</p>
          <div class="mt-4 pt-2 border-t border-gray-100">
            <strong class="text-gray-700">Author:</strong> {post.author?.name || 'Unknown'}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <p class="py-4 text-gray-600">No posts found. Click the button to fetch posts.</p>
  {/if}
</div>
