import type { 
  SequenceRunnerOptions, 
  SequenceExecutionState, 
  SequenceFlowResult
} from './types';
import type { TestFlow } from '$lib/types/test-flow';
import type { FlowSequenceStep } from '$lib/types/flow_sequence';
import { FlowRunner, type FlowRunnerOptions } from '$lib/flow-runner';
import { SequenceParameterResolver } from './parameter-resolver';

export class SequenceRunner {
  private options: SequenceRunnerOptions;
  private state: SequenceExecutionState;

  constructor(options: SequenceRunnerOptions) {
    this.options = options;
    this.state = this.initializeState();
  }

  private initializeState(): SequenceExecutionState {
    return {
      isRunning: false,
      currentFlowIndex: 0,
      totalFlows: this.options.flows.length,
      progress: 0,
      shouldStopExecution: false,
      flowResults: [],
      accumulatedOutputs: {},
      accumulatedResponses: {}
    };
  }

  async runSequence(): Promise<{ success: boolean; error?: unknown }> {
    this.resetExecution();
    this.options.onSequenceStart?.();
    
    this.state.isRunning = true;

    try {
      // Get the sequence steps ordered by step_order
      const orderedSteps = [...this.options.sequence.sequenceConfig.steps]
        .sort((a, b) => a.step_order - b.step_order);

      for (let i = 0; i < orderedSteps.length; i++) {
        this.state.currentFlowIndex = i;
        this.state.progress = Math.floor((i / this.state.totalFlows) * 100);

        const sequenceStep = orderedSteps[i];
        const flow = this.options.flows.find(f => parseInt(f.id) === sequenceStep.test_flow_id);

        if (!flow) {
          const error = new Error(`Flow with ID ${sequenceStep.test_flow_id} not found in sequence step ${sequenceStep.step_order}`);
          this.options.onLog('error', 'Flow not found', error.message);
          throw error;
        }

        // Execute this flow
        const flowResult = await this.executeFlow(flow, sequenceStep, i);
        console.log("Flow result: ", flowResult);
        this.state.flowResults.push(flowResult);

        // Check if flow execution failed
        if (!flowResult.success) {
          // Use user's stopOnError preference (inverted logic - stopOnError=true means don't continue)
          const shouldStopOnError = this.options.preferences.stopOnError;
          
          if (shouldStopOnError) {
            this.options.onLog('error', 'Sequence execution stopped due to flow failure', 
              `Flow ${flow.name} failed: ${flowResult.error}`);
            break;
          } else {
            this.options.onLog('warning', 'Flow failed but continuing due to execution options',
              `Flow ${flow.name} failed: ${flowResult.error}`);
          }
        }

        // Check for user stop request
        if (this.state.shouldStopExecution) {
          this.options.onLog('info', 'Sequence execution stopped by user');
          break;
        }

        // Update accumulated outputs and responses for next flows
        this.state.accumulatedOutputs[`flow_${sequenceStep.step_order}`] = flowResult.outputs;
        this.state.accumulatedResponses[`flow_${sequenceStep.step_order}`] = flowResult.responses;

        // Emit state update
        this.options.onSequenceStateUpdate?.(this.state);
      }

      this.state.progress = 100;

      // Evaluate overall success
      const hasErrors = this.state.flowResults.some(result => !result.success);
      const success = !hasErrors && !this.state.error;

      // Compile sequence outputs (outputs from all flows)
      const sequenceOutputs: Record<string, unknown> = {};
      this.state.flowResults.forEach((result, index) => {
        const stepOrder = this.options.sequence.sequenceConfig.steps[index]?.step_order || index + 1;
        sequenceOutputs[`flow_${stepOrder}`] = result.outputs;
      });

      this.options.onSequenceComplete?.({
        success,
        error: this.state.error,
        completedFlows: this.state.flowResults.length,
        totalFlows: this.state.totalFlows,
        flowResults: this.state.flowResults,
        sequenceOutputs
      });

      return { success, error: this.state.error };

    } catch (err: unknown) {
      this.state.error = err;
      this.options.onLog('error', 'Sequence execution error', err instanceof Error ? err.message : String(err));
      
      this.options.onSequenceComplete?.({
        success: false,
        error: this.state.error,
        completedFlows: this.state.flowResults.length,
        totalFlows: this.state.totalFlows,
        flowResults: this.state.flowResults,
        sequenceOutputs: {}
      });

      return { success: false, error: this.state.error };
    } finally {
      this.state.isRunning = false;
    }
  }

  private async executeFlow(
    flow: TestFlow, 
    sequenceStep: FlowSequenceStep, 
    flowIndex: number
  ): Promise<SequenceFlowResult> {
    const startTime = performance.now();
    
    this.options.onFlowStart?.({ 
      flowIndex, 
      flow, 
      stepOrder: sequenceStep.step_order 
    });

    this.options.onLog('info', `Starting execution of flow ${flow.name}`, 
      `Step order: ${sequenceStep.step_order}, Flow ID: ${flow.id}`);

    try {
      // Prepare environment variables
      const {selectedEnvironment, selectedSubEnvironment} = this.options;
      let environmentVariables: Record<string, unknown> = {};
      let apiHosts: Record<string, string> = {};
      
      if (selectedEnvironment.config.environments[selectedSubEnvironment]) {
        const {variables, api_hosts} = selectedEnvironment.config.environments[selectedSubEnvironment];
        environmentVariables = variables;
        apiHosts = api_hosts;
      }
      // Resolve parameters for this flow
      const resolvedExecution = SequenceParameterResolver.resolveFlowParameters(
        flow,
        sequenceStep,
        this.state.accumulatedOutputs,
        environmentVariables,
        apiHosts,
        this.options.onLog
      );

      // Variables to capture flow execution results
      let flowOutputs: Record<string, unknown> = {};
      let storedResponses: Record<string, unknown> = {};
      let flowExecutionResult: { success: boolean; error?: unknown } | null = null;

      // Create FlowRunner options
      const flowRunnerOptions: FlowRunnerOptions = {
        flowData: resolvedExecution.flowData,
        preferences: this.options.preferences,
        selectedEnvironment: this.options.selectedEnvironment,
        environmentVariables: resolvedExecution.environmentVariables,
        onLog: this.options.onLog,
        onExecutionStateUpdate: () => {}, // We handle this at sequence level
        onEndpointStateUpdate: () => {}, // We handle this at sequence level  
        onExecutionComplete: (data) => {
          // Capture the flow outputs and responses from the callback
          flowOutputs = data.flowOutputs;
          storedResponses = data.storedResponses;
          flowExecutionResult = { success: data.success, error: data.error };
        }
      };

      // Create and run the flow
      const flowRunner = new FlowRunner(flowRunnerOptions);
      
      // Set the resolved parameters directly into the flow runner
      // We bypass the normal parameter checking since sequence resolver already handled it
      flowRunner.setParameterValues(resolvedExecution.resolvedParameters);
      
      // Execute flow directly, bypassing parameter validation since we already resolved all parameters
      const result = await flowRunner.executeFlowAfterParameterCheck();
      
      const endTime = performance.now();
      const executionTime = Math.round(endTime - startTime);

      // Check for errors in responses
      let hasResponseError = false;
      let responseErrorMessage = '';
      
      for (const [endpointId, response] of Object.entries(storedResponses)) {
        if (typeof response === 'object' && response !== null) {
          if (SequenceParameterResolver.hasErrorInResponse(response as Record<string, unknown>)) {
            hasResponseError = true;
            responseErrorMessage = SequenceParameterResolver.getErrorFromResponse(response as Record<string, unknown>);
            this.options.onLog('error', `API error detected in endpoint ${endpointId}`, responseErrorMessage);
            break;
          }
        }
      }
      // Use the execution result from the callback if available, otherwise fall back to the direct result
      const finalResult = flowExecutionResult || result;
      const success = finalResult.success && !hasResponseError;
      const error = finalResult.error || (hasResponseError ? new Error(responseErrorMessage) : undefined);

      const flowResult: SequenceFlowResult = {
        flowId: parseInt(flow.id),
        flowName: flow.name,
        stepOrder: sequenceStep.step_order,
        success,
        error,
        outputs: flowOutputs, // Now properly captured from onExecutionComplete callback
        responses: storedResponses, // Now properly captured from onExecutionComplete callback
        parameterValues: resolvedExecution.resolvedParameters,
        executionTime
      };

      this.options.onFlowComplete?.({
        flowIndex,
        flow,
        stepOrder: sequenceStep.step_order,
        success,
        error,
        flowOutputs
      });

      this.options.onLog(success ? 'info' : 'error', 
        `Flow ${flow.name} execution ${success ? 'completed successfully' : 'failed'}`,
        `Execution time: ${executionTime}ms${error ? `, Error: ${error}` : ''}`);

      return flowResult;

    } catch (err: unknown) {
      const endTime = performance.now();
      const executionTime = Math.round(endTime - startTime);
      
      this.options.onLog('error', `Flow ${flow.name} execution failed`, err instanceof Error ? err.message : String(err));

      const flowResult: SequenceFlowResult = {
        flowId: parseInt(flow.id),
        flowName: flow.name,
        stepOrder: sequenceStep.step_order,
        success: false,
        error: err,
        outputs: {},
        responses: {},
        parameterValues: {},
        executionTime
      };

      this.options.onFlowComplete?.({
        flowIndex,
        flow,
        stepOrder: sequenceStep.step_order,
        success: false,
        error: err,
        flowOutputs: {}
      });

      return flowResult;
    }
  }

  stopExecution(): void {
    if (this.state.isRunning) {
      this.state.shouldStopExecution = true;
      this.options.onLog('info', 'User requested to stop sequence execution');
    }
  }

  resetExecution(): void {
    this.state.currentFlowIndex = 0;
    this.state.progress = 0;
    this.state.error = undefined;
    this.state.flowResults = [];
    this.state.accumulatedOutputs = {};
    this.state.accumulatedResponses = {};
    this.state.isRunning = false;
    this.state.shouldStopExecution = false;
  }

  // Getters for state access
  get isRunning(): boolean { return this.state.isRunning; }
  get currentFlowIndex(): number { return this.state.currentFlowIndex; }
  get progress(): number { return this.state.progress; }
  get error(): unknown { return this.state.error; }
  get flowResults(): SequenceFlowResult[] { return this.state.flowResults; }
  get accumulatedOutputs(): Record<string, unknown> { return this.state.accumulatedOutputs; }
}
