"""
API Specification-related types
"""

from typing import Literal
from pydantic import BaseModel, Field


SpecType = Literal[
    "OPENAPI:3.0",
    "OPENAPI:3.1",
    "ASYNCAPI:2.0",
    "GRAPHQL",
    "RAML:1.0",
    "WSDL:1.1",
    "WSDL:2.0",
]

SpecFileType = Literal["ROOT", "DEFAULT"]


class Spec(BaseModel):
    """Spec entity (from list endpoint)"""
    id: str
    name: str
    type: SpecType
    created_at: str | None = Field(None, alias="createdAt")
    updated_at: str | None = Field(None, alias="updatedAt")

    class Config:
        populate_by_name = True


class SpecFile(BaseModel):
    """Spec file metadata"""
    id: str
    name: str
    path: str
    type: SpecFileType
    created_at: str | None = Field(None, alias="createdAt")
    updated_at: str | None = Field(None, alias="updatedAt")

    class Config:
        populate_by_name = True


class SpecFileWithContent(SpecFile):
    """Spec file with content"""
    content: str


class CreateSpecFile(BaseModel):
    """Create spec file (for creation)"""
    path: str
    content: str
    type: SpecFileType


class CreateSpecResult(BaseModel):
    """Create spec result"""
    success: bool
    spec: Spec | None = None
    error: str | None = None


class CopySpecResult(BaseModel):
    """Copy spec result"""
    success: bool
    spec_name: str
    new_spec_id: str | None = None
    files_copied: int = 0
    total_files: int = 0
    errors: list[str] = Field(default_factory=list)


class CopyAllSpecsSuccessItem(BaseModel):
    """Copy all specs success item"""
    name: str
    source_id: str
    target_id: str
    files_copied: int
    total_files: int


class CopyAllSpecsFailedItem(BaseModel):
    """Copy all specs failed item"""
    name: str
    error: str


class CopyAllSpecsResult(BaseModel):
    """Copy all specs result"""
    success: list[CopyAllSpecsSuccessItem] = Field(default_factory=list)
    failed: list[CopyAllSpecsFailedItem] = Field(default_factory=list)


class SpecMapping(BaseModel):
    """Spec mapping (source to target)"""
    source_id: str
    target_id: str
    name: str
    files_copied: int


class DeleteSpecResult(BaseModel):
    """Delete spec result"""
    success: bool
    error: str | None = None
