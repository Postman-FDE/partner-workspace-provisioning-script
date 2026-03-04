# Postman Workspace Provisioning Tools — Java (Spring WebFlux)

Comprehensive tooling for automated Postman partner workspace provisioning and management. This is a Spring Boot service that uses WebFlux's reactive `WebClient` for non-blocking HTTP operations.

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Library Usage](#library-usage)
  - [Available Methods](#available-methods)
  - [Provisioning Methods](#provisioning-methods)
  - [Reset Methods](#reset-methods)
  - [Team & Partner Management](#team--partner-management)
  - [Helper Methods](#helper-methods)
- [API Reference](#api-reference)
- [Workflow Details](#workflow-details)
- [Troubleshooting](#troubleshooting)

---

## Overview

This service automates the process of creating and managing Postman partner workspaces. It handles the complete provisioning workflow from workspace creation through asset copying to team/partner management.

### Complete Provisioning Workflow

```
1. Workspace Creation     -> Create new partner workspace (or use existing)
2. Copy Collections       -> Fork all collections from source workspace
3. Create Mock Servers    -> Generate mock servers for each collection
4. Copy Environments      -> Duplicate environment configurations
5. Update Mock Env        -> Create/update "Mock Env" with mock server URLs
6. Copy API Specs         -> Transfer all API specification files
7. Add Team Admins        -> Add internal team members as workspace admins
8. Invite Partners        -> Send partner invitations with invitation links
```

### Reset Workflow

Deletes workspace resources in reverse dependency order:
1. Delete API Specs
2. Delete Mock Servers
3. Delete Environments
4. Delete Collections

---

## Features

- **Reactive / non-blocking** — all HTTP operations use Spring WebFlux `WebClient` with `Mono<T>` return types
- **Spring Boot integration** — `@Service` annotation for autowiring, `@Value` for configuration
- **Inner record types** — strongly typed options and result records
- **Complete Workspace Provisioning** — collection forking, mock server creation, environment handling, API spec copying, team member management, partner invitation with "Run in Postman" links
- **Custom Selection Provisioning** — choose specific asset types and individual items
- **Safe Reset Functionality** — dependency-aware deletion order, selective deletion
- **Robust Error Handling** — progress callbacks, rate limit management, partial failure handling

---

## Installation

### Option 1: Copy the file

Copy `PostmanService.java` into your Spring Boot project under the appropriate package directory (e.g. `src/main/java/com/postman/sdk/script/`).

Add these dependencies to your `pom.xml`:

```xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.2.2</version>
</parent>

<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-webflux</artifactId>
    </dependency>
    <dependency>
        <groupId>com.fasterxml.jackson.core</groupId>
        <artifactId>jackson-databind</artifactId>
    </dependency>
</dependencies>
```

Or for Gradle:

```groovy
implementation 'org.springframework.boot:spring-boot-starter-webflux'
implementation 'com.fasterxml.jackson.core:jackson-databind'
```

### Option 2: Use from this repository

```bash
cd dev-portal/java/sdk
mvn clean install
```

---

## Configuration

### application.yml

```yaml
POSTMAN_API_KEY: ${POSTMAN_API_KEY}
POSTMAN_SOURCE_WORKSPACE_ID: ${POSTMAN_SOURCE_WORKSPACE_ID}
POSTMAN_TARGET_WORKSPACE_ID: ${POSTMAN_TARGET_WORKSPACE_ID:}  # optional
```

### Environment Variables

```bash
# Required
export POSTMAN_API_KEY=PMAK-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
export POSTMAN_SOURCE_WORKSPACE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Optional
export POSTMAN_TARGET_WORKSPACE_ID=           # Leave empty to create new workspace
```

### Environment Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTMAN_API_KEY` | Yes | Your Postman API key |
| `POSTMAN_SOURCE_WORKSPACE_ID` | Yes | Source workspace to copy from |
| `POSTMAN_TARGET_WORKSPACE_ID` | No | Target workspace (creates new if empty) |

---

## Library Usage

### Inject the Service

```java
import com.postman.sdk.script.PostmanService;
import com.postman.sdk.script.PostmanService.*;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

@Service
public class WorkspaceManager {

    private final PostmanService postmanService;

    public WorkspaceManager(PostmanService postmanService) {
        this.postmanService = postmanService;
    }
}
```

---

### Available Methods

| Category | Method | Purpose |
|----------|--------|---------|
| **Provisioning** | `provisionWorkspace()` | Complete provisioning with all assets |
| **Provisioning** | `provisionCustomWorkspace()` | Selective provisioning with options |
| **Reset** | `resetWorkspace()` | Delete all/selected asset types |
| **Reset** | `resetCustomWorkspace()` | Delete specific items |
| **Team** | `addWorkspaceAdmin()` | Add a user as workspace admin |
| **Team** | `addMultipleAdmins()` | Batch add multiple admins |
| **Partners** | `invitePartner()` | Invite a partner by email |
| **Partners** | `inviteMultiplePartners()` | Batch invite multiple partners |
| **Partners** | `removePartner()` | Remove partner from workspace |
| **Helper** | `getAvailableCollections()` | Get collections for UI checklist |
| **Helper** | `getAvailableResources()` | Get all resources for UI selection |
| **Helper** | `validateApiKey()` | Validate the configured API key |
| **Helper** | `getWorkspaceSummary()` | Get workspace content counts |

---

### Provisioning Methods

#### `provisionWorkspace()` — Full Provisioning

```java
ProvisionOptions options = ProvisionOptions.of(
    "source-workspace-id",
    null,                           // targetWorkspaceId (null = create new)
    "My Partner Workspace",
    "partner",
    List.of("12345", "67890"),      // adminUserIds
    List.of("partner@company.com"), // partnerEmails
    "7"                             // partnerRoleId
);

Consumer<Map<String, Object>> onProgress = progress -> {
    System.out.printf("%s: %s (%s%%)%n",
        progress.get("phase"),
        progress.get("message"),
        progress.get("progress"));
};

Mono<ProvisionResult> resultMono = postmanService.provisionWorkspace(options, onProgress);

resultMono.subscribe(result -> {
    System.out.println("Workspace: " + result.workspace());
    System.out.println("Collections: " + result.collections().get("success"));
    System.out.println("Invitation links: " + result.invitations().get("links"));
});
```

#### `provisionCustomWorkspace()` — Selective Provisioning

```java
CustomProvisionOptions options = CustomProvisionOptions.of(
    "source-workspace-id",
    "target-workspace-id",
    null,                    // workspaceName
    "partner",
    true,                    // copyCollections
    true,                    // copyEnvironments
    true,                    // copyMocks
    false,                   // copySpecs
    true,                    // createMockEnv
    true,                    // addAdmins
    true,                    // invitePartners
    List.of("uid1", "uid2"), // selectedCollectionUids
    null,                    // selectedEnvironmentUids
    null,                    // selectedSpecIds
    List.of("12345"),        // adminUserIds
    List.of("partner@company.com"),
    "7"
);

postmanService.provisionCustomWorkspace(options, progress -> {
    System.out.println(progress.get("message"));
}).subscribe();
```

---

### Reset Methods

#### `resetWorkspace()` — Delete All/Selected Asset Types

```java
ResetOptions options = new ResetOptions(true, true, false, false);

postmanService.resetWorkspace(
    "workspace-id",
    progress -> System.out.printf("%s: %s/%s%n",
        progress.get("phase"),
        progress.get("deleted"),
        progress.get("total")),
    options
).subscribe(result -> {
    System.out.println("Deleted specs: " + result.deletedSpecs());
    System.out.println("Deleted mocks: " + result.deletedMocks());
});
```

---

### Team & Partner Management

```java
// Add a single admin
postmanService.addWorkspaceAdmin("workspace-id", "12345678", "3")
    .subscribe(result -> System.out.println("Added: " + result.success()));

// Invite a single partner
postmanService.invitePartner("workspace-id", "partner@company.com", "7")
    .subscribe(result -> System.out.println("Invitation Link: " + result.invitationLink()));

// Invite multiple partners
postmanService.inviteMultiplePartners(
    "workspace-id",
    List.of("partner1@company.com", "partner2@company.com"),
    "7",
    progress -> System.out.printf("Invited %s/%s%n", progress.get("current"), progress.get("total"))
).subscribe();
```

---

### Helper Methods

```java
// Validate API key
postmanService.validateApiKey().subscribe(result -> {
    System.out.println("Valid: " + result.valid());
    System.out.println("User: " + result.user());
});

// Get workspace summary
postmanService.getWorkspaceSummary("workspace-id").subscribe(summary -> {
    System.out.println("Collections: " + summary.counts().get("collections"));
});

// Configuration status
ConfigurationStatus status = postmanService.getConfigurationStatus();
System.out.println("Configured: " + status.isConfigured());
```

---

## API Reference

### Progress Callback

All async methods accept an optional `Consumer<Map<String, Object>>` progress callback:

```java
Consumer<Map<String, Object>> onProgress = progress -> {
    String phase = (String) progress.get("phase");       // validation, workspace, collections, mocks, environments, mockEnv, specs, admins, partners, complete, error
    String message = (String) progress.get("message");   // Human-readable status message
    Integer progressPct = (Integer) progress.get("progress"); // Overall progress percentage (0-100)
    Integer current = (Integer) progress.get("current"); // Current item number
    Integer total = (Integer) progress.get("total");     // Total items
    String currentItem = (String) progress.get("currentItem"); // Name of current item
    Integer deleted = (Integer) progress.get("deleted"); // Number deleted (reset operations)
};
```

### Error Handling

```java
postmanService.provisionWorkspace(options, onProgress)
    .doOnError(error -> System.err.println("Provisioning failed: " + error.getMessage()))
    .subscribe(result -> {
        List<String> errors = result.errors();
        if (!errors.isEmpty()) {
            System.out.println("Some operations failed: " + errors);
        }
    });
```

### REST Controller Example

```java
@RestController
@RequestMapping("/api")
public class WorkspaceController {

    private final PostmanService postmanService;

    public WorkspaceController(PostmanService postmanService) {
        this.postmanService = postmanService;
    }

    @GetMapping("/validate")
    public Mono<ValidateApiKeyResult> validate() {
        return postmanService.validateApiKey();
    }

    @GetMapping("/workspaces/{id}")
    public Mono<Map<String, Object>> getWorkspace(@PathVariable String id) {
        return postmanService.getWorkspace(id);
    }

    @PostMapping("/provision")
    public Mono<ProvisionResult> provision(@RequestBody ProvisionOptions options) {
        return postmanService.provisionWorkspace(options, progress ->
            System.out.println("Progress: " + progress));
    }

    @PostMapping("/reset/{workspaceId}")
    public Mono<ResetResult> reset(@PathVariable String workspaceId) {
        return postmanService.resetWorkspace(workspaceId, null, new ResetOptions(true, true, true, true));
    }
}
```

---

## Workflow Details

### Provisioning Order

1. **Validation** — Verify API key and workspaces
2. **Workspace** — Create or verify target workspace
3. **Collections** — Fork collections (basis for mocks)
4. **Mock Servers** — Create for each collection
5. **Environments** — Copy with original variables
6. **Mock Environment** — Update/create with mock URLs
7. **API Specs** — Copy specification files
8. **Admins** — Add team members as workspace admins
9. **Partners** — Invite partners and generate invitation links

### Reset Order

1. **API Specs** — No dependencies
2. **Mock Servers** — Depend on collections
3. **Environments** — Independent
4. **Collections** — Deleted last

### Rate Limiting

Automatic delays between API calls using `Mono.delayElement()`: Collections (300ms), Mocks (300ms), Environments (300ms), Specs (500ms), Admins (300ms), Partners (300ms).

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid API key" | Verify key is correct, hasn't expired, and has proper permissions |
| "Workspace not found" | Confirm workspace IDs are correct and accessible |
| "Failed to add admin" | Verify user ID, ensure user is on your Postman team |
| "Failed to invite partner" | Check email format, ensure Partner Workspaces are enabled |
| "Spec files not copying" | Confirm specs exist in source, check supported types (OPENAPI:3.0, OPENAPI:3.1, ASYNCAPI:2.0) |
| Bean not found | Ensure component scanning covers `com.postman.sdk.script` |
| WebClient errors | Verify Spring Boot WebFlux starter is on the classpath |

### Prerequisites

- **Java 17+**
- **Spring Boot 3.2+** with WebFlux
- **Jackson** for JSON serialization
