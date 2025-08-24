# 📋 Project Feature Proposal

**Feature Name**: Project Management System  
**Target User**: Backend engineers and QA developers  
**Goal**: Enable grouping, organization, and batch execution of related test flows with environment-specific configurations and variable management.

---

## ✅ Objective

Build a comprehensive **Project Management System** that allows users to:

- **Group Related Test Flows**: Organize test flows into logical projects for better management
- **Environment Management**: Define multiple environments (dev, sit, uat, prod) with specific configurations
- **Variable Management**: Define project-level variables that can be customized per environment
- **Batch Execution**: Run all flows in a project or specific sequences across different environments
- **Flow Sequencing**: Create execution sequences with dependencies and data flow between test flows

---

## 🧩 Data Model Overview

### 🔹 New Tables

#### `projects`
```sql
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  user_id INTEGER REFERENCES users(id),
  settings JSONB NOT NULL DEFAULT '{}', -- Project-level settings
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `project_variables`
```sql
CREATE TABLE project_variables (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  variable_type VARCHAR(50) DEFAULT 'string', -- string, number, boolean, object
  default_value TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, name)
);
```

#### `project_environments`
```sql
CREATE TABLE project_environments (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  variable_values JSONB NOT NULL DEFAULT '{}', -- { "varName": "value" }
  api_hosts JSONB NOT NULL DEFAULT '{}', -- { "apiId": "https://host.com" }
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, name)
);
```

#### `project_apis`
```sql
CREATE TABLE project_apis (
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  api_id INTEGER REFERENCES apis(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, api_id)
);
```

#### `project_sequences`
```sql
CREATE TABLE project_sequences (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  steps JSONB NOT NULL DEFAULT '[]', -- Array of sequence steps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `project_sequence_executions`
```sql
CREATE TABLE project_sequence_executions (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  sequence_id INTEGER REFERENCES project_sequences(id) ON DELETE CASCADE,
  environment_id INTEGER REFERENCES project_environments(id),
  status VARCHAR(50) DEFAULT 'pending', -- pending, running, completed, failed
  execution_results JSONB, -- Detailed execution results
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🏗️ Project Structure

### Project Configuration
```json
{
  "id": 1,
  "name": "E-commerce API Testing",
  "description": "Complete test suite for e-commerce platform APIs",
  "settings": {
    "timeout": 30000,
    "retryPolicy": {
      "maxRetries": 3,
      "backoffStrategy": "exponential"
    },
    "globalHeaders": {
      "User-Agent": "Test-Pilot/1.0"
    }
  }
}
```

### Variable Definitions
```json
{
  "variables": [
    {
      "name": "username",
      "description": "Test user username",
      "type": "string",
      "defaultValue": "testuser"
    },
    {
      "name": "baseTimeout",
      "description": "Default timeout for API calls",
      "type": "number",
      "defaultValue": "5000"
    }
  ]
}
```

### Environment Configuration
```json
{
  "environments": [
    {
      "name": "development",
      "description": "Development environment",
      "isDefault": true,
      "variableValues": {
        "username": "dev-testuser",
        "baseTimeout": "10000"
      },
      "apiHosts": {
        "1": "https://dev-api.example.com",
        "2": "https://dev-auth.example.com"
      }
    },
    {
      "name": "staging",
      "description": "Staging environment",
      "isDefault": false,
      "variableValues": {
        "username": "stage-testuser",
        "baseTimeout": "5000"
      },
      "apiHosts": {
        "1": "https://staging-api.example.com",
        "2": "https://staging-auth.example.com"
      }
    }
  ]
}
```

### Sequence Structure
```json
{
  "sequences": [
    {
      "id": 1,
      "name": "User Authentication Flow",
      "description": "Complete user registration and login sequence",
      "order": 1,
      "steps": [
        {
          "stepId": "auth-step-1",
          "label": "Authentication Setup",
          "testFlows": [
            {
              "testFlowId": 5,
              "inputParameters": {
                "username": "{{prjvar:username}}",
                "environment": "{{env:current}}"
              },
              "outputMapping": {
                "authToken": "$.response.token",
                "userId": "$.response.user.id"
              }
            }
          ]
        },
        {
          "stepId": "auth-step-2", 
          "label": "Token Validation",
          "testFlows": [
            {
              "testFlowId": 6,
              "inputParameters": {
                "token": "{{res:auth-step-1.authToken}}",
                "userId": "{{res:auth-step-1.userId}}"
              },
              "outputMapping": {
                "validationResult": "$.response.valid"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 🎯 Core Features

### 1. **Project Management**
- Create, read, update, delete projects
- Associate APIs with projects
- Project-level settings and configurations
- Project cloning and templating

### 2. **Variable Management**
- Define project-wide variables with types and descriptions
- Environment-specific variable value overrides
- Template expression support in variable values
- Variable validation and type checking

### 3. **Environment Management**
- Multiple environment support (dev, staging, prod, etc.)
- Environment-specific API host configurations
- Environment-specific variable values
- Default environment designation

### 4. **Sequence Builder**
- Visual sequence editor with drag-and-drop
- Step-based execution with dependency management
- Parallel and sequential flow execution within steps
- Data flow between steps using template expressions

### 5. **Expression System**
- Project variable references: `{{prjvar:variableName}}`
- Previous step output references: `{{res:stepId.outputKey}}`
- Environment references: `{{env:property}}`
- Built-in functions: `{{func:randomString(10)}}`

### 6. **Execution Engine**
- Run entire project (all sequences)
- Run specific sequences
- Environment selection for execution
- Real-time execution monitoring
- Execution history and reporting

---

## 🛠️ Implementation Plan

### Backend Implementation

#### 1. Database Schema Updates
```typescript
// src/lib/server/db/schema.ts
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  userId: integer('user_id').references(() => users.id),
  settings: jsonb('settings').notNull().default('{}'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const projectVariables = pgTable('project_variables', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  variableType: varchar('variable_type', { length: 50 }).default('string'),
  defaultValue: text('default_value'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const projectEnvironments = pgTable('project_environments', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isDefault: boolean('is_default').default(false),
  variableValues: jsonb('variable_values').notNull().default('{}'),
  apiHosts: jsonb('api_hosts').notNull().default('{}'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const projectApis = pgTable('project_apis', {
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  apiId: integer('api_id').references(() => apis.id, { onDelete: 'cascade' })
});

export const projectSequences = pgTable('project_sequences', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  sequenceOrder: integer('sequence_order').notNull().default(0),
  steps: jsonb('steps').notNull().default('[]'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const projectSequenceExecutions = pgTable('project_sequence_executions', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  sequenceId: integer('sequence_id').references(() => projectSequences.id, { onDelete: 'cascade' }),
  environmentId: integer('environment_id').references(() => projectEnvironments.id),
  status: varchar('status', { length: 50 }).default('pending'),
  executionResults: jsonb('execution_results'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});
```

#### 2. Repository Layer
```
src/lib/server/repository/db/
├── projects.ts
├── project-variables.ts
├── project-environments.ts
├── project-apis.ts
├── project-sequences.ts
└── project-executions.ts
```

#### 3. Service Layer
```
src/lib/server/service/projects/
├── create-project.ts
├── update-project.ts
├── delete-project.ts
├── get-project.ts
├── list-projects.ts
├── manage-variables.ts
├── manage-environments.ts
├── manage-sequences.ts
├── execute-project.ts
├── execute-sequence.ts
└── expression-evaluator.ts
```

#### 4. API Controllers
```
src/routes/api/projects/
├── +server.ts                    // GET /api/projects, POST /api/projects
├── [id]/
│   ├── +server.ts               // GET, PUT, DELETE /api/projects/{id}
│   ├── variables/
│   │   └── +server.ts           // GET, POST /api/projects/{id}/variables
│   ├── environments/
│   │   └── +server.ts           // GET, POST /api/projects/{id}/environments
│   ├── sequences/
│   │   └── +server.ts           // GET, POST /api/projects/{id}/sequences
│   └── execute/
│       └── +server.ts           // POST /api/projects/{id}/execute
└── sequences/
    └── [sequenceId]/
        └── execute/
            └── +server.ts       // POST /api/projects/sequences/{sequenceId}/execute
```

### Frontend Implementation

#### 1. Route Structure
```
src/routes/dashboard/projects/
├── +page.svelte                 // Project list page
├── create/
│   └── +page.svelte            // Create project page
├── [id]/
│   ├── +page.svelte            // Project detail page
│   ├── +layout.svelte          // Project layout with tabs
│   ├── sequences/
│   │   ├── +page.svelte        // Sequences tab
│   │   ├── [sequenceId]/
│   │   │   └── +page.svelte    // Sequence editor
│   │   └── create/
│   │       └── +page.svelte    // Create sequence
│   ├── environments/
│   │   └── +page.svelte        // Environments tab
│   ├── variables/
│   │   └── +page.svelte        // Variables tab
│   └── settings/
│       └── +page.svelte        // Project settings
```

#### 2. Component Structure
```
src/lib/components/projects/
├── ProjectCard.svelte           // Project list item
├── ProjectForm.svelte           // Create/edit project form
├── ProjectTabs.svelte           // Tab navigation
├── variables/
│   ├── VariableList.svelte
│   ├── VariableForm.svelte
│   └── VariableEditor.svelte
├── environments/
│   ├── EnvironmentList.svelte
│   ├── EnvironmentForm.svelte
│   └── EnvironmentSelector.svelte
├── sequences/
│   ├── SequenceList.svelte
│   ├── SequenceEditor.svelte
│   ├── SequenceStepEditor.svelte
│   ├── FlowPipelineView.svelte
│   └── ExecutionMonitor.svelte
└── execution/
    ├── ExecutionPanel.svelte
    ├── ExecutionHistory.svelte
    └── ExecutionResults.svelte
```

#### 3. HTTP Client Functions
```typescript
// src/lib/http_client/projects.ts
export interface Project {
  id: number;
  name: string;
  description?: string;
  settings: ProjectSettings;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectVariable {
  id: number;
  projectId: number;
  name: string;
  description?: string;
  variableType: 'string' | 'number' | 'boolean' | 'object';
  defaultValue?: string;
}

export interface ProjectEnvironment {
  id: number;
  projectId: number;
  name: string;
  description?: string;
  isDefault: boolean;
  variableValues: Record<string, any>;
  apiHosts: Record<string, string>;
}

export interface ProjectSequence {
  id: number;
  projectId: number;
  name: string;
  description?: string;
  order: number;
  steps: SequenceStep[];
}

export async function getProjects(options?: PaginationOptions): Promise<PaginatedResponse<Project>> {
  // Implementation
}

export async function createProject(project: CreateProjectRequest): Promise<Project> {
  // Implementation  
}

export async function getProject(id: number): Promise<ProjectDetail> {
  // Implementation
}

export async function executeProject(id: number, environmentId: number): Promise<ExecutionResult> {
  // Implementation
}

export async function executeSequence(sequenceId: number, environmentId: number): Promise<ExecutionResult> {
  // Implementation
}
```

---

## 🎨 User Interface Design

### 1. **Project List Page**
- Grid/list view toggle
- Search and filter by name, APIs, created date
- Pagination support
- Quick action buttons (Run, Clone, Delete)
- Create new project button

### 2. **Project Detail Page**
- Tabbed interface:
  - **Overview**: Basic info, recent executions, quick stats
  - **Sequences**: Sequence management and visual editor
  - **Environments**: Environment configuration
  - **Variables**: Variable definitions
  - **Settings**: Project-level configurations
  - **History**: Execution history and results

### 3. **Sequence Editor**
- Visual pipeline builder with drag-and-drop
- Step-based interface showing:
  - Step name and description
  - Test flows in each step (parallel execution)
  - Data flow arrows between steps
  - Input/output parameter mapping
- Expression builder for dynamic values
- Test flow search and selection
- Real-time validation

### 4. **Environment Management**
- Environment list with default indicator
- Variable value override interface
- API host configuration per environment
- Environment cloning functionality

### 5. **Execution Interface**
- Environment selector dropdown
- Run options (full project vs. specific sequence)
- Real-time execution monitoring
- Progress indicator with step-by-step status
- Execution results with expandable details

---

## 🔄 Expression System

### Supported Expression Types

1. **Project Variables**: `{{prjvar:variableName}}`
   - References project-defined variables
   - Uses environment-specific values when available
   - Falls back to default values

2. **Step Results**: `{{res:stepId.outputKey}}`
   - References output from previous sequence steps
   - Supports nested object access with dot notation
   - JSONPath support for complex data extraction

3. **Environment Properties**: `{{env:propertyName}}`
   - Access to current environment metadata
   - Properties: name, id, isDefault

4. **Built-in Functions**: `{{func:functionName(params)}}`
   - `randomString(length)`: Generate random string
   - `randomInt(min, max)`: Generate random integer
   - `formatDate(pattern, date?)`: Format current or specified date
   - `uuid()`: Generate UUID v4

### Expression Evaluation
```typescript
// src/lib/server/service/projects/expression-evaluator.ts
export class ExpressionEvaluator {
  constructor(
    private project: Project,
    private environment: ProjectEnvironment,
    private stepResults: Record<string, any>
  ) {}

  evaluate(expression: string): any {
    // Parse and evaluate expressions
    // Support nested expressions and function calls
    // Handle type conversion and validation
  }

  validateExpression(expression: string): ValidationResult {
    // Validate expression syntax and variable references
  }
}
```

---

## 🚀 Execution Engine

### Execution Flow
1. **Pre-execution Validation**
   - Validate all expressions and variable references
   - Check API availability and authentication
   - Verify test flow dependencies

2. **Environment Setup**
   - Load environment-specific configurations
   - Resolve variable values and API hosts
   - Initialize execution context

3. **Sequence Execution**
   - Execute steps in sequential order
   - Within each step, run test flows in parallel
   - Collect and store step results for subsequent steps

4. **Result Processing**
   - Aggregate execution results
   - Generate execution report
   - Store execution history

### Error Handling
- Retry policies for failed requests
- Graceful degradation for non-critical failures
- Detailed error reporting with context
- Option to continue on errors vs. fail-fast

---

## 📊 Reporting and Analytics

### Execution Reports
- Overall success/failure rates
- Step-by-step execution timeline
- Performance metrics (response times, throughput)
- Error analysis and trending

### Project Analytics
- Execution frequency and patterns
- Most/least used sequences
- Environment-specific success rates
- Variable usage analytics

---

## 🔧 Integration Points

### 1. **Test Flow Integration**
- Seamless integration with existing test flow system
- Automatic parameter mapping from project variables
- Override capabilities for sequence-specific requirements

### 2. **API Management Integration**
- Project-scoped API selection
- Host override capabilities per environment
- Authentication token management

### 3. **Monitoring Integration**
- Real-time execution monitoring
- WebSocket updates for execution progress
- Integration with existing notification systems

---

## 🎯 Success Metrics

### User Experience
- Reduced time to set up test suites for multiple environments
- Improved test coverage through systematic flow organization
- Enhanced collaboration through project sharing

### Technical Performance
- Execution time optimization through parallel processing
- Resource utilization efficiency
- System reliability and error recovery

### Business Value
- Faster deployment cycles through automated testing
- Reduced manual testing effort
- Improved API quality through comprehensive testing

---

## 📅 Implementation Timeline

### Phase 1: Core Infrastructure (4-6 weeks)
- Database schema implementation
- Basic CRUD operations for projects
- Core expression evaluation system
- Simple sequence execution engine

### Phase 2: User Interface (3-4 weeks)
- Project management UI
- Basic sequence editor
- Environment and variable management
- Execution monitoring interface

### Phase 3: Advanced Features (4-5 weeks)
- Visual sequence builder with drag-and-drop
- Advanced expression system with functions
- Comprehensive error handling and retry logic
- Reporting and analytics dashboard

### Phase 4: Polish and Optimization (2-3 weeks)
- Performance optimization
- User experience improvements
- Documentation and testing
- Beta user feedback integration

---

## 🔚 Conclusion

The Project feature will significantly enhance Test-Pilot's capabilities by providing a comprehensive project management system that enables users to organize, configure, and execute complex test scenarios across multiple environments. This feature addresses the core need for systematic API testing workflows while maintaining the simplicity and power that users expect from Test-Pilot.

The proposed implementation follows the existing architectural patterns in the codebase, ensuring consistency and maintainability while introducing powerful new capabilities for enterprise-level API testing workflows.
