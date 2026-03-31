"""
Postman API Service - Async Python client for Postman API operations.

Requires: pip install httpx

Usage:
    import asyncio
    from postman_service import create_workspace, get_workspace

    async def main():
        result = await create_workspace("My Workspace", "team", "Description")
        print(result)

    asyncio.run(main())
"""

from __future__ import annotations

import asyncio
import os
import re
from dataclasses import dataclass, field
from typing import Any, Callable, Optional, TypedDict
from urllib.parse import quote, urlparse

import httpx

# ============================================================================
# ENVIRONMENT CONFIGURATION
# ============================================================================

POSTMAN_API_BASE = "https://api.getpostman.com"
COMMON_HOST_VAR_NAMES = ['baseUrl', 'baseurl', 'base_url', 'HostName', 'hostname', 'host', 'apiUrl', 'apiurl', 'api_url', 'serverUrl', 'serverurl', 'server_url']


def derive_company_name(workspace_name: Optional[str]) -> Optional[str]:
    if not workspace_name:
        return None
    match = re.search(r'<>\s*(.+?)\s*Partner\s*Workspace', workspace_name, re.IGNORECASE)
    return match.group(1).strip() if match else None


def _get_api_key() -> str:
    return os.environ.get("POSTMAN_API_KEY", "")


def _get_target_workspace_id() -> Optional[str]:
    return os.environ.get("POSTMAN_TARGET_WORKSPACE_ID")


def _get_source_workspace_id() -> Optional[str]:
    return os.environ.get("POSTMAN_SOURCE_WORKSPACE_ID")


def _get_workspace_name() -> str:
    return os.environ.get("POSTMAN_WORKSPACE_NAME", "Partner Workspace")


def _get_admin_user_ids() -> list[str]:
    raw = os.environ.get("POSTMAN_ADMIN_USER_IDS", "")
    return [uid.strip() for uid in raw.split(",") if uid.strip()] if raw else []


def _get_partner_emails() -> list[str]:
    raw = os.environ.get("PARTNER_EMAILS", "")
    return [e.strip() for e in raw.split(",") if e.strip()] if raw else []


def _get_partner_role_id() -> str:
    return os.environ.get("PARTNER_ROLE_ID", "7")


def _headers() -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "X-Api-Key": _get_api_key(),
    }


def _auth_headers() -> dict[str, str]:
    return {"X-Api-Key": _get_api_key()}


def _extract_error(error: BaseException) -> str:
    if isinstance(error, httpx.HTTPStatusError):
        try:
            data = error.response.json()
            if isinstance(data, dict):
                err = data.get("error", {})
                if isinstance(err, dict):
                    msg = err.get("message")
                    if msg:
                        return str(msg)
        except Exception:
            pass
        return str(error.response.text) or str(error)
    return str(error) if error else "Unknown error"


async def _request(
    method: str,
    url: str,
    *,
    json: Optional[dict[str, Any]] = None,
    use_auth_only: bool = False,
) -> httpx.Response:
    hdrs = _auth_headers() if use_auth_only else _headers()
    async with httpx.AsyncClient() as client:
        return await client.request(method, url, headers=hdrs, json=json)


# ============================================================================
# TYPED DICTIONARIES (Options)
# ===========================================================================


class InitTargetWorkspaceOptions(TypedDict, total=False):
    target_workspace_id: Optional[str]
    new_workspace_name: Optional[str]
    workspace_type: str
    description: str


class ResetOptions(TypedDict, total=False):
    include_specs: bool
    include_mocks: bool
    include_environments: bool
    include_collections: bool


class ProvisionOptions(TypedDict, total=False):
    source_workspace_id: Optional[str]
    target_workspace_id: Optional[str]
    workspace_name: str
    workspace_type: str
    admin_user_ids: list[str]
    partner_emails: list[str]
    partner_role_id: str


class QuickProvisionOptions(TypedDict, total=False):
    workspace_type: str


class ResetCustomOptions(TypedDict, total=False):
    include_specs: bool
    include_mocks: bool
    include_environments: bool
    include_collections: bool
    selected_collection_uids: Optional[list[str]]
    selected_environment_uids: Optional[list[str]]
    selected_mock_ids: Optional[list[str]]
    selected_spec_ids: Optional[list[str]]


class ProvisionCustomOptions(TypedDict, total=False):
    source_workspace_id: Optional[str]
    target_workspace_id: Optional[str]
    workspace_name: str
    workspace_type: str
    copy_collections: bool
    copy_environments: bool
    copy_mocks: bool
    copy_specs: bool
    selected_collection_uids: Optional[list[str]]
    selected_environment_uids: Optional[list[str]]
    selected_spec_ids: Optional[list[str]]
    create_mock_env: bool
    add_admins: bool
    invite_partners: bool
    admin_user_ids: list[str]
    partner_emails: list[str]
    partner_role_id: str


# ============================================================================
# DATACLASSES (Result types)
# ===========================================================================


@dataclass
class WorkspaceInfo:
    id: Optional[str]
    name: Optional[str]
    type: Optional[str]


@dataclass
class CreateWorkspaceResult:
    success: bool
    workspace: Optional[WorkspaceInfo] = None
    error: Optional[str] = None


@dataclass
class InitializeTargetWorkspaceResult:
    success: bool
    created: bool
    workspace_id: Optional[str] = None
    workspace: Optional[WorkspaceInfo] = None
    error: Optional[str] = None


@dataclass
class RolesResult:
    success: bool
    roles: list[Any] = field(default_factory=list)
    error: Optional[str] = None


@dataclass
class InvitePartnerResult:
    success: bool
    email: str
    status: Optional[str] = None
    invitation_link: Optional[str] = None
    user_id: Optional[int] = None
    role_display_name: Optional[str] = None
    error: Optional[str] = None


@dataclass
class RemovePartnerResult:
    success: bool
    user_id: str
    status: Optional[str] = None
    error: Optional[str] = None


@dataclass
class CreateSpecResult:
    success: bool
    spec: Optional[dict[str, Any]] = None
    error: Optional[str] = None


@dataclass
class CreateSpecFileResult:
    success: bool
    file: Optional[dict[str, Any]] = None
    error: Optional[str] = None


@dataclass
class CopySpecResult:
    success: bool
    spec_name: str
    new_spec_id: Optional[str] = None
    files_copied: int = 0
    total_files: int = 0
    errors: list[str] = field(default_factory=list)


@dataclass
class ForkCollectionResult:
    success: bool
    collection_name: str
    collection_id: Optional[str] = None
    uid: Optional[str] = None
    error: Optional[str] = None


@dataclass
class CreateCollectionResult:
    success: bool
    collection_name: str
    collection_id: Optional[str] = None
    uid: Optional[str] = None
    error: Optional[str] = None


@dataclass
class CreateEnvironmentResult:
    success: bool
    environment_name: str
    environment_id: Optional[str] = None
    uid: Optional[str] = None
    error: Optional[str] = None


@dataclass
class UpdateEnvironmentResult:
    success: bool
    environment: Optional[dict[str, Any]] = None
    error: Optional[str] = None


@dataclass
class CreateMockServerResult:
    success: bool
    mock_name: str
    mock_id: Optional[str] = None
    mock_url: Optional[str] = None
    uid: Optional[str] = None
    error: Optional[str] = None


@dataclass
class ValidateApiKeyResult:
    valid: bool
    user: Optional[dict[str, Any]] = None
    error: Optional[str] = None


@dataclass
class ConfigurationStatus:
    has_api_key: bool
    has_target_workspace: bool
    has_source_workspace: bool
    is_configured: bool
    is_fully_configured: bool
    message: str


# Type for progress callback
ProgressCallback = Callable[[dict[str, Any]], None]


# ============================================================================
# WORKSPACE MANAGEMENT
# ============================================================================


def get_target_workspace_id() -> Optional[str]:
    """Return target workspace ID from environment."""
    return _get_target_workspace_id()


def get_source_workspace_id() -> Optional[str]:
    """Return source workspace ID from environment."""
    return _get_source_workspace_id()


def get_default_workspace_name() -> str:
    """Return workspace name from environment, defaulting to 'Partner Workspace'."""
    return _get_workspace_name()


def get_admin_user_ids() -> list[str]:
    """Return admin user IDs from environment (comma-separated)."""
    return _get_admin_user_ids()


def get_partner_emails() -> list[str]:
    """Return partner emails from environment (comma-separated)."""
    return _get_partner_emails()


def get_partner_role_id() -> str:
    """Return partner role ID from environment, defaulting to '7'."""
    return _get_partner_role_id()


async def create_workspace(
    name: str,
    workspace_type: str = "team",
    description: str = "",
) -> CreateWorkspaceResult:
    """Create a new Postman workspace."""
    try:
        response = await _request(
            "POST",
            f"{POSTMAN_API_BASE}/workspaces",
            json={
                "workspace": {
                    "name": name,
                    "type": workspace_type,
                    "description": description or "Workspace created via automation script",
                }
            },
        )
        response.raise_for_status()
        data = response.json()
        ws = data.get("workspace", {})
        return CreateWorkspaceResult(
            success=True,
            workspace=WorkspaceInfo(
                id=ws.get("id"),
                name=ws.get("name"),
                type=ws.get("type"),
            ),
        )
    except httpx.HTTPStatusError as e:
        return CreateWorkspaceResult(success=False, error=_extract_error(e))
    except Exception as e:
        return CreateWorkspaceResult(success=False, error=_extract_error(e))


async def get_workspace(workspace_id: str) -> Optional[dict[str, Any]]:
    """Get workspace details by ID."""
    try:
        response = await _request(
            "GET",
            f"{POSTMAN_API_BASE}/workspaces/{workspace_id}",
            use_auth_only=True,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("workspace")
    except Exception as e:
        print(f"Error getting workspace: {e}")
        return None


async def update_workspace(
    workspace_id: str,
    updates: dict[str, Any],
) -> dict[str, Any]:
    """Update a workspace by ID via PUT /workspaces/{workspaceId}."""
    try:
        response = await _request(
            "PUT",
            f"{POSTMAN_API_BASE}/workspaces/{workspace_id}",
            json={"workspace": updates},
        )
        response.raise_for_status()
        data = response.json()
        return {"success": True, "workspace": data.get("workspace")}
    except Exception as e:
        print(f"Error updating workspace: {e}")
        return {"success": False}


async def delete_workspace(workspace_id: str) -> bool:
    """Delete a workspace by ID."""
    try:
        response = await _request(
            "DELETE",
            f"{POSTMAN_API_BASE}/workspaces/{workspace_id}",
            use_auth_only=True,
        )
        response.raise_for_status()
        return True
    except Exception as e:
        print(f"Error deleting workspace: {e}")
        return False


async def initialize_target_workspace(
    options: Optional[InitTargetWorkspaceOptions] = None,
) -> InitializeTargetWorkspaceResult:
    """Initialize target workspace — use existing or create new."""
    opts = options or {}
    target_workspace_id = opts.get("target_workspace_id")
    new_workspace_name = opts.get("new_workspace_name")
    workspace_type = opts.get("workspace_type", "team")
    description = opts.get("description", "")

    if target_workspace_id:
        existing = await get_workspace(target_workspace_id)
        if existing:
            return InitializeTargetWorkspaceResult(
                success=True,
                workspace_id=target_workspace_id,
                workspace=WorkspaceInfo(
                    id=existing.get("id"),
                    name=existing.get("name"),
                    type=existing.get("type"),
                ),
                created=False,
            )
        return InitializeTargetWorkspaceResult(
            success=False,
            error=f'Target workspace with ID "{target_workspace_id}" not found or not accessible',
            created=False,
        )

    if not new_workspace_name:
        return InitializeTargetWorkspaceResult(
            success=False,
            error="Either target_workspace_id or new_workspace_name must be provided",
            created=False,
        )

    create_result = await create_workspace(new_workspace_name, workspace_type, description)
    if create_result.success and create_result.workspace:
        return InitializeTargetWorkspaceResult(
            success=True,
            workspace_id=create_result.workspace.id,
            workspace=create_result.workspace,
            created=True,
        )
    return InitializeTargetWorkspaceResult(
        success=False,
        error=create_result.error,
        created=False,
    )


# ============================================================================
# WORKSPACE ROLES MANAGEMENT
# ============================================================================


async def get_workspace_roles(workspace_id: str) -> RolesResult:
    """Get all roles assigned in a workspace."""
    try:
        response = await _request(
            "GET",
            f"{POSTMAN_API_BASE}/workspaces/{workspace_id}/roles",
            use_auth_only=True,
        )
        response.raise_for_status()
        data = response.json()
        return RolesResult(success=True, roles=data.get("roles", []))
    except Exception as e:
        return RolesResult(success=False, error=_extract_error(e), roles=[])


async def add_workspace_admin(
    workspace_id: str,
    user_id: str,
    role_id: str = "3",
) -> RolesResult:
    """Add a workspace admin (team member)."""
    try:
        response = await _request(
            "PATCH",
            f"{POSTMAN_API_BASE}/workspaces/{workspace_id}/roles",
            json={
                "roles": [
                    {
                        "op": "add",
                        "path": "/user",
                        "value": [{"id": user_id, "role": role_id}],
                    }
                ]
            },
        )
        response.raise_for_status()
        data = response.json()
        return RolesResult(success=True, roles=data.get("roles", []))
    except Exception as e:
        return RolesResult(success=False, error=_extract_error(e))


async def remove_workspace_user(
    workspace_id: str,
    user_id: str,
    role_id: str,
) -> RolesResult:
    """Remove a user from workspace."""
    try:
        response = await _request(
            "PATCH",
            f"{POSTMAN_API_BASE}/workspaces/{workspace_id}/roles",
            json={
                "roles": [
                    {
                        "op": "remove",
                        "path": "/user",
                        "value": [{"id": user_id, "role": role_id}],
                    }
                ]
            },
        )
        response.raise_for_status()
        data = response.json()
        return RolesResult(success=True, roles=data.get("roles", []))
    except Exception as e:
        return RolesResult(success=False, error=_extract_error(e))


async def add_multiple_admins(
    workspace_id: str,
    user_ids: list[str],
    on_progress: Optional[ProgressCallback] = None,
) -> dict[str, list[Any]]:
    """Add multiple admins to a workspace."""
    results: dict[str, list[Any]] = {"success": [], "failed": []}
    for i, user_id in enumerate(user_ids):
        if on_progress:
            on_progress({
                "phase": "admins",
                "message": f"Adding admin: {user_id}",
                "current": i + 1,
                "total": len(user_ids),
            })
        add_result = await add_workspace_admin(workspace_id, user_id, "3")
        if add_result.success:
            results["success"].append({"user_id": user_id, "role_id": "3"})
        else:
            results["failed"].append({"user_id": user_id, "error": add_result.error})
        await asyncio.sleep(0.3)
    return results


# ============================================================================
# PARTNER INVITATIONS MANAGEMENT
# ============================================================================


async def invite_partner(
    workspace_id: str,
    email: str,
    role_id: str = "7",
) -> InvitePartnerResult:
    """Invite a partner to a workspace."""
    try:
        response = await _request(
            "POST",
            f"{POSTMAN_API_BASE}/invitations",
            json={
                "action": "invite_partner",
                "targetEntity": "workspace",
                "targetEntityId": workspace_id,
                "roleId": role_id,
                "target": {"emails": [email]},
            },
        )
        response.raise_for_status()
        data = response.json()
        result = (data.get("results") or [{}])[0]
        return InvitePartnerResult(
            success=True,
            email=result.get("email", email),
            status=result.get("status"),
            invitation_link=result.get("invitationLink"),
            user_id=result.get("userId"),
            role_display_name=data.get("roleDisplayName"),
        )
    except Exception as e:
        return InvitePartnerResult(success=False, email=email, error=_extract_error(e))


async def remove_partner(workspace_id: str, user_id: str) -> RemovePartnerResult:
    """Remove a partner from a workspace."""
    try:
        response = await _request(
            "POST",
            f"{POSTMAN_API_BASE}/invitations",
            json={
                "action": "remove_partner",
                "targetEntity": "workspace",
                "targetEntityId": workspace_id,
                "target": {"userIds": [user_id]},
            },
        )
        response.raise_for_status()
        data = response.json()
        result = (data.get("results") or [{}])[0]
        return RemovePartnerResult(
            success=True,
            user_id=str(result.get("userId", user_id)),
            status=result.get("status"),
        )
    except Exception as e:
        return RemovePartnerResult(success=False, user_id=user_id, error=_extract_error(e))


async def remove_partner_from_team(team_id: str, user_id: str) -> RemovePartnerResult:
    """Remove a partner from the entire team."""
    try:
        response = await _request(
            "POST",
            f"{POSTMAN_API_BASE}/invitations",
            json={
                "action": "remove_partner",
                "targetEntity": "team",
                "targetEntityId": team_id,
                "target": {"userIds": [user_id]},
            },
        )
        response.raise_for_status()
        data = response.json()
        result = (data.get("results") or [{}])[0]
        return RemovePartnerResult(
            success=True,
            user_id=str(result.get("userId", user_id)),
            status=result.get("status"),
        )
    except Exception as e:
        return RemovePartnerResult(success=False, user_id=user_id, error=_extract_error(e))


async def invite_multiple_partners(
    workspace_id: str,
    emails: list[str],
    role_id: str = "7",
    on_progress: Optional[ProgressCallback] = None,
) -> dict[str, list[Any]]:
    """Invite multiple partners to a workspace."""
    results: dict[str, list[Any]] = {"success": [], "failed": []}
    for i, email in enumerate(emails):
        if on_progress:
            on_progress({
                "phase": "invitations",
                "message": f"Inviting partner: {email}",
                "current": i + 1,
                "total": len(emails),
            })
        invite_result = await invite_partner(workspace_id, email, role_id)
        if invite_result.success:
            results["success"].append({
                "email": invite_result.email,
                "status": invite_result.status,
                "invitation_link": invite_result.invitation_link,
                "user_id": invite_result.user_id,
                "role_display_name": invite_result.role_display_name,
            })
        else:
            results["failed"].append({"email": email, "error": invite_result.error})
        await asyncio.sleep(0.3)
    return results


async def remove_multiple_partners(
    workspace_id: str,
    user_ids: list[str],
    on_progress: Optional[ProgressCallback] = None,
) -> dict[str, list[Any]]:
    """Remove multiple partners from a workspace."""
    results: dict[str, list[Any]] = {"success": [], "failed": []}
    for i, user_id in enumerate(user_ids):
        if on_progress:
            on_progress({
                "phase": "removePartners",
                "message": f"Removing partner: {user_id}",
                "current": i + 1,
                "total": len(user_ids),
            })
        remove_result = await remove_partner(workspace_id, user_id)
        if remove_result.success:
            results["success"].append({
                "user_id": remove_result.user_id,
                "status": remove_result.status,
            })
        else:
            results["failed"].append({"user_id": user_id, "error": remove_result.error})
        await asyncio.sleep(0.3)
    return results


# ============================================================================
# SPEC MANAGEMENT
# ============================================================================


async def get_all_specs(workspace_id: str) -> list[dict[str, Any]]:
    """Get all specs from a workspace."""
    try:
        response = await _request(
            "GET",
            f"{POSTMAN_API_BASE}/specs?workspaceId={workspace_id}",
            use_auth_only=True,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("specs", [])
    except Exception as e:
        print(f"Error getting specs: {e}")
        return []


async def get_spec_details(spec_id: str) -> Optional[dict[str, Any]]:
    """Get spec details."""
    try:
        response = await _request(
            "GET",
            f"{POSTMAN_API_BASE}/specs/{spec_id}",
            use_auth_only=True,
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error getting spec details: {e}")
        return None


async def get_spec_files(spec_id: str) -> list[dict[str, Any]]:
    """Get all files in a spec."""
    try:
        response = await _request(
            "GET",
            f"{POSTMAN_API_BASE}/specs/{spec_id}/files",
            use_auth_only=True,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("files", [])
    except Exception as e:
        print(f"Error getting spec files: {e}")
        return []


async def get_spec_file(spec_id: str, file_path: str) -> Optional[dict[str, Any]]:
    """Get a specific spec file's content."""
    try:
        encoded_path = quote(file_path, safe="")
        response = await _request(
            "GET",
            f"{POSTMAN_API_BASE}/specs/{spec_id}/files/{encoded_path}",
            use_auth_only=True,
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error getting spec file {file_path}: {e}")
        return None


async def create_spec(
    workspace_id: str,
    name: str,
    spec_type: str,
    files: list[dict[str, Any]],
) -> CreateSpecResult:
    """Create a new spec in a workspace with files."""
    try:
        response = await _request(
            "POST",
            f"{POSTMAN_API_BASE}/specs?workspaceId={workspace_id}",
            json={"name": name, "type": spec_type, "files": files},
        )
        response.raise_for_status()
        return CreateSpecResult(success=True, spec=response.json())
    except Exception as e:
        return CreateSpecResult(success=False, error=_extract_error(e))


async def create_spec_file(
    spec_id: str,
    path: str,
    content: str,
) -> CreateSpecFileResult:
    """Create a file in a spec."""
    try:
        response = await _request(
            "POST",
            f"{POSTMAN_API_BASE}/specs/{spec_id}/files",
            json={"path": path, "content": content},
        )
        response.raise_for_status()
        return CreateSpecFileResult(success=True, file=response.json())
    except Exception as e:
        return CreateSpecFileResult(success=False, error=_extract_error(e))


async def update_spec_file_type(
    spec_id: str,
    file_path: str,
    spec_file_type: str,
) -> CreateSpecFileResult:
    """Update a spec file's type (e.g., set as ROOT)."""
    try:
        encoded_path = quote(file_path, safe="")
        response = await _request(
            "PATCH",
            f"{POSTMAN_API_BASE}/specs/{spec_id}/files/{encoded_path}",
            json={"type": spec_file_type},
        )
        response.raise_for_status()
        return CreateSpecFileResult(success=True, file=response.json())
    except Exception as e:
        return CreateSpecFileResult(success=False, error=_extract_error(e))


async def delete_spec(spec_id: str) -> bool:
    """Delete a spec."""
    try:
        response = await _request(
            "DELETE",
            f"{POSTMAN_API_BASE}/specs/{spec_id}",
            use_auth_only=True,
        )
        response.raise_for_status()
        return True
    except Exception as e:
        print(f"Error deleting spec: {e}")
        return False


async def copy_spec(
    source_spec_id: str,
    source_spec_name: str,
    source_spec_type: str,
    target_workspace_id: str,
    on_progress: Optional[ProgressCallback] = None,
) -> CopySpecResult:
    """Copy a single spec with all its files from source to target workspace."""
    result = CopySpecResult(
        success=False,
        spec_name=source_spec_name,
        new_spec_id=None,
        files_copied=0,
        total_files=0,
        errors=[],
    )
    try:
        if on_progress:
            on_progress({"step": "files", "message": f"Getting files for: {source_spec_name}"})
        source_files = await get_spec_files(source_spec_id)
        result.total_files = len(source_files)

        if not source_files:
            result.errors.append("No files found in source spec")
            return result

        if on_progress:
            on_progress({
                "step": "content",
                "message": f"Fetching {len(source_files)} file(s) content...",
            })
        files_with_content: list[dict[str, Any]] = []

        for idx, file_info in enumerate(source_files):
            path = file_info.get("path", "")
            if on_progress:
                on_progress({
                    "step": "fetchingFile",
                    "message": f"Fetching: {path}",
                    "current": len(files_with_content) + 1,
                    "total": len(source_files),
                })
            file_content = await get_spec_file(source_spec_id, path)
            if file_content and file_content.get("content"):
                files_with_content.append({
                    "path": path,
                    "content": file_content["content"],
                    "type": file_info.get("type"),
                })
            else:
                result.errors.append(f"Failed to get content for file: {path}")
            await asyncio.sleep(0.2)

        if not files_with_content:
            result.errors.append("Could not retrieve any file contents")
            return result

        if on_progress:
            on_progress({
                "step": "create",
                "message": f"Creating spec with {len(files_with_content)} file(s)...",
            })
        create_result = await create_spec(
            target_workspace_id, source_spec_name, source_spec_type, files_with_content
        )

        if not create_result.success:
            result.errors.append(f"Failed to create spec: {create_result.error}")
            return result

        result.new_spec_id = create_result.spec.get("id") if create_result.spec else None
        result.files_copied = len(files_with_content)
        result.success = True
        return result
    except Exception as e:
        result.errors.append(f"Unexpected error: {e}")
        return result


async def copy_specs(
    source_workspace_id: str,
    target_workspace_id: str,
    on_progress: Optional[ProgressCallback] = None,
) -> dict[str, list[Any]]:
    """Copy all specs from source workspace to target workspace."""
    results: dict[str, list[Any]] = {"copied": [], "errors": []}
    source_specs = await get_all_specs(source_workspace_id)

    if not source_specs:
        if on_progress:
            on_progress({"phase": "specs", "message": "No specs found in source workspace", "progress": 100})
        return results

    for i, spec in enumerate(source_specs):
        if on_progress:
            on_progress({
                "phase": "specs",
                "message": f"Copying spec: {spec.get('name')} ({spec.get('type')})",
                "currentItem": spec.get("name"),
                "current": i + 1,
                "total": len(source_specs),
                "progress": round((i / len(source_specs)) * 100),
            })
        copy_result = await copy_spec(
            spec["id"], spec["name"], spec["type"], target_workspace_id, on_progress
        )
        if copy_result.success:
            results["copied"].append({
                "original_spec_id": spec["id"],
                "new_spec_id": copy_result.new_spec_id,
                "name": spec["name"],
                "type": spec["type"],
                "files_copied": copy_result.files_copied,
            })
        else:
            results["errors"].append({
                "spec_name": spec["name"],
                "error": "; ".join(copy_result.errors),
            })
        await asyncio.sleep(0.5)

    return results


# ============================================================================
# COLLECTIONS MANAGEMENT
# ============================================================================


async def get_source_collections() -> list[dict[str, Any]]:
    """Get collections from source workspace."""
    source_id = _get_source_workspace_id()
    if not source_id:
        return []
    try:
        response = await _request(
            "GET",
            f"{POSTMAN_API_BASE}/collections?workspace={source_id}",
            use_auth_only=True,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("collections", [])
    except Exception as e:
        print(f"Error getting source collections: {e}")
        return []


async def fork_collection(
    collection_id: str,
    collection_name: str,
    workspace_id: str,
) -> ForkCollectionResult:
    """Fork a collection from source to target workspace."""
    try:
        response = await _request(
            "POST",
            f"{POSTMAN_API_BASE}/collections/fork/{collection_id}?workspace={workspace_id}",
            json={"label": collection_name},
        )
        response.raise_for_status()
        data = response.json()
        coll = data.get("collection", {})
        return ForkCollectionResult(
            success=True,
            collection_name=coll.get("name", collection_name),
            collection_id=coll.get("id"),
            uid=coll.get("uid"),
        )
    except Exception as e:
        return ForkCollectionResult(
            success=False,
            collection_name=collection_name,
            error=_extract_error(e),
        )


async def get_collection_details(collection_uid: str) -> Optional[dict[str, Any]]:
    """Get full collection details."""
    try:
        response = await _request(
            "GET",
            f"{POSTMAN_API_BASE}/collections/{collection_uid}",
            use_auth_only=True,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("collection")
    except Exception as e:
        print(f"Error getting collection details: {e}")
        return None


async def create_collection_in_postman(
    collection_data: dict[str, Any],
    workspace_id: str,
) -> CreateCollectionResult:
    """Create a collection in Postman."""
    try:
        response = await _request(
            "POST",
            f"{POSTMAN_API_BASE}/collections?workspace={workspace_id}",
            json={"collection": collection_data},
        )
        response.raise_for_status()
        data = response.json()
        coll = data.get("collection", {})
        info = collection_data.get("info", {})
        return CreateCollectionResult(
            success=True,
            collection_name=info.get("name", "Unknown"),
            collection_id=coll.get("id"),
            uid=coll.get("uid"),
        )
    except Exception as e:
        info = collection_data.get("info", {})
        return CreateCollectionResult(
            success=False,
            collection_name=info.get("name", "Unknown"),
            error=_extract_error(e),
        )


async def create_multiple_collections(
    collections: list[dict[str, Any]],
    workspace_id: str,
    on_progress: Optional[ProgressCallback] = None,
) -> list[CreateCollectionResult]:
    """Create multiple collections with progress callback."""
    results: list[CreateCollectionResult] = []
    for i, collection in enumerate(collections):
        result = await create_collection_in_postman(collection, workspace_id)
        results.append(result)
        if on_progress:
            info = collection.get("info", {})
            on_progress({
                "current": i + 1,
                "total": len(collections),
                "currentItem": info.get("name", "Unknown"),
                "result": result,
            })
        await asyncio.sleep(0.5)
    return results


async def get_all_collections(workspace_id: str) -> list[dict[str, Any]]:
    """Get all collections in workspace."""
    try:
        response = await _request(
            "GET",
            f"{POSTMAN_API_BASE}/collections?workspace={workspace_id}",
            use_auth_only=True,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("collections", [])
    except Exception as e:
        print(f"Error getting collections: {e}")
        return []


async def delete_collection(collection_id: str) -> bool:
    """Delete a collection."""
    try:
        response = await _request(
            "DELETE",
            f"{POSTMAN_API_BASE}/collections/{collection_id}",
            use_auth_only=True,
        )
        response.raise_for_status()
        return True
    except Exception as e:
        print(f"Error deleting collection: {e}")
        return False


async def patch_collection_variables(
    collection_uid: str, variables: list[dict]
) -> dict:
    """Update a collection's variables via PATCH."""
    try:
        response = await _request(
            "PATCH",
            f"{POSTMAN_API_BASE}/collections/{collection_uid}",
            json={"collection": {"variable": variables}},
        )
        response.raise_for_status()
        data = response.json()
        return {"success": True, "collection": data.get("collection")}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ============================================================================
# ENVIRONMENT MANAGEMENT
# ============================================================================


async def create_environment_in_postman(
    environment_name: str,
    variables: list[dict[str, Any]],
    workspace_id: str,
) -> CreateEnvironmentResult:
    """Create environment in Postman."""
    try:
        values = [
            {
                "key": v.get("key"),
                "value": str(v.get("value", "")),
                "enabled": v.get("enabled", True),
                "type": v.get("type", "default"),
                "description": v.get("description", ""),
            }
            for v in variables
        ]
        response = await _request(
            "POST",
            f"{POSTMAN_API_BASE}/environments?workspace={workspace_id}",
            json={"environment": {"name": environment_name, "values": values}},
        )
        response.raise_for_status()
        data = response.json()
        env = data.get("environment", {})
        return CreateEnvironmentResult(
            success=True,
            environment_name=environment_name,
            environment_id=env.get("id"),
            uid=env.get("uid"),
        )
    except Exception as e:
        return CreateEnvironmentResult(
            success=False,
            environment_name=environment_name,
            error=_extract_error(e),
        )


async def get_all_environments(workspace_id: str) -> list[dict[str, Any]]:
    """Get all environments in workspace."""
    try:
        response = await _request(
            "GET",
            f"{POSTMAN_API_BASE}/environments?workspace={workspace_id}",
            use_auth_only=True,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("environments", [])
    except Exception as e:
        print(f"Error getting environments: {e}")
        return []


async def get_environment_details(environment_uid: str) -> Optional[dict[str, Any]]:
    """Get environment details."""
    try:
        response = await _request(
            "GET",
            f"{POSTMAN_API_BASE}/environments/{environment_uid}",
            use_auth_only=True,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("environment")
    except Exception as e:
        print(f"Error getting environment details: {e}")
        return None


async def update_environment(
    environment_uid: str,
    name: str,
    variables: list[dict[str, Any]],
) -> UpdateEnvironmentResult:
    """Update environment."""
    try:
        values = [
            {
                "key": v.get("key"),
                "value": str(v.get("value", "")),
                "enabled": v.get("enabled", True),
                "type": v.get("type", "default"),
            }
            for v in variables
        ]
        response = await _request(
            "PUT",
            f"{POSTMAN_API_BASE}/environments/{environment_uid}",
            json={"environment": {"name": name, "values": values}},
        )
        response.raise_for_status()
        data = response.json()
        return UpdateEnvironmentResult(success=True, environment=data.get("environment"))
    except Exception as e:
        return UpdateEnvironmentResult(success=False, error=_extract_error(e))


async def delete_environment(environment_id: str) -> bool:
    """Delete an environment."""
    try:
        response = await _request(
            "DELETE",
            f"{POSTMAN_API_BASE}/environments/{environment_id}",
            use_auth_only=True,
        )
        response.raise_for_status()
        return True
    except Exception as e:
        print(f"Error deleting environment: {e}")
        return False


# ============================================================================
# MOCK SERVER MANAGEMENT
# ============================================================================


async def get_all_mocks(workspace_id: str) -> list[dict[str, Any]]:
    """Get all mock servers in workspace."""
    try:
        response = await _request(
            "GET",
            f"{POSTMAN_API_BASE}/mocks?workspace={workspace_id}",
            use_auth_only=True,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("mocks", [])
    except Exception as e:
        print(f"Error getting mocks: {e}")
        return []


async def delete_mock(mock_id: str) -> bool:
    """Delete a mock server. Use mock.id (not mock.uid) for deletion."""
    try:
        response = await _request(
            "DELETE",
            f"{POSTMAN_API_BASE}/mocks/{mock_id}",
            use_auth_only=True,
        )
        response.raise_for_status()
        return True
    except Exception as e:
        print(f"Error deleting mock: {e}")
        return False


async def create_mock_server(
    mock_name: str,
    collection_uid: str,
    workspace_id: str,
    environment_uid: Optional[str] = None,
) -> CreateMockServerResult:
    """Create mock server in Postman."""
    try:
        response = await _request(
            "POST",
            f"{POSTMAN_API_BASE}/mocks?workspace={workspace_id}",
            json={
                "mock": {
                    "name": mock_name,
                    "collection": collection_uid,
                    "environment": environment_uid,
                    "private": False,
                }
            },
        )
        response.raise_for_status()
        data = response.json()
        mock = data.get("mock", {})
        return CreateMockServerResult(
            success=True,
            mock_name=mock_name,
            mock_id=mock.get("id"),
            mock_url=mock.get("mockUrl"),
            uid=mock.get("uid"),
        )
    except Exception as e:
        return CreateMockServerResult(
            success=False,
            mock_name=mock_name,
            error=_extract_error(e),
        )


# ============================================================================
# RESET OPERATIONS
# ============================================================================


async def reset_workspace(
    workspace_id: str,
    on_progress: Optional[ProgressCallback] = None,
    options: Optional[ResetOptions] = None,
) -> dict[str, Any]:
    """Reset workspace — delete all resources in reverse order of provisioning."""
    opts = options or {}
    include_specs = opts.get("include_specs", True)
    include_mocks = opts.get("include_mocks", True)
    include_environments = opts.get("include_environments", True)
    include_collections = opts.get("include_collections", True)

    result: dict[str, Any] = {
        "deleted_specs": 0,
        "deleted_mocks": 0,
        "deleted_environments": 0,
        "deleted_collections": 0,
        "total_specs": 0,
        "total_mocks": 0,
        "total_environments": 0,
        "total_collections": 0,
        "errors": [],
    }

    try:
        if include_specs:
            specs = await get_all_specs(workspace_id)
            result["total_specs"] = len(specs)
            if on_progress:
                on_progress({
                    "phase": "specs",
                    "message": f"Deleting {len(specs)} spec(s)...",
                    "deleted": 0,
                    "total": len(specs),
                })
            for spec in specs:
                if await delete_spec(spec["id"]):
                    result["deleted_specs"] += 1
                else:
                    result["errors"].append(f"Failed to delete spec: {spec.get('name')}")
                if on_progress:
                    on_progress({
                        "phase": "specs",
                        "deleted": result["deleted_specs"],
                        "total": len(specs),
                        "currentItem": spec.get("name"),
                    })
                await asyncio.sleep(0.3)

        if include_mocks:
            mocks = await get_all_mocks(workspace_id)
            result["total_mocks"] = len(mocks)
            if on_progress:
                on_progress({
                    "phase": "mocks",
                    "message": f"Deleting {len(mocks)} mock server(s)...",
                    "deleted": 0,
                    "total": len(mocks),
                })
            for mock in mocks:
                if await delete_mock(mock["id"]):
                    result["deleted_mocks"] += 1
                else:
                    result["errors"].append(f"Failed to delete mock: {mock.get('name')}")
                if on_progress:
                    on_progress({
                        "phase": "mocks",
                        "deleted": result["deleted_mocks"],
                        "total": len(mocks),
                        "currentItem": mock.get("name"),
                    })
                await asyncio.sleep(0.3)

        if include_environments:
            environments = await get_all_environments(workspace_id)
            result["total_environments"] = len(environments)
            if on_progress:
                on_progress({
                    "phase": "environments",
                    "message": f"Deleting {len(environments)} environment(s)...",
                    "deleted": 0,
                    "total": len(environments),
                })
            for env in environments:
                if await delete_environment(env["uid"]):
                    result["deleted_environments"] += 1
                else:
                    result["errors"].append(f"Failed to delete environment: {env.get('name')}")
                if on_progress:
                    on_progress({
                        "phase": "environments",
                        "deleted": result["deleted_environments"],
                        "total": len(environments),
                        "currentItem": env.get("name"),
                    })
                await asyncio.sleep(0.3)

        if include_collections:
            collections = await get_all_collections(workspace_id)
            result["total_collections"] = len(collections)
            if on_progress:
                on_progress({
                    "phase": "collections",
                    "message": f"Deleting {len(collections)} collection(s)...",
                    "deleted": 0,
                    "total": len(collections),
                })
            for coll in collections:
                if await delete_collection(coll["uid"]):
                    result["deleted_collections"] += 1
                else:
                    result["errors"].append(f"Failed to delete collection: {coll.get('name')}")
                if on_progress:
                    on_progress({
                        "phase": "collections",
                        "deleted": result["deleted_collections"],
                        "total": len(collections),
                        "currentItem": coll.get("name"),
                    })
                await asyncio.sleep(0.3)

        # Clear workspace description
        try:
            await update_workspace(workspace_id, {"description": ""})
        except Exception as desc_err:
            print(f"WARNING: Failed to clear workspace description: {desc_err}")

        if on_progress:
            on_progress({"phase": "complete", "message": "Reset complete", "result": result})
        return result
    except Exception as e:
        result["errors"].append(f"Unexpected error: {e}")
        if on_progress:
            on_progress({"phase": "error", "message": str(e), "result": result})
        raise


# ============================================================================
# PROVISIONING OPERATIONS
# ============================================================================


async def provision_workspace(
    options: dict[str, Any],
    on_progress: Optional[ProgressCallback] = None,
) -> dict[str, Any]:
    """Full workspace provisioning — copies all assets and manages team/partners."""
    source_workspace_id = options.get("source_workspace_id")
    target_workspace_id = options.get("target_workspace_id")
    workspace_name = options.get("workspace_name", "Partner Workspace")
    workspace_type = options.get("workspace_type", "partner")
    admin_user_ids = options.get("admin_user_ids", [])
    partner_emails = options.get("partner_emails", [])
    partner_role_id = options.get("partner_role_id", "7")

    if not _get_api_key():
        raise ValueError("Postman API key not configured")
    if not source_workspace_id:
        raise ValueError("Source workspace ID is required")

    results: dict[str, Any] = {
        "workspace": None,
        "workspace_created": False,
        "collections": {"total": 0, "success": 0, "failed": [], "success_data": []},
        "mocks": {"total": 0, "success": 0, "failed": [], "urls": []},
        "environments": {"total": 0, "success": 0, "failed": [], "success_data": []},
        "mock_env": {"success": False, "action": None},
        "specs": {"total": 0, "success": 0, "failed": [], "success_data": []},
        "admins": {"total": 0, "success": 0, "failed": [], "success_data": []},
        "invitations": {"total": 0, "success": 0, "failed": [], "links": []},
        "errors": [],
    }

    try:
        if on_progress:
            on_progress({"phase": "validation", "message": "Validating API key...", "progress": 5})
        validation = await validate_api_key()
        if not validation.valid:
            raise ValueError(f"Invalid API key: {validation.error}")

        source_workspace = await get_workspace(source_workspace_id)
        if not source_workspace:
            raise ValueError(f"Source workspace not found: {source_workspace_id}")

        if on_progress:
            on_progress({
                "phase": "workspace",
                "message": "Using existing workspace..." if target_workspace_id else "Creating new workspace...",
                "progress": 10,
            })
        workspace_id: Optional[str] = target_workspace_id

        if target_workspace_id:
            existing = await get_workspace(target_workspace_id)
            if not existing:
                raise ValueError(f"Target workspace not found: {target_workspace_id}")
            results["workspace"] = existing
            results["workspace_created"] = False
        else:
            if not workspace_name:
                raise ValueError("Workspace name is required when creating a new workspace")
            create_result = await create_workspace(workspace_name, workspace_type)
            if not create_result.success:
                raise ValueError(f"Failed to create workspace: {create_result.error}")
            workspace_id = create_result.workspace.id if create_result.workspace else None
            results["workspace"] = create_result.workspace
            results["workspace_created"] = True

        if not workspace_id:
            raise ValueError("Workspace ID is required")

        # Copy workspace description from source
        try:
            source_description = source_workspace.get("description") if source_workspace else None
            if source_description:
                final_description = source_description
                company_name = derive_company_name(workspace_name or (results.get("workspace") or {}).get("name"))
                if company_name:
                    final_description = source_description.replace("<Company>", company_name)
                    print(f'Replaced <Company> placeholder with "{company_name}"')
                else:
                    print("WARNING: Could not derive company name from target workspace name — copying description as-is")
                update_result = await update_workspace(workspace_id, {"description": final_description})
                if update_result.get("success"):
                    print("Workspace description updated successfully")
                else:
                    print("WARNING: Failed to update workspace description — continuing provisioning")
            else:
                print("WARNING: Source workspace has no description — skipping description copy")
        except Exception as desc_err:
            print(f"WARNING: Unexpected error copying workspace description: {desc_err} — continuing provisioning")

        # Step 2: Copy Collections
        if on_progress:
            on_progress({"phase": "collections", "message": "Copying collections...", "progress": 20})
        source_collections = await get_all_collections(source_workspace_id)
        results["collections"]["total"] = len(source_collections)
        collection_map: dict[str, str] = {}

        for i, collection in enumerate(source_collections):
            if on_progress:
                on_progress({
                    "phase": "collections",
                    "message": f"Forking: {collection.get('name')}",
                    "current": i + 1,
                    "total": len(source_collections),
                    "progress": 20 + int((i / len(source_collections)) * 15),
                })
            fork_result = await fork_collection(
                collection["uid"], collection["name"], workspace_id
            )
            if fork_result.success and fork_result.uid:
                results["collections"]["success"] += 1
                results["collections"]["success_data"].append({
                    "name": fork_result.collection_name,
                    "uid": fork_result.uid,
                })
                collection_map[collection["uid"]] = fork_result.uid
            else:
                results["collections"]["failed"].append({
                    "name": collection["name"],
                    "error": fork_result.error,
                })
                results["errors"].append(f"Failed to fork {collection['name']}: {fork_result.error}")
            await asyncio.sleep(0.3)

        for coll in results["collections"]["success_data"]:
            details = await get_collection_details(coll["uid"])
            if details:
                coll["collection_details"] = details
                coll["host_variables"] = extract_host_variables(details)
            await asyncio.sleep(0.2)

        # Step 3: Create Mock Servers
        if on_progress:
            on_progress({"phase": "mocks", "message": "Creating mock servers...", "progress": 40})
        results["mocks"]["total"] = len(results["collections"]["success_data"])
        for i, coll in enumerate(results["collections"]["success_data"]):
            mock_name = f"{coll['name']} Mock"
            if on_progress:
                total = results["collections"]["success_data"]
                on_progress({
                    "phase": "mocks",
                    "message": f"Creating: {mock_name}",
                    "current": i + 1,
                    "total": len(total),
                    "progress": 40 + int((i / len(total)) * 15) if total else 40,
                })
            mock_result = await create_mock_server(
                mock_name, coll["uid"], workspace_id, None
            )
            if mock_result.success:
                results["mocks"]["success"] += 1
                results["mocks"]["urls"].append({
                    "collection_name": coll["name"],
                    "mock_name": mock_result.mock_name,
                    "mock_url": mock_result.mock_url,
                })
            else:
                results["mocks"]["failed"].append({"name": mock_name, "error": mock_result.error})
                results["errors"].append(f"Failed to create mock {mock_name}: {mock_result.error}")
            await asyncio.sleep(0.3)

        # Step 4: Copy Environments
        if on_progress:
            on_progress({"phase": "environments", "message": "Copying environments...", "progress": 60})
        source_environments = await get_all_environments(source_workspace_id)
        results["environments"]["total"] = len(source_environments)
        env_map: dict[str, dict[str, Any]] = {}

        for i, env in enumerate(source_environments):
            if on_progress:
                on_progress({
                    "phase": "environments",
                    "message": f"Copying: {env.get('name')}",
                    "current": i + 1,
                    "total": len(source_environments),
                    "progress": 60 + int((i / len(source_environments)) * 10),
                })
            env_details = await get_environment_details(env["uid"])
            if not env_details:
                results["environments"]["failed"].append({
                    "name": env["name"],
                    "error": "Could not get environment details",
                })
                continue
            create_result = await create_environment_in_postman(
                env_details["name"], env_details.get("values", []), workspace_id
            )
            if create_result.success and create_result.uid:
                results["environments"]["success"] += 1
                results["environments"]["success_data"].append({
                    "name": create_result.environment_name,
                    "uid": create_result.uid,
                })
                env_map[env["uid"]] = {
                    "target_uid": create_result.uid,
                    "name": env_details["name"],
                }
            else:
                results["environments"]["failed"].append({
                    "name": env_details["name"],
                    "error": create_result.error,
                })
                results["errors"].append(f"Failed to copy {env_details['name']}: {create_result.error}")
            await asyncio.sleep(0.3)

        # Step 5: Create fresh Mock Env
        if on_progress:
            on_progress({"phase": "mockEnv", "message": "Creating Mock Environment...", "progress": 75})
        mock_env_var_map: dict[str, str] = {}
        if results["mocks"]["urls"]:
            mock_variables: list[dict[str, Any]] = []
            for mock_entry in results["mocks"]["urls"]:
                coll_name = mock_entry["collection_name"]
                mock_url = mock_entry["mock_url"]
                coll_data = next(
                    (c for c in results["collections"]["success_data"] if c["name"] == coll_name),
                    None,
                )
                host_vars = coll_data.get("host_variables", []) if coll_data else []
                if host_vars:
                    camel_name = to_camel_case(coll_name)
                    for hv in host_vars:
                        pascal_var = to_pascal_case(hv["var_name"])
                        env_var_name = f"{camel_name}{pascal_var}"
                        mock_variables.append({
                            "key": env_var_name,
                            "value": mock_url,
                            "type": "default",
                            "enabled": True,
                            "description": f"Mock server URL for {coll_name} (variable: {hv['var_name']})",
                        })
                        if coll_data:
                            mock_env_var_map[f"{coll_data['uid']}:{hv['var_name']}"] = env_var_name
                else:
                    camel_name = to_camel_case(coll_name)
                    env_var_name = f"{camel_name}BaseUrl"
                    mock_variables.append({
                        "key": env_var_name,
                        "value": mock_url,
                        "type": "default",
                        "enabled": True,
                        "description": f"Mock server URL for {coll_name}",
                    })
                    if coll_data:
                        mock_env_var_map[f"{coll_data['uid']}:__fallback__"] = env_var_name

            create_result = await create_environment_in_postman(
                "Mock Env", mock_variables, workspace_id
            )
            if create_result.success:
                results["mock_env"] = {"success": True, "action": "created"}
            else:
                results["errors"].append(f"Failed to create Mock Env: {create_result.error}")

        # Step 5b: Update collection variables to reference mock env var names
        if mock_env_var_map:
            for coll in results["collections"]["success_data"]:
                if not coll.get("collection_details"):
                    continue
                host_vars = coll.get("host_variables", [])
                existing_vars = coll["collection_details"].get("variable", [])
                updated_vars: list[dict[str, Any]] = []
                if host_vars:
                    matched_keys: set[str] = set()
                    for v in existing_vars:
                        hv = next((h for h in host_vars if h["var_name"] == v.get("key")), None)
                        if hv:
                            env_name = mock_env_var_map.get(f"{coll['uid']}:{hv['var_name']}")
                            if env_name:
                                updated_vars.append({**v, "value": f"{{{{{env_name}}}}}"})
                                matched_keys.add(hv["var_name"])
                                continue
                        updated_vars.append(v)
                    for hv in host_vars:
                        env_name = mock_env_var_map.get(f"{coll['uid']}:{hv['var_name']}")
                        if env_name and hv["var_name"] not in matched_keys:
                            updated_vars.append({"key": hv["var_name"], "value": f"{{{{{env_name}}}}}", "type": "string"})
                    await patch_collection_variables(coll["uid"], updated_vars)
                else:
                    env_name = mock_env_var_map.get(f"{coll['uid']}:__fallback__")
                    if not env_name:
                        continue
                    fallback_done = False
                    for v in existing_vars:
                        if not fallback_done and v.get("key") in COMMON_HOST_VAR_NAMES:
                            updated_vars.append({**v, "value": f"{{{{{env_name}}}}}"})
                            fallback_done = True
                        else:
                            updated_vars.append(v)
                    if not fallback_done:
                        updated_vars.append({"key": "baseUrl", "value": f"{{{{{env_name}}}}}", "type": "string"})
                    await patch_collection_variables(coll["uid"], updated_vars)

        # Step 6: Copy Specs
        if on_progress:
            on_progress({"phase": "specs", "message": "Copying specs...", "progress": 80})
        source_specs = await get_all_specs(source_workspace_id)
        results["specs"]["total"] = len(source_specs)
        for i, spec in enumerate(source_specs):
            if on_progress:
                on_progress({
                    "phase": "specs",
                    "message": f"Copying: {spec.get('name')}",
                    "current": i + 1,
                    "total": len(source_specs),
                    "progress": 80 + int((i / len(source_specs)) * 15),
                })
            copy_result = await copy_spec(
                spec["id"], spec["name"], spec["type"], workspace_id
            )
            if copy_result.success:
                results["specs"]["success"] += 1
                results["specs"]["success_data"].append({
                    "name": copy_result.spec_name,
                    "id": copy_result.new_spec_id,
                    "files_copied": copy_result.files_copied,
                })
            else:
                results["specs"]["failed"].append({
                    "name": spec["name"],
                    "error": "; ".join(copy_result.errors),
                })
                results["errors"].append(f"Failed to copy spec {spec['name']}")
            await asyncio.sleep(0.5)

        # Step 7: Add Team Admins
        if admin_user_ids:
            if on_progress:
                on_progress({"phase": "admins", "message": "Adding workspace admins...", "progress": 88})
            results["admins"]["total"] = len(admin_user_ids)
            for i, user_id in enumerate(admin_user_ids):
                if on_progress:
                    on_progress({
                        "phase": "admins",
                        "message": f"Adding admin: {user_id}",
                        "current": i + 1,
                        "total": len(admin_user_ids),
                        "progress": 88 + int((i / len(admin_user_ids)) * 5),
                    })
                add_result = await add_workspace_admin(workspace_id, user_id, "3")
                if add_result.success:
                    results["admins"]["success"] += 1
                    results["admins"]["success_data"].append({"user_id": user_id, "role_id": "3"})
                else:
                    results["admins"]["failed"].append({"user_id": user_id, "error": add_result.error})
                    results["errors"].append(f"Failed to add admin {user_id}: {add_result.error}")
                await asyncio.sleep(0.3)

        # Step 8: Invite Partners
        if partner_emails:
            if on_progress:
                on_progress({"phase": "invitations", "message": "Inviting partners...", "progress": 93})
            results["invitations"]["total"] = len(partner_emails)
            for i, email in enumerate(partner_emails):
                if on_progress:
                    on_progress({
                        "phase": "invitations",
                        "message": f"Inviting partner: {email}",
                        "current": i + 1,
                        "total": len(partner_emails),
                        "progress": 93 + int((i / len(partner_emails)) * 6),
                    })
                invite_result = await invite_partner(workspace_id, email, partner_role_id)
                if invite_result.success:
                    results["invitations"]["success"] += 1
                    if invite_result.invitation_link:
                        results["invitations"]["links"].append({
                            "email": invite_result.email,
                            "invitation_link": invite_result.invitation_link,
                            "status": invite_result.status,
                        })
                else:
                    results["invitations"]["failed"].append({"email": email, "error": invite_result.error})
                    results["errors"].append(f"Failed to invite partner {email}: {invite_result.error}")
                await asyncio.sleep(0.3)

        if on_progress:
            on_progress({"phase": "complete", "message": "Provisioning complete!", "progress": 100, "results": results})
        return results
    except Exception as e:
        results["errors"].append(str(e))
        if on_progress:
            on_progress({"phase": "error", "message": f"Error: {e}", "progress": 0, "results": results})
        raise


async def quick_provision(
    source_workspace_id: str,
    workspace_name: str,
    options: Optional[QuickProvisionOptions] = None,
    on_progress: Optional[ProgressCallback] = None,
) -> dict[str, Any]:
    """Simplified provisioning — creates a new workspace and copies all content."""
    opts = options or {}
    return await provision_workspace(
        {
            "source_workspace_id": source_workspace_id,
            "workspace_name": workspace_name,
            "workspace_type": opts.get("workspace_type", "partner"),
            **opts,
        },
        on_progress,
    )


# ============================================================================
# UPDATE OPERATIONS
# ============================================================================


async def update_workspace_assets(
    source_workspace_id: str,
    target_workspace_id: str,
    on_progress: Optional[ProgressCallback] = None,
) -> dict[str, Any]:
    """
    Update a target workspace by detecting and adding net-new assets from source.

    Detects new collections (fork check + name fallback), specs (name match),
    and environments (name match, excluding "Mock Env"). Forks new collections,
    creates mock servers, updates Mock Env in-place with dedup, updates collection
    variables, and copies new specs and environments.
    """
    if not _get_api_key():
        raise ValueError("Postman API key not configured")
    if not source_workspace_id:
        raise ValueError("Source workspace ID is required")
    if not target_workspace_id:
        raise ValueError("Target workspace ID is required")

    results: dict[str, Any] = {
        "collections": {"total": 0, "success": 0, "failed": [], "success_data": []},
        "mocks": {"total": 0, "success": 0, "failed": [], "urls": []},
        "mock_env": {"success": False, "action": None},
        "specs": {"total": 0, "success": 0, "failed": [], "success_data": []},
        "environments": {"total": 0, "success": 0, "failed": [], "success_data": []},
        "errors": [],
    }

    try:
        # Step 1: Detect new assets
        if on_progress:
            on_progress({"phase": "detection", "message": "Scanning workspaces for new assets...", "progress": 5})

        source_colls = await get_all_collections(source_workspace_id)
        target_colls = await get_all_collections(target_workspace_id)
        source_specs = await get_all_specs(source_workspace_id)
        target_specs = await get_all_specs(target_workspace_id)
        source_envs = await get_all_environments(source_workspace_id)
        target_envs = await get_all_environments(target_workspace_id)

        # Collections: fork check + name fallback
        target_fork_sources: set[str] = set()
        target_names: set[str] = set()
        for tc in target_colls:
            target_names.add(tc.get("name", ""))
            try:
                details = await get_collection_details(tc["uid"])
                if details:
                    fork_from = (details.get("fork") or {}).get("from")
                    if fork_from:
                        target_fork_sources.add(fork_from)
            except Exception:
                pass
            await asyncio.sleep(0.3)

        new_collections = [
            sc for sc in source_colls
            if sc.get("uid") not in target_fork_sources and sc.get("name") not in target_names
        ]

        # Specs: name match
        target_spec_names = {s.get("name") for s in target_specs}
        new_specs = [s for s in source_specs if s.get("name") not in target_spec_names]

        # Environments: name match, exclude Mock Env
        target_env_names = {e.get("name") for e in target_envs}
        new_environments = [
            e for e in source_envs
            if e.get("name") != "Mock Env" and e.get("name") not in target_env_names
        ]

        if on_progress:
            on_progress({
                "phase": "detection",
                "message": f"Found {len(new_collections)} new collection(s), {len(new_specs)} new spec(s), {len(new_environments)} new environment(s)",
                "progress": 15,
            })

        if not new_collections and not new_specs and not new_environments:
            if on_progress:
                on_progress({"phase": "complete", "message": "Workspace is up to date — no new assets found.", "progress": 100, "results": results})
            return results

        # Step 2: Fork new collections
        if on_progress:
            on_progress({"phase": "collections", "message": "Forking new collections...", "progress": 20})
        results["collections"]["total"] = len(new_collections)

        for i, collection in enumerate(new_collections):
            if on_progress:
                on_progress({
                    "phase": "collections",
                    "message": f"Forking: {collection.get('name')}",
                    "current": i + 1,
                    "total": len(new_collections),
                    "progress": 20 + int((i / len(new_collections)) * 15) if new_collections else 20,
                })
            fork_result = await fork_collection(collection["uid"], collection["name"], target_workspace_id)
            if fork_result.success and fork_result.uid:
                results["collections"]["success"] += 1
                coll_details = await get_collection_details(fork_result.uid)
                host_variables = extract_host_variables(coll_details) if coll_details else []
                results["collections"]["success_data"].append({
                    "name": fork_result.collection_name,
                    "uid": fork_result.uid,
                    "host_variables": host_variables,
                    "collection_details": coll_details,
                })
            else:
                results["collections"]["failed"].append({"name": collection["name"], "error": fork_result.error})
                results["errors"].append(f"Failed to fork {collection['name']}: {fork_result.error}")
            await asyncio.sleep(0.3)

        # Step 3: Create mock servers for new collections
        if results["collections"]["success_data"]:
            if on_progress:
                on_progress({"phase": "mocks", "message": "Creating mock servers...", "progress": 40})
            results["mocks"]["total"] = len(results["collections"]["success_data"])
            for i, coll in enumerate(results["collections"]["success_data"]):
                mock_name = f"{coll['name']} Mock"
                if on_progress:
                    total = results["collections"]["success_data"]
                    on_progress({
                        "phase": "mocks",
                        "message": f"Creating: {mock_name}",
                        "current": i + 1,
                        "total": len(total),
                        "progress": 40 + int((i / len(total)) * 15) if total else 40,
                    })
                mock_result = await create_mock_server(mock_name, coll["uid"], target_workspace_id, None)
                if mock_result.success:
                    results["mocks"]["success"] += 1
                    results["mocks"]["urls"].append({
                        "collection_name": coll["name"],
                        "mock_name": mock_result.mock_name,
                        "mock_url": mock_result.mock_url,
                        "target_uid": coll["uid"],
                        "host_variables": coll.get("host_variables", []),
                    })
                else:
                    results["mocks"]["failed"].append({"name": mock_name, "error": mock_result.error})
                    results["errors"].append(f"Failed to create mock {mock_name}: {mock_result.error}")
                await asyncio.sleep(0.3)

        # Step 4: Update Mock Env in-place (or create if missing)
        mock_env_var_map: dict[str, str] = {}
        if results["mocks"]["urls"]:
            if on_progress:
                on_progress({"phase": "mockEnv", "message": "Updating Mock Environment...", "progress": 60})

            new_variables: list[dict[str, Any]] = []
            for mock_entry in results["mocks"]["urls"]:
                coll_name = mock_entry["collection_name"]
                mock_url = mock_entry["mock_url"]
                target_uid = mock_entry["target_uid"]
                host_vars = mock_entry.get("host_variables", [])
                if host_vars:
                    camel_name = to_camel_case(coll_name)
                    for hv in host_vars:
                        pascal_var = to_pascal_case(hv["var_name"])
                        env_var_name = f"{camel_name}{pascal_var}"
                        new_variables.append({
                            "key": env_var_name, "value": mock_url, "type": "default", "enabled": True,
                        })
                        mock_env_var_map[f"{target_uid}:{hv['var_name']}"] = env_var_name
                else:
                    camel_name = to_camel_case(coll_name)
                    env_var_name = f"{camel_name}BaseUrl"
                    new_variables.append({
                        "key": env_var_name, "value": mock_url, "type": "default", "enabled": True,
                    })
                    mock_env_var_map[f"{target_uid}:__fallback__"] = env_var_name

            if new_variables:
                mock_env = next((e for e in target_envs if e.get("name") == "Mock Env"), None)
                if mock_env:
                    # Update existing Mock Env in-place with deduplication
                    env_details = await get_environment_details(mock_env["uid"])
                    existing_vars = env_details.get("values", []) if env_details else []
                    existing_keys: set[str] = {v.get("key", "") for v in existing_vars}

                    deduped: list[dict[str, Any]] = []
                    for v in new_variables:
                        if v["key"] in existing_keys:
                            suffix = 2
                            new_key = f"{v['key']}{suffix}"
                            while new_key in existing_keys:
                                suffix += 1
                                new_key = f"{v['key']}{suffix}"
                            existing_keys.add(new_key)
                            # Update the map to reflect the deduped key
                            for map_key, map_val in list(mock_env_var_map.items()):
                                if map_val == v["key"]:
                                    mock_env_var_map[map_key] = new_key
                            deduped.append({**v, "key": new_key})
                        else:
                            existing_keys.add(v["key"])
                            deduped.append(v)

                    merged = existing_vars + deduped
                    update_result = await update_environment(mock_env["uid"], "Mock Env", merged)
                    results["mock_env"] = {"success": update_result.get("success", False), "action": "updated"}
                    if not update_result.get("success"):
                        results["errors"].append(f"Failed to update Mock Env: {update_result.get('error', 'Unknown error')}")
                else:
                    # Create fresh Mock Env
                    create_result = await create_environment_in_postman("Mock Env", new_variables, target_workspace_id)
                    results["mock_env"] = {"success": create_result.success, "action": "created"}
                    if not create_result.success:
                        results["errors"].append(f"Failed to create Mock Env: {create_result.error}")

        # Step 5: Update collection variables to reference mock env var names
        if mock_env_var_map:
            if on_progress:
                on_progress({"phase": "collectionVars", "message": "Updating collection variables...", "progress": 70})
            for coll in results["collections"]["success_data"]:
                if not coll.get("collection_details"):
                    continue
                host_vars = coll.get("host_variables", [])
                existing_vars = coll["collection_details"].get("variable", [])
                updated_vars: list[dict[str, Any]] = []

                if host_vars:
                    matched_keys: set[str] = set()
                    for v in existing_vars:
                        hv = next((h for h in host_vars if h["var_name"] == v.get("key")), None)
                        if hv:
                            env_name = mock_env_var_map.get(f"{coll['uid']}:{hv['var_name']}")
                            if env_name:
                                updated_vars.append({**v, "value": f"{{{{{env_name}}}}}"})
                                matched_keys.add(hv["var_name"])
                                continue
                        updated_vars.append(v)
                    for hv in host_vars:
                        env_name = mock_env_var_map.get(f"{coll['uid']}:{hv['var_name']}")
                        if env_name and hv["var_name"] not in matched_keys:
                            updated_vars.append({"key": hv["var_name"], "value": f"{{{{{env_name}}}}}", "type": "string"})
                    await patch_collection_variables(coll["uid"], updated_vars)
                else:
                    env_name = mock_env_var_map.get(f"{coll['uid']}:__fallback__")
                    if not env_name:
                        continue
                    fallback_done = False
                    for v in existing_vars:
                        if not fallback_done and v.get("key") in COMMON_HOST_VAR_NAMES:
                            updated_vars.append({**v, "value": f"{{{{{env_name}}}}}"})
                            fallback_done = True
                        else:
                            updated_vars.append(v)
                    if not fallback_done:
                        updated_vars.append({"key": "baseUrl", "value": f"{{{{{env_name}}}}}", "type": "string"})
                    await patch_collection_variables(coll["uid"], updated_vars)
                await asyncio.sleep(0.3)

        # Step 6: Copy new specs
        if new_specs:
            if on_progress:
                on_progress({"phase": "specs", "message": "Copying new specs...", "progress": 80})
            results["specs"]["total"] = len(new_specs)
            for i, spec in enumerate(new_specs):
                if on_progress:
                    on_progress({
                        "phase": "specs",
                        "message": f"Copying: {spec.get('name')}",
                        "current": i + 1,
                        "total": len(new_specs),
                        "progress": 80 + int((i / len(new_specs)) * 10),
                    })
                copy_result = await copy_spec(spec["id"], spec["name"], spec["type"], target_workspace_id)
                if copy_result.success:
                    results["specs"]["success"] += 1
                    results["specs"]["success_data"].append({
                        "name": copy_result.spec_name,
                        "id": copy_result.new_spec_id,
                        "files_copied": copy_result.files_copied,
                    })
                else:
                    results["specs"]["failed"].append({"name": spec["name"], "error": "; ".join(copy_result.errors)})
                    results["errors"].append(f"Failed to copy spec {spec['name']}")
                await asyncio.sleep(0.5)

        # Step 7: Copy new environments
        if new_environments:
            if on_progress:
                on_progress({"phase": "environments", "message": "Copying new environments...", "progress": 90})
            results["environments"]["total"] = len(new_environments)
            for i, env in enumerate(new_environments):
                if on_progress:
                    on_progress({
                        "phase": "environments",
                        "message": f"Copying: {env.get('name')}",
                        "current": i + 1,
                        "total": len(new_environments),
                        "progress": 90 + int((i / len(new_environments)) * 9),
                    })
                env_details = await get_environment_details(env["uid"])
                if not env_details:
                    results["environments"]["failed"].append({"name": env.get("name", ""), "error": "Could not get environment details"})
                    continue
                create_result = await create_environment_in_postman(
                    env_details["name"], env_details.get("values", []), target_workspace_id
                )
                if create_result.success and create_result.uid:
                    results["environments"]["success"] += 1
                    results["environments"]["success_data"].append({
                        "name": create_result.environment_name, "uid": create_result.uid,
                    })
                else:
                    results["environments"]["failed"].append({"name": env_details["name"], "error": create_result.error})
                    results["errors"].append(f"Failed to copy environment {env_details['name']}: {create_result.error}")
                await asyncio.sleep(0.3)

        if on_progress:
            on_progress({"phase": "complete", "message": "Update complete!", "progress": 100, "results": results})
        return results
    except Exception as e:
        results["errors"].append(str(e))
        if on_progress:
            on_progress({"phase": "error", "message": f"Error: {e}", "progress": 0, "results": results})
        raise


# ============================================================================
# CONFIGURATION & UTILITIES
# ============================================================================


def is_postman_configured() -> bool:
    """Check if Postman is properly configured for basic operations."""
    return bool(_get_api_key() and _get_source_workspace_id())


def is_postman_fully_configured() -> bool:
    """Check if Postman is fully configured (including target workspace)."""
    return bool(_get_api_key() and _get_target_workspace_id() and _get_source_workspace_id())


def get_configuration_status() -> ConfigurationStatus:
    """Get configuration status for debugging."""
    has_api = bool(_get_api_key())
    has_target = bool(_get_target_workspace_id())
    has_source = bool(_get_source_workspace_id())
    if not has_api:
        message = "Missing API key (POSTMAN_API_KEY)"
    elif not has_source:
        message = "Missing source workspace ID (POSTMAN_SOURCE_WORKSPACE_ID)"
    elif not has_target:
        message = "Target workspace ID not set — will create new workspace"
    else:
        message = "Fully configured"
    return ConfigurationStatus(
        has_api_key=has_api,
        has_target_workspace=has_target,
        has_source_workspace=has_source,
        is_configured=is_postman_configured(),
        is_fully_configured=is_postman_fully_configured(),
        message=message,
    )


async def validate_api_key() -> ValidateApiKeyResult:
    """Validate API key by making a test request."""
    try:
        response = await _request("GET", f"{POSTMAN_API_BASE}/me", use_auth_only=True)
        response.raise_for_status()
        data = response.json()
        return ValidateApiKeyResult(valid=True, user=data.get("user"))
    except Exception as e:
        return ValidateApiKeyResult(valid=False, error=_extract_error(e))


async def get_workspace_summary(workspace_id: str) -> dict[str, Any]:
    """Get a summary of workspace contents."""
    collections, environments, mocks, apis = await asyncio.gather(
        get_all_collections(workspace_id),
        get_all_environments(workspace_id),
        get_all_mocks(workspace_id),
        get_all_specs(workspace_id),
    )
    return {
        "workspace_id": workspace_id,
        "counts": {
            "collections": len(collections),
            "environments": len(environments),
            "mocks": len(mocks),
            "apis": len(apis),
        },
        "items": {
            "collections": [{"id": c.get("id"), "uid": c.get("uid"), "name": c.get("name")} for c in collections],
            "environments": [{"id": e.get("id"), "uid": e.get("uid"), "name": e.get("name")} for e in environments],
            "mocks": [{"id": m.get("id"), "uid": m.get("uid"), "name": m.get("name")} for m in mocks],
            "apis": [{"id": a.get("id"), "name": a.get("name")} for a in apis],
        },
    }


# ============================================================================
# CUSTOM PROVISIONING & RESET
# ============================================================================


async def get_available_collections(workspace_id: str) -> list[dict[str, Any]]:
    """Get available collections from a workspace for UI selection."""
    try:
        collections = await get_all_collections(workspace_id)
        return [
            {
                "id": c.get("id"),
                "uid": c.get("uid"),
                "name": c.get("name"),
                "selected": False,
                "metadata": {
                    "created_at": c.get("createdAt"),
                    "updated_at": c.get("updatedAt"),
                },
            }
            for c in collections
        ]
    except Exception as e:
        print(f"Error getting available collections: {e}")
        return []


async def get_available_resources(workspace_id: str) -> dict[str, list[dict[str, Any]]]:
    """Get available resources from a workspace for UI selection."""
    try:
        collections, environments, mocks, specs = await asyncio.gather(
            get_all_collections(workspace_id),
            get_all_environments(workspace_id),
            get_all_mocks(workspace_id),
            get_all_specs(workspace_id),
        )
        return {
            "collections": [
                {"id": c.get("id"), "uid": c.get("uid"), "name": c.get("name"), "selected": False}
                for c in collections
            ],
            "environments": [
                {"id": e.get("id"), "uid": e.get("uid"), "name": e.get("name"), "selected": False}
                for e in environments
            ],
            "mocks": [
                {
                    "id": m.get("id"),
                    "uid": m.get("uid"),
                    "name": m.get("name"),
                    "selected": False,
                    "collection_uid": m.get("collection"),
                }
                for m in mocks
            ],
            "specs": [
                {"id": s.get("id"), "name": s.get("name"), "type": s.get("type"), "selected": False}
                for s in specs
            ],
        }
    except Exception as e:
        print(f"Error getting available resources: {e}")
        return {"collections": [], "environments": [], "mocks": [], "specs": []}


async def provision_custom_workspace(
    options: dict[str, Any],
    on_progress: Optional[ProgressCallback] = None,
) -> dict[str, Any]:
    """Custom workspace provisioning with selective resource copying."""
    source_workspace_id = options.get("source_workspace_id")
    target_workspace_id = options.get("target_workspace_id")
    workspace_name = options.get("workspace_name", "Partner Workspace")
    workspace_type = options.get("workspace_type", "partner")
    copy_collections = options.get("copy_collections", True)
    copy_environments = options.get("copy_environments", True)
    copy_mocks = options.get("copy_mocks", True)
    copy_specs = options.get("copy_specs", True)
    selected_collection_uids = options.get("selected_collection_uids") or []
    selected_environment_uids = options.get("selected_environment_uids") or []
    selected_spec_ids = options.get("selected_spec_ids") or []
    create_mock_env = options.get("create_mock_env", True)
    add_admins = options.get("add_admins", True)
    invite_partners = options.get("invite_partners", True)
    admin_user_ids = options.get("admin_user_ids", [])
    partner_emails = options.get("partner_emails", [])
    partner_role_id = options.get("partner_role_id", "7")

    if not _get_api_key():
        raise ValueError("Postman API key not configured")
    if not source_workspace_id:
        raise ValueError("Source workspace ID is required")

    results: dict[str, Any] = {
        "workspace": None,
        "workspace_created": False,
        "collections": {"total": 0, "success": 0, "failed": [], "success_data": []},
        "mocks": {"total": 0, "success": 0, "failed": [], "urls": []},
        "environments": {"total": 0, "success": 0, "failed": [], "success_data": []},
        "mock_env": {"success": False, "action": None},
        "specs": {"total": 0, "success": 0, "failed": [], "success_data": []},
        "admins": {"total": 0, "success": 0, "failed": [], "success_data": []},
        "invitations": {"total": 0, "success": 0, "failed": [], "links": []},
        "errors": [],
    }

    try:
        if on_progress:
            on_progress({"phase": "validation", "message": "Validating configuration...", "progress": 5})
        validation = await validate_api_key()
        if not validation.valid:
            raise ValueError(f"Invalid API key: {validation.error}")
        source_workspace = await get_workspace(source_workspace_id)
        if not source_workspace:
            raise ValueError(f"Source workspace not found: {source_workspace_id}")

        if on_progress:
            on_progress({
                "phase": "workspace",
                "message": "Using existing workspace..." if target_workspace_id else "Creating new workspace...",
                "progress": 10,
            })
        workspace_id = target_workspace_id

        if target_workspace_id:
            existing = await get_workspace(target_workspace_id)
            if not existing:
                raise ValueError(f"Target workspace not found: {target_workspace_id}")
            results["workspace"] = existing
        else:
            if not workspace_name:
                raise ValueError("Workspace name is required when creating a new workspace")
            create_result = await create_workspace(workspace_name, workspace_type)
            if not create_result.success:
                raise ValueError(f"Failed to create workspace: {create_result.error}")
            workspace_id = create_result.workspace.id if create_result.workspace else None
            results["workspace"] = create_result.workspace
            results["workspace_created"] = True

        if not workspace_id:
            raise ValueError("Workspace ID is required")

        # Copy workspace description from source
        try:
            source_description = source_workspace.get("description") if source_workspace else None
            if source_description:
                final_description = source_description
                company_name = derive_company_name(workspace_name or (results.get("workspace") or {}).get("name"))
                if company_name:
                    final_description = source_description.replace("<Company>", company_name)
                    print(f'Replaced <Company> placeholder with "{company_name}"')
                else:
                    print("WARNING: Could not derive company name from target workspace name — copying description as-is")
                update_result = await update_workspace(workspace_id, {"description": final_description})
                if update_result.get("success"):
                    print("Workspace description updated successfully")
                else:
                    print("WARNING: Failed to update workspace description — continuing provisioning")
            else:
                print("WARNING: Source workspace has no description — skipping description copy")
        except Exception as desc_err:
            print(f"WARNING: Unexpected error copying workspace description: {desc_err} — continuing provisioning")

        if copy_collections:
            if on_progress:
                on_progress({"phase": "collections", "message": "Copying collections...", "progress": 20})
            source_collections = await get_all_collections(source_workspace_id)
            if selected_collection_uids:
                source_collections = [c for c in source_collections if c.get("uid") in selected_collection_uids]
            results["collections"]["total"] = len(source_collections)
            env_map: dict[str, dict[str, Any]] = {}

            for i, collection in enumerate(source_collections):
                if on_progress:
                    on_progress({
                        "phase": "collections",
                        "message": f"Forking: {collection.get('name')}",
                        "current": i + 1,
                        "total": len(source_collections),
                        "progress": 20 + int((i / len(source_collections)) * 15) if source_collections else 20,
                    })
                fork_result = await fork_collection(
                    collection["uid"], collection["name"], workspace_id
                )
                if fork_result.success and fork_result.uid:
                    results["collections"]["success"] += 1
                    results["collections"]["success_data"].append({
                        "name": fork_result.collection_name,
                        "uid": fork_result.uid,
                    })
                else:
                    results["collections"]["failed"].append({
                        "name": collection["name"],
                        "error": fork_result.error,
                    })
                    results["errors"].append(f"Failed to fork {collection['name']}: {fork_result.error}")
                await asyncio.sleep(0.3)

            for coll in results["collections"]["success_data"]:
                details = await get_collection_details(coll["uid"])
                if details:
                    coll["collection_details"] = details
                    coll["host_variables"] = extract_host_variables(details)
                await asyncio.sleep(0.2)

            if copy_mocks and results["collections"]["success_data"]:
                if on_progress:
                    on_progress({"phase": "mocks", "message": "Creating mock servers...", "progress": 40})
                results["mocks"]["total"] = len(results["collections"]["success_data"])
                for i, coll in enumerate(results["collections"]["success_data"]):
                    mock_name = f"{coll['name']} Mock"
                    if on_progress:
                        total = results["collections"]["success_data"]
                        on_progress({
                            "phase": "mocks",
                            "message": f"Creating: {mock_name}",
                            "current": i + 1,
                            "total": len(total),
                            "progress": 40 + int((i / len(total)) * 15) if total else 40,
                        })
                    mock_result = await create_mock_server(
                        mock_name, coll["uid"], workspace_id, None
                    )
                    if mock_result.success:
                        results["mocks"]["success"] += 1
                        results["mocks"]["urls"].append({
                            "collection_name": coll["name"],
                            "mock_name": mock_result.mock_name,
                            "mock_url": mock_result.mock_url,
                        })
                    else:
                        results["mocks"]["failed"].append({"name": mock_name, "error": mock_result.error})
                        results["errors"].append(f"Failed to create mock {mock_name}: {mock_result.error}")
                    await asyncio.sleep(0.3)

        if copy_environments:
            if on_progress:
                on_progress({"phase": "environments", "message": "Copying environments...", "progress": 60})
            source_envs = await get_all_environments(source_workspace_id)
            if selected_environment_uids:
                source_envs = [e for e in source_envs if e.get("uid") in selected_environment_uids]
            results["environments"]["total"] = len(source_envs)
            env_map: dict[str, dict[str, Any]] = {}

            for i, env in enumerate(source_envs):
                if on_progress:
                    on_progress({
                        "phase": "environments",
                        "message": f"Copying: {env.get('name')}",
                        "current": i + 1,
                        "total": len(source_envs),
                        "progress": 60 + int((i / len(source_envs)) * 10) if source_envs else 60,
                    })
                env_details = await get_environment_details(env["uid"])
                if not env_details:
                    results["environments"]["failed"].append({
                        "name": env["name"],
                        "error": "Could not get environment details",
                    })
                    continue
                cr = await create_environment_in_postman(
                    env_details["name"], env_details.get("values", []), workspace_id
                )
                if cr.success and cr.uid:
                    results["environments"]["success"] += 1
                    results["environments"]["success_data"].append({
                        "name": cr.environment_name,
                        "uid": cr.uid,
                    })
                    env_map[env["uid"]] = {"target_uid": cr.uid, "name": env_details["name"]}
                else:
                    results["environments"]["failed"].append({
                        "name": env_details["name"],
                        "error": cr.error,
                    })
                    results["errors"].append(f"Failed to copy {env_details['name']}: {cr.error}")
                await asyncio.sleep(0.3)

            mock_env_var_map: dict[str, str] = {}
            if create_mock_env and results["mocks"]["urls"]:
                if on_progress:
                    on_progress({"phase": "mockEnv", "message": "Creating Mock Environment...", "progress": 75})
                mock_variables: list[dict[str, Any]] = []
                for mock_entry in results["mocks"]["urls"]:
                    coll_name = mock_entry["collection_name"]
                    mock_url = mock_entry["mock_url"]
                    coll_data = next(
                        (c for c in results["collections"]["success_data"] if c["name"] == coll_name),
                        None,
                    )
                    host_vars = coll_data.get("host_variables", []) if coll_data else []
                    if host_vars:
                        camel_name = to_camel_case(coll_name)
                        for hv in host_vars:
                            pascal_var = to_pascal_case(hv["var_name"])
                            env_var_name = f"{camel_name}{pascal_var}"
                            mock_variables.append({
                                "key": env_var_name,
                                "value": mock_url,
                                "type": "default",
                                "enabled": True,
                                "description": f"Mock server URL for {coll_name} (variable: {hv['var_name']})",
                            })
                            if coll_data:
                                mock_env_var_map[f"{coll_data['uid']}:{hv['var_name']}"] = env_var_name
                    else:
                        camel_name = to_camel_case(coll_name)
                        env_var_name = f"{camel_name}BaseUrl"
                        mock_variables.append({
                            "key": env_var_name,
                            "value": mock_url,
                            "type": "default",
                            "enabled": True,
                            "description": f"Mock server URL for {coll_name}",
                        })
                        if coll_data:
                            mock_env_var_map[f"{coll_data['uid']}:__fallback__"] = env_var_name

                cr = await create_environment_in_postman("Mock Env", mock_variables, workspace_id)
                if cr.success:
                    results["mock_env"] = {"success": True, "action": "created"}
                else:
                    results["errors"].append(f"Failed to create Mock Env: {cr.error}")

            if mock_env_var_map:
                for coll in results["collections"]["success_data"]:
                    if not coll.get("collection_details"):
                        continue
                    host_vars = coll.get("host_variables", [])
                    existing_vars = coll["collection_details"].get("variable", [])
                    updated_vars: list[dict[str, Any]] = []
                    if host_vars:
                        matched_keys: set[str] = set()
                        for v in existing_vars:
                            hv = next((h for h in host_vars if h["var_name"] == v.get("key")), None)
                            if hv:
                                env_name = mock_env_var_map.get(f"{coll['uid']}:{hv['var_name']}")
                                if env_name:
                                    updated_vars.append({**v, "value": f"{{{{{env_name}}}}}"})
                                    matched_keys.add(hv["var_name"])
                                    continue
                            updated_vars.append(v)
                        for hv in host_vars:
                            env_name = mock_env_var_map.get(f"{coll['uid']}:{hv['var_name']}")
                            if env_name and hv["var_name"] not in matched_keys:
                                updated_vars.append({"key": hv["var_name"], "value": f"{{{{{env_name}}}}}", "type": "string"})
                        await patch_collection_variables(coll["uid"], updated_vars)
                    else:
                        env_name = mock_env_var_map.get(f"{coll['uid']}:__fallback__")
                        if not env_name:
                            continue
                        fallback_done = False
                        for v in existing_vars:
                            if not fallback_done and v.get("key") in COMMON_HOST_VAR_NAMES:
                                updated_vars.append({**v, "value": f"{{{{{env_name}}}}}"})
                                fallback_done = True
                            else:
                                updated_vars.append(v)
                        if not fallback_done:
                            updated_vars.append({"key": "baseUrl", "value": f"{{{{{env_name}}}}}", "type": "string"})
                        await patch_collection_variables(coll["uid"], updated_vars)

        if copy_specs:
            if on_progress:
                on_progress({"phase": "specs", "message": "Copying specs...", "progress": 80})
            src_specs = await get_all_specs(source_workspace_id)
            if selected_spec_ids:
                src_specs = [s for s in src_specs if s.get("id") in selected_spec_ids]
            results["specs"]["total"] = len(src_specs)
            for i, spec in enumerate(src_specs):
                if on_progress:
                    on_progress({
                        "phase": "specs",
                        "message": f"Copying: {spec.get('name')}",
                        "current": i + 1,
                        "total": len(src_specs),
                        "progress": 80 + int((i / len(src_specs)) * 15) if src_specs else 80,
                    })
                cr = await copy_spec(spec["id"], spec["name"], spec["type"], workspace_id)
                if cr.success:
                    results["specs"]["success"] += 1
                    results["specs"]["success_data"].append({
                        "name": cr.spec_name,
                        "id": cr.new_spec_id,
                        "files_copied": cr.files_copied,
                    })
                else:
                    results["specs"]["failed"].append({
                        "name": spec["name"],
                        "error": "; ".join(cr.errors),
                    })
                    results["errors"].append(f"Failed to copy spec {spec['name']}")
                await asyncio.sleep(0.5)

        if add_admins and admin_user_ids:
            if on_progress:
                on_progress({"phase": "admins", "message": "Adding workspace admins...", "progress": 88})
            results["admins"]["total"] = len(admin_user_ids)
            for i, user_id in enumerate(admin_user_ids):
                if on_progress:
                    on_progress({
                        "phase": "admins",
                        "message": f"Adding admin: {user_id}",
                        "current": i + 1,
                        "total": len(admin_user_ids),
                        "progress": 88 + int((i / len(admin_user_ids)) * 5),
                    })
                ar = await add_workspace_admin(workspace_id, user_id, "3")
                if ar.success:
                    results["admins"]["success"] += 1
                    results["admins"]["success_data"].append({"user_id": user_id, "role_id": "3"})
                else:
                    results["admins"]["failed"].append({"user_id": user_id, "error": ar.error})
                    results["errors"].append(f"Failed to add admin {user_id}: {ar.error}")
                await asyncio.sleep(0.3)

        if invite_partners and partner_emails:
            if on_progress:
                on_progress({"phase": "invitations", "message": "Inviting partners...", "progress": 93})
            results["invitations"]["total"] = len(partner_emails)
            for i, email in enumerate(partner_emails):
                if on_progress:
                    on_progress({
                        "phase": "invitations",
                        "message": f"Inviting partner: {email}",
                        "current": i + 1,
                        "total": len(partner_emails),
                        "progress": 93 + int((i / len(partner_emails)) * 6),
                    })
                ir = await invite_partner(workspace_id, email, partner_role_id)
                if ir.success:
                    results["invitations"]["success"] += 1
                    if ir.invitation_link:
                        results["invitations"]["links"].append({
                            "email": ir.email,
                            "invitation_link": ir.invitation_link,
                            "status": ir.status,
                        })
                else:
                    results["invitations"]["failed"].append({"email": email, "error": ir.error})
                    results["errors"].append(f"Failed to invite partner {email}: {ir.error}")
                await asyncio.sleep(0.3)

        if on_progress:
            on_progress({"phase": "complete", "message": "Custom provisioning complete!", "progress": 100, "results": results})
        return results
    except Exception as e:
        results["errors"].append(str(e))
        if on_progress:
            on_progress({"phase": "error", "message": f"Error: {e}", "progress": 0, "results": results})
        raise


async def reset_custom_workspace(
    workspace_id: str,
    on_progress: Optional[ProgressCallback] = None,
    options: Optional[ResetCustomOptions] = None,
) -> dict[str, Any]:
    """Custom workspace reset with selective resource deletion."""
    opts = options or {}
    include_specs = opts.get("include_specs", True)
    include_mocks = opts.get("include_mocks", True)
    include_environments = opts.get("include_environments", True)
    include_collections = opts.get("include_collections", True)
    selected_collection_uids = opts.get("selected_collection_uids") or []
    selected_environment_uids = opts.get("selected_environment_uids") or []
    selected_mock_ids = opts.get("selected_mock_ids") or []
    selected_spec_ids = opts.get("selected_spec_ids") or []

    result: dict[str, Any] = {
        "deleted_specs": 0,
        "deleted_mocks": 0,
        "deleted_environments": 0,
        "deleted_collections": 0,
        "total_specs": 0,
        "total_mocks": 0,
        "total_environments": 0,
        "total_collections": 0,
        "errors": [],
    }

    try:
        if include_specs:
            specs = await get_all_specs(workspace_id)
            if selected_spec_ids:
                specs = [s for s in specs if s.get("id") in selected_spec_ids]
            result["total_specs"] = len(specs)
            if on_progress:
                on_progress({
                    "phase": "specs",
                    "message": f"Deleting {len(specs)} spec(s)...",
                    "deleted": 0,
                    "total": len(specs),
                })
            for spec in specs:
                if await delete_spec(spec["id"]):
                    result["deleted_specs"] += 1
                else:
                    result["errors"].append(f"Failed to delete spec: {spec.get('name')}")
                if on_progress:
                    on_progress({
                        "phase": "specs",
                        "deleted": result["deleted_specs"],
                        "total": len(specs),
                        "currentItem": spec.get("name"),
                    })
                await asyncio.sleep(0.3)

        if include_mocks:
            mocks = await get_all_mocks(workspace_id)
            if selected_mock_ids:
                mocks = [m for m in mocks if m.get("id") in selected_mock_ids]
            result["total_mocks"] = len(mocks)
            if on_progress:
                on_progress({
                    "phase": "mocks",
                    "message": f"Deleting {len(mocks)} mock server(s)...",
                    "deleted": 0,
                    "total": len(mocks),
                })
            for mock in mocks:
                if await delete_mock(mock["id"]):
                    result["deleted_mocks"] += 1
                else:
                    result["errors"].append(f"Failed to delete mock: {mock.get('name')}")
                if on_progress:
                    on_progress({
                        "phase": "mocks",
                        "deleted": result["deleted_mocks"],
                        "total": len(mocks),
                        "currentItem": mock.get("name"),
                    })
                await asyncio.sleep(0.3)

        if include_environments:
            environments = await get_all_environments(workspace_id)
            if selected_environment_uids:
                environments = [e for e in environments if e.get("uid") in selected_environment_uids]
            result["total_environments"] = len(environments)
            if on_progress:
                on_progress({
                    "phase": "environments",
                    "message": f"Deleting {len(environments)} environment(s)...",
                    "deleted": 0,
                    "total": len(environments),
                })
            for env in environments:
                if await delete_environment(env["uid"]):
                    result["deleted_environments"] += 1
                else:
                    result["errors"].append(f"Failed to delete environment: {env.get('name')}")
                if on_progress:
                    on_progress({
                        "phase": "environments",
                        "deleted": result["deleted_environments"],
                        "total": len(environments),
                        "currentItem": env.get("name"),
                    })
                await asyncio.sleep(0.3)

        if include_collections:
            collections = await get_all_collections(workspace_id)
            if selected_collection_uids:
                collections = [c for c in collections if c.get("uid") in selected_collection_uids]
            result["total_collections"] = len(collections)
            if on_progress:
                on_progress({
                    "phase": "collections",
                    "message": f"Deleting {len(collections)} collection(s)...",
                    "deleted": 0,
                    "total": len(collections),
                })
            for coll in collections:
                if await delete_collection(coll["uid"]):
                    result["deleted_collections"] += 1
                else:
                    result["errors"].append(f"Failed to delete collection: {coll.get('name')}")
                if on_progress:
                    on_progress({
                        "phase": "collections",
                        "deleted": result["deleted_collections"],
                        "total": len(collections),
                        "currentItem": coll.get("name"),
                    })
                await asyncio.sleep(0.3)

        # Clear workspace description
        try:
            await update_workspace(workspace_id, {"description": ""})
        except Exception as desc_err:
            print(f"WARNING: Failed to clear workspace description: {desc_err}")

        if on_progress:
            on_progress({"phase": "complete", "message": "Custom reset complete", "result": result})
        return result
    except Exception as e:
        result["errors"].append(f"Unexpected error: {e}")
        if on_progress:
            on_progress({"phase": "error", "message": str(e), "result": result})
        raise


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================


def to_pascal_case(s: str) -> str:
    """Convert string to PascalCase, splitting on camelCase boundaries and non-alphanumeric chars."""
    s = re.sub(r'([a-z])([A-Z])', r'\1 \2', s)
    s = re.sub(r'[^a-zA-Z0-9]', ' ', s)
    words = s.split()
    return ''.join(word.capitalize() for word in words if word)


def to_camel_case(name: str) -> str:
    """Convert a name to camelCase."""
    clean = re.sub(r'[^a-zA-Z0-9\s]', '', name)
    words = clean.split()
    return ''.join(
        word.lower() if i == 0 else word.capitalize()
        for i, word in enumerate(words)
    )


def extract_url_path(url_string: str) -> str:
    """Extract the pathname from a URL string."""
    try:
        parsed = urlparse(url_string)
        return '' if parsed.path == '/' else parsed.path
    except Exception:
        return ''


def extract_host_variables(collection: dict) -> list[dict]:
    """Extract host variable names from collection request URLs with fallback detection."""
    host_var_names: set[str] = set()

    def traverse(items: list):
        for item in items:
            if 'item' in item and isinstance(item['item'], list):
                traverse(item['item'])
            request = item.get('request', {})
            if isinstance(request, dict):
                url = request.get('url', {})
                if isinstance(url, dict):
                    for h in url.get('host', []):
                        m = re.match(r'^\{\{(.+)\}\}$', str(h))
                        if m:
                            host_var_names.add(m.group(1))

    traverse(collection.get('item', []))

    collection_vars = collection.get('variable', [])

    if host_var_names:
        all_mapped = []
        for var_name in host_var_names:
            var_def = next((v for v in collection_vars if v.get('key') == var_name), None)
            original_url = var_def.get('value', '') if var_def else ''
            all_mapped.append({'var_name': var_name, 'original_url': original_url, 'path': extract_url_path(original_url)})
        with_protocol = [hv for hv in all_mapped if '://' in hv['original_url']]
        if with_protocol:
            return with_protocol
        return [{'var_name': hv['var_name'], 'original_url': hv['original_url'], 'path': ''} for hv in all_mapped]

    return [
        {'var_name': v.get('key', ''), 'original_url': v.get('value', ''), 'path': ''}
        for v in collection_vars
        if v.get('key') in COMMON_HOST_VAR_NAMES
    ]


def get_api_key() -> Optional[str]:
    """Get API key from environment."""
    key = _get_api_key()
    return key if key else None


def parse_comma_separated(value: str) -> list[str]:
    """Parse comma-separated string into array."""
    if not value:
        return []
    return [s.strip() for s in value.split(",") if s.strip()]


def format_collections_for_ui(collections: list[dict[str, Any]]) -> list[str]:
    """Format collections for UI display."""
    return [f"{c.get('name')} ({c.get('uid')})" for c in collections]


def format_environments_for_ui(environments: list[dict[str, Any]]) -> list[str]:
    """Format environments for UI display."""
    return [f"{e.get('name')} ({e.get('uid')})" for e in environments]


def format_mocks_for_ui(mocks: list[dict[str, Any]]) -> list[str]:
    """Format mocks for UI display."""
    return [f"{m.get('name')} ({m.get('uid')})" for m in mocks]


def format_specs_for_ui(specs: list[dict[str, Any]]) -> list[str]:
    """Format specs for UI display."""
    return [f"{s.get('name')} ({s.get('id')})" for s in specs]


def format_resources_for_ui(resources: dict[str, list[dict[str, Any]]]) -> dict[str, list[str]]:
    """Format all resources for UI display."""
    return {
        "collections": format_collections_for_ui(resources.get("collections", [])),
        "environments": format_environments_for_ui(resources.get("environments", [])),
        "mocks": format_mocks_for_ui(resources.get("mocks", [])),
        "specs": format_specs_for_ui(resources.get("specs", [])),
    }
