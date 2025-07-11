## 🛣️ MVP Product Roadmap

### 🔰 Phase 1: Foundation (Week 1–2)

> _Goal: Set up the core skeleton — import OpenAPI, extract data, and prepare the DB._

- [x] ✅ **Set up project structure** (Node.js, Express or CLI-based, with TypeScript preferred)
- [x] ✅ **Parse OpenAPI YAML**
  - Use `swagger-parser` + `yaml` to load and dereference spec

- [x] ✅ **Extract key elements**
  - Paths, HTTP methods
  - Parameters (query, path, body)
  - Request/response schemas
  - Security requirements

- [x] ✅ **Store to local database** (SQLite or PostgreSQL)
  - Tables: `endpoints`, `parameters`, `schemas`, `flows` (optional at this stage)

---

### 🚀 Phase 2: Test Flow Generator (Week 3–4)

> _Goal: Generate meaningful test plans automatically from imported OpenAPI._

- [ ] ✅ **Build API dependency resolver**
  - Identify relationships via `path`, `requestBody`, `response` (e.g., create → get by id)

- [ ] ✅ **Generate test flows**
  - Detect common flows (e.g., auth → create → get)
  - Allow one flow per resource (`POST` → `GET`, `PUT`, `DELETE`)

- [ ] ✅ **Integrate LLM to help:**
  - Generate sample input payloads (based on schema and field names)
  - Suggest basic assertion checks (e.g., `status === 200`, `id != null`)

- [ ] ✅ **Create internal format to represent a test plan**
  - JSON-based structure for flow steps, data mappings

---

### 🧪 Phase 3: Test Runner (Week 5)

> _Goal: Run the generated flows and report success/failure._

- [ ] ✅ **Simple local test executor**
  - Use `axios` or `fetch` to make HTTP requests
  - Support headers, path replacement, and auth tokens

- [ ] ✅ **Report test result**
  - Basic success/failure with logs
  - Highlight failed steps and reasons

---

### 🖥️ Phase 4: Developer UX (Week 6)

> _Goal: Let engineers interact with the app in a smooth and minimal way._

- [ ] ✅ **Simple UI or CLI**
  - CLI: commands like `import`, `generate`, `run`
  - Optional: Web UI with dashboard to see endpoints and flows

- [ ] ✅ **Flow selection**
  - Let users choose specific endpoints or flows to test

- [ ] ✅ **Minimal config support**
  - Server URL
  - Auth credentials (e.g., login username/password)

---

### 🧩 📡 Phase 5: MCP Server – AI Agent Integration Layer (Week 7+)

> **Goal:** Enable communication between your testing app and an external AI agent (e.g., LLM, VSCode plugin, ChatGPT plugin, etc.) to issue instructions and receive structured responses.

#### 🛠️ Key Features

| Feature                                           | Description                                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 🧠 **LLM-compatible request format**              | JSON structure that describes OpenAPI context, current API selection, and asks the agent for a test flow suggestion |
| 🔌 **API interface (MCP server)**                 | A REST or WebSocket interface that receives instructions from your app and returns agent-generated responses        |
| 🧾 **Prompt & response template system**          | Unified structure for asking the LLM to generate: payloads, test flows, assertions, etc.                            |
| 🧪 **Execution hook for AI-generated test plans** | Optionally run the plan automatically after receiving it                                                            |
| 🛑 **Security/sandboxing**                        | Prevent malicious or invalid test code from being run blindly                                                       |

---

## 🏁 Stretch Goals (Post-MVP)

> _Start thinking beyond MVP only after validation_

- [ ] 🔄 **CI integration** (`run-testplan` before `git push`)
- [ ] 🌐 **VSCode Extension** to run plans directly
- [ ] 🧪 **Advanced assertions** using LLM
- [ ] 🔍 **Flow diff detection** (compare new OpenAPI version with old)

---

## 🎯 Summary

| Milestone  | Outcome                          |
| ---------- | -------------------------------- |
| ✅ Phase 1 | OpenAPI parser + DB              |
| ✅ Phase 2 | Auto-generated test flows        |
| ✅ Phase 3 | Executable test plans            |
| ✅ Phase 4 | CLI or basic UI for devs to use  |
| ✅ Phase 5 | MCP Server: AI integration layer |

Let me know if you'd like this as a Notion doc, markdown file, or Kanban-style board format.
