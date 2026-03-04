package com.postman.sdk.types;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Collection entity
 */
public record Collection(
    String id,
    String uid,
    String name,
    String owner,
    @JsonProperty("createdAt") String createdAt,
    @JsonProperty("updatedAt") String updatedAt,
    ForkInfo fork
) {
    /**
     * Fork information
     */
    public record ForkInfo(
        String label,
        @JsonProperty("createdAt") String createdAt,
        @JsonProperty("from") String from
    ) {}
}
