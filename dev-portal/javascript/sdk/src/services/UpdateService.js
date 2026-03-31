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

      // Auto-link specs to new collection names
      const normalize = (name) => (name || '').toLowerCase().trim();
      const newCollectionNames = new Set(newCollections.map(c => normalize(c.name)));
      const linkedSpecs = newSpecs.filter(s => newCollectionNames.has(normalize(s.name)));

      // Check if workspace is up to date
      if (newCollections.length === 0 && linkedSpecs.length === 0 && newEnvironments.length === 0) {
        this._emitProgress(onProgress, 'complete', 'Workspace is up to date — no new assets found.', 100);
        return result;
      }

      this._emitProgress(onProgress, 'detection',
        `Found ${newCollections.length} new collection(s), ${linkedSpecs.length} new spec(s), ${newEnvironments.length} new environment(s)`,
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
      if (linkedSpecs.length > 0) {
        this._emitProgress(onProgress, 'specs', 'Copying new API specs...', 75);
        await this._copyNewSpecs(linkedSpecs, targetWorkspaceId, result, onProgress);
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

  /**
   * Scan workspaces and return a diff of new assets without making changes.
   * Specs are auto-linked to new collections by name.
   */
  async scan(options) {
    const { sourceWorkspaceId, targetWorkspaceId } = options;

    const validation = await this.client.validateApiKey();
    if (!validation.valid) throw new Error(`Invalid API key: ${validation.error}`);

    const { newCollections, newSpecs, newEnvironments } = await this._detectNewAssets(
      sourceWorkspaceId, targetWorkspaceId
    );

    const normalize = (name) => (name || '').toLowerCase().trim();
    const newCollectionNames = new Set(newCollections.map(c => normalize(c.name)));
    const linkedSpecs = newSpecs.filter(s => newCollectionNames.has(normalize(s.name)));

    return {
      newCollections: newCollections.map(c => ({ id: c.id, uid: c.uid, name: c.name })),
      newSpecs: linkedSpecs.map(s => ({ id: s.id, name: s.name, type: s.type })),
      newEnvironments: newEnvironments.map(e => ({ id: e.id, uid: e.uid, name: e.name })),
      isUpToDate: newCollections.length === 0 && linkedSpecs.length === 0 && newEnvironments.length === 0,
    };
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

    // Normalize names for robust comparison (case-insensitive, trimmed)
    const normalize = (name) => (name || '').toLowerCase().trim();

    // Detect new specs (name match only)
    const targetSpecNames = new Set(targetSpecs.map(s => normalize(s.name)));
    const newSpecs = sourceSpecs.filter(s => !targetSpecNames.has(normalize(s.name)));

    // Detect new environments (name match, exclude "Mock Env")
    const targetEnvNames = new Set(targetEnvs.map(e => normalize(e.name)));
    const newEnvironments = sourceEnvs.filter(
      e => e.name !== 'Mock Env' && !targetEnvNames.has(normalize(e.name))
    );

    return { newCollections, newSpecs, newEnvironments };
  }

  /**
   * Find source collections that don't exist in target.
   * Uses fork relationship (primary) then name match (fallback).
   */
  async _findNewCollections(sourceCollections, targetCollections) {
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
          existingKeys.add(newKey);
          return { ...v, key: newKey };
        }
        existingKeys.add(v.key);
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

    for (const [, collData] of store.collections) {
      const mockData = store.mocks.get(collData.targetUid);
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
