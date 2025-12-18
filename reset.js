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

// ============================================================================
// RESOURCE FUNCTIONS
// ============================================================================

async function getAllCollections(workspaceId) {
  try {
    const response = await api.get(`/collections?workspace=${workspaceId}`);
    return response.data.collections || [];
  } catch (error) {
    return [];
  }
}

async function deleteCollection(collectionUid) {
  try {
    await api.delete(`/collections/${collectionUid}`);
    return true;
  } catch (error) {
    return false;
  }
}

async function getAllEnvironments(workspaceId) {
  try {
    const response = await api.get(`/environments?workspace=${workspaceId}`);
    return response.data.environments || [];
  } catch (error) {
    return [];
  }
}

async function deleteEnvironment(environmentUid) {
  try {
    await api.delete(`/environments/${environmentUid}`);
    return true;
  } catch (error) {
    return false;
  }
}

async function getAllMocks(workspaceId) {
  try {
    const response = await api.get(`/mocks?workspace=${workspaceId}`);
    return response.data.mocks || [];
  } catch (error) {
    return [];
  }
}

async function deleteMock(mockUid) {
  try {
    await api.delete(`/mocks/${mockUid}`);
    return true;
  } catch (error) {
    return false;
  }
}

async function getAllSpecs(workspaceId) {
  try {
    const response = await api.get(`/specs?workspace=${workspaceId}`);
    return response.data.apis || [];
  } catch (error) {
    return [];
  }
}

async function deleteSpec(specId) {
  try {
    await api.delete(`/specs/${specId}`);
    return true;
  } catch (error) {
    return false;
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
  console.log(`  • ${counts.specs} API spec(s)`);
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
  log.detail(`API Specs: ${specs.length}`);

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
  // DELETE MOCK SERVERS FIRST (they depend on collections)
  // =========================================================================
  if (mocks.length > 0) {
    log.step('Deleting mock servers...');
    
    for (const mock of mocks) {
      const success = await deleteMock(mock.uid);
      if (success) {
        results.mocks.deleted++;
        log.success(`Deleted mock: ${mock.name}`);
      } else {
        results.mocks.failed.push(mock.name);
        log.error(`Failed to delete mock: ${mock.name}`);
      }
      await delay(200);
    }
  }

  // =========================================================================
  // DELETE COLLECTIONS
  // =========================================================================
  if (collections.length > 0) {
    log.step('Deleting collections...');
    
    for (const collection of collections) {
      const success = await deleteCollection(collection.uid);
      if (success) {
        results.collections.deleted++;
        log.success(`Deleted collection: ${collection.name}`);
      } else {
        results.collections.failed.push(collection.name);
        log.error(`Failed to delete collection: ${collection.name}`);
      }
      await delay(200);
    }
  }

  // =========================================================================
  // DELETE ENVIRONMENTS
  // =========================================================================
  if (environments.length > 0) {
    log.step('Deleting environments...');
    
    for (const env of environments) {
      const success = await deleteEnvironment(env.uid);
      if (success) {
        results.environments.deleted++;
        log.success(`Deleted environment: ${env.name}`);
      } else {
        results.environments.failed.push(env.name);
        log.error(`Failed to delete environment: ${env.name}`);
      }
      await delay(200);
    }
  }

  // =========================================================================
  // DELETE API SPECS
  // =========================================================================
  if (specs.length > 0) {
    log.step('Deleting API specs...');
    
    for (const spec of specs) {
      const success = await deleteSpec(spec.id);
      if (success) {
        results.specs.deleted++;
        log.success(`Deleted API spec: ${spec.name}`);
      } else {
        results.specs.failed.push(spec.name);
        log.error(`Failed to delete API spec: ${spec.name}`);
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
  console.log(`\x1b[1mAPI Specs:\x1b[0m ${results.specs.deleted}/${results.specs.total} deleted`);

  const totalFailed = 
    results.collections.failed.length + 
    results.environments.failed.length + 
    results.mocks.failed.length + 
    results.specs.failed.length;

  if (totalFailed > 0) {
    console.log('\n\x1b[33m⚠ Some items failed to delete:\x1b[0m');
    
    if (results.collections.failed.length > 0) {
      console.log('  Collections:', results.collections.failed.join(', '));
    }
    if (results.environments.failed.length > 0) {
      console.log('  Environments:', results.environments.failed.join(', '));
    }
    if (results.mocks.failed.length > 0) {
      console.log('  Mocks:', results.mocks.failed.join(', '));
    }
    if (results.specs.failed.length > 0) {
      console.log('  Specs:', results.specs.failed.join(', '));
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

