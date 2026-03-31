# Postman Workspace Provisioning Tools — TypeScript

Comprehensive tooling for automated Postman partner workspace provisioning and management. This is a standalone, fully-typed TypeScript module that can be copied into any Node.js / TypeScript project.

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [CLI Usage](#cli-usage)
- [Library Usage](#library-usage)
  - [Available Functions](#available-functions)
  - [Provisioning Functions](#provisioning-functions)
  - [Reset Functions](#reset-functions)
  - [Update Functions](#update-functions)
  - [Team & Partner Management](#team--partner-management)
  - [Helper Functions](#helper-functions)
- [Type Reference](#type-reference)
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

### Update Workflow

Detects and adds new assets from a source workspace to an existing partner workspace:
1. Scan source and target workspaces for differences
2. Fork new collections to target workspace
3. Create mock servers for new collections
4. Update existing "Mock Env" with new mock URL variables (in-place)
5. Update new collection variables to reference mock env
6. Copy new API specs
7. Copy new environments

---

## Features

- **Full TypeScript types** — interfaces for all options, results, and callback parameters
- **Complete Workspace Provisioning** — collection forking, mock server creation, environment handling, mock environment creation, collection variable mapping, API spec copying, team member management, partner invitation with "Run in Postman" links
- **Mock Environment Creation** — always creates a fresh "Mock Env" with bare mock server URLs; detects host variables via request URL inspection with fallback to common variable names
- **Collection Variable Mapping** — after creating mock env variables, each forked collection is PATCHed to update its host variables to reference the corresponding mock env variable
- **Custom Selection Provisioning** — choose specific asset types and individual items
- **Workspace Update Detection** — scan for new collections, specs, and environments added to the source workspace; add them to partner workspace with full mock URL wiring without touching existing assets
- **Safe Reset Functionality** — dependency-aware deletion order, selective deletion
- **Flexible Configuration** — existing or new workspaces, env var config, multiple workspace types
- **Robust Error Handling** — typed progress callbacks, rate limit management, partial failure handling

---

## Installation

### Option 1: Copy the file

Copy `postmanService.ts` into your project and install dependencies:

```bash
npm install axios typescript @types/node
```

### Option 2: Use from this repository

```bash
cd dev-portal/typescript/script
npm install
```

### Compile and run

```bash
npx ts-node postmanService.ts
# or
npx tsx postmanService.ts
```

### Environment Configuration

Create a `.env` file (or set environment variables):

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

---

## CLI Usage

### Provisioning a Workspace

```bash
npx ts-node provision.ts

# Skip interactive prompts
npx ts-node provision.ts --yes
```

### Resetting a Workspace

```bash
npx ts-node reset.ts

# Skip confirmation prompt
npx ts-node reset.ts --yes
```

---

## Library Usage

### Import the Module

```typescript
import {
  provisionWorkspace,
  provisionCustomWorkspace,
  resetWorkspace,
  resetCustomWorkspace,
  validateApiKey,
  getWorkspace,
  getWorkspaceSummary,
  getAvailableCollections,
  getAvailableResources,
  addWorkspaceAdmin,
  addMultipleAdmins,
  invitePartner,
  inviteMultiplePartners,
  removePartner,
  removeMultiplePartners,
  getConfigurationStatus,
} from './postmanService';

import type {
  ProvisionOptions,
  ProvisionResult,
  ResetOptions,
  ResetResult,
  ProgressCallback,
} from './postmanService';
```

---

### Available Functions

| Category | Function | Purpose |
|----------|----------|---------|
| **Provisioning** | `provisionWorkspace()` | Complete provisioning with all assets |
| **Provisioning** | `provisionCustomWorkspace()` | Selective provisioning with options |
| **Reset** | `resetWorkspace()` | Delete all/selected asset types |
| **Reset** | `resetCustomWorkspace()` | Delete specific items |
| **Update** | `updateWorkspaceAssets()` | Detect and add new assets from source to target |
| **Team** | `addWorkspaceAdmin()` | Add a user as workspace admin |
| **Team** | `addMultipleAdmins()` | Batch add multiple admins |
| **Partners** | `invitePartner()` | Invite a partner by email |
| **Partners** | `inviteMultiplePartners()` | Batch invite multiple partners |
| **Partners** | `removePartner()` | Remove partner from workspace |
| **Helper** | `getAvailableCollections()` | Get collections for UI checklist |
| **Helper** | `getAvailableResources()` | Get all resources for UI selection |
| **Helper** | `validateApiKey()` | Validate the configured API key |
| **Helper** | `getWorkspaceSummary()` | Get workspace content counts |

---

### Provisioning Functions

#### `provisionWorkspace()` — Full Provisioning

```typescript
import { provisionWorkspace, ProvisionOptions, ProgressCallback } from './postmanService';

const options: ProvisionOptions = {
  sourceWorkspaceId: 'source-workspace-id',
  workspaceName: 'My Partner Workspace',
  workspaceType: 'partner',
  adminUserIds: ['12345', '67890'],
  partnerEmails: ['partner@company.com'],
  partnerRoleId: '7',
};

const onProgress: ProgressCallback = (progress) => {
  console.log(`${progress.phase}: ${progress.message} (${progress.progress}%)`);
};

const results = await provisionWorkspace(options, onProgress);

console.log('Workspace:', results.workspace);
console.log('Collections copied:', results.collections.success);
console.log('Invitation links:', results.invitations.links);
```

#### `provisionCustomWorkspace()` — Selective Provisioning

```typescript
import { provisionCustomWorkspace, CustomProvisionOptions } from './postmanService';

const options: CustomProvisionOptions = {
  sourceWorkspaceId: 'source-workspace-id',
  targetWorkspaceId: 'target-workspace-id',
  copyCollections: true,
  copyEnvironments: true,
  copyMocks: true,
  copySpecs: false,
  createMockEnv: true,
  addAdmins: true,
  invitePartners: true,
  adminUserIds: ['12345'],
  partnerEmails: ['partner@company.com'],
  selectedCollectionUids: ['uid1', 'uid2'],
};

const results = await provisionCustomWorkspace(options, (progress) => {
  console.log(progress.message);
});
```

---

### Reset Functions

#### `resetWorkspace()` — Delete All/Selected Asset Types

```typescript
import { resetWorkspace, ResetOptions } from './postmanService';

const options: ResetOptions = {
  includeSpecs: true,
  includeMocks: true,
  includeEnvironments: false,
  includeCollections: false,
};

const results = await resetWorkspace(
  'workspace-id',
  (progress) => console.log(`${progress.phase}: ${progress.deleted}/${progress.total}`),
  options
);
```

---

### Update Functions

#### `updateWorkspaceAssets()` — Detect and Add New Assets

```typescript
import { updateWorkspaceAssets, UpdateOptions, ProgressCallback } from './postmanService';

const options: UpdateOptions = {
  sourceWorkspaceId: 'source-workspace-id',
  targetWorkspaceId: 'target-workspace-id',
};

const onProgress: ProgressCallback = (progress) => {
  console.log(`${progress.phase}: ${progress.message}`);
};

const results = await updateWorkspaceAssets(options, onProgress);

console.log('New collections:', results.newCollections.success);
console.log('New specs:', results.newSpecs.success);
console.log('New environments:', results.newEnvironments.success);
console.log('Mock Env updated:', results.updatedMockEnv?.newVarsAdded ?? 0, 'new variables');
```

---

### Team & Partner Management

```typescript
import { addWorkspaceAdmin, invitePartner, inviteMultiplePartners } from './postmanService';

// Add a single admin
await addWorkspaceAdmin('workspace-id', '12345678', '3');

// Invite a single partner
const result = await invitePartner('workspace-id', 'partner@company.com', '7');
console.log('Invitation Link:', result.invitationLink);

// Invite multiple partners
const results = await inviteMultiplePartners(
  'workspace-id',
  ['partner1@company.com', 'partner2@company.com'],
  '7',
  (progress) => console.log(`Invited ${progress.current}/${progress.total}`)
);
```

---

### Helper Functions

```typescript
import { validateApiKey, getWorkspaceSummary, getConfigurationStatus } from './postmanService';

const { valid, user } = await validateApiKey();
const summary = await getWorkspaceSummary('workspace-id');
const status = getConfigurationStatus();
```

---

## Type Reference

### Key Interfaces

```typescript
interface ProvisionOptions {
  sourceWorkspaceId: string;
  targetWorkspaceId?: string;
  workspaceName?: string;
  workspaceType?: string;
  adminUserIds?: string[];
  partnerEmails?: string[];
  partnerRoleId?: string;
}

interface ProvisionResult {
  workspace: object | null;
  workspaceCreated: boolean;
  collections: { total: number; success: number; failed: object[]; successData: object[] };
  mocks: { total: number; success: number; failed: object[]; urls: object[] };
  environments: { total: number; success: number; failed: object[]; successData: object[] };
  mockEnv: { success: boolean; action: string | null };
  specs: { total: number; success: number; failed: object[]; successData: object[] };
  admins: { total: number; success: number; failed: object[]; successData: object[] };
  invitations: { total: number; success: number; failed: object[]; links: object[] };
  errors: string[];
}

type ProgressCallback = (params: ProgressCallbackParams) => void;
```

See the full type definitions at the top of `postmanService.ts`.

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

### Update Order

1. **Detection** — Compare source and target workspaces (fork-check then name-match for collections, name-match for specs/environments)
2. **Fork Collections** — Fork new collections from source to target
3. **Mock Servers** — Create for each new collection
4. **Mock Environment** — Update existing "Mock Env" in-place with new mock URL variables (or create if missing)
5. **Collection Variables** — PATCH new collection host variables to reference mock env variables
6. **API Specs** — Copy new specification files
7. **Environments** — Copy new environments (excludes "Mock Env")

### Rate Limiting

Automatic delays between API calls: Collections (300ms), Mocks (300ms), Environments (300ms), Specs (500ms), Admins (300ms), Partners (300ms).

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid API key" | Verify key is correct, hasn't expired, and has proper permissions |
| "Workspace not found" | Confirm workspace IDs are correct and accessible |
| "Failed to add admin" | Verify user ID, ensure user is on your Postman team |
| "Failed to invite partner" | Check email format, ensure Partner Workspaces are enabled |
| "Spec files not copying" | Confirm specs exist in source, check supported types (OPENAPI:3.0, OPENAPI:3.1, ASYNCAPI:2.0) |
| TypeScript compilation errors | Ensure `strict: true` in tsconfig, install `@types/node` |

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
