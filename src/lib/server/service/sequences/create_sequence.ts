import { createSequence, validateUserTestFlows } from '$lib/server/repository/db/sequences';
import { projectExistsForUser } from '$lib/server/repository/db/projects';
import type { SequenceConfig } from '$lib/server/repository/db/sequences';

export interface CreateSequenceInput {
  name: string;
  projectId: number;
  parameters?: Record<string, {
    type: 'string' | 'number' | 'boolean';
    description: string;
    required: boolean;
    value_source: 'project_variable' | 'hardcoded';
    project_variable: string | null;
    hardcoded_value: any;
  }>;
  flows?: Array<{
    test_flow_id: number;
    order_index: number;
    parameter_mappings: Record<string, {
      source_type: 'sequence_parameter' | 'previous_flow_output';
      source_reference: string;
    }>;
  }>;
}

export interface CreateSequenceOutput {
  sequence: {
    id: number;
    name: string;
    projectId: number;
    config: SequenceConfig;
    orderIndex: number;
    createdAt: Date;
    updatedAt: Date;
  };
}

/**
 * Create a new sequence
 * @param userId - The ID of the user creating the sequence
 * @param input - The sequence data
 * @returns The created sequence
 */
export async function createSequenceService(
  userId: number,
  input: CreateSequenceInput
): Promise<CreateSequenceOutput> {
  const { name, projectId, parameters = {}, flows = [] } = input;

  // Verify project exists and belongs to user
  const projectExists = await projectExistsForUser(projectId, userId);
  if (!projectExists) {
    throw new Error('Project not found or does not belong to the user');
  }

  // Validate test flows belong to user if any flows are provided
  if (flows.length > 0) {
    const testFlowIds = flows.map(flow => flow.test_flow_id);
    const validTestFlowIds = await validateUserTestFlows(testFlowIds, userId);
    if (validTestFlowIds.length !== testFlowIds.length) {
      throw new Error('One or more test flows not found or do not belong to the user');
    }
  }

  // Create sequence config with proper structure
  const config: SequenceConfig = {
    parameters: parameters || {},
    flows: flows || []
  };

  // Create the sequence
  const sequence = await createSequence({
    name,
    projectId,
    config
  });

  return {
    sequence
  };
}
