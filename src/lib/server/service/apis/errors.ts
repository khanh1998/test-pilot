export class ApiManagementError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'FORBIDDEN' | 'IN_USE' | 'INVALID',
    public readonly affectedFlows: Array<{ id: number; name: string }> = []
  ) {
    super(message);
    this.name = 'ApiManagementError';
  }
}
