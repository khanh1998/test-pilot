<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { TestFlowData, FlowParameter, ExecutionState, FlowStep, StepEndpoint } from './types';

  // Props
  export let flowData: TestFlowData = {
    parameters: [],
    settings: { 
      api_hosts: {}
    },
    steps: [],
    assertions: []
  }; // The complete test flow data
  export let isRunning: boolean = false; // Whether the flow is currently running
  export let executionState: ExecutionState = {}; // Execution state for each endpoint

  // Extended FlowParameter type with isNew property
  interface ExtendedFlowParameter extends FlowParameter {
    isNew?: boolean;
  }

  // Parameter input modal state
  let showParameterInputModal = false;
  let parametersWithMissingValues: Array<FlowParameter> = [];

  // Parameters management panel
  export let showParametersPanel = false;

  // Control visibility of buttons - set to false when used by TestFlowEditor
  export let showButtons = true;

  let editingParameter: null | ExtendedFlowParameter = null;

  // Computed Parameter values for template resolution
  let parameterValues: Record<string, unknown> = {};

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
  

  // Parameters panel state
  let newParameter = {
    name: '',
    type: 'string' as 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null',
    value: '',
    defaultValue: '',
    description: '',
    required: false
  };

  import {
	executeDirectEndpoint,
	executeProxiedEndpoint,
	type RequestCookie
} from '$lib/http_client/test-flow';

  // Cookie management
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
    dispatch('log', { level, message, details });
  }

  // Initialize when component mounts
  $: if (flowData && flowData.steps) {
    totalSteps = flowData.steps.length;
  }

  // No need to check apiHost anymore as we only use api_hosts

  // Ensure endpoints are available
  $: if (!flowData.endpoints) {
    flowData.endpoints = [];
    console.warn('No endpoints provided in flowData. The flow may not execute correctly.');
  }

  // Ensure parameters array exists
  $: if (!flowData.parameters) {
    console.log('Initializing empty parameters array');
    flowData.parameters = [];
  }

  // Log whenever parameters change
  $: console.log('Parameters in flowData:', flowData.parameters);

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

    // Validate that at least one API host is configured
    const hasApiHosts = flowData.settings && 
      flowData.settings.api_hosts && 
      Object.values(flowData.settings.api_hosts).some(host => host.url && host.url.trim() !== '');
    
    if (!hasApiHosts) {
      error = new Error(
        'No API Hosts are configured. Please configure at least one API host before running the flow.'
      );
      dispatch('error', { message: 'No API Hosts are configured' });
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

    // Validate that at least one API host is configured
    const hasApiHosts = flowData.settings && 
      flowData.settings.api_hosts && 
      Object.values(flowData.settings.api_hosts).some(host => host.url && host.url.trim() !== '');
    
    if (!hasApiHosts) {
      error = new Error(
        'No API Hosts are configured. Please configure at least one API host before running the flow.'
      );
      isRunning = false;
      dispatch('executionComplete', {
        success: false,
        error,
        storedResponses
      });
      return;
    }

    // Prepare parameters and check if all required parameters have values
    prepareParameters();
    if (!checkRequiredParameters()) {
      // Show the Parameter input modal if there are missing required values
      addLog(
        'info',
        'Required parameters need input',
        `${parametersWithMissingValues.length} required Parameter(s) need values`
      );
      showParameterInputModal = true;
      return;
    }

    // All parameters are ready, execute the flow
    executeFlowAfterParameterCheck();
  }

  // Execute flow after Parameter check
  async function executeFlowAfterParameterCheck() {
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
        parameterValues: parameterValues
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
      
      // Get the API host for this endpoint
      let endpointHost = '';
      
      // Get host from api_hosts using endpoint's api_id
      if (endpoint.api_id && flowData.settings && flowData.settings.api_hosts) {
        const apiHostInfo = flowData.settings.api_hosts[endpoint.api_id];
        if (apiHostInfo && apiHostInfo.url) {
          endpointHost = apiHostInfo.url;
          addLog('debug', `Using host for API ID ${endpoint.api_id}: ${endpointHost}`);
        } else {
          addLog('warning', `API host not found for ID: ${endpoint.api_id}`);
        }
      }
      
      if (!endpointHost) {
        addLog('error', 'No API host available for endpoint', `Endpoint ID: ${endpoint.endpoint_id}`);
        throw new Error(`No API host available for endpoint ${endpoint.endpoint_id}`);
      }
      
      // Build the URL with path parameters
      let url = endpointHost + endpointDef.path;

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

      // Add request debug logs
      addRequestDebugLogs(endpointDef.path, headers);

      // Make the request
      let response;

      if (preferences.serverCookieHandling) {
        // Use server proxy for cookie handling
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
        addLog(
          'debug',
          `Sending ${requestCookies.length} cookies with request`,
          `Target domain: ${domain}`
        );

        const proxiedResult = await executeProxiedEndpoint(
          endpointDef,
          url,
          headers,
          body,
          requestCookies,
          preferences.timeout
        );

        response = proxiedResult.response;
        const responseCookies = proxiedResult.cookies;

        // Store cookies from the response
        if (responseCookies && responseCookies.length > 0) {
          const endpointKey = endpointId;
          cookieStore.set(
            endpointKey,
            responseCookies.map((c: RequestCookie) => ({
              name: c.name,
              value: c.value,
              domain: c.domain || targetUrl.hostname,
              path: c.path
            }))
          );
          
        }

        addLog(
          'info',
          'Request proxied through server for cookie handling',
          `Original URL: ${url}\nProxy URL: /api/proxy/request`
        );
      } else {
        // Direct fetch without proxy
        response = await executeDirectEndpoint(
          endpointDef,
          url,
          headers,
          body,
          preferences.timeout
        );
      }

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
      
      // Log the stored response for debugging
      addLog(
        'debug',
        `Stored response for endpoint: ${endpointId}`,
        `Response data type: ${responseData ? typeof responseData : 'undefined'}`
      );

      // Also store with custom name if requested
      if (endpoint.store_response_as) {
        storedResponses[endpoint.store_response_as] = responseData;
        addLog(
          'info',
          `Also stored response as: ${endpoint.store_response_as}`,
          `This can be referenced in templates as: {{res:${endpoint.store_response_as}}}`
        );
      }
      
      // Debug log all stored responses
      addLog(
        'debug', 
        'Currently stored responses:', 
        `Available keys: ${JSON.stringify(Object.keys(storedResponses))}`
      );

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
    
    parameterValues = {}; // Clear Parameter values
    showParameterInputModal = false; // Close the Parameter input modal

    // Reset cookies if user wants to start fresh
    if (preferences.serverCookieHandling) {
      cookieStore.clear();
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

      addLog(
        'debug',
        'Response content type:',
        contentType || 'No content-type header'
      );

      // Handle different content types
      if (contentType.includes('application/json')) {
        data = await response.json();
        addLog('debug', 'Response parsed as JSON');
      } else if (contentType.includes('text/html')) {
        data = await response.text();
        addLog('debug', 'Response parsed as HTML');
      } else if (contentType.includes('text/')) {
        data = await response.text();
        addLog('debug', 'Response parsed as text');
      } else if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
        data = await response.text();
        addLog('debug', 'Response parsed as XML');
      } else {
        // Try to parse as JSON first
        try {
          data = await response.json();
          addLog('debug', 'Response auto-detected as JSON');
        } catch (_e: unknown) {
          // Then try as text
          data = await response.text();
          addLog('debug', 'Response auto-detected as text');
        }
      }

      return data;
    } catch (_error: unknown) {
      addLog(
        'error',
        'Failed to parse response:',
        _error instanceof Error ? _error.message : String(_error)
      );
      return 'Unable to parse response data';
    }
  }

  import * as templateFunctionsModule from './templateFunctions';

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
    try {
      // First verify that we have a valid expression with a source and path
      if (!expression || expression.indexOf(':') === -1) {
        addLog(
          'warning',
          `Invalid template expression: ${expression}`,
          `Expression must be in format 'source:path'`
        );
        return originalMatch;
      }
      
      const [source, path] = expression.trim().split(':', 2);
      
      if (!path || path.trim() === '') {
        addLog(
          'warning', 
          `Missing path in template expression: ${expression}`,
          `Expression must include a path after the colon`
        );
        return originalMatch;
      }

      switch (source.trim()) {
        case 'res':
          // Handle res:stepId-endpointIndex.jsonpath
          return resolveResponseTemplate(path.trim(), storedData);

        case 'func':
          // Handle func:functionName(arg1,arg2,...)
          return resolveFunctionTemplate(path.trim());

        case 'param':
          // Handle param:parameter_name
          return resolveParameterTemplate(path.trim());

        default:
          addLog(
            'warning',
            `Unknown template source: ${source}`,
            `Valid sources are: 'res', 'func', and 'var'`
          );
          return originalMatch; // Keep original template if source is unknown
      }
    } catch (error: unknown) {
      addLog(
        'error',
        `Error processing template expression: ${expression}`,
        error instanceof Error ? error.message : String(error)
      );
      return originalMatch;
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
    // Fixed: Store the result of replace() back into the value Parameter
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
      
      // Log available keys to help debug
      const availableKeys = Object.keys(storedData);
      addLog(
        'warning',
        `Response data not found for: ${stepEndpointId}`,
        `Available response keys: ${JSON.stringify(availableKeys)}`
      );
      
      return `{res:${path}}`;
    }

    // Apply JSONPath if specified
    if (jsonPathExpr) {
      try {
        const result = templateFunctions.jsonPath(responseData, jsonPathExpr);
        return result !== undefined ? String(result) : `{res:${path}}`;
      } catch (error: unknown) {
        console.error(`Error applying JSONPath '${jsonPathExpr}' to response:`, error);
        addLog(
          'error',
          `Error applying JSONPath to response`,
          `Path: ${jsonPathExpr}\nError: ${error instanceof Error ? error.message : String(error)}`
        );
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

  // Helper function to resolve Parameter templates like var:Parameter_name
  function resolveParameterTemplate(parameterName: string): string {
    if (Object.prototype.hasOwnProperty.call(parameterValues, parameterName)) {
      const value = parameterValues[parameterName];
      const result = value !== null && value !== undefined ? String(value) : '';

      // Add to logs for debugging
      addLog('debug', `Parameter substitution: ${parameterName}`, `Value: ${result}`);

      return result;
    }
    console.warn(`Parameter not found: ${parameterName}`);
    return `{var:${parameterName}}`;
  }

  // Function for adding debug logs about requests
  function addRequestDebugLogs(path: string, reqHeaders: Record<string, string>) {
    
  }

  // Function to prepare parameters before executing the flow
  function prepareParameters() {
    // Reset parameters values store
    parameterValues = {};

    // Fill Parameter values from flowData.parameters with either values or defaults
    flowData.parameters.forEach((parameter) => {
      // If Parameter has a value, use it
      if (parameter.value !== undefined && parameter.value !== null) {
        parameterValues[parameter.name] = parameter.value;
      }
      // Otherwise use default value if available
      else if (parameter.defaultValue !== undefined && parameter.defaultValue !== null) {
        parameterValues[parameter.name] = parameter.defaultValue;
        // Also set as current value
        parameter.value = parameter.defaultValue;
      }
    });

    // Log the parameters for debugging
    addLog('debug', 'Flow Parameters prepared', JSON.stringify(parameterValues, null, 2));
  }

  // Check if all required parameters have values
  function checkRequiredParameters(): boolean {
    // Clear the missing values array
    parametersWithMissingValues = [];

    // Check each Parameter
    flowData.parameters.forEach((parameter) => {
      if (
        parameter.required &&
        (parameter.value === undefined || parameter.value === null) &&
        (parameter.defaultValue === undefined || parameter.defaultValue === null)
      ) {
        parametersWithMissingValues.push({ ...parameter });
      }
    });

    // Return true if no missing values
    return parametersWithMissingValues.length === 0;
  }

  // Function to handle Parameter input form submission
  function handleParameterFormSubmit() {
    // Update the Parameter values
    parametersWithMissingValues.forEach((parameter) => {
      // Find the corresponding Parameter in flowData.parameters
      const originalVar = flowData.parameters.find((v) => v.name === parameter.name);
      if (originalVar) {
        originalVar.value = parameter.value;
        parameterValues[parameter.name] = parameter.value;
      }
    });

    // Close the modal
    showParameterInputModal = false;

    // Continue with flow execution
    executeFlowAfterParameterCheck();
  }

  // Handle saving a Parameter from the form
  function handleSaveParameter(parameter: ExtendedFlowParameter) {
    console.log('Saving Parameter:', parameter);
    console.log('Current parameters:', flowData.parameters);

    // Ensure parameters array exists
    if (!flowData.parameters) {
      flowData.parameters = [];
    }

    // Check for duplicate name when adding a new Parameter
    if (parameter.isNew && flowData.parameters.some((v) => v.name === parameter.name)) {
      alert('A Parameter with this name already exists.');
      return false;
    }

    // Remove old Parameter if editing
    if (!parameter.isNew) {
      flowData.parameters = flowData.parameters.filter((v) => v.name !== parameter.name);
    }

    // Add the new or updated Parameter
    const newVar = {
      name: parameter.name,
      type: parameter.type || 'string',
      value: parameter.value,
      defaultValue: parameter.defaultValue,
      description: parameter.description,
      required: parameter.required === true
    };

    // Create a new array to ensure reactivity
    const newParameters = [...flowData.parameters, newVar];

    // Update flowData with the new parameters array
    flowData = {
      ...flowData,
      parameters: newParameters
    };

    console.log('Updated parameters:', flowData.parameters);

    // Dispatch change event to notify parent components
    dispatch('change', { flowData });

    // Notify parent of parameters change
    dispatch('change', { flowData });

    // Return success
    return true;
  }

  function editParameter(parameter: FlowParameter) {
    // Convert the string values
    const varValue = typeof parameter.value === 'string' ? parameter.value : '';
    const varDefaultValue = typeof parameter.defaultValue === 'string' ? parameter.defaultValue : '';

    newParameter = {
      ...parameter,
      value: varValue,
      defaultValue: varDefaultValue,
      description: parameter.description || ''
    };
    editingParameter = { ...parameter, isNew: false } as ExtendedFlowParameter;
  }

  function removeParameter(parameter: FlowParameter) {
    console.log('Removing Parameter:', parameter);
    console.log('Before removal:', flowData.parameters);

    // Ensure the parameters array exists
    if (!flowData.parameters) {
      return;
    }

    // Create new array without the removed Parameter
    const updatedParameters = flowData.parameters.filter((v) => v.name !== parameter.name);

    // Update the whole flowData object to ensure reactivity
    flowData = {
      ...flowData,
      parameters: updatedParameters
    };

    console.log('After removal:', flowData.parameters);

    // Dispatch change event to notify parent components
    dispatch('change', { flowData });

    console.log('After removal:', flowData.parameters);

    // Notify parent of parameters change
    dispatch('change', { flowData });
  }

  // Update Parameter values when flowData.parameters change
  $: {
    parameterValues = {};
    if (flowData.parameters) {
      flowData.parameters.forEach((parameter) => {
        parameterValues[parameter.name] =
          parameter.value !== undefined ? parameter.value : parameter.defaultValue;
      });
    }
  }

  // Debug Parameter reactivity
  $: if (flowData && flowData.parameters) {
    console.log('FlowRunner: flowData.parameters updated', flowData.parameters);
  }

  // Add debugging to see if Parameter updates are being triggered
</script>

<!-- Parameter Input Modal - Only shown when required parameters are missing -->
{#if showParameterInputModal}
  <div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
    <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-lg font-medium">Required Parameters</h3>
        <button
          class="text-gray-500 hover:text-gray-700"
          on:click={() => (showParameterInputModal = false)}
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

      <p class="mb-4 text-sm text-gray-600">The following parameters need values to run the flow:</p>

      <div class="mb-6 max-h-96 overflow-y-auto">
        {#each parametersWithMissingValues as parameter (parameter.name)}
          <div class="mb-4">
            <label
              for={`var-${parameter.name}`}
              class="mb-1 block text-sm font-medium text-gray-700"
            >
              {parameter.name}
              {parameter.required ? '*' : ''}
            </label>

            {#if parameter.description}
              <p class="mb-2 text-xs text-gray-500">{parameter.description}</p>
            {/if}

            {#if parameter.type === 'string'}
              <input
                id={`var-${parameter.name}`}
                type="text"
                class="block w-full rounded-md border border-gray-300 p-2 shadow-sm"
                bind:value={parameter.value}
              />
            {:else if parameter.type === 'number'}
              <input
                id={`var-${parameter.name}`}
                type="number"
                class="block w-full rounded-md border border-gray-300 p-2 shadow-sm"
                bind:value={parameter.value}
              />
            {:else if parameter.type === 'boolean'}
              <label class="flex items-center" for={`var-${parameter.name}`}>
                <input
                  id={`var-${parameter.name}`}
                  type="checkbox"
                  class="h-4 w-4 rounded border-gray-300 text-blue-600"
                  checked={Boolean(parameter.value)}
                  on:change={(e) => (parameter.value = e.currentTarget.checked)}
                />
                <span class="ml-2 text-sm">Enabled</span>
              </label>
            {:else if parameter.type === 'object' || parameter.type === 'array'}
              <div>
                <textarea
                  id={`var-${parameter.name}`}
                  class="block w-full rounded-md border border-gray-300 p-2 font-mono shadow-sm"
                  rows="4"
                  value={parameter.value ? JSON.stringify(parameter.value, null, 2) : ''}
                  on:input={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    try {
                      parameter.value = JSON.parse(target.value);
                    } catch (_error: unknown) {
                      // Don't update if invalid JSON
                    }
                  }}
                ></textarea>
                <p class="mt-1 text-xs text-gray-500">Enter a valid JSON {parameter.type}</p>
              </div>
            {:else}
              <div class="rounded-md bg-gray-100 p-2">
                <span class="text-gray-700 italic">No input required for {parameter.type} type</span>
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <div class="flex justify-end space-x-3">
        <button
          class="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          on:click={() => (showParameterInputModal = false)}
        >
          Cancel
        </button>
        <button
          class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          on:click={handleParameterFormSubmit}
        >
          Run Flow
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Parameters Management Panel - Sliding panel for adding/editing parameters -->
{#if showParametersPanel}
  <div
    class="fixed top-0 right-0 bottom-0 z-50 h-full w-96 overflow-auto border-l border-gray-200 bg-white p-6 shadow-xl"
  >
    <div class="mb-4 flex items-center justify-between">
      <h3 class="text-lg font-semibold">Flow Parameters</h3>
      <button
        class="rounded-full p-2 hover:bg-gray-200"
        on:click={() => (showParametersPanel = false)}
        aria-label="Close parameters panel"
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

    <!-- Parameters List -->
    <div class="mb-4">
      <div class="mb-2 flex justify-between">
        <h4 class="font-medium">Defined Parameters</h4>
        <button
          class="rounded bg-blue-600 px-2 py-1 text-sm text-white hover:bg-blue-700"
          on:click={() => {
            editingParameter = {
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
          Add Parameter
        </button>
      </div>

      {#if flowData.parameters && flowData.parameters.length > 0}
        {@const varCount = flowData.parameters.length}
        <div class="mb-2 bg-blue-50 p-2 text-sm">
          Found {varCount} parameter{varCount !== 1 ? 's' : ''}
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
              {#each flowData.parameters as parameter (parameter.name)}
                <tr class="hover:bg-gray-50">
                  <td class="px-2 py-2">{parameter.name}</td>
                  <td class="px-2 py-2">{parameter.type || 'string'}</td>
                  <td class="px-2 py-2">{parameter.required ? 'Yes' : 'No'}</td>
                  <td class="space-x-1 px-2 py-2">
                    <button
                      class="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200"
                      on:click={() => editParameter(parameter)}
                    >
                      Edit
                    </button>
                    <button
                      class="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200"
                      on:click={() => removeParameter(parameter)}
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
          <p class="text-gray-500">No parameters defined yet. Add a parameter to get started.</p>
        </div>
      {/if}
    </div>

    <!-- Parameter Editor Form -->
    {#if editingParameter !== null}
      {@const parameter = editingParameter}
      <div class="rounded-md border border-gray-200 bg-gray-50 p-4">
        <h4 class="mb-2 font-medium">
          {parameter.isNew ? 'Add New Parameter' : 'Edit Parameter'}
        </h4>
        <form
          on:submit|preventDefault={() => {
            if (handleSaveParameter(parameter)) {
              editingParameter = null;
            }
          }}
        >
          <div class="mb-2">
            <label for="var-name" class="mb-1 block text-sm font-medium">Name</label>
            <input
              id="var-name"
              type="text"
              class="input input-sm input-bordered w-full"
              bind:value={parameter.name}
              required
            />
          </div>

          <div class="mb-2">
            <label for="var-type" class="mb-1 block text-sm font-medium">Type</label>
            <select
              id="var-type"
              class="select select-sm select-bordered w-full"
              bind:value={parameter.type}
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
            {#if parameter.type === 'string'}
              <input
                id="var-default"
                type="text"
                class="input input-sm input-bordered w-full"
                bind:value={parameter.defaultValue}
              />
            {:else if parameter.type === 'number'}
              <input
                id="var-default"
                type="number"
                class="input input-sm input-bordered w-full"
                bind:value={parameter.defaultValue}
              />
            {:else if parameter.type === 'boolean'}
              <select
                id="var-default"
                class="select select-sm select-bordered w-full"
                bind:value={parameter.defaultValue}
              >
                <option value={undefined}>No default</option>
                <option value={true}>True</option>
                <option value={false}>False</option>
              </select>
            {:else if parameter.type === 'object' || parameter.type === 'array'}
              <textarea
                id="var-default"
                class="textarea textarea-sm textarea-bordered h-20 w-full"
                placeholder="Enter valid JSON"
                bind:value={parameter.defaultValue}
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
              bind:value={parameter.description}
            ></textarea>
          </div>

          <div class="mb-4">
            <label class="flex items-center">
              <input
                type="checkbox"
                class="checkbox checkbox-sm"
                bind:checked={parameter.required}
              />
              <span class="ml-2 text-sm">Required</span>
            </label>
          </div>

          <div class="flex justify-end space-x-2">
            <button
              type="button"
              class="btn btn-sm btn-ghost"
              on:click={() => {
                editingParameter = null;
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
        on:click={() => (showParametersPanel = !showParametersPanel)}
        class:btn-active={showParametersPanel}
      >
        {showParametersPanel ? 'Hide Parameters' : 'Parameters'}
      </button>
    </div>
    {#if currentStep !== null}
      <button class="btn btn-outline btn-error" on:click={() => stopExecution()}>Stop</button>
    {/if}
  </div>
{/if}
