/**
 * Check if Postman is configured (has API key and source workspace)
 * @param {Object} [env] - Environment variables object
 * @returns {boolean}
 */
export function isPostmanConfigured(env = process.env) {
  const apiKey = env.POSTMAN_API_KEY || env.VITE_POSTMAN_API_KEY;
  const sourceWorkspace = env.POSTMAN_SOURCE_WORKSPACE_ID || env.VITE_POSTMAN_SOURCE_WORKSPACE_ID;
  return !!(apiKey && sourceWorkspace);
}

/**
 * Check if Postman is fully configured (API key + source + target workspaces)
 * @param {Object} [env] - Environment variables object
 * @returns {boolean}
 */
export function isPostmanFullyConfigured(env = process.env) {
  const apiKey = env.POSTMAN_API_KEY || env.VITE_POSTMAN_API_KEY;
  const sourceWorkspace = env.POSTMAN_SOURCE_WORKSPACE_ID || env.VITE_POSTMAN_SOURCE_WORKSPACE_ID;
  const targetWorkspace = env.POSTMAN_TARGET_WORKSPACE_ID || env.VITE_POSTMAN_TARGET_WORKSPACE_ID;
  return !!(apiKey && sourceWorkspace && targetWorkspace);
}

/**
 * Get configuration status
 * @param {Object} [env] - Environment variables object
 * @returns {{hasApiKey: boolean, hasSourceWorkspace: boolean, hasTargetWorkspace: boolean, isConfigured: boolean, message: string}}
 */
export function getConfigurationStatus(env = process.env) {
  const hasApiKey = !!(env.POSTMAN_API_KEY || env.VITE_POSTMAN_API_KEY);
  const hasSourceWorkspace = !!(env.POSTMAN_SOURCE_WORKSPACE_ID || env.VITE_POSTMAN_SOURCE_WORKSPACE_ID);
  const hasTargetWorkspace = !!(env.POSTMAN_TARGET_WORKSPACE_ID || env.VITE_POSTMAN_TARGET_WORKSPACE_ID);

  let message = '';
  if (!hasApiKey) {
    message = 'Missing Postman API key';
  } else if (!hasSourceWorkspace) {
    message = 'Missing source workspace ID';
  } else if (!hasTargetWorkspace) {
    message = 'Ready (will create new workspace)';
  } else {
    message = 'Fully configured';
  }

  return {
    hasApiKey,
    hasSourceWorkspace,
    hasTargetWorkspace,
    isConfigured: hasApiKey && hasSourceWorkspace,
    message,
  };
}

/**
 * Get API key from environment
 * @param {Object} [env] - Environment variables object
 * @returns {string|undefined}
 */
export function getApiKey(env = process.env) {
  return env.POSTMAN_API_KEY || env.VITE_POSTMAN_API_KEY;
}

/**
 * Get source workspace ID from environment
 * @param {Object} [env] - Environment variables object
 * @returns {string|undefined}
 */
export function getSourceWorkspaceId(env = process.env) {
  return env.POSTMAN_SOURCE_WORKSPACE_ID || env.VITE_POSTMAN_SOURCE_WORKSPACE_ID;
}

/**
 * Get target workspace ID from environment
 * @param {Object} [env] - Environment variables object
 * @returns {string|undefined}
 */
export function getTargetWorkspaceId(env = process.env) {
  return env.POSTMAN_TARGET_WORKSPACE_ID || env.VITE_POSTMAN_TARGET_WORKSPACE_ID;
}

/**
 * Parse comma-separated string to array
 * @param {string} [value] - Comma-separated string
 * @returns {string[]}
 */
export function parseCommaSeparated(value) {
  if (!value) return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Format collections for UI checklist
 * @param {Array} collections - Raw collection data
 * @returns {Array<{id: string, uid: string, name: string, selected: boolean, metadata: Object}>}
 */
export function formatCollectionsForUI(collections) {
  return collections.map(c => ({
    id: c.id,
    uid: c.uid,
    name: c.name,
    selected: false,
    metadata: {
      owner: c.owner,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    },
  }));
}

/**
 * Format environments for UI checklist
 * @param {Array} environments - Raw environment data
 * @returns {Array<{id: string, uid: string, name: string, selected: boolean, metadata: Object}>}
 */
export function formatEnvironmentsForUI(environments) {
  return environments.map(e => ({
    id: e.id,
    uid: e.uid,
    name: e.name,
    selected: false,
    metadata: {
      owner: e.owner,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    },
  }));
}

/**
 * Format mocks for UI checklist
 * @param {Array} mocks - Raw mock data
 * @returns {Array<{id: string, uid: string, name: string, selected: boolean, collectionUid: string, mockUrl: string}>}
 */
export function formatMocksForUI(mocks) {
  return mocks.map(m => ({
    id: m.id,
    uid: m.uid,
    name: m.name,
    selected: false,
    collectionUid: m.collection,
    mockUrl: m.mockUrl,
  }));
}

/**
 * Format specs for UI checklist
 * @param {Array} specs - Raw spec data
 * @returns {Array<{id: string, name: string, type: string, selected: boolean}>}
 */
export function formatSpecsForUI(specs) {
  return specs.map(s => ({
    id: s.id,
    name: s.name,
    type: s.type,
    selected: false,
  }));
}

/**
 * Format all resources for UI
 * @param {Object} resources - Object with collections, environments, mocks, specs arrays
 * @returns {Object}
 */
export function formatResourcesForUI(resources) {
  return {
    collections: formatCollectionsForUI(resources.collections || []),
    environments: formatEnvironmentsForUI(resources.environments || []),
    mocks: formatMocksForUI(resources.mocks || []),
    specs: formatSpecsForUI(resources.specs || []),
  };
}

/**
 * Delay helper
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
