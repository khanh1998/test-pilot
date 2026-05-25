import {
  parseTemplateExpression,
  resolveTemplateExpression,
  type TemplateContext
} from '$lib/template';
import { SafeJSONPathEvaluator } from './JSONPathEvaluator';

export class TransformationExpressionError extends Error {
  constructor(
    message: string,
    readonly code: string = 'TRANSFORMATION_EXPRESSION_ERROR'
  ) {
    super(message);
    this.name = 'TransformationExpressionError';
  }
}

type TokenType =
  | 'template'
  | 'tripleTemplate'
  | 'jsonPath'
  | 'identifier'
  | 'number'
  | 'string'
  | 'operator'
  | 'paren'
  | 'brace'
  | 'bracket'
  | 'comma'
  | 'colon'
  | 'dot'
  | 'pipe'
  | 'eof';

type Token = {
  type: TokenType;
  value: string;
  position: number;
};

type ExpressionNode =
  | { type: 'literal'; value: unknown }
  | { type: 'identifier'; name: string }
  | { type: 'jsonPath'; path: string }
  | { type: 'template'; expression: string; quoted: boolean }
  | { type: 'templateString'; value: string }
  | { type: 'member'; object: ExpressionNode; property: string }
  | { type: 'array'; elements: ExpressionNode[] }
  | { type: 'object'; properties: Array<{ key: string; value: ExpressionNode }> }
  | { type: 'unary'; operator: string; operand: ExpressionNode }
  | { type: 'binary'; operator: string; left: ExpressionNode; right: ExpressionNode }
  | {
      type: 'functionCall';
      name: string;
      args: ExpressionNode[];
      namedArgs: Array<{ name: string; value: ExpressionNode }>;
    }
  | { type: 'pipeline'; input: ExpressionNode; calls: FunctionCallNode[] };

type FunctionCallNode = Extract<ExpressionNode, { type: 'functionCall' }>;

type EvaluationScope = {
  root: unknown;
  current: unknown;
};

const BINARY_PRECEDENCE: Record<string, number> = {
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
  '%': 6
};

const TRANSFORMATION_TEMPLATE_SOURCES = new Set(['param', 'res', 'proc', 'func']);

export class ExpressionParser {
  private tokens: Token[] = [];
  private current = 0;

  parseExpression(expression: string): ExpressionNode {
    this.tokens = tokenize(expression);
    this.current = 0;

    const node = this.parsePipeline();
    this.expect('eof');
    return node;
  }

  private parsePipeline(): ExpressionNode {
    let input = this.parseBinaryExpression(0);
    const calls: FunctionCallNode[] = [];

    while (this.match('pipe')) {
      const next = this.parsePrimary();
      if (next.type !== 'functionCall') {
        throw this.error('A pipeline stage must be a function call.');
      }
      calls.push(next);
    }

    if (calls.length === 0) {
      return input;
    }

    if (input.type === 'pipeline') {
      return { type: 'pipeline', input: input.input, calls: [...input.calls, ...calls] };
    }

    return { type: 'pipeline', input, calls };
  }

  private parseBinaryExpression(minPrecedence: number): ExpressionNode {
    let left = this.parseUnary();

    while (this.peek().type === 'operator') {
      const operator = this.peek().value;
      const precedence = BINARY_PRECEDENCE[operator];
      if (precedence === undefined || precedence < minPrecedence) {
        break;
      }

      this.advance();
      const right = this.parseBinaryExpression(precedence + 1);
      left = { type: 'binary', operator, left, right };
    }

    return left;
  }

  private parseUnary(): ExpressionNode {
    if (this.peek().type === 'operator' && ['!', '-'].includes(this.peek().value)) {
      const operator = this.advance().value;
      return { type: 'unary', operator, operand: this.parseUnary() };
    }

    return this.parsePostfix();
  }

  private parsePostfix(): ExpressionNode {
    let node = this.parsePrimary();

    while (this.match('dot')) {
      const property = this.expect('identifier').value;
      node = { type: 'member', object: node, property };
    }

    return node;
  }

  private parsePrimary(): ExpressionNode {
    const token = this.peek();

    if (this.matchValue('paren', '(')) {
      const node = this.parsePipeline();
      this.expectValue('paren', ')');
      return node;
    }

    if (this.matchValue('bracket', '[')) {
      return this.parseArray();
    }

    if (this.matchValue('brace', '{')) {
      return this.parseObject();
    }

    if (token.type === 'number') {
      this.advance();
      return { type: 'literal', value: Number(token.value) };
    }

    if (token.type === 'string') {
      this.advance();
      const value = unquote(token.value);
      if (hasTemplate(value)) {
        return { type: 'templateString', value };
      }
      return { type: 'literal', value };
    }

    if (token.type === 'template' || token.type === 'tripleTemplate') {
      this.advance();
      return { type: 'template', expression: token.value, quoted: false };
    }

    if (token.type === 'jsonPath') {
      this.advance();
      return { type: 'jsonPath', path: token.value };
    }

    if (token.type === 'identifier') {
      this.advance();
      if (token.value === 'true') return { type: 'literal', value: true };
      if (token.value === 'false') return { type: 'literal', value: false };
      if (token.value === 'null') return { type: 'literal', value: null };
      if (token.value === 'undefined') return { type: 'literal', value: undefined };

      if (this.matchValue('paren', '(')) {
        return this.parseFunctionCall(token.value);
      }

      return { type: 'identifier', name: token.value };
    }

    throw this.error(`Unexpected token "${token.value}".`);
  }

  private parseArray(): ExpressionNode {
    const elements: ExpressionNode[] = [];

    if (this.matchValue('bracket', ']')) {
      return { type: 'array', elements };
    }

    do {
      elements.push(this.parsePipeline());
    } while (this.match('comma'));

    this.expectValue('bracket', ']');
    return { type: 'array', elements };
  }

  private parseObject(): ExpressionNode {
    const properties: Array<{ key: string; value: ExpressionNode }> = [];
    const keys = new Set<string>();

    if (this.matchValue('brace', '}')) {
      return { type: 'object', properties };
    }

    do {
      const keyToken = this.peek();
      if (!['identifier', 'string'].includes(keyToken.type)) {
        throw this.error('Object literal keys must be identifiers or strings.');
      }
      this.advance();

      const key = keyToken.type === 'string' ? unquote(keyToken.value) : keyToken.value;
      if (keys.has(key)) {
        throw this.error(`Duplicate object key "${key}".`);
      }
      keys.add(key);

      this.expect('colon');
      properties.push({ key, value: this.parsePipeline() });
    } while (this.match('comma'));

    this.expectValue('brace', '}');
    return { type: 'object', properties };
  }

  private parseFunctionCall(name: string): FunctionCallNode {
    const args: ExpressionNode[] = [];
    const namedArgs: Array<{ name: string; value: ExpressionNode }> = [];
    const namedArgNames = new Set<string>();

    if (this.matchValue('paren', ')')) {
      return { type: 'functionCall', name, args, namedArgs };
    }

    do {
      if (this.peek().type === 'identifier' && this.peekNext().type === 'colon') {
        const argName = this.advance().value;
        if (namedArgNames.has(argName)) {
          throw this.error(`Duplicate named argument "${argName}".`);
        }
        namedArgNames.add(argName);
        this.expect('colon');
        namedArgs.push({ name: argName, value: this.parsePipeline() });
      } else {
        args.push(this.parsePipeline());
      }
    } while (this.match('comma'));

    this.expectValue('paren', ')');
    return { type: 'functionCall', name, args, namedArgs };
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private peekNext(): Token {
    return this.tokens[this.current + 1] ?? this.tokens[this.tokens.length - 1];
  }

  private advance(): Token {
    const token = this.peek();
    if (token.type !== 'eof') {
      this.current += 1;
    }
    return token;
  }

  private match(type: TokenType): boolean {
    if (this.peek().type !== type) return false;
    this.advance();
    return true;
  }

  private matchValue(type: TokenType, value: string): boolean {
    if (this.peek().type !== type || this.peek().value !== value) return false;
    this.advance();
    return true;
  }

  private expect(type: TokenType): Token {
    const token = this.peek();
    if (token.type !== type) {
      throw this.error(`Expected ${type} but found "${token.value}".`);
    }
    return this.advance();
  }

  private expectValue(type: TokenType, value: string): Token {
    const token = this.peek();
    if (token.type !== type || token.value !== value) {
      throw this.error(`Expected "${value}" but found "${token.value}".`);
    }
    return this.advance();
  }

  private error(message: string): TransformationExpressionError {
    const position = this.peek().position;
    return new TransformationExpressionError(`${message} Position ${position}.`, 'PARSE_ERROR');
  }
}

export class ASTEvaluator {
  private jsonPathEvaluator = new SafeJSONPathEvaluator();

  constructor(
    private templateContext: TemplateContext,
    private operators: Record<string, (...args: unknown[]) => unknown> = {}
  ) {}

  evaluate(ast: ExpressionNode, data: unknown): unknown {
    return this.evaluateNode(ast, { root: data, current: data });
  }

  private evaluateNode(node: ExpressionNode, scope: EvaluationScope): unknown {
    switch (node.type) {
      case 'literal':
        return node.value;
      case 'identifier':
        return this.evaluateIdentifier(node.name, scope);
      case 'jsonPath':
        return this.jsonPathEvaluator.evaluate(node.path, scope.current);
      case 'template':
        return this.evaluateTemplate(node.expression, node.quoted);
      case 'templateString':
        return this.evaluateTemplateString(node.value);
      case 'member':
        return this.evaluateMember(node, scope);
      case 'array':
        return node.elements.map((element) => this.evaluateNode(element, scope));
      case 'object':
        return Object.fromEntries(
          node.properties.map((property) => [
            property.key,
            this.evaluateNode(property.value, scope)
          ])
        );
      case 'unary':
        return this.evaluateUnary(node, scope);
      case 'binary':
        return this.evaluateBinary(node, scope);
      case 'functionCall':
        return this.evaluateFunctionCall(node, scope.current, scope);
      case 'pipeline':
        return this.evaluatePipeline(node, scope);
      default:
        return assertNever(node);
    }
  }

  private evaluatePipeline(
    node: Extract<ExpressionNode, { type: 'pipeline' }>,
    scope: EvaluationScope
  ): unknown {
    let value = this.evaluateNode(node.input, scope);
    for (const call of node.calls) {
      value = this.evaluateFunctionCall(call, value, scope);
    }
    return value;
  }

  private evaluateIdentifier(name: string, scope: EvaluationScope): unknown {
    if (name === 'data') return scope.root;
    if (
      scope.current &&
      typeof scope.current === 'object' &&
      name in (scope.current as Record<string, unknown>)
    ) {
      return (scope.current as Record<string, unknown>)[name];
    }
    return undefined;
  }

  private evaluateMember(
    node: Extract<ExpressionNode, { type: 'member' }>,
    scope: EvaluationScope
  ): unknown {
    const value = this.evaluateNode(node.object, scope);
    if (value && typeof value === 'object') {
      return (value as Record<string, unknown>)[node.property];
    }
    return undefined;
  }

  private evaluateUnary(
    node: Extract<ExpressionNode, { type: 'unary' }>,
    scope: EvaluationScope
  ): unknown {
    const value = this.evaluateNode(node.operand, scope);
    if (node.operator === '!') return !Boolean(value);
    if (node.operator === '-') {
      const num = Number(value);
      return Number.isNaN(num) ? NaN : -num;
    }
    throw new TransformationExpressionError(
      `Unknown unary operator "${node.operator}".`,
      'UNKNOWN_OPERATOR'
    );
  }

  private evaluateBinary(
    node: Extract<ExpressionNode, { type: 'binary' }>,
    scope: EvaluationScope
  ): unknown {
    if (node.operator === '&&') {
      const left = this.evaluateNode(node.left, scope);
      return left ? Boolean(this.evaluateNode(node.right, scope)) : false;
    }

    if (node.operator === '||') {
      const left = this.evaluateNode(node.left, scope);
      return left ? true : Boolean(this.evaluateNode(node.right, scope));
    }

    const left = this.evaluateNode(node.left, scope);
    const right = this.evaluateNode(node.right, scope);

    switch (node.operator) {
      case '==':
        return compareEqual(left, right);
      case '!=':
        return !compareEqual(left, right);
      case '>':
        return numericCompare(left, right, (a, b) => a > b);
      case '<':
        return numericCompare(left, right, (a, b) => a < b);
      case '>=':
        return numericCompare(left, right, (a, b) => a >= b);
      case '<=':
        return numericCompare(left, right, (a, b) => a <= b);
      case '+':
        return numericOperation(left, right, (a, b) => a + b);
      case '-':
        return numericOperation(left, right, (a, b) => a - b);
      case '*':
        return numericOperation(left, right, (a, b) => a * b);
      case '/':
        return numericOperation(left, right, (a, b) =>
          b === 0 ? (a >= 0 ? Infinity : -Infinity) : a / b
        );
      case '%':
        return numericOperation(left, right, (a, b) => (b === 0 ? NaN : a % b));
      default:
        throw new TransformationExpressionError(
          `Unknown binary operator "${node.operator}".`,
          'UNKNOWN_OPERATOR'
        );
    }
  }

  private evaluateTemplate(expression: string, quoted: boolean): unknown {
    const parsed = parseTemplateExpression(expression);
    if (!parsed) {
      throw new TransformationExpressionError(
        `Invalid template expression "${expression}".`,
        'INVALID_TEMPLATE'
      );
    }
    if (parsed.preserveType) {
      throw new TransformationExpressionError(
        'Transformations use {{...}} templates only; {{{...}}} is only for JSON request bodies.',
        'UNSUPPORTED_TEMPLATE'
      );
    }
    if (!TRANSFORMATION_TEMPLATE_SOURCES.has(parsed.source)) {
      throw new TransformationExpressionError(
        `Template source "${parsed.source}" is not supported in transformations. Use a flow parameter instead.`,
        'UNSUPPORTED_TEMPLATE'
      );
    }

    const result = resolveTemplateExpression(
      quoted ? `"${expression}"` : expression,
      this.templateContext
    );
    if (!result.success) {
      throw new TransformationExpressionError(
        result.error ?? `Failed to resolve template "${expression}".`,
        'TEMPLATE_RESOLUTION_ERROR'
      );
    }
    return result.value;
  }

  private evaluateTemplateString(value: string): unknown {
    if (/\{\{\{[^}]+\}\}\}/.test(value)) {
      throw new TransformationExpressionError(
        'Transformations use {{...}} templates only; {{{...}}} is only for JSON request bodies.',
        'UNSUPPORTED_TEMPLATE'
      );
    }

    for (const match of value.match(/\{\{[^}]+\}\}/g) ?? []) {
      const parsed = parseTemplateExpression(match);
      if (!parsed) {
        throw new TransformationExpressionError(
          `Invalid template expression "${match}".`,
          'INVALID_TEMPLATE'
        );
      }
      if (!TRANSFORMATION_TEMPLATE_SOURCES.has(parsed.source)) {
        throw new TransformationExpressionError(
          `Template source "${parsed.source}" is not supported in transformations. Use a flow parameter instead.`,
          'UNSUPPORTED_TEMPLATE'
        );
      }
    }

    return value.replace(/\{\{[^}]+\}\}/g, (match) => {
      const result = resolveTemplateExpression(match, this.templateContext);
      if (!result.success) {
        throw new TransformationExpressionError(
          result.error ?? `Failed to resolve template "${match}".`,
          'TEMPLATE_RESOLUTION_ERROR'
        );
      }
      return result.value === null || result.value === undefined ? '' : String(result.value);
    });
  }

  private evaluateFunctionCall(
    node: FunctionCallNode,
    input: unknown,
    scope: EvaluationScope
  ): unknown {
    const args = node.args.map((arg) => this.evaluateNode(arg, scope));
    const namedArgs = Object.fromEntries(
      node.namedArgs.map((arg) => [arg.name, this.evaluateNode(arg.value, scope)])
    );

    switch (node.name) {
      case 'where':
      case 'select':
        return this.where(input, node.args[0], scope);
      case 'map':
        return this.map(input, node, scope);
      case 'transform':
        return this.transform(input, node, scope);
      case 'sort':
        return this.sort(input, node, scope);
      case 'sum':
        return this.sum(input, node.args[0], scope);
      case 'count':
        return Array.isArray(input) ? input.length : 0;
      case 'first':
        return Array.isArray(input) ? input[0] : undefined;
      case 'last':
        return Array.isArray(input) ? input[input.length - 1] : undefined;
      case 'take':
        return this.take(input, args[0]);
      case 'skip':
        return this.skip(input, args[0]);
      case 'at':
        return this.at(input, args[0]);
      case 'flatten':
        return this.flatten(input, args[0]);
      case 'pick':
        return this.pick(input, args[0]);
      case 'add':
        return this.mathPipeline(input, args[0], 'add', (a, b) => a + b);
      case 'sub':
        return this.mathPipeline(input, args[0], 'sub', (a, b) => a - b);
      case 'mul':
        return this.mathPipeline(input, args[0], 'mul', (a, b) => a * b);
      case 'div':
        return this.mathPipeline(input, args[0], 'div', (a, b) =>
          b === 0 ? (a >= 0 ? Infinity : -Infinity) : a / b
        );
      case 'mod':
        return this.mathPipeline(input, args[0], 'mod', (a, b) => (b === 0 ? NaN : a % b));
      case 'int':
        return castInput(input, args[0], castToInt);
      case 'float':
        return castInput(input, args[0], castToFloat);
      case 'string':
        return castInput(input, args[0], castToString);
      case 'bool':
        return castToBool(input, args[0]);
      case 'contains':
      case 'startsWith':
      case 'endsWith':
      case 'matches':
      case 'empty':
      case 'length':
      case 'abs':
      case 'round':
      case 'ceil':
      case 'floor':
      case 'min':
      case 'max':
      case 'pow':
        return this.callOperator(node.name, args);
      default:
        if (this.operators[node.name]) {
          return this.operators[node.name](...args);
        }
        throw new TransformationExpressionError(
          `Unknown function "${node.name}".`,
          'UNKNOWN_FUNCTION'
        );
    }
  }

  private where(
    input: unknown,
    condition: ExpressionNode | undefined,
    scope: EvaluationScope
  ): unknown[] {
    if (!condition)
      throw new TransformationExpressionError(
        'where() requires a condition expression.',
        'INVALID_ARGUMENTS'
      );
    if (!Array.isArray(input)) return [];
    return input.filter((item) =>
      Boolean(this.evaluateNode(condition, { ...scope, current: item }))
    );
  }

  private map(input: unknown, node: FunctionCallNode, scope: EvaluationScope): unknown[] {
    if (!Array.isArray(input)) return [];
    const mapper = node.args[0] ?? namedArgsToObjectNode(node);
    if (!mapper)
      throw new TransformationExpressionError(
        'map() requires an expression or named object mapping.',
        'INVALID_ARGUMENTS'
      );
    return input.map((item) => this.evaluateNode(mapper, { ...scope, current: item }));
  }

  private transform(input: unknown, node: FunctionCallNode, scope: EvaluationScope): unknown {
    const mapper = node.args[0] ?? namedArgsToObjectNode(node);
    if (!mapper)
      throw new TransformationExpressionError(
        'transform() requires an expression or named object mapping.',
        'INVALID_ARGUMENTS'
      );
    if (Array.isArray(input)) {
      return input.map((item) => this.evaluateNode(mapper, { ...scope, current: item }));
    }
    return this.evaluateNode(mapper, { ...scope, current: input });
  }

  private sort(input: unknown, node: FunctionCallNode, scope: EvaluationScope): unknown[] {
    if (!Array.isArray(input)) return [];
    const byNode = node.namedArgs.find((arg) => arg.name === 'by')?.value ?? node.args[0];
    const descNode = node.namedArgs.find((arg) => arg.name === 'desc')?.value;
    const desc = descNode ? Boolean(this.evaluateNode(descNode, scope)) : false;

    return [...input].sort((a, b) => {
      const valueA = byNode ? this.evaluateSortValue(byNode, { ...scope, current: a }) : a;
      const valueB = byNode ? this.evaluateSortValue(byNode, { ...scope, current: b }) : b;
      const result = compareSortValues(valueA, valueB);
      return desc ? -result : result;
    });
  }

  private evaluateSortValue(byNode: ExpressionNode, scope: EvaluationScope): unknown {
    if (byNode.type === 'literal' && typeof byNode.value === 'string') {
      return scope.current && typeof scope.current === 'object'
        ? (scope.current as Record<string, unknown>)[byNode.value]
        : undefined;
    }
    return this.evaluateNode(byNode, scope);
  }

  private sum(input: unknown, field: ExpressionNode | undefined, scope: EvaluationScope): number {
    if (!Array.isArray(input)) return 0;
    return input.reduce((acc, item) => {
      const value = field ? this.evaluateNode(field, { ...scope, current: item }) : item;
      const numberValue = Number(value);
      return acc + (Number.isNaN(numberValue) ? 0 : numberValue);
    }, 0);
  }

  private take(input: unknown, n: unknown): unknown[] {
    if (!Array.isArray(input)) return [];
    const count = Number(n);
    return Number.isNaN(count) ? input : input.slice(0, count);
  }

  private skip(input: unknown, n: unknown): unknown[] {
    if (!Array.isArray(input)) return [];
    const count = Number(n);
    return Number.isNaN(count) ? input : input.slice(count);
  }

  private at(input: unknown, index: unknown): unknown {
    if (!Array.isArray(input) || index === null || index === undefined) return undefined;
    const numericIndex = Number(index);
    if (Number.isNaN(numericIndex)) return undefined;
    const intIndex = Math.floor(numericIndex);
    return intIndex < 0 ? input[input.length + intIndex] : input[intIndex];
  }

  private flatten(input: unknown, depthValue: unknown = 1): unknown[] {
    if (!Array.isArray(input)) return [];
    const depth = Number(depthValue);
    if (Number.isNaN(depth) || depth <= 0) return input;
    return flattenArray(input, depth);
  }

  private pick(input: unknown, keys: unknown): Record<string, unknown> {
    if (typeof input !== 'object' || input === null || !Array.isArray(keys)) return {};
    const record = input as Record<string, unknown>;
    return Object.fromEntries(
      keys
        .map(String)
        .filter((key) => key in record)
        .map((key) => [key, record[key]])
    );
  }

  private mathPipeline(
    input: unknown,
    value: unknown,
    name: string,
    operation: (a: number, b: number) => number
  ): number | undefined {
    if (typeof input !== 'number') return undefined;
    if (typeof value !== 'number') return undefined;
    if ((name === 'div' || name === 'mod') && value === 0 && name === 'mod') return undefined;
    return operation(input, value);
  }

  private callOperator(name: string, args: unknown[]): unknown {
    const operator = this.operators[name];
    if (!operator) {
      throw new TransformationExpressionError(`Unknown function "${name}".`, 'UNKNOWN_FUNCTION');
    }
    return operator(...args);
  }
}

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < expression.length) {
    const char = expression[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (expression.startsWith('{{{', index)) {
      const end = expression.indexOf('}}}', index + 3);
      if (end < 0)
        throw new TransformationExpressionError(
          'Unclosed triple-brace template expression.',
          'PARSE_ERROR'
        );
      tokens.push({
        type: 'tripleTemplate',
        value: expression.slice(index, end + 3),
        position: index
      });
      index = end + 3;
      continue;
    }

    if (expression.startsWith('{{', index)) {
      const end = expression.indexOf('}}', index + 2);
      if (end < 0)
        throw new TransformationExpressionError('Unclosed template expression.', 'PARSE_ERROR');
      tokens.push({ type: 'template', value: expression.slice(index, end + 2), position: index });
      index = end + 2;
      continue;
    }

    if (char === '"' || char === "'") {
      const { value, next } = readString(expression, index);
      tokens.push({ type: 'string', value, position: index });
      index = next;
      continue;
    }

    if (char === '$') {
      const { value, next } = readJsonPath(expression, index);
      tokens.push({ type: 'jsonPath', value, position: index });
      index = next;
      continue;
    }

    const twoChar = expression.slice(index, index + 2);
    if (['||', '&&', '==', '!=', '>=', '<='].includes(twoChar)) {
      tokens.push({ type: 'operator', value: twoChar, position: index });
      index += 2;
      continue;
    }

    if (char === '|') {
      tokens.push({ type: 'pipe', value: char, position: index });
      index += 1;
      continue;
    }

    if (['>', '<', '!', '+', '-', '*', '/', '%'].includes(char)) {
      tokens.push({ type: 'operator', value: char, position: index });
      index += 1;
      continue;
    }

    if (char === '(' || char === ')') {
      tokens.push({ type: 'paren', value: char, position: index });
      index += 1;
      continue;
    }

    if (char === '{' || char === '}') {
      tokens.push({ type: 'brace', value: char, position: index });
      index += 1;
      continue;
    }

    if (char === '[' || char === ']') {
      tokens.push({ type: 'bracket', value: char, position: index });
      index += 1;
      continue;
    }

    if (char === ',') {
      tokens.push({ type: 'comma', value: char, position: index });
      index += 1;
      continue;
    }

    if (char === ':') {
      tokens.push({ type: 'colon', value: char, position: index });
      index += 1;
      continue;
    }

    if (char === '.') {
      if (/\d/.test(expression[index + 1])) {
        const start = index;
        index += 1;
        while (index < expression.length && /[\d.]/.test(expression[index])) index += 1;
        tokens.push({ type: 'number', value: expression.slice(start, index), position: start });
        continue;
      }
      tokens.push({ type: 'dot', value: char, position: index });
      index += 1;
      continue;
    }

    if (/\d/.test(char)) {
      const start = index;
      index += 1;
      while (index < expression.length && /[\d.]/.test(expression[index])) index += 1;
      tokens.push({ type: 'number', value: expression.slice(start, index), position: start });
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      const start = index;
      index += 1;
      while (index < expression.length && /[A-Za-z0-9_]/.test(expression[index])) index += 1;
      tokens.push({ type: 'identifier', value: expression.slice(start, index), position: start });
      continue;
    }

    throw new TransformationExpressionError(
      `Unexpected character "${char}" at position ${index}.`,
      'PARSE_ERROR'
    );
  }

  tokens.push({ type: 'eof', value: '<eof>', position: expression.length });
  return tokens;
}

function readString(expression: string, start: number): { value: string; next: number } {
  const quote = expression[start];
  let index = start + 1;
  let escaped = false;

  while (index < expression.length) {
    const char = expression[index];
    if (escaped) {
      escaped = false;
      index += 1;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      index += 1;
      continue;
    }
    if (char === quote) {
      return { value: expression.slice(start, index + 1), next: index + 1 };
    }
    index += 1;
  }

  throw new TransformationExpressionError('Unclosed string literal.', 'PARSE_ERROR');
}

function readJsonPath(expression: string, start: number): { value: string; next: number } {
  let index = start + 1;
  let bracketDepth = 0;
  let quote: string | null = null;

  while (index < expression.length) {
    const char = expression[index];
    const prev = expression[index - 1];

    if (quote) {
      if (char === quote && prev !== '\\') quote = null;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      index += 1;
      continue;
    }

    if (char === '[') {
      bracketDepth += 1;
      index += 1;
      continue;
    }

    if (char === ']') {
      bracketDepth -= 1;
      index += 1;
      continue;
    }

    if (bracketDepth === 0 && /[\s,|):}<>=!+\-*\/%]/.test(char)) {
      break;
    }

    index += 1;
  }

  return { value: expression.slice(start, index), next: index };
}

function unquote(value: string): string {
  const quote = value[0];
  const raw = value.slice(1, -1);
  if (quote === '"') {
    try {
      return JSON.parse(value) as string;
    } catch {
      return raw;
    }
  }
  return raw.replace(/\\'/g, "'");
}

function hasTemplate(value: string): boolean {
  return /\{\{[^}]+\}\}/.test(value) || /\{\{\{[^}]+\}\}\}/.test(value);
}

function compareEqual(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) && !Array.isArray(right)) return left.includes(right);
  if (!Array.isArray(left) && Array.isArray(right)) return right.includes(left);
  return left === right;
}

function numericCompare(
  left: unknown,
  right: unknown,
  compare: (left: number, right: number) => boolean
): boolean {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isNaN(leftNumber) || Number.isNaN(rightNumber)) return false;
  return compare(leftNumber, rightNumber);
}

function numericOperation(
  left: unknown,
  right: unknown,
  operation: (left: number, right: number) => number
): number {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isNaN(leftNumber) || Number.isNaN(rightNumber)) return NaN;
  return operation(leftNumber, rightNumber);
}

function namedArgsToObjectNode(node: FunctionCallNode): ExpressionNode | undefined {
  if (node.namedArgs.length === 0) return undefined;
  return {
    type: 'object',
    properties: node.namedArgs.map((arg) => ({ key: arg.name, value: arg.value }))
  };
}

function compareSortValues(left: unknown, right: unknown): number {
  if (left === right) return 0;
  if (left === null || left === undefined) return -1;
  if (right === null || right === undefined) return 1;

  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) {
    return leftNumber - rightNumber;
  }

  return String(left).localeCompare(String(right));
}

function flattenArray(input: unknown[], depth: number): unknown[] {
  if (depth <= 0) return input;
  return input.flatMap((item) => (Array.isArray(item) ? flattenArray(item, depth - 1) : item));
}

function castInput(
  input: unknown,
  defaultValue: unknown,
  cast: (value: unknown, defaultValue?: unknown) => unknown
): unknown {
  if (Array.isArray(input)) {
    return input.map((item) => cast(item, defaultValue));
  }
  return cast(input, defaultValue);
}

function castToInt(value: unknown, defaultValue?: unknown): number | null {
  if (value === null || value === undefined)
    return defaultValue !== undefined ? Number(defaultValue) : null;
  if (typeof value === 'number') return Math.floor(value);
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const parsed = parseInt(value.trim(), 10);
    return Number.isNaN(parsed)
      ? defaultValue !== undefined
        ? Number(defaultValue)
        : null
      : parsed;
  }
  return defaultValue !== undefined ? Number(defaultValue) : null;
}

function castToFloat(value: unknown, defaultValue?: unknown): number | null {
  if (value === null || value === undefined)
    return defaultValue !== undefined ? Number(defaultValue) : null;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.trim());
    return Number.isNaN(parsed)
      ? defaultValue !== undefined
        ? Number(defaultValue)
        : null
      : parsed;
  }
  return defaultValue !== undefined ? Number(defaultValue) : null;
}

function castToString(value: unknown, defaultValue?: unknown): string | null {
  if (value === null || value === undefined)
    return defaultValue !== undefined ? String(defaultValue) : null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function castToBool(value: unknown, defaultValue?: unknown): boolean | null {
  if (value === null || value === undefined)
    return defaultValue !== undefined ? Boolean(defaultValue) : null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0' || normalized === '') return false;
    return true;
  }
  return Boolean(value);
}

function assertNever(value: never): never {
  throw new TransformationExpressionError(
    `Unsupported expression node: ${JSON.stringify(value)}`,
    'INTERNAL_ERROR'
  );
}
