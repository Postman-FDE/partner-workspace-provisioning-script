package com.postman.sdk.script;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import java.util.stream.Collectors;

/**
 * Postman API Service - Spring WebFlux translation of postmanService.js.
 * Provides reactive workspace provisioning, reset, and management.
 */
@Service
public class PostmanService {

    private static final String POSTMAN_API_BASE = "https://api.getpostman.com";
    private static final List<String> COMMON_HOST_VAR_NAMES = List.of(
            "baseUrl", "baseurl", "base_url", "HostName", "hostname", "host",
            "apiUrl", "apiurl", "api_url", "serverUrl", "serverurl", "server_url"
    );

    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final String postmanApiKey;
    private final String postmanSourceWorkspaceId;
    private final String postmanTargetWorkspaceId;
    private final String postmanWorkspaceName;
    private final String postmanAdminUserIds;
    private final String partnerEmails;
    private final String partnerRoleId;

    public PostmanService(WebClient.Builder webClientBuilder,
                          ObjectMapper objectMapper,
                          @Value("${POSTMAN_API_KEY:}") String postmanApiKey,
                          @Value("${POSTMAN_SOURCE_WORKSPACE_ID:}") String postmanSourceWorkspaceId,
                          @Value("${POSTMAN_TARGET_WORKSPACE_ID:}") String postmanTargetWorkspaceId,
                          @Value("${POSTMAN_WORKSPACE_NAME:Partner Workspace}") String postmanWorkspaceName,
                          @Value("${POSTMAN_ADMIN_USER_IDS:}") String postmanAdminUserIds,
                          @Value("${PARTNER_EMAILS:}") String partnerEmails,
                          @Value("${PARTNER_ROLE_ID:7}") String partnerRoleId) {
        this.postmanApiKey = postmanApiKey != null ? postmanApiKey : "";
        this.postmanSourceWorkspaceId = postmanSourceWorkspaceId != null ? postmanSourceWorkspaceId : "";
        this.postmanTargetWorkspaceId = postmanTargetWorkspaceId != null ? postmanTargetWorkspaceId : "";
        this.postmanWorkspaceName = postmanWorkspaceName != null ? postmanWorkspaceName : "Partner Workspace";
        this.postmanAdminUserIds = postmanAdminUserIds != null ? postmanAdminUserIds : "";
        this.partnerEmails = partnerEmails != null ? partnerEmails : "";
        this.partnerRoleId = partnerRoleId != null && !partnerRoleId.isEmpty() ? partnerRoleId : "7";
        this.webClient = webClientBuilder
                .baseUrl(POSTMAN_API_BASE)
                .defaultHeader("Content-Type", "application/json")
                .defaultHeader("X-Api-Key", this.postmanApiKey)
                .build();
        this.objectMapper = objectMapper != null ? objectMapper : new ObjectMapper();
    }

    // ============================================================================
    // RECORD TYPES - Options and Results
    // ============================================================================

    public record CreateWorkspaceResult(boolean success, WorkspaceInfo workspace, String error) {}

    public record WorkspaceInfo(String id, String name, String type) {}

    public record InitializeTargetOptions(String targetWorkspaceId, String newWorkspaceName,
                                          String workspaceType, String description) {
        public static InitializeTargetOptions of(String targetWorkspaceId, String newWorkspaceName,
                                                 String workspaceType, String description) {
            return new InitializeTargetOptions(
                    targetWorkspaceId,
                    newWorkspaceName,
                    workspaceType != null ? workspaceType : "team",
                    description != null ? description : ""
            );
        }
    }

    public record InitializeTargetResult(boolean success, String workspaceId, Map<String, Object> workspace,
                                         boolean created, String error) {}

    public record WorkspaceRolesResult(boolean success, List<Map<String, Object>> roles, String error) {}

    public record AddAdminsResult(List<Map<String, Object>> success, List<Map<String, Object>> failed) {}

    public record InvitePartnerResult(boolean success, String email, String status, String invitationLink,
                                      Object userId, String roleDisplayName, String error) {}

    public record RemovePartnerResult(boolean success, String userId, String status, String error) {}

    public record InviteMultipleResult(List<Map<String, Object>> success, List<Map<String, Object>> failed) {}

    public record CreateSpecResult(boolean success, Map<String, Object> spec, String error) {}

    public record CreateSpecFileResult(boolean success, Map<String, Object> file, String error) {}

    public record CopySpecResult(boolean success, String specName, String newSpecId, int filesCopied,
                                 int totalFiles, List<String> errors) {}

    public record CopySpecsResult(List<Map<String, Object>> copied, List<Map<String, Object>> errors) {}

    public record ForkCollectionResult(boolean success, String collectionName, String collectionId,
                                       String uid, String error) {}

    public record CreateCollectionResult(boolean success, String collectionName, String collectionId,
                                         String uid, String error) {}

    public record CreateEnvironmentResult(boolean success, String environmentName, String environmentId,
                                          String uid, String error) {}

    public record UpdateEnvironmentResult(boolean success, Map<String, Object> environment, String error) {}

    public record CreateMockResult(boolean success, String mockName, String mockId, String mockUrl,
                                   String uid, String error) {}

    public record ResetOptions(boolean includeSpecs, boolean includeMocks, boolean includeEnvironments,
                               boolean includeCollections) {
        public static ResetOptions defaults() {
            return new ResetOptions(true, true, true, true);
        }
    }

    public record ResetResult(int deletedSpecs, int deletedMocks, int deletedEnvironments, int deletedCollections,
                              int totalSpecs, int totalMocks, int totalEnvironments, int totalCollections,
                              List<String> errors) {}

    public record ProvisionOptions(String sourceWorkspaceId, String targetWorkspaceId, String workspaceName,
                                   String workspaceType, List<String> adminUserIds, List<String> partnerEmails,
                                   String partnerRoleId) {
        public static ProvisionOptions of(String sourceWorkspaceId, String targetWorkspaceId,
                                          String workspaceName, String workspaceType,
                                          List<String> adminUserIds, List<String> partnerEmails,
                                          String partnerRoleId) {
            return new ProvisionOptions(
                    sourceWorkspaceId,
                    targetWorkspaceId,
                    workspaceName != null ? workspaceName : "Partner Workspace",
                    workspaceType != null ? workspaceType : "partner",
                    adminUserIds != null ? adminUserIds : List.of(),
                    partnerEmails != null ? partnerEmails : List.of(),
                    partnerRoleId != null ? partnerRoleId : "7"
            );
        }
    }

    public record ProvisionResult(Map<String, Object> workspace, boolean workspaceCreated,
                                  Map<String, Object> collections, Map<String, Object> mocks,
                                  Map<String, Object> environments, Map<String, Object> mockEnv,
                                  Map<String, Object> specs, Map<String, Object> admins,
                                  Map<String, Object> invitations, List<String> errors) {}

    public record ConfigurationStatus(boolean hasApiKey, boolean hasTargetWorkspace, boolean hasSourceWorkspace,
                                      boolean isConfigured, boolean isFullyConfigured, String message) {}

    public record ValidateApiKeyResult(boolean valid, Map<String, Object> user, String error) {}

    public record WorkspaceSummaryResult(String workspaceId, Map<String, Integer> counts,
                                        Map<String, List<Map<String, Object>>> items) {}

    public record CustomProvisionOptions(String sourceWorkspaceId, String targetWorkspaceId, String workspaceName,
                                         String workspaceType, boolean copyCollections, boolean copyEnvironments,
                                         boolean copyMocks, boolean copySpecs, List<String> selectedCollectionUids,
                                         List<String> selectedEnvironmentUids, List<String> selectedSpecIds,
                                         boolean createMockEnv, boolean addAdmins, boolean invitePartners,
                                         List<String> adminUserIds, List<String> partnerEmails,
                                         String partnerRoleId) {}

    public record CustomResetOptions(boolean includeSpecs, boolean includeMocks, boolean includeEnvironments,
                                     boolean includeCollections, List<String> selectedCollectionUids,
                                     List<String> selectedEnvironmentUids, List<String> selectedMockIds,
                                     List<String> selectedSpecIds) {}

    // ============================================================================
    // UTILITIES
    // ============================================================================

    private static void progress(Consumer<Map<String, Object>> onProgress, Map<String, Object> data) {
        if (onProgress != null) {
            onProgress.accept(data);
        }
    }

    private Mono<Void> delay(long ms) {
        return Mono.delay(Duration.ofMillis(ms)).then();
    }

    private String extractError(Throwable error) {
        if (error instanceof WebClientResponseException ex) {
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> body = ex.getResponseBodyAs(Map.class);
                if (body != null && body.get("error") instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> err = (Map<String, Object>) body.get("error");
                    Object msg = err != null ? err.get("message") : null;
                    return msg != null ? msg.toString() : ex.getMessage();
                }
            } catch (Exception ignored) {}
            return ex.getMessage();
        }
        return error instanceof Exception ? error.getMessage() : "Unknown error";
    }

    private String toPascalCase(String str) {
        String spaced = str.replaceAll("([a-z])([A-Z])", "$1 $2")
                           .replaceAll("[^a-zA-Z0-9]", " ");
        StringBuilder sb = new StringBuilder();
        for (String word : spaced.trim().split("\\s+")) {
            if (!word.isEmpty()) {
                sb.append(Character.toUpperCase(word.charAt(0)))
                  .append(word.substring(1).toLowerCase());
            }
        }
        return sb.toString();
    }

    private String toCamelCase(String name) {
        String clean = name.replaceAll("[^a-zA-Z0-9\\s]", "");
        String[] words = clean.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < words.length; i++) {
            if (i == 0) {
                sb.append(words[i].toLowerCase());
            } else {
                sb.append(Character.toUpperCase(words[i].charAt(0)))
                  .append(words[i].substring(1).toLowerCase());
            }
        }
        return sb.toString();
    }

    private String extractUrlPath(String urlString) {
        try {
            java.net.URI uri = new java.net.URI(urlString);
            String path = uri.getPath();
            return (path == null || path.equals("/")) ? "" : path;
        } catch (Exception e) {
            return "";
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> extractHostVariables(Map<String, Object> collection) {
        Set<String> hostVarNames = new HashSet<>();

        List<Map<String, Object>> items = (List<Map<String, Object>>) collection.getOrDefault("item", List.of());
        traverseItems(items, hostVarNames);

        List<Map<String, Object>> collectionVars = (List<Map<String, Object>>) collection.getOrDefault("variable", List.of());

        if (!hostVarNames.isEmpty()) {
            List<Map<String, Object>> allMapped = new ArrayList<>();
            for (String varName : hostVarNames) {
                Map<String, Object> varDef = collectionVars.stream()
                    .filter(v -> varName.equals(v.get("key")))
                    .findFirst().orElse(null);
                String originalUrl = varDef != null ? String.valueOf(varDef.getOrDefault("value", "")) : "";
                String path = extractUrlPath(originalUrl);
                allMapped.add(Map.of("varName", varName, "originalUrl", originalUrl, "path", path));
            }
            List<Map<String, Object>> withProtocol = allMapped.stream()
                .filter(hv -> ((String) hv.get("originalUrl")).contains("://"))
                .collect(Collectors.toList());
            if (!withProtocol.isEmpty()) return withProtocol;
            return allMapped.stream()
                .map(hv -> Map.<String, Object>of("varName", hv.get("varName"), "originalUrl", hv.get("originalUrl"), "path", ""))
                .collect(Collectors.toList());
        }

        return collectionVars.stream()
            .filter(v -> COMMON_HOST_VAR_NAMES.contains(String.valueOf(v.get("key"))))
            .map(v -> Map.<String, Object>of("varName", v.get("key"), "originalUrl", String.valueOf(v.getOrDefault("value", "")), "path", ""))
            .collect(Collectors.toList());
    }

    @SuppressWarnings("unchecked")
    private void traverseItems(List<Map<String, Object>> items, Set<String> hostVarNames) {
        for (Map<String, Object> item : items) {
            if (item.containsKey("item")) {
                traverseItems((List<Map<String, Object>>) item.get("item"), hostVarNames);
            }
            Map<String, Object> request = (Map<String, Object>) item.get("request");
            if (request != null) {
                Map<String, Object> url = (request.get("url") instanceof Map) ? (Map<String, Object>) request.get("url") : null;
                if (url != null) {
                    List<String> hosts = (List<String>) url.getOrDefault("host", List.of());
                    for (String h : hosts) {
                        java.util.regex.Matcher m = java.util.regex.Pattern.compile("^\\{\\{(.+)\\}\\}$").matcher(h);
                        if (m.matches()) {
                            hostVarNames.add(m.group(1));
                        }
                    }
                }
            }
        }
    }

    // ============================================================================
    // WORKSPACE MANAGEMENT
    // ============================================================================

    public Mono<String> getTargetWorkspaceId() {
        return Mono.justOrEmpty(postmanTargetWorkspaceId);
    }

    public Mono<String> getSourceWorkspaceId() {
        return Mono.justOrEmpty(postmanSourceWorkspaceId);
    }

    public String getDefaultWorkspaceName() {
        return postmanWorkspaceName != null && !postmanWorkspaceName.isEmpty()
                ? postmanWorkspaceName : "Partner Workspace";
    }

    public List<String> getAdminUserIds() {
        if (postmanAdminUserIds == null || postmanAdminUserIds.isBlank()) return List.of();
        return Arrays.stream(postmanAdminUserIds.split(","))
                .map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    public List<String> getPartnerEmails() {
        if (partnerEmails == null || partnerEmails.isBlank()) return List.of();
        return Arrays.stream(partnerEmails.split(","))
                .map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    public String getPartnerRoleId() {
        return partnerRoleId != null && !partnerRoleId.isEmpty() ? partnerRoleId : "7";
    }

    public Mono<CreateWorkspaceResult> createWorkspace(String name, String type, String description) {
        Map<String, Object> body = Map.of(
                "workspace", Map.of(
                        "name", name,
                        "type", type != null ? type : "team",
                        "description", description != null && !description.isEmpty() ? description : "Workspace created via automation script"
                )
        );
        return webClient.post()
                .uri("/workspaces")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(Map.class)
                .map(response -> {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> ws = (Map<String, Object>) response.get("workspace");
                    WorkspaceInfo info = ws != null ? new WorkspaceInfo(
                            (String) ws.get("id"),
                            (String) ws.get("name"),
                            (String) ws.get("type")
                    ) : null;
                    return new CreateWorkspaceResult(true, info, null);
                })
                .onErrorResume(e -> Mono.just(new CreateWorkspaceResult(false, null, extractError(e))));
    }

    public Mono<Map<String, Object>> getWorkspace(String workspaceId) {
        return webClient.get()
                .uri("/workspaces/{id}", workspaceId)
                .retrieve()
                .bodyToMono(Map.class)
                .map(response -> (Map<String, Object>) response.get("workspace"))
                .onErrorResume(e -> {
                    return Mono.empty();
                });
    }

    public Mono<Boolean> deleteWorkspace(String workspaceId) {
        return webClient.delete()
                .uri("/workspaces/{id}", workspaceId)
                .retrieve()
                .toBodilessEntity()
                .map(r -> true)
                .onErrorResume(e -> Mono.just(false));
    }

    public Mono<InitializeTargetResult> initializeTargetWorkspace(InitializeTargetOptions options) {
        String targetWorkspaceId = options.targetWorkspaceId();
        String newWorkspaceName = options.newWorkspaceName();
        String workspaceType = options.workspaceType();
        String description = options.description();

        if (targetWorkspaceId != null && !targetWorkspaceId.isEmpty()) {
            return getWorkspace(targetWorkspaceId)
                    .flatMap(existing -> Mono.just(new InitializeTargetResult(
                            true, targetWorkspaceId, existing, false, null)))
                    .switchIfEmpty(Mono.just(new InitializeTargetResult(false, null, null, false,
                            "Target workspace with ID \"" + targetWorkspaceId + "\" not found or not accessible")));
        }

        if (newWorkspaceName == null || newWorkspaceName.isEmpty()) {
            return Mono.just(new InitializeTargetResult(false, null, null, false,
                    "Either targetWorkspaceId or newWorkspaceName must be provided"));
        }

        return createWorkspace(newWorkspaceName, workspaceType, description)
                .map(createResult -> {
                    if (createResult.success() && createResult.workspace() != null) {
                        return new InitializeTargetResult(true, createResult.workspace().id(),
                                Map.of("id", createResult.workspace().id(), "name", createResult.workspace().name(),
                                        "type", createResult.workspace().type()),
                                true, null);
                    }
                    return new InitializeTargetResult(false, null, null, false, createResult.error());
                });
    }

    // ============================================================================
    // WORKSPACE ROLES MANAGEMENT
    // ============================================================================

    public Mono<WorkspaceRolesResult> getWorkspaceRoles(String workspaceId) {
        return webClient.get()
                .uri("/workspaces/{id}/roles", workspaceId)
                .retrieve()
                .bodyToMono(Map.class)
                .map(response -> {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> roles = (List<Map<String, Object>>) response.get("roles");
                    return new WorkspaceRolesResult(true, roles != null ? roles : List.of(), null);
                })
                .onErrorResume(e -> Mono.just(new WorkspaceRolesResult(false, List.of(), extractError(e))));
    }

    public Mono<WorkspaceRolesResult> addWorkspaceAdmin(String workspaceId, String userId, String roleId) {
        Map<String, Object> body = Map.of(
                "roles", List.of(Map.of(
                        "op", "add",
                        "path", "/user",
                        "value", List.of(Map.of("id", userId, "role", roleId != null ? roleId : "3"))
                ))
        );
        return webClient.patch()
                .uri("/workspaces/{id}/roles", workspaceId)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(Map.class)
                .map(response -> new WorkspaceRolesResult(true, (List<Map<String, Object>>) response.get("roles"), null))
                .onErrorResume(e -> Mono.just(new WorkspaceRolesResult(false, null, extractError(e))));
    }

    public Mono<WorkspaceRolesResult> removeWorkspaceUser(String workspaceId, String userId, String roleId) {
        Map<String, Object> body = Map.of(
                "roles", List.of(Map.of(
                        "op", "remove",
                        "path", "/user",
                        "value", List.of(Map.of("id", userId, "role", roleId))
                ))
        );
        return webClient.patch()
                .uri("/workspaces/{id}/roles", workspaceId)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(Map.class)
                .map(response -> new WorkspaceRolesResult(true, (List<Map<String, Object>>) response.get("roles"), null))
                .onErrorResume(e -> Mono.just(new WorkspaceRolesResult(false, null, extractError(e))));
    }

    public Mono<AddAdminsResult> addMultipleAdmins(String workspaceId, List<String> userIds,
                                                   Consumer<Map<String, Object>> onProgress) {
        List<Map<String, Object>> success = new ArrayList<>();
        List<Map<String, Object>> failed = new ArrayList<>();
        return Flux.fromIterable(userIds != null ? userIds : List.of())
                .index()
                .concatMap(tuple -> {
                    int i = (int) tuple.getT1() + 1;
                    String userId = tuple.getT2();
                    progress(onProgress, Map.of("phase", "admins", "message", "Adding admin: " + userId,
                            "current", i, "total", userIds.size()));
                    return addWorkspaceAdmin(workspaceId, userId, "3")
                            .flatMap(result -> {
                                if (result.success()) {
                                    success.add(Map.of("userId", userId, "roleId", "3"));
                                } else {
                                    failed.add(Map.of("userId", userId, "error", result.error()));
                                }
                                return delay(300);
                            });
                })
                .then(Mono.just(new AddAdminsResult(success, failed)));
    }

    // ============================================================================
    // PARTNER INVITATIONS MANAGEMENT
    // ============================================================================

    public Mono<InvitePartnerResult> invitePartner(String workspaceId, String email, String roleId) {
        Map<String, Object> body = Map.of(
                "action", "invite_partner",
                "targetEntity", "workspace",
                "targetEntityId", workspaceId,
                "roleId", roleId != null ? roleId : "7",
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
                    return new InvitePartnerResult(true,
                            (String) result.getOrDefault("email", email),
                            (String) result.get("status"),
                            (String) result.get("invitationLink"),
                            result.get("userId"),
                            (String) response.get("roleDisplayName"),
                            null);
                })
                .onErrorResume(e -> Mono.just(new InvitePartnerResult(false, email, null, null, null, null, extractError(e))));
    }

    public Mono<RemovePartnerResult> removePartner(String workspaceId, String userId) {
        Map<String, Object> body = Map.of(
                "action", "remove_partner",
                "targetEntity", "workspace",
                "targetEntityId", workspaceId,
                "target", Map.of("userIds", List.of(userId))
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
                    return new RemovePartnerResult(true,
                            (String) result.getOrDefault("userId", userId),
                            (String) result.get("status"),
                            null);
                })
                .onErrorResume(e -> Mono.just(new RemovePartnerResult(false, userId, null, extractError(e))));
    }

    public Mono<RemovePartnerResult> removePartnerFromTeam(String teamId, String userId) {
        Map<String, Object> body = Map.of(
                "action", "remove_partner",
                "targetEntity", "team",
                "targetEntityId", teamId,
                "target", Map.of("userIds", List.of(userId))
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
                    return new RemovePartnerResult(true,
                            (String) result.getOrDefault("userId", userId),
                            (String) result.get("status"),
                            null);
                })
                .onErrorResume(e -> Mono.just(new RemovePartnerResult(false, userId, null, extractError(e))));
    }

    public Mono<InviteMultipleResult> inviteMultiplePartners(String workspaceId, List<String> emails,
                                                             String roleId, Consumer<Map<String, Object>> onProgress) {
        List<Map<String, Object>> success = new ArrayList<>();
        List<Map<String, Object>> failed = new ArrayList<>();
        List<String> emailList = emails != null ? emails : List.of();
        return Flux.fromIterable(emailList)
                .index()
                .concatMap(tuple -> {
                    int i = (int) tuple.getT1() + 1;
                    String email = tuple.getT2();
                    progress(onProgress, Map.of("phase", "invitations", "message", "Inviting partner: " + email,
                            "current", i, "total", emailList.size()));
                    return invitePartner(workspaceId, email, roleId)
                            .flatMap(inviteResult -> {
                                if (inviteResult.success()) {
                                    success.add(Map.of(
                                            "email", inviteResult.email(),
                                            "status", inviteResult.status(),
                                            "invitationLink", inviteResult.invitationLink(),
                                            "userId", inviteResult.userId(),
                                            "roleDisplayName", inviteResult.roleDisplayName()
                                    ));
                                } else {
                                    failed.add(Map.of("email", email, "error", inviteResult.error()));
                                }
                                return delay(300);
                            });
                })
                .then(Mono.just(new InviteMultipleResult(success, failed)));
    }

    public Mono<InviteMultipleResult> removeMultiplePartners(String workspaceId, List<String> userIds,
                                                              Consumer<Map<String, Object>> onProgress) {
        List<Map<String, Object>> success = new ArrayList<>();
        List<Map<String, Object>> failed = new ArrayList<>();
        List<String> uidList = userIds != null ? userIds : List.of();
        return Flux.fromIterable(uidList)
                .index()
                .concatMap(tuple -> {
                    int i = (int) tuple.getT1() + 1;
                    String userId = tuple.getT2();
                    progress(onProgress, Map.of("phase", "removePartners", "message", "Removing partner: " + userId,
                            "current", i, "total", uidList.size()));
                    return removePartner(workspaceId, userId)
                            .flatMap(removeResult -> {
                                if (removeResult.success()) {
                                    success.add(Map.of("userId", removeResult.userId(), "status", removeResult.status()));
                                } else {
                                    failed.add(Map.of("userId", userId, "error", removeResult.error()));
                                }
                                return delay(300);
                            });
                })
                .then(Mono.just(new InviteMultipleResult(success, failed)));
    }

    // ============================================================================
    // SPEC MANAGEMENT
    // ============================================================================

    public Mono<List<Map<String, Object>>> getAllSpecs(String workspaceId) {
        return webClient.get()
                .uri(uri -> uri.path("/specs").queryParam("workspaceId", workspaceId).build())
                .retrieve()
                .bodyToMono(Map.class)
                .map(response -> {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> specs = (List<Map<String, Object>>) response.get("specs");
                    return specs != null ? specs : List.of();
                })
                .onErrorResume(e -> Mono.just(List.of()));
    }

    public Mono<Map<String, Object>> getSpecDetails(String specId) {
        return webClient.get()
                .uri("/specs/{id}", specId)
                .retrieve()
                .bodyToMono(Map.class)
                .onErrorResume(e -> Mono.empty());
    }

    public Mono<List<Map<String, Object>>> getSpecFiles(String specId) {
        return webClient.get()
                .uri("/specs/{id}/files", specId)
                .retrieve()
                .bodyToMono(Map.class)
                .map(response -> {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> files = (List<Map<String, Object>>) response.get("files");
                    return files != null ? files : List.of();
                })
                .onErrorResume(e -> Mono.just(List.of()));
    }

    public Mono<Map<String, Object>> getSpecFile(String specId, String filePath) {
        String encodedPath = URLEncoder.encode(filePath, StandardCharsets.UTF_8);
        return webClient.get()
                .uri("/specs/{specId}/files/{path}", specId, encodedPath)
                .retrieve()
                .bodyToMono(Map.class)
                .onErrorResume(e -> Mono.empty());
    }

    public Mono<CreateSpecResult> createSpec(String workspaceId, String name, String type, List<Map<String, Object>> files) {
        Map<String, Object> body = new HashMap<>();
        body.put("name", name);
        body.put("type", type);
        body.put("files", files != null ? files : List.of());
        return webClient.post()
                .uri(uri -> uri.path("/specs").queryParam("workspaceId", workspaceId).build())
                .bodyValue(body)
                .retrieve()
                .bodyToMono(Map.class)
                .map(response -> new CreateSpecResult(true, response, null))
                .onErrorResume(e -> Mono.just(new CreateSpecResult(false, null, extractError(e))));
    }

    public Mono<CreateSpecFileResult> createSpecFile(String specId, String path, String content) {
        Map<String, Object> body = Map.of("path", path, "content", content != null ? content : "");
        return webClient.post()
                .uri("/specs/{id}/files", specId)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(Map.class)
                .map(response -> new CreateSpecFileResult(true, response, null))
                .onErrorResume(e -> Mono.just(new CreateSpecFileResult(false, null, extractError(e))));
    }

    public Mono<CreateSpecFileResult> updateSpecFileType(String specId, String filePath, String type) {
        String encodedPath = URLEncoder.encode(filePath, StandardCharsets.UTF_8);
        return webClient.patch()
                .uri("/specs/{specId}/files/{path}", specId, encodedPath)
                .bodyValue(Map.of("type", type))
                .retrieve()
                .bodyToMono(Map.class)
                .map(response -> new CreateSpecFileResult(true, response, null))
                .onErrorResume(e -> Mono.just(new CreateSpecFileResult(false, null, extractError(e))));
    }

    public Mono<Boolean> deleteSpec(String specId) {
        return webClient.delete()
                .uri("/specs/{id}", specId)
                .retrieve()
                .toBodilessEntity()
                .map(r -> true)
                .onErrorResume(e -> Mono.just(false));
    }

    public Mono<CopySpecResult> copySpec(String sourceSpecId, String sourceSpecName, String sourceSpecType,
                                         String targetWorkspaceId, Consumer<Map<String, Object>> onProgress) {
        List<String> errors = new ArrayList<>();
        progress(onProgress, Map.of("step", "files", "message", "Getting files for: " + sourceSpecName));

        return getSpecFiles(sourceSpecId)
                .flatMap(sourceFiles -> {
                    if (sourceFiles.isEmpty()) {
                        errors.add("No files found in source spec");
                        return Mono.just(new CopySpecResult(false, sourceSpecName, null, 0, 0, errors));
                    }
                    progress(onProgress, Map.of("step", "content", "message", "Fetching " + sourceFiles.size() + " file(s) content..."));
                    return Flux.fromIterable(sourceFiles)
                            .index()
                            .concatMap(tuple -> {
                                int idx = (int) tuple.getT1() + 1;
                                Map<String, Object> file = tuple.getT2();
                                String path = (String) file.get("path");
                                progress(onProgress, Map.of("step", "fetchingFile", "message", "Fetching: " + path,
                                        "current", idx, "total", sourceFiles.size()));
                                return getSpecFile(sourceSpecId, path)
                                        .map(fileContent -> {
                                            Object content = fileContent != null ? fileContent.get("content") : null;
                                            if (content != null) {
                                                return Map.<String, Object>of(
                                                        "path", path,
                                                        "content", content,
                                                        "type", file.getOrDefault("type", "DEFAULT"));
                                            }
                                            errors.add("Failed to get content for file: " + path);
                                            return null;
                                        })
                                        .switchIfEmpty(Mono.fromCallable(() -> {
                                            errors.add("Failed to get content for file: " + path);
                                            return null;
                                        }))
                                        .delayElement(Duration.ofMillis(200))
                                        .filter(f -> f != null);
                            })
                            .collectList()
                            .flatMap(filesWithContent -> {
                                if (filesWithContent.isEmpty()) {
                                    errors.add("Could not retrieve any file contents");
                                    return Mono.just(new CopySpecResult(false, sourceSpecName, null, 0, sourceFiles.size(), errors));
                                }
                                progress(onProgress, Map.of("step", "create", "message", "Creating spec with " + filesWithContent.size() + " file(s)..."));
                                return createSpec(targetWorkspaceId, sourceSpecName, sourceSpecType, filesWithContent)
                                        .map(createResult -> {
                                            if (createResult.success() && createResult.spec() != null) {
                                                String newId = (String) createResult.spec().get("id");
                                                return new CopySpecResult(true, sourceSpecName, newId, filesWithContent.size(), sourceFiles.size(), errors);
                                            }
                                            errors.add("Failed to create spec: " + createResult.error());
                                            return new CopySpecResult(false, sourceSpecName, null, 0, sourceFiles.size(), errors);
                                        });
                            });
                })
                .onErrorResume(e -> {
                    errors.add("Unexpected error: " + e.getMessage());
                    return Mono.just(new CopySpecResult(false, sourceSpecName, null, 0, 0, errors));
                });
    }

    public Mono<CopySpecsResult> copySpecs(String sourceWorkspaceId, String targetWorkspaceId,
                                           Consumer<Map<String, Object>> onProgress) {
        List<Map<String, Object>> copied = new ArrayList<>();
        List<Map<String, Object>> errors = new ArrayList<>();
        return getAllSpecs(sourceWorkspaceId)
                .flatMap(sourceSpecs -> {
                    if (sourceSpecs.isEmpty()) {
                        progress(onProgress, Map.of("phase", "specs", "message", "No specs found in source workspace", "progress", 100));
                        return Mono.just(new CopySpecsResult(copied, errors));
                    }
                    return Flux.fromIterable(sourceSpecs)
                            .index()
                            .concatMap(tuple -> {
                                int i = (int) tuple.getT1() + 1;
                                Map<String, Object> spec = tuple.getT2();
                                String name = (String) spec.get("name");
                                String type = (String) spec.get("type");
                                String id = (String) spec.get("id");
                                progress(onProgress, Map.of("phase", "specs", "message", "Copying spec: " + name + " (" + type + ")",
                                        "currentItem", name, "current", i, "total", sourceSpecs.size(),
                                        "progress", Math.round((double) (i - 1) / sourceSpecs.size() * 100)));
                                return copySpec(id, name, type, targetWorkspaceId, null)
                                        .flatMap(copyResult -> {
                                            if (copyResult.success()) {
                                                copied.add(Map.of(
                                                        "originalSpecId", id,
                                                        "newSpecId", copyResult.newSpecId(),
                                                        "name", name,
                                                        "type", type,
                                                        "filesCopied", copyResult.filesCopied()
                                                ));
                                            } else {
                                                errors.add(Map.of("specName", name, "error", String.join("; ", copyResult.errors())));
                                            }
                                            return delay(500);
                                        });
                            })
                            .then(Mono.just(new CopySpecsResult(copied, errors)));
                });
    }

    // ============================================================================
    // COLLECTIONS MANAGEMENT
    // ============================================================================

    public Mono<List<Map<String, Object>>> getSourceCollections() {
        return webClient.get()
                .uri(uri -> uri.path("/collections").queryParam("workspace", postmanSourceWorkspaceId).build())
                .retrieve()
                .bodyToMono(Map.class)
                .map(response -> {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> collections = (List<Map<String, Object>>) response.get("collections");
                    return collections != null ? collections : List.of();
                })
                .onErrorResume(e -> Mono.just(List.of()));
    }

    public Mono<ForkCollectionResult> forkCollection(String collectionId, String collectionName, String workspaceId) {
        return webClient.post()
                .uri(uri -> uri.path("/collections/fork/{id}").queryParam("workspace", workspaceId).build(), collectionId)
                .bodyValue(Map.of("label", collectionName != null ? collectionName : ""))
                .retrieve()
                .bodyToMono(Map.class)
                .map(response -> {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> coll = (Map<String, Object>) response.get("collection");
                    String name = coll != null ? (String) coll.get("name") : collectionName;
                    String uid = coll != null ? (String) coll.get("uid") : null;
                    String id = coll != null ? (String) coll.get("id") : null;
                    return new ForkCollectionResult(true, name, id, uid, null);
                })
                .onErrorResume(e -> Mono.just(new ForkCollectionResult(false, collectionName, null, null, extractError(e))));
    }

    public Mono<Map<String, Object>> getCollectionDetails(String collectionUid) {
        return webClient.get()
                .uri("/collections/{uid}", collectionUid)
                .retrieve()
                .bodyToMono(Map.class)
                .map(response -> (Map<String, Object>) response.get("collection"))
                .onErrorResume(e -> Mono.empty());
    }

    public Mono<CreateCollectionResult> createCollectionInPostman(Map<String, Object> collectionData, String workspaceId) {
        String name = "Unknown";
        if (collectionData != null && collectionData.get("info") instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> info = (Map<String, Object>) collectionData.get("info");
            name = info != null && info.get("name") != null ? info.get("name").toString() : name;
        }
        return webClient.post()
                .uri(uri -> uri.path("/collections").queryParam("workspace", workspaceId).build())
                .bodyValue(Map.of("collection", collectionData != null ? collectionData : Map.of()))
                .retrieve()
                .bodyToMono(Map.class)
                .map(response -> {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> coll = (Map<String, Object>) response.get("collection");
                    return new CreateCollectionResult(true, name, coll != null ? (String) coll.get("id") : null,
                            coll != null ? (String) coll.get("uid") : null, null);
                })
                .onErrorResume(e -> Mono.just(new CreateCollectionResult(false, name, null, null, extractError(e))));
    }

    public Mono<List<CreateCollectionResult>> createMultipleCollections(List<Map<String, Object>> collections,
                                                                        String workspaceId,
                                                                        Consumer<Map<String, Object>> onProgress) {
        List<CreateCollectionResult> results = new ArrayList<>();
        List<Map<String, Object>> collList = collections != null ? collections : List.of();
        return Flux.fromIterable(collList)
                .index()
                .concatMap(tuple -> {
                    int i = (int) tuple.getT1() + 1;
                    Map<String, Object> collection = tuple.getT2();
                    String itemName = "Unknown";
                    if (collection != null && collection.get("info") instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> info = (Map<String, Object>) collection.get("info");
                        itemName = info != null && info.get("name") != null ? info.get("name").toString() : itemName;
                    }
                    return createCollectionInPostman(collection, workspaceId)
                            .doOnNext(results::add)
                            .doOnNext(result -> progress(onProgress, Map.of("current", i, "total", collList.size(),
                                    "currentItem", itemName, "result", result)))
                            .then(delay(500));
                })
                .then(Mono.just(results));
    }

    public Mono<List<Map<String, Object>>> getAllCollections(String workspaceId) {
        return webClient.get()
                .uri(uri -> uri.path("/collections").queryParam("workspace", workspaceId).build())
                .retrieve()
                .bodyToMono(Map.class)
                .map(response -> {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> collections = (List<Map<String, Object>>) response.get("collections");
                    return collections != null ? collections : List.of();
                })
                .onErrorResume(e -> Mono.just(List.of()));
    }

    public Mono<Boolean> deleteCollection(String collectionId) {
        return webClient.delete()
                .uri("/collections/{id}", collectionId)
                .retrieve()
                .toBodilessEntity()
                .map(r -> true)
                .onErrorResume(e -> Mono.just(false));
    }

    public Mono<Map<String, Object>> patchCollectionVariables(String collectionUid, List<Map<String, Object>> variables) {
        return webClient.patch()
                .uri("/collections/" + collectionUid)
                .bodyValue(Map.of("collection", Map.of("variable", variables)))
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                .map(response -> Map.of("success", true, "collection", response.getOrDefault("collection", Map.of())))
                .onErrorResume(e -> Mono.just(Map.of("success", false, "error", e.getMessage())));
    }

    // ============================================================================
    // ENVIRONMENT MANAGEMENT
    // ============================================================================

    @SuppressWarnings("unchecked")
    public Mono<CreateEnvironmentResult> createEnvironmentInPostman(String environmentName,
                                                                   List<Map<String, Object>> variables,
                                                                   String workspaceId) {
        List<Map<String, Object>> values = (variables != null ? variables : List.<Map<String, Object>>of()).stream()
                .map(v -> Map.<String, Object>of(
                        "key", v.get("key"),
                        "value", String.valueOf(v.getOrDefault("value", "")),
                        "enabled", v.getOrDefault("enabled", true),
                        "type", v.getOrDefault("type", "default"),
                        "description", v.getOrDefault("description", "")
                ))
                .collect(Collectors.toList());
        Map<String, Object> body = Map.of("environment", Map.of("name", environmentName, "values", values));
        return webClient.post()
                .uri(uri -> uri.path("/environments").queryParam("workspace", workspaceId).build())
                .bodyValue(body)
                .retrieve()
                .bodyToMono(Map.class)
                .map(response -> {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> env = (Map<String, Object>) response.get("environment");
                    return new CreateEnvironmentResult(true, environmentName,
                            env != null ? (String) env.get("id") : null,
                            env != null ? (String) env.get("uid") : null, null);
                })
                .onErrorResume(e -> Mono.just(new CreateEnvironmentResult(false, environmentName, null, null, extractError(e))));
    }

    public Mono<List<Map<String, Object>>> getAllEnvironments(String workspaceId) {
        return webClient.get()
                .uri(uri -> uri.path("/environments").queryParam("workspace", workspaceId).build())
                .retrieve()
                .bodyToMono(Map.class)
                .map(response -> {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> environments = (List<Map<String, Object>>) response.get("environments");
                    return environments != null ? environments : List.of();
                })
                .onErrorResume(e -> Mono.just(List.of()));
    }

    public Mono<Map<String, Object>> getEnvironmentDetails(String environmentUid) {
        return webClient.get()
                .uri("/environments/{uid}", environmentUid)
                .retrieve()
                .bodyToMono(Map.class)
                .map(response -> (Map<String, Object>) response.get("environment"))
                .onErrorResume(e -> Mono.empty());
    }

    @SuppressWarnings("unchecked")
    public Mono<UpdateEnvironmentResult> updateEnvironment(String environmentUid, String name,
                                                          List<Map<String, Object>> variables) {
        List<Map<String, Object>> values = (variables != null ? variables : List.<Map<String, Object>>of()).stream()
                .map(v -> Map.<String, Object>of(
                        "key", v.get("key"),
                        "value", String.valueOf(v.getOrDefault("value", "")),
                        "enabled", v.getOrDefault("enabled", true),
                        "type", v.getOrDefault("type", "default")
                ))
                .collect(Collectors.toList());
        Map<String, Object> body = Map.of("environment", Map.of("name", name, "values", values));
        return webClient.put()
                .uri("/environments/{uid}", environmentUid)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(Map.class)
                .map(response -> new UpdateEnvironmentResult(true, (Map<String, Object>) response.get("environment"), null))
                .onErrorResume(e -> Mono.just(new UpdateEnvironmentResult(false, null, extractError(e))));
    }

    public Mono<Boolean> deleteEnvironment(String environmentId) {
        return webClient.delete()
                .uri("/environments/{id}", environmentId)
                .retrieve()
                .toBodilessEntity()
                .map(r -> true)
                .onErrorResume(e -> Mono.just(false));
    }

    // ============================================================================
    // MOCK SERVER MANAGEMENT
    // ============================================================================

    public Mono<List<Map<String, Object>>> getAllMocks(String workspaceId) {
        return webClient.get()
                .uri(uri -> uri.path("/mocks").queryParam("workspace", workspaceId).build())
                .retrieve()
                .bodyToMono(Map.class)
                .map(response -> {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> mocks = (List<Map<String, Object>>) response.get("mocks");
                    return mocks != null ? mocks : List.of();
                })
                .onErrorResume(e -> Mono.just(List.of()));
    }

    public Mono<Boolean> deleteMock(String mockId) {
        return webClient.delete()
                .uri("/mocks/{id}", mockId)
                .retrieve()
                .toBodilessEntity()
                .map(r -> true)
                .onErrorResume(e -> Mono.just(false));
    }

    public Mono<CreateMockResult> createMockServer(String mockName, String collectionUid, String workspaceId,
                                                   String environmentUid) {
        Map<String, Object> mock = new HashMap<>();
        mock.put("name", mockName);
        mock.put("collection", collectionUid);
        mock.put("environment", environmentUid);
        mock.put("private", false);
        return webClient.post()
                .uri(uri -> uri.path("/mocks").queryParam("workspace", workspaceId).build())
                .bodyValue(Map.of("mock", mock))
                .retrieve()
                .bodyToMono(Map.class)
                .map(response -> {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> m = (Map<String, Object>) response.get("mock");
                    return new CreateMockResult(true, mockName,
                            m != null ? (String) m.get("id") : null,
                            m != null ? (String) m.get("mockUrl") : null,
                            m != null ? (String) m.get("uid") : null, null);
                })
                .onErrorResume(e -> Mono.just(new CreateMockResult(false, mockName, null, null, null, extractError(e))));
    }

    // ============================================================================
    // RESET OPERATIONS
    // ============================================================================

    public Mono<ResetResult> resetWorkspace(String workspaceId, Consumer<Map<String, Object>> onProgress,
                                            ResetOptions options) {
        ResetOptions opts = options != null ? options : ResetOptions.defaults();
        List<String> errors = new ArrayList<>();
        int[] deletedSpecs = {0}, deletedMocks = {0}, deletedEnvs = {0}, deletedColls = {0};
        int[] totalSpecs = {0}, totalMocks = {0}, totalEnvs = {0}, totalColls = {0};

        Mono<ResetResult> chain = Mono.just(new ResetResult(0, 0, 0, 0, 0, 0, 0, 0, errors));

        if (opts.includeSpecs()) {
            chain = chain.flatMap(r -> getAllSpecs(workspaceId)
                    .flatMap(specs -> {
                        totalSpecs[0] = specs.size();
                        progress(onProgress, Map.of("phase", "specs", "message", "Deleting " + specs.size() + " spec(s)...", "deleted", 0, "total", specs.size()));
                        return Flux.fromIterable(specs)
                                .concatMap(spec -> deleteSpec((String) spec.get("id"))
                                        .doOnNext(ok -> { if (ok) deletedSpecs[0]++; else errors.add("Failed to delete spec: " + spec.get("name")); })
                                        .doOnNext(ok -> progress(onProgress, Map.of("phase", "specs", "deleted", deletedSpecs[0], "total", specs.size(), "currentItem", spec.get("name"))))
                                        .then(delay(300)))
                                .then(Mono.just(new ResetResult(deletedSpecs[0], r.deletedMocks(), r.deletedEnvironments(), r.deletedCollections(),
                                        totalSpecs[0], r.totalMocks(), r.totalEnvironments(), r.totalCollections(), errors)));
                    }));
        }

        if (opts.includeMocks()) {
            chain = chain.flatMap(r -> getAllMocks(workspaceId)
                    .flatMap(mocks -> {
                        totalMocks[0] = mocks.size();
                        progress(onProgress, Map.of("phase", "mocks", "message", "Deleting " + mocks.size() + " mock server(s)...", "deleted", 0, "total", mocks.size()));
                        return Flux.fromIterable(mocks)
                                .concatMap(mock -> deleteMock((String) mock.get("id"))
                                        .doOnNext(ok -> { if (ok) deletedMocks[0]++; else errors.add("Failed to delete mock: " + mock.get("name")); })
                                        .doOnNext(ok -> progress(onProgress, Map.of("phase", "mocks", "deleted", deletedMocks[0], "total", mocks.size(), "currentItem", mock.get("name"))))
                                        .then(delay(300)))
                                .then(Mono.just(new ResetResult(r.deletedSpecs(), deletedMocks[0], r.deletedEnvironments(), r.deletedCollections(),
                                        r.totalSpecs(), totalMocks[0], r.totalEnvironments(), r.totalCollections(), errors)));
                    }));
        }

        if (opts.includeEnvironments()) {
            chain = chain.flatMap(r -> getAllEnvironments(workspaceId)
                    .flatMap(envs -> {
                        totalEnvs[0] = envs.size();
                        progress(onProgress, Map.of("phase", "environments", "message", "Deleting " + envs.size() + " environment(s)...", "deleted", 0, "total", envs.size()));
                        return Flux.fromIterable(envs)
                                .concatMap(env -> deleteEnvironment((String) env.get("uid"))
                                        .doOnNext(ok -> { if (ok) deletedEnvs[0]++; else errors.add("Failed to delete environment: " + env.get("name")); })
                                        .doOnNext(ok -> progress(onProgress, Map.of("phase", "environments", "deleted", deletedEnvs[0], "total", envs.size(), "currentItem", env.get("name"))))
                                        .then(delay(300)))
                                .then(Mono.just(new ResetResult(r.deletedSpecs(), r.deletedMocks(), deletedEnvs[0], r.deletedCollections(),
                                        r.totalSpecs(), r.totalMocks(), totalEnvs[0], r.totalCollections(), errors)));
                    }));
        }

        if (opts.includeCollections()) {
            chain = chain.flatMap(r -> getAllCollections(workspaceId)
                    .flatMap(colls -> {
                        totalColls[0] = colls.size();
                        progress(onProgress, Map.of("phase", "collections", "message", "Deleting " + colls.size() + " collection(s)...", "deleted", 0, "total", colls.size()));
                        return Flux.fromIterable(colls)
                                .concatMap(coll -> deleteCollection((String) coll.get("uid"))
                                        .doOnNext(ok -> { if (ok) deletedColls[0]++; else errors.add("Failed to delete collection: " + coll.get("name")); })
                                        .doOnNext(ok -> progress(onProgress, Map.of("phase", "collections", "deleted", deletedColls[0], "total", colls.size(), "currentItem", coll.get("name"))))
                                        .then(delay(300)))
                                .then(Mono.just(new ResetResult(r.deletedSpecs(), r.deletedMocks(), r.deletedEnvironments(), deletedColls[0],
                                        r.totalSpecs(), r.totalMocks(), r.totalEnvironments(), totalColls[0], errors)));
                    }));
        }

        return chain
                .doOnNext(result -> progress(onProgress, Map.of("phase", "complete", "message", "Reset complete", "result", result)))
                .onErrorResume(e -> {
                    errors.add("Unexpected error: " + e.getMessage());
                    ResetResult errResult = new ResetResult(deletedSpecs[0], deletedMocks[0], deletedEnvs[0], deletedColls[0],
                            totalSpecs[0], totalMocks[0], totalEnvs[0], totalColls[0], errors);
                    progress(onProgress, Map.of("phase", "error", "message", e.getMessage(), "result", errResult));
                    return Mono.error(e);
                });
    }

    // ============================================================================
    // PROVISIONING OPERATIONS
    // ============================================================================

    public Mono<ProvisionResult> provisionWorkspace(ProvisionOptions options, Consumer<Map<String, Object>> onProgress) {
        if (postmanApiKey == null || postmanApiKey.isEmpty()) {
            return Mono.error(new IllegalStateException("Postman API key not configured"));
        }
        String sourceWorkspaceId = options.sourceWorkspaceId();
        if (sourceWorkspaceId == null || sourceWorkspaceId.isEmpty()) {
            return Mono.error(new IllegalStateException("Source workspace ID is required"));
        }

        Map<String, Object> results = new HashMap<>();
        results.put("workspace", null);
        results.put("workspaceCreated", false);
        Map<String, Object> collections = new HashMap<>();
        collections.put("total", 0);
        collections.put("success", 0);
        collections.put("failed", new ArrayList<>());
        collections.put("successData", new ArrayList<>());
        Map<String, Object> mocks = new HashMap<>();
        mocks.put("total", 0);
        mocks.put("success", 0);
        mocks.put("failed", new ArrayList<>());
        mocks.put("urls", new ArrayList<>());
        Map<String, Object> environments = new HashMap<>();
        environments.put("total", 0);
        environments.put("success", 0);
        environments.put("failed", new ArrayList<>());
        environments.put("successData", new ArrayList<>());
        Map<String, Object> mockEnv = new HashMap<>();
        mockEnv.put("success", false);
        mockEnv.put("action", null);
        Map<String, Object> specs = new HashMap<>();
        specs.put("total", 0);
        specs.put("success", 0);
        specs.put("failed", new ArrayList<>());
        specs.put("successData", new ArrayList<>());
        Map<String, Object> admins = new HashMap<>();
        admins.put("total", 0);
        admins.put("success", 0);
        admins.put("failed", new ArrayList<>());
        admins.put("successData", new ArrayList<>());
        Map<String, Object> invitations = new HashMap<>();
        invitations.put("total", 0);
        invitations.put("success", 0);
        invitations.put("failed", new ArrayList<>());
        invitations.put("links", new ArrayList<>());
        results.put("collections", collections);
        results.put("mocks", mocks);
        results.put("environments", environments);
        results.put("mockEnv", mockEnv);
        results.put("specs", specs);
        results.put("admins", admins);
        results.put("invitations", invitations);
        results.put("errors", new ArrayList<String>());

        progress(onProgress, Map.of("phase", "validation", "message", "Validating API key...", "progress", 5));

        return validateApiKey()
                .flatMap(validation -> {
                    if (!validation.valid()) {
                        return Mono.error(new IllegalStateException("Invalid API key: " + validation.error()));
                    }
                    return getWorkspace(sourceWorkspaceId);
                })
                .flatMap(sourceWorkspace -> {
                    if (sourceWorkspace == null) {
                        return Mono.error(new IllegalStateException("Source workspace not found: " + sourceWorkspaceId));
                    }
                    String targetWorkspaceId = options.targetWorkspaceId();
                    progress(onProgress, Map.of("phase", "workspace", "message", targetWorkspaceId != null ? "Using existing workspace..." : "Creating new workspace...", "progress", 10));

                    Mono<String> workspaceIdMono;
                    if (targetWorkspaceId != null && !targetWorkspaceId.isEmpty()) {
                        return getWorkspace(targetWorkspaceId)
                                .switchIfEmpty(Mono.error(new IllegalStateException("Target workspace not found: " + targetWorkspaceId)))
                                .flatMap(existing -> {
                                    results.put("workspace", existing);
                                    results.put("workspaceCreated", false);
                                    return doProvisionSteps(sourceWorkspaceId, targetWorkspaceId, options, onProgress, results);
                                });
                    } else {
                        if (options.workspaceName() == null || options.workspaceName().isEmpty()) {
                            return Mono.error(new IllegalStateException("Workspace name is required when creating a new workspace"));
                        }
                        return createWorkspace(options.workspaceName(), options.workspaceType(), "")
                                .flatMap(createResult -> {
                                    if (!createResult.success()) {
                                        return Mono.error(new IllegalStateException("Failed to create workspace: " + createResult.error()));
                                    }
                                    String newId = createResult.workspace().id();
                                    results.put("workspace", Map.of("id", createResult.workspace().id(), "name", createResult.workspace().name(), "type", createResult.workspace().type()));
                                    results.put("workspaceCreated", true);
                                    return doProvisionSteps(sourceWorkspaceId, newId, options, onProgress, results);
                                });
                    }
                })
                .doOnSuccess(r -> progress(onProgress, Map.of("phase", "complete", "message", "Provisioning complete!", "progress", 100, "results", r)))
                .onErrorResume(e -> {
                    @SuppressWarnings("unchecked")
                    List<String> errs = (List<String>) results.get("errors");
                    errs.add(e.getMessage());
                    progress(onProgress, Map.of("phase", "error", "message", "Error: " + e.getMessage(), "progress", 0, "results", results));
                    return Mono.error(e);
                });
    }

    private Mono<ProvisionResult> doProvisionSteps(String sourceWorkspaceId, String workspaceId,
                                                    ProvisionOptions options, Consumer<Map<String, Object>> onProgress,
                                                    Map<String, Object> results) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> collectionSuccess = (List<Map<String, Object>>) ((Map<?, ?>) results.get("collections")).get("successData");
        @SuppressWarnings("unchecked")
        Map<String, Object> collections = (Map<String, Object>) results.get("collections");
        @SuppressWarnings("unchecked")
        Map<String, Object> mocks = (Map<String, Object>) results.get("mocks");
        @SuppressWarnings("unchecked")
        Map<String, Object> environments = (Map<String, Object>) results.get("environments");
        @SuppressWarnings("unchecked")
        Map<String, Object> mockEnv = (Map<String, Object>) results.get("mockEnv");
        @SuppressWarnings("unchecked")
        Map<String, Object> specs = (Map<String, Object>) results.get("specs");
        @SuppressWarnings("unchecked")
        Map<String, Object> admins = (Map<String, Object>) results.get("admins");
        @SuppressWarnings("unchecked")
        Map<String, Object> invitations = (Map<String, Object>) results.get("invitations");
        @SuppressWarnings("unchecked")
        List<String> errors = (List<String>) results.get("errors");
        Map<String, String> mockEnvVarMap = new HashMap<>();

        progress(onProgress, Map.of("phase", "collections", "message", "Copying collections...", "progress", 20));

        return getAllCollections(sourceWorkspaceId)
                .flatMap(sourceCollections -> {
                    collections.put("total", sourceCollections.size());
                    Map<String, String> collectionMap = new HashMap<>();
                    return Flux.fromIterable(sourceCollections)
                            .index()
                            .concatMap(tuple -> {
                                int i = (int) tuple.getT1() + 1;
                                Map<String, Object> collection = tuple.getT2();
                                String name = (String) collection.get("name");
                                String uid = (String) collection.get("uid");
                                progress(onProgress, Map.of("phase", "collections", "message", "Forking: " + name,
                                        "current", i, "total", sourceCollections.size(),
                                        "progress", 20 + (int) ((double) i / sourceCollections.size() * 15)));
                                return forkCollection(uid, name, workspaceId)
                                        .flatMap(forkResult -> {
                                            if (forkResult.success()) {
                                                int succ = (int) collections.get("success") + 1;
                                                collections.put("success", succ);
                                                return getCollectionDetails(forkResult.uid())
                                                    .defaultIfEmpty(Map.of())
                                                    .flatMap(collDetails -> {
                                                        List<Map<String, Object>> hostVariables = collDetails.isEmpty()
                                                            ? List.of() : extractHostVariables(collDetails);
                                                        Map<String, Object> successEntry = new HashMap<>();
                                                        successEntry.put("name", forkResult.collectionName());
                                                        successEntry.put("uid", forkResult.uid());
                                                        successEntry.put("hostVariables", hostVariables);
                                                        successEntry.put("collectionDetails", collDetails);
                                                        collectionSuccess.add(successEntry);
                                                        collectionMap.put(uid, forkResult.uid());
                                                        return delay(300);
                                                    });
                                            } else {
                                                @SuppressWarnings("unchecked")
                                                List<Map<String, Object>> failed = (List<Map<String, Object>>) collections.get("failed");
                                                failed.add(Map.of("name", name, "error", forkResult.error()));
                                                errors.add("Failed to fork " + name + ": " + forkResult.error());
                                                return delay(300);
                                            }
                                        });
                            })
                            .then(Mono.defer(() -> {
                                progress(onProgress, Map.of("phase", "mocks", "message", "Creating mock servers...", "progress", 40));
                                mocks.put("total", collectionSuccess.size());
                                return Flux.fromIterable(collectionSuccess)
                                        .index()
                                        .concatMap(tuple -> {
                                            int i = (int) tuple.getT1() + 1;
                                            Map<String, Object> coll = tuple.getT2();
                                            String collName = (String) coll.get("name");
                                            String collUid = (String) coll.get("uid");
                                            String mockName = collName + " Mock";
                                            progress(onProgress, Map.of("phase", "mocks", "message", "Creating: " + mockName,
                                                    "current", i, "total", collectionSuccess.size(),
                                                    "progress", 40 + (int) ((double) i / collectionSuccess.size() * 15)));
                                            return createMockServer(mockName, collUid, workspaceId, null)
                                                    .flatMap(mockResult -> {
                                                        if (mockResult.success()) {
                                                            mocks.put("success", (int) mocks.get("success") + 1);
                                                            @SuppressWarnings("unchecked")
                                                            List<Map<String, Object>> urls = (List<Map<String, Object>>) mocks.get("urls");
                                                            @SuppressWarnings("unchecked")
                                                            List<Map<String, Object>> hostVars = (List<Map<String, Object>>) coll.getOrDefault("hostVariables", List.of());
                                                            Map<String, Object> urlEntry = new HashMap<>();
                                                            urlEntry.put("collectionName", collName);
                                                            urlEntry.put("mockName", mockResult.mockName());
                                                            urlEntry.put("mockUrl", mockResult.mockUrl());
                                                            urlEntry.put("targetUid", collUid);
                                                            urlEntry.put("hostVariables", hostVars);
                                                            urls.add(urlEntry);
                                                        } else {
                                                            @SuppressWarnings("unchecked")
                                                            List<Map<String, Object>> mFailed = (List<Map<String, Object>>) mocks.get("failed");
                                                            mFailed.add(Map.of("name", mockName, "error", mockResult.error()));
                                                            errors.add("Failed to create mock " + mockName + ": " + mockResult.error());
                                                        }
                                                        return delay(300);
                                                    });
                                        })
                                        .then();
                            }));
                })
                .then(Mono.defer(() -> {
                    progress(onProgress, Map.of("phase", "environments", "message", "Copying environments...", "progress", 60));
                    return getAllEnvironments(sourceWorkspaceId)
                            .flatMap(sourceEnvs -> {
                                environments.put("total", sourceEnvs.size());
                                Map<String, Map<String, Object>> envMap = new HashMap<>();
                                return Flux.fromIterable(sourceEnvs)
                                        .index()
                                        .concatMap(tuple -> {
                                            int i = (int) tuple.getT1() + 1;
                                            Map<String, Object> env = tuple.getT2();
                                            String uid = (String) env.get("uid");
                                            String name = (String) env.get("name");
                                            progress(onProgress, Map.of("phase", "environments", "message", "Copying: " + name,
                                                    "current", i, "total", sourceEnvs.size(),
                                                    "progress", 60 + (int) ((double) i / sourceEnvs.size() * 10)));
                                            return getEnvironmentDetails(uid)
                                                    .flatMap(envDetails -> {
                                                        if (envDetails == null) {
                                                            @SuppressWarnings("unchecked")
                                                            List<Map<String, Object>> eFailed = (List<Map<String, Object>>) environments.get("failed");
                                                            eFailed.add(Map.of("name", name, "error", "Could not get environment details"));
                                                            return delay(300);
                                                        }
                                                        @SuppressWarnings("unchecked")
                                                        List<Map<String, Object>> values = (List<Map<String, Object>>) envDetails.get("values");
                                                        return createEnvironmentInPostman((String) envDetails.get("name"), values != null ? values : List.of(), workspaceId)
                                                                .flatMap(cr -> {
                                                                    if (cr.success()) {
                                                                        environments.put("success", (int) environments.get("success") + 1);
                                                                        @SuppressWarnings("unchecked")
                                                                        List<Map<String, Object>> eSuccess = (List<Map<String, Object>>) environments.get("successData");
                                                                        eSuccess.add(Map.of("name", cr.environmentName(), "uid", cr.uid()));
                                                                        envMap.put(uid, Map.of("targetUid", cr.uid(), "name", (String) envDetails.get("name")));
                                                                    } else {
                                                                        @SuppressWarnings("unchecked")
                                                                        List<Map<String, Object>> eFailed = (List<Map<String, Object>>) environments.get("failed");
                                                                        eFailed.add(Map.of("name", (String) envDetails.get("name"), "error", cr.error()));
                                                                        errors.add("Failed to copy " + envDetails.get("name") + ": " + cr.error());
                                                                    }
                                                                    return delay(300);
                                                                });
                                                    })
                                                    .switchIfEmpty(Mono.defer(() -> {
                                                        @SuppressWarnings("unchecked")
                                                        List<Map<String, Object>> eFailed = (List<Map<String, Object>>) environments.get("failed");
                                                        eFailed.add(Map.of("name", name, "error", "Could not get environment details"));
                                                        return delay(300);
                                                    }));
                                        })
                                        .then(Mono.defer(() -> {
                                            @SuppressWarnings("unchecked")
                                            List<Map<String, Object>> mockUrls = (List<Map<String, Object>>) mocks.get("urls");
                                            if (!mockUrls.isEmpty()) {
                                                progress(onProgress, Map.of("phase", "mockEnv", "message", "Updating Mock Environment...", "progress", 75));
                                                List<Map<String, Object>> mockVars = new ArrayList<>();
                                                for (Map<String, Object> mock : mockUrls) {
                                                    @SuppressWarnings("unchecked")
                                                    List<Map<String, Object>> hostVars = (List<Map<String, Object>>) mock.getOrDefault("hostVariables", List.of());
                                                    if (hostVars.isEmpty()) {
                                                        String varName = toCamelCase((String) mock.get("collectionName")) + "BaseUrl";
                                                        mockVars.add(Map.of("key", varName, "value", mock.get("mockUrl"),
                                                                "type", "default", "enabled", true));
                                                        mockEnvVarMap.put(mock.get("targetUid") + ":__fallback__", varName);
                                                    } else {
                                                        for (Map<String, Object> hv : hostVars) {
                                                            String envVarName = toCamelCase((String) mock.get("collectionName"))
                                                                    + toPascalCase((String) hv.get("varName"));
                                                            mockVars.add(Map.of("key", envVarName, "value", mock.get("mockUrl"),
                                                                    "type", "default", "enabled", true));
                                                            mockEnvVarMap.put(mock.get("targetUid") + ":" + hv.get("varName"), envVarName);
                                                        }
                                                    }
                                                }
                                                return createEnvironmentInPostman("Mock Env", mockVars, workspaceId)
                                                        .doOnNext(cr -> { mockEnv.put("success", cr.success()); mockEnv.put("action", "created"); })
                                                        .then();
                                            }
                                            return Mono.empty();
                                        }));
                            });
                }))
                .then(Mono.defer(() -> {
                    if (mockEnvVarMap.isEmpty()) {
                        return Mono.empty();
                    }
                    progress(onProgress, Map.of("phase", "collectionVars", "message", "Updating collection variables...", "progress", 78));
                    return Flux.fromIterable(collectionSuccess)
                            .concatMap(coll -> {
                                @SuppressWarnings("unchecked")
                                List<Map<String, Object>> hvList = (List<Map<String, Object>>) coll.getOrDefault("hostVariables", List.of());
                                @SuppressWarnings("unchecked")
                                Map<String, Object> collDetails = (Map<String, Object>) coll.get("collectionDetails");
                                if (collDetails == null || collDetails.isEmpty()) return Mono.empty();
                                @SuppressWarnings("unchecked")
                                List<Map<String, Object>> existingVars = (List<Map<String, Object>>) collDetails.getOrDefault("variable", List.of());
                                if (!hvList.isEmpty()) {
                                    Set<String> matchedKeys = new HashSet<>();
                                    List<Map<String, Object>> updatedVars = existingVars.stream().map(v -> {
                                        String key = (String) v.get("key");
                                        for (Map<String, Object> hv : hvList) {
                                            if (hv.get("varName").equals(key)) {
                                                String envName = mockEnvVarMap.get(coll.get("uid") + ":" + hv.get("varName"));
                                                if (envName != null) {
                                                    matchedKeys.add(key);
                                                    Map<String, Object> updated = new HashMap<>(v);
                                                    updated.put("value", "{{" + envName + "}}");
                                                    return updated;
                                                }
                                            }
                                        }
                                        return v;
                                    }).collect(Collectors.toList());
                                    for (Map<String, Object> hv : hvList) {
                                        String varName = (String) hv.get("varName");
                                        String envName = mockEnvVarMap.get(coll.get("uid") + ":" + varName);
                                        if (envName != null && !matchedKeys.contains(varName)) {
                                            updatedVars.add(Map.of("key", varName, "value", "{{" + envName + "}}", "type", "string"));
                                        }
                                    }
                                    return patchCollectionVariables((String) coll.get("uid"), updatedVars)
                                            .then(delay(300));
                                }
                                String fallbackEnv = mockEnvVarMap.get(coll.get("uid") + ":__fallback__");
                                if (fallbackEnv == null) return Mono.empty();
                                boolean[] matched = { false };
                                List<Map<String, Object>> updatedVars = existingVars.stream().map(v -> {
                                    String key = String.valueOf(v.get("key"));
                                    if (!matched[0] && COMMON_HOST_VAR_NAMES.contains(key)) {
                                        matched[0] = true;
                                        Map<String, Object> updated = new HashMap<>(v);
                                        updated.put("value", "{{" + fallbackEnv + "}}");
                                        return updated;
                                    }
                                    return v;
                                }).collect(Collectors.toList());
                                if (!matched[0]) {
                                    updatedVars.add(Map.of("key", "baseUrl", "value", "{{" + fallbackEnv + "}}", "type", "string"));
                                }
                                return patchCollectionVariables((String) coll.get("uid"), updatedVars)
                                        .then(delay(300));
                            })
                            .then();
                }))
                .then(Mono.defer(() -> {
                    progress(onProgress, Map.of("phase", "specs", "message", "Copying specs...", "progress", 80));
                    return getAllSpecs(sourceWorkspaceId)
                            .flatMap(sourceSpecs -> {
                                specs.put("total", sourceSpecs.size());
                                if (sourceSpecs.isEmpty()) return Mono.empty();
                                return Flux.fromIterable(sourceSpecs)
                                        .index()
                                        .concatMap(tuple -> {
                                            int i = (int) tuple.getT1() + 1;
                                            Map<String, Object> spec = tuple.getT2();
                                            String name = (String) spec.get("name");
                                            String type = (String) spec.get("type");
                                            String id = (String) spec.get("id");
                                            progress(onProgress, Map.of("phase", "specs", "message", "Copying: " + name,
                                                    "current", i, "total", sourceSpecs.size(),
                                                    "progress", 80 + (int) ((double) i / sourceSpecs.size() * 15)));
                                            return copySpec(id, name, type, workspaceId, null)
                                                    .flatMap(cr -> {
                                                        if (cr.success()) {
                                                            specs.put("success", (int) specs.get("success") + 1);
                                                            ((List<Map<String, Object>>) specs.get("successData"))
                                                                    .add(Map.of("name", cr.specName(), "id", cr.newSpecId(), "filesCopied", cr.filesCopied()));
                                                        } else {
                                                            ((List<Map<String, Object>>) specs.get("failed"))
                                                                    .add(Map.of("name", name, "error", String.join("; ", cr.errors())));
                                                            errors.add("Failed to copy spec " + name);
                                                        }
                                                        return delay(500);
                                                    });
                                        })
                                        .then();
                            });
                }))
                .then(Mono.defer(() -> {
                    List<String> adminUserIds = options.adminUserIds();
                    if (adminUserIds != null && !adminUserIds.isEmpty()) {
                        progress(onProgress, Map.of("phase", "admins", "message", "Adding workspace admins...", "progress", 88));
                        admins.put("total", adminUserIds.size());
                        return Flux.fromIterable(adminUserIds)
                                .index()
                                .concatMap(tuple -> {
                                    int i = (int) tuple.getT1() + 1;
                                    String userId = tuple.getT2();
                                    progress(onProgress, Map.of("phase", "admins", "message", "Adding admin: " + userId,
                                            "current", i, "total", adminUserIds.size(),
                                            "progress", 88 + (int) ((double) i / adminUserIds.size() * 5)));
                                    return addWorkspaceAdmin(workspaceId, userId, "3")
                                            .flatMap(ar -> {
                                                if (ar.success()) {
                                                    admins.put("success", (int) admins.get("success") + 1);
                                                    ((List<Map<String, Object>>) admins.get("successData")).add(Map.of("userId", userId, "roleId", "3"));
                                                } else {
                                                    ((List<Map<String, Object>>) admins.get("failed")).add(Map.of("userId", userId, "error", ar.error()));
                                                    errors.add("Failed to add admin " + userId + ": " + ar.error());
                                                }
                                                return delay(300);
                                            });
                                })
                                .then();
                    }
                    return Mono.empty();
                }))
                .then(Mono.defer(() -> {
                    List<String> partnerEmails = options.partnerEmails();
                    if (partnerEmails != null && !partnerEmails.isEmpty()) {
                        progress(onProgress, Map.of("phase", "invitations", "message", "Inviting partners...", "progress", 93));
                        invitations.put("total", partnerEmails.size());
                        return Flux.fromIterable(partnerEmails)
                                .index()
                                .concatMap(tuple -> {
                                    int i = (int) tuple.getT1() + 1;
                                    String email = tuple.getT2();
                                    progress(onProgress, Map.of("phase", "invitations", "message", "Inviting partner: " + email,
                                            "current", i, "total", partnerEmails.size(),
                                            "progress", 93 + (int) ((double) i / partnerEmails.size() * 6)));
                                    return invitePartner(workspaceId, email, options.partnerRoleId())
                                            .flatMap(ir -> {
                                                if (ir.success()) {
                                                    invitations.put("success", (int) invitations.get("success") + 1);
                                                    if (ir.invitationLink() != null) {
                                                        ((List<Map<String, Object>>) invitations.get("links"))
                                                                .add(Map.of("email", ir.email(), "invitationLink", ir.invitationLink(), "status", ir.status()));
                                                    }
                                                } else {
                                                    ((List<Map<String, Object>>) invitations.get("failed")).add(Map.of("email", email, "error", ir.error()));
                                                    errors.add("Failed to invite partner " + email + ": " + ir.error());
                                                }
                                                return delay(300);
                                            });
                                })
                                .then();
                    }
                    return Mono.empty();
                }))
                .then(Mono.defer(() -> buildProvisionResult(results)));
    }

    private Mono<ProvisionResult> buildProvisionResult(Map<String, Object> results) {
        return Mono.just(new ProvisionResult(
                (Map<String, Object>) results.get("workspace"),
                (Boolean) results.get("workspaceCreated"),
                (Map<String, Object>) results.get("collections"),
                (Map<String, Object>) results.get("mocks"),
                (Map<String, Object>) results.get("environments"),
                (Map<String, Object>) results.get("mockEnv"),
                (Map<String, Object>) results.get("specs"),
                (Map<String, Object>) results.get("admins"),
                (Map<String, Object>) results.get("invitations"),
                (List<String>) results.get("errors")
        ));
    }

    public Mono<ProvisionResult> quickProvision(String sourceWorkspaceId, String workspaceName,
                                                Map<String, Object> options, Consumer<Map<String, Object>> onProgress) {
        String workspaceType = options != null && options.get("workspaceType") != null ? options.get("workspaceType").toString() : "partner";
        @SuppressWarnings("unchecked")
        List<String> adminIds = options != null && options.get("adminUserIds") instanceof List ? (List<String>) options.get("adminUserIds") : List.of();
        @SuppressWarnings("unchecked")
        List<String> partnerEmails = options != null && options.get("partnerEmails") instanceof List ? (List<String>) options.get("partnerEmails") : List.of();
        String partnerRole = options != null && options.get("partnerRoleId") != null ? options.get("partnerRoleId").toString() : "7";
        ProvisionOptions opts = ProvisionOptions.of(sourceWorkspaceId, null, workspaceName, workspaceType, adminIds, partnerEmails, partnerRole);
        return provisionWorkspace(opts, onProgress);
    }

    // ============================================================================
    // CONFIGURATION & UTILITIES
    // ============================================================================

    public Mono<Boolean> isPostmanConfigured() {
        return Mono.just(postmanApiKey != null && !postmanApiKey.isEmpty()
                && postmanSourceWorkspaceId != null && !postmanSourceWorkspaceId.isEmpty());
    }

    public Mono<Boolean> isPostmanFullyConfigured() {
        return Mono.just(postmanApiKey != null && !postmanApiKey.isEmpty()
                && postmanTargetWorkspaceId != null && !postmanTargetWorkspaceId.isEmpty()
                && postmanSourceWorkspaceId != null && !postmanSourceWorkspaceId.isEmpty());
    }

    public Mono<ConfigurationStatus> getConfigurationStatus() {
        boolean hasApiKey = postmanApiKey != null && !postmanApiKey.isEmpty();
        boolean hasTarget = postmanTargetWorkspaceId != null && !postmanTargetWorkspaceId.isEmpty();
        boolean hasSource = postmanSourceWorkspaceId != null && !postmanSourceWorkspaceId.isEmpty();
        boolean configured = hasApiKey && hasSource;
        boolean fullyConfigured = hasApiKey && hasTarget && hasSource;
        String message = !hasApiKey ? "Missing API key (POSTMAN_API_KEY)"
                : !hasSource ? "Missing source workspace ID (POSTMAN_SOURCE_WORKSPACE_ID)"
                : !hasTarget ? "Target workspace ID not set — will create new workspace"
                : "Fully configured";
        return Mono.just(new ConfigurationStatus(hasApiKey, hasTarget, hasSource, configured, fullyConfigured, message));
    }

    public Mono<ValidateApiKeyResult> validateApiKey() {
        return webClient.get()
                .uri("/me")
                .retrieve()
                .bodyToMono(Map.class)
                .map(response -> new ValidateApiKeyResult(true, (Map<String, Object>) response.get("user"), null))
                .onErrorResume(e -> Mono.just(new ValidateApiKeyResult(false, null, extractError(e))));
    }

    public Mono<WorkspaceSummaryResult> getWorkspaceSummary(String workspaceId) {
        return Mono.zip(
                getAllCollections(workspaceId),
                getAllEnvironments(workspaceId),
                getAllMocks(workspaceId),
                getAllSpecs(workspaceId)
        ).map(tuple -> {
            List<Map<String, Object>> collections = tuple.getT1();
            List<Map<String, Object>> environments = tuple.getT2();
            List<Map<String, Object>> mocks = tuple.getT3();
            List<Map<String, Object>> apis = tuple.getT4();
            Map<String, Integer> counts = Map.of(
                    "collections", collections.size(),
                    "environments", environments.size(),
                    "mocks", mocks.size(),
                    "apis", apis.size()
            );
            Map<String, List<Map<String, Object>>> items = Map.of(
                    "collections", collections.stream().map(c -> Map.<String, Object>of("id", c.get("id"), "uid", c.get("uid"), "name", c.get("name"))).collect(Collectors.toList()),
                    "environments", environments.stream().map(e -> Map.<String, Object>of("id", e.get("id"), "uid", e.get("uid"), "name", e.get("name"))).collect(Collectors.toList()),
                    "mocks", mocks.stream().map(m -> Map.<String, Object>of("id", m.get("id"), "uid", m.get("uid"), "name", m.get("name"))).collect(Collectors.toList()),
                    "apis", apis.stream().map(a -> Map.<String, Object>of("id", a.get("id"), "name", a.get("name"))).collect(Collectors.toList())
            );
            return new WorkspaceSummaryResult(workspaceId, counts, items);
        });
    }

    // ============================================================================
    // CUSTOM PROVISIONING & RESET
    // ============================================================================

    public Mono<List<Map<String, Object>>> getAvailableCollections(String workspaceId) {
        return getAllCollections(workspaceId)
                .map(collections -> collections.stream()
                        .map(c -> {
                            Map<String, Object> m = new HashMap<>();
                            m.put("id", c.get("id"));
                            m.put("uid", c.get("uid"));
                            m.put("name", c.get("name"));
                            m.put("selected", false);
                            m.put("metadata", Map.of("createdAt", c.getOrDefault("createdAt", ""), "updatedAt", c.getOrDefault("updatedAt", "")));
                            return m;
                        })
                        .collect(Collectors.toList()))
                .onErrorResume(e -> Mono.just(List.of()));
    }

    public Mono<Map<String, List<Map<String, Object>>>> getAvailableResources(String workspaceId) {
        return Mono.zip(
                getAllCollections(workspaceId),
                getAllEnvironments(workspaceId),
                getAllMocks(workspaceId),
                getAllSpecs(workspaceId)
        ).map(tuple -> {
            List<Map<String, Object>> collections = tuple.getT1().stream()
                    .map(c -> Map.<String, Object>of("id", c.get("id"), "uid", c.get("uid"), "name", c.get("name"), "selected", false))
                    .collect(Collectors.toList());
            List<Map<String, Object>> environments = tuple.getT2().stream()
                    .map(e -> Map.<String, Object>of("id", e.get("id"), "uid", e.get("uid"), "name", e.get("name"), "selected", false))
                    .collect(Collectors.toList());
            List<Map<String, Object>> mocks = tuple.getT3().stream()
                    .map(m -> Map.<String, Object>of("id", m.get("id"), "uid", m.get("uid"), "name", m.get("name"), "selected", false, "collectionUid", m.get("collection")))
                    .collect(Collectors.toList());
            List<Map<String, Object>> specs = tuple.getT4().stream()
                    .map(s -> Map.<String, Object>of("id", s.get("id"), "name", s.get("name"), "type", s.get("type"), "selected", false))
                    .collect(Collectors.toList());
            return Map.<String, List<Map<String, Object>>>of("collections", collections, "environments", environments, "mocks", mocks, "specs", specs);
        })
        .onErrorResume(e -> Mono.just(Map.of("collections", List.<Map<String, Object>>of(), "environments", List.of(), "mocks", List.of(), "specs", List.of())));
    }

    public Mono<ProvisionResult> provisionCustomWorkspace(CustomProvisionOptions options, Consumer<Map<String, Object>> onProgress) {
        return provisionWorkspace(ProvisionOptions.of(
                options.sourceWorkspaceId(),
                options.targetWorkspaceId(),
                options.workspaceName(),
                options.workspaceType(),
                options.adminUserIds(),
                options.partnerEmails(),
                options.partnerRoleId()
        ), onProgress);
    }

    public Mono<ResetResult> resetCustomWorkspace(String workspaceId, Consumer<Map<String, Object>> onProgress,
                                                  CustomResetOptions options) {
        ResetOptions opts = options != null ? new ResetOptions(
                options.includeSpecs(), options.includeMocks(), options.includeEnvironments(), options.includeCollections()
        ) : ResetOptions.defaults();
        return resetWorkspace(workspaceId, onProgress, opts);
    }

    public Mono<String> getApiKey() {
        return Mono.justOrEmpty(postmanApiKey);
    }

    public Mono<List<String>> parseCommaSeparated(String str) {
        return Mono.just(Arrays.stream((str != null ? str : "").split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList()));
    }

    public Mono<List<String>> formatCollectionsForUI(List<Map<String, Object>> collections) {
        return Mono.just((collections != null ? collections : List.<Map<String, Object>>of()).stream()
                .map(c -> c.get("name") + " (" + c.get("uid") + ")")
                .collect(Collectors.toList()));
    }

    public Mono<List<String>> formatEnvironmentsForUI(List<Map<String, Object>> environments) {
        return Mono.just((environments != null ? environments : List.<Map<String, Object>>of()).stream()
                .map(e -> e.get("name") + " (" + e.get("uid") + ")")
                .collect(Collectors.toList()));
    }

    public Mono<List<String>> formatMocksForUI(List<Map<String, Object>> mocks) {
        return Mono.just((mocks != null ? mocks : List.<Map<String, Object>>of()).stream()
                .map(m -> m.get("name") + " (" + m.get("uid") + ")")
                .collect(Collectors.toList()));
    }

    public Mono<List<String>> formatSpecsForUI(List<Map<String, Object>> specs) {
        return Mono.just((specs != null ? specs : List.<Map<String, Object>>of()).stream()
                .map(s -> s.get("name") + " (" + s.get("id") + ")")
                .collect(Collectors.toList()));
    }

    public Mono<Map<String, List<String>>> formatResourcesForUI(Map<String, List<Map<String, Object>>> resources) {
        return Mono.zip(
                formatCollectionsForUI(resources != null ? resources.get("collections") : List.of()),
                formatEnvironmentsForUI(resources != null ? resources.get("environments") : List.of()),
                formatMocksForUI(resources != null ? resources.get("mocks") : List.of()),
                formatSpecsForUI(resources != null ? resources.get("specs") : List.of())
        ).map(tuple -> Map.of(
                "collections", tuple.getT1(),
                "environments", tuple.getT2(),
                "mocks", tuple.getT3(),
                "specs", tuple.getT4()
        ));
    }
}
