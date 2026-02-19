/**
 * Workspace-related types
 */

/**
 * Workspace type enumeration
 */
export type WorkspaceType = 'personal' | 'private' | 'team' | 'partner' | 'public';

/**
 * Workspace role IDs
 */
export enum WorkspaceRoleId {
  Viewer = '1',
  Editor = '2',
  Admin = '3',
  PartnerViewer = '6',
  PartnerEditorAndLead = '7',
}

/**
 * Workspace entity
 */
export interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
  description?: string;
  visibility?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Workspace details with additional metadata
 */
export interface WorkspaceDetails extends Workspace {
  collections?: Array<{ id: string; uid: string; name: string }>;
  environments?: Array<{ id: string; uid: string; name: string }>;
  mocks?: Array<{ id: string; uid: string; name: string }>;
  apis?: Array<{ id: string; name: string }>;
}

/**
 * Workspace role assignment
 */
export interface WorkspaceRole {
  user: {
    id: string;
    email?: string;
    name?: string;
  };
  role: WorkspaceRoleId | string;
}

/**
 * Create workspace request
 */
export interface CreateWorkspaceRequest {
  name: string;
  type: WorkspaceType;
  description?: string;
}

/**
 * Create workspace result
 */
export interface CreateWorkspaceResult {
  success: boolean;
  workspace?: Workspace;
  error?: string;
}

/**
 * Add admin request
 */
export interface AddAdminRequest {
  workspaceId: string;
  userId: string;
  roleId?: WorkspaceRoleId | string;
}

/**
 * Add admin result
 */
export interface AddAdminResult {
  success: boolean;
  roles?: WorkspaceRole[];
  error?: string;
}

/**
 * Remove user request
 */
export interface RemoveUserRequest {
  workspaceId: string;
  userId: string;
  roleId: WorkspaceRoleId | string;
}

/**
 * Workspace summary for provisioning results
 */
export interface WorkspaceSummary {
  collections: number;
  environments: number;
  mocks: number;
  specs: number;
  admins: number;
  invitations: number;
}
