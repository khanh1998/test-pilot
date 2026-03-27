import type { Assertion } from '$lib/assertions/types';

export type ExplanationKind = 'template' | 'transformation' | 'assertion';

export interface ExplanationDependency {
  kind: 'response' | 'transformation' | 'parameter' | 'environment' | 'function';
  reference: string;
}

export interface ExplanationResult {
  kind: ExplanationKind;
  valid: boolean;
  summary: string;
  plainEnglish: string;
  outputType: string;
  dependencies: ExplanationDependency[];
  warnings: string[];
}

export interface TemplateSuggestionInput {
  source: 'res' | 'proc' | 'param' | 'func' | 'env';
  preserveType?: boolean;
  stepEndpointRef?: string;
  endpointIndex?: number;
  jsonPath?: string;
  alias?: string;
  nestedPath?: string;
  parameterName?: string;
  environmentName?: string;
  functionName?: string;
  functionArgs?: Array<string | number | boolean | null>;
}

export interface TemplateSuggestionResult {
  expression: string;
  explanation: ExplanationResult;
}

export interface AssertionExplanationInput {
  assertion: Assertion;
}
