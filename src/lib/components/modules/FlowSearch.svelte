<!-- FlowSearch.svelte - Inline flow search and selection -->
<script lang="ts">
  import type { TestFlow } from '../../types/test-flow.js';
  import { createEventDispatcher } from 'svelte';
  import { onMount } from 'svelte';
  import * as testFlowClient from '$lib/http_client/test-flow';

  export let isOpen: boolean = false;

  const dispatch = createEventDispatcher<{
    select: { flow: TestFlow };
    close: void;
  }>();

  let searchTerm = '';
  let searchResults: TestFlow[] = [];
  let isLoading = false;
  let inputElement: HTMLInputElement;
  let inputContainer: HTMLDivElement;
  let selectedIndex = -1;
  
  // Dropdown positioning
  let dropdownPosition = { top: 0, left: 0, width: 0 };

  function updateDropdownPosition() {
    if (inputContainer) {
      const rect = inputContainer.getBoundingClientRect();
      dropdownPosition = {
        top: rect.bottom + 4, // 4px gap like mt-1
        left: rect.left,
        width: rect.width
      };
    }
  }

  $: if (isOpen && inputElement) {
    inputElement.focus();
  }

  async function searchFlows() {
    if (searchTerm.trim().length < 2) {
      searchResults = [];
      return;
    }

    try {
      isLoading = true;
      if (inputContainer) {
        updateDropdownPosition(); // Update position when showing results
      }
      const response = await testFlowClient.getTestFlows({ 
        search: searchTerm.trim(),
        limit: 10 
      });
      searchResults = response?.testFlows || [];
    } catch (err) {
      console.error('Failed to search flows:', err);
      searchResults = [];
    } finally {
      isLoading = false;
    }
  }

  function handleInput() {
    selectedIndex = -1;
    if (inputContainer) {
      updateDropdownPosition(); // Update position when input changes
    }
    searchFlows();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleClose();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, searchResults.length - 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (selectedIndex >= 0 && searchResults[selectedIndex]) {
        selectFlow(searchResults[selectedIndex]);
      }
    }
  }

  function selectFlow(flow: TestFlow) {
    dispatch('select', { flow });
    handleClose();
  }

  function handleClose() {
    searchTerm = '';
    searchResults = [];
    selectedIndex = -1;
    dispatch('close');
  }

  function handleBlur() {
    // Delay closing to allow for click events on dropdown items
    setTimeout(() => {
      isOpen = false;
    }, 150);
  }

  // Close when clicking outside
  function handleClickOutside(event: MouseEvent) {
    if (isOpen && event.target instanceof Node && event.currentTarget instanceof Element) {
      if (!event.currentTarget.contains(event.target)) {
        handleClose();
      }
    }
  }

  onMount(() => {
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  });
</script>

{#if isOpen}
    <!-- Flow Search Component -->
  <div class="relative inline-block w-64">
    <!-- Search Input -->
    <div class="relative" bind:this={inputContainer}>
      <input
        bind:this={inputElement}
        bind:value={searchTerm}
        on:input={handleInput}
        on:keydown={handleKeydown}
        on:focus={() => { 
          if (inputContainer) updateDropdownPosition(); 
          isOpen = true; 
        }}
        on:blur={handleBlur}
        placeholder="Search flows..."
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        autocomplete="off"
      />
      
      <!-- Loading Spinner -->
      {#if isLoading}
        <div class="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div class="w-4 h-4 animate-spin border-2 border-gray-300 border-t-blue-500 rounded-full"></div>
        </div>
      {/if}
    </div>

    <!-- Search Results -->
    {#if searchResults.length > 0}
      <div class="fixed z-[9999] bg-white border border-gray-300 rounded-md shadow-xl max-h-48 overflow-y-auto min-w-[16rem]" 
           style="top: {dropdownPosition.top}px; left: {dropdownPosition.left}px; width: {dropdownPosition.width}px;">
        {#each searchResults as flow, index}
          <button
            type="button"
            class="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none text-sm border-b border-gray-100 last:border-b-0"
            class:bg-blue-50={index === selectedIndex}
            class:text-blue-700={index === selectedIndex}
            on:click={() => selectFlow(flow)}
          >
            <div class="font-medium truncate">{flow.name}</div>
            <div class="text-xs text-gray-500 truncate">
              {flow.steps?.length || 0} steps • API #{flow.apiId}
            </div>
          </button>
        {/each}
      </div>
    {:else if searchTerm.length >= 2 && !isLoading}
      <div class="fixed z-[9999] bg-white border border-gray-300 rounded-md shadow-xl p-3 text-sm text-gray-500 min-w-[16rem]"
           style="top: {dropdownPosition.top}px; left: {dropdownPosition.left}px; width: {dropdownPosition.width}px;">
        No flows found matching "{searchTerm}"
      </div>
    {/if}
  </div>
{:else}
  <button
    type="button"
    on:click={() => (isOpen = true)}
    class="inline-flex items-center px-3 py-2 border border-dashed border-gray-300 rounded-md text-sm text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors"
  >
    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
    </svg>
    Add Flow
  </button>
{/if}
