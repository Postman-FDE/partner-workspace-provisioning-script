# Update Detection Logic — Design Spec

**Date:** 2026-03-30
**Status:** Draft
**Scope:** Additive-only workspace update detection across all languages and deployment targets

---

## Problem

After initial provisioning of a partner workspace, there is no way to detect and add new collections, specs, or environments that were added to the source workspace. The only option today is a full reset and re-provision, which destroys existing partner workspace state.

## Goal

Build an `UpdateService` that scans a source and target workspace, identifies net-new assets (collections, specs, environments), and adds them to the partner workspace with full mock URL wiring — without touching existing assets.

## Decisions

- **Additive only** — no removals or modifications to existing partner workspace assets
- **Net-new only** — existing collections/specs/environments are not re-processed
- **Matching strategy** — fork relationship (primary), name match (fallback)
- **Mock Env** — updated in-place (PATCH/PUT), not recreated
- **Architecture** — new dedicated `UpdateService`, follows existing service pattern
- **Targets** — all languages (JS, TS, Python, Java), all modes (CLI, standalone, SDK)

---

## Detection & Matching

### Workflow

1. List all collections in source workspace (`GET /collections?workspace={sourceId}`)
2. List all collections in target workspace (`GET /collections?workspace={targetId}`)
3. For each source collection, check if it exists in target:
   - **Fork check (primary):** Get target collection details, check `fork.from` field for source collection UID match
   - **Name match (fallback):** If no fork metadata found, match by collection name
4. Source collections with no match in target = **new collections**
5. List all specs in source (`GET /specs?workspaceId={sourceId}`) and target (`GET /specs?workspaceId={targetId}`)
   - Match by name only (specs are copied, not forked)
6. List all environments in source (`GET /environments?workspace={sourceId}`) and target (`GET /environments?workspace={targetId}`)
   - Match by name only
   - Exclude "Mock Env" from matching (it's managed separately)

### Output

Three lists: `newCollections[]`, `newSpecs[]`, `newEnvironments[]`

---

## Processing New Assets

### New Collections (per collection)

1. **Fork** from source to target (`POST /collections/fork/{uid}?workspace={targetId}`)
2. **Get full details** of forked collection (`GET /collections/{newUid}`)
3. **Extract host variables** using existing 3-tier detection:
   - Scan `request.url.host[]` for `{{varName}}` patterns
   - Fall back to `collection.variable[]` matching against common names (`baseUrl`, `apiUrl`, etc.)
   - Final fallback: generate `{collectionName}BaseUrl`
4. **Create mock server** (`POST /mocks?workspace={targetId}`)
5. **Generate mock env variable names** using existing camelCase convention
6. **Update Mock Env in-place:**
   - Find existing "Mock Env" in target by name (`GET /environments?workspace={targetId}`)
   - Get current variables (`GET /environments/{mockEnvUid}`)
   - Append new mock URL variables
   - Save via `PUT /environments/{mockEnvUid}` (use whichever update method the language client already exposes)
7. **Update collection variables** to reference mock env vars (`PATCH /collections/{newUid}`)

### New Specs (per spec)

1. Get spec details (`GET /specs/{specId}`)
2. Get all file metadata (`GET /specs/{specId}/files`)
3. For each file: fetch content (`GET /specs/{specId}/files/{filePath}`)
4. Create spec with all files in target (`POST /specs?workspaceId={targetId}`)

### New Environments (per environment)

1. Get full details with variables (`GET /environments/{uid}`)
2. Create in target workspace (`POST /environments?workspace={targetId}`)

---

## Service Interface

### Public API

```
updateWorkspace({
  sourceWorkspaceId: string,
  targetWorkspaceId: string,
  onProgress?: (step: string, detail: string) => void
}) -> {
  newCollections: [{ name, targetUid, mockUrl }],
  newSpecs: [{ name, targetId }],
  newEnvironments: [{ name, targetUid }],
  updatedMockEnv: { uid, newVarsAdded: number } | null
}
```

### File Locations

| Language | Type | File |
|----------|------|------|
| JS | SDK | `dev-portal/javascript/sdk/src/services/UpdateService.js` |
| TS | SDK | `dev-portal/typescript/sdk/src/services/UpdateService.ts` |
| Python | SDK | `dev-portal/python/sdk/postman_sdk/services/update_service.py` |
| Java | SDK | `dev-portal/java/sdk/src/main/java/com/postman/sdk/services/UpdateService.java` |
| JS | Standalone | `dev-portal/javascript/script/postmanService.js` (add update functions) |
| Python | Standalone | `dev-portal/python/script/postman_service.py` (add update functions) |
| Java | Standalone | `dev-portal/java/script/PostmanService.java` (add update functions) |
| CLI | Entry point | `cli/update.js` |
| Root | Entry point | `update.js` |

### Modified Files

- SDK `index` files updated to export `UpdateService`
- `package.json` updated with `npm run update` script
- Java `PostmanAutoConfiguration.java` updated to register `UpdateService` bean

---

## Edge Cases

1. **No Mock Env exists** — Create one from scratch (same as initial provisioning flow)
2. **Duplicate mock env variable names** — Append numeric suffix (e.g., `ordersApiBaseUrl2`)
3. **Empty diff (workspace is up to date)** — Return early with empty result, no changes made
4. **API rate limiting** — 300-500ms delays between calls, consistent with existing provisioning
5. **Partial failure** — Log error for failed individual assets, continue with remaining. Return both successes and failures in result

## Explicitly Out of Scope

- Removing assets from partner workspace that were deleted from source
- Re-processing or updating existing collections, specs, or environments
- Detecting changes within existing assets (modified request bodies, updated spec files, etc.)

---

## Verification Plan

1. **Unit test the matching logic** — Verify fork-check-first, name-fallback behavior
2. **Integration test with real workspaces:**
   - Provision a workspace with 2 collections + 1 spec
   - Add a 3rd collection + 2nd spec to source
   - Run update — verify only the new items are added
   - Verify Mock Env has 3 variables (2 original + 1 new)
   - Verify new collection variables reference mock env correctly
   - Run update again — verify "up to date" with no changes
3. **Test across all languages** — Run standalone scripts and SDK examples in each language
4. **Edge case testing:**
   - Run update on workspace with no Mock Env
   - Run update when source and target are already in sync
   - Run update with a collection that has no host variables (fallback naming)
