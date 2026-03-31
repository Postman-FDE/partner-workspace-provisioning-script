# Postman SDK for JavaScript

A comprehensive JavaScript SDK for the Postman API with workspace provisioning, reset, and management capabilities. Perfect for integrating into web applications, dashboards, or automation systems.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Available Functions](#available-functions)
- [Provisioning Functions](#provisioning-functions)
  - [provisionWorkspace()](#provisionworkspace---full-provisioning)
  - [provisionCustomWorkspace()](#provisioncustomworkspace---selective-provisioning)
- [Reset Functions](#reset-functions)
  - [resetWorkspace()](#resetworkspace---delete-all-or-selected)
  - [resetCustomWorkspace()](#resetcustomworkspace---delete-specific-items)
- [Update Functions](#update-functions)
  - [updateWorkspace()](#updateworkspace---detect-and-add-new-assets)
- [Team & Partner Management](#team--partner-management)
- [Helper Functions](#helper-functions)
- [React Integration Examples](#react-integration-examples)
  - [Provision Workspace Button](#provision-workspace-button-with-partner-links)
  - [Collection Selector with Checklist](#collection-selector-with-checklist)
- [Vue Integration Examples](#vue-integration-examples)
- [Angular Integration Examples](#angular-integration-examples)
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

### Environment Configuration

```env
# Required
POSTMAN_API_KEY=PMAK-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
POSTMAN_SOURCE_WORKSPACE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Optional
POSTMAN_TARGET_WORKSPACE_ID=           # Leave empty to create new workspace
POSTMAN_WORKSPACE_NAME=Partner Workspace
POSTMAN_ADMIN_USER_IDS=12345,67890     # Comma-separated user IDs
PARTNER_EMAILS=partner1@company.com    # Comma-separated emails
PARTNER_ROLE_ID=7                       # 4=Viewer, 7=Editor and Partner Lead
```

### Basic Usage

```javascript
import {
  provisionWorkspace,
  resetWorkspace,
  validateApiKey,
  getWorkspace,
} from '@postman/workspace-sdk';

// Validate API key
const { valid, user } = await validateApiKey();
console.log(`Authenticated as: ${user?.username}`);

// Provision a new workspace
const result = await provisionWorkspace({
  sourceWorkspaceId: 'source-workspace-id',
  workspaceName: 'Partner Workspace',
  partnerEmails: ['partner@company.com'],
}, (progress) => {
  console.log(`${progress.phase}: ${progress.message}`);
});

console.log('Partner invitation links:', result.invitations.links);
```

### Using Classes Directly

```javascript
import { PostmanClient, ProvisioningService, ResetService } from '@postman/workspace-sdk';

const client = new PostmanClient({
  apiKey: process.env.POSTMAN_API_KEY,
});

// Using ProvisioningService
const provisioner = new ProvisioningService(client);
const result = await provisioner.provision({
  sourceWorkspaceId: 'source-id',
  workspaceName: 'New Workspace',
});

// Using ResetService
const resetter = new ResetService(client);
const resetResult = await resetter.reset('workspace-id');
```

---

## Available Functions

### Function Overview

| Category | Function | Purpose |
|----------|----------|---------|
| **Provisioning** | `provisionWorkspace()` | Complete provisioning with all assets |
| **Provisioning** | `provisionCustomWorkspace()` | Selective provisioning with options |
| **Provisioning** | `quickProvision()` | Minimal config provisioning |
| **Reset** | `resetWorkspace()` | Delete all/selected asset types |
| **Reset** | `resetCustomWorkspace()` | Delete specific items |
| **Update** | `updateWorkspace()` | Detect and add new assets from source |
| **Workspace** | `getWorkspace()` | Get workspace details |
| **Workspace** | `getWorkspaceSummary()` | Get workspace with resource counts |
| **Team** | `addWorkspaceAdmin()` | Add a user as workspace admin |
| **Team** | `addMultipleAdmins()` | Batch add multiple admins |
| **Team** | `removeWorkspaceUser()` | Remove a user from workspace |
| **Team** | `getWorkspaceRoles()` | Get workspace roles |
| **Partners** | `invitePartner()` | Invite a partner by email |
| **Partners** | `inviteMultiplePartners()` | Batch invite multiple partners |
| **Partners** | `removePartner()` | Remove partner from workspace |
| **Partners** | `removeMultiplePartners()` | Batch remove partners |
| **Helper** | `validateApiKey()` | Validate API key and get user |
| **Helper** | `getAvailableCollections()` | Get collections for UI checklist |
| **Helper** | `getAvailableResources()` | Get all resources for UI selection |
| **Helper** | `getConfigurationStatus()` | Check environment configuration |

---

## Provisioning Functions

### `provisionWorkspace()` - Full Provisioning

Copies all collections, creates mocks, copies environments, creates a fresh mock environment with mock server URLs, patches collection variables to reference the mock environment, copies specs, adds admins, and invites partners.

```javascript
import { provisionWorkspace } from '@postman/workspace-sdk';

const results = await provisionWorkspace({
  sourceWorkspaceId: 'source-workspace-id',
  workspaceName: 'My Partner Workspace',
  workspaceType: 'partner',  // 'partner' | 'team' | 'private'
  
  // Team & Partner Management (optional)
  adminUserIds: ['12345', '67890'],
  partnerEmails: ['partner@company.com'],
  partnerRoleId: '7',
}, (progress) => {
  console.log(`${progress.phase}: ${progress.message}`);
  console.log(`Progress: ${progress.progress}%`);
});

// Access results
console.log('Workspace:', results.workspace);
console.log('Collections copied:', results.collections.success);
console.log('Mocks created:', results.mocks.success);
console.log('Mock URLs:', results.mocks.urls);
console.log('Admins added:', results.admins.success);
console.log('Partners invited:', results.invitations.success);
console.log('Invitation links:', results.invitations.links);
```

**Full Options:**

```javascript
{
  sourceWorkspaceId: string,        // Required: Source workspace ID
  targetWorkspaceId?: string,       // Optional: Existing target workspace
  workspaceName?: string,           // Required if creating new workspace
  workspaceType?: string,           // 'partner' | 'team' | 'private'
  adminUserIds?: string[],          // User IDs to add as admins
  partnerEmails?: string[],         // Partner emails to invite
  partnerRoleId?: string,           // Partner role (default: "7")
}
```

**Returns:**

```javascript
{
  workspace: { id, name, type },
  workspaceCreated: boolean,
  collections: { total, success, failed, successData },
  mocks: { total, success, failed, urls },
  environments: { total, success, failed, successData },
  mockEnv: { success, action: 'created' | 'updated' },
  collectionVariables: { total, success, failed },
  specs: { total, success, failed, successData },
  admins: { total, success, failed, successData },
  invitations: { 
    total, 
    success, 
    failed, 
    links: [{ email, link }]  // Partner invitation links
  },
  errors: []
}
```

### `provisionCustomWorkspace()` - Selective Provisioning

Choose which asset types and specific items to copy.

```javascript
import { provisionCustomWorkspace } from '@postman/workspace-sdk';

const results = await provisionCustomWorkspace({
  sourceWorkspaceId: 'source-workspace-id',
  targetWorkspaceId: 'target-workspace-id',
  
  // Asset type toggles
  copyCollections: true,
  copyEnvironments: true,
  copyMocks: true,
  copySpecs: false,           // Skip specs
  createMockEnv: true,
  
  // Team & partner toggles
  addAdmins: true,
  invitePartners: true,
  adminUserIds: ['12345'],
  partnerEmails: ['partner@company.com'],
  partnerRoleId: '7',
  
  // Optional: Specific items to copy
  selectedCollectionUids: ['uid1', 'uid2'],  // null = all
  selectedEnvironmentUids: null,              // null = all
  selectedSpecIds: null,
}, (progress) => {
  console.log(progress.message);
});
```

**Full Options:**

```javascript
{
  sourceWorkspaceId: string,           // Required
  targetWorkspaceId?: string,          // Optional: Existing target
  workspaceName?: string,              // For new workspace
  workspaceType?: string,              // 'partner' | 'team' | 'private'
  copyCollections?: boolean,           // Default: true
  copyEnvironments?: boolean,          // Default: true
  copyMocks?: boolean,                 // Default: true
  copySpecs?: boolean,                 // Default: true
  createMockEnv?: boolean,             // Default: true
  addAdmins?: boolean,                 // Default: true
  invitePartners?: boolean,            // Default: true
  selectedCollectionUids?: string[],   // null = all
  selectedEnvironmentUids?: string[],  // null = all
  selectedSpecIds?: string[],          // null = all
  adminUserIds?: string[],
  partnerEmails?: string[],
  partnerRoleId?: string,
}
```

---

## Reset Functions

### `resetWorkspace()` - Delete All or Selected

```javascript
import { resetWorkspace } from '@postman/workspace-sdk';

// Delete ALL resources
const results = await resetWorkspace(
  'workspace-id',
  (progress) => console.log(`${progress.phase}: ${progress.deleted}/${progress.total}`)
);

// Partial reset - keep collections and environments
const results = await resetWorkspace(
  'workspace-id',
  (progress) => console.log(progress),
  {
    includeSpecs: true,
    includeMocks: true,
    includeEnvironments: false,  // Keep
    includeCollections: false,   // Keep
  }
);
```

### `resetCustomWorkspace()` - Delete Specific Items

```javascript
import { resetCustomWorkspace, getAvailableCollections } from '@postman/workspace-sdk';

// Get collections and select specific ones to delete
const collections = await getAvailableCollections('workspace-id');
const toDelete = collections
  .filter(c => c.name.includes('Test'))
  .map(c => c.uid);

const results = await resetCustomWorkspace(
  'workspace-id',
  (progress) => console.log(progress),
  {
    includeCollections: true,
    selectedCollectionUids: toDelete,  // Only delete these
    includeEnvironments: false,
    includeMocks: false,
    includeSpecs: false,
  }
);
```

---

## Update Functions

### `updateWorkspace()` - Detect and Add New Assets

Detects and adds new assets from source to an existing partner workspace without modifying existing assets.

```javascript
import { updateWorkspace } from '@postman/workspace-sdk';

const results = await updateWorkspace({
  sourceWorkspaceId: 'source-workspace-id',
  targetWorkspaceId: 'target-workspace-id',
}, (progress) => {
  console.log(`${progress.phase}: ${progress.message}`);
});

console.log('New collections:', results.newCollections.success);
console.log('New specs:', results.newSpecs.success);
console.log('New environments:', results.newEnvironments.success);
```

Or using the service directly:

```javascript
import { PostmanClient, UpdateService } from '@postman/workspace-sdk';

const client = new PostmanClient({ apiKey: 'your-api-key' });
const updateService = new UpdateService(client);
const results = await updateService.update({
  sourceWorkspaceId: 'source-id',
  targetWorkspaceId: 'target-id',
});
```

---

## Team & Partner Management

### Adding Workspace Admins

```javascript
import { addWorkspaceAdmin, addMultipleAdmins } from '@postman/workspace-sdk';

// Add a single admin
const result = await addWorkspaceAdmin(
  'workspace-id',
  '12345678',    // User ID
  '3'            // Role ID (3 = Admin)
);

if (result.success) {
  console.log('Admin added');
}

// Add multiple admins
const results = await addMultipleAdmins(
  'workspace-id',
  ['12345', '67890', '11111'],
  (progress) => console.log(`Added ${progress.current}/${progress.total}`)
);

console.log('Successful:', results.success.length);
console.log('Failed:', results.failed);
```

### Inviting Partners

```javascript
import { invitePartner, inviteMultiplePartners } from '@postman/workspace-sdk';

// Invite a single partner
const result = await invitePartner(
  'workspace-id',
  'partner@company.com',
  '7'  // Role ID (7 = Editor and Partner Lead)
);

if (result.success) {
  console.log('Invitation sent!');
  console.log('Status:', result.status);
  console.log('Invitation Link:', result.invitationLink);  // Share this!
}

// Invite multiple partners
const results = await inviteMultiplePartners(
  'workspace-id',
  ['partner1@company.com', 'partner2@company.com'],
  '7',
  (progress) => console.log(`Invited ${progress.current}/${progress.total}`)
);

// Get all invitation links
const invitationLinks = results
  .filter(r => r.success && r.invitationLink)
  .map(r => ({ email: r.email, link: r.invitationLink }));

console.log('Invitation Links:', invitationLinks);
```

### Removing Users

```javascript
import { removeWorkspaceUser, removePartner } from '@postman/workspace-sdk';

// Remove a user from workspace
await removeWorkspaceUser('workspace-id', 'user-id', '3');

// Remove a partner from workspace
await removePartner('workspace-id', 'partner-user-id');
```

---

## Helper Functions

### `getAvailableCollections(workspaceId)`

Returns collections formatted for checkbox/checklist UI.

```javascript
import { getAvailableCollections } from '@postman/workspace-sdk';

const collections = await getAvailableCollections('workspace-id');

// Result:
// [
//   {
//     id: '12345',
//     uid: '12345678-abc-def',
//     name: 'Authentication Services',
//     selected: false,
//     metadata: { createdAt, updatedAt }
//   },
//   ...
// ]
```

### `getAvailableResources(workspaceId)`

Returns ALL resource types at once.

```javascript
import { getAvailableResources } from '@postman/workspace-sdk';

const resources = await getAvailableResources('workspace-id');

// Result:
// {
//   collections: [{ id, uid, name, selected: false }, ...],
//   environments: [{ id, uid, name, selected: false }, ...],
//   mocks: [{ id, uid, name, selected: false, collectionUid, mockUrl }, ...],
//   specs: [{ id, name, type, selected: false }, ...]
// }
```

### Other Utility Functions

```javascript
import {
  validateApiKey,
  getWorkspace,
  getWorkspaceSummary,
  getConfigurationStatus,
  getWorkspaceRoles,
} from '@postman/workspace-sdk';

// Validate API key
const { valid, user, error } = await validateApiKey();

// Get workspace details
const workspace = await getWorkspace(workspaceId);

// Get workspace summary
const summary = await getWorkspaceSummary(workspaceId);
// Returns: { workspaceId, counts: { collections, environments, mocks, specs }, items: {...} }

// Check configuration
const status = getConfigurationStatus();
// Returns: { hasApiKey, hasSourceWorkspace, hasTargetWorkspace, isConfigured, message }

// Get workspace roles
const roles = await getWorkspaceRoles(workspaceId);
```

---

## React Integration Examples

### Provision Workspace Button with Partner Links

```javascript
import React, { useState } from 'react';
import { provisionWorkspace } from '@postman/workspace-sdk';

function PartnerProvisioner() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const [config, setConfig] = useState({
    workspaceName: 'Partner Workspace',
    adminUserIds: '',
    partnerEmails: '',
  });

  const handleProvision = async () => {
    setLoading(true);
    try {
      const result = await provisionWorkspace({
        sourceWorkspaceId: 'your-source-workspace-id',
        workspaceName: config.workspaceName,
        workspaceType: 'partner',
        adminUserIds: config.adminUserIds.split(',').map(s => s.trim()).filter(Boolean),
        partnerEmails: config.partnerEmails.split(',').map(s => s.trim()).filter(Boolean),
      }, (progressData) => {
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
        <label>
          Workspace Name:
          <input
            type="text"
            value={config.workspaceName}
            onChange={(e) => setConfig({...config, workspaceName: e.target.value})}
          />
        </label>
      </div>
      
      <div className="form-group">
        <label>
          Admin User IDs (comma-separated):
          <input
            type="text"
            value={config.adminUserIds}
            onChange={(e) => setConfig({...config, adminUserIds: e.target.value})}
            placeholder="12345, 67890"
          />
        </label>
      </div>
      
      <div className="form-group">
        <label>
          Partner Emails (comma-separated):
          <input
            type="text"
            value={config.partnerEmails}
            onChange={(e) => setConfig({...config, partnerEmails: e.target.value})}
            placeholder="partner1@company.com, partner2@company.com"
          />
        </label>
      </div>
      
      <button onClick={handleProvision} disabled={loading}>
        {loading ? 'Provisioning...' : 'Provision Workspace'}
      </button>
      
      {loading && (
        <div className="progress">
          <div>Status: {status}</div>
          <div>Progress: {progress}%</div>
          <div className="progress-bar">
            <div style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}
      
      {results && (
        <div className="results">
          <h3>Results</h3>
          <p><strong>Workspace:</strong> {results.workspace?.name}</p>
          <p>Collections: {results.collections.success}/{results.collections.total}</p>
          <p>Mocks: {results.mocks.success}/{results.mocks.total}</p>
          <p>Environments: {results.environments.success}/{results.environments.total}</p>
          <p>Admins Added: {results.admins.success}/{results.admins.total}</p>
          <p>Partners Invited: {results.invitations.success}/{results.invitations.total}</p>
          
          {results.invitations.links.length > 0 && (
            <div className="invitation-links">
              <h4>Partner Invitation Links (Run in Postman)</h4>
              <ul>
                {results.invitations.links.map((invite, i) => (
                  <li key={i}>
                    <strong>{invite.email}:</strong>
                    <br />
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

export default PartnerProvisioner;
```

### Collection Selector with Checklist

```javascript
import React, { useState, useEffect } from 'react';
import {
  getAvailableCollections,
  provisionCustomWorkspace
} from '@postman/workspace-sdk';

function CollectionSelector({ sourceWorkspaceId, targetWorkspaceId }) {
  const [collections, setCollections] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);

  useEffect(() => {
    const loadCollections = async () => {
      const data = await getAvailableCollections(sourceWorkspaceId);
      setCollections(data);
    };
    loadCollections();
  }, [sourceWorkspaceId]);

  const toggleCollection = (uid) => {
    setSelected(prev =>
      prev.includes(uid)
        ? prev.filter(id => id !== uid)
        : [...prev, uid]
    );
  };

  const selectAll = () => {
    setSelected(collections.map(c => c.uid));
  };

  const selectNone = () => {
    setSelected([]);
  };

  const handleProvision = async () => {
    if (selected.length === 0) {
      alert('Please select at least one collection');
      return;
    }

    setLoading(true);
    setResults(null);
    
    try {
      const result = await provisionCustomWorkspace({
        sourceWorkspaceId,
        targetWorkspaceId,
        copyCollections: true,
        copyMocks: true,
        copyEnvironments: false,
        copySpecs: false,
        createMockEnv: true,
        addAdmins: false,
        invitePartners: false,
        selectedCollectionUids: selected,
      }, (progressData) => {
        setProgress(progressData.progress);
      });

      setResults(result);
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="collection-selector">
      <h2>Select Collections to Copy</h2>
      
      <div className="actions">
        <button onClick={selectAll}>Select All</button>
        <button onClick={selectNone}>Select None</button>
        <span>{selected.length} of {collections.length} selected</span>
      </div>
      
      <div className="collection-list">
        {collections.map(collection => (
          <div key={collection.uid} className="collection-item">
            <label>
              <input
                type="checkbox"
                checked={selected.includes(collection.uid)}
                onChange={() => toggleCollection(collection.uid)}
              />
              <span className="name">{collection.name}</span>
            </label>
          </div>
        ))}
      </div>

      <button
        onClick={handleProvision}
        disabled={loading || selected.length === 0}
        className="provision-btn"
      >
        {loading ? `Provisioning... ${progress}%` : `Provision ${selected.length} Collection(s)`}
      </button>

      {results && (
        <div className="results">
          <h3>Success!</h3>
          <p>Copied {results.collections.success} collection(s)</p>
          <p>Created {results.mocks.success} mock server(s)</p>
          
          {Object.keys(results.mocks.urls).length > 0 && (
            <div className="mock-urls">
              <h4>Mock Server URLs:</h4>
              <ul>
                {Object.entries(results.mocks.urls).map(([name, url]) => (
                  <li key={name}>
                    <strong>{name}:</strong> <code>{url}</code>
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

export default CollectionSelector;
```

---

## Vue Integration Examples

### Composables Pattern

```javascript
// composables/usePostman.js
import { ref, onMounted } from 'vue';
import {
  PostmanClient,
  getAvailableCollections,
  getAvailableResources,
  provisionWorkspace,
} from '@postman/workspace-sdk';

export function useCollections(workspaceId) {
  const collections = ref([]);
  const loading = ref(true);
  const error = ref(null);

  onMounted(async () => {
    try {
      collections.value = await getAvailableCollections(workspaceId);
    } catch (err) {
      error.value = err;
    } finally {
      loading.value = false;
    }
  });

  return { collections, loading, error };
}

export function useProvisioning() {
  const loading = ref(false);
  const progress = ref(0);
  const status = ref('');
  const results = ref(null);

  const provision = async (options) => {
    loading.value = true;
    progress.value = 0;
    results.value = null;

    try {
      results.value = await provisionWorkspace(options, (p) => {
        progress.value = p.progress;
        status.value = p.message;
      });
    } finally {
      loading.value = false;
    }

    return results.value;
  };

  return { loading, progress, status, results, provision };
}
```

### Component Usage

```vue
<script setup>
import { ref, computed } from 'vue';
import { useCollections, useProvisioning } from '@/composables/usePostman';

const props = defineProps({
  sourceWorkspaceId: String,
  targetWorkspaceId: String,
});

const { collections, loading: loadingCollections } = useCollections(props.sourceWorkspaceId);
const { loading, progress, status, results, provision } = useProvisioning();

const selected = ref([]);

const toggleSelection = (uid) => {
  const idx = selected.value.indexOf(uid);
  if (idx > -1) {
    selected.value.splice(idx, 1);
  } else {
    selected.value.push(uid);
  }
};

const handleProvision = async () => {
  await provision({
    sourceWorkspaceId: props.sourceWorkspaceId,
    targetWorkspaceId: props.targetWorkspaceId,
    copyCollections: true,
    selectedCollectionUids: selected.value,
  });
};
</script>

<template>
  <div class="collection-selector">
    <div v-if="loadingCollections">Loading collections...</div>
    
    <div v-else>
      <div v-for="c in collections" :key="c.uid" class="collection-item">
        <input
          type="checkbox"
          :checked="selected.includes(c.uid)"
          @change="toggleSelection(c.uid)"
        />
        {{ c.name }}
      </div>
      
      <button @click="handleProvision" :disabled="loading || selected.length === 0">
        {{ loading ? `${progress}% - ${status}` : 'Provision Selected' }}
      </button>
    </div>
    
    <div v-if="results" class="results">
      <p>Copied {{ results.collections.success }} collections</p>
    </div>
  </div>
</template>
```

---

## Angular Integration Examples

### Service

```typescript
// postman.service.ts
import { Injectable } from '@angular/core';
import {
  PostmanClient,
  ProvisioningService,
  ResetService,
  getAvailableCollections,
  getAvailableResources,
} from '@postman/workspace-sdk';
import { from, Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class PostmanService {
  private client: PostmanClient;
  private provisioningService: ProvisioningService;
  
  progress$ = new BehaviorSubject<{ phase: string; message: string; progress: number }>({
    phase: '',
    message: '',
    progress: 0,
  });

  constructor() {
    this.client = new PostmanClient({ apiKey: environment.postmanApiKey });
    this.provisioningService = new ProvisioningService(this.client);
  }

  getCollections(workspaceId: string): Observable<any[]> {
    return from(getAvailableCollections(workspaceId));
  }

  getResources(workspaceId: string): Observable<any> {
    return from(getAvailableResources(workspaceId));
  }

  provision(options: any): Observable<any> {
    return from(
      this.provisioningService.provision(options, (progress) => {
        this.progress$.next(progress);
      })
    );
  }
}
```

### Component

```typescript
// provisioner.component.ts
import { Component, OnInit } from '@angular/core';
import { PostmanService } from './postman.service';

@Component({
  selector: 'app-provisioner',
  template: `
    <div class="provisioner">
      <h2>Workspace Provisioner</h2>
      
      <div *ngIf="collections$ | async as collections">
        <div *ngFor="let c of collections" class="collection-item">
          <input
            type="checkbox"
            [checked]="selected.includes(c.uid)"
            (change)="toggleCollection(c.uid)"
          />
          {{ c.name }}
        </div>
      </div>
      
      <div *ngIf="progress$ | async as progress" class="progress">
        <p>{{ progress.message }}</p>
        <div class="progress-bar">
          <div [style.width.%]="progress.progress"></div>
        </div>
      </div>
      
      <button (click)="provision()" [disabled]="loading">
        {{ loading ? 'Provisioning...' : 'Provision' }}
      </button>
    </div>
  `,
})
export class ProvisionerComponent implements OnInit {
  collections$ = this.postmanService.getCollections('source-workspace-id');
  progress$ = this.postmanService.progress$;
  selected: string[] = [];
  loading = false;

  constructor(private postmanService: PostmanService) {}

  ngOnInit() {}

  toggleCollection(uid: string) {
    const idx = this.selected.indexOf(uid);
    if (idx > -1) {
      this.selected.splice(idx, 1);
    } else {
      this.selected.push(uid);
    }
  }

  provision() {
    this.loading = true;
    this.postmanService.provision({
      sourceWorkspaceId: 'source-workspace-id',
      workspaceName: 'New Partner Workspace',
      selectedCollectionUids: this.selected,
    }).subscribe({
      next: (result) => {
        console.log('Provisioned:', result);
        this.loading = false;
      },
      error: (err) => {
        console.error('Error:', err);
        this.loading = false;
      },
    });
  }
}
```

---

## API Reference

### Progress Callback

All functions accept a progress callback:

```javascript
(progress) => {
  progress.phase      // Current phase: 'validation' | 'workspace' | 'collections' | 
                      // 'mocks' | 'environments' | 'mockEnv' | 'updateCollectionVars' |
                      // 'specs' | 'admins' | 'partners' | 'complete' | 'error'
  progress.message    // Human-readable status message
  progress.progress   // Overall progress percentage (0-100)
  progress.current    // Current item number (for lists)
  progress.total      // Total items (for lists)
  progress.currentItem // Name of current item
  progress.deleted    // Number deleted (reset operations)
}
```

### Error Handling

```javascript
try {
  const results = await provisionWorkspace({
    sourceWorkspaceId: 'source-id',
    workspaceName: 'My Workspace',
    partnerEmails: ['partner@company.com'],
  }, (progress) => console.log(progress));

  // Check for partial failures
  if (results.errors.length > 0) {
    console.warn('Some operations failed:', results.errors);
  }

  // Check specific success counts
  console.log(`Collections: ${results.collections.success}/${results.collections.total}`);
  console.log(`Partners: ${results.invitations.success}/${results.invitations.total}`);
  
  // Get invitation links for successful invitations
  for (const invite of results.invitations.links) {
    console.log(`Send to ${invite.email}: ${invite.link}`);
  }
  
} catch (error) {
  console.error('Provisioning failed:', error.message);
}
```

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
| 6 | Mock Environment | Create fresh env with mock server URLs (e.g., `directDebitsApiBaseUrl`) |
| 7 | Update Collection Variables | Patch forked collections to reference mock env variables |
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

### Update Workflow

Detects and adds new assets from source to an existing partner workspace without modifying existing assets:

| Step | Phase | Description |
|------|-------|-------------|
| 1 | Detection | Compare source and target workspaces (fork-check then name-match for collections, name-match for specs/environments) |
| 2 | Fork Collections | Fork new collections from source to target |
| 3 | Mock Servers | Create mock servers for each new collection |
| 4 | Mock Environment | Update existing "Mock Env" in-place with new mock URL variables (or create fresh if not found) |
| 5 | Collection Variables | PATCH new collection host variables to reference mock env variables |
| 6 | API Specs | Copy new specification files |
| 7 | Environments | Copy new environments (excludes "Mock Env") |

### Rate Limiting

The SDK includes automatic delays between API calls:

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
- Check that the workspace hasn't been deleted

#### "Failed to add admin"
- Verify the user ID is correct
- Ensure the user is part of your Postman team
- Check that you have permission to add admins

#### "Failed to invite partner"
- Verify the email address format
- Check that your team has Partner Workspaces enabled
- Ensure you have permission to invite partners

#### "Spec files not copying"
- Confirm specs exist in source workspace
- Check that spec files have content
- Verify spec type is supported (OPENAPI:3.0, OPENAPI:3.1, ASYNCAPI:2.0)

### Partner Role Reference

| Role ID | Name | Description |
|---------|------|-------------|
| `4` | Partner Viewer | Read-only access to workspace |
| `7` | Editor and Partner Lead | Full editing access with partner lead privileges |

### Debug Mode

Enable detailed logging:

```javascript
// Check configuration
import { getConfigurationStatus } from '@postman/workspace-sdk';

const status = getConfigurationStatus();
console.log('Configuration:', status);

// Verbose progress logging
await provisionWorkspace(options, (progress) => {
  console.log('[DEBUG]', JSON.stringify(progress, null, 2));
});
```

### Getting Help

- Check the [Postman API Documentation](https://www.postman.com/postman/workspace/postman-public-workspace/documentation)
- Review error messages carefully - they often indicate the exact issue
- Ensure your Postman plan supports Partner Workspaces

---

## License

ISC
