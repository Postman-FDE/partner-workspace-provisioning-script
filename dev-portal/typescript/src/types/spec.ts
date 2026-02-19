/**
 * API Specification-related types
 */

/**
 * Spec type enumeration
 */
export type SpecType = 
  | 'OPENAPI:3.0'
  | 'OPENAPI:3.1'
  | 'ASYNCAPI:2.0'
  | 'GRAPHQL'
  | 'RAML:1.0'
  | 'WSDL:1.1'
  | 'WSDL:2.0';

/**
 * Spec file type
 */
export type SpecFileType = 'ROOT' | 'DEFAULT';

/**
 * Spec entity (from list endpoint)
 */
export interface Spec {
  id: string;
  name: string;
  type: SpecType;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Spec details
 */
export interface SpecDetails extends Spec {
  description?: string;
  workspaceId?: string;
}

/**
 * Spec file metadata
 */
export interface SpecFile {
  id: string;
  name: string;
  path: string;
  type: SpecFileType;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Spec file with content
 */
export interface SpecFileWithContent extends SpecFile {
  content: string;
}

/**
 * Create spec request
 */
export interface CreateSpecRequest {
  workspaceId: string;
  name: string;
  type: SpecType;
  files: CreateSpecFile[];
}

/**
 * Create spec file (for creation)
 */
export interface CreateSpecFile {
  path: string;
  content: string;
  type: SpecFileType;
}

/**
 * Create spec result
 */
export interface CreateSpecResult {
  success: boolean;
  spec?: Spec;
  error?: string;
}

/**
 * Copy spec result
 */
export interface CopySpecResult {
  success: boolean;
  specName: string;
  newSpecId: string | null;
  filesCopied: number;
  totalFiles: number;
  errors: string[];
}

/**
 * Copy all specs result
 */
export interface CopyAllSpecsResult {
  success: Array<{
    name: string;
    sourceId: string;
    targetId: string;
    filesCopied: number;
    totalFiles: number;
  }>;
  failed: Array<{
    name: string;
    error: string;
  }>;
}

/**
 * Spec mapping (source to target)
 */
export interface SpecMapping {
  sourceId: string;
  targetId: string;
  name: string;
  filesCopied: number;
}

/**
 * Delete spec result
 */
export interface DeleteSpecResult {
  success: boolean;
  error?: string;
}

/**
 * Update spec file type request
 */
export interface UpdateSpecFileTypeRequest {
  specId: string;
  filePath: string;
  type: SpecFileType;
}

/**
 * Update spec file type result
 */
export interface UpdateSpecFileTypeResult {
  success: boolean;
  file?: SpecFile;
  error?: string;
}
