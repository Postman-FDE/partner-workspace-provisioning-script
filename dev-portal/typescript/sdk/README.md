# Postman SDK for TypeScript

A fully-typed TypeScript SDK for the Postman API with workspace provisioning, reset, and management capabilities. Perfect for type-safe integrations in modern web applications.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Available Functions](#available-functions)
- [Provisioning Functions](#provisioning-functions)
  - [ProvisioningService.provision()](#provisioningserviceprovision---full-provisioning)
  - [ProvisioningService.provisionCustom()](#provisioningserviceprovisioncustom---selective-provisioning)
- [Reset Functions](#reset-functions)
  - [ResetService.reset()](#resetservicereset---delete-all-or-selected)
  - [ResetService.resetCustom()](#resetserviceresetcustom---delete-specific-items)
- [Team & Partner Management](#team--partner-management)
- [Helper Functions](#helper-functions)
- [React Integration Examples](#react-integration-examples)
  - [Provision Workspace Button](#provision-workspace-button-with-partner-links)
  - [Collection Selector with Checklist](#collection-selector-with-checklist)
- [Next.js Integration](#nextjs-integration)
- [Vue Integration](#vue-integration)
- [Angular Integration](#angular-integration)
- [API Reference](#api-reference)
- [Workflow Details](#workflow-details)
- [Troubleshooting](#troubleshooting)

---

## Installation

```bash
npm install @postman/workspace-sdk
# or
yarn add @postman/workspace-sdk
# or
pnpm add @postman/workspace-sdk
```

## Quick Start

```typescript
import { PostmanClient, ProvisioningService } from '@postman/workspace-sdk';

const client = new PostmanClient({
  apiKey: process.env.POSTMAN_API_KEY!,
});

// Validate API key
const { valid, user } = await client.validateApiKey();
console.log(`Authenticated as: ${user?.username}`);

// Get workspace
const workspace = await client.getWorkspace('workspace-id');
```

## Features

- Full TypeScript type safety
- All Postman API endpoints
- High-level services for provisioning and reset workflows
- Mock URL path resolution — extracts URL paths from collection host variables and appends them to mock server URLs
- Collection variable mapping — patches forked collections to reference mock environment variables
- Automatic retry with exponential backoff
- Progress callbacks for long-running operations

---

## Available Functions

### Function Overview

| Category | Function/Method | Purpose |
|----------|-----------------|---------|
| **Provisioning** | `ProvisioningService.provision()` | Complete provisioning with all assets |
| **Provisioning** | `ProvisioningService.provisionCustom()` | Selective provisioning with options |
| **Reset** | `ResetService.reset()` | Delete all/selected asset types |
| **Reset** | `ResetService.resetCustom()` | Delete specific items |
| **Workspace** | `WorkspaceService.getWorkspace()` | Get workspace details |
| **Workspace** | `WorkspaceService.createWorkspace()` | Create new workspace |
| **Workspace** | `WorkspaceService.initializeTargetWorkspace()` | Create or verify workspace |
| **Workspace** | `WorkspaceService.getWorkspaceSummary()` | Get workspace with counts |
| **Team** | `WorkspaceService.addAdmin()` | Add a user as workspace admin |
| **Team** | `WorkspaceService.addMultipleAdmins()` | Batch add multiple admins |
| **Team** | `client.getWorkspaceRoles()` | Get workspace roles |
| **Partners** | `client.invitePartner()` | Invite a partner by email |
| **Partners** | `client.removePartner()` | Remove partner from workspace |
| **Collections** | `client.getCollections()` | Get all collections |
| **Collections** | `client.forkCollection()` | Fork a collection |
| **Collections** | `client.patchCollectionVariables()` | Update collection variables |
| **Collections** | `client.deleteCollection()` | Delete a collection |
| **Environments** | `client.getEnvironments()` | Get all environments |
| **Environments** | `client.createEnvironment()` | Create environment |
| **Environments** | `client.updateEnvironment()` | Update environment |
| **Mocks** | `client.getMocks()` | Get all mock servers |
| **Mocks** | `client.createMock()` | Create mock server |
| **Specs** | `client.getSpecs()` | Get all specs |
| **Specs** | `client.createSpec()` | Create spec |
| **Helper** | `client.validateApiKey()` | Validate API key |

---

## Provisioning Functions

### `ProvisioningService.provision()` - Full Provisioning

Copies all collections, creates mocks, copies environments, creates a mock environment with path-resolved mock URLs, patches collection variables to reference the mock environment, copies specs, adds admins, and invites partners.

```typescript
import { PostmanClient, ProvisioningService } from '@postman/workspace-sdk';
import type { ProvisioningOptions, ProvisioningResult, ProgressEvent } from '@postman/workspace-sdk';

const client = new PostmanClient({ apiKey: process.env.POSTMAN_API_KEY! });
const provisioner = new ProvisioningService(client);

const options: ProvisioningOptions = {
  sourceWorkspaceId: 'source-workspace-id',
  workspaceName: 'My Partner Workspace',
  workspaceType: 'partner',
  adminUserIds: ['12345', '67890'],
  partnerEmails: ['partner@company.com'],
  partnerRoleId: '7',
};

const result: ProvisioningResult = await provisioner.provision(
  options,
  (progress: ProgressEvent) => {
    console.log(`${progress.phase}: ${progress.message}`);
    console.log(`Progress: ${progress.progress}%`);
  }
);

// Access results with full type safety
console.log('Workspace:', result.workspace);
console.log('Collections copied:', result.collections.success);
console.log('Mock URLs:', result.mocks.urls);
console.log('Invitation links:', result.invitations.links);
```

**Type Definitions:**

```typescript
interface ProvisioningOptions {
  sourceWorkspaceId: string;
  targetWorkspaceId?: string;
  workspaceName?: string;
  workspaceType?: 'partner' | 'team' | 'private';
  adminUserIds?: string[];
  partnerEmails?: string[];
  partnerRoleId?: string;
}

interface ProvisioningResult {
  workspace: Workspace;
  workspaceCreated: boolean;
  collections: { total: number; success: number; failed: FailedItem[]; successData: CollectionMapping[] };
  mocks: { total: number; success: number; failed: FailedItem[]; urls: Record<string, string> };
  environments: { total: number; success: number; failed: FailedItem[]; successData: EnvironmentMapping[] };
  mockEnv: { success: boolean; action: 'created' | 'updated' | null };
  collectionVariables: { total: number; success: number; failed: FailedItem[] };
  specs: { total: number; success: number; failed: FailedItem[]; successData: SpecMapping[] };
  admins: { total: number; success: number; failed: FailedItem[]; successData: AdminResult[] };
  invitations: { total: number; success: number; failed: FailedItem[]; links: InvitationLink[] };
  errors: string[];
}

interface ProgressEvent {
  phase: 'validation' | 'workspace' | 'collections' | 'mocks' | 'environments' | 
         'mockEnv' | 'updateCollectionVars' | 'specs' | 'admins' | 'partners' | 'complete' | 'error';
  message: string;
  progress: number;
  current?: number;
  total?: number;
  currentItem?: string;
}
```

### `ProvisioningService.provisionCustom()` - Selective Provisioning

Choose which asset types and specific items to copy.

```typescript
import { PostmanClient, ProvisioningService } from '@postman/workspace-sdk';
import type { CustomProvisioningOptions } from '@postman/workspace-sdk';

const client = new PostmanClient({ apiKey: process.env.POSTMAN_API_KEY! });
const provisioner = new ProvisioningService(client);

const options: CustomProvisioningOptions = {
  sourceWorkspaceId: 'source-workspace-id',
  targetWorkspaceId: 'target-workspace-id',
  
  // Asset type toggles
  copyCollections: true,
  copyEnvironments: true,
  copyMocks: true,
  copySpecs: false,
  createMockEnv: true,
  
  // Team & partner toggles
  addAdmins: true,
  invitePartners: true,
  adminUserIds: ['12345'],
  partnerEmails: ['partner@company.com'],
  
  // Specific items to copy (null = all)
  selectedCollectionUids: ['uid1', 'uid2'],
  selectedEnvironmentUids: null,
  selectedSpecIds: null,
};

const result = await provisioner.provisionCustom(options, (progress) => {
  console.log(progress.message);
});
```

---

## Reset Functions

### `ResetService.reset()` - Delete All or Selected

```typescript
import { PostmanClient, ResetService } from '@postman/workspace-sdk';
import type { ResetOptions, ResetResult } from '@postman/workspace-sdk';

const client = new PostmanClient({ apiKey: process.env.POSTMAN_API_KEY! });
const resetter = new ResetService(client);

// Delete ALL resources
const result: ResetResult = await resetter.reset(
  'workspace-id',
  (progress) => console.log(`${progress.phase}: ${progress.deleted}/${progress.total}`)
);

// Partial reset - keep collections and environments
const options: ResetOptions = {
  includeSpecs: true,
  includeMocks: true,
  includeEnvironments: false,
  includeCollections: false,
};

const partialResult = await resetter.reset('workspace-id', console.log, options);
```

### `ResetService.resetCustom()` - Delete Specific Items

```typescript
import { PostmanClient, ResetService } from '@postman/workspace-sdk';
import type { CustomResetOptions } from '@postman/workspace-sdk';

const client = new PostmanClient({ apiKey: process.env.POSTMAN_API_KEY! });
const resetter = new ResetService(client);

// Get collections and select specific ones to delete
const collections = await client.getCollections('workspace-id');
const toDelete = collections
  .filter(c => c.name.includes('Test'))
  .map(c => c.uid);

const options: CustomResetOptions = {
  includeCollections: true,
  selectedCollectionUids: toDelete,
  includeEnvironments: false,
  includeMocks: false,
  includeSpecs: false,
};

const result = await resetter.resetCustom('workspace-id', console.log, options);
```

---

## Team & Partner Management

### Adding Workspace Admins

```typescript
import { PostmanClient, WorkspaceService } from '@postman/workspace-sdk';

const client = new PostmanClient({ apiKey: process.env.POSTMAN_API_KEY! });
const workspaceService = new WorkspaceService(client);

// Add a single admin
const result = await workspaceService.addAdmin('workspace-id', '12345678');
if (result.success) {
  console.log('Admin added:', result.userId);
}

// Add multiple admins with progress
const results = await workspaceService.addMultipleAdmins(
  'workspace-id',
  ['12345', '67890', '11111'],
  (progress) => console.log(`Added ${progress.current}/${progress.total}`)
);

console.log('Successful:', results.success.length);
console.log('Failed:', results.failed);
```

### Inviting Partners

```typescript
import { PostmanClient } from '@postman/workspace-sdk';

const client = new PostmanClient({ apiKey: process.env.POSTMAN_API_KEY! });

// Invite a single partner
const result = await client.invitePartner(
  'workspace-id',
  'partner@company.com',
  '7'  // Role ID (7 = Editor and Partner Lead)
);

if (result.success) {
  console.log('Invitation sent!');
  console.log('Status:', result.status);
  console.log('Invitation Link:', result.invitationLink);
}
```

---

## Helper Functions

### Get Available Resources for UI

```typescript
import { PostmanClient } from '@postman/workspace-sdk';

const client = new PostmanClient({ apiKey: process.env.POSTMAN_API_KEY! });

// Get collections
const collections = await client.getCollections('workspace-id');

// Get all resources at once
const [envs, mocks, specs] = await Promise.all([
  client.getEnvironments('workspace-id'),
  client.getMocks('workspace-id'),
  client.getSpecs('workspace-id'),
]);
```

---

## React Integration Examples

### Direct Hook Pattern

```tsx
// hooks/usePostmanWorkspace.ts
import { useState, useEffect } from 'react';
import { PostmanClient, Workspace } from '@postman/workspace-sdk';

const client = new PostmanClient({ apiKey: process.env.NEXT_PUBLIC_POSTMAN_API_KEY! });

export function usePostmanWorkspace(workspaceId: string) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchWorkspace() {
      try {
        setLoading(true);
        const data = await client.getWorkspace(workspaceId);
        setWorkspace(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }
    fetchWorkspace();
  }, [workspaceId]);

  return { workspace, loading, error };
}
```

### With React Query

```tsx
// queries/workspace.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PostmanClient, ProvisioningService } from '@postman/workspace-sdk';

const client = new PostmanClient({ apiKey: process.env.NEXT_PUBLIC_POSTMAN_API_KEY! });

export function useWorkspace(workspaceId: string) {
  return useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => client.getWorkspace(workspaceId),
  });
}

export function useCollections(workspaceId: string) {
  return useQuery({
    queryKey: ['collections', workspaceId],
    queryFn: () => client.getCollections(workspaceId),
  });
}

export function useProvision() {
  const queryClient = useQueryClient();
  const provisioningService = new ProvisioningService(client);
  
  return useMutation({
    mutationFn: (options: Parameters<typeof provisioningService.provision>[0]) => 
      provisioningService.provision(options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}
```

### Provision Workspace Button with Partner Links

```tsx
import React, { useState } from 'react';
import { PostmanClient, ProvisioningService, ProvisioningResult, ProgressEvent } from '@postman/workspace-sdk';

const client = new PostmanClient({ apiKey: process.env.NEXT_PUBLIC_POSTMAN_API_KEY! });

interface ProvisionerConfig {
  workspaceName: string;
  adminUserIds: string;
  partnerEmails: string;
}

function PartnerProvisioner() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [results, setResults] = useState<ProvisioningResult | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [config, setConfig] = useState<ProvisionerConfig>({
    workspaceName: 'Partner Workspace',
    adminUserIds: '',
    partnerEmails: '',
  });

  const handleProvision = async () => {
    setLoading(true);
    const provisioner = new ProvisioningService(client);
    
    try {
      const result = await provisioner.provision({
        sourceWorkspaceId: 'your-source-workspace-id',
        workspaceName: config.workspaceName,
        workspaceType: 'partner',
        adminUserIds: config.adminUserIds.split(',').map(s => s.trim()).filter(Boolean),
        partnerEmails: config.partnerEmails.split(',').map(s => s.trim()).filter(Boolean),
      }, (progressData: ProgressEvent) => {
        setProgress(progressData.progress);
        setStatus(progressData.message);
      });
      
      setResults(result);
    } catch (error) {
      console.error('Provisioning failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="provisioner">
      <h2>Partner Workspace Provisioning</h2>
      
      <div className="form-group">
        <label>Workspace Name:</label>
        <input
          type="text"
          value={config.workspaceName}
          onChange={(e) => setConfig({...config, workspaceName: e.target.value})}
        />
      </div>
      
      <div className="form-group">
        <label>Partner Emails (comma-separated):</label>
        <input
          type="text"
          value={config.partnerEmails}
          onChange={(e) => setConfig({...config, partnerEmails: e.target.value})}
          placeholder="partner1@company.com, partner2@company.com"
        />
      </div>
      
      <button onClick={handleProvision} disabled={loading}>
        {loading ? 'Provisioning...' : 'Provision Workspace'}
      </button>
      
      {loading && (
        <div className="progress">
          <div>Status: {status}</div>
          <div>Progress: {progress}%</div>
        </div>
      )}
      
      {results && (
        <div className="results">
          <h3>Results</h3>
          <p>Workspace: {results.workspace?.name}</p>
          <p>Collections: {results.collections.success}/{results.collections.total}</p>
          <p>Partners Invited: {results.invitations.success}/{results.invitations.total}</p>
          
          {results.invitations.links.length > 0 && (
            <div>
              <h4>Partner Invitation Links</h4>
              <ul>
                {results.invitations.links.map((invite, i) => (
                  <li key={i}>
                    <strong>{invite.email}:</strong>
                    <a href={invite.link} target="_blank" rel="noopener noreferrer">
                      {invite.link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### Collection Selector with Checklist

```tsx
import React, { useState, useEffect } from 'react';
import { PostmanClient, ProvisioningService, Collection } from '@postman/workspace-sdk';

const client = new PostmanClient({ apiKey: process.env.NEXT_PUBLIC_POSTMAN_API_KEY! });

interface CollectionSelectorProps {
  sourceWorkspaceId: string;
  targetWorkspaceId: string;
}

function CollectionSelector({ sourceWorkspaceId, targetWorkspaceId }: CollectionSelectorProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const loadCollections = async () => {
      const data = await client.getCollections(sourceWorkspaceId);
      setCollections(data);
    };
    loadCollections();
  }, [sourceWorkspaceId]);

  const toggleCollection = (uid: string) => {
    setSelected(prev =>
      prev.includes(uid)
        ? prev.filter(id => id !== uid)
        : [...prev, uid]
    );
  };

  const handleProvision = async () => {
    if (selected.length === 0) {
      alert('Please select at least one collection');
      return;
    }

    setLoading(true);
    const provisioner = new ProvisioningService(client);
    
    try {
      const results = await provisioner.provisionCustom({
        sourceWorkspaceId,
        targetWorkspaceId,
        copyCollections: true,
        copyMocks: true,
        copyEnvironments: false,
        copySpecs: false,
        selectedCollectionUids: selected,
        addAdmins: false,
        invitePartners: false,
      }, (progressData) => {
        setProgress(progressData.progress);
      });

      alert(`Success! Copied ${results.collections.success} collections`);
    } catch (error) {
      alert(`Error: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="collection-selector">
      <h2>Select Collections to Copy</h2>
      
      <div className="collection-list">
        {collections.map(collection => (
          <div key={collection.uid} className="collection-item">
            <label>
              <input
                type="checkbox"
                checked={selected.includes(collection.uid)}
                onChange={() => toggleCollection(collection.uid)}
              />
              <span>{collection.name}</span>
            </label>
          </div>
        ))}
      </div>

      <button
        onClick={handleProvision}
        disabled={loading || selected.length === 0}
      >
        {loading ? `Provisioning... ${progress}%` : 'Provision Selected'}
      </button>
    </div>
  );
}
```

---

## Next.js Integration

### Server Components (App Router)

```tsx
// app/workspace/[id]/page.tsx
import { PostmanClient } from '@postman/workspace-sdk';

const client = new PostmanClient({ apiKey: process.env.POSTMAN_API_KEY! });

export default async function WorkspacePage({ params }: { params: { id: string } }) {
  const workspace = await client.getWorkspace(params.id);
  const collections = await client.getCollections(params.id);

  return (
    <div>
      <h1>{workspace?.name}</h1>
      <h2>Collections ({collections.length})</h2>
      <ul>
        {collections.map((c) => (
          <li key={c.uid}>{c.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

### Server Actions

```typescript
// app/actions/workspace.ts
'use server';

import { PostmanClient, ProvisioningService } from '@postman/workspace-sdk';
import { revalidatePath } from 'next/cache';

const client = new PostmanClient({ apiKey: process.env.POSTMAN_API_KEY! });

export async function provisionWorkspace(formData: FormData) {
  const name = formData.get('name') as string;
  const sourceWorkspaceId = formData.get('sourceWorkspaceId') as string;

  const provisioner = new ProvisioningService(client);
  const result = await provisioner.provision({
    sourceWorkspaceId,
    workspaceName: name,
  });
  
  revalidatePath('/workspaces');
  return result;
}
```

---

## Vue Integration

### Composables Pattern

```typescript
// composables/usePostman.ts
import { ref, onMounted } from 'vue';
import { PostmanClient, Workspace, Collection } from '@postman/workspace-sdk';

const client = new PostmanClient({ apiKey: import.meta.env.VITE_POSTMAN_API_KEY });

export function useWorkspace(workspaceId: string) {
  const workspace = ref<Workspace | null>(null);
  const loading = ref(true);
  const error = ref<Error | null>(null);

  onMounted(async () => {
    try {
      workspace.value = await client.getWorkspace(workspaceId);
    } catch (err) {
      error.value = err as Error;
    } finally {
      loading.value = false;
    }
  });

  return { workspace, loading, error };
}

export function useCollections(workspaceId: string) {
  const collections = ref<Collection[]>([]);
  const loading = ref(true);

  onMounted(async () => {
    try {
      collections.value = await client.getCollections(workspaceId);
    } finally {
      loading.value = false;
    }
  });

  return { collections, loading };
}
```

---

## Angular Integration

### Injectable Service

```typescript
// services/postman.service.ts
import { Injectable } from '@angular/core';
import { PostmanClient, Workspace, Collection, ProvisioningService } from '@postman/workspace-sdk';
import { from, Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class PostmanService {
  private client: PostmanClient;
  
  progress$ = new BehaviorSubject<{ phase: string; progress: number }>({ phase: '', progress: 0 });

  constructor() {
    this.client = new PostmanClient({ apiKey: environment.postmanApiKey });
  }

  getWorkspace(workspaceId: string): Observable<Workspace | null> {
    return from(this.client.getWorkspace(workspaceId));
  }

  getCollections(workspaceId: string): Observable<Collection[]> {
    return from(this.client.getCollections(workspaceId));
  }

  provision(options: any): Observable<any> {
    const provisioner = new ProvisioningService(this.client);
    return from(
      provisioner.provision(options, (progress) => {
        this.progress$.next(progress);
      })
    );
  }
}
```

---

## API Reference

### PostmanClient

Main SDK client with all API methods.

```typescript
const client = new PostmanClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.getpostman.com', // optional
  timeout: 30000, // optional
});
```

**Methods:**

| Method | Return Type | Description |
|--------|-------------|-------------|
| `validateApiKey()` | `Promise<{valid, user?, error?}>` | Validate API key |
| `getWorkspace(id)` | `Promise<Workspace \| null>` | Get workspace details |
| `createWorkspace(name, type, desc)` | `Promise<{success, workspace?, error?}>` | Create workspace |
| `getCollections(workspaceId)` | `Promise<Collection[]>` | Get all collections |
| `forkCollection(uid, label, targetId)` | `Promise<{success, collection?, error?}>` | Fork a collection |
| `deleteCollection(uid)` | `Promise<boolean>` | Delete collection |
| `getEnvironments(workspaceId)` | `Promise<Environment[]>` | Get all environments |
| `createEnvironment(name, values, wsId)` | `Promise<{success, environment?, error?}>` | Create environment |
| `getMocks(workspaceId)` | `Promise<MockServer[]>` | Get all mock servers |
| `createMock(name, collectionUid, wsId)` | `Promise<{success, mock?, error?}>` | Create mock server |
| `getSpecs(workspaceId)` | `Promise<Spec[]>` | Get all specs |
| `createSpec(wsId, name, type, files)` | `Promise<{success, spec?, error?}>` | Create spec |
| `patchCollectionVariables(collectionUid, variables)` | `Promise<{success, error?}>` | Update collection variables |
| `invitePartner(wsId, email, roleId)` | `Promise<InvitationResult>` | Invite partner |

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
| 6 | Mock Environment | Create/update env with path-resolved mock URLs (e.g., `directDebitsApiBaseUrl`) |
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

---

## License

MIT
