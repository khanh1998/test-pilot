# Environment Management Feature Proposal

## Overview

This proposal outlines the implementation of an Environment Management system for the Test-Pilot project. This feature will enable users to create environment sets (like "Hero") containing multiple environments (dev, sit, uat, prod) with environment-specific API hosts and variables, making test flows more suitable for real-world multi-environment scenarios.

## Problem Statement

Currently, test flows use static API hosts and parameters, which doesn't reflect real-world usage where:
- Different environments (dev, sit, uat, prod) have different API endpoints
- Each environment requires different configuration values (usernames, passwords, API keys)
- Teams need to switch between environments quickly during testing
- Manual parameter changes are error-prone and time-consuming

## Solution Overview

### Core Concepts

1. **Environment Set**: A logical grouping of related environments (e.g., "Hero Project")
2. **Environment**: A specific deployment environment (dev, sit, uat, prod)
3. **Environment Variables**: Configurable values that vary per environment
4. **Environment API Hosts**: Environment-specific API endpoint URLs

### Key Features

1. **Environment Set Management**: Users can create and manage environment sets
2. **Multi-Environment Support**: Each set can contain multiple environments
3. **Variable Management**: Define variables once, set values per environment
4. **API Host Override**: Environment-specific API hosts override default configurations
5. **Flow Integration**: Link test flows to environment sets for easy execution
6. **Backward Compatibility**: Existing flows continue to work unchanged

## Detailed Design

### 1. Database Schema

#### Simplified Schema Structure

```sql
-- Unified Environments table - stores all environment configurations in JSONB
CREATE TABLE environments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  user_id INTEGER REFERENCES users(id) NOT NULL,
  config JSONB NOT NULL, -- Stores all environment configuration
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, name) -- Prevent duplicate environment names per user
);

-- Link table between environments and APIs
CREATE TABLE environment_apis (
  id SERIAL PRIMARY KEY,
  environment_id INTEGER REFERENCES environments(id) ON DELETE CASCADE NOT NULL,
  api_id INTEGER REFERENCES apis(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(environment_id, api_id) -- One relationship per environment-API pair
);

-- Add environment_id to test_flows for linking
ALTER TABLE test_flows ADD COLUMN environment_id INTEGER REFERENCES environments(id);

-- Indexes for efficient JSONB queries and relationships
CREATE INDEX idx_environments_config_gin ON environments USING GIN (config);
CREATE INDEX idx_environments_user_id ON environments (user_id);
CREATE INDEX idx_environment_apis_env_id ON environment_apis (environment_id);
CREATE INDEX idx_environment_apis_api_id ON environment_apis (api_id);
```

#### JSONB Configuration Structure

The `config` JSONB field will store all environment data in the following structure:

```json
{
  "type": "environment_set", // or "single_environment"
  "environments": {
    "dev": {
      "name": "Development",
      "description": "Development environment",
      "variables": {
        "username": "dev_user",
        "password": "dev123",
        "api_key": "dev_key_123"
        // Note: If a variable is not specified here, it will fall back to default_value
      },
      "api_hosts": {
        "1": "https://api.dev.hero.com",
        "2": "https://auth.dev.hero.com"
      }
    },
    "sit": {
      "name": "System Integration Test",
      "description": "SIT environment",
      "variables": {
        "username": "sit_user", 
        "password": "sit456",
        "api_key": "sit_key_456"
      },
      "api_hosts": {
        "1": "https://api.sit.hero.com",
        "2": "https://auth.sit.hero.com"
      }
    },
    "prod": {
      "name": "Production",
      "description": "Production environment",
      "variables": {
        "username": "prod_user",
        // password not specified - will use default_value
        "api_key": "prod_key_789"
      },
      "api_hosts": {
        "1": "https://api.hero.com",
        "2": "https://auth.hero.com"
      }
    }
  },
  "variable_definitions": {
    "username": {
      "type": "string",
      "description": "Login username",
      "required": true,
      "default_value": "default_user"
    },
    "password": {
      "type": "string", 
      "description": "Login password",
      "required": true,
      "default_value": "changeme123"
    },
    "api_key": {
      "type": "string",
      "description": "API authentication key", 
      "required": true,
      "default_value": "default_api_key"
    }
  },
  "linked_apis": [1, 2, 5] // References to APIs this environment works with
}
```

### 2. Enhanced Template Expression System

#### New Expression Type: `{{env:variable_name}}`

- **Purpose**: Reference environment variables in flow parameters
- **Format**: `{{env:variable_name}}`
- **Example**: `{{env:username}}`, `{{env:api_key}}`
- **Resolution**: 
  - If environment is selected: resolve to environment variable value
  - If no environment selected: fall back to parameter's `default_value`

#### Updated Parameter Structure

```typescript
type FlowParameter = {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  value?: unknown;           // NEW: Can contain {{env:var_name}} expressions
  defaultValue?: unknown;    // NEW: Concrete fallback value (no expressions allowed)
  description?: string;
  required: boolean;
};
```

### 3. API Structure

#### Environment Management APIs

```
GET    /api/environments                    # List user's environments
POST   /api/environments                    # Create new environment
GET    /api/environments/{envId}            # Get specific environment (full config)
PUT    /api/environments/{envId}            # Update environment (full config)
DELETE /api/environments/{envId}            # Delete environment

POST   /api/environments/{envId}/apis/{apiId}     # Link an API to environment
DELETE /api/environments/{envId}/apis/{apiId}     # Unlink an API from environment
```

#### Test Flow Integration APIs

```
# No additional APIs needed - environments are fetched and used locally for execution
```

#### API Request/Response Examples

**Create Environment:**
```json
POST /api/environments
{
  "name": "Hero Project",
  "description": "Main project environments",
  "config": {
    "type": "environment_set",
    "environments": {
      "dev": {
        "name": "Development",
        "variables": { "username": "dev_user" },
        "api_hosts": { "1": "https://api.dev.hero.com" }
      }
    },
    "variable_definitions": {
      "username": {
        "type": "string",
        "default_value": "default_user",
        "required": true
      }
    }
  }
}
```

**Update Environment (Full Config):**
```json
PUT /api/environments/{envId}
{
  "name": "Hero Project Updated",
  "config": {
    // Full JSONB config object
  }
}
```

### 4. User Interface Design

#### 4.1 Environment Management Pages

**Main Environments Page** (`/dashboard/environments`)
- List all user environments (both sets and individual environments)
- Create new environment or environment set
- Quick actions (edit, delete, duplicate)

**Environment Detail Page** (`/dashboard/environments/{envId}`)
- Overview tab showing environment info and sub-environments
- Sub-environments tab for managing individual environments (dev, sit, uat, prod)
- Variables tab for defining variables with default values and setting specific values per sub-environment
- API Hosts tab for configuring hosts per sub-environment
- APIs tab for linking/unlinking APIs to this environment

#### 4.2 Test Flow Integration

**Test Flow Settings Tab Enhancement**
- Environment Linking section
- Dropdown to select which environment to link to the flow
- Preview of available sub-environments and variables

**Test Flow Execution Enhancement**
- Environment selector dropdown next to "Execute Flow" button
- Shows sub-environments from linked environment
- Option to run without environment (uses default values)
- Visual indicator when environment is selected

#### 4.3 Parameter Editor Enhancement**
- Support for `{{env:variable_name}}` expressions in parameter values
- Autocomplete for available environment variables
- Visual validation of environment expressions
- Clear distinction between `value` (can have expressions) and `defaultValue` (concrete only)

### 5. Implementation Phases

#### Phase 1: Backend Infrastructure (Week 1)
1. Database schema and migrations
2. Repository layer (CRUD operations)
3. Service layer (business logic)
4. API controllers

#### Phase 2: Template Engine Enhancement (Week 1)
1. Add `env` expression type to template engine
2. Update template context to include environment variables
3. Enhance parameter resolution logic
4. Add tests for new template functionality

#### Phase 3: Frontend - Environment Management (Week 2)
1. Environment management pages
2. Environment set CRUD operations
3. Variable management interface
4. API host configuration per environment

#### Phase 4: Frontend - Test Flow Integration (Week 2)
1. Environment set linking in test flow settings
2. Environment selector in execution interface
3. Enhanced parameter editor with env expressions
4. Update flow runner to handle environment context

#### Phase 5: Testing & Documentation (Week 3)
1. End-to-end testing
2. User documentation
3. Migration guide
4. Performance optimization

### 6. Implementation Guidelines

#### 6.1 Project Structure and Organization

**Backend API (Three-Layer Architecture):**
```
src/routes/api/environments/
├── +server.ts                           # Controller layer
├── [envId]/
│   ├── +server.ts                       # Environment-specific controller
│   └── apis/
│       └── [apiId]/+server.ts           # API linking controller

src/lib/server/service/environments/
├── create_environment.ts               # Business logic for creation
├── get_environments.ts                 # Business logic for retrieval
├── update_environment.ts               # Business logic for updates
├── delete_environment.ts               # Business logic for deletion
├── link_api.ts                         # Business logic for API linking
├── resolve_environment_variables.ts    # Variable resolution logic
└── validate_environment_config.ts      # Config validation logic

src/lib/server/repository/db/
├── environment.ts                      # Database operations for environments
└── environment_api.ts                  # Database operations for environment-API linking
```

**Frontend Components:**
```
src/lib/components/environments/
├── EnvironmentList.svelte              # List all environments
├── EnvironmentCard.svelte              # Individual environment card
├── EnvironmentEditor.svelte            # Create/edit environment form
├── SubEnvironmentEditor.svelte         # Edit sub-environments (dev, sit, uat)
├── VariableDefinitionEditor.svelte     # Define variables with defaults
├── VariableValueEditor.svelte          # Set variable values per sub-environment
├── ApiHostEditor.svelte                # Configure API hosts per sub-environment
├── ApiLinkingManager.svelte            # Link/unlink APIs to environment
├── EnvironmentSelector.svelte          # Dropdown for selecting environment + sub-env
└── EnvironmentPreview.svelte           # Preview resolved config

src/lib/components/test-flows/
├── EnvironmentIntegration.svelte       # Environment selection in flow execution
└── ParameterEditorEnhanced.svelte      # Enhanced parameter editor with {{env:}} support
```

**Frontend Pages:**
```
src/routes/dashboard/environments/
├── +page.svelte                        # Main environments list page
├── +page.ts                            # Load environments data
├── new/
│   └── +page.svelte                    # Create new environment page
└── [envId]/
    ├── +page.svelte                    # Environment detail page
    ├── +page.ts                        # Load environment data
    ├── edit/
    │   └── +page.svelte                # Edit environment page
    └── sub-environments/
        └── [subEnvName]/
            └── +page.svelte            # Sub-environment detail page
```

#### 6.2 Database Implementation

**Migration File:**
```
drizzle/
└── XXXX_add_environments.sql           # New migration file
```

**Schema Updates:**
```typescript
// src/lib/server/db/schema.ts
export const environments = pgTable('environments', {
  // ... table definition
});

export const environmentApis = pgTable('environment_apis', {
  // ... table definition
});
```

**Relations:**
```typescript
// src/lib/server/db/relations.ts
export const environmentsRelations = relations(environments, ({ one, many }) => ({
  user: one(users, {
    fields: [environments.userId],
    references: [users.id],
  }),
  environmentApis: many(environmentApis),
  testFlows: many(testFlows),
}));

export const environmentApisRelations = relations(environmentApis, ({ one }) => ({
  environment: one(environments, {
    fields: [environmentApis.environmentId],
    references: [environments.id],
  }),
  api: one(apis, {
    fields: [environmentApis.apiId],
    references: [apis.id],
  }),
}));
```

#### 6.3 API Implementation Guidelines

**Controller Layer (src/routes/api/environments/+server.ts):**
```typescript
import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { 
  createEnvironment, 
  getEnvironmentsForUser, 
  validateEnvironmentData 
} from '$lib/server/service/environments';

export async function GET({ locals, url }: RequestEvent) {
  // 1. Check authentication
  // 2. Extract query parameters
  // 3. Call service layer
  // 4. Return JSON response
}

export async function POST({ request, locals }: RequestEvent) {
  // 1. Check authentication
  // 2. Validate request body
  // 3. Call service layer
  // 4. Handle errors
  // 5. Return JSON response
}
```

**Service Layer (src/lib/server/service/environments/create_environment.ts):**
```typescript
import { db } from '$lib/server/db';
import { environments, environmentApis } from '$lib/server/db/schema';
import { validateEnvironmentConfig } from './validate_environment_config';

export async function createEnvironment(
  userId: number, 
  environmentData: CreateEnvironmentData
): Promise<Environment> {
  // 1. Validate environment configuration
  // 2. Process business logic
  // 3. Call repository layer
  // 4. Return processed result
}
```

**Repository Layer (src/lib/server/repository/db/environment.ts):**
```typescript
import { db } from '$lib/server/db';
import { environments } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export async function createEnvironmentRecord(
  userId: number,
  environmentData: EnvironmentInsert
): Promise<Environment> {
  // Direct database operations using Drizzle ORM
}

export async function getEnvironmentsByUserId(userId: number): Promise<Environment[]> {
  // Direct database operations using Drizzle ORM
}
```

#### 6.4 Frontend Implementation Guidelines

**HTTP Client (src/lib/http_client/environments.ts):**
```typescript
import { getApiClient } from './base';

const apiClient = getApiClient();

export interface EnvironmentCreateData {
  name: string;
  description?: string;
  config: EnvironmentConfig;
}

export async function createEnvironment(data: EnvironmentCreateData) {
  return apiClient.post('/environments', data);
}

export async function getEnvironments() {
  return apiClient.get('/environments');
}

export async function getEnvironment(envId: number) {
  return apiClient.get(`/environments/${envId}`);
}

export async function updateEnvironment(envId: number, data: Partial<EnvironmentCreateData>) {
  return apiClient.put(`/environments/${envId}`, data);
}

export async function deleteEnvironment(envId: number) {
  return apiClient.delete(`/environments/${envId}`);
}

export async function linkApiToEnvironment(envId: number, apiId: number) {
  return apiClient.post(`/environments/${envId}/apis/${apiId}`);
}

export async function unlinkApiFromEnvironment(envId: number, apiId: number) {
  return apiClient.delete(`/environments/${envId}/apis/${apiId}`);
}
```

**Component Guidelines:**
```typescript
// src/lib/components/environments/EnvironmentEditor.svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { EnvironmentConfig } from '$lib/types/environment';
  
  export let environment: Environment | null = null;
  export let isEditing: boolean = false;
  
  const dispatch = createEventDispatcher();
  
  // Component logic here
</script>

<!-- Component template here -->
```

#### 6.5 Type Definitions

**Environment Types (src/lib/types/environment.ts):**
```typescript
export interface Environment {
  id: number;
  name: string;
  description?: string;
  userId: number;
  config: EnvironmentConfig;
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentConfig {
  type: 'environment_set' | 'single_environment';
  environments: Record<string, SubEnvironment>;
  variable_definitions: Record<string, VariableDefinition>;
  linked_apis?: number[];
}

export interface SubEnvironment {
  name: string;
  description?: string;
  variables: Record<string, unknown>;
  api_hosts: Record<string, string>;
}

export interface VariableDefinition {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  required: boolean;
  default_value: unknown;
}
```

#### 6.6 Testing Guidelines

**Unit Tests:**
```
tests/environments/
├── service/
│   ├── create_environment.test.ts
│   ├── resolve_variables.test.ts
│   └── validate_config.test.ts
├── repository/
│   └── environment.test.ts
└── components/
    ├── EnvironmentEditor.test.ts
    └── EnvironmentSelector.test.ts
```

**Test Structure:**
```typescript
// tests/environments/service/create_environment.test.ts
import { describe, it, expect } from 'vitest';
import { createEnvironment } from '$lib/server/service/environments/create_environment';

describe('createEnvironment', () => {
  it('should create environment with valid config', async () => {
    // Test implementation
  });
  
  it('should validate environment config', async () => {
    // Test implementation
  });
});
```

#### 6.7 Error Handling

**Service Layer Error Handling:**
```typescript
export class EnvironmentError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'EnvironmentError';
  }
}

export class EnvironmentValidationError extends EnvironmentError {
  constructor(message: string, public field: string) {
    super(message, 'VALIDATION_ERROR');
  }
}
```

**API Error Responses:**
```typescript
// Consistent error response format
interface ApiError {
  error: string;
  message: string;
  code?: string;
  field?: string;
}
```

#### 6.8 Navigation Updates

**Main Navigation (src/lib/components/Navigation.svelte):**
```svelte
<!-- Add Environments link to main navigation -->
<a href="/dashboard/environments" class="nav-link">
  <EnvironmentIcon />
  Environments
</a>
```

**Breadcrumb Updates:**
```typescript
// src/lib/utils/breadcrumbs.ts
export function getEnvironmentBreadcrumbs(envId?: string, subEnvName?: string) {
  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Environments', href: '/dashboard/environments' }
  ];
  
  if (envId) {
    breadcrumbs.push({ 
      label: 'Environment Details', 
      href: `/dashboard/environments/${envId}` 
    });
  }
  
  return breadcrumbs;
}
```

### 7. FlowRunner Environment Support Plan

The FlowRunner component requires minimal but targeted improvements to support environment-aware execution while maintaining full backward compatibility.

#### Current Flow Execution Process:
1. `runFlow()` → validates API hosts
2. `prepareParameters()` → sets up parameter values 
3. `checkRequiredParameters()` → validates required params
4. `executeFlowAfterParameterCheck()` → runs the actual flow

#### Proposed Changes:

##### 7.1 Add Environment Context Support (Minimal Addition)
```typescript
// New props to FlowRunner.svelte
export let selectedEnvironment: EnvironmentData | null = null; // Optional environment data

// Environment data type
interface EnvironmentData {
  id: number;
  name: string;
  subEnvironmentName: string;          // Selected sub-environment (dev, sit, uat)
  variables: Record<string, unknown>;   // Resolved environment variables (with fallbacks)
  apiHosts: Record<string, string>;     // API host overrides
  environmentConfig: any;               // Full environment config for advanced resolution
}
```

##### 7.2 Enhanced Parameter Preparation (Small Modification)
```typescript
// Update prepareParameters() function
function prepareParameters() {
  parameterValues = {};
  
  flowData.parameters.forEach((parameter) => {
    let resolvedValue = parameter.value;
    
    // NEW: If parameter value contains {{env:}} and we have environment
    if (selectedEnvironment && 
        typeof parameter.value === 'string' && 
        parameter.value.includes('{{env:')) {
      
      try {
        // Create environment context for template resolution
        const envContext: TemplateContext = {
          parameters: {},
          responses: {},
          transformedData: {},
          environment: selectedEnvironment.variables // NEW!
        };
        
        resolvedValue = resolveTemplate(parameter.value, envContext);
      } catch (error) {
        // Fall back to defaultValue if environment resolution fails
        addLog('warning', `Failed to resolve environment variable in parameter ${parameter.name}, using default`, String(error));
        resolvedValue = parameter.defaultValue;
      }
    }
    
    // Use resolved value or fall back to defaultValue
    if (resolvedValue !== undefined && resolvedValue !== null) {
      parameterValues[parameter.name] = resolvedValue;
    } else if (parameter.defaultValue !== undefined && parameter.defaultValue !== null) {
      parameterValues[parameter.name] = parameter.defaultValue;
      parameter.value = parameter.defaultValue;
    }
  });
  
  addLog('debug', 'Flow Parameters prepared', JSON.stringify(parameterValues, null, 2));
}

// NEW: Helper function to resolve environment variables with fallbacks
function resolveEnvironmentVariable(variableName: string, environmentData: EnvironmentData): unknown {
  const subEnv = environmentData.subEnvironmentName;
  const config = environmentData.environmentConfig;
  
  // First, try to get the value from the specific sub-environment
  if (config.environments[subEnv]?.variables?.[variableName] !== undefined) {
    return config.environments[subEnv].variables[variableName];
  }
  
  // Fall back to the default value from variable definition
  if (config.variable_definitions?.[variableName]?.default_value !== undefined) {
    addLog('debug', `Using default value for environment variable: ${variableName}`);
    return config.variable_definitions[variableName].default_value;
  }
  
  // If no default value, throw error
  throw new Error(`Environment variable '${variableName}' not found in sub-environment '${subEnv}' and no default value defined`);
}
```

##### 7.3 Environment-Aware API Host Resolution (Small Modification)
```typescript
// Update the API host resolution in executeEndpoint()
function getApiHostForEndpoint(endpoint: StepEndpoint): string {
  let endpointHost = '';
  
  // NEW: Check environment API hosts first (override default)
  if (selectedEnvironment && 
      selectedEnvironment.apiHosts && 
      endpoint.api_id && 
      selectedEnvironment.apiHosts[endpoint.api_id]) {
    
    endpointHost = selectedEnvironment.apiHosts[endpoint.api_id];
    addLog('debug', `Using environment host for API ID ${endpoint.api_id}: ${endpointHost}`);
    return endpointHost;
  }
  
  // Fall back to existing api_hosts logic
  if (endpoint.api_id && flowData.settings?.api_hosts) {
    const apiHostInfo = flowData.settings.api_hosts[endpoint.api_id];
    if (apiHostInfo?.url) {
      endpointHost = apiHostInfo.url;
      addLog('debug', `Using default host for API ID ${endpoint.api_id}: ${endpointHost}`);
    }
  }
  
  return endpointHost;
}
```

##### 7.4 Template Engine Enhancement (One-time addition)
```typescript
// Update src/lib/template/engine.ts to support 'env' source
function resolveExpressionBySource(expression: TemplateExpression, context: TemplateContext, functions: Record<string, (...args: unknown[]) => unknown>): unknown {
  switch (expression.source) {
    case 'res':
      return resolveResponseExpression(expression.path, context);
    case 'proc':
      return resolveTransformationExpression(expression.path, context);
    case 'param':
      return resolveParameterExpression(expression.path, context);
    case 'func':
      return resolveFunctionExpression(expression.path, functions);
    case 'env': // NEW!
      return resolveEnvironmentExpression(expression.path, context);
    default:
      throw new Error(`Unknown template source: ${expression.source}`);
  }
}

// NEW function with default value fallback support
function resolveEnvironmentExpression(variableName: string, context: TemplateContext): unknown {
  if (!context.environment) {
    throw new Error('Environment context not available for environment variable resolution');
  }
  
  if (!(variableName in context.environment)) {
    const availableVars = Object.keys(context.environment);
    throw new Error(`Environment variable not found: ${variableName}. Available variables: ${availableVars.join(', ')}`);
  }
  
  return context.environment[variableName];
}
```

##### 7.5 Usage from Parent Component (Test Flow Page)
```typescript
// In test flow execution page
let selectedEnvironment: EnvironmentData | null = null;

// Before execution, fetch environment data if selected
async function executeWithEnvironment(environmentId?: number, subEnvName?: string) {
  if (environmentId && subEnvName) {
    selectedEnvironment = await fetchEnvironmentData(environmentId, subEnvName);
  } else {
    selectedEnvironment = null; // Use defaults
  }
  
  flowRunner.runFlow(); // Existing method, no changes needed
}

// Helper function to fetch environment data
async function fetchEnvironmentData(envId: number, subEnvName: string): Promise<EnvironmentData> {
  const response = await fetch(`/api/environments/${envId}`);
  const envData = await response.json();
  
  const subEnv = envData.config.environments[subEnvName];
  if (!subEnv) {
    throw new Error(`Sub-environment ${subEnvName} not found`);
  }
  
  // Resolve variables with fallback to defaults
  const resolvedVariables: Record<string, unknown> = {};
  const variableDefinitions = envData.config.variable_definitions || {};
  
  // For each variable definition, get the value from sub-environment or use default
  Object.keys(variableDefinitions).forEach(varName => {
    if (subEnv.variables?.[varName] !== undefined) {
      // Use sub-environment specific value
      resolvedVariables[varName] = subEnv.variables[varName];
    } else if (variableDefinitions[varName].default_value !== undefined) {
      // Use default value from definition
      resolvedVariables[varName] = variableDefinitions[varName].default_value;
    }
    // If neither exists, the variable will be undefined (handled by template engine)
  });
  
  return {
    id: envId,
    name: envData.name,
    subEnvironmentName: subEnvName,
    variables: resolvedVariables,
    apiHosts: subEnv.api_hosts || {},
    environmentConfig: envData.config
  };
}
```

#### Key Benefits of This Approach:

1. **Minimal Code Changes**: Only 3-4 small modifications to existing functions
2. **Backward Compatible**: Flows without environment work exactly as before
3. **Gradual Adoption**: Users can migrate parameters to use `{{env:}}` expressions over time
4. **Clear Separation**: Environment logic is contained, doesn't affect core execution flow
5. **Robust Fallback**: Always falls back to `defaultValue` if environment resolution fails

#### Execution Flow:
```
Without Environment (current behavior):
runFlow() → prepareParameters() → uses parameter.value or parameter.defaultValue

With Environment (new behavior):
runFlow() → prepareParameters() → resolves {{env:}} expressions → falls back to defaultValue if needed
```

#### Parameter Structure Example:
```typescript
// Existing parameter (works unchanged)
{
  name: "username",
  type: "string",
  value: "test_user",           // concrete value
  defaultValue: "test_user",    // same value
  required: true
}

// Environment-aware parameter (new)
{
  name: "username", 
  type: "string",
  value: "{{env:username}}",    // environment expression
  defaultValue: "test_user",    // fallback value
  required: true
}
```

### 8. Example User Workflow

#### Setup Phase
1. User creates "Hero Project" environment
2. Links relevant APIs to the environment (User API, Auth API, etc.)
3. Adds sub-environments: dev, sit, uat, prod
4. Defines variables with default values: 
   - `username` (type: string, default: "default_user")
   - `password` (type: string, default: "changeme123") 
   - `api_key` (type: string, default: "default_key")
5. Sets environment-specific values (optional, will use defaults if not set):
   - dev: username="test_user", password="test123", api_key="dev_key"
   - sit: username="sit_user", password="sit456" (api_key uses default)
   - prod: username="prod_user" (password and api_key use defaults)
6. Configures API hosts per sub-environment:
   - dev: api.dev.hero.com
   - sit: api.sit.hero.com  
   - prod: api.hero.com

#### Usage Phase
1. User opens existing test flow
2. Links flow to "Hero Project" environment
3. Updates parameters:
   - username: value=`{{env:username}}`, defaultValue="default_user"
   - password: value=`{{env:password}}`, defaultValue="default_pass"
4. Selects "sit" sub-environment from dropdown
5. Executes flow with sit-specific configuration

### 9. Backward Compatibility

#### Migration Strategy
- **Existing flows**: Continue to work unchanged
- **Parameter enhancement**: Gradual adoption of new `value`/`defaultValue` structure
- **API hosts**: Environment hosts override existing hosts when environment is selected
- **Template expressions**: `{{env:}}` expressions fall back gracefully when no environment is provided

#### Data Migration
- Add `environment_id` column to `test_flows` table (nullable)
- Migrate existing parameter structure to include `defaultValue` (copy from current `value`)
- No breaking changes to existing flow JSON structure

### 10. Technical Considerations

#### Performance
- Environment data cached during flow execution
- Efficient queries with proper indexing
- Lazy loading of environment details

#### Security
- Environment variables are user-scoped
- Sensitive data handling for credentials
- Proper access control for environment management

#### Scalability
- Support for large numbers of sub-environments per environment
- Efficient variable resolution using JSONB indexing
- Optimized API queries with GIN indexes

### 11. Success Metrics

#### User Experience
- Reduced time to switch between environments
- Fewer manual configuration errors
- Increased test flow reusability

#### Technical Metrics
- Zero breaking changes to existing flows
- < 100ms overhead for environment resolution
- Support for 50+ sub-environments per environment
- Efficient JSONB queries with proper indexing

### 12. Future Enhancements

#### Potential Extensions
- Environment templates/inheritance
- Encrypted variable values for sensitive data
- Environment-specific test configurations
- Integration with external configuration systems
- Team/workspace-level environments

#### Integration Opportunities
- CI/CD pipeline integration
- External secret management systems
- Environment promotion workflows

## Conclusion

This Environment Management feature will significantly enhance Test-Pilot's real-world usability by enabling seamless multi-environment testing. The design prioritizes backward compatibility while providing powerful new capabilities for environment-aware test execution.

The phased implementation approach ensures stable delivery while allowing for user feedback and iterative improvements throughout the development process.
