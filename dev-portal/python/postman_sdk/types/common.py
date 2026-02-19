"""
Common types used across the Postman SDK
"""

from typing import Any, Callable, Generic, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class ApiError(BaseModel):
    """API Error structure"""
    message: str
    name: str | None = None
    details: dict[str, Any] | None = None


class ApiResponse(BaseModel, Generic[T]):
    """Generic API response wrapper"""
    success: bool
    data: T | None = None
    error: ApiError | None = None


class ProgressEvent(BaseModel):
    """Progress event details"""
    step: str
    message: str
    current: int | None = None
    total: int | None = None
    progress: int | None = None
    phase: str | None = None
    current_item: str | None = Field(None, alias="currentItem")

    class Config:
        populate_by_name = True


# Type alias for progress callback
ProgressCallback = Callable[[ProgressEvent], None]


class PostmanClientConfig(BaseModel):
    """SDK Configuration options"""
    api_key: str
    base_url: str = "https://api.getpostman.com"
    timeout: int = 30
    retry_attempts: int = 3
    retry_delay: float = 1.0


class CurrentUser(BaseModel):
    """User info from /me endpoint"""
    id: str
    username: str
    email: str | None = None
    full_name: str | None = Field(None, alias="fullName")
    avatar: str | None = None

    class Config:
        populate_by_name = True


class BatchResult(BaseModel, Generic[T]):
    """Batch operation result"""
    success: list[T] = Field(default_factory=list)
    failed: list[dict[str, Any]] = Field(default_factory=list)
    total: int = 0
    success_count: int = 0
    failed_count: int = 0
