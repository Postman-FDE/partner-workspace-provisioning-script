package com.postman.sdk.services;

import com.postman.sdk.client.PostmanClient;
import com.postman.sdk.types.*;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Service for spec management operations
 */
@Service
public class SpecService {

    private final PostmanClient client;

    public SpecService(PostmanClient client) {
        this.client = client;
    }

    /**
     * Copy a single spec with all its files
     */
    public Mono<CopySpecResult> copySpec(String sourceSpecId, String sourceSpecName, Spec.SpecType sourceSpecType, String targetWorkspaceId) {
        return client.getSpecFiles(sourceSpecId)
            .flatMap(files -> {
                if (files.isEmpty()) {
                    return Mono.just(new CopySpecResult(false, sourceSpecName, null, 0, 0, List.of("No files found in spec")));
                }

                return Flux.fromIterable(files)
                    .delayElements(Duration.ofMillis(200))
                    .flatMap(file -> client.getSpecFile(sourceSpecId, file.path()))
                    .filter(file -> file != null && file.content() != null)
                    .collectList()
                    .flatMap(filesWithContent -> {
                        if (filesWithContent.isEmpty()) {
                            return Mono.just(new CopySpecResult(false, sourceSpecName, null, 0, files.size(), List.of("Could not retrieve file contents")));
                        }

                        List<Map<String, String>> fileMaps = filesWithContent.stream()
                            .map(f -> Map.of(
                                "path", f.path(),
                                "content", f.content(),
                                "type", f.type().name()
                            ))
                            .toList();

                        return client.createSpec(targetWorkspaceId, sourceSpecName, sourceSpecType, fileMaps)
                            .map(result -> {
                                if (result.success()) {
                                    return new CopySpecResult(true, sourceSpecName, result.data().id(), filesWithContent.size(), files.size(), List.of());
                                }
                                return new CopySpecResult(false, sourceSpecName, null, 0, files.size(), List.of(result.error()));
                            });
                    });
            });
    }

    /**
     * Copy all specs from source to target workspace
     */
    public Mono<CopyAllSpecsResult> copyAllSpecs(String sourceWorkspaceId, String targetWorkspaceId) {
        return client.getSpecs(sourceWorkspaceId)
            .flatMap(specs -> {
                if (specs.isEmpty()) {
                    return Mono.just(new CopyAllSpecsResult(List.of(), List.of()));
                }

                return Flux.fromIterable(specs)
                    .delayElements(Duration.ofMillis(500))
                    .flatMap(spec -> copySpec(spec.id(), spec.name(), spec.type(), targetWorkspaceId)
                        .map(result -> new SpecCopyAttempt(spec, result)))
                    .collectList()
                    .map(attempts -> {
                        List<CopyAllSpecsResult.SuccessItem> success = new ArrayList<>();
                        List<CopyAllSpecsResult.FailedItem> failed = new ArrayList<>();

                        for (SpecCopyAttempt attempt : attempts) {
                            if (attempt.result().success()) {
                                success.add(new CopyAllSpecsResult.SuccessItem(
                                    attempt.spec().name(),
                                    attempt.spec().id(),
                                    attempt.result().newSpecId(),
                                    attempt.result().filesCopied(),
                                    attempt.result().totalFiles()
                                ));
                            } else {
                                failed.add(new CopyAllSpecsResult.FailedItem(
                                    attempt.spec().name(),
                                    String.join("; ", attempt.result().errors())
                                ));
                            }
                        }

                        return new CopyAllSpecsResult(success, failed);
                    });
            });
    }

    /**
     * Delete all specs in a workspace
     */
    public Mono<DeleteAllResult> deleteAllSpecs(String workspaceId) {
        return client.getSpecs(workspaceId)
            .flatMap(specs -> {
                if (specs.isEmpty()) {
                    return Mono.just(new DeleteAllResult(0, 0, List.of()));
                }

                return Flux.fromIterable(specs)
                    .delayElements(Duration.ofMillis(300))
                    .flatMap(spec -> client.deleteSpec(spec.id())
                        .map(result -> new DeleteAttempt(spec.name(), result.success(), result.error())))
                    .collectList()
                    .map(attempts -> {
                        int deleted = 0;
                        List<DeleteAllResult.FailedItem> failed = new ArrayList<>();

                        for (DeleteAttempt attempt : attempts) {
                            if (attempt.success()) {
                                deleted++;
                            } else {
                                failed.add(new DeleteAllResult.FailedItem(attempt.name(), attempt.error()));
                            }
                        }

                        return new DeleteAllResult(specs.size(), deleted, failed);
                    });
            });
    }

    // Helper records
    private record SpecCopyAttempt(Spec spec, CopySpecResult result) {}
    private record DeleteAttempt(String name, boolean success, String error) {}

    // Result types
    public record CopySpecResult(
        boolean success,
        String specName,
        String newSpecId,
        int filesCopied,
        int totalFiles,
        List<String> errors
    ) {}

    public record CopyAllSpecsResult(
        List<SuccessItem> success,
        List<FailedItem> failed
    ) {
        public record SuccessItem(String name, String sourceId, String targetId, int filesCopied, int totalFiles) {}
        public record FailedItem(String name, String error) {}
    }

    public record DeleteAllResult(
        int total,
        int deleted,
        List<FailedItem> failed
    ) {
        public record FailedItem(String name, String error) {}
    }
}
