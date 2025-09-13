export interface Project {
  id: number;
  name: string;
  description?: string;
  userId: number;
  projectJson: ProjectConfig;
  createdAt: Date;
  updatedAt: Date;
  // Optional counts for display purposes
  moduleCount?: number;
  sequenceCount?: number;
  environmentCount?: number;
}

export interface ProjectConfig {
  variables: ProjectVariable[];
  api_hosts: Record<string, ApiHostConfig>;
  environment_mappings: EnvironmentMapping[];
}

export interface ProjectVariable {
  name: string;
  description?: string;
  default_value?: any;
  type: 'string' | 'number' | 'boolean' | 'object';
}

export interface ApiHostConfig {
  api_id: number;
  name: string;
  default_host: string;
}

export interface EnvironmentMapping {
  environment_id: number;
  variable_mappings: Record<string, string>; // project_var -> env_var
}

export interface ProjectApi {
  id: number;
  projectId: number;
  apiId: number;
  defaultHost?: string;
  createdAt: Date;
  // Include related data when needed
  api?: {
    id: number;
    name: string;
    description?: string;
    host?: string;
  };
}

export interface ProjectEnvironment {
  id: number;
  projectId: number;
  environmentId: number;
  variableMappings: Record<string, string>;
  createdAt: Date;
  // Include related data when needed
  environment?: {
    id: number;
    name: string;
    description?: string;
  };
}

// Request/Response types for API
export interface CreateProjectRequest {
  name: string;
  description?: string;
  apiIds: number[];
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  projectJson?: ProjectConfig;
}

export interface ProjectListResponse {
  projects: Project[];
  total: number;
}

export interface ProjectDetailResponse {
  project: Project;
  modules: ProjectModule[];
  apis: ProjectApi[];
  environments: ProjectEnvironment[];
}

export interface ProjectModule {
  id: number;
  projectId: number;
  name: string;
  description?: string;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
  sequenceCount?: number; // Count of sequences in this module
}
