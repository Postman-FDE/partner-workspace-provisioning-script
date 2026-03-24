# Postman SDK for Python

A fully-typed Python SDK for the Postman API with async/await support, Pydantic models, and high-level services for workspace provisioning and reset workflows.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Available Functions](#available-functions)
- [Provisioning Functions](#provisioning-functions)
  - [ProvisioningService.provision()](#provisioningserviceprovision---full-provisioning)
  - [ProvisioningService.provision_custom()](#provisioningserviceprovision_custom---selective-provisioning)
- [Reset Functions](#reset-functions)
  - [ResetService.reset()](#resetservicereset---delete-all-or-selected)
  - [ResetService.reset_custom()](#resetservicereset_custom---delete-specific-items)
- [Team & Partner Management](#team--partner-management)
- [Helper Functions](#helper-functions)
- [FastAPI Integration Examples](#fastapi-integration-examples)
  - [Provision Workspace Endpoint](#provision-workspace-endpoint-with-partner-links)
  - [Collection Selector API](#collection-selector-api)
- [Django Integration](#django-integration)
- [Flask Integration](#flask-integration)
- [Streamlit Dashboard](#streamlit-dashboard)
- [API Reference](#api-reference)
- [Workflow Details](#workflow-details)
- [Troubleshooting](#troubleshooting)

---

## Installation

```bash
pip install postman-workspace-sdk
# or
poetry add postman-workspace-sdk
# or
uv add postman-workspace-sdk
```

## Quick Start

```python
import asyncio
from postman_sdk import PostmanClient, ProvisioningService

async def main():
    async with PostmanClient(api_key="your-api-key") as client:
        # Validate API key
        result = await client.validate_api_key()
        print(f"Authenticated as: {result['user'].username}")

        # Get workspace
        workspace = await client.get_workspace("workspace-id")
        print(f"Workspace: {workspace.name}")

asyncio.run(main())
```

## Features

- Full async/await support with httpx
- Pydantic v2 models for all API entities
- Type hints throughout
- High-level services for provisioning and reset workflows
- Mock URL path resolution — extracts URL paths from collection host variables and appends them to mock server URLs
- Collection variable mapping — patches forked collections to reference mock environment variables
- Automatic retry with exponential backoff
- Context manager support

---

## Available Functions

### Function Overview

| Category | Function/Method | Purpose |
|----------|-----------------|---------|
| **Provisioning** | `ProvisioningService.provision()` | Complete provisioning with all assets |
| **Provisioning** | `ProvisioningService.provision_custom()` | Selective provisioning with options |
| **Reset** | `ResetService.reset()` | Delete all/selected asset types |
| **Reset** | `ResetService.reset_custom()` | Delete specific items |
| **Workspace** | `WorkspaceService.get_workspace()` | Get workspace details |
| **Workspace** | `WorkspaceService.create_workspace()` | Create new workspace |
| **Workspace** | `WorkspaceService.initialize_target_workspace()` | Create or verify workspace |
| **Workspace** | `WorkspaceService.get_workspace_summary()` | Get workspace with counts |
| **Team** | `WorkspaceService.add_admin()` | Add a user as workspace admin |
| **Team** | `WorkspaceService.add_multiple_admins()` | Batch add multiple admins |
| **Team** | `client.get_workspace_roles()` | Get workspace roles |
| **Partners** | `client.invite_partner()` | Invite a partner by email |
| **Partners** | `client.remove_partner()` | Remove partner from workspace |
| **Collections** | `client.get_collections()` | Get all collections |
| **Collections** | `client.fork_collection()` | Fork a collection |
| **Collections** | `client.patch_collection_variables()` | Update collection variables |
| **Collections** | `client.delete_collection()` | Delete a collection |
| **Environments** | `client.get_environments()` | Get all environments |
| **Environments** | `client.create_environment()` | Create environment |
| **Environments** | `client.update_environment()` | Update environment |
| **Mocks** | `client.get_mocks()` | Get all mock servers |
| **Mocks** | `client.create_mock()` | Create mock server |
| **Specs** | `client.get_specs()` | Get all specs |
| **Specs** | `client.create_spec()` | Create spec |
| **Helper** | `client.validate_api_key()` | Validate API key |

---

## Provisioning Functions

### `ProvisioningService.provision()` - Full Provisioning

Copies all collections, creates mocks, copies environments, creates a mock environment with path-resolved mock URLs, patches collection variables to reference the mock environment, copies specs, adds admins, and invites partners.

```python
import asyncio
from postman_sdk import PostmanClient, ProvisioningService
from postman_sdk.types import ProvisioningOptions, ProgressEvent

async def provision_workspace():
    async with PostmanClient(api_key="your-api-key") as client:
        provisioner = ProvisioningService(client)
        
        options = ProvisioningOptions(
            source_workspace_id="source-workspace-id",
            workspace_name="My Partner Workspace",
            workspace_type="partner",
            admin_user_ids=["12345", "67890"],
            partner_emails=["partner@company.com"],
            partner_role_id="7",
        )
        
        def on_progress(event: ProgressEvent):
            print(f"{event.phase}: {event.message}")
            print(f"Progress: {event.progress}%")
        
        result = await provisioner.provision(options, on_progress)
        
        # Access results
        print(f"Workspace: {result.workspace.name}")
        print(f"Collections copied: {result.collections.success}")
        print(f"Mock URLs: {result.mocks.urls}")
        print(f"Invitation links: {result.invitations.links}")

asyncio.run(provision_workspace())
```

**Options Dataclass:**

```python
from dataclasses import dataclass
from typing import List, Optional

@dataclass
class ProvisioningOptions:
    source_workspace_id: str
    target_workspace_id: Optional[str] = None
    workspace_name: Optional[str] = None
    workspace_type: str = "partner"  # "partner" | "team" | "private"
    admin_user_ids: Optional[List[str]] = None
    partner_emails: Optional[List[str]] = None
    partner_role_id: str = "7"
```

**Result Model:**

```python
from pydantic import BaseModel
from typing import List, Dict, Optional

class ProvisioningResult(BaseModel):
    workspace: Workspace
    workspace_created: bool
    collections: ResourceResult
    mocks: MockResult
    environments: ResourceResult
    mock_env: MockEnvResult
    collection_variables: ResourceResult
    specs: ResourceResult
    admins: ResourceResult
    invitations: InvitationsResult
    errors: List[str]

class InvitationsResult(BaseModel):
    total: int
    success: int
    failed: List[FailedItem]
    links: List[InvitationLink]  # Partner invitation links

class InvitationLink(BaseModel):
    email: str
    link: str
```

### `ProvisioningService.provision_custom()` - Selective Provisioning

Choose which asset types and specific items to copy.

```python
import asyncio
from postman_sdk import PostmanClient, ProvisioningService
from postman_sdk.types import CustomProvisioningOptions

async def provision_custom():
    async with PostmanClient(api_key="your-api-key") as client:
        provisioner = ProvisioningService(client)
        
        options = CustomProvisioningOptions(
            source_workspace_id="source-workspace-id",
            target_workspace_id="target-workspace-id",
            
            # Asset type toggles
            copy_collections=True,
            copy_environments=True,
            copy_mocks=True,
            copy_specs=False,  # Skip specs
            create_mock_env=True,
            
            # Team & partner toggles
            add_admins=True,
            invite_partners=True,
            admin_user_ids=["12345"],
            partner_emails=["partner@company.com"],
            
            # Specific items to copy (None = all)
            selected_collection_uids=["uid1", "uid2"],
            selected_environment_uids=None,
            selected_spec_ids=None,
        )
        
        result = await provisioner.provision_custom(
            options,
            lambda p: print(p.message)
        )
        
        return result

asyncio.run(provision_custom())
```

---

## Reset Functions

### `ResetService.reset()` - Delete All or Selected

```python
import asyncio
from postman_sdk import PostmanClient, ResetService
from postman_sdk.types import ResetOptions

async def reset_workspace():
    async with PostmanClient(api_key="your-api-key") as client:
        resetter = ResetService(client)
        
        # Delete ALL resources
        result = await resetter.reset(
            "workspace-id",
            lambda p: print(f"{p.phase}: {p.deleted}/{p.total}")
        )
        
        print(f"Deleted {result.collections.deleted} collections")

async def partial_reset():
    async with PostmanClient(api_key="your-api-key") as client:
        resetter = ResetService(client)
        
        # Partial reset - keep collections and environments
        options = ResetOptions(
            include_specs=True,
            include_mocks=True,
            include_environments=False,  # Keep
            include_collections=False,   # Keep
        )
        
        result = await resetter.reset("workspace-id", print, options)
        return result

asyncio.run(reset_workspace())
```

### `ResetService.reset_custom()` - Delete Specific Items

```python
import asyncio
from postman_sdk import PostmanClient, ResetService
from postman_sdk.types import CustomResetOptions

async def reset_specific_collections():
    async with PostmanClient(api_key="your-api-key") as client:
        resetter = ResetService(client)
        
        # Get collections and select specific ones to delete
        collections = await client.get_collections("workspace-id")
        to_delete = [c.uid for c in collections if "Test" in c.name]
        
        options = CustomResetOptions(
            include_collections=True,
            selected_collection_uids=to_delete,
            include_environments=False,
            include_mocks=False,
            include_specs=False,
        )
        
        result = await resetter.reset_custom("workspace-id", print, options)
        print(f"Deleted {result.collections.deleted} test collections")

asyncio.run(reset_specific_collections())
```

---

## Team & Partner Management

### Adding Workspace Admins

```python
import asyncio
from postman_sdk import PostmanClient, WorkspaceService

async def manage_admins():
    async with PostmanClient(api_key="your-api-key") as client:
        workspace_service = WorkspaceService(client)
        
        # Add a single admin
        result = await workspace_service.add_admin("workspace-id", "12345678")
        if result.success:
            print(f"Admin added: {result.user_id}")
        
        # Add multiple admins with progress
        results = await workspace_service.add_multiple_admins(
            "workspace-id",
            ["12345", "67890", "11111"],
            lambda p: print(f"Added {p.current}/{p.total}")
        )
        
        print(f"Successful: {len(results.success)}")
        print(f"Failed: {results.failed}")

asyncio.run(manage_admins())
```

### Inviting Partners

```python
import asyncio
from postman_sdk import PostmanClient

async def invite_partners():
    async with PostmanClient(api_key="your-api-key") as client:
        # Invite a single partner
        result = await client.invite_partner(
            "workspace-id",
            "partner@company.com",
            "7"  # Role ID (7 = Editor and Partner Lead)
        )
        
        if result.success:
            print("Invitation sent!")
            print(f"Status: {result.status}")
            print(f"Invitation Link: {result.invitation_link}")  # Share this!

asyncio.run(invite_partners())
```

---

## Helper Functions

### Get Available Resources for UI

```python
import asyncio
from postman_sdk import PostmanClient

async def get_resources():
    async with PostmanClient(api_key="your-api-key") as client:
        workspace_id = "workspace-id"
        
        # Get all resources
        collections = await client.get_collections(workspace_id)
        environments = await client.get_environments(workspace_id)
        mocks = await client.get_mocks(workspace_id)
        specs = await client.get_specs(workspace_id)
        
        # Format for UI
        return {
            "collections": [
                {"id": c.id, "uid": c.uid, "name": c.name, "selected": False}
                for c in collections
            ],
            "environments": [
                {"id": e.id, "uid": e.uid, "name": e.name, "selected": False}
                for e in environments
            ],
            "mocks": [
                {"id": m.id, "name": m.name, "mock_url": m.mock_url, "selected": False}
                for m in mocks
            ],
            "specs": [
                {"id": s.id, "name": s.name, "type": s.type, "selected": False}
                for s in specs
            ],
        }

asyncio.run(get_resources())
```

---

## FastAPI Integration Examples

### Provision Workspace Endpoint with Partner Links

```python
# app/routers/workspaces.py
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
from postman_sdk import PostmanClient, ProvisioningService
from postman_sdk.types import ProvisioningOptions
import os

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])

class ProvisionRequest(BaseModel):
    source_workspace_id: str
    workspace_name: str
    workspace_type: str = "partner"
    admin_user_ids: Optional[List[str]] = None
    partner_emails: Optional[List[str]] = None

class ProvisionResponse(BaseModel):
    workspace_id: str
    workspace_name: str
    collections_copied: int
    mocks_created: int
    partners_invited: int
    invitation_links: List[dict]
    mock_urls: dict

def get_client():
    return PostmanClient(api_key=os.environ["POSTMAN_API_KEY"])

@router.post("/provision", response_model=ProvisionResponse)
async def provision_workspace(request: ProvisionRequest):
    """Provision a new partner workspace with all assets"""
    async with get_client() as client:
        provisioner = ProvisioningService(client)
        
        options = ProvisioningOptions(
            source_workspace_id=request.source_workspace_id,
            workspace_name=request.workspace_name,
            workspace_type=request.workspace_type,
            admin_user_ids=request.admin_user_ids,
            partner_emails=request.partner_emails,
        )
        
        result = await provisioner.provision(options)
        
        if result.errors:
            raise HTTPException(status_code=500, detail=result.errors)
        
        return ProvisionResponse(
            workspace_id=result.workspace.id,
            workspace_name=result.workspace.name,
            collections_copied=result.collections.success,
            mocks_created=result.mocks.success,
            partners_invited=result.invitations.success,
            invitation_links=[
                {"email": link.email, "link": link.link}
                for link in result.invitations.links
            ],
            mock_urls=result.mocks.urls,
        )

@router.get("/{workspace_id}/collections")
async def get_collections(workspace_id: str):
    """Get all collections in a workspace for UI selection"""
    async with get_client() as client:
        collections = await client.get_collections(workspace_id)
        return [
            {
                "id": c.id,
                "uid": c.uid,
                "name": c.name,
                "selected": False,
            }
            for c in collections
        ]

@router.get("/{workspace_id}/summary")
async def get_workspace_summary(workspace_id: str):
    """Get workspace summary with resource counts"""
    async with get_client() as client:
        workspace = await client.get_workspace(workspace_id)
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace not found")
        
        collections = await client.get_collections(workspace_id)
        environments = await client.get_environments(workspace_id)
        mocks = await client.get_mocks(workspace_id)
        specs = await client.get_specs(workspace_id)
        
        return {
            "workspace": {
                "id": workspace.id,
                "name": workspace.name,
                "type": workspace.type,
            },
            "counts": {
                "collections": len(collections),
                "environments": len(environments),
                "mocks": len(mocks),
                "specs": len(specs),
            },
        }
```

### Collection Selector API

```python
# app/routers/provisioning.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from postman_sdk import PostmanClient, ProvisioningService
from postman_sdk.types import CustomProvisioningOptions
import os

router = APIRouter(prefix="/api/provision", tags=["provisioning"])

class CustomProvisionRequest(BaseModel):
    source_workspace_id: str
    target_workspace_id: Optional[str] = None
    workspace_name: Optional[str] = None
    copy_collections: bool = True
    copy_environments: bool = True
    copy_mocks: bool = True
    copy_specs: bool = True
    selected_collection_uids: Optional[List[str]] = None
    selected_environment_uids: Optional[List[str]] = None
    selected_spec_ids: Optional[List[str]] = None

@router.post("/custom")
async def provision_custom(request: CustomProvisionRequest):
    """Provision with custom selection of assets"""
    async with PostmanClient(api_key=os.environ["POSTMAN_API_KEY"]) as client:
        provisioner = ProvisioningService(client)
        
        options = CustomProvisioningOptions(
            source_workspace_id=request.source_workspace_id,
            target_workspace_id=request.target_workspace_id,
            workspace_name=request.workspace_name,
            copy_collections=request.copy_collections,
            copy_environments=request.copy_environments,
            copy_mocks=request.copy_mocks,
            copy_specs=request.copy_specs,
            create_mock_env=request.copy_mocks,
            add_admins=False,
            invite_partners=False,
            selected_collection_uids=request.selected_collection_uids,
            selected_environment_uids=request.selected_environment_uids,
            selected_spec_ids=request.selected_spec_ids,
        )
        
        result = await provisioner.provision_custom(options)
        
        return {
            "workspace": {
                "id": result.workspace.id,
                "name": result.workspace.name,
            },
            "results": {
                "collections": {
                    "total": result.collections.total,
                    "success": result.collections.success,
                },
                "mocks": {
                    "total": result.mocks.total,
                    "success": result.mocks.success,
                    "urls": result.mocks.urls,
                },
                "environments": {
                    "total": result.environments.total,
                    "success": result.environments.success,
                },
                "specs": {
                    "total": result.specs.total,
                    "success": result.specs.success,
                },
            },
        }
```

---

## Django Integration

### Django Views with HTMX

```python
# views.py
import asyncio
from django.http import JsonResponse, HttpResponse
from django.views.decorators.http import require_http_methods
from django.shortcuts import render
from postman_sdk import PostmanClient, ProvisioningService
from postman_sdk.types import ProvisioningOptions
from django.conf import settings

def get_client():
    return PostmanClient(api_key=settings.POSTMAN_API_KEY)

@require_http_methods(["GET"])
def workspace_detail(request, workspace_id):
    async def fetch():
        async with get_client() as client:
            workspace = await client.get_workspace(workspace_id)
            collections = await client.get_collections(workspace_id)
            return workspace, collections

    workspace, collections = asyncio.run(fetch())
    
    if request.headers.get('HX-Request'):
        return render(request, 'partials/workspace_detail.html', {
            'workspace': workspace,
            'collections': collections,
        })
    
    return render(request, 'workspace_detail.html', {
        'workspace': workspace,
        'collections': collections,
    })

@require_http_methods(["POST"])
def provision_workspace(request):
    source_id = request.POST.get('source_workspace_id')
    target_name = request.POST.get('target_name')
    partner_emails = request.POST.get('partner_emails', '').split(',')
    partner_emails = [e.strip() for e in partner_emails if e.strip()]

    async def do_provision():
        async with get_client() as client:
            provisioner = ProvisioningService(client)
            options = ProvisioningOptions(
                source_workspace_id=source_id,
                workspace_name=target_name,
                partner_emails=partner_emails if partner_emails else None,
            )
            return await provisioner.provision(options)

    result = asyncio.run(do_provision())
    
    if request.headers.get('HX-Request'):
        return render(request, 'partials/provision_result.html', {
            'result': result,
            'invitation_links': result.invitations.links,
        })
    
    return JsonResponse({
        'workspace_id': result.workspace.id,
        'workspace_name': result.workspace.name,
        'invitation_links': [
            {'email': l.email, 'link': l.link}
            for l in result.invitations.links
        ],
    })
```

### HTMX Template

```html
<!-- templates/workspace_detail.html -->
{% extends "base.html" %}

{% block content %}
<div id="workspace-content">
  <h1>{{ workspace.name }}</h1>
  <p>Type: {{ workspace.type }}</p>
  
  <h2>Collections ({{ collections|length }})</h2>
  <ul id="collections-list">
    {% for collection in collections %}
    <li>
      <input type="checkbox" name="collection_uids" value="{{ collection.uid }}">
      {{ collection.name }}
    </li>
    {% endfor %}
  </ul>
  
  <button 
    hx-get="/workspaces/{{ workspace.id }}/refresh"
    hx-target="#collections-list"
    hx-swap="outerHTML"
  >
    Refresh Collections
  </button>
</div>

<h2>Provision New Workspace</h2>
<form 
  hx-post="/workspaces/provision"
  hx-target="#provision-result"
  hx-swap="innerHTML"
>
  <input type="hidden" name="source_workspace_id" value="{{ workspace.id }}">
  
  <label>
    Workspace Name:
    <input type="text" name="target_name" placeholder="Partner Workspace" required>
  </label>
  
  <label>
    Partner Emails (comma-separated):
    <input type="text" name="partner_emails" placeholder="partner@company.com">
  </label>
  
  <button type="submit">Provision</button>
</form>

<div id="provision-result"></div>
{% endblock %}

<!-- templates/partials/provision_result.html -->
<div class="provision-result">
  <h3>Provisioning Complete!</h3>
  <p>Workspace: {{ result.workspace.name }}</p>
  <p>Collections: {{ result.collections.success }}/{{ result.collections.total }}</p>
  <p>Mocks: {{ result.mocks.success }}/{{ result.mocks.total }}</p>
  
  {% if invitation_links %}
  <h4>Partner Invitation Links</h4>
  <ul>
    {% for invite in invitation_links %}
    <li>
      <strong>{{ invite.email }}:</strong>
      <a href="{{ invite.link }}" target="_blank">{{ invite.link }}</a>
    </li>
    {% endfor %}
  </ul>
  {% endif %}
</div>
```

---

## Flask Integration

```python
# app.py
import asyncio
from flask import Flask, jsonify, request
from flask_cors import CORS
from postman_sdk import PostmanClient, ProvisioningService
from postman_sdk.types import ProvisioningOptions
import os

app = Flask(__name__)
CORS(app)

def get_client():
    return PostmanClient(api_key=os.environ['POSTMAN_API_KEY'])

def run_async(coro):
    return asyncio.run(coro)

@app.route('/api/workspaces/<workspace_id>')
def get_workspace(workspace_id):
    async def fetch():
        async with get_client() as client:
            return await client.get_workspace(workspace_id)
    
    workspace = run_async(fetch())
    if not workspace:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(workspace.model_dump())

@app.route('/api/workspaces/<workspace_id>/collections')
def get_collections(workspace_id):
    async def fetch():
        async with get_client() as client:
            return await client.get_collections(workspace_id)
    
    collections = run_async(fetch())
    return jsonify([c.model_dump() for c in collections])

@app.route('/api/provision', methods=['POST'])
def provision():
    data = request.json
    
    async def do_provision():
        async with get_client() as client:
            provisioner = ProvisioningService(client)
            options = ProvisioningOptions(
                source_workspace_id=data['source_workspace_id'],
                workspace_name=data.get('workspace_name', 'Partner Workspace'),
                partner_emails=data.get('partner_emails'),
            )
            return await provisioner.provision(options)
    
    result = run_async(do_provision())
    return jsonify({
        'workspace': result.workspace.model_dump(),
        'collections': result.collections.success,
        'mocks': result.mocks.success,
        'invitation_links': [
            {'email': l.email, 'link': l.link}
            for l in result.invitations.links
        ],
    })

if __name__ == '__main__':
    app.run(debug=True)
```

---

## Streamlit Dashboard

```python
# dashboard.py
import streamlit as st
import asyncio
from postman_sdk import PostmanClient, ProvisioningService, ResetService
from postman_sdk.types import ProvisioningOptions

st.set_page_config(page_title="Postman Workspace Manager", layout="wide")

@st.cache_resource
def get_client():
    api_key = st.secrets.get("POSTMAN_API_KEY", "")
    return PostmanClient(api_key=api_key)

def run_async(coro):
    return asyncio.run(coro)

st.title("Postman Workspace Manager")

# Sidebar
st.sidebar.header("Configuration")
workspace_id = st.sidebar.text_input("Workspace ID")

if workspace_id:
    client = get_client()
    
    # Fetch workspace info
    async def get_workspace_info():
        async with client as c:
            workspace = await c.get_workspace(workspace_id)
            collections = await c.get_collections(workspace_id)
            environments = await c.get_environments(workspace_id)
            mocks = await c.get_mocks(workspace_id)
            specs = await c.get_specs(workspace_id)
            return workspace, collections, environments, mocks, specs
    
    workspace, collections, environments, mocks, specs = run_async(get_workspace_info())
    
    if workspace:
        st.header(f"Workspace: {workspace.name}")
        
        # Metrics
        col1, col2, col3, col4 = st.columns(4)
        col1.metric("Collections", len(collections))
        col2.metric("Environments", len(environments))
        col3.metric("Mocks", len(mocks))
        col4.metric("Specs", len(specs))
        
        # Collections table
        st.subheader("Collections")
        st.table([{"Name": c.name, "UID": c.uid} for c in collections])
        
        # Provisioning form
        st.subheader("Provision New Workspace")
        with st.form("provision_form"):
            target_name = st.text_input("New Workspace Name")
            partner_emails = st.text_input("Partner Emails (comma-separated)")
            submitted = st.form_submit_button("Provision")
            
            if submitted and target_name:
                async def do_provision():
                    async with client as c:
                        provisioner = ProvisioningService(c)
                        emails = [e.strip() for e in partner_emails.split(',') if e.strip()]
                        options = ProvisioningOptions(
                            source_workspace_id=workspace_id,
                            workspace_name=target_name,
                            partner_emails=emails if emails else None,
                        )
                        return await provisioner.provision(options)
                
                with st.spinner("Provisioning..."):
                    result = run_async(do_provision())
                
                st.success(f"Created workspace: {result.workspace.name}")
                
                if result.invitations.links:
                    st.subheader("Partner Invitation Links")
                    for link in result.invitations.links:
                        st.write(f"**{link.email}:** {link.link}")
    else:
        st.error("Workspace not found")
```

---

## API Reference

### PostmanClient

Main SDK client with all API methods.

```python
async with PostmanClient(
    api_key="your-api-key",
    base_url="https://api.getpostman.com",  # optional
    timeout=30,  # optional
) as client:
    # Use client
    pass
```

**Methods:**

| Method | Return Type | Description |
|--------|-------------|-------------|
| `validate_api_key()` | `ApiResponse[User]` | Validate API key |
| `get_workspace(id)` | `Workspace \| None` | Get workspace details |
| `create_workspace(name, type, desc)` | `ApiResponse[Workspace]` | Create workspace |
| `get_collections(workspace_id)` | `List[Collection]` | Get all collections |
| `fork_collection(uid, label, target_id)` | `ApiResponse[Collection]` | Fork a collection |
| `delete_collection(uid)` | `bool` | Delete collection |
| `get_environments(workspace_id)` | `List[Environment]` | Get all environments |
| `create_environment(name, values, ws_id)` | `ApiResponse[Environment]` | Create environment |
| `get_mocks(workspace_id)` | `List[MockServer]` | Get all mock servers |
| `create_mock(name, collection_uid, ws_id)` | `ApiResponse[MockServer]` | Create mock server |
| `get_specs(workspace_id)` | `List[Spec]` | Get all specs |
| `create_spec(ws_id, name, type, files)` | `ApiResponse[Spec]` | Create spec |
| `patch_collection_variables(collection_uid, variables)` | `ApiResponse` | Update collection variables |
| `invite_partner(ws_id, email, role_id)` | `InvitationResult` | Invite partner |

---

## Workflow Details

### Provisioning Order

| Step | Phase | Description |
|------|-------|-------------|
| 1 | Validation | Verify API key and workspaces |
| 2 | Workspace | Create or verify target workspace |
| 3 | Collections | Fork collections (basis for mocks) |
| 4 | Mock Servers | Create for each collection |
| 5 | Environments | Copy with original variables |
| 6 | Mock Environment | Create/update env with path-resolved mock URLs (e.g., `direct_debits_api_base_url`) |
| 7 | Update Collection Variables | Patch forked collections to reference mock env variables |
| 8 | API Specs | Copy specification files |
| 9 | Admins | Add team members as workspace admins |
| 10 | Partners | Invite partners and generate invitation links |

### Reset Order

| Step | Phase | Reason |
|------|-------|--------|
| 1 | API Specs | No dependencies |
| 2 | Mock Servers | Depend on collections |
| 3 | Environments | Independent |
| 4 | Collections | Deleted last |

### Rate Limiting

| Operation | Delay |
|-----------|-------|
| Collections | 300ms |
| Mocks | 300ms |
| Environments | 300ms |
| Specs | 500ms |
| Admins | 300ms |
| Partners | 300ms |

---

## Troubleshooting

### Common Issues

#### "Invalid API key"
- Verify your API key is correct and hasn't expired
- Check that the key has appropriate permissions
- Generate a new key at [Postman Account Settings](https://go.postman.co/settings/me/api-keys)

#### "Workspace not found"
- Confirm workspace IDs are correct
- Ensure you have access to the workspace

#### "Failed to add admin"
- Verify the user ID is correct
- Ensure the user is part of your Postman team

#### "Failed to invite partner"
- Verify the email address format
- Check that your team has Partner Workspaces enabled

#### "Spec files not copying"
- Confirm specs exist in source workspace
- Verify spec type is supported (OPENAPI:3.0, OPENAPI:3.1, ASYNCAPI:2.0)

### Partner Role Reference

| Role ID | Name | Description |
|---------|------|-------------|
| `4` | Partner Viewer | Read-only access |
| `7` | Editor and Partner Lead | Full editing access |

### Debug Mode

```python
import logging
logging.basicConfig(level=logging.DEBUG)

# Or check configuration
from postman_sdk.utils import get_configuration_status
status = get_configuration_status()
print(f"Configuration: {status}")
```

---

## License

MIT
