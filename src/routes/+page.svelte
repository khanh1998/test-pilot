<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/store/auth';

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
    <p class="mt-2 text-center text-sm text-gray-600">Smart API Test Flow Client</p>
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
