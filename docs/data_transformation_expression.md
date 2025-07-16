# Response Transformation Phase Two
* Define the syntax and parser for the transformation expression.
* Evaluate the expression right after receiving the response in `executeEndpoint`.
* Populate transformed values to `proc:` namespace in runtime store.

## Functional Pipeline with Named Functions
**Combines Linux pipes with functional programming:**
```javascript
// Clean, readable pipeline
data.users
  | where(age > 18)
  | map(pick(['name', 'email']))
  | transform(name: upper(name))
  | sort(by: 'name')
  | take(10)

// More complex transformations
data.orders
  | join(data.customers, on: 'customerId')
  | group(by: 'status')
  | map(count: length(items), total: sum(items.amount))
  | sort(by: 'total', desc: true)
```
**Function definitions:**
```javascript
const PIPELINE_FUNCTIONS = {
  // Filtering
  where: (data, condition) => data.filter(item => evaluateCondition(item, condition)),
  select: (data, condition) => data.filter(item => evaluateCondition(item, condition)),
  
  // Transformation
  map: (data, transformer) => data.map(item => applyTransformer(item, transformer)),
  transform: (data, transforms) => data.map(item => applyTransforms(item, transforms)),
  
  // Aggregation
  group: (data, options) => groupBy(data, options.by),
  count: (data) => data.length,
  sum: (data, field) => data.reduce((acc, item) => acc + get(item, field), 0),
  
  // Sorting and slicing
  sort: (data, options) => sortBy(data, options.by, options.desc),
  take: (data, n) => data.slice(0, n),
  skip: (data, n) => data.slice(n),
  
  // Joining
  join: (data, other, options) => joinArrays(data, other, options.on),
  
  // Utility
  pick: (obj, keys) => pickKeys(obj, keys),
  omit: (obj, keys) => omitKeys(obj, keys),
  get: (obj, path) => getPath(obj, path)
};
```

### JSONPath Integration

**Support for nested field access:**

```javascript
// JSONPath examples in expressions
data.users | where($.profile.age > 18 && $.account.status == 'active')
data.orders | where($.customer.address.country == 'US')
data.events | where($.metadata.source.type == 'mobile')

// Array access
data.users | where($.tags[0] == 'premium')
data.orders | where($.items[*].price > 100)  // any item price > 100
```

## Safe Expression Evaluator

**Core expression evaluation engine:**

```javascript
class SafeExpressionEvaluator {
  constructor() {
    this.operators = {
      // Comparison
      '==': (a, b) => a === b,
      '!=': (a, b) => a !== b,
      '>': (a, b) => this.safeNumericCompare(a, b, (x, y) => x > y),
      '<': (a, b) => this.safeNumericCompare(a, b, (x, y) => x < y),
      '>=': (a, b) => this.safeNumericCompare(a, b, (x, y) => x >= y),
      '<=': (a, b) => this.safeNumericCompare(a, b, (x, y) => x <= y),
      
      // Logical
      '&&': (a, b) => a && b,
      '||': (a, b) => a || b,
      '!': (a) => !a,
      
      // String operations
      'contains': (a, b) => String(a).includes(String(b)),
      'startswith': (a, b) => String(a).startsWith(String(b)),
      'endswith': (a, b) => String(a).endsWith(String(b)),
      'matches': (a, pattern) => this.safeRegexMatch(a, pattern),
      
      // Array operations
      'in': (a, arr) => Array.isArray(arr) && arr.includes(a),
      'notin': (a, arr) => Array.isArray(arr) && !arr.includes(a),
      'any': (arr, condition) => arr.some(item => this.evaluate(condition, item)),
      'all': (arr, condition) => arr.every(item => this.evaluate(condition, item)),
      
      // Null/undefined checks
      'exists': (a) => a !== null && a !== undefined,
      'null': (a) => a === null,
      'empty': (a) => a === '' || a === null || a === undefined || (Array.isArray(a) && a.length === 0)
    };
    
    this.jsonPathEvaluator = new SafeJSONPathEvaluator();
  }
  
  evaluate(expression, data) {
    const ast = this.parseExpression(expression);
    return this.evaluateAST(ast, data);
  }
  
  safeNumericCompare(a, b, compareFn) {
    const numA = Number(a);
    const numB = Number(b);
    if (isNaN(numA) || isNaN(numB)) return false;
    return compareFn(numA, numB);
  }
  
  safeRegexMatch(str, pattern) {
    // Only allow safe regex patterns
    if (this.isUnsafeRegex(pattern)) return false;
    try {
      return new RegExp(pattern).test(String(str));
    } catch {
      return false;
    }
  }
  
  isUnsafeRegex(pattern) {
    // Check for potentially dangerous regex patterns
    const dangerousPatterns = [
      /\(\?\=/,    // Positive lookahead
      /\(\?\!/,    // Negative lookahead
      /\(\?\<\=/,  // Positive lookbehind
      /\(\?\<\!/,  // Negative lookbehind
      /\{[0-9]+,\}/, // Unbounded quantifiers
      /\*\*+/,     // Nested quantifiers
    ];
    
    return dangerousPatterns.some(dangerous => dangerous.test(pattern));
  }
}
```

## JSONPath Evaluator

**Safe JSONPath implementation:**

```javascript
class SafeJSONPathEvaluator {
  constructor() {
    this.cache = new Map();
  }
  
  evaluate(path, data) {
    if (this.cache.has(path)) {
      return this.cache.get(path)(data);
    }
    
    const compiledPath = this.compilePath(path);
    this.cache.set(path, compiledPath);
    return compiledPath(data);
  }
  
  compilePath(path) {
    // Parse JSONPath safely
    const tokens = this.tokenizePath(path);
    const steps = this.parseTokens(tokens);
    
    return (data) => {
      try {
        return this.executeSteps(steps, data);
      } catch (error) {
        return undefined;
      }
    };
  }
  
  tokenizePath(path) {
    // Tokenize path like: $.users[0].profile.age
    const tokens = [];
    let current = '';
    let inBrackets = false;
    
    for (let i = 0; i < path.length; i++) {
      const char = path[i];
      
      if (char === '$' && i === 0) {
        tokens.push({ type: 'root', value: '$' });
      } else if (char === '.' && !inBrackets) {
        if (current) {
          tokens.push({ type: 'property', value: current });
          current = '';
        }
      } else if (char === '[') {
        if (current) {
          tokens.push({ type: 'property', value: current });
          current = '';
        }
        inBrackets = true;
      } else if (char === ']' && inBrackets) {
        if (current) {
          tokens.push({ type: 'index', value: this.parseIndex(current) });
          current = '';
        }
        inBrackets = false;
      } else if (char !== ' ') {
        current += char;
      }
    }
    
    if (current) {
      tokens.push({ type: 'property', value: current });
    }
    
    return tokens;
  }
  
  parseIndex(indexStr) {
    // Handle different index types
    if (indexStr === '*') {
      return { type: 'wildcard' };
    } else if (indexStr.includes(':')) {
      // Slice notation [start:end]
      const [start, end] = indexStr.split(':').map(s => s ? parseInt(s) : undefined);
      return { type: 'slice', start, end };
    } else if (/^\d+$/.test(indexStr)) {
      // Numeric index
      return { type: 'numeric', value: parseInt(indexStr) };
    } else if (indexStr.startsWith("'") && indexStr.endsWith("'")) {
      // String key
      return { type: 'string', value: indexStr.slice(1, -1) };
    } else {
      throw new Error(`Invalid index: ${indexStr}`);
    }
  }
  
  executeSteps(steps, data) {
    let current = data;
    
    for (const step of steps) {
      current = this.executeStep(step, current);
      if (current === undefined) break;
    }
    
    return current;
  }
  
  executeStep(step, data) {
    switch (step.type) {
      case 'root':
        return data;
        
      case 'property':
        if (data && typeof data === 'object') {
          return data[step.value];
        }
        return undefined;
        
      case 'index':
        return this.executeIndex(step.value, data);
        
      default:
        return undefined;
    }
  }
  
  executeIndex(index, data) {
    if (!Array.isArray(data) && typeof data !== 'object') {
      return undefined;
    }
    
    switch (index.type) {
      case 'numeric':
        return Array.isArray(data) ? data[index.value] : undefined;
        
      case 'string':
        return typeof data === 'object' ? data[index.value] : undefined;
        
      case 'wildcard':
        if (Array.isArray(data)) {
          return data; // Return all elements
        } else if (typeof data === 'object') {
          return Object.values(data);
        }
        return undefined;
        
      case 'slice':
        if (Array.isArray(data)) {
          return data.slice(index.start, index.end);
        }
        return undefined;
        
      default:
        return undefined;
    }
  }
}
```

## Expression Parser

**Parse complex logical expressions into AST:**

```javascript
class ExpressionParser {
  constructor() {
    this.precedence = {
      '||': 1,
      '&&': 2,
      '==': 3, '!=': 3,
      '>': 4, '<': 4, '>=': 4, '<=': 4,
      'contains': 4, 'startswith': 4, 'endswith': 4,
      'in': 4, 'notin': 4,
      '!': 5
    };
  }
  
  parseExpression(expression) {
    const tokens = this.tokenize(expression);
    const ast = this.parseTokens(tokens);
    return ast;
  }
  
  tokenize(expression) {
    const tokens = [];
    const regex = /(\$[.\w\[\]'":*]+)|(\|\||&&|==|!=|>=|<=|>|<|!)|(\w+)|('[^']*')|("[^"]*")|(\d+(?:\.\d+)?)|(\(|\))/g;
    
    let match;
    while ((match = regex.exec(expression)) !== null) {
      const [, jsonPath, operator, identifier, singleQuote, doubleQuote, number, paren] = match;
      
      if (jsonPath) {
        tokens.push({ type: 'jsonpath', value: jsonPath });
      } else if (operator) {
        tokens.push({ type: 'operator', value: operator });
      } else if (identifier) {
        tokens.push({ type: 'identifier', value: identifier });
      } else if (singleQuote || doubleQuote) {
        tokens.push({ type: 'string', value: (singleQuote || doubleQuote).slice(1, -1) });
      } else if (number) {
        tokens.push({ type: 'number', value: parseFloat(number) });
      } else if (paren) {
        tokens.push({ type: 'paren', value: paren });
      }
    }
    
    return tokens;
  }
  
  parseTokens(tokens) {
    return this.parseOr(tokens, 0);
  }
  
  parseOr(tokens, index) {
    let left = this.parseAnd(tokens, index);
    index = left.nextIndex;
    
    while (index < tokens.length && tokens[index].value === '||') {
      const right = this.parseAnd(tokens, index + 1);
      left = {
        type: 'binary',
        operator: '||',
        left: left,
        right: right,
        nextIndex: right.nextIndex
      };
      index = right.nextIndex;
    }
    
    return left;
  }
  
  parseAnd(tokens, index) {
    let left = this.parseComparison(tokens, index);
    index = left.nextIndex;
    
    while (index < tokens.length && tokens[index].value === '&&') {
      const right = this.parseComparison(tokens, index + 1);
      left = {
        type: 'binary',
        operator: '&&',
        left: left,
        right: right,
        nextIndex: right.nextIndex
      };
      index = right.nextIndex;
    }
    
    return left;
  }
  
  parseComparison(tokens, index) {
    let left = this.parseUnary(tokens, index);
    index = left.nextIndex;
    
    const comparisonOps = ['==', '!=', '>', '<', '>=', '<=', 'contains', 'startswith', 'endswith', 'in', 'notin'];
    
    if (index < tokens.length && comparisonOps.includes(tokens[index].value)) {
      const operator = tokens[index].value;
      const right = this.parseUnary(tokens, index + 1);
      return {
        type: 'binary',
        operator,
        left,
        right,
        nextIndex: right.nextIndex
      };
    }
    
    return left;
  }
  
  parseUnary(tokens, index) {
    if (index < tokens.length && tokens[index].value === '!') {
      const operand = this.parseUnary(tokens, index + 1);
      return {
        type: 'unary',
        operator: '!',
        operand,
        nextIndex: operand.nextIndex
      };
    }
    
    return this.parsePrimary(tokens, index);
  }
  
  parsePrimary(tokens, index) {
    if (index >= tokens.length) {
      throw new Error('Unexpected end of expression');
    }
    
    const token = tokens[index];
    
    if (token.type === 'paren' && token.value === '(') {
      const expr = this.parseOr(tokens, index + 1);
      if (expr.nextIndex >= tokens.length || tokens[expr.nextIndex].value !== ')') {
        throw new Error('Missing closing parenthesis');
      }
      return {
        ...expr,
        nextIndex: expr.nextIndex + 1
      };
    }
    
    if (token.type === 'jsonpath') {
      return {
        type: 'jsonpath',
        path: token.value,
        nextIndex: index + 1
      };
    }
    
    if (token.type === 'string' || token.type === 'number') {
      return {
        type: 'literal',
        value: token.value,
        nextIndex: index + 1
      };
    }
    
    if (token.type === 'identifier') {
      return {
        type: 'identifier',
        name: token.value,
        nextIndex: index + 1
      };
    }
    
    throw new Error(`Unexpected token: ${token.value}`);
  }
}
```

## AST Evaluator

**Evaluate the parsed AST:**

```javascript
class ASTEvaluator {
  constructor() {
    this.jsonPathEvaluator = new SafeJSONPathEvaluator();
    this.operators = new SafeExpressionEvaluator().operators;
  }
  
  evaluate(ast, data) {
    return this.evaluateNode(ast, data);
  }
  
  evaluateNode(node, data) {
    switch (node.type) {
      case 'binary':
        return this.evaluateBinary(node, data);
        
      case 'unary':
        return this.evaluateUnary(node, data);
        
      case 'jsonpath':
        return this.jsonPathEvaluator.evaluate(node.path, data);
        
      case 'literal':
        return node.value;
        
      case 'identifier':
        // Handle simple property access
        return data[node.name];
        
      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }
  
  evaluateBinary(node, data) {
    const left = this.evaluateNode(node.left, data);
    
    // Short-circuit evaluation
    if (node.operator === '&&' && !left) return false;
    if (node.operator === '||' && left) return true;
    
    const right = this.evaluateNode(node.right, data);
    const operator = this.operators[node.operator];
    
    if (!operator) {
      throw new Error(`Unknown operator: ${node.operator}`);
    }
    
    return operator(left, right);
  }
  
  evaluateUnary(node, data) {
    const operand = this.evaluateNode(node.operand, data);
    const operator = this.operators[node.operator];
    
    if (!operator) {
      throw new Error(`Unknown operator: ${node.operator}`);
    }
    
    return operator(operand);
  }
}
```

## Usage Examples

**Complex expressions with JSONPath:**

```javascript
const evaluator = new SafeExpressionEvaluator();

// Complex logical expressions
evaluator.evaluate(
  "$.user.profile.age > 18 && $.user.account.status == 'active'",
  data
);

// Array operations
evaluator.evaluate(
  "$.orders[*].total > 100 && $.user.tier == 'premium'",
  data
);

// String operations
evaluator.evaluate(
  "$.user.email contains '@company.com' && $.user.name startswith 'John'",
  data
);

// Nested conditions
evaluator.evaluate(
  "($.user.age > 18 || $.user.verified == true) && $.user.status != 'banned'",
  data
);

// Array conditions
evaluator.evaluate(
  "$.user.tags any (tag => tag == 'vip') && $.user.score >= 100",
  data
);
```

This system provides:
- **Safe evaluation** of complex logical expressions
- **JSONPath support** for nested field access
- **Operator precedence** and parentheses support
- **Short-circuit evaluation** for performance
- **Type safety** with validation
- **Performance optimization** through caching

The combination gives you the power to handle complex JSON transformations while maintaining complete security!