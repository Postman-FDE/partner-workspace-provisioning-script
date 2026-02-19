package com.postman.sdk.types;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Mock server entity
 */
public record MockServer(
    String id,
    String uid,
    String name,
    String owner,
    String collection,
    String environment,
    @JsonProperty("mockUrl") String mockUrl,
    @JsonProperty("isPublic") Boolean isPublic,
    @JsonProperty("createdAt") String createdAt,
    @JsonProperty("updatedAt") String updatedAt
) {}
