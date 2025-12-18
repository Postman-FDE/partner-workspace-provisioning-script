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
// API SPECIFICATIONS MANAGEMENT
// ============================================================================

/**
 * Get all API specs from a workspace
 * @param {string} workspaceId - The workspace ID to get specs from
 * @returns {Promise<Array>}
 */
export const getAllSpecs = async (workspaceId) => {
  try {
    const response = await axios.get(
      `${POSTMAN_API_BASE}/specs?workspace=${workspaceId}`,
      {
        headers: {
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      }
    );
    return response.data.apis || [];
  } catch (error) {
    console.error("Error getting specs:", error);
    return [];
  }
};

/**
 * Get a single API spec details including schema
 * @param {string} apiId - The API ID
 * @returns {Promise<object|null>}
 */
export const getApiSpec = async (apiId) => {
  try {
    const response = await axios.get(
      `${POSTMAN_API_BASE}/specs/${apiId}`,
      {
        headers: {
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      }
    );
    return response.data || null;
  } catch (error) {
    console.error("Error getting API spec:", error);
    return null;
  }
};

/**
 * Get all versions of an API
 * @param {string} apiId - The API ID
 * @returns {Promise<Array>}
 */
export const getApiVersions = async (apiId) => {
  try {
    const response = await axios.get(
      `${POSTMAN_API_BASE}/specs/${apiId}/versions`,
      {
        headers: {
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      }
    );
    return response.data.versions || [];
  } catch (error) {
    console.error("Error getting API versions:", error);
    return [];
  }
};

/**
 * Get the schema for an API version
 * @param {string} apiId - The API ID
 * @param {string} versionId - The version ID
 * @param {string} schemaId - The schema ID
 * @returns {Promise<object|null>}
 */
export const getApiSchema = async (apiId, versionId, schemaId) => {
  try {
    const response = await axios.get(
      `${POSTMAN_API_BASE}/specs/${apiId}/versions/${versionId}/schemas/${schemaId}`,
      {
        headers: {
          "X-Api-Key": POSTMAN_API_KEY || "",
        },
      }
    );
    return response.data.schema || null;
  } catch (error) {
    console.error("Error getting API schema:", error);
    return null;
  }
};

/**
 * Create a new API in a workspace
 * @param {string} workspaceId - Target workspace ID
 * @param {string} name - API name
 * @param {string} description - API description
 * @returns {Promise<{success: boolean, api?: object, error?: string}>}
 */
export const createApi = async (workspaceId, name, description = '') => {
  try {
    const response = await axios.post(
      `${POSTMAN_API_BASE}/specs?workspace=${workspaceId}`,
      {
        api: {
          name,
          description,
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
      api: response.data.api || response.data,
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
 * Create an API version
 * @param {string} apiId - The API ID
 * @param {string} name - Version name
 * @returns {Promise<{success: boolean, version?: object, error?: string}>}
 */
export const createApiVersion = async (apiId, name) => {
  try {
    const response = await axios.post(
      `${POSTMAN_API_BASE}/specs/${apiId}/versions`,
      {
        version: {
          name,
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
      version: response.data.version || response.data,
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
 * Create a schema for an API version
 * @param {string} apiId - The API ID
 * @param {string} versionId - The version ID
 * @param {string} type - Schema type (e.g., 'openapi3', 'openapi2', 'raml', 'graphql')
 * @param {string} language - Schema language (e.g., 'json', 'yaml')
 * @param {string} schema - The schema content
 * @returns {Promise<{success: boolean, schema?: object, error?: string}>}
 */
export const createApiSchema = async (apiId, versionId, type, language, schema) => {
  try {
    const response = await axios.post(
      `${POSTMAN_API_BASE}/specs/${apiId}/versions/${versionId}/schemas`,
      {
        schema: {
          type,
          language,
          schema,
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
      schema: response.data.schema || response.data,
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
 * Delete an API
 * @param {string} apiId - The API ID to delete
 * @returns {Promise<boolean>}
 */
export const deleteApi = async (apiId) => {
  try {
    await axios.delete(`${POSTMAN_API_BASE}/specs/${apiId}`, {
      headers: {
        "X-Api-Key": POSTMAN_API_KEY || "",
      },
    });
    return true;
  } catch (error) {
    console.error("Error deleting API:", error);
    return false;
  }
};

/**
 * Copy specs from source workspace to target workspace
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

  // Get all APIs from source workspace
  const sourceApis = await getAllSpecs(sourceWorkspaceId);

  if (sourceApis.length === 0) {
    onProgress?.({
      phase: 'specs',
      message: 'No API specs found in source workspace',
      progress: 100,
    });
    return results;
  }

  for (let i = 0; i < sourceApis.length; i++) {
    const api = sourceApis[i];
    const progressPercent = Math.round((i / sourceApis.length) * 100);

    onProgress?.({
      phase: 'specs',
      message: `Copying API spec: ${api.name}`,
      currentItem: api.name,
      current: i + 1,
      total: sourceApis.length,
      progress: progressPercent,
    });

    try {
      // Get full API details
      const apiDetails = await getApiSpec(api.id);
      
      // Create the API in target workspace
      const createResult = await createApi(
        targetWorkspaceId,
        api.name,
        apiDetails?.api?.description || ''
      );

      if (!createResult.success) {
        results.errors.push({
          apiName: api.name,
          error: createResult.error,
        });
        continue;
      }

      const newApiId = createResult.api.id;

      // Get versions and copy schemas
      const versions = await getApiVersions(api.id);
      
      for (const version of versions) {
        // Create version in new API
        const versionResult = await createApiVersion(newApiId, version.name);
        
        if (versionResult.success && version.schema && version.schema.length > 0) {
          for (const schemaRef of version.schema) {
            // Get the schema content
            const schemaDetails = await getApiSchema(api.id, version.id, schemaRef);
            
            if (schemaDetails) {
              await createApiSchema(
                newApiId,
                versionResult.version.id,
                schemaDetails.type || 'openapi3',
                schemaDetails.language || 'json',
                schemaDetails.schema
              );
            }
          }
        }
      }

      results.copied.push({
        originalApiId: api.id,
        newApiId,
        name: api.name,
      });

      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      results.errors.push({
        apiName: api.name,
        error: error.message,
      });
    }
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
export const deleteMock = async (mockUid) => {
  try {
    await axios.delete(`${POSTMAN_API_BASE}/mocks/${mockUid}`, {
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
      const success = await deleteMock(mock.uid);
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

  // Delete all APIs
  if (includeApis) {
    const apis = await getAllSpecs(workspaceId);
    for (const api of apis) {
      const success = await deleteApi(api.id);
      if (success) result.deletedApis++;
      if (onProgress) {
        onProgress({
          phase: 'apis',
          deleted: result.deletedApis,
          total: apis.length,
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

