#!/usr/bin/env node

/**
 * Partner Workspace Provisioning Script
 * 
 * Automatically creates and provisions a new Postman partner workspace
 * by copying all collections, environments, mocks, and specs from a source workspace.
 * 
 * Required Environment Variables:
 *   - POSTMAN_API_KEY: Your Postman API key
 *   - POSTMAN_SOURCE_WORKSPACE_ID: Source workspace to copy from
 * 
 * Optional Environment Variables:
 *   - POSTMAN_TARGET_WORKSPACE_ID: Existing target workspace (if omitted, creates new)
 *   - POSTMAN_WORKSPACE_NAME: Name for the new workspace (default: "Partner Workspace")
 * 
 * Usage:
 *   node provision.js              # Interactive mode
 *   node provision.js --yes        # Run with defaults (no prompts)
 *   node provision.js --name "My Partner Workspace"
 *   node provision.js --target-workspace-id "existing-workspace-id"
 */

import axios from "axios";
import 'dotenv/config';
import * as readline from 'readline';

// ============================================================================
// CONFIGURATION
// ============================================================================

const POSTMAN_API_KEY = process.env.POSTMAN_API_KEY || process.env.VITE_POSTMAN_API_KEY;
const POSTMAN_SOURCE_WORKSPACE_ID = process.env.POSTMAN_SOURCE_WORKSPACE_ID || process.env.VITE_POSTMAN_SOURCE_WORKSPACE_ID;
const POSTMAN_TARGET_WORKSPACE_ID = process.env.POSTMAN_TARGET_WORKSPACE_ID || process.env.VITE_POSTMAN_TARGET_WORKSPACE_ID;
const POSTMAN_WORKSPACE_NAME = process.env.POSTMAN_WORKSPACE_NAME || process.env.VITE_POSTMAN_WORKSPACE_NAME;
const POSTMAN_API_BASE = "https://api.getpostman.com";

// Partner workspace type
const WORKSPACE_TYPE = "partner";

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
};
const hasFlag = (flag) => args.includes(flag);

const CLI_WORKSPACE_NAME = getArg('--name') || getArg('-n');
const CLI_TARGET_WORKSPACE_ID = getArg('--target-workspace-id') || getArg('-t');
const SKIP_INTERACTIVE = hasFlag('--yes') || hasFlag('-y');

// Runtime configuration (can be modified by interactive prompts)
let runtimeConfig = {
  workspaceName: CLI_WORKSPACE_NAME || POSTMAN_WORKSPACE_NAME || "Partner Workspace",
  targetWorkspaceId: CLI_TARGET_WORKSPACE_ID || POSTMAN_TARGET_WORKSPACE_ID || null,
};

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

const log = {
  info: (msg) => console.log(`\x1b[36mℹ\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m✓\x1b[0m ${msg}`),
  warn: (msg) => console.log(`\x1b[33m⚠\x1b[0m ${msg}`),
  error: (msg) => console.log(`\x1b[31m✗\x1b[0m ${msg}`),
  step: (msg) => console.log(`\n\x1b[35m▸\x1b[0m ${msg}`),
  detail: (msg) => console.log(`  ${msg}`),
};

const printBanner = () => {
  console.log('\n\x1b[36m╔════════════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[36m║\x1b[0m      \x1b[1mPostman Partner Workspace Provisioning Script\x1b[0m        \x1b[36m║\x1b[0m');
  console.log('\x1b[36m╚════════════════════════════════════════════════════════════╝\x1b[0m\n');
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
  const rl = createReadline();
  
  console.log('\x1b[36m─────────────────────────────────────────────────────────────\x1b[0m');
  console.log('\x1b[1m                    Current Configuration\x1b[0m');
  console.log('\x1b[36m─────────────────────────────────────────────────────────────\x1b[0m\n');
  
  // Show current config from .env
  console.log(`  \x1b[1mAPI Key:\x1b[0m          ${POSTMAN_API_KEY ? '\x1b[32m✓ Configured\x1b[0m' : '\x1b[31m✗ Missing\x1b[0m'}`);
  console.log(`  \x1b[1mSource Workspace:\x1b[0m ${POSTMAN_SOURCE_WORKSPACE_ID ? `\x1b[32m${POSTMAN_SOURCE_WORKSPACE_ID.substring(0, 8)}...\x1b[0m` : '\x1b[31m✗ Missing\x1b[0m'}`);
  
  if (runtimeConfig.targetWorkspaceId) {
    console.log(`  \x1b[1mTarget Workspace:\x1b[0m \x1b[33m${runtimeConfig.targetWorkspaceId.substring(0, 8)}...\x1b[0m (existing)`);
  } else {
    console.log(`  \x1b[1mTarget Workspace:\x1b[0m \x1b[36mWill create new\x1b[0m`);
    console.log(`  \x1b[1mNew Workspace Name:\x1b[0m \x1b[36m${runtimeConfig.workspaceName}\x1b[0m`);
  }
  
  console.log(`  \x1b[1mWorkspace Type:\x1b[0m   \x1b[36m${WORKSPACE_TYPE}\x1b[0m`);
  
  console.log('\n\x1b[36m─────────────────────────────────────────────────────────────\x1b[0m\n');
  
  // Check for missing required config
  if (!POSTMAN_API_KEY || !POSTMAN_SOURCE_WORKSPACE_ID) {
    console.log('\x1b[31m✗ Missing required configuration. Please set up your .env file.\x1b[0m\n');
    rl.close();
    process.exit(1);
  }
  
  // Interactive menu
  console.log('  \x1b[1mOptions:\x1b[0m');
  console.log('  \x1b[36m[1]\x1b[0m Run with current settings');
  console.log('  \x1b[36m[2]\x1b[0m Change workspace name (create new workspace)');
  console.log('  \x1b[36m[3]\x1b[0m Use existing target workspace ID');
  console.log('  \x1b[36m[4]\x1b[0m Exit');
  console.log('');
  
  const choice = await prompt(rl, '\x1b[33mSelect option [1-4]: \x1b[0m');
  
  switch (choice) {
    case '1':
      // Run with current settings
      rl.close();
      return true;
      
    case '2':
      // Change workspace name
      const newName = await prompt(rl, '\x1b[33mEnter new workspace name: \x1b[0m');
      if (newName) {
        runtimeConfig.workspaceName = newName;
        runtimeConfig.targetWorkspaceId = null; // Clear target to create new
      }
      rl.close();
      return true;
      
    case '3':
      // Use existing workspace
      const targetId = await prompt(rl, '\x1b[33mEnter target workspace ID: \x1b[0m');
      if (targetId) {
        runtimeConfig.targetWorkspaceId = targetId;
      }
      rl.close();
      return true;
      
    case '4':
      // Exit
      console.log('\n\x1b[33mExiting...\x1b[0m\n');
      rl.close();
      process.exit(0);
      
    default:
      // Default to option 1 (run with current)
      rl.close();
      return true;
  }
}

async function confirmAndRun() {
  const rl = createReadline();
  
  console.log('\n\x1b[36m─────────────────────────────────────────────────────────────\x1b[0m');
  console.log('\x1b[1m                    Ready to Provision\x1b[0m');
  console.log('\x1b[36m─────────────────────────────────────────────────────────────\x1b[0m\n');
  
  if (runtimeConfig.targetWorkspaceId) {
    console.log(`  \x1b[1mAction:\x1b[0m Copy content to existing workspace`);
    console.log(`  \x1b[1mTarget:\x1b[0m ${runtimeConfig.targetWorkspaceId}`);
  } else {
    console.log(`  \x1b[1mAction:\x1b[0m Create new ${WORKSPACE_TYPE} workspace`);
    console.log(`  \x1b[1mName:\x1b[0m   ${runtimeConfig.workspaceName}`);
  }
  
  console.log('');
  
  const answer = await prompt(rl, '\x1b[33mProceed? [Y/n]: \x1b[0m');
  rl.close();
  
  return answer.toLowerCase() !== 'n';
}

// ============================================================================
// API HELPER
// ============================================================================

const api = axios.create({
  baseURL: POSTMAN_API_BASE,
  headers: {
    "Content-Type": "application/json",
    "X-Api-Key": POSTMAN_API_KEY || "",
  },
});

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================================================
// WORKSPACE FUNCTIONS
// ============================================================================

async function validateApiKey() {
  try {
    const response = await api.get('/me');
    return { valid: true, user: response.data.user };
  } catch (error) {
    return { 
      valid: false, 
      error: error.response?.data?.error?.message || error.message 
    };
  }
}

async function getWorkspace(workspaceId) {
  try {
    const response = await api.get(`/workspaces/${workspaceId}`);
    return response.data.workspace;
  } catch (error) {
    return null;
  }
}

async function createWorkspace(name, type = WORKSPACE_TYPE) {
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
      error: error.response?.data?.error?.message || error.message 
    };
  }
}

// ============================================================================
// COLLECTION FUNCTIONS
// ============================================================================

async function getAllCollections(workspaceId) {
  try {
    const response = await api.get(`/collections?workspace=${workspaceId}`);
    return response.data.collections || [];
  } catch (error) {
    log.error(`Error getting collections: ${error.message}`);
    return [];
  }
}

async function forkCollection(collectionUid, label, targetWorkspaceId) {
  try {
    const response = await api.post(
      `/collections/fork/${collectionUid}?workspace=${targetWorkspaceId}`,
      { label }
    );
    return { success: true, collection: response.data.collection };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error?.message || error.message 
    };
  }
}

// ============================================================================
// ENVIRONMENT FUNCTIONS
// ============================================================================

async function getAllEnvironments(workspaceId) {
  try {
    const response = await api.get(`/environments?workspace=${workspaceId}`);
    return response.data.environments || [];
  } catch (error) {
    log.error(`Error getting environments: ${error.message}`);
    return [];
  }
}

async function getEnvironmentDetails(environmentUid) {
  try {
    const response = await api.get(`/environments/${environmentUid}`);
    return response.data.environment;
  } catch (error) {
    return null;
  }
}

async function createEnvironment(name, values, workspaceId) {
  try {
    const response = await api.post(`/environments?workspace=${workspaceId}`, {
      environment: {
        name,
        values: values.map(v => ({
          key: v.key,
          value: v.value || '',
          enabled: v.enabled !== false,
          type: v.type || 'default',
        })),
      },
    });
    return { success: true, environment: response.data.environment };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error?.message || error.message 
    };
  }
}

// ============================================================================
// MOCK SERVER FUNCTIONS
// ============================================================================

async function getAllMocks(workspaceId) {
  try {
    const response = await api.get(`/mocks?workspace=${workspaceId}`);
    return response.data.mocks || [];
  } catch (error) {
    log.error(`Error getting mocks: ${error.message}`);
    return [];
  }
}

async function createMock(name, collectionUid, workspaceId, environmentUid = null) {
  try {
    const mockConfig = {
      mock: {
        name,
        collection: collectionUid,
        private: false,
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
      error: error.response?.data?.error?.message || error.message 
    };
  }
}

// ============================================================================
// SPEC FUNCTIONS
// ============================================================================

async function getAllSpecs(workspaceId) {
  try {
    const response = await api.get(`/specs?workspaceId=${workspaceId}`);
    return response.data.specs || [];
  } catch (error) {
    log.error(`Error getting specs: ${error.message}`);
    return [];
  }
}

async function getSpecDetails(specId) {
  try {
    const response = await api.get(`/specs/${specId}`);
    return response.data;
  } catch (error) {
    return null;
  }
}

async function getSpecVersions(specId) {
  try {
    const response = await api.get(`/specs/${specId}/versions`);
    return response.data.versions || [];
  } catch (error) {
    return [];
  }
}


async function createSpec(workspaceId, name, description = '') {
  try {
    const response = await api.post(`/specs?workspaceId=${workspaceId}`, {
      spec: { name, description },
    });
    return { success: true, spec: response.data.spec || response.data };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error?.message || error.message 
    };
  }
}

// ============================================================================
// MAIN PROVISIONING LOGIC
// ============================================================================

async function provision() {
  printBanner();

  // Interactive mode (unless --yes flag is used)
  if (!SKIP_INTERACTIVE) {
    const shouldRun = await showInteractiveMenu();
    if (!shouldRun) {
      return;
    }
    
    const confirmed = await confirmAndRun();
    if (!confirmed) {
      console.log('\n\x1b[33mProvisioning cancelled.\x1b[0m\n');
      process.exit(0);
    }
  }

  console.log('\n');

  const results = {
    workspace: null,
    workspaceCreated: false,
    collections: { total: 0, success: 0, failed: [] },
    environments: { total: 0, success: 0, failed: [] },
    mocks: { total: 0, success: 0, failed: [] },
    specs: { total: 0, success: 0, failed: [] },
  };

  // Validate configuration
  log.step('Validating configuration...');

  if (!POSTMAN_API_KEY) {
    log.error('POSTMAN_API_KEY is required. Set it in your environment or .env file.');
    process.exit(1);
  }

  if (!POSTMAN_SOURCE_WORKSPACE_ID) {
    log.error('POSTMAN_SOURCE_WORKSPACE_ID is required. Set it in your environment or .env file.');
    process.exit(1);
  }

  // Validate API key
  const validation = await validateApiKey();
  if (!validation.valid) {
    log.error(`Invalid API key: ${validation.error}`);
    process.exit(1);
  }
  log.success(`API key valid. Authenticated as: ${validation.user.username}`);

  // Verify source workspace
  const sourceWorkspace = await getWorkspace(POSTMAN_SOURCE_WORKSPACE_ID);
  if (!sourceWorkspace) {
    log.error(`Source workspace not found: ${POSTMAN_SOURCE_WORKSPACE_ID}`);
    process.exit(1);
  }
  log.success(`Source workspace: ${sourceWorkspace.name}`);

  // Initialize target workspace
  log.step('Initializing target workspace...');
  
  let targetWorkspaceId;
  
  if (runtimeConfig.targetWorkspaceId) {
    // Use existing workspace
    const existingWorkspace = await getWorkspace(runtimeConfig.targetWorkspaceId);
    if (!existingWorkspace) {
      log.error(`Target workspace not found: ${runtimeConfig.targetWorkspaceId}`);
      process.exit(1);
    }
    targetWorkspaceId = runtimeConfig.targetWorkspaceId;
    results.workspace = existingWorkspace;
    results.workspaceCreated = false;
    log.success(`Using existing workspace: ${existingWorkspace.name}`);
  } else {
    // Create new partner workspace
    log.info(`Creating new ${WORKSPACE_TYPE} workspace: "${runtimeConfig.workspaceName}"...`);
    const createResult = await createWorkspace(runtimeConfig.workspaceName, WORKSPACE_TYPE);
    
    if (!createResult.success) {
      log.error(`Failed to create workspace: ${createResult.error}`);
      process.exit(1);
    }
    
    targetWorkspaceId = createResult.workspace.id;
    results.workspace = createResult.workspace;
    results.workspaceCreated = true;
    log.success(`Created new workspace: ${createResult.workspace.name} (ID: ${createResult.workspace.id})`);
  }

  // =========================================================================
  // COPY COLLECTIONS
  // =========================================================================
  log.step('Copying collections...');
  
  const sourceCollections = await getAllCollections(POSTMAN_SOURCE_WORKSPACE_ID);
  results.collections.total = sourceCollections.length;
  
  if (sourceCollections.length === 0) {
    log.warn('No collections found in source workspace');
  } else {
    log.info(`Found ${sourceCollections.length} collection(s) to copy`);
    
    // Map to store original -> new collection UIDs for mock server recreation
    const collectionMap = new Map();
    
    for (const collection of sourceCollections) {
      const forkResult = await forkCollection(
        collection.uid,
        collection.name,
        targetWorkspaceId
      );
      
      if (forkResult.success) {
        results.collections.success++;
        collectionMap.set(collection.uid, forkResult.collection.uid);
        log.success(`Forked: ${collection.name}`);
      } else {
        results.collections.failed.push({ name: collection.name, error: forkResult.error });
        log.error(`Failed to fork "${collection.name}": ${forkResult.error}`);
      }
      
      await delay(500); // Rate limiting
    }
  }

  // =========================================================================
  // COPY ENVIRONMENTS
  // =========================================================================
  log.step('Copying environments...');
  
  const sourceEnvironments = await getAllEnvironments(POSTMAN_SOURCE_WORKSPACE_ID);
  results.environments.total = sourceEnvironments.length;
  
  // Map to store original -> new environment UIDs
  const environmentMap = new Map();
  
  if (sourceEnvironments.length === 0) {
    log.warn('No environments found in source workspace');
  } else {
    log.info(`Found ${sourceEnvironments.length} environment(s) to copy`);
    
    for (const env of sourceEnvironments) {
      const envDetails = await getEnvironmentDetails(env.uid);
      
      if (envDetails && envDetails.values) {
        const createResult = await createEnvironment(
          env.name,
          envDetails.values,
          targetWorkspaceId
        );
        
        if (createResult.success) {
          results.environments.success++;
          environmentMap.set(env.uid, createResult.environment.uid);
          log.success(`Created: ${env.name}`);
        } else {
          results.environments.failed.push({ name: env.name, error: createResult.error });
          log.error(`Failed to create "${env.name}": ${createResult.error}`);
        }
      } else {
        results.environments.failed.push({ name: env.name, error: 'Could not get environment details' });
        log.warn(`Skipped "${env.name}": Could not retrieve details`);
      }
      
      await delay(300);
    }
  }

  // =========================================================================
  // RECREATE MOCK SERVERS
  // =========================================================================
  log.step('Recreating mock servers...');
  
  const sourceMocks = await getAllMocks(POSTMAN_SOURCE_WORKSPACE_ID);
  results.mocks.total = sourceMocks.length;
  
  if (sourceMocks.length === 0) {
    log.warn('No mock servers found in source workspace');
  } else {
    log.info(`Found ${sourceMocks.length} mock server(s) to recreate`);
    
    // Get target collections for mapping
    const targetCollections = await getAllCollections(targetWorkspaceId);
    const targetCollectionMap = new Map(
      targetCollections.map(c => [c.name, c.uid])
    );
    
    for (const mock of sourceMocks) {
      // Find corresponding collection in target by name
      // (since forked collections keep the same name)
      const sourceCollections = await getAllCollections(POSTMAN_SOURCE_WORKSPACE_ID);
      const sourceCollection = sourceCollections.find(c => c.uid === mock.collection);
      
      if (!sourceCollection) {
        results.mocks.failed.push({ name: mock.name, error: 'Source collection not found' });
        log.warn(`Skipped mock "${mock.name}": Source collection not found`);
        continue;
      }
      
      const targetCollectionUid = targetCollectionMap.get(sourceCollection.name);
      
      if (!targetCollectionUid) {
        results.mocks.failed.push({ name: mock.name, error: 'Target collection not found' });
        log.warn(`Skipped mock "${mock.name}": Target collection not found`);
        continue;
      }
      
      // Find environment mapping if mock has one
      let targetEnvironmentUid = null;
      if (mock.environment) {
        targetEnvironmentUid = environmentMap.get(mock.environment);
      }
      
      const createResult = await createMock(
        mock.name,
        targetCollectionUid,
        targetWorkspaceId,
        targetEnvironmentUid
      );
      
      if (createResult.success) {
        results.mocks.success++;
        log.success(`Created: ${mock.name} (URL: ${createResult.mock.mockUrl})`);
      } else {
        results.mocks.failed.push({ name: mock.name, error: createResult.error });
        log.error(`Failed to create "${mock.name}": ${createResult.error}`);
      }
      
      await delay(500);
    }
  }

  // =========================================================================
  // COPY SPECS
  // =========================================================================
  log.step('Copying specs...');
  
  const sourceSpecs = await getAllSpecs(POSTMAN_SOURCE_WORKSPACE_ID);
  results.specs.total = sourceSpecs.length;
  
  if (sourceSpecs.length === 0) {
    log.warn('No specs found in source workspace');
  } else {
    log.info(`Found ${sourceSpecs.length} spec(s) to copy`);
    
    for (const spec of sourceSpecs) {
      const specDetails = await getSpecDetails(spec.id);
      
      // Create the spec in target workspace
      const createResult = await createSpec(
        targetWorkspaceId,
        spec.name,
        specDetails?.spec?.description || ''
      );
      
      if (!createResult.success) {
        results.specs.failed.push({ name: spec.name, error: createResult.error });
        log.error(`Failed to create spec "${spec.name}": ${createResult.error}`);
        continue;
      }
      
      const newSpecId = createResult.spec.id;
      
      // Copy versions and schemas
      const versions = await getSpecVersions(spec.id);
      let versionsCopied = true;
      
      for (const version of versions) {
        const versionResult = await createSpecVersion(newSpecId, version.name);
        
        if (versionResult.success && version.schema && version.schema.length > 0) {
          for (const schemaRef of version.schema) {
            const schemaDetails = await getSpecSchema(spec.id, version.id, schemaRef);
            
            if (schemaDetails) {
              await createSpecSchema(
                newSpecId,
                versionResult.version.id,
                schemaDetails.type || 'openapi3',
                schemaDetails.language || 'json',
                schemaDetails.schema
              );
            }
          }
        } else if (!versionResult.success) {
          versionsCopied = false;
        }
        
        await delay(300);
      }
      
      if (versionsCopied) {
        results.specs.success++;
        log.success(`Copied: ${spec.name}`);
      } else {
        results.specs.failed.push({ name: spec.name, error: 'Some versions failed to copy' });
        log.warn(`Partially copied: ${spec.name}`);
      }
      
      await delay(500);
    }
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n\x1b[36m═══════════════════════════════════════════════════════════════\x1b[0m');
  console.log('\x1b[1m                      PROVISIONING COMPLETE\x1b[0m');
  console.log('\x1b[36m═══════════════════════════════════════════════════════════════\x1b[0m\n');

  console.log(`\x1b[1mWorkspace:\x1b[0m ${results.workspace.name}`);
  console.log(`\x1b[1mWorkspace ID:\x1b[0m ${targetWorkspaceId}`);
  console.log(`\x1b[1mWorkspace Created:\x1b[0m ${results.workspaceCreated ? 'Yes (new)' : 'No (existing)'}`);
  console.log('');
  console.log(`\x1b[1mCollections:\x1b[0m ${results.collections.success}/${results.collections.total} copied`);
  console.log(`\x1b[1mEnvironments:\x1b[0m ${results.environments.success}/${results.environments.total} copied`);
  console.log(`\x1b[1mMock Servers:\x1b[0m ${results.mocks.success}/${results.mocks.total} recreated`);
  console.log(`\x1b[1mSpecs:\x1b[0m ${results.specs.success}/${results.specs.total} copied`);

  const totalFailed = 
    results.collections.failed.length + 
    results.environments.failed.length + 
    results.mocks.failed.length + 
    results.specs.failed.length;

  if (totalFailed > 0) {
    console.log('\n\x1b[33m⚠ Some items failed to copy:\x1b[0m');
    
    if (results.collections.failed.length > 0) {
      console.log('  Collections:', results.collections.failed.map(f => f.name).join(', '));
    }
    if (results.environments.failed.length > 0) {
      console.log('  Environments:', results.environments.failed.map(f => f.name).join(', '));
    }
    if (results.mocks.failed.length > 0) {
      console.log('  Mocks:', results.mocks.failed.map(f => f.name).join(', '));
    }
    if (results.specs.failed.length > 0) {
      console.log('  Specs:', results.specs.failed.map(f => f.name).join(', '));
    }
  }

  console.log('\n\x1b[32m✓ Done!\x1b[0m\n');
  
  return results;
}

// Run the script
provision().catch(error => {
  log.error(`Unexpected error: ${error.message}`);
  process.exit(1);
});

