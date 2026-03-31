# Postman Workspace CLI Tools

Command-line tools for interactive Postman workspace provisioning and reset operations. Best suited for manual operations, testing, and one-off workspace management tasks.

## Table of Contents

- [Overview](#overview)
- [When to Use CLI vs SDK](#when-to-use-cli-vs-sdk)
- [Setup](#setup)
  - [Environment Configuration](#environment-configuration)
  - [Getting Your Configuration Values](#getting-your-configuration-values)
- [Usage](#usage)
  - [Provisioning a Workspace](#provisioning-a-workspace)
  - [Resetting a Workspace](#resetting-a-workspace)
  - [Updating a Workspace](#updating-a-workspace)
- [Configuration Reference](#configuration-reference)
  - [Environment Variables](#environment-variables)
  - [Partner Role Reference](#partner-role-reference)
  - [Command Line Options](#command-line-options)
- [Example Workflows](#example-workflows)
- [Troubleshooting](#troubleshooting)

---

## Overview

The CLI tools provide an interactive way to:

- **Provision** new partner workspaces by copying collections, environments, mocks, and specs from a source workspace
- **Map mock URLs** with automatic mock environment creation and collection variable updates
- **Update** existing partner workspaces by detecting and adding new collections, specs, and environments from the source workspace
- **Reset** existing workspaces by deleting all or selected resources
- **Manage** team members and partner invitations

These scripts use the same underlying `postmanService.js` module as the SDK packages, but provide a terminal-based interface with prompts and confirmations.

---

## When to Use CLI vs SDK

| Use Case | CLI | SDK |
|----------|-----|-----|
| One-off workspace provisioning | ✅ | |
| Update existing workspace | ✅ | |
| Testing/debugging | ✅ | |
| Manual operations | ✅ | |
| Automated pipelines | | ✅ |
| Web application integration | | ✅ |
| Custom UI/dashboard | | ✅ |
| CI/CD integration | | ✅ |

---

## Setup

### Environment Configuration

1. **Create `.env` file** in the project root (copy from `.env-example`):

```bash
cp .env-example .env
```

2. **Edit `.env` with your configuration**:

```env
# Required
POSTMAN_API_KEY=PMAK-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
POSTMAN_SOURCE_WORKSPACE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Optional - Target Workspace
POSTMAN_TARGET_WORKSPACE_ID=           # Leave empty to create new workspace
POSTMAN_WORKSPACE_NAME=Partner Workspace

# Optional - Team Members & Partners
POSTMAN_ADMIN_USER_IDS=12345,67890     # Comma-separated user IDs to add as admins
PARTNER_EMAILS=partner1@company.com,partner2@company.com  # Comma-separated emails
PARTNER_ROLE_ID=7                       # 4=Partner Viewer, 7=Editor and Partner Lead
```

### Getting Your Configuration Values

#### 1. Postman API Key

1. Go to [Postman Account Settings](https://go.postman.co/settings/me/api-keys)
2. Click "Generate API Key"
3. Give it a name (e.g., "Workspace Provisioning")
4. Copy the key (starts with `PMAK-`)

> **Important**: Store your API key securely. It provides full access to your Postman account.

#### 2. Workspace IDs

**Option A - From Postman UI:**
1. Open Postman
2. Navigate to your workspace
3. Click the workspace name → Settings
4. Copy the "Workspace ID"

**Option B - From URL:**
- The workspace ID is in the URL: `https://app.getpostman.com/workspace/<WORKSPACE_ID>`

#### 3. User IDs (for Admin Management)

User IDs can be found via:
- Postman API (`GET /users`)
- Team management settings in Postman
- Ask team members for their user ID from their profile settings

---

## Usage

### Provisioning a Workspace

Run the provisioning script to copy all assets from a source workspace to a new or existing target workspace.

```bash
# Using npm script
npm run provision

# Or directly with Node
node cli/provision.js
```

#### Interactive Flow

1. **Configuration Check** - Validates your `.env` settings
2. **Workspace Selection** - If no target workspace ID is configured, prompts for a new workspace name
3. **Review** - Shows what will be copied
4. **Confirmation** - Asks to proceed
5. **Execution** - Copies assets with progress display
6. **Summary** - Shows results with mock URLs and invitation links

#### Non-Interactive Mode

Skip all prompts and use `.env` configuration directly:

```bash
node cli/provision.js --yes
```

#### Example Output

```
════════════════════════════════════════════════════════════
Postman Workspace Provisioning
════════════════════════════════════════════════════════════

Configuration:
  Source Workspace: abc-123-def-456
  Target Workspace: (will create new)
  Workspace Name:   Partner Workspace

Proceed with provisioning? (y/n): y

Starting provisioning...

 [1/10] Validating API key...                    ✓
 [2/10] Creating workspace...                    ✓
 [3/10] Copying collections...                   ✓ 3/3
 [4/10] Creating mock servers...                 ✓ 3/3
 [5/10] Copying environments...                  ✓ 2/2
 [6/10] Updating mock environment...             ✓
 [7/10] Updating collection variables...         ✓ 3/3
 [8/10] Copying API specs...                     ✓ 1/1
 [9/10] Adding workspace admins...               ✓ 2/2
[10/10] Inviting partners...                     ✓ 2/2

════════════════════════════════════════════════════════════
Provisioning Complete!
════════════════════════════════════════════════════════════

Target Workspace: Partner Workspace
  ID: xyz-789-uvw-012
  Status: Created new

Results Summary:
  Collections:  3/3 copied
  Mock Servers: 3/3 created
  Environments: 2/2 copied
  Mock Env:     created
  Specs:        1/1 copied
  Admins:       2/2 added
  Partners:     2/2 invited

Mock Server URLs:
  Authentication API: https://abc123.mock.pstmn.io/v1/auth
  User Service:       https://def456.mock.pstmn.io/api/users
  Payment Gateway:    https://ghi789.mock.pstmn.io/v2/payments

Mock Environment Variables:
  authenticationApiBaseUrl -> https://abc123.mock.pstmn.io/v1/auth
  userServiceHostName     -> https://def456.mock.pstmn.io/api/users
  paymentGatewayBaseUrl   -> https://ghi789.mock.pstmn.io/v2/payments

Partner Invitation Links (Run in Postman):
  partner1@company.com:
    https://app.getpostman.com/join-team?invite_code=xxxxx

  partner2@company.com:
    https://app.getpostman.com/join-team?invite_code=yyyyy

════════════════════════════════════════════════════════════
```

---

### Resetting a Workspace

Run the reset script to delete resources from a workspace. **Use with caution!**

```bash
# Using npm script
npm run reset

# Or directly with Node
node cli/reset.js
```

#### Interactive Flow

1. **Workspace Selection** - If no target workspace ID is configured, prompts for one
2. **Scanning** - Counts all resources in the workspace
3. **Review** - Shows what will be deleted
4. **Confirmation** - Requires typing "RESET" to confirm
5. **Execution** - Deletes resources in dependency order
6. **Summary** - Shows deletion results

#### Non-Interactive Mode

Skip confirmation prompt (**use with extreme caution!**):

```bash
node cli/reset.js --yes
```

#### Override Workspace ID

Specify a different workspace than configured in `.env`:

```bash
node cli/reset.js --workspace-id "your-workspace-id"
```

#### Example Output

```
════════════════════════════════════════════════════════════
Postman Workspace Reset
════════════════════════════════════════════════════════════

Target Workspace: xyz-789-uvw-012

Scanning workspace...

Resources found:
  Collections:  3
  Environments: 2
  Mock Servers: 3
  API Specs:    1

⚠️  WARNING: This will permanently delete all resources!

Type "RESET" to confirm: RESET

Deleting resources...

[1/4] Deleting API specs...      ✓ 1/1
[2/4] Deleting mock servers...   ✓ 3/3
[3/4] Deleting environments...   ✓ 2/2
[4/4] Deleting collections...    ✓ 3/3

════════════════════════════════════════════════════════════
Reset Complete!
════════════════════════════════════════════════════════════

Deleted:
  Collections:  3
  Environments: 2
  Mock Servers: 3
  API Specs:    1

════════════════════════════════════════════════════════════
```

---

### Updating a Workspace

Run the update script to detect and add new assets from the source workspace to an existing partner workspace.

```bash
# Using npm script
npm run update

# Or directly with Node
node cli/update.js
```

#### How It Works

1. **Scanning** - Lists all assets in both source and target workspaces
2. **Detection** - Identifies new collections (via fork-check then name-match), specs, and environments
3. **Review** - Shows what new assets were found
4. **Confirmation** - Asks to proceed (unless `--confirm` flag is used)
5. **Processing** - Forks new collections, creates mocks, updates Mock Env, copies specs and environments
6. **Summary** - Shows results with new mock URLs

#### Non-Interactive Mode

Skip confirmation prompt:

```bash
node cli/update.js --confirm
```

#### Override Workspace IDs

```bash
node cli/update.js --source "source-workspace-id" --target "target-workspace-id"
```

#### Example Output

```
╔══════════════════════════════════════════╗
║   Partner Workspace Update Detection     ║
╚══════════════════════════════════════════╝

✓ Authenticated as username

═══ SCANNING WORKSPACES ═══

ℹ Source: 5 collections, 3 specs, 2 environments
ℹ Target: 3 collections, 2 specs, 2 environments
ℹ New: 2 collections, 1 specs, 0 environments

Proceed with adding 2 collection(s), 1 spec(s), 0 environment(s)? (y/n) y

═══ FORKING NEW COLLECTIONS ═══

✓ Forked "Payment API" → abc-123
✓ Forked "Notification Service" → def-456

═══ CREATING MOCK SERVERS ═══

✓ Created "Payment API Mock" → https://xxxxx-mock.postman.com
✓ Created "Notification Service Mock" → https://yyyyy-mock.postman.com

═══ UPDATING MOCK ENVIRONMENT ═══

✓ Updated Mock Env with 2 new variable(s)

═══ UPDATING COLLECTION VARIABLES ═══

✓ Updated variables for "Payment API"
✓ Updated variables for "Notification Service"

═══ COPYING NEW SPECS ═══

✓ Copied "Payment OpenAPI" (2 file(s))

═══ UPDATE COMPLETE ═══

✓ Collections added: 2
✓ Mocks created: 2
✓ Specs copied: 1
✓ Environments copied: 0
```

---

## Configuration Reference

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTMAN_API_KEY` | **Yes** | Your Postman API key (starts with `PMAK-`) |
| `POSTMAN_SOURCE_WORKSPACE_ID` | **Yes** | Source workspace ID to copy assets from |
| `POSTMAN_TARGET_WORKSPACE_ID` | No | Target workspace ID (leave empty to create new) |
| `POSTMAN_WORKSPACE_NAME` | No | Name for new workspace (default: "Partner Workspace") |
| `POSTMAN_ADMIN_USER_IDS` | No | Comma-separated user IDs to add as workspace admins |
| `PARTNER_EMAILS` | No | Comma-separated partner email addresses to invite |
| `PARTNER_ROLE_ID` | No | Partner role ID (default: "7" - Editor and Partner Lead) |

### Partner Role Reference

| Role ID | Name | Description |
|---------|------|-------------|
| `4` | Partner Viewer | Read-only access to workspace assets |
| `7` | Editor and Partner Lead | Full editing access with partner lead privileges |

### Command Line Options

#### Provision Script (`cli/provision.js`)

| Option | Description |
|--------|-------------|
| `--yes` | Skip interactive prompts and use `.env` configuration |
| `--name <name>` | Override workspace name from `.env` |

#### Reset Script (`cli/reset.js`)

| Option | Description |
|--------|-------------|
| `--yes` | Skip confirmation prompt (dangerous!) |
| `--workspace-id <id>` | Override target workspace ID from `.env` |

#### Update Script (`cli/update.js`)

| Option | Description |
|--------|-------------|
| `--confirm` | Skip confirmation prompt |
| `--source <id>` | Override source workspace ID from `.env` |
| `--target <id>` | Override target workspace ID from `.env` |

---

## Example Workflows

### Create a New Partner Workspace with Full Setup

Complete provisioning including team admins and partner invitations:

```bash
# 1. Configure .env with all options
cat > .env << 'EOF'
POSTMAN_API_KEY=PMAK-your-api-key
POSTMAN_SOURCE_WORKSPACE_ID=abc-123-source-workspace
POSTMAN_WORKSPACE_NAME=Acme Corp Partner Workspace
POSTMAN_ADMIN_USER_IDS=12345678,87654321
PARTNER_EMAILS=john@acme.com,jane@acme.com
PARTNER_ROLE_ID=7
EOF

# 2. Run provisioning
npm run provision

# 3. Share the invitation links with partners (shown in output)
```

### Use Existing Target Workspace

Copy assets into a pre-existing workspace:

```bash
# 1. Configure .env with both workspace IDs
cat > .env << 'EOF'
POSTMAN_API_KEY=PMAK-your-api-key
POSTMAN_SOURCE_WORKSPACE_ID=abc-123-source-workspace
POSTMAN_TARGET_WORKSPACE_ID=def-456-target-workspace
EOF

# 2. Run provisioning (no workspace creation prompts)
npm run provision --yes
```

### Copy Assets Only (No Team/Partner Management)

Provision a workspace without adding admins or inviting partners:

```bash
# 1. Configure .env without admin/partner config
cat > .env << 'EOF'
POSTMAN_API_KEY=PMAK-your-api-key
POSTMAN_SOURCE_WORKSPACE_ID=abc-123-source-workspace
POSTMAN_WORKSPACE_NAME=My Workspace
# Leave POSTMAN_ADMIN_USER_IDS and PARTNER_EMAILS empty/unset
EOF

# 2. Run provisioning (admin and partner steps will be skipped)
npm run provision
```

### Reset and Re-provision

Clear a workspace and start fresh:

```bash
# 1. Reset the target workspace
node cli/reset.js --workspace-id "target-workspace-id" --yes

# 2. Re-provision
npm run provision
```

### Update After Source Changes

Add new assets to an existing partner workspace after the source workspace has been updated:

```bash
# Run update to detect and add new assets
npm run update

# Or with explicit IDs
node cli/update.js --source "source-id" --target "target-id" --confirm
```

### Automated Provisioning Script

Create a shell script for repeatable provisioning:

```bash
#!/bin/bash
# provision-partner.sh

set -e

PARTNER_NAME=$1
PARTNER_EMAIL=$2

if [ -z "$PARTNER_NAME" ] || [ -z "$PARTNER_EMAIL" ]; then
  echo "Usage: ./provision-partner.sh <partner-name> <partner-email>"
  exit 1
fi

# Set environment
export POSTMAN_WORKSPACE_NAME="${PARTNER_NAME} Partner Workspace"
export PARTNER_EMAILS="${PARTNER_EMAIL}"

# Run provisioning
node cli/provision.js --yes

echo "Done! Check output above for invitation link."
```

Usage:
```bash
chmod +x provision-partner.sh
./provision-partner.sh "Acme Corp" "partner@acme.com"
```

---

## Troubleshooting

### Common Issues

#### "Invalid API key"

**Symptoms:** Script fails at validation step

**Solutions:**
- Verify your API key is correct (starts with `PMAK-`)
- Check that the key hasn't expired
- Ensure the key has appropriate permissions
- Generate a new key at [Postman Account Settings](https://go.postman.co/settings/me/api-keys)

#### "Workspace not found"

**Symptoms:** Script fails when accessing workspace

**Solutions:**
- Confirm workspace IDs are correct (check for typos)
- Ensure you have access to the workspace
- Verify the workspace hasn't been deleted

#### "Failed to add admin"

**Symptoms:** Admin step fails

**Solutions:**
- Verify the user ID is correct (numeric ID, not email)
- Ensure the user is part of your Postman team
- Check that you have permission to add workspace admins

#### "Failed to invite partner"

**Symptoms:** Partner invitation step fails

**Solutions:**
- Verify the email address format is correct
- Check that your Postman team has Partner Workspaces enabled
- Ensure you have permission to invite partners
- Verify the partner role ID is valid (4 or 7)

#### "Spec files not copying"

**Symptoms:** Specs step shows 0 copied or fails

**Solutions:**
- Confirm specs exist in source workspace
- Check that spec files have content
- Verify spec type is supported:
  - `OPENAPI:3.0`
  - `OPENAPI:3.1`
  - `ASYNCAPI:2.0`

#### "Rate limit exceeded"

**Symptoms:** Multiple API errors, script slows down

**Solutions:**
- Wait a few minutes and retry
- The scripts include automatic delays (300-500ms between calls)
- For large workspaces, consider provisioning in batches

### Debug Mode

Enable detailed logging to diagnose issues:

```bash
# Set DEBUG environment variable
DEBUG=true npm run provision

# Or inline
DEBUG=true node cli/provision.js
```

This will output:
- Full API request/response details
- Timing information
- Detailed error messages

### Checking Configuration

Verify your setup before running:

```bash
# Check that .env is loaded correctly
node -e "require('dotenv').config(); console.log({
  hasApiKey: !!process.env.POSTMAN_API_KEY,
  hasSourceWorkspace: !!process.env.POSTMAN_SOURCE_WORKSPACE_ID,
  hasTargetWorkspace: !!process.env.POSTMAN_TARGET_WORKSPACE_ID,
  workspaceName: process.env.POSTMAN_WORKSPACE_NAME,
})"
```

### Getting Help

- **Postman API Documentation**: [https://www.postman.com/postman/workspace/postman-public-workspace/documentation](https://www.postman.com/postman/workspace/postman-public-workspace/documentation)
- **Partner Workspaces Guide**: Check Postman's official documentation for Partner Workspace setup requirements
- **API Key Permissions**: Ensure your API key has the necessary scopes for workspace management

---

## Related Documentation

- [Main README](../README.md) - Project overview and SDK comparison
- [Dev Portal Overview](../dev-portal/README.md) - Scripts and SDK directory overview
- [JavaScript SDK](../dev-portal/javascript/sdk/README.md) - For web application integration
- [TypeScript SDK](../dev-portal/typescript/sdk/README.md) - Type-safe SDK for TypeScript projects
- [Python SDK](../dev-portal/python/sdk/README.md) - Async Python SDK with Pydantic models
- [Java SDK](../dev-portal/java/sdk/README.md) - Spring Boot reactive SDK

---

## License

ISC
