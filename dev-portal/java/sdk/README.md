# Postman SDK for Java

A Spring Boot-based Java SDK for the Postman API with reactive WebClient, Java 17 records, and high-level services for workspace provisioning and reset workflows.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Available Functions](#available-functions)
- [Provisioning Functions](#provisioning-functions)
  - [ProvisioningService.provision()](#provisioningserviceprovision---full-provisioning)
  - [Custom Provisioning](#custom-provisioning)
- [Reset Functions](#reset-functions)
  - [ResetService.reset()](#resetservicereset---delete-all-or-selected)
  - [ResetService.resetCustom()](#resetserviceresetcustom---delete-specific-items)
- [Team & Partner Management](#team--partner-management)
- [Helper Functions](#helper-functions)
- [Spring MVC + React Integration](#spring-mvc--react-integration)
  - [REST Controllers](#rest-controllers)
  - [Provision Workspace Button (React)](#provision-workspace-button-react)
  - [Collection Selector with Checklist (React)](#collection-selector-with-checklist-react)
- [Thymeleaf Integration](#thymeleaf-integration)
- [Vaadin Integration](#vaadin-integration)
- [HTMX Integration](#htmx-integration)
- [API Reference](#api-reference)
- [Workflow Details](#workflow-details)
- [Troubleshooting](#troubleshooting)

---

## Installation

### Maven

Add the dependency to your `pom.xml`:

```xml
<dependency>
    <groupId>com.postman</groupId>
    <artifactId>postman-workspace-sdk</artifactId>
    <version>1.0.0</version>
</dependency>
```

### Gradle

```groovy
implementation 'com.postman:postman-workspace-sdk:1.0.0'
```

---

## Quick Start

### Spring Boot Auto-Configuration

Add your API key to `application.yml`:

```yaml
postman:
  api-key: ${POSTMAN_API_KEY}
  base-url: https://api.getpostman.com
  timeout-seconds: 30
```

Then inject the client:

```java
@RestController
public class WorkspaceController {
    
    private final PostmanClient client;
    
    public WorkspaceController(PostmanClient client) {
        this.client = client;
    }
    
    @GetMapping("/workspace/{id}")
    public Mono<Workspace> getWorkspace(@PathVariable String id) {
        return client.getWorkspace(id);
    }
}
```

### Manual Configuration

```java
@Configuration
public class PostmanConfig {
    
    @Bean
    public PostmanClient postmanClient() {
        PostmanClientConfig config = new PostmanClientConfig();
        config.setApiKey("your-api-key");
        
        WebClient webClient = WebClient.builder()
            .baseUrl(config.getBaseUrl())
            .defaultHeader("Content-Type", "application/json")
            .defaultHeader("X-Api-Key", config.getApiKey())
            .build();
            
        return new PostmanClient(webClient, config);
    }
}
```

---

## Available Functions

### Function Overview

| Category | Method | Return Type | Purpose |
|----------|--------|-------------|---------|
| **Provisioning** | `ProvisioningService.provision()` | `Mono<ProvisioningResult>` | Complete provisioning |
| **Reset** | `ResetService.reset()` | `Mono<ResetResult>` | Delete resources |
| **Reset** | `ResetService.scanWorkspace()` | `Mono<WorkspaceContents>` | Scan before reset |
| **Workspace** | `client.getWorkspace()` | `Mono<Workspace>` | Get workspace |
| **Workspace** | `client.createWorkspace()` | `Mono<ApiResponse<Workspace>>` | Create workspace |
| **Collections** | `client.getCollections()` | `Mono<List<Collection>>` | Get all collections |
| **Collections** | `client.getCollectionDetails()` | `Mono<CollectionDetails>` | Get collection with variables |
| **Collections** | `client.forkCollection()` | `Mono<ApiResponse<Collection>>` | Fork collection |
| **Collections** | `client.patchCollectionVariables()` | `Mono<ApiResponse<?>>` | Update collection variables |
| **Collections** | `client.deleteCollection()` | `Mono<Boolean>` | Delete collection |
| **Environments** | `client.getEnvironments()` | `Mono<List<Environment>>` | Get environments |
| **Environments** | `client.createEnvironment()` | `Mono<ApiResponse<Environment>>` | Create environment |
| **Mocks** | `client.getMocks()` | `Mono<List<MockServer>>` | Get mock servers |
| **Mocks** | `client.createMock()` | `Mono<ApiResponse<MockServer>>` | Create mock |
| **Specs** | `client.getSpecs()` | `Mono<List<Spec>>` | Get all specs |
| **Specs** | `client.createSpec()` | `Mono<ApiResponse<Spec>>` | Create spec |
| **Partners** | `client.invitePartner()` | `Mono<InvitationResult>` | Invite partner |
| **Team** | `client.addWorkspaceAdmin()` | `Mono<ApiResponse<?>>` | Add admin |
| **Validation** | `client.validateApiKey()` | `Mono<ApiResponse<CurrentUser>>` | Validate key |

---

## Provisioning Functions

### `ProvisioningService.provision()` - Full Provisioning

Copies all collections, creates mocks, copies environments, creates a mock environment with path-resolved mock URLs, patches collection variables to reference the mock environment, copies specs, adds admins, and invites partners.

```java
import com.postman.sdk.services.ProvisioningService;
import com.postman.sdk.services.ProvisioningService.ProvisioningConfig;
import com.postman.sdk.services.ProvisioningService.ProvisioningResult;

@Service
public class WorkspaceManager {
    
    private final ProvisioningService provisioningService;
    
    public WorkspaceManager(ProvisioningService provisioningService) {
        this.provisioningService = provisioningService;
    }
    
    public Mono<ProvisioningResult> createPartnerWorkspace(
        String sourceWorkspaceId,
        String workspaceName,
        List<String> adminUserIds,
        List<String> partnerEmails
    ) {
        var config = new ProvisioningConfig(
            sourceWorkspaceId,
            null,                    // targetWorkspaceId (null = create new)
            workspaceName,
            adminUserIds,
            partnerEmails,
            null,                    // partnerRoleId (default: "7")
            event -> log.info("{}: {}", event.step(), event.message())
        );
        
        return provisioningService.provision(config);
    }
}
```

**Configuration Record:**

```java
public record ProvisioningConfig(
    String sourceWorkspaceId,
    String targetWorkspaceId,        // null = create new workspace
    String targetWorkspaceName,
    List<String> adminUserIds,
    List<String> partnerEmails,
    String partnerRoleId,            // default: "7" (Editor and Partner Lead)
    Consumer<ProgressEvent> onProgress
) {}

public record ProgressEvent(String step, String message) {}
```

**Result Class:**

```java
public static class ProvisioningResult {
    public Workspace workspace;
    public boolean workspaceCreated;
    public ResourceResult collections;
    public ResourceResult mocks;
    public ResourceResult environments;
    public ResourceResult specs;
    public ResourceResult admins;
    public InvitationsResult invitations;
    
    public static class ResourceResult {
        public int total;
        public int success;
        public List<Map<String, String>> failed;
    }
    
    public ResourceResult collectionVariables;
    
    public static class InvitationsResult extends ResourceResult {
        public List<Map<String, String>> links;  // Partner invitation links
    }
}
```

### Custom Provisioning

For selective provisioning, use the ProvisioningService with custom options:

```java
@Service
public class CustomProvisioningService {
    
    private final PostmanClient client;
    
    public Mono<Map<String, Object>> provisionCustom(
        String sourceWorkspaceId,
        String targetWorkspaceId,
        List<String> selectedCollectionUids,
        boolean copyMocks,
        boolean copyEnvironments
    ) {
        return Mono.zip(
            copyCollections(sourceWorkspaceId, targetWorkspaceId, selectedCollectionUids),
            copyMocks ? createMocksForCollections(targetWorkspaceId, selectedCollectionUids) : Mono.just(List.of()),
            copyEnvironments ? copyAllEnvironments(sourceWorkspaceId, targetWorkspaceId) : Mono.just(List.of())
        ).map(tuple -> Map.of(
            "collections", tuple.getT1(),
            "mocks", tuple.getT2(),
            "environments", tuple.getT3()
        ));
    }
    
    private Mono<List<Collection>> copyCollections(
        String sourceId, 
        String targetId, 
        List<String> uids
    ) {
        return client.getCollections(sourceId)
            .flatMapMany(Flux::fromIterable)
            .filter(c -> uids == null || uids.contains(c.uid()))
            .flatMap(c -> client.forkCollection(c.uid(), c.name(), targetId)
                .map(ApiResponse::data))
            .collectList();
    }
}
```

---

## Reset Functions

### `ResetService.reset()` - Delete All or Selected

```java
import com.postman.sdk.services.ResetService;
import com.postman.sdk.services.ResetService.ResetConfig;
import com.postman.sdk.services.ResetService.ResetResult;

@Service
public class WorkspaceResetManager {
    
    private final ResetService resetService;
    
    public Mono<ResetResult> resetWorkspace(String workspaceId) {
        var config = new ResetConfig(
            workspaceId,
            event -> log.info("{}: {}", event.step(), event.message())
        );
        
        return resetService.reset(config);
    }
    
    // Scan workspace before reset
    public Mono<WorkspaceContents> scanWorkspace(String workspaceId) {
        return resetService.scanWorkspace(workspaceId);
    }
}
```

### `ResetService.resetCustom()` - Delete Specific Items

```java
@Service
public class SelectiveResetService {
    
    private final PostmanClient client;
    
    public Mono<Map<String, Integer>> deleteSelectedCollections(
        String workspaceId,
        List<String> collectionUids
    ) {
        return Flux.fromIterable(collectionUids)
            .delayElements(Duration.ofMillis(300))
            .flatMap(uid -> client.deleteCollection(uid))
            .filter(success -> success)
            .count()
            .map(count -> Map.of(
                "total", collectionUids.size(),
                "deleted", count.intValue()
            ));
    }
}
```

---

## Team & Partner Management

### Adding Workspace Admins

```java
@Service
public class TeamManagementService {
    
    private final PostmanClient client;
    
    public Mono<List<AdminResult>> addMultipleAdmins(
        String workspaceId,
        List<String> userIds
    ) {
        return Flux.fromIterable(userIds)
            .delayElements(Duration.ofMillis(300))
            .flatMap(userId -> client.addWorkspaceAdmin(workspaceId, userId)
                .map(result -> new AdminResult(userId, result.success(), result.error())))
            .collectList();
    }
    
    public record AdminResult(String userId, boolean success, String error) {}
}
```

### Inviting Partners

```java
@Service
public class PartnerInvitationService {
    
    private final PostmanClient client;
    
    public Mono<List<InvitationResult>> invitePartners(
        String workspaceId,
        List<String> emails,
        String roleId
    ) {
        return Flux.fromIterable(emails)
            .delayElements(Duration.ofMillis(300))
            .flatMap(email -> client.invitePartner(workspaceId, email, roleId))
            .collectList();
    }
    
    // Get invitation links for display
    public List<Map<String, String>> getInvitationLinks(List<InvitationResult> results) {
        return results.stream()
            .filter(r -> r.success() && r.invitationLink() != null)
            .map(r -> Map.of(
                "email", r.email(),
                "link", r.invitationLink()
            ))
            .toList();
    }
}
```

---

## Spring MVC + React Integration

### REST Controllers

```java
@RestController
@RequestMapping("/api/workspaces")
@CrossOrigin(origins = "http://localhost:3000")
public class WorkspaceApiController {

    private final PostmanClient client;
    private final ProvisioningService provisioningService;
    private final ResetService resetService;

    public WorkspaceApiController(
        PostmanClient client,
        ProvisioningService provisioningService,
        ResetService resetService
    ) {
        this.client = client;
        this.provisioningService = provisioningService;
        this.resetService = resetService;
    }

    @GetMapping("/{workspaceId}")
    public Mono<Workspace> getWorkspace(@PathVariable String workspaceId) {
        return client.getWorkspace(workspaceId);
    }

    @GetMapping("/{workspaceId}/collections")
    public Mono<List<Collection>> getCollections(@PathVariable String workspaceId) {
        return client.getCollections(workspaceId);
    }

    @GetMapping("/{workspaceId}/summary")
    public Mono<WorkspaceSummary> getSummary(@PathVariable String workspaceId) {
        return Mono.zip(
            client.getCollections(workspaceId),
            client.getEnvironments(workspaceId),
            client.getMocks(workspaceId),
            client.getSpecs(workspaceId)
        ).map(tuple -> new WorkspaceSummary(
            tuple.getT1().size(),
            tuple.getT2().size(),
            tuple.getT3().size(),
            tuple.getT4().size()
        ));
    }

    @PostMapping("/provision")
    public Mono<ProvisionResponse> provision(@RequestBody ProvisionRequest request) {
        var config = new ProvisioningService.ProvisioningConfig(
            request.sourceWorkspaceId(),
            null,
            request.targetName(),
            request.adminUserIds(),
            request.partnerEmails(),
            null,
            null
        );
        
        return provisioningService.provision(config)
            .map(result -> new ProvisionResponse(
                result.workspace.id(),
                result.workspace.name(),
                result.collections.success,
                result.mocks.success,
                result.invitations.success,
                result.invitations.links
            ));
    }

    @PostMapping("/{workspaceId}/reset")
    public Mono<ResetService.ResetResult> reset(@PathVariable String workspaceId) {
        var config = new ResetService.ResetConfig(workspaceId, null);
        return resetService.reset(config);
    }

    // DTOs
    record WorkspaceSummary(int collections, int environments, int mocks, int specs) {}
    
    record ProvisionRequest(
        String sourceWorkspaceId,
        String targetName,
        List<String> adminUserIds,
        List<String> partnerEmails
    ) {}
    
    record ProvisionResponse(
        String workspaceId,
        String workspaceName,
        int collectionsCopied,
        int mocksCreated,
        int partnersInvited,
        List<Map<String, String>> invitationLinks
    ) {}
}
```

### Provision Workspace Button (React)

```tsx
// hooks/usePostman.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/workspaces';

interface ProvisionRequest {
  sourceWorkspaceId: string;
  targetName: string;
  adminUserIds?: string[];
  partnerEmails?: string[];
}

interface ProvisionResponse {
  workspaceId: string;
  workspaceName: string;
  collectionsCopied: number;
  mocksCreated: number;
  partnersInvited: number;
  invitationLinks: { email: string; link: string }[];
}

export function useWorkspace(workspaceId: string) {
  return useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/${workspaceId}`);
      if (!res.ok) throw new Error('Failed to fetch workspace');
      return res.json();
    },
  });
}

export function useCollections(workspaceId: string) {
  return useQuery({
    queryKey: ['collections', workspaceId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/${workspaceId}/collections`);
      return res.json();
    },
  });
}

export function useProvision() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: ProvisionRequest): Promise<ProvisionResponse> => {
      const res = await fetch(`${API_BASE}/provision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}

// Component
function PartnerProvisioner({ sourceWorkspaceId }: { sourceWorkspaceId: string }) {
  const [workspaceName, setWorkspaceName] = useState('');
  const [partnerEmails, setPartnerEmails] = useState('');
  const provision = useProvision();

  const handleProvision = () => {
    const emails = partnerEmails.split(',').map(e => e.trim()).filter(Boolean);
    provision.mutate({
      sourceWorkspaceId,
      targetName: workspaceName,
      partnerEmails: emails,
    });
  };

  return (
    <div className="provisioner">
      <h2>Provision Partner Workspace</h2>
      
      <input
        type="text"
        value={workspaceName}
        onChange={(e) => setWorkspaceName(e.target.value)}
        placeholder="Workspace Name"
      />
      
      <input
        type="text"
        value={partnerEmails}
        onChange={(e) => setPartnerEmails(e.target.value)}
        placeholder="Partner Emails (comma-separated)"
      />
      
      <button onClick={handleProvision} disabled={provision.isPending}>
        {provision.isPending ? 'Provisioning...' : 'Provision'}
      </button>
      
      {provision.data && (
        <div className="results">
          <h3>Success!</h3>
          <p>Workspace: {provision.data.workspaceName}</p>
          <p>Collections: {provision.data.collectionsCopied}</p>
          <p>Partners Invited: {provision.data.partnersInvited}</p>
          
          {provision.data.invitationLinks.length > 0 && (
            <div>
              <h4>Partner Invitation Links</h4>
              <ul>
                {provision.data.invitationLinks.map((invite, i) => (
                  <li key={i}>
                    <strong>{invite.email}:</strong>
                    <a href={invite.link} target="_blank">{invite.link}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### Collection Selector with Checklist (React)

```tsx
interface Collection {
  id: string;
  uid: string;
  name: string;
}

function CollectionSelector({ 
  sourceWorkspaceId, 
  targetWorkspaceId 
}: { 
  sourceWorkspaceId: string;
  targetWorkspaceId: string;
}) {
  const { data: collections = [], isLoading } = useCollections(sourceWorkspaceId);
  const [selected, setSelected] = useState<string[]>([]);
  const [provisioning, setProvisioning] = useState(false);
  const [results, setResults] = useState<any>(null);

  const toggleCollection = (uid: string) => {
    setSelected(prev =>
      prev.includes(uid)
        ? prev.filter(id => id !== uid)
        : [...prev, uid]
    );
  };

  const handleProvision = async () => {
    setProvisioning(true);
    try {
      const res = await fetch('/api/workspaces/provision/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceWorkspaceId,
          targetWorkspaceId,
          selectedCollectionUids: selected,
          copyMocks: true,
        }),
      });
      setResults(await res.json());
    } finally {
      setProvisioning(false);
    }
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="collection-selector">
      <h2>Select Collections to Copy</h2>
      
      <div className="actions">
        <button onClick={() => setSelected(collections.map(c => c.uid))}>
          Select All
        </button>
        <button onClick={() => setSelected([])}>
          Select None
        </button>
        <span>{selected.length} of {collections.length} selected</span>
      </div>
      
      <div className="collection-list">
        {collections.map((c: Collection) => (
          <div key={c.uid} className="collection-item">
            <label>
              <input
                type="checkbox"
                checked={selected.includes(c.uid)}
                onChange={() => toggleCollection(c.uid)}
              />
              {c.name}
            </label>
          </div>
        ))}
      </div>

      <button
        onClick={handleProvision}
        disabled={provisioning || selected.length === 0}
      >
        {provisioning ? 'Provisioning...' : `Provision ${selected.length} Collection(s)`}
      </button>

      {results && (
        <div className="results">
          <p>Copied {results.collectionsCopied} collections</p>
          <p>Created {results.mocksCreated} mocks</p>
        </div>
      )}
    </div>
  );
}
```

---

## Thymeleaf Integration

### Controller

```java
@Controller
@RequestMapping("/workspaces")
public class WorkspaceViewController {

    private final PostmanClient client;
    private final ProvisioningService provisioningService;

    @GetMapping("/{workspaceId}")
    public String workspaceDetail(@PathVariable String workspaceId, Model model) {
        Workspace workspace = client.getWorkspace(workspaceId).block();
        List<Collection> collections = client.getCollections(workspaceId).block();
        List<Environment> environments = client.getEnvironments(workspaceId).block();

        model.addAttribute("workspace", workspace);
        model.addAttribute("collections", collections);
        model.addAttribute("environments", environments);

        return "workspace/detail";
    }

    @PostMapping("/provision")
    public String provision(
        @RequestParam String sourceWorkspaceId,
        @RequestParam String targetName,
        @RequestParam(required = false) String partnerEmails,
        RedirectAttributes redirectAttributes
    ) {
        List<String> emails = partnerEmails != null
            ? Arrays.stream(partnerEmails.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList()
            : null;

        var config = new ProvisioningService.ProvisioningConfig(
            sourceWorkspaceId, null, targetName,
            null, emails, null, null
        );

        ProvisioningService.ProvisioningResult result = 
            provisioningService.provision(config).block();

        redirectAttributes.addFlashAttribute("result", result);
        redirectAttributes.addFlashAttribute("invitationLinks", result.invitations.links);

        return "redirect:/workspaces/" + result.workspace.id();
    }
}
```

### Template

```html
<!-- templates/workspace/detail.html -->
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org">
<head>
    <title th:text="${workspace.name}">Workspace</title>
</head>
<body>
    <div th:if="${result}" class="alert alert-success">
        <h4>Provisioning Complete!</h4>
        <p>Created workspace: <span th:text="${result.workspace.name}"></span></p>
        <p>Collections: <span th:text="${result.collections.success}"></span>/<span th:text="${result.collections.total}"></span></p>
        
        <div th:if="${invitationLinks != null and !invitationLinks.isEmpty()}">
            <h5>Partner Invitation Links</h5>
            <ul>
                <li th:each="invite : ${invitationLinks}">
                    <strong th:text="${invite.email}"></strong>: 
                    <a th:href="${invite.link}" target="_blank" th:text="${invite.link}"></a>
                </li>
            </ul>
        </div>
    </div>

    <h1 th:text="${workspace.name}">Workspace Name</h1>
    <p>Type: <span th:text="${workspace.type}"></span></p>

    <h2>Collections (<span th:text="${#lists.size(collections)}"></span>)</h2>
    <ul>
        <li th:each="collection : ${collections}" th:text="${collection.name}">Collection</li>
    </ul>

    <h2>Provision Clone</h2>
    <form method="post" th:action="@{/workspaces/provision}">
        <input type="hidden" name="sourceWorkspaceId" th:value="${workspace.id}">
        
        <div class="form-group">
            <label>New workspace name:</label>
            <input type="text" name="targetName" placeholder="Partner Workspace" required>
        </div>
        
        <div class="form-group">
            <label>Partner emails (comma-separated):</label>
            <input type="text" name="partnerEmails" placeholder="partner@company.com">
        </div>
        
        <button type="submit">Provision</button>
    </form>
</body>
</html>
```

---

## Vaadin Integration

```java
@Route("workspace/:workspaceId")
@PageTitle("Workspace Details")
public class WorkspaceView extends VerticalLayout implements BeforeEnterObserver {

    private final PostmanClient client;
    private final ProvisioningService provisioningService;
    
    private String workspaceId;
    private final H1 title = new H1();
    private final Grid<Collection> collectionsGrid = new Grid<>(Collection.class);
    private final TextField newWorkspaceName = new TextField("New Workspace Name");
    private final TextField partnerEmails = new TextField("Partner Emails (comma-separated)");
    private final Button provisionButton = new Button("Provision");

    public WorkspaceView(PostmanClient client, ProvisioningService provisioningService) {
        this.client = client;
        this.provisioningService = provisioningService;
        
        configureGrid();
        configureProvisionForm();
        
        add(title, collectionsGrid, newWorkspaceName, partnerEmails, provisionButton);
    }

    @Override
    public void beforeEnter(BeforeEnterEvent event) {
        workspaceId = event.getRouteParameters().get("workspaceId").orElse("");
        loadData();
    }

    private void configureGrid() {
        collectionsGrid.setColumns("name", "uid");
        collectionsGrid.setHeight("300px");
    }

    private void configureProvisionForm() {
        provisionButton.addClickListener(e -> provision());
        provisionButton.addThemeVariants(ButtonVariant.LUMO_PRIMARY);
    }

    private void loadData() {
        client.getWorkspace(workspaceId)
            .subscribe(workspace -> {
                getUI().ifPresent(ui -> ui.access(() -> {
                    title.setText(workspace.name());
                }));
            });

        client.getCollections(workspaceId)
            .subscribe(collections -> {
                getUI().ifPresent(ui -> ui.access(() -> {
                    collectionsGrid.setItems(collections);
                }));
            });
    }

    private void provision() {
        String targetName = newWorkspaceName.getValue();
        if (targetName.isEmpty()) {
            Notification.show("Please enter a name");
            return;
        }

        List<String> emails = Arrays.stream(partnerEmails.getValue().split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .toList();

        var config = new ProvisioningService.ProvisioningConfig(
            workspaceId, null, targetName,
            null, emails.isEmpty() ? null : emails, null, null
        );

        provisioningService.provision(config)
            .subscribe(result -> {
                getUI().ifPresent(ui -> ui.access(() -> {
                    Notification.show("Created: " + result.workspace.name());
                    
                    if (!result.invitations.links.isEmpty()) {
                        Dialog dialog = new Dialog();
                        dialog.setHeaderTitle("Partner Invitation Links");
                        
                        VerticalLayout content = new VerticalLayout();
                        for (var link : result.invitations.links) {
                            content.add(new Anchor(link.get("link"), link.get("email")));
                        }
                        dialog.add(content);
                        dialog.open();
                    }
                    
                    newWorkspaceName.clear();
                    partnerEmails.clear();
                }));
            });
    }
}
```

---

## HTMX Integration

### Controller

```java
@Controller
@RequestMapping("/htmx/workspaces")
public class HtmxWorkspaceController {

    private final PostmanClient client;
    private final ProvisioningService provisioningService;

    @GetMapping("/{workspaceId}/collections")
    public String getCollections(@PathVariable String workspaceId, Model model) {
        List<Collection> collections = client.getCollections(workspaceId).block();
        model.addAttribute("collections", collections);
        return "fragments/collections :: list";
    }

    @PostMapping("/provision")
    public String provision(
        @RequestParam String sourceWorkspaceId,
        @RequestParam String targetName,
        @RequestParam(required = false) String partnerEmails,
        Model model
    ) {
        List<String> emails = partnerEmails != null
            ? Arrays.stream(partnerEmails.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList()
            : null;

        var config = new ProvisioningService.ProvisioningConfig(
            sourceWorkspaceId, null, targetName,
            null, emails, null, null
        );

        var result = provisioningService.provision(config).block();
        
        model.addAttribute("result", result);
        model.addAttribute("invitationLinks", result.invitations.links);
        
        return "fragments/provision-result :: result";
    }
}
```

### Templates

```html
<!-- templates/workspace.html -->
<div id="workspace-content">
    <h1 th:text="${workspace.name}"></h1>
    
    <button 
        hx-get="/htmx/workspaces/${workspace.id}/refresh"
        hx-target="#workspace-content"
        hx-swap="innerHTML">
        Refresh
    </button>
    
    <h2>Collections</h2>
    <div 
        hx-get="/htmx/workspaces/${workspace.id}/collections"
        hx-trigger="load"
        hx-swap="innerHTML">
        Loading...
    </div>
    
    <h2>Provision</h2>
    <form 
        hx-post="/htmx/workspaces/provision"
        hx-target="#provision-result"
        hx-swap="innerHTML">
        <input type="hidden" name="sourceWorkspaceId" th:value="${workspace.id}">
        <input type="text" name="targetName" placeholder="Workspace Name" required>
        <input type="text" name="partnerEmails" placeholder="partner@company.com">
        <button type="submit">Provision</button>
    </form>
    
    <div id="provision-result"></div>
</div>

<!-- templates/fragments/provision-result.html -->
<div th:fragment="result" class="provision-result">
    <h3>Provisioning Complete!</h3>
    <p>Workspace: <span th:text="${result.workspace.name}"></span></p>
    <p>Collections: <span th:text="${result.collections.success}"></span></p>
    
    <div th:if="${invitationLinks != null and !invitationLinks.isEmpty()}">
        <h4>Partner Invitation Links</h4>
        <ul>
            <li th:each="link : ${invitationLinks}">
                <strong th:text="${link.email}"></strong>:
                <a th:href="${link.link}" target="_blank" th:text="${link.link}"></a>
            </li>
        </ul>
    </div>
</div>
```

---

## API Reference

### PostmanClient

Main SDK client with reactive methods.

| Method | Return Type | Description |
|--------|-------------|-------------|
| `validateApiKey()` | `Mono<ApiResponse<CurrentUser>>` | Validate API key |
| `getWorkspace(id)` | `Mono<Workspace>` | Get workspace details |
| `createWorkspace(name, type, desc)` | `Mono<ApiResponse<Workspace>>` | Create workspace |
| `getCollections(workspaceId)` | `Mono<List<Collection>>` | Get all collections |
| `forkCollection(uid, label, targetId)` | `Mono<ApiResponse<Collection>>` | Fork a collection |
| `getCollectionDetails(collectionUid)` | `Mono<CollectionDetails>` | Get collection with variables |
| `patchCollectionVariables(collectionUid, variables)` | `Mono<ApiResponse<?>>` | Update collection variables |
| `deleteCollection(uid)` | `Mono<Boolean>` | Delete collection |
| `getEnvironments(workspaceId)` | `Mono<List<Environment>>` | Get all environments |
| `createEnvironment(name, values, wsId)` | `Mono<ApiResponse<Environment>>` | Create environment |
| `getMocks(workspaceId)` | `Mono<List<MockServer>>` | Get all mocks |
| `createMock(name, collectionUid, wsId)` | `Mono<ApiResponse<MockServer>>` | Create mock |
| `deleteMock(mockId)` | `Mono<Boolean>` | Delete mock |
| `getSpecs(workspaceId)` | `Mono<List<Spec>>` | Get all specs |
| `createSpec(wsId, name, type, files)` | `Mono<ApiResponse<Spec>>` | Create spec |
| `deleteSpec(specId)` | `Mono<ApiResponse<?>>` | Delete spec |
| `invitePartner(wsId, email, roleId)` | `Mono<InvitationResult>` | Invite partner |
| `addWorkspaceAdmin(wsId, userId)` | `Mono<ApiResponse<?>>` | Add admin |

---

## Workflow Details

### Provisioning Order

| Step | Phase | Description |
|------|-------|-------------|
| 1 | Validation | Verify API key and workspaces |
| 2 | Workspace | Create or verify target workspace |
| 3 | Collections | Fork collections (basis for mocks) |
| 4 | Mock Servers | Create for each collection |
| 5 | Environments | Copy with original variables |
| 6 | Mock Environment | Create/update env with path-resolved mock URLs (e.g., `directDebitsApiBaseUrl`) |
| 7 | Update Collection Variables | Patch forked collections to reference mock env variables |
| 8 | API Specs | Copy specification files |
| 9 | Admins | Add team members as workspace admins |
| 10 | Partners | Invite partners and generate invitation links |

### Reset Order

| Step | Phase | Reason |
|------|-------|--------|
| 1 | API Specs | No dependencies |
| 2 | Mock Servers | Depend on collections |
| 3 | Environments | Independent |
| 4 | Collections | Deleted last |

### Rate Limiting

| Operation | Delay |
|-----------|-------|
| Collections | 300ms |
| Mocks | 300ms |
| Environments | 300ms |
| Specs | 500ms |
| Admins | 300ms |
| Partners | 300ms |

---

## Troubleshooting

### Common Issues

#### "Invalid API key"
- Verify your API key is correct and hasn't expired
- Check that the key has appropriate permissions
- Generate a new key at [Postman Account Settings](https://go.postman.co/settings/me/api-keys)

#### "Workspace not found"
- Confirm workspace IDs are correct
- Ensure you have access to the workspace

#### "Failed to add admin"
- Verify the user ID is correct
- Ensure the user is part of your Postman team

#### "Failed to invite partner"
- Verify the email address format
- Check that your team has Partner Workspaces enabled

#### "Spec files not copying"
- Confirm specs exist in source workspace
- Verify spec type is supported (OPENAPI:3.0, OPENAPI:3.1, ASYNCAPI:2.0)

### Partner Role Reference

| Role ID | Name | Description |
|---------|------|-------------|
| `4` | Partner Viewer | Read-only access |
| `7` | Editor and Partner Lead | Full editing access |

---

## License

MIT
