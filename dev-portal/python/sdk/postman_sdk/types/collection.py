"""
Collection-related types
"""

from typing import Any
from pydantic import BaseModel, Field


class CollectionFork(BaseModel):
    """Collection fork info"""
    label: str
    created_at: str = Field(alias="createdAt")
    source: str = Field(alias="from")

    class Config:
        populate_by_name = True


class Collection(BaseModel):
    """Collection summary (from list endpoint)"""
    id: str
    uid: str
    name: str
    owner: str | None = None
    created_at: str | None = Field(None, alias="createdAt")
    updated_at: str | None = Field(None, alias="updatedAt")
    fork: CollectionFork | None = None

    class Config:
        populate_by_name = True


class CollectionInfo(BaseModel):
    """Collection info block"""
    name: str
    description: str | None = None
    schema_url: str = Field(alias="schema")
    postman_id: str | None = Field(None, alias="_postman_id")

    class Config:
        populate_by_name = True


class CollectionDetails(Collection):
    """Full collection details"""
    info: CollectionInfo | None = None
    item: list[dict[str, Any]] = Field(default_factory=list)
    auth: dict[str, Any] | None = None
    variable: list[dict[str, Any]] = Field(default_factory=list)
    event: list[dict[str, Any]] = Field(default_factory=list)


class ForkResult(BaseModel):
    """Fork collection result"""
    success: bool
    collection: Collection | None = None
    error: str | None = None


class CollectionMapping(BaseModel):
    """Collection mapping (source to target)"""
    source_uid: str
    target_uid: str
    name: str
    mock_url: str | None = None
