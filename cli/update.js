#!/usr/bin/env node
/**
 * Partner Workspace Update Script
 *
 * Scans source and target workspaces, detects net-new collections, specs, and
 * environments, then adds them to the target workspace with full mock URL wiring.
 *
 * UPDATE WORKFLOW:
 *   1. Scan source and target workspaces for asset differences
 *   2. Fork new collections from source to target
 *   3. Create mock servers for new collections
 *   4. Update Mock Env with new mock URL variables (in-place)
 *   5. Update new collection variables to reference mock env vars
 *   6. Copy new spec files from source to target
 *   7. Copy new environments from source to target
 *
 * Required Environment Variables:
 *   - POSTMAN_API_KEY: Your Postman API key
 *   - POSTMAN_SOURCE_WORKSPACE_ID: Source workspace to detect changes from
 *   - POSTMAN_TARGET_WORKSPACE_ID: Target partner workspace to update
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

const COMMON_HOST_VAR_NAMES = [
  'baseUrl', 'baseurl', 'base_url', 'HostName', 'hostname', 'host',
  'apiUrl', 'apiurl', 'api_url', 'serverUrl', 'serverurl', 'server_url',
];

const api = axios.create({
  baseURL: POSTMAN_API_BASE,
  headers: {
    "Content-Type": "application/json",
    "X-Api-Key": POSTMAN_API_KEY || "",
  },
});

const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
};
const hasFlag = (flag) => args.includes(flag);

// ============================================================================
// UTILITIES
// ============================================================================

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const log = {
  info: (msg) => console.log(`\x1b[36m\u2139\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m\u2713\x1b[0m ${msg}`),
  warn: (msg) => console.log(`\x1b[33m\u26A0\x1b[0m ${msg}`),
  error: (msg) => console.log(`\x1b[31m\u2717\x1b[0m ${msg}`),
  section: (msg) => console.log(`\n\x1b[1m\x1b[35m\u2550\u2550\u2550 ${msg} \u2550\u2550\u2550\x1b[0m\n`),
};

function toPascalCase(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[^a-zA-Z0-9]/g, ' ')
    .split(/\s+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
}

function toVariableName(name) {
  const clean = name.replace(/[^a-zA-Z0-9\s]/g, '');
  const words = clean.split(/\s+/);
  return words.map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
}

function extractUrlPath(urlString) {
  try { const url = new URL(urlString); return url.pathname === '/' ? '' : url.pathname; } catch { return ''; }
}

function extractHostVariables(collection) {
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
  const collVars = collection.variable || [];

  const mapHostVar = (varName) => {
    const varDef = collVars.find(v => v.key === varName);
    const originalUrl = varDef?.value || '';
    return { varName, originalUrl, path: extractUrlPath(originalUrl) };
  };

  if (hostVarNames.size > 0) {
    const mapped = Array.from(hostVarNames).map(mapHostVar);
    const withProto = mapped.filter(hv => hv.originalUrl.includes('://'));
    return withProto.length > 0 ? withProto : mapped.map(hv => ({ ...hv, path: '' }));
  }

  return collVars
    .filter(v => COMMON_HOST_VAR_NAMES.some(n => n.toLowerCase() === v.key.toLowerCase()))
    .map(v => ({ varName: v.key, originalUrl: v.value || '', path: v.value?.includes('://') ? extractUrlPath(v.value) : '' }));
}

// ============================================================================
// API HELPERS
// ============================================================================

async function apiGet(path) {
  try {
    const { data } = await api.get(path);
    return data;
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    throw new Error(`GET ${path} failed: ${msg}`);
  }
}

async function apiPost(path, payload) {
  try {
    const { data } = await api.post(path, payload);
    return data;
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    throw new Error(`POST ${path} failed: ${msg}`);
  }
}

async function apiPut(path, payload) {
  try {
    const { data } = await api.put(path, payload);
    return data;
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    throw new Error(`PUT ${path} failed: ${msg}`);
  }
}

async function apiPatch(path, payload) {
  try {
    const { data } = await api.patch(path, payload);
    return data;
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    throw new Error(`PATCH ${path} failed: ${msg}`);
  }
}

// ============================================================================
// DETECTION
// ============================================================================

async function detectNewAssets(sourceId, targetId) {
  log.section('SCANNING WORKSPACES');

  const [sourceCollRes, targetCollRes, sourceSpecRes, targetSpecRes, sourceEnvRes, targetEnvRes] = await Promise.all([
    apiGet(`/collections?workspace=${sourceId}`),
    apiGet(`/collections?workspace=${targetId}`),
    apiGet(`/specs?workspaceId=${sourceId}`),
    apiGet(`/specs?workspaceId=${targetId}`),
    apiGet(`/environments?workspace=${sourceId}`),
    apiGet(`/environments?workspace=${targetId}`),
  ]);

  const sourceColls = sourceCollRes.collections || [];
  const targetColls = targetCollRes.collections || [];
  const sourceSpecs = sourceSpecRes.specs || [];
  const targetSpecs = targetSpecRes.specs || [];
  const sourceEnvs = sourceEnvRes.environments || [];
  const targetEnvs = targetEnvRes.environments || [];

  log.info(`Source: ${sourceColls.length} collections, ${sourceSpecs.length} specs, ${sourceEnvs.length} environments`);
  log.info(`Target: ${targetColls.length} collections, ${targetSpecs.length} specs, ${targetEnvs.length} environments`);

  // Collections: fork check + name fallback
  const targetForkSources = new Set();
  const targetNames = new Set();
  for (const tc of targetColls) {
    targetNames.add(tc.name);
    try {
      const details = await apiGet(`/collections/${tc.uid}`);
      const forkFrom = details?.collection?.fork?.from;
      if (forkFrom) targetForkSources.add(forkFrom);
    } catch { /* ignore */ }
    await delay(300);
  }

  const newCollections = sourceColls.filter(sc => !targetForkSources.has(sc.uid) && !targetNames.has(sc.name));

  // Normalize names for robust comparison (case-insensitive, trimmed)
  const normalize = (name) => (name || '').toLowerCase().trim();

  // Specs: name match
  const targetSpecNames = new Set(targetSpecs.map(s => normalize(s.name)));
  const newSpecs = sourceSpecs.filter(s => !targetSpecNames.has(normalize(s.name)));

  // Environments: name match, exclude Mock Env
  const targetEnvNames = new Set(targetEnvs.map(e => normalize(e.name)));
  const newEnvironments = sourceEnvs.filter(e => e.name !== 'Mock Env' && !targetEnvNames.has(normalize(e.name)));

  log.info(`Target spec names: [${targetSpecs.map(s => s.name).join(', ')}]`);
  log.info(`Source spec names: [${sourceSpecs.map(s => s.name).join(', ')}]`);
  log.info(`New: ${newCollections.length} collections, ${newSpecs.length} specs, ${newEnvironments.length} environments`);

  return { newCollections, newSpecs, newEnvironments, targetEnvs };
}

// ============================================================================
// PROCESSING
// ============================================================================

async function processNewCollections(newCollections, targetId) {
  log.section('FORKING NEW COLLECTIONS');
  const store = { collections: new Map(), mocks: new Map() };

  for (const coll of newCollections) {
    log.info(`Forking "${coll.name}"...`);
    try {
      const forkRes = await apiPost(`/collections/fork/${coll.uid}?workspace=${targetId}`, { label: coll.name });
      const forkedUid = forkRes.collection?.uid;
      if (!forkedUid) throw new Error('No UID in fork response');

      const details = await apiGet(`/collections/${forkedUid}`);
      const collDetails = details?.collection;
      const hostVars = collDetails ? extractHostVariables(collDetails) : [];

      store.collections.set(coll.uid, {
        sourceUid: coll.uid, targetUid: forkedUid, name: coll.name,
        hostVariables: hostVars, collectionDetails: collDetails,
      });
      log.success(`Forked "${coll.name}" \u2192 ${forkedUid}`);
    } catch (err) {
      log.error(`Failed to fork "${coll.name}": ${err.message}`);
    }
    await delay(300);
  }

  // Create mocks
  if (store.collections.size > 0) {
    log.section('CREATING MOCK SERVERS');
    for (const [, collData] of store.collections) {
      const mockName = `${collData.name} Mock`;
      log.info(`Creating "${mockName}"...`);
      try {
        const mockRes = await apiPost(`/mocks?workspace=${targetId}`, {
          mock: { name: mockName, collection: collData.targetUid, private: false },
        });
        const mock = mockRes.mock;
        store.mocks.set(collData.targetUid, {
          mockId: mock.id, mockUrl: mock.mockUrl, name: mockName, collectionName: collData.name,
        });
        log.success(`Created "${mockName}" \u2192 ${mock.mockUrl}`);
      } catch (err) {
        log.error(`Failed to create mock for "${collData.name}": ${err.message}`);
      }
      await delay(300);
    }
  }

  return store;
}

async function updateMockEnv(targetId, store, targetEnvs) {
  if (store.mocks.size === 0) return new Map();

  log.section('UPDATING MOCK ENVIRONMENT');

  // Generate new variables
  const variables = [];
  const mockEnvVarMap = new Map();

  for (const [, collData] of store.collections) {
    const mockData = Array.from(store.mocks.values()).find(m => m.collectionName === collData.name);
    if (!mockData) continue;

    const hostVars = collData.hostVariables || [];
    if (hostVars.length === 0) {
      const varName = toVariableName(collData.name) + 'BaseUrl';
      variables.push({ key: varName, value: mockData.mockUrl, type: 'default', enabled: true });
      mockEnvVarMap.set(`${collData.targetUid}:__fallback__`, varName);
    } else {
      for (const hv of hostVars) {
        const envVarName = toVariableName(collData.name) + toPascalCase(hv.varName);
        variables.push({ key: envVarName, value: mockData.mockUrl, type: 'default', enabled: true });
        mockEnvVarMap.set(`${collData.targetUid}:${hv.varName}`, envVarName);
      }
    }
  }

  if (variables.length === 0) return mockEnvVarMap;

  // Find existing Mock Env
  const mockEnv = targetEnvs.find(e => e.name === 'Mock Env');

  if (mockEnv) {
    const details = await apiGet(`/environments/${mockEnv.uid}`);
    const existingVars = details?.environment?.values || [];
    const existingKeys = new Set(existingVars.map(v => v.key));

    const deduped = variables.map(v => {
      if (existingKeys.has(v.key)) {
        let suffix = 2;
        let newKey = `${v.key}${suffix}`;
        while (existingKeys.has(newKey)) { suffix++; newKey = `${v.key}${suffix}`; }
        for (const [mapKey, mapVal] of mockEnvVarMap.entries()) {
          if (mapVal === v.key) mockEnvVarMap.set(mapKey, newKey);
        }
        return { ...v, key: newKey };
      }
      return v;
    });

    const merged = [...existingVars, ...deduped];
    await apiPut(`/environments/${mockEnv.uid}`, { environment: { name: 'Mock Env', values: merged } });
    log.success(`Updated Mock Env with ${deduped.length} new variable(s)`);
  } else {
    await apiPost(`/environments?workspace=${targetId}`, {
      environment: { name: 'Mock Env', values: variables },
    });
    log.success(`Created Mock Env with ${variables.length} variable(s)`);
  }

  return mockEnvVarMap;
}

async function updateCollectionVariables(store, mockEnvVarMap) {
  if (!mockEnvVarMap || mockEnvVarMap.size === 0) return;

  log.section('UPDATING COLLECTION VARIABLES');

  for (const [, collData] of store.collections) {
    if (!collData.collectionDetails) continue;
    const hostVars = collData.hostVariables || [];
    const existingVars = collData.collectionDetails.variable || [];

    if (hostVars.length > 0) {
      const updatedVars = existingVars.map(v => {
        const hv = hostVars.find(h => h.varName === v.key);
        if (hv) {
          const envName = mockEnvVarMap.get(`${collData.targetUid}:${hv.varName}`);
          if (envName) return { ...v, value: `{{${envName}}}` };
        }
        return v;
      });
      for (const hv of hostVars) {
        const envName = mockEnvVarMap.get(`${collData.targetUid}:${hv.varName}`);
        if (envName && !updatedVars.some(v => v.key === hv.varName)) {
          updatedVars.push({ key: hv.varName, value: `{{${envName}}}`, type: 'string' });
        }
      }
      await apiPatch(`/collections/${collData.targetUid}`, { collection: { variable: updatedVars } });
      log.success(`Updated variables for "${collData.name}"`);
      await delay(300);
      continue;
    }

    const fallback = mockEnvVarMap.get(`${collData.targetUid}:__fallback__`);
    if (!fallback) continue;
    const commonVar = existingVars.find(v => COMMON_HOST_VAR_NAMES.some(n => n.toLowerCase() === v.key.toLowerCase()));
    const updatedVars = commonVar
      ? existingVars.map(v => v.key === commonVar.key ? { ...v, value: `{{${fallback}}}` } : v)
      : [...existingVars, { key: 'baseUrl', value: `{{${fallback}}}`, type: 'string' }];
    await apiPatch(`/collections/${collData.targetUid}`, { collection: { variable: updatedVars } });
    log.success(`Updated variables for "${collData.name}" (fallback)`);
    await delay(300);
  }
}

async function copyNewSpecs(newSpecs, targetId) {
  log.section('COPYING NEW SPECS');
  for (const spec of newSpecs) {
    log.info(`Copying "${spec.name}"...`);
    try {
      const filesRes = await apiGet(`/specs/${spec.id}/files`);
      const files = filesRes.files || [];
      const filesWithContent = [];
      for (const f of files) {
        const fileData = await apiGet(`/specs/${spec.id}/files/${f.path}`);
        if (fileData?.content) {
          filesWithContent.push({ path: f.path, content: fileData.content, type: f.type });
        }
        await delay(200);
      }
      if (filesWithContent.length > 0) {
        await apiPost(`/specs?workspaceId=${targetId}`, { name: spec.name, type: spec.type, files: filesWithContent });
        log.success(`Copied "${spec.name}" (${filesWithContent.length} file(s))`);
      }
    } catch (err) {
      log.error(`Failed to copy spec "${spec.name}": ${err.message}`);
    }
    await delay(500);
  }
}

async function copyNewEnvironments(newEnvironments, targetId) {
  log.section('COPYING NEW ENVIRONMENTS');
  for (const env of newEnvironments) {
    log.info(`Copying "${env.name}"...`);
    try {
      const details = await apiGet(`/environments/${env.uid}`);
      const envData = details?.environment;
      if (envData) {
        await apiPost(`/environments?workspace=${targetId}`, {
          environment: { name: envData.name, values: envData.values || [] },
        });
        log.success(`Copied "${env.name}"`);
      }
    } catch (err) {
      log.error(`Failed to copy environment "${env.name}": ${err.message}`);
    }
    await delay(300);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n\x1b[1m\x1b[36m\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\x1b[0m');
  console.log('\x1b[1m\x1b[36m\u2551   Partner Workspace Update Detection     \u2551\x1b[0m');
  console.log('\x1b[1m\x1b[36m\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\x1b[0m\n');

  const sourceId = getArg('--source') || POSTMAN_SOURCE_WORKSPACE_ID;
  const targetId = getArg('--target') || POSTMAN_TARGET_WORKSPACE_ID;

  if (!POSTMAN_API_KEY) { log.error('POSTMAN_API_KEY is required'); process.exit(1); }
  if (!sourceId) { log.error('Source workspace ID is required (--source or POSTMAN_SOURCE_WORKSPACE_ID)'); process.exit(1); }
  if (!targetId) { log.error('Target workspace ID is required (--target or POSTMAN_TARGET_WORKSPACE_ID)'); process.exit(1); }

  // Validate API key
  try {
    const me = await apiGet('/me');
    log.success(`Authenticated as ${me.user?.username || 'unknown'}`);
  } catch (err) {
    log.error(`Authentication failed: ${err.message}`);
    process.exit(1);
  }

  // Detect
  const { newCollections, newSpecs, newEnvironments, targetEnvs } = await detectNewAssets(sourceId, targetId);

  // Auto-link specs to collections: only copy specs whose names match a new collection
  const normalize = (name) => (name || '').toLowerCase().trim();
  const newCollectionNames = new Set(newCollections.map(c => normalize(c.name)));
  const linkedSpecs = newSpecs.filter(s => newCollectionNames.has(normalize(s.name)));

  if (newCollections.length === 0 && linkedSpecs.length === 0 && newEnvironments.length === 0) {
    log.success('Workspace is up to date \u2014 no new assets found.');
    process.exit(0);
  }

  // Show diff of detected changes
  log.section('CHANGES DETECTED');
  if (newCollections.length > 0) {
    log.info(`New Collections (${newCollections.length}):`);
    newCollections.forEach(c => log.info(`  \u2022 ${c.name}`));
  }
  if (linkedSpecs.length > 0) {
    log.info(`New API Specs (${linkedSpecs.length}):`);
    linkedSpecs.forEach(s => log.info(`  \u2022 ${s.name}`));
  }
  if (newEnvironments.length > 0) {
    log.info(`New Environments (${newEnvironments.length}):`);
    newEnvironments.forEach(e => log.info(`  \u2022 ${e.name}`));
  }

  // Confirm unless --confirm flag is present
  if (!hasFlag('--confirm')) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(resolve => rl.question(
      `\nProceed with adding ${newCollections.length} collection(s), ${linkedSpecs.length} spec(s), ${newEnvironments.length} environment(s)? (y/n) `,
      resolve
    ));
    rl.close();
    if (answer.toLowerCase() !== 'y') { log.warn('Cancelled.'); process.exit(0); }
  }

  // Process
  const store = await processNewCollections(newCollections, targetId);
  const mockEnvVarMap = await updateMockEnv(targetId, store, targetEnvs);
  await updateCollectionVariables(store, mockEnvVarMap);

  if (linkedSpecs.length > 0) await copyNewSpecs(linkedSpecs, targetId);
  if (newEnvironments.length > 0) await copyNewEnvironments(newEnvironments, targetId);

  // Summary
  log.section('UPDATE COMPLETE');
  log.success(`Collections added: ${store.collections.size}`);
  log.success(`Mocks created: ${store.mocks.size}`);
  log.success(`Specs copied: ${linkedSpecs.length}`);
  log.success(`Environments copied: ${newEnvironments.length}`);
}

main().catch(err => {
  log.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
