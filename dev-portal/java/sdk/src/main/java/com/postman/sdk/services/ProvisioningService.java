package com.postman.sdk.services;

import com.postman.sdk.client.PostmanClient;
import com.postman.sdk.types.*;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.time.Duration;
import java.util.*;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Service for workspace provisioning workflow
 */
@Service
public class ProvisioningService {

    private static final List<String> COMMON_HOST_VAR_NAMES = List.of(
            "baseUrl", "baseurl", "base_url", "HostName", "hostname", "host",
            "apiUrl", "apiurl", "api_url", "serverUrl", "serverurl", "server_url"
    );

    private final PostmanClient client;
    private final SpecService specService;

    public ProvisioningService(PostmanClient client, SpecService specService) {
        this.client = client;
        this.specService = specService;
    }

    /**
     * Run full provisioning workflow
     */
    public Mono<ProvisioningResult> provision(ProvisioningConfig config) {
        ProvisioningContext ctx = new ProvisioningContext(config);

        return initializeWorkspace(ctx)
            .flatMap(workspace -> {
                ctx.result.workspace = workspace;
                ctx.result.workspaceCreated = config.targetWorkspaceId() == null;
                ctx.targetWorkspaceId = workspace.id();

                return copyCollections(ctx);
            })
            .flatMap(v -> createMocks(ctx))
            .flatMap(v -> copyEnvironments(ctx))
            .flatMap(v -> updateMockEnvironment(ctx))
            .flatMap(v -> updateCollectionVariables(ctx))
            .flatMap(v -> copySpecs(ctx))
            .flatMap(v -> addAdmins(ctx))
            .flatMap(v -> invitePartners(ctx))
            .map(v -> ctx.result);
    }

    private Mono<Workspace> initializeWorkspace(ProvisioningContext ctx) {
        if (ctx.config.targetWorkspaceId() != null) {
            return client.getWorkspace(ctx.config.targetWorkspaceId())
                .switchIfEmpty(Mono.error(new RuntimeException("Target workspace not found")));
        }

        return client.createWorkspace(
            ctx.config.targetWorkspaceName() != null ? ctx.config.targetWorkspaceName() : "Partner Workspace",
            Workspace.WorkspaceType.partner,
            null
        ).flatMap(result -> {
            if (result.success()) {
                return Mono.just(result.data());
            }
            return Mono.error(new RuntimeException("Failed to create workspace: " + result.error()));
        });
    }

    private Mono<Void> copyCollections(ProvisioningContext ctx) {
        ctx.emitProgress("collections", "Copying collections...");
        
        return client.getCollections(ctx.config.sourceWorkspaceId())
            .flatMap(collections -> {
                ctx.result.collections.total = collections.size();
                
                return Flux.fromIterable(collections)
                    .delayElements(Duration.ofMillis(500))
                    .flatMap(collection -> client.forkCollection(collection.uid(), collection.name(), ctx.targetWorkspaceId)
                        .flatMap(result -> {
                            if (result.success()) {
                                String targetUid = result.data().uid();
                                CollectionMapping mapping = new CollectionMapping(collection.uid(), targetUid, collection.name());
                                ctx.collectionMappings.put(collection.uid(), mapping);
                                ctx.result.collections.success++;

                                return client.getCollectionDetails(targetUid)
                                    .map(details -> {
                                        if (details != null) {
                                            ctx.collectionDetails.put(targetUid, details);
                                            List<Map<String, String>> hostVars = extractHostVariables(details);
                                            ctx.collectionHostVars.put(targetUid, hostVars);
                                        }
                                        return result;
                                    })
                                    .onErrorResume(e -> Mono.just(result));
                            } else {
                                ctx.result.collections.failed.add(Map.of("name", collection.name(), "error", result.error()));
                                return Mono.just(result);
                            }
                        }))
                    .then();
            });
    }

    private Mono<Void> createMocks(ProvisioningContext ctx) {
        ctx.emitProgress("mocks", "Creating mock servers...");
        ctx.result.mocks.total = ctx.collectionMappings.size();

        return Flux.fromIterable(ctx.collectionMappings.values())
            .delayElements(Duration.ofMillis(500))
            .flatMap(mapping -> {
                String mockName = mapping.name() + " Mock";
                return client.createMock(mockName, mapping.targetUid(), ctx.targetWorkspaceId, false)
                    .map(result -> {
                        if (result.success()) {
                            MockMapping mockMapping = new MockMapping(
                                result.data().id(),
                                result.data().mockUrl(),
                                mockName,
                                mapping.name(),
                                mapping.targetUid()
                            );
                            ctx.mockMappings.put(mapping.targetUid(), mockMapping);
                            ctx.result.mocks.success++;
                        } else {
                            ctx.result.mocks.failed.add(Map.of("name", mockName, "error", result.error()));
                        }
                        return result;
                    });
            })
            .then();
    }

    private Mono<Void> copyEnvironments(ProvisioningContext ctx) {
        ctx.emitProgress("environments", "Copying environments...");

        return client.getEnvironments(ctx.config.sourceWorkspaceId())
            .flatMap(environments -> {
                ctx.result.environments.total = environments.size();

                return Flux.fromIterable(environments)
                    .delayElements(Duration.ofMillis(300))
                    .flatMap(env -> client.getEnvironmentDetails(env.uid())
                        .flatMap(details -> {
                            if (details == null) {
                                ctx.result.environments.failed.add(Map.of("name", env.name(), "error", "Could not get details"));
                                return Mono.empty();
                            }

                            return client.createEnvironment(details.name(), details.values() != null ? details.values() : List.of(), ctx.targetWorkspaceId)
                                .map(result -> {
                                    if (result.success()) {
                                        EnvironmentMapping mapping = new EnvironmentMapping(env.uid(), result.data().uid(), details.name());
                                        ctx.environmentMappings.put(env.uid(), mapping);
                                        ctx.result.environments.success++;
                                    } else {
                                        ctx.result.environments.failed.add(Map.of("name", details.name(), "error", result.error()));
                                    }
                                    return result;
                                });
                        }))
                    .then();
            });
    }

    private Mono<Void> updateMockEnvironment(ProvisioningContext ctx) {
        ctx.emitProgress("mockEnv", "Updating mock environment...");
        
        MockUrlGenerationResult genResult = generateMockUrlVariables(ctx);
        List<Environment.EnvironmentVariable> mockUrlVars = genResult.variables();
        ctx.mockEnvVarMap = genResult.mockEnvVarMap();

        if (mockUrlVars.isEmpty()) {
            return Mono.empty();
        }

        return client.createEnvironment("Mock Env", mockUrlVars, ctx.targetWorkspaceId).then();
    }

    private record MockUrlGenerationResult(
        List<Environment.EnvironmentVariable> variables,
        Map<String, String> mockEnvVarMap
    ) {}

    private MockUrlGenerationResult generateMockUrlVariables(ProvisioningContext ctx) {
        List<Environment.EnvironmentVariable> variables = new ArrayList<>();
        Map<String, String> mockEnvVarMap = new HashMap<>();
        
        for (MockMapping mock : ctx.mockMappings.values()) {
            String collectionUid = mock.collectionUid();
            String collectionCamel = toCamelCase(mock.collectionName());
            List<Map<String, String>> hostVars = ctx.collectionHostVars.getOrDefault(collectionUid, List.of());
            
            if (hostVars.isEmpty()) {
                String varName = collectionCamel + "BaseUrl";
                variables.add(new Environment.EnvironmentVariable(varName, mock.mockUrl(), "default", true));
                mockEnvVarMap.put(collectionUid + ":__fallback__", varName);
            } else {
                for (Map<String, String> hostVar : hostVars) {
                    String originalVarName = hostVar.get("varName");
                    String envVarName = collectionCamel + toPascalCase(originalVarName);

                    variables.add(new Environment.EnvironmentVariable(envVarName, mock.mockUrl(), "default", true));
                    mockEnvVarMap.put(collectionUid + ":" + originalVarName, envVarName);
                }
            }
        }

        return new MockUrlGenerationResult(variables, mockEnvVarMap);
    }

    private String toCamelCase(String name) {
        String clean = name.replaceAll("[^a-zA-Z0-9\\s]", "");
        String[] words = clean.trim().split("\\s+");
        StringBuilder result = new StringBuilder();
        for (int i = 0; i < words.length; i++) {
            if (i == 0) {
                result.append(words[i].toLowerCase());
            } else {
                result.append(Character.toUpperCase(words[i].charAt(0)))
                      .append(words[i].substring(1).toLowerCase());
            }
        }
        return result.toString();
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

    private String extractUrlPath(String urlString) {
        try {
            URI uri = new URI(urlString);
            String path = uri.getPath();
            return (path == null || path.equals("/")) ? "" : path;
        } catch (Exception e) {
            return "";
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, String>> extractHostVariables(Map<String, Object> collection) {
        Set<String> hostVarNames = new HashSet<>();
        List<Map<String, Object>> items = (List<Map<String, Object>>) collection.getOrDefault("item", List.of());
        traverseItems(items, hostVarNames);

        List<Map<String, Object>> collectionVars = (List<Map<String, Object>>) collection.getOrDefault("variable", List.of());
        List<Map<String, String>> result = new ArrayList<>();
        if (!hostVarNames.isEmpty()) {
            for (String varName : hostVarNames) {
                Map<String, Object> varDef = collectionVars.stream()
                    .filter(v -> varName.equals(v.get("key")))
                    .findFirst().orElse(null);
                String originalUrl = varDef != null ? String.valueOf(varDef.getOrDefault("value", "")) : "";
                String path = originalUrl.contains("://") ? extractUrlPath(originalUrl) : "";
                result.add(Map.of("varName", varName, "originalUrl", originalUrl, "path", path));
            }
        } else {
            for (Map<String, Object> varDef : collectionVars) {
                String key = String.valueOf(varDef.getOrDefault("key", ""));
                if (matchesCommonHostVarName(key)) {
                    String originalUrl = String.valueOf(varDef.getOrDefault("value", ""));
                    String path = originalUrl.contains("://") ? extractUrlPath(originalUrl) : "";
                    result.add(Map.of("varName", key, "originalUrl", originalUrl, "path", path));
                }
            }
        }
        return result;
    }

    private static boolean matchesCommonHostVarName(String key) {
        for (String name : COMMON_HOST_VAR_NAMES) {
            if (name.equalsIgnoreCase(key)) {
                return true;
            }
        }
        return false;
    }

    @SuppressWarnings("unchecked")
    private void traverseItems(List<Map<String, Object>> items, Set<String> hostVarNames) {
        Pattern pattern = Pattern.compile("^\\{\\{(.+)\\}\\}$");
        for (Map<String, Object> item : items) {
            if (item.containsKey("item") && item.get("item") instanceof List) {
                traverseItems((List<Map<String, Object>>) item.get("item"), hostVarNames);
            }
            Object requestObj = item.get("request");
            if (requestObj instanceof Map) {
                Map<String, Object> request = (Map<String, Object>) requestObj;
                Object urlObj = request.get("url");
                if (urlObj instanceof Map) {
                    Map<String, Object> url = (Map<String, Object>) urlObj;
                    Object hostsObj = url.get("host");
                    if (hostsObj instanceof List) {
                        for (Object h : (List<?>) hostsObj) {
                            Matcher m = pattern.matcher(String.valueOf(h));
                            if (m.matches()) {
                                hostVarNames.add(m.group(1));
                            }
                        }
                    }
                }
            }
        }
    }

    @SuppressWarnings("unchecked")
    private Mono<Void> updateCollectionVariables(ProvisioningContext ctx) {
        ctx.emitProgress("collectionVars", "Updating collection variables...");

        if (ctx.mockEnvVarMap.isEmpty()) {
            return Mono.empty();
        }

        return Flux.fromIterable(ctx.collectionMappings.values())
            .delayElements(Duration.ofMillis(300))
            .flatMap(mapping -> {
                String targetUid = mapping.targetUid();
                List<Map<String, String>> hostVars = ctx.collectionHostVars.getOrDefault(targetUid, List.of());
                Map<String, Object> details = ctx.collectionDetails.getOrDefault(targetUid, Map.of());
                if (details.isEmpty()) {
                    return Mono.empty();
                }

                List<Map<String, Object>> existingVars = (List<Map<String, Object>>) details.getOrDefault("variable", List.of());
                List<Map<String, Object>> updatedVars = new ArrayList<>();

                if (!hostVars.isEmpty()) {
                    for (Map<String, Object> v : existingVars) {
                        String key = String.valueOf(v.getOrDefault("key", ""));
                        Map<String, String> hv = hostVars.stream()
                            .filter(h -> key.equals(h.get("varName")))
                            .findFirst().orElse(null);
                        if (hv != null) {
                            String envName = ctx.mockEnvVarMap.get(targetUid + ":" + hv.get("varName"));
                            if (envName != null) {
                                Map<String, Object> updated = new HashMap<>(v);
                                updated.put("value", "{{" + envName + "}}");
                                updatedVars.add(updated);
                                continue;
                            }
                        }
                        updatedVars.add(v);
                    }
                } else {
                    String fallbackEnvName = ctx.mockEnvVarMap.get(targetUid + ":__fallback__");
                    if (fallbackEnvName == null) {
                        return Mono.empty();
                    }
                    boolean found = false;
                    for (Map<String, Object> v : existingVars) {
                        String key = String.valueOf(v.getOrDefault("key", ""));
                        if (!found && matchesCommonHostVarName(key)) {
                            Map<String, Object> updated = new HashMap<>(v);
                            updated.put("value", "{{" + fallbackEnvName + "}}");
                            updatedVars.add(updated);
                            found = true;
                        } else {
                            updatedVars.add(v);
                        }
                    }
                    if (!found) {
                        return Mono.empty();
                    }
                }

                if (updatedVars.isEmpty()) {
                    return Mono.empty();
                }

                return client.patchCollectionVariables(targetUid, updatedVars)
                    .onErrorResume(e -> Mono.empty());
            })
            .then();
    }

    private Mono<Void> copySpecs(ProvisioningContext ctx) {
        ctx.emitProgress("specs", "Copying specs...");
        
        return specService.copyAllSpecs(ctx.config.sourceWorkspaceId(), ctx.targetWorkspaceId)
            .map(result -> {
                ctx.result.specs.total = result.success().size() + result.failed().size();
                ctx.result.specs.success = result.success().size();
                for (SpecService.CopyAllSpecsResult.FailedItem item : result.failed()) {
                    ctx.result.specs.failed.add(Map.of("name", item.name(), "error", item.error()));
                }
                return result;
            })
            .then();
    }

    private Mono<Void> addAdmins(ProvisioningContext ctx) {
        if (ctx.config.adminUserIds() == null || ctx.config.adminUserIds().isEmpty()) {
            return Mono.empty();
        }

        ctx.emitProgress("admins", "Adding workspace admins...");
        ctx.result.admins.total = ctx.config.adminUserIds().size();

        // Note: Would need addWorkspaceAdmin method in client
        return Mono.empty();
    }

    private Mono<Void> invitePartners(ProvisioningContext ctx) {
        if (ctx.config.partnerEmails() == null || ctx.config.partnerEmails().isEmpty()) {
            return Mono.empty();
        }

        ctx.emitProgress("partners", "Inviting partners...");
        ctx.result.invitations.total = ctx.config.partnerEmails().size();

        return Flux.fromIterable(ctx.config.partnerEmails())
            .delayElements(Duration.ofMillis(300))
            .flatMap(email -> client.invitePartner(
                ctx.targetWorkspaceId,
                email,
                ctx.config.partnerRoleId() != null ? ctx.config.partnerRoleId() : WorkspaceRole.PARTNER_EDITOR_AND_LEAD.getId()
            ).map(result -> {
                if (result.success()) {
                    ctx.result.invitations.success++;
                    if (result.invitationLink() != null) {
                        ctx.result.invitations.links.add(Map.of(
                            "email", email,
                            "invitationLink", result.invitationLink()
                        ));
                    }
                } else {
                    ctx.result.invitations.failed.add(Map.of("email", email, "error", result.error()));
                }
                return result;
            }))
            .then();
    }

    // Context class
    private static class ProvisioningContext {
        final ProvisioningConfig config;
        final ProvisioningResult result = new ProvisioningResult();
        final Map<String, CollectionMapping> collectionMappings = new HashMap<>();
        final Map<String, MockMapping> mockMappings = new HashMap<>();
        final Map<String, EnvironmentMapping> environmentMappings = new HashMap<>();
        final Map<String, List<Map<String, String>>> collectionHostVars = new HashMap<>();
        final Map<String, Map<String, Object>> collectionDetails = new HashMap<>();
        Map<String, String> mockEnvVarMap = new HashMap<>();
        String targetWorkspaceId;

        ProvisioningContext(ProvisioningConfig config) {
            this.config = config;
        }

        void emitProgress(String step, String message) {
            if (config.onProgress() != null) {
                config.onProgress().accept(new ProgressEvent(step, message));
            }
        }
    }

    // Configuration record
    public record ProvisioningConfig(
        String sourceWorkspaceId,
        String targetWorkspaceId,
        String targetWorkspaceName,
        List<String> adminUserIds,
        List<String> partnerEmails,
        String partnerRoleId,
        Consumer<ProgressEvent> onProgress
    ) {}

    public record ProgressEvent(String step, String message) {}

    // Mapping records
    public record CollectionMapping(String sourceUid, String targetUid, String name) {}
    public record MockMapping(String mockId, String mockUrl, String name, String collectionName, String collectionUid) {}
    public record EnvironmentMapping(String sourceUid, String targetUid, String name) {}

    // Result class
    public static class ProvisioningResult {
        public Workspace workspace;
        public boolean workspaceCreated;
        public final ResourceResult collections = new ResourceResult();
        public final ResourceResult mocks = new ResourceResult();
        public final ResourceResult environments = new ResourceResult();
        public final ResourceResult specs = new ResourceResult();
        public final ResourceResult admins = new ResourceResult();
        public final InvitationsResult invitations = new InvitationsResult();

        public static class ResourceResult {
            public int total;
            public int success;
            public List<Map<String, String>> failed = new ArrayList<>();
        }

        public static class InvitationsResult extends ResourceResult {
            public List<Map<String, String>> links = new ArrayList<>();
        }
    }
}
