# Postman Workspace Provisioning Tools

Comprehensive tooling for automated Postman workspace provisioning and management. Available in two versions:
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
  - [Copy All Functions](#copy-all-functions)
  - [Custom Selection Functions](#custom-selection-functions)
  - [Helper Functions](#helper-functions)
  - [React Integration Examples](#react-integration-examples)
- [API Reference](#api-reference)
- [Workflow Details](#workflow-details)
- [Troubleshooting](#troubleshooting)

---

## Overview

These tools automate the process of creating and managing Postman partner workspaces. They copy collections, create mock servers, manage environments, and transfer API specifications from a source workspace to a target workspace.

### Provisioning Workflow
1. **Copy Collections**: Fork all collections from source to target workspace
2. **Create Mock Servers**: Generate mock servers for each collection
3. **Copy Environments**: Duplicate environment configurations
4. **Update Mock Environment**: Create/update "Mock Env" with mock server URLs
5. **Copy API Specs**: Transfer all API specification files

### Reset Workflow
Deletes workspace resources in reverse order:
1. Delete API Specs
2. Delete Mock Servers
3. Delete Environments
4. Delete Collections

---

## Features

✅ **Complete Workspace Provisioning**
- Automated collection forking
- Mock server creation and URL management
- Environment variable handling
- Multi-file API specification copying

✅ **Custom Selection Provisioning**
- Choose specific asset types (Collections, Environments, Mocks, Specs)
- Select individual items from each category
- Build custom workflows for your specific needs

✅ **Safe Reset Functionality**
- Dependency-aware deletion order
- Confirmation prompts (CLI only)
- Selective deletion options
- Detailed error reporting

✅ **Flexible Configuration**
- Use existing workspaces or create new ones
- Environment variable configuration
- Partner/team/private workspace types

✅ **Robust Error Handling**
- Detailed error logging
- Progress callbacks
- Rate limit management

---

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd fde-pw-creation-script

# Install dependencies
npm install
```

---

## Version 1: CLI Scripts

Command-line tools for interactive workspace management. Best for manual operations and testing.

### CLI Setup

1. **Create `.env` file** in the project root:

```env
# Required
POSTMAN_API_KEY=your_api_key_here
POSTMAN_SOURCE_WORKSPACE_ID=your_source_workspace_id

# Optional (if not provided, will prompt/create new workspace)
POSTMAN_TARGET_WORKSPACE_ID=your_target_workspace_id
POSTMAN_WORKSPACE_NAME=My Partner Workspace
```

2. **Get your Postman API Key**:
   - Go to [Postman Account Settings](https://go.postman.co/settings/me/api-keys)
   - Click "Generate API Key"
   - Copy the key to your `.env` file

3. **Get Workspace IDs**:
   - Open Postman
   - Navigate to your workspace
   - Copy the ID from the URL: `https://app.getpostman.com/workspace/<WORKSPACE_ID>`

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

**With Flags:**
```bash
# Skip interactive prompts and use .env configuration
node provision.js --yes
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
| `POSTMAN_API_KEY` | ✅ Yes | Your Postman API key |
| `POSTMAN_SOURCE_WORKSPACE_ID` | ✅ Yes | Source workspace to copy from |
| `POSTMAN_TARGET_WORKSPACE_ID` | ❌ No | Target workspace (creates new if not provided) |
| `POSTMAN_WORKSPACE_NAME` | ❌ No | Name for new workspace (default: "Partner Workspace") |

#### Command Line Options

**Provision Script:**
- `--yes`: Skip interactive prompts
- `--workspace-id <id>`: Override target workspace ID
- `--workspace-name <name>`: Override workspace name

**Reset Script:**
- `--yes`: Skip confirmation prompt
- `--workspace-id <id>`: Override target workspace ID

### CLI Example Workflows

#### Create a New Partner Workspace

```bash
# 1. Configure .env with source workspace only
POSTMAN_API_KEY=PMAK-...
POSTMAN_SOURCE_WORKSPACE_ID=abc-123

# 2. Run provisioning
npm run provision

# 3. Follow prompts to name your new workspace
# Enter name for new workspace [Partner Workspace]: My New Workspace
# Proceed with provisioning? (Y/N): Y
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

#### Reset a Workspace

```bash
# Run reset
npm run reset

# Confirm by typing RESET
Type "RESET" to confirm: RESET
```

---

## Version 2: Web Library

JavaScript module for programmatic workspace management. Perfect for integrating into web applications, dashboards, or automation systems.

### Web Setup

1. **Install as a dependency** or copy `postmanService.js` to your project

2. **Configure environment variables** (for Vite/Create React App):

```env
VITE_POSTMAN_API_KEY=your_api_key_here
VITE_POSTMAN_SOURCE_WORKSPACE_ID=your_source_workspace_id
VITE_POSTMAN_TARGET_WORKSPACE_ID=your_target_workspace_id (optional)
```

3. **Import the module**:

```javascript
import {
  // Copy All Functions
  provisionWorkspace,
  resetWorkspace,
  
  // Custom Selection Functions
  provisionCustomWorkspace,
  resetCustomWorkspace,
  
  // Helper Functions
  getAvailableCollections,
  getAvailableResources,
  validateApiKey,
  getWorkspace,
  getWorkspaceSummary,
} from './postmanService.js';
```

---

### Available Functions

The web library provides two categories of functions:

| Category | Function | Purpose |
|----------|----------|---------|
| **Copy All** | `provisionWorkspace()` | Copy ALL assets from source workspace |
| **Copy All** | `resetWorkspace()` | Delete ALL assets in target workspace |
| **Custom** | `provisionCustomWorkspace()` | Select specific asset types and items |
| **Custom** | `resetCustomWorkspace()` | Delete specific asset types and items |
| **Helper** | `getAvailableCollections()` | Get collections for UI checklist |
| **Helper** | `getAvailableResources()` | Get all resources for UI selection |

---

### Copy All Functions

These functions copy or delete ALL assets without selection. Simple, one-call operations.

#### `provisionWorkspace()` - Copy All Assets

Copies all collections, creates mocks, copies environments, and copies specs automatically.

```javascript
import { provisionWorkspace } from './postmanService.js';

// Create new workspace with all assets
const results = await provisionWorkspace({
  sourceWorkspaceId: 'source-workspace-id',
  workspaceName: 'My Partner Workspace',
  workspaceType: 'partner'  // 'partner' | 'team' | 'private'
}, (progress) => {
  console.log(`${progress.phase}: ${progress.message}`);
  console.log(`Progress: ${progress.progress}%`);
});

console.log('Results:', results);
```

```javascript
// Use existing target workspace
const results = await provisionWorkspace({
  sourceWorkspaceId: 'source-workspace-id',
  targetWorkspaceId: 'existing-target-workspace-id',
}, (progress) => {
  console.log(`${progress.phase}: ${progress.message}`);
});
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
  errors: []
}
```

#### `resetWorkspace()` - Delete All Assets

Deletes all resources in reverse dependency order.

```javascript
import { resetWorkspace } from './postmanService.js';

// Delete ALL resources
const results = await resetWorkspace(
  'workspace-id-to-reset',
  (progress) => {
    console.log(`${progress.phase}: ${progress.message}`);
    console.log(`Deleted: ${progress.deleted}/${progress.total}`);
  }
);

console.log('Reset complete!', results);
```

```javascript
// Partial reset - choose asset types
const results = await resetWorkspace(
  'workspace-id',
  (progress) => console.log(progress),
  {
    includeSpecs: true,
    includeMocks: true,
    includeEnvironments: false,  // Keep environments
    includeCollections: false,   // Keep collections
  }
);
```

**Returns:**
```javascript
{
  deletedSpecs: number,
  deletedMocks: number,
  deletedEnvironments: number,
  deletedCollections: number,
  totalSpecs: number,
  totalMocks: number,
  totalEnvironments: number,
  totalCollections: number,
  errors: []
}
```

---

### Custom Selection Functions

These functions allow you to choose which asset types to copy/delete AND select specific items.

#### `provisionCustomWorkspace()` - Selective Provisioning

Copy specific asset types and/or specific items within each type.

**Example 1: Copy Only Collections and Environments (Skip Mocks & Specs)**

```javascript
import { provisionCustomWorkspace } from './postmanService.js';

const results = await provisionCustomWorkspace({
  sourceWorkspaceId: 'source-workspace-id',
  targetWorkspaceId: 'target-workspace-id',
  copyCollections: true,      // ✅ Copy collections
  copyEnvironments: true,     // ✅ Copy environments
  copyMocks: false,           // ❌ Skip mocks
  copySpecs: false,           // ❌ Skip specs
}, (progress) => {
  console.log(`${progress.phase}: ${progress.message}`);
});
```

**Example 2: Copy Specific Collections Only**

```javascript
import { getAvailableCollections, provisionCustomWorkspace } from './postmanService.js';

// Step 1: Get available collections (for UI checklist)
const availableCollections = await getAvailableCollections('source-workspace-id');
console.log(availableCollections);
// [{ id, uid, name, selected: false, metadata: {...} }, ...]

// Step 2: User selects specific collections (from UI)
const selectedUids = [
  availableCollections[0].uid,  // First collection
  availableCollections[2].uid,  // Third collection
];

// Step 3: Provision only selected collections
const results = await provisionCustomWorkspace({
  sourceWorkspaceId: 'source-workspace-id',
  targetWorkspaceId: 'target-workspace-id',
  copyCollections: true,
  copyMocks: true,                           // Create mocks for selected collections
  copyEnvironments: false,
  copySpecs: false,
  selectedCollectionUids: selectedUids,      // ⭐ Only copy these collections
}, (progress) => {
  console.log(progress);
});
```

**Example 3: Copy Collections + Specific Environments**

```javascript
import { getAvailableResources, provisionCustomWorkspace } from './postmanService.js';

// Get all available resources
const resources = await getAvailableResources('source-workspace-id');

// Select specific items
const selectedCollections = resources.collections
  .filter(c => c.name.includes('Authentication'))
  .map(c => c.uid);

const selectedEnvironments = resources.environments
  .filter(e => e.name.includes('Test'))
  .map(e => e.uid);

// Provision with selections
const results = await provisionCustomWorkspace({
  sourceWorkspaceId: 'source-workspace-id',
  workspaceName: 'Custom Workspace',  // Create new workspace
  copyCollections: true,
  copyEnvironments: true,
  copyMocks: true,
  copySpecs: false,
  selectedCollectionUids: selectedCollections,
  selectedEnvironmentUids: selectedEnvironments,
  createMockEnv: true,
}, (progress) => {
  console.log(`Progress: ${progress.progress}%`);
});
```

**Example 4: Copy Everything Except Specs**

```javascript
const results = await provisionCustomWorkspace({
  sourceWorkspaceId: 'source-workspace-id',
  targetWorkspaceId: 'target-workspace-id',
  copyCollections: true,
  copyEnvironments: true,
  copyMocks: true,
  copySpecs: false,  // ❌ Skip specs only
  createMockEnv: true,
}, (progress) => console.log(progress.message));
```

**Example 5: Copy Only Specs**

```javascript
const results = await provisionCustomWorkspace({
  sourceWorkspaceId: 'source-workspace-id',
  targetWorkspaceId: 'target-workspace-id',
  copyCollections: false,
  copyEnvironments: false,
  copyMocks: false,
  copySpecs: true,  // ✅ Only copy specs
}, (progress) => console.log(progress));
```

**Full Options:**
```javascript
{
  sourceWorkspaceId: string,        // Required: Source workspace ID
  targetWorkspaceId?: string,       // Optional: Existing target workspace
  workspaceName?: string,           // Required if creating new workspace
  workspaceType?: string,           // 'partner' | 'team' | 'private'
  copyCollections?: boolean,        // Default: true
  copyEnvironments?: boolean,       // Default: true
  copyMocks?: boolean,              // Default: true
  copySpecs?: boolean,              // Default: true
  selectedCollectionUids?: string[], // Specific collection UIDs to copy
  selectedEnvironmentUids?: string[], // Specific environment UIDs to copy
  selectedSpecIds?: string[],       // Specific spec IDs to copy
  createMockEnv?: boolean,          // Create/update Mock Env (default: true)
}
```

#### `resetCustomWorkspace()` - Selective Reset

Delete specific asset types and/or specific items within each type.

**Example 1: Delete Only Mocks and Specs (Keep Collections & Environments)**

```javascript
import { resetCustomWorkspace } from './postmanService.js';

const results = await resetCustomWorkspace(
  'workspace-id',
  (progress) => {
    console.log(`${progress.phase}: ${progress.deleted}/${progress.total}`);
  },
  {
    includeSpecs: true,         // ✅ Delete specs
    includeMocks: true,         // ✅ Delete mocks
    includeEnvironments: false, // ❌ Keep environments
    includeCollections: false,  // ❌ Keep collections
  }
);

console.log('Deleted:', results);
```

**Example 2: Delete Specific Collections Only**

```javascript
import { getAvailableCollections, resetCustomWorkspace } from './postmanService.js';

// Get collections in target workspace
const collections = await getAvailableCollections('target-workspace-id');

// Select specific collections to delete
const collectionsToDelete = collections
  .filter(c => c.name.includes('Old') || c.name.includes('Test'))
  .map(c => c.uid);

// Delete only selected collections
const results = await resetCustomWorkspace(
  'workspace-id',
  (progress) => console.log(progress),
  {
    includeCollections: true,
    includeEnvironments: false,
    includeMocks: false,
    includeSpecs: false,
    selectedCollectionUids: collectionsToDelete,  // ⭐ Only delete these
  }
);
```

**Example 3: Delete Test Environments Only**

```javascript
import { getAvailableResources, resetCustomWorkspace } from './postmanService.js';

const resources = await getAvailableResources('workspace-id');

// Select test environments to delete
const testEnvUids = resources.environments
  .filter(e => e.name.includes('Test'))
  .map(e => e.uid);

const results = await resetCustomWorkspace(
  'workspace-id',
  (progress) => console.log(progress),
  {
    includeEnvironments: true,
    selectedEnvironmentUids: testEnvUids,  // Only delete test environments
    includeCollections: false,
    includeMocks: false,
    includeSpecs: false,
  }
);
```

**Example 4: Clean Up Everything Except Production Collection**

```javascript
const allCollections = await getAvailableCollections('workspace-id');

// Keep only the production collection
const collectionsToDelete = allCollections
  .filter(c => c.name !== 'Production Collection')
  .map(c => c.uid);

const results = await resetCustomWorkspace(
  'workspace-id',
  (progress) => console.log(progress),
  {
    includeSpecs: true,
    includeMocks: true,
    includeEnvironments: true,
    includeCollections: true,
    selectedCollectionUids: collectionsToDelete,  // Delete all except production
  }
);
```

**Full Options:**
```javascript
{
  includeSpecs?: boolean,           // Default: true
  includeMocks?: boolean,           // Default: true
  includeEnvironments?: boolean,    // Default: true
  includeCollections?: boolean,     // Default: true
  selectedCollectionUids?: string[], // Specific collections to delete
  selectedEnvironmentUids?: string[], // Specific environments to delete
  selectedMockIds?: string[],       // Specific mocks to delete
  selectedSpecIds?: string[],       // Specific specs to delete
}
```

---

### Helper Functions

Functions to retrieve resources for building selection UIs.

#### `getAvailableCollections(workspaceId)`

Returns collections formatted for checkbox/checklist UI.

```javascript
import { getAvailableCollections } from './postmanService.js';

const collections = await getAvailableCollections('source-workspace-id');

console.log(collections);
// [
//   {
//     id: '12345',
//     uid: '12345678-abc-def',
//     name: 'Authentication Services',
//     selected: false,  // Default selection state for UI
//     metadata: {
//       createdAt: '2024-01-01T00:00:00Z',
//       updatedAt: '2024-01-15T00:00:00Z'
//     }
//   },
//   ...
// ]
```

#### `getAvailableResources(workspaceId)`

Returns ALL resource types at once for comprehensive UIs.

```javascript
import { getAvailableResources } from './postmanService.js';

const resources = await getAvailableResources('source-workspace-id');

console.log(resources);
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

#### Simple "Copy All" Button

```javascript
import React, { useState } from 'react';
import { provisionWorkspace } from './postmanService';

function SimpleProvisioner() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleProvision = async () => {
    setLoading(true);
    try {
      const result = await provisionWorkspace({
        sourceWorkspaceId: 'source-workspace-id',
        workspaceName: 'New Workspace',
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
      <h2>Quick Provision</h2>
      <button onClick={handleProvision} disabled={loading}>
        {loading ? 'Provisioning...' : 'Provision All Assets'}
      </button>
      
      {loading && (
        <div>
          <div>Status: {status}</div>
          <div>Progress: {progress}%</div>
        </div>
      )}
      
      {results && (
        <div>
          <h3>Results</h3>
          <p>Collections: {results.collections.success}/{results.collections.total}</p>
          <p>Mocks: {results.mocks.success}/{results.mocks.total}</p>
          <p>Environments: {results.environments.success}/{results.environments.total}</p>
          <p>Specs: {results.specs.success}/{results.specs.total}</p>
        </div>
      )}
    </div>
  );
}

export default SimpleProvisioner;
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
  const [status, setStatus] = useState('');

  // Load available collections
  useEffect(() => {
    const loadCollections = async () => {
      const data = await getAvailableCollections('source-workspace-id');
      setCollections(data);
    };
    loadCollections();
  }, []);

  // Toggle collection selection
  const toggleCollection = (uid) => {
    setSelected(prev =>
      prev.includes(uid)
        ? prev.filter(id => id !== uid)
        : [...prev, uid]
    );
  };

  // Select/Deselect all
  const toggleAll = () => {
    if (selected.length === collections.length) {
      setSelected([]);
    } else {
      setSelected(collections.map(c => c.uid));
    }
  };

  // Provision selected collections
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
        createMockEnv: true,
      }, (progressData) => {
        setProgress(progressData.progress);
        setStatus(progressData.message);
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
      
      {/* Select All Button */}
      <div style={{ marginBottom: '20px' }}>
        <button onClick={toggleAll}>
          {selected.length === collections.length ? 'Deselect All' : 'Select All'}
        </button>
        <span style={{ marginLeft: '10px' }}>
          {selected.length} of {collections.length} selected
        </span>
      </div>

      {/* Collection Checklist */}
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

      {/* Provision Button */}
      <div style={{ marginTop: '20px' }}>
        <button
          onClick={handleProvision}
          disabled={loading || selected.length === 0}
          style={{ padding: '10px 20px', fontSize: '16px' }}
        >
          {loading ? 'Provisioning...' : 'Provision Selected Collections'}
        </button>
      </div>

      {/* Progress Display */}
      {loading && (
        <div style={{ marginTop: '20px' }}>
          <div>Status: {status}</div>
          <div style={{ 
            width: '100%', 
            backgroundColor: '#f0f0f0', 
            height: '20px', 
            borderRadius: '10px' 
          }}>
            <div style={{
              width: `${progress}%`,
              backgroundColor: '#4CAF50',
              height: '100%',
              borderRadius: '10px',
              transition: 'width 0.3s'
            }} />
          </div>
          <div style={{ textAlign: 'center' }}>{progress}%</div>
        </div>
      )}
    </div>
  );
}

export default CollectionSelector;
```

#### Multi-Resource Selector (All Asset Types)

```javascript
import React, { useState, useEffect } from 'react';
import {
  getAvailableResources,
  provisionCustomWorkspace
} from './postmanService';

function MultiResourceSelector() {
  const [resources, setResources] = useState({
    collections: [],
    environments: [],
    specs: []
  });
  
  const [selected, setSelected] = useState({
    collections: [],
    environments: [],
    specs: []
  });

  const [options, setOptions] = useState({
    copyCollections: true,
    copyEnvironments: true,
    copyMocks: true,
    copySpecs: true,
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadResources = async () => {
      const data = await getAvailableResources('source-workspace-id');
      setResources(data);
    };
    loadResources();
  }, []);

  const toggleItem = (type, id) => {
    setSelected(prev => ({
      ...prev,
      [type]: prev[type].includes(id)
        ? prev[type].filter(item => item !== id)
        : [...prev[type], id]
    }));
  };

  const handleProvision = async () => {
    setLoading(true);
    try {
      await provisionCustomWorkspace({
        sourceWorkspaceId: 'source-workspace-id',
        targetWorkspaceId: 'target-workspace-id',
        ...options,
        selectedCollectionUids: selected.collections.length > 0 ? selected.collections : null,
        selectedEnvironmentUids: selected.environments.length > 0 ? selected.environments : null,
        selectedSpecIds: selected.specs.length > 0 ? selected.specs : null,
      }, (progress) => {
        console.log(progress);
      });
      alert('Provisioning complete!');
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Custom Workspace Provisioning</h2>

      {/* Asset Type Toggles */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5' }}>
        <h3>Select Asset Types to Copy</h3>
        <label style={{ marginRight: '20px' }}>
          <input
            type="checkbox"
            checked={options.copyCollections}
            onChange={(e) => setOptions({...options, copyCollections: e.target.checked})}
          />
          Collections
        </label>
        <label style={{ marginRight: '20px' }}>
          <input
            type="checkbox"
            checked={options.copyEnvironments}
            onChange={(e) => setOptions({...options, copyEnvironments: e.target.checked})}
          />
          Environments
        </label>
        <label style={{ marginRight: '20px' }}>
          <input
            type="checkbox"
            checked={options.copyMocks}
            onChange={(e) => setOptions({...options, copyMocks: e.target.checked})}
          />
          Mock Servers
        </label>
        <label>
          <input
            type="checkbox"
            checked={options.copySpecs}
            onChange={(e) => setOptions({...options, copySpecs: e.target.checked})}
          />
          API Specs
        </label>
      </div>

      {/* Resource Selection Lists */}
      <div style={{ display: 'flex', gap: '20px' }}>
        {/* Collections */}
        {options.copyCollections && (
          <div style={{ flex: 1 }}>
            <h4>Collections ({selected.collections.length} selected)</h4>
            <div style={{ maxHeight: '200px', overflow: 'auto', border: '1px solid #ddd', padding: '10px' }}>
              {resources.collections.map(c => (
                <div key={c.uid}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.collections.includes(c.uid)}
                      onChange={() => toggleItem('collections', c.uid)}
                    />
                    {c.name}
                  </label>
                </div>
              ))}
            </div>
            <small>Leave unchecked to copy all</small>
          </div>
        )}

        {/* Environments */}
        {options.copyEnvironments && (
          <div style={{ flex: 1 }}>
            <h4>Environments ({selected.environments.length} selected)</h4>
            <div style={{ maxHeight: '200px', overflow: 'auto', border: '1px solid #ddd', padding: '10px' }}>
              {resources.environments.map(e => (
                <div key={e.uid}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.environments.includes(e.uid)}
                      onChange={() => toggleItem('environments', e.uid)}
                    />
                    {e.name}
                  </label>
                </div>
              ))}
            </div>
            <small>Leave unchecked to copy all</small>
          </div>
        )}

        {/* Specs */}
        {options.copySpecs && (
          <div style={{ flex: 1 }}>
            <h4>API Specs ({selected.specs.length} selected)</h4>
            <div style={{ maxHeight: '200px', overflow: 'auto', border: '1px solid #ddd', padding: '10px' }}>
              {resources.specs.map(s => (
                <div key={s.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.specs.includes(s.id)}
                      onChange={() => toggleItem('specs', s.id)}
                    />
                    {s.name} ({s.type})
                  </label>
                </div>
              ))}
            </div>
            <small>Leave unchecked to copy all</small>
          </div>
        )}
      </div>

      <button 
        onClick={handleProvision} 
        disabled={loading}
        style={{ marginTop: '20px', padding: '10px 30px', fontSize: '16px' }}
      >
        {loading ? 'Provisioning...' : 'Provision Workspace'}
      </button>
    </div>
  );
}

export default MultiResourceSelector;
```

---

## API Reference

### Function Comparison Table

| Function | Copies | Selectable | Use Case |
|----------|--------|------------|----------|
| `provisionWorkspace()` | ALL assets | Asset types only | Quick full copy |
| `provisionCustomWorkspace()` | Selected assets | Types + Individual items | Custom workflows |
| `resetWorkspace()` | ALL assets | Asset types only | Full workspace reset |
| `resetCustomWorkspace()` | Selected assets | Types + Individual items | Targeted cleanup |

### Progress Callback

All functions accept a progress callback:

```javascript
(progress) => {
  progress.phase      // Current phase: 'validation' | 'workspace' | 'collections' | 'mocks' | 'environments' | 'mockEnv' | 'specs' | 'complete' | 'error'
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
  const results = await provisionCustomWorkspace({
    sourceWorkspaceId: 'source-id',
    targetWorkspaceId: 'target-id',
    copyCollections: true,
    selectedCollectionUids: ['uid1', 'uid2'],
  }, (progress) => console.log(progress));

  // Check for partial failures
  if (results.errors.length > 0) {
    console.warn('Some operations failed:', results.errors);
  }

  // Check success counts
  console.log(`Copied ${results.collections.success}/${results.collections.total} collections`);
  
} catch (error) {
  console.error('Provisioning failed:', error.message);
}
```

---

## Workflow Details

### Provisioning Order

The provisioning follows a specific order to ensure dependencies are met:

1. **Collections** → Forked first as basis for mocks
2. **Mock Servers** → Created for each collection
3. **Environments** → Copied with original variables
4. **Mock Environment** → Updated/created with mock URLs
5. **API Specs** → Copied last (no dependencies)

### Reset Order

The reset follows the reverse order to handle dependencies:

1. **API Specs** → Deleted first (no dependencies)
2. **Mock Servers** → Deleted before collections (depend on collections)
3. **Environments** → Deleted before clearing workspace
4. **Collections** → Deleted last

### Rate Limiting

Both versions include automatic delays between API calls:
- Collections: 300ms delay
- Mocks: 300ms delay
- Environments: 300ms delay
- Specs: 500ms delay (larger operations)

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

#### "Failed to create mock server"
- Verify the collection exists in the target workspace
- Check that the collection has requests (mocks need endpoints)
- Ensure you're not hitting rate limits

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
- Ensure your Postman plan supports the features you're using

---

## File Structure

```
fde-pw-creation-script/
├── provision.js         # CLI provisioning script
├── reset.js             # CLI reset script
├── postmanService.js    # Web library module
├── package.json         # Dependencies and scripts
├── .env                 # Configuration (create this)
└── README.md            # This file
```

---

## License

[Your License Here]

## Contributing

[Contributing Guidelines Here]
