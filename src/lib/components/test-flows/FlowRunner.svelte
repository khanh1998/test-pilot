<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { TestFlowData, FlowParameter, ExecutionState, FlowStep, StepEndpoint } from './types';
  // Import assertion types (will be used when typing the endpoint.assertions array)
  import type { Assertion } from '$lib/assertions/types';
  import { runAssertions } from '$lib/assertions/engine';
  import { resolveTemplate, createTemplateContextFromFlowRunner, type TemplateContext } from '$lib/template';
  import FlowParameterEditor from './FlowParameterEditor.svelte';

  // Props
  export let flowData: TestFlowData = {
    parameters: [],
    settings: { 
      api_hosts: {}
    },
    steps: [],
  }; // The complete test flow data
  export let isRunning: boolean = false; // Whether the flow is currently running
  export let executionState: ExecutionState = {}; // Execution state for each endpoint

  // Parameter input modal state
  let showParameterInputModal = false;
  let parametersWithMissingValues: Array<FlowParameter> = [];

  // Parameters management panel
  export let showParametersPanel = false;

  // Control visibility of buttons - set to false when used by TestFlowEditor
  export let showButtons = true;

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
  let storedTransformations: Record<string, Record<string, unknown>> = {}; // Stores transformed values by endpoint id and alias
  

  // Parameters panel state
  let newParameter = {
    name: '',
    type: 'string' as 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null',
    value: '',
    defaultValue: '',
    description: '',
    required: false
  };

  import { isDesktop } from '$lib/environment';
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
    flowData.parameters = [];
  }  $: console.log('flow data', flowData);

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
    if (!validateApiHosts()) {
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
    if (!validateApiHosts()) {
      error = new Error(
        'No API Hosts are configured. Please configure at least one API host before running the flow.'
      );
      isRunning = false;
      dispatch('executionComplete', {
        success: false,
        error,
        storedResponses,
        parameterValues,
        transformResponse,
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
        parameterValues,
        transformResponse,
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
    updateExecutionState(endpointId, {
      status: 'running',
      request: {},
      response: null,
      timing: 0
    });

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
            // Replace template values using centralized engine
            const resolvedValue = resolveTemplateValueUnified(value as string);
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
            const resolvedValue = resolveTemplateValueUnified(value as string);
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
            headers[h.name] = resolveTemplateValueUnified(h.value);
          });
      }

      // Prepare body
      let body = null;
      if (endpoint.body) {
        body = resolveTemplateObjectUnified(endpoint.body);
      }

      // Record the request details for debugging - create a new object for reactivity
      updateExecutionState(endpointId, {
        request: {
          url,
          method: endpointDef.method,
          headers,
          body,
          pathParams: endpoint.pathParams,
          queryParams: endpoint.queryParams
        }
      });

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
          preferences.timeout,
          cookieStore,  // Pass the cookieStore for cookie management
          endpointId    // Pass the endpointId for storage reference
        );
        
        // Check for cookies in the response if we're in desktop mode
        if (isDesktop) {
          // The cookies are already stored inside executeDirectEndpoint if in desktop mode
          addLog(
            'debug',
            `Desktop mode: cookies managed via Tauri HTTP client`,
            `Cookies for ${endpointId}: ${cookieStore.has(endpointId) ? cookieStore.get(endpointId)?.length : 0} cookies`
          );
        }
      }

      // Calculate timing - create a new object for reactivity
      const endTime = performance.now();
      const timing = Math.round(endTime - startTime);
      updateExecutionState(endpointId, { timing });

      // Process response
      const responseData = await getResponseData(response);

      

      // Store response details - create a new object for reactivity
      updateExecutionState(endpointId, {
        response: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries([...response.headers.entries()]),
          body: responseData
        }
      });

      // Always store response with endpointId for reference by templates
      storedResponses[endpointId] = responseData;
      
      // Log the stored response for debugging
      addLog(
        'debug',
        `Stored response for endpoint: ${endpointId}`,
        `Response data type: ${responseData ? typeof responseData : 'undefined'}`
      );
      
      // Debug log all stored responses
      addLog(
        'debug', 
        'Currently stored responses:', 
        `Available keys: ${JSON.stringify(Object.keys(storedResponses))}`
      );
      
      // Process transformations if configured for this endpoint
      if (endpoint.transformations && endpoint.transformations.length > 0) {
        const transformedData: Record<string, unknown> = {};
        
        try {
          // Import the transformation module
          const transformModule = await import('$lib/transform');
          
          // Phase 1 & 2: Store and evaluate transformations
          for (const transform of endpoint.transformations) {
            try {
              // Phase 1: Store the raw response under the alias
              transformedData[transform.alias] = responseData;
              
              // Phase 2: Evaluate the expression if provided
              if (transform.expression && transform.expression.trim()) {
                // Evaluate the expression using the transformation engine
                const evaluatedResult = transformModule.transformResponse(responseData, transform.expression);
                
                if (evaluatedResult !== null && evaluatedResult !== undefined) {
                  // Update with the evaluated result
                  transformedData[transform.alias] = evaluatedResult;
                  
                  addLog(
                    'debug',
                    `Applied transformation: ${transform.alias}`,
                    `Expression: ${transform.expression} evaluated successfully, value: ${JSON.stringify(evaluatedResult)}`
                  );
                } else {
                  addLog(
                    'warning',
                    `Transformation evaluation returned null/undefined: ${transform.alias}`,
                    `Expression: ${transform.expression}`
                  );
                }
              } else {
                addLog(
                  'debug',
                  `Applied transformation: ${transform.alias}`,
                  `No expression provided, using raw response`
                );
              }
            } catch (error: unknown) {
              addLog(
                'error',
                `Failed to apply transformation: ${transform.alias}`,
                `Expression: ${transform.expression}\nError: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }
        } catch (error: unknown) {
          addLog(
            'error',
            `Failed to load transformation module`,
            `Error: ${error instanceof Error ? error.message : String(error)}`
          );
          
          // Fallback to Phase 1 only if transformation module fails to load
          for (const transform of endpoint.transformations) {
            transformedData[transform.alias] = responseData;
            
            addLog(
              'debug',
              `Applied transformation (fallback): ${transform.alias}`,
              `Expression: ${transform.expression} (evaluation skipped)`
            );
          }
        }
        
        // Store all transformations for this endpoint
        storedTransformations[endpointId] = transformedData;
        
        // Also store transformations in execution state for UI access
        updateExecutionState(endpointId, {
          transformations: transformedData
        });
        
        addLog(
          'info',
          `Stored ${endpoint.transformations.length} transformations for endpoint: ${endpointId}`,
          `Available aliases: ${Object.keys(transformedData).join(', ')}`
        );
      }

      // Run assertions if configured for this endpoint
      if (endpoint.assertions && endpoint.assertions.length > 0) {
        addLog(
          'info',
          `Running ${endpoint.assertions.length} assertions for endpoint: ${endpointId}`
        );
        
        try {
          // Import the assertion engine module
          const assertionModule = await import('$lib/assertions');
          
          // Build template context for template expressions in assertions
          const templateContext = createTemplateContextFromFlowRunner(
            storedResponses,
            storedTransformations,
            parameterValues,
            templateFunctions
          );
          
          // Run all assertions
          const transformedDataForEndpoint = storedTransformations[endpointId] || null;
          const assertionResults = await assertionModule.runAssertions(
            endpoint.assertions,
            response,
            responseData,
            transformedDataForEndpoint,
            timing,
            templateContext
          );
          
          // Process the results
          for (const result of assertionResults.results) {
            // Create detailed log message with template info
            let logDetails = `Actual value: ${JSON.stringify(result.actualValue)}`;
            if (result.originalExpectedValue && result.originalExpectedValue !== result.expectedValue) {
              logDetails += `, Template: ${result.originalExpectedValue} → ${JSON.stringify(result.expectedValue)}`;
            } else {
              logDetails += `, Expected: ${JSON.stringify(result.expectedValue)}`;
            }
            
            // Log each assertion result
            addLog(
              result.passed ? 'debug' : 'error',
              result.message || '',
              logDetails
            );
            
            // Show any template resolution errors
            if (result.error) {
              addLog('error', 'Template Error:', result.error);
            }
          }
          
          // Update status based on overall assertion results
          if (!assertionResults.passed) {
            // Update execution state with failed assertion
            updateExecutionState(endpointId, {
              status: 'failed',
              error: assertionResults.failureMessage || 'Assertion failed'
            });
            
            // Set error if stopOnError is true
            if (preferences.stopOnError) {
              error = new Error(assertionResults.failureMessage || 'Assertion failed');
            }
            
            return;
          }
        } catch (error) {
          const errorMessage = `Failed to run assertions: ${error instanceof Error ? error.message : String(error)}`;
          
          // Update execution state with the error
          updateExecutionState(endpointId, {
            status: 'failed',
            error: errorMessage
          });
          
          // Set error if stopOnError is true
          if (preferences.stopOnError) {
            error = new Error(errorMessage);
          }
          
          // Log the error
          addLog('error', errorMessage);
          
          return;
        }
      }

      // Update status - create a new object for reactivity
      // Check if we should skip the default 2xx status check
      const shouldSkipDefaultCheck = endpoint.skipDefaultStatusCheck === true;
      
      if (shouldSkipDefaultCheck) {
        // When skipping default check, always mark as completed regardless of status code
        // The user will use explicit status code assertions to validate the response
        updateExecutionState(endpointId, { status: 'completed' }, true);
        addLog(
          'debug',
          `Skipped default status check for endpoint ${endpointId}`,
          `Response status: ${response.status} - using explicit assertions only`
        );
      } else if (response.ok) {
        updateExecutionState(endpointId, { status: 'completed' }, true);
      } else {
        updateExecutionState(endpointId, {
          status: 'failed',
          error: `Request failed with status ${response.status}: ${response.statusText}`
        }, true);

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
      updateExecutionState(endpointId, {
        status: 'failed',
        error: errorMessage
      });

      if (preferences.stopOnError) {
        error = err;
      }
    }

    // Final execution state update (this ensures any missed updates are emitted)
    dispatch('executionStateUpdate', executionState);
  }

  // Reset execution state
  export function resetExecution() {
    currentStep = 0;
    progress = 0;
    error = null;
    storedResponses = {};
    storedTransformations = {};
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

  import { createTemplateFunctions, defaultTemplateFunctions } from '$lib/template';
  import { transformResponse } from '$lib/transform';

  // Create template functions for use in template resolution
  const templateFunctions = createTemplateFunctions({
    responses: {},
    transformedData: {},
    parameters: {},
    functions: defaultTemplateFunctions
  });

  // Unified template resolution using centralized engine
  function resolveTemplateValueUnified(value: string): string {
    try {
      const context = createTemplateContextFromFlowRunner(
        storedResponses,
        storedTransformations,
        parameterValues,
        templateFunctions
      );
      
      const result = resolveTemplate(value, context);
      return result !== undefined && result !== null ? String(result) : '';
    } catch (error) {
      addLog('error', `Template resolution failed for "${value}"`, error instanceof Error ? error.message : String(error));
      return value; // Return original value on error
    }
  }

  // Unified template resolution for objects using centralized engine
  function resolveTemplateObjectUnified(obj: unknown): unknown {
    try {
      const context = createTemplateContextFromFlowRunner(
        storedResponses,
        storedTransformations,
        parameterValues,
        templateFunctions
      );
      
      if (obj === null || obj === undefined) {
        return obj;
      }

      let objString = JSON.stringify(obj);
      const result = resolveTemplate(objString, context);
      
      if (typeof result === 'string') {
        return JSON.parse(result);
      }
      
      return result;
    } catch (error) {
      addLog('error', 'Template object resolution failed', error instanceof Error ? error.message : String(error));
      return obj; // Return original object on error
    }
  }

  // Function for adding debug logs about requests
  function addRequestDebugLogs(path: string, reqHeaders: Record<string, string>) {
    
  }

  // Utility function to validate API hosts configuration
  function validateApiHosts(): boolean {
    return !!(flowData.settings && 
      flowData.settings.api_hosts && 
      Object.values(flowData.settings.api_hosts).some(host => host.url && host.url.trim() !== ''));
  }

  // Utility function to update execution state immutably
  function updateExecutionState(endpointId: string, updates: Partial<any>, emitEndpointUpdate: boolean = false) {
    const updatedEndpointState = {
      ...executionState[endpointId],
      ...updates
    };
    
    executionState = {
      ...executionState,
      [endpointId]: updatedEndpointState
    };
    
    // Emit execution state update event
    dispatch('executionStateUpdate', executionState);
    
    // Optionally emit specific endpoint update event
    if (emitEndpointUpdate) {
      dispatch('endpointStateUpdate', {
        endpointId,
        state: updatedEndpointState
      });
    }
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

  // Parameters management has been moved to FlowParameterEditor.svelte

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

<!-- Parameters Management Panel -->
{#if showParametersPanel}
  <FlowParameterEditor
    isOpen={showParametersPanel}
    parameters={flowData.parameters || []}
    on:save={(e) => {
      // Handle saving a parameter
      const parameter = e.detail;
      
      // Initialize parameters array if it doesn't exist
      if (!flowData.parameters) {
        flowData.parameters = [];
      }
      
      // Check if this is a new parameter or existing one
      if (parameter.isNew) {
        // Remove the isNew flag
        delete parameter.isNew;
        // Add to parameters array
        flowData.parameters = [...flowData.parameters, parameter];
      } else {
        // Update existing parameter
        const index = flowData.parameters.findIndex(p => p.name === parameter.name);
        if (index !== -1) {
          flowData.parameters[index] = parameter;
          flowData.parameters = [...flowData.parameters];
        }
      }
      
      // Dispatch change event to notify parent components
      dispatch('change', { flowData });
    }}
    on:remove={(e) => {
      // Handle removing a parameter
      const parameter = e.detail;
      flowData.parameters = flowData.parameters.filter(p => p.name !== parameter.name);
      
      // Dispatch change event to notify parent components
      dispatch('change', { flowData });
    }}
    on:close={() => (showParametersPanel = false)}
  />
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
