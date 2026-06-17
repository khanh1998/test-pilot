import type { TestFlowData } from '$lib/components/test-flows/types';
import type { Environment } from '$lib/types/environment';
import { resolveApiHostCoverage } from './api-hosts';

export class FlowValidator {
  static validateFlow(flowData: TestFlowData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!flowData) {
      errors.push('Flow data is missing');
      return { isValid: false, errors };
    }

    if (!flowData.steps || !Array.isArray(flowData.steps)) {
      errors.push('Invalid flow data: missing steps array');
    }

    if (!flowData.endpoints || !Array.isArray(flowData.endpoints)) {
      errors.push('Flow data is missing endpoints array');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateApiHosts(
    flowData: TestFlowData,
    environment: Environment | null = null,
    selectedSubEnvironment: string | null = null
  ): boolean {
    return resolveApiHostCoverage({
      flowData,
      environment,
      selectedSubEnvironment
    }).hasRequiredHosts;
  }

  static getValidationErrorMessage(flowData: TestFlowData): string | null {
    const validation = this.validateFlow(flowData);
    if (!validation.isValid) {
      return validation.errors.join('; ');
    }
    return null;
  }
}
