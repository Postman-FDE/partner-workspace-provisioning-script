/**
 * Update Detection Service
 *
 * Scans source and target workspaces, detects net-new assets
 * (collections, specs, environments), and adds them to the target
 * with full mock URL wiring.
 */

import { PostmanClient } from '../client';
import {
  Collection,
  CollectionDetails,
  Environment,
  EnvironmentVariable,
  Spec,
  SpecType,
  SpecFileType,
  HostVariableInfo,
  ProgressEvent,
} from '../types';

const COMMON_HOST_VAR_NAMES = [
  'baseUrl', 'baseurl', 'base_url', 'HostName', 'hostname', 'host',
  'apiUrl', 'apiurl', 'api_url', 'serverUrl', 'serverurl', 'server_url',
];

// ── Public types ──────────────────────────────────────────────────────

export interface UpdateConfig {
  sourceWorkspaceId: string;
  targetWorkspaceId: string;
}

interface AssetResultBlock {
  total: number;
  success: number;
  failed: Array<{ name: string; error: string }>;
  successData: Array<Record<string, unknown>>;
}

export interface UpdateResult {
  newCollections: AssetResultBlock;
  newSpecs: AssetResultBlock;
  newEnvironments: AssetResultBlock;
  updatedMockEnv: { uid: string; newVarsAdded: number } | null;
  errors: string[];
}

type OnProgress = (event: ProgressEvent) => void;

// ── Internal store types ──────────────────────────────────────────────

interface CollectionStoreEntry {
  sourceUid: string;
  targetUid: string;
  name: string;
  hostVariables: HostVariableInfo[];
  collectionDetails: CollectionDetails | null;
}

interface MockStoreEntry {
  mockId: string;
  mockUrl: string;
  name: string;
  collectionName: string;
}

interface InternalStore {
  collections: Map<string, CollectionStoreEntry>;
  mocks: Map<string, MockStoreEntry>;
}

// ── Service ───────────────────────────────────────────────────────────

export class UpdateService {
  private client: PostmanClient;

  constructor(client: PostmanClient) {
    this.client = client;
  }

  /**
   * Detect and add new assets from source to target workspace.
   */
  async update(options: UpdateConfig, onProgress?: OnProgress): Promise<UpdateResult> {
    const { sourceWorkspaceId, targetWorkspaceId } = options;
    const result = this.initResult();
    const store: InternalStore = {
      collections: new Map(),
      mocks: new Map(),
    };

    try {
      // Phase 1: Validate
      this.emitProgress(onProgress, 'validation', 'Validating API key...', 0);
      const validation = await this.client.validateApiKey();
      if (!validation.valid) {
        throw new Error(`Invalid API key: ${validation.error}`);
      }

      // Phase 2: Detect new assets
      this.emitProgress(onProgress, 'detection', 'Scanning workspaces for new assets...', 10);
      const { newCollections, newSpecs, newEnvironments } = await this.detectNewAssets(
        sourceWorkspaceId, targetWorkspaceId
      );

      // Auto-link specs to new collection names
      const normalize = (name: string | undefined | null): string => (name || '').toLowerCase().trim();
      const newCollectionNames = new Set(newCollections.map(c => normalize(c.name)));
      const linkedSpecs = newSpecs.filter(s => newCollectionNames.has(normalize(s.name)));

      if (newCollections.length === 0 && linkedSpecs.length === 0 && newEnvironments.length === 0) {
        this.emitProgress(onProgress, 'complete', 'Workspace is up to date — no new assets found.', 100);
        return result;
      }

      this.emitProgress(onProgress, 'detection',
        `Found ${newCollections.length} new collection(s), ${linkedSpecs.length} new spec(s), ${newEnvironments.length} new environment(s)`,
        20
      );

      // Phase 3: Fork new collections
      if (newCollections.length > 0) {
        this.emitProgress(onProgress, 'collections', 'Forking new collections...', 25);
        await this.forkNewCollections(newCollections, targetWorkspaceId, store, result, onProgress);
      }

      // Phase 4: Create mocks for new collections
      if (store.collections.size > 0) {
        this.emitProgress(onProgress, 'mocks', 'Creating mock servers...', 45);
        await this.createMocks(targetWorkspaceId, store, result, onProgress);
      }

      // Phase 5: Update Mock Env with new variables
      if (store.mocks.size > 0) {
        this.emitProgress(onProgress, 'mockEnv', 'Updating Mock Environment...', 60);
        const mockEnvVarMap = await this.updateMockEnv(targetWorkspaceId, store, result);

        // Phase 5b: Update new collection variables
        await this.updateCollectionVariables(store, mockEnvVarMap);
      }

      // Phase 6: Copy new specs
      if (linkedSpecs.length > 0) {
        this.emitProgress(onProgress, 'specs', 'Copying new API specs...', 75);
        await this.copyNewSpecs(linkedSpecs, targetWorkspaceId, result, onProgress);
      }

      // Phase 7: Copy new environments
      if (newEnvironments.length > 0) {
        this.emitProgress(onProgress, 'environments', 'Copying new environments...', 88);
        await this.copyNewEnvironments(newEnvironments, targetWorkspaceId, result, onProgress);
      }

      this.emitProgress(onProgress, 'complete', 'Update complete!', 100);

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(message);
      this.emitProgress(onProgress, 'error', `Error: ${message}`, -1);
    }

    return result;
  }

  /**
   * Scan workspaces and return a diff of new assets without making changes.
   * Specs are auto-linked to new collections by name.
   */
  async scan(options: UpdateConfig): Promise<{
    newCollections: Array<{ id: string; uid: string; name: string }>;
    newSpecs: Array<{ id: string; name: string; type: string }>;
    newEnvironments: Array<{ id: string; uid: string; name: string }>;
    isUpToDate: boolean;
  }> {
    const { sourceWorkspaceId, targetWorkspaceId } = options;

    const validation = await this.client.validateApiKey();
    if (!validation.valid) throw new Error(`Invalid API key: ${validation.error}`);

    const { newCollections, newSpecs, newEnvironments } = await this.detectNewAssets(
      sourceWorkspaceId, targetWorkspaceId
    );

    const normalize = (name: string | undefined | null): string => (name || '').toLowerCase().trim();
    const newCollectionNames = new Set(newCollections.map(c => normalize(c.name)));
    const linkedSpecs = newSpecs.filter(s => newCollectionNames.has(normalize(s.name)));

    return {
      newCollections: newCollections.map(c => ({ id: c.id, uid: c.uid, name: c.name })),
      newSpecs: linkedSpecs.map(s => ({ id: s.id, name: s.name, type: s.type })),
      newEnvironments: newEnvironments.map(e => ({ id: e.id, uid: e.uid, name: e.name })),
      isUpToDate: newCollections.length === 0 && linkedSpecs.length === 0 && newEnvironments.length === 0,
    };
  }

  // ==================== Detection ====================

  private async detectNewAssets(
    sourceWorkspaceId: string,
    targetWorkspaceId: string
  ): Promise<{ newCollections: Collection[]; newSpecs: Spec[]; newEnvironments: Environment[] }> {
    const [sourceCollections, targetCollections, sourceSpecs, targetSpecs, sourceEnvs, targetEnvs] =
      await Promise.all([
        this.client.getCollections(sourceWorkspaceId),
        this.client.getCollections(targetWorkspaceId),
        this.client.getSpecs(sourceWorkspaceId),
        this.client.getSpecs(targetWorkspaceId),
        this.client.getEnvironments(sourceWorkspaceId),
        this.client.getEnvironments(targetWorkspaceId),
      ]);

    // Collections: fork check + name fallback
    const newCollections = await this.findNewCollections(sourceCollections, targetCollections);

    // Specs: name match only
    const normalize = (name: string | undefined | null): string => (name || '').toLowerCase().trim();
    const targetSpecNames = new Set(targetSpecs.map(s => normalize(s.name)));
    const newSpecs = sourceSpecs.filter(s => !targetSpecNames.has(normalize(s.name)));

    // Environments: name match, exclude "Mock Env"
    const targetEnvNames = new Set(targetEnvs.map(e => normalize(e.name)));
    const newEnvironments = sourceEnvs.filter(
      e => normalize(e.name) !== 'mock env' && !targetEnvNames.has(normalize(e.name))
    );

    return { newCollections, newSpecs, newEnvironments };
  }

  /**
   * Find source collections that don't exist in target.
   * Uses fork relationship (primary) then name match (fallback).
   */
  private async findNewCollections(
    sourceCollections: Collection[],
    targetCollections: Collection[]
  ): Promise<Collection[]> {
    const targetForkSources = new Map<string, Collection>();
    const targetNames = new Set<string>();

    for (const tc of targetCollections) {
      targetNames.add(tc.name);

      const details = await this.client.getCollectionDetails(tc.uid);
      if (details?.fork?.from) {
        targetForkSources.set(details.fork.from, tc);
      }
      await this.delay(300);
    }

    return sourceCollections.filter(sc => {
      const hasForkedCopy = targetForkSources.has(sc.uid);
      const hasNameMatch = targetNames.has(sc.name);
      return !hasForkedCopy && !hasNameMatch;
    });
  }

  // ==================== Processing ====================

  private async forkNewCollections(
    newCollections: Collection[],
    targetWorkspaceId: string,
    store: InternalStore,
    result: UpdateResult,
    onProgress?: OnProgress
  ): Promise<void> {
    result.newCollections.total = newCollections.length;

    for (let i = 0; i < newCollections.length; i++) {
      const collection = newCollections[i]!;

      this.emitProgress(onProgress, 'collections', `Forking ${collection.name}...`, undefined, {
        current: i + 1,
        total: newCollections.length,
        currentItem: collection.name,
      });

      const forkResult = await this.client.forkCollection(collection.uid, collection.name, targetWorkspaceId);

      if (forkResult.success && forkResult.collection) {
        result.newCollections.success++;
        result.newCollections.successData.push({
          name: collection.name,
          sourceUid: collection.uid,
          targetUid: forkResult.collection.uid,
        });

        const collDetails = await this.client.getCollectionDetails(forkResult.collection.uid);
        let hostVariables: HostVariableInfo[] = [];
        if (collDetails) {
          hostVariables = this.extractHostVariables(collDetails);
        }

        store.collections.set(collection.uid, {
          sourceUid: collection.uid,
          targetUid: forkResult.collection.uid,
          name: collection.name,
          hostVariables,
          collectionDetails: collDetails,
        });
      } else {
        result.newCollections.failed.push({
          name: collection.name,
          error: forkResult.error ?? 'Unknown error',
        });
      }

      await this.delay(300);
    }
  }

  private async createMocks(
    targetWorkspaceId: string,
    store: InternalStore,
    result: UpdateResult,
    onProgress?: OnProgress
  ): Promise<void> {
    const collections = Array.from(store.collections.values());

    for (let i = 0; i < collections.length; i++) {
      const { targetUid, name } = collections[i]!;
      const mockName = `${name} Mock`;

      this.emitProgress(onProgress, 'mocks', `Creating ${mockName}...`, undefined, {
        current: i + 1,
        total: collections.length,
        currentItem: mockName,
      });

      const mockResult = await this.client.createMock({
        name: mockName,
        collection: targetUid,
        workspaceId: targetWorkspaceId,
      });

      if (mockResult.success && mockResult.mock) {
        store.mocks.set(targetUid, {
          mockId: mockResult.mock.id,
          mockUrl: mockResult.mock.mockUrl,
          name: mockName,
          collectionName: name,
        });
      } else {
        result.errors.push(`Failed to create mock for ${name}: ${mockResult.error}`);
      }

      await this.delay(300);
    }
  }

  /**
   * Update existing Mock Env in-place, or create one if it doesn't exist.
   */
  private async updateMockEnv(
    targetWorkspaceId: string,
    store: InternalStore,
    result: UpdateResult
  ): Promise<Map<string, string>> {
    const { variables: newMockVars, mockEnvVarMap } = this.generateMockUrlVariables(store);
    if (newMockVars.length === 0) {
      return mockEnvVarMap;
    }

    // Find existing Mock Env
    const envs = await this.client.getEnvironments(targetWorkspaceId);
    const mockEnv = envs.find(e => e.name === 'Mock Env');

    if (mockEnv) {
      // Get current variables and append new ones
      const details = await this.client.getEnvironmentDetails(mockEnv.uid);
      const existingVars: EnvironmentVariable[] = details?.values || [];

      // Check for duplicate variable names
      const existingKeys = new Set(existingVars.map(v => v.key));
      const deduplicatedNewVars = newMockVars.map(v => {
        if (existingKeys.has(v.key)) {
          let suffix = 2;
          let newKey = `${v.key}${suffix}`;
          while (existingKeys.has(newKey)) {
            suffix++;
            newKey = `${v.key}${suffix}`;
          }
          // Update the mockEnvVarMap to reflect the renamed key
          for (const [mapKey, mapVal] of mockEnvVarMap.entries()) {
            if (mapVal === v.key) {
              mockEnvVarMap.set(mapKey, newKey);
            }
          }
          existingKeys.add(newKey);
          return { ...v, key: newKey };
        }
        existingKeys.add(v.key);
        return v;
      });

      const mergedVars = [...existingVars, ...deduplicatedNewVars];
      await this.client.updateEnvironment(mockEnv.uid, 'Mock Env', mergedVars);

      result.updatedMockEnv = { uid: mockEnv.uid, newVarsAdded: deduplicatedNewVars.length };
    } else {
      // No Mock Env exists — create one from scratch
      const createResult = await this.client.createEnvironment('Mock Env', newMockVars, targetWorkspaceId);
      if (createResult.success && createResult.environment?.uid) {
        result.updatedMockEnv = { uid: createResult.environment.uid, newVarsAdded: newMockVars.length };
      }
    }

    return mockEnvVarMap;
  }

  private async updateCollectionVariables(
    store: InternalStore,
    mockEnvVarMap: Map<string, string>
  ): Promise<void> {
    if (mockEnvVarMap.size === 0) return;

    for (const [, collData] of store.collections) {
      if (!collData.collectionDetails) continue;

      const hostVars = collData.hostVariables || [];
      const existingVars = (collData.collectionDetails.variable || []) as Array<{ key: string; value: string; [k: string]: unknown }>;

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

        await this.client.patchCollectionVariables(collData.targetUid, updatedVars, collData.collectionDetails);
        await this.delay(300);
        continue;
      }

      // Fallback for collections without detected host variables
      const fallbackEnvName = mockEnvVarMap.get(`${collData.targetUid}:__fallback__`);
      if (!fallbackEnvName) continue;

      const commonVar = existingVars.find(v =>
        COMMON_HOST_VAR_NAMES.some(n => n.toLowerCase() === v.key.toLowerCase())
      );

      const updatedVars = commonVar
        ? existingVars.map(v =>
            v.key === commonVar.key ? { ...v, value: `{{${fallbackEnvName}}}` } : v
          )
        : [...existingVars, { key: 'baseUrl', value: `{{${fallbackEnvName}}}`, type: 'string' }];

      await this.client.patchCollectionVariables(collData.targetUid, updatedVars, collData.collectionDetails);
      await this.delay(300);
    }
  }

  private async copyNewSpecs(
    newSpecs: Spec[],
    targetWorkspaceId: string,
    result: UpdateResult,
    onProgress?: OnProgress
  ): Promise<void> {
    result.newSpecs.total = newSpecs.length;

    for (let i = 0; i < newSpecs.length; i++) {
      const spec = newSpecs[i]!;

      this.emitProgress(onProgress, 'specs', `Copying ${spec.name}...`, undefined, {
        current: i + 1,
        total: newSpecs.length,
        currentItem: spec.name,
      });

      try {
        const files = await this.client.getSpecFiles(spec.id);
        if (files.length === 0) {
          result.newSpecs.failed.push({ name: spec.name, error: 'No files found' });
          continue;
        }

        const filesWithContent: Array<{ path: string; content: string; type: SpecFileType }> = [];
        for (const file of files) {
          const fileData = await this.client.getSpecFile(spec.id, file.path);
          if (fileData?.content) {
            filesWithContent.push({ path: file.path, content: fileData.content, type: file.type });
          }
          await this.delay(200);
        }

        if (filesWithContent.length === 0) {
          result.newSpecs.failed.push({ name: spec.name, error: 'Could not retrieve file contents' });
          continue;
        }

        const createResult = await this.client.createSpec(
          targetWorkspaceId,
          spec.name,
          spec.type as SpecType,
          filesWithContent
        );

        if (createResult.success) {
          result.newSpecs.success++;
          result.newSpecs.successData.push({
            name: spec.name,
            sourceId: spec.id,
            targetId: createResult.spec?.id,
            filesCopied: filesWithContent.length,
          });
        } else {
          result.newSpecs.failed.push({ name: spec.name, error: createResult.error ?? 'Unknown error' });
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        result.newSpecs.failed.push({ name: spec.name, error: message });
      }

      await this.delay(500);
    }
  }

  private async copyNewEnvironments(
    newEnvironments: Environment[],
    targetWorkspaceId: string,
    result: UpdateResult,
    onProgress?: OnProgress
  ): Promise<void> {
    result.newEnvironments.total = newEnvironments.length;

    for (let i = 0; i < newEnvironments.length; i++) {
      const env = newEnvironments[i]!;

      this.emitProgress(onProgress, 'environments', `Copying ${env.name}...`, undefined, {
        current: i + 1,
        total: newEnvironments.length,
        currentItem: env.name,
      });

      const details = await this.client.getEnvironmentDetails(env.uid);
      if (!details) {
        result.newEnvironments.failed.push({ name: env.name, error: 'Could not fetch details' });
        continue;
      }

      const createResult = await this.client.createEnvironment(details.name, details.values || [], targetWorkspaceId);

      if (createResult.success) {
        result.newEnvironments.success++;
        result.newEnvironments.successData.push({
          name: details.name,
          sourceUid: env.uid,
          targetUid: createResult.environment?.uid,
        });
      } else {
        result.newEnvironments.failed.push({ name: details.name, error: createResult.error ?? 'Unknown error' });
      }

      await this.delay(300);
    }
  }

  // ==================== Helpers ====================

  private generateMockUrlVariables(
    store: InternalStore
  ): { variables: EnvironmentVariable[]; mockEnvVarMap: Map<string, string> } {
    const variables: EnvironmentVariable[] = [];
    const mockEnvVarMap = new Map<string, string>();

    for (const [, collData] of store.collections) {
      const mockData = store.mocks.get(collData.targetUid);
      if (!mockData) continue;

      const hostVars = collData.hostVariables || [];
      if (hostVars.length === 0) {
        const varName = this.toVariableName(collData.name) + 'BaseUrl';
        variables.push({ key: varName, value: mockData.mockUrl, type: 'default', enabled: true });
        mockEnvVarMap.set(`${collData.targetUid}:__fallback__`, varName);
        continue;
      }

      for (const hv of hostVars) {
        const envVarName = this.toVariableName(collData.name) + this.toPascalCase(hv.varName);
        variables.push({ key: envVarName, value: mockData.mockUrl, type: 'default', enabled: true });
        mockEnvVarMap.set(`${collData.targetUid}:${hv.varName}`, envVarName);
      }
    }

    return { variables, mockEnvVarMap };
  }

  private extractHostVariables(collection: CollectionDetails): HostVariableInfo[] {
    const hostVarNames = new Set<string>();
    function traverse(items: Array<{ item?: any[]; request?: any }>) {
      for (const item of items) {
        if (item.item) traverse(item.item);
        if (item.request?.url?.host) {
          for (const h of item.request.url.host) {
            const m = (h as string).match(/^\{\{(.+)\}\}$/);
            if (m) hostVarNames.add(m[1]!);
          }
        }
      }
    }
    traverse(collection.item || []);
    const collectionVars = collection.variable || [];

    const mapHostVar = (varName: string): HostVariableInfo => {
      const varDef = collectionVars.find(v => v.key === varName);
      const originalUrl = varDef?.value || '';
      const path = this.extractUrlPath(originalUrl);
      return { varName, originalUrl, path };
    };

    if (hostVarNames.size > 0) {
      const mapped = Array.from(hostVarNames).map(mapHostVar);
      const withProtocol = mapped.filter(hv => hv.originalUrl.includes('://'));
      if (withProtocol.length > 0) return withProtocol;
      return mapped.map(hv => ({ ...hv, path: '' }));
    }

    const common: HostVariableInfo[] = [];
    for (const v of collectionVars) {
      if (COMMON_HOST_VAR_NAMES.some(n => n.toLowerCase() === v.key.toLowerCase())) {
        const originalUrl = v.value || '';
        common.push({
          varName: v.key,
          originalUrl,
          path: originalUrl.includes('://') ? this.extractUrlPath(originalUrl) : '',
        });
      }
    }
    return common;
  }

  private toVariableName(name: string): string {
    const clean = name.replace(/[^a-zA-Z0-9\s]/g, '');
    const words = clean.split(/\s+/);
    return words.map((word, i) => {
      if (i === 0) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join('');
  }

  private toPascalCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  private extractUrlPath(urlString: string): string {
    try {
      const url = new URL(urlString);
      return url.pathname === '/' ? '' : url.pathname;
    } catch {
      return '';
    }
  }

  private initResult(): UpdateResult {
    return {
      newCollections: { total: 0, success: 0, failed: [], successData: [] },
      newSpecs: { total: 0, success: 0, failed: [], successData: [] },
      newEnvironments: { total: 0, success: 0, failed: [], successData: [] },
      updatedMockEnv: null,
      errors: [],
    };
  }

  private emitProgress(
    onProgress: OnProgress | undefined,
    phase: string,
    message: string,
    progress?: number,
    extra: { current?: number; total?: number; currentItem?: string } = {}
  ): void {
    if (onProgress) {
      onProgress({ step: phase, phase, message, progress, ...extra });
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
