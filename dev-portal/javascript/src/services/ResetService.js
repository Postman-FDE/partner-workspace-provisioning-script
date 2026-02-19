/**
 * @typedef {import('../client/PostmanClient.js').PostmanClient} PostmanClient
 * @typedef {import('../client/PostmanClient.js').Workspace} Workspace
 * @typedef {import('../client/PostmanClient.js').Collection} Collection
 * @typedef {import('../client/PostmanClient.js').Environment} Environment
 * @typedef {import('../client/PostmanClient.js').MockServer} MockServer
 * @typedef {import('../client/PostmanClient.js').Spec} Spec
 */

/**
 * @typedef {Object} ResetOptions
 * @property {boolean} [includeSpecs=true] - Delete specs
 * @property {boolean} [includeMocks=true] - Delete mocks
 * @property {boolean} [includeEnvironments=true] - Delete environments
 * @property {boolean} [includeCollections=true] - Delete collections
 */

/**
 * @typedef {Object} CustomResetOptions
 * @property {boolean} [includeSpecs=true]
 * @property {boolean} [includeMocks=true]
 * @property {boolean} [includeEnvironments=true]
 * @property {boolean} [includeCollections=true]
 * @property {string[]} [selectedSpecIds]
 * @property {string[]} [selectedMockIds]
 * @property {string[]} [selectedEnvironmentUids]
 * @property {string[]} [selectedCollectionUids]
 */

/**
 * @typedef {Object} ProgressEvent
 * @property {string} phase - Current phase
 * @property {string} message - Progress message
 * @property {number} [deleted] - Items deleted
 * @property {number} [total] - Total items
 * @property {string} [currentItem] - Current item name
 */

/**
 * @typedef {Object} ResetResult
 * @property {Workspace} workspace
 * @property {{total: number, deleted: number, failed: Array}} specs
 * @property {{total: number, deleted: number, failed: Array}} mocks
 * @property {{total: number, deleted: number, failed: Array}} environments
 * @property {{total: number, deleted: number, failed: Array}} collections
 * @property {Array} errors
 */

/**
 * High-level reset workflow service
 */
export class ResetService {
  /**
   * @param {PostmanClient} client
   */
  constructor(client) {
    this.client = client;
  }

  /**
   * Scan workspace contents
   * @param {string} workspaceId
   * @returns {Promise<{workspace: Workspace, collections: Collection[], environments: Environment[], mocks: MockServer[], specs: Spec[]}>}
   */
  async scanWorkspace(workspaceId) {
    const [workspace, collections, environments, mocks, specs] = await Promise.all([
      this.client.getWorkspace(workspaceId),
      this.client.getCollections(workspaceId),
      this.client.getEnvironments(workspaceId),
      this.client.getMocks(workspaceId),
      this.client.getSpecs(workspaceId),
    ]);

    return { workspace, collections, environments, mocks, specs };
  }

  /**
   * Reset workspace - delete all or selected resource types
   * @param {string} workspaceId
   * @param {function(ProgressEvent): void} [onProgress]
   * @param {ResetOptions} [options]
   * @returns {Promise<ResetResult>}
   */
  async reset(workspaceId, onProgress, options = {}) {
    const {
      includeSpecs = true,
      includeMocks = true,
      includeEnvironments = true,
      includeCollections = true,
    } = options;

    const result = this._initResult();

    try {
      // Scan workspace
      this._emitProgress(onProgress, 'scanning', 'Scanning workspace...');
      const contents = await this.scanWorkspace(workspaceId);
      
      if (!contents.workspace) {
        throw new Error(`Workspace ${workspaceId} not found`);
      }
      result.workspace = contents.workspace;

      const totalItems = 
        (includeSpecs ? contents.specs.length : 0) +
        (includeMocks ? contents.mocks.length : 0) +
        (includeEnvironments ? contents.environments.length : 0) +
        (includeCollections ? contents.collections.length : 0);

      if (totalItems === 0) {
        this._emitProgress(onProgress, 'complete', 'Workspace is already empty');
        return result;
      }

      // Delete in reverse dependency order:
      // 1. Specs (no dependencies)
      // 2. Mocks (depend on collections)
      // 3. Environments (independent)
      // 4. Collections (deleted last)

      if (includeSpecs && contents.specs.length > 0) {
        this._emitProgress(onProgress, 'specs', `Deleting ${contents.specs.length} spec(s)...`);
        await this._deleteSpecs(contents.specs, result, onProgress);
      }

      if (includeMocks && contents.mocks.length > 0) {
        this._emitProgress(onProgress, 'mocks', `Deleting ${contents.mocks.length} mock server(s)...`);
        await this._deleteMocks(contents.mocks, result, onProgress);
      }

      if (includeEnvironments && contents.environments.length > 0) {
        this._emitProgress(onProgress, 'environments', `Deleting ${contents.environments.length} environment(s)...`);
        await this._deleteEnvironments(contents.environments, result, onProgress);
      }

      if (includeCollections && contents.collections.length > 0) {
        this._emitProgress(onProgress, 'collections', `Deleting ${contents.collections.length} collection(s)...`);
        await this._deleteCollections(contents.collections, result, onProgress);
      }

      this._emitProgress(onProgress, 'complete', 'Reset complete!');

    } catch (error) {
      result.errors.push(error.message);
      this._emitProgress(onProgress, 'error', `Error: ${error.message}`);
    }

    return result;
  }

  /**
   * Custom reset - delete specific items
   * @param {string} workspaceId
   * @param {function(ProgressEvent): void} [onProgress]
   * @param {CustomResetOptions} [options]
   * @returns {Promise<ResetResult>}
   */
  async resetCustom(workspaceId, onProgress, options = {}) {
    const {
      includeSpecs = true,
      includeMocks = true,
      includeEnvironments = true,
      includeCollections = true,
      selectedSpecIds,
      selectedMockIds,
      selectedEnvironmentUids,
      selectedCollectionUids,
    } = options;

    const result = this._initResult();

    try {
      // Scan workspace
      this._emitProgress(onProgress, 'scanning', 'Scanning workspace...');
      const contents = await this.scanWorkspace(workspaceId);

      if (!contents.workspace) {
        throw new Error(`Workspace ${workspaceId} not found`);
      }
      result.workspace = contents.workspace;

      // Filter items based on selection
      const specsToDelete = includeSpecs
        ? (selectedSpecIds ? contents.specs.filter(s => selectedSpecIds.includes(s.id)) : contents.specs)
        : [];
      const mocksToDelete = includeMocks
        ? (selectedMockIds ? contents.mocks.filter(m => selectedMockIds.includes(m.id)) : contents.mocks)
        : [];
      const envsToDelete = includeEnvironments
        ? (selectedEnvironmentUids ? contents.environments.filter(e => selectedEnvironmentUids.includes(e.uid)) : contents.environments)
        : [];
      const collectionsToDelete = includeCollections
        ? (selectedCollectionUids ? contents.collections.filter(c => selectedCollectionUids.includes(c.uid)) : contents.collections)
        : [];

      const totalItems = specsToDelete.length + mocksToDelete.length + envsToDelete.length + collectionsToDelete.length;

      if (totalItems === 0) {
        this._emitProgress(onProgress, 'complete', 'No items selected for deletion');
        return result;
      }

      // Delete in order
      if (specsToDelete.length > 0) {
        this._emitProgress(onProgress, 'specs', `Deleting ${specsToDelete.length} spec(s)...`);
        await this._deleteSpecs(specsToDelete, result, onProgress);
      }

      if (mocksToDelete.length > 0) {
        this._emitProgress(onProgress, 'mocks', `Deleting ${mocksToDelete.length} mock server(s)...`);
        await this._deleteMocks(mocksToDelete, result, onProgress);
      }

      if (envsToDelete.length > 0) {
        this._emitProgress(onProgress, 'environments', `Deleting ${envsToDelete.length} environment(s)...`);
        await this._deleteEnvironments(envsToDelete, result, onProgress);
      }

      if (collectionsToDelete.length > 0) {
        this._emitProgress(onProgress, 'collections', `Deleting ${collectionsToDelete.length} collection(s)...`);
        await this._deleteCollections(collectionsToDelete, result, onProgress);
      }

      this._emitProgress(onProgress, 'complete', 'Reset complete!');

    } catch (error) {
      result.errors.push(error.message);
      this._emitProgress(onProgress, 'error', `Error: ${error.message}`);
    }

    return result;
  }

  // ==================== Private Methods ====================

  _initResult() {
    return {
      workspace: null,
      specs: { total: 0, deleted: 0, failed: [] },
      mocks: { total: 0, deleted: 0, failed: [] },
      environments: { total: 0, deleted: 0, failed: [] },
      collections: { total: 0, deleted: 0, failed: [] },
      errors: [],
    };
  }

  _emitProgress(onProgress, phase, message, extra = {}) {
    if (onProgress) {
      onProgress({ phase, message, ...extra });
    }
  }

  async _deleteSpecs(specs, result, onProgress) {
    result.specs.total = specs.length;

    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i];

      this._emitProgress(onProgress, 'specs', `Deleting ${spec.name}...`, {
        deleted: i,
        total: specs.length,
        currentItem: spec.name,
      });

      const success = await this.client.deleteSpec(spec.id);

      if (success) {
        result.specs.deleted++;
      } else {
        result.specs.failed.push({ name: spec.name, id: spec.id });
      }

      await this._delay(300);
    }
  }

  async _deleteMocks(mocks, result, onProgress) {
    result.mocks.total = mocks.length;

    for (let i = 0; i < mocks.length; i++) {
      const mock = mocks[i];

      this._emitProgress(onProgress, 'mocks', `Deleting ${mock.name}...`, {
        deleted: i,
        total: mocks.length,
        currentItem: mock.name,
      });

      const success = await this.client.deleteMock(mock.id);

      if (success) {
        result.mocks.deleted++;
      } else {
        result.mocks.failed.push({ name: mock.name, id: mock.id });
      }

      await this._delay(300);
    }
  }

  async _deleteEnvironments(environments, result, onProgress) {
    result.environments.total = environments.length;

    for (let i = 0; i < environments.length; i++) {
      const env = environments[i];

      this._emitProgress(onProgress, 'environments', `Deleting ${env.name}...`, {
        deleted: i,
        total: environments.length,
        currentItem: env.name,
      });

      const success = await this.client.deleteEnvironment(env.uid);

      if (success) {
        result.environments.deleted++;
      } else {
        result.environments.failed.push({ name: env.name, uid: env.uid });
      }

      await this._delay(300);
    }
  }

  async _deleteCollections(collections, result, onProgress) {
    result.collections.total = collections.length;

    for (let i = 0; i < collections.length; i++) {
      const collection = collections[i];

      this._emitProgress(onProgress, 'collections', `Deleting ${collection.name}...`, {
        deleted: i,
        total: collections.length,
        currentItem: collection.name,
      });

      const success = await this.client.deleteCollection(collection.uid);

      if (success) {
        result.collections.deleted++;
      } else {
        result.collections.failed.push({ name: collection.name, uid: collection.uid });
      }

      await this._delay(300);
    }
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default ResetService;
