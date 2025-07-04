<script lang="ts">
  import { onMount } from 'svelte';

  let posts: any[] = [];
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

<div class="drizzle-relations-example">
  <h2>Drizzle Relations Example</h2>
  
  <button on:click={fetchPostsWithAuthors}>Fetch Posts with Authors</button>
  
  {#if loading}
    <p>Loading posts...</p>
  {:else if error}
    <p class="error">Error: {error}</p>
  {:else if posts.length > 0}
    <div class="posts-grid">
      {#each posts as post}
        <div class="post-card">
          <h3>{post.post.title}</h3>
          <p class="post-content">{post.post.content || 'No content'}</p>
          <div class="author-info">
            <strong>Author:</strong> {post.author?.name || 'Unknown'}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <p>No posts found. Click the button to fetch posts.</p>
  {/if}
  </div>

<style>
  .drizzle-relations-example {
    padding: 1rem;
  }
  
  button {
    padding: 0.5rem 1rem;
    background-color: #0070f3;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    margin-bottom: 1rem;
  }
  
  button:hover {
    background-color: #0060df;
  }
  
  .error {
    color: red;
  }
  
  .posts-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
    margin-top: 1rem;
  }
  
  @media (min-width: 768px) {
    .posts-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  
  .post-card {
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    background-color: #f9f9f9;
  }
  
  .post-card h3 {
    margin-top: 0;
  }
  
  .post-content {
    font-style: italic;
    color: #555;
  }
  
  .author-info {
    margin-top: 1rem;
    padding-top: 0.5rem;
    border-top: 1px solid #eee;
  }
  
  .code-example {
    margin-top: 2rem;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    background-color: #f4f4f4;
  }
  
  .code-example h3 {
    margin-top: 0;
    margin-bottom: 1rem;
  }
  
  pre {
    background-color: #272822;
    color: #f8f8f2;
    padding: 1rem;
    border-radius: 4px;
    overflow-x: auto;
  }
</style>
