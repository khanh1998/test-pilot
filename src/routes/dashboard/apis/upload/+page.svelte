<script lang="ts">
  import ApiFileUpload from '$lib/components/ApiFileUpload.svelte';
</script>

<div class="container mx-auto px-4 py-6">
  <div class="mb-6">
    <a href="/dashboard/apis" class="text-blue-500 hover:text-blue-700">
      &larr; Back to APIs
    </a>
  </div>
  
  <ApiFileUpload />
</div>
