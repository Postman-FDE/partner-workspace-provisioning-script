# Postman Partner Workspace Provisioning Script

Automated scripts for creating and managing Postman partner workspaces. Copies all collections, environments, mock servers, and API specs from a source workspace to a new or existing target workspace.

## Features

- **Fully Automated** - Just configure environment variables and run
- **Workspace Creation** - Automatically creates new partner workspaces when no target is specified
- **Complete Copy** - Copies collections, environments, mock servers, and API specs
- **Reset Functionality** - Clean slate option to restore workspace to blank state

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Configuration File

Create a `.env` file in the project root:

```bash
# REQUIRED: Your Postman API Key
POSTMAN_API_KEY=PMAK-xxxxxxxx-xxxxxxxxxxxxxxxxxxxx

# REQUIRED: Source workspace ID (workspace to copy FROM)
POSTMAN_SOURCE_WORKSPACE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# OPTIONAL: Target workspace ID (if omitted, creates a new partner workspace)
POSTMAN_TARGET_WORKSPACE_ID=

# OPTIONAL: Name for the new workspace (default: "Partner Workspace")
POSTMAN_WORKSPACE_NAME=My Partner Workspace
```

### 3. Run Provisioning

```bash
# Interactive mode (default) - shows config and prompts for options
npm run provision

# Skip prompts and run with .env defaults
npm run provision -- --yes

# Or with a custom workspace name
npm run provision -- --name "ACME Corp Partner Workspace"

# Or copy into an existing workspace
npm run provision -- --target-workspace-id "existing-workspace-id"
```

---

## Getting Your Configuration Values

### Postman API Key

1. Log in to [postman.com](https://postman.com)
2. Click your avatar → **Account Settings**
3. Go to **API Keys** tab
4. Click **Generate API Key**
5. Copy the key (starts with `PMAK-`)

> ⚠️ Keep your API key secret. Never commit it to version control.

### Source Workspace ID

1. Open Postman and navigate to your source workspace
2. Click on the workspace name in the sidebar
3. Go to **Workspace Settings** (gear icon)
4. Copy the **Workspace ID**

### Target Workspace ID (Optional)

- **Leave blank** to create a new partner workspace automatically
- **Provide an ID** to copy content into an existing workspace

---

## Scripts

### Provision Script (`provision.js`)

Creates and provisions a new workspace by copying all content from the source workspace.

**Interactive Mode (Default):**
```bash
# Shows current configuration and menu to modify settings
npm run provision
```

When you run `npm run provision`, you'll see an interactive menu:

```
╔════════════════════════════════════════════════════════════╗
║      Postman Partner Workspace Provisioning Script        ║
╚════════════════════════════════════════════════════════════╝

─────────────────────────────────────────────────────────────
                    Current Configuration
─────────────────────────────────────────────────────────────

  API Key:          ✓ Configured
  Source Workspace: abc123...
  Target Workspace: Will create new
  New Workspace Name: Partner Workspace
  Workspace Type:   partner

─────────────────────────────────────────────────────────────

  Options:
  [1] Run with current settings
  [2] Change workspace name (create new workspace)
  [3] Use existing target workspace ID
  [4] Exit

Select option [1-4]: 
```

**Non-Interactive Mode:**
```bash
# Skip prompts and run with .env defaults
npm run provision -- --yes
node provision.js -y

# With custom options
node provision.js --name "Custom Workspace Name"
node provision.js --target-workspace-id "existing-id"
node provision.js -n "Short Name" -t "target-id"
```

**What it copies:**
- ✅ All collections (forked to maintain link to source)
- ✅ All environments (with variable values)
- ✅ All mock servers (recreated and linked to new collections)
- ✅ All API specs (with schemas and versions)

**Output:**
```
╔════════════════════════════════════════════════════════════╗
║      Postman Partner Workspace Provisioning Script        ║
╚════════════════════════════════════════════════════════════╝

▸ Validating configuration...
✓ API key valid. Authenticated as: your-username
✓ Source workspace: Template Workspace

▸ Initializing target workspace...
ℹ Creating new partner workspace: "Partner Workspace"...
✓ Created new workspace: Partner Workspace (ID: abc123...)

▸ Copying collections...
ℹ Found 5 collection(s) to copy
✓ Forked: Authentication API
✓ Forked: Payment Services
...

═══════════════════════════════════════════════════════════════
                      PROVISIONING COMPLETE
═══════════════════════════════════════════════════════════════

Workspace: Partner Workspace
Workspace ID: abc123-def456-...
Workspace Created: Yes (new)

Collections: 5/5 copied
Environments: 2/2 copied
Mock Servers: 1/1 recreated
API Specs: 3/3 copied

✓ Done!
```

---

### Reset Script (`reset.js`)

Removes all content from a workspace, returning it to a blank state.

```bash
# Using npm
npm run reset

# Using node directly
node reset.js

# With options
node reset.js --workspace-id "workspace-to-reset"
node reset.js --workspace-id "workspace-id" --confirm  # Skip prompt
node reset.js -w "workspace-id" -y
```

**What it deletes:**
- 🗑️ All collections
- 🗑️ All environments
- 🗑️ All mock servers
- 🗑️ All API specs

> ⚠️ **Warning:** This action cannot be undone!

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTMAN_API_KEY` | ✅ Yes | Your Postman API key |
| `POSTMAN_SOURCE_WORKSPACE_ID` | ✅ Yes | Workspace ID to copy from |
| `POSTMAN_TARGET_WORKSPACE_ID` | ❌ No | Target workspace ID (creates new if omitted) |
| `POSTMAN_WORKSPACE_NAME` | ❌ No | Name for new workspace (default: "Partner Workspace") |

**Legacy Support:** The scripts also support `VITE_` prefixed variables for compatibility with Vite.js projects:
- `VITE_POSTMAN_API_KEY`
- `VITE_POSTMAN_SOURCE_WORKSPACE_ID`
- `VITE_POSTMAN_TARGET_WORKSPACE_ID`

---

## Command Line Options

### Provision Script

| Flag | Alias | Description |
|------|-------|-------------|
| `--yes` | `-y` | Skip interactive prompts, run with defaults |
| `--name` | `-n` | Name for the new workspace |
| `--target-workspace-id` | `-t` | Use existing workspace instead of creating new |

### Reset Script

| Flag | Alias | Description |
|------|-------|-------------|
| `--workspace-id` | `-w` | ID of workspace to reset |
| `--confirm` | `-y` | Skip confirmation prompt |

---

## Example Workflows

### Create a New Partner Workspace

```bash
# Set up environment
export POSTMAN_API_KEY="PMAK-..."
export POSTMAN_SOURCE_WORKSPACE_ID="source-workspace-id"
export POSTMAN_WORKSPACE_NAME="ACME Corp Integration"

# Run provisioning
npm run provision
```

### Copy to Existing Workspace

```bash
# Set up environment
export POSTMAN_API_KEY="PMAK-..."
export POSTMAN_SOURCE_WORKSPACE_ID="source-workspace-id"
export POSTMAN_TARGET_WORKSPACE_ID="existing-workspace-id"

# Run provisioning
npm run provision
```

### Reset and Re-provision

```bash
# Reset the workspace
npm run reset -- --workspace-id "workspace-id" --confirm

# Re-provision with fresh content
npm run provision -- --target-workspace-id "workspace-id"
```

---

## Project Structure

```
fde-pw-creation-script/
├── provision.js        # Main provisioning script
├── reset.js           # Workspace reset script
├── postmanService.js  # API service module (for import use)
├── package.json       # Dependencies and npm scripts
├── .env               # Your configuration (create this)
└── README.md          # This file
```

---

## Files Overview

### `provision.js`
Standalone executable script for provisioning. Contains all necessary API functions built-in. Run directly with `node provision.js`.

### `reset.js`
Standalone executable script for resetting workspaces. Contains all necessary API functions built-in. Run directly with `node reset.js`.

### `postmanService.js`
Module with exported functions for importing into other projects (e.g., React/Vite apps). Use this if you need programmatic access to the API functions.

---

## Troubleshooting

### "POSTMAN_API_KEY is required"
Ensure your `.env` file exists and contains `POSTMAN_API_KEY=your-key`.

### "Invalid API key"
- Verify the API key is correct and not expired
- Generate a new key if needed at postman.com → Account Settings → API Keys

### "Source workspace not found"
- Verify `POSTMAN_SOURCE_WORKSPACE_ID` is correct
- Ensure your API key has access to the source workspace

### "Target workspace not found"
- If using an existing workspace, verify the ID is correct
- Ensure your API key has write access to the target workspace

### "Failed to create workspace"
- You may not have permission to create partner workspaces
- Try using `team` type instead by modifying the script

### Rate Limiting
The scripts include built-in delays between API calls. If you hit rate limits:
- Wait a few minutes and try again
- Increase delay values in the scripts

---

## Security Notes

1. **Never commit `.env` files** - Add `.env` to `.gitignore`
2. **Rotate API keys** - Generate new keys periodically
3. **Use minimal permissions** - Only grant necessary workspace access
4. **Audit access** - Review who can access your source workspace

---

## License

ISC
