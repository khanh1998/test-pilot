import type { FlowOutput } from '$lib/components/test-flows/types';
import { resolveTemplate, createTemplateContextFromFlowRunner } from '$lib/template';
import { createTemplateFunctions, defaultTemplateFunctions } from '$lib/template';

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
        if (output.isTemplate && output.value) {
          const result = this.resolveTemplateValue(output.value);
          
          try {
            if (result.startsWith('{') || result.startsWith('[') || result.startsWith('"')) {
              results[output.name] = JSON.parse(result);
            } else {
              results[output.name] = result;
            }
          } catch {
            results[output.name] = result;
          }
        } else {
          results[output.name] = output.value;
        }
        
        this.context.addLog('debug', `Output "${output.name}" evaluated successfully`, String(results[output.name]));
      } catch (outputError: unknown) {
        const errorMessage = outputError instanceof Error ? outputError.message : String(outputError);
        this.context.addLog('error', `Failed to evaluate output "${output.name}"`, errorMessage);
        results[output.name] = null;
      }
    }

    return results;
  }

  private resolveTemplateValue(value: string): string {
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
}
