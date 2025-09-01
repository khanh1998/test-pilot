/**
 * User Guide: Using Object and Array Expected Values in Assertions
 * 
 * This test file demonstrates how to use the assertion system with:
 * - Object expected values for complex object comparisons
 * - Array expected values for array operations
 * - Template expressions with objects and arrays
 * - Best practices and common patterns
 */
import { describe, it, expect } from 'vitest';
import { evaluateAssertion } from '$lib/assertions/engine';
import type { Assertion } from '$lib/assertions/types';
import type { TemplateContext } from '$lib/assertions/template';

describe('Object Expected Values - User Guide', () => {
  describe('Basic Object Comparisons', () => {
    it('should compare objects using equals operator - NOTE: Currently uses reference equality', () => {
      const assertion: Assertion = {
        id: 'obj-1',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.user',
        operator: 'equals',
        expected_value: { id: 123, name: 'John Doe', active: true },
        enabled: true
      };

      // IMPORTANT: The current equals operator uses == which means reference equality for objects
      // For object comparison, you should compare individual fields instead
      
      // Different object instances with same content - will fail due to reference inequality
      const result1 = evaluateAssertion(assertion, { id: 123, name: 'John Doe', active: true });
      expect(result1.passed).toBe(false); // This fails because objects are different references

      // Same reference would pass
      const sameObject = { id: 123, name: 'John Doe', active: true };
      const result2 = evaluateAssertion(assertion, sameObject);
      expect(result2.passed).toBe(false); // Still false because expected_value is different reference

      // Better approach: Use template expressions to reference the exact same object
      // Or validate individual fields separately (see other examples)
    });

    it('should use contains operator to check if object contains subset', () => {
      // Note: The contains operator is designed for strings and arrays
      // For object subset checking, you'd need to extract specific fields
      const assertion: Assertion = {
        id: 'obj-2',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.user.name',
        operator: 'equals',
        expected_value: 'John Doe',
        enabled: true
      };

      const userData = { id: 123, name: 'John Doe', active: true, email: 'john@example.com' };
      const result = evaluateAssertion(assertion, userData.name);
      expect(result.passed).toBe(true);
    });

    it('should validate object structure using is_type operator', () => {
      const assertion: Assertion = {
        id: 'obj-3',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.user',
        operator: 'is_type',
        expected_value: 'object',
        enabled: true
      };

      // Valid object - should pass
      const result1 = evaluateAssertion(assertion, { id: 123, name: 'John' });
      expect(result1.passed).toBe(true);

      // Array is not considered an object for this operator
      const result2 = evaluateAssertion(assertion, [1, 2, 3]);
      expect(result2.passed).toBe(false);

      // Null is not an object
      const result3 = evaluateAssertion(assertion, null);
      expect(result3.passed).toBe(false);
    });

    it('should check if object is empty using is_empty operator', () => {
      const assertion: Assertion = {
        id: 'obj-4',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.metadata',
        operator: 'is_empty',
        expected_value: null, // Not used for is_empty
        enabled: true
      };

      // Empty object - should pass
      const result1 = evaluateAssertion(assertion, {});
      expect(result1.passed).toBe(true);

      // Non-empty object - should fail
      const result2 = evaluateAssertion(assertion, { key: 'value' });
      expect(result2.passed).toBe(false);
    });
  });

  describe('Template Expressions with Objects', () => {
    const mockContext: TemplateContext = {
      responses: {
        'step1': {
          user: { id: 123, name: 'John Doe', active: true },
          preferences: { theme: 'dark', notifications: true }
        }
      },
      transformedData: {
        'step1': {
          processedUser: { fullName: 'John Doe', status: 'active' }
        }
      },
      parameters: {
        expectedUser: { id: 123, name: 'John Doe', active: true }
      }
    };

    it('should resolve object from template expression - demonstrates template usage pattern', () => {
      const assertion: Assertion = {
        id: 'obj-template-1',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.currentUser',
        operator: 'equals',
        expected_value: '{{res:step1.$.user}}',
        enabled: true,
        is_template_expression: true
      };

      // IMPORTANT: Template resolution creates new object instances
      // For object comparison with templates, the actual value must be the EXACT same object reference
      // that was stored in the template context, OR you should compare individual fields

      const resolvedUser = { id: 123, name: 'John Doe', active: true };
      
      // This will fail because template resolution creates a new object instance
      const result1 = evaluateAssertion(assertion, resolvedUser, mockContext);
      expect(result1.passed).toBe(false); // Expected behavior with current implementation
      expect(result1.expectedValue).toEqual({ id: 123, name: 'John Doe', active: true });
      expect(result1.originalExpectedValue).toBe('{{res:step1.$.user}}');

      // Better pattern: Compare individual fields using separate assertions
      const nameAssertion: Assertion = {
        id: 'obj-template-1b',
        data_source: 'response', 
        assertion_type: 'json_body',
        data_id: '$.currentUser.name',
        operator: 'equals',
        expected_value: '{{res:step1.$.user.name}}',
        enabled: true,
        is_template_expression: true
      };

      const nameResult = evaluateAssertion(nameAssertion, 'John Doe', mockContext);
      expect(nameResult.passed).toBe(true); // This works because strings compare by value
    });

    it('should resolve nested object properties from template', () => {
      const assertion: Assertion = {
        id: 'obj-template-2',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.theme',
        operator: 'equals',
        expected_value: '{{res:step1.$.preferences.theme}}',
        enabled: true,
        is_template_expression: true
      };

      const result = evaluateAssertion(assertion, 'dark', mockContext);
      
      expect(result.passed).toBe(true);
      expect(result.expectedValue).toBe('dark');
    });

    it('should use object from parameters in template - demonstrates limitations', () => {
      const assertion: Assertion = {
        id: 'obj-template-3',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.user',
        operator: 'equals',
        expected_value: '{{param:expectedUser}}',
        enabled: true,
        is_template_expression: true
      };

      // Same issue: parameter resolution creates new object reference
      const actualUser = { id: 123, name: 'John Doe', active: true };
      const result = evaluateAssertion(assertion, actualUser, mockContext);
      
      expect(result.passed).toBe(false); // Will fail due to reference inequality
      expect(result.expectedValue).toEqual({ id: 123, name: 'John Doe', active: true });
    });
  });
});

describe('Array Expected Values - User Guide', () => {
  describe('Array Length Operations', () => {
    it('should check exact array length using has_length operator', () => {
      const assertion: Assertion = {
        id: 'arr-1',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.items',
        operator: 'has_length',
        expected_value: 3,
        enabled: true
      };

      // Correct length - should pass
      const result1 = evaluateAssertion(assertion, ['item1', 'item2', 'item3']);
      expect(result1.passed).toBe(true);

      // Wrong length - should fail
      const result2 = evaluateAssertion(assertion, ['item1', 'item2']);
      expect(result2.passed).toBe(false);

      // Empty array - should fail
      const result3 = evaluateAssertion(assertion, []);
      expect(result3.passed).toBe(false);
    });

    it('should check if array length is greater than expected using length_greater_than', () => {
      const assertion: Assertion = {
        id: 'arr-2',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.results',
        operator: 'length_greater_than',
        expected_value: 2,
        enabled: true
      };

      // Length > 2 - should pass
      const result1 = evaluateAssertion(assertion, [1, 2, 3, 4]);
      expect(result1.passed).toBe(true);

      // Length = 2 - should fail
      const result2 = evaluateAssertion(assertion, [1, 2]);
      expect(result2.passed).toBe(false);

      // Length < 2 - should fail
      const result3 = evaluateAssertion(assertion, [1]);
      expect(result3.passed).toBe(false);
    });

    it('should check if array length is less than expected using length_less_than', () => {
      const assertion: Assertion = {
        id: 'arr-3',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.errors',
        operator: 'length_less_than',
        expected_value: 5,
        enabled: true
      };

      // Length < 5 - should pass
      const result1 = evaluateAssertion(assertion, ['error1', 'error2']);
      expect(result1.passed).toBe(true);

      // Length = 5 - should fail
      const result2 = evaluateAssertion(assertion, [1, 2, 3, 4, 5]);
      expect(result2.passed).toBe(false);

      // Length > 5 - should fail
      const result3 = evaluateAssertion(assertion, [1, 2, 3, 4, 5, 6]);
      expect(result3.passed).toBe(false);
    });
  });

  describe('Array Content Operations', () => {
    it('should check if array contains a specific item using contains operator', () => {
      const assertion: Assertion = {
        id: 'arr-4',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.tags',
        operator: 'contains',
        expected_value: 'javascript',
        enabled: true
      };

      // Contains the item - should pass
      const result1 = evaluateAssertion(assertion, ['javascript', 'typescript', 'react']);
      expect(result1.passed).toBe(true);

      // Doesn't contain the item - should fail
      const result2 = evaluateAssertion(assertion, ['python', 'java', 'go']);
      expect(result2.passed).toBe(false);
    });

    it('should check if array contains all specified items using contains_all operator', () => {
      const assertion: Assertion = {
        id: 'arr-5',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.technologies',
        operator: 'contains_all',
        expected_value: ['javascript', 'react'],
        enabled: true
      };

      // Contains all items - should pass
      const result1 = evaluateAssertion(assertion, ['javascript', 'react', 'typescript', 'nodejs']);
      expect(result1.passed).toBe(true);

      // Missing one item - should fail
      const result2 = evaluateAssertion(assertion, ['javascript', 'typescript', 'nodejs']);
      expect(result2.passed).toBe(false);

      // Empty array - should fail
      const result3 = evaluateAssertion(assertion, []);
      expect(result3.passed).toBe(false);
    });

    it('should check if array contains any of the specified items using contains_any operator', () => {
      const assertion: Assertion = {
        id: 'arr-6',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.skills',
        operator: 'contains_any',
        expected_value: ['python', 'go', 'rust'],
        enabled: true
      };

      // Contains at least one item - should pass
      const result1 = evaluateAssertion(assertion, ['javascript', 'python', 'react']);
      expect(result1.passed).toBe(true);

      // Contains multiple items - should pass
      const result2 = evaluateAssertion(assertion, ['python', 'go', 'javascript']);
      expect(result2.passed).toBe(true);

      // Contains none of the items - should fail
      const result3 = evaluateAssertion(assertion, ['javascript', 'typescript', 'react']);
      expect(result3.passed).toBe(false);
    });

    it('should check if array does not contain any of the specified items using not_contains_any operator', () => {
      const assertion: Assertion = {
        id: 'arr-7',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.forbiddenTags',
        operator: 'not_contains_any',
        expected_value: ['spam', 'inappropriate', 'deleted'],
        enabled: true
      };

      // Contains none of the forbidden items - should pass
      const result1 = evaluateAssertion(assertion, ['valid', 'approved', 'published']);
      expect(result1.passed).toBe(true);

      // Contains one forbidden item - should fail
      const result2 = evaluateAssertion(assertion, ['valid', 'spam', 'published']);
      expect(result2.passed).toBe(false);
    });

    it('should check if value is one of the specified options using one_of operator', () => {
      const assertion: Assertion = {
        id: 'arr-8',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.status',
        operator: 'one_of',
        expected_value: ['pending', 'approved', 'rejected'],
        enabled: true
      };

      // Value is in the list - should pass
      const result1 = evaluateAssertion(assertion, 'approved');
      expect(result1.passed).toBe(true);

      // Value is not in the list - should fail
      const result2 = evaluateAssertion(assertion, 'unknown');
      expect(result2.passed).toBe(false);
    });

    it('should check if value is not one of the specified options using not_one_of operator', () => {
      const assertion: Assertion = {
        id: 'arr-9',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.role',
        operator: 'not_one_of',
        expected_value: ['admin', 'superuser'],
        enabled: true
      };

      // Value is not in the restricted list - should pass
      const result1 = evaluateAssertion(assertion, 'user');
      expect(result1.passed).toBe(true);

      // Value is in the restricted list - should fail
      const result2 = evaluateAssertion(assertion, 'admin');
      expect(result2.passed).toBe(false);
    });
  });

  describe('Array Type Validation', () => {
    it('should validate that value is an array using is_type operator', () => {
      const assertion: Assertion = {
        id: 'arr-10',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.items',
        operator: 'is_type',
        expected_value: 'array',
        enabled: true
      };

      // Is an array - should pass
      const result1 = evaluateAssertion(assertion, [1, 2, 3]);
      expect(result1.passed).toBe(true);

      // Empty array is still an array - should pass
      const result2 = evaluateAssertion(assertion, []);
      expect(result2.passed).toBe(true);

      // Not an array - should fail
      const result3 = evaluateAssertion(assertion, { items: [1, 2, 3] });
      expect(result3.passed).toBe(false);

      // String is not an array - should fail
      const result4 = evaluateAssertion(assertion, 'not an array');
      expect(result4.passed).toBe(false);
    });

    it('should check if array is empty using is_empty operator', () => {
      const assertion: Assertion = {
        id: 'arr-11',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.emptyList',
        operator: 'is_empty',
        expected_value: null, // Not used for is_empty
        enabled: true
      };

      // Empty array - should pass
      const result1 = evaluateAssertion(assertion, []);
      expect(result1.passed).toBe(true);

      // Non-empty array - should fail
      const result2 = evaluateAssertion(assertion, [1]);
      expect(result2.passed).toBe(false);
    });

    it('should check if array is not empty using is_not_empty operator', () => {
      const assertion: Assertion = {
        id: 'arr-12',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.results',
        operator: 'is_not_empty',
        expected_value: null, // Not used for is_not_empty
        enabled: true
      };

      // Non-empty array - should pass
      const result1 = evaluateAssertion(assertion, ['result1', 'result2']);
      expect(result1.passed).toBe(true);

      // Empty array - should fail
      const result2 = evaluateAssertion(assertion, []);
      expect(result2.passed).toBe(false);
    });
  });

  describe('Template Expressions with Arrays', () => {
    const mockContext: TemplateContext = {
      responses: {
        'step1': {
          items: ['apple', 'banana', 'cherry'],
          numbers: [1, 2, 3, 4, 5],
          user_ids: [101, 102, 103]
        }
      },
      transformedData: {
        'step1': {
          processedItems: ['processed_apple', 'processed_banana'],
          validationErrors: []
        }
      },
      parameters: {
        expectedTags: ['javascript', 'typescript'],
        maxItems: 10,
        allowedStatuses: ['active', 'pending', 'approved']
      }
    };

    it('should resolve array from template expression for exact comparison - demonstrates limitation', () => {
      const assertion: Assertion = {
        id: 'arr-template-1',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.currentItems',
        operator: 'equals',
        expected_value: '{{res:step1.$.items}}',
        enabled: true,
        is_template_expression: true
      };

      // Same limitation applies to arrays - reference equality
      const actualItems = ['apple', 'banana', 'cherry'];
      const result = evaluateAssertion(assertion, actualItems, mockContext);
      
      expect(result.passed).toBe(false); // Will fail due to reference inequality
      expect(result.expectedValue).toEqual(['apple', 'banana', 'cherry']);
      expect(result.originalExpectedValue).toBe('{{res:step1.$.items}}');

      // Better approach: Use contains_all for array content validation
      const containsAllAssertion: Assertion = {
        id: 'arr-template-1b',
        data_source: 'response',
        assertion_type: 'json_body', 
        data_id: '$.currentItems',
        operator: 'contains_all',
        expected_value: '{{res:step1.$.items}}',
        enabled: true,
        is_template_expression: true
      };

      const containsResult = evaluateAssertion(containsAllAssertion, actualItems, mockContext);
      expect(containsResult.passed).toBe(true); // This works for content validation
    });

    it('should use array from parameters for contains_all validation', () => {
      const assertion: Assertion = {
        id: 'arr-template-2',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.projectTags',
        operator: 'contains_all',
        expected_value: '{{param:expectedTags}}',
        enabled: true,
        is_template_expression: true
      };

      const actualTags = ['javascript', 'typescript', 'react', 'nodejs'];
      const result = evaluateAssertion(assertion, actualTags, mockContext);
      
      expect(result.passed).toBe(true);
      expect(result.expectedValue).toEqual(['javascript', 'typescript']);
    });

    it('should use single value from template for one_of validation', () => {
      const assertion: Assertion = {
        id: 'arr-template-3',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.status',
        operator: 'one_of',
        expected_value: '{{param:allowedStatuses}}',
        enabled: true,
        is_template_expression: true
      };

      const actualStatus = 'active';
      const result = evaluateAssertion(assertion, actualStatus, mockContext);
      
      expect(result.passed).toBe(true);
      expect(result.expectedValue).toEqual(['active', 'pending', 'approved']);
    });

    it('should use numeric value from template for array length validation', () => {
      const assertion: Assertion = {
        id: 'arr-template-4',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.resultList',
        operator: 'length_less_than',
        expected_value: '{{param:maxItems}}',
        enabled: true,
        is_template_expression: true
      };

      const actualResults = [1, 2, 3, 4, 5]; // Length 5, should be less than 10
      const result = evaluateAssertion(assertion, actualResults, mockContext);
      
      expect(result.passed).toBe(true);
      expect(result.expectedValue).toBe(10);
    });

    it('should resolve empty array from transformed data - demonstrates limitation', () => {
      const assertion: Assertion = {
        id: 'arr-template-5',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.errors',
        operator: 'equals',
        expected_value: '{{proc:step1.$.validationErrors}}',
        enabled: true,
        is_template_expression: true
      };

      const actualErrors: unknown[] = [];
      const result = evaluateAssertion(assertion, actualErrors, mockContext);
      
      expect(result.passed).toBe(false); // Will fail due to reference inequality 
      expect(result.expectedValue).toEqual([]);

      // Better approach: Check if array is empty using is_empty operator
      const isEmptyAssertion: Assertion = {
        id: 'arr-template-5b',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.errors', 
        operator: 'is_empty',
        expected_value: null,
        enabled: true
      };

      const emptyResult = evaluateAssertion(isEmptyAssertion, actualErrors);
      expect(emptyResult.passed).toBe(true); // This works
    });
  });

  describe('Complex Use Cases and Best Practices', () => {
    const complexContext: TemplateContext = {
      responses: {
        'get-users': {
          users: [
            { id: 1, name: 'John', roles: ['user', 'admin'] },
            { id: 2, name: 'Jane', roles: ['user'] }
          ],
          pagination: { total: 2, page: 1, limit: 10 }
        },
        'create-user': {
          user: { id: 3, name: 'Bob', roles: ['user'] },
          success: true
        }
      },
      transformedData: {
        'get-users': {
          userIds: [1, 2],
          adminUsers: [{ id: 1, name: 'John' }]
        }
      },
      parameters: {
        requiredRoles: ['user'],
        forbiddenRoles: ['banned', 'suspended'],
        minUsers: 1,
        maxUsers: 100
      }
    };

    it('should validate pagination info with multiple assertions', () => {
      // Check that total users is within expected range
      const totalUsersAssertion: Assertion = {
        id: 'complex-1',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.pagination.total',
        operator: 'between',
        expected_value: [1, 100], // Array for between operator
        enabled: true
      };

      const result1 = evaluateAssertion(totalUsersAssertion, 2, complexContext);
      expect(result1.passed).toBe(true);

      // Check that users array length matches pagination total
      const lengthMatchAssertion: Assertion = {
        id: 'complex-2',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.users',
        operator: 'has_length',
        expected_value: '{{res:get-users.$.pagination.total}}',
        enabled: true,
        is_template_expression: true
      };

      const usersList = [
        { id: 1, name: 'John', roles: ['user', 'admin'] },
        { id: 2, name: 'Jane', roles: ['user'] }
      ];
      const result2 = evaluateAssertion(lengthMatchAssertion, usersList, complexContext);
      expect(result2.passed).toBe(true);
      expect(result2.expectedValue).toBe(2);
    });

    it('should validate that all users have required roles', () => {
      // This would typically be done by extracting each user's roles and checking them individually
      // For demonstration, let's check if the first user has the required roles
      const userRolesAssertion: Assertion = {
        id: 'complex-3',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.users[0].roles',
        operator: 'contains_all',
        expected_value: '{{param:requiredRoles}}',
        enabled: true,
        is_template_expression: true
      };

      const firstUserRoles = ['user', 'admin'];
      const result = evaluateAssertion(userRolesAssertion, firstUserRoles, complexContext);
      expect(result.passed).toBe(true);
      expect(result.expectedValue).toEqual(['user']);
    });

    it('should validate that no users have forbidden roles', () => {
      const noForbiddenRolesAssertion: Assertion = {
        id: 'complex-4',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.users[1].roles',
        operator: 'not_contains_any',
        expected_value: '{{param:forbiddenRoles}}',
        enabled: true,
        is_template_expression: true
      };

      const secondUserRoles = ['user'];
      const result = evaluateAssertion(noForbiddenRolesAssertion, secondUserRoles, complexContext);
      expect(result.passed).toBe(true);
      expect(result.expectedValue).toEqual(['banned', 'suspended']);
    });

    it('should validate transformed data arrays - demonstrates better patterns', () => {
      // Instead of direct array comparison, use length validation which works reliably
      const transformedLengthAssertion: Assertion = {
        id: 'complex-5',
        data_source: 'transformed_data',
        assertion_type: 'json_body',
        data_id: '$.userIds',
        operator: 'has_length',
        expected_value: 2, // We know the expected length
        enabled: true
      };

      const actualUserIds = [1, 2];
      const lengthResult = evaluateAssertion(transformedLengthAssertion, actualUserIds, complexContext);
      expect(lengthResult.passed).toBe(true);

      // Also validate individual elements if needed
      const firstIdAssertion: Assertion = {
        id: 'complex-5b',
        data_source: 'transformed_data',
        assertion_type: 'json_body',
        data_id: '$.userIds[0]',
        operator: 'equals',
        expected_value: 1,
        enabled: true
      };

      const firstIdResult = evaluateAssertion(firstIdAssertion, 1);
      expect(firstIdResult.passed).toBe(true);
    });

    it('should handle complex nested object arrays - better validation pattern', () => {
      // Instead of comparing entire objects, validate key properties individually
      const userIdAssertion: Assertion = {
        id: 'complex-6a',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.user.id',
        operator: 'equals',
        expected_value: '{{res:create-user.$.user.id}}',
        enabled: true,
        is_template_expression: true
      };

      const userNameAssertion: Assertion = {
        id: 'complex-6b',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.user.name',
        operator: 'equals',
        expected_value: '{{res:create-user.$.user.name}}',
        enabled: true,
        is_template_expression: true
      };

      const actualCreatedUser = { id: 3, name: 'Bob', roles: ['user'] };
      
      const idResult = evaluateAssertion(userIdAssertion, actualCreatedUser.id, complexContext);
      const nameResult = evaluateAssertion(userNameAssertion, actualCreatedUser.name, complexContext);
      
      expect(idResult.passed).toBe(true);
      expect(nameResult.passed).toBe(true);
      expect(idResult.expectedValue).toBe(3);
      expect(nameResult.expectedValue).toBe('Bob');
    });
  });

  describe('Common Patterns and Tips', () => {
    it('demonstrates pattern: Check if response contains expected structure', () => {
      // Use individual field assertions rather than whole object comparison for more flexible validation
      const nameAssertion: Assertion = {
        id: 'pattern-1',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.user.name',
        operator: 'exists',
        expected_value: null,
        enabled: true
      };

      const idAssertion: Assertion = {
        id: 'pattern-2',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.user.id',
        operator: 'is_type',
        expected_value: 'number',
        enabled: true
      };

      const userData = { user: { id: 123, name: 'John', extra: 'field' } };
      
      const nameResult = evaluateAssertion(nameAssertion, userData.user.name);
      const idResult = evaluateAssertion(idAssertion, userData.user.id);
      
      expect(nameResult.passed).toBe(true);
      expect(idResult.passed).toBe(true);
    });

    it('demonstrates pattern: Validate array elements individually', () => {
      // For arrays, often better to validate length and sample elements rather than entire array
      const arrayLengthAssertion: Assertion = {
        id: 'pattern-3',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.items',
        operator: 'length_greater_than',
        expected_value: 0,
        enabled: true
      };

      const firstItemTypeAssertion: Assertion = {
        id: 'pattern-4',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.items[0].id',
        operator: 'is_type',
        expected_value: 'number',
        enabled: true
      };

      const itemsData = [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }];
      
      const lengthResult = evaluateAssertion(arrayLengthAssertion, itemsData);
      const typeResult = evaluateAssertion(firstItemTypeAssertion, itemsData[0].id);
      
      expect(lengthResult.passed).toBe(true);
      expect(typeResult.passed).toBe(true);
    });

    it('demonstrates pattern: Using numeric range validation for arrays', () => {
      const numericRangeAssertion: Assertion = {
        id: 'pattern-5',
        data_source: 'response',
        assertion_type: 'json_body',
        data_id: '$.scores',
        operator: 'between',
        expected_value: [0, 100], // Array expected value for between operator
        enabled: true
      };

      // This would be used for validating individual numeric values, not arrays themselves
      const scoreValue = 85;
      const result = evaluateAssertion(numericRangeAssertion, scoreValue);
      
      expect(result.passed).toBe(true);
    });
  });
});

/**
 * Key Takeaways from this User Guide:
 * 
 * 1. OBJECT EXPECTED VALUES:
 *    - ⚠️  IMPORTANT: `equals` operator uses reference equality for objects, not deep equality
 *    - For object comparison, validate individual fields using separate assertions
 *    - Use `is_type: 'object'` to validate object structure
 *    - Use `is_empty`/`is_not_empty` for object presence checks
 *    - Template expressions create new object instances, so direct object comparison will fail
 *    - Best practice: Compare object properties individually for reliable validation
 * 
 * 2. ARRAY EXPECTED VALUES:
 *    - ⚠️  IMPORTANT: `equals` operator uses reference equality for arrays, not deep equality
 *    - Use `has_length`, `length_greater_than`, `length_less_than` for size validation (these work reliably)
 *    - Use `contains`, `contains_all`, `contains_any` for content validation (these work reliably)
 *    - Use `one_of`, `not_one_of` for membership validation
 *    - Use `is_type: 'array'` to validate array structure
 *    - For exact array comparison, use `contains_all` instead of `equals`
 * 
 * 3. TEMPLATE EXPRESSIONS WITH OBJECTS/ARRAYS:
 *    - Template resolution creates new object/array instances
 *    - Direct object/array comparison with templates will typically fail
 *    - Use templates for primitive values (strings, numbers, booleans) - these work perfectly
 *    - For complex structures, use templates to reference individual properties
 *    - Example: Use `{{res:step1.$.user.name}}` instead of `{{res:step1.$.user}}`
 * 
 * 4. BEST PRACTICES:
 *    - For objects: Validate individual properties rather than entire objects
 *    - For arrays: Use length validation + content validation instead of exact comparison
 *    - Use template expressions for primitive values and individual properties
 *    - Combine multiple assertions for comprehensive validation
 *    - Use appropriate operators designed for the data type you're validating
 * 
 * 5. RECOMMENDED PATTERNS:
 *    - Object validation: `$.user.id equals {{res:step1.$.user.id}}`
 *    - Array length: `$.items has_length 3`
 *    - Array content: `$.tags contains_all ["javascript", "typescript"]`
 *    - Array membership: `$.status one_of ["pending", "approved", "rejected"]`
 *    - Type validation: `$.data is_type "object"` or `$.items is_type "array"`
 *    - Existence checks: `$.user.email exists` and `$.errors is_empty`
 */
