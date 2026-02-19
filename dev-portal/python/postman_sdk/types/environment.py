"""
Environment-related types
"""

from typing import Literal
from pydantic import BaseModel, Field


VariableType = Literal["default", "secret", "any"]


class Environment(BaseModel):
    """Environment summary (from list endpoint)"""
    id: str
    uid: str
    name: str
    owner: str | None = None
    created_at: str | None = Field(None, alias="createdAt")
    updated_at: str | None = Field(None, alias="updatedAt")
    is_public: bool | None = Field(None, alias="isPublic")

    class Config:
        populate_by_name = True


class EnvironmentVariable(BaseModel):
    """Environment variable"""
    key: str
    value: str
    type: VariableType = "default"
    enabled: bool = True


class EnvironmentDetails(Environment):
    """Environment details with variables"""
    values: list[EnvironmentVariable] = Field(default_factory=list)


class CreateEnvironmentResult(BaseModel):
    """Create environment result"""
    success: bool
    environment: Environment | None = None
    error: str | None = None


class UpdateEnvironmentResult(BaseModel):
    """Update environment result"""
    success: bool
    environment: Environment | None = None
    error: str | None = None


class EnvironmentMapping(BaseModel):
    """Environment mapping (source to target)"""
    source_uid: str
    target_uid: str
    name: str


class MockEnvUpdateResult(BaseModel):
    """Mock environment update result"""
    success: bool
    environment: Environment | None = None
    action: Literal["created", "updated"] | None = None
    error: str | None = None
