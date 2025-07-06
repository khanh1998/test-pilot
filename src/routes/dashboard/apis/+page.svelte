<script lang="ts">
  import ApiList from '$lib/components/ApiList.svelte';
</script>

<div class="container mx-auto px-4 py-8">
  <div class="mb-6">
    <a href="/dashboard" class="text-blue-500 hover:text-blue-600 text-sm">
      ← Back to Dashboard
    </a>
  </div>
  
  <ApiList />
</div>
