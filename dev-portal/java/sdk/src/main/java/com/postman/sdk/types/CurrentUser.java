package com.postman.sdk.types;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Current user info from /me endpoint
 */
public record CurrentUser(
    String id,
    String username,
    String email,
    @JsonProperty("fullName") String fullName,
    String avatar
) {}
