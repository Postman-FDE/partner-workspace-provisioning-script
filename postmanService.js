import axios from "axios";

const POSTMAN_API_KEY = import.meta.env.VITE_POSTMAN_API_KEY;
const POSTMAN_TARGET_WORKSPACE_ID = import.meta.env.VITE_POSTMAN_TARGET_WORKSPACE_ID;
const POSTMAN_SOURCE_WORKSPACE_ID = import.meta.env.VITE_POSTMAN_SOURCE_WORKSPACE_ID;
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

// Reset workspace - delete all collections, environments, mocks, and APIs
export const resetWorkspace = async (workspaceId, onProgress, options = {}) => {
  const { 
    includeCollections = true, 
    includeEnvironments = true, 
    includeMocks = true,
    includeApis = true,
  } = options;

  const result = { 
    deletedCollections: 0, 
    deletedEnvironments: 0, 
    deletedMocks: 0,
    deletedApis: 0,
  };

  // Delete all collections
  if (includeCollections) {
    const collections = await getAllCollections(workspaceId);
    for (const collection of collections) {
      const success = await deleteCollection(collection.uid);
      if (success) result.deletedCollections++;
      if (onProgress) {
        onProgress({
          phase: 'collections',
          deleted: result.deletedCollections,
          total: collections.length,
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  // Delete all environments
  if (includeEnvironments) {
    const environments = await getAllEnvironments(workspaceId);
    for (const environment of environments) {
      const success = await deleteEnvironment(environment.uid);
      if (success) result.deletedEnvironments++;
      if (onProgress) {
        onProgress({
          phase: 'environments',
          deleted: result.deletedEnvironments,
          total: environments.length,
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  // Delete all mocks
  if (includeMocks) {
    const mocks = await getAllMocks(workspaceId);
    for (const mock of mocks) {
      // Use mock.id (not mock.uid) for deletion
      const success = await deleteMock(mock.id);
      if (success) result.deletedMocks++;
      if (onProgress) {
        onProgress({
          phase: 'mocks',
          deleted: result.deletedMocks,
          total: mocks.length,
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  // Delete all specs
  if (includeApis) {
    const specs = await getAllSpecs(workspaceId);
    for (const spec of specs) {
      const success = await deleteSpec(spec.id);
      if (success) result.deletedApis++;
      if (onProgress) {
        onProgress({
          phase: 'specs',
          deleted: result.deletedApis,
          total: specs.length,
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return result;
};

// API to Collection mapping - maps API names to collection name patterns
// Update these values to match patterns in your Postman source workspace collection names
export const apiToCollectionMapping = {
  'Authentication': 'Authentication',
  'Account Services': 'Account Services',
  'Outgoing Payments': 'Outgoing Payments',
  'Payment Acceptance': 'Payment Acceptance',
  'Commercial Cards': 'Commercial Cards',
  'Trade': 'Trade',
  'Additional Payment Services': 'Additional Payment Services',
};

// Find matching collections for selected APIs using pattern/keyword matching
// Returns collections whose names contain the mapped pattern (case-insensitive)
export const findMatchingCollections = (sourceCollections, selectedApis) => {
  const matchedCollections = [];
  
  for (const api of selectedApis) {
    // Get the pattern for this API
    const pattern = apiToCollectionMapping[api];
    
    if (!pattern) {
      console.warn(`No collection mapping found for API: ${api}`);
      continue;
    }
    
    // Find collections that contain the pattern (case-insensitive)
    for (const collection of sourceCollections) {
      const collectionNameLower = collection.name.toLowerCase();
      const patternLower = pattern.toLowerCase();
      const isMatch = collectionNameLower.includes(patternLower);
      
      if (isMatch && !matchedCollections.find(c => c.id === collection.id)) {
        matchedCollections.push({
          ...collection,
          matchedApi: api,
        });
      }
    }
  }
  
  return matchedCollections;
};

/**
 * Main function to provision workspace with selected APIs
 * Now supports both creating a new workspace or using an existing one
 * Also supports copying API specs from source workspace
 * 
 * @param {object} options - Provisioning options
 * @param {string} options.workspaceName - Name for the workspace/provisioning label
 * @param {Array<string>} options.selectedApis - Array of API names to provision (matches apiToCollectionMapping)
 * @param {string} options.targetWorkspaceId - Existing target workspace ID (optional - if not provided, creates new)
 * @param {string} options.workspaceType - Type of workspace to create: 'personal', 'private', 'team', 'public'
 * @param {string} options.workspaceDescription - Description for new workspace
 * @param {boolean} options.copyCollections - Whether to copy/fork collections (default: true)
 * @param {boolean} options.copySpecs - Whether to copy API specs (default: false)
 * @param {boolean} options.createEnvironment - Whether to create an environment (default: true)
 * @param {Array<object>} options.environmentVariables - Custom environment variables (optional)
 * @param {function} onStatusUpdate - Progress callback
 * @returns {Promise<object>} Results of the provisioning
 */
export const provisionWorkspace = async (options, onStatusUpdate) => {
  // Support legacy call signature: provisionWorkspace(workspaceName, selectedApis, onStatusUpdate)
  let config;
  if (typeof options === 'string') {
    config = {
      workspaceName: options,
      selectedApis: onStatusUpdate,
      targetWorkspaceId: POSTMAN_TARGET_WORKSPACE_ID,
      copyCollections: true,
      copySpecs: false,
      createEnvironment: true,
    };
    onStatusUpdate = arguments[2];
  } else {
    config = {
      workspaceName: options.workspaceName,
      selectedApis: options.selectedApis || [],
      targetWorkspaceId: options.targetWorkspaceId || POSTMAN_TARGET_WORKSPACE_ID,
      workspaceType: options.workspaceType || 'team',
      workspaceDescription: options.workspaceDescription || '',
      copyCollections: options.copyCollections !== false,
      copySpecs: options.copySpecs === true,
      createEnvironment: options.createEnvironment !== false,
      environmentVariables: options.environmentVariables || null,
    };
  }

  if (!POSTMAN_API_KEY) {
    throw new Error('Postman API key not configured. Please set VITE_POSTMAN_API_KEY');
  }

  const results = {
    workspace: null,
    workspaceCreated: false,
    collections: [],
    specs: [],
    environments: [],
    errors: [],
    summary: {
      totalCollections: 0,
      successfulCollections: 0,
      totalSpecs: 0,
      successfulSpecs: 0,
      totalEnvironments: 0,
      successfulEnvironments: 0,
    },
  };

  let workspaceId = config.targetWorkspaceId;

  try {
    // Phase 1: Initialize/Create workspace
    onStatusUpdate?.({
      phase: 'workspace',
      message: workspaceId 
        ? 'Verifying target workspace...' 
        : `Creating new workspace: ${config.workspaceName}...`,
      progress: 5,
    });

    const workspaceInit = await initializeTargetWorkspace({
      targetWorkspaceId: workspaceId,
      newWorkspaceName: config.workspaceName,
      workspaceType: config.workspaceType,
      description: config.workspaceDescription,
    });

    if (!workspaceInit.success) {
      throw new Error(workspaceInit.error);
    }

    workspaceId = workspaceInit.workspaceId;
    results.workspace = workspaceInit.workspace;
    results.workspaceCreated = workspaceInit.created;

    onStatusUpdate?.({
      phase: 'workspace',
      message: workspaceInit.created 
        ? `Created new workspace: ${results.workspace.name}` 
        : `Using existing workspace: ${results.workspace.name}`,
      progress: 10,
    });

    // Phase 2: Copy Collections (if enabled)
    if (config.copyCollections && config.selectedApis.length > 0) {
      onStatusUpdate?.({
        phase: 'fetching',
        message: 'Fetching available collections from source workspace...',
        progress: 15,
      });
      
      const sourceCollections = await getSourceCollections();
      
      if (sourceCollections.length === 0) {
        onStatusUpdate?.({
          phase: 'warning',
          message: 'No collections found in source workspace.',
          progress: 20,
        });
      } else {
        // Find matching collections for selected APIs
        onStatusUpdate?.({
          phase: 'matching',
          message: `Matching collections for ${config.selectedApis.length} selected API(s)...`,
          progress: 25,
        });
        
        const matchedCollections = findMatchingCollections(sourceCollections, config.selectedApis);
        results.summary.totalCollections = matchedCollections.length;

        // Log which APIs didn't have matching collections
        const unmatchedApis = config.selectedApis.filter(api => 
          !matchedCollections.find(c => c.matchedApi === api)
        );
        
        if (unmatchedApis.length > 0) {
          const warningMsg = `No matching collections found for: ${unmatchedApis.join(', ')}. ` +
            `Please ensure collection names in source workspace match the API names exactly.`;
          console.warn(warningMsg);
          results.errors.push(warningMsg);
        }

        // Fork each matched collection
        if (matchedCollections.length > 0) {
          for (let i = 0; i < matchedCollections.length; i++) {
            const collection = matchedCollections[i];
            const progressPercent = 30 + (i / matchedCollections.length) * 25;
            
            onStatusUpdate?.({
              phase: 'forking',
              message: `Forking collection: ${collection.name}`,
              currentItem: collection.name,
              current: i + 1,
              total: matchedCollections.length,
              progress: progressPercent,
            });

            const result = await forkCollection(
              collection.uid, 
              `${config.workspaceName} - ${collection.name}`, 
              workspaceId
            );
            results.collections.push({
              ...result,
              originalName: collection.name,
              matchedApi: collection.matchedApi,
            });

            if (result.success) {
              results.summary.successfulCollections++;
            } else {
              results.errors.push(`Failed to fork ${collection.name}: ${result.error}`);
            }

            // Delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
    }

    // Phase 3: Copy Specs (if enabled)
    if (config.copySpecs) {
      onStatusUpdate?.({
        phase: 'specs',
        message: 'Copying API specs from source workspace...',
        progress: 60,
      });

      const sourceWorkspaceId = POSTMAN_SOURCE_WORKSPACE_ID;
      if (!sourceWorkspaceId) {
        results.errors.push('Source workspace ID not configured. Skipping spec copy.');
      } else {
        const specResults = await copySpecs(
          sourceWorkspaceId,
          workspaceId,
          (progress) => {
            onStatusUpdate?.({
              phase: 'specs',
              message: progress.message,
              currentItem: progress.currentItem,
              current: progress.current,
              total: progress.total,
              progress: 60 + (progress.progress * 0.15),
            });
          }
        );

        results.specs = specResults.copied;
        results.summary.totalSpecs = specResults.copied.length + specResults.errors.length;
        results.summary.successfulSpecs = specResults.copied.length;
        
        for (const err of specResults.errors) {
          results.errors.push(`Failed to copy spec ${err.apiName}: ${err.error}`);
        }
      }
    }

    // Phase 4: Create environment (if enabled)
    if (config.createEnvironment) {
      onStatusUpdate?.({
        phase: 'environment',
        message: 'Creating environment with API credentials...',
        progress: 80,
      });

      const envVariables = config.environmentVariables || [
        { key: 'workspace_name', value: config.workspaceName, description: 'Name of this workspace' },
        { key: 'api_key', value: '', type: 'secret', description: 'Your API key' },
        { key: 'api_secret', value: '', type: 'secret', description: 'Your API secret' },
        { key: 'base_url', value: 'https://api.citi.com', description: 'API base URL' },
        { key: 'client_id', value: '', description: 'OAuth client ID' },
        { key: 'access_token', value: '', type: 'secret', description: 'OAuth access token' },
      ];

      results.summary.totalEnvironments = 1;
      
      const envResult = await createEnvironmentInPostman(
        `${config.workspaceName} - Environment`,
        envVariables,
        workspaceId
      );
      
      results.environments.push(envResult);
      
      if (envResult.success) {
        results.summary.successfulEnvironments++;
      } else {
        results.errors.push(`Failed to create environment: ${envResult.error}`);
      }
    }

    // Phase 5: Complete
    onStatusUpdate?.({
      phase: 'complete',
      message: 'Workspace provisioning complete!',
      progress: 100,
      results,
    });

    return results;
  } catch (error) {
    results.errors.push(error.message);
    onStatusUpdate?.({
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
 * @param {string} workspaceName - Name for the new workspace
 * @param {object} options - Additional options
 * @param {function} onStatusUpdate - Progress callback
 */
export const quickProvision = async (workspaceName, options = {}, onStatusUpdate) => {
  return provisionWorkspace({
    workspaceName,
    selectedApis: Object.keys(apiToCollectionMapping),
    workspaceType: options.workspaceType || 'team',
    workspaceDescription: options.description || '',
    copyCollections: true,
    copySpecs: options.copySpecs || false,
    createEnvironment: true,
    ...options,
  }, onStatusUpdate);
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

