# Agent Instructions for Test-Pilot

## Project Goal

Test-Pilot is a smart API test flow generator and runner. It helps backend engineers sanity-check REST APIs after changes by importing OpenAPI/Swagger specs, analyzing endpoints, and generating or executing realistic multi-step API test flows with correct data dependencies.

Core product capabilities:

- OpenAPI YAML/JSON import and parsing
- Automatic test flow generation from endpoint dependencies
- Smart test data generation with LLM and static rules
- Visual test flow editing
- One-click execution for full or partial API flows
- Template expressions for passing data between API calls
- Assertions, response transformations, environment management, and session handling

Target users are backend engineers who want a fast, smart, and convenient way to validate APIs before pushing code.

## Architecture

This is a SvelteKit + Supabase project with optional Tauri desktop support.

- Frontend: Svelte 5 with SvelteKit
- Backend: SvelteKit API routes
- Database: PostgreSQL with Drizzle ORM
- Authentication: Supabase Auth with local user database synchronization
- Styling: TailwindCSS
- Testing: Vitest
- Desktop: Tauri for localhost API testing and CORS-free native HTTP execution

## Repository Structure

- `src/`: Main application source code.
- `src/routes/`: SvelteKit file-based routing.
- `src/routes/api/`: API route controllers. Controllers handle validation, request/response marshaling, and service calls. Do not put business logic here.
- `src/lib/`: Reusable code, components, utilities, and feature engines.
- `src/lib/components/`: Svelte components organized by feature.
- `src/lib/assertions/`: Assertion feature for test flows.
- `src/lib/template/`: Template expression system for dynamic test flow data.
- `src/lib/transform/`: Transformation logic for test flow responses.
- `src/lib/flow-runner/`: Test flow execution engine.
- `src/lib/sequence-runner/`: Sequence execution support.
- `src/lib/http_client/`: Client-side functions for backend API requests.
- `src/lib/supabase/`: Supabase client initialization and types.
- `src/lib/server/`: Server-side only code.
- `src/lib/server/service/`: Business logic and workflows.
- `src/lib/server/repository/`: Data access abstractions.
- `src/lib/server/repository/db/`: Drizzle database operations.
- `src/lib/server/repository/openai/`: OpenAI API interactions.
- `src/lib/server/repository/supabase/`: Supabase-specific data operations.
- `src/lib/server/db/`: Drizzle schema, relations, types, and database connection.
- `src/lib/server/auth/`: Authentication-related server logic.
- `src-tauri/`: Tauri desktop application.
- `drizzle/`: Drizzle Kit generated SQL migrations and metadata. Do not edit generated migration files manually.
- `static/`: Static assets.
- `docs/`: Product, architecture, and feature documentation.
- `tests/`: Vitest unit tests when not colocated.

## Key Development Principles

- Keep controllers thin. Business rules belong in services.
- Put database queries in repositories.
- Use Drizzle ORM for all database interactions.
- Keep server-only code under `src/lib/server/` or SvelteKit server routes.
- Never expose the database client or server secrets to frontend code.
- Use TypeScript strictly and avoid `any` unless there is a clear reason.
- Follow established local patterns before introducing new abstractions.
- Write tests for complex business logic, cross-module contracts, and regression-prone behavior.
- Do not manually edit generated files under `drizzle/`.

## Authentication and Authorization

- Server-side authentication is handled in `src/hooks.server.ts`.
- API routes that require authentication should check `event.locals.user`.
- Use `event.locals.getUserId()` for user-scoped database queries.
- The local `users` table is synchronized with Supabase Auth through `supabaseAuthId`.
- Keep all user-owned resources scoped to the authenticated local user ID.

## API Route Guidelines

- API routes live in `src/routes/api/**/+server.ts`.
- Follow RESTful conventions for resource endpoints.
- Use SvelteKit's `json` helper for JSON responses.
- Validate inputs at the route boundary.
- Return appropriate HTTP status codes and useful error messages.
- Call service methods for business workflows.
- Do not place direct database access or application workflows in controllers.

## Service and Repository Guidelines

- Services in `src/lib/server/service/` contain application business rules and workflows.
- Services may call repositories and other services.
- Repositories in `src/lib/server/repository/` encapsulate data-source access.
- Use Drizzle helpers and operators such as `eq` and `inArray` for database queries.
- Add new repository subfolders for new data sources when needed.

## Frontend Guidelines

- Use Svelte 5 patterns, including runes and snippets where appropriate.
- Keep reusable UI in `src/lib/components/`, organized by feature.
- Use `src/lib/http_client/` for client-side backend calls when a feature needs reusable request helpers.
- Keep page-level UI in `src/routes/**/+page.svelte`.
- For feature pages, follow the existing dashboard/project UI conventions rather than creating a separate visual style.

## Environment Variables

- Copy `.env.example` to `.env` for local development.
- Store secrets and environment-specific configuration in `.env`.
- Use `$env/static/private` for private server-only values.
- Use `$env/static/public` for public client-safe values.
- Do not hard-code secrets, API keys, or database URLs.

Common local values include:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `DATABASE_URL`
- `OPENAI_API_KEY`

## Development Commands

- Install dependencies: `npm install`
- Set up local database and seed data: `npm run setup`
- Start web dev server: `npm run dev`
- Start web dev server after database setup: `npm run dev:with-db`
- Start desktop app: `npm run tauri:dev`
- Build web app: `npm run build:web`
- Build desktop app: `npm run tauri:build`
- Run tests once: `npm run test`
- Run unit tests directly: `npm run test:unit`
- Type check: `npm run check`
- Format code: `npm run format`
- Lint code: `npm run lint`

## Database Operations

- Schema source of truth: `src/lib/server/db/schema.ts`
- Relations source of truth: `src/lib/server/db/relations.ts`
- Generate migrations: `npm run drizzle:generate`
- Apply schema changes: `npm run drizzle:push`
- Seed database: `npm run db:seed`
- Open Drizzle Studio: `npm run drizzle:studio`

When adding tables or columns, update `schema.ts`. When relationships change, also update `relations.ts`. Generate migrations with Drizzle Kit instead of hand-editing generated SQL.

## Testing

- Framework: Vitest.
- Test files should use `.test.ts` or `.spec.ts`.
- Server-side unit tests can live in `tests/` or near the implementation if that matches existing local patterns.
- Component tests should be colocated with components under `src/lib/components/`.
- Run `npm run test` before finalizing behavior changes when feasible.

## Adding a New Feature

1. Update `src/lib/server/db/schema.ts` for new tables or columns.
2. Update `src/lib/server/db/relations.ts` when relationships change.
3. Generate and apply database changes with `npm run drizzle:generate` and `npm run drizzle:push`.
4. Add API controllers under `src/routes/api/`.
5. Put business logic in `src/lib/server/service/<feature>/`.
6. Put database access in `src/lib/server/repository/db/`.
7. Add reusable components under `src/lib/components/<feature>/`.
8. Add pages under `src/routes/`.
9. Add HTTP client helpers under `src/lib/http_client/` when needed.
10. Add focused tests for the new behavior.

For example, a `widgets` feature would typically include:

- `src/routes/api/widgets/+server.ts`
- `src/routes/api/widgets/[id]/+server.ts`
- `src/lib/server/service/widgets/list_widgets.ts`
- `src/lib/server/service/widgets/create_widget.ts`
- `src/lib/server/service/widgets/get_widget.ts`
- `src/lib/server/service/widgets/update_widget.ts`
- `src/lib/server/service/widgets/delete_widget.ts`
- `src/lib/server/repository/db/widget.ts`
- `src/lib/components/widgets/`
- `src/routes/dashboard/widgets/+page.svelte`
- `src/routes/dashboard/widgets/[id]/+page.svelte`

## Deployment Notes

- The web app is configured for Vercel deployment.
- Ensure production environment variables are configured.
- Ensure `DATABASE_URL` points at the production database.
- Tauri builds are used for desktop distribution and are especially important for testing localhost APIs and bypassing browser CORS restrictions.

## Documentation References

- `README.md`: Product overview, user guide, and contributor setup.
- `docs/testflow.md`: Test flow structure and design.
- `docs/json_template_expressions.md`: Dynamic data references.
- `docs/assertion.md`: Response validation.
- `docs/data_transformation_expression.md`: Data transformation syntax.
- `docs/environment_feature_proposal.md`: Environment management.
- `docs/ROADMAP.md`: Planned features.
- `.github/copilot-instructions.md`: GitHub Copilot-specific instructions.
