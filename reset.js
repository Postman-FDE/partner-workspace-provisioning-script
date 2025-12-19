#!/usr/bin/env node
/**
 * Partner Workspace Reset Script
 * 
 * Modular system for resetting Postman workspaces to a blank state.
 * Removes all collections, mock servers, environments, and specs.
 * 
 * DELETION ORDER (reverse of provisioning):
 *   1. Delete specs first
 *   2. Delete mock servers (depend on collections)
 *   3. Delete environments
 *   4. Delete collections last
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

import 'dotenv/config';
import axios from 'axios';
import readline from 'readline';

// ============================================================================
// CONFIGURATION
// ============================================================================

const POSTMAN_API_KEY = process.env.POSTMAN_API_KEY;
const POSTMAN_SOURCE_WORKSPACE_ID = process.env.POSTMAN_SOURCE_WORKSPACE_ID;
const POSTMAN_TARGET_WORKSPACE_ID = process.env.POSTMAN_TARGET_WORKSPACE_ID;
const POSTMAN_API_BASE = "https://api.getpostman.com";

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
const CLI_WORKSPACE_ID = getArg('--workspace-id') || getArg('-w');
const SKIP_CONFIRM = hasFlag('--confirm') || hasFlag('-y');

// Runtime configuration - prioritize CLI, then env file
let runtimeConfig = {
  workspaceId: CLI_WORKSPACE_ID || POSTMAN_TARGET_WORKSPACE_ID || null,
};

// ============================================================================
// IN-MEMORY STORE
// Tracks resources found in workspace before deletion
// ============================================================================

const Store = {
  // Resources to delete
  collections: [],
  environments: [],
  mocks: [],
  specs: [],
  
  // Target workspace info
  targetWorkspace: null,
  
  // Clear all stores
  clear() {
    this.collections = [];
    this.environments = [];
    this.mocks = [];
    this.specs = [];
    this.targetWorkspace = null;
  },
  
  // Get total count of items to delete
  getTotalCount() {
    return this.collections.length + 
           this.environments.length + 
           this.mocks.length + 
           this.specs.length;
  },
  
  // Get summary of all stored data
  getSummary() {
    return {
      collections: this.collections.length,
      environments: this.environments.length,
      mocks: this.mocks.length,
      specs: this.specs.length,
    };
  }
};

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

const log = {
  step: (msg) => console.log(`\n\x1b[35m▸\x1b[0m ${msg}`),
  success: (msg) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`),
  error: (msg) => console.log(`  \x1b[31m✗\x1b[0m ${msg}`),
  warn: (msg) => console.log(`  \x1b[33m⚠\x1b[0m ${msg}`),
  info: (msg) => console.log(`  \x1b[36mℹ\x1b[0m ${msg}`),
  detail: (msg) => console.log(`    \x1b[90m${msg}\x1b[0m`),
};

function printBanner() {
  console.log('\x1b[31m');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║              POSTMAN WORKSPACE RESET SCRIPT                   ║');
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
};

// ============================================================================
// MODULE: COLLECTIONS
// API functions for collection management
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
   * Delete a collection
   * DELETE /collections/{collectionId}
   */
  async delete(collectionUid) {
    try {
      await api.delete(`/collections/${collectionUid}`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: logApiError('Delete collection', error, { collectionUid })
      };
    }
  },
};

/**
 * Collection Helper Functions
 */
const CollectionsHelper = {
  /**
   * Scan all collections in workspace and store in memory
   */
  async scanAll(workspaceId) {
    const collections = await CollectionsAPI.getAll(workspaceId);
    Store.collections = collections;
    return collections;
  },

  /**
   * Delete all collections stored in memory
   */
  async deleteAll() {
    const results = { deleted: 0, failed: [] };
    
    if (Store.collections.length === 0) {
      log.info('No collections to delete');
      return results;
    }
    
    log.info(`Deleting ${Store.collections.length} collection(s)`);
    
    for (const collection of Store.collections) {
      const deleteResult = await CollectionsAPI.delete(collection.uid);
      
      if (deleteResult.success) {
        results.deleted++;
        log.success(`Deleted: ${collection.name}`);
      } else {
        results.failed.push({ name: collection.name, error: deleteResult.error });
      }
      
      await delay(300);
    }
    
    return results;
  },
};

// ============================================================================
// MODULE: MOCKS
// API functions for mock server management
// ============================================================================

const MocksAPI = {
  /**
   * Get all mock servers in a workspace
   * GET /mocks?workspace={workspaceId}
   * 
   * Response contains: id, uid, name, collection, mockUrl, etc.
   * - id: The mock server's ID (use this for DELETE)
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
   * Delete a mock server
   * DELETE /mocks/{mockId}
   * 
   * Note: Use mock.id (not mock.uid) for deletion
   */
  async delete(mockId) {
    try {
      await api.delete(`/mocks/${mockId}`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: logApiError('Delete mock', error, { mockId })
      };
    }
  },
};

/**
 * Mock Server Helper Functions
 */
const MocksHelper = {
  /**
   * Scan all mocks in workspace and store in memory
   */
  async scanAll(workspaceId) {
    const mocks = await MocksAPI.getAll(workspaceId);
    Store.mocks = mocks;
    return mocks;
  },

  /**
   * Delete all mocks stored in memory
   * Note: Uses mock.id (not mock.uid) for the DELETE API call
   */
  async deleteAll() {
    const results = { deleted: 0, failed: [] };
    
    if (Store.mocks.length === 0) {
      log.info('No mock servers to delete');
      return results;
    }
    
    log.info(`Deleting ${Store.mocks.length} mock server(s)`);
    
    for (const mock of Store.mocks) {
      // Use mock.id (not mock.uid) for deletion
      const deleteResult = await MocksAPI.delete(mock.id);
      
      if (deleteResult.success) {
        results.deleted++;
        log.success(`Deleted: ${mock.name}`);
      } else {
        results.failed.push({ name: mock.name, error: deleteResult.error });
      }
      
      await delay(300);
    }
    
    return results;
  },
};

// ============================================================================
// MODULE: ENVIRONMENTS
// API functions for environment management
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
   * Delete an environment
   * DELETE /environments/{environmentId}
   */
  async delete(environmentUid) {
    try {
      await api.delete(`/environments/${environmentUid}`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: logApiError('Delete environment', error, { environmentUid })
      };
    }
  },
};

/**
 * Environment Helper Functions
 */
const EnvironmentsHelper = {
  /**
   * Scan all environments in workspace and store in memory
   */
  async scanAll(workspaceId) {
    const environments = await EnvironmentsAPI.getAll(workspaceId);
    Store.environments = environments;
    return environments;
  },

  /**
   * Delete all environments stored in memory
   */
  async deleteAll() {
    const results = { deleted: 0, failed: [] };
    
    if (Store.environments.length === 0) {
      log.info('No environments to delete');
      return results;
    }
    
    log.info(`Deleting ${Store.environments.length} environment(s)`);
    
    for (const env of Store.environments) {
      const deleteResult = await EnvironmentsAPI.delete(env.uid);
      
      if (deleteResult.success) {
        results.deleted++;
        log.success(`Deleted: ${env.name}`);
      } else {
        results.failed.push({ name: env.name, error: deleteResult.error });
      }
      
      await delay(300);
    }
    
    return results;
  },
};

// ============================================================================
// MODULE: SPECS
// API functions for spec management
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
   * Delete a spec
   * DELETE /specs/{specId}
   */
  async delete(specId) {
    try {
      await api.delete(`/specs/${specId}`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: logApiError('Delete spec', error, { specId })
      };
    }
  },
};

/**
 * Spec Helper Functions
 */
const SpecsHelper = {
  /**
   * Scan all specs in workspace and store in memory
   */
  async scanAll(workspaceId) {
    const specs = await SpecsAPI.getAll(workspaceId);
    Store.specs = specs;
    return specs;
  },

  /**
   * Delete all specs stored in memory
   */
  async deleteAll() {
    const results = { deleted: 0, failed: [] };
    
    if (Store.specs.length === 0) {
      log.info('No specs to delete');
      return results;
    }
    
    log.info(`Deleting ${Store.specs.length} spec(s)`);
    
    for (const spec of Store.specs) {
      const deleteResult = await SpecsAPI.delete(spec.id);
      
      if (deleteResult.success) {
        results.deleted++;
        log.success(`Deleted: ${spec.name}`);
      } else {
        results.failed.push({ name: spec.name, error: deleteResult.error });
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
  const rl = createReadline();
  
  console.log('\x1b[36m─────────────────────────────────────────────────────────────\x1b[0m');
  console.log('\x1b[1mConfiguration\x1b[0m\n');
  
  // Show current config
  console.log(`Current settings:`);
  console.log(`  API Key:          ${POSTMAN_API_KEY ? '\x1b[32m✓ Configured\x1b[0m' : '\x1b[31m✗ Missing\x1b[0m'}`);
  console.log(`  Target Workspace: ${runtimeConfig.workspaceId || '\x1b[31m(not set)\x1b[0m'}`);
  console.log('');
  
  // Check for missing required config
  if (!POSTMAN_API_KEY) {
    console.log('\x1b[31m✗ Missing API key. Please set POSTMAN_API_KEY in your .env file.\x1b[0m\n');
    rl.close();
    process.exit(1);
  }
  
  // If no workspace ID, prompt for one
  if (!runtimeConfig.workspaceId) {
    const targetId = await prompt(rl, '\x1b[33mEnter workspace ID to reset: \x1b[0m');
    if (targetId) {
      runtimeConfig.workspaceId = targetId;
    } else {
      console.log('\n\x1b[31m✗ Workspace ID is required.\x1b[0m\n');
      rl.close();
      process.exit(1);
    }
  }
  
  rl.close();
  return true;
}

async function confirmReset(workspaceName, counts) {
  const rl = createReadline();
  
  console.log('\n\x1b[33m═══════════════════════════════════════════════════════════════\x1b[0m');
  console.log('\x1b[33m                    ⚠ WARNING: DESTRUCTIVE ACTION\x1b[0m');
  console.log('\x1b[33m═══════════════════════════════════════════════════════════════\x1b[0m\n');
  
  console.log(`  \x1b[1mWorkspace:\x1b[0m ${workspaceName}`);
  console.log(`  \x1b[1mWorkspace ID:\x1b[0m ${runtimeConfig.workspaceId}`);
  console.log('');
  console.log('  \x1b[1mThis will permanently delete:\x1b[0m');
  console.log(`    • ${counts.specs} spec(s)`);
  console.log(`    • ${counts.mocks} mock server(s)`);
  console.log(`    • ${counts.environments} environment(s)`);
  console.log(`    • ${counts.collections} collection(s)`);
  console.log('');
  console.log('\x1b[31m  This action cannot be undone!\x1b[0m');
  console.log('');
  
  const answer = await prompt(rl, '\x1b[33mType "RESET" to confirm: \x1b[0m');
  rl.close();
  
  return answer.toUpperCase() === 'RESET';
}

// ============================================================================
// MAIN RESET WORKFLOW
// ============================================================================

async function runResetWorkflow() {
  const results = {
    workspace: null,
    specs: { total: 0, deleted: 0, failed: [] },
    mocks: { total: 0, deleted: 0, failed: [] },
    environments: { total: 0, deleted: 0, failed: [] },
    collections: { total: 0, deleted: 0, failed: [] },
  };

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
  
  if (!runtimeConfig.workspaceId) {
    log.error('Workspace ID is required. Use --workspace-id flag or set POSTMAN_TARGET_WORKSPACE_ID.');
    process.exit(1);
  }

  // Validate API key
  const validation = await WorkspaceAPI.validateApiKey();
  if (!validation.valid) {
    log.error(`Invalid API key: ${validation.error}`);
    process.exit(1);
  }
  log.success(`API key valid. Authenticated as: ${validation.user.username}`);

  // Verify workspace exists
  const workspace = await WorkspaceAPI.getWorkspace(runtimeConfig.workspaceId);
  if (!workspace) {
    log.error(`Workspace not found: ${runtimeConfig.workspaceId}`);
    process.exit(1);
  }
  results.workspace = workspace;
  Store.targetWorkspace = workspace;
  log.success(`Target workspace: ${workspace.name}`);

  // =========================================================================
  // SCAN WORKSPACE CONTENTS
  // =========================================================================
  log.step('Scanning workspace contents...');
  
  // Scan all resources in parallel
  await Promise.all([
    CollectionsHelper.scanAll(runtimeConfig.workspaceId),
    EnvironmentsHelper.scanAll(runtimeConfig.workspaceId),
    MocksHelper.scanAll(runtimeConfig.workspaceId),
    SpecsHelper.scanAll(runtimeConfig.workspaceId),
  ]);
  
  const summary = Store.getSummary();
  results.collections.total = summary.collections;
  results.environments.total = summary.environments;
  results.mocks.total = summary.mocks;
  results.specs.total = summary.specs;
  
  const totalItems = Store.getTotalCount();

  if (totalItems === 0) {
    log.info('Workspace is already empty. Nothing to reset.');
    return results;
  }

  log.info(`Found ${totalItems} item(s) to delete`);
  log.detail(`Collections: ${summary.collections}`);
  log.detail(`Environments: ${summary.environments}`);
  log.detail(`Mock Servers: ${summary.mocks}`);
  log.detail(`Specs: ${summary.specs}`);

  // =========================================================================
  // CONFIRMATION
  // =========================================================================
  if (!SKIP_CONFIRM) {
    const confirmed = await confirmReset(workspace.name, summary);
    if (!confirmed) {
      log.warn('Reset cancelled.');
      process.exit(0);
    }
  }

  // =========================================================================
  // DELETION ORDER: Reverse of provisioning
  // Provisioning: Collections → Mocks → Environments → Specs
  // Reset: Specs → Mocks → Environments → Collections
  // =========================================================================

  // =========================================================================
  // STEP 1: DELETE SPECS
  // =========================================================================
  log.step('Step 1: Deleting specs...');
  const specResults = await SpecsHelper.deleteAll();
  results.specs.deleted = specResults.deleted;
  results.specs.failed = specResults.failed;

  // =========================================================================
  // STEP 2: DELETE MOCKS (depend on collections, must delete before)
  // =========================================================================
  log.step('Step 2: Deleting mock servers...');
  const mockResults = await MocksHelper.deleteAll();
  results.mocks.deleted = mockResults.deleted;
  results.mocks.failed = mockResults.failed;

  // =========================================================================
  // STEP 3: DELETE ENVIRONMENTS
  // =========================================================================
  log.step('Step 3: Deleting environments...');
  const envResults = await EnvironmentsHelper.deleteAll();
  results.environments.deleted = envResults.deleted;
  results.environments.failed = envResults.failed;

  // =========================================================================
  // STEP 4: DELETE COLLECTIONS (last, since mocks depend on them)
  // =========================================================================
  log.step('Step 4: Deleting collections...');
  const collectionResults = await CollectionsHelper.deleteAll();
  results.collections.deleted = collectionResults.deleted;
  results.collections.failed = collectionResults.failed;

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n\x1b[36m════════════════════════════════════════════════════════════\x1b[0m');
  console.log('\x1b[1mReset Complete!\x1b[0m');
  console.log('\x1b[36m════════════════════════════════════════════════════════════\x1b[0m\n');
  
  console.log(`\x1b[1mWorkspace:\x1b[0m ${workspace.name}`);
  console.log(`  ID: ${runtimeConfig.workspaceId}`);
  console.log('');
  
  console.log('\x1b[1mResults Summary:\x1b[0m');
  console.log(`  Specs:        ${results.specs.deleted}/${results.specs.total} deleted`);
  console.log(`  Mock Servers: ${results.mocks.deleted}/${results.mocks.total} deleted`);
  console.log(`  Environments: ${results.environments.deleted}/${results.environments.total} deleted`);
  console.log(`  Collections:  ${results.collections.deleted}/${results.collections.total} deleted`);
  
  // Show failures if any
  const allFailures = [
    ...results.specs.failed.map(f => ({ type: 'Spec', ...f })),
    ...results.mocks.failed.map(f => ({ type: 'Mock', ...f })),
    ...results.environments.failed.map(f => ({ type: 'Environment', ...f })),
    ...results.collections.failed.map(f => ({ type: 'Collection', ...f })),
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
  
  // Show interactive menu unless --confirm flag is provided with workspace ID
  if (!SKIP_CONFIRM || !runtimeConfig.workspaceId) {
    await showInteractiveMenu();
  }
  
  try {
    await runResetWorkflow();
  } catch (error) {
    log.error(`Reset failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Export modules for external use
export {
  WorkspaceAPI,
  CollectionsAPI,
  CollectionsHelper,
  MocksAPI,
  MocksHelper,
  EnvironmentsAPI,
  EnvironmentsHelper,
  SpecsAPI,
  SpecsHelper,
  Store,
  runResetWorkflow,
};

// Run if executed directly
main();
