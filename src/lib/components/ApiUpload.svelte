<script lang="ts">
  import { goto } from '$app/navigation';
  
  let fileInput: HTMLInputElement;
  let nameInput: string = '';
  let descriptionInput: string = '';
  let hostInput: string = '';
  let file: File | null = null;
  let uploading = false;
  let error: string | null = null;
  let fileError: string | null = null;
  let hostDetected: boolean = false;
  
  function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      file = input.files[0];
      fileError = null;
      
      // Auto-fill the name field if it's empty
      if (!nameInput) {
        const fileName = file.name.replace(/\.(json|yaml|yml)$/, '');
        nameInput = fileName.replace(/-|_/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase()); // Capitalize words
      }
    }
  }
  
  async function handleSubmit() {
    if (!file) {
      fileError = 'Please select a file to upload';
      return;
    }
    
    if (!nameInput.trim()) {
      error = 'Please provide a name for the API';
      return;
    }
    
    try {
      uploading = true;
      error = null;
      
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', nameInput.trim());
      if (descriptionInput.trim()) {
        formData.append('description', descriptionInput.trim());
      }
      if (hostInput.trim()) {
        formData.append('host', hostInput.trim());
      }
      
      // Send the request
      const response = await fetch('/api/swagger/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      goto('/dashboard/apis');
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred during upload';
    } finally {
      uploading = false;
    }
  }
</script>

<div class="container mx-auto px-4 py-8 max-w-3xl">
  <div class="mb-8">
    <h1 class="text-2xl font-bold mb-2">Upload Swagger/OpenAPI Specification</h1>
    <p class="text-gray-600">Upload your Swagger or OpenAPI specification file (YAML or JSON format)</p>
  </div>
  
  <form on:submit|preventDefault={handleSubmit} class="space-y-6">
    <div class="space-y-4">
      <!-- File Upload -->
      <div>
        <label for="file" class="block text-sm font-medium text-gray-700 mb-1">
          Specification File (YAML or JSON)
        </label>
        <div 
          class="border-2 border-dashed border-gray-300 rounded-md px-6 py-8 text-center cursor-pointer hover:border-blue-500"
          role="button"
          tabindex="0"
          on:click={() => fileInput.click()}
          on:keydown={e => e.key === 'Enter' && fileInput.click()}
        >
          <input
            type="file"
            id="file"
            accept=".yaml,.yml,.json"
            class="hidden"
            bind:this={fileInput}
            on:change={handleFileChange}
          />
          {#if file}
            <p class="text-sm text-gray-600">Selected file: <span class="font-medium">{file.name}</span></p>
            <p class="text-xs text-gray-500 mt-1">Click to change file</p>
          {:else}
            <div class="flex flex-col items-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p class="mt-2 text-sm text-gray-600">Click to upload or drag and drop</p>
              <p class="mt-1 text-xs text-gray-500">.yaml, .yml or .json files</p>
            </div>
          {/if}
        </div>
        {#if fileError}
          <p class="mt-1 text-sm text-red-600">{fileError}</p>
        {/if}
      </div>
      
      <!-- API Name -->
      <div>
        <label for="name" class="block text-sm font-medium text-gray-700 mb-1">
          API Name
        </label>
        <input
          type="text"
          id="name"
          bind:value={nameInput}
          class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="My API"
          required
        />
      </div>
      
      <!-- API Description -->
      <div>
        <label for="description" class="block text-sm font-medium text-gray-700 mb-1">
          Description (optional)
        </label>
        <textarea
          id="description"
          bind:value={descriptionInput}
          rows="3"
          class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="Describe your API..."
        ></textarea>
      </div>
      
      <!-- API Host -->
      <div>
        <label for="host" class="block text-sm font-medium text-gray-700 mb-1">
          API Host (optional)
        </label>
        <div class="flex flex-col">
          <input
            type="text"
            id="host"
            bind:value={hostInput}
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="api.example.com"
          />
          <p class="mt-1 text-xs text-gray-500">
            Enter the host if not included in the specification
          </p>
        </div>
      </div>
    </div>
    
    {#if error}
      <div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
        <p>{error}</p>
      </div>
    {/if}
    
    <div class="flex items-center space-x-4">
      <button
        type="submit"
        class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        disabled={uploading}
      >
        {uploading ? 'Uploading...' : 'Upload Specification'}
      </button>
      
      <a href="/dashboard/apis" class="text-gray-600 hover:text-gray-800">
        Cancel
      </a>
    </div>
  </form>
</div>
