package com.postman.sdk.types;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * API Specification entity
 */
public record Spec(
    String id,
    String name,
    SpecType type,
    @JsonProperty("createdAt") String createdAt,
    @JsonProperty("updatedAt") String updatedAt
) {
    /**
     * Spec type enumeration
     */
    public enum SpecType {
        @JsonProperty("OPENAPI:3.0") OPENAPI_3_0("OPENAPI:3.0"),
        @JsonProperty("OPENAPI:3.1") OPENAPI_3_1("OPENAPI:3.1"),
        @JsonProperty("ASYNCAPI:2.0") ASYNCAPI_2_0("ASYNCAPI:2.0"),
        @JsonProperty("GRAPHQL") GRAPHQL("GRAPHQL"),
        @JsonProperty("RAML:1.0") RAML_1_0("RAML:1.0"),
        @JsonProperty("WSDL:1.1") WSDL_1_1("WSDL:1.1"),
        @JsonProperty("WSDL:2.0") WSDL_2_0("WSDL:2.0");

        private final String value;

        SpecType(String value) {
            this.value = value;
        }

        public String getValue() {
            return value;
        }
    }

    /**
     * Spec file type
     */
    public enum SpecFileType {
        ROOT, DEFAULT
    }
}
