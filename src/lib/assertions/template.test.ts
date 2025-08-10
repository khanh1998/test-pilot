/**
 * Basic test for template expressions in assertions
 */
import { describe, it, expect } from 'vitest';
import { 
  hasTemplateExpressions, 
  validateAssertionExpectedValue 
} from '$lib/assertions/template';

describe('Template Expression Utilities', () => {
  it('should detect template expressions correctly', () => {
    expect(hasTemplateExpressions('{{res:step1-0.$.data}}')).toBe(true);
    expect(hasTemplateExpressions('{{{res:step1-0.$.data}}}')).toBe(true);
    expect(hasTemplateExpressions('no templates here')).toBe(false);
    expect(hasTemplateExpressions('single brace {not template}')).toBe(false);
  });

  it('should validate template expressions', () => {
    const validResult = validateAssertionExpectedValue('{{res:step1-0.$.data}}', true);
    expect(validResult.valid).toBe(true);

    const invalidSourceResult = validateAssertionExpectedValue('{{invalid:step1-0.$.data}}', true);
    expect(invalidSourceResult.valid).toBe(false);
    expect(invalidSourceResult.error).toContain('Unknown template source');

    const nonTemplateResult = validateAssertionExpectedValue('static value', false);
    expect(nonTemplateResult.valid).toBe(true);
  });
});
