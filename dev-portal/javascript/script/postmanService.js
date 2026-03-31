import axios from "axios";

// ============================================================================
// ENVIRONMENT CONFIGURATION
// ============================================================================

const POSTMAN_API_KEY = process.env.POSTMAN_API_KEY;
const POSTMAN_TARGET_WORKSPACE_ID = process.env.POSTMAN_TARGET_WORKSPACE_ID;
const POSTMAN_SOURCE_WORKSPACE_ID = process.env.POSTMAN_SOURCE_WORKSPACE_ID;
const POSTMAN_WORKSPACE_NAME = process.env.POSTMAN_WORKSPACE_NAME;
const POSTMAN_ADMIN_USER_IDS = process.env.POSTMAN_ADMIN_USER_IDS;
const PARTNER_EMAILS = process.env.PARTNER_EMAILS;
const PARTNER_ROLE_ID = process.env.PARTNER_ROLE_ID;
const POSTMAN_API_BASE = "https://api.getpostman.com";

const COMMON_HOST_VAR_NAMES = ['baseUrl', 'baseurl', 'base_url', 'HostName', 'hostname', 'host', 'apiUrl', 'apiurl', 'api_url', 'serverUrl', 'serverurl', 'server_url'];

const deriveCompanyName = (workspaceName) => {
  if (!workspaceName) return null;
  const match = workspaceName.match(/<>\s*(.+?)\s*Partner\s*Workspace/i);
  return match ? match[1].trim() : null;
};

const headers = () => ({
  "Content-Type": "application/json",
  "X-Api-Key": POSTMAN_API_KEY || "",
});

const authHeaders = () => ({
  "X-Api-Key": POSTMAN_API_KEY || "",
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function extractError(error) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error?.message || error.message;
  }
  return error instanceof Error ? error.message : "Unknown error";
}

const toPascalCase = (str) => {
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
};

const extractUrlPath = (urlString) => {
  try {
    const url = new URL(urlString);
    return url.pathname === '/' ? '' : url.pathname;
  } catch {
    return '';
  }
};

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

  return collectionVars
    .filter(v => COMMON_HOST_VAR_NAMES.includes(v.key))
    .map(v => ({ varName: v.key, originalUrl: v.value || '', path: '' }));
};

// ============================================================================
// WORKSPACE MANAGEMENT
// ============================================================================

export const getTargetWorkspaceId = () => POSTMAN_TARGET_WORKSPACE_ID;

export const getSourceWorkspaceId = () => POSTMAN_SOURCE_WORKSPACE_ID;

export const getDefaultWorkspaceName = () => {
  return POSTMAN_WORKSPACE_NAME || 'Partner Workspace';
};

export const getAdminUserIds = () => {
  if (!POSTMAN_ADMIN_USER_IDS) return [];
  return POSTMAN_ADMIN_USER_IDS.split(',').map(id => id.trim()).filter(Boolean);
};

export const getPartnerEmails = () => {
  if (!PARTNER_EMAILS) return [];
  return PARTNER_EMAILS.split(',').map(email => email.trim()).filter(Boolean);
};

export const getPartnerRoleId = () => {
  return PARTNER_ROLE_ID || '7';
};

/**
 * Create a new Postman workspace.
 * @param {string} name
 * @param {string} type - 'personal' | 'private' | 'team' | 'public'
 * @param {string} description
 * @returns {Promise<{success: boolean, workspace?: object, error?: string}>}
 */
export const createWorkspace = async (name, type = "team", description = "") => {
  try {
    const response = await axios.post(
      `${POSTMAN_API_BASE}/workspaces`,
      {
        workspace: {
          name,
          type,
          description: description || "Workspace created via automation script",
        },
      },
      { headers: headers() }
    );
    const data = response.data;
    return {
      success: true,
      workspace: {
        id: data.workspace?.id,
        name: data.workspace?.name,
        type: data.workspace?.type,
      },
    };
  } catch (error) {
    return { success: false, error: extractError(error) };
  }
};

/**
 * Get workspace details by ID.
 * @param {string} workspaceId
 * @returns {Promise<object|null>}
 */
export const getWorkspace = async (workspaceId) => {
  try {
    const response = await axios.get(
      `${POSTMAN_API_BASE}/workspaces/${workspaceId}`,
      { headers: authHeaders() }
    );
    return response.data.workspace || null;
  } catch (error) {
    console.error("Error getting workspace:", error);
    return null;
  }
};

/**
 * Update a workspace by ID.
 * @param {string} workspaceId
 * @param {object} updates - Fields to update (e.g. { description })
 * @returns {Promise<{success: boolean, workspace?: object}>}
 */
export const updateWorkspace = async (workspaceId, updates) => {
  try {
    const response = await axios.put(
      `${POSTMAN_API_BASE}/workspaces/${workspaceId}`,
      { workspace: updates },
      { headers: headers() }
    );
    return { success: true, workspace: response.data.workspace };
  } catch (error) {
    console.error("Error updating workspace:", extractError(error));
    return { success: false };
  }
};

/**
 * Delete a workspace by ID.
 * @param {string} workspaceId
 * @returns {Promise<boolean>}
 */
export const deleteWorkspace = async (workspaceId) => {
  try {
    await axios.delete(`${POSTMAN_API_BASE}/workspaces/${workspaceId}`, {
      headers: authHeaders(),
    });
    return true;
  } catch (error) {
    console.error("Error deleting workspace:", error);
    return false;
  }
};

/**
 * Initialize target workspace — use existing or create new.
 * @param {object} options
 * @returns {Promise<{success: boolean, workspaceId?: string, workspace?: object, created: boolean, error?: string}>}
 */
export const initializeTargetWorkspace = async (options = {}) => {
  const { targetWorkspaceId, newWorkspaceName, workspaceType = "team", description = "" } = options;

  if (targetWorkspaceId) {
    const existingWorkspace = await getWorkspace(targetWorkspaceId);
    if (existingWorkspace) {
      return { success: true, workspaceId: targetWorkspaceId, workspace: existingWorkspace, created: false };
    }
    return { success: false, error: `Target workspace with ID "${targetWorkspaceId}" not found or not accessible`, created: false };
  }

  if (!newWorkspaceName) {
    return { success: false, error: "Either targetWorkspaceId or newWorkspaceName must be provided", created: false };
  }

  const createResult = await createWorkspace(newWorkspaceName, workspaceType, description);
  if (createResult.success) {
    return { success: true, workspaceId: createResult.workspace.id, workspace: createResult.workspace, created: true };
  }
  return { success: false, error: createResult.error, created: false };
};

// ============================================================================
// WORKSPACE ROLES MANAGEMENT
// ============================================================================

/**
 * Get all roles assigned in a workspace.
 * @param {string} workspaceId
 * @returns {Promise<{success: boolean, roles?: Array, error?: string}>}
 */
export const getWorkspaceRoles = async (workspaceId) => {
  try {
    const response = await axios.get(
      `${POSTMAN_API_BASE}/workspaces/${workspaceId}/roles`,
      { headers: authHeaders() }
    );
    return { success: true, roles: response.data.roles || [] };
  } catch (error) {
    return { success: false, error: extractError(error), roles: [] };
  }
};

/**
 * Add a workspace admin (team member).
 * @param {string} workspaceId
 * @param {string} userId
 * @param {string} roleId - Default "3" for Admin
 * @returns {Promise<{success: boolean, roles?: Array, error?: string}>}
 */
export const addWorkspaceAdmin = async (workspaceId, userId, roleId = "3") => {
  try {
    const response = await axios.patch(
      `${POSTMAN_API_BASE}/workspaces/${workspaceId}/roles`,
      { roles: [{ op: "add", path: "/user", value: [{ id: userId, role: roleId }] }] },
      { headers: headers() }
    );
    return { success: true, roles: response.data.roles };
  } catch (error) {
    return { success: false, error: extractError(error) };
  }
};

/**
 * Remove a user from workspace.
 * @param {string} workspaceId
 * @param {string} userId
 * @param {string} roleId
 * @returns {Promise<{success: boolean, roles?: Array, error?: string}>}
 */
export const removeWorkspaceUser = async (workspaceId, userId, roleId) => {
  try {
    const response = await axios.patch(
      `${POSTMAN_API_BASE}/workspaces/${workspaceId}/roles`,
      { roles: [{ op: "remove", path: "/user", value: [{ id: userId, role: roleId }] }] },
      { headers: headers() }
    );
    return { success: true, roles: response.data.roles };
  } catch (error) {
    return { success: false, error: extractError(error) };
  }
};

/**
 * Add multiple admins to a workspace.
 * @param {string} workspaceId
 * @param {Array<string>} userIds
 * @param {function} onProgress
 * @returns {Promise<{success: Array, failed: Array}>}
 */
export const addMultipleAdmins = async (workspaceId, userIds, onProgress) => {
  const results = { success: [], failed: [] };

  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i];
    onProgress?.({ phase: "admins", message: `Adding admin: ${userId}`, current: i + 1, total: userIds.length });

    const addResult = await addWorkspaceAdmin(workspaceId, userId, "3");
    if (addResult.success) {
      results.success.push({ userId, roleId: "3" });
    } else {
      results.failed.push({ userId, error: addResult.error });
    }
    await delay(300);
  }

  return results;
};

// ============================================================================
// PARTNER INVITATIONS MANAGEMENT
// ============================================================================

/**
 * Invite a partner to a workspace.
 * @param {string} workspaceId
 * @param {string} email
 * @param {string} roleId - Default "7" for Editor and Partner Lead
 * @returns {Promise<{success: boolean, email: string, status?: string, invitationLink?: string, userId?: number, error?: string}>}
 */
export const invitePartner = async (workspaceId, email, roleId = "7") => {
  try {
    const response = await axios.post(
      `${POSTMAN_API_BASE}/invitations`,
      {
        action: "invite_partner",
        targetEntity: "workspace",
        targetEntityId: workspaceId,
        roleId,
        target: { emails: [email] },
      },
      { headers: headers() }
    );
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
    return { success: false, email, error: extractError(error) };
  }
};

/**
 * Remove a partner from a workspace.
 * @param {string} workspaceId
 * @param {string} userId
 * @returns {Promise<{success: boolean, userId: string, status?: string, error?: string}>}
 */
export const removePartner = async (workspaceId, userId) => {
  try {
    const response = await axios.post(
      `${POSTMAN_API_BASE}/invitations`,
      {
        action: "remove_partner",
        targetEntity: "workspace",
        targetEntityId: workspaceId,
        target: { userIds: [userId] },
      },
      { headers: headers() }
    );
    const result = response.data.results?.[0] || {};
    return { success: true, userId: result.userId || userId, status: result.status };
  } catch (error) {
    return { success: false, userId, error: extractError(error) };
  }
};

/**
 * Remove a partner from the entire team.
 * @param {string} teamId
 * @param {string} userId
 * @returns {Promise<{success: boolean, userId: string, status?: string, error?: string}>}
 */
export const removePartnerFromTeam = async (teamId, userId) => {
  try {
    const response = await axios.post(
      `${POSTMAN_API_BASE}/invitations`,
      {
        action: "remove_partner",
        targetEntity: "team",
        targetEntityId: teamId,
        target: { userIds: [userId] },
      },
      { headers: headers() }
    );
    const result = response.data.results?.[0] || {};
    return { success: true, userId: result.userId || userId, status: result.status };
  } catch (error) {
    return { success: false, userId, error: extractError(error) };
  }
};

/**
 * Invite multiple partners to a workspace.
 * @param {string} workspaceId
 * @param {Array<string>} emails
 * @param {string} roleId
 * @param {function} onProgress
 * @returns {Promise<{success: Array, failed: Array}>}
 */
export const inviteMultiplePartners = async (workspaceId, emails, roleId = "7", onProgress) => {
  const results = { success: [], failed: [] };

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    onProgress?.({ phase: "invitations", message: `Inviting partner: ${email}`, current: i + 1, total: emails.length });

    const inviteResult = await invitePartner(workspaceId, email, roleId);
    if (inviteResult.success) {
      results.success.push({
        email: inviteResult.email,
        status: inviteResult.status,
        invitationLink: inviteResult.invitationLink,
        userId: inviteResult.userId,
        roleDisplayName: inviteResult.roleDisplayName,
      });
    } else {
      results.failed.push({ email, error: inviteResult.error });
    }
    await delay(300);
  }

  return results;
};

/**
 * Remove multiple partners from a workspace.
 * @param {string} workspaceId
 * @param {Array<string>} userIds
 * @param {function} onProgress
 * @returns {Promise<{success: Array, failed: Array}>}
 */
export const removeMultiplePartners = async (workspaceId, userIds, onProgress) => {
  const results = { success: [], failed: [] };

  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i];
    onProgress?.({ phase: "removePartners", message: `Removing partner: ${userId}`, current: i + 1, total: userIds.length });

    const removeResult = await removePartner(workspaceId, userId);
    if (removeResult.success) {
      results.success.push({ userId: removeResult.userId, status: removeResult.status });
    } else {
      results.failed.push({ userId, error: removeResult.error });
    }
    await delay(300);
  }

  return results;
};

// ============================================================================
// SPEC MANAGEMENT
// ============================================================================

/**
 * Get all specs from a workspace.
 * @param {string} workspaceId
 * @returns {Promise<Array>}
 */
export const getAllSpecs = async (workspaceId) => {
  try {
    const response = await axios.get(`${POSTMAN_API_BASE}/specs?workspaceId=${workspaceId}`, { headers: authHeaders() });
    return response.data.specs || [];
  } catch (error) {
    console.error("Error getting specs:", error);
    return [];
  }
};

/**
 * Get spec details.
 * @param {string} specId
 * @returns {Promise<object|null>}
 */
export const getSpecDetails = async (specId) => {
  try {
    const response = await axios.get(`${POSTMAN_API_BASE}/specs/${specId}`, { headers: authHeaders() });
    return response.data || null;
  } catch (error) {
    console.error("Error getting spec details:", error);
    return null;
  }
};

/**
 * Get all files in a spec.
 * @param {string} specId
 * @returns {Promise<Array>}
 */
export const getSpecFiles = async (specId) => {
  try {
    const response = await axios.get(`${POSTMAN_API_BASE}/specs/${specId}/files`, { headers: authHeaders() });
    return response.data.files || [];
  } catch (error) {
    console.error("Error getting spec files:", error);
    return [];
  }
};

/**
 * Get a specific spec file's content.
 * @param {string} specId
 * @param {string} filePath
 * @returns {Promise<object|null>}
 */
export const getSpecFile = async (specId, filePath) => {
  try {
    const encodedPath = encodeURIComponent(filePath);
    const response = await axios.get(`${POSTMAN_API_BASE}/specs/${specId}/files/${encodedPath}`, { headers: authHeaders() });
    return response.data || null;
  } catch (error) {
    console.error(`Error getting spec file ${filePath}:`, error);
    return null;
  }
};

/**
 * Create a new spec in a workspace with files.
 * @param {string} workspaceId
 * @param {string} name
 * @param {string} type - e.g. "OPENAPI:3.0", "OPENAPI:3.1", "ASYNCAPI:2.0"
 * @param {Array} files - Array of {path, content, type}
 * @returns {Promise<{success: boolean, spec?: object, error?: string}>}
 */
export const createSpec = async (workspaceId, name, type, files) => {
  try {
    const response = await axios.post(
      `${POSTMAN_API_BASE}/specs?workspaceId=${workspaceId}`,
      { name, type, files },
      { headers: headers() }
    );
    return { success: true, spec: response.data };
  } catch (error) {
    return { success: false, error: extractError(error) };
  }
};

/**
 * Create a file in a spec.
 * @param {string} specId
 * @param {string} path
 * @param {string} content
 * @returns {Promise<{success: boolean, file?: object, error?: string}>}
 */
export const createSpecFile = async (specId, path, content) => {
  try {
    const response = await axios.post(
      `${POSTMAN_API_BASE}/specs/${specId}/files`,
      { path, content },
      { headers: headers() }
    );
    return { success: true, file: response.data };
  } catch (error) {
    return { success: false, error: extractError(error) };
  }
};

/**
 * Update a spec file's type (e.g., set as ROOT).
 * @param {string} specId
 * @param {string} filePath
 * @param {string} type - 'ROOT' | 'DEFAULT'
 * @returns {Promise<{success: boolean, file?: object, error?: string}>}
 */
export const updateSpecFileType = async (specId, filePath, type) => {
  try {
    const encodedPath = encodeURIComponent(filePath);
    const response = await axios.patch(
      `${POSTMAN_API_BASE}/specs/${specId}/files/${encodedPath}`,
      { type },
      { headers: headers() }
    );
    return { success: true, file: response.data };
  } catch (error) {
    return { success: false, error: extractError(error) };
  }
};

/**
 * Delete a spec.
 * @param {string} specId
 * @returns {Promise<boolean>}
 */
export const deleteSpec = async (specId) => {
  try {
    await axios.delete(`${POSTMAN_API_BASE}/specs/${specId}`, { headers: authHeaders() });
    return true;
  } catch (error) {
    console.error("Error deleting spec:", error);
    return false;
  }
};

/**
 * Copy a single spec with all its files from source to target workspace.
 * @param {string} sourceSpecId
 * @param {string} sourceSpecName
 * @param {string} sourceSpecType
 * @param {string} targetWorkspaceId
 * @param {function} onProgress
 * @returns {Promise<object>}
 */
export const copySpec = async (sourceSpecId, sourceSpecName, sourceSpecType, targetWorkspaceId, onProgress) => {
  const result = { success: false, specName: sourceSpecName, newSpecId: null, filesCopied: 0, totalFiles: 0, errors: [] };

  try {
    onProgress?.({ step: "files", message: `Getting files for: ${sourceSpecName}` });
    const sourceFiles = await getSpecFiles(sourceSpecId);
    result.totalFiles = sourceFiles.length;

    if (sourceFiles.length === 0) {
      result.errors.push("No files found in source spec");
      return result;
    }

    onProgress?.({ step: "content", message: `Fetching ${sourceFiles.length} file(s) content...` });
    const filesWithContent = [];

    for (const file of sourceFiles) {
      onProgress?.({ step: "fetchingFile", message: `Fetching: ${file.path}`, current: filesWithContent.length + 1, total: sourceFiles.length });
      const fileContent = await getSpecFile(sourceSpecId, file.path);
      if (fileContent?.content) {
        filesWithContent.push({ path: file.path, content: fileContent.content, type: file.type });
      } else {
        result.errors.push(`Failed to get content for file: ${file.path}`);
      }
      await delay(200);
    }

    if (filesWithContent.length === 0) {
      result.errors.push("Could not retrieve any file contents");
      return result;
    }

    onProgress?.({ step: "create", message: `Creating spec with ${filesWithContent.length} file(s)...` });
    const createResult = await createSpec(targetWorkspaceId, sourceSpecName, sourceSpecType, filesWithContent);

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
};

/**
 * Copy all specs from source workspace to target workspace.
 * @param {string} sourceWorkspaceId
 * @param {string} targetWorkspaceId
 * @param {function} onProgress
 * @returns {Promise<{copied: Array, errors: Array}>}
 */
export const copySpecs = async (sourceWorkspaceId, targetWorkspaceId, onProgress) => {
  const results = { copied: [], errors: [] };
  const sourceSpecs = await getAllSpecs(sourceWorkspaceId);

  if (sourceSpecs.length === 0) {
    onProgress?.({ phase: "specs", message: "No specs found in source workspace", progress: 100 });
    return results;
  }

  for (let i = 0; i < sourceSpecs.length; i++) {
    const spec = sourceSpecs[i];
    onProgress?.({ phase: "specs", message: `Copying spec: ${spec.name} (${spec.type})`, currentItem: spec.name, current: i + 1, total: sourceSpecs.length, progress: Math.round((i / sourceSpecs.length) * 100) });

    const copyResult = await copySpec(spec.id, spec.name, spec.type, targetWorkspaceId);
    if (copyResult.success) {
      results.copied.push({ originalSpecId: spec.id, newSpecId: copyResult.newSpecId, name: spec.name, type: spec.type, filesCopied: copyResult.filesCopied });
    } else {
      results.errors.push({ specName: spec.name, error: copyResult.errors.join("; ") });
    }
    await delay(500);
  }

  return results;
};

// ============================================================================
// COLLECTIONS MANAGEMENT
// ============================================================================

/**
 * Get collections from source workspace.
 * @returns {Promise<Array>}
 */
export const getSourceCollections = async () => {
  try {
    const response = await axios.get(`${POSTMAN_API_BASE}/collections?workspace=${POSTMAN_SOURCE_WORKSPACE_ID}`, { headers: authHeaders() });
    return response.data.collections || [];
  } catch (error) {
    console.error("Error getting source collections:", error);
    return [];
  }
};

/**
 * Fork a collection from source to target workspace.
 * @param {string} collectionId
 * @param {string} collectionName
 * @param {string} workspaceId
 * @returns {Promise<{success: boolean, collectionName: string, collectionId?: string, uid?: string, error?: string}>}
 */
export const forkCollection = async (collectionId, collectionName, workspaceId) => {
  try {
    const response = await axios.post(
      `${POSTMAN_API_BASE}/collections/fork/${collectionId}?workspace=${workspaceId}`,
      { label: collectionName },
      { headers: headers() }
    );
    const data = response.data;
    return { success: true, collectionName: data.collection?.name || collectionName, collectionId: data.collection?.id, uid: data.collection?.uid };
  } catch (error) {
    return { success: false, collectionName, error: extractError(error) };
  }
};

/**
 * Get full collection details.
 * @param {string} collectionUid
 * @returns {Promise<object|null>}
 */
export const getCollectionDetails = async (collectionUid) => {
  try {
    const response = await axios.get(`${POSTMAN_API_BASE}/collections/${collectionUid}`, { headers: authHeaders() });
    return response.data.collection || null;
  } catch (error) {
    console.error("Error getting collection details:", error);
    return null;
  }
};

/**
 * Create a collection in Postman.
 * @param {object} collectionData
 * @param {string} workspaceId
 * @returns {Promise<{success: boolean, collectionName: string, collectionId?: string, uid?: string, error?: string}>}
 */
export const createCollectionInPostman = async (collectionData, workspaceId) => {
  try {
    const response = await axios.post(
      `${POSTMAN_API_BASE}/collections?workspace=${workspaceId}`,
      { collection: collectionData },
      { headers: headers() }
    );
    const data = response.data;
    return { success: true, collectionName: collectionData.info?.name || "Unknown", collectionId: data.collection?.id, uid: data.collection?.uid };
  } catch (error) {
    return { success: false, collectionName: collectionData.info?.name || "Unknown", error: extractError(error) };
  }
};

/**
 * Create multiple collections with progress callback.
 * @param {Array} collections
 * @param {string} workspaceId
 * @param {function} onProgress
 * @returns {Promise<Array>}
 */
export const createMultipleCollections = async (collections, workspaceId, onProgress) => {
  const results = [];

  for (let i = 0; i < collections.length; i++) {
    const collection = collections[i];
    const result = await createCollectionInPostman(collection, workspaceId);
    results.push(result);
    onProgress?.({ current: i + 1, total: collections.length, currentItem: collection.info?.name || "Unknown", result });
    await delay(500);
  }

  return results;
};

/**
 * Get all collections in workspace.
 * @param {string} workspaceId
 * @returns {Promise<Array>}
 */
export const getAllCollections = async (workspaceId) => {
  try {
    const response = await axios.get(`${POSTMAN_API_BASE}/collections?workspace=${workspaceId}`, { headers: authHeaders() });
    return response.data.collections || [];
  } catch (error) {
    console.error("Error getting collections:", error);
    return [];
  }
};

/**
 * Delete a collection.
 * @param {string} collectionId
 * @returns {Promise<boolean>}
 */
export const deleteCollection = async (collectionId) => {
  try {
    await axios.delete(`${POSTMAN_API_BASE}/collections/${collectionId}`, { headers: authHeaders() });
    return true;
  } catch (error) {
    console.error("Error deleting collection:", error);
    return false;
  }
};

/**
 * Patch collection variables (partial update).
 * @param {string} collectionUid
 * @param {Array} variables
 * @returns {Promise<{success: boolean, collection?: object, error?: string}>}
 */
export const patchCollectionVariables = async (collectionUid, variables) => {
  try {
    const response = await axios.patch(
      `${POSTMAN_API_BASE}/collections/${collectionUid}`,
      { collection: { variable: variables } },
      { headers: headers() }
    );
    return { success: true, collection: response.data.collection };
  } catch (error) {
    return { success: false, error: extractError(error) };
  }
};

// ============================================================================
// ENVIRONMENT MANAGEMENT
// ============================================================================

/**
 * Create environment in Postman.
 * @param {string} environmentName
 * @param {Array} variables
 * @param {string} workspaceId
 * @returns {Promise<{success: boolean, environmentName: string, environmentId?: string, uid?: string, error?: string}>}
 */
export const createEnvironmentInPostman = async (environmentName, variables, workspaceId) => {
  try {
    const response = await axios.post(
      `${POSTMAN_API_BASE}/environments?workspace=${workspaceId}`,
      {
        environment: {
          name: environmentName,
          values: variables.map((v) => ({
            key: v.key,
            value: String(v.value),
            enabled: v.enabled !== false,
            type: v.type || "default",
            description: v.description || "",
          })),
        },
      },
      { headers: headers() }
    );
    const data = response.data;
    return { success: true, environmentName, environmentId: data.environment?.id, uid: data.environment?.uid };
  } catch (error) {
    return { success: false, environmentName, error: extractError(error) };
  }
};

/**
 * Get all environments in workspace.
 * @param {string} workspaceId
 * @returns {Promise<Array>}
 */
export const getAllEnvironments = async (workspaceId) => {
  try {
    const response = await axios.get(`${POSTMAN_API_BASE}/environments?workspace=${workspaceId}`, { headers: authHeaders() });
    return response.data.environments || [];
  } catch (error) {
    console.error("Error getting environments:", error);
    return [];
  }
};

/**
 * Get environment details.
 * @param {string} environmentUid
 * @returns {Promise<object|null>}
 */
export const getEnvironmentDetails = async (environmentUid) => {
  try {
    const response = await axios.get(`${POSTMAN_API_BASE}/environments/${environmentUid}`, { headers: authHeaders() });
    return response.data.environment || null;
  } catch (error) {
    console.error("Error getting environment details:", error);
    return null;
  }
};

/**
 * Update environment.
 * @param {string} environmentUid
 * @param {string} name
 * @param {Array} variables
 * @returns {Promise<{success: boolean, environment?: object, error?: string}>}
 */
export const updateEnvironment = async (environmentUid, name, variables) => {
  try {
    const response = await axios.put(
      `${POSTMAN_API_BASE}/environments/${environmentUid}`,
      {
        environment: {
          name,
          values: variables.map((v) => ({
            key: v.key,
            value: String(v.value),
            enabled: v.enabled !== false,
            type: v.type || "default",
          })),
        },
      },
      { headers: headers() }
    );
    return { success: true, environment: response.data.environment };
  } catch (error) {
    return { success: false, error: extractError(error) };
  }
};

/**
 * Delete an environment.
 * @param {string} environmentId
 * @returns {Promise<boolean>}
 */
export const deleteEnvironment = async (environmentId) => {
  try {
    await axios.delete(`${POSTMAN_API_BASE}/environments/${environmentId}`, { headers: authHeaders() });
    return true;
  } catch (error) {
    console.error("Error deleting environment:", error);
    return false;
  }
};

// ============================================================================
// MOCK SERVER MANAGEMENT
// ============================================================================

/**
 * Get all mock servers in workspace.
 * @param {string} workspaceId
 * @returns {Promise<Array>}
 */
export const getAllMocks = async (workspaceId) => {
  try {
    const response = await axios.get(`${POSTMAN_API_BASE}/mocks?workspace=${workspaceId}`, { headers: authHeaders() });
    return response.data.mocks || [];
  } catch (error) {
    console.error("Error getting mocks:", error);
    return [];
  }
};

/**
 * Delete a mock server. Use mock.id (not mock.uid) for deletion.
 * @param {string} mockId
 * @returns {Promise<boolean>}
 */
export const deleteMock = async (mockId) => {
  try {
    await axios.delete(`${POSTMAN_API_BASE}/mocks/${mockId}`, { headers: authHeaders() });
    return true;
  } catch (error) {
    console.error("Error deleting mock:", error);
    return false;
  }
};

/**
 * Create mock server in Postman.
 * @param {string} mockName
 * @param {string} collectionUid
 * @param {string} workspaceId
 * @param {string|null} environmentUid
 * @returns {Promise<{success: boolean, mockName: string, mockId?: string, mockUrl?: string, uid?: string, error?: string}>}
 */
export const createMockServer = async (mockName, collectionUid, workspaceId, environmentUid) => {
  try {
    const response = await axios.post(
      `${POSTMAN_API_BASE}/mocks?workspace=${workspaceId}`,
      { mock: { name: mockName, collection: collectionUid, environment: environmentUid, private: false } },
      { headers: headers() }
    );
    const data = response.data;
    return { success: true, mockName, mockId: data.mock?.id, mockUrl: data.mock?.mockUrl, uid: data.mock?.uid };
  } catch (error) {
    return { success: false, mockName, error: extractError(error) };
  }
};

// ============================================================================
// RESET OPERATIONS
// ============================================================================

/**
 * Reset workspace — delete all resources in reverse order of provisioning.
 * Deletion order: Specs -> Mocks -> Environments -> Collections
 * @param {string} workspaceId
 * @param {function} onProgress
 * @param {object} options
 * @returns {Promise<object>}
 */
export const resetWorkspace = async (workspaceId, onProgress, options = {}) => {
  const { includeSpecs = true, includeMocks = true, includeEnvironments = true, includeCollections = true } = options;

  const result = {
    deletedSpecs: 0, deletedMocks: 0, deletedEnvironments: 0, deletedCollections: 0,
    totalSpecs: 0, totalMocks: 0, totalEnvironments: 0, totalCollections: 0,
    errors: [],
  };

  try {
    if (includeSpecs) {
      const specs = await getAllSpecs(workspaceId);
      result.totalSpecs = specs.length;
      onProgress?.({ phase: "specs", message: `Deleting ${specs.length} spec(s)...`, deleted: 0, total: specs.length });
      for (const spec of specs) {
        if (await deleteSpec(spec.id)) { result.deletedSpecs++; } else { result.errors.push(`Failed to delete spec: ${spec.name}`); }
        onProgress?.({ phase: "specs", deleted: result.deletedSpecs, total: specs.length, currentItem: spec.name });
        await delay(300);
      }
    }

    if (includeMocks) {
      const mocks = await getAllMocks(workspaceId);
      result.totalMocks = mocks.length;
      onProgress?.({ phase: "mocks", message: `Deleting ${mocks.length} mock server(s)...`, deleted: 0, total: mocks.length });
      for (const mock of mocks) {
        if (await deleteMock(mock.id)) { result.deletedMocks++; } else { result.errors.push(`Failed to delete mock: ${mock.name}`); }
        onProgress?.({ phase: "mocks", deleted: result.deletedMocks, total: mocks.length, currentItem: mock.name });
        await delay(300);
      }
    }

    if (includeEnvironments) {
      const environments = await getAllEnvironments(workspaceId);
      result.totalEnvironments = environments.length;
      onProgress?.({ phase: "environments", message: `Deleting ${environments.length} environment(s)...`, deleted: 0, total: environments.length });
      for (const environment of environments) {
        if (await deleteEnvironment(environment.uid)) { result.deletedEnvironments++; } else { result.errors.push(`Failed to delete environment: ${environment.name}`); }
        onProgress?.({ phase: "environments", deleted: result.deletedEnvironments, total: environments.length, currentItem: environment.name });
        await delay(300);
      }
    }

    if (includeCollections) {
      const collections = await getAllCollections(workspaceId);
      result.totalCollections = collections.length;
      onProgress?.({ phase: "collections", message: `Deleting ${collections.length} collection(s)...`, deleted: 0, total: collections.length });
      for (const collection of collections) {
        if (await deleteCollection(collection.uid)) { result.deletedCollections++; } else { result.errors.push(`Failed to delete collection: ${collection.name}`); }
        onProgress?.({ phase: "collections", deleted: result.deletedCollections, total: collections.length, currentItem: collection.name });
        await delay(300);
      }
    }

    // Clear workspace description
    try {
      await updateWorkspace(workspaceId, { description: "" });
    } catch (e) {
      console.warn("Failed to clear workspace description:", e.message);
    }

    onProgress?.({ phase: "complete", message: "Reset complete", result });
    return result;
  } catch (error) {
    result.errors.push(`Unexpected error: ${error.message}`);
    onProgress?.({ phase: "error", message: error.message, result });
    throw error;
  }
};

// ============================================================================
// PROVISIONING OPERATIONS
// ============================================================================

/**
 * Full workspace provisioning — copies all assets and manages team/partners.
 * @param {object} options
 * @param {function} onProgress
 * @returns {Promise<object>}
 */
export const provisionWorkspace = async (options, onProgress) => {
  const {
    sourceWorkspaceId, targetWorkspaceId,
    workspaceName = "Partner Workspace", workspaceType = "partner",
    adminUserIds = [], partnerEmails = [], partnerRoleId = "7",
  } = options;

  if (!POSTMAN_API_KEY) throw new Error("Postman API key not configured");
  if (!sourceWorkspaceId) throw new Error("Source workspace ID is required");

  const results = {
    workspace: null, workspaceCreated: false,
    collections: { total: 0, success: 0, failed: [], successData: [] },
    mocks: { total: 0, success: 0, failed: [], urls: [] },
    environments: { total: 0, success: 0, failed: [], successData: [] },
    mockEnv: { success: false, action: null },
    specs: { total: 0, success: 0, failed: [], successData: [] },
    admins: { total: 0, success: 0, failed: [], successData: [] },
    invitations: { total: 0, success: 0, failed: [], links: [] },
    errors: [],
  };

  try {
    onProgress?.({ phase: "validation", message: "Validating API key...", progress: 5 });
    const validation = await validateApiKey();
    if (!validation.valid) throw new Error(`Invalid API key: ${validation.error}`);

    const sourceWorkspace = await getWorkspace(sourceWorkspaceId);
    if (!sourceWorkspace) throw new Error(`Source workspace not found: ${sourceWorkspaceId}`);

    onProgress?.({ phase: "workspace", message: targetWorkspaceId ? "Using existing workspace..." : "Creating new workspace...", progress: 10 });
    let workspaceId = targetWorkspaceId;

    if (targetWorkspaceId) {
      const existingWorkspace = await getWorkspace(targetWorkspaceId);
      if (!existingWorkspace) throw new Error(`Target workspace not found: ${targetWorkspaceId}`);
      results.workspace = existingWorkspace;
      results.workspaceCreated = false;
    } else {
      if (!workspaceName) throw new Error("Workspace name is required when creating a new workspace");
      const createResult = await createWorkspace(workspaceName, workspaceType);
      if (!createResult.success) throw new Error(`Failed to create workspace: ${createResult.error}`);
      workspaceId = createResult.workspace.id;
      results.workspace = createResult.workspace;
      results.workspaceCreated = true;
    }

    // Copy workspace description from source
    try {
      const sourceDescription = sourceWorkspace.description;
      if (sourceDescription) {
        let finalDescription = sourceDescription;
        const companyName = deriveCompanyName(workspaceName || results.workspace?.name);
        if (companyName) {
          finalDescription = sourceDescription.replace(/<Company>/g, companyName);
          console.log(`Replaced <Company> placeholder with "${companyName}"`);
        } else {
          console.warn("Could not derive company name from target workspace name — copying description as-is");
        }
        const updateResult = await updateWorkspace(workspaceId, { description: finalDescription });
        if (updateResult.success) {
          console.log("Workspace description updated successfully");
        } else {
          console.warn("Failed to update workspace description — continuing provisioning");
        }
      } else {
        console.warn("Source workspace has no description — skipping description copy");
      }
    } catch (descError) {
      console.warn(`Unexpected error copying workspace description: ${descError.message} — continuing provisioning`);
    }

    // Step 2: Copy Collections
    onProgress?.({ phase: "collections", message: "Copying collections...", progress: 20 });
    const sourceCollections = await getAllCollections(sourceWorkspaceId);
    results.collections.total = sourceCollections.length;
    const collectionMap = new Map();

    for (let i = 0; i < sourceCollections.length; i++) {
      const collection = sourceCollections[i];
      onProgress?.({ phase: "collections", message: `Forking: ${collection.name}`, current: i + 1, total: sourceCollections.length, progress: 20 + (i / sourceCollections.length) * 15 });
      const forkResult = await forkCollection(collection.uid, collection.name, workspaceId);
      if (forkResult.success) {
        results.collections.success++;
        const collDetails = await getCollectionDetails(forkResult.uid);
        let hostVariables = [];
        if (collDetails) {
          hostVariables = extractHostVariables(collDetails);
        }
        results.collections.successData.push({ name: forkResult.collectionName, uid: forkResult.uid, hostVariables, collectionDetails: collDetails });
        collectionMap.set(collection.uid, forkResult.uid);
      } else {
        results.collections.failed.push({ name: collection.name, error: forkResult.error });
        results.errors.push(`Failed to fork ${collection.name}: ${forkResult.error}`);
      }
      await delay(300);
    }

    // Step 3: Create Mock Servers
    onProgress?.({ phase: "mocks", message: "Creating mock servers...", progress: 40 });
    results.mocks.total = results.collections.successData.length;
    for (let i = 0; i < results.collections.successData.length; i++) {
      const collection = results.collections.successData[i];
      const mockName = `${collection.name} Mock`;
      onProgress?.({ phase: "mocks", message: `Creating: ${mockName}`, current: i + 1, total: results.collections.successData.length, progress: 40 + (i / results.collections.successData.length) * 15 });
      const mockResult = await createMockServer(mockName, collection.uid, workspaceId, null);
      if (mockResult.success) {
        results.mocks.success++;
        results.mocks.urls.push({ collectionName: collection.name, mockName: mockResult.mockName, mockUrl: mockResult.mockUrl, targetUid: collection.uid, hostVariables: collection.hostVariables });
      } else {
        results.mocks.failed.push({ name: mockName, error: mockResult.error });
        results.errors.push(`Failed to create mock ${mockName}: ${mockResult.error}`);
      }
      await delay(300);
    }

    // Step 4: Copy Environments
    onProgress?.({ phase: "environments", message: "Copying environments...", progress: 60 });
    const sourceEnvironments = await getAllEnvironments(sourceWorkspaceId);
    results.environments.total = sourceEnvironments.length;
    const envMap = new Map();

    for (let i = 0; i < sourceEnvironments.length; i++) {
      const env = sourceEnvironments[i];
      onProgress?.({ phase: "environments", message: `Copying: ${env.name}`, current: i + 1, total: sourceEnvironments.length, progress: 60 + (i / sourceEnvironments.length) * 10 });
      const envDetails = await getEnvironmentDetails(env.uid);
      if (!envDetails) { results.environments.failed.push({ name: env.name, error: "Could not get environment details" }); continue; }
      const createResult = await createEnvironmentInPostman(envDetails.name, envDetails.values || [], workspaceId);
      if (createResult.success) {
        results.environments.success++;
        results.environments.successData.push({ name: createResult.environmentName, uid: createResult.uid });
        envMap.set(env.uid, { targetUid: createResult.uid, name: envDetails.name });
      } else {
        results.environments.failed.push({ name: envDetails.name, error: createResult.error });
        results.errors.push(`Failed to copy ${envDetails.name}: ${createResult.error}`);
      }
      await delay(300);
    }

    // Step 5: Create fresh Mock Env
    onProgress?.({ phase: "mockEnv", message: "Creating Mock Environment...", progress: 75 });
    const mockEnvVarMap = new Map();
    if (results.mocks.urls.length > 0) {
      const toCamelCase = (name) => {
        return name.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/)
          .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join('');
      };

      const mockVariables = [];
      for (const mock of results.mocks.urls) {
        const hostVars = mock.hostVariables || [];
        if (hostVars.length === 0) {
          const varName = toCamelCase(mock.collectionName) + 'BaseUrl';
          mockVariables.push({ key: varName, value: mock.mockUrl, type: 'default', enabled: true });
          mockEnvVarMap.set(`${mock.targetUid}:__fallback__`, varName);
        } else {
          for (const hv of hostVars) {
            const envVarName = toCamelCase(mock.collectionName) + toPascalCase(hv.varName);
            mockVariables.push({ key: envVarName, value: mock.mockUrl, type: 'default', enabled: true });
            mockEnvVarMap.set(`${mock.targetUid}:${hv.varName}`, envVarName);
          }
        }
      }

      const createResult = await createEnvironmentInPostman("Mock Env", mockVariables, workspaceId);
      if (createResult.success) { results.mockEnv = { success: true, action: "created" }; }
      else { results.errors.push(`Failed to create Mock Env: ${createResult.error}`); }
    }

    // Step 5b: Update collection variables to reference mock env
    if (mockEnvVarMap.size > 0) {
      onProgress?.({ phase: "collectionVars", message: "Updating collection variables...", progress: 78 });
      for (const coll of results.collections.successData) {
        if (!coll.collectionDetails) continue;
        const existingVars = coll.collectionDetails.variable || [];
        const hostVars = coll.hostVariables || [];

        if (hostVars.length > 0) {
          const updatedVars = existingVars.map(v => {
            const hv = hostVars.find(h => h.varName === v.key);
            if (hv) {
              const envName = mockEnvVarMap.get(`${coll.uid}:${hv.varName}`);
              if (envName) return { ...v, value: `{{${envName}}}` };
            }
            return v;
          });
          for (const hv of hostVars) {
            const envName = mockEnvVarMap.get(`${coll.uid}:${hv.varName}`);
            if (envName && !updatedVars.some(v => v.key === hv.varName)) {
              updatedVars.push({ key: hv.varName, value: `{{${envName}}}`, type: 'string' });
            }
          }
          await patchCollectionVariables(coll.uid, updatedVars);
        } else {
          const fallbackEnvVarName = mockEnvVarMap.get(`${coll.uid}:__fallback__`);
          if (!fallbackEnvVarName) continue;
          const matchedVar = existingVars.find(v => COMMON_HOST_VAR_NAMES.includes(v.key));
          const updatedVars = matchedVar
            ? existingVars.map(v =>
                v.key === matchedVar.key ? { ...v, value: `{{${fallbackEnvVarName}}}` } : v
              )
            : [...existingVars, { key: 'baseUrl', value: `{{${fallbackEnvVarName}}}`, type: 'string' }];
          await patchCollectionVariables(coll.uid, updatedVars);
        }
        await delay(300);
      }
    }

    // Step 6: Copy Specs
    onProgress?.({ phase: "specs", message: "Copying specs...", progress: 80 });
    const sourceSpecs = await getAllSpecs(sourceWorkspaceId);
    results.specs.total = sourceSpecs.length;
    for (let i = 0; i < sourceSpecs.length; i++) {
      const spec = sourceSpecs[i];
      onProgress?.({ phase: "specs", message: `Copying: ${spec.name}`, current: i + 1, total: sourceSpecs.length, progress: 80 + (i / sourceSpecs.length) * 15 });
      const copyResult = await copySpec(spec.id, spec.name, spec.type, workspaceId);
      if (copyResult.success) {
        results.specs.success++;
        results.specs.successData.push({ name: copyResult.specName, id: copyResult.newSpecId, filesCopied: copyResult.filesCopied });
      } else {
        results.specs.failed.push({ name: spec.name, error: copyResult.errors.join("; ") });
        results.errors.push(`Failed to copy spec ${spec.name}`);
      }
      await delay(500);
    }

    // Step 7: Add Team Admins
    if (adminUserIds.length > 0) {
      onProgress?.({ phase: "admins", message: "Adding workspace admins...", progress: 88 });
      results.admins.total = adminUserIds.length;
      for (let i = 0; i < adminUserIds.length; i++) {
        const userId = adminUserIds[i];
        onProgress?.({ phase: "admins", message: `Adding admin: ${userId}`, current: i + 1, total: adminUserIds.length, progress: 88 + (i / adminUserIds.length) * 5 });
        const addResult = await addWorkspaceAdmin(workspaceId, userId, "3");
        if (addResult.success) { results.admins.success++; results.admins.successData.push({ userId, roleId: "3" }); }
        else { results.admins.failed.push({ userId, error: addResult.error }); results.errors.push(`Failed to add admin ${userId}: ${addResult.error}`); }
        await delay(300);
      }
    }

    // Step 8: Invite Partners
    if (partnerEmails.length > 0) {
      onProgress?.({ phase: "invitations", message: "Inviting partners...", progress: 93 });
      results.invitations.total = partnerEmails.length;
      for (let i = 0; i < partnerEmails.length; i++) {
        const email = partnerEmails[i];
        onProgress?.({ phase: "invitations", message: `Inviting partner: ${email}`, current: i + 1, total: partnerEmails.length, progress: 93 + (i / partnerEmails.length) * 6 });
        const inviteResult = await invitePartner(workspaceId, email, partnerRoleId);
        if (inviteResult.success) {
          results.invitations.success++;
          if (inviteResult.invitationLink) { results.invitations.links.push({ email: inviteResult.email, invitationLink: inviteResult.invitationLink, status: inviteResult.status }); }
        } else {
          results.invitations.failed.push({ email, error: inviteResult.error });
          results.errors.push(`Failed to invite partner ${email}: ${inviteResult.error}`);
        }
        await delay(300);
      }
    }

    onProgress?.({ phase: "complete", message: "Provisioning complete!", progress: 100, results });
    return results;
  } catch (error) {
    results.errors.push(error.message);
    onProgress?.({ phase: "error", message: `Error: ${error.message}`, progress: 0, results });
    throw error;
  }
};

/**
 * Simplified provisioning — creates a new workspace and copies all content.
 * @param {string} sourceWorkspaceId
 * @param {string} workspaceName
 * @param {object} options
 * @param {function} onProgress
 * @returns {Promise<object>}
 */
export const quickProvision = async (sourceWorkspaceId, workspaceName, options = {}, onProgress) => {
  return provisionWorkspace({ sourceWorkspaceId, workspaceName, workspaceType: options.workspaceType || "partner", ...options }, onProgress);
};

// ============================================================================
// UPDATE OPERATIONS
// ============================================================================

/**
 * Update a target workspace by detecting and adding net-new assets from source.
 * Detects new collections (fork check + name fallback), specs (name match),
 * and environments (name match, excluding "Mock Env"). Forks new collections,
 * creates mock servers, updates Mock Env in-place with dedup, updates collection
 * variables, and copies new specs and environments.
 *
 * @param {object} options - { sourceWorkspaceId, targetWorkspaceId, onProgress }
 * @returns {Promise<object>} Update results
 */
export const updateWorkspaceAssets = async ({ sourceWorkspaceId, targetWorkspaceId, onProgress }) => {
  if (!POSTMAN_API_KEY) throw new Error("Postman API key not configured");
  if (!sourceWorkspaceId) throw new Error("Source workspace ID is required");
  if (!targetWorkspaceId) throw new Error("Target workspace ID is required");

  const results = {
    collections: { total: 0, success: 0, failed: [], successData: [] },
    mocks: { total: 0, success: 0, failed: [], urls: [] },
    mockEnv: { success: false, action: null },
    specs: { total: 0, success: 0, failed: [], successData: [] },
    environments: { total: 0, success: 0, failed: [], successData: [] },
    errors: [],
  };

  try {
    // Step 1: Detect new assets
    onProgress?.({ phase: "detection", message: "Scanning workspaces for new assets...", progress: 5 });

    const [sourceColls, targetColls, sourceSpecs, targetSpecs, sourceEnvs, targetEnvs] = await Promise.all([
      getAllCollections(sourceWorkspaceId),
      getAllCollections(targetWorkspaceId),
      getAllSpecs(sourceWorkspaceId),
      getAllSpecs(targetWorkspaceId),
      getAllEnvironments(sourceWorkspaceId),
      getAllEnvironments(targetWorkspaceId),
    ]);

    // Collections: fork check + name fallback
    const targetForkSources = new Set();
    const targetNames = new Set();
    for (const tc of targetColls) {
      targetNames.add(tc.name);
      try {
        const details = await getCollectionDetails(tc.uid);
        const forkFrom = details?.fork?.from;
        if (forkFrom) targetForkSources.add(forkFrom);
      } catch { /* ignore */ }
      await delay(300);
    }
    const newCollections = sourceColls.filter(sc => !targetForkSources.has(sc.uid) && !targetNames.has(sc.name));

    // Specs: name match
    const normalize = (name) => (name || '').toLowerCase().trim();
    const targetSpecNames = new Set(targetSpecs.map(s => normalize(s.name)));
    const newSpecs = sourceSpecs.filter(s => !targetSpecNames.has(normalize(s.name)));

    // Environments: name match, exclude Mock Env
    const targetEnvNames = new Set(targetEnvs.map(e => normalize(e.name)));
    const newEnvironments = sourceEnvs.filter(e => normalize(e.name) !== 'mock env' && !targetEnvNames.has(normalize(e.name)));

    onProgress?.({ phase: "detection", message: `Found ${newCollections.length} new collection(s), ${newSpecs.length} new spec(s), ${newEnvironments.length} new environment(s)`, progress: 15 });

    if (newCollections.length === 0 && newSpecs.length === 0 && newEnvironments.length === 0) {
      onProgress?.({ phase: "complete", message: "Workspace is up to date — no new assets found.", progress: 100, results });
      return results;
    }

    // Step 2: Fork new collections
    onProgress?.({ phase: "collections", message: "Forking new collections...", progress: 20 });
    results.collections.total = newCollections.length;
    const collectionMap = new Map();

    for (let i = 0; i < newCollections.length; i++) {
      const collection = newCollections[i];
      onProgress?.({ phase: "collections", message: `Forking: ${collection.name}`, current: i + 1, total: newCollections.length, progress: 20 + (i / newCollections.length) * 15 });
      const forkResult = await forkCollection(collection.uid, collection.name, targetWorkspaceId);
      if (forkResult.success) {
        results.collections.success++;
        const collDetails = await getCollectionDetails(forkResult.uid);
        const hostVariables = collDetails ? extractHostVariables(collDetails) : [];
        results.collections.successData.push({
          name: forkResult.collectionName, uid: forkResult.uid,
          hostVariables, collectionDetails: collDetails,
        });
        collectionMap.set(collection.uid, forkResult.uid);
      } else {
        results.collections.failed.push({ name: collection.name, error: forkResult.error });
        results.errors.push(`Failed to fork ${collection.name}: ${forkResult.error}`);
      }
      await delay(300);
    }

    // Step 3: Create mock servers for new collections
    if (results.collections.successData.length > 0) {
      onProgress?.({ phase: "mocks", message: "Creating mock servers...", progress: 40 });
      results.mocks.total = results.collections.successData.length;
      for (let i = 0; i < results.collections.successData.length; i++) {
        const coll = results.collections.successData[i];
        const mockName = `${coll.name} Mock`;
        onProgress?.({ phase: "mocks", message: `Creating: ${mockName}`, current: i + 1, total: results.collections.successData.length, progress: 40 + (i / results.collections.successData.length) * 15 });
        const mockResult = await createMockServer(mockName, coll.uid, targetWorkspaceId, null);
        if (mockResult.success) {
          results.mocks.success++;
          results.mocks.urls.push({
            collectionName: coll.name, mockName: mockResult.mockName,
            mockUrl: mockResult.mockUrl, targetUid: coll.uid,
            hostVariables: coll.hostVariables,
          });
        } else {
          results.mocks.failed.push({ name: mockName, error: mockResult.error });
          results.errors.push(`Failed to create mock ${mockName}: ${mockResult.error}`);
        }
        await delay(300);
      }
    }

    // Step 4: Update Mock Env in-place (or create if missing)
    const mockEnvVarMap = new Map();
    if (results.mocks.urls.length > 0) {
      onProgress?.({ phase: "mockEnv", message: "Updating Mock Environment...", progress: 60 });

      const toCamelCase = (name) => {
        return name.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/)
          .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join('');
      };

      const newVariables = [];
      for (const mock of results.mocks.urls) {
        const hostVars = mock.hostVariables || [];
        if (hostVars.length === 0) {
          const varName = toCamelCase(mock.collectionName) + 'BaseUrl';
          newVariables.push({ key: varName, value: mock.mockUrl, type: 'default', enabled: true });
          mockEnvVarMap.set(`${mock.targetUid}:__fallback__`, varName);
        } else {
          for (const hv of hostVars) {
            const envVarName = toCamelCase(mock.collectionName) + toPascalCase(hv.varName);
            newVariables.push({ key: envVarName, value: mock.mockUrl, type: 'default', enabled: true });
            mockEnvVarMap.set(`${mock.targetUid}:${hv.varName}`, envVarName);
          }
        }
      }

      if (newVariables.length > 0) {
        const mockEnv = targetEnvs.find(e => e.name === 'Mock Env');
        if (mockEnv) {
          // Update existing Mock Env in-place with deduplication
          const envDetails = await getEnvironmentDetails(mockEnv.uid);
          const existingVars = envDetails?.values || [];
          const existingKeys = new Set(existingVars.map(v => v.key));

          const deduped = newVariables.map(v => {
            if (existingKeys.has(v.key)) {
              let suffix = 2;
              let newKey = `${v.key}${suffix}`;
              while (existingKeys.has(newKey)) { suffix++; newKey = `${v.key}${suffix}`; }
              existingKeys.add(newKey);
              for (const [mapKey, mapVal] of mockEnvVarMap.entries()) {
                if (mapVal === v.key) mockEnvVarMap.set(mapKey, newKey);
              }
              return { ...v, key: newKey };
            }
            existingKeys.add(v.key);
            return v;
          });

          const merged = [...existingVars, ...deduped];
          const updateResult = await updateEnvironment(mockEnv.uid, 'Mock Env', merged);
          results.mockEnv = { success: updateResult.success, action: 'updated' };
          if (!updateResult.success) results.errors.push(`Failed to update Mock Env: ${updateResult.error}`);
        } else {
          // Create fresh Mock Env
          const createResult = await createEnvironmentInPostman('Mock Env', newVariables, targetWorkspaceId);
          results.mockEnv = { success: createResult.success, action: 'created' };
          if (!createResult.success) results.errors.push(`Failed to create Mock Env: ${createResult.error}`);
        }
      }
    }

    // Step 5: Update collection variables to reference mock env var names
    if (mockEnvVarMap.size > 0) {
      onProgress?.({ phase: "collectionVars", message: "Updating collection variables...", progress: 70 });
      for (const coll of results.collections.successData) {
        if (!coll.collectionDetails) continue;
        const existingVars = coll.collectionDetails.variable || [];
        const hostVars = coll.hostVariables || [];

        if (hostVars.length > 0) {
          const updatedVars = existingVars.map(v => {
            const hv = hostVars.find(h => h.varName === v.key);
            if (hv) {
              const envName = mockEnvVarMap.get(`${coll.uid}:${hv.varName}`);
              if (envName) return { ...v, value: `{{${envName}}}` };
            }
            return v;
          });
          for (const hv of hostVars) {
            const envName = mockEnvVarMap.get(`${coll.uid}:${hv.varName}`);
            if (envName && !updatedVars.some(v => v.key === hv.varName)) {
              updatedVars.push({ key: hv.varName, value: `{{${envName}}}`, type: 'string' });
            }
          }
          await patchCollectionVariables(coll.uid, updatedVars);
        } else {
          const fallbackEnvVarName = mockEnvVarMap.get(`${coll.uid}:__fallback__`);
          if (!fallbackEnvVarName) continue;
          const matchedVar = existingVars.find(v => COMMON_HOST_VAR_NAMES.includes(v.key));
          const updatedVars = matchedVar
            ? existingVars.map(v => v.key === matchedVar.key ? { ...v, value: `{{${fallbackEnvVarName}}}` } : v)
            : [...existingVars, { key: 'baseUrl', value: `{{${fallbackEnvVarName}}}`, type: 'string' }];
          await patchCollectionVariables(coll.uid, updatedVars);
        }
        await delay(300);
      }
    }

    // Step 6: Copy new specs
    if (newSpecs.length > 0) {
      onProgress?.({ phase: "specs", message: "Copying new specs...", progress: 80 });
      results.specs.total = newSpecs.length;
      for (let i = 0; i < newSpecs.length; i++) {
        const spec = newSpecs[i];
        onProgress?.({ phase: "specs", message: `Copying: ${spec.name}`, current: i + 1, total: newSpecs.length, progress: 80 + (i / newSpecs.length) * 10 });
        const copyResult = await copySpec(spec.id, spec.name, spec.type, targetWorkspaceId);
        if (copyResult.success) {
          results.specs.success++;
          results.specs.successData.push({ name: copyResult.specName, id: copyResult.newSpecId, filesCopied: copyResult.filesCopied });
        } else {
          results.specs.failed.push({ name: spec.name, error: copyResult.errors.join("; ") });
          results.errors.push(`Failed to copy spec ${spec.name}`);
        }
        await delay(500);
      }
    }

    // Step 7: Copy new environments
    if (newEnvironments.length > 0) {
      onProgress?.({ phase: "environments", message: "Copying new environments...", progress: 90 });
      results.environments.total = newEnvironments.length;
      for (let i = 0; i < newEnvironments.length; i++) {
        const env = newEnvironments[i];
        onProgress?.({ phase: "environments", message: `Copying: ${env.name}`, current: i + 1, total: newEnvironments.length, progress: 90 + (i / newEnvironments.length) * 9 });
        const envDetails = await getEnvironmentDetails(env.uid);
        if (!envDetails) {
          results.environments.failed.push({ name: env.name, error: "Could not get environment details" });
          continue;
        }
        const createResult = await createEnvironmentInPostman(envDetails.name, envDetails.values || [], targetWorkspaceId);
        if (createResult.success) {
          results.environments.success++;
          results.environments.successData.push({ name: createResult.environmentName, uid: createResult.uid });
        } else {
          results.environments.failed.push({ name: envDetails.name, error: createResult.error });
          results.errors.push(`Failed to copy environment ${envDetails.name}: ${createResult.error}`);
        }
        await delay(300);
      }
    }

    onProgress?.({ phase: "complete", message: "Update complete!", progress: 100, results });
    return results;
  } catch (error) {
    results.errors.push(error.message);
    onProgress?.({ phase: "error", message: `Error: ${error.message}`, progress: 0, results });
    throw error;
  }
};

// ============================================================================
// CONFIGURATION & UTILITIES
// ============================================================================

/** Check if Postman is properly configured for basic operations. */
export const isPostmanConfigured = () => !!(POSTMAN_API_KEY && POSTMAN_SOURCE_WORKSPACE_ID);

/** Check if Postman is fully configured (including target workspace). */
export const isPostmanFullyConfigured = () => !!(POSTMAN_API_KEY && POSTMAN_TARGET_WORKSPACE_ID && POSTMAN_SOURCE_WORKSPACE_ID);

/** Get configuration status for debugging. */
export const getConfigurationStatus = () => ({
  hasApiKey: !!POSTMAN_API_KEY,
  hasTargetWorkspace: !!POSTMAN_TARGET_WORKSPACE_ID,
  hasSourceWorkspace: !!POSTMAN_SOURCE_WORKSPACE_ID,
  isConfigured: isPostmanConfigured(),
  isFullyConfigured: isPostmanFullyConfigured(),
  message: !POSTMAN_API_KEY
    ? "Missing API key (POSTMAN_API_KEY)"
    : !POSTMAN_SOURCE_WORKSPACE_ID
      ? "Missing source workspace ID (POSTMAN_SOURCE_WORKSPACE_ID)"
      : !POSTMAN_TARGET_WORKSPACE_ID
        ? "Target workspace ID not set — will create new workspace"
        : "Fully configured",
});

/**
 * Validate API key by making a test request.
 * @returns {Promise<{valid: boolean, user?: object, error?: string}>}
 */
export const validateApiKey = async () => {
  try {
    const response = await axios.get(`${POSTMAN_API_BASE}/me`, { headers: authHeaders() });
    return { valid: true, user: response.data.user };
  } catch (error) {
    return { valid: false, error: extractError(error) };
  }
};

/**
 * Get a summary of workspace contents.
 * @param {string} workspaceId
 * @returns {Promise<object>}
 */
export const getWorkspaceSummary = async (workspaceId) => {
  const [collections, environments, mocks, apis] = await Promise.all([
    getAllCollections(workspaceId),
    getAllEnvironments(workspaceId),
    getAllMocks(workspaceId),
    getAllSpecs(workspaceId),
  ]);

  return {
    workspaceId,
    counts: { collections: collections.length, environments: environments.length, mocks: mocks.length, apis: apis.length },
    items: {
      collections: collections.map((c) => ({ id: c.id, uid: c.uid, name: c.name })),
      environments: environments.map((e) => ({ id: e.id, uid: e.uid, name: e.name })),
      mocks: mocks.map((m) => ({ id: m.id, uid: m.uid, name: m.name })),
      apis: apis.map((a) => ({ id: a.id, name: a.name })),
    },
  };
};

// ============================================================================
// CUSTOM PROVISIONING & RESET
// ============================================================================

/**
 * Get available collections from a workspace for UI selection.
 * @param {string} workspaceId
 * @returns {Promise<Array>}
 */
export const getAvailableCollections = async (workspaceId) => {
  try {
    const collections = await getAllCollections(workspaceId);
    return collections.map((collection) => ({
      id: collection.id, uid: collection.uid, name: collection.name, selected: false,
      metadata: { createdAt: collection.createdAt, updatedAt: collection.updatedAt },
    }));
  } catch (error) {
    console.error("Error getting available collections:", error);
    return [];
  }
};

/**
 * Get available resources from a workspace for UI selection.
 * @param {string} workspaceId
 * @returns {Promise<object>}
 */
export const getAvailableResources = async (workspaceId) => {
  try {
    const [collections, environments, mocks, specs] = await Promise.all([
      getAllCollections(workspaceId),
      getAllEnvironments(workspaceId),
      getAllMocks(workspaceId),
      getAllSpecs(workspaceId),
    ]);
    return {
      collections: collections.map((c) => ({ id: c.id, uid: c.uid, name: c.name, selected: false })),
      environments: environments.map((e) => ({ id: e.id, uid: e.uid, name: e.name, selected: false })),
      mocks: mocks.map((m) => ({ id: m.id, uid: m.uid, name: m.name, selected: false, collectionUid: m.collection })),
      specs: specs.map((s) => ({ id: s.id, name: s.name, type: s.type, selected: false })),
    };
  } catch (error) {
    console.error("Error getting available resources:", error);
    return { collections: [], environments: [], mocks: [], specs: [] };
  }
};

/**
 * Custom workspace provisioning with selective resource copying.
 * @param {object} options
 * @param {function} onProgress
 * @returns {Promise<object>}
 */
export const provisionCustomWorkspace = async (options, onProgress) => {
  const {
    sourceWorkspaceId, targetWorkspaceId, workspaceName = "Partner Workspace", workspaceType = "partner",
    copyCollections = true, copyEnvironments = true, copyMocks = true, copySpecs = true,
    selectedCollectionUids = null, selectedEnvironmentUids = null, selectedSpecIds = null,
    createMockEnv = true, addAdmins = true, invitePartners = true,
    adminUserIds = [], partnerEmails = [], partnerRoleId = "7",
  } = options;

  if (!POSTMAN_API_KEY) throw new Error("Postman API key not configured");
  if (!sourceWorkspaceId) throw new Error("Source workspace ID is required");

  const results = {
    workspace: null, workspaceCreated: false,
    collections: { total: 0, success: 0, failed: [], successData: [] },
    mocks: { total: 0, success: 0, failed: [], urls: [] },
    environments: { total: 0, success: 0, failed: [], successData: [] },
    mockEnv: { success: false, action: null },
    specs: { total: 0, success: 0, failed: [], successData: [] },
    admins: { total: 0, success: 0, failed: [], successData: [] },
    invitations: { total: 0, success: 0, failed: [], links: [] },
    errors: [],
  };

  try {
    onProgress?.({ phase: "validation", message: "Validating configuration...", progress: 5 });
    const validation = await validateApiKey();
    if (!validation.valid) throw new Error(`Invalid API key: ${validation.error}`);
    const sourceWorkspace = await getWorkspace(sourceWorkspaceId);
    if (!sourceWorkspace) throw new Error(`Source workspace not found: ${sourceWorkspaceId}`);

    onProgress?.({ phase: "workspace", message: targetWorkspaceId ? "Using existing workspace..." : "Creating new workspace...", progress: 10 });
    let workspaceId = targetWorkspaceId;
    if (targetWorkspaceId) {
      const existingWorkspace = await getWorkspace(targetWorkspaceId);
      if (!existingWorkspace) throw new Error(`Target workspace not found: ${targetWorkspaceId}`);
      results.workspace = existingWorkspace;
    } else {
      if (!workspaceName) throw new Error("Workspace name is required when creating a new workspace");
      const createResult = await createWorkspace(workspaceName, workspaceType);
      if (!createResult.success) throw new Error(`Failed to create workspace: ${createResult.error}`);
      workspaceId = createResult.workspace.id;
      results.workspace = createResult.workspace;
      results.workspaceCreated = true;
    }

    // Copy workspace description from source
    try {
      const sourceDescription = sourceWorkspace.description;
      if (sourceDescription) {
        let finalDescription = sourceDescription;
        const companyName = deriveCompanyName(workspaceName || results.workspace?.name);
        if (companyName) {
          finalDescription = sourceDescription.replace(/<Company>/g, companyName);
          console.log(`Replaced <Company> placeholder with "${companyName}"`);
        } else {
          console.warn("Could not derive company name from target workspace name — copying description as-is");
        }
        const updateResult = await updateWorkspace(workspaceId, { description: finalDescription });
        if (updateResult.success) {
          console.log("Workspace description updated successfully");
        } else {
          console.warn("Failed to update workspace description — continuing provisioning");
        }
      } else {
        console.warn("Source workspace has no description — skipping description copy");
      }
    } catch (descError) {
      console.warn(`Unexpected error copying workspace description: ${descError.message} — continuing provisioning`);
    }

    if (copyCollections) {
      onProgress?.({ phase: "collections", message: "Copying collections...", progress: 20 });
      let sourceCollections = await getAllCollections(sourceWorkspaceId);
      if (selectedCollectionUids?.length > 0) sourceCollections = sourceCollections.filter((c) => selectedCollectionUids.includes(c.uid));
      results.collections.total = sourceCollections.length;

      for (let i = 0; i < sourceCollections.length; i++) {
        const collection = sourceCollections[i];
        onProgress?.({ phase: "collections", message: `Forking: ${collection.name}`, current: i + 1, total: sourceCollections.length, progress: 20 + (i / sourceCollections.length) * 15 });
        const forkResult = await forkCollection(collection.uid, collection.name, workspaceId);
        if (forkResult.success) {
          results.collections.success++;
          const collDetails = await getCollectionDetails(forkResult.uid);
          let hostVariables = [];
          if (collDetails) {
            hostVariables = extractHostVariables(collDetails);
          }
          results.collections.successData.push({ name: forkResult.collectionName, uid: forkResult.uid, hostVariables, collectionDetails: collDetails });
        } else {
          results.collections.failed.push({ name: collection.name, error: forkResult.error });
          results.errors.push(`Failed to fork ${collection.name}: ${forkResult.error}`);
        }
        await delay(300);
      }

      if (copyMocks && results.collections.successData.length > 0) {
        onProgress?.({ phase: "mocks", message: "Creating mock servers...", progress: 40 });
        results.mocks.total = results.collections.successData.length;
        for (let i = 0; i < results.collections.successData.length; i++) {
          const coll = results.collections.successData[i];
          const mockName = `${coll.name} Mock`;
          onProgress?.({ phase: "mocks", message: `Creating: ${mockName}`, current: i + 1, total: results.collections.successData.length, progress: 40 + (i / results.collections.successData.length) * 15 });
          const mockResult = await createMockServer(mockName, coll.uid, workspaceId, null);
          if (mockResult.success) { results.mocks.success++; results.mocks.urls.push({ collectionName: coll.name, mockName: mockResult.mockName, mockUrl: mockResult.mockUrl, targetUid: coll.uid, hostVariables: coll.hostVariables }); }
          else { results.mocks.failed.push({ name: mockName, error: mockResult.error }); results.errors.push(`Failed to create mock ${mockName}: ${mockResult.error}`); }
          await delay(300);
        }
      }
    }

    if (copyEnvironments) {
      onProgress?.({ phase: "environments", message: "Copying environments...", progress: 60 });
      let sourceEnvs = await getAllEnvironments(sourceWorkspaceId);
      if (selectedEnvironmentUids?.length > 0) sourceEnvs = sourceEnvs.filter((e) => selectedEnvironmentUids.includes(e.uid));
      results.environments.total = sourceEnvs.length;
      const envMap = new Map();

      for (let i = 0; i < sourceEnvs.length; i++) {
        const env = sourceEnvs[i];
        onProgress?.({ phase: "environments", message: `Copying: ${env.name}`, current: i + 1, total: sourceEnvs.length, progress: 60 + (i / sourceEnvs.length) * 10 });
        const envDetails = await getEnvironmentDetails(env.uid);
        if (!envDetails) { results.environments.failed.push({ name: env.name, error: "Could not get environment details" }); continue; }
        const cr = await createEnvironmentInPostman(envDetails.name, envDetails.values || [], workspaceId);
        if (cr.success) { results.environments.success++; results.environments.successData.push({ name: cr.environmentName, uid: cr.uid }); envMap.set(env.uid, { targetUid: cr.uid, name: envDetails.name }); }
        else { results.environments.failed.push({ name: envDetails.name, error: cr.error }); results.errors.push(`Failed to copy ${envDetails.name}: ${cr.error}`); }
        await delay(300);
      }

      const customMockEnvVarMap = new Map();
      if (createMockEnv && results.mocks.urls.length > 0) {
        onProgress?.({ phase: "mockEnv", message: "Creating Mock Environment...", progress: 75 });
        const toCamelCase = (name) => {
          return name.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/)
            .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');
        };

        const mockVariables = [];
        for (const mock of results.mocks.urls) {
          const hostVars = mock.hostVariables || [];
          if (hostVars.length === 0) {
            const varName = toCamelCase(mock.collectionName) + 'BaseUrl';
            mockVariables.push({ key: varName, value: mock.mockUrl, type: 'default', enabled: true });
            customMockEnvVarMap.set(`${mock.targetUid}:__fallback__`, varName);
          } else {
            for (const hv of hostVars) {
              const envVarName = toCamelCase(mock.collectionName) + toPascalCase(hv.varName);
              mockVariables.push({ key: envVarName, value: mock.mockUrl, type: 'default', enabled: true });
              customMockEnvVarMap.set(`${mock.targetUid}:${hv.varName}`, envVarName);
            }
          }
        }

        const cr = await createEnvironmentInPostman("Mock Env", mockVariables, workspaceId);
        if (cr.success) results.mockEnv = { success: true, action: "created" }; else results.errors.push(`Failed to create Mock Env: ${cr.error}`);
      }

      if (customMockEnvVarMap.size > 0) {
        onProgress?.({ phase: "collectionVars", message: "Updating collection variables...", progress: 78 });
        for (const coll of results.collections.successData) {
          if (!coll.collectionDetails) continue;
          const existingVars = coll.collectionDetails.variable || [];
          const hostVars = coll.hostVariables || [];

          if (hostVars.length > 0) {
            const updatedVars = existingVars.map(v => {
              const hv = hostVars.find(h => h.varName === v.key);
              if (hv) {
                const envName = customMockEnvVarMap.get(`${coll.uid}:${hv.varName}`);
                if (envName) return { ...v, value: `{{${envName}}}` };
              }
              return v;
            });
            for (const hv of hostVars) {
              const envName = customMockEnvVarMap.get(`${coll.uid}:${hv.varName}`);
              if (envName && !updatedVars.some(v => v.key === hv.varName)) {
                updatedVars.push({ key: hv.varName, value: `{{${envName}}}`, type: 'string' });
              }
            }
            await patchCollectionVariables(coll.uid, updatedVars);
          } else {
            const fallbackEnvVarName = customMockEnvVarMap.get(`${coll.uid}:__fallback__`);
            if (!fallbackEnvVarName) continue;
            const matchedVar = existingVars.find(v => COMMON_HOST_VAR_NAMES.includes(v.key));
            const updatedVars = matchedVar
              ? existingVars.map(v =>
                  v.key === matchedVar.key ? { ...v, value: `{{${fallbackEnvVarName}}}` } : v
                )
              : [...existingVars, { key: 'baseUrl', value: `{{${fallbackEnvVarName}}}`, type: 'string' }];
            await patchCollectionVariables(coll.uid, updatedVars);
          }
          await delay(300);
        }
      }
    }

    if (copySpecs) {
      onProgress?.({ phase: "specs", message: "Copying specs...", progress: 80 });
      let srcSpecs = await getAllSpecs(sourceWorkspaceId);
      if (selectedSpecIds?.length > 0) srcSpecs = srcSpecs.filter((s) => selectedSpecIds.includes(s.id));
      results.specs.total = srcSpecs.length;
      for (let i = 0; i < srcSpecs.length; i++) {
        const spec = srcSpecs[i];
        onProgress?.({ phase: "specs", message: `Copying: ${spec.name}`, current: i + 1, total: srcSpecs.length, progress: 80 + (i / srcSpecs.length) * 15 });
        const cr = await copySpec(spec.id, spec.name, spec.type, workspaceId);
        if (cr.success) { results.specs.success++; results.specs.successData.push({ name: cr.specName, id: cr.newSpecId, filesCopied: cr.filesCopied }); }
        else { results.specs.failed.push({ name: spec.name, error: cr.errors.join("; ") }); results.errors.push(`Failed to copy spec ${spec.name}`); }
        await delay(500);
      }
    }

    if (addAdmins && adminUserIds.length > 0) {
      onProgress?.({ phase: "admins", message: "Adding workspace admins...", progress: 88 });
      results.admins.total = adminUserIds.length;
      for (let i = 0; i < adminUserIds.length; i++) {
        const userId = adminUserIds[i];
        onProgress?.({ phase: "admins", message: `Adding admin: ${userId}`, current: i + 1, total: adminUserIds.length, progress: 88 + (i / adminUserIds.length) * 5 });
        const ar = await addWorkspaceAdmin(workspaceId, userId, "3");
        if (ar.success) { results.admins.success++; results.admins.successData.push({ userId, roleId: "3" }); }
        else { results.admins.failed.push({ userId, error: ar.error }); results.errors.push(`Failed to add admin ${userId}: ${ar.error}`); }
        await delay(300);
      }
    }

    if (invitePartners && partnerEmails.length > 0) {
      onProgress?.({ phase: "invitations", message: "Inviting partners...", progress: 93 });
      results.invitations.total = partnerEmails.length;
      for (let i = 0; i < partnerEmails.length; i++) {
        const email = partnerEmails[i];
        onProgress?.({ phase: "invitations", message: `Inviting partner: ${email}`, current: i + 1, total: partnerEmails.length, progress: 93 + (i / partnerEmails.length) * 6 });
        const ir = await invitePartner(workspaceId, email, partnerRoleId);
        if (ir.success) { results.invitations.success++; if (ir.invitationLink) results.invitations.links.push({ email: ir.email, invitationLink: ir.invitationLink, status: ir.status }); }
        else { results.invitations.failed.push({ email, error: ir.error }); results.errors.push(`Failed to invite partner ${email}: ${ir.error}`); }
        await delay(300);
      }
    }

    onProgress?.({ phase: "complete", message: "Custom provisioning complete!", progress: 100, results });
    return results;
  } catch (error) {
    results.errors.push(error.message);
    onProgress?.({ phase: "error", message: `Error: ${error.message}`, progress: 0, results });
    throw error;
  }
};

/**
 * Custom workspace reset with selective resource deletion.
 * @param {string} workspaceId
 * @param {function} onProgress
 * @param {object} options
 * @returns {Promise<object>}
 */
export const resetCustomWorkspace = async (workspaceId, onProgress, options = {}) => {
  const {
    includeSpecs = true, includeMocks = true, includeEnvironments = true, includeCollections = true,
    selectedCollectionUids = null, selectedEnvironmentUids = null, selectedMockIds = null, selectedSpecIds = null,
  } = options;

  const result = {
    deletedSpecs: 0, deletedMocks: 0, deletedEnvironments: 0, deletedCollections: 0,
    totalSpecs: 0, totalMocks: 0, totalEnvironments: 0, totalCollections: 0, errors: [],
  };

  try {
    if (includeSpecs) {
      let specs = await getAllSpecs(workspaceId);
      if (selectedSpecIds?.length > 0) specs = specs.filter((s) => selectedSpecIds.includes(s.id));
      result.totalSpecs = specs.length;
      onProgress?.({ phase: "specs", message: `Deleting ${specs.length} spec(s)...`, deleted: 0, total: specs.length });
      for (const spec of specs) {
        if (await deleteSpec(spec.id)) result.deletedSpecs++; else result.errors.push(`Failed to delete spec: ${spec.name}`);
        onProgress?.({ phase: "specs", deleted: result.deletedSpecs, total: specs.length, currentItem: spec.name });
        await delay(300);
      }
    }

    if (includeMocks) {
      let mocks = await getAllMocks(workspaceId);
      if (selectedMockIds?.length > 0) mocks = mocks.filter((m) => selectedMockIds.includes(m.id));
      result.totalMocks = mocks.length;
      onProgress?.({ phase: "mocks", message: `Deleting ${mocks.length} mock server(s)...`, deleted: 0, total: mocks.length });
      for (const mock of mocks) {
        if (await deleteMock(mock.id)) result.deletedMocks++; else result.errors.push(`Failed to delete mock: ${mock.name}`);
        onProgress?.({ phase: "mocks", deleted: result.deletedMocks, total: mocks.length, currentItem: mock.name });
        await delay(300);
      }
    }

    if (includeEnvironments) {
      let environments = await getAllEnvironments(workspaceId);
      if (selectedEnvironmentUids?.length > 0) environments = environments.filter((e) => selectedEnvironmentUids.includes(e.uid));
      result.totalEnvironments = environments.length;
      onProgress?.({ phase: "environments", message: `Deleting ${environments.length} environment(s)...`, deleted: 0, total: environments.length });
      for (const env of environments) {
        if (await deleteEnvironment(env.uid)) result.deletedEnvironments++; else result.errors.push(`Failed to delete environment: ${env.name}`);
        onProgress?.({ phase: "environments", deleted: result.deletedEnvironments, total: environments.length, currentItem: env.name });
        await delay(300);
      }
    }

    if (includeCollections) {
      let collections = await getAllCollections(workspaceId);
      if (selectedCollectionUids?.length > 0) collections = collections.filter((c) => selectedCollectionUids.includes(c.uid));
      result.totalCollections = collections.length;
      onProgress?.({ phase: "collections", message: `Deleting ${collections.length} collection(s)...`, deleted: 0, total: collections.length });
      for (const coll of collections) {
        if (await deleteCollection(coll.uid)) result.deletedCollections++; else result.errors.push(`Failed to delete collection: ${coll.name}`);
        onProgress?.({ phase: "collections", deleted: result.deletedCollections, total: collections.length, currentItem: coll.name });
        await delay(300);
      }
    }

    // Clear workspace description
    try {
      await updateWorkspace(workspaceId, { description: "" });
    } catch (e) {
      console.warn("Failed to clear workspace description:", e.message);
    }

    onProgress?.({ phase: "complete", message: "Custom reset complete", result });
    return result;
  } catch (error) {
    result.errors.push(`Unexpected error: ${error.message}`);
    onProgress?.({ phase: "error", message: error.message, result });
    throw error;
  }
};

/**
 * Get API key from environment.
 * @returns {string|undefined}
 */
export const getApiKey = () => POSTMAN_API_KEY;

/**
 * Parse comma-separated string into array.
 * @param {string} str
 * @returns {Array<string>}
 */
export const parseCommaSeparated = (str) => (str || "").split(",").map((s) => s.trim()).filter(Boolean);

/**
 * Format collections for UI display.
 * @param {Array} collections
 * @returns {Array<string>}
 */
export const formatCollectionsForUI = (collections) => collections.map((c) => `${c.name} (${c.uid})`);

/**
 * Format environments for UI display.
 * @param {Array} environments
 * @returns {Array<string>}
 */
export const formatEnvironmentsForUI = (environments) => environments.map((e) => `${e.name} (${e.uid})`);

/**
 * Format mocks for UI display.
 * @param {Array} mocks
 * @returns {Array<string>}
 */
export const formatMocksForUI = (mocks) => mocks.map((m) => `${m.name} (${m.uid})`);

/**
 * Format specs for UI display.
 * @param {Array} specs
 * @returns {Array<string>}
 */
export const formatSpecsForUI = (specs) => specs.map((s) => `${s.name} (${s.id})`);

/**
 * Format all resources for UI display.
 * @param {object} resources
 * @returns {object}
 */
export const formatResourcesForUI = (resources) => ({
  collections: formatCollectionsForUI(resources.collections || []),
  environments: formatEnvironmentsForUI(resources.environments || []),
  mocks: formatMocksForUI(resources.mocks || []),
  specs: formatSpecsForUI(resources.specs || []),
});
