import { HttpClient } from './HttpClient.js';

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
export class PostmanClient {
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

export default PostmanClient;
