<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  export let apiId: number | null = null;  // If provided, we're in update mode
  export let apiName: string = '';
  export let apiDescription: string = '';
  export let apiHost: string = '';
  
  // HTMLInputElement reference for the file input
  let fileInput: HTMLInputElement | null = null;
  let nameInput: string = apiName;
  let descriptionInput: string = apiDescription;
  let hostInput: string = apiHost;
  let file: File | null = null;
  let uploading = false;
  let error: string | null = null;
  let fileError: string | null = null;
  let isDragging = false;
  
  const isUpdateMode = apiId !== null;

  onMount(() => {
    if (isUpdateMode) {
      nameInput = apiName;
      descriptionInput = apiDescription;
      hostInput = apiHost;
    }
  });
  
  function openFileSelector() {
    console.log('Opening file selector, fileInput:', fileInput);
    if (fileInput) {
      fileInput.click();
    }
  }
  
  function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      file = input.files[0];
      fileError = null;
      
      // Auto-fill the name field if it's empty and not in update mode
      if (!nameInput && !isUpdateMode) {
        const fileName = file.name.replace(/\.(json|yaml|yml)$/, '');
        nameInput = fileName.replace(/-|_/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase()); // Capitalize words
      }
    }
  }
  
  function handleDragEnter(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDragging = true;
  }
  
  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDragging = false;
  }
  
  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDragging = true;
  }
  
  function handleDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDragging = false;
    
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      file = event.dataTransfer.files[0];
      fileError = null;
      
      // Auto-fill the name field if it's empty and not in update mode
      if (!nameInput && !isUpdateMode) {
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
    
    if (!isUpdateMode && !nameInput.trim()) {
      error = 'Please provide a name for the API';
      return;
    }
    
    try {
      uploading = true;
      error = null;
      
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      
      if (!isUpdateMode) {
        // Only include name/description for new APIs
        formData.append('name', nameInput.trim());
        if (descriptionInput.trim()) {
          formData.append('description', descriptionInput.trim());
        }
      }
      
      if (hostInput.trim()) {
        formData.append('host', hostInput.trim());
      }
      
      // Send the request - different endpoints for create vs update
      const endpoint = isUpdateMode 
        ? `/api/swagger/update/${apiId}` 
        : '/api/swagger/upload';
        
      const response = await fetch(endpoint, {
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
      
      // Redirect based on the operation
      if (isUpdateMode) {
        goto(`/dashboard/apis/${apiId}`);
      } else {
        goto('/dashboard/apis');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred during upload';
    } finally {
      uploading = false;
    }
  }
</script>

<div class="container mx-auto px-4 py-8 max-w-3xl">
  <div class="mb-8">
    <h1 class="text-2xl font-bold mb-2">
      {isUpdateMode ? 'Update API Specification' : 'Upload Swagger/OpenAPI Specification'}
    </h1>
    <p class="text-gray-600">
      {isUpdateMode 
        ? 'Upload a new Swagger/OpenAPI specification to update this API. Existing endpoints will be updated, new ones added, and removed ones deleted.' 
        : 'Upload your Swagger or OpenAPI specification file (YAML or JSON format)'}
    </p>
  </div>
  
  <form on:submit|preventDefault={handleSubmit} class="space-y-6">
    <div class="space-y-4">
      <!-- File Upload -->
      <div>
        <label for="file" class="block text-sm font-medium text-gray-700 mb-1">
          Specification File (YAML or JSON)
        </label>
        <div 
          class="border-2 {isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'} border-dashed rounded-md px-6 py-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
          role="button"
          tabindex="0"
          on:click={openFileSelector}
          on:keydown={e => e.key === 'Enter' && openFileSelector()}
          on:dragenter={handleDragEnter}
          on:dragleave={handleDragLeave}
          on:dragover={handleDragOver}
          on:drop={handleDrop}
        >
          {#if file}
            <div class="space-y-1">
              <div class="text-sm font-medium text-blue-500">
                <svg class="w-5 h-5 inline-block mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                </svg>
                {file.name}
              </div>
              <p class="text-xs text-gray-500">
                {Math.round(file.size / 1024)} KB • {file.type || (file.name.endsWith('.yaml') || file.name.endsWith('.yml') ? 'application/yaml' : 'application/json')}
              </p>
              <p class="text-xs text-gray-500">Click to change file</p>
            </div>
          {:else}
            <div class="space-y-1">
              <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <div class="flex text-sm justify-center">
                <label
                  for="file-upload"
                  class="relative cursor-pointer rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                >
                  <span>Upload a file</span>
                </label>
                <p class="pl-1 text-gray-500">or drag and drop</p>
              </div>
              <p class="text-xs text-gray-500">YAML or JSON up to 10MB</p>
            </div>
          {/if}
          
          <!-- File input (hidden) -->
        <input
          bind:this={fileInput}
          type="file"
          id="file-upload"
          name="file"
          accept=".yaml,.yml,.json"
          class="hidden"
          on:change={handleFileChange}
        />
        </div>
        
        {#if fileError}
          <p class="mt-2 text-sm text-red-600">
            {fileError}
          </p>
        {/if}
      </div>
      
      {#if !isUpdateMode}
        <!-- Name -->
        <div>
          <label for="name" class="block text-sm font-medium text-gray-700 mb-1">
            API Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            bind:value={nameInput}
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter a name for this API"
            required={!isUpdateMode}
          />
        </div>
        
        <!-- Description -->
        <div>
          <label for="description" class="block text-sm font-medium text-gray-700 mb-1">
            Description (optional)
          </label>
          <textarea
            id="description"
            name="description"
            bind:value={descriptionInput}
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter a description for this API"
          ></textarea>
        </div>
      {:else}
        <div>
          <div class="text-sm font-medium text-gray-700 mb-1">API Name</div>
          <div class="text-base">{apiName}</div>
        </div>
        
        {#if apiDescription}
          <div>
            <div class="text-sm font-medium text-gray-700 mb-1">Description</div>
            <div class="text-base">{apiDescription}</div>
          </div>
        {/if}
      {/if}
      
      <!-- Host -->
      <div>
        <label for="host" class="block text-sm font-medium text-gray-700 mb-1">
          Host URL (optional)
        </label>
        <input
          type="text"
          id="host"
          name="host"
          bind:value={hostInput}
          class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="e.g., https://api.example.com"
        />
        <p class="mt-1 text-xs text-gray-500">
          Provide a host URL if not specified in the OpenAPI document
        </p>
      </div>
    </div>
    
    {#if error}
      <div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
        <p>{error}</p>
      </div>
    {/if}
    
    <div class="flex justify-end">
      <a 
        href={isUpdateMode ? `/dashboard/apis/${apiId}` : "/dashboard/apis"} 
        class="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded mr-2"
      >
        Cancel
      </a>
      <button
        type="submit"
        class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        disabled={uploading}
      >
        {#if uploading}
          <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {isUpdateMode ? 'Updating...' : 'Uploading...'}
        {:else}
          {isUpdateMode ? 'Update API' : 'Upload API'}
        {/if}
      </button>
    </div>
  </form>
</div>
