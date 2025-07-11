# Svelte + Supabase Project

Everything you need to build a Svelte project with Supabase integration, powered by [`sv`](https://github.com/sveltejs/cli) and [`supabase-js`](https://github.com/supabase/supabase-js).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```bash
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Backend Authentication Setup

This project uses Supabase for authentication while maintaining a local user database with Drizzle ORM. Here's how it works:

1. Users sign up/sign in through our frontend component
2. The requests are sent to our backend API endpoints
3. The backend handles Supabase authentication and synchronizes with our local user database

### Environment Variables

Copy the `.env.example` file to `.env` and fill in your values:

```bash
cp .env.example .env
```

You'll need:

- Supabase URL and anon key (for client-side)
- Supabase service key (for server-side, keep this secret!)
- Your database connection string

### Database Migration

Run the migration to add the Supabase auth ID column:

```bash
psql -U your_username -d your_database -f drizzle/migration_supabase_auth_id.sql
```

Or use Drizzle's migration system if set up:

```bash
npm run drizzle:generate
npm run drizzle:migrate
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Supabase Setup

This project includes Supabase integration for authentication, database, and storage features.

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com/) and sign up or log in
2. Create a new project
3. Wait for your database to start

### 2. Configure Environment Variables

1. Copy the `.env` file to `.env.local`:

   ```bash
   cp .env .env.local
   ```

2. Update the `.env.local` file with your Supabase credentials:

   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

   You can find these values in your Supabase project dashboard under Settings > API.

### 3. Set Up Database Types (Optional)

For better TypeScript support, you can generate types from your Supabase database:

1. Install Supabase CLI
2. Run:
   ```bash
   supabase gen types typescript --project-id your-project-id > src/lib/supabase/types.ts
   ```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Supabase Features Used

This project demonstrates:

1. **Authentication** - Email/password login and signup
2. **Database Operations** - Fetching data from Supabase tables
3. **Type Safety** - TypeScript integration with Supabase
4. **Drizzle ORM** - SQL query builder and schema management with Supabase PostgreSQL

For more information, check out the [Supabase documentation](https://supabase.com/docs).

## Drizzle ORM Integration

This project includes [Drizzle ORM](https://orm.drizzle.team/) for database schema management, migrations, and SQL query building.

### 1. Configuration

The database connection is configured in two places:

- Server-side: `/src/lib/server/drizzle.ts`
- Client-side (use with caution): `/src/db/index.ts`

### 2. Schema Definition

The database schema is defined in `/src/db/schema.ts` using Drizzle's schema definition language.

### 3. Running Migrations

Generate migrations based on schema changes:

```bash
npm run drizzle:generate
```

Push migrations to the database:

```bash
npm run drizzle:push
```

View your database with Drizzle Studio:

```bash
npm run drizzle:studio
```

### 4. Environment Setup

Ensure your `.env` file includes:

```
DATABASE_URL=postgres://[user]:[password]@[host]:[port]/[db_name]
```

For Supabase, this usually looks like:

```
DATABASE_URL=postgres://postgres:[password]@[project-ref].supabase.co:5432/postgres
```

### 5. Best Practices

- Always perform database operations server-side (in API routes or server load functions)
- Use Drizzle relations for complex joins
- Use prepared statements for user-provided data

For more information, see the [Drizzle ORM documentation](https://orm.drizzle.team/docs/overview).
