# Postman Workspace Provisioning Tools

Comprehensive multi-language tooling for automated Postman partner workspace provisioning and management. Available in three modes: **CLI scripts** for interactive terminal use, **drag-and-drop standalone scripts** for quick integration, and **modular SDKs** for embedding into applications.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Repository Modes](#repository-modes)
  - [CLI Scripts](#cli-scripts)
  - [Dev Portal — Standalone Scripts](#dev-portal--standalone-scripts)
  - [Dev Portal — SDKs](#dev-portal--sdks)
- [Available SDKs](#available-sdks)
- [Quick Start](#quick-start)
  - [JavaScript](#javascript-quick-start)
  - [TypeScript](#typescript-quick-start)
  - [Python](#python-quick-start)
  - [Java](#java-quick-start)
- [Configuration](#configuration)
- [Architecture Overview](#architecture-overview)
- [Workflow Details](#workflow-details)
- [Original Source Reference](#original-source-reference)
- [Project Structure](#project-structure)
- [License](#license)

---

## Overview

These tools automate the process of creating and managing Postman partner workspaces. They handle the complete provisioning workflow from workspace creation through asset copying to team/partner management.

### Complete Provisioning Workflow

```
1. Workspace Creation         → Create new partner workspace (or use existing)
2. Copy Collections           → Fork all collections + extract host variable URLs
3. Create Mock Servers        → Generate mock servers for each collection
4. Copy Environments          → Duplicate environment configurations
5. Create Mock Env             → Create fresh "Mock Env" with mock server URLs
6. Update Collection Vars     → Map collection host variables to mock env references
7. Copy API Specs             → Transfer all API specification files
8. Add Team Admins            → Add internal team members as workspace admins
9. Invite Partners            → Send partner invitations with invitation links
```

> **Mock Environment**: A fresh "Mock Env" is always created with mock server URLs. Host variables are detected via request URL inspection with a fallback to common variable names (baseUrl, HostName, etc.). Collection variables are then patched to reference the mock environment variables.

### Reset Workflow

Deletes workspace resources in reverse dependency order:
1. Delete API Specs
2. Delete Mock Servers
3. Delete Environments
4. Delete Collections

### Update Workflow

Detects and adds new assets from the source workspace to an existing partner workspace — without modifying existing assets:

```
1. Scan & Detect           → Compare source and target workspaces for differences
2. Fork New Collections    → Fork only net-new collections to target workspace
3. Create Mock Servers     → Generate mock servers for each new collection
4. Update Mock Env         → Add new mock URL variables to existing "Mock Env" (in-place)
5. Update Collection Vars  → Map new collection host variables to mock env references
6. Copy New API Specs      → Transfer new specification files
7. Copy New Environments   → Duplicate new environment configurations
```

> **Detection Strategy**: Collections are matched by fork-relationship first (checking `fork.from` metadata), then by name as a fallback. Specs and environments are matched by name only. "Mock Env" is excluded from environment matching since it's managed separately.

---

## Features

### Complete Workspace Provisioning
- Automated collection forking with host variable detection
- Mock server creation with automatic mock environment generation
- Environment variable handling with intelligent mock URL naming
- Collection variable auto-mapping to mock environment references
- Multi-file API specification copying
- Team member management (add admins)
- Partner invitation with "Run in Postman" links

### Custom Selection Provisioning
- Choose specific asset types (Collections, Environments, Mocks, Specs)
- Select individual items from each category
- Enable/disable admin and partner steps
- Build custom workflows for your specific needs

### Safe Reset Functionality
- Dependency-aware deletion order
- Confirmation prompts (CLI only)
- Selective deletion options
- Detailed error reporting

### Workspace Update Detection
- Scan source and target workspaces to detect net-new collections, specs, and environments
- Fork-relationship matching (primary) with name-match fallback for collection detection
- Existing "Mock Env" updated in-place with new mock URL variables (not recreated)
- New collection variables automatically wired to reference mock env
- Additive only — existing assets are never modified or removed

### Robust Error Handling
- Detailed error logging
- Progress callbacks
- Rate limit management
- Partial failure handling

---

## Repository Modes

This repository offers three ways to use the Postman provisioning tools, depending on your use case.

### CLI Scripts

Interactive command-line tools for manual workspace provisioning and reset. Run directly from the terminal with prompts and confirmations.

```bash
npm run provision    # Interactive provisioning
npm run reset        # Interactive reset
npm run update       # Detect and add new assets
```

Best for one-off operations, testing, and debugging. See the [CLI documentation](cli/README.md) for full details on `provision.js`, `reset.js`, and `update.js`.

### Dev Portal — Standalone Scripts

Single-file "drag-and-drop" scripts that contain all provisioning logic in one file per language. Copy a script into any project and call its exported functions directly — no package installation or build step required.

| Language | Script | Documentation |
|----------|--------|---------------|
| **JavaScript** | [`postmanService.js`](dev-portal/javascript/script/postmanService.js) | [SCRIPT_README](dev-portal/javascript/script/SCRIPT_README.md) |
| **TypeScript** | [`postmanService.ts`](dev-portal/typescript/script/postmanService.ts) | [SCRIPT_README](dev-portal/typescript/script/SCRIPT_README.md) |
| **Python** | [`postman_service.py`](dev-portal/python/script/postman_service.py) | [SCRIPT_README](dev-portal/python/script/SCRIPT_README.md) |
| **Java** | [`PostmanService.java`](dev-portal/java/script/PostmanService.java) | [SCRIPT_README](dev-portal/java/script/SCRIPT_README.md) |

### Dev Portal — SDKs

Modular, fully-packaged SDKs with proper project structure, build tooling, type definitions, and service-layer architecture. Install as a dependency and import into your application.

| Language | Package | Documentation | Integration Guide |
|----------|---------|---------------|-------------------|
| **JavaScript** | `@postman/workspace-sdk` | [README](dev-portal/javascript/sdk/README.md) | [SDK_INTEGRATION](dev-portal/javascript/sdk/SDK_INTEGRATION.md) |
| **TypeScript** | `@postman/workspace-sdk` | [README](dev-portal/typescript/sdk/README.md) | [SDK_INTEGRATION](dev-portal/typescript/sdk/SDK_INTEGRATION.md) |
| **Python** | `postman-workspace-sdk` | [README](dev-portal/python/sdk/README.md) | [SDK_INTEGRATION](dev-portal/python/sdk/SDK_INTEGRATION.md) |
| **Java** | `com.postman:workspace-sdk` | [README](dev-portal/java/sdk/README.md) | [SDK_INTEGRATION](dev-portal/java/sdk/SDK_INTEGRATION.md) |

See the [Dev Portal documentation](dev-portal/README.md) for a full comparison of scripts vs SDKs.

---

## Available SDKs

| Language | Package | Async Support | Framework Integrations | Documentation |
|----------|---------|---------------|------------------------|---------------|
| **JavaScript** | `@postman/workspace-sdk` | Promises | React, Vue, Angular, Svelte, Node.js | [README](dev-portal/javascript/sdk/README.md) |
| **TypeScript** | `@postman/workspace-sdk` | Promises | React, Next.js, Vue, Angular, Svelte | [README](dev-portal/typescript/sdk/README.md) |
| **Python** | `postman-workspace-sdk` | async/await | FastAPI, Django, Flask, Streamlit | [README](dev-portal/python/sdk/README.md) |
| **Java** | `com.postman:workspace-sdk` | Reactive (Mono/Flux) | Spring Boot, Thymeleaf, Vaadin | [README](dev-portal/java/sdk/README.md) |

### SDK Feature Matrix

| Feature | JavaScript | TypeScript | Python | Java |
|---------|------------|------------|--------|------|
| Full Provisioning | ✅ | ✅ | ✅ | ✅ |
| Custom Provisioning | ✅ | ✅ | ✅ | ✅ |
| Full Reset | ✅ | ✅ | ✅ | ✅ |
| Custom Reset | ✅ | ✅ | ✅ | ✅ |
| Update Detection | ✅ | ✅ | ✅ | ✅ |
| Partner Invitations | ✅ | ✅ | ✅ | ✅ |
| Admin Management | ✅ | ✅ | ✅ | ✅ |
| Progress Callbacks | ✅ | ✅ | ✅ | ✅ |
| Type Safety | JSDoc | Full | Pydantic | Records |

---

## Quick Start

### JavaScript Quick Start

```bash
cd dev-portal/javascript/sdk
npm install
```

```javascript
import { PostmanClient, ProvisioningService } from '@postman/workspace-sdk';

const client = new PostmanClient({
  apiKey: process.env.POSTMAN_API_KEY,
});

const provisioner = new ProvisioningService(client, {
  sourceWorkspaceId: 'source-workspace-id',
  targetWorkspaceName: 'Partner Workspace',
  partnerEmails: ['partner@company.com'],
});

const result = await provisioner.provision((progress) => {
  console.log(`${progress.phase}: ${progress.message}`);
});

console.log('Invitation links:', result.invitations.links);
```

### TypeScript Quick Start

```bash
cd dev-portal/typescript/sdk
npm install
npm run build
```

```typescript
import { PostmanClient, ProvisioningService } from '@postman/workspace-sdk';

const client = new PostmanClient({
  apiKey: process.env.POSTMAN_API_KEY!,
});

const provisioner = new ProvisioningService(client, {
  sourceWorkspaceId: 'source-workspace-id',
  targetWorkspaceName: 'Partner Workspace',
  adminUserIds: ['12345'],
  partnerEmails: ['partner@company.com'],
});

const result = await provisioner.provision();
```

### Python Quick Start

```bash
cd dev-portal/python/sdk
pip install -e .
```

```python
import asyncio
from postman_sdk import PostmanClient, ProvisioningService

async def main():
    async with PostmanClient(api_key="your-api-key") as client:
        provisioner = ProvisioningService(
            client=client,
            source_workspace_id="source-workspace-id",
            target_workspace_name="Partner Workspace",
            partner_emails=["partner@company.com"],
        )
        
        result = await provisioner.provision()
        print(f"Created workspace: {result.workspace.name}")
        
        for invite in result.invitations.links:
            print(f"Send to {invite.email}: {invite.link}")

asyncio.run(main())
```

### Java Quick Start

```bash
cd dev-portal/java/sdk
mvn install
```

```java
import com.postman.sdk.client.PostmanClient;
import com.postman.sdk.services.ProvisioningService;

@Service
public class WorkspaceManager {
    
    private final ProvisioningService provisioningService;
    
    public Mono<ProvisioningResult> createPartnerWorkspace(String sourceId, String name) {
        var config = new ProvisioningService.ProvisioningConfig(
            sourceId,
            null,
            name,
            List.of("admin-user-id"),
            List.of("partner@company.com"),
            null,
            event -> log.info(event.message())
        );
        
        return provisioningService.provision(config);
    }
}
```

---

## Configuration

All SDKs and scripts use the same environment variables for configuration:

### Required Variables

| Variable | Description |
|----------|-------------|
| `POSTMAN_API_KEY` | Your Postman API key |
| `POSTMAN_SOURCE_WORKSPACE_ID` | Source workspace to copy from |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTMAN_TARGET_WORKSPACE_ID` | Target workspace (creates new if not provided) | - |
| `POSTMAN_WORKSPACE_NAME` | Name for new workspace | "Partner Workspace" |
| `POSTMAN_ADMIN_USER_IDS` | Comma-separated user IDs to add as admins | - |
| `PARTNER_EMAILS` | Comma-separated partner emails to invite | - |
| `PARTNER_ROLE_ID` | Partner role ID | "7" |

### Getting Your Configuration Values

1. **API Key**: Go to [Postman Account Settings](https://go.postman.co/settings/me/api-keys) → Generate API Key

2. **Workspace IDs**: Open Postman → Workspace Settings → Workspace ID (or from URL: `https://app.getpostman.com/workspace/<ID>`)

3. **User IDs**: Available via Postman API or team management

### Partner Role Reference

| Role ID | Name | Description |
|---------|------|-------------|
| `4` | Partner Viewer | Read-only access to workspace |
| `7` | Editor and Partner Lead | Full editing access with partner lead privileges |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Postman Workspace SDK                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │JavaScript│  │TypeScript│  │  Python  │  │   Java   │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │             │             │             │               │
│       ▼             ▼             ▼             ▼               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Service Layer                         │   │
│  │  • ProvisioningService  • ResetService  • UpdateService   │  │
│  │  • WorkspaceService                                       │  │
│  └─────────────────────────────────────────────────────────┘   │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Client Layer                          │   │
│  │  • PostmanClient (API methods)  • HttpClient (requests)  │   │
│  └─────────────────────────────────────────────────────────┘   │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Postman API                           │   │
│  │  • Workspaces  • Collections  • Environments  • Mocks    │   │
│  │  • Specs  • Invitations  • Roles                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Responsibility |
|-------|----------------|
| **Service Layer** | High-level workflows, business logic, progress tracking |
| **Client Layer** | API method wrappers, request/response handling, error handling |
| **HTTP Layer** | Raw HTTP requests, authentication, retries |

---

## Workflow Details

### Provisioning Order

The provisioning follows a specific order to ensure dependencies are met:

| Step | Phase | Description |
|------|-------|-------------|
| 1 | Validation | Verify API key and workspaces |
| 2 | Workspace | Create or verify target workspace |
| 3 | Collections | Fork collections and extract host variable URLs |
| 4 | Mock Servers | Create for each collection |
| 5 | Environments | Copy with original variables |
| 6 | Mock Environment | Create fresh env with mock server URLs |
| 7 | Collection Variables | Update collection host vars to reference mock env vars |
| 8 | API Specs | Copy specification files |
| 9 | Admins | Add team members as workspace admins |
| 10 | Partners | Invite partners and generate invitation links |

### Reset Order

The reset follows reverse order to handle dependencies:

| Step | Phase | Reason |
|------|-------|--------|
| 1 | API Specs | No dependencies |
| 2 | Mock Servers | Depend on collections |
| 3 | Environments | Independent |
| 4 | Collections | Deleted last |

### Update Order

The update detects new assets and adds them with full mock wiring:

| Step | Phase | Description |
|------|-------|-------------|
| 1 | Detection | Scan both workspaces; identify new collections (fork-check → name-match), specs, and environments |
| 2 | Fork Collections | Fork only net-new collections to target workspace |
| 3 | Mock Servers | Create mock server for each new collection |
| 4 | Mock Environment | Append new mock URL variables to existing "Mock Env" (or create fresh) |
| 5 | Collection Variables | PATCH new collection host vars to reference mock env vars |
| 6 | API Specs | Copy new specification files |
| 7 | Environments | Copy new environments (excluding "Mock Env") |

### Rate Limiting

All SDKs and scripts include automatic delays between API calls:

| Operation | Delay |
|-----------|-------|
| Collections | 300ms |
| Mocks | 300ms |
| Environments | 300ms |
| Specs | 500ms |
| Admins | 300ms |
| Partners | 300ms |

---

## Reference Materials

Original source files and API references are preserved in the [`reference/`](reference/) directory for traceability:

| File | Description |
|------|-------------|
| [`postmanService.js`](reference/postmanService.js) | Original single-file implementation (before multi-language modularization) |
| [`OG_README.md`](reference/OG_README.md) | Original README documenting the single-file approach |
| [`postman-api.yaml`](reference/postman-api.yaml) | Postman API OpenAPI specification |
| [`Postman API.postman_collection.json`](reference/Postman%20API.postman_collection.json) | Postman API collection |
| [`PW Auto Provisioning.postman_collection.json`](reference/PW%20Auto%20Provisioning.postman_collection.json) | Auto-provisioning workflow collection |

### Relationship to Dev Portal

```
reference/postmanService.js (original)
    │
    ├── dev-portal/javascript/
    │     ├── script/    (cleaned-up single-file JS)
    │     └── sdk/       (ES Module SDK with Rollup)
    ├── dev-portal/typescript/
    │     ├── script/    (fully-typed single-file TS)
    │     └── sdk/       (TypeScript SDK with tsup)
    ├── dev-portal/python/
    │     ├── script/    (async single-file Python)
    │     └── sdk/       (Python SDK with Pydantic)
    └── dev-portal/java/
          ├── script/    (Spring WebClient single-file Java)
          └── sdk/       (Java SDK with Spring Boot)
```

---

## Project Structure

```
fde-pw-creation-script/
├── cli/                              # CLI scripts (interactive terminal)
│   ├── README.md
│   ├── provision.js
│   ├── reset.js
│   └── update.js
├── dev-portal/                       # Multi-language tools
│   ├── README.md                     # Dev portal overview
│   ├── javascript/
│   │   ├── script/                   # Drag-and-drop standalone script
│   │   └── sdk/                      # Modular JavaScript SDK
│   ├── typescript/
│   │   ├── script/                   # Drag-and-drop standalone script
│   │   └── sdk/                      # Modular TypeScript SDK
│   ├── python/
│   │   ├── script/                   # Drag-and-drop standalone script
│   │   └── sdk/                      # Modular Python SDK
│   └── java/
│       ├── script/                   # Drag-and-drop standalone script
│       └── sdk/                      # Modular Java SDK
├── reference/                        # Original source & API references
│   ├── postmanService.js             # Original single-file implementation
│   ├── OG_README.md                  # Original README
│   ├── postman-api.yaml              # Postman API OpenAPI spec
│   ├── Postman API.postman_collection.json
│   └── PW Auto Provisioning.postman_collection.json
├── package.json                      # Root package config
└── README.md                         # This file
```

---

## License

ISC

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

For SDK-specific contributions, please follow the conventions in each SDK's README.
