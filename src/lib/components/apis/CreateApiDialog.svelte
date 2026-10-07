<script lang="ts">
  import { goto } from '$app/navigation';
  import { createApi } from '$lib/http_client/apis';
  import type { Project } from '$lib/store/project';

  interface Props {
    isOpen?: boolean;
    selectedProject: Project | null;
  }

  let { isOpen = $bindable(false), selectedProject }: Props = $props();

  let name = $state('');
  let description = $state('');
  let host = $state('');
  let saving = $state(false);
  let error: string | null = $state(null);

  $effect(() => {
    if (!isOpen) return;
    name = '';
    description = '';
    host = '';
    error = null;
  });

  function close() {
    if (saving) return;
    isOpen = false;
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) {
      error = 'Please provide a name for the API';
      return;
    }
    saving = true;
    error = null;
    try {
      const result = await createApi({
        name: name.trim(),
        description: description.trim() || undefined,
        host: host.trim() || undefined,
        projectId: selectedProject?.id
      });
      isOpen = false;
      goto(`/projects/apis/${result.api.id}`);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : 'Failed to create API';
    } finally {
      saving = false;
    }
  }
</script>

{#if isOpen}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
    role="presentation"
    onclick={close}
  >
    <div
      class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-label="Create API"
      onclick={(event) => event.stopPropagation()}
      onkeydown={(event) => event.key === 'Escape' && close()}
    >
      <form class="space-y-4" onsubmit={submit}>
        <div>
          <h2 class="text-lg font-semibold text-gray-900">Create API</h2>
          <p class="text-sm text-gray-500">
            Start with an empty API and add endpoints by hand. No specification file needed.
          </p>
        </div>

        {#if error}
          <div class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        {/if}

        <label class="block text-sm font-medium text-gray-700">
          Name
          <input
            type="text"
            bind:value={name}
            required
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none"
          />
        </label>
        <label class="block text-sm font-medium text-gray-700">
          Description
          <input
            type="text"
            bind:value={description}
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none"
          />
        </label>
        <label class="block text-sm font-medium text-gray-700">
          Host
          <input
            type="text"
            bind:value={host}
            placeholder="api.example.com"
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none"
          />
        </label>

        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
            onclick={close}>Cancel</button
          >
          <button
            type="submit"
            disabled={saving}
            class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create API'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
