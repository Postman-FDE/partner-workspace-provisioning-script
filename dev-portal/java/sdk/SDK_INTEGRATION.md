# Postman Java SDK — Integration Guide

This guide covers **5 methods** for integrating the locally built `com.postman:postman-sdk` Java SDK into another project. Each method has different trade-offs around convenience, fidelity, and development workflow.

---

## Prerequisites

All methods assume:

- **Java 17** or later is installed
- **Maven 3.6+** is available (the SDK uses Maven as its build system)
- You have cloned this repository locally
- You know the absolute or relative path from your consuming project to `dev-portal/java/sdk/`

The SDK is built on **Spring Boot 3.2.2** and uses **Spring WebFlux** for reactive HTTP. Key runtime dependencies:

| Dependency | Purpose |
|------------|---------|
| `spring-boot-starter-webflux` | Reactive `WebClient` for HTTP |
| `jackson-databind` + `jackson-datatype-jsr310` | JSON serialization |
| `spring-boot-starter-validation` | Bean validation |
| `lombok` | Boilerplate reduction (compile-time only) |

Methods 1–3 handle transitive dependency resolution automatically via Maven; Methods 4–5 require you to manage dependencies manually.

---

## Quick Comparison

| Method | Best For | Build Required | Auto-resolves deps | Reflects SDK Changes |
|--------|----------|:--------------:|:------------------:|:-------------------:|
| 1. `mvn install` to local repo | Active development | Yes | Yes | After rebuild + reimport |
| 2. System-scope dependency | Quick local reference | Yes | No (manual) | After rebuild |
| 3. Project-local repository | Pre-deploy validation | Yes | Yes | After rebuild + reimport |
| 4. Copy JAR to `lib/` | Vendoring compiled artifact | Yes | No (manual) | After recopy |
| 5. Copy Java source | Prototyping / modifying SDK | No | No (manual) | Immediate (recompile) |

---

## Method 1: `mvn install` to Local Repository (Active Development)

Installs the SDK JAR into your local Maven repository (`~/.m2/repository`) so any Maven project on your machine can reference it as a standard dependency. This is the Java equivalent of `npm link`.

### Step 1 — Build and install to local `.m2`

```bash
cd dev-portal/java/sdk
mvn clean install
```

This compiles the SDK, runs any tests, and installs `com.postman:postman-sdk:1.0.0` into `~/.m2/repository/com/postman/postman-sdk/1.0.0/`.

### Step 2 — Add the dependency to your consuming project

In your consuming project's `pom.xml`:

```xml
<dependency>
    <groupId>com.postman</groupId>
    <artifactId>postman-sdk</artifactId>
    <version>1.0.0</version>
</dependency>
```

Or in `build.gradle`:

```groovy
implementation 'com.postman:postman-sdk:1.0.0'
```

Then reimport/refresh your project in your IDE, or run:

```bash
mvn dependency:resolve
```

### Step 3 — Configure and use

Add the Postman configuration to your `application.yml` (or `application.properties`):

```yaml
postman:
  api-key: ${POSTMAN_API_KEY}
  base-url: https://api.getpostman.com
  timeout-seconds: 30
  max-retries: 3
```

The SDK provides Spring Boot auto-configuration. Inject the client directly:

```java
import com.postman.sdk.client.PostmanClient;
import com.postman.sdk.types.Workspace;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

@Service
public class WorkspaceManager {

    private final PostmanClient client;

    public WorkspaceManager(PostmanClient client) {
        this.client = client;
    }

    public Mono<Workspace> getWorkspace(String workspaceId) {
        return client.getWorkspace(workspaceId);
    }
}
```

### Updating after SDK changes

```bash
# Rebuild and reinstall
cd dev-portal/java/sdk
mvn clean install

# In your consuming project, reimport dependencies
cd /path/to/your-project
mvn dependency:resolve
# or refresh in your IDE (IntelliJ: Ctrl+Shift+O / Cmd+Shift+I)
```

### Caveats

- The version (`1.0.0`) is a SNAPSHOT-less release. If you change the SDK source without bumping the version, Maven may use a cached copy. Force an update with `mvn -U dependency:resolve` or delete the cached artifact: `rm -rf ~/.m2/repository/com/postman/postman-sdk/1.0.0`.
- Using a `-SNAPSHOT` version (e.g., `1.0.0-SNAPSHOT`) avoids the caching issue — Maven always checks for the latest snapshot. Update the `<version>` in both the SDK's `pom.xml` and your consuming project.
- This only works on your local machine. Other developers need to run `mvn install` on their own copies.

---

## Method 2: System-Scope Dependency in `pom.xml`

Points your consuming project's dependency directly at a local JAR file using Maven's `system` scope. The JAR doesn't need to be in any repository.

### Step 1 — Build the SDK JAR

```bash
cd dev-portal/java/sdk
mvn clean package -DskipTests
```

This produces `target/postman-sdk-1.0.0.jar`.

### Step 2 — Reference the JAR in your consuming project

In your consuming project's `pom.xml`:

```xml
<dependency>
    <groupId>com.postman</groupId>
    <artifactId>postman-sdk</artifactId>
    <version>1.0.0</version>
    <scope>system</scope>
    <systemPath>${project.basedir}/../relative/path/to/dev-portal/java/sdk/target/postman-sdk-1.0.0.jar</systemPath>
</dependency>
```

Or use an absolute path:

```xml
<systemPath>/absolute/path/to/dev-portal/java/sdk/target/postman-sdk-1.0.0.jar</systemPath>
```

### Step 3 — Add transitive dependencies manually

System-scoped dependencies do **not** resolve transitive dependencies. You must add the SDK's runtime dependencies to your consuming project's `pom.xml`:

```xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.2.2</version>
</parent>

<dependencies>
    <!-- SDK's runtime dependencies -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-webflux</artifactId>
    </dependency>
    <dependency>
        <groupId>com.fasterxml.jackson.core</groupId>
        <artifactId>jackson-databind</artifactId>
    </dependency>
    <dependency>
        <groupId>com.fasterxml.jackson.datatype</groupId>
        <artifactId>jackson-datatype-jsr310</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>
    <dependency>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <optional>true</optional>
    </dependency>
</dependencies>
```

If your project already uses Spring Boot with the same parent, most of these will already be managed.

### Updating after SDK changes

```bash
# Rebuild the JAR
cd dev-portal/java/sdk
mvn clean package -DskipTests

# Your consuming project picks up the new JAR on next compile
cd /path/to/your-project
mvn compile
```

### Caveats

- **`system` scope is deprecated** in Maven 3.x and may be removed in future versions. Use this only for quick local testing.
- System-scoped dependencies are **not included** in the final packaged artifact (WAR/JAR). Your consuming project's deployed build will be missing the SDK unless you use the `maven-shade-plugin` or `spring-boot-maven-plugin` with explicit inclusion.
- The `systemPath` must be an absolute path or use `${project.basedir}` to resolve relative to the POM. Plain relative paths don't work.

---

## Method 3: Project-Local Maven Repository (Pre-Deploy Validation)

Creates a file-based Maven repository inside your consuming project and installs the SDK JAR there. This is the most portable and reproducible local method — it works on any machine without requiring `mvn install` globally.

### Step 1 — Build the SDK

```bash
cd dev-portal/java/sdk
mvn clean package -DskipTests
```

### Step 2 — Install the JAR into a project-local repository

```bash
cd /path/to/your-project

mvn deploy:deploy-file \
  -Durl=file://$(pwd)/repo \
  -Dfile=/path/to/dev-portal/java/sdk/target/postman-sdk-1.0.0.jar \
  -DgroupId=com.postman \
  -DartifactId=postman-sdk \
  -Dversion=1.0.0 \
  -Dpackaging=jar \
  -DgeneratePom=true
```

This creates a `repo/` directory in your project with the standard Maven layout:

```
your-project/
├── repo/
│   └── com/
│       └── postman/
│           └── postman-sdk/
│               └── 1.0.0/
│                   ├── postman-sdk-1.0.0.jar
│                   └── postman-sdk-1.0.0.pom
├── pom.xml
└── src/
```

### Step 3 — Add the local repository and dependency to your `pom.xml`

```xml
<repositories>
    <repository>
        <id>project-local</id>
        <url>file://${project.basedir}/repo</url>
    </repository>
</repositories>

<dependencies>
    <dependency>
        <groupId>com.postman</groupId>
        <artifactId>postman-sdk</artifactId>
        <version>1.0.0</version>
    </dependency>
</dependencies>
```

For Gradle:

```groovy
repositories {
    maven {
        url = uri("${rootProject.projectDir}/repo")
    }
}

dependencies {
    implementation 'com.postman:postman-sdk:1.0.0'
}
```

### Step 4 — Add transitive dependencies

Since the generated POM doesn't include the SDK's dependencies, you need to declare them in your consuming project (same as Method 2, Step 3). If your project already uses Spring Boot with the WebFlux starter, this is likely already covered.

### Updating after SDK changes

```bash
# Rebuild the SDK
cd dev-portal/java/sdk
mvn clean package -DskipTests

# Re-deploy to the local repo
cd /path/to/your-project
mvn deploy:deploy-file \
  -Durl=file://$(pwd)/repo \
  -Dfile=/path/to/dev-portal/java/sdk/target/postman-sdk-1.0.0.jar \
  -DgroupId=com.postman \
  -DartifactId=postman-sdk \
  -Dversion=1.0.0 \
  -Dpackaging=jar \
  -DgeneratePom=true

# Reimport dependencies
mvn -U dependency:resolve
```

### Why use this method?

- The `repo/` directory can be committed to version control, making the project self-contained.
- Works on any machine with Maven — no global `mvn install` needed.
- Compatible with CI/CD pipelines without needing to publish to a remote repository.

### Caveats

- The generated POM does not include transitive dependencies. Include the SDK's `pom.xml` alongside the JAR (using `-DpomFile`) for full dependency resolution, or declare them explicitly.
- The `repo/` directory adds size to your project. Add it to `.gitignore` if you prefer not to commit it.

---

## Method 4: Copy JAR to `lib/` (Vendored Artifact)

Copies the built JAR directly into your project and configures the build tool to use it from the filesystem. No Maven repository involved.

### Step 1 — Build the SDK JAR

```bash
cd dev-portal/java/sdk
mvn clean package -DskipTests
```

### Step 2 — Copy the JAR into your consuming project

```bash
mkdir -p /path/to/your-project/lib
cp dev-portal/java/sdk/target/postman-sdk-1.0.0.jar /path/to/your-project/lib/
```

Your project structure:

```
your-project/
├── lib/
│   └── postman-sdk-1.0.0.jar
├── pom.xml
└── src/
```

### Step 3 — Reference the JAR in your build

**Maven:**

```xml
<dependency>
    <groupId>com.postman</groupId>
    <artifactId>postman-sdk</artifactId>
    <version>1.0.0</version>
    <scope>system</scope>
    <systemPath>${project.basedir}/lib/postman-sdk-1.0.0.jar</systemPath>
</dependency>
```

**Gradle (preferred — no `system` scope needed):**

```groovy
dependencies {
    implementation files('lib/postman-sdk-1.0.0.jar')
}
```

### Step 4 — Add transitive dependencies

Same as Method 2, Step 3 — add the SDK's runtime dependencies (`spring-boot-starter-webflux`, `jackson-databind`, etc.) to your consuming project.

### Step 5 — Configure Spring Boot packaging (Maven only)

To include the system-scoped JAR in your Spring Boot fat JAR:

```xml
<build>
    <plugins>
        <plugin>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-maven-plugin</artifactId>
            <configuration>
                <includeSystemScope>true</includeSystemScope>
            </configuration>
        </plugin>
    </plugins>
</build>
```

### Updating after SDK changes

```bash
# Rebuild
cd dev-portal/java/sdk
mvn clean package -DskipTests

# Recopy
cp dev-portal/java/sdk/target/postman-sdk-1.0.0.jar /path/to/your-project/lib/
```

### Caveats

- Same deprecation warning as Method 2: `system` scope is deprecated in Maven. Gradle's `files()` dependency has no such issue.
- You must manage transitive dependencies manually.
- Commit the `lib/` folder to version control for self-contained builds, or add it to `.gitignore` and document the build step.

---

## Method 5: Copy Java Source (Direct Source Integration)

Copies the raw Java source files into your project so they are compiled alongside your own code. No separate build step for the SDK. Best for prototyping or when you want to modify the SDK code directly.

### Step 1 — Copy the SDK source

```bash
mkdir -p /path/to/your-project/src/main/java/com/postman/sdk

cp -r dev-portal/java/sdk/src/main/java/com/postman/sdk/* \
  /path/to/your-project/src/main/java/com/postman/sdk/
```

Your consuming project should now have:

```
your-project/
├── src/
│   └── main/
│       └── java/
│           └── com/
│               └── postman/
│                   └── sdk/
│                       ├── client/
│                       │   ├── PostmanApiException.java
│                       │   └── PostmanClient.java
│                       ├── config/
│                       │   ├── PostmanAutoConfiguration.java
│                       │   └── PostmanClientConfig.java
│                       ├── services/
│                       │   ├── ProvisioningService.java
│                       │   ├── ResetService.java
│                       │   └── SpecService.java
│                       └── types/
│                           ├── ApiResponse.java
│                           ├── Collection.java
│                           ├── CurrentUser.java
│                           ├── Environment.java
│                           ├── Invitation.java
│                           ├── MockServer.java
│                           ├── Spec.java
│                           ├── SpecFile.java
│                           ├── Workspace.java
│                           └── WorkspaceRole.java
├── pom.xml
└── ...
```

### Step 2 — Add the SDK's dependencies to your `pom.xml`

Your consuming project needs the same dependencies the SDK uses:

```xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.2.2</version>
    <relativePath/>
</parent>

<properties>
    <java.version>17</java.version>
</properties>

<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-webflux</artifactId>
    </dependency>
    <dependency>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <optional>true</optional>
    </dependency>
    <dependency>
        <groupId>com.fasterxml.jackson.core</groupId>
        <artifactId>jackson-databind</artifactId>
    </dependency>
    <dependency>
        <groupId>com.fasterxml.jackson.datatype</groupId>
        <artifactId>jackson-datatype-jsr310</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-configuration-processor</artifactId>
        <optional>true</optional>
    </dependency>
</dependencies>
```

Ensure the Lombok annotation processor is configured:

```xml
<build>
    <plugins>
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-compiler-plugin</artifactId>
            <version>3.11.0</version>
            <configuration>
                <source>17</source>
                <target>17</target>
                <annotationProcessorPaths>
                    <path>
                        <groupId>org.projectlombok</groupId>
                        <artifactId>lombok</artifactId>
                        <version>${lombok.version}</version>
                    </path>
                </annotationProcessorPaths>
            </configuration>
        </plugin>
    </plugins>
</build>
```

### Step 3 — Enable auto-configuration (Spring Boot projects)

The SDK includes `PostmanAutoConfiguration` which auto-creates `PostmanClient` beans. For Spring Boot to discover it, either:

**Option A — Component scan (if your app's base package is different):**

```java
@SpringBootApplication
@Import(com.postman.sdk.config.PostmanAutoConfiguration.class)
public class YourApplication {
    public static void main(String[] args) {
        SpringApplication.run(YourApplication.class, args);
    }
}
```

**Option B — Component scan includes the package:**

If your application's base package already covers `com.postman.sdk`, the auto-configuration is picked up automatically.

### Step 4 — Import and use

```java
import com.postman.sdk.client.PostmanClient;
import com.postman.sdk.services.ProvisioningService;
import com.postman.sdk.services.ResetService;
import com.postman.sdk.types.Workspace;

@Service
public class WorkspaceManager {

    private final PostmanClient client;
    private final ProvisioningService provisioningService;

    public WorkspaceManager(PostmanClient client) {
        this.client = client;
        this.provisioningService = new ProvisioningService(client);
    }

    public Mono<Workspace> getWorkspace(String workspaceId) {
        return client.getWorkspace(workspaceId);
    }
}
```

### Updating after SDK changes

Simply recopy the source files:

```bash
cp -r dev-portal/java/sdk/src/main/java/com/postman/sdk/* \
  /path/to/your-project/src/main/java/com/postman/sdk/
```

Or, if you've made local modifications, manually merge the changes.

### Caveats

- Your project must use **Java 17** and **Spring Boot 3.x** (the SDK uses Spring Boot 3.2.2 features and Java 17 syntax).
- **Lombok** must be configured in your build tool and IDE. IntelliJ requires the Lombok plugin; VS Code requires the Lombok extension.
- The SDK source lives in the `com.postman.sdk` package. If your project already has classes in this package, there may be naming conflicts.
- Any local modifications diverge from the upstream SDK. Track these carefully.
- The SDK's `PostmanAutoConfiguration` uses `@ConditionalOnProperty(prefix = "postman", name = "api-key")` — make sure the property is set in your `application.yml`.

---

## Usage Example (All Methods)

Regardless of which integration method you choose, the SDK API is the same:

```java
import com.postman.sdk.client.PostmanClient;
import com.postman.sdk.services.ProvisioningService;
import com.postman.sdk.services.ResetService;
import com.postman.sdk.types.Workspace;
import reactor.core.publisher.Mono;

// With Spring Boot auto-configuration (Methods 1-4 with Spring, or Method 5):

@RestController
@RequestMapping("/api")
public class WorkspaceController {

    private final PostmanClient client;

    public WorkspaceController(PostmanClient client) {
        this.client = client;
    }

    @GetMapping("/validate")
    public Mono<Map<String, Object>> validate() {
        return client.validateApiKey();
    }

    @GetMapping("/workspaces")
    public Mono<List<Workspace>> listWorkspaces() {
        return client.getWorkspaces();
    }

    @GetMapping("/workspaces/{id}")
    public Mono<Workspace> getWorkspace(@PathVariable String id) {
        return client.getWorkspace(id);
    }

    @PostMapping("/provision")
    public Mono<Map<String, Object>> provision(@RequestBody ProvisionRequest request) {
        ProvisioningService provisioner = new ProvisioningService(client);
        return provisioner.provision(
            request.getSourceWorkspaceId(),
            request.getWorkspaceName()
        ).doOnNext(result -> log.info("Collection variables updated: {}", 
            result.get("collectionVariables")));
    }

    @PostMapping("/reset/{workspaceId}")
    public Mono<Map<String, Object>> reset(@PathVariable String workspaceId) {
        ResetService resetter = new ResetService(client);
        return resetter.reset(workspaceId);
    }
}
```

### Non-Spring usage (manual client creation)

If you're not using Spring Boot, create the client manually:

```java
import com.postman.sdk.client.PostmanClient;
import com.postman.sdk.config.PostmanClientConfig;
import org.springframework.web.reactive.function.client.WebClient;

PostmanClientConfig config = new PostmanClientConfig();
config.setApiKey(System.getenv("POSTMAN_API_KEY"));
config.setBaseUrl("https://api.getpostman.com");
config.setTimeoutSeconds(30);

WebClient webClient = WebClient.builder()
    .baseUrl(config.getBaseUrl())
    .defaultHeader("X-API-Key", config.getApiKey())
    .build();

PostmanClient client = new PostmanClient(webClient, config);

// Use the client
client.getWorkspaces()
    .doOnNext(workspaces -> System.out.println("Found " + workspaces.size() + " workspaces"))
    .block();
```

---

## Troubleshooting

### "Package com.postman.sdk does not exist"

- **Methods 1, 3:** Verify the SDK is in your local or project-local Maven repository. Run `ls ~/.m2/repository/com/postman/postman-sdk/1.0.0/`.
- **Methods 2, 4:** Verify the JAR path in `<systemPath>` is correct and the JAR exists.
- **Method 5:** Ensure the source files are in the correct package directory (`src/main/java/com/postman/sdk/`).

### "Cannot resolve symbol 'PostmanClient'" in IDE

Reimport your Maven project:
- **IntelliJ:** Right-click `pom.xml` > Maven > Reimport (or Ctrl+Shift+O / Cmd+Shift+I)
- **Eclipse:** Right-click project > Maven > Update Project
- **VS Code:** Run "Java: Clean Language Server Workspace" from the command palette

### "Lombok annotations not processed"

Ensure Lombok is configured:
1. The `lombok` dependency is in your `pom.xml`
2. The `maven-compiler-plugin` has Lombok in `annotationProcessorPaths`
3. Your IDE has Lombok support enabled (IntelliJ: Lombok plugin + "Enable annotation processing" in settings)

### Spring Boot auto-configuration not working

The SDK's `PostmanAutoConfiguration` requires:
1. `postman.api-key` property to be set in `application.yml`/`application.properties`
2. The configuration class to be discoverable — either via component scanning or `@Import`
3. Spring Boot 3.x (the SDK uses Spring Boot 3.2.2)

### Version conflict with Spring Boot

The SDK uses Spring Boot 3.2.2 as its parent. If your consuming project uses a different Spring Boot version, dependency versions may conflict. Align the Spring Boot version in your project's `pom.xml`, or use `<dependencyManagement>` to override specific versions.
