import type { TestFlowData, FlowStep, FlowParameter, ExecutionState } from '$lib/components/test-flows/types';
import type { RequestCookie } from '$lib/http_client/test-flow';
import { FlowExecutionEngine, type ExecutionPreferences, type ExecutionContext } from './execution-engine';
import { ParameterManager, type ParameterManagerContext } from './parameter-manager';
import { FlowOutputEvaluator, type OutputEvaluatorContext } from './output-evaluator';
import { FlowValidator } from './validator';

export interface FlowRunnerOptions {
  flowData: TestFlowData;
  preferences: ExecutionPreferences;
  environments: import('$lib/types/environment').Environment[];
  selectedEnvironment: import('$lib/types/environment').Environment | null;
  environmentVariables: Record<string, unknown>;
  onLog: (level: 'info' | 'debug' | 'error' | 'warning', message: string, details?: string) => void;
  onExecutionStateUpdate: (state: ExecutionState) => void;
  onEndpointStateUpdate: (data: { endpointId: string; state: any }) => void;
  onStepExecutionComplete?: (data: { stepId: string; stepIndex?: number; success: boolean; error?: unknown }) => void;
  onExecutionStart?: () => void;
  onExecutionComplete?: (data: { 
    success: boolean; 
    error?: unknown; 
    storedResponses: Record<string, unknown>; 
    parameterValues: Record<string, unknown>; 
    flowOutputs: Record<string, unknown> 
  }) => void;
}

export interface FlowRunnerState {
  isRunning: boolean;
  currentStep: number;
  totalSteps: number;
  progress: number;
  error: unknown;
  shouldStopExecution: boolean;
  storedResponses: Record<string, unknown>;
  storedTransformations: Record<string, Record<string, unknown>>;
  parameterValues: Record<string, unknown>;
  executionState: ExecutionState;
  cookieStore: Map<string, Array<RequestCookie>>;
}

export class FlowRunner {
  private options: FlowRunnerOptions;
  private state: FlowRunnerState;
  private parameterManager!: ParameterManager;
  private executionEngine!: FlowExecutionEngine;
  private outputEvaluator!: FlowOutputEvaluator;

  constructor(options: FlowRunnerOptions) {
    this.options = options;
    this.state = this.initializeState();
    this.setupManagers();
  }

  private initializeState(): FlowRunnerState {
    return {
      isRunning: false,
      currentStep: 0,
      totalSteps: this.options.flowData.steps.length,
      progress: 0,
      error: null,
      shouldStopExecution: false,
      storedResponses: {},
      storedTransformations: {},
      parameterValues: {},
      executionState: {},
      cookieStore: new Map()
    };
  }

  private setupManagers(): void {
    const parameterContext: ParameterManagerContext = {
      flowData: this.options.flowData,
      environmentVariables: this.options.environmentVariables,
      selectedEnvironment: this.options.selectedEnvironment,
      addLog: this.options.onLog
    };

    this.parameterManager = new ParameterManager(parameterContext);

    const executionContext: ExecutionContext = {
      flowData: this.options.flowData,
      preferences: this.options.preferences,
      storedResponses: this.state.storedResponses,
      storedTransformations: this.state.storedTransformations,
      parameterValues: this.state.parameterValues,
      environmentVariables: this.options.environmentVariables,
      cookieStore: this.state.cookieStore,
      selectedEnvironment: this.options.selectedEnvironment,
      shouldStopExecution: this.state.shouldStopExecution,
      error: this.state.error,
      executionState: this.state.executionState,
      addLog: this.options.onLog,
      updateExecutionState: this.updateExecutionState.bind(this)
    };

    this.executionEngine = new FlowExecutionEngine(executionContext);

    const outputContext: OutputEvaluatorContext = {
      outputs: this.options.flowData.outputs || [],
      storedResponses: this.state.storedResponses,
      storedTransformations: this.state.storedTransformations,
      parameterValues: this.state.parameterValues,
      environmentVariables: this.options.environmentVariables,
      addLog: this.options.onLog
    };

    this.outputEvaluator = new FlowOutputEvaluator(outputContext);
  }

  async runFlow(): Promise<{ success: boolean; error?: unknown; parametersWithMissingValues?: FlowParameter[] }> {
    this.resetExecution();

    const validationError = FlowValidator.getValidationErrorMessage(this.options.flowData);
    if (validationError) {
      this.state.error = new Error(validationError);
      this.options.onExecutionComplete?.({
        success: false,
        error: this.state.error,
        storedResponses: this.state.storedResponses,
        parameterValues: this.state.parameterValues,
        flowOutputs: {}
      });
      return { success: false, error: this.state.error };
    }

    // Prepare parameters
    this.state.parameterValues = this.parameterManager.prepareParameters();
    
    // Update execution context with new parameter values
    this.executionEngine.updateParameterValues(this.state.parameterValues);
    
    const parametersWithMissingValues = this.parameterManager.checkRequiredParameters(this.state.parameterValues);

    if (parametersWithMissingValues.length > 0) {
      this.options.onLog('info', 'Required parameters need input', 
        `${parametersWithMissingValues.length} required Parameter(s) need values`);
      return { success: false, parametersWithMissingValues };
    }

    return await this.executeFlowAfterParameterCheck();
  }

  async executeFlowAfterParameterCheck(): Promise<{ success: boolean; error?: unknown }> {
    this.options.onExecutionStart?.();
    this.state.isRunning = true;
    this.state.currentStep = 0;

    try {
      for (let i = 0; i < this.options.flowData.steps.length; i++) {
        this.state.currentStep = i;
        this.state.progress = Math.floor((i / this.state.totalSteps) * 100);

        const step = this.options.flowData.steps[i];
        await this.executionEngine.executeStep(step);

        if (this.state.error && this.options.preferences.stopOnError) {
          break;
        }

        if (this.state.shouldStopExecution) {
          this.options.onLog('info', 'Execution stopped by user');
          break;
        }
      }

      this.state.progress = 100;
      
      let flowOutputs: Record<string, unknown> = {};
      if (!this.state.error) {
        flowOutputs = this.outputEvaluator.evaluateOutputs();
      }

      this.options.onExecutionComplete?.({
        success: !this.state.error,
        error: this.state.error,
        storedResponses: this.state.storedResponses,
        parameterValues: this.state.parameterValues,
        flowOutputs
      });

      return { success: !this.state.error, error: this.state.error };

    } catch (err: unknown) {
      this.state.error = err;
      this.options.onLog('error', 'Flow execution error', err instanceof Error ? err.message : String(err));
      
      this.options.onExecutionComplete?.({
        success: false,
        error: this.state.error,
        storedResponses: this.state.storedResponses,
        parameterValues: this.state.parameterValues,
        flowOutputs: {}
      });

      return { success: false, error: this.state.error };
    } finally {
      this.state.isRunning = false;
    }
  }

  async executeSingleStep(step: FlowStep, stepIndex?: number): Promise<{ success: boolean; error?: unknown }> {
    if (!step || !step.step_id) {
      const error = new Error('Invalid step provided for execution');
      return { success: false, error };
    }

    const validationError = FlowValidator.getValidationErrorMessage(this.options.flowData);
    if (validationError) {
      const error = new Error(validationError);
      this.options.onLog('error', 'Validation failed', validationError);
      return { success: false, error };
    }

    const localIsRunning = this.state.isRunning;
    this.state.isRunning = true;

    try {
      this.options.onLog('info', `Executing step ${step.step_id} individually`, JSON.stringify(step));
      await this.executionEngine.executeStep(step);

      this.options.onStepExecutionComplete?.({
        stepId: step.step_id,
        stepIndex: stepIndex,
        success: true
      });

      return { success: true };
    } catch (err: unknown) {
      this.options.onLog('error', `Error executing step ${step.step_id}`, err instanceof Error ? err.message : String(err));

      this.options.onStepExecutionComplete?.({
        stepId: step.step_id,
        stepIndex: stepIndex,
        success: false,
        error: err
      });

      return { success: false, error: err };
    } finally {
      this.state.isRunning = localIsRunning;
    }
  }

  stopExecution(): void {
    if (this.state.isRunning) {
      this.state.shouldStopExecution = true;
      this.options.onLog('info', 'User requested to stop execution');
    }
  }

  resetExecution(): void {
    this.state.currentStep = 0;
    this.state.progress = 0;
    this.state.error = null;
    this.state.storedResponses = {};
    this.state.storedTransformations = {};
    this.state.executionState = {};
    this.state.isRunning = false;
    this.state.parameterValues = {};
    this.state.shouldStopExecution = false;

    if (this.options.preferences.serverCookieHandling) {
      this.state.cookieStore.clear();
    }
  }

  updateParameterValues(parametersWithMissingValues: FlowParameter[]): void {
    this.state.parameterValues = this.parameterManager.updateParameterValues(
      parametersWithMissingValues, 
      this.state.parameterValues
    );
    
    // Update execution context with new parameter values
    this.executionEngine.updateParameterValues(this.state.parameterValues);
  }

  private updateExecutionState(endpointId: string, updates: Partial<any>, emitEndpointUpdate: boolean = false): void {
    const updatedEndpointState = {
      ...this.state.executionState[endpointId],
      ...updates
    };
    
    this.state.executionState = {
      ...this.state.executionState,
      [endpointId]: updatedEndpointState
    };
    
    // Update progress and current step in execution state
    this.state.executionState.progress = this.state.progress;
    this.state.executionState.currentStep = this.state.currentStep;
    
    this.options.onExecutionStateUpdate(this.state.executionState);
    
    if (emitEndpointUpdate) {
      this.options.onEndpointStateUpdate({
        endpointId,
        state: updatedEndpointState
      });
    }
  }

  // Getters for state access
  get isRunning(): boolean { return this.state.isRunning; }
  get currentStep(): number { return this.state.currentStep; }
  get progress(): number { return this.state.progress; }
  get error(): unknown { return this.state.error; }
  get executionState(): ExecutionState { return this.state.executionState; }
  get parameterValues(): Record<string, unknown> { return this.state.parameterValues; }
  get storedResponses(): Record<string, unknown> { return this.state.storedResponses; }
}
