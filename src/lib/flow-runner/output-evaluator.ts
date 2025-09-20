import type { FlowOutput } from '$lib/components/test-flows/types';
import { resolveTemplate, createTemplateContextFromFlowRunner } from '$lib/template';
import { createTemplateFunctions, defaultTemplateFunctions } from '$lib/template';
import { PipelineHelpers } from '$lib/transform/PipelineFunctions';

export interface OutputEvaluatorContext {
  outputs: FlowOutput[];
  storedResponses: Record<string, unknown>;
  storedTransformations: Record<string, Record<string, unknown>>;
  parameterValues: Record<string, unknown>;
  environmentVariables: Record<string, unknown>;
  addLog: (level: 'info' | 'debug' | 'error' | 'warning', message: string, details?: string) => void;
}

export class FlowOutputEvaluator {
  private context: OutputEvaluatorContext;
  private templateFunctions: any;

  constructor(context: OutputEvaluatorContext) {
    this.context = context;
    this.templateFunctions = createTemplateFunctions({
      responses: {},
      transformedData: {},
      parameters: {},
      functions: defaultTemplateFunctions
    });
  }

  evaluateOutputs(): Record<string, unknown> {
    const results: Record<string, unknown> = {};
    
    if (!this.context.outputs || this.context.outputs.length === 0) {
      return results;
    }

    this.context.addLog('info', 'Evaluating flow outputs', `${this.context.outputs.length} outputs to evaluate`);

    for (const output of this.context.outputs) {
      try {
        let result: unknown;
        
        if (output.isTemplate && output.value) {
          result = this.resolveTemplateValue(output.value);
          
          // Apply type casting if requested and type is specified
          if (output.castToType && output.type) {
            result = this.castToType(result, output.type);
            this.context.addLog('debug', `Output "${output.name}" cast to type "${output.type}"`, String(result));
          }
        } else {
          result = output.value;
        }
        
        results[output.name] = result;
        this.context.addLog('debug', `Output "${output.name}" evaluated successfully`, String(results[output.name]));
      } catch (outputError: unknown) {
        const errorMessage = outputError instanceof Error ? outputError.message : String(outputError);
        this.context.addLog('error', `Failed to evaluate output "${output.name}"`, errorMessage);
        results[output.name] = null;
      }
    }

    return results;
  }

  private resolveTemplateValue(value: string): unknown {
    try {
      const context = createTemplateContextFromFlowRunner(
        this.context.storedResponses,
        this.context.storedTransformations,
        this.context.parameterValues,
        this.templateFunctions,
        this.context.environmentVariables
      );
      
      const result = resolveTemplate(value, context);
      return result;
    } catch (error) {
      this.context.addLog('error', `Template resolution failed for "${value}"`, 
        error instanceof Error ? error.message : String(error));
      return value;
    }
  }

  private castToType(value: unknown, type: string): unknown {
    try {
      switch (type) {
        case 'string':
          return PipelineHelpers.castToString(value);
        case 'number':
          return PipelineHelpers.castToFloat(value);
        case 'boolean':
          return PipelineHelpers.castToBool(value);
        case 'object':
          // For objects, try to parse if it's a string, otherwise return as-is
          if (typeof value === 'string') {
            try {
              return JSON.parse(value);
            } catch {
              return value;
            }
          }
          return value;
        case 'array':
          // For arrays, try to parse if it's a string, otherwise wrap in array if not already
          if (typeof value === 'string') {
            try {
              const parsed = JSON.parse(value);
              return Array.isArray(parsed) ? parsed : [value];
            } catch {
              return [value];
            }
          }
          return Array.isArray(value) ? value : [value];
        case 'null':
          return null;
        default:
          this.context.addLog('warning', `Unknown type "${type}" for casting, returning value as-is`);
          return value;
      }
    } catch (error) {
      this.context.addLog('error', `Type casting failed for type "${type}"`, 
        error instanceof Error ? error.message : String(error));
      return value;
    }
  }
}
