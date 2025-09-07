import { updateSequence, validateUserTestFlows, getSequenceById } from '$lib/server/repository/db/sequences';
import { projectExistsForUser } from '$lib/server/repository/db/projects';
import type { SequenceConfig, Sequence } from '$lib/server/repository/db/sequences';

export interface UpdateSequenceInput {
  name?: string;
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

export interface UpdateSequenceOutput {
  sequence: Sequence;
}

/**
 * Update a sequence
 * @param sequenceId - The sequence ID
 * @param userId - The user ID to verify ownership through project
 * @param input - The sequence update data
 * @returns The updated sequence
 */
export async function updateSequenceService(
  sequenceId: number,
  userId: number,
  input: UpdateSequenceInput
): Promise<UpdateSequenceOutput | null> {
  const { name, parameters, flows } = input;

  // First, get the existing sequence to verify ownership
  const existingSequence = await getSequenceById(sequenceId);
  if (!existingSequence) {
    return null;
  }

  // Verify user owns the project that contains this sequence
  const userOwnsProject = await projectExistsForUser(existingSequence.projectId, userId);
  if (!userOwnsProject) {
    return null;
  }

  // Build the update data
  const updateData: {
    name?: string;
    config?: SequenceConfig;
  } = {};

  if (name !== undefined) {
    updateData.name = name;
  }

  // Handle config updates
  if (parameters !== undefined || flows !== undefined) {
    // Validate test flows if provided
    if (flows && flows.length > 0) {
      const testFlowIds = flows.map(flow => flow.test_flow_id);
      const validTestFlowIds = await validateUserTestFlows(testFlowIds, userId);
      if (validTestFlowIds.length !== testFlowIds.length) {
        throw new Error('One or more test flows not found or do not belong to the user');
      }
    }

    // Build new config - merge with existing
    updateData.config = {
      parameters: parameters !== undefined ? parameters : existingSequence.config.parameters,
      flows: flows !== undefined ? flows : existingSequence.config.flows
    };
  }

  const sequence = await updateSequence(sequenceId, updateData);
  
  if (!sequence) {
    return null;
  }

  return {
    sequence
  };
}
