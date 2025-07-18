/**
 * Assertion engine for evaluating API response assertions
 */
import { getOperator } from './operators';
import type { Assertion, AssertionResult } from './types';

/**
 * Evaluate a single assertion against actual data
 * 
 * @param assertion The assertion configuration
 * @param actualValue The value extracted from the response or transformed data
 * @returns An assertion result object with pass/fail status and additional info
 */
export function evaluateAssertion(assertion: Assertion, actualValue: unknown): AssertionResult {
  try {
    // Get the operator implementation
    const operator = getOperator(assertion.operator);
    
    // Evaluate the assertion
    const passed = operator.evaluate(actualValue, assertion.expected_value);
    
    // Return the result
    return {
      passed,
      actualValue,
      expectedValue: assertion.expected_value,
      message: passed 
        ? `Assertion passed: ${assertion.assertion_type} ${assertion.data_id} ${assertion.operator} ${JSON.stringify(assertion.expected_value)}`
        : `Assertion failed: ${assertion.assertion_type} ${assertion.data_id} ${assertion.operator} ${JSON.stringify(assertion.expected_value)}, actual value: ${JSON.stringify(actualValue)}`
    };
  } catch (error) {
    // Handle any errors during evaluation
    return {
      passed: false,
      actualValue,
      expectedValue: assertion.expected_value,
      message: `Error evaluating assertion: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Extract a value from response data based on assertion type and data ID
 * 
 * @param assertion The assertion configuration
 * @param response The HTTP response object
 * @param responseData The parsed response body
 * @param transformedData Optional transformed response data
 * @param responseTime Response time in milliseconds
 * @returns The extracted value to be used for assertion evaluation
 */
export async function extractAssertionValue(
  assertion: Assertion, 
  response: Response, 
  responseData: unknown,
  transformedData: Record<string, unknown> | null = null,
  responseTime: number
): Promise<unknown> {
  // Determine the data source
  const sourceData = assertion.data_source === 'transformed_data' && transformedData 
    ? transformedData 
    : responseData;
  
  // Extract the value based on assertion type
  switch (assertion.assertion_type) {
    case 'status_code':
      return response.status;
      
    case 'response_time':
      return responseTime;
      
    case 'header':
      return response.headers.get(assertion.data_id);
      
    case 'json_body':
      try {
        // Use transformation module for JSONPath in response
        const transformModule = await import('$lib/transform');
        return transformModule.transformResponse(sourceData, assertion.data_id);
      } catch (error) {
        throw new Error(`Failed to evaluate JSONPath: ${error instanceof Error ? error.message : String(error)}`);
      }
      
    default:
      throw new Error(`Unknown assertion type: ${assertion.assertion_type}`);
  }
}

/**
 * Run all assertions for an endpoint
 * 
 * @param assertions Array of assertions to evaluate
 * @param response HTTP response object
 * @param responseData Parsed response data
 * @param transformedData Optional transformed data
 * @param responseTime Response time in milliseconds
 * @returns Object with results and overall pass/fail status
 */
export async function runAssertions(
  assertions: Assertion[],
  response: Response,
  responseData: unknown,
  transformedData: Record<string, unknown> | null = null,
  responseTime: number
): Promise<{
  passed: boolean;
  results: AssertionResult[];
  failureMessage?: string;
}> {
  const results: AssertionResult[] = [];
  let allPassed = true;
  let failureMessage: string | undefined;
  
  // Process each enabled assertion
  for (const assertion of assertions) {
    if (!assertion.enabled) {
      continue;
    }
    
    try {
      // Extract the value to test
      const actualValue = await extractAssertionValue(
        assertion, 
        response, 
        responseData, 
        transformedData, 
        responseTime
      );
      
      // Evaluate the assertion
      const result = evaluateAssertion(assertion, actualValue);
      results.push(result);
      
      // Track overall status
      if (!result.passed) {
        allPassed = false;
        failureMessage = result.message;
        break; // Stop on first failure
      }
    } catch (error) {
      // Handle extraction errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.push({
        passed: false,
        actualValue: null,
        expectedValue: assertion.expected_value,
        message: `Error extracting assertion value: ${errorMessage}`
      });
      
      allPassed = false;
      failureMessage = `Error extracting assertion value: ${errorMessage}`;
      break; // Stop on first error
    }
  }
  
  return {
    passed: allPassed,
    results,
    failureMessage
  };
}
