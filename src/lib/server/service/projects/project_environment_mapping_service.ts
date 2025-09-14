import { ProjectRepository } from '../../repository/db/project.js';
import { ProjectEnvironmentRepository } from '../../repository/db/project_environment.js';
import type { EnvironmentMapping } from '../../../types/project.js';

export class ProjectEnvironmentMappingService {
  private projectRepo: ProjectRepository;
  private projectEnvRepo: ProjectEnvironmentRepository;

  constructor() {
    this.projectRepo = new ProjectRepository();
    this.projectEnvRepo = new ProjectEnvironmentRepository();
  }

  /**
   * Link environment to project 
   * - Creates entry in project_environments table
   * - Stores variable mappings in project_json.environment_mappings
   */
  async linkEnvironment(
    projectId: number, 
    userId: number, 
    environmentId: number, 
    variableMappings: Record<string, string>
  ): Promise<void> {
    // Verify user owns the project
    const project = await this.projectRepo.getUserProject(projectId, userId);
    if (!project) {
      throw new Error('Project not found or access denied');
    }

    // Check if environment is already linked in project_environments table
    const existingLink = await this.projectEnvRepo.isEnvironmentLinked(projectId, environmentId);
    if (existingLink) {
      throw new Error('Environment is already linked to this project');
    }

    // 1. Create link in project_environments table (without variable mappings)
    await this.projectEnvRepo.linkEnvironment(projectId, {
      environmentId,
      variableMappings: {} // Empty since we store mappings in project_json
    });

    // 2. Store variable mappings in project_json.environment_mappings
    await this.updateVariableMappingsInProjectJson(projectId, userId, environmentId, variableMappings);
  }

  /**
   * Update environment mapping in project_json.environment_mappings
   */
  async updateEnvironmentMapping(
    projectId: number,
    userId: number,
    environmentId: number,
    variableMappings: Record<string, string>
  ): Promise<void> {
    // Verify user owns the project
    const project = await this.projectRepo.getUserProject(projectId, userId);
    if (!project) {
      throw new Error('Project not found or access denied');
    }

    // Verify environment is linked in project_environments table
    const existingLink = await this.projectEnvRepo.isEnvironmentLinked(projectId, environmentId);
    if (!existingLink) {
      throw new Error('Environment is not linked to this project');
    }

    // Update variable mappings in project_json.environment_mappings
    await this.updateVariableMappingsInProjectJson(projectId, userId, environmentId, variableMappings);
  }

  /**
   * Unlink environment from project
   * - Removes entry from project_environments table
   * - Removes variable mappings from project_json.environment_mappings
   */
  async unlinkEnvironment(
    projectId: number,
    userId: number,
    environmentId: number
  ): Promise<void> {
    // Verify user owns the project
    const project = await this.projectRepo.getUserProject(projectId, userId);
    if (!project) {
      throw new Error('Project not found or access denied');
    }

    // 1. Remove link from project_environments table
    const unlinked = await this.projectEnvRepo.unlinkEnvironment(projectId, environmentId);
    if (!unlinked) {
      throw new Error('Environment link not found');
    }

    // 2. Remove variable mappings from project_json.environment_mappings
    await this.removeVariableMappingsFromProjectJson(projectId, userId, environmentId);
  }

  /**
   * Helper method to update variable mappings in project_json.environment_mappings
   */
  private async updateVariableMappingsInProjectJson(
    projectId: number,
    userId: number,
    environmentId: number,
    variableMappings: Record<string, string>
  ): Promise<void> {
    const project = await this.projectRepo.getUserProject(projectId, userId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Initialize projectJson if it doesn't exist
    if (!project.projectJson) {
      project.projectJson = {
        variables: [],
        api_hosts: {},
        environment_mappings: []
      };
    }
    if (!project.projectJson.environment_mappings) {
      project.projectJson.environment_mappings = [];
    }

    // Find and update existing mapping or add new one
    const mappingIndex = project.projectJson.environment_mappings.findIndex(
      mapping => mapping.environment_id === environmentId
    );

    const newMapping: EnvironmentMapping = {
      environment_id: environmentId,
      variable_mappings: variableMappings
    };

    if (mappingIndex >= 0) {
      // Update existing mapping
      project.projectJson.environment_mappings[mappingIndex] = newMapping;
    } else {
      // Add new mapping
      project.projectJson.environment_mappings.push(newMapping);
    }

    // Save to database
    await this.projectRepo.updateProject(projectId, userId, {
      projectJson: project.projectJson
    });
  }

  /**
   * Helper method to remove variable mappings from project_json.environment_mappings
   */
  private async removeVariableMappingsFromProjectJson(
    projectId: number,
    userId: number,
    environmentId: number
  ): Promise<void> {
    const project = await this.projectRepo.getUserProject(projectId, userId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Initialize projectJson if it doesn't exist
    if (!project.projectJson) {
      project.projectJson = {
        variables: [],
        api_hosts: {},
        environment_mappings: []
      };
    }
    if (!project.projectJson.environment_mappings) {
      project.projectJson.environment_mappings = [];
    }

    // Remove the environment mapping
    project.projectJson.environment_mappings = project.projectJson.environment_mappings.filter(
      mapping => mapping.environment_id !== environmentId
    );

    // Save to database
    await this.projectRepo.updateProject(projectId, userId, {
      projectJson: project.projectJson
    });
  }

  /**
   * Get all environment mappings for a project
   */
  async getEnvironmentMappings(projectId: number, userId: number): Promise<EnvironmentMapping[]> {
    // Verify user owns the project
    const project = await this.projectRepo.getUserProject(projectId, userId);
    if (!project) {
      throw new Error('Project not found or access denied');
    }

    // Return environment mappings from project_json
    return project.projectJson?.environment_mappings || [];
  }

  /**
   * Get a specific environment mapping
   */
  async getEnvironmentMapping(
    projectId: number, 
    userId: number, 
    environmentId: number
  ): Promise<EnvironmentMapping | null> {
    const mappings = await this.getEnvironmentMappings(projectId, userId);
    return mappings.find(mapping => mapping.environment_id === environmentId) || null;
  }
}
