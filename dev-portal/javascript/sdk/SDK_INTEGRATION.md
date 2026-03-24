# Postman JavaScript SDK — Integration Guide

This guide covers **5 methods** for integrating the locally built `@postman/workspace-sdk` JavaScript SDK into another project. Each method has different trade-offs around convenience, fidelity, and development workflow.

---

## Prerequisites

All methods assume:

- **Node.js >= 18.0.0** is installed
- You have cloned this repository locally
- You know the absolute or relative path from your consuming project to `dev-portal/javascript/sdk/`

The SDK has two runtime dependencies: **`axios ^1.6.0`** and **`dotenv ^16.3.1`**. Methods 1–3 handle these automatically via npm; Methods 4–5 require you to install them manually.

---

## Quick Comparison

| Method | Best For | Build Required | Auto-installs deps | Reflects SDK Changes |
|--------|----------|:--------------:|:------------------:|:-------------------:|
| 1. `npm link` | Active development | Yes | No (shared) | After rebuild |
| 2. `file:` protocol | Simple local reference | Yes | Yes | After `npm install` |
| 3. `npm pack` tarball | Pre-publish validation | Yes | Yes | After repack + reinstall |
| 4. Copy built `dist/` | Vendoring compiled output | Yes | No (manual) | After recopy |
| 5. Copy JavaScript source | Prototyping / modifying SDK | No | No (manual) | Immediate |

---

## Method 1: `npm link` (Symlink for Active Development)

Creates a global symlink so your consuming project resolves `@postman/workspace-sdk` to the local SDK directory. Ideal when you are actively iterating on the SDK and a consuming project simultaneously.

### Step 1 — Build and register the SDK globally

```bash
cd dev-portal/javascript/sdk
npm install
npm run build
npm link
```

This registers a global symlink for `@postman/workspace-sdk` pointing to this directory.

### Step 2 — Link the SDK in your consuming project

```bash
cd /path/to/your-project
npm link @postman/workspace-sdk
```

npm creates a symlink at `your-project/node_modules/@postman/workspace-sdk` → `dev-portal/javascript/sdk/`.

### Step 3 — Import and use

```javascript
import { PostmanClient, ProvisioningService } from '@postman/workspace-sdk';

const client = new PostmanClient({
  apiKey: process.env.POSTMAN_API_KEY,
});
const { valid, user } = await client.validateApiKey();
```

Or use the convenience functions:

```javascript
import { provisionWorkspace, validateApiKey } from '@postman/workspace-sdk';

const { valid, user } = await validateApiKey();
```

### Step 4 — Iterate with watch mode (optional)

For a live development loop, run the SDK in watch mode in a separate terminal:

```bash
cd dev-portal/javascript/sdk
npm run dev
```

Rollup's watch mode will rebuild the `dist/` output on every source change. Your consuming project picks up the new build immediately since it's symlinked.

### Removing the link

```bash
# In your consuming project
npm unlink @postman/workspace-sdk

# Remove the global registration
cd dev-portal/javascript/sdk
npm unlink
```

### Caveats

- Running `npm install` in the consuming project **removes the link**. You will need to re-run `npm link @postman/workspace-sdk` after any install.
- Symlinks can cause issues with bundlers that don't follow symlinks (e.g., some Webpack configs). If you encounter module resolution errors, add `resolve.symlinks: true` to your bundler config.
- If both projects depend on `axios` or `dotenv`, the symlink may cause duplicate copies. This is usually harmless, but if you see issues, hoist shared dependencies or deduplicate with `npm dedupe`.

---

## Method 2: `file:` Protocol in `package.json`

Points your consuming project's dependency directly at the local SDK folder using a file path. npm copies (or symlinks, depending on your package manager) the SDK into `node_modules`.

### Step 1 — Build the SDK

```bash
cd dev-portal/javascript/sdk
npm install
npm run build
```

### Step 2 — Add the dependency to your consuming project

Edit your consuming project's `package.json`:

```jsonc
{
  "dependencies": {
    "@postman/workspace-sdk": "file:../relative/path/to/dev-portal/javascript"
    // e.g. "file:../../fde-pw-creation-script-fde-org/dev-portal/javascript"
  }
}
```

Then install:

```bash
npm install
```

### Step 3 — Import and use

```javascript
import { PostmanClient, provisionWorkspace } from '@postman/workspace-sdk';

const client = new PostmanClient({ apiKey: process.env.POSTMAN_API_KEY });
```

### Updating after SDK changes

After making changes to the SDK source:

```bash
# Rebuild the SDK
cd dev-portal/javascript/sdk
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
- The `files` field in the SDK's `package.json` controls what gets copied: `dist/` and `src/`. Source files are included in this SDK.

---

## Method 3: `npm pack` Tarball (Pre-Publish Validation)

Builds a `.tgz` tarball identical to what `npm publish` would produce, then installs it in your consuming project. This is the most faithful simulation of a real published package.

### Step 1 — Build and pack the SDK

```bash
cd dev-portal/javascript/sdk
npm install
npm run build
npm pack
```

This produces a file named `postman-workspace-sdk-1.0.0.tgz` in the `dev-portal/javascript/sdk/` directory.

### Step 2 — Install the tarball in your consuming project

```bash
cd /path/to/your-project
npm install ../relative/path/to/dev-portal/javascript/sdk/postman-workspace-sdk-1.0.0.tgz
```

This installs `@postman/workspace-sdk` and its dependencies (`axios`, `dotenv`) into `node_modules`, exactly as if it came from the npm registry.

### Step 3 — Import and use

```javascript
import { PostmanClient, WorkspaceService, resetWorkspace } from '@postman/workspace-sdk';

const client = new PostmanClient({ apiKey: process.env.POSTMAN_API_KEY });
const workspaces = await client.getWorkspaces();
```

### Updating after SDK changes

```bash
# Rebuild and repack
cd dev-portal/javascript/sdk
npm run build
npm pack

# Reinstall in consuming project
cd /path/to/your-project
npm install ../relative/path/to/dev-portal/javascript/sdk/postman-workspace-sdk-1.0.0.tgz
```

### Why use this method?

This catches packaging issues that other methods miss:

- Missing files (the `files` field in `package.json` controls what's included in the tarball)
- Broken `exports` map entries
- Missing runtime dependencies
- Incorrect `main`/`module` paths

If the tarball installs and works, `npm publish` will too.

### Caveats

- You must repack and reinstall after every SDK change — the slowest feedback loop of all methods.
- The tarball filename includes the version (`1.0.0`). If you bump the version, the filename changes.

---

## Method 4: Copy the Built `dist/` Folder (Vendored Compiled Output)

Copies the compiled SDK output directly into your project as a vendored dependency. No symlinks, no npm resolution — just a local folder with JavaScript bundles.

### Step 1 — Build the SDK

```bash
cd dev-portal/javascript/sdk
npm install
npm run build
```

### Step 2 — Copy the SDK into your consuming project

Copy the required files into a `lib/` directory (or any location you prefer):

```bash
mkdir -p /path/to/your-project/lib/postman-sdk

# Copy the compiled output and package.json
cp -r dev-portal/javascript/sdk/dist /path/to/your-project/lib/postman-sdk/
cp dev-portal/javascript/sdk/package.json /path/to/your-project/lib/postman-sdk/
```

Your consuming project should now have:

```
your-project/
├── lib/
│   └── postman-sdk/
│       ├── dist/
│       │   ├── index.js          (ESM)
│       │   ├── index.js.map      (source map)
│       │   ├── index.cjs         (CommonJS)
│       │   └── index.cjs.map     (source map)
│       └── package.json
```

### Step 3 — Install the runtime dependencies

The SDK depends on `axios` and `dotenv` at runtime. Install them in your consuming project:

```bash
cd /path/to/your-project
npm install axios@^1.6.0 dotenv@^16.3.1
```

### Step 4 — Import and use

```javascript
// ESM import
import { PostmanClient, ProvisioningService } from './lib/postman-sdk/dist/index.js';

// CommonJS require
const { PostmanClient } = require('./lib/postman-sdk/dist/index.cjs');
```

### Updating after SDK changes

```bash
# Rebuild
cd dev-portal/javascript/sdk
npm run build

# Recopy
cp -r dev-portal/javascript/sdk/dist /path/to/your-project/lib/postman-sdk/
```

### Caveats

- You are responsible for keeping the vendored copy in sync with the SDK source.
- Consider adding `lib/postman-sdk/` to `.gitignore` if you don't want to commit vendored files, or **do** commit it if you want the project to be self-contained.
- Source maps in `dist/` reference the original `src/` file paths, which won't exist in your project. Stack traces will still work, but you won't be able to step into SDK source during debugging.

---

## Method 5: Copy the JavaScript Source (Direct Source Integration)

Copies the raw JavaScript source files into your project. No separate build step for the SDK. Best for prototyping or when you want to modify the SDK code directly.

### Step 1 — Copy the SDK source

```bash
mkdir -p /path/to/your-project/lib/postman-sdk

cp -r dev-portal/javascript/sdk/src/* /path/to/your-project/lib/postman-sdk/
```

Your consuming project should now have:

```
your-project/
├── lib/
│   └── postman-sdk/
│       ├── index.js
│       ├── client/
│       │   ├── index.js
│       │   ├── HttpClient.js
│       │   └── PostmanClient.js
│       ├── services/
│       │   ├── index.js
│       │   ├── WorkspaceService.js
│       │   ├── ProvisioningService.js
│       │   └── ResetService.js
│       └── helpers/
│           ├── index.js
│           └── utils.js
```

### Step 2 — Install the runtime dependencies

```bash
cd /path/to/your-project
npm install axios@^1.6.0 dotenv@^16.3.1
```

### Step 3 — Verify module compatibility

The SDK source uses ES module syntax (`import`/`export`). Ensure your consuming project supports ESM:

- Your `package.json` should include `"type": "module"`, **or**
- Rename the copied files to `.mjs`, **or**
- Use a bundler that handles ESM (Webpack, Vite, Rollup, esbuild)

### Step 4 — Import and use

```javascript
import { PostmanClient, ProvisioningService } from './lib/postman-sdk/index.js';

const client = new PostmanClient({ apiKey: process.env.POSTMAN_API_KEY });

const provisioner = new ProvisioningService(client);
const result = await provisioner.provision({
  sourceWorkspaceId: 'source-workspace-id',
  workspaceName: 'Partner Workspace',
});

console.log(`Provisioned workspace: ${result.workspaceId}`);
```

Or use the convenience functions:

```javascript
import { provisionWorkspace, resetWorkspace, validateApiKey } from './lib/postman-sdk/index.js';

const { valid, user } = await validateApiKey();
const result = await provisionWorkspace({
  sourceWorkspaceId: 'source-workspace-id',
  workspaceName: 'Partner Workspace',
  partnerEmails: ['partner@company.com'],
});
```

### Updating after SDK changes

Simply recopy the source files:

```bash
cp -r dev-portal/javascript/sdk/src/* /path/to/your-project/lib/postman-sdk/
```

Or, if you've made local modifications, manually merge the changes.

### Caveats

- Your project must support ES module syntax (the source uses `import`/`export`).
- Any local modifications you make diverge from the upstream SDK. Track these carefully.
- This method does **not** produce separate ESM/CJS builds — the output format depends entirely on your consuming project's configuration.
- The `jsconfig.json` path aliases (`@client/*`, `@services/*`, `@helpers/*`) used in the SDK source will not work in your project. If the source files use these aliases internally, you may need to rewrite them to relative paths.

---

## Usage Example (All Methods)

Regardless of which integration method you choose, the SDK API is the same:

```javascript
import {
  PostmanClient,
  ProvisioningService,
  ResetService,
  provisionWorkspace,
  resetWorkspace,
  validateApiKey,
} from '@postman/workspace-sdk';
// adjust the import path for Methods 4 and 5

// --- Convenience functions ---

const { valid, user } = await validateApiKey();
console.log(`Authenticated as: ${user?.username}`);

const result = await provisionWorkspace({
  sourceWorkspaceId: 'template-workspace-id',
  workspaceName: 'My New Workspace',
  partnerEmails: ['partner@company.com'],
}, (progress) => {
  console.log(`${progress.phase}: ${progress.message}`);
});

console.log('Invitation links:', result.invitations.links);
console.log('Collection variables updated:', result.collectionVariables.success);

// --- Class-based usage ---

const client = new PostmanClient({ apiKey: process.env.POSTMAN_API_KEY });

const provisioner = new ProvisioningService(client);
const provisionResult = await provisioner.provision({
  sourceWorkspaceId: 'template-workspace-id',
  workspaceName: 'My New Workspace',
});

const resetter = new ResetService(client);
await resetter.reset('workspace-id');
```

---

## Troubleshooting

### "Cannot find module '@postman/workspace-sdk'"

- **Methods 1–3:** Run `npm install` or `npm link @postman/workspace-sdk` again. Check that the dependency appears in `node_modules/@postman/workspace-sdk/`.
- **Method 4:** Verify the `dist/` folder was copied correctly and your import path is accurate.
- **Method 5:** Ensure your import path points to the correct location (e.g., `./lib/postman-sdk/index.js`).

### "Cannot find module 'axios'" or "Cannot find module 'dotenv'"

The SDK depends on `axios` and `dotenv` at runtime. Install them:

```bash
npm install axios@^1.6.0 dotenv@^16.3.1
```

### ERR_MODULE_NOT_FOUND or ERR_REQUIRE_ESM

The SDK source uses ES module syntax. If you see `ERR_REQUIRE_ESM`, you're trying to `require()` an ESM file. Either:

- Switch to `import` syntax and add `"type": "module"` to your `package.json`
- Use the CJS build (`dist/index.cjs`) instead of the ESM source
- Use a bundler that handles the conversion

### Exports subpath not resolved

If `import ... from '@postman/workspace-sdk'` doesn't resolve to the correct entry point, check that your Node.js version supports the `exports` field in `package.json` (Node >= 12.11.0, fully stable in >= 16).
