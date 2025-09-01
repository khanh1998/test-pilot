import { describe, it, expect } from 'vitest';

// Copy the validation function for testing
function validateArrayInput(value: string): { isValid: boolean; parsed?: unknown; error?: string } {
  if (!value.trim()) {
    return { isValid: false, error: "Array cannot be empty" };
  }
  
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return { isValid: false, error: "Value must be an array" };
    }
    
    // Check that all elements are primitive types (no objects or nested arrays)
    for (const item of parsed) {
      const itemType = typeof item;
      if (item === null) {
        continue; // null is allowed
      }
      if (itemType === 'object' || Array.isArray(item)) {
        return { isValid: false, error: "Arrays can only contain primitive values (string, number, boolean, null)" };
      }
      if (itemType !== 'string' && itemType !== 'number' && itemType !== 'boolean') {
        return { isValid: false, error: "Arrays can only contain primitive values (string, number, boolean, null)" };
      }
    }
    
    return { isValid: true, parsed };
  } catch (e) {
    return { isValid: false, error: "Invalid array" };
  }
}

describe('Array Validation for Assertions', () => {
  it('should accept arrays of primitive types', () => {
    expect(validateArrayInput('[1, 2, 3]')).toEqual({
      isValid: true,
      parsed: [1, 2, 3]
    });
    
    expect(validateArrayInput('["a", "b", "c"]')).toEqual({
      isValid: true,
      parsed: ["a", "b", "c"]
    });
    
    expect(validateArrayInput('[true, false, true]')).toEqual({
      isValid: true,
      parsed: [true, false, true]
    });
    
    expect(validateArrayInput('[null, "test", 42, true]')).toEqual({
      isValid: true,
      parsed: [null, "test", 42, true]
    });
  });

  it('should reject arrays containing objects', () => {
    const result = validateArrayInput('[{"id": 1}, {"id": 2}]');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Arrays can only contain primitive values (string, number, boolean, null)");
  });

  it('should reject arrays containing nested arrays', () => {
    const result = validateArrayInput('[[1, 2], [3, 4]]');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Arrays can only contain primitive values (string, number, boolean, null)");
  });

  it('should reject mixed arrays with objects', () => {
    const result = validateArrayInput('[1, "test", {"nested": "object"}]');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Arrays can only contain primitive values (string, number, boolean, null)");
  });

  it('should reject invalid JSON', () => {
    const result = validateArrayInput('[1, 2, 3');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Invalid array");
  });

  it('should reject non-array values', () => {
    const result = validateArrayInput('{"not": "an array"}');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Value must be an array");
  });

  it('should reject empty strings', () => {
    const result = validateArrayInput('   ');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Array cannot be empty");
  });
});
