# Dev Portal — Postman Workspace Provisioning

Multi-language tools for integrating Postman workspace provisioning into your applications. Each language offers two approaches: a **standalone script** for quick drag-and-drop usage, and a **modular SDK** for full application integration.

## Table of Contents

- [Overview](#overview)
- [Scripts vs SDKs](#scripts-vs-sdks)
- [Available Languages](#available-languages)
- [Directory Structure](#directory-structure)
- [Quick Navigation](#quick-navigation)
- [Getting Started](#getting-started)
- [Configuration](#configuration)

---

## Overview

The dev-portal provides Postman workspace provisioning tools in four languages. For each language, there are two options:

- **Standalone Scripts (`script/`)** — A single self-contained file per language that exports all provisioning functions. Copy the file into your project, install the one or two required dependencies, and start calling functions. No build step, no package management, no SDK installation. Ideal for prototyping, internal tools, or projects where you want minimal overhead.

- **Modular SDKs (`sdk/`)** — A properly structured package with separate modules for the HTTP client, service layer, and type definitions. Install as a dependency (or use one of the local integration methods documented in each SDK_INTEGRATION.md). Ideal for production applications, teams that value clean architecture, and projects that benefit from tree-shaking and type safety.

Both approaches expose the same core functionality: full provisioning (including mock URL path resolution and collection variable mapping), custom provisioning, full reset, custom reset, admin management, and partner invitations.

---

## Scripts vs SDKs

| Consideration | Standalone Script | Modular SDK |
|---------------|-------------------|-------------|
| **Setup time** | Copy one file + install deps | Install package or link locally |
| **Dependencies** | 1-2 (HTTP client + env loader) | Managed via package manifest |
| **Build step** | None | Required (produces dist/) |
| **Type safety** | Partial (JSDoc / type hints) | Full (interfaces, Pydantic, records) |
| **Architecture** | Single file, flat exports | Layered (client → services → types) |
| **Tree-shaking** | Not applicable | Supported (ESM/CJS outputs) |
| **Best for** | Prototyping, internal tools, scripts | Production apps, team projects, CI/CD |
| **Update path** | Re-copy the file | Bump version, re-install |

---

## Available Languages

| Language | Script | Script Docs | SDK | SDK Docs | Integration Guide |
|----------|--------|-------------|-----|----------|-------------------|
| **JavaScript** | [`postmanService.js`](javascript/script/postmanService.js) | [SCRIPT_README](javascript/script/SCRIPT_README.md) | `@postman/workspace-sdk` | [README](javascript/sdk/README.md) | [SDK_INTEGRATION](javascript/sdk/SDK_INTEGRATION.md) |
| **TypeScript** | [`postmanService.ts`](typescript/script/postmanService.ts) | [SCRIPT_README](typescript/script/SCRIPT_README.md) | `@postman/workspace-sdk` | [README](typescript/sdk/README.md) | [SDK_INTEGRATION](typescript/sdk/SDK_INTEGRATION.md) |
| **Python** | [`postman_service.py`](python/script/postman_service.py) | [SCRIPT_README](python/script/SCRIPT_README.md) | `postman-workspace-sdk` | [README](python/sdk/README.md) | [SDK_INTEGRATION](python/sdk/SDK_INTEGRATION.md) |
| **Java** | [`PostmanService.java`](java/script/PostmanService.java) | [SCRIPT_README](java/script/SCRIPT_README.md) | `com.postman:workspace-sdk` | [README](java/sdk/README.md) | [SDK_INTEGRATION](java/sdk/SDK_INTEGRATION.md) |

### Feature Parity

All languages support the same core features across both scripts and SDKs:

| Feature | JS | TS | Python | Java |
|---------|----|----|--------|------|
| Full Provisioning | ✅ | ✅ | ✅ | ✅ |
| Custom Provisioning | ✅ | ✅ | ✅ | ✅ |
| Mock URL Path Resolution | ✅ | ✅ | ✅ | ✅ |
| Collection Variable Mapping | ✅ | ✅ | ✅ | ✅ |
| Full Reset | ✅ | ✅ | ✅ | ✅ |
| Custom Reset | ✅ | ✅ | ✅ | ✅ |
| Partner Invitations | ✅ | ✅ | ✅ | ✅ |
| Admin Management | ✅ | ✅ | ✅ | ✅ |
| Progress Callbacks | ✅ | ✅ | ✅ | ✅ |

### Language-Specific Details

| Language | HTTP Client | Async Model | Build Tool | Type System |
|----------|-------------|-------------|------------|-------------|
| **JavaScript** | axios | Promises | Rollup | JSDoc |
| **TypeScript** | axios | Promises | tsup | Full interfaces |
| **Python** | httpx | async/await | Hatchling | Pydantic + dataclasses |
| **Java** | Spring WebClient | Reactive (Mono/Flux) | Maven | Records + Lombok |

---

## Directory Structure

Each language follows a consistent layout with `script/` and `sdk/` subdirectories:

```
dev-portal/
├── README.md                         ← You are here
├── javascript/
│   ├── script/
│   │   ├── SCRIPT_README.md          # Usage guide for the standalone script
│   │   └── postmanService.js         # Single-file provisioning module
│   └── sdk/
│       ├── README.md                 # Full SDK documentation
│       ├── SDK_INTEGRATION.md        # 5 methods to integrate the SDK
│       ├── package.json
│       ├── jsconfig.json
│       ├── rollup.config.js
│       └── src/                      # SDK source (client, helpers, services)
├── typescript/
│   ├── script/
│   │   ├── SCRIPT_README.md
│   │   ├── postmanService.ts
│   │   └── tsconfig.json
│   └── sdk/
│       ├── README.md
│       ├── SDK_INTEGRATION.md
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsup.config.ts
│       └── src/                      # SDK source (client, services, types)
├── python/
│   ├── script/
│   │   ├── SCRIPT_README.md
│   │   ├── postman_service.py
│   │   └── requirements.txt
│   └── sdk/
│       ├── README.md
│       ├── SDK_INTEGRATION.md
│       ├── pyproject.toml
│       ├── requirements.txt
│       └── postman_sdk/              # SDK package (client, services, types)
└── java/
    ├── script/
    │   ├── SCRIPT_README.md
    │   └── PostmanService.java
    └── sdk/
        ├── README.md
        ├── SDK_INTEGRATION.md
        ├── pom.xml
        └── src/                      # SDK source (client, config, services, types)
```

---

## Quick Navigation

### Scripts (drag-and-drop)

| Language | File | Docs |
|----------|------|------|
| JavaScript | [postmanService.js](javascript/script/postmanService.js) | [SCRIPT_README](javascript/script/SCRIPT_README.md) |
| TypeScript | [postmanService.ts](typescript/script/postmanService.ts) | [SCRIPT_README](typescript/script/SCRIPT_README.md) |
| Python | [postman_service.py](python/script/postman_service.py) | [SCRIPT_README](python/script/SCRIPT_README.md) |
| Java | [PostmanService.java](java/script/PostmanService.java) | [SCRIPT_README](java/script/SCRIPT_README.md) |

### SDKs (modular packages)

| Language | Docs | Integration Guide |
|----------|------|-------------------|
| JavaScript | [README](javascript/sdk/README.md) | [SDK_INTEGRATION](javascript/sdk/SDK_INTEGRATION.md) |
| TypeScript | [README](typescript/sdk/README.md) | [SDK_INTEGRATION](typescript/sdk/SDK_INTEGRATION.md) |
| Python | [README](python/sdk/README.md) | [SDK_INTEGRATION](python/sdk/SDK_INTEGRATION.md) |
| Java | [README](java/sdk/README.md) | [SDK_INTEGRATION](java/sdk/SDK_INTEGRATION.md) |

---

## Getting Started

### Using a Standalone Script

1. Choose your language from the table above
2. Copy the script file into your project
3. Install the required dependency (e.g., `npm install axios` for JS/TS, `pip install httpx` for Python)
4. Set environment variables (`POSTMAN_API_KEY`, `POSTMAN_SOURCE_WORKSPACE_ID`)
5. Import and call the functions you need

### Using an SDK

1. Choose your language from the table above
2. Follow the [SDK_INTEGRATION.md](javascript/sdk/SDK_INTEGRATION.md) guide for your language (5 integration methods available)
3. Import the client and services into your application
4. Configure with environment variables or constructor parameters

---

## Configuration

All scripts and SDKs use the same environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTMAN_API_KEY` | Yes | Your Postman API key |
| `POSTMAN_SOURCE_WORKSPACE_ID` | Yes | Source workspace to copy from |
| `POSTMAN_TARGET_WORKSPACE_ID` | No | Target workspace (creates new if empty) |
| `POSTMAN_WORKSPACE_NAME` | No | Name for new workspace |
| `POSTMAN_ADMIN_USER_IDS` | No | Comma-separated admin user IDs |
| `PARTNER_EMAILS` | No | Comma-separated partner emails |
| `PARTNER_ROLE_ID` | No | Partner role ID (default: "7") |

---

## Related Documentation

- [Main README](../README.md) — Project overview covering CLI, scripts, and SDKs
- [CLI Documentation](../cli/README.md) — Interactive command-line provisioning and reset tools
