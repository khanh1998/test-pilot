# Project Refactoring Plan: Aligning with SvelteKit Best Practices

This plan outlines the steps to refactor the project structure to better align with SvelteKit's recommended conventions, focusing on extensibility, cleanliness, and readability.

Reference: https://svelte.dev/docs/kit/project-structure

## Goals:

- Consolidate database schema definitions to a single source of truth.
- Improve component organization by flattening redundant nesting.
- Centralize global type definitions for better maintainability.
- Adhere to SvelteKit's `src/lib/server` convention for server-only logic.

## Plan:

### 1. Consolidate Database Schemas

**Current State:**

- `drizzle/schema.ts` (redundant, used by Drizzle Kit for migrations)
- `src/db/schema.ts` (authoritative, configured in `drizzle.config.ts`)

**Action:**

1.  **Delete Redundant Schema:** Remove `drizzle/schema.ts`.
    ```bash
    rm drizzle/schema.ts
    ```
2.  **Move Authoritative Schema:** Move `src/db/schema.ts` to `src/lib/server/db/schema.ts`.
    ```bash
    mv src/db/schema.ts src/lib/server/db/schema.ts
    ```
3.  **Update Drizzle Config:** Modify `drizzle.config.ts` to point to the new schema path.
    ```typescript
    // drizzle.config.ts
    export default defineConfig({
      // ...
      schema: './src/lib/server/db/schema.ts' // Updated path
      // ...
    });
    ```
4.  **Update Imports:** Identify and update all files that import from the old `src/db/schema.ts` path to the new `src/lib/server/db/schema.ts` path. This will likely include `src/db/index.ts` and `src/db/relations.ts`.

### 2. Flatten `test-flows` Components

**Current State:**

- Redundant nesting: `src/lib/features/test-flows/components/components/`

**Action:**

1.  **Move Components:** Move all files from `src/lib/features/test-flows/components/components/` up one level to `src/lib/features/test-flows/components/`.
    ```bash
    mv src/lib/features/test-flows/components/components/* src/lib/features/test-flows/components/
    ```
2.  **Remove Empty Directory:** Delete the now empty `src/lib/features/test-flows/components/components/` directory.
    ```bash
    rmdir src/lib/features/test-flows/components/components/
    ```
3.  **Update Imports:** Update all imports that referenced the nested path.

### 3. Review and Consolidate Type Definitions

**Current State:**

- `types.ts` files in various locations (e.g., `src/lib/features/test-flows/components/components/types.ts`, `src/lib/supabase/types.ts`).

**Action:**

1.  **Identify Global Types:** Determine which types are used across multiple features or are truly global to the application.
2.  **Create Central Types Directory:** Create `src/lib/types/index.ts` for global types.
3.  **Move Global Types:** Move identified global types to `src/lib/types/index.ts`.
4.  **Update Imports:** Update all imports to reflect the new central location for global types.
5.  **Retain Feature-Specific Types:** Keep types that are only relevant to a single feature within that feature's directory.

### 4. Review `src/db` and `src/lib/server/drizzle.ts`

**Current State:**

- `src/db/index.ts` and `src/db/relations.ts`
- `src/lib/server/drizzle.ts`

**Action:**

1.  **Move Server-Only DB Logic:** Move `src/db/index.ts` and `src/db/relations.ts` to `src/lib/server/db/`.
    ```bash
    mv src/db/index.ts src/lib/server/db/index.ts
    mv src/db/relations.ts src/lib/server/db/relations.ts
    ```
2.  **Update Imports:** Update all imports that referenced the old `src/db/` path to the new `src/lib/server/db/` path.
3.  **Ensure `src/lib/server/drizzle.ts` is the primary DB client:** Confirm that `src/lib/server/drizzle.ts` is the main entry point for database interactions on the server.

## Verification:

After completing all refactoring steps:

1.  **Install Dependencies:** Run `npm install` to ensure all dependencies are correctly resolved.
2.  **Build Project:** Run the project's build command (e.g., `npm run build`) to check for compilation errors.
3.  **Run Tests:** Execute all existing tests to ensure no regressions were introduced.
4.  **Manual Testing:** Perform manual checks of key application functionalities.
