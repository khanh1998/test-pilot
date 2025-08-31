import { resolveTemplateExpression, type TemplateContext } from "$lib/template";
import type { SafeJSONPathEvaluator } from "./JSONPathEvaluator";

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

/**
 * ExpressionParser
 * Parses expressions into AST (Abstract Syntax Tree)
 */
export class ExpressionParser {
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
    // Match quoted templates (double and single), unquoted templates, JSONPath, operators, identifiers, strings, numbers, and parentheses
    const regex = /("\{\{[^}]+\}\}")|('\{\{[^}]+\}\}')|(\{\{[^}]+\}\})|(\$[.\w\[\]'":*]+)|(\|\||&&|==|!=|>=|<=|>|<|!|\+|-|\*|\/|%)|([a-zA-Z_][a-zA-Z0-9_]*)|('[^']*')|("[^"]*")|(\d+(?:\.\d+)?)|(\(|\))/g;
    
    let match;
    while ((match = regex.exec(expression)) !== null) {
      const [, quotedTemplate, singleQuotedTemplate, template, jsonPath, operator, identifier, singleQuote, doubleQuote, number, paren] = match;
      
      if (quotedTemplate) {
        tokens.push({ type: 'quotedTemplate', value: quotedTemplate });
      } else if (singleQuotedTemplate) {
        tokens.push({ type: 'singleQuotedTemplate', value: singleQuotedTemplate });
      } else if (template) {
        tokens.push({ type: 'template', value: template });
      } else if (jsonPath) {
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
      case 'quotedTemplate':
        return {
          node: {
            type: 'quotedTemplate',
            expression: token.value
          },
          nextIndex: index + 1
        };
        
      case 'singleQuotedTemplate':
        return {
          node: {
            type: 'singleQuotedTemplate',
            expression: token.value
          },
          nextIndex: index + 1
        };
        
      case 'template':
        return {
          node: {
            type: 'template',
            expression: token.value
          },
          nextIndex: index + 1
        };
        
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
export class ASTEvaluator {
  constructor(
    private operators: Record<string, (...args: unknown[]) => unknown>,
    private jsonPathEvaluator: SafeJSONPathEvaluator,
    private templateContext: TemplateContext
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
        
      case 'quotedTemplate':
        return this.evaluateTemplate(node, data);
        
      case 'singleQuotedTemplate':
        return this.evaluateTemplate(node, data);
        
      case 'template':
        return this.evaluateTemplate(node, data);
        
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
  
  /**
   * Evaluate a template expression node
   * @param node - Template node
   * @param data - Data context
   * @returns Result of the template evaluation
   */
  private evaluateTemplate(node: Node, data: unknown): unknown {
    var templateExpression = node.expression as string;

    // Handle single quote template expressions: '{{expr}}' 
    // Convert to double quote format since template engine supports "{{expr}}" but not '{{expr}}'
    if (
      node.type === 'singleQuotedTemplate' ||
      (templateExpression.startsWith("'{{") && templateExpression.endsWith("}}'"))
    ) {
      // Convert single quotes to double quotes: '{{expr}}' -> "{{expr}}"
      templateExpression = '"' + templateExpression.slice(1, -1) + '"';
    }

    // Use the template engine to resolve the expression
    const result = resolveTemplateExpression(templateExpression, this.templateContext);
    
    return result.success ? result.value : templateExpression;
  }
}
