import { describe, it, expect } from 'vitest';
import { 
  parseStepId, 
  stepIdToDecimal, 
  decimalToStepId, 
  generateStepId 
} from './step-id-utils.js';

describe('Step ID Generation', () => {
  describe('parseStepId', () => {
    it('should parse basic step IDs', () => {
      expect(parseStepId('step1')).toEqual({ base: 1, fractional: 0 });
      expect(parseStepId('step2')).toEqual({ base: 2, fractional: 0 });
      expect(parseStepId('step10')).toEqual({ base: 10, fractional: 0 });
    });

    it('should parse fractional step IDs', () => {
      expect(parseStepId('step1_25')).toEqual({ base: 1, fractional: 25 });
      expect(parseStepId('step1_5')).toEqual({ base: 1, fractional: 5 });
      expect(parseStepId('step1_05')).toEqual({ base: 1, fractional: 5 });
      expect(parseStepId('step2_125')).toEqual({ base: 2, fractional: 125 });
    });

    it('should throw error for invalid formats', () => {
      expect(() => parseStepId('invalid')).toThrow('Invalid step ID format');
      expect(() => parseStepId('step')).toThrow('Invalid step ID format');
      expect(() => parseStepId('step_5')).toThrow('Invalid step ID format');
    });
  });

  describe('stepIdToDecimal', () => {
    it('should convert basic step IDs to decimals', () => {
      expect(stepIdToDecimal('step1')).toBe(1.0);
      expect(stepIdToDecimal('step2')).toBe(2.0);
      expect(stepIdToDecimal('step10')).toBe(10.0);
    });

    it('should convert fractional step IDs to decimals correctly', () => {
      expect(stepIdToDecimal('step1_25')).toBe(1.25);
      expect(stepIdToDecimal('step1_5')).toBe(1.5);
      expect(stepIdToDecimal('step1_05')).toBe(1.05);
      expect(stepIdToDecimal('step2_125')).toBe(2.125);
    });
  });

  describe('decimalToStepId', () => {
    it('should convert whole numbers to basic step IDs', () => {
      expect(decimalToStepId(1.0)).toBe('step1');
      expect(decimalToStepId(2.0)).toBe('step2');
      expect(decimalToStepId(10.0)).toBe('step10');
    });

    it('should convert decimal numbers to fractional step IDs', () => {
      expect(decimalToStepId(1.25)).toBe('step1_25');
      expect(decimalToStepId(1.5)).toBe('step1_5');
      expect(decimalToStepId(1.05)).toBe('step1_05');
      expect(decimalToStepId(2.125)).toBe('step2_125');
    });
  });

  describe('generateStepId', () => {
    it('should generate first step ID when no existing IDs', () => {
      expect(generateStepId([], null, null)).toBe('step1');
    });

    it('should generate ID after last step', () => {
      expect(generateStepId(['step1'], 'step1', null)).toBe('step2');
      expect(generateStepId(['step1', 'step2'], 'step2', null)).toBe('step3');
    });

    it('should generate ID before first step', () => {
      expect(generateStepId(['step2'], null, 'step2')).toBe('step1');
      expect(generateStepId(['step1'], null, 'step1')).toBe('step0');
    });

    it('should generate ID between two consecutive integer steps', () => {
      expect(generateStepId(['step1', 'step2'], 'step1', 'step2')).toBe('step1_5');
      expect(generateStepId(['step2', 'step3'], 'step2', 'step3')).toBe('step2_5');
    });

    it('should generate ID between fractional steps', () => {
      expect(generateStepId(['step1', 'step1_1'], 'step1', 'step1_1')).toBe('step1_05');
      expect(generateStepId(['step1_1', 'step1_2'], 'step1_1', 'step1_2')).toBe('step1_15');
      expect(generateStepId(['step1_25', 'step1_3'], 'step1_25', 'step1_3')).toBe('step1_275');
    });

    it('should handle complex fractional scenarios', () => {
      // Between 1.05 and 1.1 should be 1.075
      expect(generateStepId(['step1_05', 'step1_1'], 'step1_05', 'step1_1')).toBe('step1_075');
      
      // Between 1.125 and 1.25 should be 1.1875
      expect(generateStepId(['step1_125', 'step1_25'], 'step1_125', 'step1_25')).toBe('step1_1875');
    });

    it('should avoid existing IDs when generating between steps', () => {
      // If step1_5 already exists, should find another position
      const existingIds = ['step1', 'step1_5', 'step2'];
      const result = generateStepId(existingIds, 'step1', 'step2');
      
      // Should not be step1_5 since it exists
      expect(result).not.toBe('step1_5');
      expect(existingIds).not.toContain(result);
      
      // Should be between 1 and 2
      const decimal = stepIdToDecimal(result);
      expect(decimal).toBeGreaterThan(1);
      expect(decimal).toBeLessThan(2);
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle inserting steps in a growing flow', () => {
      let existingIds = ['step1'];
      
      // Add step after step1
      let newId = generateStepId(existingIds, 'step1', null);
      expect(newId).toBe('step2');
      existingIds.push(newId);
      
      // Insert between step1 and step2
      newId = generateStepId(existingIds, 'step1', 'step2');
      expect(newId).toBe('step1_5');
      existingIds.push(newId);
      
      // Insert between step1 and step1_5
      newId = generateStepId(existingIds, 'step1', 'step1_5');
      expect(newId).toBe('step1_25');
      existingIds.push(newId);
      
      // Insert between step1 and step1_25
      newId = generateStepId(existingIds, 'step1', 'step1_25');
      expect(newId).toBe('step1_125');
      existingIds.push(newId);
      
      expect(existingIds.sort()).toEqual(['step1', 'step1_125', 'step1_25', 'step1_5', 'step2']);
    });
  });
});
