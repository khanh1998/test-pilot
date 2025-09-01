/**
 * SafeExpressionEvaluator
 * A secure evaluator for expression language used in data transformations
 */
import { SafeJSONPathEvaluator } from './JSONPathEvaluator';
import type { TemplateContext } from '../template/types';
import { ASTEvaluator, ExpressionParser } from './ExpressionParser';
import { createOperators, createPipelineFunctions, PipelineHelpers, type PipelineFunction } from './PipelineFunctions';

export class SafeExpressionEvaluator {
  private jsonPathEvaluator = new SafeJSONPathEvaluator();
  private templateContext: TemplateContext = {
    responses: {},
    transformedData: {},
    parameters: {},
    environment: {},
    functions: {}
  };
  
  // Operators and pipeline functions - created lazily to avoid circular dependencies
  private operators: Record<string, (...args: unknown[]) => unknown>;
  private pipelineFunctions: Record<string, PipelineFunction>;
  
  constructor() {
    // Create operators and pipeline functions with bound context methods
    this.operators = createOperators(
      this.evaluateConditionWithContext.bind(this),
      this.evaluateWithContext.bind(this)
    );
    
    this.pipelineFunctions = createPipelineFunctions(
      this.evaluateConditionWithContext.bind(this),
      this.evaluateWithContext.bind(this)
    );
  }
  /**
   * Set template context for template substitution
   * @param context - Template context with responses, parameters, etc.
   */
  setTemplateContext(context: Partial<TemplateContext>): void {
    this.templateContext = {
      ...this.templateContext,
      ...context
    };
  }
  
  /**
   * Set parameters for template substitution (convenience method)
   * @param params - Parameters to use for {{param:name}} substitution
   */
  setParameters(params: Record<string, unknown>): void {
    this.templateContext.parameters = { ...params };
  }
  
  /**
   * Get current template context
   * @returns Current template context
   */
  getTemplateContext(): TemplateContext {
    return { ...this.templateContext };
  }
  /**
   * Evaluate an expression using the data context
   * @param expression - The expression to evaluate
   * @param data - The data context to evaluate against
   * @param params - Optional parameters for template substitution
   * @returns The result of the evaluation
   */
  evaluate(expression: string, data: unknown, params?: Record<string, unknown>): unknown {
    // Set parameters if provided
    if (params) {
      this.setParameters(params);
    }
    
    // Don't substitute templates here - let the AST evaluator handle it per operand
    expression = expression.trim();
    
    // Check for pipeline notation (| but not ||)
    if (this.isPipelineExpression(expression)) {
      return this.evaluatePipeline(expression, data);
    }
    
    // Check for JSONPath notation - but only if it doesn't contain operators
    if (expression.startsWith('$') && !this.containsOperators(expression)) {
      return this.jsonPathEvaluator.evaluate(expression, data);
    }
    
    // Parse and evaluate expression
    try {
      const parser = new ExpressionParser();
      const ast = parser.parseExpression(expression);
      const evaluator = new ASTEvaluator(this.operators, this.jsonPathEvaluator, this.templateContext);
      return evaluator.evaluate(ast, data);
    } catch (error) {
      console.error('Error evaluating expression:', error);
      return null;
    }
  }

  /**
   * Evaluate a pipeline expression
   * @param expression - Pipeline expression like "data | where(age > 18) | map(name)"
   * @param data - The data context
   * @returns The transformed data
   */
  private evaluatePipeline(expression: string, data: unknown): unknown {
    // Split by pipe operator, but respect parentheses to avoid splitting on || inside functions
    const steps = this.splitPipelineSteps(expression);
    
    // The first part is the data reference
    let initialData: unknown;
    const firstStep = steps[0];
    
    if (firstStep.startsWith('$')) {
      initialData = this.jsonPathEvaluator.evaluate(firstStep, data);
    } else if (firstStep === 'data') {
      initialData = data;
    } else {
      // Check if the first step is a function call (like in "float(0) | int()")
      const functionMatch = firstStep.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*)\)$/);
      if (functionMatch) {
        const functionName = functionMatch[1];
        const argsString = functionMatch[2].trim();
        
        if (['int', 'float', 'string', 'bool'].includes(functionName)) {
          const castFunction = this.operators[functionName];
          if (typeof castFunction === 'function') {
            if (argsString) {
              const defaultValue = this.parseArgumentValue(argsString);
              initialData = castFunction(data, defaultValue);
            } else {
              initialData = castFunction(data);
            }
          } else {
            initialData = null;
          }
        } else {
          initialData = null;
        }
      } else {
        initialData = null;
      }
    }
    
    // Process each pipeline step
    let result = initialData;
    
    for (let i = 1; i < steps.length; i++) {
      const step = steps[i];
      result = this.executePipelineStep(step, result);
    }
    
    return result;
  }
  
  /**
   * Split pipeline expression by | operator while respecting parentheses
   * @param expression - Pipeline expression
   * @returns Array of pipeline steps
   */
  private splitPipelineSteps(expression: string): string[] {
    const steps: string[] = [];
    let current = '';
    let parenthesesLevel = 0;
    
    for (let i = 0; i < expression.length; i++) {
      const char = expression[i];
      
      if (char === '(') {
        parenthesesLevel++;
        current += char;
      } else if (char === ')') {
        parenthesesLevel--;
        current += char;
      } else if (char === '|' && parenthesesLevel === 0) {
        // Only split on | when not inside parentheses
        if (i + 1 < expression.length && expression[i + 1] === '|') {
          // This is ||, not a pipeline separator - add both characters and skip next
          current += '||';
          i++; // Skip the next |
        } else {
          // This is a pipeline separator
          steps.push(current.trim());
          current = '';
        }
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      steps.push(current.trim());
    }
    
    return steps;
  }
  
  /**
   * Execute a single pipeline step
   * @param step - Step like "where(age > 18)" or "map(name: item.name)"
   * @param data - Current data in the pipeline
   * @returns Transformed data
   */
  /**
   * Evaluate an argument expression that might contain templates
   * @param expression - Argument expression
   * @param data - Data context
   * @returns Evaluated result
   */
  private evaluateArgumentExpression(expression: string, data: unknown): unknown {
    // If it's a simple number, return it directly
    if (/^\d+$/.test(expression.trim())) {
      return parseInt(expression.trim(), 10);
    }
    
    // Use the AST evaluator for complex expressions including templates
    try {
      const parser = new ExpressionParser();
      const ast = parser.parseExpression(expression.trim());
      const evaluator = new ASTEvaluator(this.operators, this.jsonPathEvaluator, this.templateContext);
      return evaluator.evaluate(ast, data);
    } catch (error) {
      // Fallback to string value
      return expression;
    }
  }

  private executePipelineStep(step: string, data: unknown): unknown {
    // Parse function name and arguments
    const match = step.match(/^([a-zA-Z0-9_]+)\s*\((.*)\)$/);
    if (!match) {
      throw new Error(`Invalid pipeline step: ${step}`);
    }
    
    const functionName = match[1];
    const argsString = match[2].trim();
    
    // Get the pipeline function
    const pipelineFunction = this.pipelineFunctions[functionName];
    if (typeof pipelineFunction !== 'function') {
      throw new Error(`Unknown pipeline function: ${functionName}`);
    }
    
    // Parse arguments based on function name
    let args: unknown[];
    
    switch (functionName) {
      case 'where':
      case 'select':
        args = [data, argsString]; // Pass the raw condition string
        break;
        
      case 'map':
      case 'transform':
        if (argsString.includes(':')) {
          // Object transform notation: map(name: item.name, age: item.age)
          const transforms: Record<string, string> = {};
          const keyValuePairs = this.parseKeyValueArguments(argsString);
          
          for (const [key, value] of Object.entries(keyValuePairs)) {
            transforms[key] = String(value);
          }
          
          args = [data, transforms];
        } else {
          // Simple transform: map(item.name)
          args = [data, argsString];
        }
        break;
        
      case 'sort':
        const sortOptions: { by?: string, desc?: boolean } = {};
        const sortArgs = this.parseKeyValueArguments(argsString);
        
        if ('by' in sortArgs) {
          sortOptions.by = String(sortArgs.by);
        }
        
        if ('desc' in sortArgs) {
          sortOptions.desc = Boolean(sortArgs.desc);
        }
        
        args = [data, sortOptions];
        break;
        
      case 'take':
      case 'skip':
        // Evaluate the argument properly to handle templates, but only filter triple brackets in transformation context
        const evaluatedArg = this.templateContext ? this.evaluateArgumentExpression(argsString, data) : parseInt(argsString, 10);
        args = [data, Number(evaluatedArg)];
        break;
        
      case 'at':
        // For 'at', don't automatically convert to number to preserve null/undefined handling
        const atArg = this.templateContext ? this.evaluateArgumentExpression(argsString, data) : parseInt(argsString, 10);
        args = [data, atArg];
        break;
        
      case 'flatten':
        args = argsString ? [data, parseInt(argsString, 10)] : [data];
        break;
        
      case 'sum':
        args = argsString ? [data, argsString] : [data];
        break;
        
      case 'int':
      case 'float':
      case 'string':
      case 'bool':
        // Type casting functions with optional default value
        args = argsString ? [data, this.parseArgumentValue(argsString)] : [data];
        break;
        
      default:
        // Try to parse JSON-like arguments
        try {
          const parsedArgs = this.parseArguments(argsString);
          args = [data, ...parsedArgs];
        } catch {
          args = [data, argsString];
        }
    }
    
    // Execute the function with the parsed arguments directly
    // This is safer than using apply with unknown arguments
    if (args.length === 1) {
      return pipelineFunction(data);
    } else if (args.length === 2) {
      return pipelineFunction(data, args[1]);
    } else {
      console.error('Too many arguments for pipeline function', functionName);
      return pipelineFunction(data);
    }
  }
  
  /**
   * Parse key-value arguments like "by: 'name', desc: true"
   * @param argsString - Arguments string
   * @returns Object with key-value pairs
   */
  private parseKeyValueArguments(argsString: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    
    // Simple parsing - not handling nested structures
    const entries = argsString.split(',').map(entry => entry.trim());
    
    for (const entry of entries) {
      const colonIndex = entry.indexOf(':');
      if (colonIndex > 0) {
        const key = entry.substring(0, colonIndex).trim();
        const value = this.parseArgumentValue(entry.substring(colonIndex + 1).trim());
        result[key] = value;
      }
    }
    
    return result;
  }
  
  /**
   * Parse a list of arguments separated by commas
   * @param argsString - Arguments string
   * @returns Array of parsed argument values
   */
  private parseArguments(argsString: string): unknown[] {
    if (!argsString.trim()) {
      return [];
    }
    
    const args: unknown[] = [];
    const parts = argsString.split(',').map(p => p.trim());
    
    for (const part of parts) {
      args.push(this.parseArgumentValue(part));
    }
    
    return args;
  }
  
  /**
   * Parse a single argument value, handling strings, numbers, booleans
   * @param valueString - Value string
   * @returns Parsed value
   */
  private parseArgumentValue(valueString: string): unknown {
    // String literal
    if ((valueString.startsWith("'") && valueString.endsWith("'")) || 
        (valueString.startsWith('"') && valueString.endsWith('"'))) {
      return valueString.substring(1, valueString.length - 1);
    }
    
    // Boolean
    if (valueString === 'true') return true;
    if (valueString === 'false') return false;
    
    // Null
    if (valueString === 'null') return null;
    if (valueString === 'undefined') return undefined;
    
    // Number
    if (/^-?\d+(\.\d+)?$/.test(valueString)) {
      return parseFloat(valueString);
    }
    
    // Default to string
    return valueString;
  }
  
  /**
   * Evaluate a condition using data as the context
   * @param condition - Condition string
   * @param context - Data context
   * @returns Boolean result
   */
  private evaluateConditionWithContext(condition: string, context: unknown): boolean {
    try {
      const result = this.evaluateWithContext(condition, context);
      return Boolean(result);
    } catch {
      return false;
    }
  }
  
  /**
   * Evaluate an expression using data as the context
   * @param expression - Expression string
   * @param context - Data context
   * @returns Result of the evaluation
   */
  private evaluateWithContext(expression: string, context: unknown): unknown {
    // Don't substitute templates here - let the AST evaluator handle it per operand
    expression = expression.trim();
    
    // Check if it's a template expression (e.g., {{func:uuid()}})
    if (this.isTemplateExpression(expression)) {
      return expression; // Keep template expressions as-is
    }
    
    // Check if it's a simple function call like int(), float(), etc.
    const functionMatch = expression.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*)\)$/);
    if (functionMatch) {
      const functionName = functionMatch[1];
      const argsString = functionMatch[2].trim();
      
      // Check if it's a type casting function
      if (['int', 'float', 'string', 'bool'].includes(functionName)) {
        const castFunction = this.operators[functionName];
        if (typeof castFunction === 'function') {
          if (argsString) {
            const defaultValue = this.parseArgumentValue(argsString);
            return castFunction(context, defaultValue);
          } else {
            return castFunction(context);
          }
        }
      }
    }
    
    // Check for pipeline notation in the context (like "float(0) | int()")
    if (this.isPipelineExpression(expression)) {
      return this.evaluatePipeline(expression, context);
    }
    
    return this.evaluate(expression, context);
  }
  
  /**
   * Get a nested value from an object using dot notation
   * @param obj - Object to extract value from
   * @param path - Path to the value using dot notation
   * @returns The value at the specified path
   */
  private getNestedValue(obj: unknown, path: string): unknown {
    if (obj === null || obj === undefined) {
      return undefined;
    }
    
    if (path.startsWith('$.')) {
      return this.jsonPathEvaluator.evaluate(path, obj);
    }
    
    // Use PipelineHelpers for non-JSONPath dot notation
    return PipelineHelpers.getNestedValue(obj, path);
  }

  /**
   * Check if a string is a template expression (e.g., {{func:uuid()}})
   * With simplified template support, this is no longer needed for complex detection
   * @param str - String to check
   * @returns Whether the string is a template expression
   */
  private isTemplateExpression(str: string): boolean {
    return false; // Simplified - all template processing is handled by the engine
  }
  
  /**
   * Check if an expression contains operators that require expression parsing
   * @param expression - Expression to check
   * @returns Whether the expression contains operators
   */
  private containsOperators(expression: string): boolean {
    // List of operators that indicate this is an expression, not pure JSONPath
    const operatorPatterns = [
      /\s*(==|!=|>=|<=|>|<)\s*/,  // Comparison operators
      /\s*(&&|\|\|)\s*/,          // Logical operators
      /\s*!\s*/,                  // Negation operator
      /\s*(\+|-|\*|\/|%)\s*/      // Arithmetic operators
    ];
    
    return operatorPatterns.some(pattern => pattern.test(expression));
  }
  
  /**
   * Check if an expression is a pipeline expression (contains | but not ||)
   * @param expression - Expression to check
   * @returns Whether the expression is a pipeline
   */
  private isPipelineExpression(expression: string): boolean {
    // Check if it contains | but not as part of ||
    // Use a more compatible approach without lookbehind/lookahead
    // Replace all || with a placeholder, then check for remaining |
    const withoutLogicalOr = expression.replace(/\|\|/g, '__LOGICAL_OR__');
    return withoutLogicalOr.includes('|');
  }
}
