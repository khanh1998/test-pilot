<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let assertion: Assertion;
  export let steps: Step[];
  export let assertionIndex: number;

  const dispatch = createEventDispatcher();

  interface Assertion {
    step_id: string;
    endpoint_id: string;
    target_path: string;
    condition: string;
    expected_value: {
      source: 'fixed' | 'response';
      value?: string;
      from?: {
        step_id: string;
        endpoint_id: string;
        path: string;
      };
    };
  }

  interface Endpoint {
    endpoint_id: string;
    store_response_as: string;
  }

  interface Step {
    step_id: string;
    label: string;
    endpoints: Endpoint[];
  }

  function getEndpointsForStep(stepId: string): Endpoint[] {
    const step = steps.find((s) => s.step_id === stepId);
    return step ? step.endpoints : [];
  }
</script>

<div class="rounded-lg border bg-white p-4 shadow-sm">
  <div class="mb-4 flex items-center justify-between">
    <h3 class="text-lg font-medium">Assertion {assertionIndex + 1}</h3>
    <button
      class="text-red-600 hover:text-red-800"
      on:click={() => dispatch('remove', { assertionIndex })}
      aria-label="Remove Assertion"
    >
      <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fill-rule="evenodd"
          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
          clip-rule="evenodd"
        ></path>
      </svg>
    </button>
  </div>

  <div class="grid grid-cols-1 gap-4">
    <div>
      <label for="step-{assertionIndex}" class="mb-1 block text-xs font-medium text-gray-500">
        Step:
      </label>
      <select
        id="step-{assertionIndex}"
        bind:value={assertion.step_id}
        class="w-full rounded border px-2 py-1 text-sm"
        on:change={() => {
          // Reset endpoint when step changes
          assertion.endpoint_id = '';
          dispatch('change');
        }}
      >
        <option value="">Select Step</option>
        {#each steps as step (step.step_id)}
          <option value={step.step_id}>{step.label}</option>
        {/each}
      </select>
    </div>

    {#if assertion.step_id}
      <div>
        <label for="endpoint-{assertionIndex}" class="mb-1 block text-xs font-medium text-gray-500">
          Endpoint:
        </label>
        <select
          id="endpoint-{assertionIndex}"
          bind:value={assertion.endpoint_id}
          class="w-full rounded border px-2 py-1 text-sm"
          on:change={() => dispatch('change')}
        >
          <option value="">Select Endpoint</option>
          {#each getEndpointsForStep(assertion.step_id) as endpoint (endpoint.endpoint_id)}
            <option value={endpoint.endpoint_id}>{endpoint.store_response_as}</option>
          {/each}
        </select>
      </div>
    {/if}

    <div>
      <label for="path-{assertionIndex}" class="mb-1 block text-xs font-medium text-gray-500">
        Target Path:
      </label>
      <input
        id="path-{assertionIndex}"
        type="text"
        bind:value={assertion.target_path}
        class="w-full rounded border px-2 py-1 text-sm"
        placeholder="$.response.data.id"
        on:change={() => dispatch('change')}
      />
      <p class="mt-1 text-xs text-gray-500">JSONPath expression to select data from the response</p>
    </div>

    <div>
      <label for="condition-{assertionIndex}" class="mb-1 block text-xs font-medium text-gray-500">
        Condition:
      </label>
      <select
        id="condition-{assertionIndex}"
        bind:value={assertion.condition}
        class="w-full rounded border px-2 py-1 text-sm"
        on:change={() => dispatch('change')}
      >
        <option value="equals">Equals</option>
        <option value="not_equals">Not Equals</option>
        <option value="contains">Contains</option>
        <option value="greater_than">Greater Than</option>
        <option value="less_than">Less Than</option>
      </select>
    </div>

    <div>
      <label for="source-{assertionIndex}" class="mb-1 block text-xs font-medium text-gray-500">
        Expected Value Source:
      </label>
      <select
        id="source-{assertionIndex}"
        bind:value={assertion.expected_value.source}
        class="w-full rounded border px-2 py-1 text-sm"
        on:change={() => dispatch('change')}
      >
        <option value="fixed">Fixed Value</option>
        <option value="response">From Response</option>
      </select>
    </div>

    {#if assertion.expected_value.source === 'fixed'}
      <div>
        <label for="value-{assertionIndex}" class="mb-1 block text-xs font-medium text-gray-500">
          Expected Value:
        </label>
        <input
          id="value-{assertionIndex}"
          type="text"
          bind:value={assertion.expected_value.value}
          class="w-full rounded border px-2 py-1 text-sm"
          on:change={() => dispatch('change')}
        />
      </div>
    {:else if assertion.expected_value.source === 'response'}
      <div>
        <label
          for="resp-step-{assertionIndex}"
          class="mb-1 block text-xs font-medium text-gray-500"
        >
          Response Step:
        </label>
        <select
          id="resp-step-{assertionIndex}"
          bind:value={assertion.expected_value.from.step_id}
          class="w-full rounded border px-2 py-1 text-sm"
          on:change={() => {
            assertion.expected_value.from.endpoint_id = '';
            dispatch('change');
          }}
        >
          <option value="">Select Step</option>
          {#each steps as step (step.step_id)}
            <option value={step.step_id}>{step.label}</option>
          {/each}
        </select>
      </div>

      {#if assertion.expected_value.from && assertion.expected_value.from.step_id}
        <div>
          <label
            for="resp-endpoint-{assertionIndex}"
            class="mb-1 block text-xs font-medium text-gray-500"
          >
            Response Endpoint:
          </label>
          <select
            id="resp-endpoint-{assertionIndex}"
            bind:value={assertion.expected_value.from.endpoint_id}
            class="w-full rounded border px-2 py-1 text-sm"
            on:change={() => dispatch('change')}
          >
            <option value="">Select Endpoint</option>
            {#each getEndpointsForStep(assertion.expected_value.from.step_id) as endpoint (endpoint.endpoint_id)}
              <option value={endpoint.endpoint_id}>{endpoint.store_response_as}</option>
            {/each}
          </select>
        </div>
      {/if}

      <div>
        <label
          for="resp-path-{assertionIndex}"
          class="mb-1 block text-xs font-medium text-gray-500"
        >
          JSONPath:
        </label>
        <input
          id="resp-path-{assertionIndex}"
          type="text"
          bind:value={assertion.expected_value.from.path}
          class="w-full rounded border px-2 py-1 text-sm"
          placeholder="$.data.id"
          on:change={() => dispatch('change')}
        />
      </div>
    {/if}
  </div>
</div>
