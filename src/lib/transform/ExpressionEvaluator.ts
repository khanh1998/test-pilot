/**
 * SafeExpressionEvaluator
 * A secure evaluator for the transformation expression language.
 */
import type { TemplateContext } from '../template/types';
import { ASTEvaluator, ExpressionParser } from './ExpressionParser';
import { createOperators } from './PipelineFunctions';

export class SafeExpressionEvaluator {
  private templateContext: TemplateContext = {
    responses: {},
    transformedData: {},
    parameters: {},
    environment: {},
    functions: {}
  };

  private operators: Record<string, (...args: unknown[]) => unknown>;

  constructor() {
    this.operators = createOperators(
      (condition, context) => Boolean(this.evaluate(condition, context)),
      (expression, context) => this.evaluate(expression, context)
    );
  }

  setTemplateContext(context: Partial<TemplateContext>): void {
    this.templateContext = {
      ...this.templateContext,
      ...context
    };
  }

  setParameters(params: Record<string, unknown>): void {
    this.templateContext.parameters = { ...params };
  }

  getTemplateContext(): TemplateContext {
    return { ...this.templateContext };
  }

  evaluate(expression: string, data: unknown, params?: Record<string, unknown>): unknown {
    if (params) {
      this.setParameters(params);
    }

    const trimmed = expression.trim();
    if (!trimmed) {
      return data;
    }

    const parser = new ExpressionParser();
    const ast = parser.parseExpression(trimmed);
    const evaluator = new ASTEvaluator(this.templateContext, this.operators);
    return evaluator.evaluate(ast, data);
  }
}
