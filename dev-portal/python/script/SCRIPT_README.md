# Postman Workspace Provisioning Tools — Python

Comprehensive tooling for automated Postman partner workspace provisioning and management. This is a standalone async Python module that can be copied into any Python 3.10+ project.

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [CLI Usage](#cli-usage)
- [Library Usage](#library-usage)
  - [Available Functions](#available-functions)
  - [Provisioning Functions](#provisioning-functions)
  - [Reset Functions](#reset-functions)
  - [Team & Partner Management](#team--partner-management)
  - [Helper Functions](#helper-functions)
- [API Reference](#api-reference)
- [Workflow Details](#workflow-details)
- [Troubleshooting](#troubleshooting)

---

## Overview

This module automates the process of creating and managing Postman partner workspaces. It handles the complete provisioning workflow from workspace creation through asset copying to team/partner management.

### Complete Provisioning Workflow

```
1. Workspace Creation     -> Create new partner workspace (or use existing)
2. Copy Collections       -> Fork all collections from source workspace
3. Create Mock Servers    -> Generate mock servers for each collection
4. Copy Environments      -> Duplicate environment configurations
5. Create Mock Env        -> Create fresh "Mock Env" with mock server URLs
6. Update Collection Vars -> Patch collection host variables to reference mock env
7. Copy API Specs         -> Transfer all API specification files
8. Add Team Admins        -> Add internal team members as workspace admins
9. Invite Partners        -> Send partner invitations with invitation links
```

### Reset Workflow

Deletes workspace resources in reverse dependency order:
1. Delete API Specs
2. Delete Mock Servers
3. Delete Environments
4. Delete Collections

---

## Features

- **Fully async** — all HTTP operations use `httpx.AsyncClient` with `async`/`await`
- **Type-annotated** — dataclasses for results, TypedDict for options, full type hints
- **Complete Workspace Provisioning** — collection forking, mock server creation, environment handling, mock environment creation, collection variable mapping, API spec copying, team member management, partner invitation with "Run in Postman" links
- **Mock Environment Creation** — always creates a fresh "Mock Env" with bare mock server URLs; detects host variables via request URL inspection with fallback to common variable names
- **Collection Variable Mapping** — after creating mock env variables, each forked collection is PATCHed to update its host variables to reference the corresponding mock env variable
- **Custom Selection Provisioning** — choose specific asset types and individual items
- **Safe Reset Functionality** — dependency-aware deletion order, selective deletion
- **Flexible Configuration** — existing or new workspaces, env var config, multiple workspace types
- **Robust Error Handling** — progress callbacks, rate limit management, partial failure handling

---

## Installation

### Option 1: Copy the file

Copy `postman_service.py` into your project and install the dependency:

```bash
pip install httpx
```

### Option 2: Use from this repository

```bash
cd dev-portal/python/script
pip install -r requirements.txt
```

### Environment Configuration

Set environment variables:

```bash
# Required
export POSTMAN_API_KEY=PMAK-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
export POSTMAN_SOURCE_WORKSPACE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Optional
export POSTMAN_TARGET_WORKSPACE_ID=           # Leave empty to create new workspace
export POSTMAN_WORKSPACE_NAME="Partner Workspace"
export POSTMAN_ADMIN_USER_IDS=12345,67890     # Comma-separated user IDs
export PARTNER_EMAILS=partner1@company.com    # Comma-separated emails
export PARTNER_ROLE_ID=7                       # 4=Viewer, 7=Editor and Partner Lead
```

Or use a `.env` file with `python-dotenv`:

```python
from dotenv import load_dotenv
load_dotenv()
```

---

## CLI Usage

### Provisioning a Workspace

```bash
python provision.py

# Skip interactive prompts
python provision.py --yes
```

### Resetting a Workspace

```bash
python reset.py

# Skip confirmation prompt
python reset.py --yes
```

---

## Library Usage

### Import the Module

```python
from postman_service import (
    # Provisioning
    provision_workspace,
    provision_custom_workspace,
    # Reset
    reset_workspace,
    reset_custom_workspace,
    # Workspace
    create_workspace,
    get_workspace,
    delete_workspace,
    # Roles
    add_workspace_admin,
    add_multiple_admins,
    # Partners
    invite_partner,
    invite_multiple_partners,
    remove_partner,
    remove_multiple_partners,
    # Helpers
    validate_api_key,
    get_workspace_summary,
    get_available_collections,
    get_available_resources,
    get_configuration_status,
)
```

---

### Available Functions

| Category | Function | Purpose |
|----------|----------|---------|
| **Provisioning** | `provision_workspace()` | Complete provisioning with all assets |
| **Provisioning** | `provision_custom_workspace()` | Selective provisioning with options |
| **Reset** | `reset_workspace()` | Delete all/selected asset types |
| **Reset** | `reset_custom_workspace()` | Delete specific items |
| **Team** | `add_workspace_admin()` | Add a user as workspace admin |
| **Team** | `add_multiple_admins()` | Batch add multiple admins |
| **Partners** | `invite_partner()` | Invite a partner by email |
| **Partners** | `invite_multiple_partners()` | Batch invite multiple partners |
| **Partners** | `remove_partner()` | Remove partner from workspace |
| **Helper** | `get_available_collections()` | Get collections for UI checklist |
| **Helper** | `get_available_resources()` | Get all resources for UI selection |
| **Helper** | `validate_api_key()` | Validate the configured API key |
| **Helper** | `get_workspace_summary()` | Get workspace content counts |

---

### Provisioning Functions

#### `provision_workspace()` — Full Provisioning

```python
import asyncio
from postman_service import provision_workspace

def on_progress(progress):
    print(f"{progress['phase']}: {progress['message']} ({progress.get('progress', 0)}%)")

async def main():
    results = await provision_workspace(
        options={
            "source_workspace_id": "source-workspace-id",
            "workspace_name": "My Partner Workspace",
            "workspace_type": "partner",
            "admin_user_ids": ["12345", "67890"],
            "partner_emails": ["partner@company.com"],
            "partner_role_id": "7",
        },
        on_progress=on_progress,
    )

    print("Workspace:", results["workspace"])
    print("Collections copied:", results["collections"]["success"])
    print("Invitation links:", results["invitations"]["links"])

asyncio.run(main())
```

#### `provision_custom_workspace()` — Selective Provisioning

```python
import asyncio
from postman_service import provision_custom_workspace

async def main():
    results = await provision_custom_workspace(
        options={
            "source_workspace_id": "source-workspace-id",
            "target_workspace_id": "target-workspace-id",
            "copy_collections": True,
            "copy_environments": True,
            "copy_mocks": True,
            "copy_specs": False,
            "create_mock_env": True,
            "add_admins": True,
            "invite_partners": True,
            "admin_user_ids": ["12345"],
            "partner_emails": ["partner@company.com"],
            "selected_collection_uids": ["uid1", "uid2"],  # None = all
        },
        on_progress=lambda p: print(p["message"]),
    )

asyncio.run(main())
```

---

### Reset Functions

#### `reset_workspace()` — Delete All/Selected Asset Types

```python
import asyncio
from postman_service import reset_workspace

async def main():
    results = await reset_workspace(
        workspace_id="workspace-id",
        on_progress=lambda p: print(f"{p['phase']}: {p.get('deleted', 0)}/{p.get('total', 0)}"),
        options={
            "include_specs": True,
            "include_mocks": True,
            "include_environments": False,
            "include_collections": False,
        },
    )

asyncio.run(main())
```

#### `reset_custom_workspace()` — Delete Specific Items

```python
import asyncio
from postman_service import reset_custom_workspace

async def main():
    results = await reset_custom_workspace(
        workspace_id="workspace-id",
        on_progress=lambda p: print(p),
        options={
            "include_collections": True,
            "selected_collection_uids": ["uid1", "uid2"],
        },
    )

asyncio.run(main())
```

---

### Team & Partner Management

```python
import asyncio
from postman_service import add_workspace_admin, invite_partner, invite_multiple_partners

async def main():
    # Add a single admin
    await add_workspace_admin("workspace-id", "12345678", "3")

    # Invite a single partner
    result = await invite_partner("workspace-id", "partner@company.com", "7")
    print("Invitation Link:", result.invitation_link)

    # Invite multiple partners
    results = await invite_multiple_partners(
        "workspace-id",
        ["partner1@company.com", "partner2@company.com"],
        "7",
        on_progress=lambda p: print(f"Invited {p['current']}/{p['total']}"),
    )

asyncio.run(main())
```

---

### Helper Functions

```python
import asyncio
from postman_service import validate_api_key, get_workspace_summary, get_configuration_status

async def main():
    validation = await validate_api_key()
    print(f"Valid: {validation.valid}, User: {validation.user}")

    summary = await get_workspace_summary("workspace-id")
    print(f"Collections: {summary['counts']['collections']}")

    status = get_configuration_status()
    print(f"Configured: {status.is_configured}")

asyncio.run(main())
```

---

## API Reference

### Progress Callback

All async functions accept an optional `on_progress` callback:

```python
def on_progress(progress: dict):
    progress["phase"]       # 'validation' | 'workspace' | 'collections' | 'mocks' | 'environments' | 'mockEnv' | 'collectionVars' | 'specs' | 'admins' | 'partners' | 'complete' | 'error'
    progress["message"]     # Human-readable status message
    progress["progress"]    # Overall progress percentage (0-100)
    progress["current"]     # Current item number
    progress["total"]       # Total items
    progress["currentItem"] # Name of current item
    progress["deleted"]     # Number deleted (reset operations)
```

### Error Handling

```python
import asyncio
from postman_service import provision_workspace

async def main():
    try:
        results = await provision_workspace(
            options={...},
            on_progress=lambda p: print(p),
        )
        if results["errors"]:
            print("Some operations failed:", results["errors"])
    except Exception as e:
        print(f"Provisioning failed: {e}")

asyncio.run(main())
```

### Framework Integration

#### FastAPI

```python
from fastapi import FastAPI
from postman_service import provision_workspace

app = FastAPI()

@app.post("/provision")
async def provision(source_id: str, name: str):
    return await provision_workspace(
        options={"source_workspace_id": source_id, "workspace_name": name},
    )
```

#### Flask (with asyncio)

```python
import asyncio
from flask import Flask, jsonify
from postman_service import get_workspace

app = Flask(__name__)

@app.route("/workspaces/<workspace_id>")
def workspace(workspace_id):
    result = asyncio.run(get_workspace(workspace_id))
    return jsonify(result)
```

---

## Workflow Details

### Provisioning Order

1. **Validation** — Verify API key and workspaces
2. **Workspace** — Create or verify target workspace
3. **Collections** — Fork collections (basis for mocks)
4. **Mock Servers** — Create for each collection
5. **Environments** — Copy with original variables
6. **Mock Environment** — Create with path-aware mock URLs (variable naming: `{camelCaseCollectionName}{PascalCaseVarName}`, e.g. `directDebitsApiBaseUrl`)
7. **Collection Variables** — PATCH each collection's host variables to reference the corresponding mock env variable (e.g. `HostName` → `{{bankingHubHostName}}`)
8. **API Specs** — Copy specification files
9. **Admins** — Add team members as workspace admins
10. **Partners** — Invite partners and generate invitation links

### Reset Order

1. **API Specs** — No dependencies
2. **Mock Servers** — Depend on collections
3. **Environments** — Independent
4. **Collections** — Deleted last

### Rate Limiting

Automatic delays between API calls: Collections (0.3s), Mocks (0.3s), Environments (0.3s), Specs (0.5s), Admins (0.3s), Partners (0.3s).

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid API key" | Verify key is correct, hasn't expired, and has proper permissions |
| "Workspace not found" | Confirm workspace IDs are correct and accessible |
| "Failed to add admin" | Verify user ID, ensure user is on your Postman team |
| "Failed to invite partner" | Check email format, ensure Partner Workspaces are enabled |
| "Spec files not copying" | Confirm specs exist in source, check supported types (OPENAPI:3.0, OPENAPI:3.1, ASYNCAPI:2.0) |
| `ModuleNotFoundError: httpx` | Install httpx: `pip install httpx` |
| `SyntaxError` on type hints | Requires Python 3.10+. Check `python --version` |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTMAN_API_KEY` | Yes | Your Postman API key |
| `POSTMAN_SOURCE_WORKSPACE_ID` | Yes | Source workspace to copy from |
| `POSTMAN_TARGET_WORKSPACE_ID` | No | Target workspace (creates new if empty) |
| `POSTMAN_WORKSPACE_NAME` | No | Name for new workspace (default: "Partner Workspace") |
| `POSTMAN_ADMIN_USER_IDS` | No | Comma-separated user IDs for admins |
| `PARTNER_EMAILS` | No | Comma-separated partner emails |
| `PARTNER_ROLE_ID` | No | Partner role ID (default: "7") |
