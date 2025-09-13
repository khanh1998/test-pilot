export interface ProjectEnvironmentLink {
  id: number;
  projectId: number;
  environmentId: number;
  variableMappings: Record<string, string>; // project_var -> env_var
  createdAt: Date;
  // Include related data when needed
  project?: {
    id: number;
    name: string;
  };
  environment?: {
    id: number;
    name: string;
    description?: string;
    config: any;
  };
}

// Request/Response types for API
export interface LinkEnvironmentRequest {
  environmentId: number;
  variableMappings: Record<string, string>;
}

export interface UpdateEnvironmentLinkRequest {
  variableMappings: Record<string, string>;
}

export interface ProjectEnvironmentListResponse {
  environmentLinks: ProjectEnvironmentLink[];
  total: number;
}
