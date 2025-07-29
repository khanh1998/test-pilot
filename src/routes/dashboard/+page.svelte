<script lang="ts">
  // This page is now wrapped by the DashboardLayout via +layout.svelte
  // All the navigation and layout logic is handled in the layout
</script>

<!-- Dashboard Home Content -->
<div class="flex h-full items-center justify-center">
  <div class="text-center">
    <div class="mx-auto h-24 w-24 rounded-full bg-gray-100 flex items-center justify-center mb-4">
      <svg class="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2V7a2 2 0 012-2h2a2 2 0 002 2v2a2 2 0 002 2h6a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2-2V3a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 002 2h2a2 2 0 012 2v2a2 2 0 00-2 2h-6a2 2 0 00-2 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2z" />
      </svg>
    </div>
    <h2 class="text-2xl font-bold text-gray-900 mb-2">Welcome to Test Pilot</h2>
    <p class="text-gray-600 mb-8 max-w-md">
      Your smart API testing companion. Import OpenAPI specs, generate test flows, and validate your APIs with ease.
    </p>
    
    <!-- Quick action cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
      <a
        href="/dashboard/apis"
        class="group relative rounded-lg border border-gray-300 bg-white px-6 py-4 shadow-sm hover:shadow-md transition-shadow duration-200 hover:border-gray-400"
      >
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <svg class="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8" />
            </svg>
          </div>
          <div class="ml-4 text-left">
            <h3 class="text-lg font-medium text-gray-900 group-hover:text-blue-600">
              Manage APIs
            </h3>
            <p class="text-sm text-gray-500">
              Import and manage your OpenAPI specifications
            </p>
          </div>
        </div>
      </a>

      <a
        href="/dashboard/test-flows"
        class="group relative rounded-lg border border-gray-300 bg-white px-6 py-4 shadow-sm hover:shadow-md transition-shadow duration-200 hover:border-gray-400"
      >
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <svg class="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div class="ml-4 text-left">
            <h3 class="text-lg font-medium text-gray-900 group-hover:text-green-600">
              Test Flows
            </h3>
            <p class="text-sm text-gray-500">
              Create and execute API test sequences
            </p>
          </div>
        </div>
      </a>
    </div>
  </div>
</div>
