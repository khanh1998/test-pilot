import type { ExecutionState, TestFlowData } from '$lib/components/test-flows/types';
export { sanitizeExecutionState } from '$lib/flow-runner/sanitize';
import { sanitizeExecutionState, sanitizeValue } from '$lib/flow-runner/sanitize';

const CACHE_VERSION = 1;
const CACHE_KEY_PREFIX = 'test-pilot:test-flow-run-cache:';
const MAX_SNAPSHOT_BYTES = 4 * 1024 * 1024;

type JsonRecord = Record<string, unknown>;

export interface TestFlowRunSnapshot {
  version: number;
  testFlowId: string;
  flowSignature: string;
  cachedAt: string;
  runId: string;
  status: 'success';
  executionState: ExecutionState;
  parameterValues: Record<string, unknown>;
  flowOutputs: Record<string, unknown>;
}

export interface SaveRunSnapshotInput {
  testFlowId: string | number | undefined;
  flowData: TestFlowData;
  executionState: ExecutionState;
  parameterValues: Record<string, unknown>;
  flowOutputs?: Record<string, unknown>;
}

export function createFlowSignature(flowData: TestFlowData): string {
  return hashString(
    stableStringify({
      settings: flowData.settings,
      parameters: flowData.parameters,
      outputs: flowData.outputs ?? [],
      steps: flowData.steps
    })
  );
}

export function loadRunSnapshot(
  testFlowId: string | number | undefined,
  flowData: TestFlowData
): TestFlowRunSnapshot | null {
  const storage = getStorage();
  const normalizedTestFlowId = normalizeTestFlowId(testFlowId);
  if (!storage || !normalizedTestFlowId) return null;

  try {
    const rawSnapshot = storage.getItem(getCacheKey(normalizedTestFlowId));
    if (!rawSnapshot) return null;

    const snapshot = JSON.parse(rawSnapshot) as TestFlowRunSnapshot;
    if (!isValidSnapshot(snapshot, normalizedTestFlowId)) return null;

    if (snapshot.flowSignature !== createFlowSignature(flowData)) {
      return null;
    }

    return snapshot;
  } catch (error) {
    console.warn('Failed to load test flow run snapshot from localStorage:', error);
    return null;
  }
}

export function saveRunSnapshot(input: SaveRunSnapshotInput): boolean {
  const storage = getStorage();
  const normalizedTestFlowId = normalizeTestFlowId(input.testFlowId);
  if (!storage || !normalizedTestFlowId) return false;

  const snapshot: TestFlowRunSnapshot = {
    version: CACHE_VERSION,
    testFlowId: normalizedTestFlowId,
    flowSignature: createFlowSignature(input.flowData),
    cachedAt: new Date().toISOString(),
    runId: createRunId(),
    status: 'success',
    executionState: sanitizeExecutionState(input.executionState),
    parameterValues: sanitizeValue(input.parameterValues) as Record<string, unknown>,
    flowOutputs: sanitizeValue(input.flowOutputs ?? {}) as Record<string, unknown>
  };

  try {
    const serializedSnapshot = JSON.stringify(snapshot);
    if (byteLength(serializedSnapshot) > MAX_SNAPSHOT_BYTES) {
      console.warn(
        'Skipping test flow run snapshot cache because it exceeds localStorage size budget.'
      );
      return false;
    }

    storage.setItem(getCacheKey(normalizedTestFlowId), serializedSnapshot);
    return true;
  } catch (error) {
    console.warn('Failed to save test flow run snapshot to localStorage:', error);
    return false;
  }
}

export function clearRunSnapshot(testFlowId: string | number | undefined): void {
  const storage = getStorage();
  const normalizedTestFlowId = normalizeTestFlowId(testFlowId);
  if (!storage || !normalizedTestFlowId) return;

  try {
    storage.removeItem(getCacheKey(normalizedTestFlowId));
  } catch (error) {
    console.warn('Failed to clear test flow run snapshot from localStorage:', error);
  }
}

function isValidSnapshot(snapshot: TestFlowRunSnapshot, testFlowId: string): boolean {
  return (
    snapshot?.version === CACHE_VERSION &&
    snapshot.testFlowId === testFlowId &&
    snapshot.status === 'success' &&
    typeof snapshot.flowSignature === 'string' &&
    typeof snapshot.cachedAt === 'string' &&
    isPlainObject(snapshot.executionState) &&
    isPlainObject(snapshot.parameterValues) &&
    isPlainObject(snapshot.flowOutputs)
  );
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
}

function normalizeTestFlowId(testFlowId: string | number | undefined): string | null {
  if (testFlowId === undefined || testFlowId === null || testFlowId === '') return null;
  return String(testFlowId);
}

function getCacheKey(testFlowId: string): string {
  return `${CACHE_KEY_PREFIX}${testFlowId}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as JsonRecord)[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }

  return (hash >>> 0).toString(36);
}

function createRunId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function byteLength(value: string): number {
  if (typeof Blob !== 'undefined') {
    return new Blob([value]).size;
  }

  return value.length;
}

function isPlainObject(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
