/**
 * Workspace Service
 * 
 * High-level workspace operations
 */

import { PostmanClient } from '../client';
import {
  Workspace,
  WorkspaceType,
  WorkspaceRole,
  WorkspaceRoleId,
  CreateWorkspaceResult,
  AddAdminResult,
  BatchResult,
} from '../types';

export interface WorkspaceServiceConfig {
  client: PostmanClient;
  defaultWorkspaceType?: WorkspaceType;
  adminRoleId?: string;
}

/**
 * High-level workspace operations
 */
export class WorkspaceService {
  private client: PostmanClient;
  private defaultWorkspaceType: WorkspaceType;
  private adminRoleId: string;

  constructor(config: WorkspaceServiceConfig) {
    this.client = config.client;
    this.defaultWorkspaceType = config.defaultWorkspaceType ?? 'partner';
    this.adminRoleId = config.adminRoleId ?? WorkspaceRoleId.Admin;
  }

  /**
   * Initialize a target workspace (get existing or create new)
   */
  async initializeWorkspace(
    workspaceIdOrName: string,
    options?: { type?: WorkspaceType; description?: string }
  ): Promise<CreateWorkspaceResult & { isNew: boolean }> {
    // Check if it looks like a workspace ID (UUID format)
    const isId = /^[a-f0-9-]{36}$/i.test(workspaceIdOrName);

    if (isId) {
      const existing = await this.client.getWorkspace(workspaceIdOrName);
      if (existing) {
        return { success: true, workspace: existing, isNew: false };
      }
      return { success: false, error: `Workspace not found: ${workspaceIdOrName}`, isNew: false };
    }

    // Create new workspace
    const result = await this.client.createWorkspace({
      name: workspaceIdOrName,
      type: options?.type ?? this.defaultWorkspaceType,
      description: options?.description,
    });

    return { ...result, isNew: true };
  }

  /**
   * Get workspace summary (counts of all resources)
   */
  async getWorkspaceSummary(workspaceId: string): Promise<{
    workspace: Workspace | null;
    collections: number;
    environments: number;
    mocks: number;
    specs: number;
  }> {
    const [workspace, collections, environments, mocks, specs] = await Promise.all([
      this.client.getWorkspace(workspaceId),
      this.client.getCollections(workspaceId),
      this.client.getEnvironments(workspaceId),
      this.client.getMocks(workspaceId),
      this.client.getSpecs(workspaceId),
    ]);

    return {
      workspace,
      collections: collections.length,
      environments: environments.length,
      mocks: mocks.length,
      specs: specs.length,
    };
  }

  /**
   * Add multiple admins to a workspace
   */
  async addMultipleAdmins(
    workspaceId: string,
    userIds: string[],
    options?: { delayMs?: number }
  ): Promise<BatchResult<{ userId: string; roleId: string }>> {
    const result: BatchResult<{ userId: string; roleId: string }> = {
      success: [],
      failed: [],
      total: userIds.length,
      successCount: 0,
      failedCount: 0,
    };

    for (const userId of userIds) {
      const addResult = await this.client.addWorkspaceAdmin(workspaceId, userId, this.adminRoleId);

      if (addResult.success) {
        result.success.push({ userId, roleId: this.adminRoleId });
        result.successCount++;
      } else {
        result.failed.push({
          item: { userId, roleId: this.adminRoleId },
          error: addResult.error ?? 'Unknown error',
        });
        result.failedCount++;
      }

      if (options?.delayMs) {
        await this.delay(options.delayMs);
      }
    }

    return result;
  }

  /**
   * Get all workspace roles
   */
  async getRoles(workspaceId: string): Promise<WorkspaceRole[]> {
    const result = await this.client.getWorkspaceRoles(workspaceId);
    return result.roles;
  }

  /**
   * Helper delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
