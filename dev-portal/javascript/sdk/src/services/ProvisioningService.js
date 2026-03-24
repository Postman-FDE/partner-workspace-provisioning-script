/**
 * @typedef {import('../client/PostmanClient.js').PostmanClient} PostmanClient
 * @typedef {import('../client/PostmanClient.js').Workspace} Workspace
 * @typedef {import('../client/PostmanClient.js').Collection} Collection
 * @typedef {import('../client/PostmanClient.js').Environment} Environment
 * @typedef {import('../client/PostmanClient.js').MockServer} MockServer
 * @typedef {import('../client/PostmanClient.js').Spec} Spec
 */

/**
 * @typedef {Object} ProvisioningOptions
 * @property {string} sourceWorkspaceId - Source workspace to copy from
 * @property {string} [targetWorkspaceId] - Existing target workspace
 * @property {string} [workspaceName] - Name for new workspace
 * @property {string} [workspaceType='partner'] - Workspace type
 * @property {string[]} [adminUserIds] - User IDs to add as admins
 * @property {string[]} [partnerEmails] - Partner emails to invite
 * @property {string} [partnerRoleId='7'] - Partner role ID
 */

/**
 * @typedef {Object} CustomProvisioningOptions
 * @property {string} sourceWorkspaceId
 * @property {string} [targetWorkspaceId]
 * @property {string} [workspaceName]
 * @property {string} [workspaceType]
 * @property {boolean} [copyCollections=true]
 * @property {boolean} [copyEnvironments=true]
 * @property {boolean} [copyMocks=true]
 * @property {boolean} [copySpecs=true]
 * @property {boolean} [createMockEnv=true]
 * @property {boolean} [addAdmins=true]
 * @property {boolean} [invitePartners=true]
 * @property {string[]} [selectedCollectionUids]
 * @property {string[]} [selectedEnvironmentUids]
 * @property {string[]} [selectedSpecIds]
 * @property {string[]} [adminUserIds]
 * @property {string[]} [partnerEmails]
 * @property {string} [partnerRoleId]
 */

/**
 * @typedef {Object} ProgressEvent
 * @property {string} phase - Current phase
 * @property {string} message - Progress message
 * @property {number} progress - Overall progress (0-100)
 * @property {number} [current] - Current item
 * @property {number} [total] - Total items
 * @property {string} [currentItem] - Current item name
 */

/**
 * @typedef {Object} ProvisioningResult
 * @property {Workspace} workspace
 * @property {boolean} workspaceCreated
 * @property {{total: number, success: number, failed: Array, successData: Array}} collections
 * @property {{total: number, success: number, failed: Array, urls: Object}} mocks
 * @property {{total: number, success: number, failed: Array, successData: Array}} environments
 * @property {{success: boolean, action: string}} mockEnv
 * @property {{total: number, success: number, failed: Array, successData: Array}} specs
 * @property {{total: number, success: number, failed: Array, successData: Array}} admins
 * @property {{total: number, success: number, failed: Array, links: Array}} invitations
 * @property {Array} errors
 */

const COMMON_HOST_VAR_NAMES = [
  'baseUrl',
  'baseurl',
  'base_url',
  'HostName',
  'hostname',
  'host',
  'apiUrl',
  'apiurl',
  'api_url',
  'serverUrl',
  'serverurl',
  'server_url',
];

/**
 * High-level provisioning workflow service
 */
export class ProvisioningService {
  /**
   * @param {PostmanClient} client
   * @param {Object} [config]
   * @param {string} [config.partnerRoleId='7'] - Default partner role ID
   * @param {string} [config.adminRoleId='3'] - Default admin role ID
   */
  constructor(client, config = {}) {
    this.client = client;
    this.partnerRoleId = config.partnerRoleId || '7';
    this.adminRoleId = config.adminRoleId || '3';
  }

  /**
   * Full workspace provisioning
   * @param {ProvisioningOptions} options
   * @param {function(ProgressEvent): void} [onProgress] - Progress callback
   * @returns {Promise<ProvisioningResult>}
   */
  async provision(options, onProgress) {
    const result = this._initResult();
    const store = {
      collections: new Map(),
      mocks: new Map(),
      environments: new Map(),
      specs: new Map(),
    };

    try {
      // Phase 1: Validation
      this._emitProgress(onProgress, 'validation', 'Validating API key...', 0);
      const validation = await this.client.validateApiKey();
      if (!validation.valid) {
        throw new Error(`Invalid API key: ${validation.error}`);
      }

      // Phase 2: Initialize workspace
      this._emitProgress(onProgress, 'workspace', 'Initializing workspace...', 5);
      const wsResult = await this._initializeWorkspace(options);
      if (!wsResult.success) {
        throw new Error(wsResult.error);
      }
      result.workspace = wsResult.workspace;
      result.workspaceCreated = wsResult.created;
      const targetWorkspaceId = wsResult.workspace.id;

      // Phase 3: Copy collections
      this._emitProgress(onProgress, 'collections', 'Copying collections...', 15);
      await this._copyCollections(options.sourceWorkspaceId, targetWorkspaceId, store, result, onProgress);

      // Phase 4: Create mocks
      this._emitProgress(onProgress, 'mocks', 'Creating mock servers...', 35);
      await this._createMocks(targetWorkspaceId, store, result, onProgress);

      // Phase 5: Copy environments
      this._emitProgress(onProgress, 'environments', 'Copying environments...', 50);
      await this._copyEnvironments(options.sourceWorkspaceId, targetWorkspaceId, store, result, onProgress);

      // Phase 6: Update mock environment
      this._emitProgress(onProgress, 'mockEnv', 'Updating mock environment...', 65);
      const mockEnvVarMap = await this._updateMockEnv(targetWorkspaceId, store, result);

      // Phase 6b: Update collection variables
      await this._updateCollectionVariables(store, mockEnvVarMap);

      // Phase 7: Copy specs
      this._emitProgress(onProgress, 'specs', 'Copying API specs...', 70);
      await this._copySpecs(options.sourceWorkspaceId, targetWorkspaceId, store, result, onProgress);

      // Phase 8: Add admins
      if (options.adminUserIds?.length) {
        this._emitProgress(onProgress, 'admins', 'Adding workspace admins...', 85);
        await this._addAdmins(targetWorkspaceId, options.adminUserIds, result, onProgress);
      }

      // Phase 9: Invite partners
      if (options.partnerEmails?.length) {
        this._emitProgress(onProgress, 'partners', 'Inviting partners...', 92);
        await this._invitePartners(
          targetWorkspaceId,
          options.partnerEmails,
          options.partnerRoleId || this.partnerRoleId,
          result,
          onProgress
        );
      }

      this._emitProgress(onProgress, 'complete', 'Provisioning complete!', 100);

    } catch (error) {
      result.errors.push(error.message);
      this._emitProgress(onProgress, 'error', `Error: ${error.message}`, -1);
    }

    return result;
  }

  /**
   * Custom workspace provisioning with selective options
   * @param {CustomProvisioningOptions} options
   * @param {function(ProgressEvent): void} [onProgress]
   * @returns {Promise<ProvisioningResult>}
   */
  async provisionCustom(options, onProgress) {
    const {
      copyCollections = true,
      copyEnvironments = true,
      copyMocks = true,
      copySpecs = true,
      createMockEnv = true,
      addAdmins = true,
      invitePartners = true,
      selectedCollectionUids,
      selectedEnvironmentUids,
      selectedSpecIds,
    } = options;

    const result = this._initResult();
    const store = {
      collections: new Map(),
      mocks: new Map(),
      environments: new Map(),
      specs: new Map(),
    };

    try {
      // Validation
      this._emitProgress(onProgress, 'validation', 'Validating API key...', 0);
      const validation = await this.client.validateApiKey();
      if (!validation.valid) {
        throw new Error(`Invalid API key: ${validation.error}`);
      }

      // Initialize workspace
      this._emitProgress(onProgress, 'workspace', 'Initializing workspace...', 5);
      const wsResult = await this._initializeWorkspace(options);
      if (!wsResult.success) {
        throw new Error(wsResult.error);
      }
      result.workspace = wsResult.workspace;
      result.workspaceCreated = wsResult.created;
      const targetWorkspaceId = wsResult.workspace.id;

      let progress = 10;
      const steps = [copyCollections, copyMocks, copyEnvironments, createMockEnv, copySpecs, addAdmins, invitePartners]
        .filter(Boolean).length;
      const progressPerStep = 80 / Math.max(steps, 1);

      // Copy collections
      if (copyCollections) {
        this._emitProgress(onProgress, 'collections', 'Copying collections...', progress);
        await this._copyCollections(
          options.sourceWorkspaceId,
          targetWorkspaceId,
          store,
          result,
          onProgress,
          selectedCollectionUids
        );
        progress += progressPerStep;
      }

      // Create mocks
      if (copyMocks && copyCollections) {
        this._emitProgress(onProgress, 'mocks', 'Creating mock servers...', progress);
        await this._createMocks(targetWorkspaceId, store, result, onProgress);
        progress += progressPerStep;
      }

      // Copy environments
      if (copyEnvironments) {
        this._emitProgress(onProgress, 'environments', 'Copying environments...', progress);
        await this._copyEnvironments(
          options.sourceWorkspaceId,
          targetWorkspaceId,
          store,
          result,
          onProgress,
          selectedEnvironmentUids
        );
        progress += progressPerStep;
      }

      // Update mock environment
      let mockEnvVarMap;
      if (createMockEnv && copyMocks) {
        this._emitProgress(onProgress, 'mockEnv', 'Updating mock environment...', progress);
        mockEnvVarMap = await this._updateMockEnv(targetWorkspaceId, store, result);
        progress += progressPerStep;
      }

      // Update collection variables
      await this._updateCollectionVariables(store, mockEnvVarMap);

      // Copy specs
      if (copySpecs) {
        this._emitProgress(onProgress, 'specs', 'Copying API specs...', progress);
        await this._copySpecs(
          options.sourceWorkspaceId,
          targetWorkspaceId,
          store,
          result,
          onProgress,
          selectedSpecIds
        );
        progress += progressPerStep;
      }

      // Add admins
      if (addAdmins && options.adminUserIds?.length) {
        this._emitProgress(onProgress, 'admins', 'Adding workspace admins...', progress);
        await this._addAdmins(targetWorkspaceId, options.adminUserIds, result, onProgress);
        progress += progressPerStep;
      }

      // Invite partners
      if (invitePartners && options.partnerEmails?.length) {
        this._emitProgress(onProgress, 'partners', 'Inviting partners...', progress);
        await this._invitePartners(
          targetWorkspaceId,
          options.partnerEmails,
          options.partnerRoleId || this.partnerRoleId,
          result,
          onProgress
        );
      }

      this._emitProgress(onProgress, 'complete', 'Provisioning complete!', 100);

    } catch (error) {
      result.errors.push(error.message);
      this._emitProgress(onProgress, 'error', `Error: ${error.message}`, -1);
    }

    return result;
  }

  // ==================== Private Methods ====================

  _initResult() {
    return {
      workspace: null,
      workspaceCreated: false,
      collections: { total: 0, success: 0, failed: [], successData: [] },
      mocks: { total: 0, success: 0, failed: [], urls: {} },
      environments: { total: 0, success: 0, failed: [], successData: [] },
      mockEnv: { success: false, action: null },
      specs: { total: 0, success: 0, failed: [], successData: [] },
      admins: { total: 0, success: 0, failed: [], successData: [] },
      invitations: { total: 0, success: 0, failed: [], links: [] },
      errors: [],
    };
  }

  _emitProgress(onProgress, phase, message, progress, extra = {}) {
    if (onProgress) {
      onProgress({ phase, message, progress, ...extra });
    }
  }

  async _initializeWorkspace(options) {
    const { targetWorkspaceId, workspaceName, workspaceType = 'partner' } = options;

    if (targetWorkspaceId) {
      const workspace = await this.client.getWorkspace(targetWorkspaceId);
      if (workspace) {
        return { success: true, workspace, created: false };
      }
      return { success: false, error: `Workspace ${targetWorkspaceId} not found` };
    }

    if (!workspaceName) {
      return { success: false, error: 'Workspace name required for new workspace' };
    }

    const result = await this.client.createWorkspace(workspaceName, workspaceType);
    if (result.success) {
      return { success: true, workspace: result.workspace, created: true };
    }
    return { success: false, error: result.error };
  }

  async _copyCollections(sourceWorkspaceId, targetWorkspaceId, store, result, onProgress, selectedUids = null) {
    const collections = await this.client.getCollections(sourceWorkspaceId);
    const toProcess = selectedUids
      ? collections.filter(c => selectedUids.includes(c.uid))
      : collections;

    result.collections.total = toProcess.length;

    for (let i = 0; i < toProcess.length; i++) {
      const collection = toProcess[i];
      
      this._emitProgress(onProgress, 'collections', `Copying ${collection.name}...`, null, {
        current: i + 1,
        total: toProcess.length,
        currentItem: collection.name,
      });

      const forkResult = await this.client.forkCollection(collection.uid, collection.name, targetWorkspaceId);
      
      if (forkResult.success) {
        result.collections.success++;
        result.collections.successData.push({
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
        result.collections.failed.push({
          name: collection.name,
          error: forkResult.error,
        });
      }

      await this._delay(300);
    }
  }

  async _createMocks(targetWorkspaceId, store, result, onProgress) {
    const collections = Array.from(store.collections.values());
    result.mocks.total = collections.length;

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
        result.mocks.success++;
        result.mocks.urls[name] = mockResult.mock.mockUrl;
        store.mocks.set(targetUid, {
          mockId: mockResult.mock.id,
          mockUrl: mockResult.mock.mockUrl,
          name: mockName,
          collectionName: name,
        });
      } else {
        result.mocks.failed.push({
          name: mockName,
          error: mockResult.error,
        });
      }

      await this._delay(300);
    }
  }

  async _copyEnvironments(sourceWorkspaceId, targetWorkspaceId, store, result, onProgress, selectedUids = null) {
    const environments = await this.client.getEnvironments(sourceWorkspaceId);
    const toProcess = selectedUids
      ? environments.filter(e => selectedUids.includes(e.uid))
      : environments;

    result.environments.total = toProcess.length;

    for (let i = 0; i < toProcess.length; i++) {
      const env = toProcess[i];

      this._emitProgress(onProgress, 'environments', `Copying ${env.name}...`, null, {
        current: i + 1,
        total: toProcess.length,
        currentItem: env.name,
      });

      // Get full environment details
      const details = await this.client.getEnvironmentDetails(env.uid);
      if (!details) {
        result.environments.failed.push({ name: env.name, error: 'Could not fetch details' });
        continue;
      }

      const createResult = await this.client.createEnvironment(
        details.name,
        details.values || [],
        targetWorkspaceId
      );

      if (createResult.success) {
        result.environments.success++;
        result.environments.successData.push({
          name: details.name,
          sourceUid: env.uid,
          targetUid: createResult.environment.uid,
        });
        store.environments.set(env.uid, {
          sourceUid: env.uid,
          targetUid: createResult.environment.uid,
          name: details.name,
        });
      } else {
        result.environments.failed.push({
          name: details.name,
          error: createResult.error,
        });
      }

      await this._delay(300);
    }
  }

  async _updateMockEnv(targetWorkspaceId, store, result) {
    const { variables: mockUrlVars, mockEnvVarMap } = this._generateMockUrlVariables(store);
    if (mockUrlVars.length === 0) {
      return mockEnvVarMap;
    }

    const createResult = await this.client.createEnvironment('Mock Env', mockUrlVars, targetWorkspaceId);
    result.mockEnv.success = createResult.success;
    result.mockEnv.action = 'created';

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

  async _copySpecs(sourceWorkspaceId, targetWorkspaceId, store, result, onProgress, selectedIds = null) {
    const specs = await this.client.getSpecs(sourceWorkspaceId);
    const toProcess = selectedIds
      ? specs.filter(s => selectedIds.includes(s.id))
      : specs;

    result.specs.total = toProcess.length;

    for (let i = 0; i < toProcess.length; i++) {
      const spec = toProcess[i];

      this._emitProgress(onProgress, 'specs', `Copying ${spec.name}...`, null, {
        current: i + 1,
        total: toProcess.length,
        currentItem: spec.name,
      });

      const copyResult = await this._copySingleSpec(spec, targetWorkspaceId);
      
      if (copyResult.success) {
        result.specs.success++;
        result.specs.successData.push({
          name: spec.name,
          sourceId: spec.id,
          targetId: copyResult.specId,
          filesCopied: copyResult.filesCopied,
        });
        store.specs.set(spec.id, {
          sourceId: spec.id,
          targetId: copyResult.specId,
          name: spec.name,
        });
      } else {
        result.specs.failed.push({
          name: spec.name,
          error: copyResult.error,
        });
      }

      await this._delay(500);
    }
  }

  async _copySingleSpec(spec, targetWorkspaceId) {
    try {
      // Get all files
      const files = await this.client.getSpecFiles(spec.id);
      if (files.length === 0) {
        return { success: false, error: 'No files found in spec' };
      }

      // Get content for each file
      const filesWithContent = [];
      for (const file of files) {
        const fileData = await this.client.getSpecFile(spec.id, file.path);
        if (fileData?.content) {
          filesWithContent.push({
            path: file.path,
            content: fileData.content,
            type: file.type,
          });
        }
        await this._delay(200);
      }

      if (filesWithContent.length === 0) {
        return { success: false, error: 'Could not retrieve file contents' };
      }

      // Create spec in target
      const createResult = await this.client.createSpec(
        targetWorkspaceId,
        spec.name,
        spec.type,
        filesWithContent
      );

      if (createResult.success) {
        return {
          success: true,
          specId: createResult.spec.id,
          filesCopied: filesWithContent.length,
        };
      }
      return { success: false, error: createResult.error };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async _addAdmins(workspaceId, userIds, result, onProgress) {
    result.admins.total = userIds.length;

    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];

      this._emitProgress(onProgress, 'admins', `Adding admin ${userId}...`, null, {
        current: i + 1,
        total: userIds.length,
        currentItem: userId,
      });

      const addResult = await this.client.addWorkspaceAdmin(workspaceId, userId, this.adminRoleId);

      if (addResult.success) {
        result.admins.success++;
        result.admins.successData.push({ userId });
      } else {
        result.admins.failed.push({ userId, error: addResult.error });
      }

      await this._delay(300);
    }
  }

  async _invitePartners(workspaceId, emails, roleId, result, onProgress) {
    result.invitations.total = emails.length;

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];

      this._emitProgress(onProgress, 'partners', `Inviting ${email}...`, null, {
        current: i + 1,
        total: emails.length,
        currentItem: email,
      });

      const inviteResult = await this.client.invitePartner(workspaceId, email, roleId);

      if (inviteResult.success) {
        result.invitations.success++;
        if (inviteResult.invitationLink) {
          result.invitations.links.push({
            email,
            link: inviteResult.invitationLink,
          });
        }
      } else {
        result.invitations.failed.push({ email, error: inviteResult.error });
      }

      await this._delay(300);
    }
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default ProvisioningService;
