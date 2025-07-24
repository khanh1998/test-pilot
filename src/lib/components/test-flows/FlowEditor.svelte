<script lang="ts">
  import { createEventDispatcher, onMount, afterUpdate } from 'svelte';

  // Props
  export let description = '';

  const dispatch = createEventDispatcher();

  // Step color themes
  const stepColors = [
    { bg: 'bg-blue-500', bgLight: 'bg-blue-100', text: 'text-blue-800', textLight: 'text-blue-600', border: '#3b82f6' },
    { bg: 'bg-green-500', bgLight: 'bg-green-100', text: 'text-green-800', textLight: 'text-green-600', border: '#10b981' },
    { bg: 'bg-purple-500', bgLight: 'bg-purple-100', text: 'text-purple-800', textLight: 'text-purple-600', border: '#8b5cf6' },
    { bg: 'bg-orange-500', bgLight: 'bg-orange-100', text: 'text-orange-800', textLight: 'text-orange-600', border: '#f97316' },
    { bg: 'bg-pink-500', bgLight: 'bg-pink-100', text: 'text-pink-800', textLight: 'text-pink-600', border: '#ec4899' },
    { bg: 'bg-indigo-500', bgLight: 'bg-indigo-100', text: 'text-indigo-800', textLight: 'text-indigo-600', border: '#6366f1' },
    { bg: 'bg-teal-500', bgLight: 'bg-teal-100', text: 'text-teal-800', textLight: 'text-teal-600', border: '#14b8a6' },
    { bg: 'bg-red-500', bgLight: 'bg-red-100', text: 'text-red-800', textLight: 'text-red-600', border: '#ef4444' }
  ];

  function getStepColor(stepIndex: number) {
    return stepColors[(stepIndex - 1) % stepColors.length];
  }

  // Functions to handle line annotations
  function updateAnnotations() {
    if (typeof window === 'undefined') return;
    
    const textarea = document.getElementById('flow-description') as HTMLTextAreaElement;
    const annotationSidebar = document.querySelector('.annotations-sidebar') as HTMLElement;
    
    if (!textarea || !annotationSidebar) return;
    
    // Set the height of the sidebar to match the textarea exactly
    const textareaHeight = textarea.scrollHeight;
    const textareaPadding = 12; // p-3 = 12px padding
    const textareaLineHeight = 24; // 1.5rem = 24px
    
    if (annotationSidebar) {
      annotationSidebar.style.height = `${textareaHeight}px`;
      // Match the textarea's padding-top exactly
      annotationSidebar.style.paddingTop = `${textareaPadding}px`;
    }
    
    // Sync the height of both columns
    const stepColumn = document.querySelector('.step-column') as HTMLElement;
    const endpointColumn = document.querySelector('.endpoint-column') as HTMLElement;
    
    if (stepColumn && endpointColumn) {
      stepColumn.style.height = `${textareaHeight}px`;
      endpointColumn.style.height = `${textareaHeight}px`;
    }
  }

  // Handle hovering effects
  function setupHoverEffects() {
    if (typeof window === 'undefined') return;
    
    const container = document.getElementById('flow-description-container');
    if (!container) return;
    
    const endpointAnnotations = container.querySelectorAll('.endpoint-annotation-line');
    const textarea = document.getElementById('flow-description') as HTMLTextAreaElement;
    
    endpointAnnotations.forEach((annotation) => {
      annotation.addEventListener('mouseenter', () => {
        const htmlAnnotation = annotation as HTMLElement;
        const lineIndex = parseInt(htmlAnnotation.getAttribute('data-line-index') || '0');
        const stepIndex = parseInt(htmlAnnotation.getAttribute('data-step') || '1');
        const stepColor = getStepColor(stepIndex);
        
        // Update textarea selection colors to match step color (lighter version)
        textarea.style.setProperty('--selection-bg-color', stepColor.border + '40');
        textarea.style.setProperty('--selection-text-color', stepColor.border);
        
        // Highlight corresponding line in textarea
        const lines = textarea.value.split('\n');
        if (lineIndex < lines.length && lines[lineIndex].trim()) {
          const start = lines.slice(0, lineIndex).join('\n').length + (lineIndex > 0 ? 1 : 0);
          const end = start + lines[lineIndex].length;
          
          textarea.focus();
          if (textarea.setSelectionRange) {
            textarea.setSelectionRange(start, end);
          }
          
          // Apply hover styles with step color
          htmlAnnotation.style.backgroundColor = stepColor.border + '20';
          htmlAnnotation.style.borderLeftColor = stepColor.border;
          
          // Enhance endpoint badge
          const endpointBadgeEl = annotation.querySelector('.endpoint-badge') as HTMLElement;
          if (endpointBadgeEl) {
            endpointBadgeEl.style.color = stepColor.border;
            endpointBadgeEl.style.fontWeight = 'bold';
            endpointBadgeEl.style.transform = 'scale(1.1)';
          }
        }
      });
      
      annotation.addEventListener('mouseleave', () => {
        const htmlAnnotation = annotation as HTMLElement;
        const lineIndex = parseInt(htmlAnnotation.getAttribute('data-line-index') || '0');
        const stepIndex = parseInt(htmlAnnotation.getAttribute('data-step') || '1');
        const stepColor = getStepColor(stepIndex);
        
        // Reset textarea selection colors to default
        textarea.style.setProperty('--selection-bg-color', '#3b82f6');
        textarea.style.setProperty('--selection-text-color', 'white');
        
        // Clear text selection
        if (textarea.setSelectionRange) {
          textarea.setSelectionRange(0, 0);
        }
        textarea.blur();
        
        // Remove hover styles
        htmlAnnotation.style.backgroundColor = '';
        htmlAnnotation.style.borderLeftColor = stepColor.border + '40';
        
        // Reset endpoint badge
        const endpointBadgeEl = annotation.querySelector('.endpoint-badge') as HTMLElement;
        if (endpointBadgeEl) {
          endpointBadgeEl.style.color = '';
          endpointBadgeEl.style.fontWeight = '';
          endpointBadgeEl.style.transform = '';
        }
      });
    });
  }
  
  // Track when description changes to update annotations
  $: {
    setTimeout(updateAnnotations, 0);
    setTimeout(setupHoverEffects, 10); // Small delay to ensure DOM is updated
  }
  
  // Update annotations after component renders
  afterUpdate(() => {
    updateAnnotations();
    setupHoverEffects();
  });
  
  onMount(() => {
    updateAnnotations();
    setupHoverEffects();
    
    // Add scroll event handler to sync textarea and annotation scrolling
    const textarea = document.getElementById('flow-description') as HTMLTextAreaElement;
    const sidebar = document.querySelector('.annotations-sidebar') as HTMLElement;
    
    if (textarea && sidebar) {
      textarea.addEventListener('scroll', () => {
        if (sidebar) {
          sidebar.scrollTop = textarea.scrollTop;
        }
      });
      
      // Also handle input events to update annotations when text changes
      textarea.addEventListener('input', () => {
        setTimeout(() => {
          updateAnnotations();
          setupHoverEffects();
        }, 0);
      });
      
      // Handle resize events on the textarea
      textarea.addEventListener('mouseup', updateAnnotations);
      window.addEventListener('resize', updateAnnotations);
    }
  });
</script>

<div
  id="flow-description-container"
  class="focus:ring-opacity-50 w-full rounded-md border border-gray-300 shadow-sm focus-within:border-blue-500 focus-within:ring focus-within:ring-blue-500"
>
  <!-- Step and endpoint annotations -->
  <div class="flex">
    <!-- Two-column annotation sidebar -->
    <div class="annotations-sidebar relative flex border-r border-gray-200 bg-gray-50">
      <!-- Step column (left) -->
      <div class="step-column min-w-[60px] border-r border-gray-200">
        <!-- Show default annotation when description is empty -->
        {#if !description.trim()}
          {@const stepColor = getStepColor(1)}
          <div class="step-annotation-line text-xs">
            <div class="step-badge rounded-full px-2 py-0.5 text-xs font-medium {stepColor.bgLight} {stepColor.text}">
              Step 1
            </div>
          </div>
        {:else}
          {#each description.split('\n') as line, i}
            {@const lines = description.split('\n')}
            {@const isEmptyLine = !line.trim()}
            
            <!-- Calculate step index -->
            {@const currentStepIndex = (() => {
              let stepCount = 1;
              for (let j = 0; j < i; j++) {
                // Only increment step count if current line is empty AND previous line was not empty
                // This ensures consecutive empty lines don't create multiple steps
                if (!lines[j].trim() && (j === 0 || lines[j - 1].trim())) {
                  stepCount++;
                }
              }
              return stepCount;
            })()}

            <!-- Check if this is the first line of a step -->
            {@const isFirstLineOfStep = (() => {
              if (isEmptyLine) return false; // Don't show step badge on empty lines
              if (i === 0) return true;
              
              // Check if previous line was empty (indicates start of new step)
              return i > 0 && !lines[i - 1].trim();
            })()}

            {@const stepColor = getStepColor(currentStepIndex)}

            <div class="step-annotation-line text-xs">
              {#if isFirstLineOfStep}
                <div class="step-badge rounded-full px-2 py-0.5 text-xs font-medium {stepColor.bgLight} {stepColor.text}">
                  Step {currentStepIndex}
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>

      <!-- Endpoint column (right) -->
      <div class="endpoint-column min-w-[40px]">
        <!-- Show default annotation when description is empty -->
        {#if !description.trim()}
          {@const stepColor = getStepColor(1)}
          <div
            class="endpoint-annotation-line text-xs cursor-pointer transition-all duration-200 hover-highlight"
            data-step="1"
            data-endpoint="1"
            data-line-index="0"
            style="border-left: 3px solid {stepColor.border + '40'};"
          >
            <div class="endpoint-badge font-medium {stepColor.textLight}">
              1
            </div>
          </div>
        {:else}
          {#each description.split('\n') as line, i}
            {@const lines = description.split('\n')}
            {@const isEmptyLine = !line.trim()}

            <!-- Calculate step index -->
            {@const currentStepIndex = (() => {
              let stepCount = 1;
              for (let j = 0; j < i; j++) {
                // Only increment step count if current line is empty AND previous line was not empty
                // This ensures consecutive empty lines don't create multiple steps
                if (!lines[j].trim() && (j === 0 || lines[j - 1].trim())) {
                  stepCount++;
                }
              }
              return stepCount;
            })()}

            <!-- Calculate endpoint index within current step -->
            {@const currentEndpointIndex = (() => {
              if (isEmptyLine) return 0; // Don't count empty lines as endpoints

              // Find the start of the current step
              let stepStartIndex = i;
              for (let j = i - 1; j >= 0; j--) {
                if (!lines[j].trim()) {
                  stepStartIndex = j + 1;
                  break;
                }
                if (j === 0) stepStartIndex = 0;
              }

              // Count only non-empty lines from step start to current line
              let endpointCount = 0;
              for (let j = stepStartIndex; j <= i; j++) {
                if (lines[j].trim()) endpointCount++;
              }

              return endpointCount;
            })()}

            {@const stepColor = getStepColor(currentStepIndex)}

            <div
              class="endpoint-annotation-line text-xs cursor-pointer transition-all duration-200"
              class:hover-highlight={!isEmptyLine}
              data-step={currentStepIndex}
              data-endpoint={currentEndpointIndex}
              data-line-index={i}
              style="border-left: 3px solid {isEmptyLine ? 'transparent' : stepColor.border + '40'};"
            >
              {#if !isEmptyLine}
                <div class="endpoint-badge font-medium {stepColor.textLight}">
                  {currentEndpointIndex}
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    </div>

    <!-- Text editor -->
    <textarea
      id="flow-description"
      class="flex-1 border-0 p-3 focus:ring-0 focus:outline-none"
      rows="10"
      placeholder="Describe your test scenario, with one API endpoint per line.

For example:
Create a new user with email and password

Authenticate with the created credentials

Fetch the user profile
Update the user's name
Verify the updated profile information

(Use empty lines to separate steps as shown above)"
      bind:value={description}
      on:input={updateAnnotations}
      on:keydown={(e) => {
        // Auto-indent when user presses Enter
        if (e.key === 'Enter' && e.ctrlKey) {
          e.preventDefault();
          const textarea = e.target as HTMLTextAreaElement;
          const pos = textarea.selectionStart;
          const value = textarea.value;

          // Insert a blank line for a new step
          const newValue = value.slice(0, pos) + '\n\n' + value.slice(pos);
          description = newValue;

          // Set cursor position after the insertion
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = pos + 2;
            updateAnnotations();
          }, 0);
        }
      }}
    ></textarea>
  </div>

  <!-- Helper text -->
  <div class="border-t border-gray-200 bg-gray-50 p-2 text-xs text-gray-500">
    <strong>Tip:</strong> Write one endpoint per line. Use empty lines to create new steps. Each step
    can contain multiple endpoints.
  </div>
</div>


<style>
  /* Styles for the two-column annotations */
  .annotations-sidebar {
    overflow-y: hidden;
    position: relative;
    transition: all 0.2s ease;
  }
  
  .step-column, .endpoint-column {
    display: flex;
    flex-direction: column;
  }
  
  .step-annotation-line, .endpoint-annotation-line {
    position: relative;
    transition: all 0.2s ease;
    overflow: visible;
    white-space: nowrap;
    height: 24px;
    line-height: 24px;
    min-height: 24px;
    display: flex;
    align-items: center;
  }
  
  .step-annotation-line {
    justify-content: center;
  }
  
  .endpoint-annotation-line {
    justify-content: center;
  }
  
  .endpoint-annotation-line.hover-highlight:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }
  
  .step-badge {
    font-size: 0.7rem;
    white-space: nowrap;
    transition: all 0.2s ease;
    font-weight: 500;
  }
  
  .endpoint-badge {
    font-size: 0.75rem;
    transition: all 0.2s ease;
    font-weight: 500;
  }
  
  .endpoint-badge.opacity-50 {
    opacity: 0.5;
  }
  
  .endpoint-annotation-line:hover .endpoint-badge {
    transform: scale(1.1);
  }
  
  /* Make textarea line height match the annotation lines */
  #flow-description {
    line-height: 24px;
    resize: vertical;
    min-height: 200px;
    font-family: inherit;
    font-size: 0.875rem;
    --selection-bg-color: #3b82f6;
    --selection-text-color: white;
  }
  
  /* Custom selection colors that can be dynamically updated */
  #flow-description::selection {
    background-color: var(--selection-bg-color);
    color: var(--selection-text-color);
  }
  
  #flow-description::-moz-selection {
    background-color: var(--selection-bg-color);
    color: var(--selection-text-color);
  }
  
  /* Ensure the container has proper layout */
  #flow-description-container {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
</style>