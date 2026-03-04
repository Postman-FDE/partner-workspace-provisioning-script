package com.postman.sdk.types;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * Environment entity
 */
public record Environment(
    String id,
    String uid,
    String name,
    String owner,
    @JsonProperty("createdAt") String createdAt,
    @JsonProperty("updatedAt") String updatedAt,
    @JsonProperty("isPublic") Boolean isPublic,
    List<EnvironmentVariable> values
) {
    /**
     * Environment variable
     */
    public record EnvironmentVariable(
        String key,
        String value,
        String type,
        Boolean enabled
    ) {
        public EnvironmentVariable {
            if (type == null) type = "default";
            if (enabled == null) enabled = true;
        }
    }
}
