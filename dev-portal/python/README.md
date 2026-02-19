# Postman SDK for Python

A fully-typed Python SDK for the Postman API with async/await support, Pydantic models, and high-level services for workspace provisioning and reset workflows.

## Installation

```bash
pip install postman-sdk
# or
poetry add postman-sdk
# or
uv add postman-sdk
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
- Automatic retry with exponential backoff
- Context manager support

---

## Frontend Integration Patterns

### FastAPI + React Integration

**Backend API Endpoints**

```python
# app/routers/workspaces.py
from fastapi import APIRouter, HTTPException, Depends
from postman_sdk import PostmanClient, Workspace
from app.config import settings

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])

async def get_client() -> PostmanClient:
    return PostmanClient(api_key=settings.postman_api_key)

@router.get("/{workspace_id}")
async def get_workspace(
    workspace_id: str,
    client: PostmanClient = Depends(get_client)
) -> Workspace | None:
    workspace = await client.get_workspace(workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace

@router.get("/{workspace_id}/collections")
async def get_collections(
    workspace_id: str,
    client: PostmanClient = Depends(get_client)
):
    return await client.get_collections(workspace_id)

@router.post("/provision")
async def provision_workspace(
    source_workspace_id: str,
    target_name: str,
    client: PostmanClient = Depends(get_client)
):
    from postman_sdk import ProvisioningService
    
    provisioner = ProvisioningService(
        client=client,
        source_workspace_id=source_workspace_id,
        target_workspace_name=target_name,
    )
    return await provisioner.provision()
```

**React Frontend (with React Query)**

```tsx
// hooks/useWorkspace.ts
import { useQuery, useMutation } from '@tanstack/react-query';

interface Workspace {
  id: string;
  name: string;
  type: string;
}

export function useWorkspace(workspaceId: string) {
  return useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: async (): Promise<Workspace> => {
      const res = await fetch(`/api/workspaces/${workspaceId}`);
      if (!res.ok) throw new Error('Failed to fetch workspace');
      return res.json();
    },
  });
}

export function useProvision() {
  return useMutation({
    mutationFn: async (data: { sourceWorkspaceId: string; targetName: string }) => {
      const res = await fetch('/api/workspaces/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Provisioning failed');
      return res.json();
    },
  });
}
```

---

### Django + HTMX Integration

**Django Views**

```python
# views.py
import asyncio
from django.http import JsonResponse, HttpResponse
from django.views.decorators.http import require_http_methods
from django.shortcuts import render
from postman_sdk import PostmanClient
from .settings import POSTMAN_API_KEY

def get_client():
    return PostmanClient(api_key=POSTMAN_API_KEY)

@require_http_methods(["GET"])
def workspace_detail(request, workspace_id):
    async def fetch():
        async with get_client() as client:
            workspace = await client.get_workspace(workspace_id)
            collections = await client.get_collections(workspace_id)
            return workspace, collections

    workspace, collections = asyncio.run(fetch())
    
    if request.headers.get('HX-Request'):
        # HTMX partial response
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
    from postman_sdk import ProvisioningService
    
    source_id = request.POST.get('source_workspace_id')
    target_name = request.POST.get('target_name')

    async def do_provision():
        async with get_client() as client:
            provisioner = ProvisioningService(
                client=client,
                source_workspace_id=source_id,
                target_workspace_name=target_name,
            )
            return await provisioner.provision()

    result = asyncio.run(do_provision())
    
    if request.headers.get('HX-Request'):
        return render(request, 'partials/provision_result.html', {'result': result})
    
    return JsonResponse(result)
```

**HTMX Template**

```html
<!-- templates/workspace_detail.html -->
{% extends "base.html" %}

{% block content %}
<div id="workspace-content">
  <h1>{{ workspace.name }}</h1>
  <p>Type: {{ workspace.type }}</p>
  
  <h2>Collections</h2>
  <ul id="collections-list">
    {% for collection in collections %}
    <li>{{ collection.name }}</li>
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
  <input type="text" name="target_name" placeholder="New workspace name">
  <button type="submit">Provision</button>
</form>
<div id="provision-result"></div>
{% endblock %}
```

---

### Flask + Vue Integration

**Flask Backend**

```python
# app.py
import asyncio
from flask import Flask, jsonify, request
from flask_cors import CORS
from postman_sdk import PostmanClient, ProvisioningService
import os

app = Flask(__name__)
CORS(app)

def get_client():
    return PostmanClient(api_key=os.environ['POSTMAN_API_KEY'])

def run_async(coro):
    """Helper to run async code in Flask"""
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
            provisioner = ProvisioningService(
                client=client,
                source_workspace_id=data['source_workspace_id'],
                target_workspace_name=data['target_name'],
            )
            return await provisioner.provision()
    
    result = run_async(do_provision())
    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True)
```

**Vue 3 Frontend**

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue';

interface Workspace {
  id: string;
  name: string;
  type: string;
}

interface Collection {
  id: string;
  uid: string;
  name: string;
}

const props = defineProps<{ workspaceId: string }>();

const workspace = ref<Workspace | null>(null);
const collections = ref<Collection[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const [wsRes, colRes] = await Promise.all([
      fetch(`/api/workspaces/${props.workspaceId}`),
      fetch(`/api/workspaces/${props.workspaceId}/collections`),
    ]);
    
    workspace.value = await wsRes.json();
    collections.value = await colRes.json();
  } finally {
    loading.value = false;
  }
});

async function provisionWorkspace(targetName: string) {
  const res = await fetch('/api/provision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source_workspace_id: props.workspaceId,
      target_name: targetName,
    }),
  });
  return res.json();
}
</script>

<template>
  <div v-if="loading">Loading...</div>
  <div v-else>
    <h1>{{ workspace?.name }}</h1>
    <h2>Collections ({{ collections.length }})</h2>
    <ul>
      <li v-for="c in collections" :key="c.uid">{{ c.name }}</li>
    </ul>
  </div>
</template>
```

---

### Streamlit Dashboard

**Internal Tools / Dashboard**

```python
# dashboard.py
import streamlit as st
import asyncio
from postman_sdk import PostmanClient, ProvisioningService, ResetService

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
        
        col1, col2, col3, col4 = st.columns(4)
        col1.metric("Collections", len(collections))
        col2.metric("Environments", len(environments))
        col3.metric("Mocks", len(mocks))
        col4.metric("Specs", len(specs))
        
        # Collections table
        st.subheader("Collections")
        st.table([{"Name": c.name, "UID": c.uid} for c in collections])
        
        # Provisioning
        st.subheader("Provision New Workspace")
        with st.form("provision_form"):
            target_name = st.text_input("New Workspace Name")
            submitted = st.form_submit_button("Provision")
            
            if submitted and target_name:
                async def do_provision():
                    async with client as c:
                        provisioner = ProvisioningService(
                            client=c,
                            source_workspace_id=workspace_id,
                            target_workspace_name=target_name,
                        )
                        return await provisioner.provision()
                
                with st.spinner("Provisioning..."):
                    result = run_async(do_provision())
                
                st.success(f"Created workspace: {result['workspace'].name}")
                st.json(result)
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
    retry_attempts=3,  # optional
    retry_delay=1.0,  # optional
) as client:
    # Use client
    pass
```

**Methods:**

| Method | Description |
|--------|-------------|
| `validate_api_key()` | Validate API key and get user info |
| `get_workspace(id)` | Get workspace details |
| `create_workspace(request)` | Create new workspace |
| `get_collections(workspace_id)` | Get all collections |
| `fork_collection(uid, label, target_id)` | Fork a collection |
| `get_environments(workspace_id)` | Get all environments |
| `create_environment(name, values, workspace_id)` | Create environment |
| `get_mocks(workspace_id)` | Get all mock servers |
| `create_mock(request)` | Create mock server |
| `get_specs(workspace_id)` | Get all specs |
| `create_spec(workspace_id, name, type, files)` | Create spec |
| `invite_partner(workspace_id, email, role_id)` | Invite partner |

### ProvisioningService

High-level provisioning workflow.

```python
from postman_sdk import ProvisioningService

provisioner = ProvisioningService(
    client=client,
    source_workspace_id="source-id",
    target_workspace_name="New Workspace",
    admin_user_ids=["user-1", "user-2"],
    partner_emails=["partner@example.com"],
    on_progress=lambda e: print(e.message),
)

result = await provisioner.provision()
```

### ResetService

High-level reset workflow.

```python
from postman_sdk import ResetService

resetter = ResetService(
    client=client,
    workspace_id="workspace-to-reset",
    on_progress=lambda e: print(e.message),
)

result = await resetter.reset()
```

---

## License

MIT
