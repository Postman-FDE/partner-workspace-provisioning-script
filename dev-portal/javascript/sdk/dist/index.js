import axios from 'axios';

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Whether the request was successful
 * @property {*} [data] - Response data if successful
 * @property {string} [error] - Error message if failed
 */

/**
 * Generic HTTP client for Postman API
 */
class HttpClient {
  /**
   * @param {string} apiKey - Postman API key
   * @param {string} [baseUrl='https://api.getpostman.com'] - Base URL for API
   * @param {number} [timeout=30000] - Request timeout in milliseconds
   */
  constructor(apiKey, baseUrl = 'https://api.getpostman.com', timeout = 30000) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.apiKey,
      },
    });
  }

  /**
   * Handle API errors consistently
   * @private
   * @param {Error} error - Axios error
   * @returns {ApiResponse}
   */
  _handleError(error) {
    const errorMessage = error.response?.data?.error?.message 
      || error.response?.data?.message 
      || error.message;
    console.error(`API Error: ${errorMessage}`, error.response?.data);
    return { success: false, error: errorMessage };
  }

  /**
   * Make a GET request
   * @param {string} path - API path
   * @param {Object} [config] - Axios config
   * @returns {Promise<ApiResponse>}
   */
  async get(path, config) {
    try {
      const response = await this.client.get(path, config);
      return { success: true, data: response.data };
    } catch (error) {
      return this._handleError(error);
    }
  }

  /**
   * Make a POST request
   * @param {string} path - API path
   * @param {*} payload - Request body
   * @param {Object} [config] - Axios config
   * @returns {Promise<ApiResponse>}
   */
  async post(path, payload, config) {
    try {
      const response = await this.client.post(path, payload, config);
      return { success: true, data: response.data };
    } catch (error) {
      return this._handleError(error);
    }
  }

  /**
   * Make a PUT request
   * @param {string} path - API path
   * @param {*} payload - Request body
   * @param {Object} [config] - Axios config
   * @returns {Promise<ApiResponse>}
   */
  async put(path, payload, config) {
    try {
      const response = await this.client.put(path, payload, config);
      return { success: true, data: response.data };
    } catch (error) {
      return this._handleError(error);
    }
  }

  /**
   * Make a PATCH request
   * @param {string} path - API path
   * @param {*} payload - Request body
   * @param {Object} [config] - Axios config
   * @returns {Promise<ApiResponse>}
   */
  async patch(path, payload, config) {
    try {
      const response = await this.client.patch(path, payload, config);
      return { success: true, data: response.data };
    } catch (error) {
      return this._handleError(error);
    }
  }

  /**
   * Make a DELETE request
   * @param {string} path - API path
   * @param {Object} [config] - Axios config
   * @returns {Promise<ApiResponse>}
   */
  async delete(path, config) {
    try {
      const response = await this.client.delete(path, config);
      return { success: true, data: response.data };
    } catch (error) {
      return this._handleError(error);
    }
  }
}

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} username
 * @property {string} email
 */

/**
 * @typedef {Object} Workspace
 * @property {string} id
 * @property {string} name
 * @property {string} type
 * @property {string} [description]
 * @property {string} [visibility]
 */

/**
 * @typedef {Object} Collection
 * @property {string} id
 * @property {string} uid
 * @property {string} name
 * @property {string} owner
 */

/**
 * @typedef {Object} Environment
 * @property {string} id
 * @property {string} uid
 * @property {string} name
 * @property {Array<{key: string, value: string, type?: string, enabled?: boolean}>} [values]
 */

/**
 * @typedef {Object} MockServer
 * @property {string} id
 * @property {string} uid
 * @property {string} name
 * @property {string} collection
 * @property {string} mockUrl
 */

/**
 * @typedef {Object} Spec
 * @property {string} id
 * @property {string} name
 * @property {string} type
 */

/**
 * @typedef {Object} SpecFile
 * @property {string} id
 * @property {string} name
 * @property {string} path
 * @property {string} type
 * @property {string} [content]
 */

/**
 * @typedef {Object} InvitationResult
 * @property {string} [email]
 * @property {string} status
 * @property {string} [invitationLink]
 * @property {string} [error]
 */

/**
 * Postman API Client
 */
class PostmanClient {
  /**
   * @param {Object} config
   * @param {string} config.apiKey - Postman API key
   * @param {string} [config.baseUrl] - Base URL for API
   * @param {number} [config.timeout] - Request timeout
   */
  constructor({ apiKey, baseUrl, timeout }) {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    this.httpClient = new HttpClient(apiKey, baseUrl, timeout);
  }

  // ==================== User ====================

  /**
   * Validate API key and get current user
   * @returns {Promise<{valid: boolean, user?: User, error?: string}>}
   */
  async validateApiKey() {
    const response = await this.httpClient.get('/me');
    if (response.success) {
      return { valid: true, user: response.data.user };
    }
    return { valid: false, error: response.error };
  }

  // ==================== Workspaces ====================

  /**
   * Get workspace details
   * @param {string} workspaceId
   * @returns {Promise<Workspace|null>}
   */
  async getWorkspace(workspaceId) {
    const response = await this.httpClient.get(`/workspaces/${workspaceId}`);
    return response.success ? response.data.workspace : null;
  }

  /**
   * Create a new workspace
   * @param {string} name - Workspace name
   * @param {string} [type='partner'] - Workspace type
   * @param {string} [description] - Workspace description
   * @returns {Promise<{success: boolean, workspace?: Workspace, error?: string}>}
   */
  async createWorkspace(name, type = 'partner', description = '') {
    const payload = {
      workspace: {
        name,
        type,
        description: description || `Workspace created via SDK on ${new Date().toISOString().split('T')[0]}`,
      },
    };
    const response = await this.httpClient.post('/workspaces', payload);
    if (response.success) {
      return { success: true, workspace: response.data.workspace };
    }
    return { success: false, error: response.error };
  }

  /**
   * Update a workspace
   * @param {string} workspaceId
   * @param {Object} updates - Fields to update (e.g. { description })
   * @returns {Promise<{success: boolean, workspace?: Object}>}
   */
  async updateWorkspace(workspaceId, updates) {
    const response = await this.httpClient.put(`/workspaces/${workspaceId}`, { workspace: updates });
    if (response.success) {
      return { success: true, workspace: response.data.workspace };
    }
    return { success: false, error: response.error };
  }

  /**
   * Delete a workspace
   * @param {string} workspaceId
   * @returns {Promise<boolean>}
   */
  async deleteWorkspace(workspaceId) {
    const response = await this.httpClient.delete(`/workspaces/${workspaceId}`);
    return response.success;
  }

  // ==================== Workspace Roles ====================

  /**
   * Get workspace roles
   * @param {string} workspaceId
   * @returns {Promise<Array>}
   */
  async getWorkspaceRoles(workspaceId) {
    const response = await this.httpClient.get(`/workspaces/${workspaceId}/roles`);
    return response.success ? response.data.roles : [];
  }

  /**
   * Add a user as workspace admin
   * @param {string} workspaceId
   * @param {string} userId
   * @param {string} [roleId='3'] - Admin role ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async addWorkspaceAdmin(workspaceId, userId, roleId = '3') {
    const payload = {
      roles: [{
        op: 'add',
        path: '/user',
        value: [{ id: userId, role: roleId }],
      }],
    };
    const response = await this.httpClient.patch(`/workspaces/${workspaceId}/roles`, payload);
    return { success: response.success, error: response.error };
  }

  /**
   * Remove a user from workspace
   * @param {string} workspaceId
   * @param {string} userId
   * @param {string} roleId
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async removeWorkspaceUser(workspaceId, userId, roleId) {
    const payload = {
      roles: [{
        op: 'remove',
        path: '/user',
        value: [{ id: userId, role: roleId }],
      }],
    };
    const response = await this.httpClient.patch(`/workspaces/${workspaceId}/roles`, payload);
    return { success: response.success, error: response.error };
  }

  // ==================== Partner Invitations ====================

  /**
   * Invite a partner to workspace
   * @param {string} workspaceId
   * @param {string} email
   * @param {string} [roleId='7'] - Partner role ID
   * @returns {Promise<InvitationResult>}
   */
  async invitePartner(workspaceId, email, roleId = '7') {
    const payload = {
      action: 'invite_partner',
      targetEntity: 'workspace',
      targetEntityId: workspaceId,
      roleId,
      target: { emails: [email] },
    };
    const response = await this.httpClient.post('/invitations', payload);
    
    if (response.success && response.data.results?.[0]) {
      const result = response.data.results[0];
      return {
        success: true,
        email,
        status: result.status,
        invitationLink: result.invitationLink,
      };
    }
    return { success: false, email, error: response.error };
  }

  /**
   * Remove a partner from workspace
   * @param {string} workspaceId
   * @param {string} userId
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async removePartner(workspaceId, userId) {
    const payload = {
      action: 'remove_partner',
      targetEntity: 'workspace',
      targetEntityId: workspaceId,
      target: { userIds: [userId] },
    };
    const response = await this.httpClient.post('/invitations', payload);
    return { success: response.success, error: response.error };
  }

  // ==================== Collections ====================

  /**
   * Get all collections in a workspace
   * @param {string} workspaceId
   * @returns {Promise<Collection[]>}
   */
  async getCollections(workspaceId) {
    const response = await this.httpClient.get(`/collections?workspace=${workspaceId}`);
    return response.success ? response.data.collections || [] : [];
  }

  /**
   * Get collection details
   * @param {string} collectionUid
   * @returns {Promise<Collection|null>}
   */
  async getCollectionDetails(collectionUid) {
    const response = await this.httpClient.get(`/collections/${collectionUid}`);
    return response.success ? response.data.collection : null;
  }

  /**
   * Fork a collection
   * @param {string} collectionUid
   * @param {string} label - Fork label
   * @param {string} targetWorkspaceId
   * @returns {Promise<{success: boolean, collection?: Collection, error?: string}>}
   */
  async forkCollection(collectionUid, label, targetWorkspaceId) {
    const payload = { label };
    const response = await this.httpClient.post(
      `/collections/fork/${collectionUid}?workspace=${targetWorkspaceId}`,
      payload
    );
    if (response.success) {
      return { success: true, collection: response.data.collection };
    }
    return { success: false, error: response.error };
  }

  /**
   * Delete a collection
   * @param {string} collectionUid
   * @returns {Promise<boolean>}
   */
  async deleteCollection(collectionUid) {
    const response = await this.httpClient.delete(`/collections/${collectionUid}`);
    return response.success;
  }

  /**
   * Update a collection's variables via partial update
   * PATCH /collections/{collectionId}
   * @param {string} collectionUid
   * @param {Array} variables - Full variable array to set
   * @returns {Promise<{success: boolean, collection?: object, error?: string}>}
   */
  async patchCollectionVariables(collectionUid, variables) {
    const response = await this.httpClient.patch(`/collections/${collectionUid}`, {
      collection: { variable: variables },
    });
    if (response.success) {
      return { success: true, collection: response.data?.collection };
    }
    return { success: false, error: response.error || 'Failed to patch collection variables' };
  }

  // ==================== Environments ====================

  /**
   * Get all environments in a workspace
   * @param {string} workspaceId
   * @returns {Promise<Environment[]>}
   */
  async getEnvironments(workspaceId) {
    const response = await this.httpClient.get(`/environments?workspace=${workspaceId}`);
    return response.success ? response.data.environments || [] : [];
  }

  /**
   * Get environment details
   * @param {string} environmentUid
   * @returns {Promise<Environment|null>}
   */
  async getEnvironmentDetails(environmentUid) {
    const response = await this.httpClient.get(`/environments/${environmentUid}`);
    return response.success ? response.data.environment : null;
  }

  /**
   * Create an environment
   * @param {string} name
   * @param {Array<{key: string, value: string, type?: string, enabled?: boolean}>} values
   * @param {string} workspaceId
   * @returns {Promise<{success: boolean, environment?: Environment, error?: string}>}
   */
  async createEnvironment(name, values, workspaceId) {
    const payload = {
      environment: { name, values },
    };
    const response = await this.httpClient.post(`/environments?workspace=${workspaceId}`, payload);
    if (response.success) {
      return { success: true, environment: response.data.environment };
    }
    return { success: false, error: response.error };
  }

  /**
   * Update an environment
   * @param {string} environmentUid
   * @param {string} name
   * @param {Array<{key: string, value: string, type?: string, enabled?: boolean}>} values
   * @returns {Promise<{success: boolean, environment?: Environment, error?: string}>}
   */
  async updateEnvironment(environmentUid, name, values) {
    const payload = {
      environment: { name, values },
    };
    const response = await this.httpClient.put(`/environments/${environmentUid}`, payload);
    if (response.success) {
      return { success: true, environment: response.data.environment };
    }
    return { success: false, error: response.error };
  }

  /**
   * Delete an environment
   * @param {string} environmentUid
   * @returns {Promise<boolean>}
   */
  async deleteEnvironment(environmentUid) {
    const response = await this.httpClient.delete(`/environments/${environmentUid}`);
    return response.success;
  }

  // ==================== Mock Servers ====================

  /**
   * Get all mock servers in a workspace
   * @param {string} workspaceId
   * @returns {Promise<MockServer[]>}
   */
  async getMocks(workspaceId) {
    const response = await this.httpClient.get(`/mocks?workspace=${workspaceId}`);
    return response.success ? response.data.mocks || [] : [];
  }

  /**
   * Create a mock server
   * @param {string} name
   * @param {string} collectionUid
   * @param {string} workspaceId
   * @param {boolean} [isPrivate=false]
   * @returns {Promise<{success: boolean, mock?: MockServer, error?: string}>}
   */
  async createMock(name, collectionUid, workspaceId, isPrivate = false) {
    const payload = {
      mock: {
        name,
        collection: collectionUid,
        private: isPrivate,
      },
    };
    const response = await this.httpClient.post(`/mocks?workspace=${workspaceId}`, payload);
    if (response.success) {
      return { success: true, mock: response.data.mock };
    }
    return { success: false, error: response.error };
  }

  /**
   * Delete a mock server
   * @param {string} mockId
   * @returns {Promise<boolean>}
   */
  async deleteMock(mockId) {
    const response = await this.httpClient.delete(`/mocks/${mockId}`);
    return response.success;
  }

  // ==================== API Specs ====================

  /**
   * Get all specs in a workspace
   * @param {string} workspaceId
   * @returns {Promise<Spec[]>}
   */
  async getSpecs(workspaceId) {
    const response = await this.httpClient.get(`/specs?workspaceId=${workspaceId}`);
    return response.success ? response.data.specs || [] : [];
  }

  /**
   * Get spec details
   * @param {string} specId
   * @returns {Promise<Spec|null>}
   */
  async getSpecDetails(specId) {
    const response = await this.httpClient.get(`/specs/${specId}`);
    return response.success ? response.data : null;
  }

  /**
   * Get spec files
   * @param {string} specId
   * @returns {Promise<SpecFile[]>}
   */
  async getSpecFiles(specId) {
    const response = await this.httpClient.get(`/specs/${specId}/files`);
    return response.success ? response.data.files || [] : [];
  }

  /**
   * Get spec file content
   * @param {string} specId
   * @param {string} filePath
   * @returns {Promise<SpecFile|null>}
   */
  async getSpecFile(specId, filePath) {
    const encodedPath = encodeURIComponent(filePath);
    const response = await this.httpClient.get(`/specs/${specId}/files/${encodedPath}`);
    return response.success ? response.data : null;
  }

  /**
   * Create a spec
   * @param {string} workspaceId
   * @param {string} name
   * @param {string} type - e.g., 'OPENAPI:3.0', 'OPENAPI:3.1', 'ASYNCAPI:2.0'
   * @param {Array<{path: string, content: string, type: 'ROOT'|'DEFAULT'}>} files
   * @returns {Promise<{success: boolean, spec?: Spec, error?: string}>}
   */
  async createSpec(workspaceId, name, type, files) {
    const payload = { name, type, files };
    const response = await this.httpClient.post(`/specs?workspaceId=${workspaceId}`, payload);
    if (response.success) {
      return { success: true, spec: response.data.spec || response.data };
    }
    return { success: false, error: response.error };
  }

  /**
   * Delete a spec
   * @param {string} specId
   * @returns {Promise<boolean>}
   */
  async deleteSpec(specId) {
    const response = await this.httpClient.delete(`/specs/${specId}`);
    return response.success;
  }
}

/**
 * @typedef {import('../client/PostmanClient.js').PostmanClient} PostmanClient
 * @typedef {import('../client/PostmanClient.js').Workspace} Workspace
 * @typedef {import('../client/PostmanClient.js').User} User
 */

/**
 * High-level workspace management service
 */
class WorkspaceService {
  /**
   * @param {PostmanClient} client
   * @param {Object} [config]
   * @param {string} [config.adminRoleId='3'] - Default admin role ID
   */
  constructor(client, config = {}) {
    this.client = client;
    this.adminRoleId = config.adminRoleId || '3';
  }

  /**
   * Validate API key and get current user
   * @returns {Promise<{valid: boolean, user?: User, error?: string}>}
   */
  async validateApiKey() {
    return this.client.validateApiKey();
  }

  /**
   * Get workspace details
   * @param {string} workspaceId
   * @returns {Promise<Workspace|null>}
   */
  async getWorkspace(workspaceId) {
    return this.client.getWorkspace(workspaceId);
  }

  /**
   * Create a new workspace
   * @param {string} name
   * @param {string} [type='partner']
   * @param {string} [description]
   * @returns {Promise<{success: boolean, workspace?: Workspace, error?: string}>}
   */
  async createWorkspace(name, type = 'partner', description) {
    return this.client.createWorkspace(name, type, description);
  }

  /**
   * Initialize target workspace - create new or verify existing
   * @param {Object} options
   * @param {string} [options.targetWorkspaceId] - Existing workspace ID
   * @param {string} [options.workspaceName] - Name for new workspace
   * @param {string} [options.workspaceType='partner'] - Workspace type
   * @param {string} [options.description] - Workspace description
   * @returns {Promise<{success: boolean, workspace?: Workspace, created: boolean, error?: string}>}
   */
  async initializeTargetWorkspace(options = {}) {
    const { targetWorkspaceId, workspaceName, workspaceType = 'partner', description } = options;

    // Use existing workspace
    if (targetWorkspaceId) {
      const workspace = await this.client.getWorkspace(targetWorkspaceId);
      if (workspace) {
        return { success: true, workspace, created: false };
      }
      return { success: false, error: `Workspace ${targetWorkspaceId} not found`, created: false };
    }

    // Create new workspace
    if (!workspaceName) {
      return { success: false, error: 'Workspace name is required when creating a new workspace', created: false };
    }

    const result = await this.client.createWorkspace(workspaceName, workspaceType, description);
    if (result.success) {
      return { success: true, workspace: result.workspace, created: true };
    }
    return { success: false, error: result.error, created: false };
  }

  /**
   * Add a user as workspace admin
   * @param {string} workspaceId
   * @param {string} userId
   * @returns {Promise<{success: boolean, userId?: string, error?: string}>}
   */
  async addAdmin(workspaceId, userId) {
    const result = await this.client.addWorkspaceAdmin(workspaceId, userId, this.adminRoleId);
    if (result.success) {
      return { success: true, userId };
    }
    return { success: false, userId, error: result.error };
  }

  /**
   * Add multiple users as workspace admins
   * @param {string} workspaceId
   * @param {string[]} userIds
   * @param {function} [onProgress] - Progress callback
   * @returns {Promise<{success: Array, failed: Array}>}
   */
  async addMultipleAdmins(workspaceId, userIds, onProgress) {
    const results = { success: [], failed: [] };

    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];
      
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: userIds.length,
          userId,
        });
      }

      const result = await this.addAdmin(workspaceId, userId);
      
      if (result.success) {
        results.success.push({ userId });
      } else {
        results.failed.push({ userId, error: result.error });
      }

      // Rate limiting delay
      if (i < userIds.length - 1) {
        await this._delay(300);
      }
    }

    return results;
  }

  /**
   * Remove a user from workspace
   * @param {string} workspaceId
   * @param {string} userId
   * @param {string} roleId
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async removeUser(workspaceId, userId, roleId) {
    return this.client.removeWorkspaceUser(workspaceId, userId, roleId);
  }

  /**
   * Get workspace roles
   * @param {string} workspaceId
   * @returns {Promise<Array>}
   */
  async getWorkspaceRoles(workspaceId) {
    return this.client.getWorkspaceRoles(workspaceId);
  }

  /**
   * Get workspace summary with counts
   * @param {string} workspaceId
   * @returns {Promise<{workspaceId: string, counts: Object, items: Object}>}
   */
  async getWorkspaceSummary(workspaceId) {
    const [collections, environments, mocks, specs] = await Promise.all([
      this.client.getCollections(workspaceId),
      this.client.getEnvironments(workspaceId),
      this.client.getMocks(workspaceId),
      this.client.getSpecs(workspaceId),
    ]);

    return {
      workspaceId,
      counts: {
        collections: collections.length,
        environments: environments.length,
        mocks: mocks.length,
        specs: specs.length,
      },
      items: {
        collections,
        environments,
        mocks,
        specs,
      },
    };
  }

  /**
   * Helper delay function
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

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

const COMMON_HOST_VAR_NAMES$1 = [
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
class ProvisioningService {
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

      // Copy workspace description from source
      await this._copyWorkspaceDescription(options.sourceWorkspaceId, targetWorkspaceId, options.workspaceName);

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

      // Copy workspace description from source
      await this._copyWorkspaceDescription(options.sourceWorkspaceId, targetWorkspaceId, options.workspaceName);

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

  _deriveCompanyName(workspaceName) {
    if (!workspaceName) return null;
    const match = workspaceName.match(/<>\s*(.+?)\s*Partner\s*Workspace/i);
    return match ? match[1].trim() : null;
  }

  async _copyWorkspaceDescription(sourceWorkspaceId, targetWorkspaceId, targetWorkspaceName) {
    try {
      const sourceWorkspace = await this.client.getWorkspace(sourceWorkspaceId);
      const sourceDescription = sourceWorkspace?.description;
      if (!sourceDescription) {
        console.warn('Source workspace has no description — skipping description copy');
        return;
      }
      let finalDescription = sourceDescription;
      const companyName = this._deriveCompanyName(targetWorkspaceName);
      if (companyName) {
        finalDescription = sourceDescription.replace(/<Company>/g, companyName);
        console.log(`Replaced <Company> placeholder with "${companyName}"`);
      } else {
        console.warn('Could not derive company name from target workspace name — copying description as-is');
      }
      const updateResult = await this.client.updateWorkspace(targetWorkspaceId, { description: finalDescription });
      if (updateResult.success) {
        console.log('Workspace description updated successfully');
      } else {
        console.warn('Failed to update workspace description — continuing provisioning');
      }
    } catch (err) {
      console.warn(`Unexpected error copying workspace description: ${err.message} — continuing provisioning`);
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
        COMMON_HOST_VAR_NAMES$1.some(n => n.toLowerCase() === v.key.toLowerCase())
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
      if (COMMON_HOST_VAR_NAMES$1.some(n => n.toLowerCase() === v.key.toLowerCase())) {
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
class ResetService {
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

      // Clear workspace description
      try {
        await this.client.updateWorkspace(workspaceId, { description: '' });
      } catch (e) {
        console.warn('Failed to clear workspace description:', e.message);
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

      // Clear workspace description
      try {
        await this.client.updateWorkspace(workspaceId, { description: '' });
      } catch (e) {
        console.warn('Failed to clear workspace description:', e.message);
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
class UpdateService {
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

/**
 * Check if Postman is configured (has API key and source workspace)
 * @param {Object} [env] - Environment variables object
 * @returns {boolean}
 */
function isPostmanConfigured(env = process.env) {
  const apiKey = env.POSTMAN_API_KEY || env.VITE_POSTMAN_API_KEY;
  const sourceWorkspace = env.POSTMAN_SOURCE_WORKSPACE_ID || env.VITE_POSTMAN_SOURCE_WORKSPACE_ID;
  return !!(apiKey && sourceWorkspace);
}

/**
 * Check if Postman is fully configured (API key + source + target workspaces)
 * @param {Object} [env] - Environment variables object
 * @returns {boolean}
 */
function isPostmanFullyConfigured(env = process.env) {
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
function getConfigurationStatus(env = process.env) {
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
function getApiKey(env = process.env) {
  return env.POSTMAN_API_KEY || env.VITE_POSTMAN_API_KEY;
}

/**
 * Get source workspace ID from environment
 * @param {Object} [env] - Environment variables object
 * @returns {string|undefined}
 */
function getSourceWorkspaceId(env = process.env) {
  return env.POSTMAN_SOURCE_WORKSPACE_ID || env.VITE_POSTMAN_SOURCE_WORKSPACE_ID;
}

/**
 * Get target workspace ID from environment
 * @param {Object} [env] - Environment variables object
 * @returns {string|undefined}
 */
function getTargetWorkspaceId(env = process.env) {
  return env.POSTMAN_TARGET_WORKSPACE_ID || env.VITE_POSTMAN_TARGET_WORKSPACE_ID;
}

/**
 * Parse comma-separated string to array
 * @param {string} [value] - Comma-separated string
 * @returns {string[]}
 */
function parseCommaSeparated(value) {
  if (!value) return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Format collections for UI checklist
 * @param {Array} collections - Raw collection data
 * @returns {Array<{id: string, uid: string, name: string, selected: boolean, metadata: Object}>}
 */
function formatCollectionsForUI(collections) {
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
function formatEnvironmentsForUI(environments) {
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
function formatMocksForUI(mocks) {
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
function formatSpecsForUI(specs) {
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
function formatResourcesForUI(resources) {
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
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Client

/**
 * Create a configured PostmanClient from environment
 * @param {Object} [env] - Environment variables
 * @returns {PostmanClient}
 */
function createClient(env = process.env) {
  const apiKey = getApiKey(env);
  if (!apiKey) {
    throw new Error('POSTMAN_API_KEY environment variable is required');
  }
  return new PostmanClient({ apiKey });
}

/**
 * Full workspace provisioning (convenience function)
 * @param {Object} options
 * @param {string} options.sourceWorkspaceId
 * @param {string} [options.targetWorkspaceId]
 * @param {string} [options.workspaceName]
 * @param {string} [options.workspaceType]
 * @param {string[]} [options.adminUserIds]
 * @param {string[]} [options.partnerEmails]
 * @param {string} [options.partnerRoleId]
 * @param {function} [onProgress]
 * @returns {Promise<Object>}
 */
async function provisionWorkspace(options, onProgress) {
  const client = createClient();
  const service = new ProvisioningService(client);
  return service.provision(options, onProgress);
}

/**
 * Custom workspace provisioning (convenience function)
 * @param {Object} options
 * @param {function} [onProgress]
 * @returns {Promise<Object>}
 */
async function provisionCustomWorkspace(options, onProgress) {
  const client = createClient();
  const service = new ProvisioningService(client);
  return service.provisionCustom(options, onProgress);
}

/**
 * Quick provision with minimal configuration
 * @param {string} sourceWorkspaceId
 * @param {string} workspaceName
 * @param {Object} [extraOptions]
 * @param {function} [onProgress]
 * @returns {Promise<Object>}
 */
async function quickProvision(sourceWorkspaceId, workspaceName, extraOptions = {}, onProgress) {
  return provisionWorkspace({
    sourceWorkspaceId,
    workspaceName,
    workspaceType: 'partner',
    ...extraOptions,
  }, onProgress);
}

/**
 * Reset workspace - delete all or selected resources (convenience function)
 * @param {string} workspaceId
 * @param {function} [onProgress]
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
async function resetWorkspace(workspaceId, onProgress, options) {
  const client = createClient();
  const service = new ResetService(client);
  return service.reset(workspaceId, onProgress, options);
}

/**
 * Custom reset workspace - delete specific items (convenience function)
 * @param {string} workspaceId
 * @param {function} [onProgress]
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
async function resetCustomWorkspace(workspaceId, onProgress, options) {
  const client = createClient();
  const service = new ResetService(client);
  return service.resetCustom(workspaceId, onProgress, options);
}

/**
 * Validate API key (convenience function)
 * @returns {Promise<{valid: boolean, user?: Object, error?: string}>}
 */
async function validateApiKey() {
  const client = createClient();
  return client.validateApiKey();
}

/**
 * Get workspace details (convenience function)
 * @param {string} workspaceId
 * @returns {Promise<Object|null>}
 */
async function getWorkspace(workspaceId) {
  const client = createClient();
  return client.getWorkspace(workspaceId);
}

/**
 * Get workspace summary with counts (convenience function)
 * @param {string} workspaceId
 * @returns {Promise<Object>}
 */
async function getWorkspaceSummary(workspaceId) {
  const client = createClient();
  const service = new WorkspaceService(client);
  return service.getWorkspaceSummary(workspaceId);
}

/**
 * Get collections formatted for UI (convenience function)
 * @param {string} workspaceId
 * @returns {Promise<Array>}
 */
async function getAvailableCollections(workspaceId) {
  const client = createClient();
  const collections = await client.getCollections(workspaceId);
  return formatCollectionsForUI(collections);
}

/**
 * Get all resources formatted for UI (convenience function)
 * @param {string} workspaceId
 * @returns {Promise<Object>}
 */
async function getAvailableResources(workspaceId) {
  const client = createClient();
  const [collections, environments, mocks, specs] = await Promise.all([
    client.getCollections(workspaceId),
    client.getEnvironments(workspaceId),
    client.getMocks(workspaceId),
    client.getSpecs(workspaceId),
  ]);
  return formatResourcesForUI({ collections, environments, mocks, specs });
}

/**
 * Get workspace roles (convenience function)
 * @param {string} workspaceId
 * @returns {Promise<Array>}
 */
async function getWorkspaceRoles(workspaceId) {
  const client = createClient();
  return client.getWorkspaceRoles(workspaceId);
}

/**
 * Add workspace admin (convenience function)
 * @param {string} workspaceId
 * @param {string} userId
 * @param {string} [roleId='3']
 * @returns {Promise<Object>}
 */
async function addWorkspaceAdmin(workspaceId, userId, roleId = '3') {
  const client = createClient();
  return client.addWorkspaceAdmin(workspaceId, userId, roleId);
}

/**
 * Add multiple workspace admins (convenience function)
 * @param {string} workspaceId
 * @param {string[]} userIds
 * @param {function} [onProgress]
 * @returns {Promise<Object>}
 */
async function addMultipleAdmins(workspaceId, userIds, onProgress) {
  const client = createClient();
  const service = new WorkspaceService(client);
  return service.addMultipleAdmins(workspaceId, userIds, onProgress);
}

/**
 * Remove workspace user (convenience function)
 * @param {string} workspaceId
 * @param {string} userId
 * @param {string} roleId
 * @returns {Promise<Object>}
 */
async function removeWorkspaceUser(workspaceId, userId, roleId) {
  const client = createClient();
  return client.removeWorkspaceUser(workspaceId, userId, roleId);
}

/**
 * Invite partner (convenience function)
 * @param {string} workspaceId
 * @param {string} email
 * @param {string} [roleId='7']
 * @returns {Promise<Object>}
 */
async function invitePartner(workspaceId, email, roleId = '7') {
  const client = createClient();
  return client.invitePartner(workspaceId, email, roleId);
}

/**
 * Invite multiple partners (convenience function)
 * @param {string} workspaceId
 * @param {string[]} emails
 * @param {string} [roleId='7']
 * @param {function} [onProgress]
 * @returns {Promise<Array>}
 */
async function inviteMultiplePartners(workspaceId, emails, roleId = '7', onProgress) {
  const client = createClient();
  const results = [];
  
  for (let i = 0; i < emails.length; i++) {
    if (onProgress) {
      onProgress({ current: i + 1, total: emails.length, email: emails[i] });
    }
    const result = await client.invitePartner(workspaceId, emails[i], roleId);
    results.push(result);
    if (i < emails.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }
  
  return results;
}

/**
 * Remove partner (convenience function)
 * @param {string} workspaceId
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function removePartner(workspaceId, userId) {
  const client = createClient();
  return client.removePartner(workspaceId, userId);
}

/**
 * Remove multiple partners (convenience function)
 * @param {string} workspaceId
 * @param {string[]} userIds
 * @param {function} [onProgress]
 * @returns {Promise<Array>}
 */
async function removeMultiplePartners(workspaceId, userIds, onProgress) {
  const client = createClient();
  const results = [];
  
  for (let i = 0; i < userIds.length; i++) {
    if (onProgress) {
      onProgress({ current: i + 1, total: userIds.length, userId: userIds[i] });
    }
    const result = await client.removePartner(workspaceId, userIds[i]);
    results.push(result);
    if (i < userIds.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return results;
}

/**
 * Update workspace — detect and add new assets (convenience function)
 * @param {Object} options
 * @param {string} options.sourceWorkspaceId
 * @param {string} options.targetWorkspaceId
 * @param {function} [onProgress]
 * @returns {Promise<Object>}
 */
async function updateWorkspace(options, onProgress) {
  const client = createClient();
  const service = new UpdateService(client);
  return service.update(options, onProgress);
}

export { HttpClient, PostmanClient, ProvisioningService, ResetService, UpdateService, WorkspaceService, addMultipleAdmins, addWorkspaceAdmin, createClient, delay, formatCollectionsForUI, formatEnvironmentsForUI, formatMocksForUI, formatResourcesForUI, formatSpecsForUI, getApiKey, getAvailableCollections, getAvailableResources, getConfigurationStatus, getSourceWorkspaceId, getTargetWorkspaceId, getWorkspace, getWorkspaceRoles, getWorkspaceSummary, inviteMultiplePartners, invitePartner, isPostmanConfigured, isPostmanFullyConfigured, parseCommaSeparated, provisionCustomWorkspace, provisionWorkspace, quickProvision, removeMultiplePartners, removePartner, removeWorkspaceUser, resetCustomWorkspace, resetWorkspace, updateWorkspace, validateApiKey };
//# sourceMappingURL=index.js.map
