package com.postman.sdk.types;

/**
 * Workspace role IDs
 */
public enum WorkspaceRole {
    VIEWER("1"),
    EDITOR("2"),
    ADMIN("3"),
    PARTNER_VIEWER("6"),
    PARTNER_EDITOR_AND_LEAD("7");

    private final String id;

    WorkspaceRole(String id) {
        this.id = id;
    }

    public String getId() {
        return id;
    }

    public static WorkspaceRole fromId(String id) {
        for (WorkspaceRole role : values()) {
            if (role.id.equals(id)) {
                return role;
            }
        }
        throw new IllegalArgumentException("Unknown role ID: " + id);
    }
}
