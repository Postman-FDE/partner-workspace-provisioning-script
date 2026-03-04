"""
Mock server-related types
"""

from pydantic import BaseModel, Field


class MockServer(BaseModel):
    """Mock server entity"""
    id: str
    uid: str
    name: str
    owner: str | None = None
    collection: str
    environment: str | None = None
    mock_url: str = Field(alias="mockUrl")
    is_public: bool = Field(alias="isPublic", default=False)
    created_at: str | None = Field(None, alias="createdAt")
    updated_at: str | None = Field(None, alias="updatedAt")

    class Config:
        populate_by_name = True


class CreateMockRequest(BaseModel):
    """Create mock server request"""
    name: str
    collection: str
    workspace_id: str
    environment: str | None = None
    is_private: bool = False


class CreateMockResult(BaseModel):
    """Create mock server result"""
    success: bool
    mock: MockServer | None = None
    error: str | None = None


class MockMapping(BaseModel):
    """Mock server mapping"""
    mock_id: str
    mock_url: str
    name: str
    collection_name: str
    collection_uid: str


class MockUrlVariable(BaseModel):
    """Mock URL variable for environment"""
    key: str
    value: str
    enabled: bool = True
    type: str = "default"
