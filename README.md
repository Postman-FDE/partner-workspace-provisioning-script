# Postman Workspace Provisioning Tools

Comprehensive multi-language SDK tooling for automated Postman partner workspace provisioning and management. Available as SDKs for JavaScript, TypeScript, Python, and Java, plus CLI scripts for manual operations.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Available SDKs](#available-sdks)
- [CLI Version](#cli-version)
- [Quick Start](#quick-start)
  - [JavaScript](#javascript-quick-start)
  - [TypeScript](#typescript-quick-start)
  - [Python](#python-quick-start)
  - [Java](#java-quick-start)
- [Configuration](#configuration)
- [Architecture Overview](#architecture-overview)
- [Workflow Details](#workflow-details)
- [Original Source Reference](#original-source-reference)
- [License](#license)

---

## Overview

These tools automate the process of creating and managing Postman partner workspaces. They handle the complete provisioning workflow from workspace creation through asset copying to team/partner management.

### Complete Provisioning Workflow

```
1. Workspace Creation     → Create new partner workspace (or use existing)
2. Copy Collections       → Fork all collections from source workspace
3. Create Mock Servers    → Generate mock servers for each collection
4. Copy Environments      → Duplicate environment configurations
5. Update Mock Env        → Create/update "Mock Env" with mock server URLs
6. Copy API Specs         → Transfer all API specification files
7. Add Team Admins        → Add internal team members as workspace admins
8. Invite Partners        → Send partner invitations with invitation links
```

### Reset Workflow

Deletes workspace resources in reverse dependency order:
1. Delete API Specs
2. Delete Mock Servers
3. Delete Environments
4. Delete Collections

---

## Features

### Complete Workspace Provisioning
- Automated collection forking
- Mock server creation and URL management
- Environment variable handling
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

### Robust Error Handling
- Detailed error logging
- Progress callbacks
- Rate limit management
- Partial failure handling

---

## Available SDKs

| Language | Package | Async Support | Framework Integrations | Documentation |
|----------|---------|---------------|------------------------|---------------|
| **JavaScript** | `@postman/workspace-sdk` | Promises | React, Vue, Angular, Svelte, Node.js | [README](dev-portal/javascript/README.md) |
| **TypeScript** | `@postman/workspace-sdk` | Promises | React, Next.js, Vue, Angular, Svelte | [README](dev-portal/typescript/README.md) |
| **Python** | `postman-workspace-sdk` | async/await | FastAPI, Django, Flask, Streamlit | [README](dev-portal/python/README.md) |
| **Java** | `com.postman:workspace-sdk` | Reactive (Mono/Flux) | Spring Boot, Thymeleaf, Vaadin | [README](dev-portal/java/README.md) |

### SDK Feature Matrix

| Feature | JavaScript | TypeScript | Python | Java |
|---------|------------|------------|--------|------|
| Full Provisioning | ✅ | ✅ | ✅ | ✅ |
| Custom Provisioning | ✅ | ✅ | ✅ | ✅ |
| Full Reset | ✅ | ✅ | ✅ | ✅ |
| Custom Reset | ✅ | ✅ | ✅ | ✅ |
| Partner Invitations | ✅ | ✅ | ✅ | ✅ |
| Admin Management | ✅ | ✅ | ✅ | ✅ |
| Progress Callbacks | ✅ | ✅ | ✅ | ✅ |
| Type Safety | JSDoc | Full | Pydantic | Records |

---

## CLI Version

Command-line tools for interactive workspace management. Best for manual operations and testing.

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd fde-pw-creation-script

# Install dependencies
npm install

# Copy environment template
cp .env-example .env

# Edit .env with your configuration
```

### Usage

```bash
# Provision a workspace
npm run provision

# Reset a workspace
npm run reset

# With flags
node cli/provision.js --yes
node cli/reset.js --yes --workspace-id "workspace-id"
```

See the [CLI documentation](cli/README.md) for detailed usage instructions.

---

## Quick Start

### JavaScript Quick Start

```bash
cd dev-portal/javascript
npm install
```

```javascript
import { PostmanClient, ProvisioningService } from '@postman/workspace-sdk';

const client = new PostmanClient({
  apiKey: process.env.POSTMAN_API_KEY,
});

// Full provisioning
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
cd dev-portal/typescript
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
cd dev-portal/python
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
cd dev-portal/java
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

All SDKs use the same environment variables for configuration:

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
│  │  • ProvisioningService  • ResetService  • WorkspaceService│  │
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
| 3 | Collections | Fork collections (basis for mocks) |
| 4 | Mock Servers | Create for each collection |
| 5 | Environments | Copy with original variables |
| 6 | Mock Environment | Update/create with mock URLs |
| 7 | API Specs | Copy specification files |
| 8 | Admins | Add team members as workspace admins |
| 9 | Partners | Invite partners and generate invitation links |

### Reset Order

The reset follows reverse order to handle dependencies:

| Step | Phase | Reason |
|------|-------|--------|
| 1 | API Specs | No dependencies |
| 2 | Mock Servers | Depend on collections |
| 3 | Environments | Independent |
| 4 | Collections | Deleted last |

### Rate Limiting

All SDKs include automatic delays between API calls:

| Operation | Delay |
|-----------|-------|
| Collections | 300ms |
| Mocks | 300ms |
| Environments | 300ms |
| Specs | 500ms |
| Admins | 300ms |
| Partners | 300ms |

---

## Original Source Reference

The original single-file implementation is preserved in [`postmanService.js`](postmanService.js) for reference and traceability. This file contains all the original API functions before they were modularized into the multi-language SDKs.

### Relationship to SDKs

```
postmanService.js (original)
    │
    ├── dev-portal/javascript/  (ES Module SDK)
    ├── dev-portal/typescript/  (TypeScript SDK with types)
    ├── dev-portal/python/      (Python SDK with Pydantic)
    └── dev-portal/java/        (Java SDK with Spring)
```

---

## Project Structure

```
fde-pw-creation-script/
├── cli/                        # CLI scripts
│   ├── provision.js
│   └── reset.js
├── dev-portal/                 # Multi-language SDKs
│   ├── javascript/             # JavaScript SDK
│   ├── typescript/             # TypeScript SDK
│   ├── python/                 # Python SDK
│   └── java/                   # Java SDK
├── postmanService.js           # Original source (preserved)
├── package.json                # Root package config
└── README.md                   # This file
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
