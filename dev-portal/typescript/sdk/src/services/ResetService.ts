/**
 * Reset Service
 * 
 * Full workspace reset workflow
 */

import { PostmanClient } from '../client';
import {
  Workspace,
  Collection,
  Environment,
  MockServer,
  Spec,
  ProgressCallback,
} from '../types';

export interface ResetConfig {
  client: PostmanClient;
  workspaceId: string;
  onProgress?: ProgressCallback;
}

export interface ResetResult {
  workspace: Workspace | null;
  specs: {
    total: number;
    deleted: number;
    failed: Array<{ name: string; error: string }>;
  };
  mocks: {
    total: number;
    deleted: number;
    failed: Array<{ name: string; error: string }>;
  };
  environments: {
    total: number;
    deleted: number;
    failed: Array<{ name: string; error: string }>;
  };
  collections: {
    total: number;
    deleted: number;
    failed: Array<{ name: string; error: string }>;
  };
}

export interface WorkspaceContents {
  collections: Collection[];
  environments: Environment[];
  mocks: MockServer[];
  specs: Spec[];
}

/**
 * Reset Service for workspace cleanup
 */
export class ResetService {
  private client: PostmanClient;
  private config: ResetConfig;

  constructor(config: ResetConfig) {
    this.client = config.client;
    this.config = config;
  }

  /**
   * Scan workspace to get all contents
   */
  async scanWorkspace(): Promise<{
    workspace: Workspace | null;
    contents: WorkspaceContents;
    total: number;
  }> {
    const [workspace, collections, environments, mocks, specs] = await Promise.all([
      this.client.getWorkspace(this.config.workspaceId),
      this.client.getCollections(this.config.workspaceId),
      this.client.getEnvironments(this.config.workspaceId),
      this.client.getMocks(this.config.workspaceId),
      this.client.getSpecs(this.config.workspaceId),
    ]);

    return {
      workspace,
      contents: { collections, environments, mocks, specs },
      total: collections.length + environments.length + mocks.length + specs.length,
    };
  }

  /**
   * Run full reset workflow
   * 
   * Deletion order (reverse of provisioning):
   * 1. Specs first
   * 2. Mocks (depend on collections)
   * 3. Environments
   * 4. Collections last
   */
  async reset(): Promise<ResetResult> {
    const result = this.initializeResult();

    // Scan workspace
    this.emitProgress('scan', 'Scanning workspace contents...');
    const { workspace, contents, total } = await this.scanWorkspace();
    result.workspace = workspace;

    if (total === 0) {
      this.emitProgress('complete', 'Workspace is already empty');
      return result;
    }

    result.specs.total = contents.specs.length;
    result.mocks.total = contents.mocks.length;
    result.environments.total = contents.environments.length;
    result.collections.total = contents.collections.length;

    // Step 1: Delete specs
    this.emitProgress('specs', `Deleting ${contents.specs.length} spec(s)...`);
    await this.deleteSpecs(contents.specs, result);

    // Step 2: Delete mocks
    this.emitProgress('mocks', `Deleting ${contents.mocks.length} mock server(s)...`);
    await this.deleteMocks(contents.mocks, result);

    // Step 3: Delete environments
    this.emitProgress('environments', `Deleting ${contents.environments.length} environment(s)...`);
    await this.deleteEnvironments(contents.environments, result);

    // Step 4: Delete collections
    this.emitProgress('collections', `Deleting ${contents.collections.length} collection(s)...`);
    await this.deleteCollections(contents.collections, result);

    this.emitProgress('complete', 'Reset complete');
    return result;
  }

  private initializeResult(): ResetResult {
    return {
      workspace: null,
      specs: { total: 0, deleted: 0, failed: [] },
      mocks: { total: 0, deleted: 0, failed: [] },
      environments: { total: 0, deleted: 0, failed: [] },
      collections: { total: 0, deleted: 0, failed: [] },
    };
  }

  private emitProgress(step: string, message: string): void {
    this.config.onProgress?.({ step, message });
  }

  private async deleteSpecs(specs: Spec[], result: ResetResult): Promise<void> {
    for (const spec of specs) {
      const deleteResult = await this.client.deleteSpec(spec.id);

      if (deleteResult.success) {
        result.specs.deleted++;
      } else {
        result.specs.failed.push({ name: spec.name, error: deleteResult.error ?? 'Unknown error' });
      }

      await this.delay(300);
    }
  }

  private async deleteMocks(mocks: MockServer[], result: ResetResult): Promise<void> {
    for (const mock of mocks) {
      // Use mock.id (not mock.uid) for deletion
      const success = await this.client.deleteMock(mock.id);

      if (success) {
        result.mocks.deleted++;
      } else {
        result.mocks.failed.push({ name: mock.name, error: 'Failed to delete' });
      }

      await this.delay(300);
    }
  }

  private async deleteEnvironments(environments: Environment[], result: ResetResult): Promise<void> {
    for (const env of environments) {
      const success = await this.client.deleteEnvironment(env.uid);

      if (success) {
        result.environments.deleted++;
      } else {
        result.environments.failed.push({ name: env.name, error: 'Failed to delete' });
      }

      await this.delay(300);
    }
  }

  private async deleteCollections(collections: Collection[], result: ResetResult): Promise<void> {
    for (const collection of collections) {
      const success = await this.client.deleteCollection(collection.uid);

      if (success) {
        result.collections.deleted++;
      } else {
        result.collections.failed.push({ name: collection.name, error: 'Failed to delete' });
      }

      await this.delay(300);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
