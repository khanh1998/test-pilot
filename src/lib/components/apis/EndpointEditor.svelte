<script lang="ts">
  import type { ApiEndpoint, EndpointMutationInput } from '$lib/types/api';

  interface Props {
    isOpen?: boolean;
    endpoint?: ApiEndpoint | null;
    saving?: boolean;
    error?: string | null;
    onSave?: (input: EndpointMutationInput) => void | Promise<void>;
    onClose?: () => void;
  }

  let {
    isOpen = $bindable(false),
    endpoint = null,
    saving = false,
    error = null,
    onSave,
    onClose
  }: Props = $props();

  let path = $state('');
  let method = $state('GET');
  let operationId = $state('');
  let summary = $state('');
  let description = $state('');
  let tags = $state('');
  let parameters = $state('[]');
  let requestSchema = $state('');
  let responseSchema = $state('');
  let validationError = $state<string | null>(null);

  $effect(() => {
    if (!isOpen) return;
    path = endpoint?.path ?? '/';
    method = endpoint?.method ?? 'GET';
    operationId = endpoint?.operationId ?? '';
    summary = endpoint?.summary ?? '';
    description = endpoint?.description ?? '';
    tags = endpoint?.tags?.join(', ') ?? '';
    parameters = JSON.stringify(endpoint?.parameters ?? [], null, 2);
    requestSchema = endpoint?.requestSchema ? JSON.stringify(endpoint.requestSchema, null, 2) : '';
    responseSchema = endpoint?.responseSchema
      ? JSON.stringify(endpoint.responseSchema, null, 2)
      : '';
    validationError = null;
  });

  function close() {
    if (saving) return;
    isOpen = false;
    onClose?.();
  }

  function parseJson(value: string, label: string): unknown {
    if (!value.trim()) return null;
    try {
      return JSON.parse(value);
    } catch {
      throw new Error(`${label} must be valid JSON`);
    }
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    validationError = null;
    try {
      const parsedParameters = parseJson(parameters, 'Parameters');
      if (!Array.isArray(parsedParameters)) throw new Error('Parameters must be a JSON array');
      await onSave?.({
        path: path.trim(),
        method,
        operationId: operationId.trim() || null,
        summary: summary.trim() || null,
        description: description.trim() || null,
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        parameters: parsedParameters,
        requestSchema: parseJson(requestSchema, 'Request schema'),
        responseSchema: parseJson(responseSchema, 'Response schema')
      });
    } catch (caught) {
      validationError = caught instanceof Error ? caught.message : 'Invalid endpoint';
    }
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex justify-end bg-black/30" role="presentation" onclick={close}>
    <div
      class="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-xl"
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-label={endpoint ? 'Edit endpoint' : 'Create endpoint'}
      onclick={(event) => event.stopPropagation()}
      onkeydown={(event) => event.key === 'Escape' && close()}
    >
      <form class="flex min-h-full flex-col" onsubmit={submit}>
        <header
          class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4"
        >
          <div>
            <h2 class="text-lg font-semibold text-gray-900">
              {endpoint ? 'Edit endpoint' : 'Create endpoint'}
            </h2>
            <p class="text-sm text-gray-500">Changes are also written to the OpenAPI document.</p>
          </div>
          <button type="button" class="rounded p-2 text-gray-500 hover:bg-gray-100" onclick={close}
            >✕</button
          >
        </header>

        <div class="flex-1 space-y-5 p-6">
          {#if error || validationError}
            <div class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {validationError || error}
            </div>
          {/if}

          <div class="grid grid-cols-[9rem_1fr] gap-3">
            <label class="text-sm font-medium text-gray-700">
              Method
              <select bind:value={method} class="mt-1 w-full rounded border-gray-300">
                {#each ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] as value}
                  <option {value}>{value}</option>
                {/each}
              </select>
            </label>
            <label class="text-sm font-medium text-gray-700">
              Path
              <input
                required
                bind:value={path}
                placeholder={'/users/{id}'}
                class="mt-1 w-full rounded border-gray-300 font-mono"
              />
            </label>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <label class="text-sm font-medium text-gray-700">
              Operation ID
              <input bind:value={operationId} class="mt-1 w-full rounded border-gray-300" />
            </label>
            <label class="text-sm font-medium text-gray-700">
              Tags <span class="font-normal text-gray-400">comma-separated</span>
              <input bind:value={tags} class="mt-1 w-full rounded border-gray-300" />
            </label>
          </div>

          <label class="block text-sm font-medium text-gray-700">
            Summary
            <input bind:value={summary} class="mt-1 w-full rounded border-gray-300" />
          </label>
          <label class="block text-sm font-medium text-gray-700">
            Description
            <textarea bind:value={description} rows="3" class="mt-1 w-full rounded border-gray-300"
            ></textarea>
          </label>
          <label class="block text-sm font-medium text-gray-700">
            Parameters <span class="font-normal text-gray-400">JSON array</span>
            <textarea
              bind:value={parameters}
              rows="7"
              class="mt-1 w-full rounded border-gray-300 font-mono text-xs"
            ></textarea>
          </label>
          <label class="block text-sm font-medium text-gray-700">
            Request schema <span class="font-normal text-gray-400">JSON Schema</span>
            <textarea
              bind:value={requestSchema}
              rows="8"
              class="mt-1 w-full rounded border-gray-300 font-mono text-xs"
            ></textarea>
          </label>
          <label class="block text-sm font-medium text-gray-700">
            Response schema <span class="font-normal text-gray-400">JSON Schema</span>
            <textarea
              bind:value={responseSchema}
              rows="8"
              class="mt-1 w-full rounded border-gray-300 font-mono text-xs"
            ></textarea>
          </label>
        </div>

        <footer class="sticky bottom-0 flex justify-end gap-3 border-t bg-white px-6 py-4">
          <button
            type="button"
            class="rounded border border-gray-300 px-4 py-2 text-sm"
            onclick={close}>Cancel</button
          >
          <button
            type="submit"
            disabled={saving}
            class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : endpoint ? 'Save changes' : 'Create endpoint'}
          </button>
        </footer>
      </form>
    </div>
  </div>
{/if}
