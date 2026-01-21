# Postman Workspace Provisioning Tools

Comprehensive tooling for automated Postman partner workspace provisioning and management. Available in two versions:
- **CLI Version**: Command-line scripts for manual workspace operations
- **Web Version**: JavaScript library for integration into web applications

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Version 1: CLI Scripts](#version-1-cli-scripts)
  - [Setup](#cli-setup)
  - [Usage](#cli-usage)
  - [Configuration](#cli-configuration)
  - [Example Workflows](#cli-example-workflows)
- [Version 2: Web Library](#version-2-web-library)
  - [Setup](#web-setup)
  - [Available Functions](#available-functions)
  - [Provisioning Functions](#provisioning-functions)
  - [Reset Functions](#reset-functions)
  - [Team & Partner Management](#team--partner-management-functions)
  - [Helper Functions](#helper-functions)
  - [React Integration Examples](#react-integration-examples)
- [API Reference](#api-reference)
- [Workflow Details](#workflow-details)
- [Troubleshooting](#troubleshooting)

---

## Overview

These tools automate the process of creating and managing Postman partner workspaces. They handle the complete provisioning workflow from workspace creation through asset copying to team/partner management.

### Complete Provisioning Workflow

```
1. Workspace Creation     -> Create new partner workspace (or use existing)
2. Copy Collections       -> Fork all collections from source workspace
3. Create Mock Servers    -> Generate mock servers for each collection
4. Copy Environments      -> Duplicate environment configurations
5. Update Mock Env        -> Create/update "Mock Env" with mock server URLs
6. Copy API Specs         -> Transfer all API specification files
7. Add Team Admins        -> Add internal team members as workspace admins
8. Invite Partners        -> Send partner invitations with invitation links
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
- **Team member management** (add admins)
- **Partner invitation with "Run in Postman" links**

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

### Flexible Configuration
- Use existing workspaces or create new ones
- Environment variable configuration
- Partner/team/private workspace types
- Configurable partner roles

### Robust Error Handling
- Detailed error logging
- Progress callbacks
- Rate limit management
- Partial failure handling

---

## Installation

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

---

## Version 1: CLI Scripts

Command-line tools for interactive workspace management. Best for manual operations and testing.

### CLI Setup

1. **Create `.env` file** in the project root (copy from `.env-example`):

```env
# Required
POSTMAN_API_KEY=PMAK-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
POSTMAN_SOURCE_WORKSPACE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Optional - Target Workspace
POSTMAN_TARGET_WORKSPACE_ID=           # Leave empty to create new workspace
POSTMAN_WORKSPACE_NAME=Partner Workspace

# Optional - Team Members & Partners
POSTMAN_ADMIN_USER_IDS=12345,67890     # Comma-separated user IDs to add as admins
PARTNER_EMAILS=partner1@company.com,partner2@company.com  # Comma-separated emails
PARTNER_ROLE_ID=7                       # 4=Partner Viewer, 7=Editor and Partner Lead
```

2. **Get your Postman API Key**:
   - Go to [Postman Account Settings](https://go.postman.co/settings/me/api-keys)
   - Click "Generate API Key"
   - Copy the key to your `.env` file

3. **Get Workspace IDs**:
   - Open Postman
   - Navigate to your workspace
   - Go to Workspace Settings > Workspace ID
   - Or copy from URL: `https://app.getpostman.com/workspace/<WORKSPACE_ID>`

4. **Get User IDs for Admins**:
   - User IDs can be found via Postman API or team management

### CLI Usage

#### Provisioning a Workspace

```bash
# Run the provisioning script
npm run provision

# Or directly with Node
node provision.js
```

**Interactive Flow:**
- If no target workspace ID is configured, you'll be prompted for a new workspace name
- Review the configuration
- Confirm to start provisioning
- View summary with mock URLs and partner invitation links

**With Flags:**
```bash
# Skip interactive prompts and use .env configuration
node provision.js --yes
```

**Example Output:**

```
════════════════════════════════════════════════════════════
Provisioning Complete!
════════════════════════════════════════════════════════════

Target Workspace: Partner Workspace
  ID: abc-123-def-456
  Status: Created new

Results Summary:
  Collections:  3/3 copied
  Mock Servers: 3/3 created
  Environments: 2/2 copied
  Mock Env:     created
  Specs:        1/1 copied
  Admins:       2/2 added
  Partners:     2/2 invited

Mock Server URLs:
  Collection A: https://abc123.mock.pstmn.io
  Collection B: https://def456.mock.pstmn.io

Partner Invitation Links (Run in Postman):
  partner1@company.com:
    https://app.getpostman.com/join-team?invite_code=xxxxx
  partner2@company.com:
    https://app.getpostman.com/join-team?invite_code=yyyyy

════════════════════════════════════════════════════════════
```

#### Resetting a Workspace

```bash
# Run the reset script
npm run reset

# Or directly with Node
node reset.js
```

**Interactive Flow:**
- If no target workspace ID is configured, you'll be prompted to enter one
- Review what will be deleted
- Type "RESET" to confirm

**With Flags:**
```bash
# Skip confirmation prompt (use with caution!)
node reset.js --yes
```

### CLI Configuration

#### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTMAN_API_KEY` | Yes | Your Postman API key |
| `POSTMAN_SOURCE_WORKSPACE_ID` | Yes | Source workspace to copy from |
| `POSTMAN_TARGET_WORKSPACE_ID` | No | Target workspace (creates new if not provided) |
| `POSTMAN_WORKSPACE_NAME` | No | Name for new workspace (default: "Partner Workspace") |
| `POSTMAN_ADMIN_USER_IDS` | No | Comma-separated user IDs to add as workspace admins |
| `PARTNER_EMAILS` | No | Comma-separated partner emails to invite |
| `PARTNER_ROLE_ID` | No | Partner role ID (default: "7" - Editor and Partner Lead) |

#### Partner Role Reference

| Role ID | Name | Description |
|---------|------|-------------|
| `4` | Partner Viewer | Read-only access to workspace |
| `7` | Editor and Partner Lead | Full editing access with partner lead privileges |

#### Command Line Options

**Provision Script:**
- `--yes`: Skip interactive prompts

**Reset Script:**
- `--yes`: Skip confirmation prompt
- `--workspace-id <id>`: Override target workspace ID

### CLI Example Workflows

#### Create a New Partner Workspace with Full Setup

```bash
# 1. Configure .env with all options
POSTMAN_API_KEY=PMAK-...
POSTMAN_SOURCE_WORKSPACE_ID=abc-123
POSTMAN_WORKSPACE_NAME=Acme Corp Partner Workspace
POSTMAN_ADMIN_USER_IDS=12345678,87654321
PARTNER_EMAILS=john@acme.com,jane@acme.com
PARTNER_ROLE_ID=7

# 2. Run provisioning
npm run provision

# 3. Share invitation links with partners
```

#### Use Existing Target Workspace

```bash
# 1. Configure .env with both workspaces
POSTMAN_API_KEY=PMAK-...
POSTMAN_SOURCE_WORKSPACE_ID=abc-123
POSTMAN_TARGET_WORKSPACE_ID=def-456

# 2. Run provisioning (no prompts needed)
npm run provision
```

#### Copy Assets Only (No Team/Partner Management)

```bash
# 1. Configure .env without admin/partner config
POSTMAN_API_KEY=PMAK-...
POSTMAN_SOURCE_WORKSPACE_ID=abc-123
POSTMAN_WORKSPACE_NAME=My Workspace
# Leave POSTMAN_ADMIN_USER_IDS and PARTNER_EMAILS empty

# 2. Run provisioning (steps 6-7 will be skipped)
npm run provision
```

---

## Version 2: Web Library

JavaScript module for programmatic workspace management. Perfect for integrating into web applications, dashboards, or automation systems.

### Web Setup

1. **Install as a dependency** or copy `postmanService.js` to your project

2. **Configure environment variables** (same as CLI - uses unified variable names):

```env
# Same variables work for both CLI and Web
POSTMAN_API_KEY=your_api_key_here
POSTMAN_SOURCE_WORKSPACE_ID=your_source_workspace_id
POSTMAN_TARGET_WORKSPACE_ID=your_target_workspace_id (optional)
```

**For Vite projects**, you can either:
- Use a `vite.config.js` to expose these variables, OR
- Use `VITE_` prefix (e.g., `VITE_POSTMAN_API_KEY`) - the library supports both

3. **Import the module**:

```javascript
import {
  // Provisioning Functions
  provisionWorkspace,
  provisionCustomWorkspace,
  
  // Reset Functions
  resetWorkspace,
  resetCustomWorkspace,
  
  // Team & Partner Management
  getWorkspaceRoles,
  addWorkspaceAdmin,
  removeWorkspaceUser,
  addMultipleAdmins,
  invitePartner,
  removePartner,
  removePartnerFromTeam,
  inviteMultiplePartners,
  removeMultiplePartners,
  
  // Helper Functions
  getAvailableCollections,
  getAvailableResources,
  validateApiKey,
  getWorkspace,
  getWorkspaceSummary,
  getConfigurationStatus,
} from './postmanService.js';
```

---

### Available Functions

#### Function Overview

| Category | Function | Purpose |
|----------|----------|---------|
| **Provisioning** | `provisionWorkspace()` | Complete provisioning with all assets |
| **Provisioning** | `provisionCustomWorkspace()` | Selective provisioning with options |
| **Reset** | `resetWorkspace()` | Delete all/selected asset types |
| **Reset** | `resetCustomWorkspace()` | Delete specific items |
| **Team** | `addWorkspaceAdmin()` | Add a user as workspace admin |
| **Team** | `addMultipleAdmins()` | Batch add multiple admins |
| **Team** | `removeWorkspaceUser()` | Remove a user from workspace |
| **Partners** | `invitePartner()` | Invite a partner by email |
| **Partners** | `inviteMultiplePartners()` | Batch invite multiple partners |
| **Partners** | `removePartner()` | Remove partner from workspace |
| **Helper** | `getAvailableCollections()` | Get collections for UI checklist |
| **Helper** | `getAvailableResources()` | Get all resources for UI selection |

---

### Provisioning Functions

#### `provisionWorkspace()` - Full Provisioning

Copies all collections, creates mocks, copies environments, copies specs, adds admins, and invites partners.

```javascript
import { provisionWorkspace } from './postmanService.js';

const results = await provisionWorkspace({
  sourceWorkspaceId: 'source-workspace-id',
  workspaceName: 'My Partner Workspace',
  workspaceType: 'partner',  // 'partner' | 'team' | 'private'
  
  // Team & Partner Management (optional)
  adminUserIds: ['12345', '67890'],           // Add these users as admins
  partnerEmails: ['partner@company.com'],     // Invite these partners
  partnerRoleId: '7',                         // Partner role
}, (progress) => {
  console.log(`${progress.phase}: ${progress.message}`);
  console.log(`Progress: ${progress.progress}%`);
});

// Access results
console.log('Workspace:', results.workspace);
console.log('Collections copied:', results.collections.success);
console.log('Mocks created:', results.mocks.success);
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

#### `provisionCustomWorkspace()` - Selective Provisioning

Choose which asset types and specific items to copy.

```javascript
import { provisionCustomWorkspace } from './postmanService.js';

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
  adminUserIds?: string[],             // Users to add as admin
  partnerEmails?: string[],            // Partners to invite
  partnerRoleId?: string,              // Default: "7"
}
```

---

### Reset Functions

#### `resetWorkspace()` - Delete All/Selected Asset Types

```javascript
import { resetWorkspace } from './postmanService.js';

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

#### `resetCustomWorkspace()` - Delete Specific Items

```javascript
import { resetCustomWorkspace, getAvailableCollections } from './postmanService.js';

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

### Team & Partner Management Functions

These functions can be used independently for team and partner management.

#### Adding Workspace Admins

```javascript
import { addWorkspaceAdmin, addMultipleAdmins } from './postmanService.js';

// Add a single admin
const result = await addWorkspaceAdmin(
  'workspace-id',
  '12345678',    // User ID
  '3'            // Role ID (3 = Admin)
);

if (result.success) {
  console.log('Admin added:', result.userId);
}

// Add multiple admins
const results = await addMultipleAdmins(
  'workspace-id',
  ['12345', '67890', '11111'],
  (progress) => console.log(`Added ${progress.current}/${progress.total}`)
);

console.log('Successful:', results.filter(r => r.success).length);
console.log('Failed:', results.filter(r => !r.success));
```

#### Inviting Partners

```javascript
import { invitePartner, inviteMultiplePartners } from './postmanService.js';

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

#### Removing Users

```javascript
import { removeWorkspaceUser, removePartner } from './postmanService.js';

// Remove a user from workspace
await removeWorkspaceUser('workspace-id', 'user-id', '3');

// Remove a partner from workspace
await removePartner('workspace-id', 'partner-user-id');
```

#### Getting Workspace Roles

```javascript
import { getWorkspaceRoles } from './postmanService.js';

const roles = await getWorkspaceRoles('workspace-id');
console.log('Current workspace roles:', roles);
```

---

### Helper Functions

#### `getAvailableCollections(workspaceId)`

Returns collections formatted for checkbox/checklist UI.

```javascript
import { getAvailableCollections } from './postmanService.js';

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

#### `getAvailableResources(workspaceId)`

Returns ALL resource types at once.

```javascript
import { getAvailableResources } from './postmanService.js';

const resources = await getAvailableResources('workspace-id');

// Result:
// {
//   collections: [{ id, uid, name, selected: false }, ...],
//   environments: [{ id, uid, name, selected: false }, ...],
//   mocks: [{ id, uid, name, selected: false, collectionUid }, ...],
//   specs: [{ id, name, type, selected: false }, ...]
// }
```

#### Other Utility Functions

```javascript
// Validate API key
const { valid, user, error } = await validateApiKey();

// Get workspace details
const workspace = await getWorkspace(workspaceId);

// Get workspace summary
const summary = await getWorkspaceSummary(workspaceId);
// Returns: { workspaceId, counts: { collections, environments, mocks, apis }, items: {...} }

// Check configuration
const status = getConfigurationStatus();
// Returns: { hasApiKey, hasSourceWorkspace, hasTargetWorkspace, isConfigured, message }
```

---

### React Integration Examples

#### Complete Provisioning with Partner Links

```javascript
import React, { useState } from 'react';
import { provisionWorkspace } from './postmanService';

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
    <div>
      <h2>Partner Workspace Provisioning</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <label>
          Workspace Name:
          <input
            type="text"
            value={config.workspaceName}
            onChange={(e) => setConfig({...config, workspaceName: e.target.value})}
          />
        </label>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
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
      
      <div style={{ marginBottom: '20px' }}>
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
        <div style={{ marginTop: '20px' }}>
          <div>Status: {status}</div>
          <div>Progress: {progress}%</div>
        </div>
      )}
      
      {results && (
        <div style={{ marginTop: '20px' }}>
          <h3>Results</h3>
          <p>Workspace: {results.workspace?.name}</p>
          <p>Collections: {results.collections.success}/{results.collections.total}</p>
          <p>Mocks: {results.mocks.success}/{results.mocks.total}</p>
          <p>Admins Added: {results.admins.success}/{results.admins.total}</p>
          <p>Partners Invited: {results.invitations.success}/{results.invitations.total}</p>
          
          {results.invitations.links.length > 0 && (
            <div>
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

#### Collection Selector with Checklist

```javascript
import React, { useState, useEffect } from 'react';
import {
  getAvailableCollections,
  provisionCustomWorkspace
} from './postmanService';

function CollectionSelector() {
  const [collections, setCollections] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const loadCollections = async () => {
      const data = await getAvailableCollections('source-workspace-id');
      setCollections(data);
    };
    loadCollections();
  }, []);

  const toggleCollection = (uid) => {
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
    try {
      const results = await provisionCustomWorkspace({
        sourceWorkspaceId: 'source-workspace-id',
        targetWorkspaceId: 'target-workspace-id',
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
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Select Collections to Copy</h2>
      
      <div style={{ maxHeight: '400px', overflow: 'auto', border: '1px solid #ccc', padding: '10px' }}>
        {collections.map(collection => (
          <div key={collection.uid} style={{ marginBottom: '10px' }}>
            <label>
              <input
                type="checkbox"
                checked={selected.includes(collection.uid)}
                onChange={() => toggleCollection(collection.uid)}
              />
              <span style={{ marginLeft: '8px' }}>{collection.name}</span>
            </label>
          </div>
        ))}
      </div>

      <button
        onClick={handleProvision}
        disabled={loading || selected.length === 0}
        style={{ marginTop: '20px', padding: '10px 20px' }}
      >
        {loading ? `Provisioning... ${progress}%` : 'Provision Selected'}
      </button>
    </div>
  );
}

export default CollectionSelector;
```

---

## API Reference

### Progress Callback

All functions accept a progress callback:

```javascript
(progress) => {
  progress.phase      // Current phase: 'validation' | 'workspace' | 'collections' | 
                      // 'mocks' | 'environments' | 'mockEnv' | 'specs' | 
                      // 'admins' | 'partners' | 'complete' | 'error'
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

1. **Validation** -> Verify API key and workspaces
2. **Workspace** -> Create or verify target workspace
3. **Collections** -> Fork collections (basis for mocks)
4. **Mock Servers** -> Create for each collection
5. **Environments** -> Copy with original variables
6. **Mock Environment** -> Update/create with mock URLs
7. **API Specs** -> Copy specification files
8. **Admins** -> Add team members as workspace admins
9. **Partners** -> Invite partners and generate invitation links

### Reset Order

The reset follows reverse order to handle dependencies:

1. **API Specs** -> No dependencies
2. **Mock Servers** -> Depend on collections
3. **Environments** -> Independent
4. **Collections** -> Deleted last

### Rate Limiting

Both versions include automatic delays between API calls:
- Collections: 300ms delay
- Mocks: 300ms delay
- Environments: 300ms delay
- Specs: 500ms delay
- Admins: 300ms delay
- Partners: 300ms delay

---

## Troubleshooting

### Common Issues

#### "Invalid API key"
- Verify your API key is correct and hasn't expired
- Check that the key has appropriate permissions
- Generate a new key if needed

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

### Debug Mode

Enable detailed logging:

```javascript
// CLI - Set DEBUG environment variable
DEBUG=true npm run provision

// Web - Check browser console for detailed logs
```

### Getting Help

- Check the [Postman API Documentation](https://www.postman.com/postman/workspace/postman-public-workspace/documentation)
- Review error messages carefully - they often indicate the exact issue
- Ensure your Postman plan supports Partner Workspaces

---

## File Structure

```
fde-pw-creation-script/
├── provision.js         # CLI provisioning script
├── reset.js             # CLI reset script
├── postmanService.js    # Web library module
├── package.json         # Dependencies and scripts
├── .env                 # Configuration (create from .env-example)
├── .env-example         # Environment template
└── README.md            # This file
```

---

## License

[Your License Here]

## Contributing

[Contributing Guidelines Here]
