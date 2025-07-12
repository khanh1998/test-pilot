<script lang="ts">
  import { goto } from '$app/navigation';
  import { uploadSwaggerFile } from '$lib/http_client/apis';

  let fileInput: HTMLInputElement;
  let nameInput: string = '';
  let descriptionInput: string = '';
  let hostInput: string = '';
  let file: File | null = null;
  let uploading = false;
  let error: string | null = null;
  let fileError: string | null = null;

  function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      file = input.files[0];
      fileError = null;

      // Auto-fill the name field if it's empty
      if (!nameInput) {
        const fileName = file.name.replace(/\.(json|yaml|yml)$/, '');
        nameInput = fileName.replace(/-|_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()); // Capitalize words
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

      await uploadSwaggerFile(file, nameInput.trim(), descriptionInput.trim(), hostInput.trim());

      goto('/dashboard/apis');
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred during upload';
    } finally {
      uploading = false;
    }
  }
</script>

<div class="container mx-auto max-w-3xl px-4 py-8">
  <div class="mb-8">
    <h1 class="mb-2 text-2xl font-bold">Upload Swagger/OpenAPI Specification</h1>
    <p class="text-gray-600">
      Upload your Swagger or OpenAPI specification file (YAML or JSON format)
    </p>
  </div>

  <form on:submit|preventDefault={handleSubmit} class="space-y-6">
    <div class="space-y-4">
      <!-- File Upload -->
      <div>
        <label for="file" class="mb-1 block text-sm font-medium text-gray-700">
          Specification File (YAML or JSON)
        </label>
        <div
          class="cursor-pointer rounded-md border-2 border-dashed border-gray-300 px-6 py-8 text-center hover:border-blue-500"
          role="button"
          tabindex="0"
          on:click={() => fileInput.click()}
          on:keydown={(e) => e.key === 'Enter' && fileInput.click()}
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
            <p class="text-sm text-gray-600">
              Selected file: <span class="font-medium">{file.name}</span>
            </p>
            <p class="mt-1 text-xs text-gray-500">Click to change file</p>
          {:else}
            <div class="flex flex-col items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-10 w-10 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
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
        <label for="name" class="mb-1 block text-sm font-medium text-gray-700"> API Name </label>
        <input
          type="text"
          id="name"
          bind:value={nameInput}
          class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
          placeholder="My API"
          required
        />
      </div>

      <!-- API Description -->
      <div>
        <label for="description" class="mb-1 block text-sm font-medium text-gray-700">
          Description (optional)
        </label>
        <textarea
          id="description"
          bind:value={descriptionInput}
          rows="3"
          class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
          placeholder="Describe your API..."
        ></textarea>
      </div>

      <!-- API Host -->
      <div>
        <label for="host" class="mb-1 block text-sm font-medium text-gray-700">
          API Host (optional)
        </label>
        <div class="flex flex-col">
          <input
            type="text"
            id="host"
            bind:value={hostInput}
            class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
            placeholder="api.example.com"
          />
          <p class="mt-1 text-xs text-gray-500">
            Enter the host if not included in the specification
          </p>
        </div>
      </div>
    </div>

    {#if error}
      <div class="border-l-4 border-red-500 bg-red-100 p-4 text-red-700" role="alert">
        <p>{error}</p>
      </div>
    {/if}

    <div class="flex items-center space-x-4">
      <button
        type="submit"
        class="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
        disabled={uploading}
      >
        {uploading ? 'Uploading...' : 'Upload Specification'}
      </button>

      <a href="/dashboard/apis" class="text-gray-600 hover:text-gray-800"> Cancel </a>
    </div>
  </form>
</div>
