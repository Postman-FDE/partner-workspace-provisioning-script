"""
Workspace-related types
"""

from enum import Enum
from typing import Literal
from pydantic import BaseModel, Field


WorkspaceType = Literal["personal", "private", "team", "partner", "public"]


class WorkspaceRoleId(str, Enum):
    """Workspace role IDs"""
    VIEWER = "1"
    EDITOR = "2"
    ADMIN = "3"
    PARTNER_VIEWER = "6"
    PARTNER_EDITOR_AND_LEAD = "7"


class Workspace(BaseModel):
    """Workspace entity"""
    id: str
    name: str
    type: WorkspaceType
    description: str | None = None
    visibility: str | None = None
    created_by: str | None = Field(None, alias="createdBy")
    created_at: str | None = Field(None, alias="createdAt")
    updated_at: str | None = Field(None, alias="updatedAt")

    class Config:
        populate_by_name = True


class WorkspaceUser(BaseModel):
    """User in workspace role"""
    id: str
    email: str | None = None
    name: str | None = None


class WorkspaceRole(BaseModel):
    """Workspace role assignment"""
    user: WorkspaceUser
    role: str


class CreateWorkspaceRequest(BaseModel):
    """Create workspace request"""
    name: str
    type: WorkspaceType
    description: str | None = None


class CreateWorkspaceResult(BaseModel):
    """Create workspace result"""
    success: bool
    workspace: Workspace | None = None
    error: str | None = None


class AddAdminResult(BaseModel):
    """Add admin result"""
    success: bool
    roles: list[WorkspaceRole] | None = None
    error: str | None = None


class WorkspaceSummary(BaseModel):
    """Workspace summary for provisioning results"""
    collections: int = 0
    environments: int = 0
    mocks: int = 0
    specs: int = 0
    admins: int = 0
    invitations: int = 0
