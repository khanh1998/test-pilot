<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/features/auth/stores/auth';

  // Form state
  let email = '';
  let password = '';
  let name = '';
  let isSignUp = false;
  let error = '';

  // Subscribe to the auth store to get loading state
  let loading = false;

  authStore.subscribe((state) => {
    loading = state.loading;
  });

  // Handle sign in
  async function handleSignIn() {
    error = '';

    const result = await authStore.signIn(email, password);

    if (result.success) {
      goto('/dashboard');
    } else {
      error = result.error || 'Sign in failed';
    }
  }

  // Handle sign up
  async function handleSignUp() {
    error = '';

    if (!name) {
      error = 'Name is required';
      return;
    }

    const result = await authStore.signUp(name, email, password);

    if (result.success) {
      // Switch to sign in form after successful registration
      isSignUp = false;
      error = '';
    } else {
      error = result.error || 'Sign up failed';
    }
  }

  // Toggle between sign in and sign up forms
  function toggleAuthMode() {
    isSignUp = !isSignUp;
    error = '';
  }

  // Check for existing session on mount
  onMount(async () => {
    if (await authStore.checkAuth()) {
      goto('/dashboard');
    }
  });
</script>

<div class="flex min-h-full flex-col justify-center py-12 sm:px-6 lg:px-8">
  <div class="sm:mx-auto sm:w-full sm:max-w-md">
    <h1 class="text-center text-4xl font-bold tracking-tight text-gray-900">Test Pilot</h1>
    <p class="mt-2 text-center text-sm text-gray-600">Smart API Test Flow Generator</p>
  </div>

  <!-- Features section -->
  <div class="mx-auto mt-12 mb-8 max-w-4xl px-4 sm:px-6 lg:px-8">
    <h2 class="mb-6 text-center text-2xl font-bold text-gray-900">Key Features</h2>

    <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
      <div class="rounded-lg bg-white p-6 shadow-md">
        <div class="mb-3 text-2xl text-blue-600">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="h-8 w-8"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        </div>
        <h3 class="mb-2 text-lg font-medium text-gray-900">OpenAPI Import</h3>
        <p class="text-gray-600">
          Upload your OpenAPI/Swagger files to automatically extract endpoint definitions and
          parameters.
        </p>
      </div>

      <div class="rounded-lg bg-white p-6 shadow-md">
        <div class="mb-3 text-2xl text-blue-600">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="h-8 w-8"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z"
            />
          </svg>
        </div>
        <h3 class="mb-2 text-lg font-medium text-gray-900">Test Flow Blueprints</h3>
        <p class="text-gray-600">
          Create structured test flows with dependent API calls, data sources, and success
          assertions.
        </p>
      </div>

      <div class="rounded-lg bg-white p-6 shadow-md">
        <div class="mb-3 text-2xl text-blue-600">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="h-8 w-8"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
            />
          </svg>
        </div>
        <h3 class="mb-2 text-lg font-medium text-gray-900">Smart Data Sources</h3>
        <p class="text-gray-600">
          Reference data from previous responses, use functions, or generate values with AI
          assistance.
        </p>
      </div>
    </div>

    <div class="mt-10 flex justify-center">
      <a
        href="/dashboard/test-flows"
        class="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-5 py-3 text-base font-medium text-white hover:bg-blue-700"
      >
        Get Started
      </a>
    </div>
  </div>

  <div class="sm:mx-auto sm:w-full sm:max-w-md">
    <h2 class="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
      {isSignUp ? 'Create your account' : 'Sign in to your account'}
    </h2>
  </div>

  <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
    <div class="bg-white px-4 py-8 shadow sm:rounded-lg sm:px-10">
      {#if error}
        <div class="mb-4 rounded-md bg-red-50 p-4">
          <div class="flex">
            <div class="ml-3">
              <h3 class="text-sm font-medium text-red-800">Error</h3>
              <div class="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      {/if}

      <form class="space-y-6" on:submit|preventDefault={isSignUp ? handleSignUp : handleSignIn}>
        {#if isSignUp}
          <div>
            <label for="name" class="block text-sm font-medium text-gray-700">Full name</label>
            <div class="mt-1">
              <input
                id="name"
                name="name"
                type="text"
                bind:value={name}
                required
                class="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
              />
            </div>
          </div>
        {/if}

        <div>
          <label for="email" class="block text-sm font-medium text-gray-700">Email address</label>
          <div class="mt-1">
            <input
              id="email"
              name="email"
              type="email"
              bind:value={email}
              required
              class="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
            />
          </div>
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-gray-700">Password</label>
          <div class="mt-1">
            <input
              id="password"
              name="password"
              type="password"
              bind:value={password}
              required
              class="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            class="flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {#if loading}
              <svg
                class="mr-3 -ml-1 h-5 w-5 animate-spin text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            {/if}
            {isSignUp ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </form>

      <div class="mt-6">
        <div class="relative">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-gray-300"></div>
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="bg-white px-2 text-gray-500">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            </span>
          </div>
        </div>

        <div class="mt-6">
          <button
            type="button"
            on:click={toggleAuthMode}
            class="flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
          >
            {isSignUp ? 'Sign in instead' : 'Create a new account'}
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
