package com.postman.sdk.services;

import com.postman.sdk.client.PostmanClient;
import com.postman.sdk.types.*;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * Service for workspace reset workflow
 */
@Service
public class ResetService {

    private final PostmanClient client;
    private final SpecService specService;

    public ResetService(PostmanClient client, SpecService specService) {
        this.client = client;
        this.specService = specService;
    }

    /**
     * Scan workspace contents
     */
    public Mono<WorkspaceContents> scanWorkspace(String workspaceId) {
        return Mono.zip(
            client.getWorkspace(workspaceId),
            client.getCollections(workspaceId),
            client.getEnvironments(workspaceId),
            client.getMocks(workspaceId),
            client.getSpecs(workspaceId)
        ).map(tuple -> new WorkspaceContents(
            tuple.getT1(),
            tuple.getT2(),
            tuple.getT3(),
            tuple.getT4(),
            tuple.getT5()
        ));
    }

    /**
     * Run full reset workflow
     * 
     * Deletion order (reverse of provisioning):
     * 1. Specs first
     * 2. Mocks (depend on collections)
     * 3. Environments
     * 4. Collections last
     */
    public Mono<ResetResult> reset(ResetConfig config) {
        ResetResult result = new ResetResult();

        return scanWorkspace(config.workspaceId())
            .flatMap(contents -> {
                result.workspace = contents.workspace();
                result.specs.total = contents.specs().size();
                result.mocks.total = contents.mocks().size();
                result.environments.total = contents.environments().size();
                result.collections.total = contents.collections().size();

                int total = contents.specs().size() + contents.mocks().size() + 
                           contents.environments().size() + contents.collections().size();

                if (total == 0) {
                    emitProgress(config, "complete", "Workspace is already empty");
                    return Mono.just(result);
                }

                return deleteSpecs(config, contents, result)
                    .then(deleteMocks(config, contents, result))
                    .then(deleteEnvironments(config, contents, result))
                    .then(deleteCollections(config, contents, result))
                    .then(Mono.fromRunnable(() -> emitProgress(config, "complete", "Reset complete")))
                    .thenReturn(result);
            });
    }

    private Mono<Void> deleteSpecs(ResetConfig config, WorkspaceContents contents, ResetResult result) {
        emitProgress(config, "specs", "Deleting " + contents.specs().size() + " spec(s)...");

        return Flux.fromIterable(contents.specs())
            .delayElements(Duration.ofMillis(300))
            .flatMap(spec -> client.deleteSpec(spec.id())
                .map(deleteResult -> {
                    if (deleteResult.success()) {
                        result.specs.deleted++;
                    } else {
                        result.specs.failed.add(new ResetResult.FailedItem(spec.name(), deleteResult.error()));
                    }
                    return deleteResult;
                }))
            .then();
    }

    private Mono<Void> deleteMocks(ResetConfig config, WorkspaceContents contents, ResetResult result) {
        emitProgress(config, "mocks", "Deleting " + contents.mocks().size() + " mock server(s)...");

        return Flux.fromIterable(contents.mocks())
            .delayElements(Duration.ofMillis(300))
            .flatMap(mock -> client.deleteMock(mock.id())
                .map(success -> {
                    if (success) {
                        result.mocks.deleted++;
                    } else {
                        result.mocks.failed.add(new ResetResult.FailedItem(mock.name(), "Failed to delete"));
                    }
                    return success;
                }))
            .then();
    }

    private Mono<Void> deleteEnvironments(ResetConfig config, WorkspaceContents contents, ResetResult result) {
        emitProgress(config, "environments", "Deleting " + contents.environments().size() + " environment(s)...");

        return Flux.fromIterable(contents.environments())
            .delayElements(Duration.ofMillis(300))
            .flatMap(env -> client.deleteEnvironment(env.uid())
                .map(success -> {
                    if (success) {
                        result.environments.deleted++;
                    } else {
                        result.environments.failed.add(new ResetResult.FailedItem(env.name(), "Failed to delete"));
                    }
                    return success;
                }))
            .then();
    }

    private Mono<Void> deleteCollections(ResetConfig config, WorkspaceContents contents, ResetResult result) {
        emitProgress(config, "collections", "Deleting " + contents.collections().size() + " collection(s)...");

        return Flux.fromIterable(contents.collections())
            .delayElements(Duration.ofMillis(300))
            .flatMap(collection -> client.deleteCollection(collection.uid())
                .map(success -> {
                    if (success) {
                        result.collections.deleted++;
                    } else {
                        result.collections.failed.add(new ResetResult.FailedItem(collection.name(), "Failed to delete"));
                    }
                    return success;
                }))
            .then();
    }

    private void emitProgress(ResetConfig config, String step, String message) {
        if (config.onProgress() != null) {
            config.onProgress().accept(new ProgressEvent(step, message));
        }
    }

    // Types
    public record WorkspaceContents(
        Workspace workspace,
        List<Collection> collections,
        List<Environment> environments,
        List<MockServer> mocks,
        List<Spec> specs
    ) {}

    public record ResetConfig(
        String workspaceId,
        Consumer<ProgressEvent> onProgress
    ) {}

    public record ProgressEvent(String step, String message) {}

    public static class ResetResult {
        public Workspace workspace;
        public final DeleteResult specs = new DeleteResult();
        public final DeleteResult mocks = new DeleteResult();
        public final DeleteResult environments = new DeleteResult();
        public final DeleteResult collections = new DeleteResult();

        public static class DeleteResult {
            public int total;
            public int deleted;
            public List<FailedItem> failed = new ArrayList<>();
        }

        public record FailedItem(String name, String error) {}
    }
}
