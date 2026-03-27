import type { Assertion } from '$lib/assertions/types';
import { parseTemplateExpression } from '$lib/template';
import type {
  ExplanationDependency,
  ExplanationResult,
  TemplateSuggestionInput,
  TemplateSuggestionResult
} from './types';

function templateWrappers(preserveType = false): [string, string] {
  return preserveType ? ['{{{', '}}}'] : ['{{', '}}'];
}

function formatTemplate(source: string, path: string, preserveType = false): string {
  const [open, close] = templateWrappers(preserveType);
  return `${open}${source}:${path}${close}`;
}

function splitPipeline(expression: string): string[] {
  const parts: string[] = [];
  let current = '';
  let parenDepth = 0;
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < expression.length; i += 1) {
    const char = expression[i];
    const prev = expression[i - 1];

    if ((char === '"' || char === "'") && prev !== '\\') {
      if (quote === char) {
        quote = null;
      } else if (!quote) {
        quote = char;
      }
      current += char;
      continue;
    }

    if (!quote) {
      if (char === '(') {
        parenDepth += 1;
      } else if (char === ')') {
        parenDepth = Math.max(0, parenDepth - 1);
      } else if (char === '|' && parenDepth === 0) {
        const trimmed = current.trim();
        if (trimmed) {
          parts.push(trimmed);
        }
        current = '';
        continue;
      }
    }

    current += char;
  }

  const trimmed = current.trim();
  if (trimmed) {
    parts.push(trimmed);
  }

  return parts;
}

function findTemplateExpressions(input: string): string[] {
  return input.match(/\{\{\{[^}]+\}\}\}|\{\{[^}]+\}\}/g) ?? [];
}

function dedupeDependencies(items: ExplanationDependency[]): ExplanationDependency[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.kind}:${item.reference}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function guessTemplateOutputType(source: string, preserveType: boolean): string {
  if (source === 'func') return preserveType ? 'function result' : 'string';
  if (source === 'param' || source === 'env') return preserveType ? 'parameter value' : 'string';
  return preserveType ? 'resolved value' : 'string';
}

function parseFunctionCall(path: string): { name: string; args: string[] } | null {
  const match = path.match(/^([A-Za-z_][A-Za-z0-9_]*)\((.*)\)$/);
  if (!match) return null;

  const [, name, argsString] = match;
  if (!argsString.trim()) {
    return { name, args: [] };
  }

  return {
    name,
    args: argsString.split(',').map((part) => part.trim())
  };
}

export function explainTemplateExpression(expression: string): ExplanationResult {
  const parsed = parseTemplateExpression(expression);
  if (!parsed) {
    return {
      kind: 'template',
      valid: false,
      summary: 'Invalid template expression',
      plainEnglish: 'This string does not match the supported Test-Pilot template syntax.',
      outputType: 'unknown',
      dependencies: [],
      warnings: ['Expected {{source:path}} or {{{source:path}}} syntax.']
    };
  }

  const warnings: string[] = [];
  const dependencies: ExplanationDependency[] = [];

  if (parsed.source === 'res') {
    const match = parsed.path.match(/^([A-Za-z0-9_-]+-\d+)(\.(.+))?$/);
    const stepEndpointRef = match?.[1];
    const jsonPath = match?.[3];
    const possibleMissingEndpointIndex = !stepEndpointRef ? parsed.path.match(/^([A-Za-z0-9_-]+)(\.(.+))?$/) : null;

    if (stepEndpointRef) {
      dependencies.push({ kind: 'response', reference: stepEndpointRef });
    } else {
      const candidate = possibleMissingEndpointIndex ? possibleMissingEndpointIndex[1] : undefined;
      const candidateJsonPath = possibleMissingEndpointIndex ? possibleMissingEndpointIndex[3] : undefined;
      if (candidate) {
        warnings.push(`Response reference is missing an endpoint index. Did you mean ${formatTemplate('res', `${candidate}-0${candidateJsonPath ? `.${candidateJsonPath}` : ''}`, parsed.preserveType)}?`);
      } else {
        warnings.push('Response reference does not include a valid step-endpoint reference like step1-0.');
      }
    }

    return {
      kind: 'template',
      valid: Boolean(stepEndpointRef),
      summary: 'Response reference',
      plainEnglish: stepEndpointRef
        ? jsonPath
          ? `Gets ${jsonPath} from the response body of ${stepEndpointRef}.`
          : `Gets the full response body from ${stepEndpointRef}.`
        : 'Gets data from a previous endpoint response.',
      outputType: guessTemplateOutputType(parsed.source, parsed.preserveType),
      dependencies,
      warnings: parsed.preserveType
        ? warnings
        : [...warnings, 'Double braces are usually rendered as strings inside JSON bodies.']
    };
  }

  if (parsed.source === 'proc') {
    const separatorIndex = parsed.path.indexOf('.$.');
    const rawStepEndpointRef = separatorIndex >= 0 ? parsed.path.slice(0, separatorIndex) : '';
    const stepEndpointRef = /-\d+$/.test(rawStepEndpointRef) ? rawStepEndpointRef : '';
    const aliasPath = separatorIndex >= 0 ? parsed.path.slice(separatorIndex + 3) : parsed.path;
    const [alias, ...rest] = aliasPath.split('.');
    const nestedPath = rest.length > 0 ? rest.join('.') : '';
    const candidateMatch =
      !stepEndpointRef && rawStepEndpointRef
        ? [parsed.path, rawStepEndpointRef, aliasPath]
        : !stepEndpointRef
          ? parsed.path.match(/^([A-Za-z0-9_-]+)\.\$\.(.+)$/)
          : null;

    if (stepEndpointRef) {
      dependencies.push({ kind: 'transformation', reference: `${stepEndpointRef}:${alias}` });
    } else {
      if (candidateMatch) {
        warnings.push(`Transformation reference is missing an endpoint index. Did you mean ${formatTemplate('proc', `${candidateMatch[1]}-0.$.${candidateMatch[2]}`, parsed.preserveType)}? Step references require a -<endpointIndex> suffix.`);
      } else {
        warnings.push('Transformation reference should include a step-endpoint prefix like step2-0.$.alias.');
      }
    }

    return {
      kind: 'template',
      valid: Boolean(stepEndpointRef && alias),
      summary: 'Transformation reference',
      plainEnglish:
        stepEndpointRef && alias
          ? nestedPath
            ? `Gets transformed value "${alias}" from ${stepEndpointRef} and then reads ${nestedPath}.`
            : `Gets transformed value "${alias}" from ${stepEndpointRef}.`
          : 'Gets data produced by a previous transformation.',
      outputType: guessTemplateOutputType(parsed.source, parsed.preserveType),
      dependencies,
      warnings
    };
  }

  if (parsed.source === 'param') {
    dependencies.push({ kind: 'parameter', reference: parsed.path });
    return {
      kind: 'template',
      valid: true,
      summary: 'Flow parameter reference',
      plainEnglish: `Reads flow parameter "${parsed.path}".`,
      outputType: guessTemplateOutputType(parsed.source, parsed.preserveType),
      dependencies,
      warnings
    };
  }

  if (parsed.source === 'env') {
    dependencies.push({ kind: 'environment', reference: parsed.path });
    return {
      kind: 'template',
      valid: true,
      summary: 'Environment variable reference',
      plainEnglish: `Reads environment variable "${parsed.path}".`,
      outputType: guessTemplateOutputType(parsed.source, parsed.preserveType),
      dependencies,
      warnings
    };
  }

  const fnCall = parseFunctionCall(parsed.path);
  if (!fnCall) {
    return {
      kind: 'template',
      valid: false,
      summary: 'Invalid function template',
      plainEnglish: 'This function template is missing a valid function call format.',
      outputType: 'unknown',
      dependencies: [],
      warnings: ['Expected func:name(arg1,arg2) syntax.']
    };
  }

  dependencies.push({ kind: 'function', reference: fnCall.name });
  return {
    kind: 'template',
    valid: true,
    summary: 'Template function call',
    plainEnglish:
      fnCall.args.length > 0
        ? `Calls template function "${fnCall.name}" with arguments ${fnCall.args.join(', ')}.`
        : `Calls template function "${fnCall.name}" with no arguments.`,
    outputType: guessTemplateOutputType(parsed.source, parsed.preserveType),
    dependencies,
    warnings
  };
}

const transformOperationDescriptions: Record<string, string> = {
  where: 'filters the current collection to only items that match the condition',
  map: 'reshapes each item into a new value or object',
  count: 'counts how many items remain',
  first: 'takes the first item',
  last: 'takes the last item',
  flatten: 'flattens nested arrays',
  sort: 'sorts the collection',
  take: 'keeps the first N items',
  skip: 'drops the first N items',
  at: 'takes the item at a specific index',
  sum: 'adds numeric values together',
  int: 'casts values to integers',
  float: 'casts values to floats',
  string: 'casts values to strings',
  bool: 'casts values to booleans',
  add: 'adds a numeric value',
  sub: 'subtracts a numeric value',
  mul: 'multiplies by a numeric value',
  div: 'divides by a numeric value',
  mod: 'applies modulo arithmetic',
  transform: 'runs a nested transformation'
};

function explainTransformStage(stage: string): { summary: string; outputType: string; warnings: string[] } {
  if (stage.startsWith('{{')) {
    const explanation = explainTemplateExpression(stage);
    return {
      summary: `evaluates template expression: ${explanation.plainEnglish}`,
      outputType: explanation.outputType,
      warnings: []
    };
  }

  const fnMatch = stage.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:\((.*)\))?$/);
  if (!fnMatch) {
    if (stage.startsWith('$')) {
      return {
        summary: `extracts data from the current payload using JSONPath ${stage}`,
        outputType: 'extracted value',
        warnings: []
      };
    }

    return {
      summary: `applies custom stage ${stage}`,
      outputType: 'unknown',
      warnings: ['Could not classify this pipeline stage; it may use advanced syntax.']
    };
  }

  const [, name, rawArgs = ''] = fnMatch;
  const detail = transformOperationDescriptions[name] ?? 'applies a pipeline operation';
  const argsText = rawArgs.trim() ? ` with arguments ${rawArgs.trim()}` : '';

  let outputType = 'transformed value';
  if (name === 'count' || name === 'sum' || name === 'int' || name === 'float') outputType = 'number';
  if (name === 'first' || name === 'last' || name === 'at') outputType = 'single item';
  if (name === 'bool') outputType = 'boolean';
  if (name === 'string') outputType = 'string';
  if (['where', 'map', 'flatten', 'sort', 'take', 'skip'].includes(name)) outputType = 'collection';

  return {
    summary: `${detail}${argsText}`,
    outputType,
    warnings: transformOperationDescriptions[name] ? [] : [`Unknown pipeline function "${name}".`]
  };
}

export function explainTransformationExpression(expression: string): ExplanationResult {
  const stages = splitPipeline(expression);
  if (stages.length === 0) {
    return {
      kind: 'transformation',
      valid: false,
      summary: 'Invalid transformation expression',
      plainEnglish: 'This transformation is empty.',
      outputType: 'unknown',
      dependencies: [],
      warnings: ['Provide a JSONPath or pipeline expression.']
    };
  }

  const warnings: string[] = [];
  const dependencies = dedupeDependencies(
    findTemplateExpressions(expression).flatMap((template) => explainTemplateExpression(template).dependencies)
  );

  const stageExplanations = stages.map(explainTransformStage);
  warnings.push(...stageExplanations.flatMap((stage) => stage.warnings));

  return {
    kind: 'transformation',
    valid: !warnings.some((warning) => warning.startsWith('Unknown')),
    summary: `Transformation pipeline with ${stages.length} stage${stages.length === 1 ? '' : 's'}`,
    plainEnglish: stageExplanations
      .map((stage, index) => `${index === 0 ? 'First' : 'Then'} it ${stage.summary}.`)
      .join(' '),
    outputType: stageExplanations[stageExplanations.length - 1]?.outputType ?? 'unknown',
    dependencies,
    warnings
  };
}

const operatorDescriptions: Record<string, string> = {
  equals: 'must equal',
  not_equals: 'must not equal',
  contains: 'must contain',
  exists: 'must exist',
  greater_than: 'must be greater than',
  less_than: 'must be less than',
  starts_with: 'must start with',
  ends_with: 'must end with',
  matches_regex: 'must match regex',
  is_empty: 'must be empty',
  is_not_empty: 'must not be empty',
  greater_than_or_equal: 'must be greater than or equal to',
  less_than_or_equal: 'must be less than or equal to',
  between: 'must be between',
  not_between: 'must not be between',
  has_length: 'must have length',
  length_greater_than: 'must have length greater than',
  length_less_than: 'must have length less than',
  contains_all: 'must contain all values',
  contains_any: 'must contain at least one value from',
  not_contains_any: 'must contain none of the values from',
  one_of: 'must be one of',
  not_one_of: 'must not be one of',
  is_type: 'must be of type',
  is_null: 'must be null',
  is_not_null: 'must not be null'
};

function describeAssertionTarget(assertion: Assertion): string {
  if (assertion.assertion_type === 'status_code') return 'the HTTP status code';
  if (assertion.assertion_type === 'response_time') return 'the response time';
  if (assertion.assertion_type === 'header') return `header "${assertion.data_id}"`;
  return assertion.data_id === 'status_code'
    ? 'the HTTP status code'
    : `response body field "${assertion.data_id}"`;
}

export function explainAssertion(assertion: Assertion): ExplanationResult {
  const warnings: string[] = [];
  const dependencies: ExplanationDependency[] = [];
  const operatorText = operatorDescriptions[assertion.operator] ?? assertion.operator;
  const target = describeAssertionTarget(assertion);

  if (!assertion.enabled) {
    warnings.push('This assertion is disabled and will not affect execution results.');
  }

  if (typeof assertion.expected_value === 'string') {
    const templates = findTemplateExpressions(assertion.expected_value);
    for (const template of templates) {
      dependencies.push(...explainTemplateExpression(template).dependencies);
    }
  }

  if ((assertion.operator === 'between' || assertion.operator === 'not_between') && !Array.isArray(assertion.expected_value)) {
    warnings.push(`Operator "${assertion.operator}" usually expects a two-item array.`);
  }

  return {
    kind: 'assertion',
    valid: true,
    summary: 'Assertion rule',
    plainEnglish:
      assertion.operator === 'is_null' || assertion.operator === 'is_not_null' || assertion.operator === 'exists'
        ? `Checks that ${target} ${operatorText}.`
        : `Checks that ${target} ${operatorText} ${JSON.stringify(assertion.expected_value)}.`,
    outputType: 'boolean',
    dependencies: dedupeDependencies(dependencies),
    warnings
  };
}

export function suggestTemplateExpression(input: TemplateSuggestionInput): TemplateSuggestionResult {
  let expression = '';
  const stepRef =
    input.stepEndpointRef && /-\d+$/.test(input.stepEndpointRef)
      ? input.stepEndpointRef
      : input.stepEndpointRef
        ? `${input.stepEndpointRef}-${input.endpointIndex ?? 0}`
        : input.stepEndpointRef;

  if (input.source === 'res') {
    if (!stepRef) {
      throw new Error('stepEndpointRef is required for response references');
    }
    expression = formatTemplate(input.source, `${stepRef}${input.jsonPath ? `.${input.jsonPath}` : ''}`, input.preserveType);
  } else if (input.source === 'proc') {
    if (!stepRef || !input.alias) {
      throw new Error('stepEndpointRef and alias are required for transformation references');
    }
    const path = `${stepRef}.$.${input.alias}${input.nestedPath ? `.${input.nestedPath}` : ''}`;
    expression = formatTemplate(input.source, path, input.preserveType);
  } else if (input.source === 'param') {
    if (!input.parameterName) {
      throw new Error('parameterName is required for parameter references');
    }
    expression = formatTemplate(input.source, input.parameterName, input.preserveType);
  } else if (input.source === 'env') {
    if (!input.environmentName) {
      throw new Error('environmentName is required for environment references');
    }
    expression = formatTemplate(input.source, input.environmentName, input.preserveType);
  } else {
    if (!input.functionName) {
      throw new Error('functionName is required for function references');
    }
    const args = (input.functionArgs ?? [])
      .map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
      .join(', ');
    expression = formatTemplate(input.source, `${input.functionName}(${args})`, input.preserveType);
  }

  return {
    expression,
    explanation: explainTemplateExpression(expression)
  };
}
