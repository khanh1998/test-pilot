/**
 * Utilities for generating and managing step IDs in test flows.
 * 
 * Step IDs follow the format:
 * - "step1", "step2", etc. for whole number steps
 * - "step1_25", "step1_5", "step1_05" for fractional steps
 * 
 * The fractional part preserves decimal precision:
 * - step1_25 represents 1.25
 * - step1_5 represents 1.5
 * - step1_05 represents 1.05
 */

/**
 * Parse step ID into base and fractional parts
 * Examples: "step1" -> {base: 1, fractional: 0}
 *          "step1_25" -> {base: 1, fractional: 25} (represents 1.25)
 */
export function parseStepId(stepId: string): { base: number; fractional: number } {
  const match = stepId.match(/^step(\d+)(?:_(\d+))?$/);
  if (!match) {
    throw new Error(`Invalid step ID format: ${stepId}`);
  }
  
  const base = parseInt(match[1], 10);
  const fractional = match[2] ? parseInt(match[2], 10) : 0;
  
  return { base, fractional };
}

/**
 * Convert step ID to decimal number for mathematical operations
 * Examples: "step1" -> 1.0
 *          "step1_25" -> 1.25
 *          "step1_5" -> 1.5
 *          "step1_05" -> 1.05
 */
export function stepIdToDecimal(stepId: string): number {
  const parsed = parseStepId(stepId);
  
  if (parsed.fractional === 0) {
    return parsed.base;
  }
  
  // Convert fractional part to proper decimal
  // step1_25 means 1.25, step1_5 means 1.5, step1_05 means 1.05
  const fractionalStr = parsed.fractional.toString();
  
  // Handle leading zeros properly by treating the fractional part as a decimal
  // If fractionalStr is "5", it should be treated as "5" (0.5), not "05" (0.05)
  // If fractionalStr is "05", it should be treated as "05" (0.05)
  // If fractionalStr is "25", it should be treated as "25" (0.25)
  
  // We need to determine how many decimal places this represents
  // The original step ID format preserves this information
  const stepIdMatch = stepId.match(/^step\d+_(\d+)$/);
  if (!stepIdMatch) {
    return parsed.base;
  }
  
  const originalFractionalStr = stepIdMatch[1];
  const fractionalValue = parseInt(originalFractionalStr, 10) / Math.pow(10, originalFractionalStr.length);
  
  return parsed.base + fractionalValue;
}

/**
 * Convert decimal back to step ID format
 * Examples: 1.0 -> "step1"
 *          1.25 -> "step1_25"
 *          1.5 -> "step1_5"
 *          1.05 -> "step1_05"
 */
export function decimalToStepId(decimal: number): string {
  const base = Math.floor(decimal);
  const fractionalPart = decimal - base;
  
  if (fractionalPart === 0 || Math.abs(fractionalPart) < 0.0001) {
    return `step${base}`;
  }
  
  // Convert fractional part back to integer representation
  // Handle floating point precision issues by rounding to reasonable precision
  const rounded = Math.round(fractionalPart * 100000) / 100000;
  
  // Convert to string and extract decimal part
  const fractionalStr = rounded.toString().split('.')[1] || '';
  
  if (!fractionalStr) {
    return `step${base}`;
  }
  
  // Remove trailing zeros but keep significant zeros
  const trimmed = fractionalStr.replace(/0+$/, '');
  
  return `step${base}_${trimmed || '0'}`;
}

/**
 * Generate a step ID that fits between two existing step IDs
 */
export function generateStepId(existingIds: string[], afterId: string | null, beforeId: string | null): string {
  // Handle edge cases
  if (!afterId && !beforeId) return 'step1';
  
  let afterDecimal: number;
  let beforeDecimal: number;
  
  if (!afterId) {
    // Insert before first step
    beforeDecimal = stepIdToDecimal(beforeId!);
    // For inserting before, we want to generate a whole number if possible
    if (beforeDecimal > 1) {
      // If beforeDecimal is step2 (2.0), we want step1
      const targetDecimal = beforeDecimal - 1;
      if (!existingIds.includes(`step${targetDecimal}`)) {
        return `step${targetDecimal}`;
      }
      afterDecimal = targetDecimal - 0.5;
    } else {
      // If beforeDecimal is step1 (1.0), we want step0
      const targetDecimal = 0;
      if (!existingIds.includes(`step${targetDecimal}`)) {
        return `step${targetDecimal}`;
      }
      afterDecimal = targetDecimal - 0.5;
    }
  } else if (!beforeId) {
    // Insert after last step  
    afterDecimal = stepIdToDecimal(afterId);
    // For inserting after, we want to generate the next whole number if possible
    beforeDecimal = Math.floor(afterDecimal) + 1;
    
    // If the next whole number already exists, find the next available
    let candidate = beforeDecimal;
    while (existingIds.includes(`step${candidate}`)) {
      candidate++;
    }
    beforeDecimal = candidate;
    
    // If we can return a whole number, do so
    if (!existingIds.includes(`step${beforeDecimal}`)) {
      return `step${beforeDecimal}`;
    }
  } else {
    // Insert between two steps
    afterDecimal = stepIdToDecimal(afterId);
    beforeDecimal = stepIdToDecimal(beforeId);
  }
  
  // Calculate mathematical midpoint
  const midDecimal = (afterDecimal + beforeDecimal) / 2;
  let candidateId = decimalToStepId(midDecimal);
  
  // If the candidate already exists, we need to find a unique one
  // This shouldn't happen with proper midpoint calculation, but just in case
  let counter = 1;
  while (existingIds.includes(candidateId)) {
    const adjustedDecimal = midDecimal + (0.001 * counter);
    candidateId = decimalToStepId(adjustedDecimal);
    counter++;
    
    // Safety check to prevent infinite loop
    if (counter > 1000) {
      throw new Error('Unable to generate unique step ID');
    }
  }
  
  return candidateId;
}

/**
 * Generate a step ID that fits between two existing steps by index
 */
export function generateStepIdBetween(steps: any[], afterIndex: number, beforeIndex: number): string {
  const allStepIds = steps.map(s => s.step_id);
  
  // Get the step IDs to insert between
  const afterStepId = afterIndex >= 0 ? steps[afterIndex].step_id : null;
  const beforeStepId = beforeIndex < steps.length ? steps[beforeIndex].step_id : null;
  
  return generateStepId(allStepIds, afterStepId, beforeStepId);
}
