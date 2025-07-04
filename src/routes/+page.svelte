<script>
  import SupabaseExample from '$lib/components/SupabaseExample.svelte';
  import SupabaseAuth from '$lib/components/SupabaseAuth.svelte';
  import DrizzleRelationsExample from '$lib/components/DrizzleRelationsExample.svelte';
</script>

<h1>Welcome to SvelteKit + Supabase + Drizzle</h1>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>

<div class="container">
  <div class="card">
    <h2>Authentication Example</h2>
    <SupabaseAuth />
  </div>
  
  <div class="card">
    <h2>Data Fetching Example</h2>
    <SupabaseExample />
  </div>

  <div class="card wide">
    <DrizzleRelationsExample />
  </div>
</div>

<style>
  .container {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
    margin-top: 2rem;
  }
  
  .card {
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  @media (min-width: 768px) {
    .container {
      grid-template-columns: 1fr 1fr;
    }

    .wide {
      grid-column: span 2;
    }
  }
</style>
