import type { TestFlowData, FlowParameter, ExecutionState } from '$lib/components/test-flows/types';
import type { FlowSequence, FlowSequenceStep } from '$lib/types/flow_sequence';
import type { Environment } from '$lib/types/environment';
import type { TestFlow } from '$lib/types/test-flow';
import type { Project } from '$lib/types/project';
import type { ExecutionPreferences } from '$lib/flow-runner/execution-engine';

export interface SequenceRunnerOptions {
  sequence: FlowSequence;
  flows: TestFlow[]; // All flows in the sequence, ordered by step_order
  project: Project; // Project information for variable resolution
  selectedEnvironment: Environment;
  selectedSubEnvironment: string; // Selected sub-environment (dev, sit, uat, etc.)
  preferences: ExecutionPreferences;
  onLog: (level: 'info' | 'debug' | 'error' | 'warning', message: string, details?: string) => void;
  onSequenceStart?: () => void;
  onSequenceComplete?: (data: {
    success: boolean;
    error?: unknown;
    completedFlows: number;
    totalFlows: number;
    flowResults: SequenceFlowResult[];
    sequenceOutputs: Record<string, unknown>;
  }) => void;
  onFlowStart?: (data: { flowIndex: number; flow: TestFlow; stepOrder: number }) => void;
  onFlowComplete?: (data: { 
    flowIndex: number; 
    flow: TestFlow; 
    stepOrder: number;
    success: boolean; 
    error?: unknown;
    flowOutputs: Record<string, unknown>;
  }) => void;
  onSequenceStateUpdate?: (state: SequenceExecutionState) => void;
}

export interface SequenceFlowResult {
  flowId: number;
  flowName: string;
  stepOrder: number;
  success: boolean;
  error?: unknown;
  outputs: Record<string, unknown>;
  responses: Record<string, unknown>;
  parameterValues: Record<string, unknown>;
  executionTime: number;
}

export interface SequenceExecutionState {
  isRunning: boolean;
  currentFlowIndex: number;
  totalFlows: number;
  progress: number;
  error?: unknown;
  shouldStopExecution: boolean;
  flowResults: SequenceFlowResult[];
  accumulatedOutputs: Record<string, unknown>; // Outputs from all previous flows
  accumulatedResponses: Record<string, unknown>; // Responses from all previous flows
}

export interface FlowParameterMapping {
  flowParameter: string; // Parameter name in the current flow
  sourceType: 'environment' | 'previous_flow_output' | 'previous_flow_response' | 'fixed_value';
  sourceValue: string; // Environment variable name, JSONPath for previous flow, or fixed value
  sourceFlowStepOrder?: number; // Which previous flow step (only for previous_flow_* types)
}

export interface ResolvedFlowExecution {
  flowData: TestFlowData;
  resolvedParameters: Record<string, unknown>;
  environmentVariables: Record<string, unknown>;
}
