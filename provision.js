#!/usr/bin/env node
/**
 * Partner Workspace Provisioning Script
 * 
 * Modular system for creating and provisioning Postman partner workspaces.
 * Copies collections, creates mock servers, copies environments, updates mock URLs,
 * and copies spec files from a source workspace.
 * 
 * WORKFLOW ORDER:
 *   1. Copy collections from source to target workspace
 *   2. Create mock servers for each copied collection
 *   3. Copy placeholder environments from source workspace
 *   4. Update Mock Env / Test Env with new mock URLs (or create new Mock Env)
 *   5. Copy spec files from source to target workspace
 * 
 * Required Environment Variables:
 *   - POSTMAN_API_KEY: Your Postman API key
 *   - POSTMAN_SOURCE_WORKSPACE_ID: Source workspace to copy from
 *   - POSTMAN_TARGET_WORKSPACE_ID: (Optional) Existing target workspace
 *   - POSTMAN_WORKSPACE_NAME: (Optional) Name for new workspace
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
const POSTMAN_WORKSPACE_NAME = process.env.POSTMAN_WORKSPACE_NAME;
const POSTMAN_API_BASE = "https://api.getpostman.com";

// Partner workspace type
const WORKSPACE_TYPE = "partner";

// Environment names to update with mock URLs
const MOCK_ENV_NAMES = ["Mock Env", "Mock Environment", "Test Env", "Test Environment"];

// Axios instance with default configuration
const api = axios.create({
  baseURL: POSTMAN_API_BASE,
  headers: {
    "Content-Type": "application/json",
    "X-Api-Key": POSTMAN_API_KEY || "",
  },
});

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
};
const hasFlag = (flag) => args.includes(flag);

// CLI arguments
const CLI_WORKSPACE_NAME = getArg('--name');
const CLI_TARGET_WORKSPACE_ID = getArg('--target-workspace-id');
const SKIP_INTERACTIVE = hasFlag('--yes') || hasFlag('-y');

// Runtime configuration
let runtimeConfig = {
  workspaceName: CLI_WORKSPACE_NAME || POSTMAN_WORKSPACE_NAME || "Partner Workspace",
  targetWorkspaceId: CLI_TARGET_WORKSPACE_ID || POSTMAN_TARGET_WORKSPACE_ID || null,
};

// ============================================================================
// IN-MEMORY STORE
// Tracks mappings between source and target resources during provisioning
// ============================================================================

const Store = {
  // Collection mappings: sourceUid -> { targetUid, name, mockUrl }
  collections: new Map(),
  
  // Environment mappings: sourceUid -> { targetUid, name }
  environments: new Map(),
  
  // Mock servers created: collectionUid -> { mockId, mockUrl, name }
  mocks: new Map(),
  
  // Spec mappings: sourceId -> { targetId, name, filesCopied }
  specs: new Map(),
  
  // Target workspace info
  targetWorkspace: null,
  
  // Clear all stores
  clear() {
    this.collections.clear();
    this.environments.clear();
    this.mocks.clear();
    this.specs.clear();
    this.targetWorkspace = null;
  },
  
  // Get all mock URLs as an array of { collectionName, mockUrl }
  getAllMockUrls() {
    const mockUrls = [];
    for (const [collectionUid, mockData] of this.mocks) {
      const collectionData = Array.from(this.collections.values())
        .find(c => c.targetUid === collectionUid);
      mockUrls.push({
        collectionName: collectionData?.name || mockData.name,
        collectionUid,
        mockId: mockData.mockId,
        mockUrl: mockData.mockUrl,
      });
    }
    return mockUrls;
  },
  
  // Get summary of all stored data
  getSummary() {
    return {
      collections: this.collections.size,
      environments: this.environments.size,
      mocks: this.mocks.size,
      specs: this.specs.size,
    };
  }
};

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

const log = {
  step: (msg) => console.log(`\n\x1b[36m▶ ${msg}\x1b[0m`),
  success: (msg) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`),
  error: (msg) => console.log(`  \x1b[31m✗\x1b[0m ${msg}`),
  warn: (msg) => console.log(`  \x1b[33m⚠\x1b[0m ${msg}`),
  info: (msg) => console.log(`  \x1b[34mℹ\x1b[0m ${msg}`),
  detail: (msg) => console.log(`    \x1b[90m${msg}\x1b[0m`),
};

function printBanner() {
  console.log('\x1b[36m');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║           POSTMAN PARTNER WORKSPACE PROVISIONER               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('\x1b[0m');
}

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

/**
 * Extracts error message from Axios errors or general errors
 */
const getErrorMessage = (error, defaultMessage = "An unknown error occurred") => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    return data?.error?.message || data?.message || error.message;
  }
  return error instanceof Error ? error.message : defaultMessage;
};

/**
 * Logs API error with context and returns the error message
 */
const logApiError = (operation, error, context = {}) => {
  const errorMessage = getErrorMessage(error);
  const contextStr = Object.keys(context).length > 0 
    ? ` [${Object.entries(context).map(([k, v]) => `${k}: ${v}`).join(', ')}]` 
    : '';
  log.error(`${operation}${contextStr}: ${errorMessage}`);
  return errorMessage;
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================================================
// MODULE: WORKSPACE
// API functions for workspace management
// ============================================================================

const WorkspaceAPI = {
  /**
   * Validate API key by getting current user info
   * GET /me
   */
  async validateApiKey() {
    try {
      const response = await api.get('/me');
      return { valid: true, user: response.data.user };
    } catch (error) {
      return {
        valid: false,
        error: logApiError('Validate API key', error)
      };
    }
  },

  /**
   * Get workspace details
   * GET /workspaces/{workspaceId}
   */
  async getWorkspace(workspaceId) {
    try {
      const response = await api.get(`/workspaces/${workspaceId}`);
      return response.data.workspace;
    } catch (error) {
      logApiError('Get workspace', error, { workspaceId });
      return null;
    }
  },

  /**
   * Create a new workspace
   * POST /workspaces
   */
  async createWorkspace(name, type = WORKSPACE_TYPE) {
    try {
      const response = await api.post('/workspaces', {
        workspace: {
          name,
          type,
          description: `Partner workspace created via automation script on ${new Date().toISOString().split('T')[0]}`,
        },
      });
      return { success: true, workspace: response.data.workspace };
    } catch (error) {
      return {
        success: false,
        error: logApiError('Create workspace', error, { name })
      };
    }
  },
};

// ============================================================================
// MODULE: COLLECTIONS
// API functions and helpers for collection management
// ============================================================================

const CollectionsAPI = {
  /**
   * Get all collections in a workspace
   * GET /collections?workspace={workspaceId}
   */
  async getAll(workspaceId) {
    try {
      const response = await api.get(`/collections?workspace=${workspaceId}`);
      return response.data.collections || [];
    } catch (error) {
      logApiError('Get all collections', error, { workspaceId });
      return [];
    }
  },

  /**
   * Get a single collection's full details
   * GET /collections/{collectionId}
   */
  async getDetails(collectionUid) {
    try {
      const response = await api.get(`/collections/${collectionUid}`);
      return response.data.collection;
    } catch (error) {
      logApiError('Get collection details', error, { collectionUid });
      return null;
    }
  },

  /**
   * Fork a collection to a target workspace
   * POST /collections/fork/{collectionId}?workspace={workspaceId}
   */
  async fork(collectionUid, label, targetWorkspaceId) {
    try {
      const response = await api.post(
        `/collections/fork/${collectionUid}?workspace=${targetWorkspaceId}`,
        { label }
      );
      return { success: true, collection: response.data.collection };
    } catch (error) {
      return {
        success: false,
        error: logApiError('Fork collection', error, { collectionUid })
      };
    }
  },
};

/**
 * Collection Helper Functions
 * Manage collections in memory and provide utility operations
 */
const CollectionsHelper = {
  /**
   * Copy all collections from source to target workspace
   * Stores mapping in Store.collections
   */
  async copyAll(sourceWorkspaceId, targetWorkspaceId) {
    const results = { success: [], failed: [] };
    
    const sourceCollections = await CollectionsAPI.getAll(sourceWorkspaceId);
    
    if (sourceCollections.length === 0) {
      log.warn('No collections found in source workspace');
      return results;
    }
    
    log.info(`Found ${sourceCollections.length} collection(s) to copy`);
    
    for (const collection of sourceCollections) {
      const forkResult = await CollectionsAPI.fork(
        collection.uid,
        collection.name,
        targetWorkspaceId
      );
      
      if (forkResult.success) {
        // Store mapping
        Store.collections.set(collection.uid, {
          sourceUid: collection.uid,
          targetUid: forkResult.collection.uid,
          name: collection.name,
        });
        
        results.success.push({
          name: collection.name,
          sourceUid: collection.uid,
          targetUid: forkResult.collection.uid,
        });
        log.success(`Forked: ${collection.name}`);
      } else {
        results.failed.push({ name: collection.name, error: forkResult.error });
        log.error(`Failed to fork "${collection.name}": ${forkResult.error}`);
      }
      
      await delay(500);
    }
    
    return results;
  },

  /**
   * Get collection UID by name from store
   */
  getTargetUidByName(name) {
    for (const [, data] of Store.collections) {
      if (data.name === name) {
        return data.targetUid;
      }
    }
    return null;
  },
};

// ============================================================================
// MODULE: MOCKS
// API functions and helpers for mock server management
// ============================================================================

const MocksAPI = {
  /**
   * Get all mock servers in a workspace
   * GET /mocks?workspace={workspaceId}
   * 
   * Response contains: id, uid, name, collection, mockUrl, etc.
   * - id: The mock server's ID (use this for DELETE/UPDATE operations)
   * - uid: The mock server's unique ID (includes owner prefix)
   */
  async getAll(workspaceId) {
    try {
      const response = await api.get(`/mocks?workspace=${workspaceId}`);
      return response.data.mocks || [];
    } catch (error) {
      logApiError('Get all mocks', error, { workspaceId });
      return [];
    }
  },

  /**
   * Create a mock server for a collection
   * POST /mocks?workspace={workspaceId}
   * 
   * @param {string} name - Mock server name
   * @param {string} collectionUid - Collection UID to mock
   * @param {string} workspaceId - Target workspace ID
   * @param {string|null} environmentUid - Optional environment UID
   * @param {boolean} isPrivate - Whether mock should be private (default: false)
   */
  async create(name, collectionUid, workspaceId, environmentUid = null, isPrivate = false) {
    try {
      const mockConfig = {
        mock: {
          name,
          collection: collectionUid,
          private: isPrivate,
        },
      };
      
      if (environmentUid) {
        mockConfig.mock.environment = environmentUid;
      }
      
      const response = await api.post(`/mocks?workspace=${workspaceId}`, mockConfig);
      return { success: true, mock: response.data.mock };
    } catch (error) {
      return {
        success: false,
        error: logApiError('Create mock', error, { name, collectionUid })
      };
    }
  },

  /**
   * Get a mock server's details
   * GET /mocks/{mockId}
   */
  async getDetails(mockId) {
    try {
      const response = await api.get(`/mocks/${mockId}`);
      return response.data.mock;
    } catch (error) {
      logApiError('Get mock details', error, { mockId });
      return null;
    }
  },
};

/**
 * Mock Server Helper Functions
 */
const MocksHelper = {
  /**
   * Create mock servers for all copied collections
   * Stores mock data in Store.mocks
   */
  async createForAllCollections(targetWorkspaceId) {
    const results = { success: [], failed: [] };
    
    if (Store.collections.size === 0) {
      log.warn('No collections in store to create mocks for');
      return results;
    }
    
    log.info(`Creating mock servers for ${Store.collections.size} collection(s)`);
    
    for (const [sourceUid, collectionData] of Store.collections) {
      const mockName = `${collectionData.name} Mock`;
      
      const createResult = await MocksAPI.create(
        mockName,
        collectionData.targetUid,
        targetWorkspaceId
      );
      
      if (createResult.success) {
        // Store mock data
        Store.mocks.set(collectionData.targetUid, {
          mockId: createResult.mock.id,
          mockUrl: createResult.mock.mockUrl,
          name: mockName,
          collectionName: collectionData.name,
        });
        
        results.success.push({
          name: mockName,
          mockId: createResult.mock.id,
          mockUrl: createResult.mock.mockUrl,
          collectionName: collectionData.name,
        });
        log.success(`Created: ${mockName} (URL: ${createResult.mock.mockUrl})`);
      } else {
        results.failed.push({ name: mockName, error: createResult.error });
        log.error(`Failed to create mock for "${collectionData.name}": ${createResult.error}`);
      }
      
      await delay(500);
    }
    
    return results;
  },

  /**
   * Generate environment variables from mock URLs
   * Creates variable entries for each mock URL
   */
  generateMockUrlVariables() {
    const variables = [];
    
    for (const [collectionUid, mockData] of Store.mocks) {
      // Create a variable name from the collection name
      // e.g., "Payment Services" -> "paymentServices_mockUrl"
      const varName = mockData.collectionName
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .split(/\s+/)
        .map((word, index) => 
          index === 0 
            ? word.toLowerCase() 
            : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join('') + '_mockUrl';
      
      variables.push({
        key: varName,
        value: mockData.mockUrl,
        enabled: true,
        type: 'default',
      });
    }
    
    // Also add a general baseUrl variable with the first mock URL
    if (variables.length > 0) {
      variables.unshift({
        key: 'baseUrl',
        value: variables[0].value,
        enabled: true,
        type: 'default',
      });
    }
    
    return variables;
  },
};

// ============================================================================
// MODULE: ENVIRONMENTS
// API functions and helpers for environment management
// ============================================================================

const EnvironmentsAPI = {
  /**
   * Get all environments in a workspace
   * GET /environments?workspace={workspaceId}
   */
  async getAll(workspaceId) {
    try {
      const response = await api.get(`/environments?workspace=${workspaceId}`);
      return response.data.environments || [];
    } catch (error) {
      logApiError('Get all environments', error, { workspaceId });
      return [];
    }
  },

  /**
   * Get environment details (includes variables)
   * GET /environments/{environmentId}
   */
  async getDetails(environmentUid) {
    try {
      const response = await api.get(`/environments/${environmentUid}`);
      return response.data.environment;
    } catch (error) {
      logApiError('Get environment details', error, { environmentUid });
      return null;
    }
  },

  /**
   * Create a new environment
   * POST /environments?workspace={workspaceId}
   */
  async create(name, values, workspaceId) {
    try {
      const response = await api.post(`/environments?workspace=${workspaceId}`, {
        environment: {
          name,
          values: values || [],
        },
      });
      return { success: true, environment: response.data.environment };
    } catch (error) {
      return {
        success: false,
        error: logApiError('Create environment', error, { name })
      };
    }
  },

  /**
   * Update an environment (replace all data)
   * PUT /environments/{environmentId}
   */
  async update(environmentUid, name, values) {
    try {
      const response = await api.put(`/environments/${environmentUid}`, {
        environment: {
          name,
          values: values || [],
        },
      });
      return { success: true, environment: response.data.environment };
    } catch (error) {
      return {
        success: false,
        error: logApiError('Update environment', error, { environmentUid })
      };
    }
  },

  /**
   * Patch an environment (partial update)
   * PATCH /environments/{environmentId}
   * 
   * Operations: add, replace, remove
   */
  async patch(environmentUid, operations) {
    try {
      const response = await api.patch(`/environments/${environmentUid}`, operations);
      return { success: true, environment: response.data.environment };
    } catch (error) {
      return {
        success: false,
        error: logApiError('Patch environment', error, { environmentUid })
      };
    }
  },
};

/**
 * Environment Helper Functions
 */
const EnvironmentsHelper = {
  /**
   * Copy all environments from source to target workspace
   * Stores mapping in Store.environments
   */
  async copyAll(sourceWorkspaceId, targetWorkspaceId) {
    const results = { success: [], failed: [] };
    
    const sourceEnvironments = await EnvironmentsAPI.getAll(sourceWorkspaceId);
    
    if (sourceEnvironments.length === 0) {
      log.warn('No environments found in source workspace');
      return results;
    }
    
    log.info(`Found ${sourceEnvironments.length} environment(s) to copy`);
    
    for (const env of sourceEnvironments) {
      // Get full environment details (includes variables)
      const envDetails = await EnvironmentsAPI.getDetails(env.uid);
      
      if (!envDetails) {
        results.failed.push({ name: env.name, error: 'Could not get environment details' });
        log.error(`Failed to get details for "${env.name}"`);
        continue;
      }
      
      // Create environment in target workspace
      const createResult = await EnvironmentsAPI.create(
        envDetails.name,
        envDetails.values || [],
        targetWorkspaceId
      );
      
      if (createResult.success) {
        // Store mapping
        Store.environments.set(env.uid, {
          sourceUid: env.uid,
          targetUid: createResult.environment.uid,
          name: envDetails.name,
        });
        
        results.success.push({
          name: envDetails.name,
          sourceUid: env.uid,
          targetUid: createResult.environment.uid,
        });
        log.success(`Copied: ${envDetails.name}`);
      } else {
        results.failed.push({ name: envDetails.name, error: createResult.error });
        log.error(`Failed to copy "${envDetails.name}": ${createResult.error}`);
      }
      
      await delay(300);
    }
    
    return results;
  },

  /**
   * Find Mock Env or Test Env in target workspace
   * Returns the environment UID if found, null otherwise
   */
  findMockEnv() {
    for (const [, envData] of Store.environments) {
      const normalizedName = envData.name.toLowerCase();
      for (const mockEnvName of MOCK_ENV_NAMES) {
        if (normalizedName === mockEnvName.toLowerCase()) {
          return envData;
        }
      }
    }
    return null;
  },

  /**
   * Update Mock Env with new mock URLs, or create new Mock Env if not found
   */
  async updateOrCreateMockEnv(targetWorkspaceId) {
    const mockUrlVariables = MocksHelper.generateMockUrlVariables();
    
    if (mockUrlVariables.length === 0) {
      log.warn('No mock URLs to add to environment');
      return { success: false, error: 'No mock URLs available' };
    }
    
    // Try to find existing Mock Env
    const existingMockEnv = this.findMockEnv();
    
    if (existingMockEnv) {
      // Update existing Mock Env
      log.info(`Updating existing environment: ${existingMockEnv.name}`);
      
      // Get current environment details
      const envDetails = await EnvironmentsAPI.getDetails(existingMockEnv.targetUid);
      
      if (!envDetails) {
        return { success: false, error: 'Could not get environment details' };
      }
      
      // Merge existing variables with new mock URL variables
      const existingValues = envDetails.values || [];
      const existingKeys = new Set(existingValues.map(v => v.key));
      
      // Add new variables, update existing ones
      const mergedValues = [...existingValues];
      for (const newVar of mockUrlVariables) {
        const existingIndex = mergedValues.findIndex(v => v.key === newVar.key);
        if (existingIndex >= 0) {
          mergedValues[existingIndex] = newVar;
        } else {
          mergedValues.push(newVar);
        }
      }
      
      const updateResult = await EnvironmentsAPI.update(
        existingMockEnv.targetUid,
        existingMockEnv.name,
        mergedValues
      );
      
      if (updateResult.success) {
        log.success(`Updated "${existingMockEnv.name}" with ${mockUrlVariables.length} mock URL variable(s)`);
        return { success: true, environment: updateResult.environment, action: 'updated' };
      } else {
        return { success: false, error: updateResult.error };
      }
    } else {
      // Create new Mock Env
      log.info('Creating new "Mock Env" environment');
      
      const createResult = await EnvironmentsAPI.create(
        'Mock Env',
        mockUrlVariables,
        targetWorkspaceId
      );
      
      if (createResult.success) {
        // Add to store
        Store.environments.set('mock-env-created', {
          sourceUid: null,
          targetUid: createResult.environment.uid,
          name: 'Mock Env',
        });
        
        log.success(`Created "Mock Env" with ${mockUrlVariables.length} mock URL variable(s)`);
        return { success: true, environment: createResult.environment, action: 'created' };
      } else {
        return { success: false, error: createResult.error };
      }
    }
  },
};

// ============================================================================
// MODULE: SPECS
// API functions and helpers for spec file management
// ============================================================================

const SpecsAPI = {
  /**
   * Get all specs in a workspace
   * GET /specs?workspaceId={workspaceId}
   */
  async getAll(workspaceId) {
    try {
      const response = await api.get(`/specs?workspaceId=${workspaceId}`);
      return response.data.specs || [];
    } catch (error) {
      logApiError('Get all specs', error, { workspaceId });
      return [];
    }
  },

  /**
   * Get spec details
   * GET /specs/{specId}
   */
  async getDetails(specId) {
    try {
      const response = await api.get(`/specs/${specId}`);
      return response.data;
    } catch (error) {
      logApiError('Get spec details', error, { specId });
      return null;
    }
  },

  /**
   * Get all files in a spec
   * GET /specs/{specId}/files
   * 
   * Returns array of file metadata: { id, name, path, type, createdAt, updatedAt }
   */
  async getFiles(specId) {
    try {
      const response = await api.get(`/specs/${specId}/files`);
      return response.data.files || [];
    } catch (error) {
      logApiError('Get spec files', error, { specId });
      return [];
    }
  },

  /**
   * Get a specific spec file's content
   * GET /specs/{specId}/files/{filePath}
   * 
   * Returns: { id, name, path, type, content, createdAt, updatedAt }
   */
  async getFile(specId, filePath) {
    try {
      const encodedPath = encodeURIComponent(filePath);
      const response = await api.get(`/specs/${specId}/files/${encodedPath}`);
      return response.data;
    } catch (error) {
      logApiError('Get spec file', error, { specId, filePath });
      return null;
    }
  },

  /**
   * Create a new spec in a workspace
   * POST /specs?workspaceId={workspaceId}
   */
  async create(workspaceId, name, description = '') {
    try {
      const response = await api.post(`/specs?workspaceId=${workspaceId}`, {
        name,
        description,
      });
      return { success: true, spec: response.data };
    } catch (error) {
      return {
        success: false,
        error: logApiError('Create spec', error, { name })
      };
    }
  },

  /**
   * Create a file in a spec
   * POST /specs/{specId}/files
   * 
   * @param {string} specId - The spec ID
   * @param {string} path - File path (e.g., "index.json" or "components/schemas.json")
   * @param {string} content - File content as string
   */
  async createFile(specId, path, content) {
    try {
      const response = await api.post(`/specs/${specId}/files`, {
        path,
        content,
      });
      return { success: true, file: response.data };
    } catch (error) {
      return {
        success: false,
        error: logApiError('Create spec file', error, { specId, path })
      };
    }
  },

  /**
   * Update a spec file's type (ROOT or DEFAULT)
   * PATCH /specs/{specId}/files/{filePath}
   */
  async updateFileType(specId, filePath, type) {
    try {
      const encodedPath = encodeURIComponent(filePath);
      const response = await api.patch(`/specs/${specId}/files/${encodedPath}`, {
        type,
      });
      return { success: true, file: response.data };
    } catch (error) {
      return {
        success: false,
        error: logApiError('Update spec file type', error, { specId, filePath })
      };
    }
  },
};

/**
 * Spec Helper Functions
 */
const SpecsHelper = {
  /**
   * Copy a single spec with all its files
   * 
   * Workflow:
   * 1. Get spec details
   * 2. Get all files in the spec
   * 3. Get content for each file
   * 4. Create new spec in target workspace
   * 5. Create all files in the new spec (ROOT file first)
   */
  async copySpec(sourceSpecId, sourceSpecName, targetWorkspaceId, onProgress) {
    const result = {
      success: false,
      specName: sourceSpecName,
      newSpecId: null,
      filesCopied: 0,
      totalFiles: 0,
      errors: [],
    };

    try {
      // Step 1: Get spec details
      onProgress?.({ step: 'details', message: `Getting spec details for: ${sourceSpecName}` });
      const specDetails = await SpecsAPI.getDetails(sourceSpecId);
      const description = specDetails?.description || '';

      // Step 2: Get all files in the source spec
      onProgress?.({ step: 'files', message: `Getting files for: ${sourceSpecName}` });
      const sourceFiles = await SpecsAPI.getFiles(sourceSpecId);
      result.totalFiles = sourceFiles.length;

      if (sourceFiles.length === 0) {
        result.errors.push('No files found in source spec');
        log.warn(`Spec "${sourceSpecName}" has no files to copy`);
        return result;
      }

      // Step 3: Get content for each file
      onProgress?.({ step: 'content', message: `Fetching ${sourceFiles.length} file(s) content...` });
      const filesWithContent = [];
      
      for (const file of sourceFiles) {
        const fileContent = await SpecsAPI.getFile(sourceSpecId, file.path);
        if (fileContent && fileContent.content) {
          filesWithContent.push({
            path: file.path,
            content: fileContent.content,
            type: file.type,
            name: file.name,
          });
        } else {
          result.errors.push(`Failed to get content for file: ${file.path}`);
        }
        await delay(200);
      }

      if (filesWithContent.length === 0) {
        result.errors.push('Could not retrieve any file contents');
        return result;
      }

      // Step 4: Create new spec in target workspace
      onProgress?.({ step: 'create', message: `Creating spec in target workspace...` });
      const createResult = await SpecsAPI.create(targetWorkspaceId, sourceSpecName, description);
      
      if (!createResult.success) {
        result.errors.push(`Failed to create spec: ${createResult.error}`);
        return result;
      }

      result.newSpecId = createResult.spec.id;

      // Step 5: Create files in the new spec (ROOT file first)
      const rootFile = filesWithContent.find(f => f.type === 'ROOT');
      const otherFiles = filesWithContent.filter(f => f.type !== 'ROOT');
      const orderedFiles = rootFile ? [rootFile, ...otherFiles] : filesWithContent;

      onProgress?.({ step: 'copyFiles', message: `Copying ${orderedFiles.length} file(s)...` });

      for (let i = 0; i < orderedFiles.length; i++) {
        const file = orderedFiles[i];
        onProgress?.({ 
          step: 'copyFile', 
          message: `Copying file: ${file.path}`,
          current: i + 1,
          total: orderedFiles.length,
        });

        const fileResult = await SpecsAPI.createFile(result.newSpecId, file.path, file.content);
        
        if (fileResult.success) {
          result.filesCopied++;
          
          // If ROOT file is not first, update its type
          if (file.type === 'ROOT' && i > 0) {
            await SpecsAPI.updateFileType(result.newSpecId, file.path, 'ROOT');
          }
        } else {
          result.errors.push(`Failed to create file ${file.path}: ${fileResult.error}`);
        }

        await delay(300);
      }

      result.success = result.filesCopied > 0;
      return result;

    } catch (error) {
      result.errors.push(`Unexpected error: ${error.message}`);
      return result;
    }
  },

  /**
   * Copy all specs from source to target workspace
   * Stores mapping in Store.specs
   */
  async copyAll(sourceWorkspaceId, targetWorkspaceId) {
    const results = { success: [], failed: [] };
    
    const sourceSpecs = await SpecsAPI.getAll(sourceWorkspaceId);
    
    if (sourceSpecs.length === 0) {
      log.warn('No specs found in source workspace');
      return results;
    }
    
    log.info(`Found ${sourceSpecs.length} spec(s) to copy`);
    
    for (let i = 0; i < sourceSpecs.length; i++) {
      const spec = sourceSpecs[i];
      log.info(`\n  [${i + 1}/${sourceSpecs.length}] Processing spec: ${spec.name}`);
      
      const copyResult = await this.copySpec(
        spec.id,
        spec.name,
        targetWorkspaceId,
        (progress) => {
          if (progress.step === 'copyFile') {
            log.detail(`  Copying file (${progress.current}/${progress.total}): ${progress.message.replace('Copying file: ', '')}`);
          }
        }
      );
      
      if (copyResult.success) {
        // Store mapping
        Store.specs.set(spec.id, {
          sourceId: spec.id,
          targetId: copyResult.newSpecId,
          name: spec.name,
          filesCopied: copyResult.filesCopied,
        });
        
        results.success.push({
          name: spec.name,
          sourceId: spec.id,
          targetId: copyResult.newSpecId,
          filesCopied: copyResult.filesCopied,
          totalFiles: copyResult.totalFiles,
        });
        log.success(`Copied: ${spec.name} (${copyResult.filesCopied}/${copyResult.totalFiles} files)`);
        
        if (copyResult.errors.length > 0) {
          copyResult.errors.forEach(err => log.warn(`  Warning: ${err}`));
        }
      } else {
        results.failed.push({ 
          name: spec.name, 
          error: copyResult.errors.join('; ') || 'Unknown error',
        });
        log.error(`Failed to copy "${spec.name}"`);
        copyResult.errors.forEach(err => log.detail(`  ${err}`));
      }
      
      await delay(500);
    }
    
    return results;
  },
};

// ============================================================================
// INTERACTIVE PROMPTS
// ============================================================================

function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function prompt(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function showInteractiveMenu() {
  const rl = createReadline();
  
  console.log('\x1b[36m─────────────────────────────────────────────────────────────\x1b[0m');
  console.log('\x1b[1mConfiguration Options\x1b[0m\n');
  
  // Show current config
  console.log(`Current settings:`);
  console.log(`  Source Workspace ID: ${POSTMAN_SOURCE_WORKSPACE_ID || '\x1b[31m(not set)\x1b[0m'}`);
  console.log(`  Target Workspace ID: ${runtimeConfig.targetWorkspaceId || '\x1b[33m(will create new)\x1b[0m'}`);
  console.log(`  New Workspace Name:  ${runtimeConfig.workspaceName}`);
  console.log('');
  
  // Ask about target workspace
  const useExisting = await prompt(rl, 'Use an existing target workspace? (y/N): ');
  
  if (useExisting.toLowerCase() === 'y' || useExisting.toLowerCase() === 'yes') {
    const targetId = await prompt(rl, `Enter target workspace ID [${runtimeConfig.targetWorkspaceId || 'none'}]: `);
    if (targetId) {
      runtimeConfig.targetWorkspaceId = targetId;
    }
  } else {
    runtimeConfig.targetWorkspaceId = null;
    const newName = await prompt(rl, `Enter name for new workspace [${runtimeConfig.workspaceName}]: `);
    if (newName) {
      runtimeConfig.workspaceName = newName;
    }
  }
  
  rl.close();
  return true;
}

async function confirmAndRun() {
  const rl = createReadline();
  
  console.log('\n\x1b[36m─────────────────────────────────────────────────────────────\x1b[0m');
  console.log('\x1b[1mProvisioning Summary\x1b[0m\n');
  
  console.log(`  Source Workspace:     ${POSTMAN_SOURCE_WORKSPACE_ID}`);
  if (runtimeConfig.targetWorkspaceId) {
    console.log(`  Target Workspace:     ${runtimeConfig.targetWorkspaceId} (existing)`);
  } else {
    console.log(`  Target Workspace:     NEW "${runtimeConfig.workspaceName}" (${WORKSPACE_TYPE})`);
  }
  
  console.log('\n  \x1b[1mWorkflow:\x1b[0m');
  console.log('    1. Copy collections from source workspace');
  console.log('    2. Create mock servers for each collection');
  console.log('    3. Copy environments from source workspace');
  console.log('    4. Update/Create Mock Env with mock URLs');
  console.log('    5. Copy spec files from source workspace');
  
  console.log('\n\x1b[36m─────────────────────────────────────────────────────────────\x1b[0m');
  
  const confirm = await prompt(rl, '\nProceed with provisioning? (Y/n): ');
  rl.close();
  
  return confirm.toLowerCase() !== 'n' && confirm.toLowerCase() !== 'no';
}

// ============================================================================
// MAIN PROVISIONING WORKFLOW
// ============================================================================

async function runProvisioningWorkflow() {
  const results = {
    workspace: null,
    workspaceCreated: false,
    collections: { total: 0, success: 0, failed: [] },
    mocks: { total: 0, success: 0, failed: [] },
    environments: { total: 0, success: 0, failed: [] },
    mockEnvUpdate: { success: false, action: null },
    specs: { total: 0, success: 0, failed: [] },
  };

  // Clear the store
  Store.clear();

  // =========================================================================
  // VALIDATION
  // =========================================================================
  log.step('Validating configuration...');
  
  if (!POSTMAN_API_KEY) {
    log.error('POSTMAN_API_KEY is required. Set it in your .env file.');
    process.exit(1);
  }
  
  if (!POSTMAN_SOURCE_WORKSPACE_ID) {
    log.error('POSTMAN_SOURCE_WORKSPACE_ID is required. Set it in your .env file.');
    process.exit(1);
  }

  // Validate API key
  const validation = await WorkspaceAPI.validateApiKey();
  if (!validation.valid) {
    log.error(`Invalid API key: ${validation.error}`);
    process.exit(1);
  }
  log.success(`API key valid. Authenticated as: ${validation.user.username}`);

  // Verify source workspace
  const sourceWorkspace = await WorkspaceAPI.getWorkspace(POSTMAN_SOURCE_WORKSPACE_ID);
  if (!sourceWorkspace) {
    log.error(`Source workspace not found: ${POSTMAN_SOURCE_WORKSPACE_ID}`);
    process.exit(1);
  }
  log.success(`Source workspace: ${sourceWorkspace.name}`);

  // =========================================================================
  // INITIALIZE TARGET WORKSPACE
  // =========================================================================
  log.step('Initializing target workspace...');
  
  let targetWorkspaceId;
  
  if (runtimeConfig.targetWorkspaceId) {
    const existingWorkspace = await WorkspaceAPI.getWorkspace(runtimeConfig.targetWorkspaceId);
    if (!existingWorkspace) {
      log.error(`Target workspace not found: ${runtimeConfig.targetWorkspaceId}`);
      process.exit(1);
    }
    targetWorkspaceId = runtimeConfig.targetWorkspaceId;
    results.workspace = existingWorkspace;
    results.workspaceCreated = false;
    Store.targetWorkspace = existingWorkspace;
    log.success(`Using existing workspace: ${existingWorkspace.name}`);
  } else {
    log.info(`Creating new ${WORKSPACE_TYPE} workspace: "${runtimeConfig.workspaceName}"...`);
    const createResult = await WorkspaceAPI.createWorkspace(runtimeConfig.workspaceName, WORKSPACE_TYPE);
    
    if (!createResult.success) {
      log.error(`Failed to create workspace: ${createResult.error}`);
      process.exit(1);
    }
    
    targetWorkspaceId = createResult.workspace.id;
    results.workspace = createResult.workspace;
    results.workspaceCreated = true;
    Store.targetWorkspace = createResult.workspace;
    log.success(`Created new workspace: ${createResult.workspace.name} (ID: ${createResult.workspace.id})`);
  }

  // =========================================================================
  // STEP 1: COPY COLLECTIONS
  // =========================================================================
  log.step('Step 1: Copying collections...');
  
  const collectionResults = await CollectionsHelper.copyAll(POSTMAN_SOURCE_WORKSPACE_ID, targetWorkspaceId);
  results.collections.total = collectionResults.success.length + collectionResults.failed.length;
  results.collections.success = collectionResults.success.length;
  results.collections.failed = collectionResults.failed;

  // =========================================================================
  // STEP 2: CREATE MOCK SERVERS
  // =========================================================================
  log.step('Step 2: Creating mock servers for collections...');
  
  const mockResults = await MocksHelper.createForAllCollections(targetWorkspaceId);
  results.mocks.total = mockResults.success.length + mockResults.failed.length;
  results.mocks.success = mockResults.success.length;
  results.mocks.failed = mockResults.failed;

  // =========================================================================
  // STEP 3: COPY ENVIRONMENTS
  // =========================================================================
  log.step('Step 3: Copying environments...');
  
  const envResults = await EnvironmentsHelper.copyAll(POSTMAN_SOURCE_WORKSPACE_ID, targetWorkspaceId);
  results.environments.total = envResults.success.length + envResults.failed.length;
  results.environments.success = envResults.success.length;
  results.environments.failed = envResults.failed;

  // =========================================================================
  // STEP 4: UPDATE MOCK ENV WITH MOCK URLS
  // =========================================================================
  log.step('Step 4: Updating Mock Env with mock URLs...');
  
  const mockEnvResult = await EnvironmentsHelper.updateOrCreateMockEnv(targetWorkspaceId);
  results.mockEnvUpdate = mockEnvResult;

  // =========================================================================
  // STEP 5: COPY SPECS
  // =========================================================================
  log.step('Step 5: Copying spec files...');
  
  const specResults = await SpecsHelper.copyAll(POSTMAN_SOURCE_WORKSPACE_ID, targetWorkspaceId);
  results.specs.total = specResults.success.length + specResults.failed.length;
  results.specs.success = specResults.success.length;
  results.specs.failed = specResults.failed;

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n\x1b[36m════════════════════════════════════════════════════════════\x1b[0m');
  console.log('\x1b[1mProvisioning Complete!\x1b[0m');
  console.log('\x1b[36m════════════════════════════════════════════════════════════\x1b[0m\n');
  
  console.log(`\x1b[1mTarget Workspace:\x1b[0m ${results.workspace?.name || 'Unknown'}`);
  console.log(`  ID: ${targetWorkspaceId}`);
  console.log(`  Status: ${results.workspaceCreated ? 'Created new' : 'Used existing'}`);
  console.log('');
  
  console.log('\x1b[1mResults Summary:\x1b[0m');
  console.log(`  Collections:  ${results.collections.success}/${results.collections.total} copied`);
  console.log(`  Mock Servers: ${results.mocks.success}/${results.mocks.total} created`);
  console.log(`  Environments: ${results.environments.success}/${results.environments.total} copied`);
  console.log(`  Mock Env:     ${results.mockEnvUpdate.success ? results.mockEnvUpdate.action : 'failed'}`);
  console.log(`  Specs:        ${results.specs.success}/${results.specs.total} copied`);
  
  // Show mock URLs
  if (Store.mocks.size > 0) {
    console.log('\n\x1b[1mMock Server URLs:\x1b[0m');
    for (const [, mockData] of Store.mocks) {
      console.log(`  ${mockData.collectionName}: ${mockData.mockUrl}`);
    }
  }
  
  // Show failures if any
  const allFailures = [
    ...results.collections.failed.map(f => ({ type: 'Collection', ...f })),
    ...results.mocks.failed.map(f => ({ type: 'Mock', ...f })),
    ...results.environments.failed.map(f => ({ type: 'Environment', ...f })),
    ...results.specs.failed.map(f => ({ type: 'Spec', ...f })),
  ];
  
  if (allFailures.length > 0) {
    console.log('\n\x1b[33mFailures:\x1b[0m');
    for (const failure of allFailures) {
      console.log(`  \x1b[31m✗\x1b[0m ${failure.type}: ${failure.name} - ${failure.error}`);
    }
  }
  
  console.log('\n\x1b[36m════════════════════════════════════════════════════════════\x1b[0m\n');

  return results;
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

async function main() {
  printBanner();
  
  // Show interactive menu unless --yes flag is provided
  if (!SKIP_INTERACTIVE) {
    await showInteractiveMenu();
    const shouldProceed = await confirmAndRun();
    if (!shouldProceed) {
      log.info('Provisioning cancelled.');
      process.exit(0);
    }
  }
  
  try {
    await runProvisioningWorkflow();
  } catch (error) {
    log.error(`Provisioning failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Export modules for external use
export {
  WorkspaceAPI,
  CollectionsAPI,
  CollectionsHelper,
  MocksAPI,
  MocksHelper,
  EnvironmentsAPI,
  EnvironmentsHelper,
  SpecsAPI,
  SpecsHelper,
  Store,
  runProvisioningWorkflow,
};

// Run if executed directly
main();
