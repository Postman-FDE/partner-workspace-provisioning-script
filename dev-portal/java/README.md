# Postman SDK for Java

A Spring Boot-based Java SDK for the Postman API with reactive WebClient, Java 17 records, and high-level services for workspace provisioning and reset workflows.

## Installation

Add the dependency to your `pom.xml`:

```xml
<dependency>
    <groupId>com.postman</groupId>
    <artifactId>postman-sdk</artifactId>
    <version>1.0.0</version>
</dependency>
```

Or for Gradle:

```groovy
implementation 'com.postman:postman-sdk:1.0.0'
```

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

## Features

- Spring Boot auto-configuration
- Reactive WebClient with Project Reactor
- Java 17 records for immutable DTOs
- Automatic retry with exponential backoff
- High-level services for provisioning and reset workflows

---

## Frontend Integration Patterns

### React (via Spring REST Controllers)

**Spring Boot REST API**

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
    public Mono<ProvisioningService.ProvisioningResult> provision(
        @RequestBody ProvisionRequest request
    ) {
        var config = new ProvisioningService.ProvisioningConfig(
            request.sourceWorkspaceId(),
            null,
            request.targetName(),
            request.adminUserIds(),
            request.partnerEmails(),
            null,
            null
        );
        return provisioningService.provision(config);
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
}
```

**React Frontend**

```tsx
// hooks/usePostman.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/workspaces';

interface Workspace {
  id: string;
  name: string;
  type: string;
}

interface WorkspaceSummary {
  collections: number;
  environments: number;
  mocks: number;
  specs: number;
}

export function useWorkspace(workspaceId: string) {
  return useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: async (): Promise<Workspace> => {
      const res = await fetch(`${API_BASE}/${workspaceId}`);
      if (!res.ok) throw new Error('Failed to fetch workspace');
      return res.json();
    },
  });
}

export function useWorkspaceSummary(workspaceId: string) {
  return useQuery({
    queryKey: ['workspace', workspaceId, 'summary'],
    queryFn: async (): Promise<WorkspaceSummary> => {
      const res = await fetch(`${API_BASE}/${workspaceId}/summary`);
      return res.json();
    },
  });
}

export function useProvision() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      sourceWorkspaceId: string;
      targetName: string;
      adminUserIds?: string[];
      partnerEmails?: string[];
    }) => {
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
```

---

### Angular Integration

**Angular Service**

```typescript
// postman.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Workspace {
  id: string;
  name: string;
  type: string;
}

export interface Collection {
  id: string;
  uid: string;
  name: string;
}

export interface ProvisionRequest {
  sourceWorkspaceId: string;
  targetName: string;
  adminUserIds?: string[];
  partnerEmails?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class PostmanService {
  private readonly baseUrl = '/api/workspaces';

  constructor(private http: HttpClient) {}

  getWorkspace(workspaceId: string): Observable<Workspace> {
    return this.http.get<Workspace>(`${this.baseUrl}/${workspaceId}`);
  }

  getCollections(workspaceId: string): Observable<Collection[]> {
    return this.http.get<Collection[]>(`${this.baseUrl}/${workspaceId}/collections`);
  }

  getSummary(workspaceId: string): Observable<{
    collections: number;
    environments: number;
    mocks: number;
    specs: number;
  }> {
    return this.http.get<any>(`${this.baseUrl}/${workspaceId}/summary`);
  }

  provision(request: ProvisionRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/provision`, request);
  }

  reset(workspaceId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/${workspaceId}/reset`, {});
  }
}

// workspace.component.ts
@Component({
  selector: 'app-workspace',
  template: `
    <div *ngIf="workspace$ | async as workspace">
      <h1>{{ workspace.name }}</h1>
      
      <div *ngIf="summary$ | async as summary">
        <p>Collections: {{ summary.collections }}</p>
        <p>Environments: {{ summary.environments }}</p>
        <p>Mocks: {{ summary.mocks }}</p>
        <p>Specs: {{ summary.specs }}</p>
      </div>
      
      <button (click)="provision()">Provision Clone</button>
    </div>
  `
})
export class WorkspaceComponent implements OnInit {
  workspace$!: Observable<Workspace>;
  summary$!: Observable<any>;
  
  @Input() workspaceId!: string;

  constructor(private postmanService: PostmanService) {}

  ngOnInit() {
    this.workspace$ = this.postmanService.getWorkspace(this.workspaceId);
    this.summary$ = this.postmanService.getSummary(this.workspaceId);
  }

  provision() {
    this.postmanService.provision({
      sourceWorkspaceId: this.workspaceId,
      targetName: 'Cloned Workspace',
    }).subscribe(result => {
      console.log('Provisioned:', result);
    });
  }
}
```

---

### Thymeleaf (Server-Side Templates)

**Controller**

```java
@Controller
@RequestMapping("/workspaces")
public class WorkspaceViewController {

    private final PostmanClient client;
    private final ProvisioningService provisioningService;

    public WorkspaceViewController(PostmanClient client, ProvisioningService provisioningService) {
        this.client = client;
        this.provisioningService = provisioningService;
    }

    @GetMapping("/{workspaceId}")
    public String workspaceDetail(@PathVariable String workspaceId, Model model) {
        // Block for Thymeleaf (or use WebFlux Thymeleaf)
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
        RedirectAttributes redirectAttributes
    ) {
        var config = new ProvisioningService.ProvisioningConfig(
            sourceWorkspaceId,
            null,
            targetName,
            null,
            null,
            null,
            null
        );

        ProvisioningService.ProvisioningResult result = 
            provisioningService.provision(config).block();

        redirectAttributes.addFlashAttribute("result", result);
        redirectAttributes.addFlashAttribute("message", 
            "Created workspace: " + (result.workspace != null ? result.workspace.name() : "Unknown"));

        return "redirect:/workspaces/" + 
            (result.workspace != null ? result.workspace.id() : sourceWorkspaceId);
    }
}
```

**Thymeleaf Template**

```html
<!-- templates/workspace/detail.html -->
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org">
<head>
    <title th:text="${workspace.name}">Workspace</title>
</head>
<body>
    <div th:if="${message}" class="alert" th:text="${message}"></div>

    <h1 th:text="${workspace.name}">Workspace Name</h1>
    <p>Type: <span th:text="${workspace.type}"></span></p>

    <h2>Collections (<span th:text="${#lists.size(collections)}"></span>)</h2>
    <ul>
        <li th:each="collection : ${collections}" th:text="${collection.name}">Collection</li>
    </ul>

    <h2>Environments (<span th:text="${#lists.size(environments)}"></span>)</h2>
    <ul>
        <li th:each="env : ${environments}" th:text="${env.name}">Environment</li>
    </ul>

    <h2>Provision Clone</h2>
    <form method="post" th:action="@{/workspaces/provision}">
        <input type="hidden" name="sourceWorkspaceId" th:value="${workspace.id}">
        <input type="text" name="targetName" placeholder="New workspace name" required>
        <button type="submit">Provision</button>
    </form>
</body>
</html>
```

---

### Vaadin (Full-Stack Java)

**Vaadin View**

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
    private final Button provisionButton = new Button("Provision Clone");

    public WorkspaceView(PostmanClient client, ProvisioningService provisioningService) {
        this.client = client;
        this.provisioningService = provisioningService;
        
        configureGrid();
        configureProvisionForm();
        
        add(title, collectionsGrid, newWorkspaceName, provisionButton);
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

        var config = new ProvisioningService.ProvisioningConfig(
            workspaceId,
            null,
            targetName,
            null,
            null,
            null,
            null
        );

        provisioningService.provision(config)
            .subscribe(result -> {
                getUI().ifPresent(ui -> ui.access(() -> {
                    Notification.show("Created: " + result.workspace.name());
                    newWorkspaceName.clear();
                }));
            });
    }
}
```

---

### HTMX + Spring Boot

**Controller with HTMX Support**

```java
@Controller
@RequestMapping("/htmx/workspaces")
public class HtmxWorkspaceController {

    private final PostmanClient client;

    public HtmxWorkspaceController(PostmanClient client) {
        this.client = client;
    }

    @GetMapping("/{workspaceId}/collections")
    public String getCollections(
        @PathVariable String workspaceId,
        Model model
    ) {
        List<Collection> collections = client.getCollections(workspaceId).block();
        model.addAttribute("collections", collections);
        return "fragments/collections :: list";
    }

    @GetMapping("/{workspaceId}/refresh")
    public String refresh(
        @PathVariable String workspaceId,
        Model model
    ) {
        Workspace workspace = client.getWorkspace(workspaceId).block();
        List<Collection> collections = client.getCollections(workspaceId).block();
        model.addAttribute("workspace", workspace);
        model.addAttribute("collections", collections);
        return "fragments/workspace-content :: content";
    }
}
```

**HTMX Template Fragment**

```html
<!-- templates/fragments/collections.html -->
<ul th:fragment="list" id="collections-list">
    <li th:each="collection : ${collections}" th:text="${collection.name}"></li>
</ul>

<!-- Main page with HTMX -->
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
| `getEnvironments(workspaceId)` | `Mono<List<Environment>>` | Get all environments |
| `getMocks(workspaceId)` | `Mono<List<MockServer>>` | Get all mocks |
| `getSpecs(workspaceId)` | `Mono<List<Spec>>` | Get all specs |
| `invitePartner(workspaceId, email, roleId)` | `Mono<InvitationResult>` | Invite partner |

### ProvisioningService

High-level provisioning workflow.

```java
var config = new ProvisioningService.ProvisioningConfig(
    "source-workspace-id",
    null,  // targetWorkspaceId (null = create new)
    "New Workspace Name",
    List.of("admin-user-id"),
    List.of("partner@example.com"),
    null,  // partnerRoleId
    event -> System.out.println(event.message())
);

Mono<ProvisioningResult> result = provisioningService.provision(config);
```

### ResetService

High-level reset workflow.

```java
var config = new ResetService.ResetConfig(
    "workspace-to-reset",
    event -> System.out.println(event.message())
);

Mono<ResetResult> result = resetService.reset(config);
```

---

## License

MIT
