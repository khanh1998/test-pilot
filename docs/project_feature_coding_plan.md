# Project Feature - Coding Plan

## Overview

This plan outlines the implementation of a new **Project** feature that addresses flow reusability and management challenges. Projects will group related test flows into reusable chains, reducing duplication and enabling complex flow orchestration.

## Problem Statement

Currently, test flows become large and complicated with many shared steps duplicated across flows. Users need to create small, focused flows that can be composed into larger test scenarios while maintaining reusability and organization.

## Solution Architecture

### Core Concepts

1. **Project**: A container that groups related flows, defines shared variables, API configurations, and environment mappings
2. **Module**: A categorization of related sequences (e.g., "Account Management", "Order Processing")
3. **Sequence**: A sequence of test flows where output from one flow becomes input for the next
4. **Flow Composition**: Individual test flows remain small and focused, but can be sequenced together

### Example Use Cases

- **Small Flows**: create_order, accept_order, cancel_order, modify_order, pickup_order
- **Flow Sequences**: 
  - create_order → accept_order → pickup_order
  - create_order → cancel_order
  - create_order → modify_order → pickup_order
- **Modules**: "Order Management", "Account Setup", "Payment Processing"

## Database Schema Changes

### New Tables

```sql
-- Projects table
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_json JSONB NOT NULL, -- Contains project configuration
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Project-API relationships
CREATE TABLE project_apis (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  api_id INTEGER NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
  default_host TEXT, -- Default host for this API in this project
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(project_id, api_id)
);

-- Project modules (renamed from flow_chain_groups)
CREATE TABLE project_modules (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Flow sequences (renamed from flow_chains)
CREATE TABLE flow_sequences (
  id SERIAL PRIMARY KEY,
  module_id INTEGER NOT NULL REFERENCES project_modules(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sequence_config JSONB NOT NULL, -- Contains complete flow sequence, steps, and parameter mappings
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Project environment links
CREATE TABLE project_environments (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment_id INTEGER NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  variable_mappings JSONB NOT NULL, -- Maps project variables to environment variables
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(project_id, environment_id)
);
```

### Project JSON Structure

```typescript
interface ProjectConfig {
  variables: ProjectVariable[];
  api_hosts: Record<string, ApiHostConfig>;
  environment_mappings: EnvironmentMapping[];
}

interface ProjectVariable {
  name: string;
  description?: string;
  default_value?: any;
  type: 'string' | 'number' | 'boolean' | 'object';
}

interface ApiHostConfig {
  api_id: number;
  name: string;
  default_host: string;
}

interface EnvironmentMapping {
  environment_id: number;
  variable_mappings: Record<string, string>; // project_var -> env_var
}

interface FlowSequenceConfig {
  steps: FlowSequenceStep[];
  global_settings?: {
    timeout?: number;
    continue_on_error?: boolean;
    parallel_execution?: boolean;
  };
}

interface FlowSequenceStep {
  id: string; // Unique step identifier
  test_flow_id: number;
  step_order: number;
  parameter_mappings: FlowParameterMapping[];
  conditions?: ExecutionCondition[]; // Optional: conditional execution
  retry_config?: RetryConfig; // Optional: retry settings
}

interface FlowParameterMapping {
  flow_parameter_name: string;
  source_type: 'project_variable' | 'previous_output' | 'static_value' | 'environment';
  source_value: string; // e.g., "project:username", "step1.response.id", "static:test_value"
}

interface ExecutionCondition {
  type: 'success' | 'failure' | 'always' | 'custom';
  expression?: string; // For custom conditions
}

interface RetryConfig {
  max_attempts: number;
  delay_ms: number;
  backoff_multiplier?: number;
}
```

## Implementation Plan

### Phase 1: Database and Core Models

#### 1.1 Database Schema Implementation

**Files to create/modify:**
- `src/lib/server/db/schema.ts` - Add new tables
- `src/lib/server/db/relations.ts` - Add table relationships
- Run `npm run drizzle:generate` and `npm run drizzle:push`

#### 1.2 Repository Layer

**Files to create:**
```
src/lib/server/repository/db/
├── project.ts
├── project_module.ts
├── flow_sequence.ts
└── project_environment.ts
```

Each repository file should include:
- CRUD operations
- User-scoped queries
- Join operations for related data
- Pagination support

#### 1.3 Type Definitions

**Files to create:**
```
src/lib/types/
├── project.ts
├── project_module.ts
├── flow_sequence.ts
└── project_environment.ts
```

### Phase 2: Backend Services

#### 2.1 Service Layer

**Files to create:**
```
src/lib/server/service/projects/
├── list_projects.ts
├── create_project.ts
├── get_project.ts
├── update_project.ts
├── delete_project.ts
├── link_api.ts
└── unlink_api.ts

src/lib/server/service/flow_sequences/
├── list_modules.ts
├── create_module.ts
├── update_module.ts
├── delete_module.ts
├── list_sequences.ts
├── create_sequence.ts
├── update_sequence.ts
├── delete_sequence.ts
├── add_flow_to_sequence.ts
├── remove_flow_from_sequence.ts
└── reorder_sequence_flows.ts
```

#### 2.2 API Routes

**Files to create:**
```
src/routes/api/projects/
├── +server.ts                    # GET (list), POST (create)
├── [id]/+server.ts              # GET, PUT, DELETE
├── [id]/apis/+server.ts         # GET linked APIs, POST link API
├── [id]/apis/[api_id]/+server.ts # DELETE unlink API
├── [id]/modules/+server.ts      # GET, POST project modules
├── [id]/environments/+server.ts # GET, POST environment links
└── [id]/environments/[env_id]/+server.ts # DELETE environment link

src/routes/api/flow-sequences/
├── [id]/+server.ts              # GET, PUT, DELETE sequence
├── [id]/flows/+server.ts        # GET flows in sequence, POST add flow
└── [id]/flows/[flow_id]/+server.ts # DELETE remove flow, PUT reorder

src/routes/api/project-modules/
├── [id]/+server.ts              # GET, PUT, DELETE module
└── [id]/sequences/+server.ts    # GET sequences in module, POST create sequence
```

### Phase 3: Frontend Components (Reusable)

#### 3.1 Project Configuration Components

**Files to create:**
```
src/lib/components/projects/
├── ProjectList.svelte
├── ProjectCard.svelte
├── ProjectEditor.svelte
├── ProjectConfigTabs.svelte
├── ProjectVariableEditor.svelte
├── ProjectApiManager.svelte
├── ProjectEnvironmentLinker.svelte
└── types.ts
```

**Key Features:**
- **ProjectConfigTabs.svelte**: Reuse tab structure from test flow settings
- **ProjectVariableEditor.svelte**: Similar to flow parameters but for project scope
- **ProjectApiManager.svelte**: Reuse API host management logic from test flows
- **ProjectEnvironmentLinker.svelte**: Extend EnvironmentLinkingManager for project scope

#### 3.2 Flow Chain Components

**Files to create:**
```
src/lib/components/flow-sequences/
├── ModuleList.svelte
├── ModuleCard.svelte
├── ModuleEditor.svelte
├── FlowSequenceList.svelte
├── FlowSequenceRow.svelte
├── FlowSequenceEditor.svelte
├── SequenceFlowSelector.svelte
├── FlowParameterMapper.svelte
└── types.ts
```

**Key Features:**
- **FlowSequenceRow.svelte**: Horizontal layout showing flow sequence
- **FlowParameterMapper.svelte**: Map flow parameters to project variables or previous outputs
- **SequenceFlowSelector.svelte**: Modal to select and add flows to sequences

#### 3.3 Shared/Reusable Components

**Files to modify/create:**
```
src/lib/components/shared/
├── ConfigTabs.svelte           # Extract from test flow page
├── VariableEditor.svelte       # Extract from test flow settings
├── ApiHostManager.svelte       # Extract from test flow settings
└── EnvironmentMapper.svelte    # Extend existing environment components
```

### Phase 4: Frontend Pages

#### 4.1 Project Management Pages

**Files to create:**
```
src/routes/dashboard/projects/
├── +page.svelte                 # Project list page
├── [id]/+page.svelte           # Project detail with tabs
├── [id]/+layout.svelte         # Project breadcrumb layout
└── [id]/modules/[module_id]/+page.svelte # Module detail
```

#### 4.2 HTTP Client Layer

**Files to create:**
```
src/lib/http_client/
├── projects.ts
├── flow_sequences.ts
└── project_environments.ts
```

### Phase 5: Integration and Execution

#### 5.1 Flow Sequence Execution Engine

**Files to create:**
```
src/lib/flow-sequence-runner/
├── FlowSequenceRunner.svelte
├── sequence_executor.ts
├── parameter_resolver.ts
└── types.ts
```

**Key Features:**
- Execute flows in sequence
- Pass output from one flow to next
- Handle parameter mapping
- Error handling and rollback
- Progress tracking

#### 5.2 Template System Extension

**Files to modify:**
- `src/lib/template/` - Add support for project variables and sequence outputs
- Support syntax like `{{project:variable_name}}` and `{{sequence:previous_flow.output_name}}`

## Implementation Strategy

### Reuse Existing Code

1. **Config Tabs Pattern**: Extract tab structure from test flow settings page
2. **Environment Linking**: Extend `EnvironmentLinkingManager.svelte` for project scope
3. **Variable Management**: Adapt parameter editor for project variables
4. **API Host Management**: Reuse API host configuration logic

### Component Architecture

```
ProjectDetailPage
├── ProjectConfigTabs
│   ├── ProjectInfoTab (reuse test flow info pattern)
│   ├── ProjectVariablesTab (adapt parameter editor)
│   ├── ProjectApisTab (reuse API host manager)
│   └── ProjectEnvironmentsTab (extend environment linker)
└── ModuleList
    └── ModuleCard
        └── FlowSequenceList
            └── FlowSequenceRow
                ├── FlowSequence
                └── FlowParameterMapper
```

### Development Phases

1. **Phase 1** (Week 1): Database schema and repository layer
2. **Phase 2** (Week 2): Backend services and API routes
3. **Phase 3** (Week 3): Core frontend components
4. **Phase 4** (Week 4): Project pages and integration
5. **Phase 5** (Week 5): Flow chain execution and testing

## Detailed Component Specs

### ProjectConfigTabs.svelte
```svelte
<!-- Reuse tab structure from test-flows/[id]/+page.svelte -->
<script lang="ts">
  export let project: Project;
  export let currentTab: 'info' | 'variables' | 'apis' | 'environments' = 'info';
  
  // Reuse save logic pattern from test flow page
  let isDirty = $state(false);
  let isSaving = $state(false);
</script>

<!-- Tab navigation (reuse from test flow) -->
<!-- Tab content based on currentTab -->
```

### ProjectVariableEditor.svelte
```svelte
<!-- Adapt from TestFlowEditor parameter management -->
<script lang="ts">
  export let variables: ProjectVariable[];
  
  // Reuse add/edit/delete logic from flow parameters
  // Add type selection (string, number, boolean, object)
  // Add default value management
</script>
```

### ProjectApiManager.svelte
```svelte
<!-- Reuse from test-flows/[id]/+page.svelte API hosts section -->
<script lang="ts">
  export let projectApis: ProjectApi[];
  export let availableApis: Api[];
  
  // Reuse API selection modal
  // Add default host configuration per API
  // Show linked APIs in table format
</script>
```

### FlowSequenceRow.svelte
```svelte
<!-- New component for horizontal flow display -->
<script lang="ts">
  export let sequence: FlowSequence;
  export let flows: TestFlow[];
  
  // Display flows horizontally with arrows
  // Show parameter mappings on hover
  // Support drag-and-drop reordering
  // Add/remove flow buttons
</script>

<div class="flex items-center space-x-4 p-4 border rounded-lg">
  {#each sequence.flows as flow, index}
    <FlowCard {flow} />
    {#if index < sequence.flows.length - 1}
      <Arrow />
    {/if}
  {/each}
  <AddFlowButton />
</div>
```

## Success Metrics

1. Reduction in flow duplication
2. Improved flow organization and discoverability
3. Faster test scenario creation through flow composition
4. Better team collaboration through shared project configurations

---

## ✅ **IMPLEMENTATION PROGRESS**

### **Phase 1: Database Schema & Types** - ✅ **COMPLETED**
- ✅ Database schema with 5 new tables created and migrated
- ✅ TypeScript interfaces for all project entities
- ✅ Database relations properly defined

### **Phase 2: Backend Services & API Routes** - ✅ **COMPLETED**
- ✅ Repository layer with 4 repository classes
- ✅ Service layer with business logic and validation
- ✅ Complete API routes:
  - Projects CRUD: `/api/projects/`, `/api/projects/[id]/`
  - Modules CRUD: `/api/projects/[id]/modules/`, `/api/projects/[id]/modules/[moduleId]/`
  - Sequences CRUD: `/api/projects/[id]/modules/[moduleId]/sequences/`, `/api/projects/[id]/modules/[moduleId]/sequences/[sequenceId]/`
  - Flow Management: `/api/projects/[id]/modules/[moduleId]/sequences/[sequenceId]/flows/`
  - Environment Linking: `/api/projects/[id]/environments/`

### **Phase 3: Frontend Components** - ✅ **COMPLETED**
- ✅ **Core Components Created:**
  - `ProjectCard.svelte` - Project display with stats
  - `ProjectForm.svelte` - Create/edit projects with API selection
  - `ModuleCard.svelte` - Module display with drag handle
  - `ModuleForm.svelte` - Create/edit modules
  - `SequenceCard.svelte` - Sequence display with execution status
  - `SequenceForm.svelte` - Create/edit sequences with flow selection
  - `ProjectTabs.svelte` - Tab navigation for project configuration
- ✅ **Utilities:** Date formatting helpers
- ✅ **HTTP Client:** Complete API client functions for frontend

### **Phase 4: Frontend Pages** - ✅ **COMPLETED**
- ✅ **Project List Page:** Complete CRUD operations with modal forms
- ✅ **Project Detail Page:** Tab-based interface with module management
- ✅ **Module Detail Page:** Shows sequences with detailed flows, create/edit/delete sequences
- ✅ **Navigation Integration:** Added to dashboard with breadcrumb support for projects/modules
- ✅ **Error Handling:** Loading states and user-friendly error messages

### **Phase 5: Execution Engine** - 🔄 **READY FOR IMPLEMENTATION**  
- **Next Steps:** Implement sequence execution logic using existing flow runner

**Total Files Created:** 20+ files across database schema, services, API routes, components, and utilities
**Architecture:** Clean separation of concerns with proper TypeScript typing throughout
