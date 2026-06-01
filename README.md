# Test-Pilot

**Automate your REST API testing workflows with intelligent test flow orchestration.**

Test-Pilot is a cross-platform application (web + Tauri desktop) that helps software engineers rapidly validate API changes by automating multi-step API test sequences. Instead of manually clicking "Send" 20+ times in traditional tools, Test-Pilot executes entire workflows with one click while automatically passing data between sequential requests.

> **💡 Desktop app recommended:** While the web version works for public APIs, the Tauri desktop app is **required for testing localhost APIs** and provides CORS-free execution with native HTTP capabilities.

## ✨ Key Features

- 🚀 **One-Click Test Execution** - Run complete multi-step API flows automatically
- 🔗 **Smart Data Flow** - Extract data from responses and inject into subsequent requests using template expressions
- 📝 **Visual Flow Editor** - Design test sequences with a clean, intuitive interface
- ✅ **Response Assertions** - Validate status codes, headers, JSON paths, and response times
- 🔄 **Response Transformations** - Transform API responses with JavaScript-like pipelines
- 🌍 **Environment Management** - Switch between dev/sit/uat/prod with environment-aware variables
- 🍪 **Session Management** - Maintain cookies and authentication state across entire test flows
- 📦 **OpenAPI Import** - Import and manage API specifications directly

## 🎯 Why Test-Pilot?

While tools like Postman excel at testing individual endpoints, Test-Pilot is designed for **workflow automation**:

| Feature | Postman Collection Runner | Test-Pilot |
|---------|---------------------------|------------|
| Sequential execution | ✅ Requires JavaScript scripting | ✅ Visual editor with templates |
| Data extraction | ✅ Via code in Tests tab | ✅ Template expressions `{{res:step1-0.$.id}}` |
| Visual assertions | ❌ Must write code | ✅ Visual assertion builder |
| Visual transformations | ❌ Must write code | ✅ Pipeline-based transformations |
| Learning curve | Higher (requires JavaScript) | Lower (low-code approach) |

## 🚀 Quick Start for Users

### Using the Hosted Version (Web)

1. Visit **[https://test-pilot-five.vercel.app](https://test-pilot-five.vercel.app)**
2. Sign up for an account
3. Import your OpenAPI specification
4. Create test flows and start testing!

> **Note:** The web version has CORS limitations when testing APIs. For full functionality and local API testing, use the desktop app.

### Using the Desktop App (Recommended for Local Testing)

The desktop app is built with Tauri and is **required for testing APIs on localhost** or APIs with strict CORS policies.

**Download:**
- [Download for macOS](#) (Coming soon)
- [Download for Windows](#) (Coming soon)
- [Download for Linux](#) (Coming soon)

**Or build from source:**

```bash
# Clone the repository
git clone https://github.com/khanh1998/test-pilot.git
cd test-pilot

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Set up the database (for local development)
npm run setup

# Run the desktop app
npm run tauri:dev

# Or build a production version
npm run tauri:build
```

**Why use the desktop app?**
- ✅ Test local APIs (localhost, 127.0.0.1)
- ✅ Bypass CORS restrictions
- ✅ Native HTTP client for better cookie/session handling

## 📖 User Guide

### 1. Import Your API

- Navigate to **Projects** → **APIs**
- Click **Import OpenAPI Specification**
- Upload your YAML or JSON file
- Test-Pilot will parse and store all endpoints

### 2. Create a Test Flow

- Go to **Test Flows** → **Create New**
- Add steps to your flow
- For each step, select endpoints to call
- Configure parameters using:
  - Static values
  - Template expressions: `{{res:step1-0.$.data.userId}}`
  - Flow parameters: `{{param:username}}`
  - Environment values by mapping linked environment variables to flow parameters

### 3. Add Assertions

- Click the **Assertion** button for any endpoint
- Choose assertion type (status code, header, JSON path, response time)
- Set expected values
- Assertions execute sequentially and stop on first failure

### 4. Add Transformations

- Click the **Transform** button for any endpoint
- Write transformation expressions using pipeline syntax
- Access transformed data in later steps: `{{proc:step1-0.users}}`

### 5. Execute Your Flow

- Click **Run Flow** 
- Watch real-time execution progress
- Review results, assertions, and timing
- Debug failures with detailed logs

### 6. Environment Management

- Create environment sets (e.g., "Hero Project")
- Define sub-environments (dev, sit, uat, prod)
- Set environment-specific API hosts and variables
- Switch environments before execution

## 👨‍💻 Contributing

We welcome contributions! This section is for developers who want to contribute code.

### Tech Stack

- **Frontend:** SvelteKit, Svelte 5, TailwindCSS
- **Backend:** SvelteKit API routes
- **Database:** PostgreSQL with Drizzle ORM
- **Authentication:** Supabase Auth
- **Testing:** Vitest
- **Desktop:** Tauri (optional)

### Development Setup

1. **Prerequisites**
   - Node.js 18+ and npm
   - PostgreSQL database
   - Supabase account (for authentication)

2. **Clone and Install**
   ```bash
   git clone https://github.com/khanh1998/test-pilot.git
   cd test-pilot
   npm install
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your values:
   ```env
   # Supabase
   PUBLIC_SUPABASE_URL=your_supabase_url
   PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_KEY=your_service_key
   
   # Database
   DATABASE_URL=postgresql://user:password@localhost:5432/testpilot
   ```

4. **Database Setup**
   ```bash
   # Run migrations and seed data
   npm run setup
   
   # Or manually:
   npm run drizzle:push
   npm run db:seed
   ```

5. **Start Development**
   ```bash
   # Web only
   npm run dev
   
   # Web + local database
   npm run dev:with-db
   
   # Desktop (Tauri)
   npm run tauri dev
   ```

### Project Structure

```
src/
├── routes/              # SvelteKit file-based routing
│   ├── api/            # API endpoints (controllers)
│   └── +page.svelte    # UI pages
├── lib/
│   ├── components/     # Svelte components
│   ├── server/         # Server-side code
│   │   ├── service/   # Business logic
│   │   ├── repository/ # Data access layer
│   │   └── db/        # Database schema & connection
│   ├── flow-runner/   # Test flow execution engine
│   ├── template/      # Template expression system
│   ├── assertions/    # Assertion engine
│   └── transform/     # Transformation engine
```

### Architecture

- **Controllers** (`/routes/api/**/+server.ts`) - Handle HTTP, validation, marshaling
- **Services** (`/lib/server/service/`) - Business logic implementation
- **Repositories** (`/lib/server/repository/`) - Data access abstraction
- **Flow Runner** (`/lib/flow-runner/`) - Orchestrates test execution

See [.github/copilot-instructions.md](.github/copilot-instructions.md) for detailed architecture documentation.

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Database Operations

```bash
# Generate migration from schema changes
npm run drizzle:generate

# Apply migrations
npm run drizzle:push

# Open Drizzle Studio (database GUI)
npm run drizzle:studio

# Seed database with sample data
npm run db:seed
```

### Code Style

```bash
# Format code
npm run format

# Lint code
npm run lint

# Type check
npm run check
```

### Contribution Guidelines

1. **Fork the repository** and create a feature branch
2. **Follow the existing code style** - run `npm run format` before committing
3. **Write tests** for new features
4. **Update documentation** if needed
5. **Submit a Pull Request** with a clear description

### Key Development Principles

- Keep controllers thin - business logic goes in services
- Database queries only in repositories
- Write tests for complex business logic
- Use TypeScript strictly - avoid `any`
- Follow Svelte 5 best practices (runes, snippets)

## 📚 Documentation

- [Test Flow Blueprint](docs/testflow.md) - Flow structure and design
- [Template Expressions](docs/json_template_expressions.md) - Dynamic data references
- [Assertions Guide](docs/assertion.md) - Response validation
- [Transformations](docs/data_transformation_expression.md) - Data manipulation
- [Environment Management](docs/environment_feature_proposal.md) - Multi-environment support
- [Testing Guide](TESTING_GUIDE.md) - Writing and running tests

## 🗺️ Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md) for planned features and development phases.

## 📄 License

This project is open source. See LICENSE file for details.

## 🤝 Support

- 🐛 Report bugs via [GitHub Issues](https://github.com/khanh1998/test-pilot/issues)
- 💡 Request features via [GitHub Issues](https://github.com/khanh1998/test-pilot/issues)
- 📧 Contact: [your-email@example.com]

## 🙏 Acknowledgments

Built with:
- [SvelteKit](https://kit.svelte.dev/)
- [Supabase](https://supabase.com/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [TailwindCSS](https://tailwindcss.com/)
- [Tauri](https://tauri.app/)
