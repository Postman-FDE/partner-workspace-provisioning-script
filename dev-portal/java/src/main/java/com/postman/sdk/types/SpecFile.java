package com.postman.sdk.types;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Spec file metadata
 */
public record SpecFile(
    String id,
    String name,
    String path,
    Spec.SpecFileType type,
    String content,
    @JsonProperty("createdAt") String createdAt,
    @JsonProperty("updatedAt") String updatedAt
) {}
