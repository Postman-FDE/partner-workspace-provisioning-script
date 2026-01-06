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
- [Version 2: Web Library](#version-2-web-library)
  - [Setup](#web-setup)
  - [Usage](#web-usage)
  - [API Reference](#web-api-reference)
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

✅ **Safe Reset Functionality**
- Dependency-aware deletion order
- Confirmation prompts (CLI only)
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

Command-line tools for interactive workspace management.

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
  provisionWorkspace,
  resetWorkspace,
  validateApiKey,
  getWorkspace,
} from './postmanService.js';
```

### Web Usage

#### Provisioning a Workspace

```javascript
// Basic example - create new workspace
const results = await provisionWorkspace({
  sourceWorkspaceId: 'source-workspace-id',
  workspaceName: 'My Partner Workspace',
  workspaceType: 'partner'
}, (progress) => {
  console.log(`${progress.phase}: ${progress.message}`);
  console.log(`Progress: ${progress.progress}%`);
});

console.log('Provisioning complete!', results);
```

```javascript
// Use existing workspace
const results = await provisionWorkspace({
  sourceWorkspaceId: 'source-workspace-id',
  targetWorkspaceId: 'existing-target-workspace-id',
}, (progress) => {
  console.log(`${progress.phase}: ${progress.message}`);
});
```

```javascript
// With React component
function WorkspaceProvisioner() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [results, setResults] = useState(null);

  const handleProvision = async () => {
    try {
      const result = await provisionWorkspace({
        sourceWorkspaceId: 'abc-123',
        workspaceName: 'New Workspace',
      }, (progressData) => {
        setProgress(progressData.progress);
        setStatus(progressData.message);
      });
      
      setResults(result);
    } catch (error) {
      console.error('Provisioning failed:', error);
    }
  };

  return (
    <div>
      <button onClick={handleProvision}>Provision Workspace</button>
      <div>Status: {status}</div>
      <div>Progress: {progress}%</div>
      {results && <pre>{JSON.stringify(results, null, 2)}</pre>}
    </div>
  );
}
```

#### Resetting a Workspace

```javascript
// Reset entire workspace
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
// Partial reset - only delete specific resources
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

```javascript
// With React component
function WorkspaceResetter() {
  const [status, setStatus] = useState('');
  const [results, setResults] = useState(null);

  const handleReset = async () => {
    if (!confirm('Are you sure? This will delete all resources!')) {
      return;
    }

    try {
      const result = await resetWorkspace(
        'workspace-id',
        (progressData) => {
          setStatus(progressData.message);
        }
      );
      
      setResults(result);
    } catch (error) {
      console.error('Reset failed:', error);
    }
  };

  return (
    <div>
      <button onClick={handleReset}>Reset Workspace</button>
      <div>Status: {status}</div>
      {results && <pre>{JSON.stringify(results, null, 2)}</pre>}
    </div>
  );
}
```

### Web API Reference

#### `provisionWorkspace(options, onProgress)`

Provisions a complete workspace with all resources.

**Parameters:**
```javascript
{
  sourceWorkspaceId: string,        // Required: Source workspace ID
  targetWorkspaceId?: string,       // Optional: Existing target workspace
  workspaceName?: string,           // Required if creating new workspace
  workspaceType?: string,           // Optional: 'partner' | 'team' | 'private' (default: 'partner')
}
```

**Progress Callback:**
```javascript
(progress) => {
  progress.phase      // Current phase: 'validation' | 'workspace' | 'collections' | 'mocks' | 'environments' | 'mockEnv' | 'specs' | 'complete' | 'error'
  progress.message    // Human-readable status message
  progress.progress   // Overall progress percentage (0-100)
  progress.current    // Current item number (for lists)
  progress.total      // Total items (for lists)
}
```

**Returns:**
```javascript
{
  workspace: object,           // Workspace details
  workspaceCreated: boolean,   // True if new workspace was created
  collections: {
    total: number,
    success: number,
    failed: array,
    successData: array
  },
  mocks: {
    total: number,
    success: number,
    failed: array,
    urls: array              // Mock server URLs
  },
  environments: {
    total: number,
    success: number,
    failed: array,
    successData: array
  },
  mockEnv: {
    success: boolean,
    action: 'created' | 'updated' | null
  },
  specs: {
    total: number,
    success: number,
    failed: array,
    successData: array
  },
  errors: array              // All errors encountered
}
```

#### `resetWorkspace(workspaceId, onProgress, options)`

Resets a workspace by deleting all resources.

**Parameters:**
```javascript
workspaceId: string                 // Required: Workspace ID to reset
onProgress: function                // Progress callback
options: {
  includeSpecs?: boolean,          // Default: true
  includeMocks?: boolean,          // Default: true
  includeEnvironments?: boolean,   // Default: true
  includeCollections?: boolean,    // Default: true
}
```

**Progress Callback:**
```javascript
(progress) => {
  progress.phase      // Current phase: 'specs' | 'mocks' | 'environments' | 'collections' | 'complete' | 'error'
  progress.message    // Human-readable status message
  progress.deleted    // Number of items deleted
  progress.total      // Total items to delete
  progress.currentItem // Name of current item being deleted
}
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
  errors: array
}
```

#### Utility Functions

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
├── reset.js            # CLI reset script
├── postmanService.js   # Web library module
├── package.json        # Dependencies and scripts
├── .env               # Configuration (create this)
└── README.md          # This file
```

---

## License

[Your License Here]

## Contributing

[Contributing Guidelines Here]
