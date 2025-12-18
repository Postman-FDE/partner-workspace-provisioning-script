#!/usr/bin/env node

/**
 * Partner Workspace Reset Script
 * 
 * Resets a Postman workspace by removing all collections, environments, 
 * mock servers, and API specs - returning it to a blank state.
 * 
 * Required Environment Variables:
 *   - POSTMAN_API_KEY: Your Postman API key
 *   - POSTMAN_TARGET_WORKSPACE_ID: Workspace to reset (or use --workspace-id flag)
 * 
 * Usage:
 *   node reset.js
 *   node reset.js --workspace-id "workspace-id-to-reset"
 *   node reset.js --confirm  # Skip confirmation prompt
 */

import axios from "axios";
import 'dotenv/config';
import * as readline from 'readline';

// ============================================================================
// CONFIGURATION
// ============================================================================

const POSTMAN_API_KEY = process.env.POSTMAN_API_KEY || process.env.VITE_POSTMAN_API_KEY;
const POSTMAN_TARGET_WORKSPACE_ID = process.env.POSTMAN_TARGET_WORKSPACE_ID || process.env.VITE_POSTMAN_TARGET_WORKSPACE_ID;
const POSTMAN_API_BASE = "https://api.getpostman.com";

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
};
const hasFlag = (flag) => args.includes(flag);

const CLI_WORKSPACE_ID = getArg('--workspace-id') || getArg('-w');
const SKIP_CONFIRM = hasFlag('--confirm') || hasFlag('-y');
const WORKSPACE_ID = CLI_WORKSPACE_ID || POSTMAN_TARGET_WORKSPACE_ID;

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
  console.log('\n\x1b[31m╔════════════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[31m║\x1b[0m          \x1b[1mPostman Workspace Reset Script\x1b[0m                 \x1b[31m║\x1b[0m');
  console.log('\x1b[31m╚════════════════════════════════════════════════════════════╝\x1b[0m\n');
};

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

/**
 * Extract detailed error information from axios errors
 */
function getErrorDetails(error) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const statusText = error.response?.statusText;
    const errorMessage = error.response?.data?.error?.message 
      || error.response?.data?.message 
      || error.message;
    const errorName = error.response?.data?.error?.name;
    const errorDetails = error.response?.data?.error?.details;
    
    let fullMessage = '';
    if (status) fullMessage += `[${status}${statusText ? ' ' + statusText : ''}] `;
    if (errorName) fullMessage += `${errorName}: `;
    fullMessage += errorMessage;
    if (errorDetails) fullMessage += ` - ${JSON.stringify(errorDetails)}`;
    
    return {
      status,
      message: fullMessage,
      raw: error.response?.data
    };
  }
  return {
    status: null,
    message: error.message || 'Unknown error',
    raw: null
  };
}

/**
 * Log detailed API error
 */
function logApiError(operation, error, context = {}) {
  const details = getErrorDetails(error);
  log.error(`${operation}: ${details.message}`);
  
  if (context.endpoint) {
    log.detail(`Endpoint: ${context.endpoint}`);
  }
  if (context.id) {
    log.detail(`Resource ID: ${context.id}`);
  }
  if (details.raw && process.env.DEBUG) {
    log.detail(`Raw response: ${JSON.stringify(details.raw, null, 2)}`);
  }
  
  return details.message;
}

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
    logApiError('Failed to get workspace', error, { 
      endpoint: `/workspaces/${workspaceId}`,
      id: workspaceId 
    });
    return null;
  }
}

// ============================================================================
// RESOURCE FUNCTIONS
// ============================================================================

async function getAllCollections(workspaceId) {
  try {
    const response = await api.get(`/collections?workspace=${workspaceId}`);
    return response.data.collections || [];
  } catch (error) {
    logApiError('Failed to get collections', error, { 
      endpoint: `/collections?workspace=${workspaceId}`,
      id: workspaceId 
    });
    return [];
  }
}

async function deleteCollection(collectionUid) {
  try {
    await api.delete(`/collections/${collectionUid}`);
    return { success: true };
  } catch (error) {
    const errorMsg = logApiError('Failed to delete collection', error, { 
      endpoint: `/collections/${collectionUid}`,
      id: collectionUid 
    });
    return { success: false, error: errorMsg };
  }
}

async function getAllEnvironments(workspaceId) {
  try {
    const response = await api.get(`/environments?workspace=${workspaceId}`);
    return response.data.environments || [];
  } catch (error) {
    logApiError('Failed to get environments', error, { 
      endpoint: `/environments?workspace=${workspaceId}`,
      id: workspaceId 
    });
    return [];
  }
}

async function deleteEnvironment(environmentUid) {
  try {
    await api.delete(`/environments/${environmentUid}`);
    return { success: true };
  } catch (error) {
    const errorMsg = logApiError('Failed to delete environment', error, { 
      endpoint: `/environments/${environmentUid}`,
      id: environmentUid 
    });
    return { success: false, error: errorMsg };
  }
}

async function getAllMocks(workspaceId) {
  try {
    const response = await api.get(`/mocks?workspace=${workspaceId}`);
    return response.data.mocks || [];
  } catch (error) {
    logApiError('Failed to get mocks', error, { 
      endpoint: `/mocks?workspace=${workspaceId}`,
      id: workspaceId 
    });
    return [];
  }
}

async function deleteMock(mockUid) {
  try {
    await api.delete(`/mocks/${mockUid}`);
    return { success: true };
  } catch (error) {
    const errorMsg = logApiError('Failed to delete mock', error, { 
      endpoint: `/mocks/${mockUid}`,
      id: mockUid 
    });
    return { success: false, error: errorMsg };
  }
}

async function getAllSpecs(workspaceId) {
  try {
    const response = await api.get(`/specs?workspaceId=${workspaceId}`);
    return response.data.specs || [];
  } catch (error) {
    logApiError('Failed to get specs', error, { 
      endpoint: `/specs?workspaceId=${workspaceId}`,
      id: workspaceId 
    });
    return [];
  }
}

async function deleteSpec(specId) {
  try {
    await api.delete(`/specs/${specId}`);
    return { success: true };
  } catch (error) {
    const errorMsg = logApiError('Failed to delete spec', error, { 
      endpoint: `/specs/${specId}`,
      id: specId 
    });
    return { success: false, error: errorMsg };
  }
}

// ============================================================================
// CONFIRMATION PROMPT
// ============================================================================

async function confirmReset(workspaceName, counts) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\n\x1b[33m⚠ WARNING: This action cannot be undone!\x1b[0m\n');
  console.log(`Workspace: \x1b[1m${workspaceName}\x1b[0m`);
  console.log(`This will delete:`);
  console.log(`  • ${counts.collections} collection(s)`);
  console.log(`  • ${counts.environments} environment(s)`);
  console.log(`  • ${counts.mocks} mock server(s)`);
  console.log(`  • ${counts.specs} spec(s)`);
  console.log('');

  return new Promise((resolve) => {
    rl.question('\x1b[33mType "RESET" to confirm: \x1b[0m', (answer) => {
      rl.close();
      resolve(answer.trim().toUpperCase() === 'RESET');
    });
  });
}

// ============================================================================
// MAIN RESET LOGIC
// ============================================================================

async function reset() {
  printBanner();

  const results = {
    collections: { deleted: 0, total: 0, failed: [] },
    environments: { deleted: 0, total: 0, failed: [] },
    mocks: { deleted: 0, total: 0, failed: [] },
    specs: { deleted: 0, total: 0, failed: [] },
  };

  // Validate configuration
  log.step('Validating configuration...');

  if (!POSTMAN_API_KEY) {
    log.error('POSTMAN_API_KEY is required. Set it in your environment or .env file.');
    process.exit(1);
  }

  if (!WORKSPACE_ID) {
    log.error('Workspace ID is required. Use --workspace-id flag or set POSTMAN_TARGET_WORKSPACE_ID.');
    console.log('\nUsage:');
    console.log('  node reset.js --workspace-id "your-workspace-id"');
    console.log('  OR set POSTMAN_TARGET_WORKSPACE_ID in your .env file');
    process.exit(1);
  }

  // Validate API key
  const validation = await validateApiKey();
  if (!validation.valid) {
    log.error(`Invalid API key: ${validation.error}`);
    process.exit(1);
  }
  log.success(`API key valid. Authenticated as: ${validation.user.username}`);

  // Verify workspace exists
  const workspace = await getWorkspace(WORKSPACE_ID);
  if (!workspace) {
    log.error(`Workspace not found: ${WORKSPACE_ID}`);
    process.exit(1);
  }
  log.success(`Target workspace: ${workspace.name}`);

  // Get counts of items to delete
  log.step('Scanning workspace contents...');
  
  const [collections, environments, mocks, specs] = await Promise.all([
    getAllCollections(WORKSPACE_ID),
    getAllEnvironments(WORKSPACE_ID),
    getAllMocks(WORKSPACE_ID),
    getAllSpecs(WORKSPACE_ID),
  ]);

  results.collections.total = collections.length;
  results.environments.total = environments.length;
  results.mocks.total = mocks.length;
  results.specs.total = specs.length;

  const totalItems = collections.length + environments.length + mocks.length + specs.length;

  if (totalItems === 0) {
    log.info('Workspace is already empty. Nothing to reset.');
    process.exit(0);
  }

  log.info(`Found ${totalItems} item(s) to delete`);
  log.detail(`Collections: ${collections.length}`);
  log.detail(`Environments: ${environments.length}`);
  log.detail(`Mock Servers: ${mocks.length}`);
  log.detail(`Specs: ${specs.length}`);

  // Confirmation
  if (!SKIP_CONFIRM) {
    const confirmed = await confirmReset(workspace.name, {
      collections: collections.length,
      environments: environments.length,
      mocks: mocks.length,
      specs: specs.length,
    });

    if (!confirmed) {
      log.warn('Reset cancelled.');
      process.exit(0);
    }
  }

  // =========================================================================
  // DELETION ORDER: Reverse of provisioning (Specs → Mocks → Environments → Collections)
  // Provisioning creates: Collections → Environments → Mocks → Specs
  // Reset deletes in reverse to handle dependencies properly
  // =========================================================================

  // =========================================================================
  // 1. DELETE SPECS FIRST
  // =========================================================================
  if (specs.length > 0) {
    log.step('Deleting specs...');
    
    for (const spec of specs) {
      const result = await deleteSpec(spec.id);
      if (result.success) {
        results.specs.deleted++;
        log.success(`Deleted spec: ${spec.name}`);
      } else {
        results.specs.failed.push({ name: spec.name, error: result.error });
      }
      await delay(200);
    }
  }

  // =========================================================================
  // 2. DELETE MOCK SERVERS (depend on collections, must delete before collections)
  // =========================================================================
  if (mocks.length > 0) {
    log.step('Deleting mock servers...');
    
    for (const mock of mocks) {
      const result = await deleteMock(mock.uid);
      if (result.success) {
        results.mocks.deleted++;
        log.success(`Deleted mock: ${mock.name}`);
      } else {
        results.mocks.failed.push({ name: mock.name, error: result.error });
      }
      await delay(200);
    }
  }

  // =========================================================================
  // 3. DELETE ENVIRONMENTS
  // =========================================================================
  if (environments.length > 0) {
    log.step('Deleting environments...');
    
    for (const env of environments) {
      const result = await deleteEnvironment(env.uid);
      if (result.success) {
        results.environments.deleted++;
        log.success(`Deleted environment: ${env.name}`);
      } else {
        results.environments.failed.push({ name: env.name, error: result.error });
      }
      await delay(200);
    }
  }

  // =========================================================================
  // 4. DELETE COLLECTIONS LAST
  // =========================================================================
  if (collections.length > 0) {
    log.step('Deleting collections...');
    
    for (const collection of collections) {
      const result = await deleteCollection(collection.uid);
      if (result.success) {
        results.collections.deleted++;
        log.success(`Deleted collection: ${collection.name}`);
      } else {
        results.collections.failed.push({ name: collection.name, error: result.error });
      }
      await delay(200);
    }
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n\x1b[36m═══════════════════════════════════════════════════════════════\x1b[0m');
  console.log('\x1b[1m                        RESET COMPLETE\x1b[0m');
  console.log('\x1b[36m═══════════════════════════════════════════════════════════════\x1b[0m\n');

  console.log(`\x1b[1mWorkspace:\x1b[0m ${workspace.name}`);
  console.log(`\x1b[1mWorkspace ID:\x1b[0m ${WORKSPACE_ID}`);
  console.log('');
  console.log(`\x1b[1mCollections:\x1b[0m ${results.collections.deleted}/${results.collections.total} deleted`);
  console.log(`\x1b[1mEnvironments:\x1b[0m ${results.environments.deleted}/${results.environments.total} deleted`);
  console.log(`\x1b[1mMock Servers:\x1b[0m ${results.mocks.deleted}/${results.mocks.total} deleted`);
  console.log(`\x1b[1mSpecs:\x1b[0m ${results.specs.deleted}/${results.specs.total} deleted`);

  const totalFailed = 
    results.collections.failed.length + 
    results.environments.failed.length + 
    results.mocks.failed.length + 
    results.specs.failed.length;

  if (totalFailed > 0) {
    console.log('\n\x1b[33m⚠ Some items failed to delete:\x1b[0m');
    
    if (results.collections.failed.length > 0) {
      console.log('  \x1b[1mCollections:\x1b[0m');
      results.collections.failed.forEach(f => {
        console.log(`    • ${f.name}`);
      });
    }
    if (results.environments.failed.length > 0) {
      console.log('  \x1b[1mEnvironments:\x1b[0m');
      results.environments.failed.forEach(f => {
        console.log(`    • ${f.name}`);
      });
    }
    if (results.mocks.failed.length > 0) {
      console.log('  \x1b[1mMocks:\x1b[0m');
      results.mocks.failed.forEach(f => {
        console.log(`    • ${f.name}`);
      });
    }
    if (results.specs.failed.length > 0) {
      console.log('  \x1b[1mSpecs:\x1b[0m');
      results.specs.failed.forEach(f => {
        console.log(`    • ${f.name}`);
      });
    }
  }

  console.log('\n\x1b[32m✓ Workspace has been reset!\x1b[0m\n');
  
  return results;
}

// Run the script
reset().catch(error => {
  log.error(`Unexpected error: ${error.message}`);
  process.exit(1);
});

