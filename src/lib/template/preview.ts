import { createTemplateFunctions } from './functions';
import { parseTemplateExpression, resolveTemplateExpression } from './engine';
import type { TemplateContext, TemplateResolutionResult } from './types';

export type PreviewValueSource = 'latest-run' | 'static';

export interface PreviewSourceInfo {
  source: PreviewValueSource;
  label: string;
  key?: string;
}

export interface TemplatePreviewContext extends TemplateContext {
  responseSources: Record<string, PreviewSourceInfo>;
}

export interface PreviewExecutionStateEntry {
  response: {
    body?: unknown;
  };
}

export type PreviewExecutionState = Record<string, PreviewExecutionStateEntry | unknown>;

export interface TemplatePreviewResult {
  success: boolean;
  value: unknown;
  error?: string;
  sources: PreviewSourceInfo[];
}

export function buildTemplatePreviewContext(params: {
  executionState: PreviewExecutionState;
  baseContext: TemplateContext;
}): TemplatePreviewContext {
  const responses: Record<string, unknown> = { ...params.baseContext.responses };
  const transformedData = { ...params.baseContext.transformedData };
  const responseSources: Record<string, PreviewSourceInfo> = {};

  for (const [responseKey, executionEntry] of Object.entries(params.executionState)) {
    if (hasExecutionResponseBody(executionEntry)) {
      responses[responseKey] = executionEntry.response.body;
      responseSources[responseKey] = {
        source: 'latest-run',
        label: 'latest run',
        key: responseKey
      };
    }
  }

  for (const responseKey of Object.keys(responses)) {
    responseSources[responseKey] ||= {
      source: 'latest-run',
      label: 'latest run',
      key: responseKey
    };
  }

  const contextForFunctions: TemplateContext = {
    responses,
    transformedData,
    parameters: params.baseContext.parameters,
    environment: params.baseContext.environment,
    functions: params.baseContext.functions
  };

  return {
    ...contextForFunctions,
    functions: createTemplateFunctions(contextForFunctions),
    responseSources
  };
}

export function previewTemplateValue(
  input: string,
  context: TemplatePreviewContext | TemplateContext
): TemplatePreviewResult {
  const result: TemplateResolutionResult = resolveTemplateExpression(input, context);
  const sources = getPreviewSources(input, context);

  return {
    success: result.success,
    value: result.value,
    error: result.error,
    sources
  };
}

export function previewTemplateObject(
  input: unknown,
  context: TemplatePreviewContext | TemplateContext
): TemplatePreviewResult {
  if (input === null || input === undefined) {
    return { success: true, value: input, sources: [] };
  }

  const serialized = typeof input === 'string' ? input : JSON.stringify(input);
  const result = previewTemplateValue(serialized, context);

  if (!result.success || typeof result.value !== 'string') {
    return result;
  }

  try {
    return {
      ...result,
      value: JSON.parse(result.value)
    };
  } catch {
    return result;
  }
}

export function getResponseSourceForKey(
  context: TemplatePreviewContext | TemplateContext | null | undefined,
  responseKey: string
): PreviewSourceInfo | null {
  if (!context || !('responseSources' in context)) {
    return null;
  }

  return context.responseSources[responseKey] || null;
}

function getPreviewSources(
  input: string,
  context: TemplatePreviewContext | TemplateContext
): PreviewSourceInfo[] {
  const sourceByKey = new Map<string, PreviewSourceInfo>();
  const matches = input.match(/\{\{\{?[^}]+\}\}\}?/g) || [];

  for (const match of matches) {
    const expression = parseTemplateExpression(match);
    if (!expression || (expression.source !== 'res' && expression.source !== 'proc')) {
      continue;
    }

    const responseKey = getResponseKeyFromExpressionPath(expression.path);
    if (!responseKey) {
      continue;
    }

    const source = getResponseSourceForKey(context, responseKey) || {
      source: 'static' as const,
      label: 'provided context',
      key: responseKey
    };
    sourceByKey.set(responseKey, source);
  }

  return [...sourceByKey.values()];
}

function getResponseKeyFromExpressionPath(path: string): string | null {
  const firstDotIndex = path.indexOf('.');
  return firstDotIndex > 0 ? path.substring(0, firstDotIndex) : path || null;
}

function hasExecutionResponseBody(entry: unknown): entry is PreviewExecutionStateEntry {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    'response' in entry &&
    typeof (entry as PreviewExecutionStateEntry).response === 'object' &&
    (entry as PreviewExecutionStateEntry).response !== null &&
    (entry as PreviewExecutionStateEntry).response?.body !== undefined
  );
}
