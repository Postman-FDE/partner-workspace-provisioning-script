# Update Detection Logic — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `UpdateService` that scans source and target workspaces, detects net-new collections/specs/environments, and adds them to the partner workspace with full mock URL wiring.

**Architecture:** New `UpdateService` sits alongside existing `ProvisioningService` and `ResetService`. Reuses `PostmanClient` methods for all API calls. Detection uses fork-relationship matching (primary) with name-match fallback. Mock Env is patched in-place with new variables.

**Tech Stack:** JavaScript (ES modules), TypeScript, Python (async/await), Java (Spring WebFlux/Reactor)

**Spec:** `docs/superpowers/specs/2026-03-30-update-detection-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `dev-portal/javascript/sdk/src/services/UpdateService.js` | JS SDK — core update detection & processing logic |
| `dev-portal/typescript/sdk/src/services/UpdateService.ts` | TS SDK — typed update detection & processing |
| `dev-portal/python/sdk/postman_sdk/services/update_service.py` | Python SDK — async update detection & processing |
| `dev-portal/java/sdk/src/main/java/com/postman/sdk/services/UpdateService.java` | Java SDK — reactive update detection & processing |
| `cli/update.js` | CLI entry point — interactive update workflow |
| `update.js` | Root entry point — programmatic update (matches root `provision.js` / `reset.js`) |

### Modified Files

| File | Change |
|------|--------|
| `dev-portal/javascript/sdk/src/services/index.js` | Export `UpdateService` |
| `dev-portal/javascript/sdk/src/index.js` | Export `UpdateService` + convenience functions `updateWorkspace`, `updateCustomWorkspace` |
| `dev-portal/typescript/sdk/src/services/index.ts` | Export `UpdateService` + types |
| `dev-portal/typescript/sdk/src/index.ts` | Export `UpdateService` + types |
| `dev-portal/python/sdk/postman_sdk/__init__.py` | Export `UpdateService` |
| `dev-portal/java/sdk/src/main/java/com/postman/sdk/config/PostmanAutoConfiguration.java` | Register `UpdateService` bean |
| `dev-portal/javascript/script/postmanService.js` | Add `updateWorkspace()` function |
| `dev-portal/python/script/postman_service.py` | Add `update_workspace()` function |
| `dev-portal/java/script/PostmanService.java` | Add `updateWorkspace()` method |
| `package.json` | Add `npm run update` script |

---

## Task 1: JavaScript SDK — `UpdateService.js`

**Files:**
- Create: `dev-portal/javascript/sdk/src/services/UpdateService.js`
- Modify: `dev-portal/javascript/sdk/src/services/index.js`

This is the reference implementation. All other languages follow this logic.

- [ ] **Step 1: Create `UpdateService.js` with class skeleton and detection methods**

```javascript
// dev-portal/javascript/sdk/src/services/UpdateService.js

/**
 * @typedef {import('../client/PostmanClient.js').PostmanClient} PostmanClient
 * @typedef {import('../client/PostmanClient.js').Collection} Collection
 * @typedef {import('../client/PostmanClient.js').Environment} Environment
 * @typedef {import('../client/PostmanClient.js').Spec} Spec
 */

/**
 * @typedef {Object} UpdateOptions
 * @property {string} sourceWorkspaceId - Source workspace to detect new assets from
 * @property {string} targetWorkspaceId - Target partner workspace to update
 */

/**
 * @typedef {Object} UpdateResult
 * @property {{total: number, success: number, failed: Array, successData: Array}} newCollections
 * @property {{total: number, success: number, failed: Array, successData: Array}} newSpecs
 * @property {{total: number, success: number, failed: Array, successData: Array}} newEnvironments
 * @property {{uid: string, newVarsAdded: number}|null} updatedMockEnv
 * @property {Array} errors
 */

/**
 * @typedef {Object} ProgressEvent
 * @property {string} phase
 * @property {string} message
 * @property {number} progress
 * @property {number} [current]
 * @property {number} [total]
 * @property {string} [currentItem]
 */

const COMMON_HOST_VAR_NAMES = [
  'baseUrl', 'baseurl', 'base_url', 'HostName', 'hostname', 'host',
  'apiUrl', 'apiurl', 'api_url', 'serverUrl', 'serverurl', 'server_url',
];

/**
 * Update detection and processing service.
 * Scans source and target workspaces, detects net-new assets,
 * and adds them to the target with full mock URL wiring.
 */
export class UpdateService {
  /**
   * @param {PostmanClient} client
   */
  constructor(client) {
    this.client = client;
  }

  /**
   * Detect and add new assets from source to target workspace
   * @param {UpdateOptions} options
   * @param {function(ProgressEvent): void} [onProgress]
   * @returns {Promise<UpdateResult>}
   */
  async update(options, onProgress) {
    const { sourceWorkspaceId, targetWorkspaceId } = options;
    const result = this._initResult();
    const store = {
      collections: new Map(),
      mocks: new Map(),
    };

    try {
      // Phase 1: Validate
      this._emitProgress(onProgress, 'validation', 'Validating API key...', 0);
      const validation = await this.client.validateApiKey();
      if (!validation.valid) {
        throw new Error(`Invalid API key: ${validation.error}`);
      }

      // Phase 2: Detect new assets
      this._emitProgress(onProgress, 'detection', 'Scanning workspaces for new assets...', 10);
      const { newCollections, newSpecs, newEnvironments } = await this._detectNewAssets(
        sourceWorkspaceId, targetWorkspaceId
      );

      // Check if workspace is up to date
      if (newCollections.length === 0 && newSpecs.length === 0 && newEnvironments.length === 0) {
        this._emitProgress(onProgress, 'complete', 'Workspace is up to date — no new assets found.', 100);
        return result;
      }

      this._emitProgress(onProgress, 'detection',
        `Found ${newCollections.length} new collection(s), ${newSpecs.length} new spec(s), ${newEnvironments.length} new environment(s)`,
        20
      );

      // Phase 3: Fork new collections
      if (newCollections.length > 0) {
        this._emitProgress(onProgress, 'collections', 'Forking new collections...', 25);
        await this._forkNewCollections(newCollections, targetWorkspaceId, store, result, onProgress);
      }

      // Phase 4: Create mocks for new collections
      if (store.collections.size > 0) {
        this._emitProgress(onProgress, 'mocks', 'Creating mock servers...', 45);
        await this._createMocks(targetWorkspaceId, store, result, onProgress);
      }

      // Phase 5: Update Mock Env with new variables
      if (store.mocks.size > 0) {
        this._emitProgress(onProgress, 'mockEnv', 'Updating Mock Environment...', 60);
        const mockEnvVarMap = await this._updateMockEnv(targetWorkspaceId, store, result);

        // Phase 5b: Update new collection variables
        await this._updateCollectionVariables(store, mockEnvVarMap);
      }

      // Phase 6: Copy new specs
      if (newSpecs.length > 0) {
        this._emitProgress(onProgress, 'specs', 'Copying new API specs...', 75);
        await this._copyNewSpecs(newSpecs, targetWorkspaceId, result, onProgress);
      }

      // Phase 7: Copy new environments
      if (newEnvironments.length > 0) {
        this._emitProgress(onProgress, 'environments', 'Copying new environments...', 88);
        await this._copyNewEnvironments(newEnvironments, targetWorkspaceId, result, onProgress);
      }

      this._emitProgress(onProgress, 'complete', 'Update complete!', 100);

    } catch (error) {
      result.errors.push(error.message);
      this._emitProgress(onProgress, 'error', `Error: ${error.message}`, -1);
    }

    return result;
  }

  // ==================== Detection ====================

  /**
   * Detect new collections, specs, and environments in source that don't exist in target
   */
  async _detectNewAssets(sourceWorkspaceId, targetWorkspaceId) {
    // Fetch all assets from both workspaces in parallel
    const [sourceCollections, targetCollections, sourceSpecs, targetSpecs, sourceEnvs, targetEnvs] =
      await Promise.all([
        this.client.getCollections(sourceWorkspaceId),
        this.client.getCollections(targetWorkspaceId),
        this.client.getSpecs(sourceWorkspaceId),
        this.client.getSpecs(targetWorkspaceId),
        this.client.getEnvironments(sourceWorkspaceId),
        this.client.getEnvironments(targetWorkspaceId),
      ]);

    // Detect new collections (fork check + name fallback)
    const newCollections = await this._findNewCollections(sourceCollections, targetCollections);

    // Detect new specs (name match only)
    const targetSpecNames = new Set(targetSpecs.map(s => s.name));
    const newSpecs = sourceSpecs.filter(s => !targetSpecNames.has(s.name));

    // Detect new environments (name match, exclude "Mock Env")
    const targetEnvNames = new Set(targetEnvs.map(e => e.name));
    const newEnvironments = sourceEnvs.filter(
      e => e.name !== 'Mock Env' && !targetEnvNames.has(e.name)
    );

    return { newCollections, newSpecs, newEnvironments };
  }

  /**
   * Find source collections that don't exist in target.
   * Uses fork relationship (primary) then name match (fallback).
   */
  async _findNewCollections(sourceCollections, targetCollections) {
    // Build a set of source collection UIDs for fork checking
    const sourceUids = new Set(sourceCollections.map(c => c.uid));

    // Get fork info for target collections
    const targetForkSources = new Map(); // sourceUid -> targetCollection
    const targetNames = new Set();

    for (const tc of targetCollections) {
      targetNames.add(tc.name);

      // Get details to check fork.from
      const details = await this.client.getCollectionDetails(tc.uid);
      if (details?.fork?.from) {
        targetForkSources.set(details.fork.from, tc);
      }
      await this._delay(300);
    }

    // A source collection is "new" if:
    // 1. No target collection was forked from it (fork check)
    // 2. AND no target collection has the same name (name fallback)
    const newCollections = sourceCollections.filter(sc => {
      const hasForkedCopy = targetForkSources.has(sc.uid);
      const hasNameMatch = targetNames.has(sc.name);
      return !hasForkedCopy && !hasNameMatch;
    });

    return newCollections;
  }

  // ==================== Processing ====================

  async _forkNewCollections(newCollections, targetWorkspaceId, store, result, onProgress) {
    result.newCollections.total = newCollections.length;

    for (let i = 0; i < newCollections.length; i++) {
      const collection = newCollections[i];

      this._emitProgress(onProgress, 'collections', `Forking ${collection.name}...`, null, {
        current: i + 1,
        total: newCollections.length,
        currentItem: collection.name,
      });

      const forkResult = await this.client.forkCollection(collection.uid, collection.name, targetWorkspaceId);

      if (forkResult.success) {
        result.newCollections.success++;
        result.newCollections.successData.push({
          name: collection.name,
          sourceUid: collection.uid,
          targetUid: forkResult.collection.uid,
        });

        const collDetails = await this.client.getCollectionDetails(forkResult.collection.uid);
        let hostVariables = [];
        if (collDetails) {
          hostVariables = this._extractHostVariables(collDetails);
        }

        store.collections.set(collection.uid, {
          sourceUid: collection.uid,
          targetUid: forkResult.collection.uid,
          name: collection.name,
          hostVariables,
          collectionDetails: collDetails,
        });
      } else {
        result.newCollections.failed.push({
          name: collection.name,
          error: forkResult.error,
        });
      }

      await this._delay(300);
    }
  }

  async _createMocks(targetWorkspaceId, store, result, onProgress) {
    const collections = Array.from(store.collections.values());
    result.newCollections.total = Math.max(result.newCollections.total, collections.length);

    for (let i = 0; i < collections.length; i++) {
      const { targetUid, name } = collections[i];
      const mockName = `${name} Mock`;

      this._emitProgress(onProgress, 'mocks', `Creating ${mockName}...`, null, {
        current: i + 1,
        total: collections.length,
        currentItem: mockName,
      });

      const mockResult = await this.client.createMock(mockName, targetUid, targetWorkspaceId, false);

      if (mockResult.success) {
        store.mocks.set(targetUid, {
          mockId: mockResult.mock.id,
          mockUrl: mockResult.mock.mockUrl,
          name: mockName,
          collectionName: name,
        });
      } else {
        result.errors.push(`Failed to create mock for ${name}: ${mockResult.error}`);
      }

      await this._delay(300);
    }
  }

  /**
   * Update existing Mock Env in-place, or create one if it doesn't exist.
   */
  async _updateMockEnv(targetWorkspaceId, store, result) {
    const { variables: newMockVars, mockEnvVarMap } = this._generateMockUrlVariables(store);
    if (newMockVars.length === 0) {
      return mockEnvVarMap;
    }

    // Find existing Mock Env
    const envs = await this.client.getEnvironments(targetWorkspaceId);
    const mockEnv = envs.find(e => e.name === 'Mock Env');

    if (mockEnv) {
      // Get current variables and append new ones
      const details = await this.client.getEnvironmentDetails(mockEnv.uid);
      const existingVars = details?.values || [];

      // Check for duplicate variable names
      const existingKeys = new Set(existingVars.map(v => v.key));
      const deduplicatedNewVars = newMockVars.map(v => {
        if (existingKeys.has(v.key)) {
          let suffix = 2;
          let newKey = `${v.key}${suffix}`;
          while (existingKeys.has(newKey)) {
            suffix++;
            newKey = `${v.key}${suffix}`;
          }
          // Update the mockEnvVarMap to reflect the renamed key
          for (const [mapKey, mapVal] of mockEnvVarMap.entries()) {
            if (mapVal === v.key) {
              mockEnvVarMap.set(mapKey, newKey);
            }
          }
          return { ...v, key: newKey };
        }
        return v;
      });

      const mergedVars = [...existingVars, ...deduplicatedNewVars];
      await this.client.updateEnvironment(mockEnv.uid, 'Mock Env', mergedVars);

      result.updatedMockEnv = { uid: mockEnv.uid, newVarsAdded: deduplicatedNewVars.length };
    } else {
      // No Mock Env exists — create one from scratch
      const createResult = await this.client.createEnvironment('Mock Env', newMockVars, targetWorkspaceId);
      if (createResult.success) {
        result.updatedMockEnv = { uid: createResult.environment.uid, newVarsAdded: newMockVars.length };
      }
    }

    return mockEnvVarMap;
  }

  async _updateCollectionVariables(store, mockEnvVarMap) {
    if (!mockEnvVarMap || mockEnvVarMap.size === 0) return;

    for (const [, collData] of store.collections) {
      if (!collData.collectionDetails) continue;

      const hostVars = collData.hostVariables || [];
      const existingVars = collData.collectionDetails.variable || [];

      if (hostVars.length > 0) {
        const updatedVars = existingVars.map(v => {
          const hv = hostVars.find(h => h.varName === v.key);
          if (hv) {
            const envName = mockEnvVarMap.get(`${collData.targetUid}:${hv.varName}`);
            if (envName) return { ...v, value: `{{${envName}}}` };
          }
          return v;
        });
        for (const hv of hostVars) {
          const envName = mockEnvVarMap.get(`${collData.targetUid}:${hv.varName}`);
          if (envName && !updatedVars.some(v => v.key === hv.varName)) {
            updatedVars.push({ key: hv.varName, value: `{{${envName}}}`, type: 'string' });
          }
        }

        await this.client.patchCollectionVariables(collData.targetUid, updatedVars);
        await this._delay(300);
        continue;
      }

      // Fallback for collections without detected host variables
      const fallbackEnvName = mockEnvVarMap.get(`${collData.targetUid}:__fallback__`);
      if (!fallbackEnvName) continue;

      const commonVar = existingVars.find(v =>
        COMMON_HOST_VAR_NAMES.some(n => n.toLowerCase() === v.key.toLowerCase())
      );

      const updatedVars = commonVar
        ? existingVars.map(v =>
            v.key === commonVar.key ? { ...v, value: `{{${fallbackEnvName}}}` } : v
          )
        : [...existingVars, { key: 'baseUrl', value: `{{${fallbackEnvName}}}`, type: 'string' }];

      await this.client.patchCollectionVariables(collData.targetUid, updatedVars);
      await this._delay(300);
    }
  }

  async _copyNewSpecs(newSpecs, targetWorkspaceId, result, onProgress) {
    result.newSpecs.total = newSpecs.length;

    for (let i = 0; i < newSpecs.length; i++) {
      const spec = newSpecs[i];

      this._emitProgress(onProgress, 'specs', `Copying ${spec.name}...`, null, {
        current: i + 1,
        total: newSpecs.length,
        currentItem: spec.name,
      });

      try {
        const files = await this.client.getSpecFiles(spec.id);
        if (files.length === 0) {
          result.newSpecs.failed.push({ name: spec.name, error: 'No files found' });
          continue;
        }

        const filesWithContent = [];
        for (const file of files) {
          const fileData = await this.client.getSpecFile(spec.id, file.path);
          if (fileData?.content) {
            filesWithContent.push({ path: file.path, content: fileData.content, type: file.type });
          }
          await this._delay(200);
        }

        if (filesWithContent.length === 0) {
          result.newSpecs.failed.push({ name: spec.name, error: 'Could not retrieve file contents' });
          continue;
        }

        const createResult = await this.client.createSpec(targetWorkspaceId, spec.name, spec.type, filesWithContent);

        if (createResult.success) {
          result.newSpecs.success++;
          result.newSpecs.successData.push({
            name: spec.name,
            sourceId: spec.id,
            targetId: createResult.spec.id,
            filesCopied: filesWithContent.length,
          });
        } else {
          result.newSpecs.failed.push({ name: spec.name, error: createResult.error });
        }
      } catch (error) {
        result.newSpecs.failed.push({ name: spec.name, error: error.message });
      }

      await this._delay(500);
    }
  }

  async _copyNewEnvironments(newEnvironments, targetWorkspaceId, result, onProgress) {
    result.newEnvironments.total = newEnvironments.length;

    for (let i = 0; i < newEnvironments.length; i++) {
      const env = newEnvironments[i];

      this._emitProgress(onProgress, 'environments', `Copying ${env.name}...`, null, {
        current: i + 1,
        total: newEnvironments.length,
        currentItem: env.name,
      });

      const details = await this.client.getEnvironmentDetails(env.uid);
      if (!details) {
        result.newEnvironments.failed.push({ name: env.name, error: 'Could not fetch details' });
        continue;
      }

      const createResult = await this.client.createEnvironment(details.name, details.values || [], targetWorkspaceId);

      if (createResult.success) {
        result.newEnvironments.success++;
        result.newEnvironments.successData.push({
          name: details.name,
          sourceUid: env.uid,
          targetUid: createResult.environment.uid,
        });
      } else {
        result.newEnvironments.failed.push({ name: details.name, error: createResult.error });
      }

      await this._delay(300);
    }
  }

  // ==================== Helpers (same as ProvisioningService) ====================

  _generateMockUrlVariables(store) {
    const variables = [];
    const mockEnvVarMap = new Map();

    for (const [sourceUid, collData] of store.collections) {
      const mockData = Array.from(store.mocks.values()).find(m => m.collectionName === collData.name);
      if (!mockData) continue;

      const hostVars = collData.hostVariables || [];
      if (hostVars.length === 0) {
        const varName = this._toVariableName(collData.name) + 'BaseUrl';
        variables.push({ key: varName, value: mockData.mockUrl, type: 'default', enabled: true });
        mockEnvVarMap.set(`${collData.targetUid}:__fallback__`, varName);
        continue;
      }

      for (const hv of hostVars) {
        const envVarName = this._toVariableName(collData.name) + this._toPascalCase(hv.varName);
        variables.push({ key: envVarName, value: mockData.mockUrl, type: 'default', enabled: true });
        mockEnvVarMap.set(`${collData.targetUid}:${hv.varName}`, envVarName);
      }
    }

    return { variables, mockEnvVarMap };
  }

  _extractHostVariables(collection) {
    const hostVarNames = new Set();
    function traverse(items) {
      for (const item of items) {
        if (item.item) traverse(item.item);
        if (item.request?.url?.host) {
          for (const h of item.request.url.host) {
            const m = h.match(/^\{\{(.+)\}\}$/);
            if (m) hostVarNames.add(m[1]);
          }
        }
      }
    }
    traverse(collection.item || []);
    const collectionVars = collection.variable || [];

    const mapHostVar = varName => {
      const varDef = collectionVars.find(v => v.key === varName);
      const originalUrl = varDef?.value || '';
      const path = this._extractUrlPath(originalUrl);
      return { varName, originalUrl, path };
    };

    if (hostVarNames.size > 0) {
      const mapped = Array.from(hostVarNames).map(mapHostVar);
      const withProtocol = mapped.filter(hv => hv.originalUrl.includes('://'));
      if (withProtocol.length > 0) return withProtocol;
      return mapped.map(hv => ({ ...hv, path: '' }));
    }

    const common = [];
    for (const v of collectionVars) {
      if (COMMON_HOST_VAR_NAMES.some(n => n.toLowerCase() === v.key.toLowerCase())) {
        const originalUrl = v.value || '';
        common.push({
          varName: v.key,
          originalUrl,
          path: originalUrl.includes('://') ? this._extractUrlPath(originalUrl) : '',
        });
      }
    }
    return common;
  }

  _toVariableName(name) {
    const clean = name.replace(/[^a-zA-Z0-9\s]/g, '');
    const words = clean.split(/\s+/);
    return words.map((word, i) => {
      if (i === 0) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join('');
  }

  _toPascalCase(str) {
    return str
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  _extractUrlPath(urlString) {
    try {
      const url = new URL(urlString);
      return url.pathname === '/' ? '' : url.pathname;
    } catch {
      return '';
    }
  }

  _initResult() {
    return {
      newCollections: { total: 0, success: 0, failed: [], successData: [] },
      newSpecs: { total: 0, success: 0, failed: [], successData: [] },
      newEnvironments: { total: 0, success: 0, failed: [], successData: [] },
      updatedMockEnv: null,
      errors: [],
    };
  }

  _emitProgress(onProgress, phase, message, progress, extra = {}) {
    if (onProgress) {
      onProgress({ phase, message, progress, ...extra });
    }
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default UpdateService;
```

- [ ] **Step 2: Export from services index**

```javascript
// dev-portal/javascript/sdk/src/services/index.js
// Add this line:
export { UpdateService } from './UpdateService.js';
```

The file should become:

```javascript
export { WorkspaceService } from './WorkspaceService.js';
export { ProvisioningService } from './ProvisioningService.js';
export { ResetService } from './ResetService.js';
export { UpdateService } from './UpdateService.js';
```

- [ ] **Step 3: Add convenience functions to `index.js`**

Add these exports and functions to the end of `dev-portal/javascript/sdk/src/index.js`:

At the top, update the services import line:

```javascript
// Change the services export line to include UpdateService:
export { WorkspaceService, ProvisioningService, ResetService, UpdateService } from './services/index.js';
```

Add the import:

```javascript
import { UpdateService } from './services/UpdateService.js';
```

Add convenience functions at the end of the file:

```javascript
/**
 * Update workspace — detect and add new assets (convenience function)
 * @param {Object} options
 * @param {string} options.sourceWorkspaceId
 * @param {string} options.targetWorkspaceId
 * @param {function} [onProgress]
 * @returns {Promise<Object>}
 */
export async function updateWorkspace(options, onProgress) {
  const client = createClient();
  const service = new UpdateService(client);
  return service.update(options, onProgress);
}
```

- [ ] **Step 4: Verify the JS SDK builds**

Run: `cd dev-portal/javascript/sdk && npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add dev-portal/javascript/sdk/src/services/UpdateService.js dev-portal/javascript/sdk/src/services/index.js dev-portal/javascript/sdk/src/index.js
git commit -m "feat: add UpdateService to JavaScript SDK for workspace update detection"
```

---

## Task 2: TypeScript SDK — `UpdateService.ts`

**Files:**
- Create: `dev-portal/typescript/sdk/src/services/UpdateService.ts`
- Modify: `dev-portal/typescript/sdk/src/services/index.ts`
- Modify: `dev-portal/typescript/sdk/src/index.ts`

- [ ] **Step 1: Create `UpdateService.ts`**

This is the TypeScript version of the JS SDK's `UpdateService.js`. The logic is identical but with full type annotations. Key differences from JS version:

```typescript
// dev-portal/typescript/sdk/src/services/UpdateService.ts

import { PostmanClient } from '../client';
import {
  Collection,
  Environment,
  Spec,
  ProgressCallback,
  EnvironmentVariable,
  HostVariableInfo,
} from '../types';

const COMMON_HOST_VAR_NAMES = ['baseUrl', 'baseurl', 'base_url', 'HostName', 'hostname', 'host', 'apiUrl', 'apiurl', 'api_url', 'serverUrl', 'serverurl', 'server_url'];

export interface UpdateConfig {
  client: PostmanClient;
  sourceWorkspaceId: string;
  targetWorkspaceId: string;
  onProgress?: ProgressCallback;
}

export interface UpdateResult {
  newCollections: {
    total: number;
    success: number;
    failed: Array<{ name: string; error: string }>;
    successData: Array<{ name: string; sourceUid: string; targetUid: string }>;
  };
  newSpecs: {
    total: number;
    success: number;
    failed: Array<{ name: string; error: string }>;
    successData: Array<{ name: string; sourceId: string; targetId: string; filesCopied: number }>;
  };
  newEnvironments: {
    total: number;
    success: number;
    failed: Array<{ name: string; error: string }>;
    successData: Array<{ name: string; sourceUid: string; targetUid: string }>;
  };
  updatedMockEnv: { uid: string; newVarsAdded: number } | null;
  errors: string[];
}

interface CollectionStoreEntry {
  sourceUid: string;
  targetUid: string;
  name: string;
  hostVariables: HostVariableInfo[];
  collectionDetails: any;
}

interface MockStoreEntry {
  mockId: string;
  mockUrl: string;
  name: string;
  collectionName: string;
}

interface UpdateStore {
  collections: Map<string, CollectionStoreEntry>;
  mocks: Map<string, MockStoreEntry>;
}

export class UpdateService {
  private client: PostmanClient;

  constructor(client: PostmanClient) {
    this.client = client;
  }

  async update(options: { sourceWorkspaceId: string; targetWorkspaceId: string }, onProgress?: ProgressCallback): Promise<UpdateResult> {
    const { sourceWorkspaceId, targetWorkspaceId } = options;
    const result = this._initResult();
    const store: UpdateStore = {
      collections: new Map(),
      mocks: new Map(),
    };

    try {
      this._emitProgress(onProgress, 'validation', 'Validating API key...', 0);
      const validation = await this.client.validateApiKey();
      if (!validation.valid) {
        throw new Error(`Invalid API key: ${validation.error}`);
      }

      this._emitProgress(onProgress, 'detection', 'Scanning workspaces for new assets...', 10);
      const { newCollections, newSpecs, newEnvironments } = await this._detectNewAssets(
        sourceWorkspaceId, targetWorkspaceId
      );

      if (newCollections.length === 0 && newSpecs.length === 0 && newEnvironments.length === 0) {
        this._emitProgress(onProgress, 'complete', 'Workspace is up to date — no new assets found.', 100);
        return result;
      }

      this._emitProgress(onProgress, 'detection',
        `Found ${newCollections.length} new collection(s), ${newSpecs.length} new spec(s), ${newEnvironments.length} new environment(s)`,
        20
      );

      if (newCollections.length > 0) {
        this._emitProgress(onProgress, 'collections', 'Forking new collections...', 25);
        await this._forkNewCollections(newCollections, targetWorkspaceId, store, result, onProgress);
      }

      if (store.collections.size > 0) {
        this._emitProgress(onProgress, 'mocks', 'Creating mock servers...', 45);
        await this._createMocks(targetWorkspaceId, store, result, onProgress);
      }

      if (store.mocks.size > 0) {
        this._emitProgress(onProgress, 'mockEnv', 'Updating Mock Environment...', 60);
        const mockEnvVarMap = await this._updateMockEnv(targetWorkspaceId, store, result);
        await this._updateCollectionVariables(store, mockEnvVarMap);
      }

      if (newSpecs.length > 0) {
        this._emitProgress(onProgress, 'specs', 'Copying new API specs...', 75);
        await this._copyNewSpecs(newSpecs, targetWorkspaceId, result, onProgress);
      }

      if (newEnvironments.length > 0) {
        this._emitProgress(onProgress, 'environments', 'Copying new environments...', 88);
        await this._copyNewEnvironments(newEnvironments, targetWorkspaceId, result, onProgress);
      }

      this._emitProgress(onProgress, 'complete', 'Update complete!', 100);
    } catch (error: any) {
      result.errors.push(error.message);
      this._emitProgress(onProgress, 'error', `Error: ${error.message}`, -1);
    }

    return result;
  }

  // Detection, processing, and helper methods are identical in logic to JS version.
  // Copy all private methods from JS UpdateService, adding type annotations to parameters and returns.
  // The method bodies are the same — only signatures change.
  // Full implementation follows the same pattern as the JS version in Task 1 Step 1.

  private async _detectNewAssets(sourceWorkspaceId: string, targetWorkspaceId: string) {
    const [sourceCollections, targetCollections, sourceSpecs, targetSpecs, sourceEnvs, targetEnvs] =
      await Promise.all([
        this.client.getCollections(sourceWorkspaceId),
        this.client.getCollections(targetWorkspaceId),
        this.client.getSpecs(sourceWorkspaceId),
        this.client.getSpecs(targetWorkspaceId),
        this.client.getEnvironments(sourceWorkspaceId),
        this.client.getEnvironments(targetWorkspaceId),
      ]);

    const newCollections = await this._findNewCollections(sourceCollections, targetCollections);
    const targetSpecNames = new Set(targetSpecs.map((s: Spec) => s.name));
    const newSpecs = sourceSpecs.filter((s: Spec) => !targetSpecNames.has(s.name));
    const targetEnvNames = new Set(targetEnvs.map((e: Environment) => e.name));
    const newEnvironments = sourceEnvs.filter(
      (e: Environment) => e.name !== 'Mock Env' && !targetEnvNames.has(e.name)
    );

    return { newCollections, newSpecs, newEnvironments };
  }

  private async _findNewCollections(sourceCollections: Collection[], targetCollections: Collection[]): Promise<Collection[]> {
    const targetForkSources = new Map<string, Collection>();
    const targetNames = new Set<string>();

    for (const tc of targetCollections) {
      targetNames.add(tc.name);
      const details = await this.client.getCollectionDetails(tc.uid);
      if ((details as any)?.fork?.from) {
        targetForkSources.set((details as any).fork.from, tc);
      }
      await this._delay(300);
    }

    return sourceCollections.filter(sc => {
      const hasForkedCopy = targetForkSources.has(sc.uid);
      const hasNameMatch = targetNames.has(sc.name);
      return !hasForkedCopy && !hasNameMatch;
    });
  }

  private async _forkNewCollections(newCollections: Collection[], targetWorkspaceId: string, store: UpdateStore, result: UpdateResult, onProgress?: ProgressCallback): Promise<void> {
    result.newCollections.total = newCollections.length;

    for (let i = 0; i < newCollections.length; i++) {
      const collection = newCollections[i];
      this._emitProgress(onProgress, 'collections', `Forking ${collection.name}...`, null as any, {
        current: i + 1, total: newCollections.length, currentItem: collection.name,
      });

      const forkResult = await this.client.forkCollection(collection.uid, collection.name, targetWorkspaceId);

      if (forkResult.success) {
        result.newCollections.success++;
        result.newCollections.successData.push({
          name: collection.name, sourceUid: collection.uid, targetUid: forkResult.collection.uid,
        });

        const collDetails = await this.client.getCollectionDetails(forkResult.collection.uid);
        let hostVariables: HostVariableInfo[] = [];
        if (collDetails) {
          hostVariables = this._extractHostVariables(collDetails);
        }

        store.collections.set(collection.uid, {
          sourceUid: collection.uid, targetUid: forkResult.collection.uid,
          name: collection.name, hostVariables, collectionDetails: collDetails,
        });
      } else {
        result.newCollections.failed.push({ name: collection.name, error: forkResult.error });
      }

      await this._delay(300);
    }
  }

  private async _createMocks(targetWorkspaceId: string, store: UpdateStore, result: UpdateResult, onProgress?: ProgressCallback): Promise<void> {
    const collections = Array.from(store.collections.values());

    for (let i = 0; i < collections.length; i++) {
      const { targetUid, name } = collections[i];
      const mockName = `${name} Mock`;
      this._emitProgress(onProgress, 'mocks', `Creating ${mockName}...`, null as any, {
        current: i + 1, total: collections.length, currentItem: mockName,
      });

      const mockResult = await this.client.createMock(mockName, targetUid, targetWorkspaceId, false);

      if (mockResult.success) {
        store.mocks.set(targetUid, {
          mockId: mockResult.mock.id, mockUrl: mockResult.mock.mockUrl,
          name: mockName, collectionName: name,
        });
      } else {
        result.errors.push(`Failed to create mock for ${name}: ${mockResult.error}`);
      }
      await this._delay(300);
    }
  }

  private async _updateMockEnv(targetWorkspaceId: string, store: UpdateStore, result: UpdateResult): Promise<Map<string, string>> {
    const { variables: newMockVars, mockEnvVarMap } = this._generateMockUrlVariables(store);
    if (newMockVars.length === 0) return mockEnvVarMap;

    const envs = await this.client.getEnvironments(targetWorkspaceId);
    const mockEnv = envs.find((e: Environment) => e.name === 'Mock Env');

    if (mockEnv) {
      const details = await this.client.getEnvironmentDetails(mockEnv.uid);
      const existingVars: EnvironmentVariable[] = (details as any)?.values || [];
      const existingKeys = new Set(existingVars.map((v: EnvironmentVariable) => v.key));

      const deduplicatedNewVars = newMockVars.map(v => {
        if (existingKeys.has(v.key)) {
          let suffix = 2;
          let newKey = `${v.key}${suffix}`;
          while (existingKeys.has(newKey)) { suffix++; newKey = `${v.key}${suffix}`; }
          for (const [mapKey, mapVal] of mockEnvVarMap.entries()) {
            if (mapVal === v.key) { mockEnvVarMap.set(mapKey, newKey); }
          }
          return { ...v, key: newKey };
        }
        return v;
      });

      const mergedVars = [...existingVars, ...deduplicatedNewVars];
      await this.client.updateEnvironment(mockEnv.uid, 'Mock Env', mergedVars);
      result.updatedMockEnv = { uid: mockEnv.uid, newVarsAdded: deduplicatedNewVars.length };
    } else {
      const createResult = await this.client.createEnvironment('Mock Env', newMockVars, targetWorkspaceId);
      if (createResult.success) {
        result.updatedMockEnv = { uid: createResult.environment.uid, newVarsAdded: newMockVars.length };
      }
    }

    return mockEnvVarMap;
  }

  private async _updateCollectionVariables(store: UpdateStore, mockEnvVarMap: Map<string, string>): Promise<void> {
    if (!mockEnvVarMap || mockEnvVarMap.size === 0) return;

    for (const [, collData] of store.collections) {
      if (!collData.collectionDetails) continue;
      const hostVars = collData.hostVariables || [];
      const existingVars = collData.collectionDetails.variable || [];

      if (hostVars.length > 0) {
        const updatedVars = existingVars.map((v: any) => {
          const hv = hostVars.find(h => h.varName === v.key);
          if (hv) {
            const envName = mockEnvVarMap.get(`${collData.targetUid}:${hv.varName}`);
            if (envName) return { ...v, value: `{{${envName}}}` };
          }
          return v;
        });
        for (const hv of hostVars) {
          const envName = mockEnvVarMap.get(`${collData.targetUid}:${hv.varName}`);
          if (envName && !updatedVars.some((v: any) => v.key === hv.varName)) {
            updatedVars.push({ key: hv.varName, value: `{{${envName}}}`, type: 'string' });
          }
        }
        await this.client.patchCollectionVariables(collData.targetUid, updatedVars);
        await this._delay(300);
        continue;
      }

      const fallbackEnvName = mockEnvVarMap.get(`${collData.targetUid}:__fallback__`);
      if (!fallbackEnvName) continue;
      const commonVar = existingVars.find((v: any) =>
        COMMON_HOST_VAR_NAMES.some(n => n.toLowerCase() === v.key.toLowerCase())
      );
      const updatedVars = commonVar
        ? existingVars.map((v: any) => v.key === commonVar.key ? { ...v, value: `{{${fallbackEnvName}}}` } : v)
        : [...existingVars, { key: 'baseUrl', value: `{{${fallbackEnvName}}}`, type: 'string' }];
      await this.client.patchCollectionVariables(collData.targetUid, updatedVars);
      await this._delay(300);
    }
  }

  private async _copyNewSpecs(newSpecs: Spec[], targetWorkspaceId: string, result: UpdateResult, onProgress?: ProgressCallback): Promise<void> {
    result.newSpecs.total = newSpecs.length;

    for (let i = 0; i < newSpecs.length; i++) {
      const spec = newSpecs[i];
      this._emitProgress(onProgress, 'specs', `Copying ${spec.name}...`, null as any, {
        current: i + 1, total: newSpecs.length, currentItem: spec.name,
      });

      try {
        const files = await this.client.getSpecFiles(spec.id);
        if (files.length === 0) { result.newSpecs.failed.push({ name: spec.name, error: 'No files found' }); continue; }

        const filesWithContent: Array<{ path: string; content: string; type: string }> = [];
        for (const file of files) {
          const fileData = await this.client.getSpecFile(spec.id, file.path);
          if (fileData?.content) { filesWithContent.push({ path: file.path, content: fileData.content, type: file.type }); }
          await this._delay(200);
        }

        if (filesWithContent.length === 0) { result.newSpecs.failed.push({ name: spec.name, error: 'Could not retrieve file contents' }); continue; }

        const createResult = await this.client.createSpec(targetWorkspaceId, spec.name, spec.type as any, filesWithContent);

        if (createResult.success) {
          result.newSpecs.success++;
          result.newSpecs.successData.push({ name: spec.name, sourceId: spec.id, targetId: createResult.spec.id, filesCopied: filesWithContent.length });
        } else {
          result.newSpecs.failed.push({ name: spec.name, error: createResult.error });
        }
      } catch (error: any) {
        result.newSpecs.failed.push({ name: spec.name, error: error.message });
      }
      await this._delay(500);
    }
  }

  private async _copyNewEnvironments(newEnvironments: Environment[], targetWorkspaceId: string, result: UpdateResult, onProgress?: ProgressCallback): Promise<void> {
    result.newEnvironments.total = newEnvironments.length;

    for (let i = 0; i < newEnvironments.length; i++) {
      const env = newEnvironments[i];
      this._emitProgress(onProgress, 'environments', `Copying ${env.name}...`, null as any, {
        current: i + 1, total: newEnvironments.length, currentItem: env.name,
      });

      const details = await this.client.getEnvironmentDetails(env.uid);
      if (!details) { result.newEnvironments.failed.push({ name: env.name, error: 'Could not fetch details' }); continue; }

      const createResult = await this.client.createEnvironment(details.name, (details as any).values || [], targetWorkspaceId);

      if (createResult.success) {
        result.newEnvironments.success++;
        result.newEnvironments.successData.push({ name: details.name, sourceUid: env.uid, targetUid: createResult.environment.uid });
      } else {
        result.newEnvironments.failed.push({ name: details.name, error: createResult.error });
      }
      await this._delay(300);
    }
  }

  // Helper methods — identical logic to JS version
  private _generateMockUrlVariables(store: UpdateStore) {
    const variables: EnvironmentVariable[] = [];
    const mockEnvVarMap = new Map<string, string>();

    for (const [sourceUid, collData] of store.collections) {
      const mockData = Array.from(store.mocks.values()).find(m => m.collectionName === collData.name);
      if (!mockData) continue;

      const hostVars = collData.hostVariables || [];
      if (hostVars.length === 0) {
        const varName = this._toVariableName(collData.name) + 'BaseUrl';
        variables.push({ key: varName, value: mockData.mockUrl, type: 'default', enabled: true });
        mockEnvVarMap.set(`${collData.targetUid}:__fallback__`, varName);
        continue;
      }

      for (const hv of hostVars) {
        const envVarName = this._toVariableName(collData.name) + this._toPascalCase(hv.varName);
        variables.push({ key: envVarName, value: mockData.mockUrl, type: 'default', enabled: true });
        mockEnvVarMap.set(`${collData.targetUid}:${hv.varName}`, envVarName);
      }
    }

    return { variables, mockEnvVarMap };
  }

  private _extractHostVariables(collection: any): HostVariableInfo[] {
    const hostVarNames = new Set<string>();
    function traverse(items: any[]) {
      for (const item of items) {
        if (item.item) traverse(item.item);
        if (item.request?.url?.host) {
          for (const h of item.request.url.host) {
            const m = h.match(/^\{\{(.+)\}\}$/);
            if (m) hostVarNames.add(m[1]);
          }
        }
      }
    }
    traverse(collection.item || []);
    const collectionVars = collection.variable || [];

    const mapHostVar = (varName: string) => {
      const varDef = collectionVars.find((v: any) => v.key === varName);
      const originalUrl = varDef?.value || '';
      const path = this._extractUrlPath(originalUrl);
      return { varName, originalUrl, path };
    };

    if (hostVarNames.size > 0) {
      const mapped = Array.from(hostVarNames).map(mapHostVar);
      const withProtocol = mapped.filter(hv => hv.originalUrl.includes('://'));
      if (withProtocol.length > 0) return withProtocol;
      return mapped.map(hv => ({ ...hv, path: '' }));
    }

    const common: HostVariableInfo[] = [];
    for (const v of collectionVars) {
      if (COMMON_HOST_VAR_NAMES.some(n => n.toLowerCase() === v.key.toLowerCase())) {
        const originalUrl = v.value || '';
        common.push({ varName: v.key, originalUrl, path: originalUrl.includes('://') ? this._extractUrlPath(originalUrl) : '' });
      }
    }
    return common;
  }

  private _toVariableName(name: string): string {
    const clean = name.replace(/[^a-zA-Z0-9\s]/g, '');
    const words = clean.split(/\s+/);
    return words.map((word, i) => {
      if (i === 0) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join('');
  }

  private _toPascalCase(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[^a-zA-Z0-9]/g, ' ').split(/\s+/).filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join('');
  }

  private _extractUrlPath(urlString: string): string {
    try { const url = new URL(urlString); return url.pathname === '/' ? '' : url.pathname; } catch { return ''; }
  }

  private _initResult(): UpdateResult {
    return {
      newCollections: { total: 0, success: 0, failed: [], successData: [] },
      newSpecs: { total: 0, success: 0, failed: [], successData: [] },
      newEnvironments: { total: 0, success: 0, failed: [], successData: [] },
      updatedMockEnv: null,
      errors: [],
    };
  }

  private _emitProgress(onProgress: ProgressCallback | undefined, phase: string, message: string, progress: number, extra: Record<string, any> = {}): void {
    if (onProgress) { onProgress({ phase, message, progress, ...extra } as any); }
  }

  private _delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

- [ ] **Step 2: Update services index**

```typescript
// dev-portal/typescript/sdk/src/services/index.ts — add this line:
export { UpdateService, type UpdateConfig, type UpdateResult } from './UpdateService';
```

- [ ] **Step 3: Update main index**

Add to `dev-portal/typescript/sdk/src/index.ts` in the services export block:

```typescript
export {
  WorkspaceService,
  ProvisioningService,
  ResetService,
  UpdateService,
  type WorkspaceServiceConfig,
  type ProvisioningConfig,
  type ProvisioningResult,
  type ResetConfig,
  type ResetResult,
  type WorkspaceContents,
  type UpdateConfig,
  type UpdateResult,
} from './services';
```

- [ ] **Step 4: Verify TS SDK builds**

Run: `cd dev-portal/typescript/sdk && npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add dev-portal/typescript/sdk/src/services/UpdateService.ts dev-portal/typescript/sdk/src/services/index.ts dev-portal/typescript/sdk/src/index.ts
git commit -m "feat: add UpdateService to TypeScript SDK for workspace update detection"
```

---

## Task 3: Python SDK — `update_service.py`

**Files:**
- Create: `dev-portal/python/sdk/postman_sdk/services/update_service.py`
- Modify: `dev-portal/python/sdk/postman_sdk/__init__.py`

- [ ] **Step 1: Create `update_service.py`**

```python
# dev-portal/python/sdk/postman_sdk/services/update_service.py

"""
Update Service

Workspace update detection and processing workflow.
Scans source and target workspaces, detects net-new assets,
and adds them with full mock URL wiring.
"""

import asyncio
import re
from typing import Any, Callable
from urllib.parse import urlparse

from postman_sdk.client import PostmanClient
from postman_sdk.types import (
    Collection,
    Environment,
    Spec,
    EnvironmentVariable,
    ProgressEvent,
    CreateSpecFile,
    HostVariableInfo,
)

ProgressCallback = Callable[[ProgressEvent], None]

COMMON_HOST_VAR_NAMES = [
    "baseUrl", "baseurl", "base_url", "HostName", "hostname", "host",
    "apiUrl", "apiurl", "api_url", "serverUrl", "serverurl", "server_url",
]


class UpdateService:
    """Service for detecting and adding new assets to partner workspaces"""

    def __init__(
        self,
        client: PostmanClient,
        source_workspace_id: str,
        target_workspace_id: str,
        on_progress: ProgressCallback | None = None,
    ):
        self.client = client
        self.source_workspace_id = source_workspace_id
        self.target_workspace_id = target_workspace_id
        self.on_progress = on_progress

        # Internal state
        self._collection_store: dict[str, dict[str, Any]] = {}
        self._mock_store: dict[str, dict[str, Any]] = {}

    async def update(self) -> dict[str, Any]:
        """Run update detection and processing workflow"""
        result = self._init_result()

        try:
            # Phase 1: Validate
            self._emit_progress("validation", "Validating API key...")
            user = await self.client.validate_api_key()
            if not user:
                raise Exception("Invalid API key")

            # Phase 2: Detect new assets
            self._emit_progress("detection", "Scanning workspaces for new assets...")
            new_collections, new_specs, new_environments = await self._detect_new_assets()

            if not new_collections and not new_specs and not new_environments:
                self._emit_progress("complete", "Workspace is up to date — no new assets found.")
                return result

            self._emit_progress(
                "detection",
                f"Found {len(new_collections)} new collection(s), "
                f"{len(new_specs)} new spec(s), "
                f"{len(new_environments)} new environment(s)",
            )

            # Phase 3: Fork new collections
            if new_collections:
                self._emit_progress("collections", "Forking new collections...")
                await self._fork_new_collections(new_collections, result)

            # Phase 4: Create mocks
            if self._collection_store:
                self._emit_progress("mocks", "Creating mock servers...")
                await self._create_mocks(result)

            # Phase 5: Update Mock Env
            mock_env_var_map: dict[str, str] = {}
            if self._mock_store:
                self._emit_progress("mockEnv", "Updating Mock Environment...")
                mock_env_var_map = await self._update_mock_env(result)
                await self._update_collection_variables(mock_env_var_map)

            # Phase 6: Copy new specs
            if new_specs:
                self._emit_progress("specs", "Copying new API specs...")
                await self._copy_new_specs(new_specs, result)

            # Phase 7: Copy new environments
            if new_environments:
                self._emit_progress("environments", "Copying new environments...")
                await self._copy_new_environments(new_environments, result)

            self._emit_progress("complete", "Update complete!")

        except Exception as e:
            result["errors"].append(str(e))
            self._emit_progress("error", f"Error: {e}")

        return result

    # ==================== Detection ====================

    async def _detect_new_assets(self) -> tuple[list, list, list]:
        source_collections, target_collections, source_specs, target_specs, source_envs, target_envs = (
            await asyncio.gather(
                self.client.get_collections(self.source_workspace_id),
                self.client.get_collections(self.target_workspace_id),
                self.client.get_specs(self.source_workspace_id),
                self.client.get_specs(self.target_workspace_id),
                self.client.get_environments(self.source_workspace_id),
                self.client.get_environments(self.target_workspace_id),
            )
        )

        new_collections = await self._find_new_collections(source_collections, target_collections)

        target_spec_names = {s.name for s in target_specs}
        new_specs = [s for s in source_specs if s.name not in target_spec_names]

        target_env_names = {e.name for e in target_envs}
        new_environments = [
            e for e in source_envs
            if e.name != "Mock Env" and e.name not in target_env_names
        ]

        return new_collections, new_specs, new_environments

    async def _find_new_collections(
        self, source_collections: list, target_collections: list
    ) -> list:
        target_fork_sources: set[str] = set()
        target_names: set[str] = set()

        for tc in target_collections:
            target_names.add(tc.name)
            details = await self.client.get_collection_details(tc.uid)
            if details and hasattr(details, "fork") and details.fork:
                fork_from = getattr(details.fork, "from_", None) or details.fork.get("from", None) if isinstance(details.fork, dict) else getattr(details.fork, "from_", None)
                if fork_from:
                    target_fork_sources.add(fork_from)
            await asyncio.sleep(0.3)

        return [
            sc for sc in source_collections
            if sc.uid not in target_fork_sources and sc.name not in target_names
        ]

    # ==================== Processing ====================

    async def _fork_new_collections(self, new_collections: list, result: dict) -> None:
        result["new_collections"]["total"] = len(new_collections)

        for i, collection in enumerate(new_collections):
            self._emit_progress("collections", f"Forking {collection.name}...")

            fork_result = await self.client.fork_collection(
                collection.uid, collection.name, self.target_workspace_id
            )

            if fork_result.get("success"):
                result["new_collections"]["success"] += 1
                target_uid = fork_result["collection"].uid
                result["new_collections"]["success_data"].append({
                    "name": collection.name,
                    "source_uid": collection.uid,
                    "target_uid": target_uid,
                })

                coll_details = await self.client.get_collection_details(target_uid)
                host_variables = []
                if coll_details:
                    host_variables = self._extract_host_variables(coll_details)

                self._collection_store[collection.uid] = {
                    "source_uid": collection.uid,
                    "target_uid": target_uid,
                    "name": collection.name,
                    "host_variables": host_variables,
                    "collection_details": coll_details,
                }
            else:
                result["new_collections"]["failed"].append({
                    "name": collection.name,
                    "error": fork_result.get("error", "Unknown error"),
                })

            await asyncio.sleep(0.3)

    async def _create_mocks(self, result: dict) -> None:
        for coll_data in self._collection_store.values():
            target_uid = coll_data["target_uid"]
            name = coll_data["name"]
            mock_name = f"{name} Mock"

            self._emit_progress("mocks", f"Creating {mock_name}...")

            mock_result = await self.client.create_mock(
                mock_name, target_uid, self.target_workspace_id, is_private=False
            )

            if mock_result.get("success"):
                self._mock_store[target_uid] = {
                    "mock_id": mock_result["mock"].id,
                    "mock_url": mock_result["mock"].mock_url,
                    "name": mock_name,
                    "collection_name": name,
                }
            else:
                result["errors"].append(f"Failed to create mock for {name}: {mock_result.get('error')}")

            await asyncio.sleep(0.3)

    async def _update_mock_env(self, result: dict) -> dict[str, str]:
        new_mock_vars, mock_env_var_map = self._generate_mock_url_variables()
        if not new_mock_vars:
            return mock_env_var_map

        envs = await self.client.get_environments(self.target_workspace_id)
        mock_env = next((e for e in envs if e.name == "Mock Env"), None)

        if mock_env:
            details = await self.client.get_environment_details(mock_env.uid)
            existing_vars = details.values if details and hasattr(details, "values") else []
            existing_keys = {v.key for v in existing_vars} if existing_vars else set()

            deduplicated = []
            for v in new_mock_vars:
                if v["key"] in existing_keys:
                    suffix = 2
                    new_key = f"{v['key']}{suffix}"
                    while new_key in existing_keys:
                        suffix += 1
                        new_key = f"{v['key']}{suffix}"
                    for map_key, map_val in list(mock_env_var_map.items()):
                        if map_val == v["key"]:
                            mock_env_var_map[map_key] = new_key
                    deduplicated.append({**v, "key": new_key})
                else:
                    deduplicated.append(v)

            merged = list(existing_vars or []) + [
                EnvironmentVariable(key=v["key"], value=v["value"], type=v.get("type", "default"), enabled=True)
                for v in deduplicated
            ]
            await self.client.update_environment(mock_env.uid, "Mock Env", merged)
            result["updated_mock_env"] = {"uid": mock_env.uid, "new_vars_added": len(deduplicated)}
        else:
            env_vars = [
                EnvironmentVariable(key=v["key"], value=v["value"], type=v.get("type", "default"), enabled=True)
                for v in new_mock_vars
            ]
            create_result = await self.client.create_environment("Mock Env", env_vars, self.target_workspace_id)
            if create_result.get("success"):
                result["updated_mock_env"] = {
                    "uid": create_result["environment"].uid,
                    "new_vars_added": len(new_mock_vars),
                }

        return mock_env_var_map

    async def _update_collection_variables(self, mock_env_var_map: dict[str, str]) -> None:
        if not mock_env_var_map:
            return

        for coll_data in self._collection_store.values():
            if not coll_data.get("collection_details"):
                continue

            host_vars = coll_data.get("host_variables", [])
            existing_vars = coll_data["collection_details"].variable if hasattr(coll_data["collection_details"], "variable") else []
            existing_vars = existing_vars or []

            if host_vars:
                updated_vars = []
                for v in existing_vars:
                    hv = next((h for h in host_vars if h.var_name == v.key), None)
                    if hv:
                        env_name = mock_env_var_map.get(f"{coll_data['target_uid']}:{hv.var_name}")
                        if env_name:
                            updated_vars.append({**v.__dict__, "value": f"{{{{{env_name}}}}}"} if hasattr(v, "__dict__") else {"key": v.key, "value": f"{{{{{env_name}}}}}", "type": "string"})
                            continue
                    updated_vars.append(v)

                for hv in host_vars:
                    env_name = mock_env_var_map.get(f"{coll_data['target_uid']}:{hv.var_name}")
                    if env_name and not any(
                        (v.key if hasattr(v, "key") else v.get("key")) == hv.var_name for v in updated_vars
                    ):
                        updated_vars.append({"key": hv.var_name, "value": f"{{{{{env_name}}}}}", "type": "string"})

                await self.client.patch_collection_variables(coll_data["target_uid"], updated_vars)
                await asyncio.sleep(0.3)
                continue

            fallback = mock_env_var_map.get(f"{coll_data['target_uid']}:__fallback__")
            if not fallback:
                continue

            common_var = next(
                (v for v in existing_vars if any(n.lower() == v.key.lower() for n in COMMON_HOST_VAR_NAMES)),
                None,
            )

            if common_var:
                updated_vars = [
                    {**v.__dict__, "value": f"{{{{{fallback}}}}}"} if v.key == common_var.key else v
                    for v in existing_vars
                ]
            else:
                updated_vars = list(existing_vars) + [{"key": "baseUrl", "value": f"{{{{{fallback}}}}}", "type": "string"}]

            await self.client.patch_collection_variables(coll_data["target_uid"], updated_vars)
            await asyncio.sleep(0.3)

    async def _copy_new_specs(self, new_specs: list, result: dict) -> None:
        result["new_specs"]["total"] = len(new_specs)

        for spec in new_specs:
            self._emit_progress("specs", f"Copying {spec.name}...")

            try:
                files = await self.client.get_spec_files(spec.id)
                if not files:
                    result["new_specs"]["failed"].append({"name": spec.name, "error": "No files found"})
                    continue

                files_with_content = []
                for f in files:
                    file_data = await self.client.get_spec_file(spec.id, f.path)
                    if file_data and file_data.content:
                        files_with_content.append(
                            CreateSpecFile(path=f.path, content=file_data.content, type=f.type)
                        )
                    await asyncio.sleep(0.2)

                if not files_with_content:
                    result["new_specs"]["failed"].append({"name": spec.name, "error": "Could not retrieve file contents"})
                    continue

                create_result = await self.client.create_spec(
                    self.target_workspace_id, spec.name, spec.type, files_with_content
                )

                if create_result.get("success"):
                    result["new_specs"]["success"] += 1
                    result["new_specs"]["success_data"].append({
                        "name": spec.name,
                        "source_id": spec.id,
                        "target_id": create_result["spec"].id,
                        "files_copied": len(files_with_content),
                    })
                else:
                    result["new_specs"]["failed"].append({"name": spec.name, "error": create_result.get("error")})
            except Exception as e:
                result["new_specs"]["failed"].append({"name": spec.name, "error": str(e)})

            await asyncio.sleep(0.5)

    async def _copy_new_environments(self, new_environments: list, result: dict) -> None:
        result["new_environments"]["total"] = len(new_environments)

        for env in new_environments:
            self._emit_progress("environments", f"Copying {env.name}...")

            details = await self.client.get_environment_details(env.uid)
            if not details:
                result["new_environments"]["failed"].append({"name": env.name, "error": "Could not fetch details"})
                continue

            create_result = await self.client.create_environment(
                details.name, details.values or [], self.target_workspace_id
            )

            if create_result.get("success"):
                result["new_environments"]["success"] += 1
                result["new_environments"]["success_data"].append({
                    "name": details.name,
                    "source_uid": env.uid,
                    "target_uid": create_result["environment"].uid,
                })
            else:
                result["new_environments"]["failed"].append({
                    "name": details.name,
                    "error": create_result.get("error"),
                })

            await asyncio.sleep(0.3)

    # ==================== Helpers ====================

    def _generate_mock_url_variables(self) -> tuple[list[dict], dict[str, str]]:
        variables: list[dict] = []
        mock_env_var_map: dict[str, str] = {}

        for source_uid, coll_data in self._collection_store.items():
            mock_data = next(
                (m for m in self._mock_store.values() if m["collection_name"] == coll_data["name"]),
                None,
            )
            if not mock_data:
                continue

            host_vars = coll_data.get("host_variables", [])
            if not host_vars:
                var_name = self._to_variable_name(coll_data["name"]) + "BaseUrl"
                variables.append({"key": var_name, "value": mock_data["mock_url"], "type": "default", "enabled": True})
                mock_env_var_map[f"{coll_data['target_uid']}:__fallback__"] = var_name
                continue

            for hv in host_vars:
                env_var_name = self._to_variable_name(coll_data["name"]) + self._to_pascal_case(hv.var_name)
                variables.append({"key": env_var_name, "value": mock_data["mock_url"], "type": "default", "enabled": True})
                mock_env_var_map[f"{coll_data['target_uid']}:{hv.var_name}"] = env_var_name

        return variables, mock_env_var_map

    def _extract_host_variables(self, collection: Any) -> list[HostVariableInfo]:
        host_var_names: set[str] = set()

        def traverse(items: list) -> None:
            for item in items:
                if hasattr(item, "item") and item.item:
                    traverse(item.item)
                if hasattr(item, "request") and item.request and hasattr(item.request, "url") and item.request.url:
                    url = item.request.url
                    host = url.host if hasattr(url, "host") else (url.get("host") if isinstance(url, dict) else None)
                    if host:
                        for h in host:
                            m = re.match(r"^\{\{(.+)\}\}$", str(h))
                            if m:
                                host_var_names.add(m.group(1))

        items = collection.item if hasattr(collection, "item") else []
        traverse(items or [])
        coll_vars = collection.variable if hasattr(collection, "variable") else []
        coll_vars = coll_vars or []

        def map_host_var(var_name: str) -> HostVariableInfo:
            var_def = next((v for v in coll_vars if v.key == var_name), None)
            original_url = var_def.value if var_def else ""
            path = self._extract_url_path(original_url) if original_url else ""
            return HostVariableInfo(var_name=var_name, original_url=original_url, path=path)

        if host_var_names:
            mapped = [map_host_var(vn) for vn in host_var_names]
            with_protocol = [hv for hv in mapped if "://" in (hv.original_url or "")]
            if with_protocol:
                return with_protocol
            return [HostVariableInfo(var_name=hv.var_name, original_url=hv.original_url, path="") for hv in mapped]

        common: list[HostVariableInfo] = []
        for v in coll_vars:
            if any(n.lower() == v.key.lower() for n in COMMON_HOST_VAR_NAMES):
                original_url = v.value or ""
                path = self._extract_url_path(original_url) if "://" in original_url else ""
                common.append(HostVariableInfo(var_name=v.key, original_url=original_url, path=path))
        return common

    @staticmethod
    def _to_variable_name(name: str) -> str:
        clean = re.sub(r"[^a-zA-Z0-9\s]", "", name)
        words = clean.split()
        return "".join(
            word.lower() if i == 0 else word[0].upper() + word[1:].lower()
            for i, word in enumerate(words)
            if word
        )

    @staticmethod
    def _to_pascal_case(s: str) -> str:
        s = re.sub(r"([a-z])([A-Z])", r"\1 \2", s)
        s = re.sub(r"[^a-zA-Z0-9]", " ", s)
        return "".join(word[0].upper() + word[1:].lower() for word in s.split() if word)

    @staticmethod
    def _extract_url_path(url_string: str) -> str:
        try:
            parsed = urlparse(url_string)
            return "" if parsed.path == "/" else parsed.path
        except Exception:
            return ""

    def _init_result(self) -> dict[str, Any]:
        return {
            "new_collections": {"total": 0, "success": 0, "failed": [], "success_data": []},
            "new_specs": {"total": 0, "success": 0, "failed": [], "success_data": []},
            "new_environments": {"total": 0, "success": 0, "failed": [], "success_data": []},
            "updated_mock_env": None,
            "errors": [],
        }

    def _emit_progress(self, phase: str, message: str) -> None:
        if self.on_progress:
            self.on_progress(ProgressEvent(phase=phase, message=message, progress=0))
```

- [ ] **Step 2: Update `__init__.py`**

Add to `dev-portal/python/sdk/postman_sdk/__init__.py`:

In the imports section, add:

```python
from postman_sdk.services.update_service import UpdateService
```

In the `__all__` list, add `"UpdateService"` after `"WorkspaceService"`.

- [ ] **Step 3: Commit**

```bash
git add dev-portal/python/sdk/postman_sdk/services/update_service.py dev-portal/python/sdk/postman_sdk/__init__.py
git commit -m "feat: add UpdateService to Python SDK for workspace update detection"
```

---

## Task 4: Java SDK — `UpdateService.java`

**Files:**
- Create: `dev-portal/java/sdk/src/main/java/com/postman/sdk/services/UpdateService.java`
- Modify: `dev-portal/java/sdk/src/main/java/com/postman/sdk/config/PostmanAutoConfiguration.java`

- [ ] **Step 1: Create `UpdateService.java`**

```java
// dev-portal/java/sdk/src/main/java/com/postman/sdk/services/UpdateService.java

package com.postman.sdk.services;

import com.postman.sdk.client.PostmanClient;
import com.postman.sdk.types.*;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.time.Duration;
import java.util.*;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Service for workspace update detection and processing.
 * Scans source and target workspaces, detects net-new assets,
 * and adds them with full mock URL wiring.
 */
@Service
public class UpdateService {

    private static final List<String> COMMON_HOST_VAR_NAMES = List.of(
            "baseUrl", "baseurl", "base_url", "HostName", "hostname", "host",
            "apiUrl", "apiurl", "api_url", "serverUrl", "serverurl", "server_url"
    );
    private static final Pattern HOST_VAR_PATTERN = Pattern.compile("^\\{\\{(.+)\\}\\}$");

    private final PostmanClient client;
    private final SpecService specService;

    public UpdateService(PostmanClient client, SpecService specService) {
        this.client = client;
        this.specService = specService;
    }

    public record UpdateConfig(
            String sourceWorkspaceId,
            String targetWorkspaceId,
            Consumer<ProgressEvent> onProgress
    ) {}

    public record UpdateResult(
            ResourceResult newCollections,
            ResourceResult newSpecs,
            ResourceResult newEnvironments,
            MockEnvResult updatedMockEnv,
            List<String> errors
    ) {
        public static UpdateResult empty() {
            return new UpdateResult(
                    ResourceResult.empty(), ResourceResult.empty(), ResourceResult.empty(),
                    null, new ArrayList<>()
            );
        }
    }

    public record ResourceResult(
            int total, int success,
            List<Map<String, String>> failed,
            List<Map<String, String>> successData
    ) {
        public static ResourceResult empty() {
            return new ResourceResult(0, 0, new ArrayList<>(), new ArrayList<>());
        }
    }

    public record MockEnvResult(String uid, int newVarsAdded) {}

    /**
     * Run update detection and processing workflow
     */
    public Mono<UpdateResult> update(UpdateConfig config) {
        UpdateContext ctx = new UpdateContext(config);

        return client.validateApiKey()
                .flatMap(user -> detectNewAssets(ctx))
                .flatMap(detected -> {
                    if (detected.newCollections.isEmpty() && detected.newSpecs.isEmpty() && detected.newEnvironments.isEmpty()) {
                        emitProgress(ctx, "complete", "Workspace is up to date — no new assets found.");
                        return Mono.just(ctx.buildResult());
                    }

                    emitProgress(ctx, "detection",
                            String.format("Found %d new collection(s), %d new spec(s), %d new environment(s)",
                                    detected.newCollections.size(), detected.newSpecs.size(), detected.newEnvironments.size()));

                    Mono<Void> pipeline = Mono.empty();

                    if (!detected.newCollections.isEmpty()) {
                        pipeline = pipeline.then(forkNewCollections(ctx, detected.newCollections))
                                .then(createMocks(ctx))
                                .then(updateMockEnv(ctx))
                                .then(updateCollectionVariables(ctx));
                    }

                    if (!detected.newSpecs.isEmpty()) {
                        pipeline = pipeline.then(copyNewSpecs(ctx, detected.newSpecs));
                    }

                    if (!detected.newEnvironments.isEmpty()) {
                        pipeline = pipeline.then(copyNewEnvironments(ctx, detected.newEnvironments));
                    }

                    return pipeline.then(Mono.fromCallable(ctx::buildResult));
                });
    }

    // ==================== Detection ====================

    private record DetectedAssets(
            List<Collection> newCollections,
            List<Spec> newSpecs,
            List<Environment> newEnvironments
    ) {}

    private Mono<DetectedAssets> detectNewAssets(UpdateContext ctx) {
        String sourceId = ctx.config.sourceWorkspaceId();
        String targetId = ctx.config.targetWorkspaceId();

        return Mono.zip(
                client.getCollections(sourceId).collectList(),
                client.getCollections(targetId).collectList(),
                client.getSpecs(sourceId).collectList(),
                client.getSpecs(targetId).collectList(),
                client.getEnvironments(sourceId).collectList(),
                client.getEnvironments(targetId).collectList()
        ).flatMap(tuple -> {
            List<Collection> sourceColls = tuple.getT1();
            List<Collection> targetColls = tuple.getT2();
            List<Spec> sourceSpecs = tuple.getT3();
            List<Spec> targetSpecs = tuple.getT4();
            List<Environment> sourceEnvs = tuple.getT5();
            List<Environment> targetEnvs = tuple.getT6();

            // Specs: name match
            Set<String> targetSpecNames = targetSpecs.stream().map(Spec::name).collect(Collectors.toSet());
            List<Spec> newSpecs = sourceSpecs.stream().filter(s -> !targetSpecNames.contains(s.name())).toList();

            // Environments: name match, exclude Mock Env
            Set<String> targetEnvNames = targetEnvs.stream().map(Environment::name).collect(Collectors.toSet());
            List<Environment> newEnvs = sourceEnvs.stream()
                    .filter(e -> !"Mock Env".equals(e.name()) && !targetEnvNames.contains(e.name()))
                    .toList();

            // Collections: fork check + name fallback
            return findNewCollections(sourceColls, targetColls)
                    .map(newColls -> new DetectedAssets(newColls, newSpecs, newEnvs));
        });
    }

    private Mono<List<Collection>> findNewCollections(List<Collection> sourceColls, List<Collection> targetColls) {
        if (targetColls.isEmpty()) {
            return Mono.just(new ArrayList<>(sourceColls));
        }

        return Flux.fromIterable(targetColls)
                .delayElements(Duration.ofMillis(300))
                .flatMapSequential(tc -> client.getCollectionDetails(tc.uid())
                        .map(details -> {
                            Map<String, Object> info = new HashMap<>();
                            info.put("name", tc.name());
                            if (details != null) {
                                Object fork = ((Map<String, Object>) details).get("fork");
                                if (fork instanceof Map) {
                                    Object from = ((Map<String, Object>) fork).get("from");
                                    if (from != null) info.put("forkFrom", from.toString());
                                }
                            }
                            return info;
                        })
                        .defaultIfEmpty(Map.of("name", tc.name()))
                )
                .collectList()
                .map(targetInfos -> {
                    Set<String> forkSources = new HashSet<>();
                    Set<String> targetNames = new HashSet<>();
                    for (Map<String, Object> info : targetInfos) {
                        targetNames.add((String) info.get("name"));
                        if (info.containsKey("forkFrom")) {
                            forkSources.add((String) info.get("forkFrom"));
                        }
                    }
                    return sourceColls.stream()
                            .filter(sc -> !forkSources.contains(sc.uid()) && !targetNames.contains(sc.name()))
                            .toList();
                });
    }

    // ==================== Processing ====================

    private Mono<Void> forkNewCollections(UpdateContext ctx, List<Collection> newCollections) {
        ctx.newCollectionsTotal = newCollections.size();

        return Flux.fromIterable(newCollections)
                .delayElements(Duration.ofMillis(300))
                .flatMapSequential(collection -> {
                    emitProgress(ctx, "collections", "Forking " + collection.name() + "...");

                    return client.forkCollection(collection.uid(), collection.name(), ctx.config.targetWorkspaceId())
                            .flatMap(forkResult -> {
                                if (forkResult.success()) {
                                    ctx.newCollectionsSuccess++;
                                    ctx.newCollectionsSuccessData.add(Map.of(
                                            "name", collection.name(),
                                            "sourceUid", collection.uid(),
                                            "targetUid", forkResult.data().uid()
                                    ));

                                    return client.getCollectionDetails(forkResult.data().uid())
                                            .doOnNext(details -> {
                                                List<HostVariableInfo> hostVars = extractHostVariables(details);
                                                ctx.collectionStore.put(collection.uid(), Map.of(
                                                        "sourceUid", collection.uid(),
                                                        "targetUid", forkResult.data().uid(),
                                                        "name", collection.name(),
                                                        "hostVariables", hostVars,
                                                        "collectionDetails", details
                                                ));
                                            })
                                            .then();
                                } else {
                                    ctx.newCollectionsFailed.add(Map.of(
                                            "name", collection.name(),
                                            "error", forkResult.error() != null ? forkResult.error() : "Unknown error"
                                    ));
                                    return Mono.empty();
                                }
                            });
                })
                .then();
    }

    private Mono<Void> createMocks(UpdateContext ctx) {
        if (ctx.collectionStore.isEmpty()) return Mono.empty();

        return Flux.fromIterable(ctx.collectionStore.values())
                .delayElements(Duration.ofMillis(300))
                .flatMapSequential(collData -> {
                    String targetUid = (String) collData.get("targetUid");
                    String name = (String) collData.get("name");
                    String mockName = name + " Mock";

                    emitProgress(ctx, "mocks", "Creating " + mockName + "...");

                    return client.createMock(mockName, targetUid, ctx.config.targetWorkspaceId(), false)
                            .doOnNext(result -> {
                                if (result.success()) {
                                    ctx.mockStore.put(targetUid, Map.of(
                                            "mockId", result.data().id(),
                                            "mockUrl", result.data().mockUrl(),
                                            "name", mockName,
                                            "collectionName", name
                                    ));
                                } else {
                                    ctx.errors.add("Failed to create mock for " + name + ": " + result.error());
                                }
                            })
                            .then();
                })
                .then();
    }

    private Mono<Void> updateMockEnv(UpdateContext ctx) {
        if (ctx.mockStore.isEmpty()) return Mono.empty();

        Map<String, List<Map<String, String>>> generated = generateMockUrlVariables(ctx);
        List<Map<String, String>> newVars = generated.get("variables");
        // mockEnvVarMap is stored in ctx

        if (newVars == null || newVars.isEmpty()) return Mono.empty();

        return client.getEnvironments(ctx.config.targetWorkspaceId())
                .collectList()
                .flatMap(envs -> {
                    Optional<Environment> mockEnvOpt = envs.stream()
                            .filter(e -> "Mock Env".equals(e.name()))
                            .findFirst();

                    if (mockEnvOpt.isPresent()) {
                        Environment mockEnv = mockEnvOpt.get();
                        return client.getEnvironmentDetails(mockEnv.uid())
                                .flatMap(details -> {
                                    List<EnvironmentVariable> existing = details != null ? details.values() : List.of();
                                    Set<String> existingKeys = existing.stream()
                                            .map(EnvironmentVariable::key)
                                            .collect(Collectors.toSet());

                                    List<EnvironmentVariable> deduped = new ArrayList<>();
                                    for (Map<String, String> v : newVars) {
                                        String key = v.get("key");
                                        if (existingKeys.contains(key)) {
                                            int suffix = 2;
                                            String newKey = key + suffix;
                                            while (existingKeys.contains(newKey)) {
                                                suffix++;
                                                newKey = key + suffix;
                                            }
                                            String finalNewKey = newKey;
                                            ctx.mockEnvVarMap.replaceAll((k, val) -> val.equals(key) ? finalNewKey : val);
                                            deduped.add(new EnvironmentVariable(newKey, v.get("value"), "default", true));
                                        } else {
                                            deduped.add(new EnvironmentVariable(key, v.get("value"), "default", true));
                                        }
                                    }

                                    List<EnvironmentVariable> merged = new ArrayList<>(existing);
                                    merged.addAll(deduped);

                                    return client.updateEnvironment(mockEnv.uid(), "Mock Env", merged)
                                            .doOnNext(r -> ctx.updatedMockEnv = new MockEnvResult(mockEnv.uid(), deduped.size()))
                                            .then();
                                });
                    } else {
                        List<EnvironmentVariable> envVars = newVars.stream()
                                .map(v -> new EnvironmentVariable(v.get("key"), v.get("value"), "default", true))
                                .toList();

                        return client.createEnvironment("Mock Env", envVars, ctx.config.targetWorkspaceId())
                                .doOnNext(r -> {
                                    if (r.success()) {
                                        ctx.updatedMockEnv = new MockEnvResult(r.data().uid(), newVars.size());
                                    }
                                })
                                .then();
                    }
                });
    }

    private Mono<Void> updateCollectionVariables(UpdateContext ctx) {
        if (ctx.mockEnvVarMap.isEmpty()) return Mono.empty();

        return Flux.fromIterable(ctx.collectionStore.values())
                .delayElements(Duration.ofMillis(300))
                .flatMapSequential(collData -> {
                    Object detailsObj = collData.get("collectionDetails");
                    if (detailsObj == null) return Mono.empty();

                    @SuppressWarnings("unchecked")
                    List<HostVariableInfo> hostVars = (List<HostVariableInfo>) collData.get("hostVariables");
                    String targetUid = (String) collData.get("targetUid");

                    // Get existing vars from collection details
                    @SuppressWarnings("unchecked")
                    Map<String, Object> details = (Map<String, Object>) detailsObj;
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> existingVars = (List<Map<String, Object>>) details.getOrDefault("variable", List.of());

                    List<Map<String, Object>> updatedVars = new ArrayList<>();

                    if (hostVars != null && !hostVars.isEmpty()) {
                        for (Map<String, Object> v : existingVars) {
                            String key = (String) v.get("key");
                            Optional<HostVariableInfo> hv = hostVars.stream().filter(h -> h.varName().equals(key)).findFirst();
                            if (hv.isPresent()) {
                                String envName = ctx.mockEnvVarMap.get(targetUid + ":" + hv.get().varName());
                                if (envName != null) {
                                    Map<String, Object> updated = new HashMap<>(v);
                                    updated.put("value", "{{" + envName + "}}");
                                    updatedVars.add(updated);
                                    continue;
                                }
                            }
                            updatedVars.add(v);
                        }

                        for (HostVariableInfo hv : hostVars) {
                            String envName = ctx.mockEnvVarMap.get(targetUid + ":" + hv.varName());
                            if (envName != null) {
                                boolean exists = updatedVars.stream().anyMatch(v -> hv.varName().equals(v.get("key")));
                                if (!exists) {
                                    updatedVars.add(Map.of("key", hv.varName(), "value", "{{" + envName + "}}", "type", "string"));
                                }
                            }
                        }

                        return client.patchCollectionVariables(targetUid, updatedVars).then();
                    }

                    String fallback = ctx.mockEnvVarMap.get(targetUid + ":__fallback__");
                    if (fallback == null) return Mono.empty();

                    Optional<Map<String, Object>> commonVar = existingVars.stream()
                            .filter(v -> COMMON_HOST_VAR_NAMES.stream().anyMatch(n -> n.equalsIgnoreCase((String) v.get("key"))))
                            .findFirst();

                    if (commonVar.isPresent()) {
                        for (Map<String, Object> v : existingVars) {
                            if (v.get("key").equals(commonVar.get().get("key"))) {
                                Map<String, Object> updated = new HashMap<>(v);
                                updated.put("value", "{{" + fallback + "}}");
                                updatedVars.add(updated);
                            } else {
                                updatedVars.add(v);
                            }
                        }
                    } else {
                        updatedVars.addAll(existingVars);
                        updatedVars.add(Map.of("key", "baseUrl", "value", "{{" + fallback + "}}", "type", "string"));
                    }

                    return client.patchCollectionVariables(targetUid, updatedVars).then();
                })
                .then();
    }

    private Mono<Void> copyNewSpecs(UpdateContext ctx, List<Spec> newSpecs) {
        ctx.newSpecsTotal = newSpecs.size();

        return Flux.fromIterable(newSpecs)
                .delayElements(Duration.ofMillis(500))
                .flatMapSequential(spec -> {
                    emitProgress(ctx, "specs", "Copying " + spec.name() + "...");
                    return specService.copySpec(spec.id(), spec.name(), spec.type(), ctx.config.targetWorkspaceId())
                            .doOnNext(result -> {
                                if (result.success()) {
                                    ctx.newSpecsSuccess++;
                                    ctx.newSpecsSuccessData.add(Map.of(
                                            "name", spec.name(),
                                            "sourceId", spec.id(),
                                            "targetId", result.specId()
                                    ));
                                } else {
                                    ctx.newSpecsFailed.add(Map.of("name", spec.name(), "error", result.error()));
                                }
                            })
                            .then();
                })
                .then();
    }

    private Mono<Void> copyNewEnvironments(UpdateContext ctx, List<Environment> newEnvironments) {
        ctx.newEnvironmentsTotal = newEnvironments.size();

        return Flux.fromIterable(newEnvironments)
                .delayElements(Duration.ofMillis(300))
                .flatMapSequential(env -> {
                    emitProgress(ctx, "environments", "Copying " + env.name() + "...");
                    return client.getEnvironmentDetails(env.uid())
                            .flatMap(details -> {
                                if (details == null) {
                                    ctx.newEnvironmentsFailed.add(Map.of("name", env.name(), "error", "Could not fetch details"));
                                    return Mono.empty();
                                }
                                return client.createEnvironment(details.name(), details.values() != null ? details.values() : List.of(), ctx.config.targetWorkspaceId())
                                        .doOnNext(r -> {
                                            if (r.success()) {
                                                ctx.newEnvironmentsSuccess++;
                                                ctx.newEnvironmentsSuccessData.add(Map.of(
                                                        "name", details.name(),
                                                        "sourceUid", env.uid(),
                                                        "targetUid", r.data().uid()
                                                ));
                                            } else {
                                                ctx.newEnvironmentsFailed.add(Map.of("name", details.name(), "error", r.error()));
                                            }
                                        })
                                        .then();
                            });
                })
                .then();
    }

    // ==================== Helpers ====================

    @SuppressWarnings("unchecked")
    private List<HostVariableInfo> extractHostVariables(Object collectionObj) {
        Map<String, Object> collection = (Map<String, Object>) collectionObj;
        Set<String> hostVarNames = new HashSet<>();

        List<Map<String, Object>> items = (List<Map<String, Object>>) collection.getOrDefault("item", List.of());
        traverseItems(items, hostVarNames);

        List<Map<String, Object>> collVars = (List<Map<String, Object>>) collection.getOrDefault("variable", List.of());

        if (!hostVarNames.isEmpty()) {
            List<HostVariableInfo> mapped = hostVarNames.stream().map(varName -> {
                String originalUrl = collVars.stream()
                        .filter(v -> varName.equals(v.get("key")))
                        .map(v -> (String) v.getOrDefault("value", ""))
                        .findFirst().orElse("");
                String path = extractUrlPath(originalUrl);
                return new HostVariableInfo(varName, originalUrl, path);
            }).toList();

            List<HostVariableInfo> withProtocol = mapped.stream().filter(hv -> hv.originalUrl().contains("://")).toList();
            if (!withProtocol.isEmpty()) return withProtocol;
            return mapped.stream().map(hv -> new HostVariableInfo(hv.varName(), hv.originalUrl(), "")).toList();
        }

        return collVars.stream()
                .filter(v -> COMMON_HOST_VAR_NAMES.stream().anyMatch(n -> n.equalsIgnoreCase((String) v.get("key"))))
                .map(v -> {
                    String originalUrl = (String) v.getOrDefault("value", "");
                    String path = originalUrl.contains("://") ? extractUrlPath(originalUrl) : "";
                    return new HostVariableInfo((String) v.get("key"), originalUrl, path);
                })
                .toList();
    }

    @SuppressWarnings("unchecked")
    private void traverseItems(List<Map<String, Object>> items, Set<String> hostVarNames) {
        if (items == null) return;
        for (Map<String, Object> item : items) {
            if (item.containsKey("item")) {
                traverseItems((List<Map<String, Object>>) item.get("item"), hostVarNames);
            }
            Map<String, Object> request = (Map<String, Object>) item.get("request");
            if (request != null) {
                Map<String, Object> url = (Map<String, Object>) request.get("url");
                if (url != null) {
                    List<String> host = (List<String>) url.get("host");
                    if (host != null) {
                        for (String h : host) {
                            Matcher m = HOST_VAR_PATTERN.matcher(h);
                            if (m.matches()) hostVarNames.add(m.group(1));
                        }
                    }
                }
            }
        }
    }

    private Map<String, List<Map<String, String>>> generateMockUrlVariables(UpdateContext ctx) {
        List<Map<String, String>> variables = new ArrayList<>();

        for (Map<String, Object> collData : ctx.collectionStore.values()) {
            String collName = (String) collData.get("name");
            String targetUid = (String) collData.get("targetUid");

            Optional<Map<String, String>> mockData = ctx.mockStore.values().stream()
                    .filter(m -> collName.equals(m.get("collectionName")))
                    .findFirst();
            if (mockData.isEmpty()) continue;

            String mockUrl = mockData.get().get("mockUrl");

            @SuppressWarnings("unchecked")
            List<HostVariableInfo> hostVars = (List<HostVariableInfo>) collData.get("hostVariables");

            if (hostVars == null || hostVars.isEmpty()) {
                String varName = toVariableName(collName) + "BaseUrl";
                variables.add(Map.of("key", varName, "value", mockUrl));
                ctx.mockEnvVarMap.put(targetUid + ":__fallback__", varName);
                continue;
            }

            for (HostVariableInfo hv : hostVars) {
                String envVarName = toVariableName(collName) + toPascalCase(hv.varName());
                variables.add(Map.of("key", envVarName, "value", mockUrl));
                ctx.mockEnvVarMap.put(targetUid + ":" + hv.varName(), envVarName);
            }
        }

        return Map.of("variables", variables);
    }

    private static String toVariableName(String name) {
        String clean = name.replaceAll("[^a-zA-Z0-9\\s]", "");
        String[] words = clean.split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < words.length; i++) {
            if (words[i].isEmpty()) continue;
            if (i == 0) sb.append(words[i].toLowerCase());
            else sb.append(Character.toUpperCase(words[i].charAt(0))).append(words[i].substring(1).toLowerCase());
        }
        return sb.toString();
    }

    private static String toPascalCase(String str) {
        str = str.replaceAll("([a-z])([A-Z])", "$1 $2").replaceAll("[^a-zA-Z0-9]", " ");
        StringBuilder sb = new StringBuilder();
        for (String word : str.split("\\s+")) {
            if (!word.isEmpty()) sb.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1).toLowerCase());
        }
        return sb.toString();
    }

    private static String extractUrlPath(String urlString) {
        try {
            URI uri = URI.create(urlString);
            String path = uri.getPath();
            return "/".equals(path) ? "" : (path != null ? path : "");
        } catch (Exception e) {
            return "";
        }
    }

    private void emitProgress(UpdateContext ctx, String phase, String message) {
        if (ctx.config.onProgress() != null) {
            ctx.config.onProgress().accept(new ProgressEvent(phase, message, 0));
        }
    }

    // ==================== Context ====================

    private class UpdateContext {
        final UpdateConfig config;
        final Map<String, Map<String, Object>> collectionStore = new LinkedHashMap<>();
        final Map<String, Map<String, String>> mockStore = new LinkedHashMap<>();
        final Map<String, String> mockEnvVarMap = new HashMap<>();
        final List<String> errors = new ArrayList<>();

        int newCollectionsTotal = 0;
        int newCollectionsSuccess = 0;
        List<Map<String, String>> newCollectionsFailed = new ArrayList<>();
        List<Map<String, String>> newCollectionsSuccessData = new ArrayList<>();

        int newSpecsTotal = 0;
        int newSpecsSuccess = 0;
        List<Map<String, String>> newSpecsFailed = new ArrayList<>();
        List<Map<String, String>> newSpecsSuccessData = new ArrayList<>();

        int newEnvironmentsTotal = 0;
        int newEnvironmentsSuccess = 0;
        List<Map<String, String>> newEnvironmentsFailed = new ArrayList<>();
        List<Map<String, String>> newEnvironmentsSuccessData = new ArrayList<>();

        MockEnvResult updatedMockEnv = null;

        UpdateContext(UpdateConfig config) {
            this.config = config;
        }

        UpdateResult buildResult() {
            return new UpdateResult(
                    new ResourceResult(newCollectionsTotal, newCollectionsSuccess, newCollectionsFailed, newCollectionsSuccessData),
                    new ResourceResult(newSpecsTotal, newSpecsSuccess, newSpecsFailed, newSpecsSuccessData),
                    new ResourceResult(newEnvironmentsTotal, newEnvironmentsSuccess, newEnvironmentsFailed, newEnvironmentsSuccessData),
                    updatedMockEnv,
                    errors
            );
        }
    }
}
```

- [ ] **Step 2: Register bean in `PostmanAutoConfiguration.java`**

Add to `dev-portal/java/sdk/src/main/java/com/postman/sdk/config/PostmanAutoConfiguration.java`:

Import:
```java
import com.postman.sdk.services.UpdateService;
import com.postman.sdk.services.SpecService;
```

Add beans (if SpecService bean doesn't already exist, add it too):

```java
@Bean
@ConditionalOnMissingBean
public SpecService specService(PostmanClient postmanClient) {
    return new SpecService(postmanClient);
}

@Bean
@ConditionalOnMissingBean
public UpdateService updateService(PostmanClient postmanClient, SpecService specService) {
    return new UpdateService(postmanClient, specService);
}
```

- [ ] **Step 3: Verify Java SDK compiles**

Run: `cd dev-portal/java/sdk && mvn compile`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add dev-portal/java/sdk/src/main/java/com/postman/sdk/services/UpdateService.java dev-portal/java/sdk/src/main/java/com/postman/sdk/config/PostmanAutoConfiguration.java
git commit -m "feat: add UpdateService to Java SDK for workspace update detection"
```

---

## Task 5: CLI Entry Point — `cli/update.js`

**Files:**
- Create: `cli/update.js`
- Create: `update.js` (root)
- Modify: `package.json`

- [ ] **Step 1: Create `cli/update.js`**

This follows the same pattern as `cli/provision.js` and `cli/reset.js` — a standalone script with axios, env vars, and interactive prompts.

```javascript
#!/usr/bin/env node
/**
 * Partner Workspace Update Script
 *
 * Scans source and target workspaces, detects net-new collections, specs, and
 * environments, then adds them to the target workspace with full mock URL wiring.
 *
 * UPDATE WORKFLOW:
 *   1. Scan source and target workspaces for asset differences
 *   2. Fork new collections from source to target
 *   3. Create mock servers for new collections
 *   4. Update Mock Env with new mock URL variables (in-place)
 *   5. Update new collection variables to reference mock env vars
 *   6. Copy new spec files from source to target
 *   7. Copy new environments from source to target
 *
 * Required Environment Variables:
 *   - POSTMAN_API_KEY: Your Postman API key
 *   - POSTMAN_SOURCE_WORKSPACE_ID: Source workspace to detect changes from
 *   - POSTMAN_TARGET_WORKSPACE_ID: Target partner workspace to update
 */

import 'dotenv/config';
import axios from 'axios';
import readline from 'readline';

// ============================================================================
// CONFIGURATION
// ============================================================================

const POSTMAN_API_KEY = process.env.POSTMAN_API_KEY;
const POSTMAN_SOURCE_WORKSPACE_ID = process.env.POSTMAN_SOURCE_WORKSPACE_ID;
const POSTMAN_TARGET_WORKSPACE_ID = process.env.POSTMAN_TARGET_WORKSPACE_ID;
const POSTMAN_API_BASE = "https://api.getpostman.com";

const COMMON_HOST_VAR_NAMES = [
  'baseUrl', 'baseurl', 'base_url', 'HostName', 'hostname', 'host',
  'apiUrl', 'apiurl', 'api_url', 'serverUrl', 'serverurl', 'server_url',
];

const api = axios.create({
  baseURL: POSTMAN_API_BASE,
  headers: {
    "Content-Type": "application/json",
    "X-Api-Key": POSTMAN_API_KEY || "",
  },
});

const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
};
const hasFlag = (flag) => args.includes(flag);

// ============================================================================
// UTILITIES
// ============================================================================

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const log = {
  info: (msg) => console.log(`\x1b[36mℹ\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m✓\x1b[0m ${msg}`),
  warn: (msg) => console.log(`\x1b[33m⚠\x1b[0m ${msg}`),
  error: (msg) => console.log(`\x1b[31m✗\x1b[0m ${msg}`),
  section: (msg) => console.log(`\n\x1b[1m\x1b[35m═══ ${msg} ═══\x1b[0m\n`),
};

function toPascalCase(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[^a-zA-Z0-9]/g, ' ')
    .split(/\s+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
}

function toVariableName(name) {
  const clean = name.replace(/[^a-zA-Z0-9\s]/g, '');
  const words = clean.split(/\s+/);
  return words.map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
}

function extractUrlPath(urlString) {
  try { const url = new URL(urlString); return url.pathname === '/' ? '' : url.pathname; } catch { return ''; }
}

function extractHostVariables(collection) {
  const hostVarNames = new Set();
  function traverse(items) {
    for (const item of items) {
      if (item.item) traverse(item.item);
      if (item.request?.url?.host) {
        for (const h of item.request.url.host) {
          const m = h.match(/^\{\{(.+)\}\}$/);
          if (m) hostVarNames.add(m[1]);
        }
      }
    }
  }
  traverse(collection.item || []);
  const collVars = collection.variable || [];

  const mapHostVar = (varName) => {
    const varDef = collVars.find(v => v.key === varName);
    const originalUrl = varDef?.value || '';
    return { varName, originalUrl, path: extractUrlPath(originalUrl) };
  };

  if (hostVarNames.size > 0) {
    const mapped = Array.from(hostVarNames).map(mapHostVar);
    const withProto = mapped.filter(hv => hv.originalUrl.includes('://'));
    return withProto.length > 0 ? withProto : mapped.map(hv => ({ ...hv, path: '' }));
  }

  return collVars
    .filter(v => COMMON_HOST_VAR_NAMES.some(n => n.toLowerCase() === v.key.toLowerCase()))
    .map(v => ({ varName: v.key, originalUrl: v.value || '', path: v.value?.includes('://') ? extractUrlPath(v.value) : '' }));
}

// ============================================================================
// API HELPERS
// ============================================================================

async function apiGet(path) {
  try {
    const { data } = await api.get(path);
    return data;
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    throw new Error(`GET ${path} failed: ${msg}`);
  }
}

async function apiPost(path, payload) {
  try {
    const { data } = await api.post(path, payload);
    return data;
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    throw new Error(`POST ${path} failed: ${msg}`);
  }
}

async function apiPut(path, payload) {
  try {
    const { data } = await api.put(path, payload);
    return data;
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    throw new Error(`PUT ${path} failed: ${msg}`);
  }
}

async function apiPatch(path, payload) {
  try {
    const { data } = await api.patch(path, payload);
    return data;
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    throw new Error(`PATCH ${path} failed: ${msg}`);
  }
}

// ============================================================================
// DETECTION
// ============================================================================

async function detectNewAssets(sourceId, targetId) {
  log.section('SCANNING WORKSPACES');

  const [sourceCollRes, targetCollRes, sourceSpecRes, targetSpecRes, sourceEnvRes, targetEnvRes] = await Promise.all([
    apiGet(`/collections?workspace=${sourceId}`),
    apiGet(`/collections?workspace=${targetId}`),
    apiGet(`/specs?workspaceId=${sourceId}`),
    apiGet(`/specs?workspaceId=${targetId}`),
    apiGet(`/environments?workspace=${sourceId}`),
    apiGet(`/environments?workspace=${targetId}`),
  ]);

  const sourceColls = sourceCollRes.collections || [];
  const targetColls = targetCollRes.collections || [];
  const sourceSpecs = sourceSpecRes.specs || [];
  const targetSpecs = targetSpecRes.specs || [];
  const sourceEnvs = sourceEnvRes.environments || [];
  const targetEnvs = targetEnvRes.environments || [];

  log.info(`Source: ${sourceColls.length} collections, ${sourceSpecs.length} specs, ${sourceEnvs.length} environments`);
  log.info(`Target: ${targetColls.length} collections, ${targetSpecs.length} specs, ${targetEnvs.length} environments`);

  // Collections: fork check + name fallback
  const targetForkSources = new Set();
  const targetNames = new Set();
  for (const tc of targetColls) {
    targetNames.add(tc.name);
    try {
      const details = await apiGet(`/collections/${tc.uid}`);
      const forkFrom = details?.collection?.fork?.from;
      if (forkFrom) targetForkSources.add(forkFrom);
    } catch { /* ignore */ }
    await delay(300);
  }

  const newCollections = sourceColls.filter(sc => !targetForkSources.has(sc.uid) && !targetNames.has(sc.name));

  // Specs: name match
  const targetSpecNames = new Set(targetSpecs.map(s => s.name));
  const newSpecs = sourceSpecs.filter(s => !targetSpecNames.has(s.name));

  // Environments: name match, exclude Mock Env
  const targetEnvNames = new Set(targetEnvs.map(e => e.name));
  const newEnvironments = sourceEnvs.filter(e => e.name !== 'Mock Env' && !targetEnvNames.has(e.name));

  log.info(`New: ${newCollections.length} collections, ${newSpecs.length} specs, ${newEnvironments.length} environments`);

  return { newCollections, newSpecs, newEnvironments, targetEnvs };
}

// ============================================================================
// PROCESSING
// ============================================================================

async function processNewCollections(newCollections, targetId) {
  log.section('FORKING NEW COLLECTIONS');
  const store = { collections: new Map(), mocks: new Map() };

  for (const coll of newCollections) {
    log.info(`Forking "${coll.name}"...`);
    try {
      const forkRes = await apiPost(`/collections/fork/${coll.uid}?workspace=${targetId}`, { label: coll.name });
      const forkedUid = forkRes.collection?.uid;
      if (!forkedUid) throw new Error('No UID in fork response');

      const details = await apiGet(`/collections/${forkedUid}`);
      const collDetails = details?.collection;
      const hostVars = collDetails ? extractHostVariables(collDetails) : [];

      store.collections.set(coll.uid, {
        sourceUid: coll.uid, targetUid: forkedUid, name: coll.name,
        hostVariables: hostVars, collectionDetails: collDetails,
      });
      log.success(`Forked "${coll.name}" → ${forkedUid}`);
    } catch (err) {
      log.error(`Failed to fork "${coll.name}": ${err.message}`);
    }
    await delay(300);
  }

  // Create mocks
  if (store.collections.size > 0) {
    log.section('CREATING MOCK SERVERS');
    for (const [, collData] of store.collections) {
      const mockName = `${collData.name} Mock`;
      log.info(`Creating "${mockName}"...`);
      try {
        const mockRes = await apiPost(`/mocks?workspace=${targetId}`, {
          mock: { name: mockName, collection: collData.targetUid, private: false },
        });
        const mock = mockRes.mock;
        store.mocks.set(collData.targetUid, {
          mockId: mock.id, mockUrl: mock.mockUrl, name: mockName, collectionName: collData.name,
        });
        log.success(`Created "${mockName}" → ${mock.mockUrl}`);
      } catch (err) {
        log.error(`Failed to create mock for "${collData.name}": ${err.message}`);
      }
      await delay(300);
    }
  }

  return store;
}

async function updateMockEnv(targetId, store, targetEnvs) {
  if (store.mocks.size === 0) return new Map();

  log.section('UPDATING MOCK ENVIRONMENT');

  // Generate new variables
  const variables = [];
  const mockEnvVarMap = new Map();

  for (const [, collData] of store.collections) {
    const mockData = Array.from(store.mocks.values()).find(m => m.collectionName === collData.name);
    if (!mockData) continue;

    const hostVars = collData.hostVariables || [];
    if (hostVars.length === 0) {
      const varName = toVariableName(collData.name) + 'BaseUrl';
      variables.push({ key: varName, value: mockData.mockUrl, type: 'default', enabled: true });
      mockEnvVarMap.set(`${collData.targetUid}:__fallback__`, varName);
    } else {
      for (const hv of hostVars) {
        const envVarName = toVariableName(collData.name) + toPascalCase(hv.varName);
        variables.push({ key: envVarName, value: mockData.mockUrl, type: 'default', enabled: true });
        mockEnvVarMap.set(`${collData.targetUid}:${hv.varName}`, envVarName);
      }
    }
  }

  if (variables.length === 0) return mockEnvVarMap;

  // Find existing Mock Env
  const mockEnv = targetEnvs.find(e => e.name === 'Mock Env');

  if (mockEnv) {
    const details = await apiGet(`/environments/${mockEnv.uid}`);
    const existingVars = details?.environment?.values || [];
    const existingKeys = new Set(existingVars.map(v => v.key));

    const deduped = variables.map(v => {
      if (existingKeys.has(v.key)) {
        let suffix = 2;
        let newKey = `${v.key}${suffix}`;
        while (existingKeys.has(newKey)) { suffix++; newKey = `${v.key}${suffix}`; }
        for (const [mapKey, mapVal] of mockEnvVarMap.entries()) {
          if (mapVal === v.key) mockEnvVarMap.set(mapKey, newKey);
        }
        return { ...v, key: newKey };
      }
      return v;
    });

    const merged = [...existingVars, ...deduped];
    await apiPut(`/environments/${mockEnv.uid}`, { environment: { name: 'Mock Env', values: merged } });
    log.success(`Updated Mock Env with ${deduped.length} new variable(s)`);
  } else {
    await apiPost(`/environments?workspace=${targetId}`, {
      environment: { name: 'Mock Env', values: variables },
    });
    log.success(`Created Mock Env with ${variables.length} variable(s)`);
  }

  return mockEnvVarMap;
}

async function updateCollectionVariables(store, mockEnvVarMap) {
  if (!mockEnvVarMap || mockEnvVarMap.size === 0) return;

  log.section('UPDATING COLLECTION VARIABLES');

  for (const [, collData] of store.collections) {
    if (!collData.collectionDetails) continue;
    const hostVars = collData.hostVariables || [];
    const existingVars = collData.collectionDetails.variable || [];

    if (hostVars.length > 0) {
      const updatedVars = existingVars.map(v => {
        const hv = hostVars.find(h => h.varName === v.key);
        if (hv) {
          const envName = mockEnvVarMap.get(`${collData.targetUid}:${hv.varName}`);
          if (envName) return { ...v, value: `{{${envName}}}` };
        }
        return v;
      });
      for (const hv of hostVars) {
        const envName = mockEnvVarMap.get(`${collData.targetUid}:${hv.varName}`);
        if (envName && !updatedVars.some(v => v.key === hv.varName)) {
          updatedVars.push({ key: hv.varName, value: `{{${envName}}}`, type: 'string' });
        }
      }
      await apiPatch(`/collections/${collData.targetUid}`, { collection: { variable: updatedVars } });
      log.success(`Updated variables for "${collData.name}"`);
      await delay(300);
      continue;
    }

    const fallback = mockEnvVarMap.get(`${collData.targetUid}:__fallback__`);
    if (!fallback) continue;
    const commonVar = existingVars.find(v => COMMON_HOST_VAR_NAMES.some(n => n.toLowerCase() === v.key.toLowerCase()));
    const updatedVars = commonVar
      ? existingVars.map(v => v.key === commonVar.key ? { ...v, value: `{{${fallback}}}` } : v)
      : [...existingVars, { key: 'baseUrl', value: `{{${fallback}}}`, type: 'string' }];
    await apiPatch(`/collections/${collData.targetUid}`, { collection: { variable: updatedVars } });
    log.success(`Updated variables for "${collData.name}" (fallback)`);
    await delay(300);
  }
}

async function copyNewSpecs(newSpecs, targetId) {
  log.section('COPYING NEW SPECS');
  for (const spec of newSpecs) {
    log.info(`Copying "${spec.name}"...`);
    try {
      const filesRes = await apiGet(`/specs/${spec.id}/files`);
      const files = filesRes.files || [];
      const filesWithContent = [];
      for (const f of files) {
        const fileData = await apiGet(`/specs/${spec.id}/files/${f.path}`);
        if (fileData?.content) {
          filesWithContent.push({ path: f.path, content: fileData.content, type: f.type });
        }
        await delay(200);
      }
      if (filesWithContent.length > 0) {
        await apiPost(`/specs?workspaceId=${targetId}`, { name: spec.name, type: spec.type, files: filesWithContent });
        log.success(`Copied "${spec.name}" (${filesWithContent.length} file(s))`);
      }
    } catch (err) {
      log.error(`Failed to copy spec "${spec.name}": ${err.message}`);
    }
    await delay(500);
  }
}

async function copyNewEnvironments(newEnvironments, targetId) {
  log.section('COPYING NEW ENVIRONMENTS');
  for (const env of newEnvironments) {
    log.info(`Copying "${env.name}"...`);
    try {
      const details = await apiGet(`/environments/${env.uid}`);
      const envData = details?.environment;
      if (envData) {
        await apiPost(`/environments?workspace=${targetId}`, {
          environment: { name: envData.name, values: envData.values || [] },
        });
        log.success(`Copied "${env.name}"`);
      }
    } catch (err) {
      log.error(`Failed to copy environment "${env.name}": ${err.message}`);
    }
    await delay(300);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n\x1b[1m\x1b[36m╔══════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[1m\x1b[36m║   Partner Workspace Update Detection     ║\x1b[0m');
  console.log('\x1b[1m\x1b[36m╚══════════════════════════════════════════╝\x1b[0m\n');

  const sourceId = getArg('--source') || POSTMAN_SOURCE_WORKSPACE_ID;
  const targetId = getArg('--target') || POSTMAN_TARGET_WORKSPACE_ID;

  if (!POSTMAN_API_KEY) { log.error('POSTMAN_API_KEY is required'); process.exit(1); }
  if (!sourceId) { log.error('Source workspace ID is required (--source or POSTMAN_SOURCE_WORKSPACE_ID)'); process.exit(1); }
  if (!targetId) { log.error('Target workspace ID is required (--target or POSTMAN_TARGET_WORKSPACE_ID)'); process.exit(1); }

  // Validate API key
  try {
    const me = await apiGet('/me');
    log.success(`Authenticated as ${me.user?.username || 'unknown'}`);
  } catch (err) {
    log.error(`Authentication failed: ${err.message}`);
    process.exit(1);
  }

  // Detect
  const { newCollections, newSpecs, newEnvironments, targetEnvs } = await detectNewAssets(sourceId, targetId);

  if (newCollections.length === 0 && newSpecs.length === 0 && newEnvironments.length === 0) {
    log.success('Workspace is up to date — no new assets found.');
    process.exit(0);
  }

  // Confirm unless --confirm flag is present
  if (!hasFlag('--confirm')) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(resolve => rl.question(
      `\nProceed with adding ${newCollections.length} collection(s), ${newSpecs.length} spec(s), ${newEnvironments.length} environment(s)? (y/n) `,
      resolve
    ));
    rl.close();
    if (answer.toLowerCase() !== 'y') { log.warn('Cancelled.'); process.exit(0); }
  }

  // Process
  const store = await processNewCollections(newCollections, targetId);
  const mockEnvVarMap = await updateMockEnv(targetId, store, targetEnvs);
  await updateCollectionVariables(store, mockEnvVarMap);

  if (newSpecs.length > 0) await copyNewSpecs(newSpecs, targetId);
  if (newEnvironments.length > 0) await copyNewEnvironments(newEnvironments, targetId);

  // Summary
  log.section('UPDATE COMPLETE');
  log.success(`Collections added: ${store.collections.size}`);
  log.success(`Mocks created: ${store.mocks.size}`);
  log.success(`Specs copied: ${newSpecs.length}`);
  log.success(`Environments copied: ${newEnvironments.length}`);
}

main().catch(err => {
  log.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
```

- [ ] **Step 2: Create root `update.js`**

The root `update.js` is identical to `cli/update.js` (same pattern as `provision.js` and `reset.js` at root level).

```bash
cp cli/update.js update.js
```

- [ ] **Step 3: Update `package.json`**

Add the `update` script:

```json
"update": "node cli/update.js"
```

The scripts section should become:

```json
"scripts": {
    "provision": "node cli/provision.js",
    "reset": "node cli/reset.js",
    "update": "node cli/update.js",
    "provision:help": "echo 'Usage: npm run provision -- --name \"Workspace Name\"'",
    "reset:help": "echo 'Usage: npm run reset -- --workspace-id \"workspace-id\" --confirm'"
}
```

- [ ] **Step 4: Verify script runs**

Run: `node cli/update.js --help`
Expected: Script starts, shows the banner, then errors with missing API key (which confirms the script loads and parses correctly).

- [ ] **Step 5: Commit**

```bash
git add cli/update.js update.js package.json
git commit -m "feat: add CLI update script and npm run update command"
```

---

## Task 6: Standalone Scripts — Add Update Functions

**Files:**
- Modify: `dev-portal/javascript/script/postmanService.js`
- Modify: `dev-portal/python/script/postman_service.py`
- Modify: `dev-portal/java/script/PostmanService.java`

These are large single-file scripts. For each, add an `updateWorkspace` function that contains the detection, forking, mock creation, mock env update, collection variable update, spec copying, and environment copying logic — following the exact patterns already in each file.

- [ ] **Step 1: Add update function to JS standalone script**

Add to the end of `dev-portal/javascript/script/postmanService.js` (before any final export), an `updateWorkspace` function that mirrors the CLI `main()` flow from Task 5. The function should be exported and accept `{ sourceWorkspaceId, targetWorkspaceId, onProgress }`. Reuse the existing utility functions already in the file (`toPascalCase`, `extractHostVariables`, `extractUrlPath`, etc.) and the existing API helper functions.

The function body follows the same detection → fork → mock → mock env update → collection var update → specs → environments flow from Task 1's `UpdateService.update()` method, but using the file's existing API call patterns rather than a client class.

- [ ] **Step 2: Add update function to Python standalone script**

Add to the end of `dev-portal/python/script/postman_service.py` an `async def update_workspace(source_workspace_id, target_workspace_id, on_progress=None)` function. Same logic as the Python SDK's `UpdateService.update()` but using the file's existing API helper functions directly.

- [ ] **Step 3: Add update method to Java standalone script**

Add to `dev-portal/java/script/PostmanService.java` a `public Mono<Map<String, Object>> updateWorkspace(String sourceWorkspaceId, String targetWorkspaceId)` method. Same logic as the Java SDK's `UpdateService.update()` but using the file's existing WebClient-based API methods.

- [ ] **Step 4: Commit**

```bash
git add dev-portal/javascript/script/postmanService.js dev-portal/python/script/postman_service.py dev-portal/java/script/PostmanService.java
git commit -m "feat: add updateWorkspace to standalone scripts across all languages"
```

---

## Task 7: Verification

- [ ] **Step 1: Verify JS SDK exports**

Run: `cd dev-portal/javascript/sdk && node -e "import('./src/index.js').then(m => console.log('UpdateService:', typeof m.UpdateService, 'updateWorkspace:', typeof m.updateWorkspace))"`

Expected: `UpdateService: function updateWorkspace: function`

- [ ] **Step 2: Verify TS SDK compiles**

Run: `cd dev-portal/typescript/sdk && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Verify Python SDK imports**

Run: `cd dev-portal/python/sdk && python -c "from postman_sdk import UpdateService; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Verify Java SDK compiles**

Run: `cd dev-portal/java/sdk && mvn compile`
Expected: `BUILD SUCCESS`

- [ ] **Step 5: Verify CLI update script starts**

Run: `node cli/update.js` (without env vars)
Expected: Shows banner, errors with "POSTMAN_API_KEY is required"

- [ ] **Step 6: End-to-end test with real workspaces (manual)**

If real workspace IDs are available:
1. Run `npm run provision` to create a partner workspace with 2 collections
2. Add a 3rd collection to the source workspace manually
3. Run `npm run update` — verify only the new collection is added
4. Verify Mock Env has 3 variables (2 original + 1 new)
5. Run `npm run update` again — verify "workspace is up to date"
