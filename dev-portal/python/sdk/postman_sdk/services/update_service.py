"""
Update Service

Detects net-new assets in a source workspace and adds them to the target
partner workspace with full mock URL wiring.
"""

import asyncio
import re
from typing import Any, Callable
from urllib.parse import urlparse

from postman_sdk.client import PostmanClient
from postman_sdk.types import (
    Collection,
    EnvironmentVariable,
    ProgressEvent,
    CreateMockRequest,
    CreateSpecFile,
    HostVariableInfo,
)

ProgressCallback = Callable[[ProgressEvent], None]

COMMON_HOST_VAR_NAMES = [
    'baseUrl', 'baseurl', 'base_url', 'HostName', 'hostname', 'host',
    'apiUrl', 'apiurl', 'api_url', 'serverUrl', 'serverurl', 'server_url',
]


class UpdateService:
    """
    Update detection and processing service.

    Scans source and target workspaces, detects net-new collections/specs/
    environments, and adds them to the target with full mock URL wiring.
    """

    def __init__(self, client: PostmanClient):
        self.client = client

    async def update(
        self,
        source_workspace_id: str,
        target_workspace_id: str,
        on_progress: ProgressCallback | None = None,
    ) -> dict[str, Any]:
        """Detect and add new assets from source to target workspace."""
        result = self._init_result()
        store: dict[str, Any] = {
            "collections": {},  # source_uid -> collection data dict
            "mocks": {},        # target_uid -> mock data dict
        }

        try:
            # Phase 1: Validate
            self._emit_progress(on_progress, "validation", "Validating API key...", 0)
            validation = await self.client.validate_api_key()
            if not validation.get("valid"):
                raise Exception(f"Invalid API key: {validation.get('error')}")

            # Phase 2: Detect new assets
            self._emit_progress(on_progress, "detection", "Scanning workspaces for new assets...", 10)
            new_collections, new_specs, new_environments = await self._detect_new_assets(
                source_workspace_id, target_workspace_id
            )

            # Check if workspace is up to date
            if not new_collections and not new_specs and not new_environments:
                self._emit_progress(
                    on_progress, "complete",
                    "Workspace is up to date — no new assets found.", 100,
                )
                return result

            self._emit_progress(
                on_progress, "detection",
                f"Found {len(new_collections)} new collection(s), "
                f"{len(new_specs)} new spec(s), "
                f"{len(new_environments)} new environment(s)",
                20,
            )

            # Phase 3: Fork new collections
            if new_collections:
                self._emit_progress(on_progress, "collections", "Forking new collections...", 25)
                await self._fork_new_collections(
                    new_collections, target_workspace_id, store, result, on_progress,
                )

            # Phase 4: Create mocks for new collections
            if store["collections"]:
                self._emit_progress(on_progress, "mocks", "Creating mock servers...", 45)
                await self._create_mocks(target_workspace_id, store, result, on_progress)

            # Phase 5: Update Mock Env with new variables
            if store["mocks"]:
                self._emit_progress(on_progress, "mockEnv", "Updating Mock Environment...", 60)
                mock_env_var_map = await self._update_mock_env(
                    target_workspace_id, store, result,
                )

                # Phase 5b: Update new collection variables
                await self._update_collection_variables(store, mock_env_var_map)

            # Phase 6: Copy new specs
            if new_specs:
                self._emit_progress(on_progress, "specs", "Copying new API specs...", 75)
                await self._copy_new_specs(new_specs, target_workspace_id, result, on_progress)

            # Phase 7: Copy new environments
            if new_environments:
                self._emit_progress(on_progress, "environments", "Copying new environments...", 88)
                await self._copy_new_environments(
                    new_environments, target_workspace_id, result, on_progress,
                )

            self._emit_progress(on_progress, "complete", "Update complete!", 100)

        except Exception as e:
            result["errors"].append(str(e))
            self._emit_progress(on_progress, "error", f"Error: {e}", -1)

        return result

    # ==================== Detection ====================

    async def _detect_new_assets(
        self, source_workspace_id: str, target_workspace_id: str
    ) -> tuple[list[Collection], list[Any], list[Any]]:
        """Detect new collections, specs, and environments in source that don't exist in target."""
        (
            source_collections, target_collections,
            source_specs, target_specs,
            source_envs, target_envs,
        ) = await asyncio.gather(
            self.client.get_collections(source_workspace_id),
            self.client.get_collections(target_workspace_id),
            self.client.get_specs(source_workspace_id),
            self.client.get_specs(target_workspace_id),
            self.client.get_environments(source_workspace_id),
            self.client.get_environments(target_workspace_id),
        )

        # Detect new collections (fork check + name fallback)
        new_collections = await self._find_new_collections(source_collections, target_collections)

        # Detect new specs (name match only)
        normalize = lambda name: (name or "").lower().strip()
        target_spec_names = {normalize(s.name) for s in target_specs}
        new_specs = [s for s in source_specs if normalize(s.name) not in target_spec_names]

        # Detect new environments (name match, exclude "Mock Env")
        target_env_names = {normalize(e.name) for e in target_envs}
        new_environments = [
            e for e in source_envs
            if e.name != "Mock Env" and normalize(e.name) not in target_env_names
        ]

        return new_collections, new_specs, new_environments

    async def _find_new_collections(
        self,
        source_collections: list[Collection],
        target_collections: list[Collection],
    ) -> list[Collection]:
        """
        Find source collections that don't exist in target.
        Uses fork relationship (primary) then name match (fallback).
        """
        target_fork_sources: dict[str, Collection] = {}
        target_names: set[str] = set()

        for tc in target_collections:
            target_names.add(tc.name)

            # Get details to check fork.from
            details = await self.client.get_collection_details(tc.uid)
            if details and details.fork:
                target_fork_sources[details.fork.source] = tc
            await asyncio.sleep(0.3)

        # A source collection is "new" if:
        # 1. No target collection was forked from it (fork check)
        # 2. AND no target collection has the same name (name fallback)
        return [
            sc for sc in source_collections
            if sc.uid not in target_fork_sources and sc.name not in target_names
        ]

    # ==================== Processing ====================

    async def _fork_new_collections(
        self,
        new_collections: list[Collection],
        target_workspace_id: str,
        store: dict[str, Any],
        result: dict[str, Any],
        on_progress: ProgressCallback | None,
    ) -> None:
        result["new_collections"]["total"] = len(new_collections)

        for i, collection in enumerate(new_collections):
            self._emit_progress(
                on_progress, "collections", f"Forking {collection.name}...", None,
                current=i + 1, total=len(new_collections), current_item=collection.name,
            )

            fork_result = await self.client.fork_collection(
                collection.uid, collection.name, target_workspace_id,
            )

            if fork_result.success and fork_result.collection:
                result["new_collections"]["success"] += 1
                result["new_collections"]["success_data"].append({
                    "name": collection.name,
                    "source_uid": collection.uid,
                    "target_uid": fork_result.collection.uid,
                })

                coll_details = await self.client.get_collection_details(fork_result.collection.uid)
                coll_dict = coll_details.model_dump(by_alias=True) if coll_details else {}
                host_variables = self._extract_host_variables(coll_dict) if coll_dict else []

                store["collections"][collection.uid] = {
                    "source_uid": collection.uid,
                    "target_uid": fork_result.collection.uid,
                    "name": collection.name,
                    "host_variables": host_variables,
                    "collection_details": coll_dict,
                }
            else:
                result["new_collections"]["failed"].append({
                    "name": collection.name,
                    "error": fork_result.error,
                })

            await asyncio.sleep(0.3)

    async def _create_mocks(
        self,
        target_workspace_id: str,
        store: dict[str, Any],
        result: dict[str, Any],
        on_progress: ProgressCallback | None,
    ) -> None:
        collections = list(store["collections"].values())

        for i, coll_data in enumerate(collections):
            target_uid = coll_data["target_uid"]
            name = coll_data["name"]
            mock_name = f"{name} Mock"

            self._emit_progress(
                on_progress, "mocks", f"Creating {mock_name}...", None,
                current=i + 1, total=len(collections), current_item=mock_name,
            )

            mock_result = await self.client.create_mock(
                CreateMockRequest(
                    name=mock_name,
                    collection=target_uid,
                    workspace_id=target_workspace_id,
                )
            )

            if mock_result.success and mock_result.mock:
                store["mocks"][target_uid] = {
                    "mock_id": mock_result.mock.id,
                    "mock_url": mock_result.mock.mock_url,
                    "name": mock_name,
                    "collection_name": name,
                }
            else:
                result["errors"].append(
                    f"Failed to create mock for {name}: {mock_result.error}"
                )

            await asyncio.sleep(0.3)

    async def _update_mock_env(
        self,
        target_workspace_id: str,
        store: dict[str, Any],
        result: dict[str, Any],
    ) -> dict[str, str]:
        """Update existing Mock Env in-place, or create one if it doesn't exist."""
        new_mock_vars, mock_env_var_map = self._generate_mock_url_variables(store)
        if not new_mock_vars:
            return mock_env_var_map

        # Find existing Mock Env
        envs = await self.client.get_environments(target_workspace_id)
        mock_env = next((e for e in envs if e.name == "Mock Env"), None)

        if mock_env:
            # Get current variables and append new ones
            details = await self.client.get_environment_details(mock_env.uid)
            existing_vars: list[EnvironmentVariable] = details.values if details else []

            # Deduplicate variable names
            existing_keys: set[str] = {v.key for v in existing_vars}
            deduplicated_new_vars: list[EnvironmentVariable] = []

            for v in new_mock_vars:
                if v.key in existing_keys:
                    suffix = 2
                    new_key = f"{v.key}{suffix}"
                    while new_key in existing_keys:
                        suffix += 1
                        new_key = f"{v.key}{suffix}"
                    # Update the mock_env_var_map to reflect the renamed key
                    for map_key, map_val in mock_env_var_map.items():
                        if map_val == v.key:
                            mock_env_var_map[map_key] = new_key
                    existing_keys.add(new_key)
                    deduplicated_new_vars.append(
                        EnvironmentVariable(key=new_key, value=v.value, type=v.type, enabled=v.enabled)
                    )
                else:
                    existing_keys.add(v.key)
                    deduplicated_new_vars.append(v)

            merged_vars = list(existing_vars) + deduplicated_new_vars
            await self.client.update_environment(mock_env.uid, "Mock Env", merged_vars)

            result["updated_mock_env"] = {
                "uid": mock_env.uid,
                "new_vars_added": len(deduplicated_new_vars),
            }
        else:
            # No Mock Env exists — create one from scratch
            create_result = await self.client.create_environment(
                "Mock Env", new_mock_vars, target_workspace_id,
            )
            if create_result.success and create_result.environment:
                result["updated_mock_env"] = {
                    "uid": create_result.environment.uid,
                    "new_vars_added": len(new_mock_vars),
                }

        return mock_env_var_map

    async def _update_collection_variables(
        self, store: dict[str, Any], mock_env_var_map: dict[str, str],
    ) -> None:
        if not mock_env_var_map:
            return

        common_lower = {n.lower() for n in COMMON_HOST_VAR_NAMES}

        for coll_data in store["collections"].values():
            coll_details = coll_data.get("collection_details")
            if not coll_details:
                continue

            host_vars: list[HostVariableInfo] = coll_data.get("host_variables", [])
            existing_vars: list[dict[str, Any]] = coll_details.get("variable", [])

            if host_vars:
                # Primary path: update known host variables
                matched_keys: set[str] = set()
                updated_vars: list[dict[str, Any]] = []

                for v in existing_vars:
                    hv = next((h for h in host_vars if h.var_name == v.get("key")), None)
                    if hv:
                        env_name = mock_env_var_map.get(f"{coll_data['target_uid']}:{hv.var_name}")
                        if env_name:
                            updated_vars.append({**v, "value": f"{{{{{env_name}}}}}"})
                            matched_keys.add(hv.var_name)
                            continue
                    updated_vars.append(v)

                # Add any host vars that weren't in existing vars
                for hv in host_vars:
                    env_name = mock_env_var_map.get(f"{coll_data['target_uid']}:{hv.var_name}")
                    if env_name and hv.var_name not in matched_keys:
                        updated_vars.append({
                            "key": hv.var_name,
                            "value": f"{{{{{env_name}}}}}",
                            "type": "string",
                        })

                await self.client.patch_collection_variables(coll_data["target_uid"], updated_vars)
                await asyncio.sleep(0.3)
                continue

            # Fallback for collections without detected host variables
            fallback_env_name = mock_env_var_map.get(f"{coll_data['target_uid']}:__fallback__")
            if not fallback_env_name:
                continue

            common_var = next(
                (v for v in existing_vars if v.get("key", "").lower() in common_lower),
                None,
            )

            if common_var:
                updated_vars = [
                    {**v, "value": f"{{{{{fallback_env_name}}}}}"} if v.get("key") == common_var.get("key") else v
                    for v in existing_vars
                ]
            else:
                updated_vars = [
                    *existing_vars,
                    {"key": "baseUrl", "value": f"{{{{{fallback_env_name}}}}}", "type": "string"},
                ]

            await self.client.patch_collection_variables(coll_data["target_uid"], updated_vars)
            await asyncio.sleep(0.3)

    async def _copy_new_specs(
        self,
        new_specs: list[Any],
        target_workspace_id: str,
        result: dict[str, Any],
        on_progress: ProgressCallback | None,
    ) -> None:
        result["new_specs"]["total"] = len(new_specs)

        for i, spec in enumerate(new_specs):
            self._emit_progress(
                on_progress, "specs", f"Copying {spec.name}...", None,
                current=i + 1, total=len(new_specs), current_item=spec.name,
            )

            try:
                files = await self.client.get_spec_files(spec.id)
                if not files:
                    result["new_specs"]["failed"].append({
                        "name": spec.name, "error": "No files found",
                    })
                    continue

                files_with_content: list[CreateSpecFile] = []
                for file in files:
                    file_data = await self.client.get_spec_file(spec.id, file.path)
                    if file_data and file_data.content:
                        files_with_content.append(
                            CreateSpecFile(path=file.path, content=file_data.content, type=file.type)
                        )
                    await asyncio.sleep(0.2)

                if not files_with_content:
                    result["new_specs"]["failed"].append({
                        "name": spec.name, "error": "Could not retrieve file contents",
                    })
                    continue

                create_result = await self.client.create_spec(
                    target_workspace_id, spec.name, spec.type, files_with_content,
                )

                if create_result.success and create_result.spec:
                    result["new_specs"]["success"] += 1
                    result["new_specs"]["success_data"].append({
                        "name": spec.name,
                        "source_id": spec.id,
                        "target_id": create_result.spec.id,
                        "files_copied": len(files_with_content),
                    })
                else:
                    result["new_specs"]["failed"].append({
                        "name": spec.name, "error": create_result.error,
                    })
            except Exception as e:
                result["new_specs"]["failed"].append({
                    "name": spec.name, "error": str(e),
                })

            await asyncio.sleep(0.5)

    async def _copy_new_environments(
        self,
        new_environments: list[Any],
        target_workspace_id: str,
        result: dict[str, Any],
        on_progress: ProgressCallback | None,
    ) -> None:
        result["new_environments"]["total"] = len(new_environments)

        for i, env in enumerate(new_environments):
            self._emit_progress(
                on_progress, "environments", f"Copying {env.name}...", None,
                current=i + 1, total=len(new_environments), current_item=env.name,
            )

            details = await self.client.get_environment_details(env.uid)
            if not details:
                result["new_environments"]["failed"].append({
                    "name": env.name, "error": "Could not fetch details",
                })
                continue

            create_result = await self.client.create_environment(
                details.name, details.values or [], target_workspace_id,
            )

            if create_result.success and create_result.environment:
                result["new_environments"]["success"] += 1
                result["new_environments"]["success_data"].append({
                    "name": details.name,
                    "source_uid": env.uid,
                    "target_uid": create_result.environment.uid,
                })
            else:
                result["new_environments"]["failed"].append({
                    "name": details.name, "error": create_result.error,
                })

            await asyncio.sleep(0.3)

    # ==================== Helpers ====================

    def _generate_mock_url_variables(
        self, store: dict[str, Any],
    ) -> tuple[list[EnvironmentVariable], dict[str, str]]:
        variables: list[EnvironmentVariable] = []
        mock_env_var_map: dict[str, str] = {}

        for coll_data in store["collections"].values():
            mock_data = store["mocks"].get(coll_data["target_uid"])
            if not mock_data:
                continue

            host_vars: list[HostVariableInfo] = coll_data.get("host_variables", [])
            if not host_vars:
                var_name = self._to_variable_name(coll_data["name"]) + "BaseUrl"
                variables.append(
                    EnvironmentVariable(key=var_name, value=mock_data["mock_url"], enabled=True)
                )
                mock_env_var_map[f"{coll_data['target_uid']}:__fallback__"] = var_name
                continue

            for hv in host_vars:
                env_var_name = self._to_variable_name(coll_data["name"]) + self._to_pascal_case(hv.var_name)
                variables.append(
                    EnvironmentVariable(key=env_var_name, value=mock_data["mock_url"], enabled=True)
                )
                mock_env_var_map[f"{coll_data['target_uid']}:{hv.var_name}"] = env_var_name

        return variables, mock_env_var_map

    def _extract_host_variables(self, collection: dict[str, Any]) -> list[HostVariableInfo]:
        host_var_names: set[str] = set()

        def traverse(items: list[Any]) -> None:
            for item in items:
                if "item" in item and isinstance(item["item"], list):
                    traverse(item["item"])
                request = item.get("request", {})
                if isinstance(request, dict):
                    url = request.get("url", {})
                    if isinstance(url, dict):
                        for h in url.get("host", []):
                            m = re.match(r"^\{\{(.+)\}\}$", str(h))
                            if m:
                                host_var_names.add(m.group(1))

        traverse(collection.get("item", []))

        collection_vars = collection.get("variable", [])
        result: list[HostVariableInfo] = []

        if host_var_names:
            for var_name in host_var_names:
                var_def = next((v for v in collection_vars if v.get("key") == var_name), None)
                original_url = var_def.get("value", "") if var_def else ""
                if "://" in original_url:
                    path = self._extract_url_path(original_url)
                else:
                    path = ""
                result.append(HostVariableInfo(var_name=var_name, original_url=original_url, path=path))
            return result

        common_lower = {n.lower() for n in COMMON_HOST_VAR_NAMES}
        for v in collection_vars:
            key = v.get("key")
            if not key or key.lower() not in common_lower:
                continue
            original_url = v.get("value", "")
            if "://" in original_url:
                path = self._extract_url_path(original_url)
            else:
                path = ""
            result.append(HostVariableInfo(var_name=key, original_url=original_url, path=path))
        return result

    @staticmethod
    def _to_variable_name(name: str) -> str:
        clean = re.sub(r"[^a-zA-Z0-9\s]", "", name)
        words = clean.split()
        return "".join(
            w.lower() if i == 0 else w.capitalize()
            for i, w in enumerate(words)
        )

    @staticmethod
    def _to_pascal_case(s: str) -> str:
        s = re.sub(r"([a-z])([A-Z])", r"\1 \2", s)
        s = re.sub(r"[^a-zA-Z0-9]", " ", s)
        return "".join(word.capitalize() for word in s.split() if word)

    @staticmethod
    def _extract_url_path(url_string: str) -> str:
        try:
            parsed = urlparse(url_string)
            return "" if parsed.path == "/" else parsed.path
        except Exception:
            return ""

    @staticmethod
    def _init_result() -> dict[str, Any]:
        return {
            "new_collections": {"total": 0, "success": 0, "failed": [], "success_data": []},
            "new_specs": {"total": 0, "success": 0, "failed": [], "success_data": []},
            "new_environments": {"total": 0, "success": 0, "failed": [], "success_data": []},
            "updated_mock_env": None,
            "errors": [],
        }

    @staticmethod
    def _emit_progress(
        on_progress: ProgressCallback | None,
        phase: str,
        message: str,
        progress: int | None,
        *,
        current: int | None = None,
        total: int | None = None,
        current_item: str | None = None,
    ) -> None:
        if on_progress:
            on_progress(ProgressEvent(
                step=phase,
                phase=phase,
                message=message,
                progress=progress,
                current=current,
                total=total,
                current_item=current_item,
            ))
