/**
 * Provisioning Service
 * 
 * Full workspace provisioning workflow
 */

import { PostmanClient } from '../client';
import {
  Workspace,
  Collection,
  Environment,
  MockServer,
  Spec,
  SpecType,
  ProgressCallback,
  CollectionMapping,
  EnvironmentMapping,
  MockMapping,
  SpecMapping,
  EnvironmentVariable,
  InvitePartnerResult,
  WorkspaceRoleId,
} from '../types';

export interface ProvisioningConfig {
  client: PostmanClient;
  sourceWorkspaceId: string;
  targetWorkspaceId?: string;
  targetWorkspaceName?: string;
  workspaceType?: 'partner' | 'team' | 'private';
  adminUserIds?: string[];
  partnerEmails?: string[];
  partnerRoleId?: string;
  mockEnvNames?: string[];
  onProgress?: ProgressCallback;
}

export interface ProvisioningResult {
  workspace: Workspace | null;
  workspaceCreated: boolean;
  collections: {
    total: number;
    success: number;
    failed: Array<{ name: string; error: string }>;
    mappings: CollectionMapping[];
  };
  mocks: {
    total: number;
    success: number;
    failed: Array<{ name: string; error: string }>;
    mappings: MockMapping[];
  };
  environments: {
    total: number;
    success: number;
    failed: Array<{ name: string; error: string }>;
    mappings: EnvironmentMapping[];
  };
  specs: {
    total: number;
    success: number;
    failed: Array<{ name: string; error: string }>;
    mappings: SpecMapping[];
  };
  admins: {
    total: number;
    success: number;
    failed: Array<{ userId: string; error: string }>;
  };
  invitations: {
    total: number;
    success: number;
    failed: Array<{ email: string; error: string }>;
    links: Array<{ email: string; invitationLink: string }>;
  };
}

/**
 * Provisioning Service for workspace setup
 */
export class ProvisioningService {
  private client: PostmanClient;
  private config: ProvisioningConfig;
  private collectionMappings: Map<string, CollectionMapping> = new Map();
  private mockMappings: Map<string, MockMapping> = new Map();
  private environmentMappings: Map<string, EnvironmentMapping> = new Map();
  private specMappings: Map<string, SpecMapping> = new Map();

  constructor(config: ProvisioningConfig) {
    this.client = config.client;
    this.config = {
      ...config,
      workspaceType: config.workspaceType ?? 'partner',
      partnerRoleId: config.partnerRoleId ?? WorkspaceRoleId.PartnerEditorAndLead,
      mockEnvNames: config.mockEnvNames ?? ['Mock Env', 'Mock Environment', 'Test Env', 'Test Environment'],
    };
  }

  /**
   * Run full provisioning workflow
   */
  async provision(): Promise<ProvisioningResult> {
    const result = this.initializeResult();

    // Step 1: Initialize target workspace
    this.emitProgress('workspace', 'Initializing target workspace...');
    const workspaceResult = await this.initializeWorkspace();
    if (!workspaceResult.success || !workspaceResult.workspace) {
      throw new Error(`Failed to initialize workspace: ${workspaceResult.error}`);
    }
    result.workspace = workspaceResult.workspace;
    result.workspaceCreated = workspaceResult.isNew;
    const targetWorkspaceId = workspaceResult.workspace.id;

    // Step 2: Copy collections
    this.emitProgress('collections', 'Copying collections...');
    await this.copyCollections(targetWorkspaceId, result);

    // Step 3: Create mocks
    this.emitProgress('mocks', 'Creating mock servers...');
    await this.createMocks(targetWorkspaceId, result);

    // Step 4: Copy environments
    this.emitProgress('environments', 'Copying environments...');
    await this.copyEnvironments(targetWorkspaceId, result);

    // Step 5: Update mock env
    this.emitProgress('mockEnv', 'Updating mock environment...');
    await this.updateMockEnvironment(targetWorkspaceId);

    // Step 6: Copy specs
    this.emitProgress('specs', 'Copying specs...');
    await this.copySpecs(targetWorkspaceId, result);

    // Step 7: Add admins
    if (this.config.adminUserIds && this.config.adminUserIds.length > 0) {
      this.emitProgress('admins', 'Adding workspace admins...');
      await this.addAdmins(targetWorkspaceId, result);
    }

    // Step 8: Invite partners
    if (this.config.partnerEmails && this.config.partnerEmails.length > 0) {
      this.emitProgress('partners', 'Inviting partners...');
      await this.invitePartners(targetWorkspaceId, result);
    }

    return result;
  }

  private initializeResult(): ProvisioningResult {
    return {
      workspace: null,
      workspaceCreated: false,
      collections: { total: 0, success: 0, failed: [], mappings: [] },
      mocks: { total: 0, success: 0, failed: [], mappings: [] },
      environments: { total: 0, success: 0, failed: [], mappings: [] },
      specs: { total: 0, success: 0, failed: [], mappings: [] },
      admins: { total: 0, success: 0, failed: [] },
      invitations: { total: 0, success: 0, failed: [], links: [] },
    };
  }

  private emitProgress(step: string, message: string): void {
    this.config.onProgress?.({ step, message });
  }

  private async initializeWorkspace(): Promise<{ success: boolean; workspace?: Workspace; isNew: boolean; error?: string }> {
    if (this.config.targetWorkspaceId) {
      const workspace = await this.client.getWorkspace(this.config.targetWorkspaceId);
      if (workspace) {
        return { success: true, workspace, isNew: false };
      }
      return { success: false, error: 'Target workspace not found', isNew: false };
    }

    const result = await this.client.createWorkspace({
      name: this.config.targetWorkspaceName ?? 'Partner Workspace',
      type: this.config.workspaceType ?? 'partner',
    });

    return { ...result, isNew: true };
  }

  private async copyCollections(targetWorkspaceId: string, result: ProvisioningResult): Promise<void> {
    const sourceCollections = await this.client.getCollections(this.config.sourceWorkspaceId);
    result.collections.total = sourceCollections.length;

    for (const collection of sourceCollections) {
      const forkResult = await this.client.forkCollection(
        collection.uid,
        collection.name,
        targetWorkspaceId
      );

      if (forkResult.success && forkResult.collection) {
        const mapping: CollectionMapping = {
          sourceUid: collection.uid,
          targetUid: forkResult.collection.uid,
          name: collection.name,
        };
        this.collectionMappings.set(collection.uid, mapping);
        result.collections.mappings.push(mapping);
        result.collections.success++;
      } else {
        result.collections.failed.push({ name: collection.name, error: forkResult.error ?? 'Unknown error' });
      }

      await this.delay(500);
    }
  }

  private async createMocks(targetWorkspaceId: string, result: ProvisioningResult): Promise<void> {
    result.mocks.total = this.collectionMappings.size;

    for (const [sourceUid, collectionMapping] of this.collectionMappings) {
      const mockName = `${collectionMapping.name} Mock`;
      const createResult = await this.client.createMock({
        name: mockName,
        collection: collectionMapping.targetUid,
        workspaceId: targetWorkspaceId,
      });

      if (createResult.success && createResult.mock) {
        const mapping: MockMapping = {
          mockId: createResult.mock.id,
          mockUrl: createResult.mock.mockUrl,
          name: mockName,
          collectionName: collectionMapping.name,
          collectionUid: collectionMapping.targetUid,
        };
        this.mockMappings.set(collectionMapping.targetUid, mapping);
        result.mocks.mappings.push(mapping);
        result.mocks.success++;

        // Update collection mapping with mock URL
        collectionMapping.mockUrl = createResult.mock.mockUrl;
      } else {
        result.mocks.failed.push({ name: mockName, error: createResult.error ?? 'Unknown error' });
      }

      await this.delay(500);
    }
  }

  private async copyEnvironments(targetWorkspaceId: string, result: ProvisioningResult): Promise<void> {
    const sourceEnvs = await this.client.getEnvironments(this.config.sourceWorkspaceId);
    result.environments.total = sourceEnvs.length;

    for (const env of sourceEnvs) {
      const details = await this.client.getEnvironmentDetails(env.uid);
      if (!details) {
        result.environments.failed.push({ name: env.name, error: 'Could not get environment details' });
        continue;
      }

      const createResult = await this.client.createEnvironment(
        details.name,
        details.values || [],
        targetWorkspaceId
      );

      if (createResult.success && createResult.environment) {
        const mapping: EnvironmentMapping = {
          sourceUid: env.uid,
          targetUid: createResult.environment.uid,
          name: details.name,
        };
        this.environmentMappings.set(env.uid, mapping);
        result.environments.mappings.push(mapping);
        result.environments.success++;
      } else {
        result.environments.failed.push({ name: details.name, error: createResult.error ?? 'Unknown error' });
      }

      await this.delay(300);
    }
  }

  private async updateMockEnvironment(targetWorkspaceId: string): Promise<void> {
    const mockUrlVariables = this.generateMockUrlVariables();
    if (mockUrlVariables.length === 0) return;

    // Find existing Mock Env
    const mockEnvMapping = Array.from(this.environmentMappings.values()).find((m) =>
      this.config.mockEnvNames?.some((name) => m.name.toLowerCase() === name.toLowerCase())
    );

    if (mockEnvMapping) {
      const details = await this.client.getEnvironmentDetails(mockEnvMapping.targetUid);
      if (details) {
        const mergedValues = this.mergeVariables(details.values || [], mockUrlVariables);
        await this.client.updateEnvironment(mockEnvMapping.targetUid, mockEnvMapping.name, mergedValues);
      }
    } else {
      await this.client.createEnvironment('Mock Env', mockUrlVariables, targetWorkspaceId);
    }
  }

  private generateMockUrlVariables(): EnvironmentVariable[] {
    const variables: EnvironmentVariable[] = [];

    for (const [, mockMapping] of this.mockMappings) {
      const varName = this.toVariableName(mockMapping.collectionName) + '_mockUrl';
      variables.push({
        key: varName,
        value: mockMapping.mockUrl,
        enabled: true,
        type: 'default',
      });
    }

    if (variables.length > 0) {
      variables.unshift({
        key: 'baseUrl',
        value: variables[0]?.value ?? '',
        enabled: true,
        type: 'default',
      });
    }

    return variables;
  }

  private toVariableName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .map((word, index) =>
        index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join('');
  }

  private mergeVariables(existing: EnvironmentVariable[], newVars: EnvironmentVariable[]): EnvironmentVariable[] {
    const merged = [...existing];
    for (const newVar of newVars) {
      const existingIndex = merged.findIndex((v) => v.key === newVar.key);
      if (existingIndex >= 0) {
        merged[existingIndex] = newVar;
      } else {
        merged.push(newVar);
      }
    }
    return merged;
  }

  private async copySpecs(targetWorkspaceId: string, result: ProvisioningResult): Promise<void> {
    const sourceSpecs = await this.client.getSpecs(this.config.sourceWorkspaceId);
    result.specs.total = sourceSpecs.length;

    for (const spec of sourceSpecs) {
      const copyResult = await this.copySpec(spec, targetWorkspaceId);

      if (copyResult.success && copyResult.targetId) {
        const mapping: SpecMapping = {
          sourceId: spec.id,
          targetId: copyResult.targetId,
          name: spec.name,
          filesCopied: copyResult.filesCopied,
        };
        this.specMappings.set(spec.id, mapping);
        result.specs.mappings.push(mapping);
        result.specs.success++;
      } else {
        result.specs.failed.push({ name: spec.name, error: copyResult.error ?? 'Unknown error' });
      }

      await this.delay(500);
    }
  }

  private async copySpec(
    spec: Spec,
    targetWorkspaceId: string
  ): Promise<{ success: boolean; targetId?: string; filesCopied: number; error?: string }> {
    const files = await this.client.getSpecFiles(spec.id);
    if (files.length === 0) {
      return { success: false, filesCopied: 0, error: 'No files found in spec' };
    }

    const filesWithContent = [];
    for (const file of files) {
      const content = await this.client.getSpecFile(spec.id, file.path);
      if (content?.content) {
        filesWithContent.push({
          path: file.path,
          content: content.content,
          type: file.type,
        });
      }
      await this.delay(200);
    }

    if (filesWithContent.length === 0) {
      return { success: false, filesCopied: 0, error: 'Could not retrieve file contents' };
    }

    const createResult = await this.client.createSpec(
      targetWorkspaceId,
      spec.name,
      spec.type as SpecType,
      filesWithContent
    );

    if (createResult.success && createResult.spec) {
      return { success: true, targetId: createResult.spec.id, filesCopied: filesWithContent.length };
    }

    return { success: false, filesCopied: 0, error: createResult.error };
  }

  private async addAdmins(targetWorkspaceId: string, result: ProvisioningResult): Promise<void> {
    const userIds = this.config.adminUserIds ?? [];
    result.admins.total = userIds.length;

    for (const userId of userIds) {
      const addResult = await this.client.addWorkspaceAdmin(targetWorkspaceId, userId);

      if (addResult.success) {
        result.admins.success++;
      } else {
        result.admins.failed.push({ userId, error: addResult.error ?? 'Unknown error' });
      }

      await this.delay(300);
    }
  }

  private async invitePartners(targetWorkspaceId: string, result: ProvisioningResult): Promise<void> {
    const emails = this.config.partnerEmails ?? [];
    result.invitations.total = emails.length;

    for (const email of emails) {
      const inviteResult = await this.client.invitePartner(
        targetWorkspaceId,
        email,
        this.config.partnerRoleId
      );

      if (inviteResult.success) {
        result.invitations.success++;
        if (inviteResult.invitationLink) {
          result.invitations.links.push({ email, invitationLink: inviteResult.invitationLink });
        }
      } else {
        result.invitations.failed.push({ email, error: inviteResult.error ?? 'Unknown error' });
      }

      await this.delay(300);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
