/**
 * Common types used across the Postman SDK
 */

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

/**
 * API Error structure
 */
export interface ApiError {
  message: string;
  name?: string;
  details?: Record<string, unknown>;
}

/**
 * Progress callback for long-running operations
 */
export interface ProgressCallback {
  (progress: ProgressEvent): void;
}

/**
 * Progress event details
 */
export interface ProgressEvent {
  step: string;
  message: string;
  current?: number;
  total?: number;
  progress?: number;
  phase?: string;
  currentItem?: string;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total?: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
  nextCursor?: string;
}

/**
 * Result type for operations that can succeed or fail
 */
export type Result<T, E = ApiError> = 
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Batch operation result
 */
export interface BatchResult<T> {
  success: T[];
  failed: Array<{ item: T; error: string }>;
  total: number;
  successCount: number;
  failedCount: number;
}

/**
 * SDK Configuration options
 */
export interface PostmanClientConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * User info from /me endpoint
 */
export interface CurrentUser {
  id: string;
  username: string;
  email?: string;
  fullName?: string;
  avatar?: string;
}
