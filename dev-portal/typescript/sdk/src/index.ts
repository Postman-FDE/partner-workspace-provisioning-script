/**
 * Postman SDK for TypeScript
 * 
 * A fully-typed TypeScript SDK for the Postman API with workspace provisioning,
 * reset, and management capabilities.
 * 
 * @example
 * ```typescript
 * import { PostmanClient, ProvisioningService } from '@postman/sdk';
 * 
 * const client = new PostmanClient({ apiKey: process.env.POSTMAN_API_KEY });
 * 
 * // Validate API key
 * const { valid, user } = await client.validateApiKey();
 * 
 * // Get workspace summary
 * const workspace = await client.getWorkspace('workspace-id');
 * 
 * // Full provisioning workflow
 * const provisioner = new ProvisioningService({
 *   client,
 *   sourceWorkspaceId: 'source-workspace-id',
 *   targetWorkspaceName: 'New Partner Workspace',
 * });
 * const result = await provisioner.provision();
 * ```
 */

// Types
export * from './types';

// Client
export { PostmanClient, HttpClient, PostmanApiError, getErrorMessage } from './client';

// Services
export {
  WorkspaceService,
  ProvisioningService,
  ResetService,
  UpdateService,
  type WorkspaceServiceConfig,
  type ProvisioningConfig,
  type ProvisioningResult,
  type ResetConfig,
  type ResetResult,
  type WorkspaceContents,
  type UpdateConfig,
  type UpdateResult,
} from './services';
