<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let name: string;
  export let description: string | null;
  export let disabled: boolean = false;

  const dispatch = createEventDispatcher();

  function handleNameChange() {
    dispatch('nameChange', { name });
  }

  function handleDescriptionChange() {
    dispatch('descriptionChange', { description });
  }

  // Validation
  $: isNameValid = name && name.trim().length > 0;
</script>

<div class="space-y-4">
  <h3 class="text-lg font-medium text-gray-800 mb-4">Flow Information</h3>

  <!-- Flow Name -->
  <div>
    <label for="flowName" class="block text-sm font-medium text-gray-700 mb-2">
      Name <span class="text-red-500">*</span>
    </label>
    <input
      id="flowName"
      type="text"
      bind:value={name}
      on:input={handleNameChange}
      {disabled}
      class="w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none
             {!isNameValid ? 'border-red-300 bg-red-50' : 'border-gray-300'}
             {disabled ? 'bg-gray-100 cursor-not-allowed' : ''}"
      placeholder="Enter flow name"
      required
    />
    {#if !isNameValid}
      <p class="mt-1 text-sm text-red-600">Flow name is required</p>
    {/if}
  </div>

  <!-- Flow Description -->
  <div>
    <label for="flowDescription" class="block text-sm font-medium text-gray-700 mb-2">
      Description
    </label>
    <textarea
      id="flowDescription"
      bind:value={description}
      on:input={handleDescriptionChange}
      {disabled}
      rows="3"
      class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none resize-y
             {disabled ? 'bg-gray-100 cursor-not-allowed' : ''}"
      placeholder="Enter a description for this test flow"
    ></textarea>
  </div>
</div>
