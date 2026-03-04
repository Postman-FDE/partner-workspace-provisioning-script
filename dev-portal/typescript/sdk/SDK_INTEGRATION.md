# Postman TypeScript SDK — Integration Guide

This guide covers **5 methods** for integrating the locally built `@postman/sdk` TypeScript SDK into another project. Each method has different trade-offs around convenience, fidelity, and development workflow.

---

## Prerequisites

All methods assume:

- **Node.js >= 18.0.0** is installed
- You have cloned this repository locally
- You know the absolute or relative path from your consuming project to `dev-portal/typescript/sdk/`

The SDK's only runtime dependency is **`axios ^1.6.0`**. Methods 1–3 handle this automatically via npm; Methods 4–5 require you to install it manually.

---

## Quick Comparison

| Method | Best For | Build Required | Auto-installs `axios` | Reflects SDK Changes |
|--------|----------|:--------------:|:--------------------:|:-------------------:|
| 1. `npm link` | Active development | Yes | No (shared) | After rebuild |
| 2. `file:` protocol | Simple local reference | Yes | Yes | After `npm install` |
| 3. `npm pack` tarball | Pre-publish validation | Yes | Yes | After repack + reinstall |
| 4. Copy built `dist/` | Vendoring compiled output | Yes | No (manual) | After recopy |
| 5. Copy TypeScript source | Prototyping / modifying SDK | No | No (manual) | Immediate |

---

## Method 1: `npm link` (Symlink for Active Development)

Creates a global symlink so your consuming project resolves `@postman/sdk` to the local SDK directory. Ideal when you are actively iterating on the SDK and a consuming project simultaneously.

### Step 1 — Build and register the SDK globally

```bash
cd dev-portal/typescript/sdk
npm install
npm run build
npm link
```

This registers a global symlink for `@postman/sdk` pointing to this directory.

### Step 2 — Link the SDK in your consuming project

```bash
cd /path/to/your-project
npm link @postman/sdk
```

npm creates a symlink at `your-project/node_modules/@postman/sdk` → `dev-portal/typescript/sdk/`.

### Step 3 — Import and use

```typescript
import { PostmanClient, ProvisioningService } from '@postman/sdk';
import type { Workspace } from '@postman/sdk/types';

const client = new PostmanClient({ apiKey: process.env.POSTMAN_API_KEY! });
const { valid, user } = await client.validateApiKey();
```

### Step 4 — Iterate with watch mode (optional)

For a live development loop, run the SDK in watch mode in a separate terminal:

```bash
cd dev-portal/typescript/sdk
npm run dev
```

`tsup --watch` will rebuild the `dist/` output on every source change. Your consuming project picks up the new build immediately since it's symlinked.

### Removing the link

```bash
# In your consuming project
npm unlink @postman/sdk

# Remove the global registration
cd dev-portal/typescript/sdk
npm unlink
```

### Caveats

- Running `npm install` in the consuming project **removes the link**. You will need to re-run `npm link @postman/sdk` after any install.
- Symlinks can cause issues with bundlers that don't follow symlinks (e.g., some Webpack configs). If you encounter module resolution errors, add `resolve.symlinks: true` to your bundler config.
- If both projects depend on `axios`, the symlink may cause duplicate copies. This is usually harmless, but if you see issues, hoist `axios` or deduplicate with `npm dedupe`.

---

## Method 2: `file:` Protocol in `package.json`

Points your consuming project's dependency directly at the local SDK folder using a file path. npm copies (or symlinks, depending on your package manager) the SDK into `node_modules`.

### Step 1 — Build the SDK

```bash
cd dev-portal/typescript/sdk
npm install
npm run build
```

### Step 2 — Add the dependency to your consuming project

Edit your consuming project's `package.json`:

```jsonc
{
  "dependencies": {
    "@postman/sdk": "file:../relative/path/to/dev-portal/typescript"
    // e.g. "file:../../fde-pw-creation-script-fde-org/dev-portal/typescript"
  }
}
```

Then install:

```bash
npm install
```

### Step 3 — Import and use

```typescript
import { PostmanClient, ResetService } from '@postman/sdk';
import type { ProvisioningResult } from '@postman/sdk';

const client = new PostmanClient({ apiKey: process.env.POSTMAN_API_KEY! });
```

### Updating after SDK changes

After making changes to the SDK source:

```bash
# Rebuild the SDK
cd dev-portal/typescript/sdk
npm run build

# Re-install in consuming project to pick up changes
cd /path/to/your-project
npm install
```

### Package manager differences

| Manager | Behavior |
|---------|----------|
| **npm** | Copies the SDK files into `node_modules`. You must `npm install` again to pick up changes. |
| **pnpm** | Creates a symlink by default, so changes are reflected after rebuild without reinstalling. |
| **yarn** | Copies files (similar to npm). Use `yarn install --force` to refresh. |

### Caveats

- The relative path is resolved from the consuming project's `package.json` location. Double-check that the path is correct.
- The `files` field in the SDK's `package.json` controls what gets copied: `dist/` and `README.md`. Source files in `src/` are not included.

---

## Method 3: `npm pack` Tarball (Pre-Publish Validation)

Builds a `.tgz` tarball identical to what `npm publish` would produce, then installs it in your consuming project. This is the most faithful simulation of a real published package.

### Step 1 — Build and pack the SDK

```bash
cd dev-portal/typescript/sdk
npm install
npm run build
npm pack
```

This produces a file named `postman-sdk-1.0.0.tgz` in the `dev-portal/typescript/sdk/` directory.

### Step 2 — Install the tarball in your consuming project

```bash
cd /path/to/your-project
npm install ../relative/path/to/dev-portal/typescript/sdk/postman-sdk-1.0.0.tgz
```

This installs `@postman/sdk` and its dependency (`axios`) into `node_modules`, exactly as if it came from the npm registry.

### Step 3 — Import and use

```typescript
import { PostmanClient, WorkspaceService } from '@postman/sdk';

const client = new PostmanClient({ apiKey: process.env.POSTMAN_API_KEY! });
const workspaces = await client.getWorkspaces();
```

### Updating after SDK changes

```bash
# Rebuild and repack
cd dev-portal/typescript/sdk
npm run build
npm pack

# Reinstall in consuming project
cd /path/to/your-project
npm install ../relative/path/to/dev-portal/typescript/sdk/postman-sdk-1.0.0.tgz
```

### Why use this method?

This catches packaging issues that other methods miss:

- Missing files (the `files` field in `package.json` controls what's included in the tarball)
- Broken `exports` map entries
- Missing runtime dependencies
- Incorrect `main`/`module`/`types` paths

If the tarball installs and works, `npm publish` will too.

### Caveats

- You must repack and reinstall after every SDK change — the slowest feedback loop of all methods.
- The tarball filename includes the version (`1.0.0`). If you bump the version, the filename changes.

---

## Method 4: Copy the Built `dist/` Folder (Vendored Compiled Output)

Copies the compiled SDK output directly into your project as a vendored dependency. No symlinks, no npm resolution — just a local folder with JavaScript and type declarations.

### Step 1 — Build the SDK

```bash
cd dev-portal/typescript/sdk
npm install
npm run build
```

### Step 2 — Copy the SDK into your consuming project

Copy the required files into a `lib/` directory (or any location you prefer):

```bash
mkdir -p /path/to/your-project/lib/postman-sdk

# Copy the compiled output and package.json
cp -r dev-portal/typescript/sdk/dist /path/to/your-project/lib/postman-sdk/
cp dev-portal/typescript/sdk/package.json /path/to/your-project/lib/postman-sdk/
```

Your consuming project should now have:

```
your-project/
├── lib/
│   └── postman-sdk/
│       ├── dist/
│       │   ├── index.js          (CJS)
│       │   ├── index.mjs         (ESM)
│       │   ├── index.d.ts        (types)
│       │   ├── index.d.mts       (types for ESM)
│       │   ├── types/
│       │   │   ├── index.js
│       │   │   ├── index.mjs
│       │   │   └── index.d.ts
│       │   └── ...
│       └── package.json
```

### Step 3 — Install the runtime dependency

The SDK depends on `axios` at runtime. Install it in your consuming project:

```bash
cd /path/to/your-project
npm install axios@^1.6.0
```

### Step 4 — Import and use

You have two import options:

**Option A — Relative path import (no config needed):**

```typescript
// ESM import
import { PostmanClient, ProvisioningService } from './lib/postman-sdk/dist/index.mjs';

// CJS require
const { PostmanClient } = require('./lib/postman-sdk/dist/index.js');
```

**Option B — TypeScript path alias (cleaner imports):**

Add a path mapping in your consuming project's `tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "paths": {
      "@postman/sdk": ["./lib/postman-sdk/dist/index.d.ts"],
      "@postman/sdk/*": ["./lib/postman-sdk/dist/*"]
    }
  }
}
```

Then import as if it were a published package:

```typescript
import { PostmanClient } from '@postman/sdk';
```

> **Note:** TypeScript path aliases only affect type resolution and compilation. If your runtime (Node.js) doesn't understand them, you also need a runtime alias via your bundler (e.g., Webpack `resolve.alias`, Vite `resolve.alias`, or `tsconfig-paths` for Node).

### Updating after SDK changes

```bash
# Rebuild
cd dev-portal/typescript/sdk
npm run build

# Recopy
cp -r dev-portal/typescript/sdk/dist /path/to/your-project/lib/postman-sdk/
```

### Caveats

- You are responsible for keeping the vendored copy in sync with the SDK source.
- Consider adding `lib/postman-sdk/` to `.gitignore` if you don't want to commit vendored files, or **do** commit it if you want the project to be self-contained.
- Source maps in `dist/` reference the original `src/` file paths, which won't exist in your project. Stack traces will still work, but you won't be able to step into SDK source during debugging.

---

## Method 5: Copy the TypeScript Source (Direct Source Integration)

Copies the raw TypeScript source files into your project so they are compiled alongside your own code. No separate build step for the SDK. Best for prototyping or when you want to modify the SDK code directly.

### Step 1 — Copy the SDK source

```bash
mkdir -p /path/to/your-project/lib/postman-sdk

cp -r dev-portal/typescript/sdk/src/* /path/to/your-project/lib/postman-sdk/
```

Your consuming project should now have:

```
your-project/
├── lib/
│   └── postman-sdk/
│       ├── index.ts
│       ├── client/
│       │   ├── index.ts
│       │   ├── HttpClient.ts
│       │   └── PostmanClient.ts
│       ├── services/
│       │   ├── index.ts
│       │   ├── ProvisioningService.ts
│       │   ├── ResetService.ts
│       │   └── WorkspaceService.ts
│       └── types/
│           ├── index.ts
│           ├── collection.ts
│           ├── common.ts
│           ├── environment.ts
│           ├── invitation.ts
│           ├── mock.ts
│           ├── spec.ts
│           └── workspace.ts
```

### Step 2 — Install the runtime dependency

```bash
cd /path/to/your-project
npm install axios@^1.6.0
```

### Step 3 — Verify TypeScript compatibility

The SDK source uses these compiler options — ensure your consuming project's `tsconfig.json` is compatible:

| Option | SDK Value | Requirement |
|--------|-----------|-------------|
| `target` | `ES2022` | Your target must be `ES2022` or later |
| `module` | `ESNext` | Must support ESNext modules |
| `moduleResolution` | `bundler` | Use `bundler` or `node16` |
| `strict` | `true` | Must be enabled (or you'll get type errors) |
| `esModuleInterop` | `true` | Required for axios default import |

If your project uses different settings, you may need to adjust them or create a separate `tsconfig` that extends yours with overrides for the `lib/` directory.

### Step 4 — Include the source in compilation

Make sure your `tsconfig.json` includes the copied files:

```jsonc
{
  "include": [
    "src/**/*",
    "lib/**/*"   // Add this if lib/ is outside your existing include paths
  ]
}
```

### Step 5 — Import and use

```typescript
import { PostmanClient, ProvisioningService } from './lib/postman-sdk';
import type { Workspace, Collection } from './lib/postman-sdk/types';

const client = new PostmanClient({ apiKey: process.env.POSTMAN_API_KEY! });

const provisioner = new ProvisioningService({
  client,
  sourceWorkspaceId: 'source-workspace-id',
  targetWorkspaceName: 'Partner Workspace',
});

const result = await provisioner.provision();
console.log(`Provisioned workspace: ${result.workspaceId}`);
```

### Updating after SDK changes

Simply recopy the source files:

```bash
cp -r dev-portal/typescript/sdk/src/* /path/to/your-project/lib/postman-sdk/
```

Or, if you've made local modifications, manually merge the changes.

### Caveats

- Your project's TypeScript config must be compatible with the SDK's strict settings.
- Any local modifications you make diverge from the upstream SDK. Track these carefully.
- The SDK's `tsconfig.json` enables `noUnusedLocals` and `noUnusedParameters`. If your project doesn't, you may get different behavior.
- This method does **not** produce separate CJS/ESM builds — the output format depends entirely on your consuming project's build pipeline.

---

## Usage Example (All Methods)

Regardless of which integration method you choose, the SDK API is the same:

```typescript
import { PostmanClient, ProvisioningService, ResetService } from '@postman/sdk';
// adjust the import path for Methods 4 and 5

// Initialize the client
const client = new PostmanClient({
  apiKey: process.env.POSTMAN_API_KEY!,
});

// Validate your API key
const { valid, user } = await client.validateApiKey();
console.log(`Authenticated as: ${user.fullName}`);

// List workspaces
const workspaces = await client.getWorkspaces();

// Provision a new workspace from a template
const provisioner = new ProvisioningService({
  client,
  sourceWorkspaceId: 'template-workspace-id',
  targetWorkspaceName: 'My New Workspace',
});
const result = await provisioner.provision();

// Reset a workspace
const resetter = new ResetService({
  client,
  workspaceId: result.workspaceId,
});
await resetter.reset();
```

---

## Troubleshooting

### "Cannot find module '@postman/sdk'"

- **Methods 1–3:** Run `npm install` or `npm link @postman/sdk` again. Check that the dependency appears in `node_modules/@postman/sdk/`.
- **Method 4:** Verify the `dist/` folder was copied correctly and your import path is accurate.
- **Method 5:** Ensure the `lib/` folder is included in your `tsconfig.json`'s `include` array.

### "Cannot find module 'axios'"

The SDK depends on `axios` at runtime. Install it:

```bash
npm install axios@^1.6.0
```

### Type errors from the SDK source (Method 5 only)

The SDK is written with `"strict": true`. If your project uses looser settings, you may see type errors. Either enable strict mode in your project or create a `tsconfig` override:

```jsonc
// tsconfig.sdk.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "strict": true
  },
  "include": ["lib/postman-sdk/**/*"]
}
```

### Exports subpath not resolved

If `import ... from '@postman/sdk/types'` doesn't resolve, ensure your `tsconfig.json` uses `"moduleResolution": "bundler"` or `"node16"`. The legacy `"node"` resolution strategy does not support the `exports` map.
