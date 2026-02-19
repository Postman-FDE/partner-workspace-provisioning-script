"""
Workspace Service

High-level workspace operations
"""

import asyncio
import re
from typing import Any

from postman_sdk.client import PostmanClient
from postman_sdk.types import (
    Workspace,
    WorkspaceType,
    WorkspaceRoleId,
    CreateWorkspaceResult,
)


class WorkspaceService:
    """High-level workspace operations"""

    def __init__(
        self,
        client: PostmanClient,
        default_workspace_type: WorkspaceType = "partner",
        admin_role_id: str = WorkspaceRoleId.ADMIN,
    ):
        self.client = client
        self.default_workspace_type = default_workspace_type
        self.admin_role_id = admin_role_id

    async def initialize_workspace(
        self,
        workspace_id_or_name: str,
        workspace_type: WorkspaceType | None = None,
        description: str | None = None,
    ) -> dict[str, Any]:
        """Initialize a target workspace (get existing or create new)"""
        # Check if it looks like a workspace ID (UUID format)
        is_id = bool(re.match(r"^[a-f0-9-]{36}$", workspace_id_or_name, re.IGNORECASE))

        if is_id:
            existing = await self.client.get_workspace(workspace_id_or_name)
            if existing:
                return {"success": True, "workspace": existing, "is_new": False}
            return {"success": False, "error": f"Workspace not found: {workspace_id_or_name}", "is_new": False}

        # Create new workspace
        from postman_sdk.types import CreateWorkspaceRequest
        
        result = await self.client.create_workspace(
            CreateWorkspaceRequest(
                name=workspace_id_or_name,
                type=workspace_type or self.default_workspace_type,
                description=description,
            )
        )

        return {
            "success": result.success,
            "workspace": result.workspace,
            "is_new": True,
            "error": result.error,
        }

    async def get_workspace_summary(self, workspace_id: str) -> dict[str, Any]:
        """Get workspace summary (counts of all resources)"""
        workspace, collections, environments, mocks, specs = await asyncio.gather(
            self.client.get_workspace(workspace_id),
            self.client.get_collections(workspace_id),
            self.client.get_environments(workspace_id),
            self.client.get_mocks(workspace_id),
            self.client.get_specs(workspace_id),
        )

        return {
            "workspace": workspace,
            "collections": len(collections),
            "environments": len(environments),
            "mocks": len(mocks),
            "specs": len(specs),
        }

    async def add_multiple_admins(
        self,
        workspace_id: str,
        user_ids: list[str],
        delay_ms: int = 300,
    ) -> dict[str, Any]:
        """Add multiple admins to a workspace"""
        result = {
            "success": [],
            "failed": [],
            "total": len(user_ids),
            "success_count": 0,
            "failed_count": 0,
        }

        for user_id in user_ids:
            add_result = await self.client.add_workspace_admin(
                workspace_id, user_id, self.admin_role_id
            )

            if add_result.success:
                result["success"].append({"user_id": user_id, "role_id": self.admin_role_id})
                result["success_count"] += 1
            else:
                result["failed"].append({"user_id": user_id, "error": add_result.error or "Unknown error"})
                result["failed_count"] += 1

            if delay_ms > 0:
                await asyncio.sleep(delay_ms / 1000)

        return result
