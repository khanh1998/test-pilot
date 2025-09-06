import type { TestFlowData, FlowStep, StepEndpoint, ExecutionState } from '$lib/components/test-flows/types';
import type { RequestCookie } from '$lib/http_client/test-flow';
import { executeDirectEndpoint, executeProxiedEndpoint } from '$lib/http_client/test-flow';
import { isDesktop } from '$lib/environment';
import { createTemplateContextFromFlowRunner, resolveTemplate } from '$lib/template';
import { createTemplateFunctions, defaultTemplateFunctions } from '$lib/template';

export interface ExecutionPreferences {
  parallelExecution: boolean;
  stopOnError: boolean;
  serverCookieHandling: boolean;
  retryCount: number;
  timeout: number;
}

export interface ExecutionContext {
  flowData: TestFlowData;
  preferences: ExecutionPreferences;
  storedResponses: Record<string, unknown>;
  storedTransformations: Record<string, Record<string, unknown>>;
  parameterValues: Record<string, unknown>;
  environmentVariables: Record<string, unknown>;
  cookieStore: Map<string, Array<RequestCookie>>;
  selectedEnvironment: import('$lib/types/environment').Environment | null;
  shouldStopExecution: boolean;
  error: unknown;
  executionState: ExecutionState;
  addLog: (level: 'info' | 'debug' | 'error' | 'warning', message: string, details?: string) => void;
  updateExecutionState: (endpointId: string, updates: Partial<any>, emitEndpointUpdate?: boolean) => void;
}

export class FlowExecutionEngine {
  private context: ExecutionContext;
  private templateFunctions: any;

  constructor(context: ExecutionContext) {
    this.context = context;
    this.templateFunctions = createTemplateFunctions({
      responses: {},
      transformedData: {},
      parameters: {},
      functions: defaultTemplateFunctions
    });
  }

  updateParameterValues(parameterValues: Record<string, unknown>): void {
    this.context.parameterValues = parameterValues;
  }

  async executeStep(step: FlowStep): Promise<void> {
    if (!step || !step.step_id) {
      console.warn('Encountered invalid step:', step);
      return;
    }

    // Clear cookies if the step has this flag enabled (do this before checking endpoints)
    if (step.clearCookiesBeforeExecution === true) {
      this.context.cookieStore.clear();
      this.context.addLog('info', `🍪 Cookies cleared before step ${step.step_id}`, 'All stored cookies removed as configured for this step - starting fresh for new user role');
    }

    if (!step.endpoints || !Array.isArray(step.endpoints) || step.endpoints.length === 0) {
      console.log(`Step ${step.step_id} has no endpoints, skipping`);
      return;
    }

    try {
      if (this.context.preferences.parallelExecution) {
        const promises = step.endpoints.map((endpoint: StepEndpoint, index: number) =>
          this.executeEndpoint(endpoint, step.step_id, index)
        );
        await Promise.all(promises);
      } else {
        for (let i = 0; i < step.endpoints.length; i++) {
          await this.executeEndpoint(step.endpoints[i], step.step_id, i);

          if (this.context.error && this.context.preferences.stopOnError) {
            break;
          }

          if (this.context.shouldStopExecution) {
            this.context.addLog('info', 'Execution stopped by user');
            break;
          }
        }
      }
    } catch (err: unknown) {
      console.error(`Error executing step ${step.step_id}:`, err);
      this.context.error = err;

      if (this.context.preferences.stopOnError) {
        throw err;
      }
    }
  }

  async executeEndpoint(endpoint: StepEndpoint, stepId: string, endpointIndex: number): Promise<void> {
    if (!endpoint || !endpoint.endpoint_id) {
      console.error('Invalid endpoint configuration', endpoint);
      return;
    }

    const endpointId = `${stepId}-${endpointIndex}`;

    this.context.updateExecutionState(endpointId, {
      status: 'running',
      request: {},
      response: null,
      timing: 0
    });

    try {
      if (!this.context.flowData.endpoints || !Array.isArray(this.context.flowData.endpoints)) {
        throw new Error(`No endpoints defined in the flow data`);
      }

      const endpointDef = this.context.flowData.endpoints.find((e) => e.id === endpoint.endpoint_id);
      if (!endpointDef) {
        throw new Error(`Endpoint definition not found for ID: ${endpoint.endpoint_id}`);
      }

      const endpointHost = this.getEndpointHost(endpoint);
      if (!endpointHost) {
        this.context.addLog('error', 'No API host available for endpoint', `Endpoint ID: ${endpoint.endpoint_id}, API ID: ${endpoint.api_id}`);
        throw new Error(`No API host available for endpoint ${endpoint.endpoint_id}`);
      }

      const { url, headers, body } = this.prepareRequest(endpointDef, endpoint, endpointHost);

      this.context.updateExecutionState(endpointId, {
        request: {
          url,
          method: endpointDef.method,
          headers,
          body,
          pathParams: endpoint.pathParams,
          queryParams: endpoint.queryParams
        }
      });

      const startTime = performance.now();
      this.addRequestDebugLogs(endpointDef.path, headers);

      const response = await this.makeRequest(endpointDef, url, headers, body, endpointId);
      
      const endTime = performance.now();
      const timing = Math.round(endTime - startTime);
      this.context.updateExecutionState(endpointId, { timing });

      const responseData = await this.getResponseData(response);

      this.context.updateExecutionState(endpointId, {
        response: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries([...response.headers.entries()]),
          body: responseData
        }
      });

      this.context.storedResponses[endpointId] = responseData;
      
      this.context.addLog(
        'debug',
        `Stored response for endpoint: ${endpointId}`,
        `Response data type: ${responseData ? typeof responseData : 'undefined'}`
      );

      await this.processTransformations(endpoint, endpointId, responseData);
      await this.processAssertions(endpoint, endpointId, response, responseData, timing);

      this.updateFinalStatus(endpoint, endpointId, response);

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.context.updateExecutionState(endpointId, {
        status: 'failed',
        error: errorMessage
      });

      if (this.context.preferences.stopOnError) {
        this.context.error = err;
      }
    }
  }

  private getEndpointHost(endpoint: StepEndpoint): string {
    let endpointHost = '';
    
    // Check environment override first
    if (this.context.selectedEnvironment && this.context.flowData.settings.environment?.subEnvironment) {
      const subEnv = this.context.flowData.settings.environment.subEnvironment;
      const subEnvironmentConfig = this.context.selectedEnvironment.config.environments[subEnv];
      
      if (subEnvironmentConfig?.api_hosts && endpoint.api_id) {
        const envHost = subEnvironmentConfig.api_hosts[String(endpoint.api_id)];
        if (envHost) {
          endpointHost = envHost;
          this.context.addLog('debug', `Using environment host override for API ID ${endpoint.api_id}: ${endpointHost}`, 
            `Environment: ${this.context.selectedEnvironment.name} (${subEnv})`);
        }
      }
    }
    
    // Fallback to flow's api_hosts
    if (!endpointHost && endpoint.api_id && this.context.flowData.settings?.api_hosts) {
      const apiHostInfo = this.context.flowData.settings.api_hosts[endpoint.api_id];
      if (apiHostInfo && apiHostInfo.url) {
        endpointHost = apiHostInfo.url;
        this.context.addLog('debug', `Using flow host for API ID ${endpoint.api_id}: ${endpointHost}`);
      } else {
        this.context.addLog('warning', `API host not found for ID: ${endpoint.api_id}`);
      }
    }
    
    return endpointHost;
  }

  private prepareRequest(endpointDef: any, endpoint: StepEndpoint, endpointHost: string) {
    let url = endpointHost + endpointDef.path;

    // Replace path parameters
    if (endpoint.pathParams && typeof endpoint.pathParams === 'object') {
      try {
        Object.entries(endpoint.pathParams).forEach(([name, value]) => {
          const resolvedValue = this.resolveTemplateValueUnified(value as string);
          url = url.replace(`{${name}}`, encodeURIComponent(resolvedValue));
        });
      } catch (err: unknown) {
        console.error('Error processing path parameters:', err);
      }
    }

    // Add query parameters
    if (endpoint.queryParams && typeof endpoint.queryParams === 'object' && Object.keys(endpoint.queryParams).length > 0) {
      try {
        const queryParams = new URLSearchParams();
        Object.entries(endpoint.queryParams).forEach(([name, value]) => {
          const resolvedValue = this.resolveTemplateValueUnified(value as string);
          
          // Check if this parameter is an array parameter in the endpoint definition
          const paramDefinition = endpointDef.parameters?.find((p: any) => p.name === name && p.in === 'query');
          
          if (paramDefinition && (paramDefinition.schema?.type === 'array' || paramDefinition.type === 'array')) {
            // Handle array parameter serialization
            const arrayValues = this.parseArrayParameter(resolvedValue, paramDefinition);
            this.serializeArrayParameter(queryParams, name, arrayValues, paramDefinition);
          } else {
            // Handle as single value parameter
            queryParams.append(name, resolvedValue);
          }
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
          headers[h.name] = this.resolveTemplateValueUnified(h.value);
        });
    }

    // Prepare body
    let body = null;
    if (endpoint.body) {
      body = this.resolveTemplateObjectUnified(endpoint.body);
    }

    return { url, headers, body };
  }

  private async makeRequest(endpointDef: any, url: string, headers: Record<string, string>, body: any, endpointId: string): Promise<Response> {
    if (this.context.preferences.serverCookieHandling) {
      return await this.makeProxiedRequest(endpointDef, url, headers, body, endpointId);
    } else {
      return await this.makeDirectRequest(endpointDef, url, headers, body, endpointId);
    }
  }

  private async makeProxiedRequest(endpointDef: any, url: string, headers: Record<string, string>, body: any, endpointId: string): Promise<Response> {
    const targetUrl = new URL(url);
    const domain = targetUrl.hostname;

    let requestCookies: RequestCookie[] = [];

    for (const [_key, cookies] of this.context.cookieStore.entries()) {
      if (cookies.length > 0) {
        for (const cookie of cookies) {
          if (cookie.value.length > 0) {
            requestCookies.push(cookie);
          }
        }
      }
    }

    this.context.addLog('debug', `Sending ${requestCookies.length} cookies with request`, `Target domain: ${domain}`);

    const proxiedResult = await executeProxiedEndpoint(
      endpointDef,
      url,
      headers,
      body,
      requestCookies,
      this.context.preferences.timeout
    );

    const response = proxiedResult.response;
    const responseCookies = proxiedResult.cookies;

    if (responseCookies && responseCookies.length > 0) {
      this.context.cookieStore.set(
        endpointId,
        responseCookies.map((c: RequestCookie) => ({
          name: c.name,
          value: c.value,
          domain: c.domain || targetUrl.hostname,
          path: c.path
        }))
      );
    }

    this.context.addLog('info', 'Request proxied through server for cookie handling', 
      `Original URL: ${url}\nProxy URL: /api/proxy/request`);

    return response;
  }

  private async makeDirectRequest(endpointDef: any, url: string, headers: Record<string, string>, body: any, endpointId: string): Promise<Response> {
    const response = await executeDirectEndpoint(
      endpointDef,
      url,
      headers,
      body,
      this.context.preferences.timeout,
      this.context.cookieStore,
      endpointId
    );

    if (isDesktop) {
      this.context.addLog('debug', `Desktop mode: cookies managed via Tauri HTTP client`,
        `Cookies for ${endpointId}: ${this.context.cookieStore.has(endpointId) ? this.context.cookieStore.get(endpointId)?.length : 0} cookies`);
    }

    return response;
  }

  private async processTransformations(endpoint: StepEndpoint, endpointId: string, responseData: unknown): Promise<void> {
    if (!endpoint.transformations || endpoint.transformations.length === 0) {
      return;
    }

    const transformedData: Record<string, unknown> = {};

    try {
      const transformModule = await import('$lib/transform');

      for (const transform of endpoint.transformations) {
        try {
          transformedData[transform.alias] = responseData;

          if (transform.expression && transform.expression.trim()) {
            const templateContext = createTemplateContextFromFlowRunner(
              this.context.storedResponses,
              this.context.storedTransformations,
              this.context.parameterValues,
              this.templateFunctions,
              this.context.environmentVariables
            );

            const evaluatedResult = transformModule.transformResponse(responseData, transform.expression, templateContext);

            if (evaluatedResult !== null && evaluatedResult !== undefined) {
              transformedData[transform.alias] = evaluatedResult;
              this.context.addLog('debug', `Applied transformation: ${transform.alias}`,
                `Expression: ${transform.expression} evaluated successfully, value: ${JSON.stringify(evaluatedResult)}`);
            } else {
              this.context.addLog('warning', `Transformation evaluation returned null/undefined: ${transform.alias}`,
                `Expression: ${transform.expression}`);
            }
          } else {
            this.context.addLog('debug', `Applied transformation: ${transform.alias}`, `No expression provided, using raw response`);
          }
        } catch (error: unknown) {
          this.context.addLog('error', `Failed to apply transformation: ${transform.alias}`,
            `Expression: ${transform.expression}\nError: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } catch (error: unknown) {
      this.context.addLog('error', `Failed to load transformation module`,
        `Error: ${error instanceof Error ? error.message : String(error)}`);

      for (const transform of endpoint.transformations) {
        transformedData[transform.alias] = responseData;
        this.context.addLog('debug', `Applied transformation (fallback): ${transform.alias}`,
          `Expression: ${transform.expression} (evaluation skipped)`);
      }
    }

    this.context.storedTransformations[endpointId] = transformedData;
    this.context.updateExecutionState(endpointId, { transformations: transformedData });

    this.context.addLog('info', `Stored ${endpoint.transformations.length} transformations for endpoint: ${endpointId}`,
      `Available aliases: ${Object.keys(transformedData).join(', ')}`);
  }

  private async processAssertions(endpoint: StepEndpoint, endpointId: string, response: Response, responseData: unknown, timing: number): Promise<void> {
    if (!endpoint.assertions || endpoint.assertions.length === 0) {
      return;
    }

    this.context.addLog('info', `Running ${endpoint.assertions.length} assertions for endpoint: ${endpointId}`);

    try {
      const assertionModule = await import('$lib/assertions');

      const templateContext = createTemplateContextFromFlowRunner(
        this.context.storedResponses,
        this.context.storedTransformations,
        this.context.parameterValues,
        this.templateFunctions,
        this.context.environmentVariables
      );

      const transformedDataForEndpoint = this.context.storedTransformations[endpointId] || null;
      const assertionResults = await assertionModule.runAssertions(
        endpoint.assertions,
        response,
        responseData,
        transformedDataForEndpoint,
        timing,
        templateContext
      );

      this.context.updateExecutionState(endpointId, { assertions: assertionResults });

      for (const result of assertionResults.results) {
        let logDetails = `Actual value: ${JSON.stringify(result.actualValue)}`;
        if (result.originalExpectedValue && result.originalExpectedValue !== result.expectedValue) {
          logDetails += `, Template: ${result.originalExpectedValue} → ${JSON.stringify(result.expectedValue)}`;
        } else {
          logDetails += `, Expected: ${JSON.stringify(result.expectedValue)}`;
        }

        this.context.addLog(result.passed ? 'debug' : 'error', result.message || '', logDetails);

        if (result.error) {
          this.context.addLog('error', 'Template Error:', result.error);
        }
      }

      this.context.addLog('info', `Assertion evaluation completed for endpoint: ${endpointId}`,
        `${assertionResults.results.length} assertions processed, Overall: ${assertionResults.passed ? 'PASSED' : 'FAILED'}`);

      if (!assertionResults.passed) {
        this.context.updateExecutionState(endpointId, {
          status: 'failed',
          error: assertionResults.failureMessage || 'Assertion failed'
        });

        if (this.context.preferences.stopOnError) {
          this.context.error = new Error(assertionResults.failureMessage || 'Assertion failed');
        }

        return;
      }
    } catch (error) {
      const errorMessage = `Failed to run assertions: ${error instanceof Error ? error.message : String(error)}`;

      this.context.updateExecutionState(endpointId, {
        status: 'failed',
        error: errorMessage
      });

      if (this.context.preferences.stopOnError) {
        this.context.error = new Error(errorMessage);
      }

      this.context.addLog('error', errorMessage);
      return;
    }
  }

  private updateFinalStatus(endpoint: StepEndpoint, endpointId: string, response: Response): void {
    const shouldSkipDefaultCheck = endpoint.skipDefaultStatusCheck === true;

    if (shouldSkipDefaultCheck) {
      this.context.updateExecutionState(endpointId, { status: 'completed' }, true);
      this.context.addLog('debug', `Skipped default status check for endpoint ${endpointId}`,
        `Response status: ${response.status} - using explicit assertions only`);
    } else if (response.ok) {
      this.context.updateExecutionState(endpointId, { status: 'completed' }, true);
    } else {
      this.context.updateExecutionState(endpointId, {
        status: 'failed',
        error: `Request failed with status ${response.status}: ${response.statusText}`
      }, true);

      if (this.context.preferences.stopOnError) {
        this.context.error = new Error(`Request failed with status ${response.status}: ${response.statusText}`);
      }
    }
  }

  private resolveTemplateValueUnified(value: string): string {
    try {
      const context = createTemplateContextFromFlowRunner(
        this.context.storedResponses,
        this.context.storedTransformations,
        this.context.parameterValues,
        this.templateFunctions,
        this.context.environmentVariables
      );

      const result = resolveTemplate(value, context);
      return result !== undefined && result !== null ? String(result) : '';
    } catch (error) {
      this.context.addLog('error', `Template resolution failed for "${value}"`, 
        error instanceof Error ? error.message : String(error));
      return value;
    }
  }

  private resolveTemplateObjectUnified(obj: unknown): unknown {
    try {
      const context = createTemplateContextFromFlowRunner(
        this.context.storedResponses,
        this.context.storedTransformations,
        this.context.parameterValues,
        this.templateFunctions,
        this.context.environmentVariables
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
      this.context.addLog('error', 'Template object resolution failed', 
        error instanceof Error ? error.message : String(error));
      return obj;
    }
  }

  private async getResponseData(response: Response): Promise<unknown> {
    try {
      const contentType = response.headers.get('content-type') || '';
      let data: unknown;

      this.context.addLog('debug', 'Response content type:', contentType || 'No content-type header');

      if (contentType.includes('application/json')) {
        data = await response.json();
        this.context.addLog('debug', 'Response parsed as JSON');
      } else if (contentType.includes('text/html')) {
        data = await response.text();
        this.context.addLog('debug', 'Response parsed as HTML');
      } else if (contentType.includes('text/')) {
        data = await response.text();
        this.context.addLog('debug', 'Response parsed as text');
      } else if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
        data = await response.text();
        this.context.addLog('debug', 'Response parsed as XML');
      } else {
        try {
          data = await response.json();
          this.context.addLog('debug', 'Response auto-detected as JSON');
        } catch (_e: unknown) {
          data = await response.text();
          this.context.addLog('debug', 'Response auto-detected as text');
        }
      }

      return data;
    } catch (_error: unknown) {
      this.context.addLog('error', 'Failed to parse response:', 
        _error instanceof Error ? _error.message : String(_error));
      return 'Unable to parse response data';
    }
  }

  private addRequestDebugLogs(path: string, reqHeaders: Record<string, string>) {
    // Implementation for request debug logs
  }

  /**
   * Parse array parameter value from string format
   */
  private parseArrayParameter(value: string, paramDefinition: any): string[] {
    if (!value || value.trim() === '') {
      return [];
    }

    const format = paramDefinition.collectionFormat || paramDefinition.style || 'csv';
    
    switch (format) {
      case 'csv':
      case 'form':
        return value.split(',').map(item => item.trim()).filter(item => item !== '');
      case 'ssv':
      case 'spaceDelimited':
        return value.split(' ').map(item => item.trim()).filter(item => item !== '');
      case 'tsv':
        return value.split('\t').map(item => item.trim()).filter(item => item !== '');
      case 'pipes':
      case 'pipeDelimited':
        return value.split('|').map(item => item.trim()).filter(item => item !== '');
      case 'multi':
        // For multi format, the value should already be an array or single value
        return [value];
      default:
        // Default to comma-separated
        return value.split(',').map(item => item.trim()).filter(item => item !== '');
    }
  }

  /**
   * Serialize array parameter values to query string format
   */
  private serializeArrayParameter(queryParams: URLSearchParams, name: string, values: string[], paramDefinition: any): void {
    if (values.length === 0) {
      return;
    }

    const format = paramDefinition.collectionFormat || paramDefinition.style || 'csv';
    const explode = paramDefinition.explode !== false; // Default to true for OpenAPI 3.x

    switch (format) {
      case 'csv':
      case 'form':
        if (explode) {
          // Multiple parameters: ?tags=red&tags=blue&tags=green
          values.forEach(value => queryParams.append(name, value));
        } else {
          // Single parameter with comma-separated values: ?tags=red,blue,green
          queryParams.append(name, values.join(','));
        }
        break;
      case 'ssv':
      case 'spaceDelimited':
        // Space-separated: ?tags=red%20blue%20green
        queryParams.append(name, values.join(' '));
        break;
      case 'tsv':
        // Tab-separated: ?tags=red%09blue%09green
        queryParams.append(name, values.join('\t'));
        break;
      case 'pipes':
      case 'pipeDelimited':
        // Pipe-separated: ?tags=red|blue|green
        queryParams.append(name, values.join('|'));
        break;
      case 'multi':
        // Multiple parameters: ?tags=red&tags=blue&tags=green
        values.forEach(value => queryParams.append(name, value));
        break;
      default:
        // Default to exploded form (multiple parameters)
        values.forEach(value => queryParams.append(name, value));
        break;
    }
  }
}
