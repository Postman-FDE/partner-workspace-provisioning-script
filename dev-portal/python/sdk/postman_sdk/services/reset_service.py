"""
Reset Service

Full workspace reset workflow
"""

import asyncio
from typing import Any, Callable

from postman_sdk.client import PostmanClient
from postman_sdk.types import (
    Workspace,
    Collection,
    Environment,
    MockServer,
    Spec,
    ProgressEvent,
)

ProgressCallback = Callable[[ProgressEvent], None]


class ResetService:
    """Reset Service for workspace cleanup"""

    def __init__(
        self,
        client: PostmanClient,
        workspace_id: str,
        on_progress: ProgressCallback | None = None,
    ):
        self.client = client
        self.workspace_id = workspace_id
        self.on_progress = on_progress

    async def scan_workspace(self) -> dict[str, Any]:
        """Scan workspace to get all contents"""
        workspace, collections, environments, mocks, specs = await asyncio.gather(
            self.client.get_workspace(self.workspace_id),
            self.client.get_collections(self.workspace_id),
            self.client.get_environments(self.workspace_id),
            self.client.get_mocks(self.workspace_id),
            self.client.get_specs(self.workspace_id),
        )

        return {
            "workspace": workspace,
            "contents": {
                "collections": collections,
                "environments": environments,
                "mocks": mocks,
                "specs": specs,
            },
            "total": len(collections) + len(environments) + len(mocks) + len(specs),
        }

    async def reset(self) -> dict[str, Any]:
        """
        Run full reset workflow

        Deletion order (reverse of provisioning):
        1. Specs first
        2. Mocks (depend on collections)
        3. Environments
        4. Collections last
        """
        result = self._initialize_result()

        # Scan workspace
        self._emit_progress("scan", "Scanning workspace contents...")
        scan_result = await self.scan_workspace()
        result["workspace"] = scan_result["workspace"]
        contents = scan_result["contents"]

        if scan_result["total"] == 0:
            self._emit_progress("complete", "Workspace is already empty")
            return result

        result["specs"]["total"] = len(contents["specs"])
        result["mocks"]["total"] = len(contents["mocks"])
        result["environments"]["total"] = len(contents["environments"])
        result["collections"]["total"] = len(contents["collections"])

        # Step 1: Delete specs
        self._emit_progress("specs", f"Deleting {len(contents['specs'])} spec(s)...")
        await self._delete_specs(contents["specs"], result)

        # Step 2: Delete mocks
        self._emit_progress("mocks", f"Deleting {len(contents['mocks'])} mock server(s)...")
        await self._delete_mocks(contents["mocks"], result)

        # Step 3: Delete environments
        self._emit_progress("environments", f"Deleting {len(contents['environments'])} environment(s)...")
        await self._delete_environments(contents["environments"], result)

        # Step 4: Delete collections
        self._emit_progress("collections", f"Deleting {len(contents['collections'])} collection(s)...")
        await self._delete_collections(contents["collections"], result)

        self._emit_progress("complete", "Reset complete")
        return result

    def _initialize_result(self) -> dict[str, Any]:
        return {
            "workspace": None,
            "specs": {"total": 0, "deleted": 0, "failed": []},
            "mocks": {"total": 0, "deleted": 0, "failed": []},
            "environments": {"total": 0, "deleted": 0, "failed": []},
            "collections": {"total": 0, "deleted": 0, "failed": []},
        }

    def _emit_progress(self, step: str, message: str) -> None:
        if self.on_progress:
            self.on_progress(ProgressEvent(step=step, message=message))

    async def _delete_specs(self, specs: list[Spec], result: dict[str, Any]) -> None:
        for spec in specs:
            delete_result = await self.client.delete_spec(spec.id)

            if delete_result.success:
                result["specs"]["deleted"] += 1
            else:
                result["specs"]["failed"].append({
                    "name": spec.name,
                    "error": delete_result.error or "Unknown error",
                })

            await asyncio.sleep(0.3)

    async def _delete_mocks(self, mocks: list[MockServer], result: dict[str, Any]) -> None:
        for mock in mocks:
            # Use mock.id (not mock.uid) for deletion
            success = await self.client.delete_mock(mock.id)

            if success:
                result["mocks"]["deleted"] += 1
            else:
                result["mocks"]["failed"].append({
                    "name": mock.name,
                    "error": "Failed to delete",
                })

            await asyncio.sleep(0.3)

    async def _delete_environments(self, environments: list[Environment], result: dict[str, Any]) -> None:
        for env in environments:
            success = await self.client.delete_environment(env.uid)

            if success:
                result["environments"]["deleted"] += 1
            else:
                result["environments"]["failed"].append({
                    "name": env.name,
                    "error": "Failed to delete",
                })

            await asyncio.sleep(0.3)

    async def _delete_collections(self, collections: list[Collection], result: dict[str, Any]) -> None:
        for collection in collections:
            success = await self.client.delete_collection(collection.uid)

            if success:
                result["collections"]["deleted"] += 1
            else:
                result["collections"]["failed"].append({
                    "name": collection.name,
                    "error": "Failed to delete",
                })

            await asyncio.sleep(0.3)
