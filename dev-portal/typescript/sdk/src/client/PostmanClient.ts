/**
 * Postman API Client
 * 
 * Main SDK entry point with all API methods
 */

import { HttpClient, getErrorMessage } from './HttpClient';
import {
  PostmanClientConfig,
  CurrentUser,
  // Workspace types
  Workspace,
  WorkspaceDetails,
  WorkspaceRole,
  WorkspaceRoleId,
  CreateWorkspaceRequest,
  CreateWorkspaceResult,
  AddAdminResult,
  // Collection types
  Collection,
  CollectionDetails,
  ForkResult,
  // Environment types
  Environment,
  EnvironmentDetails,
  EnvironmentVariable,
  CreateEnvironmentResult,
  UpdateEnvironmentResult,
  PatchEnvironmentOperation,
  // Mock types
  MockServer,
  CreateMockRequest,
  CreateMockResult,
  // Spec types
  Spec,
  SpecFile,
  SpecFileWithContent,
  SpecType,
  CreateSpecFile,
  CreateSpecResult,
  DeleteSpecResult,
  // Invitation types
  InvitePartnerResult,
  RemovePartnerResult,
} from '../types';

/**
 * Postman API Client SDK
 */
export class PostmanClient {
  private http: HttpClient;

  constructor(config: PostmanClientConfig) {
    this.http = new HttpClient(config);
  }

  // =========================================================================
  // USER / AUTHENTICATION
  // =========================================================================

  /**
   * Validate API key and get current user info
   */
  async validateApiKey(): Promise<{ valid: boolean; user?: CurrentUser; error?: string }> {
    try {
      const response = await this.http.get<{ user: CurrentUser }>('/me');
      return { valid: true, user: response.user };
    } catch (error) {
      return { valid: false, error: getErrorMessage(error) };
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<CurrentUser> {
    const response = await this.http.get<{ user: CurrentUser }>('/me');
    return response.user;
  }

  // =========================================================================
  // WORKSPACES
  // =========================================================================

  /**
   * Get workspace details
   */
  async getWorkspace(workspaceId: string): Promise<Workspace | null> {
    try {
      const response = await this.http.get<{ workspace: Workspace }>(`/workspaces/${workspaceId}`);
      return response.workspace;
    } catch {
      return null;
    }
  }

  /**
   * Get workspace details including contents
   */
  async getWorkspaceDetails(workspaceId: string): Promise<WorkspaceDetails | null> {
    try {
      const response = await this.http.get<{ workspace: WorkspaceDetails }>(`/workspaces/${workspaceId}`);
      return response.workspace;
    } catch {
      return null;
    }
  }

  /**
   * Create a new workspace
   */
  async createWorkspace(request: CreateWorkspaceRequest): Promise<CreateWorkspaceResult> {
    try {
      const response = await this.http.post<{ workspace: Workspace }>('/workspaces', {
        workspace: {
          name: request.name,
          type: request.type,
          description: request.description ?? `Created via SDK on ${new Date().toISOString().split('T')[0]}`,
        },
      });
      return { success: true, workspace: response.workspace };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }

  /**
   * Update a workspace
   */
  async updateWorkspace(
    workspaceId: string,
    updates: Record<string, unknown>,
  ): Promise<{ success: boolean; workspace?: Workspace }> {
    try {
      const response = await this.http.put<{ workspace: Workspace }>(`/workspaces/${workspaceId}`, {
        workspace: updates,
      });
      return { success: true, workspace: response.workspace };
    } catch (error) {
      console.error('Error updating workspace:', getErrorMessage(error));
      return { success: false };
    }
  }

  /**
   * Delete a workspace
   */
  async deleteWorkspace(workspaceId: string): Promise<boolean> {
    try {
      await this.http.delete(`/workspaces/${workspaceId}`);
      return true;
    } catch {
      return false;
    }
  }

  // =========================================================================
  // WORKSPACE ROLES
  // =========================================================================

  /**
   * Get workspace roles
   */
  async getWorkspaceRoles(workspaceId: string): Promise<{ success: boolean; roles: WorkspaceRole[]; error?: string }> {
    try {
      const response = await this.http.get<{ roles: WorkspaceRole[] }>(`/workspaces/${workspaceId}/roles`);
      return { success: true, roles: response.roles || [] };
    } catch (error) {
      return { success: false, roles: [], error: getErrorMessage(error) };
    }
  }

  /**
   * Add workspace admin
   */
  async addWorkspaceAdmin(
    workspaceId: string,
    userId: string,
    roleId: string = WorkspaceRoleId.Admin
  ): Promise<AddAdminResult> {
    try {
      const response = await this.http.patch<{ roles: WorkspaceRole[] }>(`/workspaces/${workspaceId}/roles`, {
        roles: [
          {
            op: 'add',
            path: '/user',
            value: [{ id: userId, role: roleId }],
          },
        ],
      });
      return { success: true, roles: response.roles };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }

  /**
   * Remove workspace user
   */
  async removeWorkspaceUser(
    workspaceId: string,
    userId: string,
    roleId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.http.patch(`/workspaces/${workspaceId}/roles`, {
        roles: [
          {
            op: 'remove',
            path: '/user',
            value: [{ id: userId, role: roleId }],
          },
        ],
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }

  // =========================================================================
  // COLLECTIONS
  // =========================================================================

  /**
   * Get all collections in a workspace
   */
  async getCollections(workspaceId: string): Promise<Collection[]> {
    try {
      const response = await this.http.get<{ collections: Collection[] }>(`/collections?workspace=${workspaceId}`);
      return response.collections || [];
    } catch {
      return [];
    }
  }

  /**
   * Get collection details
   */
  async getCollectionDetails(collectionUid: string): Promise<CollectionDetails | null> {
    try {
      const response = await this.http.get<{ collection: CollectionDetails }>(`/collections/${collectionUid}`);
      return response.collection;
    } catch {
      return null;
    }
  }

  /**
   * Fork a collection
   */
  async forkCollection(
    collectionUid: string,
    label: string,
    targetWorkspaceId: string
  ): Promise<ForkResult> {
    try {
      const response = await this.http.post<{ collection: Collection }>(
        `/collections/fork/${collectionUid}?workspace=${targetWorkspaceId}`,
        { label }
      );
      return { success: true, collection: response.collection };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }

  /**
   * Delete a collection
   */
  async deleteCollection(collectionUid: string): Promise<boolean> {
    try {
      await this.http.delete(`/collections/${collectionUid}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Update a collection's variables via partial update
   * PATCH /collections/{collectionId}
   */
  async patchCollectionVariables(
    collectionUid: string,
    variables: Array<{ key: string; value: string; [k: string]: unknown }>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.http.patch(`/collections/${collectionUid}`, {
        collection: { variable: variables },
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // =========================================================================
  // ENVIRONMENTS
  // =========================================================================

  /**
   * Get all environments in a workspace
   */
  async getEnvironments(workspaceId: string): Promise<Environment[]> {
    try {
      const response = await this.http.get<{ environments: Environment[] }>(`/environments?workspace=${workspaceId}`);
      return response.environments || [];
    } catch {
      return [];
    }
  }

  /**
   * Get environment details with variables
   */
  async getEnvironmentDetails(environmentUid: string): Promise<EnvironmentDetails | null> {
    try {
      const response = await this.http.get<{ environment: EnvironmentDetails }>(`/environments/${environmentUid}`);
      return response.environment;
    } catch {
      return null;
    }
  }

  /**
   * Create environment
   */
  async createEnvironment(
    name: string,
    values: EnvironmentVariable[],
    workspaceId: string
  ): Promise<CreateEnvironmentResult> {
    try {
      const response = await this.http.post<{ environment: Environment }>(`/environments?workspace=${workspaceId}`, {
        environment: { name, values },
      });
      return { success: true, environment: response.environment };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }

  /**
   * Update environment (full replace)
   */
  async updateEnvironment(
    environmentUid: string,
    name: string,
    values: EnvironmentVariable[]
  ): Promise<UpdateEnvironmentResult> {
    try {
      const response = await this.http.put<{ environment: Environment }>(`/environments/${environmentUid}`, {
        environment: { name, values },
      });
      return { success: true, environment: response.environment };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }

  /**
   * Patch environment (partial update)
   */
  async patchEnvironment(
    environmentUid: string,
    operations: PatchEnvironmentOperation[]
  ): Promise<UpdateEnvironmentResult> {
    try {
      const response = await this.http.patch<{ environment: Environment }>(`/environments/${environmentUid}`, operations);
      return { success: true, environment: response.environment };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }

  /**
   * Delete environment
   */
  async deleteEnvironment(environmentUid: string): Promise<boolean> {
    try {
      await this.http.delete(`/environments/${environmentUid}`);
      return true;
    } catch {
      return false;
    }
  }

  // =========================================================================
  // MOCK SERVERS
  // =========================================================================

  /**
   * Get all mocks in a workspace
   */
  async getMocks(workspaceId: string): Promise<MockServer[]> {
    try {
      const response = await this.http.get<{ mocks: MockServer[] }>(`/mocks?workspace=${workspaceId}`);
      return response.mocks || [];
    } catch {
      return [];
    }
  }

  /**
   * Get mock details
   */
  async getMockDetails(mockId: string): Promise<MockServer | null> {
    try {
      const response = await this.http.get<{ mock: MockServer }>(`/mocks/${mockId}`);
      return response.mock;
    } catch {
      return null;
    }
  }

  /**
   * Create mock server
   */
  async createMock(request: CreateMockRequest): Promise<CreateMockResult> {
    try {
      const mockConfig: Record<string, unknown> = {
        name: request.name,
        collection: request.collection,
        private: request.isPrivate ?? false,
      };

      if (request.environment) {
        mockConfig.environment = request.environment;
      }

      if (request.config) {
        mockConfig.config = request.config;
      }

      const response = await this.http.post<{ mock: MockServer }>(`/mocks?workspace=${request.workspaceId}`, {
        mock: mockConfig,
      });
      return { success: true, mock: response.mock };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }

  /**
   * Delete mock server
   */
  async deleteMock(mockId: string): Promise<boolean> {
    try {
      await this.http.delete(`/mocks/${mockId}`);
      return true;
    } catch {
      return false;
    }
  }

  // =========================================================================
  // SPECS
  // =========================================================================

  /**
   * Get all specs in a workspace
   */
  async getSpecs(workspaceId: string): Promise<Spec[]> {
    try {
      const response = await this.http.get<{ specs: Spec[] }>(`/specs?workspaceId=${workspaceId}`);
      return response.specs || [];
    } catch {
      return [];
    }
  }

  /**
   * Get spec details
   */
  async getSpecDetails(specId: string): Promise<Spec | null> {
    try {
      const response = await this.http.get<Spec>(`/specs/${specId}`);
      return response;
    } catch {
      return null;
    }
  }

  /**
   * Get all files in a spec
   */
  async getSpecFiles(specId: string): Promise<SpecFile[]> {
    try {
      const response = await this.http.get<{ files: SpecFile[] }>(`/specs/${specId}/files`);
      return response.files || [];
    } catch {
      return [];
    }
  }

  /**
   * Get a specific spec file with content
   */
  async getSpecFile(specId: string, filePath: string): Promise<SpecFileWithContent | null> {
    try {
      const encodedPath = encodeURIComponent(filePath);
      const response = await this.http.get<SpecFileWithContent>(`/specs/${specId}/files/${encodedPath}`);
      return response;
    } catch {
      return null;
    }
  }

  /**
   * Create a spec with files
   */
  async createSpec(
    workspaceId: string,
    name: string,
    type: SpecType,
    files: CreateSpecFile[]
  ): Promise<CreateSpecResult> {
    try {
      const response = await this.http.post<Spec>(`/specs?workspaceId=${workspaceId}`, {
        name,
        type,
        files,
      });
      return { success: true, spec: response };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }

  /**
   * Delete a spec
   */
  async deleteSpec(specId: string): Promise<DeleteSpecResult> {
    try {
      await this.http.delete(`/specs/${specId}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }

  // =========================================================================
  // PARTNER INVITATIONS
  // =========================================================================

  /**
   * Invite partner to workspace
   */
  async invitePartner(
    workspaceId: string,
    email: string,
    roleId: string = WorkspaceRoleId.PartnerEditorAndLead
  ): Promise<InvitePartnerResult> {
    try {
      const response = await this.http.post<{
        results: Array<{
          email: string;
          status: string;
          invitationLink?: string;
          userId?: string;
        }>;
        roleDisplayName?: string;
      }>('/invitations', {
        action: 'invite_partner',
        targetEntity: 'workspace',
        targetEntityId: workspaceId,
        roleId,
        target: { emails: [email] },
      });

      const result = response.results?.[0];
      return {
        success: true,
        email: result?.email || email,
        status: result?.status as InvitePartnerResult['status'],
        invitationLink: result?.invitationLink ?? null,
        userId: result?.userId ?? null,
        roleDisplayName: response.roleDisplayName,
      };
    } catch (error) {
      return { success: false, email, error: getErrorMessage(error) };
    }
  }

  /**
   * Remove partner from workspace
   */
  async removePartner(workspaceId: string, userId: string): Promise<RemovePartnerResult> {
    try {
      const response = await this.http.post<{
        results: Array<{ userId: string; status: string }>;
      }>('/invitations', {
        action: 'remove_partner',
        targetEntity: 'workspace',
        targetEntityId: workspaceId,
        target: { userIds: [userId] },
      });

      const result = response.results?.[0];
      return {
        success: true,
        userId: result?.userId || userId,
        status: result?.status,
      };
    } catch (error) {
      return { success: false, userId, error: getErrorMessage(error) };
    }
  }

  /**
   * Remove partner from team
   */
  async removePartnerFromTeam(teamId: string, userId: string): Promise<RemovePartnerResult> {
    try {
      const response = await this.http.post<{
        results: Array<{ userId: string; status: string }>;
      }>('/invitations', {
        action: 'remove_partner',
        targetEntity: 'team',
        targetEntityId: teamId,
        target: { userIds: [userId] },
      });

      const result = response.results?.[0];
      return {
        success: true,
        userId: result?.userId || userId,
        status: result?.status,
      };
    } catch (error) {
      return { success: false, userId, error: getErrorMessage(error) };
    }
  }
}
