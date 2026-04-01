package com.postman.sdk.services;

import com.postman.sdk.client.PostmanClient;
import com.postman.sdk.types.Collection;
import com.postman.sdk.types.Environment;
import com.postman.sdk.types.Spec;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.time.Duration;
import java.util.*;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Service for workspace update detection and processing.
 * Scans source and target workspaces, detects net-new assets,
 * and adds them with full mock URL wiring.
 */
@Service
public class UpdateService {

    private static final List<String> COMMON_HOST_VAR_NAMES = List.of(
            "baseUrl", "baseurl", "base_url", "HostName", "hostname", "host",
            "apiUrl", "apiurl", "api_url", "serverUrl", "serverurl", "server_url"
    );
    private static final Pattern HOST_VAR_PATTERN = Pattern.compile("^\\{\\{(.+)\\}\\}$");

    private final PostmanClient client;
    private final SpecService specService;

    public UpdateService(PostmanClient client, SpecService specService) {
        this.client = client;
        this.specService = specService;
    }

    // ==================== Public Types ====================

    public record UpdateConfig(
            String sourceWorkspaceId,
            String targetWorkspaceId,
            Consumer<ProgressEvent> onProgress
    ) {}

    public record UpdateResult(
            ResourceResult newCollections,
            ResourceResult newSpecs,
            ResourceResult newEnvironments,
            MockEnvResult updatedMockEnv,
            List<String> errors
    ) {
        public static UpdateResult empty() {
            return new UpdateResult(
                    ResourceResult.empty(), ResourceResult.empty(), ResourceResult.empty(),
                    null, new ArrayList<>()
            );
        }
    }

    public record ResourceResult(
            int total, int success,
            List<Map<String, String>> failed,
            List<Map<String, String>> successData
    ) {
        public static ResourceResult empty() {
            return new ResourceResult(0, 0, new ArrayList<>(), new ArrayList<>());
        }
    }

    public record MockEnvResult(String uid, int newVarsAdded) {}

    public record ProgressEvent(String phase, String message, int progress) {}

    private record HostVariableInfo(String varName, String originalUrl, String path) {}

    private record DetectedAssets(
            List<Collection> newCollections,
            List<Spec> newSpecs,
            List<Environment> newEnvironments
    ) {}

    // ==================== Main Workflow ====================

    /**
     * Run update detection and processing workflow
     */
    public Mono<UpdateResult> update(UpdateConfig config) {
        UpdateContext ctx = new UpdateContext(config);

        return client.validateApiKey()
                .flatMap(user -> detectNewAssets(ctx))
                .flatMap(detected -> {
                    // Auto-link: only include specs whose name matches a new collection
                    Set<String> newCollectionNames = detected.newCollections().stream()
                            .map(c -> c.name() != null ? c.name().toLowerCase().trim() : "")
                            .collect(Collectors.toSet());
                    List<Spec> linkedSpecs = detected.newSpecs().stream()
                            .filter(s -> newCollectionNames.contains(s.name() != null ? s.name().toLowerCase().trim() : ""))
                            .toList();

                    if (detected.newCollections().isEmpty() && linkedSpecs.isEmpty() && detected.newEnvironments().isEmpty()) {
                        emitProgress(ctx, "complete", "Workspace is up to date — no new assets found.");
                        return Mono.just(ctx.buildResult());
                    }

                    emitProgress(ctx, "detection",
                            String.format("Found %d new collection(s), %d new spec(s), %d new environment(s)",
                                    detected.newCollections().size(), linkedSpecs.size(), detected.newEnvironments().size()));

                    Mono<Void> pipeline = Mono.empty();

                    if (!detected.newCollections().isEmpty()) {
                        pipeline = pipeline.then(forkNewCollections(ctx, detected.newCollections()))
                                .then(createMocks(ctx))
                                .then(updateMockEnv(ctx))
                                .then(updateCollectionVariables(ctx));
                    }

                    if (!linkedSpecs.isEmpty()) {
                        pipeline = pipeline.then(copyNewSpecs(ctx, linkedSpecs));
                    }

                    if (!detected.newEnvironments().isEmpty()) {
                        pipeline = pipeline.then(copyNewEnvironments(ctx, detected.newEnvironments()));
                    }

                    return pipeline.then(Mono.fromCallable(ctx::buildResult));
                });
    }

    /**
     * Scan workspaces and return a diff of new assets without making changes.
     */
    public Mono<ScanResult> scan(UpdateConfig config) {
        UpdateContext ctx = new UpdateContext(config);

        return client.validateApiKey()
                .flatMap(user -> detectNewAssets(ctx))
                .map(detected -> {
                    Set<String> newCollectionNames = detected.newCollections().stream()
                            .map(c -> c.name() != null ? c.name().toLowerCase().trim() : "")
                            .collect(Collectors.toSet());
                    List<Spec> linkedSpecs = detected.newSpecs().stream()
                            .filter(s -> newCollectionNames.contains(s.name() != null ? s.name().toLowerCase().trim() : ""))
                            .toList();

                    List<Map<String, String>> collectionSummaries = detected.newCollections().stream()
                            .map(c -> Map.of("name", c.name(), "uid", c.uid()))
                            .toList();
                    List<Map<String, String>> specSummaries = linkedSpecs.stream()
                            .map(s -> Map.of("name", s.name(), "id", s.id(), "type", s.type().getValue()))
                            .toList();
                    List<Map<String, String>> envSummaries = detected.newEnvironments().stream()
                            .map(e -> Map.of("name", e.name(), "uid", e.uid()))
                            .toList();

                    boolean isUpToDate = collectionSummaries.isEmpty() && specSummaries.isEmpty() && envSummaries.isEmpty();

                    return new ScanResult(collectionSummaries, specSummaries, envSummaries, isUpToDate);
                });
    }

    public record ScanResult(
            List<Map<String, String>> newCollections,
            List<Map<String, String>> newSpecs,
            List<Map<String, String>> newEnvironments,
            boolean isUpToDate
    ) {}

    // ==================== Detection ====================

    private Mono<DetectedAssets> detectNewAssets(UpdateContext ctx) {
        String sourceId = ctx.config.sourceWorkspaceId();
        String targetId = ctx.config.targetWorkspaceId();

        return Mono.zip(
                client.getCollections(sourceId),
                client.getCollections(targetId),
                client.getSpecs(sourceId),
                client.getSpecs(targetId),
                client.getEnvironments(sourceId),
                client.getEnvironments(targetId)
        ).flatMap(tuple -> {
            List<Collection> sourceColls = tuple.getT1();
            List<Collection> targetColls = tuple.getT2();
            List<Spec> sourceSpecs = tuple.getT3();
            List<Spec> targetSpecs = tuple.getT4();
            List<Environment> sourceEnvs = tuple.getT5();
            List<Environment> targetEnvs = tuple.getT6();

            // Specs: name match
            Set<String> targetSpecNames = targetSpecs.stream()
                    .map(s -> s.name() != null ? s.name().toLowerCase().trim() : "")
                    .collect(Collectors.toSet());
            List<Spec> newSpecs = sourceSpecs.stream()
                    .filter(s -> !targetSpecNames.contains(s.name() != null ? s.name().toLowerCase().trim() : ""))
                    .toList();

            // Environments: name match, exclude Mock Env
            Set<String> targetEnvNames = targetEnvs.stream()
                    .map(e -> e.name() != null ? e.name().toLowerCase().trim() : "")
                    .collect(Collectors.toSet());
            List<Environment> newEnvs = sourceEnvs.stream()
                    .filter(e -> !"Mock Env".equals(e.name()) && !targetEnvNames.contains(e.name() != null ? e.name().toLowerCase().trim() : ""))
                    .toList();

            // Collections: fork check + name fallback
            return findNewCollections(sourceColls, targetColls)
                    .map(newColls -> new DetectedAssets(newColls, newSpecs, newEnvs));
        });
    }

    @SuppressWarnings("unchecked")
    private Mono<List<Collection>> findNewCollections(List<Collection> sourceColls, List<Collection> targetColls) {
        if (targetColls.isEmpty()) {
            return Mono.just(new ArrayList<>(sourceColls));
        }

        return Flux.fromIterable(targetColls)
                .delayElements(Duration.ofMillis(300))
                .flatMapSequential(tc -> client.getCollectionDetails(tc.uid())
                        .map(details -> {
                            Map<String, Object> info = new HashMap<>();
                            info.put("name", tc.name());
                            if (details != null) {
                                Object fork = details.get("fork");
                                if (fork instanceof Map) {
                                    Object from = ((Map<String, Object>) fork).get("from");
                                    if (from != null) info.put("forkFrom", from.toString());
                                }
                            }
                            return info;
                        })
                        .defaultIfEmpty(Map.of("name", tc.name()))
                )
                .collectList()
                .map(targetInfos -> {
                    Set<String> forkSources = new HashSet<>();
                    Set<String> targetNames = new HashSet<>();
                    for (Map<String, Object> info : targetInfos) {
                        targetNames.add((String) info.get("name"));
                        if (info.containsKey("forkFrom")) {
                            forkSources.add((String) info.get("forkFrom"));
                        }
                    }
                    return sourceColls.stream()
                            .filter(sc -> !forkSources.contains(sc.uid()) && !targetNames.contains(sc.name()))
                            .toList();
                });
    }

    // ==================== Processing ====================

    private Mono<Void> forkNewCollections(UpdateContext ctx, List<Collection> newCollections) {
        ctx.newCollectionsTotal = newCollections.size();

        return Flux.fromIterable(newCollections)
                .delayElements(Duration.ofMillis(300))
                .flatMapSequential(collection -> {
                    emitProgress(ctx, "collections", "Forking " + collection.name() + "...");

                    return client.forkCollection(collection.uid(), collection.name(), ctx.config.targetWorkspaceId())
                            .flatMap(forkResult -> {
                                if (forkResult.success()) {
                                    ctx.newCollectionsSuccess++;
                                    ctx.newCollectionsSuccessData.add(Map.of(
                                            "name", collection.name(),
                                            "sourceUid", collection.uid(),
                                            "targetUid", forkResult.data().uid()
                                    ));

                                    return client.getCollectionDetails(forkResult.data().uid())
                                            .doOnNext(details -> {
                                                List<HostVariableInfo> hostVars = extractHostVariables(details);
                                                ctx.collectionStore.put(collection.uid(), Map.of(
                                                        "sourceUid", collection.uid(),
                                                        "targetUid", forkResult.data().uid(),
                                                        "name", collection.name(),
                                                        "hostVariables", hostVars,
                                                        "collectionDetails", details
                                                ));
                                            })
                                            .then();
                                } else {
                                    ctx.newCollectionsFailed.add(Map.of(
                                            "name", collection.name(),
                                            "error", forkResult.error() != null ? forkResult.error() : "Unknown error"
                                    ));
                                    return Mono.empty();
                                }
                            });
                })
                .then();
    }

    private Mono<Void> createMocks(UpdateContext ctx) {
        if (ctx.collectionStore.isEmpty()) return Mono.empty();

        return Flux.fromIterable(ctx.collectionStore.values())
                .delayElements(Duration.ofMillis(300))
                .flatMapSequential(collData -> {
                    String targetUid = (String) collData.get("targetUid");
                    String name = (String) collData.get("name");
                    String mockName = name + " Mock";

                    emitProgress(ctx, "mocks", "Creating " + mockName + "...");

                    return client.createMock(mockName, targetUid, ctx.config.targetWorkspaceId(), false)
                            .doOnNext(result -> {
                                if (result.success()) {
                                    ctx.mockStore.put(targetUid, Map.of(
                                            "mockId", result.data().id(),
                                            "mockUrl", result.data().mockUrl(),
                                            "name", mockName,
                                            "collectionName", name
                                    ));
                                } else {
                                    ctx.errors.add("Failed to create mock for " + name + ": " + result.error());
                                }
                            })
                            .then();
                })
                .then();
    }

    private Mono<Void> updateMockEnv(UpdateContext ctx) {
        if (ctx.mockStore.isEmpty()) return Mono.empty();

        Map<String, List<Map<String, String>>> generated = generateMockUrlVariables(ctx);
        List<Map<String, String>> newVars = generated.get("variables");

        if (newVars == null || newVars.isEmpty()) return Mono.empty();

        return client.getEnvironments(ctx.config.targetWorkspaceId())
                .flatMap(envs -> {
                    Optional<Environment> mockEnvOpt = envs.stream()
                            .filter(e -> "Mock Env".equals(e.name()))
                            .findFirst();

                    if (mockEnvOpt.isPresent()) {
                        Environment mockEnv = mockEnvOpt.get();
                        return client.getEnvironmentDetails(mockEnv.uid())
                                .flatMap(details -> {
                                    List<Environment.EnvironmentVariable> existing = details != null && details.values() != null
                                            ? details.values() : List.of();
                                    Set<String> existingKeys = existing.stream()
                                            .map(Environment.EnvironmentVariable::key)
                                            .collect(Collectors.toCollection(HashSet::new));

                                    List<Environment.EnvironmentVariable> deduped = new ArrayList<>();
                                    for (Map<String, String> v : newVars) {
                                        String key = v.get("key");
                                        if (existingKeys.contains(key)) {
                                            int suffix = 2;
                                            String newKey = key + suffix;
                                            while (existingKeys.contains(newKey)) {
                                                suffix++;
                                                newKey = key + suffix;
                                            }
                                            String finalNewKey = newKey;
                                            ctx.mockEnvVarMap.replaceAll((k, val) -> val.equals(key) ? finalNewKey : val);
                                            existingKeys.add(finalNewKey);
                                            deduped.add(new Environment.EnvironmentVariable(finalNewKey, v.get("value"), "default", true));
                                        } else {
                                            existingKeys.add(key);
                                            deduped.add(new Environment.EnvironmentVariable(key, v.get("value"), "default", true));
                                        }
                                    }

                                    List<Environment.EnvironmentVariable> merged = new ArrayList<>(existing);
                                    merged.addAll(deduped);

                                    return client.updateEnvironment(mockEnv.uid(), "Mock Env", merged)
                                            .doOnNext(r -> ctx.updatedMockEnv = new MockEnvResult(mockEnv.uid(), deduped.size()))
                                            .then();
                                });
                    } else {
                        List<Environment.EnvironmentVariable> envVars = newVars.stream()
                                .map(v -> new Environment.EnvironmentVariable(v.get("key"), v.get("value"), "default", true))
                                .toList();

                        return client.createEnvironment("Mock Env", envVars, ctx.config.targetWorkspaceId())
                                .doOnNext(r -> {
                                    if (r.success()) {
                                        ctx.updatedMockEnv = new MockEnvResult(r.data().uid(), newVars.size());
                                    }
                                })
                                .then();
                    }
                });
    }

    @SuppressWarnings("unchecked")
    private Mono<Void> updateCollectionVariables(UpdateContext ctx) {
        if (ctx.mockEnvVarMap.isEmpty()) return Mono.empty();

        return Flux.fromIterable(ctx.collectionStore.values())
                .delayElements(Duration.ofMillis(300))
                .flatMapSequential(collData -> {
                    Object detailsObj = collData.get("collectionDetails");
                    if (detailsObj == null) return Mono.<Void>empty();

                    List<HostVariableInfo> hostVars = (List<HostVariableInfo>) collData.get("hostVariables");
                    String targetUid = (String) collData.get("targetUid");

                    Map<String, Object> details = (Map<String, Object>) detailsObj;
                    List<Map<String, Object>> existingVars = (List<Map<String, Object>>) details.getOrDefault("variable", List.of());

                    List<Map<String, Object>> updatedVars = new ArrayList<>();

                    if (hostVars != null && !hostVars.isEmpty()) {
                        for (Map<String, Object> v : existingVars) {
                            String key = (String) v.get("key");
                            Optional<HostVariableInfo> hv = hostVars.stream().filter(h -> h.varName().equals(key)).findFirst();
                            if (hv.isPresent()) {
                                String envName = ctx.mockEnvVarMap.get(targetUid + ":" + hv.get().varName());
                                if (envName != null) {
                                    Map<String, Object> updated = new HashMap<>(v);
                                    updated.put("value", "{{" + envName + "}}");
                                    updatedVars.add(updated);
                                    continue;
                                }
                            }
                            updatedVars.add(v);
                        }

                        for (HostVariableInfo hv : hostVars) {
                            String envName = ctx.mockEnvVarMap.get(targetUid + ":" + hv.varName());
                            if (envName != null) {
                                boolean exists = updatedVars.stream().anyMatch(v -> hv.varName().equals(v.get("key")));
                                if (!exists) {
                                    updatedVars.add(Map.of("key", hv.varName(), "value", "{{" + envName + "}}", "type", "string"));
                                }
                            }
                        }

                        return client.patchCollectionVariables(targetUid, updatedVars, details).then();
                    }

                    String fallback = ctx.mockEnvVarMap.get(targetUid + ":__fallback__");
                    if (fallback == null) return Mono.<Void>empty();

                    Optional<Map<String, Object>> commonVar = existingVars.stream()
                            .filter(v -> COMMON_HOST_VAR_NAMES.stream().anyMatch(n -> n.equalsIgnoreCase((String) v.get("key"))))
                            .findFirst();

                    if (commonVar.isPresent()) {
                        for (Map<String, Object> v : existingVars) {
                            if (v.get("key").equals(commonVar.get().get("key"))) {
                                Map<String, Object> updated = new HashMap<>(v);
                                updated.put("value", "{{" + fallback + "}}");
                                updatedVars.add(updated);
                            } else {
                                updatedVars.add(v);
                            }
                        }
                    } else {
                        updatedVars.addAll(existingVars);
                        updatedVars.add(Map.of("key", "baseUrl", "value", "{{" + fallback + "}}", "type", "string"));
                    }

                    return client.patchCollectionVariables(targetUid, updatedVars, details).then();
                })
                .then();
    }

    private Mono<Void> copyNewSpecs(UpdateContext ctx, List<Spec> newSpecs) {
        ctx.newSpecsTotal = newSpecs.size();

        return Flux.fromIterable(newSpecs)
                .delayElements(Duration.ofMillis(500))
                .flatMapSequential(spec -> {
                    emitProgress(ctx, "specs", "Copying " + spec.name() + "...");
                    return specService.copySpec(spec.id(), spec.name(), spec.type(), ctx.config.targetWorkspaceId())
                            .doOnNext(result -> {
                                if (result.success()) {
                                    ctx.newSpecsSuccess++;
                                    ctx.newSpecsSuccessData.add(Map.of(
                                            "name", spec.name(),
                                            "sourceId", spec.id(),
                                            "targetId", result.newSpecId()
                                    ));
                                } else {
                                    ctx.newSpecsFailed.add(Map.of("name", spec.name(), "error", String.join("; ", result.errors())));
                                }
                            })
                            .then();
                })
                .then();
    }

    private Mono<Void> copyNewEnvironments(UpdateContext ctx, List<Environment> newEnvironments) {
        ctx.newEnvironmentsTotal = newEnvironments.size();

        return Flux.fromIterable(newEnvironments)
                .delayElements(Duration.ofMillis(300))
                .flatMapSequential(env -> {
                    emitProgress(ctx, "environments", "Copying " + env.name() + "...");
                    return client.getEnvironmentDetails(env.uid())
                            .flatMap(details -> {
                                if (details == null) {
                                    ctx.newEnvironmentsFailed.add(Map.of("name", env.name(), "error", "Could not fetch details"));
                                    return Mono.<Void>empty();
                                }
                                return client.createEnvironment(details.name(), details.values() != null ? details.values() : List.of(), ctx.config.targetWorkspaceId())
                                        .doOnNext(r -> {
                                            if (r.success()) {
                                                ctx.newEnvironmentsSuccess++;
                                                ctx.newEnvironmentsSuccessData.add(Map.of(
                                                        "name", details.name(),
                                                        "sourceUid", env.uid(),
                                                        "targetUid", r.data().uid()
                                                ));
                                            } else {
                                                ctx.newEnvironmentsFailed.add(Map.of("name", details.name(), "error", r.error()));
                                            }
                                        })
                                        .then();
                            });
                })
                .then();
    }

    // ==================== Helpers ====================

    @SuppressWarnings("unchecked")
    private List<HostVariableInfo> extractHostVariables(Object collectionObj) {
        Map<String, Object> collection = (Map<String, Object>) collectionObj;
        Set<String> hostVarNames = new HashSet<>();

        List<Map<String, Object>> items = (List<Map<String, Object>>) collection.getOrDefault("item", List.of());
        traverseItems(items, hostVarNames);

        List<Map<String, Object>> collVars = (List<Map<String, Object>>) collection.getOrDefault("variable", List.of());

        if (!hostVarNames.isEmpty()) {
            List<HostVariableInfo> mapped = hostVarNames.stream().map(varName -> {
                String originalUrl = collVars.stream()
                        .filter(v -> varName.equals(v.get("key")))
                        .map(v -> (String) v.getOrDefault("value", ""))
                        .findFirst().orElse("");
                String path = extractUrlPath(originalUrl);
                return new HostVariableInfo(varName, originalUrl, path);
            }).toList();

            List<HostVariableInfo> withProtocol = mapped.stream().filter(hv -> hv.originalUrl().contains("://")).toList();
            if (!withProtocol.isEmpty()) return withProtocol;
            return mapped.stream().map(hv -> new HostVariableInfo(hv.varName(), hv.originalUrl(), "")).toList();
        }

        return collVars.stream()
                .filter(v -> COMMON_HOST_VAR_NAMES.stream().anyMatch(n -> n.equalsIgnoreCase((String) v.get("key"))))
                .map(v -> {
                    String originalUrl = (String) v.getOrDefault("value", "");
                    String path = originalUrl.contains("://") ? extractUrlPath(originalUrl) : "";
                    return new HostVariableInfo((String) v.get("key"), originalUrl, path);
                })
                .toList();
    }

    @SuppressWarnings("unchecked")
    private void traverseItems(List<Map<String, Object>> items, Set<String> hostVarNames) {
        if (items == null) return;
        for (Map<String, Object> item : items) {
            if (item.containsKey("item")) {
                traverseItems((List<Map<String, Object>>) item.get("item"), hostVarNames);
            }
            Map<String, Object> request = (Map<String, Object>) item.get("request");
            if (request != null) {
                Map<String, Object> url = (Map<String, Object>) request.get("url");
                if (url != null) {
                    List<String> host = (List<String>) url.get("host");
                    if (host != null) {
                        for (String h : host) {
                            Matcher m = HOST_VAR_PATTERN.matcher(h);
                            if (m.matches()) hostVarNames.add(m.group(1));
                        }
                    }
                }
            }
        }
    }

    private Map<String, List<Map<String, String>>> generateMockUrlVariables(UpdateContext ctx) {
        List<Map<String, String>> variables = new ArrayList<>();

        for (Map<String, Object> collData : ctx.collectionStore.values()) {
            String collName = (String) collData.get("name");
            String targetUid = (String) collData.get("targetUid");

            Optional<Map<String, String>> mockData = ctx.mockStore.values().stream()
                    .filter(m -> collName.equals(m.get("collectionName")))
                    .findFirst();
            if (mockData.isEmpty()) continue;

            String mockUrl = mockData.get().get("mockUrl");

            @SuppressWarnings("unchecked")
            List<HostVariableInfo> hostVars = (List<HostVariableInfo>) collData.get("hostVariables");

            if (hostVars == null || hostVars.isEmpty()) {
                String varName = toVariableName(collName) + "BaseUrl";
                variables.add(Map.of("key", varName, "value", mockUrl));
                ctx.mockEnvVarMap.put(targetUid + ":__fallback__", varName);
                continue;
            }

            for (HostVariableInfo hv : hostVars) {
                String envVarName = toVariableName(collName) + toPascalCase(hv.varName());
                variables.add(Map.of("key", envVarName, "value", mockUrl));
                ctx.mockEnvVarMap.put(targetUid + ":" + hv.varName(), envVarName);
            }
        }

        return Map.of("variables", variables);
    }

    private static String toVariableName(String name) {
        String clean = name.replaceAll("[^a-zA-Z0-9\\s]", "");
        String[] words = clean.split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < words.length; i++) {
            if (words[i].isEmpty()) continue;
            if (i == 0) sb.append(words[i].toLowerCase());
            else sb.append(Character.toUpperCase(words[i].charAt(0))).append(words[i].substring(1).toLowerCase());
        }
        return sb.toString();
    }

    private static String toPascalCase(String str) {
        str = str.replaceAll("([a-z])([A-Z])", "$1 $2").replaceAll("[^a-zA-Z0-9]", " ");
        StringBuilder sb = new StringBuilder();
        for (String word : str.split("\\s+")) {
            if (!word.isEmpty()) sb.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1).toLowerCase());
        }
        return sb.toString();
    }

    private static String extractUrlPath(String urlString) {
        try {
            URI uri = URI.create(urlString);
            String path = uri.getPath();
            return "/".equals(path) ? "" : (path != null ? path : "");
        } catch (Exception e) {
            return "";
        }
    }

    private void emitProgress(UpdateContext ctx, String phase, String message) {
        if (ctx.config.onProgress() != null) {
            ctx.config.onProgress().accept(new ProgressEvent(phase, message, 0));
        }
    }

    // ==================== Context ====================

    private class UpdateContext {
        final UpdateConfig config;
        final Map<String, Map<String, Object>> collectionStore = new LinkedHashMap<>();
        final Map<String, Map<String, String>> mockStore = new LinkedHashMap<>();
        final Map<String, String> mockEnvVarMap = new HashMap<>();
        final List<String> errors = new ArrayList<>();

        int newCollectionsTotal = 0;
        int newCollectionsSuccess = 0;
        List<Map<String, String>> newCollectionsFailed = new ArrayList<>();
        List<Map<String, String>> newCollectionsSuccessData = new ArrayList<>();

        int newSpecsTotal = 0;
        int newSpecsSuccess = 0;
        List<Map<String, String>> newSpecsFailed = new ArrayList<>();
        List<Map<String, String>> newSpecsSuccessData = new ArrayList<>();

        int newEnvironmentsTotal = 0;
        int newEnvironmentsSuccess = 0;
        List<Map<String, String>> newEnvironmentsFailed = new ArrayList<>();
        List<Map<String, String>> newEnvironmentsSuccessData = new ArrayList<>();

        MockEnvResult updatedMockEnv = null;

        UpdateContext(UpdateConfig config) {
            this.config = config;
        }

        UpdateResult buildResult() {
            return new UpdateResult(
                    new ResourceResult(newCollectionsTotal, newCollectionsSuccess, newCollectionsFailed, newCollectionsSuccessData),
                    new ResourceResult(newSpecsTotal, newSpecsSuccess, newSpecsFailed, newSpecsSuccessData),
                    new ResourceResult(newEnvironmentsTotal, newEnvironmentsSuccess, newEnvironmentsFailed, newEnvironmentsSuccessData),
                    updatedMockEnv,
                    errors
            );
        }
    }
}
