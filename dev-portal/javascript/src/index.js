// Client
export { HttpClient, PostmanClient } from './client/index.js';

// Services
export { WorkspaceService, ProvisioningService, ResetService } from './services/index.js';

// Helpers
export {
  isPostmanConfigured,
  isPostmanFullyConfigured,
  getConfigurationStatus,
  getApiKey,
  getSourceWorkspaceId,
  getTargetWorkspaceId,
  parseCommaSeparated,
  formatCollectionsForUI,
  formatEnvironmentsForUI,
  formatMocksForUI,
  formatSpecsForUI,
  formatResourcesForUI,
  delay,
} from './helpers/index.js';

// Convenience functions for quick usage
import { PostmanClient } from './client/PostmanClient.js';
import { ProvisioningService } from './services/ProvisioningService.js';
import { ResetService } from './services/ResetService.js';
import { WorkspaceService } from './services/WorkspaceService.js';
import {
  getApiKey,
  getSourceWorkspaceId,
  getTargetWorkspaceId,
  formatCollectionsForUI,
  formatResourcesForUI,
} from './helpers/utils.js';

/**
 * Create a configured PostmanClient from environment
 * @param {Object} [env] - Environment variables
 * @returns {PostmanClient}
 */
export function createClient(env = process.env) {
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
export async function provisionWorkspace(options, onProgress) {
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
export async function provisionCustomWorkspace(options, onProgress) {
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
export async function quickProvision(sourceWorkspaceId, workspaceName, extraOptions = {}, onProgress) {
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
export async function resetWorkspace(workspaceId, onProgress, options) {
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
export async function resetCustomWorkspace(workspaceId, onProgress, options) {
  const client = createClient();
  const service = new ResetService(client);
  return service.resetCustom(workspaceId, onProgress, options);
}

/**
 * Validate API key (convenience function)
 * @returns {Promise<{valid: boolean, user?: Object, error?: string}>}
 */
export async function validateApiKey() {
  const client = createClient();
  return client.validateApiKey();
}

/**
 * Get workspace details (convenience function)
 * @param {string} workspaceId
 * @returns {Promise<Object|null>}
 */
export async function getWorkspace(workspaceId) {
  const client = createClient();
  return client.getWorkspace(workspaceId);
}

/**
 * Get workspace summary with counts (convenience function)
 * @param {string} workspaceId
 * @returns {Promise<Object>}
 */
export async function getWorkspaceSummary(workspaceId) {
  const client = createClient();
  const service = new WorkspaceService(client);
  return service.getWorkspaceSummary(workspaceId);
}

/**
 * Get collections formatted for UI (convenience function)
 * @param {string} workspaceId
 * @returns {Promise<Array>}
 */
export async function getAvailableCollections(workspaceId) {
  const client = createClient();
  const collections = await client.getCollections(workspaceId);
  return formatCollectionsForUI(collections);
}

/**
 * Get all resources formatted for UI (convenience function)
 * @param {string} workspaceId
 * @returns {Promise<Object>}
 */
export async function getAvailableResources(workspaceId) {
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
export async function getWorkspaceRoles(workspaceId) {
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
export async function addWorkspaceAdmin(workspaceId, userId, roleId = '3') {
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
export async function addMultipleAdmins(workspaceId, userIds, onProgress) {
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
export async function removeWorkspaceUser(workspaceId, userId, roleId) {
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
export async function invitePartner(workspaceId, email, roleId = '7') {
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
export async function inviteMultiplePartners(workspaceId, emails, roleId = '7', onProgress) {
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
export async function removePartner(workspaceId, userId) {
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
export async function removeMultiplePartners(workspaceId, userIds, onProgress) {
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
