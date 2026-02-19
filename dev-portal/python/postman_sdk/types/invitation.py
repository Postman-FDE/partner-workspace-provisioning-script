"""
Partner invitation-related types
"""

from typing import Literal
from pydantic import BaseModel, Field


InvitationStatus = Literal[
    "EMAIL_SENT",
    "PARTNER_ADDED",
    "PENDING",
    "ACCEPTED",
    "EXPIRED",
    "FAILED",
]


class InvitePartnerRequest(BaseModel):
    """Partner invitation request"""
    workspace_id: str
    email: str
    role_id: str | None = None


class InvitePartnerResult(BaseModel):
    """Partner invitation result"""
    success: bool
    email: str
    status: InvitationStatus | None = None
    invitation_link: str | None = None
    user_id: str | None = None
    role_display_name: str | None = None
    error: str | None = None


class RemovePartnerRequest(BaseModel):
    """Remove partner request"""
    workspace_id: str
    user_id: str


class RemovePartnerResult(BaseModel):
    """Remove partner result"""
    success: bool
    user_id: str
    status: str | None = None
    error: str | None = None


class InvitationData(BaseModel):
    """Invitation data stored in memory"""
    status: InvitationStatus
    invitation_link: str | None = None
    user_id: str | None = None
    role_display_name: str | None = None


class InvitationLink(BaseModel):
    """Invitation link info"""
    email: str
    invitation_link: str
    status: InvitationStatus


class BatchInviteResultItem(BaseModel):
    """Batch invite failed item"""
    email: str
    error: str


class BatchInviteResult(BaseModel):
    """Batch invite partners result"""
    success: list[InvitePartnerResult] = Field(default_factory=list)
    failed: list[BatchInviteResultItem] = Field(default_factory=list)
