import type {
  SequenceRunnerOptions,
  SequenceExecutionState,
  SequenceFlowResult,
  SequenceLoopExecutionContext,
  SequenceLoopIterationPath,
  SequenceResolvedLoop
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
      const orderedSteps = [...this.options.sequence.sequenceConfig.steps].sort(
        (a, b) => a.step_order - b.step_order
      );

      for (let i = 0; i < orderedSteps.length; i++) {
        this.state.currentFlowIndex = i;
        this.state.progress = Math.floor((i / this.state.totalFlows) * 100);

        const sequenceStep = orderedSteps[i];
        const flow = this.options.flows.find((f) => parseInt(f.id) === sequenceStep.test_flow_id);

        if (!flow) {
          const error = new Error(
            `Flow with ID ${sequenceStep.test_flow_id} not found in sequence step ${sequenceStep.step_order}`
          );
          this.options.onLog('error', 'Flow not found', error.message);
          throw error;
        }

        // Execute this flow
        const flowResult = await this.executeFlow(flow, sequenceStep, i);
        this.state.flowResults.push(flowResult);
        this.options.onFlowResult?.({
          flowIndex: i,
          flow,
          stepOrder: sequenceStep.step_order,
          flowResult,
          flowResults: [...this.state.flowResults]
        });

        // Check if flow execution failed and evaluate against expectations
        const actuallyFailed = !flowResult.success;
        const expectsError = sequenceStep.expects_error ?? false;

        // Determine if this constitutes a sequence failure
        const isSequenceFailure = !flowResult.matchedExpectation;

        if (isSequenceFailure) {
          if (expectsError && !actuallyFailed) {
            this.options.onLog(
              'error',
              'Flow succeeded but was expected to fail',
              `Flow ${flow.name} was expected to fail but succeeded unexpectedly`
            );
          } else if (!expectsError && actuallyFailed) {
            this.options.onLog(
              'error',
              'Flow failed unexpectedly',
              `Flow ${flow.name} failed: ${flowResult.error}`
            );
          }

          // Use user's stopOnError preference (inverted logic - stopOnError=true means don't continue)
          const shouldStopOnError = this.options.preferences.stopOnError;

          if (shouldStopOnError) {
            this.options.onLog(
              'error',
              'Sequence execution stopped due to flow expectation mismatch'
            );
            break;
          } else {
            this.options.onLog(
              'warning',
              'Flow expectation mismatch but continuing due to execution options'
            );
          }
        } else {
          // Flow behaved as expected
          if (expectsError && actuallyFailed) {
            this.options.onLog(
              'info',
              'Flow failed as expected',
              `Flow ${flow.name} failed as expected: ${flowResult.error}`
            );
          } else if (!expectsError && !actuallyFailed) {
            this.options.onLog(
              'info',
              'Flow succeeded as expected',
              `Flow ${flow.name} completed successfully`
            );
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

      // Evaluate overall success - check if each flow behaved as expected
      const hasUnexpectedResults = this.state.flowResults.some(
        (result) => !result.matchedExpectation
      );

      const success = !hasUnexpectedResults && !this.state.error;

      // Compile sequence outputs (outputs from all flows)
      const sequenceOutputs: Record<string, unknown> = {};
      this.state.flowResults.forEach((result, index) => {
        const stepOrder =
          this.options.sequence.sequenceConfig.steps[index]?.step_order || index + 1;
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
      this.options.onLog(
        'error',
        'Sequence execution error',
        err instanceof Error ? err.message : String(err)
      );

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
    const startTime = Date.now();

    this.options.onFlowStart?.({
      flowIndex,
      flow,
      stepOrder: sequenceStep.step_order
    });

    this.options.onLog(
      'info',
      `Starting execution of flow ${flow.name}`,
      `Step order: ${sequenceStep.step_order}, Flow ID: ${flow.id}`
    );

    try {
      const { environmentVariables, apiHosts } = this.getExecutionContext();
      const flowResult = sequenceStep.loop_config?.enabled
        ? await this.executeLoopedFlow(
            flow,
            sequenceStep,
            flowIndex,
            environmentVariables,
            apiHosts,
            startTime
          )
        : await this.executeSingleFlowRun(
            flow,
            sequenceStep,
            flowIndex,
            environmentVariables,
            apiHosts
          );

      this.options.onFlowComplete?.({
        flowIndex,
        flow,
        stepOrder: sequenceStep.step_order,
        success: flowResult.success,
        error: flowResult.error,
        flowOutputs: flowResult.outputs
      });

      this.options.onLog(
        flowResult.success ? 'info' : 'error',
        `Flow ${flow.name} execution ${flowResult.success ? 'completed successfully' : 'failed'}`,
        `Execution time: ${flowResult.executionTime}ms${flowResult.error ? `, Error: ${flowResult.error}` : ''}`
      );

      return flowResult;
    } catch (err: unknown) {
      const flowResult = this.createFailedFlowResult(flow, sequenceStep, startTime, err);

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

  private getExecutionContext(): {
    environmentVariables: Record<string, unknown>;
    apiHosts: Record<string, string>;
  } {
    const { selectedEnvironment, selectedSubEnvironment } = this.options;
    const environmentVariables = SequenceParameterResolver.getEnvironmentVariables(
      selectedEnvironment,
      selectedSubEnvironment
    );
    let apiHosts: Record<string, string> = {};

    if (selectedEnvironment.config.environments[selectedSubEnvironment]) {
      const { api_hosts } = selectedEnvironment.config.environments[selectedSubEnvironment];
      apiHosts = api_hosts;
    }

    return { environmentVariables, apiHosts };
  }

  private async executeSingleFlowRun(
    flow: TestFlow,
    sequenceStep: FlowSequenceStep,
    flowIndex: number,
    environmentVariables: Record<string, unknown>,
    apiHosts: Record<string, string>,
    loopContext?: SequenceLoopExecutionContext
  ): Promise<SequenceFlowResult> {
    const startTime = Date.now();

    try {
      const resolvedExecution = SequenceParameterResolver.resolveFlowParameters(
        flow,
        sequenceStep,
        this.state.accumulatedOutputs,
        environmentVariables,
        apiHosts,
        this.options.onLog,
        loopContext
      );

      // Variables to capture flow execution results
      let flowOutputs: Record<string, unknown> = {};
      let storedResponses: Record<string, unknown> = {};
      let executionState: import('$lib/components/test-flows/types').ExecutionState = {};
      let flowExecutionResult: { success: boolean; error?: unknown } | null = null;

      // Create FlowRunner options
      const flowRunnerOptions: FlowRunnerOptions = {
        flowData: resolvedExecution.flowData,
        preferences: this.options.preferences,
        httpTransport: this.options.httpTransport,
        selectedEnvironment: this.options.selectedEnvironment,
        environmentVariables: resolvedExecution.environmentVariables,
        onLog: this.options.onLog,
        onExecutionStateUpdate: () => {}, // We handle this at sequence level
        onEndpointStateUpdate: () => {}, // We handle this at sequence level
        onExecutionComplete: (data) => {
          // Capture the flow outputs and responses from the callback
          flowOutputs = data.flowOutputs;
          storedResponses = data.storedResponses;
          executionState = data.executionState;
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

      const endTime = Date.now();
      const executionTime = Math.round(endTime - startTime);

      // Check for errors in responses
      let hasResponseError = false;
      let responseErrorMessage = '';

      for (const [endpointId, response] of Object.entries(storedResponses)) {
        if (typeof response === 'object' && response !== null) {
          if (SequenceParameterResolver.hasErrorInResponse(response as Record<string, unknown>)) {
            hasResponseError = true;
            responseErrorMessage = SequenceParameterResolver.getErrorFromResponse(
              response as Record<string, unknown>
            );
            this.options.onLog(
              'error',
              `API error detected in endpoint ${endpointId}`,
              responseErrorMessage
            );
            break;
          }
        }
      }
      // Use the execution result from the callback if available, otherwise fall back to the direct result
      const finalResult = flowExecutionResult || result;
      const success = finalResult.success && !hasResponseError;
      const error =
        finalResult.error || (hasResponseError ? new Error(responseErrorMessage) : undefined);

      // Check if result matches expectation
      const expectsError = sequenceStep.expects_error ?? false;
      const matchedExpectation = success !== expectsError; // success=true + expectsError=false = matched, success=false + expectsError=true = matched

      return {
        flowId: parseInt(flow.id),
        flowName: flow.name,
        stepOrder: sequenceStep.step_order,
        success,
        expectsError,
        matchedExpectation,
        error,
        outputs: flowOutputs, // Now properly captured from onExecutionComplete callback
        responses: storedResponses, // Now properly captured from onExecutionComplete callback
        parameterValues: resolvedExecution.resolvedParameters,
        executionState,
        executionTime
      };
    } catch (err: unknown) {
      this.options.onLog(
        'error',
        `Flow ${flow.name} execution failed`,
        err instanceof Error ? err.message : String(err)
      );

      return this.createFailedFlowResult(flow, sequenceStep, startTime, err);
    }
  }

  private async executeLoopedFlow(
    flow: TestFlow,
    sequenceStep: FlowSequenceStep,
    flowIndex: number,
    environmentVariables: Record<string, unknown>,
    apiHosts: Record<string, string>,
    startTime: number
  ): Promise<SequenceFlowResult> {
    const loopPlan = SequenceParameterResolver.resolveLoopPlan(
      sequenceStep,
      this.state.accumulatedOutputs,
      environmentVariables,
      this.options.onLog
    );
    const loopContexts = loopPlan ? this.buildLoopExecutionContexts(loopPlan) : [];

    this.options.onLog(
      'info',
      `Loop mode enabled for flow ${flow.name}`,
      `${loopContexts.length} iteration(s)`
    );

    const iterationResults: SequenceFlowResult[] = [];

    for (let iterationIndex = 0; iterationIndex < loopContexts.length; iterationIndex++) {
      if (this.state.shouldStopExecution) {
        this.options.onLog('info', 'Loop execution stopped by user');
        break;
      }

      const loopContext = loopContexts[iterationIndex];
      this.options.onLog(
        'info',
        `Running iteration ${iterationIndex + 1}/${loopContexts.length} for flow ${flow.name}`,
        this.formatLoopContextLabel(loopContext)
      );

      const iterationResult = await this.executeSingleFlowRun(
        flow,
        sequenceStep,
        flowIndex,
        environmentVariables,
        apiHosts,
        loopContext
      );

      iterationResults.push(iterationResult);

      if (!iterationResult.matchedExpectation) {
        return this.createLoopResult(
          flow,
          sequenceStep,
          startTime,
          loopContexts,
          iterationResults,
          iterationIndex
        );
      }
    }

    return this.createLoopResult(flow, sequenceStep, startTime, loopContexts, iterationResults);
  }

  private buildLoopExecutionContexts(loop: SequenceResolvedLoop): SequenceLoopExecutionContext[] {
    const appendLoop = (
      currentLoop: SequenceResolvedLoop,
      path: SequenceLoopIterationPath[],
      valuesByLoopId: SequenceLoopExecutionContext['valuesByLoopId']
    ): SequenceLoopExecutionContext[] => {
      const contexts: SequenceLoopExecutionContext[] = [];

      for (const row of currentLoop.rows) {
        const nextPath = [...path, row];
        const nextValuesByLoopId = {
          ...valuesByLoopId,
          [row.loopId]: {
            loopName: row.loopName,
            index: row.index,
            valuesBySourceId: row.valuesBySourceId,
            sourceAliases: row.sourceAliases
          }
        };

        if (currentLoop.children.length === 0) {
          contexts.push({ path: nextPath, valuesByLoopId: nextValuesByLoopId });
          continue;
        }

        for (const child of currentLoop.children) {
          contexts.push(...appendLoop(child, nextPath, nextValuesByLoopId));
        }
      }

      return contexts;
    };

    return appendLoop(loop, [], {});
  }

  private formatLoopContextLabel(context: SequenceLoopExecutionContext): string {
    return context.path
      .map((pathItem) => {
        const values = Object.entries(pathItem.valuesBySourceId)
          .map(
            ([sourceId, value]) =>
              `${pathItem.sourceAliases[sourceId] || sourceId}=${String(value)}`
          )
          .join(', ');
        return `${pathItem.loopName}[${pathItem.index + 1}]: ${values}`;
      })
      .join(' / ');
  }

  private createLoopResult(
    flow: TestFlow,
    sequenceStep: FlowSequenceStep,
    startTime: number,
    loopContexts: SequenceLoopExecutionContext[],
    iterationResults: SequenceFlowResult[],
    failedIterationIndex?: number
  ): SequenceFlowResult {
    const lastResult = iterationResults[iterationResults.length - 1];
    const completedResults = iterationResults.filter((result) => result.matchedExpectation);
    const success =
      iterationResults.length === loopContexts.length &&
      iterationResults.every((result) => result.success);
    const expectsError = sequenceStep.expects_error ?? false;
    const endTime = Date.now();

    return {
      flowId: parseInt(flow.id),
      flowName: flow.name,
      stepOrder: sequenceStep.step_order,
      success,
      expectsError,
      matchedExpectation: failedIterationIndex === undefined,
      error: failedIterationIndex !== undefined ? lastResult?.error : undefined,
      outputs: this.aggregateRecords(completedResults.map((result) => result.outputs)),
      responses: this.namespaceIterationRecords(iterationResults.map((result) => result.responses)),
      parameterValues: this.namespaceIterationRecords(
        iterationResults.map((result) => result.parameterValues)
      ),
      executionState: {},
      executionTime: Math.round(endTime - startTime),
      loop: {
        enabled: true,
        totalIterations: loopContexts.length,
        completedIterations: completedResults.length,
        failedIterationIndex,
        loopNames: this.collectLoopNames(loopContexts),
        sourceAliases: this.collectSourceAliases(loopContexts),
        iterations: iterationResults.map((result, index) => ({
          index,
          label: loopContexts[index] ? this.formatLoopContextLabel(loopContexts[index]) : '',
          path: loopContexts[index]?.path ?? [],
          valuesByLoopId: loopContexts[index]?.valuesByLoopId ?? {},
          success: result.success,
          matchedExpectation: result.matchedExpectation,
          error: result.error,
          outputs: result.outputs,
          responses: result.responses,
          parameterValues: result.parameterValues,
          executionState: result.executionState,
          executionTime: result.executionTime
        }))
      }
    };
  }

  private collectLoopNames(loopContexts: SequenceLoopExecutionContext[]): Record<string, string> {
    const loopNames: Record<string, string> = {};
    for (const context of loopContexts) {
      for (const pathItem of context.path) {
        loopNames[pathItem.loopId] = pathItem.loopName;
      }
    }
    return loopNames;
  }

  private collectSourceAliases(
    loopContexts: SequenceLoopExecutionContext[]
  ): Record<string, Record<string, string>> {
    const sourceAliases: Record<string, Record<string, string>> = {};
    for (const context of loopContexts) {
      for (const pathItem of context.path) {
        sourceAliases[pathItem.loopId] = {
          ...(sourceAliases[pathItem.loopId] ?? {}),
          ...pathItem.sourceAliases
        };
      }
    }
    return sourceAliases;
  }

  private aggregateRecords(records: Array<Record<string, unknown>>): Record<string, unknown> {
    const aggregated: Record<string, unknown[]> = {};

    for (const record of records) {
      for (const [key, value] of Object.entries(record)) {
        if (!aggregated[key]) {
          aggregated[key] = [];
        }
        if (Array.isArray(value)) {
          aggregated[key].push(...value);
        } else {
          aggregated[key].push(value);
        }
      }
    }

    return aggregated;
  }

  private namespaceIterationRecords(
    records: Array<Record<string, unknown>>
  ): Record<string, unknown> {
    return Object.fromEntries(records.map((record, index) => [`iteration_${index}`, record]));
  }

  private createFailedFlowResult(
    flow: TestFlow,
    sequenceStep: FlowSequenceStep,
    startTime: number,
    error: unknown
  ): SequenceFlowResult {
    const endTime = Date.now();
    const expectsError = sequenceStep.expects_error ?? false;

    this.options.onLog(
      'error',
      `Flow ${flow.name} execution failed`,
      error instanceof Error ? error.message : String(error)
    );

    return {
      flowId: parseInt(flow.id),
      flowName: flow.name,
      stepOrder: sequenceStep.step_order,
      success: false,
      expectsError,
      matchedExpectation: expectsError,
      error,
      outputs: {},
      responses: {},
      parameterValues: {},
      executionState: {},
      executionTime: Math.round(endTime - startTime)
    };
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
  get isRunning(): boolean {
    return this.state.isRunning;
  }
  get currentFlowIndex(): number {
    return this.state.currentFlowIndex;
  }
  get progress(): number {
    return this.state.progress;
  }
  get error(): unknown {
    return this.state.error;
  }
  get flowResults(): SequenceFlowResult[] {
    return this.state.flowResults;
  }
  get accumulatedOutputs(): Record<string, unknown> {
    return this.state.accumulatedOutputs;
  }
}
