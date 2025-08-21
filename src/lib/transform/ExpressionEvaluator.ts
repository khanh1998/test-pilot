/**
 * SafeExpressionEvaluator
 * A secure evaluator for expression language used in data transformations
 */
import { SafeJSONPathEvaluator } from './JSONPathEvaluator';

// Generic node type for AST
type Node = {
  type: string;
  [key: string]: unknown;
};

// Binary operation node
type BinaryNode = Node & {
  left: Node;
  right: Node;
  operator: string;
};

// Unary operation node
type UnaryNode = Node & {
  operand: Node;
  operator: string;
};

// Pipeline function signature
type PipelineFunction = (data: unknown, ...args: unknown[]) => unknown;

export class SafeExpressionEvaluator {
  private jsonPathEvaluator = new SafeJSONPathEvaluator();
  
  // Operators available in expressions
  private operators: Record<string, (...args: unknown[]) => unknown> = {
    // Comparison
    '==': (a: unknown, b: unknown): boolean => a === b,
    '!=': (a: unknown, b: unknown): boolean => a !== b,
    '>': (a: unknown, b: unknown): boolean => this.safeNumericCompare(a, b, (x, y) => x > y),
    '<': (a: unknown, b: unknown): boolean => this.safeNumericCompare(a, b, (x, y) => x < y),
    '>=': (a: unknown, b: unknown): boolean => this.safeNumericCompare(a, b, (x, y) => x >= y),
    '<=': (a: unknown, b: unknown): boolean => this.safeNumericCompare(a, b, (x, y) => x <= y),
    
    // Logical
    '&&': (a: unknown, b: unknown): boolean => Boolean(a) && Boolean(b),
    '||': (a: unknown, b: unknown): boolean => Boolean(a) || Boolean(b),
    '!': (a: unknown): boolean => !Boolean(a),
    
    // String operations
    'contains': (a: unknown, b: unknown): boolean => String(a).includes(String(b)),
    'startsWith': (a: unknown, b: unknown): boolean => String(a).startsWith(String(b)),
    'endsWith': (a: unknown, b: unknown): boolean => String(a).endsWith(String(b)),
    'matches': (a: unknown, b: unknown): boolean => this.safeRegexMatch(a, b),
    
    // Utility
    'empty': (a: unknown): boolean => a === '' || a === null || a === undefined || 
      (Array.isArray(a) && a.length === 0) ||
      (typeof a === 'object' && a !== null && Object.keys(a).length === 0),
    'length': (a: unknown): number => Array.isArray(a) ? a.length : 
      (typeof a === 'string' ? a.length : 0)
  };
  
  // Pipeline functions for transformations
  private pipelineFunctions: Record<string, PipelineFunction> = {
    // Filtering
    'where': (data: unknown, condition: unknown): unknown[] => {
      if (!Array.isArray(data)) return [];
      const conditionStr = String(condition);
      
      return data.filter(item => {
        try {
          return Boolean(this.evaluateConditionWithContext(conditionStr, item));
        } catch {
          return false;
        }
      });
    },
    
    'select': (data: unknown, condition: unknown): unknown[] => {
      if (!Array.isArray(data)) return [];
      // We cast data to unknown[] since we already checked it's an array
      return this.pipelineFunctions.where(data, condition) as unknown[];
    },
    
    // Transformation
    'map': (data: unknown, transformer: unknown): unknown[] => {
      if (!Array.isArray(data)) return [];
      
      if (typeof transformer === 'string') {
        // Simple mapping like map(item => item.name)
        return data.map(item => {
          try {
            return this.evaluateWithContext(transformer, item);
          } catch {
            return null;
          }
        });
      } else if (typeof transformer === 'object' && transformer !== null) {
        // Object mapping like map(name: item.name, age: item.age)
        const transformMap = transformer as Record<string, unknown>;
        return data.map(item => {
          const result: Record<string, unknown> = {};
          
          for (const [key, expr] of Object.entries(transformMap)) {
            try {
              if (typeof expr === 'string') {
                result[key] = this.evaluateWithContext(expr, item);
              } else {
                result[key] = expr;
              }
            } catch {
              result[key] = null;
            }
          }
          
          return result;
        });
      }
      
      return [];
    },
    
    'transform': (data: unknown, transforms: unknown): unknown => {
      if (Array.isArray(data)) {
        return this.pipelineFunctions.map(data, transforms);
      }
      
      if (typeof transforms !== 'object' || transforms === null) {
        return data;
      }
      
      // Single object transform
      const result: Record<string, unknown> = {};
      const transformMap = transforms as Record<string, unknown>;
      
      for (const [key, expr] of Object.entries(transformMap)) {
        try {
          if (typeof expr === 'string') {
            result[key] = this.evaluateWithContext(expr, data);
          } else {
            result[key] = expr;
          }
        } catch {
          result[key] = null;
        }
      }
      
      return result;
    },
    
    // Aggregation
    'sum': (data: unknown, field?: unknown): number => {
      if (!Array.isArray(data)) return 0;
      const fieldStr = field !== undefined ? String(field) : undefined;
      
      return data.reduce((acc: number, item) => {
        let value = fieldStr ? this.getNestedValue(item, fieldStr) : item;
        const numValue = Number(value);
        return acc + (isNaN(numValue) ? 0 : numValue);
      }, 0);
    },
    
    'count': (data: unknown): number => {
      return Array.isArray(data) ? data.length : 0;
    },
    
    'first': (data: unknown): unknown => {
      return Array.isArray(data) && data.length > 0 ? data[0] : undefined;
    },
    
    'last': (data: unknown): unknown => {
      return Array.isArray(data) && data.length > 0 ? data[data.length - 1] : undefined;
    },
    
    // Sorting and slicing
    'sort': (data: unknown, options?: unknown): unknown[] => {
      if (!Array.isArray(data)) return [];
      
      let by: string | undefined;
      let desc = false;
      
      if (typeof options === 'object' && options !== null) {
        const optionsMap = options as Record<string, unknown>;
        by = optionsMap.by !== undefined ? String(optionsMap.by) : undefined;
        desc = Boolean(optionsMap.desc);
      }
      
      return [...data].sort((a, b) => {
        let valueA = by ? this.getNestedValue(a, by) : a;
        let valueB = by ? this.getNestedValue(b, by) : b;
        
        if (valueA === valueB) return 0;
        
        // Handle null/undefined values - treat them as distinct but both come first
        if (valueA === null && valueB === null) return 0;
        if (valueA === undefined && valueB === undefined) return 0;
        if (valueA === null && valueB === undefined) return desc ? 1 : -1;
        if (valueA === undefined && valueB === null) return desc ? -1 : 1;
        if (valueA === null || valueA === undefined) return desc ? 1 : -1;
        if (valueB === null || valueB === undefined) return desc ? -1 : 1;
        
        // Try numeric comparison first
        const numA = Number(valueA);
        const numB = Number(valueB);
        
        if (!isNaN(numA) && !isNaN(numB)) {
          // Both are valid numbers - use numeric comparison
          const result = numA - numB;
          return desc ? -result : result;
        }
        
        // Fall back to string comparison
        const strA = String(valueA);
        const strB = String(valueB);
        
        const result = strA.localeCompare(strB);
        return desc ? -result : result;
      });
    },
    
    'take': (data: unknown, n: unknown): unknown[] => {
      if (!Array.isArray(data)) return [];
      const count = Number(n);
      if (isNaN(count)) return data;
      return data.slice(0, count);
    },
    
    'skip': (data: unknown, n: unknown): unknown[] => {
      if (!Array.isArray(data)) return [];
      const count = Number(n);
      if (isNaN(count)) return data;
      return data.slice(count);
    },
    
    // Utility
    'flatten': (data: unknown, depth?: unknown): unknown[] => {
      if (!Array.isArray(data)) return [];
      const flattenDepth = depth !== undefined ? Number(depth) : 1;
      if (isNaN(flattenDepth) || flattenDepth <= 0) return data;
      
      // Simple flatten implementation
      const flatten = (arr: unknown[], currentDepth: number): unknown[] => {
        if (currentDepth <= 0) return arr;
        
        const result: unknown[] = [];
        for (const item of arr) {
          if (Array.isArray(item)) {
            result.push(...flatten(item, currentDepth - 1));
          } else {
            result.push(item);
          }
        }
        return result;
      };
      
      return flatten(data, flattenDepth);
    },
    
    'pick': (obj: unknown, keys: unknown): Record<string, unknown> => {
      if (typeof obj !== 'object' || obj === null) return {};
      if (!Array.isArray(keys)) return {};
      
      const result: Record<string, unknown> = {};
      const objMap = obj as Record<string, unknown>;
      
      for (const key of keys) {
        const keyStr = String(key);
        if (Object.prototype.hasOwnProperty.call(objMap, keyStr)) {
          result[keyStr] = objMap[keyStr];
        }
      }
      return result;
    }
  };
  
  /**
   * Evaluate an expression using the data context
   * @param expression - The expression to evaluate
   * @param data - The data context to evaluate against
   * @returns The result of the evaluation
   */
  evaluate(expression: string, data: unknown): unknown {
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
      const evaluator = new ASTEvaluator(this.operators, this.jsonPathEvaluator);
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
    const initialData = steps[0].startsWith('$') 
      ? this.jsonPathEvaluator.evaluate(steps[0], data)
      : steps[0] === 'data' ? data : null;
    
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
        args = [data, parseInt(argsString, 10)];
        break;
        
      case 'flatten':
        args = argsString ? [data, parseInt(argsString, 10)] : [data];
        break;
        
      case 'sum':
        args = argsString ? [data, argsString] : [data];
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
    // Check if it's a template expression (e.g., {{func:uuid()}})
    if (this.isTemplateExpression(expression)) {
      return expression; // Keep template expressions as-is
    }
    
    // Replace "item." with context path if needed - but only when it refers to the context item
    // Use word boundary to avoid replacing "item." within other words like "terminal_menu_item."
    if (/\bitem\./.test(expression)) {
      const contextObj = { item: context };
      expression = expression.replace(/\bitem\./g, '$.');
      return this.jsonPathEvaluator.evaluate(expression, contextObj);
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
    
    const pathParts = path.split('.');
    let current: unknown = obj;
    
    for (const part of pathParts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      
      current = (current as Record<string, unknown>)[part];
    }
    
    return current;
  }
  
  /**
   * Safely compare numeric values
   * @param a - First value
   * @param b - Second value
   * @param compareFn - Comparison function
   * @returns Boolean result of the comparison
   */
  private safeNumericCompare(a: unknown, b: unknown, compareFn: (a: number, b: number) => boolean): boolean {
    const numA = Number(a);
    const numB = Number(b);
    if (isNaN(numA) || isNaN(numB)) return false;
    return compareFn(numA, numB);
  }
  
  /**
   * Safely match a string against a regex pattern
   * @param str - String to test
   * @param pattern - Regex pattern
   * @returns Whether the string matches the pattern
   */
  private safeRegexMatch(str: unknown, pattern: unknown): boolean {
    // Convert inputs to strings
    const stringValue = String(str);
    const patternString = String(pattern);
    
    // Only allow safe regex patterns
    if (this.isUnsafeRegex(patternString)) {
      return false;
    }
    
    try {
      return new RegExp(patternString).test(stringValue);
    } catch {
      return false;
    }
  }
  
  /**
   * Check if a regex pattern might be unsafe
   * @param pattern - Regex pattern to check
   * @returns Whether the pattern is potentially unsafe
   */
  private isUnsafeRegex(pattern: string): boolean {
    // Check for potentially dangerous regex patterns
    const dangerousPatterns = [
      /\(\?=/,    // Positive lookahead
      /\*\*+/,     // Nested quantifiers
      /\{,?\d+,\d*\}/  // Complex repetition
    ];
    
    return dangerousPatterns.some(dangerous => dangerous.test(pattern));
  }
  
  /**
   * Check if a string is a template expression (e.g., {{func:uuid()}})
   * @param str - String to check
   * @returns Whether the string is a template expression
   */
  private isTemplateExpression(str: string): boolean {
    return typeof str === 'string' && str.includes('{{') && str.includes('}}');
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
    // We'll use a simple approach: look for | that's not preceded or followed by |
    const regex = /(?<!\|)\|(?!\|)/;
    return regex.test(expression);
  }
}

/**
 * ExpressionParser
 * Parses expressions into AST (Abstract Syntax Tree)
 */
class ExpressionParser {
  private precedence: Record<string, number> = {
    '||': 1,
    '&&': 2,
    '==': 3,
    '!=': 3,
    '<': 4,
    '<=': 4,
    '>': 4,
    '>=': 4,
    '+': 5,
    '-': 5,
    '*': 6,
    '/': 6,
    '%': 6,
    '!': 7
  };
  
  /**
   * Parse an expression string into an AST
   * @param expression - Expression to parse
   * @returns AST representing the expression
   */
  parseExpression(expression: string): Node {
    const tokens = this.tokenize(expression);
    const ast = this.parseTokens(tokens);
    return ast;
  }
  
  /**
   * Tokenize an expression into parts
   * @param expression - Expression to tokenize
   * @returns Array of tokens
   */
  private tokenize(expression: string): { type: string; value: string }[] {
    const tokens: { type: string; value: string }[] = [];
    // Match JSONPath, operators, identifiers, strings, numbers, and parentheses
    const regex = /(\$[.\w\[\]'":*]+)|(\|\||&&|==|!=|>=|<=|>|<|!|\+|-|\*|\/|%)|([a-zA-Z_][a-zA-Z0-9_]*)|('[^']*')|("[^"]*")|(\d+(?:\.\d+)?)|(\(|\))/g;
    
    let match;
    while ((match = regex.exec(expression)) !== null) {
      const [, jsonPath, operator, identifier, singleQuote, doubleQuote, number, paren] = match;
      
      if (jsonPath) {
        tokens.push({ type: 'jsonPath', value: jsonPath });
      } else if (operator) {
        tokens.push({ type: 'operator', value: operator });
      } else if (identifier) {
        tokens.push({ type: 'identifier', value: identifier });
      } else if (singleQuote) {
        tokens.push({ type: 'string', value: singleQuote });
      } else if (doubleQuote) {
        tokens.push({ type: 'string', value: doubleQuote });
      } else if (number) {
        tokens.push({ type: 'number', value: number });
      } else if (paren) {
        tokens.push({ type: 'paren', value: paren });
      }
    }
    
    return tokens;
  }
  
  /**
   * Parse tokens into an AST
   * @param tokens - Tokens to parse
   * @returns AST representing the expression
   */
  private parseTokens(tokens: { type: string; value: string }[]): Node {
    // Implement a recursive descent parser
    const { node } = this.parseExpression_(tokens, 0);
    return node;
  }
  
  /**
   * Helper method for recursive parsing
   * @param tokens - Tokens to parse
   * @param index - Current index in the token stream
   * @returns Parsed node and next index
   */
  private parseExpression_(tokens: { type: string; value: string }[], index: number, minPrecedence: number = 0): { node: Node; nextIndex: number } {
    // Parse the left-hand side
    let { node: left, nextIndex } = this.parsePrimary(tokens, index);
    
    // Parse binary operators with precedence
    while (nextIndex < tokens.length) {
      const token = tokens[nextIndex];
      
      if (token.type !== 'operator' || token.value === '!') {
        break;
      }
      
      const precedence = this.precedence[token.value];
      if (precedence === undefined || precedence < minPrecedence) {
        break;
      }
      
      // Consume the operator
      nextIndex++;
      
      // Parse the right-hand side with higher precedence
      const { node: right, nextIndex: newIndex } = this.parseExpression_(tokens, nextIndex, precedence + 1);
      
      // Create binary node
      left = {
        type: 'binary',
        operator: token.value,
        left,
        right
      };
      
      nextIndex = newIndex;
    }
    
    return { node: left, nextIndex };
  }
  
  /**
   * Parse a primary expression (literal, identifier, or parenthesized expression)
   * @param tokens - Tokens to parse
   * @param index - Current index in the token stream
   * @returns Parsed node and next index
   */
  private parsePrimary(tokens: { type: string; value: string }[], index: number): { node: Node; nextIndex: number } {
    if (index >= tokens.length) {
      throw new Error('Unexpected end of input');
    }
    
    const token = tokens[index];
    
    // Handle unary operators
    if (token.type === 'operator' && token.value === '!') {
      const { node: operand, nextIndex } = this.parsePrimary(tokens, index + 1);
      return {
        node: {
          type: 'unary',
          operator: '!',
          operand
        },
        nextIndex
      };
    }
    
    // Handle parentheses
    if (token.type === 'paren' && token.value === '(') {
      const { node, nextIndex } = this.parseExpression_(tokens, index + 1);
      
      if (nextIndex >= tokens.length || tokens[nextIndex].value !== ')') {
        throw new Error('Missing closing parenthesis');
      }
      
      return { node, nextIndex: nextIndex + 1 };
    }
    
    // Handle literals and identifiers
    switch (token.type) {
      case 'jsonPath':
        return {
          node: {
            type: 'jsonPath',
            path: token.value
          },
          nextIndex: index + 1
        };
        
      case 'number':
        return {
          node: {
            type: 'literal',
            value: parseFloat(token.value)
          },
          nextIndex: index + 1
        };
        
      case 'string':
        return {
          node: {
            type: 'literal',
            value: token.value.slice(1, -1) // Remove quotes
          },
          nextIndex: index + 1
        };
        
      case 'identifier':
        // Handle boolean literals
        if (token.value === 'true') {
          return {
            node: { type: 'literal', value: true },
            nextIndex: index + 1
          };
        } else if (token.value === 'false') {
          return {
            node: { type: 'literal', value: false },
            nextIndex: index + 1
          };
        } else if (token.value === 'null') {
          return {
            node: { type: 'literal', value: null },
            nextIndex: index + 1
          };
        }
        
        // Check for function calls
        if (index + 1 < tokens.length && tokens[index + 1].type === 'paren' && tokens[index + 1].value === '(') {
          return this.parseFunctionCall(tokens, index);
        }
        
        return {
          node: {
            type: 'identifier',
            name: token.value
          },
          nextIndex: index + 1
        };
        
      default:
        throw new Error(`Unexpected token: ${token.value}`);
    }
  }
  
  /**
   * Parse a function call expression
   * @param tokens - Tokens to parse
   * @param index - Current index in the token stream
   * @returns Parsed function call node and next index
   */
  private parseFunctionCall(tokens: { type: string; value: string }[], index: number): { node: Node; nextIndex: number } {
    const functionName = tokens[index].value;
    let nextIndex = index + 2; // Skip function name and opening paren
    const args: Node[] = [];
    
    // Parse arguments until closing parenthesis
    if (tokens[nextIndex].type !== 'paren' || tokens[nextIndex].value !== ')') {
      while (true) {
        const { node: arg, nextIndex: newIndex } = this.parseExpression_(tokens, nextIndex);
        args.push(arg);
        nextIndex = newIndex;
        
        // Check for end of arguments
        if (nextIndex >= tokens.length) {
          throw new Error('Unexpected end of input in function arguments');
        }
        
        if (tokens[nextIndex].type === 'paren' && tokens[nextIndex].value === ')') {
          break;
        }
        
        // Expect a comma separator
        if (tokens[nextIndex].value !== ',') {
          throw new Error(`Expected ',' in function arguments but got ${tokens[nextIndex].value}`);
        }
        
        nextIndex++; // Skip comma
      }
    }
    
    // Skip closing parenthesis
    nextIndex++;
    
    return {
      node: {
        type: 'functionCall',
        name: functionName,
        arguments: args
      },
      nextIndex
    };
  }
}

/**
 * ASTEvaluator
 * Evaluates AST nodes against data
 */
class ASTEvaluator {
  constructor(
    private operators: Record<string, (...args: unknown[]) => unknown>,
    private jsonPathEvaluator: SafeJSONPathEvaluator
  ) {}
  
  /**
   * Evaluate an AST against data
   * @param ast - AST to evaluate
   * @param data - Data to evaluate against
   * @returns Result of the evaluation
   */
  evaluate(ast: Node, data: unknown): unknown {
    return this.evaluateNode(ast, data);
  }
  
  /**
   * Evaluate a single AST node
   * @param node - Node to evaluate
   * @param data - Data to evaluate against
   * @returns Result of the evaluation
   */
  private evaluateNode(node: Node, data: unknown): unknown {
    switch (node.type) {
      case 'binary':
        return this.evaluateBinary(node as BinaryNode, data);
        
      case 'unary':
        return this.evaluateUnary(node as UnaryNode, data);
        
      case 'literal':
        return node.value;
        
      case 'identifier':
        // Handle identifiers - might represent variables in the data context
        return this.evaluateIdentifier(node, data);
        
      case 'jsonPath':
        return this.jsonPathEvaluator.evaluate(node.path as string, data);
        
      case 'functionCall':
        return this.evaluateFunctionCall(node, data);
        
      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }
  
  /**
   * Evaluate a binary operation
   * @param node - Binary node
   * @param data - Data context
   * @returns Result of the binary operation
   */
  private evaluateBinary(node: BinaryNode, data: unknown): unknown {
    // Short-circuit evaluation for logical operators
    if (node.operator === '&&') {
      const left = this.evaluateNode(node.left, data);
      if (!left) return false;
      return Boolean(this.evaluateNode(node.right, data));
    }
    
    if (node.operator === '||') {
      const left = this.evaluateNode(node.left, data);
      if (left) return true;
      return Boolean(this.evaluateNode(node.right, data));
    }
    
    // Regular evaluation for other operators
    const left = this.evaluateNode(node.left, data);
    const right = this.evaluateNode(node.right, data);
    
    const operator = this.operators[node.operator];
    if (!operator) {
      throw new Error(`Unknown operator: ${node.operator}`);
    }
    
    return operator(left, right);
  }
  
  /**
   * Evaluate a unary operation
   * @param node - Unary node
   * @param data - Data context
   * @returns Result of the unary operation
   */
  private evaluateUnary(node: UnaryNode, data: unknown): unknown {
    const operand = this.evaluateNode(node.operand, data);
    
    const operator = this.operators[node.operator];
    if (!operator) {
      throw new Error(`Unknown unary operator: ${node.operator}`);
    }
    
    return operator(operand);
  }
  
  /**
   * Evaluate an identifier
   * @param node - Identifier node
   * @param data - Data context
   * @returns Value of the identifier
   */
  private evaluateIdentifier(node: Node, data: unknown): unknown {
    const name = node.name as string;
    
    // Check if this is a reference to a property in the data object
    if (typeof data === 'object' && data !== null && name in (data as Record<string, unknown>)) {
      return (data as Record<string, unknown>)[name];
    }
    
    // Otherwise treat as undefined
    return undefined;
  }
  
  /**
   * Evaluate a function call
   * @param node - Function call node
   * @param data - Data context
   * @returns Result of the function call
   */
  private evaluateFunctionCall(node: Node, data: unknown): unknown {
    const functionName = node.name as string;
    const args = (node.arguments as Node[]).map(arg => this.evaluateNode(arg, data));
    
    // Check for supported functions
    const func = this.operators[functionName];
    if (typeof func !== 'function') {
      throw new Error(`Unknown function: ${functionName}`);
    }
    
    return func(...args);
  }
}
