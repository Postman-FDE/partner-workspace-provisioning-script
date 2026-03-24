"""
Postman API Client

Main SDK entry point with all API methods
"""

from typing import Any
from urllib.parse import quote

from postman_sdk.client.http_client import HttpClient, get_error_message
from postman_sdk.types import (
    PostmanClientConfig,
    CurrentUser,
    Workspace,
    WorkspaceRole,
    WorkspaceRoleId,
    CreateWorkspaceRequest,
    CreateWorkspaceResult,
    AddAdminResult,
    Collection,
    CollectionDetails,
    ForkResult,
    Environment,
    EnvironmentDetails,
    EnvironmentVariable,
    CreateEnvironmentResult,
    UpdateEnvironmentResult,
    MockServer,
    CreateMockRequest,
    CreateMockResult,
    Spec,
    SpecFile,
    SpecFileWithContent,
    SpecType,
    CreateSpecFile,
    CreateSpecResult,
    DeleteSpecResult,
    InvitePartnerResult,
    RemovePartnerResult,
)


class PostmanClient:
    """Postman API Client SDK"""

    def __init__(self, api_key: str, **kwargs: Any):
        config = PostmanClientConfig(api_key=api_key, **kwargs)
        self._http = HttpClient(config)

    async def __aenter__(self) -> "PostmanClient":
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.close()

    async def close(self) -> None:
        """Close the client"""
        await self._http.close()

    # =========================================================================
    # USER / AUTHENTICATION
    # =========================================================================

    async def validate_api_key(self) -> dict[str, Any]:
        """Validate API key and get current user info"""
        try:
            response = await self._http.get("/me")
            user_data = response.get("user", {})
            return {"valid": True, "user": CurrentUser(**user_data)}
        except Exception as e:
            return {"valid": False, "error": get_error_message(e)}

    async def get_current_user(self) -> CurrentUser:
        """Get current user info"""
        response = await self._http.get("/me")
        return CurrentUser(**response.get("user", {}))

    # =========================================================================
    # WORKSPACES
    # =========================================================================

    async def get_workspace(self, workspace_id: str) -> Workspace | None:
        """Get workspace details"""
        try:
            response = await self._http.get(f"/workspaces/{workspace_id}")
            return Workspace(**response.get("workspace", {}))
        except Exception:
            return None

    async def create_workspace(self, request: CreateWorkspaceRequest) -> CreateWorkspaceResult:
        """Create a new workspace"""
        try:
            response = await self._http.post(
                "/workspaces",
                {
                    "workspace": {
                        "name": request.name,
                        "type": request.type,
                        "description": request.description or f"Created via SDK",
                    }
                },
            )
            return CreateWorkspaceResult(
                success=True,
                workspace=Workspace(**response.get("workspace", {})),
            )
        except Exception as e:
            return CreateWorkspaceResult(success=False, error=get_error_message(e))

    async def update_workspace(
        self, workspace_id: str, updates: dict[str, Any]
    ) -> dict[str, Any]:
        """Update a workspace via PUT /workspaces/{workspaceId}"""
        try:
            response = await self._http.put(
                f"/workspaces/{workspace_id}", {"workspace": updates}
            )
            return {"success": True, "workspace": response.get("workspace")}
        except Exception as e:
            print(f"Error updating workspace: {e}")
            return {"success": False}

    async def delete_workspace(self, workspace_id: str) -> bool:
        """Delete a workspace"""
        try:
            await self._http.delete(f"/workspaces/{workspace_id}")
            return True
        except Exception:
            return False

    # =========================================================================
    # WORKSPACE ROLES
    # =========================================================================

    async def get_workspace_roles(self, workspace_id: str) -> dict[str, Any]:
        """Get workspace roles"""
        try:
            response = await self._http.get(f"/workspaces/{workspace_id}/roles")
            roles_data = response.get("roles", [])
            roles = [WorkspaceRole(**r) for r in roles_data]
            return {"success": True, "roles": roles}
        except Exception as e:
            return {"success": False, "roles": [], "error": get_error_message(e)}

    async def add_workspace_admin(
        self,
        workspace_id: str,
        user_id: str,
        role_id: str = WorkspaceRoleId.ADMIN,
    ) -> AddAdminResult:
        """Add workspace admin"""
        try:
            response = await self._http.patch(
                f"/workspaces/{workspace_id}/roles",
                {
                    "roles": [
                        {
                            "op": "add",
                            "path": "/user",
                            "value": [{"id": user_id, "role": role_id}],
                        }
                    ]
                },
            )
            roles_data = response.get("roles", [])
            return AddAdminResult(
                success=True,
                roles=[WorkspaceRole(**r) for r in roles_data],
            )
        except Exception as e:
            return AddAdminResult(success=False, error=get_error_message(e))

    # =========================================================================
    # COLLECTIONS
    # =========================================================================

    async def get_collections(self, workspace_id: str) -> list[Collection]:
        """Get all collections in a workspace"""
        try:
            response = await self._http.get(f"/collections?workspace={workspace_id}")
            return [Collection(**c) for c in response.get("collections", [])]
        except Exception:
            return []

    async def get_collection_details(self, collection_uid: str) -> CollectionDetails | None:
        """Get collection details"""
        try:
            response = await self._http.get(f"/collections/{collection_uid}")
            return CollectionDetails(**response.get("collection", {}))
        except Exception:
            return None

    async def fork_collection(
        self,
        collection_uid: str,
        label: str,
        target_workspace_id: str,
    ) -> ForkResult:
        """Fork a collection"""
        try:
            response = await self._http.post(
                f"/collections/fork/{collection_uid}?workspace={target_workspace_id}",
                {"label": label},
            )
            return ForkResult(
                success=True,
                collection=Collection(**response.get("collection", {})),
            )
        except Exception as e:
            return ForkResult(success=False, error=get_error_message(e))

    async def delete_collection(self, collection_uid: str) -> bool:
        """Delete a collection"""
        try:
            await self._http.delete(f"/collections/{collection_uid}")
            return True
        except Exception:
            return False

    async def patch_collection_variables(
        self, collection_uid: str, variables: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """Update a collection's variables via PATCH /collections/{uid}"""
        try:
            response = await self._http.patch(
                f"/collections/{collection_uid}",
                json={"collection": {"variable": variables}},
            )
            return {"success": True, "collection": response.get("collection")}
        except Exception as e:
            return {"success": False, "error": get_error_message(e)}

    # =========================================================================
    # ENVIRONMENTS
    # =========================================================================

    async def get_environments(self, workspace_id: str) -> list[Environment]:
        """Get all environments in a workspace"""
        try:
            response = await self._http.get(f"/environments?workspace={workspace_id}")
            return [Environment(**e) for e in response.get("environments", [])]
        except Exception:
            return []

    async def get_environment_details(self, environment_uid: str) -> EnvironmentDetails | None:
        """Get environment details with variables"""
        try:
            response = await self._http.get(f"/environments/{environment_uid}")
            return EnvironmentDetails(**response.get("environment", {}))
        except Exception:
            return None

    async def create_environment(
        self,
        name: str,
        values: list[EnvironmentVariable],
        workspace_id: str,
    ) -> CreateEnvironmentResult:
        """Create environment"""
        try:
            response = await self._http.post(
                f"/environments?workspace={workspace_id}",
                {
                    "environment": {
                        "name": name,
                        "values": [v.model_dump() for v in values],
                    }
                },
            )
            return CreateEnvironmentResult(
                success=True,
                environment=Environment(**response.get("environment", {})),
            )
        except Exception as e:
            return CreateEnvironmentResult(success=False, error=get_error_message(e))

    async def update_environment(
        self,
        environment_uid: str,
        name: str,
        values: list[EnvironmentVariable],
    ) -> UpdateEnvironmentResult:
        """Update environment (full replace)"""
        try:
            response = await self._http.put(
                f"/environments/{environment_uid}",
                {
                    "environment": {
                        "name": name,
                        "values": [v.model_dump() for v in values],
                    }
                },
            )
            return UpdateEnvironmentResult(
                success=True,
                environment=Environment(**response.get("environment", {})),
            )
        except Exception as e:
            return UpdateEnvironmentResult(success=False, error=get_error_message(e))

    async def delete_environment(self, environment_uid: str) -> bool:
        """Delete environment"""
        try:
            await self._http.delete(f"/environments/{environment_uid}")
            return True
        except Exception:
            return False

    # =========================================================================
    # MOCK SERVERS
    # =========================================================================

    async def get_mocks(self, workspace_id: str) -> list[MockServer]:
        """Get all mocks in a workspace"""
        try:
            response = await self._http.get(f"/mocks?workspace={workspace_id}")
            return [MockServer(**m) for m in response.get("mocks", [])]
        except Exception:
            return []

    async def create_mock(self, request: CreateMockRequest) -> CreateMockResult:
        """Create mock server"""
        try:
            mock_config: dict[str, Any] = {
                "name": request.name,
                "collection": request.collection,
                "private": request.is_private,
            }
            if request.environment:
                mock_config["environment"] = request.environment

            response = await self._http.post(
                f"/mocks?workspace={request.workspace_id}",
                {"mock": mock_config},
            )
            return CreateMockResult(
                success=True,
                mock=MockServer(**response.get("mock", {})),
            )
        except Exception as e:
            return CreateMockResult(success=False, error=get_error_message(e))

    async def delete_mock(self, mock_id: str) -> bool:
        """Delete mock server"""
        try:
            await self._http.delete(f"/mocks/{mock_id}")
            return True
        except Exception:
            return False

    # =========================================================================
    # SPECS
    # =========================================================================

    async def get_specs(self, workspace_id: str) -> list[Spec]:
        """Get all specs in a workspace"""
        try:
            response = await self._http.get(f"/specs?workspaceId={workspace_id}")
            return [Spec(**s) for s in response.get("specs", [])]
        except Exception:
            return []

    async def get_spec_files(self, spec_id: str) -> list[SpecFile]:
        """Get all files in a spec"""
        try:
            response = await self._http.get(f"/specs/{spec_id}/files")
            return [SpecFile(**f) for f in response.get("files", [])]
        except Exception:
            return []

    async def get_spec_file(self, spec_id: str, file_path: str) -> SpecFileWithContent | None:
        """Get a specific spec file with content"""
        try:
            encoded_path = quote(file_path, safe="")
            response = await self._http.get(f"/specs/{spec_id}/files/{encoded_path}")
            return SpecFileWithContent(**response)
        except Exception:
            return None

    async def create_spec(
        self,
        workspace_id: str,
        name: str,
        spec_type: SpecType,
        files: list[CreateSpecFile],
    ) -> CreateSpecResult:
        """Create a spec with files"""
        try:
            response = await self._http.post(
                f"/specs?workspaceId={workspace_id}",
                {
                    "name": name,
                    "type": spec_type,
                    "files": [f.model_dump() for f in files],
                },
            )
            return CreateSpecResult(success=True, spec=Spec(**response))
        except Exception as e:
            return CreateSpecResult(success=False, error=get_error_message(e))

    async def delete_spec(self, spec_id: str) -> DeleteSpecResult:
        """Delete a spec"""
        try:
            await self._http.delete(f"/specs/{spec_id}")
            return DeleteSpecResult(success=True)
        except Exception as e:
            return DeleteSpecResult(success=False, error=get_error_message(e))

    # =========================================================================
    # PARTNER INVITATIONS
    # =========================================================================

    async def invite_partner(
        self,
        workspace_id: str,
        email: str,
        role_id: str = WorkspaceRoleId.PARTNER_EDITOR_AND_LEAD,
    ) -> InvitePartnerResult:
        """Invite partner to workspace"""
        try:
            response = await self._http.post(
                "/invitations",
                {
                    "action": "invite_partner",
                    "targetEntity": "workspace",
                    "targetEntityId": workspace_id,
                    "roleId": role_id,
                    "target": {"emails": [email]},
                },
            )
            results = response.get("results", [])
            result = results[0] if results else {}
            return InvitePartnerResult(
                success=True,
                email=result.get("email", email),
                status=result.get("status"),
                invitation_link=result.get("invitationLink"),
                user_id=result.get("userId"),
                role_display_name=response.get("roleDisplayName"),
            )
        except Exception as e:
            return InvitePartnerResult(success=False, email=email, error=get_error_message(e))

    async def remove_partner(self, workspace_id: str, user_id: str) -> RemovePartnerResult:
        """Remove partner from workspace"""
        try:
            response = await self._http.post(
                "/invitations",
                {
                    "action": "remove_partner",
                    "targetEntity": "workspace",
                    "targetEntityId": workspace_id,
                    "target": {"userIds": [user_id]},
                },
            )
            results = response.get("results", [])
            result = results[0] if results else {}
            return RemovePartnerResult(
                success=True,
                user_id=result.get("userId", user_id),
                status=result.get("status"),
            )
        except Exception as e:
            return RemovePartnerResult(success=False, user_id=user_id, error=get_error_message(e))
