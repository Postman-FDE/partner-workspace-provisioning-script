package com.postman.sdk.types;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Workspace entity
 */
public record Workspace(
    String id,
    String name,
    WorkspaceType type,
    String description,
    String visibility,
    @JsonProperty("createdBy") String createdBy,
    @JsonProperty("createdAt") String createdAt,
    @JsonProperty("updatedAt") String updatedAt
) {
    /**
     * Workspace type enumeration
     */
    public enum WorkspaceType {
        personal,
        @JsonProperty("private") PRIVATE,
        team,
        partner,
        @JsonProperty("public") PUBLIC
    }
}
