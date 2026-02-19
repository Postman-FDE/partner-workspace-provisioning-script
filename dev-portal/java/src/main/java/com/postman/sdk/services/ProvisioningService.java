package com.postman.sdk.services;

import com.postman.sdk.client.PostmanClient;
import com.postman.sdk.types.*;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

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
                        .map(result -> {
                            if (result.success()) {
                                CollectionMapping mapping = new CollectionMapping(collection.uid(), result.data().uid(), collection.name());
                                ctx.collectionMappings.put(collection.uid(), mapping);
                                ctx.result.collections.success++;
                            } else {
                                ctx.result.collections.failed.add(Map.of("name", collection.name(), "error", result.error()));
                            }
                            return result;
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
        
        List<Environment.EnvironmentVariable> mockUrlVars = generateMockUrlVariables(ctx);
        if (mockUrlVars.isEmpty()) {
            return Mono.empty();
        }

        // Find existing Mock Env
        Optional<EnvironmentMapping> mockEnvMapping = ctx.environmentMappings.values().stream()
            .filter(m -> List.of("Mock Env", "Mock Environment", "Test Env").stream()
                .anyMatch(name -> m.name().equalsIgnoreCase(name)))
            .findFirst();

        if (mockEnvMapping.isPresent()) {
            return client.getEnvironmentDetails(mockEnvMapping.get().targetUid())
                .flatMap(details -> {
                    if (details == null) return Mono.empty();
                    List<Environment.EnvironmentVariable> merged = mergeVariables(details.values(), mockUrlVars);
                    // For simplicity, we'd need an updateEnvironment method - skipping for now
                    return Mono.empty();
                });
        }

        return client.createEnvironment("Mock Env", mockUrlVars, ctx.targetWorkspaceId).then();
    }

    private List<Environment.EnvironmentVariable> generateMockUrlVariables(ProvisioningContext ctx) {
        List<Environment.EnvironmentVariable> variables = new ArrayList<>();
        
        for (MockMapping mock : ctx.mockMappings.values()) {
            String varName = toVariableName(mock.collectionName()) + "_mockUrl";
            variables.add(new Environment.EnvironmentVariable(varName, mock.mockUrl(), "default", true));
        }

        if (!variables.isEmpty()) {
            variables.add(0, new Environment.EnvironmentVariable("baseUrl", variables.get(0).value(), "default", true));
        }

        return variables;
    }

    private String toVariableName(String name) {
        String clean = name.replaceAll("[^a-zA-Z0-9\\s]", "");
        String[] words = clean.split("\\s+");
        StringBuilder result = new StringBuilder();
        for (int i = 0; i < words.length; i++) {
            if (i == 0) {
                result.append(words[i].toLowerCase());
            } else {
                result.append(words[i].substring(0, 1).toUpperCase())
                      .append(words[i].substring(1).toLowerCase());
            }
        }
        return result.toString();
    }

    private List<Environment.EnvironmentVariable> mergeVariables(List<Environment.EnvironmentVariable> existing, List<Environment.EnvironmentVariable> newVars) {
        Map<String, Environment.EnvironmentVariable> merged = new LinkedHashMap<>();
        if (existing != null) {
            for (Environment.EnvironmentVariable v : existing) {
                merged.put(v.key(), v);
            }
        }
        for (Environment.EnvironmentVariable v : newVars) {
            merged.put(v.key(), v);
        }
        return new ArrayList<>(merged.values());
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
