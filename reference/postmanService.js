import axios from "axios";

// ============================================================================
// ENVIRONMENT CONFIGURATION
// ============================================================================
// Supports both Node.js (process.env) and Vite (import.meta.env) environments
// Uses unified variable names: POSTMAN_API_KEY, POSTMAN_SOURCE_WORKSPACE_ID, etc.
// For Vite: define in vite.config.js or use VITE_ prefix as fallback
// ============================================================================

const getEnvVar = (name) => {
  // Try process.env first (Node.js)
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name];
  }
  // Try import.meta.env (Vite) - both with and without VITE_ prefix
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[name] || import.meta.env[`VITE_${name}`];
  }
  return undefined;
};

const POSTMAN_API_KEY = getEnvVar('POSTMAN_API_KEY');
const POSTMAN_TARGET_WORKSPACE_ID = getEnvVar('POSTMAN_TARGET_WORKSPACE_ID');
const POSTMAN_SOURCE_WORKSPACE_ID = getEnvVar('POSTMAN_SOURCE_WORKSPACE_ID');
const POSTMAN_API_BASE = "https://api.getpostman.com";

// ============================================================================
// WORKSPACE MANAGEMENT
// ============================================================================

// Get the target workspace ID
export const getTargetWorkspaceId = () => {
  return POSTMAN_TARGET_WORKSPACE_ID;
};

// Get the source workspace ID
export const getSourceWorkspaceId = () => {
  return POSTMAN_SOURCE_WORKSPACE_ID;
};

/**
 * Create a new Postman workspace
 * @param {string} name - Name of the workspace
 * @param {string} type - Type of workspace: 'personal', 'private', 'team', or 'public'
 * @param {string} description - Optional description of the workspace
 * @returns {Promise<{success: boolean, workspace?: object, error?: string}>}
 */
export const createWorkspace = async (name, type = 'team', description = '') => {
  try {
    const response = await axios.post(
      `${POSTMAN_API_BASE}/workspaces`,
      {
        workspace: {
          name,
          type,
          description: description || `Workspace created via automation script`,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      }
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
    return {
      success: false,
      error: axios.isAxiosError(error)
        ? error.response?.data?.error?.message || error.message
        : error instanceof Error
        ? error.message
        : "Unknown error",
    };
  }
};

/**
 * Get workspace details by ID
 * @param {string} workspaceId - The workspace ID
 * @returns {Promise<object|null>}
 */
export const getWorkspace = async (workspaceId) => {
  try {
    const response = await axios.get(
      `${POSTMAN_API_BASE}/workspaces/${workspaceId}`,
      {
        headers: {
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      }
    );
    return response.data.workspace || null;
  } catch (error) {
    console.error("Error getting workspace:", error);
    return null;
  }
};

/**
 * Delete a workspace by ID
 * @param {string} workspaceId - The workspace ID to delete
 * @returns {Promise<boolean>}
 */
export const deleteWorkspace = async (workspaceId) => {
  try {
    await axios.delete(`${POSTMAN_API_BASE}/workspaces/${workspaceId}`, {
      headers: {
        "X-Api-Key": POSTMAN_API_KEY || "",
      },
    });
    return true;
  } catch (error) {
    console.error("Error deleting workspace:", error);
    return false;
  }
};

/**
 * Initialize target workspace - either use existing or create new
 * @param {object} options - Configuration options
 * @param {string} options.targetWorkspaceId - Existing workspace ID (optional)
 * @param {string} options.newWorkspaceName - Name for new workspace (required if no targetWorkspaceId)
 * @param {string} options.workspaceType - Type of workspace to create: 'personal', 'private', 'team', 'public'
 * @param {string} options.description - Description for new workspace
 * @returns {Promise<{success: boolean, workspaceId?: string, workspace?: object, created: boolean, error?: string}>}
 */
export const initializeTargetWorkspace = async (options = {}) => {
  const { targetWorkspaceId, newWorkspaceName, workspaceType = 'team', description = '' } = options;

  // If target workspace ID is provided, verify it exists
  if (targetWorkspaceId) {
    const existingWorkspace = await getWorkspace(targetWorkspaceId);
    if (existingWorkspace) {
      return {
        success: true,
        workspaceId: targetWorkspaceId,
        workspace: existingWorkspace,
        created: false,
      };
    } else {
      return {
        success: false,
        error: `Target workspace with ID "${targetWorkspaceId}" not found or not accessible`,
        created: false,
      };
    }
  }

  // No target workspace ID provided - create a new workspace
  if (!newWorkspaceName) {
    return {
      success: false,
      error: 'Either targetWorkspaceId or newWorkspaceName must be provided',
      created: false,
    };
  }

  const createResult = await createWorkspace(newWorkspaceName, workspaceType, description);
  
  if (createResult.success) {
    return {
      success: true,
      workspaceId: createResult.workspace.id,
      workspace: createResult.workspace,
      created: true,
    };
  } else {
    return {
      success: false,
      error: createResult.error,
      created: false,
    };
  }
};

// ============================================================================
// WORKSPACE ROLES MANAGEMENT
// ============================================================================

/**
 * Get all roles assigned in a workspace
 * @param {string} workspaceId - The workspace ID
 * @returns {Promise<{success: boolean, roles?: Array, error?: string}>}
 */
export const getWorkspaceRoles = async (workspaceId) => {
  try {
    const response = await axios.get(
      `${POSTMAN_API_BASE}/workspaces/${workspaceId}/roles`,
      {
        headers: {
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      }
    );
    return { success: true, roles: response.data.roles || [] };
  } catch (error) {
    return {
      success: false,
      error: axios.isAxiosError(error)
        ? error.response?.data?.error?.message || error.message
        : error instanceof Error
        ? error.message
        : "Unknown error",
      roles: [],
    };
  }
};

/**
 * Add a workspace admin (team member)
 * @param {string} workspaceId - Target workspace ID
 * @param {string} userId - User ID to add as admin
 * @param {string} roleId - Role ID (default: "3" for Admin)
 * @returns {Promise<{success: boolean, roles?: Array, error?: string}>}
 */
export const addWorkspaceAdmin = async (workspaceId, userId, roleId = "3") => {
  try {
    const response = await axios.patch(
      `${POSTMAN_API_BASE}/workspaces/${workspaceId}/roles`,
      {
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
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      }
    );
    return { success: true, roles: response.data.roles };
  } catch (error) {
    return {
      success: false,
      error: axios.isAxiosError(error)
        ? error.response?.data?.error?.message || error.message
        : error instanceof Error
        ? error.message
        : "Unknown error",
    };
  }
};

/**
 * Remove a user from workspace
 * @param {string} workspaceId - Target workspace ID
 * @param {string} userId - User ID to remove
 * @param {string} roleId - Current role ID of the user
 * @returns {Promise<{success: boolean, roles?: Array, error?: string}>}
 */
export const removeWorkspaceUser = async (workspaceId, userId, roleId) => {
  try {
    const response = await axios.patch(
      `${POSTMAN_API_BASE}/workspaces/${workspaceId}/roles`,
      {
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
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      }
    );
    return { success: true, roles: response.data.roles };
  } catch (error) {
    return {
      success: false,
      error: axios.isAxiosError(error)
        ? error.response?.data?.error?.message || error.message
        : error instanceof Error
        ? error.message
        : "Unknown error",
    };
  }
};

/**
 * Add multiple admins to a workspace
 * @param {string} workspaceId - Target workspace ID
 * @param {Array<string>} userIds - Array of user IDs to add as admins
 * @param {function} onProgress - Progress callback
 * @returns {Promise<{success: Array, failed: Array}>}
 */
export const addMultipleAdmins = async (workspaceId, userIds, onProgress) => {
  const results = { success: [], failed: [] };

  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i];

    onProgress?.({
      phase: 'admins',
      message: `Adding admin: ${userId}`,
      current: i + 1,
      total: userIds.length,
    });

    const addResult = await addWorkspaceAdmin(workspaceId, userId, "3");

    if (addResult.success) {
      results.success.push({
        userId,
        roleId: "3",
      });
    } else {
      results.failed.push({
        userId,
        error: addResult.error,
      });
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return results;
};

// ============================================================================
// PARTNER INVITATIONS MANAGEMENT
// ============================================================================

/**
 * Invite a partner to a workspace
 * @param {string} workspaceId - Target workspace ID
 * @param {string} email - Partner email to invite
 * @param {string} roleId - Partner role ID (default: "7" for Editor and Partner Lead)
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
        roleId: roleId,
        target: {
          emails: [email],
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      }
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
    return {
      success: false,
      email,
      error: axios.isAxiosError(error)
        ? error.response?.data?.error?.message || error.message
        : error instanceof Error
        ? error.message
        : "Unknown error",
    };
  }
};

/**
 * Remove a partner from a workspace
 * @param {string} workspaceId - Target workspace ID
 * @param {string} userId - Partner user ID to remove
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
        target: {
          userIds: [userId],
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      }
    );

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
      error: axios.isAxiosError(error)
        ? error.response?.data?.error?.message || error.message
        : error instanceof Error
        ? error.message
        : "Unknown error",
    };
  }
};

/**
 * Remove a partner from the entire team
 * @param {string} teamId - Publisher team ID
 * @param {string} userId - Partner user ID to remove
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
        target: {
          userIds: [userId],
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      }
    );

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
      error: axios.isAxiosError(error)
        ? error.response?.data?.error?.message || error.message
        : error instanceof Error
        ? error.message
        : "Unknown error",
    };
  }
};

/**
 * Invite multiple partners to a workspace
 * @param {string} workspaceId - Target workspace ID
 * @param {Array<string>} emails - Array of partner emails to invite
 * @param {string} roleId - Partner role ID (default: "7")
 * @param {function} onProgress - Progress callback
 * @returns {Promise<{success: Array, failed: Array}>}
 */
export const inviteMultiplePartners = async (workspaceId, emails, roleId = "7", onProgress) => {
  const results = { success: [], failed: [] };

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];

    onProgress?.({
      phase: 'invitations',
      message: `Inviting partner: ${email}`,
      current: i + 1,
      total: emails.length,
    });

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
      results.failed.push({
        email,
        error: inviteResult.error,
      });
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return results;
};

/**
 * Remove multiple partners from a workspace
 * @param {string} workspaceId - Target workspace ID
 * @param {Array<string>} userIds - Array of partner user IDs to remove
 * @param {function} onProgress - Progress callback
 * @returns {Promise<{success: Array, failed: Array}>}
 */
export const removeMultiplePartners = async (workspaceId, userIds, onProgress) => {
  const results = { success: [], failed: [] };

  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i];

    onProgress?.({
      phase: 'removePartners',
      message: `Removing partner: ${userId}`,
      current: i + 1,
      total: userIds.length,
    });

    const removeResult = await removePartner(workspaceId, userId);

    if (removeResult.success) {
      results.success.push({
        userId: removeResult.userId,
        status: removeResult.status,
      });
    } else {
      results.failed.push({
        userId,
        error: removeResult.error,
      });
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return results;
};

// ============================================================================
// SPEC MANAGEMENT (File-based approach)
// ============================================================================

/**
 * Get all specs from a workspace
 * @param {string} workspaceId - The workspace ID to get specs from
 * @returns {Promise<Array>}
 */
export const getAllSpecs = async (workspaceId) => {
  try {
    const response = await axios.get(
      `${POSTMAN_API_BASE}/specs?workspaceId=${workspaceId}`,
      {
        headers: {
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      }
    );
    return response.data.specs || [];
  } catch (error) {
    console.error("Error getting specs:", error);
    return [];
  }
};

/**
 * Get spec details
 * @param {string} specId - The spec ID
 * @returns {Promise<object|null>}
 */
export const getSpecDetails = async (specId) => {
  try {
    const response = await axios.get(
      `${POSTMAN_API_BASE}/specs/${specId}`,
      {
        headers: {
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      }
    );
    return response.data || null;
  } catch (error) {
    console.error("Error getting spec details:", error);
    return null;
  }
};

/**
 * Get all files in a spec
 * @param {string} specId - The spec ID
 * @returns {Promise<Array>} Array of file metadata: { id, name, path, type, createdAt, updatedAt }
 */
export const getSpecFiles = async (specId) => {
  try {
    const response = await axios.get(
      `${POSTMAN_API_BASE}/specs/${specId}/files`,
      {
        headers: {
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      }
    );
    return response.data.files || [];
  } catch (error) {
    console.error("Error getting spec files:", error);
    return [];
  }
};

/**
 * Get a specific spec file's content
 * @param {string} specId - The spec ID
 * @param {string} filePath - The file path
 * @returns {Promise<object|null>} { id, name, path, type, content, createdAt, updatedAt }
 */
export const getSpecFile = async (specId, filePath) => {
  try {
    const encodedPath = encodeURIComponent(filePath);
    const response = await axios.get(
      `${POSTMAN_API_BASE}/specs/${specId}/files/${encodedPath}`,
      {
        headers: {
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      }
    );
    return response.data || null;
  } catch (error) {
    console.error(`Error getting spec file ${filePath}:`, error);
    return null;
  }
};

/**
 * Create a new spec in a workspace with files
 * @param {string} workspaceId - Target workspace ID
 * @param {string} name - Spec name
 * @param {string} type - Spec type (e.g., "OPENAPI:3.0", "OPENAPI:3.1", "ASYNCAPI:2.0")
 * @param {Array} files - Array of files with { path, content, type } where type is "ROOT" or "DEFAULT"
 * @returns {Promise<{success: boolean, spec?: object, error?: string}>}
 */
export const createSpec = async (workspaceId, name, type, files) => {
  try {
    const requestBody = {
      name,
      type,
      files,
    };
    
    const response = await axios.post(
      `${POSTMAN_API_BASE}/specs?workspaceId=${workspaceId}`,
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      }
    );

    return {
      success: true,
      spec: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error: axios.isAxiosError(error)
        ? error.response?.data?.error?.message || error.message
        : error instanceof Error
        ? error.message
        : "Unknown error",
    };
  }
};

/**
 * Create a file in a spec
 * @param {string} specId - The spec ID
 * @param {string} path - The file path (e.g., "index.json" or "components/schemas.json")
 * @param {string} content - The file content as a string
 * @returns {Promise<{success: boolean, file?: object, error?: string}>}
 */
export const createSpecFile = async (specId, path, content) => {
  try {
    const response = await axios.post(
      `${POSTMAN_API_BASE}/specs/${specId}/files`,
      {
        path,
        content,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      }
    );

    return {
      success: true,
      file: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error: axios.isAxiosError(error)
        ? error.response?.data?.error?.message || error.message
        : error instanceof Error
        ? error.message
        : "Unknown error",
    };
  }
};

/**
 * Update a spec file's type (e.g., set as ROOT)
 * @param {string} specId - The spec ID
 * @param {string} filePath - The file path
 * @param {string} type - The file type ('ROOT' or 'DEFAULT')
 * @returns {Promise<{success: boolean, file?: object, error?: string}>}
 */
export const updateSpecFileType = async (specId, filePath, type) => {
  try {
    const encodedPath = encodeURIComponent(filePath);
    const response = await axios.patch(
      `${POSTMAN_API_BASE}/specs/${specId}/files/${encodedPath}`,
      {
        type,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      }
    );

    return {
      success: true,
      file: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error: axios.isAxiosError(error)
        ? error.response?.data?.error?.message || error.message
        : error instanceof Error
        ? error.message
        : "Unknown error",
    };
  }
};

/**
 * Delete a spec
 * @param {string} specId - The spec ID to delete
 * @returns {Promise<boolean>}
 */
export const deleteSpec = async (specId) => {
  try {
    await axios.delete(`${POSTMAN_API_BASE}/specs/${specId}`, {
      headers: {
        "X-Api-Key": POSTMAN_API_KEY || "",
      },
    });
    return true;
  } catch (error) {
    console.error("Error deleting spec:", error);
    return false;
  }
};

/**
 * Copy a spec with all its files from source to target workspace
 * @param {string} sourceSpecId - Source spec ID
 * @param {string} sourceSpecName - Source spec name
 * @param {string} targetWorkspaceId - Target workspace ID
 * @param {function} onProgress - Progress callback
 * @returns {Promise<object>} Result with success, newSpecId, filesCopied, errors
 */
export const copySpec = async (sourceSpecId, sourceSpecName, sourceSpecType, targetWorkspaceId, onProgress) => {
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
    const sourceFiles = await getSpecFiles(sourceSpecId);
    result.totalFiles = sourceFiles.length;

    if (sourceFiles.length === 0) {
      result.errors.push('No files found in source spec');
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
      
      const fileContent = await getSpecFile(sourceSpecId, file.path);
      if (fileContent && fileContent.content) {
        filesWithContent.push({
          path: file.path,
          content: fileContent.content,
          type: file.type, // "ROOT" or "DEFAULT"
        });
      } else {
        result.errors.push(`Failed to get content for file: ${file.path}`);
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    if (filesWithContent.length === 0) {
      result.errors.push('Could not retrieve any file contents');
      return result;
    }

    // Step 3: Create spec with all files in one API call
    onProgress?.({ step: 'create', message: `Creating spec with ${filesWithContent.length} file(s)...` });
    const createResult = await createSpec(
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
};

/**
 * Copy all specs from source workspace to target workspace
 * @param {string} sourceWorkspaceId - Source workspace ID
 * @param {string} targetWorkspaceId - Target workspace ID
 * @param {function} onProgress - Progress callback
 * @returns {Promise<{copied: Array, errors: Array}>}
 */
export const copySpecs = async (sourceWorkspaceId, targetWorkspaceId, onProgress) => {
  const results = {
    copied: [],
    errors: [],
  };

  const sourceSpecs = await getAllSpecs(sourceWorkspaceId);

  if (sourceSpecs.length === 0) {
    onProgress?.({
      phase: 'specs',
      message: 'No specs found in source workspace',
      progress: 100,
    });
    return results;
  }

  for (let i = 0; i < sourceSpecs.length; i++) {
    const spec = sourceSpecs[i];
    const progressPercent = Math.round((i / sourceSpecs.length) * 100);

    onProgress?.({
      phase: 'specs',
      message: `Copying spec: ${spec.name} (${spec.type})`,
      currentItem: spec.name,
      current: i + 1,
      total: sourceSpecs.length,
      progress: progressPercent,
    });

    const copyResult = await copySpec(spec.id, spec.name, spec.type, targetWorkspaceId);

    if (copyResult.success) {
      results.copied.push({
        originalSpecId: spec.id,
        newSpecId: copyResult.newSpecId,
        name: spec.name,
        type: spec.type,
        filesCopied: copyResult.filesCopied,
      });
    } else {
      results.errors.push({
        specName: spec.name,
        error: copyResult.errors.join('; '),
      });
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
};

// ============================================================================
// COLLECTIONS MANAGEMENT
// ============================================================================

// Get collections from source workspace
export const getSourceCollections = async () => {
  try {
    const response = await axios.get(
      `${POSTMAN_API_BASE}/collections?workspace=${POSTMAN_SOURCE_WORKSPACE_ID}`,
      {
        headers: {
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      }
    );
    return response.data.collections || [];
  } catch (error) {
    console.error("Error getting source collections:", error);
    return [];
  }
};

// Fork a collection from source to target workspace
export const forkCollection = async (collectionId, collectionName, workspaceId) => {
  try {
    const response = await axios.post(
      `${POSTMAN_API_BASE}/collections/fork/${collectionId}?workspace=${workspaceId}`,
      { label: collectionName },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      }
    );

    const data = response.data;

    return {
      success: true,
      collectionName: data.collection?.name || collectionName,
      collectionId: data.collection?.id,
      uid: data.collection?.uid,
    };
  } catch (error) {
    return {
      success: false,
      collectionName,
      error: axios.isAxiosError(error)
        ? error.response?.data?.error?.message || error.message
        : error instanceof Error
        ? error.message
        : "Unknown error",
    };
  }
};

// Get full collection details (to extract variables)
export const getCollectionDetails = async (collectionUid) => {
  try {
    const response = await axios.get(
      `${POSTMAN_API_BASE}/collections/${collectionUid}`,
      {
        headers: {
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      }
    );
    return response.data.collection || null;
  } catch (error) {
    console.error("Error getting collection details:", error);
    return null;
  }
};

// Create a collection in Postman
export const createCollectionInPostman = async (collectionData, workspaceId) => {
  try {
    const response = await axios.post(
      `${POSTMAN_API_BASE}/collections?workspace=${workspaceId}`,
      { collection: collectionData },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      }
    );

    const data = response.data;

    return {
      success: true,
      collectionName: collectionData.info?.name || "Unknown",
      collectionId: data.collection?.id,
      uid: data.collection?.uid,
    };
  } catch (error) {
    return {
      success: false,
      collectionName: collectionData.info?.name || "Unknown",
      error: axios.isAxiosError(error)
        ? error.response?.data?.error?.message || error.message
        : error instanceof Error
        ? error.message
        : "Unknown error",
    };
  }
};

// Create multiple collections with progress callback
export const createMultipleCollections = async (collections, workspaceId, onProgress) => {
  const results = [];

  for (let i = 0; i < collections.length; i++) {
    const collection = collections[i];
    const result = await createCollectionInPostman(collection, workspaceId);
    results.push(result);
    
    // Call progress callback if provided
    if (onProgress) {
      onProgress({
        current: i + 1,
        total: collections.length,
        currentItem: collection.info?.name || "Unknown",
        result,
      });
    }
    
    // Small delay between requests to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return results;
};

// Get all collections in workspace
export const getAllCollections = async (workspaceId) => {
    try {
      const response = await axios.get(
        `${POSTMAN_API_BASE}/collections?workspace=${workspaceId}`,
        {
          headers: {
            "X-Api-Key": POSTMAN_API_KEY || "",
          },
        }
      );
      return response.data.collections || [];
    } catch (error) {
      console.error("Error getting collections:", error);
      return [];
    }
  };
  
  // Delete a collection
  export const deleteCollection = async (collectionId) => {
    try {
      await axios.delete(`${POSTMAN_API_BASE}/collections/${collectionId}`, {
        headers: {
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      });
      return true;
    } catch (error) {
      console.error("Error deleting collection:", error);
      return false;
    }
  };

// ============================================================================
// ENVIRONMENT MANAGEMENT
// ============================================================================

// Create environment in Postman
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
      {
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      }
    );

    const data = response.data;

    return {
      success: true,
      environmentName,
      environmentId: data.environment?.id,
      uid: data.environment?.uid,
    };
  } catch (error) {
    return {
      success: false,
      environmentName,
      error: axios.isAxiosError(error)
        ? error.response?.data?.error?.message || error.message
        : error instanceof Error
        ? error.message
        : "Unknown error",
    };
  }
};



// Get all environments in workspace
export const getAllEnvironments = async (workspaceId) => {
  try {
    const response = await axios.get(
      `${POSTMAN_API_BASE}/environments?workspace=${workspaceId}`,
      {
        headers: {
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      }
    );
    return response.data.environments || [];
  } catch (error) {
    console.error("Error getting environments:", error);
    return [];
  }
};

// Get environment details
export const getEnvironmentDetails = async (environmentUid) => {
  try {
    const response = await axios.get(
      `${POSTMAN_API_BASE}/environments/${environmentUid}`,
      {
        headers: {
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      }
    );
    return response.data.environment || null;
  } catch (error) {
    console.error("Error getting environment details:", error);
    return null;
  }
};

// Update environment
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
      {
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      }
    );
    return {
      success: true,
      environment: response.data.environment,
    };
  } catch (error) {
    return {
      success: false,
      error: axios.isAxiosError(error)
        ? error.response?.data?.error?.message || error.message
        : error instanceof Error
        ? error.message
        : "Unknown error",
    };
  }
};

// Delete an environment
export const deleteEnvironment = async (environmentId) => {
  try {
    await axios.delete(`${POSTMAN_API_BASE}/environments/${environmentId}`, {
      headers: {
        "X-Api-Key": POSTMAN_API_KEY || "",
      },
    });
    return true;
  } catch (error) {
    console.error("Error deleting environment:", error);
    return false;
  }
};

// Get all mock servers in workspace
export const getAllMocks = async (workspaceId) => {
  try {
    const response = await axios.get(
      `${POSTMAN_API_BASE}/mocks?workspace=${workspaceId}`,
      {
        headers: {
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      }
    );
    return response.data.mocks || [];
  } catch (error) {
    console.error("Error getting mocks:", error);
    return [];
  }
};

// Delete a mock server
// DELETE /mocks/{mockId}
// Note: Use mock.id (not mock.uid) for deletion
export const deleteMock = async (mockId) => {
  try {
    await axios.delete(`${POSTMAN_API_BASE}/mocks/${mockId}`, {
      headers: {
        "X-Api-Key": POSTMAN_API_KEY || "",
      },
    });
    return true;
  } catch (error) {
    console.error("Error deleting mock:", error);
    return false;
  }
};

// Create mock server in Postman
export const createMockServer = async (mockName, collectionUid, workspaceId, environmentUid) => {
  try {
    const response = await axios.post(
      `${POSTMAN_API_BASE}/mocks?workspace=${workspaceId}`,
      {
        mock: {
          name: mockName,
          collection: collectionUid,
          environment: environmentUid,
          private: false,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      }
    );

    const data = response.data;

    return {
      success: true,
      mockName,
      mockId: data.mock?.id,
      mockUrl: data.mock?.mockUrl,
      uid: data.mock?.uid,
    };
  } catch (error) {
    return {
      success: false,
      mockName,
      error: axios.isAxiosError(error)
        ? error.response?.data?.error?.message || error.message
        : error instanceof Error
        ? error.message
        : "Unknown error",
    };
  }
};

/**
 * Reset workspace - delete all resources in reverse order of provisioning
 * Deletion order: Specs → Mocks → Environments → Collections
 * 
 * @param {string} workspaceId - The workspace ID to reset
 * @param {function} onProgress - Progress callback function
 * @param {object} options - Options for what to delete
 * @returns {Promise<object>} Results of the reset operation
 */
export const resetWorkspace = async (workspaceId, onProgress, options = {}) => {
  const { 
    includeSpecs = true,
    includeMocks = true,
    includeEnvironments = true, 
    includeCollections = true, 
  } = options;

  const result = { 
    deletedSpecs: 0,
    deletedMocks: 0,
    deletedEnvironments: 0, 
    deletedCollections: 0,
    totalSpecs: 0,
    totalMocks: 0,
    totalEnvironments: 0,
    totalCollections: 0,
    errors: [],
  };

  try {
    // STEP 1: Delete all specs
    if (includeSpecs) {
      const specs = await getAllSpecs(workspaceId);
      result.totalSpecs = specs.length;
      
      onProgress?.({
        phase: 'specs',
        message: `Deleting ${specs.length} spec(s)...`,
        deleted: 0,
        total: specs.length,
      });

      for (const spec of specs) {
        const success = await deleteSpec(spec.id);
        if (success) {
          result.deletedSpecs++;
        } else {
          result.errors.push(`Failed to delete spec: ${spec.name}`);
        }
        
        onProgress?.({
          phase: 'specs',
          deleted: result.deletedSpecs,
          total: specs.length,
          currentItem: spec.name,
        });
        
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    // STEP 2: Delete all mocks (must delete before collections)
    if (includeMocks) {
      const mocks = await getAllMocks(workspaceId);
      result.totalMocks = mocks.length;
      
      onProgress?.({
        phase: 'mocks',
        message: `Deleting ${mocks.length} mock server(s)...`,
        deleted: 0,
        total: mocks.length,
      });

      for (const mock of mocks) {
        // Use mock.id (not mock.uid) for deletion
        const success = await deleteMock(mock.id);
        if (success) {
          result.deletedMocks++;
        } else {
          result.errors.push(`Failed to delete mock: ${mock.name}`);
        }
        
        onProgress?.({
          phase: 'mocks',
          deleted: result.deletedMocks,
          total: mocks.length,
          currentItem: mock.name,
        });
        
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    // STEP 3: Delete all environments
    if (includeEnvironments) {
      const environments = await getAllEnvironments(workspaceId);
      result.totalEnvironments = environments.length;
      
      onProgress?.({
        phase: 'environments',
        message: `Deleting ${environments.length} environment(s)...`,
        deleted: 0,
        total: environments.length,
      });

      for (const environment of environments) {
        const success = await deleteEnvironment(environment.uid);
        if (success) {
          result.deletedEnvironments++;
        } else {
          result.errors.push(`Failed to delete environment: ${environment.name}`);
        }
        
        onProgress?.({
          phase: 'environments',
          deleted: result.deletedEnvironments,
          total: environments.length,
          currentItem: environment.name,
        });
        
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    // STEP 4: Delete all collections (last, as mocks depend on them)
    if (includeCollections) {
      const collections = await getAllCollections(workspaceId);
      result.totalCollections = collections.length;
      
      onProgress?.({
        phase: 'collections',
        message: `Deleting ${collections.length} collection(s)...`,
        deleted: 0,
        total: collections.length,
      });

      for (const collection of collections) {
        const success = await deleteCollection(collection.uid);
        if (success) {
          result.deletedCollections++;
        } else {
          result.errors.push(`Failed to delete collection: ${collection.name}`);
        }
        
        onProgress?.({
          phase: 'collections',
          deleted: result.deletedCollections,
          total: collections.length,
          currentItem: collection.name,
        });
        
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    onProgress?.({
      phase: 'complete',
      message: 'Reset complete',
      result,
    });

    return result;
  } catch (error) {
    result.errors.push(`Unexpected error: ${error.message}`);
    onProgress?.({
      phase: 'error',
      message: error.message,
      result,
    });
    throw error;
  }
};

// Environment names to check for Mock environment
const MOCK_ENV_NAMES = ["Mock Env", "Mock Environment", "Test Env", "Test Environment"];

/**
 * Modern Workspace Provisioning Function
 * 
 * Provisions a complete Postman workspace with collections, mocks, environments, and specs.
 * Follows the modern workflow from the CLI version.
 * 
 * WORKFLOW ORDER:
 *   1. Validate API key and workspaces
 *   2. Copy collections from source to target workspace
 *   3. Create mock servers for each copied collection
 *   4. Copy environments from source workspace
 *   5. Update Mock Env with mock URLs (or create new Mock Env)
 *   6. Copy API specs from source workspace
 * 
 * @param {object} options - Provisioning options
 * @param {string} options.sourceWorkspaceId - Source workspace ID (required)
 * @param {string} options.targetWorkspaceId - Target workspace ID (optional - creates new if not provided)
 * @param {string} options.workspaceName - Name for new workspace (required if targetWorkspaceId not provided)
 * @param {string} options.workspaceType - Type of workspace: 'personal', 'private', 'team', 'partner' (default: 'partner')
 * @param {function} onProgress - Progress callback function
 * @returns {Promise<object>} Results of the provisioning
 */
export const provisionWorkspace = async (options, onProgress) => {
  const {
    sourceWorkspaceId,
    targetWorkspaceId,
    workspaceName = 'Partner Workspace',
    workspaceType = 'partner',
    adminUserIds = [],      // NEW: Array of user IDs to add as admins
    partnerEmails = [],     // NEW: Array of emails to invite as partners
    partnerRoleId = "7",    // NEW: Partner role (default: Editor and Partner Lead)
  } = options;

  if (!POSTMAN_API_KEY) {
    throw new Error('Postman API key not configured');
  }

  if (!sourceWorkspaceId) {
    throw new Error('Source workspace ID is required');
  }

  const results = {
    workspace: null,
    workspaceCreated: false,
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
    // Step 0: Validate API key
    onProgress?.({
      phase: 'validation',
      message: 'Validating API key...',
      progress: 5,
    });

    const validation = await validateApiKey();
    if (!validation.valid) {
      throw new Error(`Invalid API key: ${validation.error}`);
    }

    // Verify source workspace
    const sourceWorkspace = await getWorkspace(sourceWorkspaceId);
    if (!sourceWorkspace) {
      throw new Error(`Source workspace not found: ${sourceWorkspaceId}`);
    }

    // Step 1: Initialize target workspace
    onProgress?.({
      phase: 'workspace',
      message: targetWorkspaceId ? 'Using existing workspace...' : 'Creating new workspace...',
      progress: 10,
    });

    let workspaceId = targetWorkspaceId;
    
    if (targetWorkspaceId) {
      const existingWorkspace = await getWorkspace(targetWorkspaceId);
      if (!existingWorkspace) {
        throw new Error(`Target workspace not found: ${targetWorkspaceId}`);
      }
      results.workspace = existingWorkspace;
      results.workspaceCreated = false;
    } else {
      if (!workspaceName) {
        throw new Error('Workspace name is required when creating a new workspace');
      }
      
      const createResult = await createWorkspace(workspaceName, workspaceType);
      if (!createResult.success) {
        throw new Error(`Failed to create workspace: ${createResult.error}`);
      }
      
      workspaceId = createResult.workspace.id;
      results.workspace = createResult.workspace;
      results.workspaceCreated = true;
    }

    // Step 2: Copy Collections
    onProgress?.({
      phase: 'collections',
      message: 'Copying collections...',
      progress: 20,
    });

    const sourceCollections = await getAllCollections(sourceWorkspaceId);
    results.collections.total = sourceCollections.length;

    const collectionMap = new Map(); // Map source UID to target UID

    for (let i = 0; i < sourceCollections.length; i++) {
      const collection = sourceCollections[i];
      
      onProgress?.({
        phase: 'collections',
        message: `Forking: ${collection.name}`,
        current: i + 1,
        total: sourceCollections.length,
        progress: 20 + (i / sourceCollections.length) * 15,
      });

      const forkResult = await forkCollection(collection.uid, collection.name, workspaceId);
      
      if (forkResult.success) {
        results.collections.success++;
        results.collections.successData.push({
          name: forkResult.collectionName,
          uid: forkResult.uid,
        });
        collectionMap.set(collection.uid, forkResult.uid);
      } else {
        results.collections.failed.push({
          name: collection.name,
          error: forkResult.error,
        });
        results.errors.push(`Failed to fork ${collection.name}: ${forkResult.error}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Step 3: Create Mock Servers
    onProgress?.({
      phase: 'mocks',
      message: 'Creating mock servers...',
      progress: 40,
    });

    results.mocks.total = results.collections.successData.length;

    for (let i = 0; i < results.collections.successData.length; i++) {
      const collection = results.collections.successData[i];
      const mockName = `${collection.name} Mock`;
      
      onProgress?.({
        phase: 'mocks',
        message: `Creating: ${mockName}`,
        current: i + 1,
        total: results.collections.successData.length,
        progress: 40 + (i / results.collections.successData.length) * 15,
      });

      const mockResult = await createMockServer(mockName, collection.uid, workspaceId, null);
      
      if (mockResult.success) {
        results.mocks.success++;
        results.mocks.urls.push({
          collectionName: collection.name,
          mockName: mockResult.mockName,
          mockUrl: mockResult.mockUrl,
        });
      } else {
        results.mocks.failed.push({
          name: mockName,
          error: mockResult.error,
        });
        results.errors.push(`Failed to create mock ${mockName}: ${mockResult.error}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Step 4: Copy Environments
    onProgress?.({
      phase: 'environments',
      message: 'Copying environments...',
      progress: 60,
    });

    const sourceEnvironments = await getAllEnvironments(sourceWorkspaceId);
    results.environments.total = sourceEnvironments.length;

    const envMap = new Map(); // Map source UID to target UID

    for (let i = 0; i < sourceEnvironments.length; i++) {
      const env = sourceEnvironments[i];
      
      onProgress?.({
        phase: 'environments',
        message: `Copying: ${env.name}`,
        current: i + 1,
        total: sourceEnvironments.length,
        progress: 60 + (i / sourceEnvironments.length) * 10,
      });

      const envDetails = await getEnvironmentDetails(env.uid);
      if (!envDetails) {
        results.environments.failed.push({
          name: env.name,
          error: 'Could not get environment details',
        });
        continue;
      }

      const createResult = await createEnvironmentInPostman(envDetails.name, envDetails.values || [], workspaceId);
      
      if (createResult.success) {
        results.environments.success++;
        results.environments.successData.push({
          name: createResult.environmentName,
          uid: createResult.uid,
        });
        envMap.set(env.uid, { targetUid: createResult.uid, name: envDetails.name });
      } else {
        results.environments.failed.push({
          name: envDetails.name,
          error: createResult.error,
        });
        results.errors.push(`Failed to copy ${envDetails.name}: ${createResult.error}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Step 5: Update/Create Mock Env with mock URLs
    onProgress?.({
      phase: 'mockEnv',
      message: 'Updating Mock Environment...',
      progress: 75,
    });

    if (results.mocks.urls.length > 0) {
      // Create mock URL variables
      const mockVariables = results.mocks.urls.map((mock, index) => ({
        key: `mock_url_${index + 1}`,
        value: mock.mockUrl,
        type: 'default',
        enabled: true,
        description: `Mock server URL for ${mock.collectionName}`,
      }));

      // Find existing Mock Env
      let mockEnv = null;
      for (const [, envData] of envMap) {
        const normalizedName = envData.name.toLowerCase();
        if (MOCK_ENV_NAMES.some(name => normalizedName === name.toLowerCase())) {
          mockEnv = envData;
          break;
        }
      }

      if (mockEnv) {
        // Update existing Mock Env
        const envDetails = await getEnvironmentDetails(mockEnv.targetUid);
        const existingValues = envDetails?.values || [];
        const mergedValues = [...existingValues, ...mockVariables];
        
        const updateResult = await updateEnvironment(mockEnv.targetUid, mockEnv.name, mergedValues);
        
        if (updateResult.success) {
          results.mockEnv.success = true;
          results.mockEnv.action = 'updated';
        } else {
          results.errors.push(`Failed to update Mock Env: ${updateResult.error}`);
        }
      } else {
        // Create new Mock Env
        const createResult = await createEnvironmentInPostman('Mock Env', mockVariables, workspaceId);
        
        if (createResult.success) {
          results.mockEnv.success = true;
          results.mockEnv.action = 'created';
        } else {
          results.errors.push(`Failed to create Mock Env: ${createResult.error}`);
        }
      }
    }

    // Step 6: Copy Specs
    onProgress?.({
      phase: 'specs',
      message: 'Copying specs...',
      progress: 80,
    });

    const sourceSpecs = await getAllSpecs(sourceWorkspaceId);
    results.specs.total = sourceSpecs.length;

    for (let i = 0; i < sourceSpecs.length; i++) {
      const spec = sourceSpecs[i];
      
      onProgress?.({
        phase: 'specs',
        message: `Copying: ${spec.name}`,
        current: i + 1,
        total: sourceSpecs.length,
        progress: 80 + (i / sourceSpecs.length) * 15,
      });

      const copyResult = await copySpec(spec.id, spec.name, spec.type, workspaceId);
      
      if (copyResult.success) {
        results.specs.success++;
        results.specs.successData.push({
          name: copyResult.specName,
          id: copyResult.newSpecId,
          filesCopied: copyResult.filesCopied,
        });
      } else {
        results.specs.failed.push({
          name: spec.name,
          error: copyResult.errors.join('; '),
        });
        results.errors.push(`Failed to copy spec ${spec.name}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Step 7: Add Team Admins (if provided)
    if (adminUserIds.length > 0) {
      onProgress?.({
        phase: 'admins',
        message: 'Adding workspace admins...',
        progress: 88,
      });

      results.admins.total = adminUserIds.length;

      for (let i = 0; i < adminUserIds.length; i++) {
        const userId = adminUserIds[i];

        onProgress?.({
          phase: 'admins',
          message: `Adding admin: ${userId}`,
          current: i + 1,
          total: adminUserIds.length,
          progress: 88 + (i / adminUserIds.length) * 5,
        });

        const addResult = await addWorkspaceAdmin(workspaceId, userId, "3");

        if (addResult.success) {
          results.admins.success++;
          results.admins.successData.push({
            userId,
            roleId: "3",
          });
        } else {
          results.admins.failed.push({
            userId,
            error: addResult.error,
          });
          results.errors.push(`Failed to add admin ${userId}: ${addResult.error}`);
        }

        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // Step 8: Invite Partners (if provided)
    if (partnerEmails.length > 0) {
      onProgress?.({
        phase: 'invitations',
        message: 'Inviting partners...',
        progress: 93,
      });

      results.invitations.total = partnerEmails.length;

      for (let i = 0; i < partnerEmails.length; i++) {
        const email = partnerEmails[i];

        onProgress?.({
          phase: 'invitations',
          message: `Inviting partner: ${email}`,
          current: i + 1,
          total: partnerEmails.length,
          progress: 93 + (i / partnerEmails.length) * 6,
        });

        const inviteResult = await invitePartner(workspaceId, email, partnerRoleId);

        if (inviteResult.success) {
          results.invitations.success++;
          
          const inviteData = {
            email: inviteResult.email,
            status: inviteResult.status,
            invitationLink: inviteResult.invitationLink,
            userId: inviteResult.userId,
            roleDisplayName: inviteResult.roleDisplayName,
          };
          
          // Add to links array if there's an invitation link
          if (inviteResult.invitationLink) {
            results.invitations.links.push({
              email: inviteResult.email,
              invitationLink: inviteResult.invitationLink,
              status: inviteResult.status,
            });
          }
        } else {
          results.invitations.failed.push({
            email,
            error: inviteResult.error,
          });
          results.errors.push(`Failed to invite partner ${email}: ${inviteResult.error}`);
        }

        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // Complete
    onProgress?.({
      phase: 'complete',
      message: 'Provisioning complete!',
      progress: 100,
      results,
    });

    return results;

  } catch (error) {
    results.errors.push(error.message);
    onProgress?.({
      phase: 'error',
      message: `Error: ${error.message}`,
      progress: 0,
      results,
    });
    throw error;
  }
};

/**
 * Simplified provisioning - creates a new workspace and copies all content
 * @param {string} sourceWorkspaceId - Source workspace ID
 * @param {string} workspaceName - Name for the new workspace
 * @param {object} options - Additional options
 * @param {function} onProgress - Progress callback
 * @returns {Promise<object>} Provisioning results
 */
export const quickProvision = async (sourceWorkspaceId, workspaceName, options = {}, onProgress) => {
  return provisionWorkspace({
    sourceWorkspaceId,
    workspaceName,
    workspaceType: options.workspaceType || 'partner',
    ...options,
  }, onProgress);
};

// ============================================================================
// CONFIGURATION & UTILITIES
// ============================================================================

/**
 * Check if Postman is properly configured for basic operations
 * Note: Target workspace is optional if you plan to create a new one
 */
export const isPostmanConfigured = () => {
  return !!(POSTMAN_API_KEY && POSTMAN_SOURCE_WORKSPACE_ID);
};

/**
 * Check if Postman is fully configured (including target workspace)
 */
export const isPostmanFullyConfigured = () => {
  return !!(POSTMAN_API_KEY && POSTMAN_TARGET_WORKSPACE_ID && POSTMAN_SOURCE_WORKSPACE_ID);
};

/**
 * Get configuration status for debugging
 */
export const getConfigurationStatus = () => {
  return {
    hasApiKey: !!POSTMAN_API_KEY,
    hasTargetWorkspace: !!POSTMAN_TARGET_WORKSPACE_ID,
    hasSourceWorkspace: !!POSTMAN_SOURCE_WORKSPACE_ID,
    isConfigured: isPostmanConfigured(),
    isFullyConfigured: isPostmanFullyConfigured(),
    message: !POSTMAN_API_KEY 
      ? 'Missing API key (VITE_POSTMAN_API_KEY)'
      : !POSTMAN_SOURCE_WORKSPACE_ID 
        ? 'Missing source workspace ID (VITE_POSTMAN_SOURCE_WORKSPACE_ID)'
        : !POSTMAN_TARGET_WORKSPACE_ID
          ? 'Target workspace ID not set - will create new workspace'
          : 'Fully configured',
  };
};

/**
 * Validate API key by making a test request
 * @returns {Promise<{valid: boolean, user?: object, error?: string}>}
 */
export const validateApiKey = async () => {
  try {
    const response = await axios.get(`${POSTMAN_API_BASE}/me`, {
      headers: {
        "X-Api-Key": POSTMAN_API_KEY || "",
      },
    });
    return {
      valid: true,
      user: response.data.user,
    };
  } catch (error) {
    return {
      valid: false,
      error: axios.isAxiosError(error)
        ? error.response?.data?.error?.message || error.message
        : 'Unknown error',
    };
  }
};

/**
 * Get a summary of workspace contents
 * @param {string} workspaceId - The workspace ID
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
    counts: {
      collections: collections.length,
      environments: environments.length,
      mocks: mocks.length,
      apis: apis.length,
    },
    items: {
      collections: collections.map(c => ({ id: c.id, uid: c.uid, name: c.name })),
      environments: environments.map(e => ({ id: e.id, uid: e.uid, name: e.name })),
      mocks: mocks.map(m => ({ id: m.id, uid: m.uid, name: m.name })),
      apis: apis.map(a => ({ id: a.id, name: a.name })),
    },
  };
};

// ============================================================================
// CUSTOM PROVISIONING & RESET
// ============================================================================

/**
 * Get available collections from a workspace for UI selection
 * Returns collection data formatted for checkbox/checklist UI
 * 
 * @param {string} workspaceId - Source workspace ID
 * @returns {Promise<Array>} Array of collection objects with selection metadata
 */
export const getAvailableCollections = async (workspaceId) => {
  try {
    const collections = await getAllCollections(workspaceId);
    
    return collections.map(collection => ({
      id: collection.id,
      uid: collection.uid,
      name: collection.name,
      selected: false, // Default selection state for UI
      metadata: {
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt,
      },
    }));
  } catch (error) {
    console.error('Error getting available collections:', error);
    return [];
  }
};

/**
 * Get available resources from a workspace for UI selection
 * Returns all resource types formatted for checkbox/checklist UI
 * 
 * @param {string} workspaceId - Source workspace ID
 * @returns {Promise<object>} Object with arrays of each resource type
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
      collections: collections.map(c => ({
        id: c.id,
        uid: c.uid,
        name: c.name,
        selected: false,
      })),
      environments: environments.map(e => ({
        id: e.id,
        uid: e.uid,
        name: e.name,
        selected: false,
      })),
      mocks: mocks.map(m => ({
        id: m.id,
        uid: m.uid,
        name: m.name,
        selected: false,
        collectionUid: m.collection,
      })),
      specs: specs.map(s => ({
        id: s.id,
        name: s.name,
        type: s.type,
        selected: false,
      })),
    };
  } catch (error) {
    console.error('Error getting available resources:', error);
    return {
      collections: [],
      environments: [],
      mocks: [],
      specs: [],
    };
  }
};

/**
 * Custom Workspace Provisioning
 * 
 * Provision a workspace with selective resource copying.
 * Allows you to choose which asset types to copy and optionally select specific items.
 * 
 * @param {object} options - Provisioning options
 * @param {string} options.sourceWorkspaceId - Source workspace ID (required)
 * @param {string} options.targetWorkspaceId - Target workspace ID (optional - creates new if not provided)
 * @param {string} options.workspaceName - Name for new workspace (required if targetWorkspaceId not provided)
 * @param {string} options.workspaceType - Workspace type: 'partner' | 'team' | 'private' (default: 'partner')
 * @param {boolean} options.copyCollections - Copy collections (default: true)
 * @param {boolean} options.copyEnvironments - Copy environments (default: true)
 * @param {boolean} options.copyMocks - Create mock servers (default: true)
 * @param {boolean} options.copySpecs - Copy API specs (default: true)
 * @param {Array<string>} options.selectedCollectionUids - Specific collection UIDs to copy (optional)
 * @param {Array<string>} options.selectedEnvironmentUids - Specific environment UIDs to copy (optional)
 * @param {Array<string>} options.selectedSpecIds - Specific spec IDs to copy (optional)
 * @param {boolean} options.createMockEnv - Create/update Mock Env with mock URLs (default: true)
 * @param {boolean} options.addAdmins - Add admins step (default: true)
 * @param {boolean} options.invitePartners - Invite partners step (default: true)
 * @param {Array<string>} options.adminUserIds - Array of user IDs to add as admins (optional)
 * @param {Array<string>} options.partnerEmails - Array of emails to invite as partners (optional)
 * @param {string} options.partnerRoleId - Partner role ID (default: "7" for Editor and Partner Lead)
 * @param {function} onProgress - Progress callback
 * @returns {Promise<object>} Provisioning results including invitation links
 */
export const provisionCustomWorkspace = async (options, onProgress) => {
  const {
    sourceWorkspaceId,
    targetWorkspaceId,
    workspaceName = 'Partner Workspace',
    workspaceType = 'partner',
    copyCollections = true,
    copyEnvironments = true,
    copyMocks = true,
    copySpecs = true,
    selectedCollectionUids = null, // null = all collections
    selectedEnvironmentUids = null, // null = all environments
    selectedSpecIds = null, // null = all specs
    createMockEnv = true,
    addAdmins = true,           // NEW: Add admins step
    invitePartners = true,      // NEW: Invite partners step
    adminUserIds = [],          // NEW: Array of user IDs to add as admins
    partnerEmails = [],         // NEW: Array of emails to invite as partners
    partnerRoleId = "7",        // NEW: Partner role (default: Editor and Partner Lead)
  } = options;

  if (!POSTMAN_API_KEY) {
    throw new Error('Postman API key not configured');
  }

  if (!sourceWorkspaceId) {
    throw new Error('Source workspace ID is required');
  }

  const results = {
    workspace: null,
    workspaceCreated: false,
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
    // Validation
    onProgress?.({
      phase: 'validation',
      message: 'Validating configuration...',
      progress: 5,
    });

    const validation = await validateApiKey();
    if (!validation.valid) {
      throw new Error(`Invalid API key: ${validation.error}`);
    }

    const sourceWorkspace = await getWorkspace(sourceWorkspaceId);
    if (!sourceWorkspace) {
      throw new Error(`Source workspace not found: ${sourceWorkspaceId}`);
    }

    // Initialize target workspace
    onProgress?.({
      phase: 'workspace',
      message: targetWorkspaceId ? 'Using existing workspace...' : 'Creating new workspace...',
      progress: 10,
    });

    let workspaceId = targetWorkspaceId;
    
    if (targetWorkspaceId) {
      const existingWorkspace = await getWorkspace(targetWorkspaceId);
      if (!existingWorkspace) {
        throw new Error(`Target workspace not found: ${targetWorkspaceId}`);
      }
      results.workspace = existingWorkspace;
      results.workspaceCreated = false;
    } else {
      if (!workspaceName) {
        throw new Error('Workspace name is required when creating a new workspace');
      }
      
      const createResult = await createWorkspace(workspaceName, workspaceType);
      if (!createResult.success) {
        throw new Error(`Failed to create workspace: ${createResult.error}`);
      }
      
      workspaceId = createResult.workspace.id;
      results.workspace = createResult.workspace;
      results.workspaceCreated = true;
    }

    // Copy Collections (with optional filtering)
    if (copyCollections) {
      onProgress?.({
        phase: 'collections',
        message: 'Copying collections...',
        progress: 20,
      });

      let sourceCollections = await getAllCollections(sourceWorkspaceId);
      
      // Filter by selected UIDs if provided
      if (selectedCollectionUids && selectedCollectionUids.length > 0) {
        sourceCollections = sourceCollections.filter(c => selectedCollectionUids.includes(c.uid));
      }
      
      results.collections.total = sourceCollections.length;

      const collectionMap = new Map();

      for (let i = 0; i < sourceCollections.length; i++) {
        const collection = sourceCollections[i];
        
        onProgress?.({
          phase: 'collections',
          message: `Forking: ${collection.name}`,
          current: i + 1,
          total: sourceCollections.length,
          progress: 20 + (i / sourceCollections.length) * 15,
        });

        const forkResult = await forkCollection(collection.uid, collection.name, workspaceId);
        
        if (forkResult.success) {
          results.collections.success++;
          results.collections.successData.push({
            name: forkResult.collectionName,
            uid: forkResult.uid,
          });
          collectionMap.set(collection.uid, forkResult.uid);
        } else {
          results.collections.failed.push({
            name: collection.name,
            error: forkResult.error,
          });
          results.errors.push(`Failed to fork ${collection.name}: ${forkResult.error}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Create Mock Servers (if enabled and collections were copied)
      if (copyMocks && results.collections.successData.length > 0) {
        onProgress?.({
          phase: 'mocks',
          message: 'Creating mock servers...',
          progress: 40,
        });

        results.mocks.total = results.collections.successData.length;

        for (let i = 0; i < results.collections.successData.length; i++) {
          const collection = results.collections.successData[i];
          const mockName = `${collection.name} Mock`;
          
          onProgress?.({
            phase: 'mocks',
            message: `Creating: ${mockName}`,
            current: i + 1,
            total: results.collections.successData.length,
            progress: 40 + (i / results.collections.successData.length) * 15,
          });

          const mockResult = await createMockServer(mockName, collection.uid, workspaceId, null);
          
          if (mockResult.success) {
            results.mocks.success++;
            results.mocks.urls.push({
              collectionName: collection.name,
              mockName: mockResult.mockName,
              mockUrl: mockResult.mockUrl,
            });
          } else {
            results.mocks.failed.push({
              name: mockName,
              error: mockResult.error,
            });
            results.errors.push(`Failed to create mock ${mockName}: ${mockResult.error}`);
          }
          
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }

    // Copy Environments (with optional filtering)
    if (copyEnvironments) {
      onProgress?.({
        phase: 'environments',
        message: 'Copying environments...',
        progress: 60,
      });

      let sourceEnvironments = await getAllEnvironments(sourceWorkspaceId);
      
      // Filter by selected UIDs if provided
      if (selectedEnvironmentUids && selectedEnvironmentUids.length > 0) {
        sourceEnvironments = sourceEnvironments.filter(e => selectedEnvironmentUids.includes(e.uid));
      }
      
      results.environments.total = sourceEnvironments.length;

      const envMap = new Map();

      for (let i = 0; i < sourceEnvironments.length; i++) {
        const env = sourceEnvironments[i];
        
        onProgress?.({
          phase: 'environments',
          message: `Copying: ${env.name}`,
          current: i + 1,
          total: sourceEnvironments.length,
          progress: 60 + (i / sourceEnvironments.length) * 10,
        });

        const envDetails = await getEnvironmentDetails(env.uid);
        if (!envDetails) {
          results.environments.failed.push({
            name: env.name,
            error: 'Could not get environment details',
          });
          continue;
        }

        const createResult = await createEnvironmentInPostman(envDetails.name, envDetails.values || [], workspaceId);
        
        if (createResult.success) {
          results.environments.success++;
          results.environments.successData.push({
            name: createResult.environmentName,
            uid: createResult.uid,
          });
          envMap.set(env.uid, { targetUid: createResult.uid, name: envDetails.name });
        } else {
          results.environments.failed.push({
            name: envDetails.name,
            error: createResult.error,
          });
          results.errors.push(`Failed to copy ${envDetails.name}: ${createResult.error}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Update/Create Mock Env (if enabled and mocks were created)
      if (createMockEnv && results.mocks.urls.length > 0) {
        onProgress?.({
          phase: 'mockEnv',
          message: 'Updating Mock Environment...',
          progress: 75,
        });

        const mockVariables = results.mocks.urls.map((mock, index) => ({
          key: `mock_url_${index + 1}`,
          value: mock.mockUrl,
          type: 'default',
          enabled: true,
          description: `Mock server URL for ${mock.collectionName}`,
        }));

        // Find existing Mock Env
        let mockEnv = null;
        for (const [, envData] of envMap) {
          const normalizedName = envData.name.toLowerCase();
          if (MOCK_ENV_NAMES.some(name => normalizedName === name.toLowerCase())) {
            mockEnv = envData;
            break;
          }
        }

        if (mockEnv) {
          const envDetails = await getEnvironmentDetails(mockEnv.targetUid);
          const existingValues = envDetails?.values || [];
          const mergedValues = [...existingValues, ...mockVariables];
          
          const updateResult = await updateEnvironment(mockEnv.targetUid, mockEnv.name, mergedValues);
          
          if (updateResult.success) {
            results.mockEnv.success = true;
            results.mockEnv.action = 'updated';
          } else {
            results.errors.push(`Failed to update Mock Env: ${updateResult.error}`);
          }
        } else {
          const createResult = await createEnvironmentInPostman('Mock Env', mockVariables, workspaceId);
          
          if (createResult.success) {
            results.mockEnv.success = true;
            results.mockEnv.action = 'created';
          } else {
            results.errors.push(`Failed to create Mock Env: ${createResult.error}`);
          }
        }
      }
    }

    // Copy Specs (with optional filtering)
    if (copySpecs) {
      onProgress?.({
        phase: 'specs',
        message: 'Copying specs...',
        progress: 80,
      });

      let sourceSpecs = await getAllSpecs(sourceWorkspaceId);
      
      // Filter by selected IDs if provided
      if (selectedSpecIds && selectedSpecIds.length > 0) {
        sourceSpecs = sourceSpecs.filter(s => selectedSpecIds.includes(s.id));
      }
      
      results.specs.total = sourceSpecs.length;

      for (let i = 0; i < sourceSpecs.length; i++) {
        const spec = sourceSpecs[i];
        
        onProgress?.({
          phase: 'specs',
          message: `Copying: ${spec.name}`,
          current: i + 1,
          total: sourceSpecs.length,
          progress: 80 + (i / sourceSpecs.length) * 15,
        });

        const copyResult = await copySpec(spec.id, spec.name, spec.type, workspaceId);
        
        if (copyResult.success) {
          results.specs.success++;
          results.specs.successData.push({
            name: copyResult.specName,
            id: copyResult.newSpecId,
            filesCopied: copyResult.filesCopied,
          });
        } else {
          results.specs.failed.push({
            name: spec.name,
            error: copyResult.errors.join('; '),
          });
          results.errors.push(`Failed to copy spec ${spec.name}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Add Team Admins (if enabled and provided)
    if (addAdmins && adminUserIds.length > 0) {
      onProgress?.({
        phase: 'admins',
        message: 'Adding workspace admins...',
        progress: 88,
      });

      results.admins.total = adminUserIds.length;

      for (let i = 0; i < adminUserIds.length; i++) {
        const userId = adminUserIds[i];

        onProgress?.({
          phase: 'admins',
          message: `Adding admin: ${userId}`,
          current: i + 1,
          total: adminUserIds.length,
          progress: 88 + (i / adminUserIds.length) * 5,
        });

        const addResult = await addWorkspaceAdmin(workspaceId, userId, "3");

        if (addResult.success) {
          results.admins.success++;
          results.admins.successData.push({
            userId,
            roleId: "3",
          });
        } else {
          results.admins.failed.push({
            userId,
            error: addResult.error,
          });
          results.errors.push(`Failed to add admin ${userId}: ${addResult.error}`);
        }

        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // Invite Partners (if enabled and provided)
    if (invitePartners && partnerEmails.length > 0) {
      onProgress?.({
        phase: 'invitations',
        message: 'Inviting partners...',
        progress: 93,
      });

      results.invitations.total = partnerEmails.length;

      for (let i = 0; i < partnerEmails.length; i++) {
        const email = partnerEmails[i];

        onProgress?.({
          phase: 'invitations',
          message: `Inviting partner: ${email}`,
          current: i + 1,
          total: partnerEmails.length,
          progress: 93 + (i / partnerEmails.length) * 6,
        });

        const inviteResult = await invitePartner(workspaceId, email, partnerRoleId);

        if (inviteResult.success) {
          results.invitations.success++;
          
          // Add to links array if there's an invitation link
          if (inviteResult.invitationLink) {
            results.invitations.links.push({
              email: inviteResult.email,
              invitationLink: inviteResult.invitationLink,
              status: inviteResult.status,
            });
          }
        } else {
          results.invitations.failed.push({
            email,
            error: inviteResult.error,
          });
          results.errors.push(`Failed to invite partner ${email}: ${inviteResult.error}`);
        }

        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // Complete
    onProgress?.({
      phase: 'complete',
      message: 'Custom provisioning complete!',
      progress: 100,
      results,
    });

    return results;

  } catch (error) {
    results.errors.push(error.message);
    onProgress?.({
      phase: 'error',
      message: `Error: ${error.message}`,
      progress: 0,
      results,
    });
    throw error;
  }
};

/**
 * Custom Workspace Reset
 * 
 * Reset a workspace with selective resource deletion.
 * Allows you to choose which asset types to delete and optionally select specific items.
 * 
 * @param {string} workspaceId - Workspace ID to reset (required)
 * @param {function} onProgress - Progress callback
 * @param {object} options - Reset options
 * @param {boolean} options.includeSpecs - Delete specs (default: true)
 * @param {boolean} options.includeMocks - Delete mocks (default: true)
 * @param {boolean} options.includeEnvironments - Delete environments (default: true)
 * @param {boolean} options.includeCollections - Delete collections (default: true)
 * @param {Array<string>} options.selectedCollectionUids - Specific collection UIDs to delete (optional)
 * @param {Array<string>} options.selectedEnvironmentUids - Specific environment UIDs to delete (optional)
 * @param {Array<string>} options.selectedMockIds - Specific mock IDs to delete (optional)
 * @param {Array<string>} options.selectedSpecIds - Specific spec IDs to delete (optional)
 * @returns {Promise<object>} Reset results
 */
export const resetCustomWorkspace = async (workspaceId, onProgress, options = {}) => {
  const {
    includeSpecs = true,
    includeMocks = true,
    includeEnvironments = true,
    includeCollections = true,
    selectedCollectionUids = null, // null = all collections
    selectedEnvironmentUids = null, // null = all environments
    selectedMockIds = null, // null = all mocks
    selectedSpecIds = null, // null = all specs
  } = options;

  const result = {
    deletedSpecs: 0,
    deletedMocks: 0,
    deletedEnvironments: 0,
    deletedCollections: 0,
    totalSpecs: 0,
    totalMocks: 0,
    totalEnvironments: 0,
    totalCollections: 0,
    errors: [],
  };

  try {
    // STEP 1: Delete Specs
    if (includeSpecs) {
      let specs = await getAllSpecs(workspaceId);
      
      // Filter by selected IDs if provided
      if (selectedSpecIds && selectedSpecIds.length > 0) {
        specs = specs.filter(s => selectedSpecIds.includes(s.id));
      }
      
      result.totalSpecs = specs.length;
      
      onProgress?.({
        phase: 'specs',
        message: `Deleting ${specs.length} spec(s)...`,
        deleted: 0,
        total: specs.length,
      });

      for (const spec of specs) {
        const success = await deleteSpec(spec.id);
        if (success) {
          result.deletedSpecs++;
        } else {
          result.errors.push(`Failed to delete spec: ${spec.name}`);
        }
        
        onProgress?.({
          phase: 'specs',
          deleted: result.deletedSpecs,
          total: specs.length,
          currentItem: spec.name,
        });
        
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    // STEP 2: Delete Mocks
    if (includeMocks) {
      let mocks = await getAllMocks(workspaceId);
      
      // Filter by selected IDs if provided
      if (selectedMockIds && selectedMockIds.length > 0) {
        mocks = mocks.filter(m => selectedMockIds.includes(m.id));
      }
      
      result.totalMocks = mocks.length;
      
      onProgress?.({
        phase: 'mocks',
        message: `Deleting ${mocks.length} mock server(s)...`,
        deleted: 0,
        total: mocks.length,
      });

      for (const mock of mocks) {
        const success = await deleteMock(mock.id);
        if (success) {
          result.deletedMocks++;
        } else {
          result.errors.push(`Failed to delete mock: ${mock.name}`);
        }
        
        onProgress?.({
          phase: 'mocks',
          deleted: result.deletedMocks,
          total: mocks.length,
          currentItem: mock.name,
        });
        
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    // STEP 3: Delete Environments
    if (includeEnvironments) {
      let environments = await getAllEnvironments(workspaceId);
      
      // Filter by selected UIDs if provided
      if (selectedEnvironmentUids && selectedEnvironmentUids.length > 0) {
        environments = environments.filter(e => selectedEnvironmentUids.includes(e.uid));
      }
      
      result.totalEnvironments = environments.length;
      
      onProgress?.({
        phase: 'environments',
        message: `Deleting ${environments.length} environment(s)...`,
        deleted: 0,
        total: environments.length,
      });

      for (const environment of environments) {
        const success = await deleteEnvironment(environment.uid);
        if (success) {
          result.deletedEnvironments++;
        } else {
          result.errors.push(`Failed to delete environment: ${environment.name}`);
        }
        
        onProgress?.({
          phase: 'environments',
          deleted: result.deletedEnvironments,
          total: environments.length,
          currentItem: environment.name,
        });
        
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    // STEP 4: Delete Collections
    if (includeCollections) {
      let collections = await getAllCollections(workspaceId);
      
      // Filter by selected UIDs if provided
      if (selectedCollectionUids && selectedCollectionUids.length > 0) {
        collections = collections.filter(c => selectedCollectionUids.includes(c.uid));
      }
      
      result.totalCollections = collections.length;
      
      onProgress?.({
        phase: 'collections',
        message: `Deleting ${collections.length} collection(s)...`,
        deleted: 0,
        total: collections.length,
      });

      for (const collection of collections) {
        const success = await deleteCollection(collection.uid);
        if (success) {
          result.deletedCollections++;
        } else {
          result.errors.push(`Failed to delete collection: ${collection.name}`);
        }
        
        onProgress?.({
          phase: 'collections',
          deleted: result.deletedCollections,
          total: collections.length,
          currentItem: collection.name,
        });
        
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    onProgress?.({
      phase: 'complete',
      message: 'Custom reset complete',
      result,
    });

    return result;
  } catch (error) {
    result.errors.push(`Unexpected error: ${error.message}`);
    onProgress?.({
      phase: 'error',
      message: error.message,
      result,
    });
    throw error;
  }
};