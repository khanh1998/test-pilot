import { writable, derived, get } from 'svelte/store';
import type { TestFlowData } from '$lib/components/test-flows/types';
import { saveTestFlow as saveTestFlowAPI } from '$lib/http_client/test-flow';

/**
 * Test Flow Store
 * 
 * Centralized state management for test flow editing.
 * Handles dirty state tracking, validation, and save operations.
 */

export type TestFlowState = {
	id: number | null;
	name: string;
	description: string | null;
	flowJson: TestFlowData;
};

// Private stores
const testFlowState = writable<TestFlowState>({
	id: null,
	name: '',
	description: null,
	flowJson: {
		settings: {
			api_hosts: {}
		},
		steps: [],
		parameters: [],
		outputs: []
	}
});

const isDirty = writable<boolean>(false);
const isSaving = writable<boolean>(false);
const error = writable<string | null>(null);

// Keep track of the original state for dirty checking
let originalState: string = '';

/**
 * Initialize the test flow store with data
 */
export function initializeTestFlow(id: number, name: string, description: string | null, flowJson: TestFlowData) {
	// Ensure all required properties exist with proper defaults
	const normalizedFlowJson: TestFlowData = {
		settings: {
			api_hosts: flowJson.settings?.api_hosts || {},
			environment: flowJson.settings?.environment || {
				environmentId: null,
				subEnvironment: null
			},
			linkedEnvironment: flowJson.settings?.linkedEnvironment || null
		},
		steps: flowJson.steps || [],
		parameters: flowJson.parameters || [],
		outputs: flowJson.outputs || [],
		endpoints: flowJson.endpoints || []
	};

	const state: TestFlowState = {
		id,
		name,
		description,
		flowJson: normalizedFlowJson
	};

	testFlowState.set(state);
	originalState = JSON.stringify(state);
	isDirty.set(false);
	error.set(null);
}

/**
 * Update the test flow name
 */
export function updateName(name: string) {
	testFlowState.update((state) => {
		state.name = name;
		return state;
	});
	checkDirty();
}

/**
 * Update the test flow description
 */
export function updateDescription(description: string | null) {
	testFlowState.update((state) => {
		state.description = description;
		return state;
	});
	checkDirty();
}

/**
 * Update the flow JSON data
 */
export function updateFlowJson(flowJson: TestFlowData) {
	testFlowState.update((state) => {
		state.flowJson = { ...flowJson };
		return state;
	});
	checkDirty();
}

/**
 * Update specific parts of flow JSON (more granular updates)
 */
export function updateFlowSettings(settings: TestFlowData['settings']) {
	testFlowState.update((state) => {
		state.flowJson.settings = { ...settings };
		return state;
	});
	checkDirty();
}

export function updateFlowSteps(steps: TestFlowData['steps']) {
	testFlowState.update((state) => {
		state.flowJson.steps = [...steps];
		return state;
	});
	checkDirty();
}

export function updateFlowParameters(parameters: TestFlowData['parameters']) {
	testFlowState.update((state) => {
		state.flowJson.parameters = [...parameters];
		return state;
	});
	checkDirty();
}

export function updateFlowOutputs(outputs: TestFlowData['outputs']) {
	testFlowState.update((state) => {
		state.flowJson.outputs = outputs ? [...outputs] : [];
		return state;
	});
	checkDirty();
}

/**
 * Mark the flow as dirty (has unsaved changes)
 */
export function markDirty() {
	isDirty.set(true);
}

/**
 * Check if the current state differs from the original state
 */
function checkDirty() {
	const currentState = JSON.stringify(get(testFlowState));
	isDirty.set(currentState !== originalState);
}

/**
 * Save the test flow
 */
export async function saveTestFlow(): Promise<{ success: boolean; error?: string }> {
	const state = get(testFlowState);

	// Validate required fields
	if (!state.name || !state.name.trim()) {
		error.set('Flow name is required');
		return { success: false, error: 'Flow name is required' };
	}

	if (!state.id) {
		error.set('Test flow ID is missing');
		return { success: false, error: 'Test flow ID is missing' };
	}

	try {
		isSaving.set(true);
		error.set(null);

		await saveTestFlowAPI(state.id, {
			name: state.name.trim(),
			description: state.description?.trim() || null,
			flowJson: state.flowJson
		});

		// Update the original state after successful save
		originalState = JSON.stringify(state);
		isDirty.set(false);

		return { success: true };
	} catch (err: unknown) {
		const errorMessage = err instanceof Error ? err.message : 'Failed to save test flow';
		error.set(errorMessage);
		return { success: false, error: errorMessage };
	} finally {
		isSaving.set(false);
	}
}

/**
 * Reset the dirty state (useful after discarding changes)
 */
export function resetDirty() {
	const state = get(testFlowState);
	originalState = JSON.stringify(state);
	isDirty.set(false);
}

/**
 * Clear any errors
 */
export function clearError() {
	error.set(null);
}

// Exported readable stores
export const testFlow = derived(testFlowState, ($state) => $state);
export const testFlowName = derived(testFlowState, ($state) => $state.name);
export const testFlowDescription = derived(testFlowState, ($state) => $state.description);
export const flowJson = derived(testFlowState, ($state) => $state.flowJson);

// Export writable stores as readable
export { isDirty, isSaving, error };

// Validation helpers
export function validateTestFlow(): { isValid: boolean; errors: string[] } {
	const state = get(testFlowState);
	const errors: string[] = [];

	if (!state.name || !state.name.trim()) {
		errors.push('Flow name is required');
	}

	if (!state.id) {
		errors.push('Test flow ID is missing');
	}

	return {
		isValid: errors.length === 0,
		errors
	};
}
