<script lang="ts">
  import { goto } from '$app/navigation';
  import { uploadSwaggerFile, updateSwaggerFile } from '$lib/http_client/apis';

  export let apiId: number | null = null; // If provided, we're in update mode
  export let apiName: string = '';
  export let apiDescription: string = '';
  export let apiHost: string = '';

  // Simple state management
  let fileInput: HTMLInputElement;
  let nameInput: string = apiName;
  let descriptionInput: string = apiDescription;
  let hostInput: string = apiHost;
  let file: File | null = null;
  let uploading = false;
  let error: string | null = null;
  let fileError: string | null = null;
  let isDragging = false;

  const isUpdateMode = apiId !== null;

  // Simple function to trigger file input click
  function openFileSelector(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    if (fileInput) {
      fileInput.click();
    }
  }

  // Handle file selection from input or drop
  function handleFile(newFile: File) {
    file = newFile;
    fileError = null;

    // Auto-fill the name field if it's empty and not in update mode
    if (!nameInput && !isUpdateMode) {
      const fileName = newFile.name.replace(/\.(json|yaml|yml)$/, '');
      nameInput = fileName.replace(/-|_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()); // Capitalize words
    }
  }

  // Handle file input change event
  function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      handleFile(input.files[0]);
      // Reset the input value to ensure change event fires even if selecting the same file again
      input.value = '';
    }
  }

  // Simplified drag event handlers
  function handleDragEnter(event: DragEvent) {
    event.preventDefault();
    isDragging = true;
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    isDragging = false;
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragging = false;

    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      handleFile(event.dataTransfer.files[0]);
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

      if (isUpdateMode) {
        if (apiId === null) {
          throw new Error('API ID is required for update mode.');
        }
        await updateSwaggerFile(apiId.toString(), file);
      } else {
        await uploadSwaggerFile(file, nameInput.trim(), descriptionInput.trim(), hostInput.trim());
      }

      // Redirect based on the operation
      if (isUpdateMode) {
        goto(`/projects/apis/${apiId}`);
      } else {
        goto('/projects/apis');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred during upload';
    } finally {
      uploading = false;
    }
  }
</script>

<div class="container mx-auto max-w-3xl px-4 py-8">
  <div class="mb-8">
    <h1 class="mb-2 text-2xl font-bold">
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
        <label for="file-upload" class="mb-1 block text-sm font-medium text-gray-700">
          Specification File (YAML or JSON)
        </label>
        <div
          class="border-2 {isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300'} cursor-pointer rounded-md border-dashed px-6 py-8 text-center transition-colors hover:border-blue-500"
          role="button"
          tabindex="0"
          on:click={(e) => openFileSelector(e)}
          on:keydown={(e) => e.key === 'Enter' && openFileSelector(e)}
          on:dragenter={handleDragEnter}
          on:dragleave={handleDragLeave}
          on:dragover={handleDragOver}
          on:drop={handleDrop}
        >
          {#if file}
            <div class="space-y-2">
              <div class="text-sm font-medium text-blue-500">
                <svg
                  class="mr-1 inline-block h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fill-rule="evenodd"
                    d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                    clip-rule="evenodd"
                  ></path>
                </svg>
                {file.name}
              </div>
              <p class="text-xs text-gray-500">
                {Math.round(file.size / 1024)} KB
              </p>
              <button
                type="button"
                class="mt-1 text-sm text-blue-500 underline hover:text-blue-600"
                on:click={(e) => openFileSelector(e)}
              >
                Change file
              </button>
            </div>
          {:else}
            <div class="space-y-4">
              <svg
                class="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <div>
                <p class="mb-3 text-gray-500">Drag and drop a YAML or JSON file, or</p>
                <button
                  type="button"
                  class="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
                  on:click={(e) => openFileSelector(e)}
                >
                  Browse files
                </button>
              </div>
            </div>
          {/if}
        </div>

        <!-- File input element, hidden but accessible via click handlers -->
        <input
          bind:this={fileInput}
          type="file"
          id="file-upload-input"
          name="swaggerFile"
          accept=".yaml,.yml,.json"
          class="hidden"
          on:change={handleFileChange}
        />

        {#if fileError}
          <p class="mt-2 text-sm text-red-600">
            {fileError}
          </p>
        {/if}
      </div>

      {#if !isUpdateMode}
        <!-- Name -->
        <div>
          <label for="name" class="mb-1 block text-sm font-medium text-gray-700"> API Name </label>
          <input
            type="text"
            id="name"
            name="name"
            bind:value={nameInput}
            class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
            placeholder="Enter a name for this API"
            required={!isUpdateMode}
          />
        </div>

        <!-- Description -->
        <div>
          <label for="description" class="mb-1 block text-sm font-medium text-gray-700">
            Description (optional)
          </label>
          <textarea
            id="description"
            name="description"
            bind:value={descriptionInput}
            rows="3"
            class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
            placeholder="Enter a description for this API"
          ></textarea>
        </div>
      {:else}
        <div>
          <div class="mb-1 text-sm font-medium text-gray-700">API Name</div>
          <div class="text-base">{apiName}</div>
        </div>

        {#if apiDescription}
          <div>
            <div class="mb-1 text-sm font-medium text-gray-700">Description</div>
            <div class="text-base">{apiDescription}</div>
          </div>
        {/if}
      {/if}

      <!-- Host -->
      <div>
        <label for="host" class="mb-1 block text-sm font-medium text-gray-700">
          Host URL (optional)
        </label>
        <input
          type="text"
          id="host"
          name="host"
          bind:value={hostInput}
          class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
          placeholder="e.g., https://api.example.com"
        />
        <p class="mt-1 text-xs text-gray-500">
          Provide a host URL if not specified in the OpenAPI document
        </p>
      </div>
    </div>

    {#if error}
      <div class="border-l-4 border-red-500 bg-red-100 p-4 text-red-700" role="alert">
        <p>{error}</p>
      </div>
    {/if}

    <div class="flex justify-end">
      <a
        href={isUpdateMode ? `/projects/apis/${apiId}` : '/projects/apis'}
        class="mr-2 rounded bg-gray-200 px-4 py-2 text-gray-800 hover:bg-gray-300"
      >
        Cancel
      </a>
      <button
        type="submit"
        class="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
        disabled={uploading}
      >
        {#if uploading}
          <svg
            class="mr-2 -ml-1 inline-block h-4 w-4 animate-spin text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          {isUpdateMode ? 'Updating...' : 'Uploading...'}
        {:else}
          {isUpdateMode ? 'Update API' : 'Upload API'}
        {/if}
      </button>
    </div>
  </form>
</div>
