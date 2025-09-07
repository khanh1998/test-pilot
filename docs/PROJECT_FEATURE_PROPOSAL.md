# Project Feature Proposal

## Overview

This proposal outlines the implementation of a **Project** feature that groups related sequences together, with shared variables and API dependencies. A **Sequence** represents an ordered collection of test flows with parameters that map to project variables.

### Key Concepts

- **Project**: A container that groups related sequences with shared variables and API dependencies
- **Sequence**: An ordered collection of test flows with parameters (like function parameters)
- **Project Variables**: Shared variables across all sequences in a project
- **Environment Mapping**: Link environment variables to project variables
- **Flow Parameter Mapping**: Map project variables or previous flow outputs to flow parameters
- **Local Execution**: All sequence execution happens client-side, not on server

## Database Schema

I'll add two new tables following the existing JSONB pattern for quick development:

### 1. Projects Table
```sql
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  config JSONB NOT NULL, -- Stores project configuration
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, name) -- Prevent duplicate project names per user
);

CREATE INDEX projects_config_gin_idx ON projects USING GIN (config);
CREATE INDEX projects_user_id_idx ON projects (user_id);
```

### 2. Sequences Table
```sql
CREATE TABLE sequences (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  config JSONB NOT NULL, -- Stores sequence configuration
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(project_id, name) -- Prevent duplicate sequence names per project
);

CREATE INDEX sequences_config_gin_idx ON sequences USING GIN (config);
CREATE INDEX sequences_project_id_idx ON sequences (project_id);
CREATE INDEX sequences_order_idx ON sequences (project_id, order_index);
```

### JSONB Configuration Structures

**Project Config:**
```json
{
  "variables": {
    "api_key": {
      "type": "string",
      "description": "API Key for authentication",
      "required": true,
      "value_source": "environment", // "hardcoded" or "environment"
      "hardcoded_value": null, // Used when value_source is "hardcoded"
      "environment_variable": "env_api_key" // Used when value_source is "environment"
    },
    "base_url": {
      "type": "string", 
      "description": "Base URL for API",
      "required": true,
      "value_source": "hardcoded",
      "hardcoded_value": "https://api.example.com",
      "environment_variable": null
    },
    "user_id": {
      "type": "string",
      "description": "Default user ID for testing",
      "required": false,
      "value_source": "hardcoded",
      "hardcoded_value": "123",
      "environment_variable": null
    }
  },
  "api_dependencies": [1, 2, 3], // Array of API IDs this project depends on
  "environment_id": 1 // Linked environment for variable resolution
}
```

**Sequence Config:**
```json
{
  "parameters": {
    "user_id": {
      "type": "string",
      "description": "User ID for testing",
      "required": true,
      "value_source": "project_variable", // "project_variable" or "hardcoded"
      "project_variable": "user_id", // Used when value_source is "project_variable"
      "hardcoded_value": null // Used when value_source is "hardcoded"
    },
    "api_key": {
      "type": "string", 
      "description": "Authentication key",
      "required": true,
      "value_source": "project_variable",
      "project_variable": "api_key",
      "hardcoded_value": null
    },
    "test_mode": {
      "type": "boolean",
      "description": "Enable test mode",
      "required": false,
      "value_source": "hardcoded",
      "project_variable": null,
      "hardcoded_value": true
    }
  },
  "flows": [
    {
      "test_flow_id": 1,
      "order_index": 0,
      "parameter_mappings": {
        // Flow parameter name: mapping configuration
        "user_id": {
          "source_type": "sequence_parameter", // "sequence_parameter" only for first flow
          "source_reference": "user_id"
        },
        "api_key": {
          "source_type": "sequence_parameter",
          "source_reference": "api_key"
        }
      }
    },
    {
      "test_flow_id": 2,
      "order_index": 1,
      "parameter_mappings": {
        "user_token": {
          "source_type": "previous_flow_output", // "sequence_parameter" or "previous_flow_output"
          "source_reference": "flow_0.output.auth_token"
        },
        "user_id": {
          "source_type": "sequence_parameter",
          "source_reference": "user_id"
        }
      }
    }
  ]
}
```

## File Structure

### Backend Files (API Layer Only)

**Database Schema & Relations:**
- `src/lib/server/db/schema.ts` - Add projects and sequences tables
- `src/lib/server/db/relations.ts` - Add relations for new tables

**Repository Layer:**
- `src/lib/server/repository/db/projects.ts` - Project CRUD operations
- `src/lib/server/repository/db/sequences.ts` - Sequence CRUD operations

**Service Layer:**
- `src/lib/server/service/projects/`
  - `create_project.ts`
  - `get_project.ts`
  - `update_project.ts`
  - `delete_project.ts`
  - `list_projects.ts`
- `src/lib/server/service/sequences/`
  - `create_sequence.ts`
  - `get_sequence.ts`
  - `update_sequence.ts`
  - `delete_sequence.ts`
  - `list_sequences.ts`

**Controller Layer (API Routes):**
- `src/routes/api/projects/+server.ts` - List, create projects
- `src/routes/api/projects/[id]/+server.ts` - Get, update, delete project
- `src/routes/api/projects/[id]/sequences/+server.ts` - List, create sequences in project
- `src/routes/api/sequences/[id]/+server.ts` - Get, update, delete sequence

### Frontend Files (Execution Logic)

**Sequence Execution Logic (Client-side):**
- `src/lib/sequence-runner/` - **New directory for sequence execution**
  - `execution-engine.ts` - Core sequence execution logic
  - `parameter-resolver.ts` - Resolve sequence and flow parameters
  - `flow-executor.ts` - Execute individual flows in sequence
  - `error-handler.ts` - Handle sequence errors and stopping
  - `context-manager.ts` - Manage execution context for debugging
  - `types.ts` - Type definitions for sequence execution
  - `index.ts` - Export main interfaces

**HTTP Client:**
- `src/lib/http_client/projects.ts` - Project API calls
- `src/lib/http_client/sequences.ts` - Sequence API calls

**Components:**
- `src/lib/components/projects/` - **New directory**
  - `ProjectCard.svelte` - Project summary card (< 200 lines)
  - `ProjectForm.svelte` - Create/edit project form (< 300 lines)
  - `ProjectVariables.svelte` - Manage project variables (< 400 lines)
  - `ApiDependencies.svelte` - Select project APIs (< 200 lines)
  - `EnvironmentMapping.svelte` - Link environment to project (< 200 lines)
- `src/lib/components/sequences/` - **New directory**
  - `SequenceCard.svelte` - Sequence summary card (< 200 lines)
  - `SequenceForm.svelte` - Create/edit sequence form (< 300 lines)
  - `SequenceParameters.svelte` - Define sequence parameters (< 400 lines)
  - `SequenceFlowList.svelte` - List and order flows in sequence (< 500 lines)
  - `FlowParameterMapping.svelte` - Map flow parameters (< 400 lines)
  - `SequenceExecutor.svelte` - Execute sequence with results (< 500 lines)
  - `SequenceDebugger.svelte` - Debug execution with details (< 500 lines)

**Pages:**
- `src/routes/dashboard/projects/+page.svelte` - List all projects
- `src/routes/dashboard/projects/[id]/+page.svelte` - Project detail view with sequences
- `src/routes/dashboard/projects/[id]/sequences/[sequenceId]/+page.svelte` - Sequence editor

## Implementation Plan

### Phase 1: Configuration Management Foundation (12-15 days)

This phase focuses on building the complete UI and basic logic for users to create, edit, and manage project and sequence configurations. **No execution functionality** will be implemented in this phase.

#### Week 1: Database & Backend API Foundation (5 days)

**Day 1-2: Database Schema & Repository Layer**
- Add projects and sequences tables to `src/lib/server/db/schema.ts`
- Update relations in `src/lib/server/db/relations.ts`
- Generate and run migration: `npm run drizzle:generate && npm run drizzle:push`
- Implement project CRUD operations in `src/lib/server/repository/db/projects.ts`
- Implement sequence CRUD operations in `src/lib/server/repository/db/sequences.ts`
- Add proper error handling and validation

**Day 3-4: Service Layer**
- Create project services with business logic validation:
  - `src/lib/server/service/projects/create_project.ts`
  - `src/lib/server/service/projects/get_project.ts`
  - `src/lib/server/service/projects/update_project.ts`
  - `src/lib/server/service/projects/delete_project.ts`
  - `src/lib/server/service/projects/list_projects.ts`
- Create sequence services with configuration validation:
  - `src/lib/server/service/sequences/create_sequence.ts`
  - `src/lib/server/service/sequences/get_sequence.ts`
  - `src/lib/server/service/sequences/update_sequence.ts`
  - `src/lib/server/service/sequences/delete_sequence.ts`
  - `src/lib/server/service/sequences/list_sequences.ts`
- Ensure proper user scoping and ownership validation
- Add JSONB configuration validation

**Day 5: API Controllers & HTTP Clients**
- Implement RESTful API endpoints:
  - `src/routes/api/projects/+server.ts` - List, create projects
  - `src/routes/api/projects/[id]/+server.ts` - Get, update, delete project
  - `src/routes/api/projects/[id]/sequences/+server.ts` - List, create sequences
  - `src/routes/api/sequences/[id]/+server.ts` - Get, update, delete sequence
- Create HTTP client functions:
  - `src/lib/http_client/projects.ts` - Project API calls
  - `src/lib/http_client/sequences.ts` - Sequence API calls
- Follow existing authentication patterns with `locals.user`
- Add proper validation and error handling

#### Week 2: Project Management UI (5 days)

**Day 6-7: Project Listing & Basic Operations**
- Create `src/routes/dashboard/projects/+page.svelte` - Projects listing page
- Create `src/lib/components/projects/ProjectCard.svelte` - Project summary card
- Create `src/lib/components/projects/ProjectForm.svelte` - Create/edit project form
- Implement search and pagination for projects
- Add create, edit, delete functionality for projects

**Day 8-9: Project Variables Management**
- Create `src/lib/components/projects/ProjectVariables.svelte` - Variable management interface
- Support adding, editing, deleting project variables
- Variable type validation (string, number, boolean)
- **Value Source Selection UI**:
  - Radio buttons: "Environment Variable" vs "Hardcoded Value"
  - When "Environment Variable": dropdown of linked environment's variables
  - When "Hardcoded Value": text input field
- Required field management and validation
- Form validation and error handling

**Day 10: Environment Linking**
- Create `src/lib/components/projects/EnvironmentMapping.svelte` - Environment linking interface
- Allow linking/unlinking environment to project
- Show available environments in dropdown
- When environment linked: enable environment variable selection in project variables
- Validation for environment variable availability

#### Week 3: Sequence Management UI (5 days)

**Day 11-12: Sequence Listing & Basic Operations**
- Create `src/routes/dashboard/projects/[id]/+page.svelte` - Project detail with sequences
- Create `src/lib/components/sequences/SequenceCard.svelte` - Sequence summary card
- Create `src/lib/components/sequences/SequenceForm.svelte` - Create/edit sequence form
- Implement sequence listing within projects with pagination
- Add create, edit, delete functionality for sequences
- Sequence ordering with drag & drop interface

**Day 13-14: Sequence Parameters Management**
- Create `src/lib/components/sequences/SequenceParameters.svelte` - Parameter definition interface
- **Parameter Value Source Selection UI**:
  - Radio buttons: "Project Variable" vs "Hardcoded Value"
  - When "Project Variable": dropdown of available project variables
  - When "Hardcoded Value": text input field
- Parameter type validation (string, number, boolean)
- Parameter validation (project variable existence)
- Form validation and error handling

**Day 15: Flow Management & Parameter Mapping**
- Create `src/lib/components/sequences/SequenceFlowList.svelte` - Flow list and ordering
- Create `src/lib/components/sequences/FlowParameterMapping.svelte` - Parameter mapping interface
- Add/remove flows from sequence
- Drag & drop flow ordering
- **Flow Parameter Mapping UI**:
  - For each flow parameter: dropdown with two sections
  - "Sequence Parameters" section: all defined sequence parameters
  - "Previous Flow Outputs" section: outputs from previous flows (flow_0.output.field_name, etc.)
  - First flow: only sequence parameters available
  - Subsequent flows: both sequence parameters and previous flow outputs
- **Note**: No actual execution, just configuration UI and validation

#### Phase 1 Deliverables

By the end of Phase 1, users will be able to:

1. **Project Management**:
   - Create, edit, delete projects
   - Define project variables with types and default values
   - Select API dependencies from their uploaded APIs
   - Link environments and map environment variables to project variables
   - View project details and manage configurations

2. **Sequence Management**:
   - Create, edit, delete sequences within projects
   - Define sequence parameters that map to project variables
   - Add test flows to sequences and order them
   - Configure parameter mappings for each flow
   - View sequence details and manage configurations

3. **Data Persistence**:
   - All project and sequence configurations saved to database
   - Proper validation and error handling
   - User-scoped data access and security

4. **UI/UX**:
   - Intuitive interfaces for configuration management
   - Form validation and error messaging
   - Search and pagination for listings
   - Responsive design following existing patterns

#### Phase 1 Exclusions

**Not included in Phase 1**:
- Sequence execution functionality
- Debug interfaces
- Execution engines or logic
- Parameter resolution at runtime
- Flow execution or results viewing
- Error handling during execution

### Phase 2: Execution Engine (Future)

Phase 2 will focus on implementing the execution engine and debug capabilities, building upon the configuration foundation established in Phase 1.

## Key Features Implementation Details

### 1. Project Variables & Value Mapping
- **Project variables can be mapped from**:
  - **Environment variables**: Select from linked environment's variables
  - **Hardcoded values**: Direct value input by user
- Store variable definitions and mappings in project config JSONB
- UI provides radio button selection between "Environment Variable" and "Hardcoded Value"
- When "Environment Variable" selected: dropdown of available environment variables
- When "Hardcoded Value" selected: text input for direct value entry
- Validate variable types and requirements before saving
- Support linking to environment and accessing its variables

### 2. Sequence Parameter System
- **Sequence parameters can be mapped from**:
  - **Project variables**: Select from project's defined variables
  - **Hardcoded values**: Direct value input by user
- Parameters are defined in sequence config with clear source mapping
- UI provides radio button selection between "Project Variable" and "Hardcoded Value"
- When "Project Variable" selected: dropdown of available project variables
- When "Hardcoded Value" selected: text input for direct value entry
- Parameter validation before sequence saving
- Clear error messages for missing or invalid parameter mappings

### 3. Flow Parameter Mapping
- **Flow parameters can ONLY be mapped from**:
  - **Sequence parameters**: Select from sequence's defined parameters
  - **Previous flow outputs**: Select from previous flows' output fields
- UI provides dropdown with two sections:
  - "Sequence Parameters" section: Lists all sequence parameters
  - "Previous Flow Outputs" section: Lists outputs from flows that come before current flow
- **No templates or expressions** - simple dropdown selection only
- Dynamic parameter resolution during execution
- Handle missing parameters gracefully with clear error messages
- For first flow: only sequence parameters available
- For subsequent flows: both sequence parameters and previous flow outputs available

### 4. Client-side Sequence Execution Engine
- **No server-side execution** - all execution happens in the browser
- Sequential execution of flows in order (no parallel execution)
- Parameter resolution before each flow execution using existing template system
- Check for `__error` output after each flow and stop execution if error found
- Maintain execution context in memory for debugging
- Support both normal and debug execution modes
- Leverage existing `flow-runner` execution engine for individual flows

### 5. Debug Mode Features
- Preserve execution state in memory after each flow completes
- Show detailed request/response for each endpoint in each flow
- Display transformation results for each flow
- Show assertion results for each flow
- Allow stepping through execution flow-by-flow
- Provide execution timeline and context inspection

## API Endpoints

### Projects
- `GET /api/projects` - List user's projects (with pagination)
- `POST /api/projects` - Create new project
- `GET /api/projects/{id}` - Get project details
- `PUT /api/projects/{id}` - Update project
- `DELETE /api/projects/{id}` - Delete project
- `GET /api/projects/{id}/sequences` - List sequences in project

### Sequences
- `POST /api/projects/{id}/sequences` - Create sequence in project
- `GET /api/sequences/{id}` - Get sequence details
- `PUT /api/sequences/{id}` - Update sequence
- `DELETE /api/sequences/{id}` - Delete sequence

## Mapping UI Components Details

### Project Variable Value Mapping UI

**Component**: `ProjectVariables.svelte`

```svelte
<!-- For each project variable -->
<div class="variable-config">
  <input bind:value={variable.name} placeholder="Variable name" />
  <select bind:value={variable.type}>
    <option value="string">String</option>
    <option value="number">Number</option>
    <option value="boolean">Boolean</option>
  </select>
  
  <!-- Value Source Selection -->
  <div class="value-source">
    <label>
      <input type="radio" bind:group={variable.value_source} value="hardcoded" />
      Hardcoded Value
    </label>
    <label>
      <input type="radio" bind:group={variable.value_source} value="environment" />
      Environment Variable
    </label>
  </div>
  
  <!-- Conditional inputs based on selection -->
  {#if variable.value_source === 'hardcoded'}
    <input bind:value={variable.hardcoded_value} placeholder="Enter value" />
  {:else if variable.value_source === 'environment'}
    <select bind:value={variable.environment_variable}>
      <option value="">Select environment variable...</option>
      {#each environmentVariables as envVar}
        <option value={envVar.name}>{envVar.name}</option>
      {/each}
    </select>
  {/if}
</div>
```

### Sequence Parameter Value Mapping UI

**Component**: `SequenceParameters.svelte`

```svelte
<!-- For each sequence parameter -->
<div class="parameter-config">
  <input bind:value={parameter.name} placeholder="Parameter name" />
  <select bind:value={parameter.type}>
    <option value="string">String</option>
    <option value="number">Number</option>
    <option value="boolean">Boolean</option>
  </select>
  
  <!-- Value Source Selection -->
  <div class="value-source">
    <label>
      <input type="radio" bind:group={parameter.value_source} value="hardcoded" />
      Hardcoded Value
    </label>
    <label>
      <input type="radio" bind:group={parameter.value_source} value="project_variable" />
      Project Variable
    </label>
  </div>
  
  <!-- Conditional inputs based on selection -->
  {#if parameter.value_source === 'hardcoded'}
    <input bind:value={parameter.hardcoded_value} placeholder="Enter value" />
  {:else if parameter.value_source === 'project_variable'}
    <select bind:value={parameter.project_variable}>
      <option value="">Select project variable...</option>
      {#each projectVariables as projVar}
        <option value={projVar.name}>{projVar.name} ({projVar.type})</option>
      {/each}
    </select>
  {/if}
</div>
```

### Flow Parameter Mapping UI

**Component**: `FlowParameterMapping.svelte`

```svelte
<!-- For each flow parameter -->
<div class="flow-parameter-mapping">
  <span class="parameter-name">{flowParameter.name}</span>
  <span class="parameter-type">({flowParameter.type})</span>
  
  <select bind:value={mapping.source_reference}>
    <option value="">Select source...</option>
    
    <!-- Sequence Parameters Section -->
    <optgroup label="Sequence Parameters">
      {#each sequenceParameters as seqParam}
        <option value="sequence_parameter:{seqParam.name}">
          {seqParam.name} ({seqParam.type})
        </option>
      {/each}
    </optgroup>
    
    <!-- Previous Flow Outputs Section (only for flows after the first) -->
    {#if flowIndex > 0}
      <optgroup label="Previous Flow Outputs">
        {#each previousFlowOutputs as output}
          <option value="previous_flow_output:{output.reference}">
            {output.displayName} ({output.type})
          </option>
        {/each}
      </optgroup>
    {/if}
  </select>
</div>
```

**Example dropdown options**:
- Sequence Parameters section:
  - `user_id (string)`
  - `api_key (string)`
  - `test_mode (boolean)`
- Previous Flow Outputs section:
  - `Flow 0 → auth_token (string)`
  - `Flow 0 → user_profile (object)`
  - `Flow 1 → session_id (string)`

### Mapping Rules Summary

1. **Project Variables** → Environment Variable OR Hardcoded Value
2. **Sequence Parameters** → Project Variable OR Hardcoded Value  
3. **Flow Parameters** → Sequence Parameter OR Previous Flow Output

**No template expressions needed** - all mapping done through UI dropdowns and radio buttons.

## User Experience Flow

### Creating a Project
1. User navigates to projects page
2. Clicks "New Project" button
3. Fills in name, description
4. Selects API dependencies from their uploaded APIs
5. Create project

### Editing a project details
1. Defines default url host to apis
2. Defines project variables:
   - CRUD project variable
   - user can input hardcode default value here, or set it as null. 
3. Links to an environment (optional)
   - user can map environment variables to project variable here. create an ui facilitate this mapping. show environment variable values to user.
   - api hosts from env will override the default value of api host of project
4. Saves project

### Project showing a list of sequences, supporting paging.

### Creating a Sequence
1. User navigates to project detail page
2. Clicks "New Sequence" in sequences section
3. Fills in sequence name
4. Create a sequence

### Editing a sequence
1. Defines sequence parameters:
   - For each parameter: choose "Project Variable" or "Hardcoded Value"
   - If "Project Variable": select from project's defined variables. Show value of project variable there also.
   - If "Hardcoded Value": enter value directly
2. Adds test flows to sequence in order
   - can add new flow to anywhere in the sequence, in between, or at the tail.
   - supporting user to search flow by name to add to the sequence. fuzzy search.
   - can change position of the flow in sequence, move up, move down.
   - each flow should have an unique id and never change (for data reference purpose). for example: `flow1`, `flow2`,...
   - when user add a new flow in between `flow1` and `flow2`, creating `flow1_5`. `1.5` is between `1` and `2`.
   - unlike test flow. a sequence is relative short, around 5 flows in there. please optimize the ui around this fact.
3. For each flow, maps parameters using dropdowns:
   - "Sequence Parameters" section: shows all sequence parameters
   - "Previous Flow Outputs" section: shows outputs from previous flows. user pick the flow first (flow id) then pick fields from flow output.
   - First flow: only sequence parameters available
   - Later flows: both sequence parameters and previous flow outputs available
4. Saves sequence

### Executing a Sequence
1. User opens sequence detail page
2. Clicks "Execute Sequence" button
3. System resolves all parameters using project variables and environment
4. Executes flows sequentially
5. Shows real-time progress and results
6. Stops on first error encountered
7. Shows final results with success/error status

### Debug Mode Execution
1. User clicks "Debug Execute" button
2. System executes one flow at a time
3. User can inspect results after each flow
4. User can see parameter resolution and intermediate values
5. User can continue to next flow or stop execution
6. Full execution context preserved for inspection

## Technical Considerations

### Performance
- Use JSONB GIN indexes for efficient config queries
- Implement pagination for project and sequence listings
- Lazy load sequence details and flow configurations
- Client-side execution reduces server load

### Security
- All operations scoped to authenticated user
- Validate project ownership before sequence operations
- Sanitize JSONB configurations on server
- Validate API dependencies belong to user
- No sensitive data in client-side execution context

### Error Handling
- Comprehensive validation at service layer
- Proper HTTP status codes in controllers
- User-friendly error messages in UI
- Graceful degradation for missing dependencies
- Clear error reporting during sequence execution

### Client-side Execution Benefits
- Reduced server load and complexity
- Real-time execution feedback
- Better debugging capabilities
- Leverage existing flow execution engine
- No need for server-side execution state management

### Testing Strategy
- Unit tests for parameter resolution logic
- Unit tests for sequence execution engine
- Integration tests for API endpoints
- Component tests for complex UI interactions
- Mock external dependencies for testing
- Test error scenarios and edge cases

## Migration Strategy

### Database Migration
```sql
-- Migration file: XXXX_add_projects_and_sequences.sql

-- Add projects table
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, name)
);

-- Add sequences table  
CREATE TABLE sequences (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  config JSONB NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(project_id, name)
);

-- Add indexes
CREATE INDEX projects_config_gin_idx ON projects USING GIN (config);
CREATE INDEX projects_user_id_idx ON projects (user_id);
CREATE INDEX sequences_config_gin_idx ON sequences USING GIN (config);
CREATE INDEX sequences_project_id_idx ON sequences (project_id);
CREATE INDEX sequences_order_idx ON sequences (project_id, order_index);
```

### Schema Updates
- Add to `src/lib/server/db/schema.ts`
- Add relations in `src/lib/server/db/relations.ts`
- Update type definitions

## Future Enhancements (Out of Scope)

1. **Project-level Execution**: Execute all sequences in a project
2. **Sequence Scheduling**: Schedule sequences to run automatically
3. **Sequence Templates**: Create reusable sequence templates
4. **Sequence Sharing**: Share sequences between projects
5. **Advanced Parameter Types**: Support for arrays, objects, file uploads
6. **Conditional Flow Execution**: Execute flows based on conditions
7. **Parallel Flow Execution**: Execute multiple flows simultaneously
8. **Sequence Analytics**: Track execution metrics and success rates

## Conclusion

This proposal provides a comprehensive plan for implementing the project feature while maintaining consistency with the existing codebase architecture. The focus on client-side execution simplifies the implementation while providing powerful debugging capabilities. The JSONB-based configuration approach allows for rapid development and easy extensibility.

The phased implementation approach ensures we can deliver value incrementally while building a solid foundation for future enhancements.
