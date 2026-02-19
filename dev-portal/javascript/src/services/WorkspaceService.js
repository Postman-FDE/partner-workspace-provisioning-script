/**
 * @typedef {import('../client/PostmanClient.js').PostmanClient} PostmanClient
 * @typedef {import('../client/PostmanClient.js').Workspace} Workspace
 * @typedef {import('../client/PostmanClient.js').User} User
 */

/**
 * High-level workspace management service
 */
export class WorkspaceService {
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

export default WorkspaceService;
