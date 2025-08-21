/**
 * SafeJSONPathEvaluator
 * A secure evaluator for JSONPath expressions
 */

type JSONPathStep = {
  type: 'root' | 'property' | 'wildcard' | 'index' | 'slice';
  indexType?: 'wildcard' | 'numeric' | 'string' | 'slice';
  value?: string | number;
  start?: number;
  end?: number;
};

type JSONPathIndex = {
  type: 'wildcard' | 'numeric' | 'string' | 'slice';
  value?: string | number;
  start?: number;
  end?: number;
};

export class SafeJSONPathEvaluator {
  private cache = new Map<string, (data: unknown) => unknown>();

  /**
   * Evaluates a JSONPath expression against data
   * @param path - JSONPath expression (e.g., $.users[0].profile.age)
   * @param data - Data to evaluate against
   * @returns The value at the path or undefined if not found
   */
  evaluate(path: string, data: unknown): unknown {
    if (this.cache.has(path)) {
      const compiledFn = this.cache.get(path);
      return compiledFn ? compiledFn(data) : undefined;
    }

    const compiledPath = this.compilePath(path);
    this.cache.set(path, compiledPath);
    return compiledPath(data);
  }

  /**
   * Compiles a JSONPath expression to a function
   * @param path - JSONPath expression
   * @returns Function that evaluates the path against data
   */
  private compilePath(path: string) {
    // Parse JSONPath safely
    const tokens = this.tokenizePath(path);
    const steps = this.parseTokens(tokens);

    return (data: unknown) => {
      try {
        return this.executeSteps(steps, data);
      } catch (error) {
        console.error('Error executing JSONPath:', error);
        return undefined;
      }
    };
  }

  /**
   * Tokenize a JSONPath string into parts
   * @param path - JSONPath string to tokenize
   * @returns Array of tokens
   */
  private tokenizePath(path: string): { type: string; value: string }[] {
    const tokens: { type: string; value: string }[] = [];
    let current = '';
    let inBrackets = false;

    // Handle root reference
    if (path.startsWith('$')) {
      tokens.push({ type: 'root', value: '$' });
      path = path.substring(1);
    }

    for (let i = 0; i < path.length; i++) {
      const char = path[i];

      if (char === '[' && !inBrackets) {
        if (current) {
          tokens.push({ type: 'property', value: current });
          current = '';
        }
        inBrackets = true;
      } else if (char === ']' && inBrackets) {
        if (current) {
          tokens.push({ type: 'index', value: current });
          current = '';
        }
        inBrackets = false;
      } else if (char === '.' && !inBrackets) {
        if (current) {
          tokens.push({ type: 'property', value: current });
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      tokens.push({ type: 'property', value: current });
    }

    return tokens;
  }

  /**
   * Parse tokens into executable steps
   * @param tokens - Tokens from tokenizePath
   * @returns Array of steps
   */
  private parseTokens(tokens: { type: string; value: string }[]): JSONPathStep[] {
    const steps: JSONPathStep[] = [];

    for (const token of tokens) {
      if (token.type === 'root') {
        steps.push({ type: 'root' });
      } else if (token.type === 'property') {
        steps.push({ type: 'property', value: token.value });
      } else if (token.type === 'index') {
        const indexValue = token.value.trim();
        const parsedIndex = this.parseIndex(indexValue);
        steps.push({ type: 'index', indexType: parsedIndex.type, value: parsedIndex.value, start: parsedIndex.start, end: parsedIndex.end });
      }
    }

    return steps;
  }

  /**
   * Parse index notation like [0], ['key'], [*], [1:5]
   * @param indexStr - Index string without brackets
   * @returns Parsed index information
   */
  private parseIndex(indexStr: string): JSONPathIndex {
    // Handle different index types
    if (indexStr === '*') {
      return { type: 'wildcard' };
    } else if (indexStr.includes(':')) {
      // Slice notation [start:end]
      const [startStr, endStr] = indexStr.split(':').map(s => s.trim());
      const start = startStr ? parseInt(startStr, 10) : 0;
      const end = endStr ? parseInt(endStr, 10) : undefined;
      return { type: 'slice', start, end };
    } else if (/^\d+$/.test(indexStr)) {
      // Numeric index
      return { type: 'numeric', value: parseInt(indexStr, 10) };
    } else if ((indexStr.startsWith("'") && indexStr.endsWith("'")) || 
                (indexStr.startsWith('"') && indexStr.endsWith('"'))) {
      // String key
      return { type: 'string', value: indexStr.slice(1, -1) };
    } else {
      // Assume it's a string key without quotes
      return { type: 'string', value: indexStr };
    }
  }

  /**
   * Execute steps against data
   * @param steps - Steps to execute
   * @param data - Data to execute against
   * @returns Result of execution
   */
  private executeSteps(steps: JSONPathStep[], data: unknown): unknown {
    let current = data;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      if (current === undefined || current === null) {
        return undefined;
      }
      
      current = this.executeStep(step, current);
      
      // Handle wildcard result followed by property access
      if (Array.isArray(current) && i + 1 < steps.length) {
        const nextStep = steps[i + 1];
        if (nextStep.type === 'property') {
          // Apply the next property step to each element of the array
          const results = current.map(item => {
            if (typeof item === 'object' && item !== null && typeof nextStep.value === 'string') {
              return (item as Record<string, unknown>)[nextStep.value];
            }
            return undefined;
          });
          current = results;
          i++; // Skip the next step since we've already processed it
        }
      }
    }

    return current;
  }

  /**
   * Execute a single step
   * @param step - Step to execute
   * @param data - Current data
   * @returns Result after executing step
   */
  private executeStep(step: JSONPathStep, data: unknown): unknown {
    switch (step.type) {
      case 'root':
        return data;
      case 'property':
        if (typeof data === 'object' && data !== null && typeof step.value === 'string') {
          return (data as Record<string, unknown>)[step.value];
        }
        return undefined;
      case 'index':
        return this.executeIndex(step, data);
      case 'wildcard':
        if (Array.isArray(data)) {
          return data;
        }
        if (typeof data === 'object' && data !== null) {
          return Object.values(data);
        }
        return undefined;
      default:
        return undefined;
    }
  }

  /**
   * Execute index access (array or object)
   * @param index - Index information
   * @param data - Data to access
   * @returns Indexed value
   */
  private executeIndex(index: JSONPathStep, data: unknown): unknown {
    if (!Array.isArray(data) && typeof data !== 'object') {
      return undefined;
    }

    if (Array.isArray(data)) {
      switch (index.indexType) {
        case 'numeric':
          if (typeof index.value === 'number') {
            return data[index.value];
          }
          return undefined;
        case 'slice':
          return data.slice(index.start || 0, index.end);
        case 'wildcard':
          return data;
        default:
          return undefined;
      }
    } else if (data !== null) {
      // Object property access
      if (index.indexType === 'string' && typeof index.value === 'string') {
        return (data as Record<string, unknown>)[index.value];
      } else if (index.indexType === 'wildcard') {
        return Object.values(data as Record<string, unknown>);
      }
    }

    return undefined;
  }
}
