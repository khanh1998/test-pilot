<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { TestFlowData, FlowVariable, ExecutionState, FlowStep, StepEndpoint } from './types';

  // Props
  export let flowData: TestFlowData = {
    variables: [],
    settings: { api_host: '' },
    steps: [],
    assertions: []
  }; // The complete test flow data
  export let apiHost: string = ''; // API host URL
  export let isRunning: boolean = false; // Whether the flow is currently running
  export let executionState: ExecutionState = {}; // Execution state for each endpoint

  // Extended FlowVariable type with isNew property
  interface ExtendedFlowVariable extends FlowVariable {
    isNew?: boolean;
  }

  // Variable input modal state
  let showVariableInputModal = false;
  let variablesWithMissingValues: Array<FlowVariable> = [];

  // Variables management panel
  export let showVariablesPanel = false;

  // Control visibility of buttons - set to false when used by TestFlowEditor
  export let showButtons = true;

  let editingVariable: null | ExtendedFlowVariable = null;

  // Computed variable values for template resolution
  let variableValues: Record<string, unknown> = {};

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
  let error: unknown = null;
  let storedResponses: Record<string, unknown> = {}; // Stores responses by their names
  let executionLogs: Array<{
    timestamp: Date;
    level: 'info' | 'debug' | 'error' | 'warning';
    message: string;
    details?: string;
  }> = []; // Logs for the execution

  // Variables panel state
  let newVariable = {
    name: '',
    type: 'string' as 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null',
    value: '',
    defaultValue: '',
    description: '',
    required: false
  };

  // Cookie management
  // Define the cookie interface for consistency across the component
  interface RequestCookie {
    name: string;
    value: string;
    domain: string;
    path?: string;
  }

  let cookieStore: Map<string, Array<RequestCookie>> = new Map();
  // Format: Map<"stepId-endpointIndex", Array<RequestCookie>>

  // Emitted events will be handled by the parent component
  const dispatch = createEventDispatcher();

  // Add a log entry to the execution logs
  function addLog(
    level: 'info' | 'debug' | 'error' | 'warning',
    message: string,
    details?: string
  ) {
    executionLogs = [
      ...executionLogs,
      {
        timestamp: new Date(),
        level,
        message,
        details
      }
    ];

    // For errors, also console log them
    if (level === 'error') {
      console.error(message, details);
    }
  }

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
    console.warn('No endpoints provided in flowData. The flow may not execute correctly.');
  }

  // Ensure variables array exists
  $: if (!flowData.variables) {
    console.log('Initializing empty variables array');
    flowData.variables = [];
  }

  // Log whenever variables change
  $: console.log('Variables in flowData:', flowData.variables);

  $: console.log('flow data', flowData);

  // Watch executionState for changes and emit update events
  $: if (Object.keys(executionState).length > 0) {
    // Only emit if we're not in initialization
    if (isRunning) {
      dispatch('executionStateUpdate', executionState);
    }
  }

  // Make progress and current step available in the executionState for external components
  $: executionState.progress = progress;
  $: executionState.currentStep = currentStep;

  // Add event listener for the global 'runFlow' event
  import { onMount, onDestroy } from 'svelte';

  function handleRunFlowEvent() {
    console.log('Received runFlow event, starting flow execution');
    runFlow();
  }

  function handleStopFlowEvent() {
    console.log('Received stopFlow event, stopping execution');
    stopExecution();
  }

  onMount(() => {
    // Add global event listeners
    window.addEventListener('runFlow', handleRunFlowEvent);
    window.addEventListener('stopFlow', handleStopFlowEvent);
  });

  onDestroy(() => {
    // Clean up event listeners when the component is destroyed
    window.removeEventListener('runFlow', handleRunFlowEvent);
    window.removeEventListener('stopFlow', handleStopFlowEvent);
  });

  // Execute a single step (exposed as a public method)
  export async function executeSingleStep(step: FlowStep, stepIndex?: number) {
    if (!step || !step.step_id) {
      console.error('Invalid step provided for execution');
      return;
    }

    // Validate API host
    if (!apiHost || apiHost.trim() === '') {
      error = new Error(
        'API Host is not configured. Please set the API host before running the flow.'
      );
      dispatch('error', { message: 'API Host is not configured' });
      return;
    }

    // Set a local running flag just for this step execution
    const localIsRunning = isRunning;
    isRunning = true;

    try {
      // Log that we're executing a single step
      addLog('info', `Executing step ${step.step_id} individually`, JSON.stringify(step));

      // Execute the step
      await executeStep(step);

      // Notify step execution completed
      dispatch('stepExecutionComplete', {
        stepId: step.step_id,
        stepIndex: stepIndex,
        success: true
      });
    } catch (err: unknown) {
      console.error(`Error executing step ${step.step_id}:`, err);

      // Notify step execution failed
      dispatch('stepExecutionComplete', {
        stepId: step.step_id,
        stepIndex: stepIndex,
        success: false,
        error: err
      });
    } finally {
      // Restore original running state
      isRunning = localIsRunning;
    }
  }

  // Flag to signal execution should be stopped
  let shouldStopExecution = false;

  // Stop the flow execution
  export function stopExecution() {
    if (isRunning) {
      shouldStopExecution = true;
      addLog('info', 'User requested to stop execution');
    }
  }

  // Start the flow execution
  export async function runFlow() {
    // Reset state
    resetExecution();
    shouldStopExecution = false;

    // Validate API host
    if (!apiHost || apiHost.trim() === '') {
      error = new Error(
        'API Host is not configured. Please set the API host before running the flow.'
      );
      isRunning = false;
      dispatch('executionComplete', {
        success: false,
        error,
        storedResponses
      });
      return;
    }

    // Prepare variables and check if all required variables have values
    prepareVariables();
    if (!checkRequiredVariables()) {
      // Show the variable input modal if there are missing required values
      addLog(
        'info',
        'Required variables need input',
        `${variablesWithMissingValues.length} required variable(s) need values`
      );
      showVariableInputModal = true;
      return;
    }

    // All variables are ready, execute the flow
    executeFlowAfterVariableCheck();
  }

  // Execute flow after variable check
  async function executeFlowAfterVariableCheck() {
    // Notify parent that execution is starting
    dispatch('executionStart');

    isRunning = true;
    currentStep = 0;

    try {
      // Validate flow data
      if (!flowData || !flowData.steps || !Array.isArray(flowData.steps)) {
        throw new Error('Invalid flow data: missing steps array');
      }

      if (!flowData.endpoints || !Array.isArray(flowData.endpoints)) {
        console.warn('Flow data is missing endpoints array');
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

        // Check for external stop signal
        if (shouldStopExecution) {
          addLog('info', 'Execution stopped by user');
          break;
        }
      }

      progress = 100;
    } catch (err: unknown) {
      error = err;
      console.error('Flow execution error:', err);
    } finally {
      isRunning = false;
      dispatch('executionComplete', {
        success: !error,
        error,
        storedResponses,
        variableValues
      });
    }
  }

  // Execute a single step
  async function executeStep(step: FlowStep) {
    if (!step || !step.step_id) {
      console.warn('Encountered invalid step:', step);
      return;
    }

    if (!step.endpoints || !Array.isArray(step.endpoints) || step.endpoints.length === 0) {
      console.log(`Step ${step.step_id} has no endpoints, skipping`);
      return; // Skip empty steps
    }

    try {
      if (preferences.parallelExecution) {
        // Execute all endpoints in parallel and wait for all to complete
        const promises = step.endpoints.map((endpoint: StepEndpoint, index: number) =>
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

          // Check for external stop signal
          if (shouldStopExecution) {
            addLog('info', 'Execution stopped by user');
            break;
          }
        }
      }
    } catch (err: unknown) {
      console.error(`Error executing step ${step.step_id}:`, err);
      error = err;

      // Propagate the error if stopOnError is true
      if (preferences.stopOnError) {
        throw err;
      }
    }
  }

  // Execute a single endpoint request
  async function executeEndpoint(endpoint: StepEndpoint, stepId: string, endpointIndex: number) {
    if (!endpoint || !endpoint.endpoint_id) {
      console.error('Invalid endpoint configuration', endpoint);
      return;
    }

    // Use stepId-endpointIndex format for easier reference by users in templates
    // This makes it more intuitive than using the internal endpoint_id which users don't see
    const endpointId = `${stepId}-${endpointIndex}`;

    // Set initial status - create a new object to trigger reactivity
    executionState = {
      ...executionState,
      [endpointId]: {
        status: 'running',
        request: {},
        response: null,
        timing: 0
      }
    };

    // Emit execution state update event to notify parent component
    dispatch('executionStateUpdate', executionState);

    try {
      // Make sure endpoints array exists
      if (!flowData.endpoints || !Array.isArray(flowData.endpoints)) {
        throw new Error(`No endpoints defined in the flow data`);
      }

      // Find the endpoint definition
      const endpointDef = flowData.endpoints.find((e) => e.id === endpoint.endpoint_id);
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
        } catch (err: unknown) {
          console.error('Error processing path parameters:', err);
        }
      }

      // Add query parameters
      if (
        endpoint.queryParams &&
        typeof endpoint.queryParams === 'object' &&
        Object.keys(endpoint.queryParams).length > 0
      ) {
        try {
          const queryParams = new URLSearchParams();
          Object.entries(endpoint.queryParams).forEach(([name, value]) => {
            const resolvedValue = resolveTemplateValue(value as string, storedResponses);
            queryParams.append(name, resolvedValue);
          });
          url += `?${queryParams.toString()}`;
        } catch (err: unknown) {
          console.error('Error processing query parameters:', err);
        }
      }

      // Prepare headers
      const headers: Record<string, string> = {};
      if (endpoint.headers) {
        endpoint.headers
          .filter((h: { enabled: boolean }) => h.enabled)
          .forEach((h: { name: string; value: string }) => {
            headers[h.name] = resolveTemplateValue(h.value, storedResponses);
          });
      }

      // Prepare body
      let body = null;
      if (endpoint.body) {
        body = resolveTemplateObject(endpoint.body, storedResponses);
      }

      // Record the request details for debugging - create a new object for reactivity
      executionState = {
        ...executionState,
        [endpointId]: {
          ...executionState[endpointId],
          request: {
            url,
            method: endpointDef.method,
            headers,
            body,
            pathParams: endpoint.pathParams,
            queryParams: endpoint.queryParams
          }
        }
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
        for (const [_key, cookies] of cookieStore.entries()) {
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
            Authorization: `Bearer ${localStorage.getItem('authToken')}`
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
        response = new Response(proxyData.body ? JSON.stringify(proxyData.body) : null, {
          status: proxyData.status,
          statusText: proxyData.statusText,
          headers: new Headers(proxyData.headers)
        });

        // Store cookies from the response
        if (proxyData.cookies && proxyData.cookies.length > 0) {
          // Generate a unique ID for this endpoint using the same format as endpointId
          const endpointKey = endpointId;

          // Store cookies by endpoint
          cookieStore.set(
            endpointKey,
            proxyData.cookies.map((c: RequestCookie) => ({
              name: c.name,
              value: c.value,
              domain: c.domain || targetUrl.hostname,
              path: c.path
            }))
          );

          // Add cookie info to logs
          executionLogs.push({
            timestamp: new Date(),
            level: 'info',
            message: `Received ${proxyData.cookies.length} cookies from server`,
            details: `Cookies stored for step: ${endpointKey}`
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
          credentials: 'include'
        });
      }

      // Clear timeout
      clearTimeout(timeoutId);

      // Calculate timing - create a new object for reactivity
      const endTime = performance.now();
      const timing = Math.round(endTime - startTime);
      executionState = {
        ...executionState,
        [endpointId]: {
          ...executionState[endpointId],
          timing
        }
      };

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

      // Store response details - create a new object for reactivity
      executionState = {
        ...executionState,
        [endpointId]: {
          ...executionState[endpointId],
          response: {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries([...response.headers.entries()]),
            body: responseData
          }
        }
      };

      // Always store response with endpointId for reference by templates
      storedResponses[endpointId] = responseData;

      // Also store with custom name if requested
      if (endpoint.store_response_as) {
        storedResponses[endpoint.store_response_as] = responseData;
      }

      // Update status - create a new object for reactivity
      if (response.ok) {
        // Create a new copy of the endpoint state to ensure reactivity
        const updatedEndpointState = {
          ...executionState[endpointId],
          status: 'completed'
        };

        // Update the global execution state
        executionState = {
          ...executionState,
          [endpointId]: updatedEndpointState
        };

        // Emit execution state update event
        dispatch('executionStateUpdate', executionState);

        // Also emit a specific endpoint update event for more focused updates
        dispatch('endpointStateUpdate', {
          endpointId,
          state: updatedEndpointState
        });
      } else {
        // Create a new copy of the endpoint state to ensure reactivity
        const updatedEndpointState = {
          ...executionState[endpointId],
          status: 'failed',
          error: `Request failed with status ${response.status}: ${response.statusText}`
        };

        // Update the global execution state
        executionState = {
          ...executionState,
          [endpointId]: updatedEndpointState
        };

        // Emit execution state update event
        dispatch('executionStateUpdate', executionState);

        // Also emit a specific endpoint update event for more focused updates
        dispatch('endpointStateUpdate', {
          endpointId,
          state: updatedEndpointState
        });

        // Set error if stopOnError is true
        if (preferences.stopOnError) {
          error = new Error(
            `Request failed with status ${response.status}: ${response.statusText}`
          );
        }
      }
    } catch (err: unknown) {
      // Handle network errors or timeouts - create a new object for reactivity
      const errorMessage = err instanceof Error ? err.message : String(err);
      executionState = {
        ...executionState,
        [endpointId]: {
          ...executionState[endpointId],
          status: 'failed',
          error: errorMessage
        }
      };

      if (preferences.stopOnError) {
        error = err;
      }
    }

    // Update execution state
    executionState = {
      ...executionState
    };

    // Emit execution state update event
    dispatch('executionStateUpdate', executionState);
  }

  // Reset execution state
  export function resetExecution() {
    currentStep = 0;
    progress = 0;
    error = null;
    storedResponses = {};
    executionState = {};
    isRunning = false;
    executionLogs = []; // Clear execution logs
    variableValues = {}; // Clear variable values
    showVariableInputModal = false; // Close the variable input modal

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
          details:
            'If this API uses cookies for auth or sessions, enable "Use server for cookie handling" in Execution Preferences.'
        });
      }
    }

    // Removed dispatch('reset') to prevent infinite recursion
  }

  // Handle reset button click
  export function handleReset() {
    // Call resetExecution to clear all execution state
    resetExecution();
    // Emit reset event to notify parent components
    dispatch('reset');
  }

  // Helper function to get response data based on content type
  async function getResponseData(response: Response): Promise<unknown> {
    try {
      const contentType = response.headers.get('content-type') || '';
      let data: unknown;

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
        } catch (_e: unknown) {
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
    } catch (_error: unknown) {
      // Log the error
      executionLogs.push({
        timestamp: new Date(),
        level: 'error',
        message: 'Failed to parse response:',
        details: _error instanceof Error ? _error.message : String(_error)
      });
      return 'Unable to parse response data';
    }
  }

  import * as templateFunctionsModule from '../utils/templateFunctions';

  // Create an indexed object for dynamic function access
  const templateFunctions: Record<string, (...args: any[]) => any> = {};
  Object.entries(templateFunctionsModule).forEach(([key, value]) => {
    if (typeof value === 'function') {
      templateFunctions[key] = value;
    }
  });

  // Helper function to process a template expression
  function processTemplateExpression(
    expression: string,
    storedData: Record<string, unknown>,
    originalMatch: string
  ): string {
    const [source, path] = expression.trim().split(':', 2);

    switch (source.trim()) {
      case 'res':
        // Handle res:stepId-endpointIndex.jsonpath
        return resolveResponseTemplate(path.trim(), storedData);

      case 'func':
        // Handle func:functionName(arg1,arg2,...)
        return resolveFunctionTemplate(path.trim());

      case 'var':
        // Handle var:variable_name
        return resolveVariableTemplate(path.trim());

      default:
        console.warn(`Unknown template source: ${source}`);
        return originalMatch; // Keep original template if source is unknown
    }
  }

  // Helper function to resolve template values like {{source:expression}} or "{{{source:expression}}}"
  function resolveTemplateValue(value: string, storedData: Record<string, unknown>): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value !== 'string') {
      return String(value);
    }

    // First handle quoted triple bracket templates "{{{...}}}"
    // These will be replaced without the surrounding quotes
    value = value.replace(/"(\{\{\{([^}]+)\}\}\})"/g, (_match, _bracketExpr, expression) => {
      return processTemplateExpression(expression, storedData, _match);
    });

    // Then handle regular double bracket templates {{...}}
    // Fixed: Store the result of replace() back into the value variable
    // Also fixed: Removed the trailing space from the regex pattern that was preventing matches
    value = value.replace(/\{\{([^}]+)\}\}/g, (_match, expression) => {
      return processTemplateExpression(expression, storedData, _match);
    });

    return value;
  }

  // resolve template values in an json object
  function resolveTemplateObject(obj: unknown, storedData: Record<string, unknown>): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }

    let objString = JSON.stringify(obj);
    const processedStr = resolveTemplateValue(objString, storedData);
    const processedObj = JSON.parse(processedStr);

    return processedObj;
  }

  // Helper function to resolve response templates like stepId-endpointIndex.jsonpath
  function resolveResponseTemplate(path: string, storedData: Record<string, unknown>): string {
    // Get step and jsonpath parts (e.g., "step1-0.$.data.id")
    const firstDotIndex = path.indexOf('.');
    const stepEndpointId = firstDotIndex > 0 ? path.substring(0, firstDotIndex) : path;
    const jsonPathExpr = firstDotIndex > 0 ? path.substring(firstDotIndex + 1) : '$';

    // Lookup the response data
    const responseData = storedData[stepEndpointId];
    if (!responseData) {
      console.warn(`Response data not found for: ${stepEndpointId}`);
      return `{res:${path}}`;
    }

    // Apply JSONPath if specified
    if (jsonPathExpr) {
      try {
        const result = templateFunctions.jsonPath(responseData, jsonPathExpr);
        return result !== undefined ? String(result) : `{res:${path}}`;
      } catch (error: unknown) {
        console.error(`Error applying JSONPath '${jsonPathExpr}' to response:`, error);
        return `{res:${path}}`;
      }
    }

    return String(responseData);
  }

  // Helper function to resolve function templates like functionName(arg1,arg2,...)
  function resolveFunctionTemplate(expression: string): string {
    // Parse function name and arguments
    const match = expression.match(/^([a-zA-Z0-9_]+)\s*\((.*)\)$/);
    if (!match) {
      console.warn(`Invalid function template format: ${expression}`);
      return `{func:${expression}}`;
    }

    const functionName = match[1];
    const argsString = match[2].trim();

    // Check if the function exists
    if (typeof templateFunctions[functionName] !== 'function') {
      console.warn(`Function not found: ${functionName}`);
      return `{func:${expression}}`;
    }

    try {
      let args: unknown[] = [];

      // Parse arguments if any
      if (argsString) {
        // Handle comma-separated arguments, respecting quoted strings
        // This is a basic version - for production consider a proper parser
        args = argsString.split(',').map((arg) => {
          const trimmed = arg.trim();

          // Try to parse as JSON (handles numbers, booleans, null, quoted strings)
          try {
            return JSON.parse(trimmed);
          } catch (_e: unknown) {
            // If it's not valid JSON, return as string
            return trimmed;
          }
        });
      }

      // Call the function with arguments
      const result = templateFunctions[functionName](...args);
      return result !== undefined ? String(result) : `{func:${expression}}`;
    } catch (error: unknown) {
      console.error(`Error executing template function '${functionName}':`, error);
      return `{func:${expression}}`;
    }
  }

  // Helper function to resolve variable templates like var:variable_name
  function resolveVariableTemplate(variableName: string): string {
    if (Object.prototype.hasOwnProperty.call(variableValues, variableName)) {
      const value = variableValues[variableName];
      const result = value !== null && value !== undefined ? String(value) : '';

      // Add to logs for debugging
      addLog('debug', `Variable substitution: ${variableName}`, `Value: ${result}`);

      return result;
    }
    console.warn(`Variable not found: ${variableName}`);
    return `{var:${variableName}}`;
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function clearCookies() {
    try {
      cookieStore.clear();

      // Add log entry
      executionLogs.push({
        timestamp: new Date(),
        level: 'info',
        message: 'Cookies cleared',
        details: 'All cookies have been cleared from the client-side cookie store'
      });
    } catch (error: unknown) {
      console.error('Error clearing cookies:', error);
    }
  }

  // Function to prepare variables before executing the flow
  function prepareVariables() {
    // Reset variables values store
    variableValues = {};

    // Fill variable values from flowData.variables with either values or defaults
    flowData.variables.forEach((variable) => {
      // If variable has a value, use it
      if (variable.value !== undefined && variable.value !== null) {
        variableValues[variable.name] = variable.value;
      }
      // Otherwise use default value if available
      else if (variable.defaultValue !== undefined && variable.defaultValue !== null) {
        variableValues[variable.name] = variable.defaultValue;
        // Also set as current value
        variable.value = variable.defaultValue;
      }
    });

    // Log the variables for debugging
    addLog('debug', 'Flow variables prepared', JSON.stringify(variableValues, null, 2));
  }

  // Check if all required variables have values
  function checkRequiredVariables(): boolean {
    // Clear the missing values array
    variablesWithMissingValues = [];

    // Check each variable
    flowData.variables.forEach((variable) => {
      if (
        variable.required &&
        (variable.value === undefined || variable.value === null) &&
        (variable.defaultValue === undefined || variable.defaultValue === null)
      ) {
        variablesWithMissingValues.push({ ...variable });
      }
    });

    // Return true if no missing values
    return variablesWithMissingValues.length === 0;
  }

  // Function to handle variable input form submission
  function handleVariableFormSubmit() {
    // Update the variable values
    variablesWithMissingValues.forEach((variable) => {
      // Find the corresponding variable in flowData.variables
      const originalVar = flowData.variables.find((v) => v.name === variable.name);
      if (originalVar) {
        originalVar.value = variable.value;
        variableValues[variable.name] = variable.value;
      }
    });

    // Close the modal
    showVariableInputModal = false;

    // Continue with flow execution
    executeFlowAfterVariableCheck();
  }

  // Handle saving a variable from the form
  function handleSaveVariable(variable: ExtendedFlowVariable) {
    console.log('Saving variable:', variable);
    console.log('Current variables:', flowData.variables);

    // Ensure variables array exists
    if (!flowData.variables) {
      flowData.variables = [];
    }

    // Check for duplicate name when adding a new variable
    if (variable.isNew && flowData.variables.some((v) => v.name === variable.name)) {
      alert('A variable with this name already exists.');
      return false;
    }

    // Remove old variable if editing
    if (!variable.isNew) {
      flowData.variables = flowData.variables.filter((v) => v.name !== variable.name);
    }

    // Add the new or updated variable
    const newVar = {
      name: variable.name,
      type: variable.type || 'string',
      value: variable.value,
      defaultValue: variable.defaultValue,
      description: variable.description,
      required: variable.required === true
    };

    // Create a new array to ensure reactivity
    const newVariables = [...flowData.variables, newVar];

    // Update flowData with the new variables array
    flowData = {
      ...flowData,
      variables: newVariables
    };

    console.log('Updated variables:', flowData.variables);

    // Dispatch change event to notify parent components
    dispatch('change', { flowData });

    // Notify parent of variables change
    dispatch('change', { flowData });

    // Return success
    return true;
  }

  // Add, edit, or remove flow variables
  function saveVariable() {
    // Validate new variable data
    if (!newVariable.name) {
      return alert('Variable name is required');
    }

    if (editingVariable !== null) {
      // Update existing variable
      handleSaveVariable(newVariable as ExtendedFlowVariable);
      editingVariable = null;
    } else {
      // Add new variable
      handleSaveVariable({ ...newVariable, isNew: true } as ExtendedFlowVariable);
    }

    // Reset new variable state
    newVariable = {
      name: '',
      type: 'string',
      value: '',
      defaultValue: '',
      description: '',
      required: false
    };
  }

  function editVariable(variable: FlowVariable) {
    // Convert the string values
    const varValue = typeof variable.value === 'string' ? variable.value : '';
    const varDefaultValue = typeof variable.defaultValue === 'string' ? variable.defaultValue : '';

    newVariable = {
      ...variable,
      value: varValue,
      defaultValue: varDefaultValue,
      description: variable.description || ''
    };
    editingVariable = { ...variable, isNew: false } as ExtendedFlowVariable;
  }

  function removeVariable(variable: FlowVariable) {
    console.log('Removing variable:', variable);
    console.log('Before removal:', flowData.variables);

    // Ensure the variables array exists
    if (!flowData.variables) {
      return;
    }

    // Create new array without the removed variable
    const updatedVariables = flowData.variables.filter((v) => v.name !== variable.name);

    // Update the whole flowData object to ensure reactivity
    flowData = {
      ...flowData,
      variables: updatedVariables
    };

    console.log('After removal:', flowData.variables);

    // Dispatch change event to notify parent components
    dispatch('change', { flowData });

    console.log('After removal:', flowData.variables);

    // Notify parent of variables change
    dispatch('change', { flowData });
  }

  // Update variable values when flowData.variables change
  $: {
    variableValues = {};
    if (flowData.variables) {
      flowData.variables.forEach((variable) => {
        variableValues[variable.name] =
          variable.value !== undefined ? variable.value : variable.defaultValue;
      });
    }
  }

  // Debug variable reactivity
  $: if (flowData && flowData.variables) {
    console.log('FlowRunner: flowData.variables updated', flowData.variables);
  }

  // Add debugging to see if variable updates are being triggered
</script>

<!-- Variable Input Modal - Only shown when required variables are missing -->
{#if showVariableInputModal}
  <div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
    <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-lg font-medium">Required Variables</h3>
        <button
          class="text-gray-500 hover:text-gray-700"
          on:click={() => (showVariableInputModal = false)}
          aria-label="Close modal"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <p class="mb-4 text-sm text-gray-600">The following variables need values to run the flow:</p>

      <div class="mb-6 max-h-96 overflow-y-auto">
        {#each variablesWithMissingValues as variable (variable.name)}
          <div class="mb-4">
            <label
              for={`var-${variable.name}`}
              class="mb-1 block text-sm font-medium text-gray-700"
            >
              {variable.name}
              {variable.required ? '*' : ''}
            </label>

            {#if variable.description}
              <p class="mb-2 text-xs text-gray-500">{variable.description}</p>
            {/if}

            {#if variable.type === 'string'}
              <input
                id={`var-${variable.name}`}
                type="text"
                class="block w-full rounded-md border border-gray-300 p-2 shadow-sm"
                bind:value={variable.value}
              />
            {:else if variable.type === 'number'}
              <input
                id={`var-${variable.name}`}
                type="number"
                class="block w-full rounded-md border border-gray-300 p-2 shadow-sm"
                bind:value={variable.value}
              />
            {:else if variable.type === 'boolean'}
              <label class="flex items-center" for={`var-${variable.name}`}>
                <input
                  id={`var-${variable.name}`}
                  type="checkbox"
                  class="h-4 w-4 rounded border-gray-300 text-blue-600"
                  checked={Boolean(variable.value)}
                  on:change={(e) => (variable.value = e.currentTarget.checked)}
                />
                <span class="ml-2 text-sm">Enabled</span>
              </label>
            {:else if variable.type === 'object' || variable.type === 'array'}
              <div>
                <textarea
                  id={`var-${variable.name}`}
                  class="block w-full rounded-md border border-gray-300 p-2 font-mono shadow-sm"
                  rows="4"
                  value={variable.value ? JSON.stringify(variable.value, null, 2) : ''}
                  on:input={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    try {
                      variable.value = JSON.parse(target.value);
                    } catch (_error: unknown) {
                      // Don't update if invalid JSON
                    }
                  }}
                ></textarea>
                <p class="mt-1 text-xs text-gray-500">Enter a valid JSON {variable.type}</p>
              </div>
            {:else}
              <div class="rounded-md bg-gray-100 p-2">
                <span class="text-gray-700 italic">No input required for {variable.type} type</span>
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <div class="flex justify-end space-x-3">
        <button
          class="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          on:click={() => (showVariableInputModal = false)}
        >
          Cancel
        </button>
        <button
          class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          on:click={handleVariableFormSubmit}
        >
          Run Flow
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Variables Management Panel - Sliding panel for adding/editing variables -->
{#if showVariablesPanel}
  <div
    class="fixed top-0 right-0 bottom-0 z-50 h-full w-96 overflow-auto border-l border-gray-200 bg-white p-6 shadow-xl"
  >
    <div class="mb-4 flex items-center justify-between">
      <h3 class="text-lg font-semibold">Flow Variables</h3>
      <button
        class="rounded-full p-2 hover:bg-gray-200"
        on:click={() => (showVariablesPanel = false)}
        aria-label="Close variables panel"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>

    <!-- Variables List -->
    <div class="mb-4">
      <div class="mb-2 flex justify-between">
        <h4 class="font-medium">Defined Variables</h4>
        <button
          class="rounded bg-blue-600 px-2 py-1 text-sm text-white hover:bg-blue-700"
          on:click={() => {
            editingVariable = {
              name: '',
              type: 'string',
              value: undefined,
              defaultValue: undefined,
              description: '',
              required: false,
              isNew: true
            };
          }}
        >
          Add Variable
        </button>
      </div>

      {#if flowData.variables && flowData.variables.length > 0}
        {@const varCount = flowData.variables.length}
        <div class="mb-2 bg-blue-50 p-2 text-sm">
          Found {varCount} variable{varCount !== 1 ? 's' : ''}
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 text-gray-600">
              <tr>
                <th class="px-2 py-1 text-left">Name</th>
                <th class="px-2 py-1 text-left">Type</th>
                <th class="px-2 py-1 text-left">Required</th>
                <th class="px-2 py-1 text-left">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              {#each flowData.variables as variable (variable.name)}
                <tr class="hover:bg-gray-50">
                  <td class="px-2 py-2">{variable.name}</td>
                  <td class="px-2 py-2">{variable.type || 'string'}</td>
                  <td class="px-2 py-2">{variable.required ? 'Yes' : 'No'}</td>
                  <td class="space-x-1 px-2 py-2">
                    <button
                      class="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200"
                      on:click={() => editVariable(variable)}
                    >
                      Edit
                    </button>
                    <button
                      class="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200"
                      on:click={() => removeVariable(variable)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <div class="rounded-md border border-gray-200 bg-gray-50 p-4 text-center">
          <p class="text-gray-500">No variables defined yet. Add a variable to get started.</p>
        </div>
      {/if}
    </div>

    <!-- Variable Editor Form -->
    {#if editingVariable !== null}
      {@const variable = editingVariable}
      <div class="rounded-md border border-gray-200 bg-gray-50 p-4">
        <h4 class="mb-2 font-medium">
          {variable.isNew ? 'Add New Variable' : 'Edit Variable'}
        </h4>
        <form
          on:submit|preventDefault={() => {
            if (handleSaveVariable(variable)) {
              editingVariable = null;
            }
          }}
        >
          <div class="mb-2">
            <label for="var-name" class="mb-1 block text-sm font-medium">Name</label>
            <input
              id="var-name"
              type="text"
              class="input input-sm input-bordered w-full"
              bind:value={variable.name}
              required
            />
          </div>

          <div class="mb-2">
            <label for="var-type" class="mb-1 block text-sm font-medium">Type</label>
            <select
              id="var-type"
              class="select select-sm select-bordered w-full"
              bind:value={variable.type}
            >
              <option value="string">String</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
              <option value="object">Object</option>
              <option value="array">Array</option>
              <option value="null">Null</option>
            </select>
          </div>

          <div class="mb-2">
            <label for="var-default" class="mb-1 block text-sm font-medium">Default Value</label>
            {#if variable.type === 'string'}
              <input
                id="var-default"
                type="text"
                class="input input-sm input-bordered w-full"
                bind:value={variable.defaultValue}
              />
            {:else if variable.type === 'number'}
              <input
                id="var-default"
                type="number"
                class="input input-sm input-bordered w-full"
                bind:value={variable.defaultValue}
              />
            {:else if variable.type === 'boolean'}
              <select
                id="var-default"
                class="select select-sm select-bordered w-full"
                bind:value={variable.defaultValue}
              >
                <option value={undefined}>No default</option>
                <option value={true}>True</option>
                <option value={false}>False</option>
              </select>
            {:else if variable.type === 'object' || variable.type === 'array'}
              <textarea
                id="var-default"
                class="textarea textarea-sm textarea-bordered h-20 w-full"
                placeholder="Enter valid JSON"
                bind:value={variable.defaultValue}
              ></textarea>
            {:else}
              <input
                id="var-default"
                type="text"
                class="input input-sm input-bordered w-full"
                disabled
                value="null"
              />
            {/if}
          </div>

          <div class="mb-2">
            <label for="var-description" class="mb-1 block text-sm font-medium">Description</label>
            <textarea
              id="var-description"
              class="textarea textarea-sm textarea-bordered w-full"
              bind:value={variable.description}
            ></textarea>
          </div>

          <div class="mb-4">
            <label class="flex items-center">
              <input
                type="checkbox"
                class="checkbox checkbox-sm"
                bind:checked={variable.required}
              />
              <span class="ml-2 text-sm">Required</span>
            </label>
          </div>

          <div class="flex justify-end space-x-2">
            <button
              type="button"
              class="btn btn-sm btn-ghost"
              on:click={() => {
                editingVariable = null;
              }}
            >
              Cancel
            </button>
            <button type="submit" class="btn btn-sm btn-primary">Save</button>
          </div>
        </form>
      </div>
    {/if}
  </div>
{/if}

<!-- Only show these controls if showButtons is true (independent mode) -->
{#if showButtons !== false}
  <div class="mb-4 flex justify-between">
    <div class="space-x-2">
      <button
        class="btn btn-primary"
        disabled={isRunning || !flowData.steps.length}
        on:click={() => runFlow()}
      >
        {#if isRunning}
          Running...
        {:else}
          Run Flow
        {/if}
      </button>
      <button
        class="btn btn-outline"
        on:click={() => (showVariablesPanel = !showVariablesPanel)}
        class:btn-active={showVariablesPanel}
      >
        {showVariablesPanel ? 'Hide Variables' : 'Variables'}
      </button>
    </div>
    {#if currentStep !== null}
      <button class="btn btn-outline btn-error" on:click={() => stopExecution()}>Stop</button>
    {/if}
  </div>
{/if}
