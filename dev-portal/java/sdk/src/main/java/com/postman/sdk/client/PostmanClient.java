package com.postman.sdk.client;

import com.postman.sdk.config.PostmanClientConfig;
import com.postman.sdk.types.*;
import org.springframework.stereotype.Service;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Postman API Client using Spring WebClient
 */
@Service
public class PostmanClient {

    private final WebClient webClient;
    private final PostmanClientConfig config;

    public PostmanClient(WebClient webClient, PostmanClientConfig config) {
        this.webClient = webClient;
        this.config = config;
    }

    // =========================================================================
    // USER / AUTHENTICATION
    // =========================================================================

    /**
     * Validate API key and get current user info
     */
    public Mono<ApiResponse<CurrentUser>> validateApiKey() {
        return webClient.get()
            .uri("/me")
            .retrieve()
            .bodyToMono(Map.class)
            .map(response -> {
                @SuppressWarnings("unchecked")
                Map<String, Object> user = (Map<String, Object>) response.get("user");
                return ApiResponse.success(mapToCurrentUser(user));
            })
            .onErrorResume(e -> Mono.just(ApiResponse.failure(getErrorMessage(e))));
    }

    /**
     * Get current user info
     */
    public Mono<CurrentUser> getCurrentUser() {
        return webClient.get()
            .uri("/me")
            .retrieve()
            .bodyToMono(Map.class)
            .map(response -> {
                @SuppressWarnings("unchecked")
                Map<String, Object> user = (Map<String, Object>) response.get("user");
                return mapToCurrentUser(user);
            })
            .retryWhen(defaultRetry());
    }

    // =========================================================================
    // WORKSPACES
    // =========================================================================

    /**
     * Get workspace details
     */
    public Mono<Workspace> getWorkspace(String workspaceId) {
        return webClient.get()
            .uri("/workspaces/{id}", workspaceId)
            .retrieve()
            .bodyToMono(Map.class)
            .map(response -> {
                @SuppressWarnings("unchecked")
                Map<String, Object> workspace = (Map<String, Object>) response.get("workspace");
                return mapToWorkspace(workspace);
            })
            .onErrorResume(e -> Mono.empty())
            .retryWhen(defaultRetry());
    }

    /**
     * Create workspace
     */
    public Mono<ApiResponse<Workspace>> createWorkspace(String name, Workspace.WorkspaceType type, String description) {
        Map<String, Object> body = Map.of(
            "workspace", Map.of(
                "name", name,
                "type", type.name(),
                "description", description != null ? description : "Created via SDK"
            )
        );

        return webClient.post()
            .uri("/workspaces")
            .bodyValue(body)
            .retrieve()
            .bodyToMono(Map.class)
            .map(response -> {
                @SuppressWarnings("unchecked")
                Map<String, Object> workspace = (Map<String, Object>) response.get("workspace");
                return ApiResponse.success(mapToWorkspace(workspace));
            })
            .onErrorResume(e -> Mono.just(ApiResponse.failure(getErrorMessage(e))));
    }

    /**
     * Update workspace via PUT /workspaces/{workspaceId}
     */
    public Mono<Map<String, Object>> updateWorkspace(String workspaceId, Map<String, Object> updates) {
        return webClient.put()
            .uri("/workspaces/{id}", workspaceId)
            .bodyValue(Map.of("workspace", updates))
            .retrieve()
            .bodyToMono(Map.class)
            .map(response -> {
                Map<String, Object> result = new java.util.HashMap<>();
                result.put("success", true);
                result.put("workspace", response.get("workspace"));
                return result;
            })
            .onErrorResume(e -> {
                System.err.println("Error updating workspace: " + e.getMessage());
                return Mono.just(Map.of("success", false));
            });
    }

    // =========================================================================
    // COLLECTIONS
    // =========================================================================

    /**
     * Get all collections in a workspace
     */
    public Mono<List<Collection>> getCollections(String workspaceId) {
        return webClient.get()
            .uri("/collections?workspace={workspaceId}", workspaceId)
            .retrieve()
            .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
            .map(response -> {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> collections = (List<Map<String, Object>>) response.get("collections");
                return collections != null ? collections.stream().map(this::mapToCollection).toList() : List.<Collection>of();
            })
            .onErrorResume(e -> Mono.just(List.of()))
            .retryWhen(defaultRetry());
    }

    /**
     * Fork a collection
     */
    public Mono<ApiResponse<Collection>> forkCollection(String collectionUid, String label, String targetWorkspaceId) {
        return webClient.post()
            .uri("/collections/fork/{uid}?workspace={workspaceId}", collectionUid, targetWorkspaceId)
            .bodyValue(Map.of("label", label))
            .retrieve()
            .bodyToMono(Map.class)
            .map(response -> {
                @SuppressWarnings("unchecked")
                Map<String, Object> collection = (Map<String, Object>) response.get("collection");
                return ApiResponse.success(mapToCollection(collection));
            })
            .onErrorResume(e -> Mono.just(ApiResponse.failure(getErrorMessage(e))));
    }

    /**
     * Delete a collection
     */
    public Mono<Boolean> deleteCollection(String collectionUid) {
        return webClient.delete()
            .uri("/collections/{uid}", collectionUid)
            .retrieve()
            .toBodilessEntity()
            .map(response -> true)
            .onErrorResume(e -> Mono.just(false));
    }

    /**
     * Get full collection details (includes items, variables, etc.)
     * GET /collections/{collectionId}
     */
    @SuppressWarnings("unchecked")
    public Mono<Map<String, Object>> getCollectionDetails(String collectionUid) {
        return webClient.get()
            .uri("/collections/{uid}", collectionUid)
            .retrieve()
            .bodyToMono(Map.class)
            .map(response -> (Map<String, Object>) response.getOrDefault("collection", Map.of()))
            .onErrorResume(e -> Mono.empty());
    }

    /**
     * Update a collection's variables via PATCH
     * PATCH /collections/{collectionId}
     */
    public Mono<ApiResponse<Void>> patchCollectionVariables(String collectionUid, List<Map<String, Object>> variables) {
        return webClient.patch()
            .uri("/collections/{uid}", collectionUid)
            .bodyValue(Map.of("collection", Map.of("variable", variables)))
            .retrieve()
            .toBodilessEntity()
            .map(response -> ApiResponse.<Void>success(null))
            .onErrorResume(e -> Mono.just(ApiResponse.failure(getErrorMessage(e))));
    }

    // =========================================================================
    // ENVIRONMENTS
    // =========================================================================

    /**
     * Get all environments in a workspace
     */
    public Mono<List<Environment>> getEnvironments(String workspaceId) {
        return webClient.get()
            .uri("/environments?workspace={workspaceId}", workspaceId)
            .retrieve()
            .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
            .map(response -> {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> environments = (List<Map<String, Object>>) response.get("environments");
                return environments != null ? environments.stream().map(this::mapToEnvironment).toList() : List.<Environment>of();
            })
            .onErrorResume(e -> Mono.just(List.of()))
            .retryWhen(defaultRetry());
    }

    /**
     * Get environment details
     */
    public Mono<Environment> getEnvironmentDetails(String environmentUid) {
        return webClient.get()
            .uri("/environments/{uid}", environmentUid)
            .retrieve()
            .bodyToMono(Map.class)
            .map(response -> {
                @SuppressWarnings("unchecked")
                Map<String, Object> environment = (Map<String, Object>) response.get("environment");
                return mapToEnvironment(environment);
            })
            .onErrorResume(e -> Mono.empty())
            .retryWhen(defaultRetry());
    }

    /**
     * Create environment
     */
    public Mono<ApiResponse<Environment>> createEnvironment(String name, List<Environment.EnvironmentVariable> values, String workspaceId) {
        Map<String, Object> body = Map.of(
            "environment", Map.of(
                "name", name,
                "values", values.stream().map(v -> Map.of(
                    "key", v.key(),
                    "value", v.value(),
                    "type", v.type(),
                    "enabled", v.enabled()
                )).toList()
            )
        );

        return webClient.post()
            .uri("/environments?workspace={workspaceId}", workspaceId)
            .bodyValue(body)
            .retrieve()
            .bodyToMono(Map.class)
            .map(response -> {
                @SuppressWarnings("unchecked")
                Map<String, Object> environment = (Map<String, Object>) response.get("environment");
                return ApiResponse.success(mapToEnvironment(environment));
            })
            .onErrorResume(e -> Mono.just(ApiResponse.failure(getErrorMessage(e))));
    }

    /**
     * Update an environment (full replace)
     * PUT /environments/{environmentId}
     */
    public Mono<ApiResponse<Environment>> updateEnvironment(String environmentUid, String name, List<Environment.EnvironmentVariable> values) {
        Map<String, Object> body = Map.of(
            "environment", Map.of(
                "name", name,
                "values", values.stream().map(v -> Map.of(
                    "key", v.key(),
                    "value", v.value(),
                    "type", v.type(),
                    "enabled", v.enabled()
                )).toList()
            )
        );

        return webClient.put()
            .uri("/environments/{uid}", environmentUid)
            .bodyValue(body)
            .retrieve()
            .bodyToMono(Map.class)
            .map(response -> {
                @SuppressWarnings("unchecked")
                Map<String, Object> environment = (Map<String, Object>) response.get("environment");
                return ApiResponse.success(mapToEnvironment(environment));
            })
            .onErrorResume(e -> Mono.just(ApiResponse.failure(getErrorMessage(e))));
    }

    /**
     * Delete environment
     */
    public Mono<Boolean> deleteEnvironment(String environmentUid) {
        return webClient.delete()
            .uri("/environments/{uid}", environmentUid)
            .retrieve()
            .toBodilessEntity()
            .map(response -> true)
            .onErrorResume(e -> Mono.just(false));
    }

    // =========================================================================
    // MOCKS
    // =========================================================================

    /**
     * Get all mocks in a workspace
     */
    public Mono<List<MockServer>> getMocks(String workspaceId) {
        return webClient.get()
            .uri("/mocks?workspace={workspaceId}", workspaceId)
            .retrieve()
            .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
            .map(response -> {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> mocks = (List<Map<String, Object>>) response.get("mocks");
                return mocks != null ? mocks.stream().map(this::mapToMockServer).toList() : List.<MockServer>of();
            })
            .onErrorResume(e -> Mono.just(List.of()))
            .retryWhen(defaultRetry());
    }

    /**
     * Create mock server
     */
    public Mono<ApiResponse<MockServer>> createMock(String name, String collectionUid, String workspaceId, boolean isPrivate) {
        Map<String, Object> body = Map.of(
            "mock", Map.of(
                "name", name,
                "collection", collectionUid,
                "private", isPrivate
            )
        );

        return webClient.post()
            .uri("/mocks?workspace={workspaceId}", workspaceId)
            .bodyValue(body)
            .retrieve()
            .bodyToMono(Map.class)
            .map(response -> {
                @SuppressWarnings("unchecked")
                Map<String, Object> mock = (Map<String, Object>) response.get("mock");
                return ApiResponse.success(mapToMockServer(mock));
            })
            .onErrorResume(e -> Mono.just(ApiResponse.failure(getErrorMessage(e))));
    }

    /**
     * Delete mock server
     */
    public Mono<Boolean> deleteMock(String mockId) {
        return webClient.delete()
            .uri("/mocks/{id}", mockId)
            .retrieve()
            .toBodilessEntity()
            .map(response -> true)
            .onErrorResume(e -> Mono.just(false));
    }

    // =========================================================================
    // SPECS
    // =========================================================================

    /**
     * Get all specs in a workspace
     */
    public Mono<List<Spec>> getSpecs(String workspaceId) {
        return webClient.get()
            .uri("/specs?workspaceId={workspaceId}", workspaceId)
            .retrieve()
            .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
            .map(response -> {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> specs = (List<Map<String, Object>>) response.get("specs");
                return specs != null ? specs.stream().map(this::mapToSpec).toList() : List.<Spec>of();
            })
            .onErrorResume(e -> Mono.just(List.of()))
            .retryWhen(defaultRetry());
    }

    /**
     * Get spec files
     */
    public Mono<List<SpecFile>> getSpecFiles(String specId) {
        return webClient.get()
            .uri("/specs/{specId}/files", specId)
            .retrieve()
            .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
            .map(response -> {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> files = (List<Map<String, Object>>) response.get("files");
                return files != null ? files.stream().map(this::mapToSpecFile).toList() : List.<SpecFile>of();
            })
            .onErrorResume(e -> Mono.just(List.of()))
            .retryWhen(defaultRetry());
    }

    /**
     * Get spec file content
     */
    public Mono<SpecFile> getSpecFile(String specId, String filePath) {
        String encodedPath = URLEncoder.encode(filePath, StandardCharsets.UTF_8);
        return webClient.get()
            .uri("/specs/{specId}/files/{filePath}", specId, encodedPath)
            .retrieve()
            .bodyToMono(Map.class)
            .map(this::mapToSpecFile)
            .onErrorResume(e -> Mono.empty())
            .retryWhen(defaultRetry());
    }

    /**
     * Create spec
     */
    public Mono<ApiResponse<Spec>> createSpec(String workspaceId, String name, Spec.SpecType type, List<Map<String, String>> files) {
        Map<String, Object> body = Map.of(
            "name", name,
            "type", type.getValue(),
            "files", files
        );

        return webClient.post()
            .uri("/specs?workspaceId={workspaceId}", workspaceId)
            .bodyValue(body)
            .retrieve()
            .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
            .map(response -> ApiResponse.success(mapToSpec(response)))
            .onErrorResume(e -> Mono.just(ApiResponse.failure(getErrorMessage(e))));
    }

    /**
     * Delete spec
     */
    public Mono<ApiResponse<Void>> deleteSpec(String specId) {
        return webClient.delete()
            .uri("/specs/{specId}", specId)
            .retrieve()
            .toBodilessEntity()
            .map(response -> ApiResponse.<Void>success(null))
            .onErrorResume(e -> Mono.just(ApiResponse.failure(getErrorMessage(e))));
    }

    // =========================================================================
    // INVITATIONS
    // =========================================================================

    /**
     * Invite partner
     */
    public Mono<Invitation.InvitationResult> invitePartner(String workspaceId, String email, String roleId) {
        Map<String, Object> body = Map.of(
            "action", "invite_partner",
            "targetEntity", "workspace",
            "targetEntityId", workspaceId,
            "roleId", roleId,
            "target", Map.of("emails", List.of(email))
        );

        return webClient.post()
            .uri("/invitations")
            .bodyValue(body)
            .retrieve()
            .bodyToMono(Map.class)
            .map(response -> {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> results = (List<Map<String, Object>>) response.get("results");
                Map<String, Object> result = results != null && !results.isEmpty() ? results.get(0) : Map.of();
                return new Invitation.InvitationResult(
                    true,
                    (String) result.getOrDefault("email", email),
                    Invitation.InvitationStatus.valueOf((String) result.getOrDefault("status", "PENDING")),
                    (String) result.get("invitationLink"),
                    (String) result.get("userId"),
                    (String) response.get("roleDisplayName"),
                    null
                );
            })
            .onErrorResume(e -> Mono.just(new Invitation.InvitationResult(
                false, email, null, null, null, null, getErrorMessage(e)
            )));
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private Retry defaultRetry() {
        return Retry.backoff(config.getRetryAttempts(), Duration.ofMillis(config.getRetryDelayMs()))
            .filter(throwable -> !(throwable instanceof WebClientResponseException.BadRequest))
            .filter(throwable -> !(throwable instanceof WebClientResponseException.Unauthorized))
            .filter(throwable -> !(throwable instanceof WebClientResponseException.Forbidden))
            .filter(throwable -> !(throwable instanceof WebClientResponseException.NotFound));
    }

    private String getErrorMessage(Throwable e) {
        if (e instanceof WebClientResponseException ex) {
            return ex.getMessage();
        }
        return e.getMessage() != null ? e.getMessage() : "Unknown error";
    }

    private CurrentUser mapToCurrentUser(Map<String, Object> map) {
        return new CurrentUser(
            (String) map.get("id"),
            (String) map.get("username"),
            (String) map.get("email"),
            (String) map.get("fullName"),
            (String) map.get("avatar")
        );
    }

    private Workspace mapToWorkspace(Map<String, Object> map) {
        return new Workspace(
            (String) map.get("id"),
            (String) map.get("name"),
            Workspace.WorkspaceType.valueOf((String) map.getOrDefault("type", "team")),
            (String) map.get("description"),
            (String) map.get("visibility"),
            (String) map.get("createdBy"),
            (String) map.get("createdAt"),
            (String) map.get("updatedAt")
        );
    }

    private Collection mapToCollection(Map<String, Object> map) {
        return new Collection(
            (String) map.get("id"),
            (String) map.get("uid"),
            (String) map.get("name"),
            (String) map.get("owner"),
            (String) map.get("createdAt"),
            (String) map.get("updatedAt"),
            null
        );
    }

    private Environment mapToEnvironment(Map<String, Object> map) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> values = (List<Map<String, Object>>) map.get("values");
        return new Environment(
            (String) map.get("id"),
            (String) map.get("uid"),
            (String) map.get("name"),
            (String) map.get("owner"),
            (String) map.get("createdAt"),
            (String) map.get("updatedAt"),
            (Boolean) map.get("isPublic"),
            values != null ? values.stream().map(v -> new Environment.EnvironmentVariable(
                (String) v.get("key"),
                (String) v.get("value"),
                (String) v.getOrDefault("type", "default"),
                (Boolean) v.getOrDefault("enabled", true)
            )).toList() : List.of()
        );
    }

    private MockServer mapToMockServer(Map<String, Object> map) {
        return new MockServer(
            (String) map.get("id"),
            (String) map.get("uid"),
            (String) map.get("name"),
            (String) map.get("owner"),
            (String) map.get("collection"),
            (String) map.get("environment"),
            (String) map.get("mockUrl"),
            (Boolean) map.getOrDefault("isPublic", false),
            (String) map.get("createdAt"),
            (String) map.get("updatedAt")
        );
    }

    private Spec mapToSpec(Map<String, Object> map) {
        String typeStr = (String) map.get("type");
        Spec.SpecType type = typeStr != null ? 
            Spec.SpecType.valueOf(typeStr.replace(":", "_").replace(".", "_")) : 
            Spec.SpecType.OPENAPI_3_0;
        return new Spec(
            (String) map.get("id"),
            (String) map.get("name"),
            type,
            (String) map.get("createdAt"),
            (String) map.get("updatedAt")
        );
    }

    private SpecFile mapToSpecFile(Map<String, Object> map) {
        String typeStr = (String) map.get("type");
        Spec.SpecFileType type = typeStr != null ? Spec.SpecFileType.valueOf(typeStr) : Spec.SpecFileType.DEFAULT;
        return new SpecFile(
            (String) map.get("id"),
            (String) map.get("name"),
            (String) map.get("path"),
            type,
            (String) map.get("content"),
            (String) map.get("createdAt"),
            (String) map.get("updatedAt")
        );
    }
}
