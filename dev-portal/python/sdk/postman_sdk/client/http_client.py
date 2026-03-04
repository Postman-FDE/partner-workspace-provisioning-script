"""
HTTP Client wrapper with authentication and error handling
"""

import asyncio
from typing import Any, TypeVar
import httpx

from postman_sdk.types import PostmanClientConfig

T = TypeVar("T")


class PostmanApiError(Exception):
    """Custom error class for Postman API errors"""

    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        details: dict[str, Any] | None = None,
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details

    @classmethod
    def from_response(cls, response: httpx.Response) -> "PostmanApiError":
        """Create error from HTTP response"""
        try:
            data = response.json()
            error_data = data.get("error", {})
            message = (
                error_data.get("message")
                or data.get("message")
                or response.reason_phrase
                or "An unknown error occurred"
            )
            return cls(message, response.status_code, error_data if isinstance(error_data, dict) else None)
        except Exception:
            return cls(response.reason_phrase or "An unknown error occurred", response.status_code)


def get_error_message(error: Exception, default: str = "An unknown error occurred") -> str:
    """Extract error message from various error types"""
    if isinstance(error, PostmanApiError):
        return error.message
    if isinstance(error, httpx.HTTPStatusError):
        return str(error)
    return str(error) if str(error) else default


class HttpClient:
    """HTTP Client for Postman API"""

    def __init__(self, config: PostmanClientConfig):
        self.config = config
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create async client"""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.config.base_url,
                timeout=self.config.timeout,
                headers={
                    "Content-Type": "application/json",
                    "X-Api-Key": self.config.api_key,
                },
            )
        return self._client

    async def close(self) -> None:
        """Close the HTTP client"""
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def _execute_with_retry(
        self,
        operation: Any,
        attempts: int | None = None,
    ) -> Any:
        """Execute request with retry logic"""
        max_attempts = attempts or self.config.retry_attempts
        last_error: Exception | None = None

        for attempt in range(1, max_attempts + 1):
            try:
                return await operation()
            except PostmanApiError as e:
                last_error = e
                # Don't retry on 4xx errors
                if e.status_code and e.status_code < 500:
                    raise
                if attempt < max_attempts:
                    await asyncio.sleep(self.config.retry_delay * attempt)
            except Exception as e:
                last_error = e
                if attempt < max_attempts:
                    await asyncio.sleep(self.config.retry_delay * attempt)

        if last_error:
            raise last_error
        raise PostmanApiError("Unknown error after retries")

    async def _handle_response(self, response: httpx.Response) -> dict[str, Any]:
        """Handle HTTP response"""
        if response.status_code >= 400:
            raise PostmanApiError.from_response(response)
        
        if response.status_code == 204:
            return {}
        
        return response.json()

    async def get(self, url: str) -> dict[str, Any]:
        """GET request"""
        async def _do_get() -> dict[str, Any]:
            client = await self._get_client()
            response = await client.get(url)
            return await asyncio.get_event_loop().run_in_executor(
                None, lambda: self._handle_response_sync(response)
            )

        async def _operation() -> dict[str, Any]:
            client = await self._get_client()
            response = await client.get(url)
            return self._handle_response_sync(response)

        return await self._execute_with_retry(_operation)

    async def post(self, url: str, data: dict[str, Any] | None = None) -> dict[str, Any]:
        """POST request"""
        async def _operation() -> dict[str, Any]:
            client = await self._get_client()
            response = await client.post(url, json=data)
            return self._handle_response_sync(response)

        return await self._execute_with_retry(_operation)

    async def put(self, url: str, data: dict[str, Any] | None = None) -> dict[str, Any]:
        """PUT request"""
        async def _operation() -> dict[str, Any]:
            client = await self._get_client()
            response = await client.put(url, json=data)
            return self._handle_response_sync(response)

        return await self._execute_with_retry(_operation)

    async def patch(self, url: str, data: dict[str, Any] | None = None) -> dict[str, Any]:
        """PATCH request"""
        async def _operation() -> dict[str, Any]:
            client = await self._get_client()
            response = await client.patch(url, json=data)
            return self._handle_response_sync(response)

        return await self._execute_with_retry(_operation)

    async def delete(self, url: str) -> dict[str, Any]:
        """DELETE request"""
        async def _operation() -> dict[str, Any]:
            client = await self._get_client()
            response = await client.delete(url)
            return self._handle_response_sync(response)

        return await self._execute_with_retry(_operation)

    def _handle_response_sync(self, response: httpx.Response) -> dict[str, Any]:
        """Handle HTTP response synchronously"""
        if response.status_code >= 400:
            raise PostmanApiError.from_response(response)
        
        if response.status_code == 204:
            return {}
        
        try:
            return response.json()
        except Exception:
            return {}
