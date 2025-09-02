import type { TestFlowData } from '$lib/components/test-flows/types';

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

  static validateApiHosts(flowData: TestFlowData): boolean {
    return !!(flowData.settings && 
      flowData.settings.api_hosts && 
      Object.values(flowData.settings.api_hosts).some(host => host.url && host.url.trim() !== ''));
  }

  static getValidationErrorMessage(flowData: TestFlowData): string | null {
    const validation = this.validateFlow(flowData);
    if (!validation.isValid) {
      return validation.errors.join('; ');
    }

    if (!this.validateApiHosts(flowData)) {
      return 'No API Hosts are configured. Please configure at least one API host before running the flow.';
    }

    return null;
  }
}
