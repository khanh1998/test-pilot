// Example Supabase component with Drizzle ORM
<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase/client';
  import { fetchWithAuth } from '$lib/api';

  let loading = false;
  let error: string | null = null;
  let data: any = null;
  let drizzleData: any = null;
  
  // Fetch data using Drizzle ORM through server API
  async function fetchDrizzleData() {
    try {
      loading = true;
      error = null;
      
      // Proper way - use a server API endpoint that uses Drizzle internally
      const response = await fetchWithAuth('/api/users');
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      drizzleData = await response.json();
    } catch (e: any) {
      error = e?.message || 'Unknown error';
    } finally {
      loading = false;
    }
  }

  // Create sample data (for demonstration purposes)
  async function createSampleData() {
    try {
      loading = true;
      error = null;
      
      // Call the server-side API endpoint to create sample data
      const response = await fetchWithAuth('/api/seed', {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }
      
      // Fetch data to display the newly created samples
      await fetchDrizzleData();
    } catch (e: any) {
      error = e?.message || 'Unknown error';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    // Uncomment to fetch data when component mounts
    // fetchSupabaseData();
  });
</script>

<div>
  <h2>Supabase with Drizzle Example</h2>
  
  <div class="button-group">
    <button on:click={fetchDrizzleData}>Fetch with Drizzle</button>
    <button on:click={createSampleData}>Create Sample Data</button>
  </div>
  
  {#if loading}
    <p>Loading...</p>
  {:else if error}
    <p class="error">Error: {error}</p>
  {:else}
    {#if data}
      <h3>Supabase Data:</h3>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    {/if}
    
    {#if drizzleData}
      <h3>Drizzle Data:</h3>
      <pre>{JSON.stringify(drizzleData, null, 2)}</pre>
    {/if}
  {/if}
  
  <div class="notice">
    <p><strong>Note:</strong> For production applications, you should not connect directly to your database from the client side. 
    Instead, use API endpoints that use Drizzle on the server side.</p>
  </div>
</div>

<style>
  .error {
    color: red;
  }
  
  pre {
    background-color: #f4f4f4;
    padding: 1rem;
    border-radius: 4px;
    overflow: auto;
    max-height: 300px;
  }
  
  .button-group {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  
  button {
    padding: 0.5rem 1rem;
    background-color: #0070f3;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  button:hover {
    background-color: #0060df;
  }
  
  h3 {
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
  }
  
  .notice {
    margin-top: 2rem;
    padding: 1rem;
    background-color: #fff8e1;
    border-left: 4px solid #ffb74d;
    border-radius: 4px;
  }
</style>
