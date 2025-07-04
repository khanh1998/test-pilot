<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth';

	let { children } = $props();
	let isLoading = $state(true);
	
	onMount(() => {
		// Check initial session
		authStore.checkAuth().then(() => {
			isLoading = false;
		});
	});
</script>

<div class="min-h-screen bg-gray-50">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		{#if isLoading}
			<div class="flex justify-center items-center h-screen">
				<div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
			</div>
		{:else}
			{@render children()}
		{/if}
	</div>
</div>
