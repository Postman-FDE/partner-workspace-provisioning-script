"""
Provisioning Service

Full workspace provisioning workflow
"""

import asyncio
import re
from typing import Any, Callable
from urllib.parse import urlparse

from postman_sdk.client import PostmanClient
from postman_sdk.types import (
    Workspace,
    WorkspaceType,
    WorkspaceRoleId,
    CreateWorkspaceRequest,
    CollectionMapping,
    EnvironmentMapping,
    MockMapping,
    SpecMapping,
    EnvironmentVariable,
    ProgressEvent,
    CreateSpecFile,
    HostVariableInfo,
)

ProgressCallback = Callable[[ProgressEvent], None]

COMMON_HOST_VAR_NAMES = ['baseUrl', 'baseurl', 'base_url', 'HostName', 'hostname', 'host', 'apiUrl', 'apiurl', 'api_url', 'serverUrl', 'serverurl', 'server_url']


class ProvisioningService:
    """Provisioning Service for workspace setup"""

    def __init__(
        self,
        client: PostmanClient,
        source_workspace_id: str,
        target_workspace_id: str | None = None,
        target_workspace_name: str | None = None,
        workspace_type: WorkspaceType = "partner",
        admin_user_ids: list[str] | None = None,
        partner_emails: list[str] | None = None,
        partner_role_id: str = WorkspaceRoleId.PARTNER_EDITOR_AND_LEAD,
        on_progress: ProgressCallback | None = None,
    ):
        self.client = client
        self.source_workspace_id = source_workspace_id
        self.target_workspace_id = target_workspace_id
        self.target_workspace_name = target_workspace_name or "Partner Workspace"
        self.workspace_type = workspace_type
        self.admin_user_ids = admin_user_ids or []
        self.partner_emails = partner_emails or []
        self.partner_role_id = partner_role_id
        self.on_progress = on_progress

        # Internal state
        self._collection_mappings: dict[str, CollectionMapping] = {}
        self._mock_mappings: dict[str, MockMapping] = {}
        self._environment_mappings: dict[str, EnvironmentMapping] = {}
        self._spec_mappings: dict[str, SpecMapping] = {}

    async def provision(self) -> dict[str, Any]:
        """Run full provisioning workflow"""
        result = self._initialize_result()

        # Step 1: Initialize target workspace
        self._emit_progress("workspace", "Initializing target workspace...")
        workspace_result = await self._initialize_workspace()
        if not workspace_result.get("success"):
            raise Exception(f"Failed to initialize workspace: {workspace_result.get('error')}")
        
        result["workspace"] = workspace_result.get("workspace")
        result["workspace_created"] = workspace_result.get("is_new", False)
        target_workspace_id = result["workspace"].id

        # Copy workspace description from source
        await self._copy_workspace_description(target_workspace_id)

        # Step 2: Copy collections
        self._emit_progress("collections", "Copying collections...")
        await self._copy_collections(target_workspace_id, result)

        # Step 3: Create mocks
        self._emit_progress("mocks", "Creating mock servers...")
        await self._create_mocks(target_workspace_id, result)

        # Step 4: Copy environments
        self._emit_progress("environments", "Copying environments...")
        await self._copy_environments(target_workspace_id, result)

        # Step 5: Update mock env
        self._emit_progress("mockEnv", "Updating mock environment...")
        mock_env_var_map = await self._update_mock_environment(target_workspace_id)

        # Step 5b: Update collection variables to reference mock env vars
        if mock_env_var_map:
            self._emit_progress("collectionVars", "Updating collection variables...")
            await self._update_collection_variables(mock_env_var_map)

        # Step 6: Copy specs
        self._emit_progress("specs", "Copying specs...")
        await self._copy_specs(target_workspace_id, result)

        # Step 7: Add admins
        if self.admin_user_ids:
            self._emit_progress("admins", "Adding workspace admins...")
            await self._add_admins(target_workspace_id, result)

        # Step 8: Invite partners
        if self.partner_emails:
            self._emit_progress("partners", "Inviting partners...")
            await self._invite_partners(target_workspace_id, result)

        return result

    def _initialize_result(self) -> dict[str, Any]:
        return {
            "workspace": None,
            "workspace_created": False,
            "collections": {"total": 0, "success": 0, "failed": [], "mappings": []},
            "mocks": {"total": 0, "success": 0, "failed": [], "mappings": []},
            "environments": {"total": 0, "success": 0, "failed": [], "mappings": []},
            "specs": {"total": 0, "success": 0, "failed": [], "mappings": []},
            "admins": {"total": 0, "success": 0, "failed": []},
            "invitations": {"total": 0, "success": 0, "failed": [], "links": []},
        }

    def _emit_progress(self, step: str, message: str) -> None:
        if self.on_progress:
            self.on_progress(ProgressEvent(step=step, message=message))

    async def _initialize_workspace(self) -> dict[str, Any]:
        if self.target_workspace_id:
            workspace = await self.client.get_workspace(self.target_workspace_id)
            if workspace:
                return {"success": True, "workspace": workspace, "is_new": False}
            return {"success": False, "error": "Target workspace not found", "is_new": False}

        result = await self.client.create_workspace(
            CreateWorkspaceRequest(name=self.target_workspace_name, type=self.workspace_type)
        )
        return {"success": result.success, "workspace": result.workspace, "is_new": True, "error": result.error}

    @staticmethod
    def _derive_company_name(workspace_name: str | None) -> str | None:
        if not workspace_name:
            return None
        match = re.search(r'<>\s*(.+?)\s*Partner\s*Workspace', workspace_name, re.IGNORECASE)
        return match.group(1).strip() if match else None

    async def _copy_workspace_description(self, target_workspace_id: str) -> None:
        try:
            source_workspace = await self.client.get_workspace(self.source_workspace_id)
            source_description = getattr(source_workspace, 'description', None) if source_workspace else None
            if not source_description:
                print("WARNING: Source workspace has no description — skipping description copy")
                return
            final_description = source_description
            company_name = self._derive_company_name(self.target_workspace_name)
            if company_name:
                final_description = source_description.replace("<Company>", company_name)
                print(f'Replaced <Company> placeholder with "{company_name}"')
            else:
                print("WARNING: Could not derive company name from target workspace name — copying description as-is")
            update_result = await self.client.update_workspace(target_workspace_id, {"description": final_description})
            if update_result.get("success"):
                print("Workspace description updated successfully")
            else:
                print("WARNING: Failed to update workspace description — continuing provisioning")
        except Exception as err:
            print(f"WARNING: Unexpected error copying workspace description: {err} — continuing provisioning")

    async def _copy_collections(self, target_workspace_id: str, result: dict[str, Any]) -> None:
        source_collections = await self.client.get_collections(self.source_workspace_id)
        result["collections"]["total"] = len(source_collections)

        for collection in source_collections:
            fork_result = await self.client.fork_collection(
                collection.uid, collection.name, target_workspace_id
            )

            if fork_result.success and fork_result.collection:
                target_uid = fork_result.collection.uid
                details = await self.client.get_collection_details(target_uid)
                coll_dict = details.model_dump(by_alias=True) if details else {}
                host_variables = self._extract_host_variables(coll_dict) if coll_dict else []

                mapping = CollectionMapping(
                    source_uid=collection.uid,
                    target_uid=target_uid,
                    name=collection.name,
                    host_variables=host_variables,
                    collection_details=coll_dict if coll_dict else None,
                )
                self._collection_mappings[collection.uid] = mapping
                result["collections"]["mappings"].append(mapping.model_dump())
                result["collections"]["success"] += 1
            else:
                result["collections"]["failed"].append({
                    "name": collection.name,
                    "error": fork_result.error or "Unknown error",
                })

            await asyncio.sleep(0.5)

    async def _create_mocks(self, target_workspace_id: str, result: dict[str, Any]) -> None:
        result["mocks"]["total"] = len(self._collection_mappings)

        for source_uid, mapping in self._collection_mappings.items():
            mock_name = f"{mapping.name} Mock"
            from postman_sdk.types import CreateMockRequest
            
            create_result = await self.client.create_mock(
                CreateMockRequest(
                    name=mock_name,
                    collection=mapping.target_uid,
                    workspace_id=target_workspace_id,
                )
            )

            if create_result.success and create_result.mock:
                mock_mapping = MockMapping(
                    mock_id=create_result.mock.id,
                    mock_url=create_result.mock.mock_url,
                    name=mock_name,
                    collection_name=mapping.name,
                    collection_uid=mapping.target_uid,
                )
                self._mock_mappings[mapping.target_uid] = mock_mapping
                result["mocks"]["mappings"].append(mock_mapping.model_dump())
                result["mocks"]["success"] += 1
                mapping.mock_url = create_result.mock.mock_url
            else:
                result["mocks"]["failed"].append({
                    "name": mock_name,
                    "error": create_result.error or "Unknown error",
                })

            await asyncio.sleep(0.5)

    async def _copy_environments(self, target_workspace_id: str, result: dict[str, Any]) -> None:
        source_envs = await self.client.get_environments(self.source_workspace_id)
        result["environments"]["total"] = len(source_envs)

        for env in source_envs:
            details = await self.client.get_environment_details(env.uid)
            if not details:
                result["environments"]["failed"].append({
                    "name": env.name,
                    "error": "Could not get environment details",
                })
                continue

            create_result = await self.client.create_environment(
                details.name, details.values or [], target_workspace_id
            )

            if create_result.success and create_result.environment:
                mapping = EnvironmentMapping(
                    source_uid=env.uid,
                    target_uid=create_result.environment.uid,
                    name=details.name,
                )
                self._environment_mappings[env.uid] = mapping
                result["environments"]["mappings"].append(mapping.model_dump())
                result["environments"]["success"] += 1
            else:
                result["environments"]["failed"].append({
                    "name": details.name,
                    "error": create_result.error or "Unknown error",
                })

            await asyncio.sleep(0.3)

    async def _update_mock_environment(self, target_workspace_id: str) -> dict[str, str]:
        mock_url_variables, mock_env_var_map = self._generate_mock_url_variables()
        if not mock_url_variables:
            return mock_env_var_map

        await self.client.create_environment("Mock Env", mock_url_variables, target_workspace_id)

        return mock_env_var_map

    async def _update_collection_variables(self, mock_env_var_map: dict[str, str]) -> None:
        if not mock_env_var_map:
            return

        common_lower = {n.lower() for n in COMMON_HOST_VAR_NAMES}

        for coll_mapping in self._collection_mappings.values():
            host_vars = coll_mapping.host_variables or []
            coll_details = coll_mapping.collection_details
            if not coll_details:
                continue

            existing_vars = coll_details.get('variable', [])
            updated_vars = []

            if host_vars:
                matched_keys: set[str] = set()
                for v in existing_vars:
                    hv = next((h for h in host_vars if h.var_name == v.get('key')), None)
                    if hv:
                        env_name = mock_env_var_map.get(f"{coll_mapping.target_uid}:{hv.var_name}")
                        if env_name:
                            updated_vars.append({**v, 'value': f'{{{{{env_name}}}}}'})
                            matched_keys.add(hv.var_name)
                            continue
                    updated_vars.append(v)
                for hv in host_vars:
                    env_name = mock_env_var_map.get(f"{coll_mapping.target_uid}:{hv.var_name}")
                    if env_name and hv.var_name not in matched_keys:
                        updated_vars.append({'key': hv.var_name, 'value': f'{{{{{env_name}}}}}', 'type': 'string'})
            else:
                env_name = mock_env_var_map.get(f"{coll_mapping.target_uid}:__fallback__")
                if not env_name:
                    continue
                fallback_done = False
                for v in existing_vars:
                    key = v.get('key')
                    if key and key.lower() in common_lower:
                        updated_vars.append({**v, 'value': f'{{{{{env_name}}}}}'})
                        fallback_done = True
                    else:
                        updated_vars.append(v)
                if not fallback_done:
                    updated_vars.append({'key': 'baseUrl', 'value': f'{{{{{env_name}}}}}', 'type': 'string'})

            await self.client.patch_collection_variables(coll_mapping.target_uid, updated_vars)

    def _generate_mock_url_variables(self) -> tuple[list[EnvironmentVariable], dict[str, str]]:
        variables: list[EnvironmentVariable] = []
        mock_env_var_map: dict[str, str] = {}

        for source_uid, coll_mapping in self._collection_mappings.items():
            mock_mapping = self._mock_mappings.get(coll_mapping.target_uid)
            if not mock_mapping:
                continue

            host_vars = coll_mapping.host_variables or []
            if not host_vars:
                var_name = self._to_variable_name(coll_mapping.name) + 'BaseUrl'
                variables.append(EnvironmentVariable(key=var_name, value=mock_mapping.mock_url, enabled=True))
                mock_env_var_map[f"{coll_mapping.target_uid}:__fallback__"] = var_name
                continue

            for hv in host_vars:
                env_var_name = self._to_variable_name(coll_mapping.name) + self._to_pascal_case(hv.var_name)
                variables.append(EnvironmentVariable(key=env_var_name, value=mock_mapping.mock_url, enabled=True))
                mock_env_var_map[f"{coll_mapping.target_uid}:{hv.var_name}"] = env_var_name

        return variables, mock_env_var_map

    def _to_variable_name(self, name: str) -> str:
        clean = re.sub(r"[^a-zA-Z0-9\s]", "", name)
        words = clean.split()
        return "".join(
            w.lower() if i == 0 else w.capitalize()
            for i, w in enumerate(words)
        )

    def _to_pascal_case(self, s: str) -> str:
        s = re.sub(r'([a-z])([A-Z])', r'\1 \2', s)
        s = re.sub(r'[^a-zA-Z0-9]', ' ', s)
        return ''.join(word.capitalize() for word in s.split() if word)

    def _extract_url_path(self, url_string: str) -> str:
        try:
            parsed = urlparse(url_string)
            return '' if parsed.path == '/' else parsed.path
        except Exception:
            return ''

    def _extract_host_variables(self, collection: dict) -> list[HostVariableInfo]:
        host_var_names: set[str] = set()

        def traverse(items: list):
            for item in items:
                if 'item' in item and isinstance(item['item'], list):
                    traverse(item['item'])
                request = item.get('request', {})
                if isinstance(request, dict):
                    url = request.get('url', {})
                    if isinstance(url, dict):
                        for h in url.get('host', []):
                            m = re.match(r'^\{\{(.+)\}\}$', str(h))
                            if m:
                                host_var_names.add(m.group(1))

        traverse(collection.get('item', []))

        collection_vars = collection.get('variable', [])
        result: list[HostVariableInfo] = []

        if host_var_names:
            for var_name in host_var_names:
                var_def = next((v for v in collection_vars if v.get('key') == var_name), None)
                original_url = var_def.get('value', '') if var_def else ''
                if '://' in original_url:
                    path = self._extract_url_path(original_url)
                else:
                    path = ''
                result.append(HostVariableInfo(var_name=var_name, original_url=original_url, path=path))
            return result

        common_lower = {n.lower() for n in COMMON_HOST_VAR_NAMES}
        for v in collection_vars:
            key = v.get('key')
            if not key or key.lower() not in common_lower:
                continue
            original_url = v.get('value', '')
            if '://' in original_url:
                path = self._extract_url_path(original_url)
            else:
                path = ''
            result.append(HostVariableInfo(var_name=key, original_url=original_url, path=path))
        return result

    async def _copy_specs(self, target_workspace_id: str, result: dict[str, Any]) -> None:
        source_specs = await self.client.get_specs(self.source_workspace_id)

        # Auto-link: only copy specs whose name matches a copied collection
        normalize = lambda name: (name or "").lower().strip()
        copied_collection_names = {normalize(m.name) for m in self._collection_mappings.values()}
        matching_specs = [s for s in source_specs if normalize(s.name) in copied_collection_names]

        result["specs"]["total"] = len(matching_specs)

        for spec in matching_specs:
            copy_result = await self._copy_spec(spec.id, spec.name, spec.type, target_workspace_id)

            if copy_result.get("success"):
                mapping = SpecMapping(
                    source_id=spec.id,
                    target_id=copy_result["target_id"],
                    name=spec.name,
                    files_copied=copy_result["files_copied"],
                )
                self._spec_mappings[spec.id] = mapping
                result["specs"]["mappings"].append(mapping.model_dump())
                result["specs"]["success"] += 1
            else:
                result["specs"]["failed"].append({
                    "name": spec.name,
                    "error": copy_result.get("error", "Unknown error"),
                })

            await asyncio.sleep(0.5)

    async def _copy_spec(
        self, spec_id: str, name: str, spec_type: str, target_workspace_id: str
    ) -> dict[str, Any]:
        files = await self.client.get_spec_files(spec_id)
        if not files:
            return {"success": False, "error": "No files found in spec", "files_copied": 0}

        files_with_content = []
        for file in files:
            content = await self.client.get_spec_file(spec_id, file.path)
            if content and content.content:
                files_with_content.append(
                    CreateSpecFile(path=file.path, content=content.content, type=file.type)
                )
            await asyncio.sleep(0.2)

        if not files_with_content:
            return {"success": False, "error": "Could not retrieve file contents", "files_copied": 0}

        create_result = await self.client.create_spec(
            target_workspace_id, name, spec_type, files_with_content  # type: ignore
        )

        if create_result.success and create_result.spec:
            return {
                "success": True,
                "target_id": create_result.spec.id,
                "files_copied": len(files_with_content),
            }

        return {"success": False, "error": create_result.error, "files_copied": 0}

    async def _add_admins(self, target_workspace_id: str, result: dict[str, Any]) -> None:
        result["admins"]["total"] = len(self.admin_user_ids)

        for user_id in self.admin_user_ids:
            add_result = await self.client.add_workspace_admin(target_workspace_id, user_id)

            if add_result.success:
                result["admins"]["success"] += 1
            else:
                result["admins"]["failed"].append({
                    "user_id": user_id,
                    "error": add_result.error or "Unknown error",
                })

            await asyncio.sleep(0.3)

    async def _invite_partners(self, target_workspace_id: str, result: dict[str, Any]) -> None:
        result["invitations"]["total"] = len(self.partner_emails)

        for email in self.partner_emails:
            invite_result = await self.client.invite_partner(
                target_workspace_id, email, self.partner_role_id
            )

            if invite_result.success:
                result["invitations"]["success"] += 1
                if invite_result.invitation_link:
                    result["invitations"]["links"].append({
                        "email": email,
                        "invitation_link": invite_result.invitation_link,
                    })
            else:
                result["invitations"]["failed"].append({
                    "email": email,
                    "error": invite_result.error or "Unknown error",
                })

            await asyncio.sleep(0.3)
