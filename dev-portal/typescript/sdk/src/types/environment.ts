/**
 * Environment-related types
 */

/**
 * Environment summary (from list endpoint)
 */
export interface Environment {
  id: string;
  uid: string;
  name: string;
  owner?: string;
  createdAt?: string;
  updatedAt?: string;
  isPublic?: boolean;
}

/**
 * Environment details with variables
 */
export interface EnvironmentDetails extends Environment {
  values: EnvironmentVariable[];
}

/**
 * Environment variable
 */
export interface EnvironmentVariable {
  key: string;
  value: string;
  type?: 'default' | 'secret' | 'any';
  enabled?: boolean;
}

/**
 * Create environment request
 */
export interface CreateEnvironmentRequest {
  name: string;
  values?: EnvironmentVariable[];
  workspaceId: string;
}

/**
 * Create environment result
 */
export interface CreateEnvironmentResult {
  success: boolean;
  environment?: Environment;
  error?: string;
}

/**
 * Update environment request
 */
export interface UpdateEnvironmentRequest {
  environmentUid: string;
  name: string;
  values: EnvironmentVariable[];
}

/**
 * Update environment result
 */
export interface UpdateEnvironmentResult {
  success: boolean;
  environment?: Environment;
  error?: string;
}

/**
 * Patch environment operation
 */
export interface PatchEnvironmentOperation {
  op: 'add' | 'replace' | 'remove';
  path: string;
  value?: unknown;
}

/**
 * Environment mapping (source to target)
 */
export interface EnvironmentMapping {
  sourceUid: string;
  targetUid: string;
  name: string;
}

/**
 * Mock environment update result
 */
export interface MockEnvUpdateResult {
  success: boolean;
  environment?: Environment;
  action?: 'created' | 'updated';
  error?: string;
}
