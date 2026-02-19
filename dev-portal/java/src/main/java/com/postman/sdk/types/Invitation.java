package com.postman.sdk.types;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Partner invitation types
 */
public class Invitation {

    /**
     * Invitation status
     */
    public enum InvitationStatus {
        EMAIL_SENT,
        PARTNER_ADDED,
        PENDING,
        ACCEPTED,
        EXPIRED,
        FAILED
    }

    /**
     * Invitation result
     */
    public record InvitationResult(
        boolean success,
        String email,
        InvitationStatus status,
        @JsonProperty("invitationLink") String invitationLink,
        @JsonProperty("userId") String userId,
        @JsonProperty("roleDisplayName") String roleDisplayName,
        String error
    ) {}

    /**
     * Remove partner result
     */
    public record RemovePartnerResult(
        boolean success,
        @JsonProperty("userId") String userId,
        String status,
        String error
    ) {}
}
