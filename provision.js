#!/usr/bin/env node
/**
 * Partner Workspace Provisioning Script
 * 
 * Modular system for creating and provisioning Postman partner workspaces.
 * Copies collections, creates mock servers, copies environments, updates mock URLs,
 * copies spec files, adds team members, and invites partners from a source workspace.
 * 
 * WORKFLOW ORDER:
 *   1. Copy collections from source to target workspace (+ extract host variables)
 *   2. Create mock servers for each copied collection
 *   3. Copy placeholder environments from source workspace
 *   4. Create fresh Mock Env with new mock URLs (bare mock server URLs)
 *   5. Update collection variables to reference mock env variable names
 *   6. Copy spec files from source to target workspace
 *   7. Add team members as workspace admins (optional)
 *   8. Invite partners to the workspace (optional) - returns invitation links
 * 
 * Required Environment Variables:
 *   - POSTMAN_API_KEY: Your Postman API key
 *   - POSTMAN_SOURCE_WORKSPACE_ID: Source workspace to copy from
 *   - POSTMAN_TARGET_WORKSPACE_ID: (Optional) Existing target workspace
 *   - POSTMAN_WORKSPACE_NAME: (Optional) Name for new workspace
 * 
 * Optional Environment Variables for Team & Partners:
 *   - POSTMAN_ADMIN_USER_IDS: Comma-separated list of user IDs to add as admins
 *   - PARTNER_EMAILS: Comma-separated list of partner emails to invite
 *   - PARTNER_ROLE_ID: Partner role ID (default: "7" for Editor and Partner Lead)
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

// Team member and partner configuration
const POSTMAN_ADMIN_USER_IDS = process.env.POSTMAN_ADMIN_USER_IDS; // Comma-separated user IDs
const PARTNER_EMAILS = process.env.PARTNER_EMAILS; // Comma-separated emails
const PARTNER_ROLE_ID = process.env.PARTNER_ROLE_ID || "7"; // Default: Editor and Partner Lead
const ADMIN_ROLE_ID = "3"; // Workspace Admin role

// Partner workspace type
const WORKSPACE_TYPE = "partner";


/**
 * Parse comma-separated string into array of trimmed values
 * @param {string|undefined} value - Comma-separated string
 * @returns {string[]} Array of trimmed values
 */
const parseCommaSeparated = (value) => {
  if (!value || typeof value !== 'string') return [];
  return value.split(',').map(v => v.trim()).filter(v => v.length > 0);
};

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
  
  // Admin users added: userId -> { roleId }
  admins: new Map(),
  
  // Partner invitations: email -> { status, invitationLink, userId }
  invitations: new Map(),
  
  // Target workspace info
  targetWorkspace: null,
  
  // Clear all stores
  clear() {
    this.collections.clear();
    this.environments.clear();
    this.mocks.clear();
    this.specs.clear();
    this.admins.clear();
    this.invitations.clear();
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
      admins: this.admins.size,
      invitations: this.invitations.size,
    };
  },

  // Get all invitation links as an array
  getAllInvitationLinks() {
    const links = [];
    for (const [email, data] of this.invitations) {
      if (data.invitationLink) {
        links.push({
          email,
          invitationLink: data.invitationLink,
          status: data.status,
        });
      }
    }
    return links;
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

/**
 * Convert a string to PascalCase, splitting on camelCase boundaries and non-alphanumeric chars.
 * e.g. "baseUrl" -> "BaseUrl", "HostName" -> "HostName", "authToken_Hostname" -> "AuthTokenHostname"
 */
const toPascalCase = (str) => {
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
};

/**
 * Extract the pathname from a URL string.
 * e.g. "https://example.com/banking/efx/v1" -> "/banking/efx/v1"
 */
const extractUrlPath = (urlString) => {
  try {
    const url = new URL(urlString);
    return url.pathname === '/' ? '' : url.pathname;
  } catch {
    return '';
  }
};

const COMMON_HOST_VAR_NAMES = ['baseUrl', 'baseurl', 'base_url', 'HostName', 'hostname', 'host', 'apiUrl', 'apiurl', 'api_url', 'serverUrl', 'serverurl', 'server_url'];

/**
 * Recursively traverse a collection's item tree and extract all unique
 * variable names used in request url.host fields (e.g. {{HostName}}).
 * Returns an array of { varName, originalUrl, path } objects.
 *
 * Two-tier detection:
 *   1. Primary: variables found in request url.host whose values contain '://'
 *   2. Fallback: if all detected variables are filtered out (values lack '://'),
 *      keep them anyway (with empty path) so mock env vars still get created
 *      and collection variables still get updated.
 *   3. Last resort: if no variables found in request URLs at all, scan the
 *      collection's variable array for common host variable names.
 */
const extractHostVariables = (collection) => {
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

  if (hostVarNames.size > 0) {
    const allMapped = Array.from(hostVarNames).map(varName => {
      const varDef = collectionVars.find(v => v.key === varName);
      const originalUrl = varDef?.value || '';
      return { varName, originalUrl, path: extractUrlPath(originalUrl) };
    });

    const withProtocol = allMapped.filter(hv => hv.originalUrl.includes('://'));
    if (withProtocol.length > 0) return withProtocol;

    return allMapped.map(hv => ({ ...hv, path: '' }));
  }

  const fallbackVars = collectionVars
    .filter(v => COMMON_HOST_VAR_NAMES.includes(v.key))
    .map(v => ({ varName: v.key, originalUrl: v.value || '', path: '' }));

  return fallbackVars;
};

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
// MODULE: WORKSPACE ROLES
// API functions for managing workspace roles and team members
// ============================================================================

const WorkspaceRolesAPI = {
  /**
   * Get all roles assigned in a workspace
   * GET /workspaces/{workspaceId}/roles
   * 
   * Returns users and their roles, including partners
   */
  async getRoles(workspaceId) {
    try {
      const response = await api.get(`/workspaces/${workspaceId}/roles`);
      return { success: true, roles: response.data.roles || [] };
    } catch (error) {
      return {
        success: false,
        error: logApiError('Get workspace roles', error, { workspaceId }),
        roles: []
      };
    }
  },

  /**
   * Add a workspace admin (team member)
   * PATCH /workspaces/{workspaceId}/roles
   * 
   * @param {string} workspaceId - Target workspace ID
   * @param {string} userId - User ID to add as admin
   * @param {string} roleId - Role ID (default: "3" for Admin)
   */
  async addAdmin(workspaceId, userId, roleId = ADMIN_ROLE_ID) {
    try {
      const response = await api.patch(`/workspaces/${workspaceId}/roles`, {
        roles: [
          {
            op: "add",
            path: "/user",
            value: [
              {
                id: userId,
                role: roleId,
              },
            ],
          },
        ],
      });
      return { success: true, roles: response.data.roles };
    } catch (error) {
      return {
        success: false,
        error: logApiError('Add workspace admin', error, { workspaceId, userId })
      };
    }
  },

  /**
   * Remove a user from workspace
   * PATCH /workspaces/{workspaceId}/roles
   * 
   * @param {string} workspaceId - Target workspace ID
   * @param {string} userId - User ID to remove
   * @param {string} roleId - Current role ID of the user
   */
  async removeUser(workspaceId, userId, roleId) {
    try {
      const response = await api.patch(`/workspaces/${workspaceId}/roles`, {
        roles: [
          {
            op: "remove",
            path: "/user",
            value: [
              {
                id: userId,
                role: roleId,
              },
            ],
          },
        ],
      });
      return { success: true, roles: response.data.roles };
    } catch (error) {
      return {
        success: false,
        error: logApiError('Remove workspace user', error, { workspaceId, userId })
      };
    }
  },
};

// ============================================================================
// MODULE: INVITATIONS
// API functions for managing partner invitations
// ============================================================================

const InvitationsAPI = {
  /**
   * Invite a partner to a workspace
   * POST /invitations
   * 
   * @param {string} workspaceId - Target workspace ID
   * @param {string} email - Partner email to invite
   * @param {string} roleId - Partner role ID (default: "7" for Editor and Partner Lead)
   * @returns {Object} { success, email, status, invitationLink, userId (if already exists) }
   */
  async invitePartner(workspaceId, email, roleId = PARTNER_ROLE_ID) {
    try {
      const response = await api.post('/invitations', {
        action: "invite_partner",
        targetEntity: "workspace",
        targetEntityId: workspaceId,
        roleId: roleId,
        target: {
          emails: [email],
        },
      });
      
      const result = response.data.results?.[0] || {};
      return {
        success: true,
        email: result.email || email,
        status: result.status,
        invitationLink: result.invitationLink || null,
        userId: result.userId || null,
        roleDisplayName: response.data.roleDisplayName,
      };
    } catch (error) {
      return {
        success: false,
        email,
        error: logApiError('Invite partner', error, { workspaceId, email })
      };
    }
  },

  /**
   * Remove a partner from a workspace
   * POST /invitations
   * 
   * @param {string} workspaceId - Target workspace ID
   * @param {string} userId - Partner user ID to remove
   */
  async removePartner(workspaceId, userId) {
    try {
      const response = await api.post('/invitations', {
        action: "remove_partner",
        targetEntity: "workspace",
        targetEntityId: workspaceId,
        target: {
          userIds: [userId],
        },
      });
      
      const result = response.data.results?.[0] || {};
      return {
        success: true,
        userId: result.userId || userId,
        status: result.status,
      };
    } catch (error) {
      return {
        success: false,
        userId,
        error: logApiError('Remove partner', error, { workspaceId, userId })
      };
    }
  },

  /**
   * Remove a partner from the entire team
   * POST /invitations
   * 
   * @param {string} teamId - Publisher team ID
   * @param {string} userId - Partner user ID to remove
   */
  async removePartnerFromTeam(teamId, userId) {
    try {
      const response = await api.post('/invitations', {
        action: "remove_partner",
        targetEntity: "team",
        targetEntityId: teamId,
        target: {
          userIds: [userId],
        },
      });
      
      const result = response.data.results?.[0] || {};
      return {
        success: true,
        userId: result.userId || userId,
        status: result.status,
      };
    } catch (error) {
      return {
        success: false,
        userId,
        error: logApiError('Remove partner from team', error, { teamId, userId })
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

  /**
   * Update a collection's variables via partial update
   * PATCH /collections/{collectionId}
   * @param {string} collectionUid - Collection UID to update
   * @param {Array} variables - Full variable array to set on the collection
   */
  async patchVariables(collectionUid, variables) {
    try {
      const response = await api.patch(`/collections/${collectionUid}`, {
        collection: {
          variable: variables,
        },
      });
      return { success: true, collection: response.data.collection };
    } catch (error) {
      return {
        success: false,
        error: logApiError('Patch collection variables', error, { collectionUid })
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
   * Copy all collections from source to target workspace.
   * After forking, fetches full collection details to extract host variables
   * (variable names used in request URLs and their URL paths).
   * Stores mapping in Store.collections including hostVariables.
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
        // Fetch full details of the forked collection to extract host variables
        let hostVariables = [];
        const collDetails = await CollectionsAPI.getDetails(forkResult.collection.uid);
        if (collDetails) {
          hostVariables = extractHostVariables(collDetails);
          if (hostVariables.length > 0) {
            log.detail(`Found host variable(s): ${hostVariables.map(hv => `${hv.varName}${hv.path ? ' (path: ' + hv.path + ')' : ''}`).join(', ')}`);
          }
        }

        Store.collections.set(collection.uid, {
          sourceUid: collection.uid,
          targetUid: forkResult.collection.uid,
          name: collection.name,
          hostVariables,
          collectionDetails: collDetails,
        });
        
        results.success.push({
          name: collection.name,
          sourceUid: collection.uid,
          targetUid: forkResult.collection.uid,
          hostVariables,
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

  /**
   * Update all forked collections' variables to reference mock env variable names.
   * For each host variable found in a collection, replaces its value with {{mockEnvVarName}}.
   * Includes a best-effort fallback for collections where no host variables were detected.
   */
  async updateAllVariables(mockEnvVarMap) {
    const results = { success: [], failed: [], warnings: [] };

    for (const [, collData] of Store.collections) {
      if (!collData.collectionDetails) continue;

      const existingVars = collData.collectionDetails.variable || [];
      const hostVars = collData.hostVariables || [];

      if (hostVars.length > 0) {
        const updatedVars = existingVars.map(v => {
          const hv = hostVars.find(h => h.varName === v.key);
          if (hv) {
            const mockEnvVarName = mockEnvVarMap.get(`${collData.targetUid}:${hv.varName}`);
            if (mockEnvVarName) {
              return { ...v, value: `{{${mockEnvVarName}}}` };
            }
          }
          return v;
        });

        const patchResult = await CollectionsAPI.patchVariables(collData.targetUid, updatedVars);
        if (patchResult.success) {
          const updatedNames = hostVars
            .map(hv => mockEnvVarMap.get(`${collData.targetUid}:${hv.varName}`))
            .filter(Boolean);
          results.success.push({ name: collData.name, variables: updatedNames });
          log.success(`Updated variables for: ${collData.name}`);
          for (const hv of hostVars) {
            const envName = mockEnvVarMap.get(`${collData.targetUid}:${hv.varName}`);
            if (envName) {
              log.detail(`${hv.varName} -> {{${envName}}}`);
            }
          }
        } else {
          results.failed.push({ name: collData.name, error: patchResult.error });
          log.error(`Failed to update variables for "${collData.name}": ${patchResult.error}`);
        }
      } else {
        const fallbackEnvVarName = mockEnvVarMap.get(`${collData.targetUid}:__fallback__`);
        if (!fallbackEnvVarName) continue;

        const matchedVar = existingVars.find(v =>
          COMMON_HOST_VAR_NAMES.includes(v.key)
        );

        if (matchedVar) {
          const updatedVars = existingVars.map(v =>
            v.key === matchedVar.key ? { ...v, value: `{{${fallbackEnvVarName}}}` } : v
          );

          const patchResult = await CollectionsAPI.patchVariables(collData.targetUid, updatedVars);
          if (patchResult.success) {
            results.success.push({ name: collData.name, variables: [fallbackEnvVarName] });
            log.success(`Updated variables for: ${collData.name} (fallback)`);
            log.detail(`${matchedVar.key} -> {{${fallbackEnvVarName}}}`);
          } else {
            results.failed.push({ name: collData.name, error: patchResult.error });
            log.error(`Failed to update variables for "${collData.name}": ${patchResult.error}`);
          }
        } else {
          results.warnings.push({ name: collData.name });
          log.warn(`No host variable found in "${collData.name}" — mock env variable "${fallbackEnvVarName}" was created but collection variable was not updated`);
          continue;
        }
      }

      await delay(300);
    }

    return results;
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
   * Generate environment variables from mock URLs using host variable detection.
   * For each collection, for each host variable found in its requests, creates a
   * mock env variable named {camelCaseCollectionName}{PascalCaseVarName} with the
   * bare mock server URL (no path appended — mock servers route based on
   * collection-relative paths, not the original API's base path).
   *
   * Also builds a mapping (mockEnvVarMap) used later to update collection variables.
   * The map key is "{targetCollectionUid}:{hostVarName}" -> mockEnvVarName.
   *
   * @returns {{ variables: Array, mockEnvVarMap: Map<string, string> }}
   */
  generateMockUrlVariables() {
    const variables = [];
    const mockEnvVarMap = new Map();

    const toCamelCase = (name) => {
      return name
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .split(/\s+/)
        .map((word, index) =>
          index === 0
            ? word.toLowerCase()
            : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join('');
    };

    for (const [sourceUid, collData] of Store.collections) {
      const mockData = Store.mocks.get(collData.targetUid);
      if (!mockData) continue;

      const hostVars = collData.hostVariables || [];
      if (hostVars.length === 0) {
        const varName = toCamelCase(collData.name) + 'BaseUrl';
        variables.push({
          key: varName,
          value: mockData.mockUrl,
          enabled: true,
          type: 'default',
        });
        mockEnvVarMap.set(`${collData.targetUid}:__fallback__`, varName);
        continue;
      }

      for (const hv of hostVars) {
        const collectionPart = toCamelCase(collData.name);
        const varPart = toPascalCase(hv.varName);
        const envVarName = collectionPart + varPart;

        variables.push({
          key: envVarName,
          value: mockData.mockUrl,
          enabled: true,
          type: 'default',
        });

        mockEnvVarMap.set(`${collData.targetUid}:${hv.varName}`, envVarName);
      }
    }

    return { variables, mockEnvVarMap };
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
   * Create a fresh Mock Env with generated mock URL variables.
   * Always creates a new environment (does not scan for or merge into existing).
   * Returns the mockEnvVarMap needed for the collection variable update step.
   */
  async createMockEnv(targetWorkspaceId) {
    const { variables: mockUrlVariables, mockEnvVarMap } = MocksHelper.generateMockUrlVariables();
    
    if (mockUrlVariables.length === 0) {
      log.warn('No mock URLs to add to environment');
      return { success: false, error: 'No mock URLs available', mockEnvVarMap };
    }
    
    log.info('Creating new "Mock Env" environment');
    
    const createResult = await EnvironmentsAPI.create(
      'Mock Env',
      mockUrlVariables,
      targetWorkspaceId
    );
    
    if (createResult.success) {
      Store.environments.set('mock-env-created', {
        sourceUid: null,
        targetUid: createResult.environment.uid,
        name: 'Mock Env',
      });
      
      log.success(`Created "Mock Env" with ${mockUrlVariables.length} mock URL variable(s)`);
      return { success: true, environment: createResult.environment, action: 'created', mockEnvVarMap };
    } else {
      return { success: false, error: createResult.error, mockEnvVarMap };
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
   * Create a new spec in a workspace with files
   * POST /specs?workspaceId={workspaceId}
   * 
   * @param {string} workspaceId - Target workspace ID
   * @param {string} name - Spec name
   * @param {string} type - Spec type (e.g., "OPENAPI:3.0", "OPENAPI:3.1", "ASYNCAPI:2.0")
   * @param {Array} files - Array of files with { path, content, type } where type is "ROOT" or "DEFAULT"
   */
  async create(workspaceId, name, type, files) {
    try {
      const requestBody = {
        name,
        type,
        files,
      };
      
      const response = await api.post(`/specs?workspaceId=${workspaceId}`, requestBody);
      return { success: true, spec: response.data };
    } catch (error) {
      return {
        success: false,
        error: logApiError('Create spec', error, { name, fileCount: files?.length })
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
   * Simplified Workflow (using Create Spec API with all files at once):
   * 1. Get all specs (provides: id, name, type)
   * 2. Get a spec's files (provides: file metadata with id, path, type)
   * 3. For each file, get content (GET /specs/{specId}/files/{filePath})
   * 4. Create spec with all files in one API call
   */
  async copySpec(sourceSpecId, sourceSpecName, sourceSpecType, targetWorkspaceId, onProgress) {
    const result = {
      success: false,
      specName: sourceSpecName,
      newSpecId: null,
      filesCopied: 0,
      totalFiles: 0,
      errors: [],
    };

    try {
      // Step 1: Get all files metadata for the source spec
      onProgress?.({ step: 'files', message: `Getting files for: ${sourceSpecName}` });
      const sourceFiles = await SpecsAPI.getFiles(sourceSpecId);
      result.totalFiles = sourceFiles.length;

      if (sourceFiles.length === 0) {
        result.errors.push('No files found in source spec');
        log.warn(`Spec "${sourceSpecName}" has no files to copy`);
        return result;
      }

      // Step 2: Get content for each file
      onProgress?.({ step: 'content', message: `Fetching ${sourceFiles.length} file(s) content...` });
      const filesWithContent = [];
      
      for (const file of sourceFiles) {
        onProgress?.({
          step: 'fetchingFile',
          message: `Fetching: ${file.path}`,
          current: filesWithContent.length + 1,
          total: sourceFiles.length,
        });
        
        const fileContent = await SpecsAPI.getFile(sourceSpecId, file.path);
        if (fileContent && fileContent.content) {
          filesWithContent.push({
            path: file.path,
            content: fileContent.content,
            type: file.type, // "ROOT" or "DEFAULT"
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

      // Step 3: Create spec with all files in one API call
      onProgress?.({ step: 'create', message: `Creating spec with ${filesWithContent.length} file(s)...` });
      const createResult = await SpecsAPI.create(
        targetWorkspaceId,
        sourceSpecName,
        sourceSpecType, // e.g., "OPENAPI:3.0"
        filesWithContent // Array of { path, content, type }
      );

      if (!createResult.success) {
        result.errors.push(`Failed to create spec: ${createResult.error}`);
        return result;
      }

      result.newSpecId = createResult.spec.id;
      result.filesCopied = filesWithContent.length;
      result.success = true;
      
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
      log.info(`\n  [${i + 1}/${sourceSpecs.length}] Processing spec: ${spec.name} (${spec.type})`);
      
      const copyResult = await this.copySpec(
        spec.id,
        spec.name,
        spec.type, // e.g., "OPENAPI:3.0", "OPENAPI:3.1", "ASYNCAPI:2.0"
        targetWorkspaceId,
        (progress) => {
          if (progress.step === 'fetchingFile') {
            log.detail(`  ${progress.message} (${progress.current}/${progress.total})`);
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
// MODULE: WORKSPACE ROLES HELPER
// Helper functions for managing workspace team members
// ============================================================================

const WorkspaceRolesHelper = {
  /**
   * Add multiple admins to a workspace
   * @param {string} workspaceId - Target workspace ID
   * @param {string[]} userIds - Array of user IDs to add as admins
   * @returns {Object} Results with success and failed arrays
   */
  async addAllAdmins(workspaceId, userIds) {
    const results = { success: [], failed: [] };
    
    if (userIds.length === 0) {
      log.warn('No admin user IDs provided');
      return results;
    }
    
    log.info(`Adding ${userIds.length} admin(s) to workspace`);
    
    for (const userId of userIds) {
      const addResult = await WorkspaceRolesAPI.addAdmin(workspaceId, userId, ADMIN_ROLE_ID);
      
      if (addResult.success) {
        results.success.push({
          userId,
          roleId: ADMIN_ROLE_ID,
        });
        log.success(`Added admin: User ID ${userId}`);
      } else {
        results.failed.push({
          userId,
          error: addResult.error,
        });
        log.error(`Failed to add admin "${userId}": ${addResult.error}`);
      }
      
      await delay(300);
    }
    
    return results;
  },
};

// ============================================================================
// MODULE: INVITATIONS HELPER
// Helper functions for managing partner invitations
// ============================================================================

const InvitationsHelper = {
  /**
   * Invite multiple partners to a workspace
   * @param {string} workspaceId - Target workspace ID
   * @param {string[]} emails - Array of partner emails to invite
   * @param {string} roleId - Partner role ID
   * @returns {Object} Results with success array containing invitation links
   */
  async inviteAllPartners(workspaceId, emails, roleId = PARTNER_ROLE_ID) {
    const results = { success: [], failed: [] };
    
    if (emails.length === 0) {
      log.warn('No partner emails provided');
      return results;
    }
    
    log.info(`Inviting ${emails.length} partner(s) to workspace`);
    
    for (const email of emails) {
      const inviteResult = await InvitationsAPI.invitePartner(workspaceId, email, roleId);
      
      if (inviteResult.success) {
        results.success.push({
          email: inviteResult.email,
          status: inviteResult.status,
          invitationLink: inviteResult.invitationLink,
          userId: inviteResult.userId,
          roleDisplayName: inviteResult.roleDisplayName,
        });
        
        if (inviteResult.status === 'EMAIL_SENT') {
          log.success(`Invited: ${email} (invitation email sent)`);
        } else if (inviteResult.status === 'PARTNER_ADDED') {
          log.success(`Added: ${email} (existing partner added to workspace)`);
        } else {
          log.success(`Processed: ${email} (status: ${inviteResult.status})`);
        }
      } else {
        results.failed.push({
          email,
          error: inviteResult.error,
        });
        log.error(`Failed to invite "${email}": ${inviteResult.error}`);
      }
      
      await delay(300);
    }
    
    return results;
  },

  /**
   * Remove multiple partners from a workspace
   * @param {string} workspaceId - Target workspace ID
   * @param {string[]} userIds - Array of partner user IDs to remove
   * @returns {Object} Results with success and failed arrays
   */
  async removeAllPartners(workspaceId, userIds) {
    const results = { success: [], failed: [] };
    
    if (userIds.length === 0) {
      log.warn('No partner user IDs provided');
      return results;
    }
    
    log.info(`Removing ${userIds.length} partner(s) from workspace`);
    
    for (const userId of userIds) {
      const removeResult = await InvitationsAPI.removePartner(workspaceId, userId);
      
      if (removeResult.success) {
        results.success.push({
          userId: removeResult.userId,
          status: removeResult.status,
        });
        log.success(`Removed partner: User ID ${userId}`);
      } else {
        results.failed.push({
          userId,
          error: removeResult.error,
        });
        log.error(`Failed to remove partner "${userId}": ${removeResult.error}`);
      }
      
      await delay(300);
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
  // If no target workspace ID in .env, prompt for new workspace name
  if (!runtimeConfig.targetWorkspaceId) {
    const rl = createReadline();
    console.log('\x1b[36m─────────────────────────────────────────────────────────────\x1b[0m');
    console.log('\x1b[1mNew Workspace Configuration\x1b[0m\n');
    console.log('  No target workspace ID found in .env file.');
    console.log('  A new workspace will be created.\n');
    
    const newName = await prompt(rl, `Enter name for new workspace [${runtimeConfig.workspaceName}]: `);
    if (newName) {
      runtimeConfig.workspaceName = newName;
    }
    
    rl.close();
  }
  
  return true;
}

async function confirmAndRun() {
  const rl = createReadline();
  
  console.log('\n\x1b[36m─────────────────────────────────────────────────────────────\x1b[0m');
  console.log('\x1b[1mReady to Start Provisioning\x1b[0m\n');
  
  if (runtimeConfig.targetWorkspaceId) {
    console.log(`  Target: Existing workspace (ID: ${runtimeConfig.targetWorkspaceId})`);
  } else {
    console.log(`  Target: NEW "${runtimeConfig.workspaceName}" (${WORKSPACE_TYPE})`);
  }
  
  console.log('\n\x1b[36m─────────────────────────────────────────────────────────────\x1b[0m');
  
  const confirm = await prompt(rl, '\nProceed with provisioning? (Y/N): ');
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
    collectionVarUpdate: { total: 0, success: 0, failed: [] },
    specs: { total: 0, success: 0, failed: [] },
    admins: { total: 0, success: 0, failed: [] },
    invitations: { total: 0, success: 0, failed: [], links: [] },
  };

  // Parse admin user IDs and partner emails from environment variables
  const adminUserIds = parseCommaSeparated(POSTMAN_ADMIN_USER_IDS);
  const partnerEmails = parseCommaSeparated(PARTNER_EMAILS);

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
  log.step('Step 4: Creating Mock Env with mock URLs...');
  
  const mockEnvResult = await EnvironmentsHelper.createMockEnv(targetWorkspaceId);
  results.mockEnvUpdate = mockEnvResult;

  // =========================================================================
  // STEP 5: UPDATE COLLECTION VARIABLES
  // =========================================================================
  log.step('Step 5: Updating collection variables to reference mock env...');

  if (mockEnvResult.mockEnvVarMap && mockEnvResult.mockEnvVarMap.size > 0) {
    const collVarResults = await CollectionsHelper.updateAllVariables(mockEnvResult.mockEnvVarMap);
    results.collectionVarUpdate.total = collVarResults.success.length + collVarResults.failed.length;
    results.collectionVarUpdate.success = collVarResults.success.length;
    results.collectionVarUpdate.failed = collVarResults.failed;
  } else {
    log.info('No mock env variable mappings available. Skipping.');
  }

  // =========================================================================
  // STEP 6: COPY SPECS
  // =========================================================================
  log.step('Step 6: Copying spec files...');
  
  const specResults = await SpecsHelper.copyAll(POSTMAN_SOURCE_WORKSPACE_ID, targetWorkspaceId);
  results.specs.total = specResults.success.length + specResults.failed.length;
  results.specs.success = specResults.success.length;
  results.specs.failed = specResults.failed;

  // =========================================================================
  // STEP 7: ADD TEAM ADMINS (if configured)
  // =========================================================================
  if (adminUserIds.length > 0) {
    log.step('Step 7: Adding workspace admins...');
    
    const adminResults = await WorkspaceRolesHelper.addAllAdmins(targetWorkspaceId, adminUserIds);
    results.admins.total = adminResults.success.length + adminResults.failed.length;
    results.admins.success = adminResults.success.length;
    results.admins.failed = adminResults.failed;
    
    // Store admin data
    for (const admin of adminResults.success) {
      Store.admins.set(admin.userId, {
        roleId: admin.roleId,
      });
    }
  } else {
    log.step('Step 7: Adding workspace admins...');
    log.info('No admin user IDs configured (POSTMAN_ADMIN_USER_IDS). Skipping.');
  }

  // =========================================================================
  // STEP 8: INVITE PARTNERS (if configured)
  // =========================================================================
  if (partnerEmails.length > 0) {
    log.step('Step 8: Inviting partners...');
    
    const inviteResults = await InvitationsHelper.inviteAllPartners(targetWorkspaceId, partnerEmails, PARTNER_ROLE_ID);
    results.invitations.total = inviteResults.success.length + inviteResults.failed.length;
    results.invitations.success = inviteResults.success.length;
    results.invitations.failed = inviteResults.failed;
    
    // Store invitation data and collect links
    for (const invite of inviteResults.success) {
      Store.invitations.set(invite.email, {
        status: invite.status,
        invitationLink: invite.invitationLink,
        userId: invite.userId,
        roleDisplayName: invite.roleDisplayName,
      });
      
      if (invite.invitationLink) {
        results.invitations.links.push({
          email: invite.email,
          invitationLink: invite.invitationLink,
          status: invite.status,
        });
      }
    }
  } else {
    log.step('Step 8: Inviting partners...');
    log.info('No partner emails configured (PARTNER_EMAILS). Skipping.');
  }

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
  console.log(`  Collections:      ${results.collections.success}/${results.collections.total} copied`);
  console.log(`  Mock Servers:     ${results.mocks.success}/${results.mocks.total} created`);
  console.log(`  Environments:     ${results.environments.success}/${results.environments.total} copied`);
  console.log(`  Mock Env:         ${results.mockEnvUpdate.success ? 'created' : 'failed'}`);
  console.log(`  Collection Vars:  ${results.collectionVarUpdate.success}/${results.collectionVarUpdate.total} updated`);
  console.log(`  Specs:            ${results.specs.success}/${results.specs.total} copied`);
  console.log(`  Admins:           ${results.admins.success}/${results.admins.total} added`);
  console.log(`  Partners:         ${results.invitations.success}/${results.invitations.total} invited`);
  
  // Show mock URLs
  if (Store.mocks.size > 0) {
    console.log('\n\x1b[1mMock Server URLs:\x1b[0m');
    for (const [, mockData] of Store.mocks) {
      console.log(`  ${mockData.collectionName}: ${mockData.mockUrl}`);
    }
  }
  
  // Show partner invitation links (Run in Postman links)
  if (results.invitations.links.length > 0) {
    console.log('\n\x1b[1mPartner Invitation Links (Run in Postman):\x1b[0m');
    for (const invite of results.invitations.links) {
      console.log(`  \x1b[32m${invite.email}:\x1b[0m`);
      console.log(`    ${invite.invitationLink}`);
    }
  }
  
  // Show partners added without invitation links (already existing)
  const existingPartners = Array.from(Store.invitations.entries())
    .filter(([, data]) => data.status === 'PARTNER_ADDED' && !data.invitationLink);
  
  if (existingPartners.length > 0) {
    console.log('\n\x1b[1mExisting Partners Added:\x1b[0m');
    for (const [email, data] of existingPartners) {
      console.log(`  ${email} (User ID: ${data.userId})`);
    }
  }
  
  // Show failures if any
  const allFailures = [
    ...results.collections.failed.map(f => ({ type: 'Collection', ...f })),
    ...results.mocks.failed.map(f => ({ type: 'Mock', ...f })),
    ...results.environments.failed.map(f => ({ type: 'Environment', ...f })),
    ...results.collectionVarUpdate.failed.map(f => ({ type: 'Collection Var Update', ...f })),
    ...results.specs.failed.map(f => ({ type: 'Spec', ...f })),
    ...results.admins.failed.map(f => ({ type: 'Admin', name: f.userId, error: f.error })),
    ...results.invitations.failed.map(f => ({ type: 'Partner', name: f.email, error: f.error })),
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
  WorkspaceRolesAPI,
  WorkspaceRolesHelper,
  InvitationsAPI,
  InvitationsHelper,
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
  extractHostVariables,
  extractUrlPath,
  toPascalCase,
};

// Run if executed directly
main();
