import { z } from 'zod';
import { registry } from './registry';
import { ErrorResponse, MessageResponse } from './common';
import { EnvironmentConfig } from './environments';

export const ListProjectsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

// ── Shared schemas ────────────────────────────────────────────────────────────

const ProjectVariable = z.object({
  name: z.string(),
  description: z.string().optional(),
  default_value: z.unknown().optional(),
  type: z.enum(['string', 'number', 'boolean', 'object'])
});

const ApiHostConfig = z.object({
  api_id: z.number().int(),
  name: z.string(),
  default_host: z.string()
});

const EnvironmentMapping = z.object({
  environment_id: z.number().int(),
  variable_mappings: z.record(z.string(), z.string())
});

const ProjectConfig = registry.register(
  'ProjectConfig',
  z.object({
    variables: z.array(ProjectVariable),
    api_hosts: z.record(z.string(), ApiHostConfig),
    environment_mappings: z.array(EnvironmentMapping)
  })
);

const Project = registry.register(
  'Project',
  z.object({
    id: z.number().int(),
    name: z.string(),
    description: z.string().nullable().optional(),
    agentContext: z.string().nullable().optional(),
    userId: z.number().int(),
    projectJson: ProjectConfig,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    moduleCount: z.number().int().optional(),
    sequenceCount: z.number().int().optional(),
    environmentCount: z.number().int().optional()
  })
);

const ProjectApi = registry.register(
  'ProjectApi',
  z.object({
    id: z.number().int(),
    projectId: z.number().int(),
    apiId: z.number().int(),
    defaultHost: z.string().nullable().optional(),
    createdAt: z.string().datetime(),
    api: z
      .object({
        id: z.number().int(),
        name: z.string(),
        description: z.string().nullable().optional(),
        host: z.string().nullable().optional()
      })
      .optional()
  })
);

const ProjectEnvironmentLink = registry.register(
  'ProjectEnvironmentLink',
  z.object({
    id: z.number().int(),
    projectId: z.number().int(),
    environmentId: z.number().int(),
    variableMappings: z.record(z.string(), z.string()),
    createdAt: z.string().datetime(),
    environment: z
      .object({
        id: z.number().int(),
        name: z.string(),
        description: z.string().nullable().optional(),
        config: EnvironmentConfig.optional()
      })
      .optional()
  })
);

const ProjectModule = registry.register(
  'ProjectModule',
  z.object({
    id: z.number().int(),
    projectId: z.number().int(),
    name: z.string(),
    description: z.string().nullable().optional(),
    displayOrder: z.number().int(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    sequenceCount: z.number().int().optional()
  })
);

// ── Request schemas ───────────────────────────────────────────────────────────

export const CreateProjectRequest = registry.register(
  'CreateProjectRequest',
  z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    apiIds: z.array(z.number().int()).optional()
  })
);

export const UpdateProjectRequest = registry.register(
  'UpdateProjectRequest',
  z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    agentContext: z.string().nullable().optional(),
    projectJson: ProjectConfig.optional()
  })
);

export const LinkApiToProjectRequest = registry.register(
  'LinkApiToProjectRequest',
  z.object({
    apiId: z.number().int(),
    defaultHost: z.string().optional()
  })
);

export const UpdateProjectApiRequest = registry.register(
  'UpdateProjectApiRequest',
  z.object({
    defaultHost: z.string().optional()
  })
);

export const LinkEnvironmentMappingRequest = registry.register(
  'LinkEnvironmentMappingRequest',
  z.object({
    environmentId: z.number().int(),
    variableMappings: z.record(z.string(), z.string()).optional()
  })
);

export const UpdateEnvironmentMappingRequest = registry.register(
  'UpdateEnvironmentMappingRequest',
  z.object({
    variableMappings: z.record(z.string(), z.string()).optional()
  })
);

export const LinkProjectEnvironmentRequest = registry.register(
  'LinkProjectEnvironmentRequest',
  z.object({
    environment_id: z.number().int(),
    variableMappings: z.record(z.string(), z.string()).optional()
  })
);

// ── Response schemas ──────────────────────────────────────────────────────────

const ProjectListResponse = registry.register(
  'ProjectListResponse',
  z.object({
    projects: z.array(Project),
    total: z.number().int()
  })
);

const ProjectDetailResponse = registry.register(
  'ProjectDetailResponse',
  z.object({
    project: Project,
    modules: z.array(ProjectModule),
    apis: z.array(ProjectApi),
    environments: z.array(ProjectEnvironmentLink)
  })
);

const ProjectWrappedResponse = registry.register(
  'ProjectWrappedResponse',
  z.object({ project: Project })
);

// ── Path param helpers ────────────────────────────────────────────────────────

export const projectIdParam = z.object({
  id: z.coerce.number().int().positive()
});

const projectApiIdParam = z.object({
  id: z.coerce.number().int().positive(),
  apiId: z.coerce.number().int().positive()
});

const projectEnvIdParam = z.object({
  id: z.coerce.number().int().positive(),
  environmentId: z.coerce.number().int().positive()
});

// ── Path registrations ────────────────────────────────────────────────────────

// /api/projects
registry.registerPath({
  method: 'get',
  path: '/api/projects',
  summary: 'List user projects',
  tags: ['Projects'],
  security: [{ bearerAuth: [] }],
  request: {
    query: ListProjectsQuery
  },
  responses: {
    200: {
      description: 'Success',
      content: { 'application/json': { schema: ProjectListResponse } }
    },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

registry.registerPath({
  method: 'post',
  path: '/api/projects',
  summary: 'Create a project',
  tags: ['Projects'],
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: CreateProjectRequest } } }
  },
  responses: {
    201: {
      description: 'Created',
      content: { 'application/json': { schema: ProjectWrappedResponse } }
    },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

// /api/projects/{id}
registry.registerPath({
  method: 'get',
  path: '/api/projects/{id}',
  summary: 'Get project detail',
  tags: ['Projects'],
  security: [{ bearerAuth: [] }],
  request: { params: projectIdParam },
  responses: {
    200: {
      description: 'Success',
      content: { 'application/json': { schema: ProjectDetailResponse } }
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

registry.registerPath({
  method: 'put',
  path: '/api/projects/{id}',
  summary: 'Update a project',
  tags: ['Projects'],
  security: [{ bearerAuth: [] }],
  request: {
    params: projectIdParam,
    body: { content: { 'application/json': { schema: UpdateProjectRequest } } }
  },
  responses: {
    200: {
      description: 'Updated',
      content: { 'application/json': { schema: ProjectWrappedResponse } }
    },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

registry.registerPath({
  method: 'delete',
  path: '/api/projects/{id}',
  summary: 'Delete a project',
  tags: ['Projects'],
  security: [{ bearerAuth: [] }],
  request: { params: projectIdParam },
  responses: {
    200: { description: 'Deleted', content: { 'application/json': { schema: MessageResponse } } },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

// /api/projects/{id}/apis
registry.registerPath({
  method: 'get',
  path: '/api/projects/{id}/apis',
  summary: 'List APIs linked to project',
  tags: ['Projects'],
  security: [{ bearerAuth: [] }],
  request: { params: projectIdParam },
  responses: {
    200: {
      description: 'Success',
      content: { 'application/json': { schema: z.object({ projectApis: z.array(ProjectApi) }) } }
    },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

registry.registerPath({
  method: 'post',
  path: '/api/projects/{id}/apis',
  summary: 'Link API to project',
  tags: ['Projects'],
  security: [{ bearerAuth: [] }],
  request: {
    params: projectIdParam,
    body: { content: { 'application/json': { schema: LinkApiToProjectRequest } } }
  },
  responses: {
    200: {
      description: 'Linked',
      content: { 'application/json': { schema: z.object({ projectApi: ProjectApi }) } }
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } },
    409: {
      description: 'Already linked',
      content: { 'application/json': { schema: ErrorResponse } }
    }
  }
});

// /api/projects/{id}/apis/{apiId}
registry.registerPath({
  method: 'put',
  path: '/api/projects/{id}/apis/{apiId}',
  summary: 'Update API settings in project',
  tags: ['Projects'],
  security: [{ bearerAuth: [] }],
  request: {
    params: projectApiIdParam,
    body: { content: { 'application/json': { schema: UpdateProjectApiRequest } } }
  },
  responses: {
    200: {
      description: 'Updated',
      content: { 'application/json': { schema: z.object({ projectApi: ProjectApi }) } }
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

registry.registerPath({
  method: 'delete',
  path: '/api/projects/{id}/apis/{apiId}',
  summary: 'Unlink API from project',
  tags: ['Projects'],
  security: [{ bearerAuth: [] }],
  request: { params: projectApiIdParam },
  responses: {
    200: {
      description: 'Unlinked',
      content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

// /api/projects/{id}/environment (singular — returns the one linked env)
registry.registerPath({
  method: 'get',
  path: '/api/projects/{id}/environment',
  summary: 'Get the environment linked to project',
  tags: ['Projects'],
  security: [{ bearerAuth: [] }],
  request: { params: projectIdParam },
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': { schema: z.object({ environment: ProjectEnvironmentLink.nullable() }) }
      }
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

// /api/projects/{id}/environments (plural — CRUD)
registry.registerPath({
  method: 'get',
  path: '/api/projects/{id}/environments',
  summary: 'List environments linked to project',
  tags: ['Projects'],
  security: [{ bearerAuth: [] }],
  request: { params: projectIdParam },
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': { schema: z.object({ environments: z.array(ProjectEnvironmentLink) }) }
      }
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

registry.registerPath({
  method: 'post',
  path: '/api/projects/{id}/environments',
  summary: 'Link environment to project',
  tags: ['Projects'],
  security: [{ bearerAuth: [] }],
  request: {
    params: projectIdParam,
    body: { content: { 'application/json': { schema: LinkProjectEnvironmentRequest } } }
  },
  responses: {
    201: {
      description: 'Linked',
      content: { 'application/json': { schema: z.object({ link: ProjectEnvironmentLink }) } }
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } },
    409: {
      description: 'Already linked',
      content: { 'application/json': { schema: ErrorResponse } }
    }
  }
});

registry.registerPath({
  method: 'put',
  path: '/api/projects/{id}/environments',
  summary: 'Update environment link for project',
  tags: ['Projects'],
  security: [{ bearerAuth: [] }],
  request: {
    params: projectIdParam,
    body: { content: { 'application/json': { schema: LinkProjectEnvironmentRequest } } }
  },
  responses: {
    200: {
      description: 'Updated',
      content: { 'application/json': { schema: z.object({ link: ProjectEnvironmentLink }) } }
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

registry.registerPath({
  method: 'delete',
  path: '/api/projects/{id}/environments',
  summary: 'Unlink environment from project',
  tags: ['Projects'],
  security: [{ bearerAuth: [] }],
  request: {
    params: projectIdParam,
    query: z.object({ environmentId: z.coerce.number().int().positive() })
  },
  responses: {
    200: { description: 'Unlinked', content: { 'application/json': { schema: MessageResponse } } },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

// /api/projects/{id}/environment-mappings
registry.registerPath({
  method: 'post',
  path: '/api/projects/{id}/environment-mappings',
  summary: 'Link environment to project via mappings',
  tags: ['Projects'],
  security: [{ bearerAuth: [] }],
  request: {
    params: projectIdParam,
    body: { content: { 'application/json': { schema: LinkEnvironmentMappingRequest } } }
  },
  responses: {
    201: { description: 'Linked', content: { 'application/json': { schema: MessageResponse } } },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } },
    409: {
      description: 'Already linked',
      content: { 'application/json': { schema: ErrorResponse } }
    }
  }
});

// /api/projects/{id}/environment-mappings/{environmentId}
registry.registerPath({
  method: 'put',
  path: '/api/projects/{id}/environment-mappings/{environmentId}',
  summary: 'Update environment mapping',
  tags: ['Projects'],
  security: [{ bearerAuth: [] }],
  request: {
    params: projectEnvIdParam,
    body: { content: { 'application/json': { schema: UpdateEnvironmentMappingRequest } } }
  },
  responses: {
    200: { description: 'Updated', content: { 'application/json': { schema: MessageResponse } } },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

registry.registerPath({
  method: 'delete',
  path: '/api/projects/{id}/environment-mappings/{environmentId}',
  summary: 'Unlink environment mapping',
  tags: ['Projects'],
  security: [{ bearerAuth: [] }],
  request: { params: projectEnvIdParam },
  responses: {
    200: { description: 'Unlinked', content: { 'application/json': { schema: MessageResponse } } },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } }
  }
});
