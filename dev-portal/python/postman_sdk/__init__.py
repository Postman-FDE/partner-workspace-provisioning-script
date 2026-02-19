"""
Postman SDK for Python

A fully-typed Python SDK for the Postman API with workspace provisioning,
reset, and management capabilities.

Example:
    >>> from postman_sdk import PostmanClient, ProvisioningService
    >>>
    >>> async with PostmanClient(api_key="your-api-key") as client:
    ...     user = await client.validate_api_key()
    ...     workspace = await client.get_workspace("workspace-id")
"""

from postman_sdk.client.postman_client import PostmanClient
from postman_sdk.services.provisioning_service import ProvisioningService
from postman_sdk.services.reset_service import ResetService
from postman_sdk.services.workspace_service import WorkspaceService
from postman_sdk.types import (
    # Common
    ApiError,
    ApiResponse,
    ProgressEvent,
    PostmanClientConfig,
    CurrentUser,
    # Workspace
    Workspace,
    WorkspaceType,
    WorkspaceRole,
    WorkspaceRoleId,
    CreateWorkspaceRequest,
    CreateWorkspaceResult,
    # Collection
    Collection,
    ForkResult,
    CollectionMapping,
    # Environment
    Environment,
    EnvironmentDetails,
    EnvironmentVariable,
    EnvironmentMapping,
    # Mock
    MockServer,
    CreateMockRequest,
    CreateMockResult,
    MockMapping,
    # Spec
    Spec,
    SpecFile,
    SpecType,
    CreateSpecFile,
    CreateSpecResult,
    CopySpecResult,
    SpecMapping,
    # Invitation
    InvitePartnerResult,
    RemovePartnerResult,
)

__version__ = "1.0.0"
__all__ = [
    # Client
    "PostmanClient",
    # Services
    "ProvisioningService",
    "ResetService",
    "WorkspaceService",
    # Common types
    "ApiError",
    "ApiResponse",
    "ProgressEvent",
    "PostmanClientConfig",
    "CurrentUser",
    # Workspace types
    "Workspace",
    "WorkspaceType",
    "WorkspaceRole",
    "WorkspaceRoleId",
    "CreateWorkspaceRequest",
    "CreateWorkspaceResult",
    # Collection types
    "Collection",
    "ForkResult",
    "CollectionMapping",
    # Environment types
    "Environment",
    "EnvironmentDetails",
    "EnvironmentVariable",
    "EnvironmentMapping",
    # Mock types
    "MockServer",
    "CreateMockRequest",
    "CreateMockResult",
    "MockMapping",
    # Spec types
    "Spec",
    "SpecFile",
    "SpecType",
    "CreateSpecFile",
    "CreateSpecResult",
    "CopySpecResult",
    "SpecMapping",
    # Invitation types
    "InvitePartnerResult",
    "RemovePartnerResult",
]
