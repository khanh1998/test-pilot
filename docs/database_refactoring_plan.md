# Database Refactoring Plan: Making Projects Central

## Overview

This document outlines the plan to refactor the database design from a `test_flows`-centric architecture to a `projects`-centric one. The goal is to make `projects` the central entity around which all other resources (APIs, test flows, environments) are organized.

## Current State Analysis

### Current Structure (test_flows-centric)
- Users → APIs (direct relationship)
- Users → TestFlows (direct relationship)  
- Users → Environments (direct relationship)
- TestFlows ↔ APIs (many-to-many via testFlowApis)
- TestFlows → Environments (direct reference)

### Target Structure (project-centric)
- Users → Projects (direct relationship)
- Projects → APIs (via projectApis - already exists)
- Projects → TestFlows (new relationship needed)
- Projects → Environments (via projectEnvironments - already exists)
- Projects → Modules → FlowSequences (already exists)

## Migration Strategy: Additive Approach

The migration will follow a non-breaking, additive approach that allows existing functionality to continue working while gradually transitioning to the new project-centric model.

### Phase 1: Add Project References (Non-Breaking)

#### 1. Modify `test_flows` table
- Add optional `projectId` column (nullable initially)
- Keep existing `userId` and `environmentId` for backward compatibility
- Add foreign key constraint to projects table

#### 2. Modify `apis` table
- Add optional `projectId` column (nullable initially) 
- Keep existing `userId` for backward compatibility
- Add foreign key constraint to projects table

#### 3. Create default projects
- Auto-create a "Default Project" for each existing user
- Migrate orphaned resources to these default projects

### Phase 2: Update Application Logic

#### 4. Update API endpoints
- Modify create/update operations to require `projectId`
- Update list operations to filter by project
- Maintain backward compatibility for existing endpoints

#### 5. Update UI
- Add project selection to all resource creation flows
- Show project context in navigation/breadcrumbs
- Implement project switcher component

### Phase 3: Data Migration & Cleanup

#### 6. Migrate existing data
- Assign existing test_flows to default projects
- Assign existing APIs to default projects  
- Update environment associations through project relationships

#### 7. Enforce constraints
- Make `projectId` NOT NULL after migration
- Consider deprecating direct user relationships
- Update indexes and constraints

## Detailed Schema Changes

### 1. `test_flows` Table Changes

```sql
-- Add project reference (nullable initially)
ALTER TABLE test_flows ADD COLUMN project_id INTEGER REFERENCES projects(id);

-- Add index for performance
CREATE INDEX test_flows_project_id_idx ON test_flows(project_id);

-- After migration, make it required
ALTER TABLE test_flows ALTER COLUMN project_id SET NOT NULL;

-- Eventually deprecate userId (keep for transition)
-- ALTER TABLE test_flows DROP COLUMN user_id; -- Future phase
-- ALTER TABLE test_flows DROP COLUMN environment_id; -- Future phase
```

### 2. `apis` Table Changes

```sql
-- Add project reference (nullable initially)
ALTER TABLE apis ADD COLUMN project_id INTEGER REFERENCES projects(id);

-- Add index for performance
CREATE INDEX apis_project_id_idx ON apis(project_id);

-- After migration, make it required  
ALTER TABLE apis ALTER COLUMN project_id SET NOT NULL;

-- Eventually deprecate userId (keep for transition)
-- ALTER TABLE apis DROP COLUMN user_id; -- Future phase
```

### 3. Environment Relationship Changes

Instead of direct testFlow → environment relationships, environments will be associated with projects, and test flows will inherit environment access through their project.

```sql
-- Remove direct environment reference from test flows (future phase)
-- ALTER TABLE test_flows DROP COLUMN environment_id;
```

### 4. New Relationship Tables (if needed)

```sql
-- May need project-test_flows junction table for many-to-many
-- if test flows can belong to multiple projects
CREATE TABLE project_test_flows (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  test_flow_id INTEGER NOT NULL REFERENCES test_flows(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(project_id, test_flow_id)
);

CREATE INDEX project_test_flows_project_id_idx ON project_test_flows(project_id);
CREATE INDEX project_test_flows_test_flow_id_idx ON project_test_flows(test_flow_id);
```

## Migration Scripts

### Step 1: Schema Updates

```sql
-- 1. Add project references to existing tables
ALTER TABLE test_flows ADD COLUMN project_id INTEGER REFERENCES projects(id);
ALTER TABLE apis ADD COLUMN project_id INTEGER REFERENCES projects(id);

-- 2. Create indexes
CREATE INDEX test_flows_project_id_idx ON test_flows(project_id);
CREATE INDEX apis_project_id_idx ON apis(project_id);
```

### Step 2: Data Migration

```sql
-- 1. Create default projects for existing users
INSERT INTO projects (name, description, user_id, project_json, created_at, updated_at)
SELECT 
  'Default Project' as name,
  'Auto-created default project for migration' as description,
  id as user_id,
  '{}' as project_json,
  NOW() as created_at,
  NOW() as updated_at
FROM users
WHERE id NOT IN (SELECT DISTINCT user_id FROM projects WHERE user_id IS NOT NULL);

-- 2. Assign existing APIs to default projects
UPDATE apis 
SET project_id = p.id
FROM projects p
WHERE apis.user_id = p.user_id 
  AND p.name = 'Default Project'
  AND apis.project_id IS NULL;

-- 3. Assign existing test flows to default projects
UPDATE test_flows 
SET project_id = p.id
FROM projects p
WHERE test_flows.user_id = p.user_id 
  AND p.name = 'Default Project'
  AND test_flows.project_id IS NULL;

-- 4. Create project-API relationships for migrated data
INSERT INTO project_apis (project_id, api_id, created_at)
SELECT DISTINCT a.project_id, a.id, NOW()
FROM apis a
WHERE a.project_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM project_apis pa 
    WHERE pa.project_id = a.project_id AND pa.api_id = a.id
  );
```

### Step 3: Constraint Enforcement

```sql
-- Make project references required (run after ensuring all data is migrated)
ALTER TABLE test_flows ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE apis ALTER COLUMN project_id SET NOT NULL;
```

## Application Layer Changes

### 1. Service Layer Updates

```typescript
// Enhanced service methods to support flexible filtering
// Support both user-based and project-based queries during transition

// Enhanced service interface
interface ResourceFilters {
  userId?: number;     // For backward compatibility
  projectId?: number;  // For new project-centric queries
  // Additional filters as needed
}

// Updated service methods
async getTestFlows(filters: ResourceFilters): Promise<TestFlow[]>
async getApis(filters: ResourceFilters): Promise<Api[]> 
async getEnvironments(filters: ResourceFilters): Promise<Environment[]>

// Helper methods for common use cases
async getTestFlowsByUser(userId: number): Promise<TestFlow[]>    // Backward compatibility
async getTestFlowsByProject(projectId: number): Promise<TestFlow[]>  // New project-centric
async getUserDefaultProject(userId: number): Promise<Project>    // Get user's default project
```

### 2. API Route Updates

```typescript
// Enhanced existing endpoints with project support
// Use query parameters for GET requests
GET /api/test-flows?projectId={projectId}  // Optional filter by project
GET /api/apis?projectId={projectId}        // Optional filter by project
GET /api/environments?projectId={projectId} // Optional filter by project

// Use request body for POST/PUT requests
POST /api/test-flows 
// Body: { name, description, projectId, ... }

PUT /api/test-flows/{id}
// Body: { name, description, projectId, ... }

POST /api/apis
// Body: { name, description, projectId, specContent, ... }

PUT /api/apis/{id}
// Body: { name, description, projectId, ... }

// Keep all existing endpoints working for backward compatibility
// Gradually migrate client code to include projectId parameters
```

### 3. UI Component Updates

```svelte
<!-- Add project context to all resource pages -->
<ProjectSelector bind:selectedProject />

<!-- Update resource lists to be project-scoped -->
<TestFlowList {projectId} />
<ApiList {projectId} />
<EnvironmentList {projectId} />
```

## Backward Compatibility Strategy

### 1. Dual Relationships (Transition Period)
- Keep both `userId` and `projectId` on `apis` and `test_flows`
- Support queries by either field during transition
- Gradually migrate client code to use project-based queries

### 2. Default Project Pattern
- Auto-create default projects for existing users
- Assign orphaned resources to default projects
- Allow users to reorganize resources into proper projects later

### 3. Gradual API Enhancement Strategy

**Core Principle**: Enhance existing endpoints rather than creating new ones

#### GET Endpoints Enhancement
```typescript
// Existing: GET /api/test-flows
// Enhanced: GET /api/test-flows?projectId=123
// Behavior: 
//   - No projectId param: return user's resources (backward compatible)
//   - With projectId param: return project's resources (new functionality)
```

#### POST/PUT Endpoints Enhancement  
```typescript
// Existing: POST /api/test-flows { name, description, flowJson }
// Enhanced: POST /api/test-flows { name, description, flowJson, projectId }
// Behavior:
//   - No projectId in body: assign to user's default project
//   - With projectId in body: assign to specified project
```

#### Implementation Benefits
- ✅ No breaking changes to existing client code
- ✅ No new routes to document or maintain  
- ✅ Simple progressive enhancement
- ✅ Easy to test and rollback
- ✅ Clear upgrade path for frontend applications

## Benefits of This Approach

### 1. Non-breaking Migration
- Existing functionality continues to work during transition
- No immediate impact on current users
- Gradual adoption possible

### 2. Improved Organization
- Logical grouping of related APIs, flows, and environments
- Clear project boundaries and ownership
- Better resource management

### 3. Enhanced Scalability
- Foundation for team features and collaboration
- Easier permission management
- Support for project-based access control

### 4. Better User Experience
- Clearer context and navigation
- Project-based workflows
- Reduced cognitive load

## Timeline and Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Schema changes (add nullable project references)
- [ ] Data migration scripts
- [ ] Default project creation

### Phase 2: Application Updates (Week 3-4)
- [ ] Service layer updates
- [ ] New API endpoints
- [ ] UI component updates

### Phase 3: Migration (Week 5-6)
- [ ] Run data migration
- [ ] Update client applications
- [ ] User communication and training

### Phase 4: Enforcement (Week 7-8)
- [ ] Make project references required
- [ ] Deprecate old patterns
- [ ] Performance optimization

### Phase 5: Cleanup (Week 9-10)
- [ ] Remove deprecated columns (optional)
- [ ] Update documentation
- [ ] Final testing and validation

## Risks and Mitigation

### 1. Data Integrity Issues
- **Risk**: Data loss during migration
- **Mitigation**: Comprehensive backup and rollback procedures

### 2. Application Downtime
- **Risk**: Service interruption during migration
- **Mitigation**: Additive approach with backward compatibility

### 3. User Confusion
- **Risk**: Users lost in new project-centric model
- **Mitigation**: Default projects and gradual UI transition

### 4. Performance Impact
- **Risk**: Additional joins and queries
- **Mitigation**: Proper indexing and query optimization

## Success Criteria

- [ ] All existing functionality works during and after migration
- [ ] New project-centric features are available
- [ ] Performance is maintained or improved
- [ ] User satisfaction remains high
- [ ] Data integrity is preserved
- [ ] Clean separation of project resources

## Rollback Plan

In case of issues:

1. **Immediate**: Disable new project-aware features
2. **Short-term**: Revert to user-based queries
3. **Long-term**: Roll back schema changes if necessary

The additive approach ensures that rollback is always possible by simply reverting to the original user-based relationships.