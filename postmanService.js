import axios from "axios";

const POSTMAN_API_KEY = import.meta.env.VITE_POSTMAN_API_KEY;
const POSTMAN_TARGET_WORKSPACE_ID = import.meta.env.VITE_POSTMAN_TARGET_WORKSPACE_ID;
const POSTMAN_SOURCE_WORKSPACE_ID = import.meta.env.VITE_POSTMAN_SOURCE_WORKSPACE_ID;
const POSTMAN_API_BASE = "https://api.getpostman.com";

// Get the target workspace ID
export const getTargetWorkspaceId = () => {
  return POSTMAN_TARGET_WORKSPACE_ID;
};

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

// Reset workspace - delete all collections, environments, and mocks
export const resetWorkspace = async (workspaceId, onProgress) => {
  // Get all collections
  const collections = await getAllCollections(workspaceId);
  let deletedCollections = 0;

  // Delete all collections
  for (const collection of collections) {
    const success = await deleteCollection(collection.uid);
    if (success) deletedCollections++;
    if (onProgress) {
      onProgress({
        phase: 'collections',
        deleted: deletedCollections,
        total: collections.length,
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // Get all environments
  const environments = await getAllEnvironments(workspaceId);
  let deletedEnvironments = 0;

  // Delete all environments
  for (const environment of environments) {
    const success = await deleteEnvironment(environment.uid);
    if (success) deletedEnvironments++;
    if (onProgress) {
      onProgress({
        phase: 'environments',
        deleted: deletedEnvironments,
        total: environments.length,
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // Get all mocks
  const mocks = await getAllMocks(workspaceId);
  let deletedMocks = 0;

  // Delete all mocks
  for (const mock of mocks) {
    const success = await deleteMock(mock.uid);
    if (success) deletedMocks++;
    if (onProgress) {
      onProgress({
        phase: 'mocks',
        deleted: deletedMocks,
        total: mocks.length,
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return { deletedCollections, deletedEnvironments, deletedMocks };
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

// Main function to provision workspace with selected APIs
export const provisionWorkspace = async (workspaceName, selectedApis, onStatusUpdate) => {
  const workspaceId = POSTMAN_TARGET_WORKSPACE_ID;
  
  if (!workspaceId) {
    throw new Error('Target workspace ID not configured. Please set VITE_POSTMAN_TARGET_WORKSPACE_ID');
  }
  
  if (!POSTMAN_API_KEY) {
    throw new Error('Postman API key not configured. Please set VITE_POSTMAN_API_KEY');
  }

  const results = {
    collections: [],
    environments: [],
    errors: [],
    summary: {
      totalCollections: 0,
      successfulCollections: 0,
      totalEnvironments: 0,
      successfulEnvironments: 0,
    },
  };

  try {
    // Phase 1: Get source collections
    onStatusUpdate?.({
      phase: 'fetching',
      message: 'Fetching available collections from source workspace...',
      progress: 5,
    });
    
    const sourceCollections = await getSourceCollections();
    
    if (sourceCollections.length === 0) {
      onStatusUpdate?.({
        phase: 'warning',
        message: 'No collections found in source workspace. Creating empty environment.',
        progress: 10,
      });
    }

    // Phase 2: Find matching collections for selected APIs
    onStatusUpdate?.({
      phase: 'matching',
      message: `Matching collections for ${selectedApis.length} selected API(s)...`,
      progress: 15,
    });
    
    const matchedCollections = findMatchingCollections(sourceCollections, selectedApis);
    results.summary.totalCollections = matchedCollections.length;

    // Log which APIs didn't have matching collections
    const unmatchedApis = selectedApis.filter(api => 
      !matchedCollections.find(c => c.matchedApi === api)
    );
    
    if (unmatchedApis.length > 0) {
      const warningMsg = `No matching collections found for: ${unmatchedApis.join(', ')}. ` +
        `Please ensure collection names in source workspace match the API names exactly.`;
      console.warn(warningMsg);
      results.errors.push(warningMsg);
    }

    // Phase 3: Fork each matched collection
    if (matchedCollections.length > 0) {
      for (let i = 0; i < matchedCollections.length; i++) {
        const collection = matchedCollections[i];
        const progressPercent = 20 + (i / matchedCollections.length) * 50;
        
        onStatusUpdate?.({
          phase: 'forking',
          message: `Forking collection: ${collection.name}`,
          currentItem: collection.name,
          current: i + 1,
          total: matchedCollections.length,
          progress: progressPercent,
        });

        const result = await forkCollection(collection.uid, `${workspaceName} - ${collection.name}`, workspaceId);
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

    // Phase 4: Create environment
    onStatusUpdate?.({
      phase: 'environment',
      message: 'Creating environment with API credentials...',
      progress: 75,
    });

    const envVariables = [
      { key: 'workspace_name', value: workspaceName, description: 'Name of this workspace' },
      { key: 'api_key', value: '', type: 'secret', description: 'Your API key' },
      { key: 'api_secret', value: '', type: 'secret', description: 'Your API secret' },
      { key: 'base_url', value: 'https://api.citi.com', description: 'Citi API base URL' },
      { key: 'client_id', value: '', description: 'OAuth client ID' },
      { key: 'access_token', value: '', type: 'secret', description: 'OAuth access token' },
    ];

    results.summary.totalEnvironments = 1;
    
    const envResult = await createEnvironmentInPostman(
      `${workspaceName} - Environment`,
      envVariables,
      workspaceId
    );
    
    results.environments.push(envResult);
    
    if (envResult.success) {
      results.summary.successfulEnvironments++;
    } else {
      results.errors.push(`Failed to create environment: ${envResult.error}`);
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

// Check if Postman is properly configured
export const isPostmanConfigured = () => {
  return !!(POSTMAN_API_KEY && POSTMAN_TARGET_WORKSPACE_ID && POSTMAN_SOURCE_WORKSPACE_ID);
};

// Get configuration status for debugging
export const getConfigurationStatus = () => {
  return {
    hasApiKey: !!POSTMAN_API_KEY,
    hasTargetWorkspace: !!POSTMAN_TARGET_WORKSPACE_ID,
    hasSourceWorkspace: !!POSTMAN_SOURCE_WORKSPACE_ID,
    isFullyConfigured: isPostmanConfigured(),
  };
};

