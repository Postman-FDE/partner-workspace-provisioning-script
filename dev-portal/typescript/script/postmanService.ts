import axios, { AxiosError } from "axios";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type WorkspaceType = "personal" | "private" | "team" | "public" | "partner";

export interface ProgressCallbackParams {
  phase?: string;
  step?: string;
  message?: string;
  current?: number;
  total?: number;
  currentItem?: string;
  progress?: number;
  deleted?: number;
  result?: unknown;
}
export type ProgressCallback = ((params: ProgressCallbackParams) => void) | null | undefined;

export interface CreateWorkspaceResult {
  success: boolean;
  workspace?: { id: string; name: string; type: string };
  error?: string;
}

export interface InitializeTargetWorkspaceOptions {
  targetWorkspaceId?: string;
  newWorkspaceName?: string;
  workspaceType?: WorkspaceType;
  description?: string;
}

export interface InitializeTargetWorkspaceResult {
  success: boolean;
  workspaceId?: string;
  workspace?: object;
  created: boolean;
  error?: string;
}

export interface WorkspaceRoleResult {
  success: boolean;
  roles?: unknown[];
  error?: string;
}

export interface InvitePartnerResult {
  success: boolean;
  email: string;
  status?: string;
  invitationLink?: string | null;
  userId?: number | null;
  roleDisplayName?: string;
  error?: string;
}

export interface RemovePartnerResult {
  success: boolean;
  userId: string;
  status?: string;
  error?: string;
}

export interface AddMultipleAdminsResult {
  success: Array<{ userId: string; roleId: string }>;
  failed: Array<{ userId: string; error?: string }>;
}

export interface InviteMultiplePartnersResult {
  success: Array<{
    email: string;
    status?: string;
    invitationLink?: string | null;
    userId?: number | null;
    roleDisplayName?: string;
  }>;
  failed: Array<{ email: string; error?: string }>;
}

export interface RemoveMultiplePartnersResult {
  success: Array<{ userId: string; status?: string }>;
  failed: Array<{ userId: string; error?: string }>;
}

export interface SpecFileInput {
  path: string;
  content: string;
  type?: string;
}

export interface SpecFileInfo {
  path: string;
  type?: string;
}

/** Spec summary from Postman API /specs endpoint */
export interface WorkspaceSpec {
  id: string;
  name: string;
  type: string;
}

export interface CreateSpecResult {
  success: boolean;
  spec?: { id?: string; [key: string]: unknown };
  error?: string;
}

export interface CreateSpecFileResult {
  success: boolean;
  file?: object;
  error?: string;
}

export interface CopySpecResult {
  success: boolean;
  specName: string;
  newSpecId: string | null;
  filesCopied: number;
  totalFiles: number;
  errors: string[];
}

export interface CopySpecsResult {
  copied: Array<{
    originalSpecId: string;
    newSpecId: string | null;
    name: string;
    type: string;
    filesCopied: number;
  }>;
  errors: Array<{ specName: string; error: string }>;
}

export interface ForkCollectionResult {
  success: boolean;
  collectionName: string;
  collectionId?: string;
  uid?: string;
  error?: string;
}

export interface HostVariableInfo {
  varName: string;
  originalUrl: string;
  path: string;
}

export interface CreateCollectionResult {
  success: boolean;
  collectionName: string;
  collectionId?: string;
  uid?: string;
  error?: string;
}

export interface EnvironmentVariable {
  key: string;
  value: string | number | boolean;
  enabled?: boolean;
  type?: string;
  description?: string;
}

export interface CreateEnvironmentResult {
  success: boolean;
  environmentName: string;
  environmentId?: string;
  uid?: string;
  error?: string;
}

export interface UpdateEnvironmentResult {
  success: boolean;
  environment?: object;
  error?: string;
}

export interface CreateMockServerResult {
  success: boolean;
  mockName: string;
  mockId?: string;
  mockUrl?: string;
  uid?: string;
  error?: string;
}

export interface ResetOptions {
  includeSpecs?: boolean;
  includeMocks?: boolean;
  includeEnvironments?: boolean;
  includeCollections?: boolean;
}

export interface ResetResult {
  deletedSpecs: number;
  deletedMocks: number;
  deletedEnvironments: number;
  deletedCollections: number;
  totalSpecs: number;
  totalMocks: number;
  totalEnvironments: number;
  totalCollections: number;
  errors: string[];
}

export interface ProvisionOptions {
  sourceWorkspaceId: string;
  targetWorkspaceId?: string;
  workspaceName?: string;
  workspaceType?: WorkspaceType;
  adminUserIds?: string[];
  partnerEmails?: string[];
  partnerRoleId?: string;
}

export interface ProvisionResult {
  workspace: object | null;
  workspaceCreated: boolean;
  collections: {
    total: number;
    success: number;
    failed: Array<{ name: string; error?: string }>;
    successData: Array<{ name: string; uid?: string }>;
  };
  mocks: {
    total: number;
    success: number;
    failed: Array<{ name: string; error?: string }>;
    urls: Array<{ collectionName: string; mockName: string; mockUrl?: string }>;
  };
  environments: {
    total: number;
    success: number;
    failed: Array<{ name: string; error?: string }>;
    successData: Array<{ name: string; uid?: string }>;
  };
  mockEnv: { success: boolean; action: string | null };
  specs: {
    total: number;
    success: number;
    failed: Array<{ name: string; error?: string }>;
    successData: Array<{ name: string; id: string | null; filesCopied?: number }>;
  };
  admins: {
    total: number;
    success: number;
    failed: Array<{ userId: string; error?: string }>;
    successData: Array<{ userId: string; roleId: string }>;
  };
  invitations: {
    total: number;
    success: number;
    failed: Array<{ email: string; error?: string }>;
    links: Array<{ email: string; invitationLink?: string; status?: string }>;
  };
  errors: string[];
}

export interface CustomProvisionOptions extends ProvisionOptions {
  copyCollections?: boolean;
  copyEnvironments?: boolean;
  copyMocks?: boolean;
  copySpecs?: boolean;
  selectedCollectionUids?: string[] | null;
  selectedEnvironmentUids?: string[] | null;
  selectedSpecIds?: string[] | null;
  createMockEnv?: boolean;
  addAdmins?: boolean;
  invitePartners?: boolean;
}

export interface CustomResetOptions extends ResetOptions {
  selectedCollectionUids?: string[] | null;
  selectedEnvironmentUids?: string[] | null;
  selectedMockIds?: string[] | null;
  selectedSpecIds?: string[] | null;
}

export interface ValidateApiKeyResult {
  valid: boolean;
  user?: object;
  error?: string;
}

export interface ConfigurationStatus {
  hasApiKey: boolean;
  hasTargetWorkspace: boolean;
  hasSourceWorkspace: boolean;
  isConfigured: boolean;
  isFullyConfigured: boolean;
  message: string;
}

export interface WorkspaceSummary {
  workspaceId: string;
  counts: { collections: number; environments: number; mocks: number; apis: number };
  items: {
    collections: Array<{ id: string; uid: string; name: string }>;
    environments: Array<{ id: string; uid: string; name: string }>;
    mocks: Array<{ id: string; uid: string; name: string }>;
    apis: Array<{ id: string; name: string }>;
  };
}

export interface AvailableCollection {
  id: string;
  uid: string;
  name: string;
  selected: boolean;
  metadata?: { createdAt?: string; updatedAt?: string };
}

export interface AvailableResources {
  collections: Array<{ id: string; uid: string; name: string; selected: boolean }>;
  environments: Array<{ id: string; uid: string; name: string; selected: boolean }>;
  mocks: Array<{ id: string; uid: string; name: string; selected: boolean; collectionUid?: string }>;
  specs: Array<{ id: string; name: string; type: string; selected: boolean }>;
}

export interface CollectionInfo {
  info?: { name?: string };
  [key: string]: unknown;
}

// ============================================================================
// ENVIRONMENT CONFIGURATION
// ============================================================================

const POSTMAN_API_KEY: string | undefined = process.env.POSTMAN_API_KEY;
const POSTMAN_TARGET_WORKSPACE_ID: string | undefined = process.env.POSTMAN_TARGET_WORKSPACE_ID;
const POSTMAN_SOURCE_WORKSPACE_ID: string | undefined = process.env.POSTMAN_SOURCE_WORKSPACE_ID;
const POSTMAN_WORKSPACE_NAME: string | undefined = process.env.POSTMAN_WORKSPACE_NAME;
const POSTMAN_ADMIN_USER_IDS: string | undefined = process.env.POSTMAN_ADMIN_USER_IDS;
const PARTNER_EMAILS: string | undefined = process.env.PARTNER_EMAILS;
const PARTNER_ROLE_ID: string | undefined = process.env.PARTNER_ROLE_ID;
const POSTMAN_API_BASE = "https://api.getpostman.com";

const COMMON_HOST_VAR_NAMES = ['baseUrl', 'baseurl', 'base_url', 'HostName', 'hostname', 'host', 'apiUrl', 'apiurl', 'api_url', 'serverUrl', 'serverurl', 'server_url'];

const deriveCompanyName = (workspaceName: string | undefined): string | null => {
  if (!workspaceName) return null;
  const match = workspaceName.match(/<>\s*(.+?)\s*Partner\s*Workspace/i);
  return match ? match[1].trim() : null;
};

const headers = (): Record<string, string> => ({
  "Content-Type": "application/json",
  "X-Api-Key": POSTMAN_API_KEY ?? "",
});

const authHeaders = (): Record<string, string> => ({
  "X-Api-Key": POSTMAN_API_KEY ?? "",
});

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function extractError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ error?: { message?: string } }>;
    return axiosError.response?.data?.error?.message ?? axiosError.message;
  }
  return error instanceof Error ? error.message : "Unknown error";
}

// ============================================================================
// HOST VARIABLE UTILITIES
// ============================================================================

export const toPascalCase = (str: string): string => {
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
};

export const toCamelCase = (name: string): string => {
  return name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map((word, index) =>
      index === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join('');
};

export const extractUrlPath = (urlString: string): string => {
  try {
    const url = new URL(urlString);
    return url.pathname === '/' ? '' : url.pathname;
  } catch {
    return '';
  }
};

export const extractHostVariables = (collection: any): HostVariableInfo[] => {
  const hostVarNames = new Set<string>();
  function traverse(items: any[]) {
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
  const collectionVars: any[] = collection.variable || [];

  if (hostVarNames.size > 0) {
    const allMapped = Array.from(hostVarNames).map(varName => {
      const varDef = collectionVars.find((v: any) => v.key === varName);
      const originalUrl = varDef?.value || '';
      return { varName, originalUrl, path: extractUrlPath(originalUrl) };
    });
    const withProtocol = allMapped.filter(hv => hv.originalUrl.includes('://'));
    if (withProtocol.length > 0) return withProtocol;
    return allMapped.map(hv => ({ ...hv, path: '' }));
  }

  return collectionVars
    .filter((v: any) => COMMON_HOST_VAR_NAMES.includes(v.key))
    .map((v: any) => ({ varName: v.key, originalUrl: v.value || '', path: '' }));
};

// ============================================================================
// WORKSPACE MANAGEMENT
// ============================================================================

export const getTargetWorkspaceId = (): string | undefined => POSTMAN_TARGET_WORKSPACE_ID;

export const getSourceWorkspaceId = (): string | undefined => POSTMAN_SOURCE_WORKSPACE_ID;

export const getDefaultWorkspaceName = (): string => {
  return POSTMAN_WORKSPACE_NAME || 'Partner Workspace';
};

export const getAdminUserIds = (): string[] => {
  if (!POSTMAN_ADMIN_USER_IDS) return [];
  return POSTMAN_ADMIN_USER_IDS.split(',').map(id => id.trim()).filter(Boolean);
};

export const getPartnerEmails = (): string[] => {
  if (!PARTNER_EMAILS) return [];
  return PARTNER_EMAILS.split(',').map(email => email.trim()).filter(Boolean);
};

export const getPartnerRoleId = (): string => {
  return PARTNER_ROLE_ID || '7';
};

/**
 * Create a new Postman workspace.
 */
export const createWorkspace = async (
  name: string,
  type: WorkspaceType = "team",
  description = ""
): Promise<CreateWorkspaceResult> => {
  try {
    const response = await axios.post<{
      workspace?: { id?: string; name?: string; type?: string };
    }>(
      `${POSTMAN_API_BASE}/workspaces`,
      {
        workspace: {
          name,
          type,
          description: description || "Workspace created via automation script",
        },
      },
      { headers: headers() }
    );
    const data = response.data;
    return {
      success: true,
      workspace: {
        id: data.workspace?.id ?? "",
        name: data.workspace?.name ?? "",
        type: data.workspace?.type ?? "",
      },
    };
  } catch (error) {
    return { success: false, error: extractError(error) };
  }
};

/**
 * Get workspace details by ID.
 */
export const getWorkspace = async (workspaceId: string): Promise<object | null> => {
  try {
    const response = await axios.get<{ workspace?: object }>(
      `${POSTMAN_API_BASE}/workspaces/${workspaceId}`,
      { headers: authHeaders() }
    );
    return response.data.workspace ?? null;
  } catch (error) {
    console.error("Error getting workspace:", error);
    return null;
  }
};

/**
 * Update a workspace by ID.
 */
export const updateWorkspace = async (
  workspaceId: string,
  updates: Record<string, unknown>
): Promise<{ success: boolean; workspace?: object }> => {
  try {
    const response = await axios.put<{ workspace?: object }>(
      `${POSTMAN_API_BASE}/workspaces/${workspaceId}`,
      { workspace: updates },
      { headers: headers() }
    );
    return { success: true, workspace: response.data.workspace ?? undefined };
  } catch (error) {
    console.error("Error updating workspace:", error);
    return { success: false };
  }
};

/**
 * Delete a workspace by ID.
 */
export const deleteWorkspace = async (workspaceId: string): Promise<boolean> => {
  try {
    await axios.delete(`${POSTMAN_API_BASE}/workspaces/${workspaceId}`, {
      headers: authHeaders(),
    });
    return true;
  } catch (error) {
    console.error("Error deleting workspace:", error);
    return false;
  }
};

/**
 * Initialize target workspace — use existing or create new.
 */
export const initializeTargetWorkspace = async (
  options: InitializeTargetWorkspaceOptions = {}
): Promise<InitializeTargetWorkspaceResult> => {
  const {
    targetWorkspaceId,
    newWorkspaceName,
    workspaceType = "team",
    description = "",
  } = options;

  if (targetWorkspaceId) {
    const existingWorkspace = await getWorkspace(targetWorkspaceId);
    if (existingWorkspace) {
      return {
        success: true,
        workspaceId: targetWorkspaceId,
        workspace: existingWorkspace,
        created: false,
      };
    }
    return {
      success: false,
      error: `Target workspace with ID "${targetWorkspaceId}" not found or not accessible`,
      created: false,
    };
  }

  if (!newWorkspaceName) {
    return {
      success: false,
      error: "Either targetWorkspaceId or newWorkspaceName must be provided",
      created: false,
    };
  }

  const createResult = await createWorkspace(newWorkspaceName, workspaceType, description);
  if (createResult.success && createResult.workspace) {
    return {
      success: true,
      workspaceId: createResult.workspace.id,
      workspace: createResult.workspace,
      created: true,
    };
  }
  return {
    success: false,
    error: createResult.error,
    created: false,
  };
};

// ============================================================================
// WORKSPACE ROLES MANAGEMENT
// ============================================================================

/**
 * Get all roles assigned in a workspace.
 */
export const getWorkspaceRoles = async (workspaceId: string): Promise<WorkspaceRoleResult> => {
  try {
    const response = await axios.get<{ roles?: unknown[] }>(
      `${POSTMAN_API_BASE}/workspaces/${workspaceId}/roles`,
      { headers: authHeaders() }
    );
    return { success: true, roles: response.data.roles ?? [] };
  } catch (error) {
    return { success: false, error: extractError(error), roles: [] };
  }
};

/**
 * Add a workspace admin (team member).
 */
export const addWorkspaceAdmin = async (
  workspaceId: string,
  userId: string,
  roleId = "3"
): Promise<WorkspaceRoleResult> => {
  try {
    const response = await axios.patch<{ roles?: unknown[] }>(
      `${POSTMAN_API_BASE}/workspaces/${workspaceId}/roles`,
      { roles: [{ op: "add", path: "/user", value: [{ id: userId, role: roleId }] }] },
      { headers: headers() }
    );
    return { success: true, roles: response.data.roles };
  } catch (error) {
    return { success: false, error: extractError(error) };
  }
};

/**
 * Remove a user from workspace.
 */
export const removeWorkspaceUser = async (
  workspaceId: string,
  userId: string,
  roleId: string
): Promise<WorkspaceRoleResult> => {
  try {
    const response = await axios.patch<{ roles?: unknown[] }>(
      `${POSTMAN_API_BASE}/workspaces/${workspaceId}/roles`,
      { roles: [{ op: "remove", path: "/user", value: [{ id: userId, role: roleId }] }] },
      { headers: headers() }
    );
    return { success: true, roles: response.data.roles };
  } catch (error) {
    return { success: false, error: extractError(error) };
  }
};

/**
 * Add multiple admins to a workspace.
 */
export const addMultipleAdmins = async (
  workspaceId: string,
  userIds: string[],
  onProgress?: ProgressCallback
): Promise<AddMultipleAdminsResult> => {
  const results: AddMultipleAdminsResult = { success: [], failed: [] };

  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i];
    onProgress?.({
      phase: "admins",
      message: `Adding admin: ${userId}`,
      current: i + 1,
      total: userIds.length,
    });

    const addResult = await addWorkspaceAdmin(workspaceId, userId, "3");
    if (addResult.success) {
      results.success.push({ userId, roleId: "3" });
    } else {
      results.failed.push({ userId, error: addResult.error });
    }
    await delay(300);
  }

  return results;
};

// ============================================================================
// PARTNER INVITATIONS MANAGEMENT
// ============================================================================

/**
 * Invite a partner to a workspace.
 */
export const invitePartner = async (
  workspaceId: string,
  email: string,
  roleId = "7"
): Promise<InvitePartnerResult> => {
  try {
    const response = await axios.post<{
      results?: Array<{
        email?: string;
        status?: string;
        invitationLink?: string;
        userId?: number;
      }>;
      roleDisplayName?: string;
    }>(
      `${POSTMAN_API_BASE}/invitations`,
      {
        action: "invite_partner",
        targetEntity: "workspace",
        targetEntityId: workspaceId,
        roleId,
        target: { emails: [email] },
      },
      { headers: headers() }
    );
    const result = response.data.results?.[0] ?? {};
    return {
      success: true,
      email: result.email ?? email,
      status: result.status,
      invitationLink: result.invitationLink ?? null,
      userId: result.userId ?? null,
      roleDisplayName: response.data.roleDisplayName,
    };
  } catch (error) {
    return { success: false, email, error: extractError(error) };
  }
};

/**
 * Remove a partner from a workspace.
 */
export const removePartner = async (
  workspaceId: string,
  userId: string
): Promise<RemovePartnerResult> => {
  try {
    const response = await axios.post<{
      results?: Array<{ userId?: string; status?: string }>;
    }>(
      `${POSTMAN_API_BASE}/invitations`,
      {
        action: "remove_partner",
        targetEntity: "workspace",
        targetEntityId: workspaceId,
        target: { userIds: [userId] },
      },
      { headers: headers() }
    );
    const result = response.data.results?.[0] ?? {};
    return {
      success: true,
      userId: result.userId ?? userId,
      status: result.status,
    };
  } catch (error) {
    return { success: false, userId, error: extractError(error) };
  }
};

/**
 * Remove a partner from the entire team.
 */
export const removePartnerFromTeam = async (
  teamId: string,
  userId: string
): Promise<RemovePartnerResult> => {
  try {
    const response = await axios.post<{
      results?: Array<{ userId?: string; status?: string }>;
    }>(
      `${POSTMAN_API_BASE}/invitations`,
      {
        action: "remove_partner",
        targetEntity: "team",
        targetEntityId: teamId,
        target: { userIds: [userId] },
      },
      { headers: headers() }
    );
    const result = response.data.results?.[0] ?? {};
    return {
      success: true,
      userId: result.userId ?? userId,
      status: result.status,
    };
  } catch (error) {
    return { success: false, userId, error: extractError(error) };
  }
};

/**
 * Invite multiple partners to a workspace.
 */
export const inviteMultiplePartners = async (
  workspaceId: string,
  emails: string[],
  roleId = "7",
  onProgress?: ProgressCallback
): Promise<InviteMultiplePartnersResult> => {
  const results: InviteMultiplePartnersResult = { success: [], failed: [] };

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    onProgress?.({
      phase: "invitations",
      message: `Inviting partner: ${email}`,
      current: i + 1,
      total: emails.length,
    });

    const inviteResult = await invitePartner(workspaceId, email, roleId);
    if (inviteResult.success) {
      results.success.push({
        email: inviteResult.email,
        status: inviteResult.status,
        invitationLink: inviteResult.invitationLink,
        userId: inviteResult.userId,
        roleDisplayName: inviteResult.roleDisplayName,
      });
    } else {
      results.failed.push({ email, error: inviteResult.error });
    }
    await delay(300);
  }

  return results;
};

/**
 * Remove multiple partners from a workspace.
 */
export const removeMultiplePartners = async (
  workspaceId: string,
  userIds: string[],
  onProgress?: ProgressCallback
): Promise<RemoveMultiplePartnersResult> => {
  const results: RemoveMultiplePartnersResult = { success: [], failed: [] };

  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i];
    onProgress?.({
      phase: "removePartners",
      message: `Removing partner: ${userId}`,
      current: i + 1,
      total: userIds.length,
    });

    const removeResult = await removePartner(workspaceId, userId);
    if (removeResult.success) {
      results.success.push({ userId: removeResult.userId, status: removeResult.status });
    } else {
      results.failed.push({ userId, error: removeResult.error });
    }
    await delay(300);
  }

  return results;
};

// ============================================================================
// SPEC MANAGEMENT
// ============================================================================

/**
 * Get all specs from a workspace.
 */
export const getAllSpecs = async (workspaceId: string): Promise<WorkspaceSpec[]> => {
  try {
    const response = await axios.get<{ specs?: WorkspaceSpec[] }>(
      `${POSTMAN_API_BASE}/specs?workspaceId=${workspaceId}`,
      { headers: authHeaders() }
    );
    return response.data.specs ?? [];
  } catch (error) {
    console.error("Error getting specs:", error);
    return [];
  }
};

/**
 * Get spec details.
 */
export const getSpecDetails = async (specId: string): Promise<object | null> => {
  try {
    const response = await axios.get(`${POSTMAN_API_BASE}/specs/${specId}`, {
      headers: authHeaders(),
    });
    return response.data ?? null;
  } catch (error) {
    console.error("Error getting spec details:", error);
    return null;
  }
};

/**
 * Get all files in a spec.
 */
export const getSpecFiles = async (specId: string): Promise<Array<{ path: string; type?: string }>> => {
  try {
    const response = await axios.get<{ files?: Array<{ path: string; type?: string }> }>(
      `${POSTMAN_API_BASE}/specs/${specId}/files`,
      { headers: authHeaders() }
    );
    return response.data.files ?? [];
  } catch (error) {
    console.error("Error getting spec files:", error);
    return [];
  }
};

/**
 * Get a specific spec file's content.
 */
export const getSpecFile = async (
  specId: string,
  filePath: string
): Promise<{ content?: string; [key: string]: unknown } | null> => {
  try {
    const encodedPath = encodeURIComponent(filePath);
    const response = await axios.get<{ content?: string }>(
      `${POSTMAN_API_BASE}/specs/${specId}/files/${encodedPath}`,
      { headers: authHeaders() }
    );
    return response.data ?? null;
  } catch (error) {
    console.error(`Error getting spec file ${filePath}:`, error);
    return null;
  }
};

/**
 * Create a new spec in a workspace with files.
 */
export const createSpec = async (
  workspaceId: string,
  name: string,
  type: string,
  files: SpecFileInput[]
): Promise<CreateSpecResult> => {
  try {
    const response = await axios.post<{ id?: string; [key: string]: unknown }>(
      `${POSTMAN_API_BASE}/specs?workspaceId=${workspaceId}`,
      { name, type, files },
      { headers: headers() }
    );
    return { success: true, spec: response.data };
  } catch (error) {
    return { success: false, error: extractError(error) };
  }
};

/**
 * Create a file in a spec.
 */
export const createSpecFile = async (
  specId: string,
  path: string,
  content: string
): Promise<CreateSpecFileResult> => {
  try {
    const response = await axios.post(
      `${POSTMAN_API_BASE}/specs/${specId}/files`,
      { path, content },
      { headers: headers() }
    );
    return { success: true, file: response.data };
  } catch (error) {
    return { success: false, error: extractError(error) };
  }
};

/**
 * Update a spec file's type (e.g., set as ROOT).
 */
export const updateSpecFileType = async (
  specId: string,
  filePath: string,
  type: "ROOT" | "DEFAULT"
): Promise<CreateSpecFileResult> => {
  try {
    const encodedPath = encodeURIComponent(filePath);
    const response = await axios.patch(
      `${POSTMAN_API_BASE}/specs/${specId}/files/${encodedPath}`,
      { type },
      { headers: headers() }
    );
    return { success: true, file: response.data };
  } catch (error) {
    return { success: false, error: extractError(error) };
  }
};

/**
 * Delete a spec.
 */
export const deleteSpec = async (specId: string): Promise<boolean> => {
  try {
    await axios.delete(`${POSTMAN_API_BASE}/specs/${specId}`, { headers: authHeaders() });
    return true;
  } catch (error) {
    console.error("Error deleting spec:", error);
    return false;
  }
};

/**
 * Copy a single spec with all its files from source to target workspace.
 */
export const copySpec = async (
  sourceSpecId: string,
  sourceSpecName: string,
  sourceSpecType: string,
  targetWorkspaceId: string,
  onProgress?: ProgressCallback
): Promise<CopySpecResult> => {
  const result: CopySpecResult = {
    success: false,
    specName: sourceSpecName,
    newSpecId: null,
    filesCopied: 0,
    totalFiles: 0,
    errors: [],
  };

  try {
    onProgress?.({ step: "files", message: `Getting files for: ${sourceSpecName}` });
    const sourceFiles = await getSpecFiles(sourceSpecId);
    result.totalFiles = sourceFiles.length;

    if (sourceFiles.length === 0) {
      result.errors.push("No files found in source spec");
      return result;
    }

    onProgress?.({
      step: "content",
      message: `Fetching ${sourceFiles.length} file(s) content...`,
    });
    const filesWithContent: SpecFileInput[] = [];

    for (const file of sourceFiles) {
      onProgress?.({
        step: "fetchingFile",
        message: `Fetching: ${file.path}`,
        current: filesWithContent.length + 1,
        total: sourceFiles.length,
      });
      const fileContent = await getSpecFile(sourceSpecId, file.path);
      if (fileContent?.content) {
        filesWithContent.push({
          path: file.path,
          content: fileContent.content,
          type: file.type,
        });
      } else {
        result.errors.push(`Failed to get content for file: ${file.path}`);
      }
      await delay(200);
    }

    if (filesWithContent.length === 0) {
      result.errors.push("Could not retrieve any file contents");
      return result;
    }

    onProgress?.({
      step: "create",
      message: `Creating spec with ${filesWithContent.length} file(s)...`,
    });
    const createResult = await createSpec(
      targetWorkspaceId,
      sourceSpecName,
      sourceSpecType,
      filesWithContent
    );

    if (!createResult.success) {
      result.errors.push(`Failed to create spec: ${createResult.error}`);
      return result;
    }

    result.newSpecId = createResult.spec?.id ?? null;
    result.filesCopied = filesWithContent.length;
    result.success = true;
    return result;
  } catch (error) {
    result.errors.push(
      `Unexpected error: ${error instanceof Error ? error.message : String(error)}`
    );
    return result;
  }
};

/**
 * Copy all specs from source workspace to target workspace.
 */
export const copySpecs = async (
  sourceWorkspaceId: string,
  targetWorkspaceId: string,
  onProgress?: ProgressCallback
): Promise<CopySpecsResult> => {
  const results: CopySpecsResult = { copied: [], errors: [] };
  const sourceSpecs = await getAllSpecs(sourceWorkspaceId);

  if (sourceSpecs.length === 0) {
    onProgress?.({ phase: "specs", message: "No specs found in source workspace", progress: 100 });
    return results;
  }

  for (let i = 0; i < sourceSpecs.length; i++) {
    const spec = sourceSpecs[i];
    onProgress?.({
      phase: "specs",
      message: `Copying spec: ${spec.name} (${spec.type})`,
      currentItem: spec.name,
      current: i + 1,
      total: sourceSpecs.length,
      progress: Math.round((i / sourceSpecs.length) * 100),
    });

    const copyResult = await copySpec(spec.id, spec.name, spec.type, targetWorkspaceId);
    if (copyResult.success) {
      results.copied.push({
        originalSpecId: spec.id,
        newSpecId: copyResult.newSpecId,
        name: spec.name,
        type: spec.type,
        filesCopied: copyResult.filesCopied,
      });
    } else {
      results.errors.push({ specName: spec.name, error: copyResult.errors.join("; ") });
    }
    await delay(500);
  }

  return results;
};

// ============================================================================
// COLLECTIONS MANAGEMENT
// ============================================================================

/**
 * Get collections from source workspace.
 */
export const getSourceCollections = async (): Promise<Array<{ uid: string; name: string }>> => {
  try {
    const response = await axios.get<{ collections?: Array<{ uid: string; name: string }> }>(
      `${POSTMAN_API_BASE}/collections?workspace=${POSTMAN_SOURCE_WORKSPACE_ID}`,
      { headers: authHeaders() }
    );
    return response.data.collections ?? [];
  } catch (error) {
    console.error("Error getting source collections:", error);
    return [];
  }
};

/**
 * Fork a collection from source to target workspace.
 */
export const forkCollection = async (
  collectionId: string,
  collectionName: string,
  workspaceId: string
): Promise<ForkCollectionResult> => {
  try {
    const response = await axios.post<{
      collection?: { name?: string; id?: string; uid?: string };
    }>(
      `${POSTMAN_API_BASE}/collections/fork/${collectionId}?workspace=${workspaceId}`,
      { label: collectionName },
      { headers: headers() }
    );
    const data = response.data;
    return {
      success: true,
      collectionName: data.collection?.name ?? collectionName,
      collectionId: data.collection?.id,
      uid: data.collection?.uid,
    };
  } catch (error) {
    return { success: false, collectionName, error: extractError(error) };
  }
};

/**
 * Get full collection details.
 */
export const getCollectionDetails = async (
  collectionUid: string
): Promise<object | null> => {
  try {
    const response = await axios.get<{ collection?: object }>(
      `${POSTMAN_API_BASE}/collections/${collectionUid}`,
      { headers: authHeaders() }
    );
    return response.data.collection ?? null;
  } catch (error) {
    console.error("Error getting collection details:", error);
    return null;
  }
};

/**
 * Patch collection variables via partial update.
 */
export const patchCollectionVariables = async (
  collectionUid: string,
  variables: Array<{ key: string; value: string; [key: string]: any }>
): Promise<{ success: boolean; collection?: any; error?: string }> => {
  try {
    const response = await axios.patch(
      `${POSTMAN_API_BASE}/collections/${collectionUid}`,
      { collection: { variable: variables } },
      { headers: headers() }
    );
    return { success: true, collection: response.data.collection };
  } catch (error) {
    return { success: false, error: extractError(error) };
  }
};

/**
 * Create a collection in Postman.
 */
export const createCollectionInPostman = async (
  collectionData: CollectionInfo,
  workspaceId: string
): Promise<CreateCollectionResult> => {
  try {
    const response = await axios.post<{ collection?: { id?: string; uid?: string } }>(
      `${POSTMAN_API_BASE}/collections?workspace=${workspaceId}`,
      { collection: collectionData },
      { headers: headers() }
    );
    const data = response.data;
    return {
      success: true,
      collectionName: collectionData.info?.name ?? "Unknown",
      collectionId: data.collection?.id,
      uid: data.collection?.uid,
    };
  } catch (error) {
    return {
      success: false,
      collectionName: collectionData.info?.name ?? "Unknown",
      error: extractError(error),
    };
  }
};

/**
 * Create multiple collections with progress callback.
 */
export const createMultipleCollections = async (
  collections: CollectionInfo[],
  workspaceId: string,
  onProgress?: ProgressCallback
): Promise<CreateCollectionResult[]> => {
  const results: CreateCollectionResult[] = [];

  for (let i = 0; i < collections.length; i++) {
    const collection = collections[i];
    const result = await createCollectionInPostman(collection, workspaceId);
    results.push(result);
    onProgress?.({
      current: i + 1,
      total: collections.length,
      currentItem: collection.info?.name ?? "Unknown",
      result,
    });
    await delay(500);
  }

  return results;
};

/** Collection summary from Postman API */
export interface CollectionSummary {
  id: string;
  uid: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Get all collections in workspace.
 */
export const getAllCollections = async (
  workspaceId: string
): Promise<CollectionSummary[]> => {
  try {
    const response = await axios.get<{
      collections?: CollectionSummary[];
    }>(`${POSTMAN_API_BASE}/collections?workspace=${workspaceId}`, {
      headers: authHeaders(),
    });
    return response.data.collections ?? [];
  } catch (error) {
    console.error("Error getting collections:", error);
    return [];
  }
};

/**
 * Delete a collection.
 */
export const deleteCollection = async (collectionId: string): Promise<boolean> => {
  try {
    await axios.delete(`${POSTMAN_API_BASE}/collections/${collectionId}`, {
      headers: authHeaders(),
    });
    return true;
  } catch (error) {
    console.error("Error deleting collection:", error);
    return false;
  }
};

// ============================================================================
// ENVIRONMENT MANAGEMENT
// ============================================================================

/**
 * Create environment in Postman.
 */
export const createEnvironmentInPostman = async (
  environmentName: string,
  variables: EnvironmentVariable[],
  workspaceId: string
): Promise<CreateEnvironmentResult> => {
  try {
    const response = await axios.post<{ environment?: { id?: string; uid?: string } }>(
      `${POSTMAN_API_BASE}/environments?workspace=${workspaceId}`,
      {
        environment: {
          name: environmentName,
          values: variables.map((v) => ({
            key: v.key,
            value: String(v.value),
            enabled: v.enabled !== false,
            type: v.type ?? "default",
            description: v.description ?? "",
          })),
        },
      },
      { headers: headers() }
    );
    const data = response.data;
    return {
      success: true,
      environmentName,
      environmentId: data.environment?.id,
      uid: data.environment?.uid,
    };
  } catch (error) {
    return { success: false, environmentName, error: extractError(error) };
  }
};

/**
 * Get all environments in workspace.
 */
export const getAllEnvironments = async (
  workspaceId: string
): Promise<Array<{ id: string; uid: string; name: string }>> => {
  try {
    const response = await axios.get<{
      environments?: Array<{ id: string; uid: string; name: string }>;
    }>(`${POSTMAN_API_BASE}/environments?workspace=${workspaceId}`, {
      headers: authHeaders(),
    });
    return response.data.environments ?? [];
  } catch (error) {
    console.error("Error getting environments:", error);
    return [];
  }
};

/**
 * Get environment details.
 */
export const getEnvironmentDetails = async (
  environmentUid: string
): Promise<{ name: string; values?: EnvironmentVariable[] } | null> => {
  try {
    const response = await axios.get<{
      environment?: { name: string; values?: EnvironmentVariable[] };
    }>(`${POSTMAN_API_BASE}/environments/${environmentUid}`, {
      headers: authHeaders(),
    });
    return response.data.environment ?? null;
  } catch (error) {
    console.error("Error getting environment details:", error);
    return null;
  }
};

/**
 * Update environment.
 */
export const updateEnvironment = async (
  environmentUid: string,
  name: string,
  variables: EnvironmentVariable[]
): Promise<UpdateEnvironmentResult> => {
  try {
    const response = await axios.put(
      `${POSTMAN_API_BASE}/environments/${environmentUid}`,
      {
        environment: {
          name,
          values: variables.map((v) => ({
            key: v.key,
            value: String(v.value),
            enabled: v.enabled !== false,
            type: v.type ?? "default",
          })),
        },
      },
      { headers: headers() }
    );
    return { success: true, environment: response.data.environment };
  } catch (error) {
    return { success: false, error: extractError(error) };
  }
};

/**
 * Delete an environment.
 */
export const deleteEnvironment = async (environmentId: string): Promise<boolean> => {
  try {
    await axios.delete(`${POSTMAN_API_BASE}/environments/${environmentId}`, {
      headers: authHeaders(),
    });
    return true;
  } catch (error) {
    console.error("Error deleting environment:", error);
    return false;
  }
};

// ============================================================================
// MOCK SERVER MANAGEMENT
// ============================================================================

/** Mock server summary from Postman API */
export interface MockSummary {
  id: string;
  uid: string;
  name: string;
  collection?: string;
}

/**
 * Get all mock servers in workspace.
 */
export const getAllMocks = async (
  workspaceId: string
): Promise<MockSummary[]> => {
  try {
    const response = await axios.get<{
      mocks?: MockSummary[];
    }>(`${POSTMAN_API_BASE}/mocks?workspace=${workspaceId}`, {
      headers: authHeaders(),
    });
    return response.data.mocks ?? [];
  } catch (error) {
    console.error("Error getting mocks:", error);
    return [];
  }
};

/**
 * Delete a mock server. Use mock.id (not mock.uid) for deletion.
 */
export const deleteMock = async (mockId: string): Promise<boolean> => {
  try {
    await axios.delete(`${POSTMAN_API_BASE}/mocks/${mockId}`, { headers: authHeaders() });
    return true;
  } catch (error) {
    console.error("Error deleting mock:", error);
    return false;
  }
};

/**
 * Create mock server in Postman.
 */
export const createMockServer = async (
  mockName: string,
  collectionUid: string,
  workspaceId: string,
  environmentUid: string | null
): Promise<CreateMockServerResult> => {
  try {
    const response = await axios.post<{
      mock?: { id?: string; mockUrl?: string; uid?: string };
    }>(
      `${POSTMAN_API_BASE}/mocks?workspace=${workspaceId}`,
      {
        mock: {
          name: mockName,
          collection: collectionUid,
          environment: environmentUid,
          private: false,
        },
      },
      { headers: headers() }
    );
    const data = response.data;
    return {
      success: true,
      mockName,
      mockId: data.mock?.id,
      mockUrl: data.mock?.mockUrl,
      uid: data.mock?.uid,
    };
  } catch (error) {
    return { success: false, mockName, error: extractError(error) };
  }
};

// ============================================================================
// RESET OPERATIONS
// ============================================================================

/**
 * Reset workspace — delete all resources in reverse order of provisioning.
 * Deletion order: Specs -> Mocks -> Environments -> Collections
 */
export const resetWorkspace = async (
  workspaceId: string,
  onProgress?: ProgressCallback,
  options: ResetOptions = {}
): Promise<ResetResult> => {
  const {
    includeSpecs = true,
    includeMocks = true,
    includeEnvironments = true,
    includeCollections = true,
  } = options;

  const result: ResetResult = {
    deletedSpecs: 0,
    deletedMocks: 0,
    deletedEnvironments: 0,
    deletedCollections: 0,
    totalSpecs: 0,
    totalMocks: 0,
    totalEnvironments: 0,
    totalCollections: 0,
    errors: [],
  };

  try {
    if (includeSpecs) {
      const specs = await getAllSpecs(workspaceId);
      result.totalSpecs = specs.length;
      onProgress?.({
        phase: "specs",
        message: `Deleting ${specs.length} spec(s)...`,
        deleted: 0,
        total: specs.length,
      });
      for (const spec of specs) {
        if (await deleteSpec(spec.id)) {
          result.deletedSpecs++;
        } else {
          result.errors.push(`Failed to delete spec: ${spec.name}`);
        }
        onProgress?.({
          phase: "specs",
          deleted: result.deletedSpecs,
          total: specs.length,
          currentItem: spec.name,
        });
        await delay(300);
      }
    }

    if (includeMocks) {
      const mocks = await getAllMocks(workspaceId);
      result.totalMocks = mocks.length;
      onProgress?.({
        phase: "mocks",
        message: `Deleting ${mocks.length} mock server(s)...`,
        deleted: 0,
        total: mocks.length,
      });
      for (const mock of mocks) {
        if (await deleteMock(mock.id)) {
          result.deletedMocks++;
        } else {
          result.errors.push(`Failed to delete mock: ${mock.name}`);
        }
        onProgress?.({
          phase: "mocks",
          deleted: result.deletedMocks,
          total: mocks.length,
          currentItem: mock.name,
        });
        await delay(300);
      }
    }

    if (includeEnvironments) {
      const environments = await getAllEnvironments(workspaceId);
      result.totalEnvironments = environments.length;
      onProgress?.({
        phase: "environments",
        message: `Deleting ${environments.length} environment(s)...`,
        deleted: 0,
        total: environments.length,
      });
      for (const environment of environments) {
        if (await deleteEnvironment(environment.uid)) {
          result.deletedEnvironments++;
        } else {
          result.errors.push(`Failed to delete environment: ${environment.name}`);
        }
        onProgress?.({
          phase: "environments",
          deleted: result.deletedEnvironments,
          total: environments.length,
          currentItem: environment.name,
        });
        await delay(300);
      }
    }

    if (includeCollections) {
      const collections = await getAllCollections(workspaceId);
      result.totalCollections = collections.length;
      onProgress?.({
        phase: "collections",
        message: `Deleting ${collections.length} collection(s)...`,
        deleted: 0,
        total: collections.length,
      });
      for (const collection of collections) {
        if (await deleteCollection(collection.uid)) {
          result.deletedCollections++;
        } else {
          result.errors.push(`Failed to delete collection: ${collection.name}`);
        }
        onProgress?.({
          phase: "collections",
          deleted: result.deletedCollections,
          total: collections.length,
          currentItem: collection.name,
        });
        await delay(300);
      }
    }

    // Clear workspace description
    try {
      await updateWorkspace(workspaceId, { description: "" });
    } catch (e: any) {
      console.warn("Failed to clear workspace description:", e.message);
    }

    onProgress?.({ phase: "complete", message: "Reset complete", result });
    return result;
  } catch (error) {
    result.errors.push(
      `Unexpected error: ${error instanceof Error ? error.message : String(error)}`
    );
    onProgress?.({
      phase: "error",
      message: error instanceof Error ? error.message : String(error),
      result,
    });
    throw error;
  }
};

// ============================================================================
// PROVISIONING OPERATIONS
// ============================================================================

/**
 * Full workspace provisioning — copies all assets and manages team/partners.
 */
export const provisionWorkspace = async (
  options: ProvisionOptions,
  onProgress?: ProgressCallback
): Promise<ProvisionResult> => {
  const {
    sourceWorkspaceId,
    targetWorkspaceId,
    workspaceName = "Partner Workspace",
    workspaceType = "partner",
    adminUserIds = [],
    partnerEmails = [],
    partnerRoleId = "7",
  } = options;

  if (!POSTMAN_API_KEY) throw new Error("Postman API key not configured");
  if (!sourceWorkspaceId) throw new Error("Source workspace ID is required");

  const results: ProvisionResult = {
    workspace: null,
    workspaceCreated: false,
    collections: { total: 0, success: 0, failed: [], successData: [] },
    mocks: { total: 0, success: 0, failed: [], urls: [] },
    environments: { total: 0, success: 0, failed: [], successData: [] },
    mockEnv: { success: false, action: null },
    specs: { total: 0, success: 0, failed: [], successData: [] },
    admins: { total: 0, success: 0, failed: [], successData: [] },
    invitations: { total: 0, success: 0, failed: [], links: [] },
    errors: [],
  };

  try {
    onProgress?.({ phase: "validation", message: "Validating API key...", progress: 5 });
    const validation = await validateApiKey();
    if (!validation.valid) throw new Error(`Invalid API key: ${validation.error}`);

    const sourceWorkspace = await getWorkspace(sourceWorkspaceId);
    if (!sourceWorkspace) throw new Error(`Source workspace not found: ${sourceWorkspaceId}`);

    onProgress?.({
      phase: "workspace",
      message: targetWorkspaceId ? "Using existing workspace..." : "Creating new workspace...",
      progress: 10,
    });
    let workspaceId: string | undefined = targetWorkspaceId;

    if (targetWorkspaceId) {
      const existingWorkspace = await getWorkspace(targetWorkspaceId);
      if (!existingWorkspace)
        throw new Error(`Target workspace not found: ${targetWorkspaceId}`);
      results.workspace = existingWorkspace;
      results.workspaceCreated = false;
    } else {
      if (!workspaceName)
        throw new Error("Workspace name is required when creating a new workspace");
      const createResult = await createWorkspace(workspaceName, workspaceType);
      if (!createResult.success)
        throw new Error(`Failed to create workspace: ${createResult.error}`);
      workspaceId = createResult.workspace?.id;
      results.workspace = createResult.workspace ?? null;
      results.workspaceCreated = true;
    }

    // Copy workspace description from source
    try {
      const sourceDescription = (sourceWorkspace as any)?.description as string | undefined;
      if (sourceDescription) {
        let finalDescription = sourceDescription;
        const companyName = deriveCompanyName(workspaceName || (results.workspace as any)?.name);
        if (companyName) {
          finalDescription = sourceDescription.replace(/<Company>/g, companyName);
          console.log(`Replaced <Company> placeholder with "${companyName}"`);
        } else {
          console.warn("Could not derive company name from target workspace name — copying description as-is");
        }
        const updateResult = await updateWorkspace(workspaceId!, { description: finalDescription });
        if (updateResult.success) {
          console.log("Workspace description updated successfully");
        } else {
          console.warn("Failed to update workspace description — continuing provisioning");
        }
      } else {
        console.warn("Source workspace has no description — skipping description copy");
      }
    } catch (descError: any) {
      console.warn(`Unexpected error copying workspace description: ${descError.message} — continuing provisioning`);
    }

    // Step 2: Copy Collections (+ extract host variables)
    onProgress?.({ phase: "collections", message: "Copying collections...", progress: 20 });
    const sourceCollections = await getAllCollections(sourceWorkspaceId);
    results.collections.total = sourceCollections.length;
    const collectionMap = new Map<string, string>();
    const collectionHostVars = new Map<string, { hostVariables: HostVariableInfo[]; collectionDetails: any }>();

    for (let i = 0; i < sourceCollections.length; i++) {
      const collection = sourceCollections[i];
      onProgress?.({
        phase: "collections",
        message: `Forking: ${collection.name}`,
        current: i + 1,
        total: sourceCollections.length,
        progress: 20 + (i / sourceCollections.length) * 15,
      });
      const forkResult = await forkCollection(collection.uid, collection.name, workspaceId!);
      if (forkResult.success) {
        results.collections.success++;
        const entry: { name: string; uid?: string; hostVariables?: HostVariableInfo[] } = {
          name: forkResult.collectionName,
          uid: forkResult.uid,
        };

        if (forkResult.uid) {
          collectionMap.set(collection.uid, forkResult.uid);
          const collDetails = await getCollectionDetails(forkResult.uid);
          if (collDetails) {
            const hostVars = extractHostVariables(collDetails);
            entry.hostVariables = hostVars;
            collectionHostVars.set(forkResult.uid, { hostVariables: hostVars, collectionDetails: collDetails });
          }
        }

        results.collections.successData.push(entry);
      } else {
        results.collections.failed.push({ name: collection.name, error: forkResult.error });
        results.errors.push(`Failed to fork ${collection.name}: ${forkResult.error}`);
      }
      await delay(300);
    }

    // Step 3: Create Mock Servers
    onProgress?.({ phase: "mocks", message: "Creating mock servers...", progress: 40 });
    results.mocks.total = results.collections.successData.length;
    for (let i = 0; i < results.collections.successData.length; i++) {
      const collection = results.collections.successData[i];
      const mockName = `${collection.name} Mock`;
      onProgress?.({
        phase: "mocks",
        message: `Creating: ${mockName}`,
        current: i + 1,
        total: results.collections.successData.length,
        progress: 40 + (i / results.collections.successData.length) * 15,
      });
      const mockResult = await createMockServer(
        mockName,
        collection.uid!,
        workspaceId!,
        null
      );
      if (mockResult.success) {
        results.mocks.success++;
        const mockEntry: any = {
          collectionName: collection.name,
          mockName: mockResult.mockName,
          mockUrl: mockResult.mockUrl,
        };
        const hvData = collectionHostVars.get(collection.uid!);
        if (hvData) mockEntry.hostVariables = hvData.hostVariables;
        results.mocks.urls.push(mockEntry);
      } else {
        results.mocks.failed.push({ name: mockName, error: mockResult.error });
        results.errors.push(`Failed to create mock ${mockName}: ${mockResult.error}`);
      }
      await delay(300);
    }

    // Step 4: Copy Environments
    onProgress?.({ phase: "environments", message: "Copying environments...", progress: 60 });
    const sourceEnvironments = await getAllEnvironments(sourceWorkspaceId);
    results.environments.total = sourceEnvironments.length;
    const envMap = new Map<
      string,
      { targetUid: string; name: string }
    >();

    for (let i = 0; i < sourceEnvironments.length; i++) {
      const env = sourceEnvironments[i];
      onProgress?.({
        phase: "environments",
        message: `Copying: ${env.name}`,
        current: i + 1,
        total: sourceEnvironments.length,
        progress: 60 + (i / sourceEnvironments.length) * 10,
      });
      const envDetails = await getEnvironmentDetails(env.uid);
      if (!envDetails) {
        results.environments.failed.push({
          name: env.name,
          error: "Could not get environment details",
        });
        continue;
      }
      const createResult = await createEnvironmentInPostman(
        envDetails.name,
        envDetails.values ?? [],
        workspaceId!
      );
      if (createResult.success) {
        results.environments.success++;
        results.environments.successData.push({
          name: createResult.environmentName,
          uid: createResult.uid,
        });
        if (createResult.uid)
          envMap.set(env.uid, { targetUid: createResult.uid, name: envDetails.name });
      } else {
        results.environments.failed.push({
          name: envDetails.name,
          error: createResult.error,
        });
        results.errors.push(`Failed to copy ${envDetails.name}: ${createResult.error}`);
      }
      await delay(300);
    }

    // Step 5: Create fresh Mock Env (per-host-variable naming)
    onProgress?.({ phase: "mockEnv", message: "Creating Mock Environment...", progress: 75 });
    const mockEnvVarMap = new Map<string, string>();
    if (results.mocks.urls.length > 0) {
      const mockVariables: EnvironmentVariable[] = [];
      for (const mockEntry of results.mocks.urls as any[]) {
        const hostVars: HostVariableInfo[] = mockEntry.hostVariables || [];
        if (hostVars.length === 0) {
          const varName = toCamelCase(mockEntry.collectionName) + 'BaseUrl';
          mockVariables.push({
            key: varName,
            value: mockEntry.mockUrl ?? "",
            type: "default",
            enabled: true,
          });
          const collUid = results.collections.successData.find(
            (c) => c.name === mockEntry.collectionName
          )?.uid;
          if (collUid) mockEnvVarMap.set(`${collUid}:__fallback__`, varName);
        } else {
          for (const hv of hostVars) {
            const collectionPart = toCamelCase(mockEntry.collectionName);
            const varPart = toPascalCase(hv.varName);
            const envVarName = collectionPart + varPart;
            mockVariables.push({
              key: envVarName,
              value: mockEntry.mockUrl ?? "",
              type: "default",
              enabled: true,
            });
            const collUid = results.collections.successData.find(
              (c) => c.name === mockEntry.collectionName
            )?.uid;
            if (collUid) mockEnvVarMap.set(`${collUid}:${hv.varName}`, envVarName);
          }
        }
      }

      const createResult = await createEnvironmentInPostman("Mock Env", mockVariables, workspaceId!);
      if (createResult.success) {
        results.mockEnv = { success: true, action: "created" };
      } else {
        results.errors.push(`Failed to create Mock Env: ${createResult.error}`);
      }
    }

    // Step 5b: Update collection variables to reference mock env variable names
    if (mockEnvVarMap.size > 0) {
      onProgress?.({ phase: "collectionVars", message: "Updating collection variables...", progress: 77 });
      for (const [collUid, hvData] of collectionHostVars) {
        if (!hvData.collectionDetails) continue;
        const existingVars: any[] = hvData.collectionDetails.variable || [];
        const hostVars = hvData.hostVariables || [];
        let updatedVars: any[];
        if (hostVars.length > 0) {
          updatedVars = existingVars.map((v: any) => {
            const hv = hostVars.find((h) => h.varName === v.key);
            if (hv) {
              const mockEnvVarName = mockEnvVarMap.get(`${collUid}:${hv.varName}`);
              if (mockEnvVarName) return { ...v, value: `{{${mockEnvVarName}}}` };
            }
            return v;
          });
          for (const hv of hostVars) {
            const envName = mockEnvVarMap.get(`${collUid}:${hv.varName}`);
            if (envName && !updatedVars.some((v: any) => v.key === hv.varName)) {
              updatedVars.push({ key: hv.varName, value: `{{${envName}}}`, type: 'string' });
            }
          }
        } else {
          const mockEnvVarName = mockEnvVarMap.get(`${collUid}:__fallback__`);
          if (!mockEnvVarName) continue;
          const targetVar = existingVars.find((v: any) => COMMON_HOST_VAR_NAMES.includes(v.key));
          updatedVars = targetVar
            ? existingVars.map((v: any) =>
                v.key === targetVar.key ? { ...v, value: `{{${mockEnvVarName}}}` } : v
              )
            : [...existingVars, { key: 'baseUrl', value: `{{${mockEnvVarName}}}`, type: 'string' }];
        }
        const patchResult = await patchCollectionVariables(collUid, updatedVars);
        if (!patchResult.success) {
          results.errors.push(`Failed to update variables for collection ${collUid}: ${patchResult.error}`);
        }
        await delay(300);
      }
    }

    // Step 6: Copy Specs
    onProgress?.({ phase: "specs", message: "Copying specs...", progress: 80 });
    const sourceSpecs = await getAllSpecs(sourceWorkspaceId);
    results.specs.total = sourceSpecs.length;
    for (let i = 0; i < sourceSpecs.length; i++) {
      const spec = sourceSpecs[i];
      onProgress?.({
        phase: "specs",
        message: `Copying: ${spec.name}`,
        current: i + 1,
        total: sourceSpecs.length,
        progress: 80 + (i / sourceSpecs.length) * 15,
      });
      const copyResult = await copySpec(
        spec.id,
        spec.name,
        spec.type,
        workspaceId!
      );
      if (copyResult.success) {
        results.specs.success++;
        results.specs.successData.push({
          name: copyResult.specName,
          id: copyResult.newSpecId,
          filesCopied: copyResult.filesCopied,
        });
      } else {
        results.specs.failed.push({
          name: spec.name,
          error: copyResult.errors.join("; "),
        });
        results.errors.push(`Failed to copy spec ${spec.name}`);
      }
      await delay(500);
    }

    // Step 7: Add Team Admins
    if (adminUserIds.length > 0) {
      onProgress?.({ phase: "admins", message: "Adding workspace admins...", progress: 88 });
      results.admins.total = adminUserIds.length;
      for (let i = 0; i < adminUserIds.length; i++) {
        const userId = adminUserIds[i];
        onProgress?.({
          phase: "admins",
          message: `Adding admin: ${userId}`,
          current: i + 1,
          total: adminUserIds.length,
          progress: 88 + (i / adminUserIds.length) * 5,
        });
        const addResult = await addWorkspaceAdmin(workspaceId!, userId, "3");
        if (addResult.success) {
          results.admins.success++;
          results.admins.successData.push({ userId, roleId: "3" });
        } else {
          results.admins.failed.push({ userId, error: addResult.error });
          results.errors.push(`Failed to add admin ${userId}: ${addResult.error}`);
        }
        await delay(300);
      }
    }

    // Step 8: Invite Partners
    if (partnerEmails.length > 0) {
      onProgress?.({ phase: "invitations", message: "Inviting partners...", progress: 93 });
      results.invitations.total = partnerEmails.length;
      for (let i = 0; i < partnerEmails.length; i++) {
        const email = partnerEmails[i];
        onProgress?.({
          phase: "invitations",
          message: `Inviting partner: ${email}`,
          current: i + 1,
          total: partnerEmails.length,
          progress: 93 + (i / partnerEmails.length) * 6,
        });
        const inviteResult = await invitePartner(workspaceId!, email, partnerRoleId);
        if (inviteResult.success) {
          results.invitations.success++;
          if (inviteResult.invitationLink) {
            results.invitations.links.push({
              email: inviteResult.email,
              invitationLink: inviteResult.invitationLink,
              status: inviteResult.status,
            });
          }
        } else {
          results.invitations.failed.push({ email, error: inviteResult.error });
          results.errors.push(`Failed to invite partner ${email}: ${inviteResult.error}`);
        }
        await delay(300);
      }
    }

    onProgress?.({ phase: "complete", message: "Provisioning complete!", progress: 100, result: results });
    return results;
  } catch (error) {
    results.errors.push(error instanceof Error ? error.message : String(error));
    onProgress?.({
      phase: "error",
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
      progress: 0,
      result: results,
    });
    throw error;
  }
};

/**
 * Simplified provisioning — creates a new workspace and copies all content.
 */
export const quickProvision = async (
  sourceWorkspaceId: string,
  workspaceName: string,
  options: Partial<ProvisionOptions> = {},
  onProgress?: ProgressCallback
): Promise<ProvisionResult> => {
  return provisionWorkspace(
    {
      sourceWorkspaceId,
      workspaceName,
      workspaceType: (options.workspaceType as WorkspaceType) ?? "partner",
      ...options,
    },
    onProgress
  );
};

// ============================================================================
// CONFIGURATION & UTILITIES
// ============================================================================

/** Check if Postman is properly configured for basic operations. */
export const isPostmanConfigured = (): boolean =>
  !!(POSTMAN_API_KEY && POSTMAN_SOURCE_WORKSPACE_ID);

/** Check if Postman is fully configured (including target workspace). */
export const isPostmanFullyConfigured = (): boolean =>
  !!(POSTMAN_API_KEY && POSTMAN_TARGET_WORKSPACE_ID && POSTMAN_SOURCE_WORKSPACE_ID);

/** Get configuration status for debugging. */
export const getConfigurationStatus = (): ConfigurationStatus => ({
  hasApiKey: !!POSTMAN_API_KEY,
  hasTargetWorkspace: !!POSTMAN_TARGET_WORKSPACE_ID,
  hasSourceWorkspace: !!POSTMAN_SOURCE_WORKSPACE_ID,
  isConfigured: isPostmanConfigured(),
  isFullyConfigured: isPostmanFullyConfigured(),
  message: !POSTMAN_API_KEY
    ? "Missing API key (POSTMAN_API_KEY)"
    : !POSTMAN_SOURCE_WORKSPACE_ID
      ? "Missing source workspace ID (POSTMAN_SOURCE_WORKSPACE_ID)"
      : !POSTMAN_TARGET_WORKSPACE_ID
        ? "Target workspace ID not set — will create new workspace"
        : "Fully configured",
});

/**
 * Validate API key by making a test request.
 */
export const validateApiKey = async (): Promise<ValidateApiKeyResult> => {
  try {
    const response = await axios.get<{ user?: object }>(`${POSTMAN_API_BASE}/me`, {
      headers: authHeaders(),
    });
    return { valid: true, user: response.data.user };
  } catch (error) {
    return { valid: false, error: extractError(error) };
  }
};

/**
 * Get a summary of workspace contents.
 */
export const getWorkspaceSummary = async (
  workspaceId: string
): Promise<WorkspaceSummary> => {
  const [collections, environments, mocks, apis] = await Promise.all([
    getAllCollections(workspaceId),
    getAllEnvironments(workspaceId),
    getAllMocks(workspaceId),
    getAllSpecs(workspaceId),
  ]);

  return {
    workspaceId,
    counts: {
      collections: collections.length,
      environments: environments.length,
      mocks: mocks.length,
      apis: apis.length,
    },
    items: {
      collections: collections.map((c) => ({ id: c.id, uid: c.uid, name: c.name })),
      environments: environments.map((e) => ({ id: e.id, uid: e.uid, name: e.name })),
      mocks: mocks.map((m) => ({ id: m.id, uid: m.uid, name: m.name })),
      apis: apis.map((a) => ({ id: a.id, name: a.name })),
    },
  };
};

// ============================================================================
// CUSTOM PROVISIONING & RESET
// ============================================================================

/**
 * Get available collections from a workspace for UI selection.
 */
export const getAvailableCollections = async (
  workspaceId: string
): Promise<AvailableCollection[]> => {
  try {
    const collections = await getAllCollections(workspaceId);
    return collections.map((collection) => ({
      id: collection.id,
      uid: collection.uid,
      name: collection.name,
      selected: false,
      metadata: {
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt,
      },
    }));
  } catch (error) {
    console.error("Error getting available collections:", error);
    return [];
  }
};

/**
 * Get available resources from a workspace for UI selection.
 */
export const getAvailableResources = async (
  workspaceId: string
): Promise<AvailableResources> => {
  try {
    const [collections, environments, mocks, specs] = await Promise.all([
      getAllCollections(workspaceId),
      getAllEnvironments(workspaceId),
      getAllMocks(workspaceId),
      getAllSpecs(workspaceId),
    ]);
    return {
      collections: collections.map((c) => ({
        id: c.id,
        uid: c.uid,
        name: c.name,
        selected: false,
      })),
      environments: environments.map((e) => ({
        id: e.id,
        uid: e.uid,
        name: e.name,
        selected: false,
      })),
      mocks: mocks.map((m) => ({
        id: m.id,
        uid: m.uid,
        name: m.name,
        selected: false,
        collectionUid: m.collection,
      })),
      specs: specs.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        selected: false,
      })),
    };
  } catch (error) {
    console.error("Error getting available resources:", error);
    return { collections: [], environments: [], mocks: [], specs: [] };
  }
};

/**
 * Custom workspace provisioning with selective resource copying.
 */
export const provisionCustomWorkspace = async (
  options: CustomProvisionOptions,
  onProgress?: ProgressCallback
): Promise<ProvisionResult> => {
  const {
    sourceWorkspaceId,
    targetWorkspaceId,
    workspaceName = "Partner Workspace",
    workspaceType = "partner",
    copyCollections = true,
    copyEnvironments = true,
    copyMocks = true,
    copySpecs = true,
    selectedCollectionUids = null,
    selectedEnvironmentUids = null,
    selectedSpecIds = null,
    createMockEnv = true,
    addAdmins = true,
    invitePartners = true,
    adminUserIds = [],
    partnerEmails = [],
    partnerRoleId = "7",
  } = options;

  if (!POSTMAN_API_KEY) throw new Error("Postman API key not configured");
  if (!sourceWorkspaceId) throw new Error("Source workspace ID is required");

  const results: ProvisionResult = {
    workspace: null,
    workspaceCreated: false,
    collections: { total: 0, success: 0, failed: [], successData: [] },
    mocks: { total: 0, success: 0, failed: [], urls: [] },
    environments: { total: 0, success: 0, failed: [], successData: [] },
    mockEnv: { success: false, action: null },
    specs: { total: 0, success: 0, failed: [], successData: [] },
    admins: { total: 0, success: 0, failed: [], successData: [] },
    invitations: { total: 0, success: 0, failed: [], links: [] },
    errors: [],
  };

  try {
    onProgress?.({ phase: "validation", message: "Validating configuration...", progress: 5 });
    const validation = await validateApiKey();
    if (!validation.valid) throw new Error(`Invalid API key: ${validation.error}`);
    const sourceWorkspace = await getWorkspace(sourceWorkspaceId);
    if (!sourceWorkspace) throw new Error(`Source workspace not found: ${sourceWorkspaceId}`);

    onProgress?.({
      phase: "workspace",
      message: targetWorkspaceId ? "Using existing workspace..." : "Creating new workspace...",
      progress: 10,
    });
    let workspaceId: string | undefined = targetWorkspaceId;
    if (targetWorkspaceId) {
      const existingWorkspace = await getWorkspace(targetWorkspaceId);
      if (!existingWorkspace)
        throw new Error(`Target workspace not found: ${targetWorkspaceId}`);
      results.workspace = existingWorkspace;
    } else {
      if (!workspaceName)
        throw new Error("Workspace name is required when creating a new workspace");
      const createResult = await createWorkspace(workspaceName, workspaceType);
      if (!createResult.success)
        throw new Error(`Failed to create workspace: ${createResult.error}`);
      workspaceId = createResult.workspace?.id;
      results.workspace = createResult.workspace ?? null;
      results.workspaceCreated = true;
    }

    // Copy workspace description from source
    try {
      const sourceDescription = (sourceWorkspace as any)?.description as string | undefined;
      if (sourceDescription) {
        let finalDescription = sourceDescription;
        const companyName = deriveCompanyName(workspaceName || (results.workspace as any)?.name);
        if (companyName) {
          finalDescription = sourceDescription.replace(/<Company>/g, companyName);
          console.log(`Replaced <Company> placeholder with "${companyName}"`);
        } else {
          console.warn("Could not derive company name from target workspace name — copying description as-is");
        }
        const updateResult = await updateWorkspace(workspaceId!, { description: finalDescription });
        if (updateResult.success) {
          console.log("Workspace description updated successfully");
        } else {
          console.warn("Failed to update workspace description — continuing provisioning");
        }
      } else {
        console.warn("Source workspace has no description — skipping description copy");
      }
    } catch (descError: any) {
      console.warn(`Unexpected error copying workspace description: ${descError.message} — continuing provisioning`);
    }

    const customCollectionHostVars = new Map<string, { hostVariables: HostVariableInfo[]; collectionDetails: any }>();

    if (copyCollections) {
      onProgress?.({ phase: "collections", message: "Copying collections...", progress: 20 });
      let sourceCollections = await getAllCollections(sourceWorkspaceId);
      if ((selectedCollectionUids?.length ?? 0) > 0) {
        sourceCollections = sourceCollections.filter((c) =>
          selectedCollectionUids!.includes(c.uid)
        );
      }
      results.collections.total = sourceCollections.length;

      for (let i = 0; i < sourceCollections.length; i++) {
        const collection = sourceCollections[i];
        onProgress?.({
          phase: "collections",
          message: `Forking: ${collection.name}`,
          current: i + 1,
          total: sourceCollections.length,
          progress: 20 + (i / sourceCollections.length) * 15,
        });
        const forkResult = await forkCollection(collection.uid, collection.name, workspaceId!);
        if (forkResult.success) {
          results.collections.success++;
          const entry: { name: string; uid?: string; hostVariables?: HostVariableInfo[] } = {
            name: forkResult.collectionName,
            uid: forkResult.uid,
          };

          if (forkResult.uid) {
            const collDetails = await getCollectionDetails(forkResult.uid);
            if (collDetails) {
              const hostVars = extractHostVariables(collDetails);
              entry.hostVariables = hostVars;
              customCollectionHostVars.set(forkResult.uid, { hostVariables: hostVars, collectionDetails: collDetails });
            }
          }

          results.collections.successData.push(entry);
        } else {
          results.collections.failed.push({ name: collection.name, error: forkResult.error });
          results.errors.push(`Failed to fork ${collection.name}: ${forkResult.error}`);
        }
        await delay(300);
      }

      if (copyMocks && results.collections.successData.length > 0) {
        onProgress?.({ phase: "mocks", message: "Creating mock servers...", progress: 40 });
        results.mocks.total = results.collections.successData.length;
        for (let i = 0; i < results.collections.successData.length; i++) {
          const coll = results.collections.successData[i];
          const mockName = `${coll.name} Mock`;
          onProgress?.({
            phase: "mocks",
            message: `Creating: ${mockName}`,
            current: i + 1,
            total: results.collections.successData.length,
            progress: 40 + (i / results.collections.successData.length) * 15,
          });
          const mockResult = await createMockServer(
            mockName,
            coll.uid!,
            workspaceId!,
            null
          );
          if (mockResult.success) {
            results.mocks.success++;
            const mockEntry: any = {
              collectionName: coll.name,
              mockName: mockResult.mockName,
              mockUrl: mockResult.mockUrl,
            };
            const hvData = customCollectionHostVars.get(coll.uid!);
            if (hvData) mockEntry.hostVariables = hvData.hostVariables;
            results.mocks.urls.push(mockEntry);
          } else {
            results.mocks.failed.push({ name: mockName, error: mockResult.error });
            results.errors.push(`Failed to create mock ${mockName}: ${mockResult.error}`);
          }
          await delay(300);
        }
      }
    }

    if (copyEnvironments) {
      onProgress?.({ phase: "environments", message: "Copying environments...", progress: 60 });
      let sourceEnvs = await getAllEnvironments(sourceWorkspaceId);
      if ((selectedEnvironmentUids?.length ?? 0) > 0) {
        sourceEnvs = sourceEnvs.filter((e) => selectedEnvironmentUids!.includes(e.uid));
      }
      results.environments.total = sourceEnvs.length;
      const envMap = new Map<string, { targetUid: string; name: string }>();

      for (let i = 0; i < sourceEnvs.length; i++) {
        const env = sourceEnvs[i];
        onProgress?.({
          phase: "environments",
          message: `Copying: ${env.name}`,
          current: i + 1,
          total: sourceEnvs.length,
          progress: 60 + (i / sourceEnvs.length) * 10,
        });
        const envDetails = await getEnvironmentDetails(env.uid);
        if (!envDetails) {
          results.environments.failed.push({
            name: env.name,
            error: "Could not get environment details",
          });
          continue;
        }
        const cr = await createEnvironmentInPostman(
          envDetails.name,
          envDetails.values ?? [],
          workspaceId!
        );
        if (cr.success) {
          results.environments.success++;
          results.environments.successData.push({
            name: cr.environmentName,
            uid: cr.uid,
          });
          if (cr.uid) envMap.set(env.uid, { targetUid: cr.uid, name: envDetails.name });
        } else {
          results.environments.failed.push({
            name: envDetails.name,
            error: cr.error,
          });
          results.errors.push(`Failed to copy ${envDetails.name}: ${cr.error}`);
        }
        await delay(300);
      }

      if (createMockEnv && results.mocks.urls.length > 0) {
        onProgress?.({ phase: "mockEnv", message: "Creating Mock Environment...", progress: 75 });
        const customMockEnvVarMap = new Map<string, string>();
        const mockVariables: EnvironmentVariable[] = [];
        for (const mockEntry of results.mocks.urls as any[]) {
          const hostVars: HostVariableInfo[] = mockEntry.hostVariables || [];
          if (hostVars.length === 0) {
            const varName = toCamelCase(mockEntry.collectionName) + 'BaseUrl';
            mockVariables.push({
              key: varName,
              value: mockEntry.mockUrl ?? "",
              type: "default",
              enabled: true,
            });
            const collUid = results.collections.successData.find(
              (c) => c.name === mockEntry.collectionName
            )?.uid;
            if (collUid) customMockEnvVarMap.set(`${collUid}:__fallback__`, varName);
          } else {
            for (const hv of hostVars) {
              const collectionPart = toCamelCase(mockEntry.collectionName);
              const varPart = toPascalCase(hv.varName);
              const envVarName = collectionPart + varPart;
              mockVariables.push({
                key: envVarName,
                value: mockEntry.mockUrl ?? "",
                type: "default",
                enabled: true,
              });
              const collUid = results.collections.successData.find(
                (c) => c.name === mockEntry.collectionName
              )?.uid;
              if (collUid) customMockEnvVarMap.set(`${collUid}:${hv.varName}`, envVarName);
            }
          }
        }

        const cr = await createEnvironmentInPostman("Mock Env", mockVariables, workspaceId!);
        if (cr.success) {
          results.mockEnv = { success: true, action: "created" };
        } else {
          results.errors.push(`Failed to create Mock Env: ${cr.error}`);
        }

        // Update collection variables to reference mock env variable names
        if (customMockEnvVarMap.size > 0) {
          onProgress?.({ phase: "collectionVars", message: "Updating collection variables...", progress: 77 });
          for (const [collUid, hvData] of customCollectionHostVars) {
            if (!hvData.collectionDetails) continue;
            const existingVars: any[] = hvData.collectionDetails.variable || [];
            const hostVars = hvData.hostVariables || [];
            let updatedVars: any[];
            if (hostVars.length > 0) {
              updatedVars = existingVars.map((v: any) => {
                const hv = hostVars.find((h) => h.varName === v.key);
                if (hv) {
                  const mockEnvVarName = customMockEnvVarMap.get(`${collUid}:${hv.varName}`);
                  if (mockEnvVarName) return { ...v, value: `{{${mockEnvVarName}}}` };
                }
                return v;
              });
              for (const hv of hostVars) {
                const envName = customMockEnvVarMap.get(`${collUid}:${hv.varName}`);
                if (envName && !updatedVars.some((v: any) => v.key === hv.varName)) {
                  updatedVars.push({ key: hv.varName, value: `{{${envName}}}`, type: 'string' });
                }
              }
            } else {
              const mockEnvVarName = customMockEnvVarMap.get(`${collUid}:__fallback__`);
              if (!mockEnvVarName) continue;
              const targetVar = existingVars.find((v: any) => COMMON_HOST_VAR_NAMES.includes(v.key));
              updatedVars = targetVar
                ? existingVars.map((v: any) =>
                    v.key === targetVar.key ? { ...v, value: `{{${mockEnvVarName}}}` } : v
                  )
                : [...existingVars, { key: 'baseUrl', value: `{{${mockEnvVarName}}}`, type: 'string' }];
            }
            const patchResult = await patchCollectionVariables(collUid, updatedVars);
            if (!patchResult.success) {
              results.errors.push(`Failed to update variables for collection ${collUid}: ${patchResult.error}`);
            }
            await delay(300);
          }
        }
      }
    }

    if (copySpecs) {
      onProgress?.({ phase: "specs", message: "Copying specs...", progress: 80 });
      const srcSpecs = await getAllSpecs(sourceWorkspaceId);
      const filteredSpecs =
        (selectedSpecIds?.length ?? 0) > 0
          ? srcSpecs.filter((s) => selectedSpecIds!.includes(s.id))
          : srcSpecs;
      results.specs.total = filteredSpecs.length;
      for (let i = 0; i < filteredSpecs.length; i++) {
        const spec = filteredSpecs[i];
        onProgress?.({
          phase: "specs",
          message: `Copying: ${spec.name}`,
          current: i + 1,
          total: filteredSpecs.length,
          progress: 80 + (i / filteredSpecs.length) * 15,
        });
        const cr = await copySpec(spec.id, spec.name, spec.type, workspaceId!);
        if (cr.success) {
          results.specs.success++;
          results.specs.successData.push({
            name: cr.specName,
            id: cr.newSpecId,
            filesCopied: cr.filesCopied,
          });
        } else {
          results.specs.failed.push({ name: spec.name, error: cr.errors.join("; ") });
          results.errors.push(`Failed to copy spec ${spec.name}`);
        }
        await delay(500);
      }
    }

    if (addAdmins && adminUserIds.length > 0) {
      onProgress?.({ phase: "admins", message: "Adding workspace admins...", progress: 88 });
      results.admins.total = adminUserIds.length;
      for (let i = 0; i < adminUserIds.length; i++) {
        const userId = adminUserIds[i];
        onProgress?.({
          phase: "admins",
          message: `Adding admin: ${userId}`,
          current: i + 1,
          total: adminUserIds.length,
          progress: 88 + (i / adminUserIds.length) * 5,
        });
        const ar = await addWorkspaceAdmin(workspaceId!, userId, "3");
        if (ar.success) {
          results.admins.success++;
          results.admins.successData.push({ userId, roleId: "3" });
        } else {
          results.admins.failed.push({ userId, error: ar.error });
          results.errors.push(`Failed to add admin ${userId}: ${ar.error}`);
        }
        await delay(300);
      }
    }

    if (invitePartners && partnerEmails.length > 0) {
      onProgress?.({ phase: "invitations", message: "Inviting partners...", progress: 93 });
      results.invitations.total = partnerEmails.length;
      for (let i = 0; i < partnerEmails.length; i++) {
        const email = partnerEmails[i];
        onProgress?.({
          phase: "invitations",
          message: `Inviting partner: ${email}`,
          current: i + 1,
          total: partnerEmails.length,
          progress: 93 + (i / partnerEmails.length) * 6,
        });
        const ir = await invitePartner(workspaceId!, email, partnerRoleId);
        if (ir.success) {
          results.invitations.success++;
          if (ir.invitationLink) {
            results.invitations.links.push({
              email: ir.email,
              invitationLink: ir.invitationLink,
              status: ir.status,
            });
          }
        } else {
          results.invitations.failed.push({ email, error: ir.error });
          results.errors.push(`Failed to invite partner ${email}: ${ir.error}`);
        }
        await delay(300);
      }
    }

    onProgress?.({
      phase: "complete",
      message: "Custom provisioning complete!",
      progress: 100,
      result: results,
    });
    return results;
  } catch (error) {
    results.errors.push(error instanceof Error ? error.message : String(error));
    onProgress?.({
      phase: "error",
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
      progress: 0,
      result: results,
    });
    throw error;
  }
};

/**
 * Custom workspace reset with selective resource deletion.
 */
export const resetCustomWorkspace = async (
  workspaceId: string,
  onProgress?: ProgressCallback,
  options: CustomResetOptions = {}
): Promise<ResetResult> => {
  const {
    includeSpecs = true,
    includeMocks = true,
    includeEnvironments = true,
    includeCollections = true,
    selectedCollectionUids = null,
    selectedEnvironmentUids = null,
    selectedMockIds = null,
    selectedSpecIds = null,
  } = options;

  const result: ResetResult = {
    deletedSpecs: 0,
    deletedMocks: 0,
    deletedEnvironments: 0,
    deletedCollections: 0,
    totalSpecs: 0,
    totalMocks: 0,
    totalEnvironments: 0,
    totalCollections: 0,
    errors: [],
  };

  try {
    if (includeSpecs) {
      const specs = await getAllSpecs(workspaceId);
      const filteredSpecs =
        (selectedSpecIds?.length ?? 0) > 0
          ? specs.filter((s) => selectedSpecIds!.includes(s.id))
          : specs;
      result.totalSpecs = filteredSpecs.length;
      onProgress?.({
        phase: "specs",
        message: `Deleting ${filteredSpecs.length} spec(s)...`,
        deleted: 0,
        total: filteredSpecs.length,
      });
      for (const spec of filteredSpecs) {
        if (await deleteSpec(spec.id)) {
          result.deletedSpecs++;
        } else {
          result.errors.push(`Failed to delete spec: ${spec.name}`);
        }
        onProgress?.({
          phase: "specs",
          deleted: result.deletedSpecs,
          total: filteredSpecs.length,
          currentItem: spec.name,
        });
        await delay(300);
      }
    }

    if (includeMocks) {
      let mocks = await getAllMocks(workspaceId);
      const filteredMocks =
        (selectedMockIds?.length ?? 0) > 0
          ? mocks.filter((m) => selectedMockIds!.includes(m.id))
          : mocks;
      result.totalMocks = filteredMocks.length;
      onProgress?.({
        phase: "mocks",
        message: `Deleting ${filteredMocks.length} mock server(s)...`,
        deleted: 0,
        total: filteredMocks.length,
      });
      for (const mock of filteredMocks) {
        if (await deleteMock(mock.id)) {
          result.deletedMocks++;
        } else {
          result.errors.push(`Failed to delete mock: ${mock.name}`);
        }
        onProgress?.({
          phase: "mocks",
          deleted: result.deletedMocks,
          total: filteredMocks.length,
          currentItem: mock.name,
        });
        await delay(300);
      }
    }

    if (includeEnvironments) {
      let environments = await getAllEnvironments(workspaceId);
      const filteredEnvs =
        (selectedEnvironmentUids?.length ?? 0) > 0
          ? environments.filter((e) => selectedEnvironmentUids!.includes(e.uid))
          : environments;
      result.totalEnvironments = filteredEnvs.length;
      onProgress?.({
        phase: "environments",
        message: `Deleting ${filteredEnvs.length} environment(s)...`,
        deleted: 0,
        total: filteredEnvs.length,
      });
      for (const env of filteredEnvs) {
        if (await deleteEnvironment(env.uid)) {
          result.deletedEnvironments++;
        } else {
          result.errors.push(`Failed to delete environment: ${env.name}`);
        }
        onProgress?.({
          phase: "environments",
          deleted: result.deletedEnvironments,
          total: filteredEnvs.length,
          currentItem: env.name,
        });
        await delay(300);
      }
    }

    if (includeCollections) {
      let collections = await getAllCollections(workspaceId);
      const filteredColls =
        (selectedCollectionUids?.length ?? 0) > 0
          ? collections.filter((c) => selectedCollectionUids!.includes(c.uid))
          : collections;
      result.totalCollections = filteredColls.length;
      onProgress?.({
        phase: "collections",
        message: `Deleting ${filteredColls.length} collection(s)...`,
        deleted: 0,
        total: filteredColls.length,
      });
      for (const coll of filteredColls) {
        if (await deleteCollection(coll.uid)) {
          result.deletedCollections++;
        } else {
          result.errors.push(`Failed to delete collection: ${coll.name}`);
        }
        onProgress?.({
          phase: "collections",
          deleted: result.deletedCollections,
          total: filteredColls.length,
          currentItem: coll.name,
        });
        await delay(300);
      }
    }

    // Clear workspace description
    try {
      await updateWorkspace(workspaceId, { description: "" });
    } catch (e: any) {
      console.warn("Failed to clear workspace description:", e.message);
    }

    onProgress?.({ phase: "complete", message: "Custom reset complete", result });
    return result;
  } catch (error) {
    result.errors.push(
      `Unexpected error: ${error instanceof Error ? error.message : String(error)}`
    );
    onProgress?.({
      phase: "error",
      message: error instanceof Error ? error.message : String(error),
      result,
    });
    throw error;
  }
};

/**
 * Get API key from environment.
 */
export const getApiKey = (): string | undefined => POSTMAN_API_KEY;

/**
 * Parse comma-separated string into array.
 */
export const parseCommaSeparated = (str: string): string[] =>
  (str ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/**
 * Format collections for UI display.
 */
export const formatCollectionsForUI = (
  collections: Array<{ name: string; uid: string }>
): string[] => collections.map((c) => `${c.name} (${c.uid})`);

/**
 * Format environments for UI display.
 */
export const formatEnvironmentsForUI = (
  environments: Array<{ name: string; uid: string }>
): string[] => environments.map((e) => `${e.name} (${e.uid})`);

/**
 * Format mocks for UI display.
 */
export const formatMocksForUI = (mocks: Array<{ name: string; uid: string }>): string[] =>
  mocks.map((m) => `${m.name} (${m.uid})`);

/**
 * Format specs for UI display.
 */
export const formatSpecsForUI = (specs: Array<{ name: string; id: string }>): string[] =>
  specs.map((s) => `${s.name} (${s.id})`);

/**
 * Format all resources for UI display.
 */
export const formatResourcesForUI = (resources: {
  collections?: Array<{ name: string; uid: string }>;
  environments?: Array<{ name: string; uid: string }>;
  mocks?: Array<{ name: string; uid: string }>;
  specs?: Array<{ name: string; id: string }>;
}): {
  collections: string[];
  environments: string[];
  mocks: string[];
  specs: string[];
} => ({
  collections: formatCollectionsForUI(resources.collections ?? []),
  environments: formatEnvironmentsForUI(resources.environments ?? []),
  mocks: formatMocksForUI(resources.mocks ?? []),
  specs: formatSpecsForUI(resources.specs ?? []),
});
