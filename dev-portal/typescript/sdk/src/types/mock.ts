/**
 * Mock server-related types
 */

/**
 * Mock server entity
 */
export interface MockServer {
  id: string;
  uid: string;
  name: string;
  owner?: string;
  collection: string;
  environment?: string;
  mockUrl: string;
  isPublic: boolean;
  createdAt?: string;
  updatedAt?: string;
  config?: MockServerConfig;
}

/**
 * Mock server configuration
 */
export interface MockServerConfig {
  serverResponseId?: string;
  matchBody?: boolean;
  matchQueryParams?: boolean;
  matchWildcards?: boolean;
  delay?: MockDelayConfig;
}

/**
 * Mock delay configuration
 */
export interface MockDelayConfig {
  type: 'fixed' | 'random';
  preset?: 'fast' | 'slow' | 'custom';
  duration?: number;
  min?: number;
  max?: number;
}

/**
 * Create mock server request
 */
export interface CreateMockRequest {
  name: string;
  collection: string;
  workspaceId: string;
  environment?: string;
  isPrivate?: boolean;
  config?: MockServerConfig;
}

/**
 * Create mock server result
 */
export interface CreateMockResult {
  success: boolean;
  mock?: MockServer;
  error?: string;
}

/**
 * Mock server mapping
 */
export interface MockMapping {
  mockId: string;
  mockUrl: string;
  name: string;
  collectionName: string;
  collectionUid: string;
}

/**
 * Mock URL variable for environment
 */
export interface MockUrlVariable {
  key: string;
  value: string;
  enabled: boolean;
  type: 'default';
}

/**
 * Mock call log entry
 */
export interface MockCallLog {
  id: string;
  mockId: string;
  timestamp: string;
  method: string;
  path: string;
  responseCode: number;
  responseTime: number;
}

/**
 * Delete mock result
 */
export interface DeleteMockResult {
  success: boolean;
  error?: string;
}
