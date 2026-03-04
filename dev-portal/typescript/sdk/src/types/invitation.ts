/**
 * Partner invitation-related types
 */

/**
 * Partner invitation status
 */
export type InvitationStatus = 
  | 'EMAIL_SENT'
  | 'PARTNER_ADDED'
  | 'PENDING'
  | 'ACCEPTED'
  | 'EXPIRED'
  | 'FAILED';

/**
 * Invitation action type
 */
export type InvitationAction = 
  | 'invite_partner'
  | 'remove_partner';

/**
 * Target entity type
 */
export type TargetEntityType = 'workspace' | 'team';

/**
 * Partner invitation request
 */
export interface InvitePartnerRequest {
  workspaceId: string;
  email: string;
  roleId?: string;
}

/**
 * Partner invitation result
 */
export interface InvitePartnerResult {
  success: boolean;
  email: string;
  status?: InvitationStatus;
  invitationLink?: string | null;
  userId?: string | null;
  roleDisplayName?: string;
  error?: string;
}

/**
 * Remove partner request
 */
export interface RemovePartnerRequest {
  workspaceId: string;
  userId: string;
}

/**
 * Remove partner result
 */
export interface RemovePartnerResult {
  success: boolean;
  userId: string;
  status?: string;
  error?: string;
}

/**
 * Remove partner from team request
 */
export interface RemovePartnerFromTeamRequest {
  teamId: string;
  userId: string;
}

/**
 * Invitation data stored in memory
 */
export interface InvitationData {
  status: InvitationStatus;
  invitationLink: string | null;
  userId: string | null;
  roleDisplayName?: string;
}

/**
 * Invitation link info
 */
export interface InvitationLink {
  email: string;
  invitationLink: string;
  status: InvitationStatus;
}

/**
 * Batch invite partners result
 */
export interface BatchInviteResult {
  success: InvitePartnerResult[];
  failed: Array<{
    email: string;
    error: string;
  }>;
}

/**
 * Batch remove partners result
 */
export interface BatchRemoveResult {
  success: RemovePartnerResult[];
  failed: Array<{
    userId: string;
    error: string;
  }>;
}
