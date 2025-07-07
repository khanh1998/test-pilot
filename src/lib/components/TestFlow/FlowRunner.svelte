<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  // Props
  export let flowData: any; // The complete test flow data
  export let apiHost: string = ''; // The API host URL
  export let isRunning: boolean = false; // Whether the flow is currently running
  export let executionState: Record<string, any> = {}; // Execution state for each endpoint
  
  // Execution preferences
  export let preferences = {
    parallelExecution: true, // Whether to execute endpoints in parallel
    stopOnError: true, // Whether to stop execution on error
    serverCookieHandling: false, // Whether to use server for cookie handling
    retryCount: 0, // Number of retries for failed requests
    timeout: 30000 // Request timeout in ms
  };
  
  // Local state
  let currentStep = 0;
  let totalSteps = 0;
  let progress = 0; // 0-100
  let error: any = null;
  let storedResponses: Record<string, any> = {}; // Stores responses by their names
  let executionLogs: Array<{
    timestamp: Date;
    level: 'info' | 'debug' | 'error' | 'warning';
    message: string;
    details?: string;
  }> = []; // Logs for the execution
  
  // Cookie management
  // Define the cookie interface for consistency across the component
  interface RequestCookie {
    name: string;
    value: string;
    domain: string;
    path?: string;
  }
  
  let cookieMessage: string = '';
  let cookieStore: Map<string, Array<RequestCookie>> = new Map();
  // Format: Map<"stepId-endpointIndex", Array<RequestCookie>>
  
  // Emitted events will be handled by the parent component
  const dispatch = createEventDispatcher();
  
  // Initialize when component mounts
  $: if (flowData && flowData.steps) {
    totalSteps = flowData.steps.length;
  }
  
  // Make sure apiHost is not undefined when passed to fetch
  $: if (apiHost === undefined || apiHost === null) {
    apiHost = '';
  }
  
  // Ensure endpoints are available
  $: if (!flowData.endpoints) {
    flowData.endpoints = [];
    console.warn("No endpoints provided in flowData. The flow may not execute correctly.");
  }
  
  // Start the flow execution
  async function runFlow() {
    // Reset state
    resetExecution();
    
    // Validate API host
    if (!apiHost || apiHost.trim() === '') {
      error = new Error("API Host is not configured. Please set the API host before running the flow.");
      isRunning = false;
      dispatch('executionComplete', { 
        success: false,
        error,
        storedResponses
      });
      return;
    }
    
    // Notify parent that execution is starting
    dispatch('executionStart');
    
    isRunning = true;
    currentStep = 0;
    
    try {
      // Validate flow data
      if (!flowData || !flowData.steps || !Array.isArray(flowData.steps)) {
        throw new Error("Invalid flow data: missing steps array");
      }
      
      if (!flowData.endpoints || !Array.isArray(flowData.endpoints)) {
        console.warn("Flow data is missing endpoints array");
      }
      
      // Execute steps in sequence
      for (let i = 0; i < flowData.steps.length; i++) {
        currentStep = i;
        progress = Math.floor((i / totalSteps) * 100);
        
        const step = flowData.steps[i];
        
        // Execute this step
        await executeStep(step);
        
        // Check if we should continue after this step
        if (error && preferences.stopOnError) {
          break;
        }
      }
      
      progress = 100;
    } catch (err) {
      error = err;
      console.error('Flow execution error:', err);
    } finally {
      isRunning = false;
      dispatch('executionComplete', { 
        success: !error,
        error,
        storedResponses
      });
    }
  }
  
  // Execute a single step
  async function executeStep(step: any) {
    if (!step || !step.step_id) {
      console.warn("Encountered invalid step:", step);
      return;
    }
    
    if (!step.endpoints || !Array.isArray(step.endpoints) || step.endpoints.length === 0) {
      console.log(`Step ${step.step_id} has no endpoints, skipping`);
      return; // Skip empty steps
    }
    
    try {
      if (preferences.parallelExecution) {
        // Execute all endpoints in parallel and wait for all to complete
        const promises = step.endpoints.map((endpoint: any, index: number) => 
          executeEndpoint(endpoint, step.step_id, index)
        );
        
        await Promise.all(promises);
      } else {
        // Execute endpoints sequentially
        for (let i = 0; i < step.endpoints.length; i++) {
          await executeEndpoint(step.endpoints[i], step.step_id, i);
          
          // Check if we should continue
          if (error && preferences.stopOnError) {
            break;
          }
        }
      }
    } catch (err) {
      console.error(`Error executing step ${step.step_id}:`, err);
      error = err;
      
      // Propagate the error if stopOnError is true
      if (preferences.stopOnError) {
        throw err;
      }
    }
  }
  
  // Execute a single endpoint request
  async function executeEndpoint(endpoint: any, stepId: string, endpointIndex: number) {
    if (!endpoint || !endpoint.endpoint_id) {
      console.error('Invalid endpoint configuration', endpoint);
      return;
    }
    
    const endpointId = `${endpoint.endpoint_id}-${endpointIndex}`;
    
    // Set initial status
    executionState[endpointId] = {
      status: 'running',
      request: {},
      response: null,
      timing: 0
    };
    
    try {
      // Make sure endpoints array exists
      if (!flowData.endpoints || !Array.isArray(flowData.endpoints)) {
        throw new Error(`No endpoints defined in the flow data`);
      }

      // Find the endpoint definition
      const endpointDef = flowData.endpoints.find((e: any) => e.id === endpoint.endpoint_id);
      if (!endpointDef) {
        throw new Error(`Endpoint definition not found for ID: ${endpoint.endpoint_id}`);
      }
      
      // Build the URL with path parameters
      let url = apiHost + endpointDef.path;
      
      // Replace path parameters
      if (endpoint.pathParams && typeof endpoint.pathParams === 'object') {
        try {
          Object.entries(endpoint.pathParams).forEach(([name, value]) => {
            // Replace template values from stored responses
            const resolvedValue = resolveTemplateValue(value as string, storedResponses);
            url = url.replace(`{${name}}`, encodeURIComponent(resolvedValue));
          });
        } catch (err) {
          console.error('Error processing path parameters:', err);
        }
      }
      
      // Add query parameters
      if (endpoint.queryParams && typeof endpoint.queryParams === 'object' && Object.keys(endpoint.queryParams).length > 0) {
        try {
          const queryParams = new URLSearchParams();
          Object.entries(endpoint.queryParams).forEach(([name, value]) => {
            const resolvedValue = resolveTemplateValue(value as string, storedResponses);
            queryParams.append(name, resolvedValue);
          });
          url += `?${queryParams.toString()}`;
        } catch (err) {
          console.error('Error processing query parameters:', err);
        }
      }
      
      // Prepare headers
      const headers: Record<string, string> = {};
      if (endpoint.headers) {
        endpoint.headers
          .filter((h: any) => h.enabled)
          .forEach((h: any) => {
            headers[h.name] = resolveTemplateValue(h.value, storedResponses);
          });
      }
      
      // Prepare body
      let body = null;
      if (endpoint.body) {
        body = resolveTemplateObject(endpoint.body, storedResponses);
      }
      
      // Record the request details for debugging
      executionState[endpointId].request = {
        url,
        method: endpointDef.method,
        headers,
        body,
        pathParams: endpoint.pathParams,
        queryParams: endpoint.queryParams
      };
      
      // Start timer
      const startTime = performance.now();
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), preferences.timeout);
      
      // Add request debug logs
      addRequestDebugLogs(endpointDef.path, headers);
      
      // Make the request
      let response;
      
      if (preferences.serverCookieHandling) {
        // Use server proxy for cookie handling
        const proxyUrl = '/api/proxy/request';
        
        // Prepare cookies to send with the request
        const targetUrl = new URL(url);
        const domain = targetUrl.hostname;
        
        let requestCookies: RequestCookie[] = [];
        
        // Gather all cookies from previous steps regardless of domain (temporary solution)
        for (const [key, cookies] of cookieStore.entries()) {
          // Add all cookies regardless of domain
          if (cookies.length > 0) {
            for (const cookie of cookies) {
                if (cookie.value.length > 0) {
                    requestCookies.push(cookie);
                }
            }
          }
        }
        
        // Log the cookies being sent
        executionLogs.push({
          timestamp: new Date(),
          level: 'debug',
          message: `Sending ${requestCookies.length} cookies with request`,
          details: `Target domain: ${domain}`
        });
        
        // Make the proxy request
        const proxyResponse = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({
            url,
            method: endpointDef.method,
            headers,
            body: body ? JSON.stringify(body) : null,
            cookies: requestCookies
          }),
          signal: controller.signal
        });
        
        // Extract the response data from the proxy
        const proxyData = await proxyResponse.json();
        
        // Create a synthetic Response object from proxy data
        response = new Response(
          proxyData.body ? JSON.stringify(proxyData.body) : null,
          {
            status: proxyData.status,
            statusText: proxyData.statusText,
            headers: new Headers(proxyData.headers)
          }
        );
        
        // Store cookies from the response
        if (proxyData.cookies && proxyData.cookies.length > 0) {
          // Generate a unique ID for this endpoint
          const endpointKey = `${stepId}-${endpointIndex}`;
          
          // Store cookies by endpoint
          cookieStore.set(endpointKey, proxyData.cookies.map((c: any) => ({
            name: c.name,
            value: c.value,
            domain: c.domain || targetUrl.hostname,
            path: c.path
          })));
          
          // Add cookie info to logs
          executionLogs.push({
            timestamp: new Date(),
            level: 'info',
            message: `Received ${proxyData.cookies.length} cookies from server`,
            details: `Cookies stored for endpoint: ${endpointKey}`
          });
        }
        
        // Add proxy info to logs
        executionLogs.push({
          timestamp: new Date(),
          level: 'info',
          message: 'Request proxied through server for cookie handling',
          details: `Original URL: ${url}\nProxy URL: ${proxyUrl}`
        });
      } else {
        // Direct fetch without proxy
        response = await fetch(url, {
          method: endpointDef.method,
          headers,
          body: body ? JSON.stringify(body) : null,
          signal: controller.signal,
          mode: 'cors', // Enable CORS for cross-origin requests
        });
      }
      
      // Clear timeout
      clearTimeout(timeoutId);
      
      // Calculate timing
      const endTime = performance.now();
      executionState[endpointId].timing = Math.round(endTime - startTime);
      
      // Process response
      const responseData = await getResponseData(response);
      
      // Add response info to logs
      const responseHeaders = Object.fromEntries([...response.headers.entries()]);
      executionLogs.push({
        timestamp: new Date(),
        level: 'info',
        message: `Response status: ${response.status} ${response.statusText}`,
        details: `Received from ${endpointDef.path}`
      });
      
      executionLogs.push({
        timestamp: new Date(),
        level: 'info',
        message: 'Response headers:',
        details: JSON.stringify(responseHeaders, null, 2)
      });
      
      // Store response details
      executionState[endpointId].response = {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries([...response.headers.entries()]),
        body: responseData
      };
      
      // Store named response for use in later steps if requested
      if (endpoint.store_response_as) {
        storedResponses[endpoint.store_response_as] = responseData;
      }
      
      // Update status
      if (response.ok) {
        executionState[endpointId].status = 'completed';
      } else {
        executionState[endpointId].status = 'failed';
        
        // Set error if stopOnError is true
        if (preferences.stopOnError) {
          error = new Error(`Request failed with status ${response.status}: ${response.statusText}`);
        }
      }
    } catch (err) {
      // Handle network errors or timeouts
      executionState[endpointId].status = 'failed';
      executionState[endpointId].error = err instanceof Error ? err.message : String(err);
      
      if (preferences.stopOnError) {
        error = err;
      }
    }
    
    // Update execution state
    executionState = { 
      ...executionState
    };
  }
  
  // Reset execution state
  function resetExecution() {
    currentStep = 0;
    progress = 0;
    error = null;
    storedResponses = {};
    executionState = {};
    isRunning = false;
    executionLogs = []; // Clear execution logs
    
    // Reset cookies if user wants to start fresh
    if (preferences.serverCookieHandling) {
      cookieStore.clear();
    }
    
    // Add initial log entry
    executionLogs.push({
      timestamp: new Date(),
      level: 'info',
      message: 'Test flow execution reset',
      details: 'Ready to execute'
    });
    
    // Add a log about CORS if an API host is set
    if (apiHost) {
      const apiUrl = new URL(apiHost.startsWith('http') ? apiHost : `https://${apiHost}`);
      const frontend = window.location.origin;
      
      if (frontend !== apiUrl.origin) {
        executionLogs.push({
          timestamp: new Date(),
          level: 'info',
          message: 'Cross-Origin API detected',
          details: `Frontend: ${frontend}\nAPI: ${apiUrl.origin}`
        });
        
        // Add suggestion about cookie handling if cross-origin
        executionLogs.push({
          timestamp: new Date(),
          level: 'info',
          message: 'Tip: For APIs that use cookies',
          details: 'If this API uses cookies for auth or sessions, enable "Use server for cookie handling" in Execution Preferences.'
        });
      }
    }
    
    dispatch('reset');
  }
  
  // Helper function to get response data based on content type
  async function getResponseData(response: Response): Promise<any> {
    try {
      const contentType = response.headers.get('content-type') || '';
      let data: any;
      
      // Add content type to logs
      executionLogs.push({
        timestamp: new Date(),
        level: 'debug',
        message: 'Response content type:',
        details: contentType || 'No content-type header'
      });
      
      // Handle different content types
      if (contentType.includes('application/json')) {
        data = await response.json();
        executionLogs.push({
          timestamp: new Date(),
          level: 'debug',
          message: 'Response parsed as JSON'
        });
      } else if (contentType.includes('text/html')) {
        data = await response.text();
        executionLogs.push({
          timestamp: new Date(),
          level: 'debug',
          message: 'Response parsed as HTML'
        });
      } else if (contentType.includes('text/')) {
        data = await response.text();
        executionLogs.push({
          timestamp: new Date(),
          level: 'debug',
          message: 'Response parsed as text'
        });
      } else if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
        data = await response.text();
        executionLogs.push({
          timestamp: new Date(),
          level: 'debug',
          message: 'Response parsed as XML'
        });
      } else {
        // Try to parse as JSON first
        try {
          data = await response.json();
          executionLogs.push({
            timestamp: new Date(),
            level: 'debug',
            message: 'Response auto-detected as JSON'
          });
        } catch (e: any) {
          // Then try as text
          data = await response.text();
          executionLogs.push({
            timestamp: new Date(),
            level: 'debug',
            message: 'Response auto-detected as text'
          });
        }
      }
      
      return data;
    } catch (error: any) {
      // Log the error
      executionLogs.push({
        timestamp: new Date(),
        level: 'error',
        message: 'Failed to parse response:',
        details: error.message || 'Unknown error parsing response'
      });
      return 'Unable to parse response data';
    }
  }
  
  // Helper function to resolve template values like {{responseName.path.to.property}}
  function resolveTemplateValue(value: string, storedData: Record<string, any>): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (typeof value !== 'string') {
      return String(value);
    }
    
    // Replace all {{...}} templates in the string
    return value.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      try {
        const segments = path.trim().split('.');
        const responseName = segments[0];
        
        if (!storedData[responseName]) {
          return match; // Keep original template if response not found
        }
        
        let result = storedData[responseName];
        
        // Navigate the property path
        for (let i = 1; i < segments.length; i++) {
          result = result[segments[i]];
          
          if (result === undefined) {
            return match; // Keep original template if property not found
          }
        }
        
        return String(result);
      } catch {
        return match; // Keep original template on error
      }
    });
  }
  
  // Recursively resolve template values in an object
  function resolveTemplateObject(obj: any, storedData: Record<string, any>): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (typeof obj === 'string') {
      return resolveTemplateValue(obj, storedData);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => resolveTemplateObject(item, storedData));
    }
    
    if (typeof obj === 'object') {
      const result: Record<string, any> = {};
      
      Object.entries(obj).forEach(([key, value]) => {
        result[key] = resolveTemplateObject(value, storedData);
      });
      
      return result;
    }
    
    return obj;
  }
  
  // Function for adding debug logs about requests
  function addRequestDebugLogs(path: string, reqHeaders: Record<string, string>) {
    // Add debug info to logs
    executionLogs.push({
      timestamp: new Date(),
      level: 'info',
      message: `Request headers for ${path}:`,
      details: JSON.stringify(reqHeaders, null, 2)
    });
  }
  
  // Function to clear all cookies in the client-side cookie store
  function clearCookies() {
    try {
      cookieStore.clear();
      cookieMessage = 'All cookies cleared successfully';
      
      // Add log entry
      executionLogs.push({
        timestamp: new Date(),
        level: 'info',
        message: 'Cookies cleared',
        details: 'All cookies have been cleared from the client-side cookie store'
      });
      
      // Reset message after 3 seconds
      setTimeout(() => {
        cookieMessage = '';
      }, 3000);
    } catch (error) {
      cookieMessage = 'Failed to clear cookies';
      console.error('Error clearing cookies:', error);
    }
  }
</script>

<div class="bg-white border rounded-lg shadow-sm p-4 mb-6">
  <div class="flex justify-between items-center mb-4">
    <h3 class="text-lg font-medium">Test Flow Runner</h3>
    <div class="flex space-x-3">
      <button 
        class="px-4 py-2 text-sm font-medium rounded-md {isRunning ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}"
        on:click={runFlow}
        disabled={isRunning}
      >
        {#if isRunning}
          <div class="flex items-center">
            <div class="w-4 h-4 mr-2">
              <div class="w-full h-full border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            Running...
          </div>
        {:else}
          <div class="flex items-center">
            <svg class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
            </svg>
            Run Flow
          </div>
        {/if}
      </button>
      
      <button 
        class="px-4 py-2 text-sm font-medium border border-gray-300 rounded-md {isRunning ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}"
        on:click={resetExecution}
        disabled={isRunning}
      >
        Reset
      </button>
    </div>
  </div>
  
  <!-- Progress Bar -->
  {#if isRunning || progress > 0}
    <div class="w-full bg-gray-200 rounded-full h-2 mb-4">
      <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: {progress}%"></div>
    </div>
    
    <!-- Current Step Indicator -->
    {#if isRunning}
      <div class="text-sm text-gray-600 mb-4">
        Executing step {currentStep + 1} of {totalSteps}
      </div>
    {/if}
  {/if}
  
  <!-- Error Display -->
  {#if error}
    <div class="mt-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded-md">
      <div class="font-medium">Flow execution error</div>
      <div class="text-sm mt-1">{error.message || String(error)}</div>
    </div>
  {/if}
  
  <!-- Preferences Section -->
  <div class="mt-4 pt-4 border-t">
    <h4 class="text-sm font-medium text-gray-700 mb-3">Execution Preferences</h4>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="flex items-center">
        <input 
          type="checkbox" 
          id="parallel-execution" 
          bind:checked={preferences.parallelExecution} 
          class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          disabled={isRunning}
        >
        <label for="parallel-execution" class="ml-2 text-sm text-gray-700">
          Execute endpoints in parallel
        </label>
      </div>
      
      <div class="flex items-center">
        <input 
          type="checkbox" 
          id="stop-on-error" 
          bind:checked={preferences.stopOnError} 
          class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          disabled={isRunning}
        >
        <label for="stop-on-error" class="ml-2 text-sm text-gray-700">
          Stop on error (4xx, 5xx)
        </label>
      </div>
      
      <div class="flex items-center">
        <input 
          type="checkbox" 
          id="server-cookie-handling" 
          bind:checked={preferences.serverCookieHandling} 
          class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          disabled={isRunning}
        >
        <label for="server-cookie-handling" class="ml-2 text-sm text-gray-700 flex items-center">
          Use server for cookie handling
          <span class="ml-1 text-xs text-gray-500 bg-gray-100 px-1 rounded">
            CORS fix
          </span>
        </label>
      </div>
      
      <div>
        <label for="retry-count" class="block text-sm text-gray-700">
          Retry attempts
        </label>
        <input 
          type="number" 
          id="retry-count" 
          bind:value={preferences.retryCount} 
          min="0" 
          max="5"
          class="mt-1 block w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          disabled={isRunning}
        >
      </div>
      
      <div>
        <label for="timeout" class="block text-sm text-gray-700">
          Timeout (ms)
        </label>
        <input 
          type="number" 
          id="timeout" 
          bind:value={preferences.timeout} 
          min="1000"
          step="1000" 
          class="mt-1 block w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          disabled={isRunning}
        >
      </div>
    </div>
  </div>
  
  <!-- Cookie Management Info - Only visible when serverCookieHandling is enabled -->
  {#if preferences.serverCookieHandling}
    <div class="mt-4 pt-4 border-t">
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-medium text-gray-700">Cookie Management</h4>
        <button 
          on:click={clearCookies} 
          class="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
          disabled={isRunning}
        >
          Clear All Cookies
        </button>
      </div>
      <p class="text-xs text-gray-500 mt-1">
        {cookieMessage || 'Cookies will be passed between endpoints to maintain session state.'}
      </p>
    </div>
  {/if}
  
  <!-- Execution Logs Section -->
  <div class="mt-6 pt-4 border-t">
    <h4 class="text-sm font-medium text-gray-700 mb-3 flex items-center justify-between">
      <span>Execution Logs</span>
      <button 
        class="text-xs text-gray-500 hover:text-gray-700" 
        on:click={() => { executionLogs = []; }}
      >
        Clear logs
      </button>
    </h4>
    
    <div class="bg-gray-800 text-gray-200 rounded-md p-2 max-h-96 overflow-y-auto font-mono text-xs">
      {#if executionLogs.length === 0}
        <div class="italic text-gray-400 p-2">No logs yet</div>
      {:else}
        {#each executionLogs as log}
          <div class="mb-2 border-b border-gray-700 pb-2 last:border-b-0 last:pb-0">
            <div class="flex items-start">
              <span class="
                inline-block w-16 mr-2 
                {log.level === 'error' ? 'text-red-400' : 
                log.level === 'warning' ? 'text-yellow-400' : 
                log.level === 'debug' ? 'text-blue-400' : 'text-green-400'}
              ">
                [{log.level}]
              </span>
              <span class="flex-1">{log.message}</span>
              <span class="text-gray-400 text-xxs ml-2">{log.timestamp.toLocaleTimeString()}</span>
            </div>
            {#if log.details}
              <div class="ml-18 mt-1 pl-2 border-l-2 border-gray-600 text-gray-400 whitespace-pre-wrap">
                {log.details}
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>
  </div>
</div>
