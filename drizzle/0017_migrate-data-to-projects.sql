-- Custom SQL migration file, put your code below! --

-- Step 1: Create default projects for existing users who don't have any projects yet
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

-- Step 2: Assign existing APIs to default projects
UPDATE apis 
SET project_id = p.id
FROM projects p
WHERE apis.user_id = p.user_id 
  AND p.name = 'Default Project'
  AND apis.project_id IS NULL;

-- Step 3: Assign existing test flows to default projects
UPDATE test_flows 
SET project_id = p.id
FROM projects p
WHERE test_flows.user_id = p.user_id 
  AND p.name = 'Default Project'
  AND test_flows.project_id IS NULL;

-- Step 4: Create project-API relationships for migrated data
-- This ensures APIs are properly linked in the project_apis junction table
INSERT INTO project_apis (project_id, api_id, created_at)
SELECT DISTINCT a.project_id, a.id, NOW()
FROM apis a
WHERE a.project_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM project_apis pa 
    WHERE pa.project_id = a.project_id AND pa.api_id = a.id
  );

-- Step 5: Create project-test flow relationships in the junction table
-- This populates the new project_test_flows table for existing relationships
INSERT INTO project_test_flows (project_id, test_flow_id, created_at)
SELECT DISTINCT tf.project_id, tf.id, NOW()
FROM test_flows tf
WHERE tf.project_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM project_test_flows ptf 
    WHERE ptf.project_id = tf.project_id AND ptf.test_flow_id = tf.id
  );

-- Step 6: Assign existing environments to default projects
-- Create project-environment relationships for all existing environments
INSERT INTO project_environments (project_id, environment_id, variable_mappings, created_at)
SELECT DISTINCT p.id, e.id, '{}'::jsonb as variable_mappings, NOW()
FROM environments e
JOIN projects p ON e.user_id = p.user_id
WHERE p.name = 'Default Project'
  AND NOT EXISTS (
    SELECT 1 FROM project_environments pe 
    WHERE pe.project_id = p.id AND pe.environment_id = e.id
  );
