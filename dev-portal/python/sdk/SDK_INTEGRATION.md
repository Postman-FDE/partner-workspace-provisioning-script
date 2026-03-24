# Postman Python SDK — Integration Guide

This guide covers **5 methods** for integrating the locally built `postman-sdk` Python package into another project. Each method has different trade-offs around convenience, fidelity, and development workflow.

---

## Prerequisites

All methods assume:

- **Python >= 3.10** is installed
- **pip** (or an alternative like `uv`, `poetry`) is available
- You have cloned this repository locally
- You know the absolute or relative path from your consuming project to `dev-portal/python/sdk/`

The SDK has two runtime dependencies: **`httpx >=0.25.0`** and **`pydantic >=2.5.0`**. Methods 1–3 handle these automatically via pip; Methods 4–5 require you to install them manually.

---

## Quick Comparison

| Method | Best For | Build Required | Auto-installs deps | Reflects SDK Changes |
|--------|----------|:--------------:|:------------------:|:-------------------:|
| 1. Editable install (`pip install -e`) | Active development | No | Yes | Immediate |
| 2. Path dependency | Simple local reference | No | Yes | After reinstall |
| 3. Build wheel + install `.whl` | Pre-publish validation | Yes | Yes | After rebuild + reinstall |
| 4. Vendor from `site-packages` | Vendoring built package | Yes (install) | No (manual) | After recopy |
| 5. Copy source directory | Prototyping / modifying SDK | No | No (manual) | Immediate |

---

## Method 1: Editable Install (Active Development)

Installs the SDK in "editable" (development) mode so that changes to the source are reflected immediately without reinstalling. This is the Python equivalent of `npm link`.

### Step 1 — Create and activate a virtual environment (recommended)

```bash
cd /path/to/your-project
python -m venv .venv
source .venv/bin/activate   # macOS/Linux
# .venv\Scripts\activate    # Windows
```

### Step 2 — Install the SDK in editable mode

```bash
pip install -e /path/to/dev-portal/python
```

This installs `postman-sdk` into your virtual environment with a link back to the source directory. Dependencies (`httpx`, `pydantic`) are installed automatically.

### Step 3 — Import and use

```python
import asyncio
from postman_sdk import PostmanClient, ProvisioningService

async def main():
    async with PostmanClient(api_key="your-api-key") as client:
        result = await client.validate_api_key()
        print(f"Authenticated as: {result['user'].username}")

        workspace = await client.get_workspace("workspace-id")
        print(f"Workspace: {workspace.name}")

asyncio.run(main())
```

### Step 4 — Iterate

Any changes you make to the SDK source files in `dev-portal/python/sdk/postman_sdk/` are reflected immediately — no reinstall needed. This is the fastest feedback loop.

### Installing dev dependencies (optional)

To also install testing and linting tools:

```bash
pip install -e "/path/to/dev-portal/python[dev]"
```

This adds `pytest`, `pytest-asyncio`, `pytest-cov`, `ruff`, and `mypy`.

### Removing the install

```bash
pip uninstall postman-sdk
```

### Caveats

- Editable installs rely on the source directory remaining in place. Moving or deleting the SDK folder will break the install.
- If you're using a `requirements.txt` in your project and run `pip install -r requirements.txt`, the editable link is not affected (it's a separate entry in `site-packages`). But `pip freeze` will show a `file://` path, which is not portable across machines.

---

## Method 2: Path Dependency in `requirements.txt` or `pyproject.toml`

Points your consuming project's dependency list at the local SDK folder. pip resolves and installs it (along with its dependencies) from that path.

### Option A — Using `requirements.txt`

Add the local path to your consuming project's `requirements.txt`:

```text
# requirements.txt
/absolute/path/to/dev-portal/python
# or a relative path from the project root:
# ../fde-pw-creation-script-fde-org/dev-portal/python
```

Then install:

```bash
pip install -r requirements.txt
```

### Option B — Using `pyproject.toml` (PEP 508)

If your consuming project uses `pyproject.toml`, add the SDK as a path dependency:

```toml
[project]
dependencies = [
    "postman-sdk @ file:///absolute/path/to/dev-portal/python",
]
```

Then install:

```bash
pip install .
```

### Option C — Using Poetry

```toml
[tool.poetry.dependencies]
postman-sdk = { path = "../relative/path/to/dev-portal/python", develop = false }
```

Then:

```bash
poetry install
```

### Import and use

```python
from postman_sdk import PostmanClient, ResetService
```

### Updating after SDK changes

After making changes to the SDK source, reinstall in your consuming project:

```bash
pip install /path/to/dev-portal/python --force-reinstall --no-deps
```

The `--no-deps` flag avoids re-downloading `httpx` and `pydantic` if they're already installed.

### Caveats

- Absolute paths in `requirements.txt` are not portable across machines. Use editable installs (Method 1) or wheels (Method 3) for team workflows.
- `pip install` from a path creates a **copy** in `site-packages`, unlike an editable install. Changes to the source require a reinstall.

---

## Method 3: Build Wheel + Install `.whl` (Pre-Publish Validation)

Builds a distributable wheel (`.whl`) file — identical to what `twine upload` would produce — then installs it in your consuming project. This is the most faithful simulation of a real published package.

### Step 1 — Install the build tool

```bash
pip install build
```

### Step 2 — Build the wheel

```bash
cd dev-portal/python/sdk
python -m build
```

This produces two files in `dist/`:

```
dist/
├── postman_sdk-1.0.0-py3-none-any.whl    (wheel — use this)
└── postman_sdk-1.0.0.tar.gz              (sdist)
```

### Step 3 — Install the wheel in your consuming project

```bash
cd /path/to/your-project
pip install /path/to/dev-portal/python/sdk/dist/postman_sdk-1.0.0-py3-none-any.whl
```

This installs `postman-sdk` and its dependencies (`httpx`, `pydantic`) into your environment, exactly as if it came from PyPI.

### Step 4 — Import and use

```python
from postman_sdk import PostmanClient, ProvisioningService, WorkspaceService
```

### Updating after SDK changes

```bash
# Rebuild the wheel
cd dev-portal/python/sdk
python -m build

# Reinstall in consuming project
cd /path/to/your-project
pip install /path/to/dev-portal/python/sdk/dist/postman_sdk-1.0.0-py3-none-any.whl --force-reinstall
```

### Why use this method?

This catches packaging issues that other methods miss:

- Missing files (the `[tool.hatch.build.targets.wheel]` config controls what's included)
- Missing runtime dependencies in `[project.dependencies]`
- Incorrect package structure or missing `__init__.py` files
- Metadata errors in `pyproject.toml`

If the wheel installs and works, `twine upload` to PyPI will too.

### Caveats

- You must rebuild and reinstall after every SDK change — the slowest feedback loop of all methods.
- The wheel filename includes the version (`1.0.0`). If you bump the version, the filename changes.
- You need the `build` package installed (`pip install build`).

---

## Method 4: Vendor the Built Package (Copy from `site-packages`)

Copies the installed SDK package files directly into your project as a vendored dependency. No virtual environment tricks — just a local folder with Python modules.

### Step 1 — Install the SDK into a temporary environment

```bash
python -m venv /tmp/postman-sdk-vendor
source /tmp/postman-sdk-vendor/bin/activate
pip install /path/to/dev-portal/python
```

### Step 2 — Copy the package into your consuming project

```bash
mkdir -p /path/to/your-project/vendor

# Copy the SDK package
cp -r /tmp/postman-sdk-vendor/lib/python3.*/site-packages/postman_sdk /path/to/your-project/vendor/

deactivate
```

Your consuming project should now have:

```
your-project/
├── vendor/
│   └── postman_sdk/
│       ├── __init__.py
│       ├── client/
│       │   ├── __init__.py
│       │   ├── http_client.py
│       │   └── postman_client.py
│       ├── services/
│       │   ├── __init__.py
│       │   ├── provisioning_service.py
│       │   ├── reset_service.py
│       │   └── workspace_service.py
│       └── types/
│           ├── __init__.py
│           ├── common.py
│           ├── collection.py
│           ├── environment.py
│           ├── invitation.py
│           ├── mock.py
│           ├── spec.py
│           └── workspace.py
```

### Step 3 — Install the runtime dependencies

```bash
cd /path/to/your-project
pip install httpx>=0.25.0 pydantic>=2.5.0
```

### Step 4 — Add the vendor directory to your Python path

**Option A — `sys.path` at runtime:**

```python
import sys
sys.path.insert(0, './vendor')

from postman_sdk import PostmanClient
```

**Option B — Set `PYTHONPATH`:**

```bash
export PYTHONPATH=/path/to/your-project/vendor:$PYTHONPATH
python your_app.py
```

**Option C — Use a `.pth` file:**

Create `vendor.pth` in your virtual environment's `site-packages/` directory:

```
/path/to/your-project/vendor
```

### Updating after SDK changes

Repeat Steps 1–2: rebuild, reinstall to a temp venv, recopy.

### Caveats

- You are responsible for keeping the vendored copy in sync with the SDK source.
- The `sys.path` manipulation adds complexity. Method 5 (copying source directly) achieves a similar result with less ceremony.
- Consider adding `vendor/postman_sdk/` to `.gitignore` if you don't want to commit vendored files.

---

## Method 5: Copy the Source Directory (Direct Source Integration)

Copies the raw Python source files into your project. No build step, no packaging — just drop the `postman_sdk/` package into your project. Best for prototyping or when you want to modify the SDK code directly.

### Step 1 — Copy the SDK source

```bash
cp -r dev-portal/python/sdk/postman_sdk /path/to/your-project/
```

Or place it in a subdirectory:

```bash
mkdir -p /path/to/your-project/lib
cp -r dev-portal/python/sdk/postman_sdk /path/to/your-project/lib/
```

Your consuming project should now have:

```
your-project/
├── postman_sdk/          (or lib/postman_sdk/)
│   ├── __init__.py
│   ├── client/
│   │   ├── __init__.py
│   │   ├── http_client.py
│   │   └── postman_client.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── provisioning_service.py
│   │   ├── reset_service.py
│   │   └── workspace_service.py
│   └── types/
│       ├── __init__.py
│       ├── common.py
│       ├── collection.py
│       ├── environment.py
│       ├── invitation.py
│       ├── mock.py
│       ├── spec.py
│       └── workspace.py
├── your_app.py
└── ...
```

### Step 2 — Install the runtime dependencies

```bash
pip install httpx>=0.25.0 pydantic>=2.5.0
```

### Step 3 — Import and use

If you copied directly into the project root:

```python
from postman_sdk import PostmanClient, ProvisioningService, ResetService
from postman_sdk.types import Workspace, Collection, Environment
```

If you copied into a `lib/` subdirectory, add it to `sys.path` first:

```python
import sys
sys.path.insert(0, './lib')

from postman_sdk import PostmanClient
```

### Step 4 — Verify Python version compatibility

The SDK uses features that require Python >= 3.10:

- `match` statements (Python 3.10+)
- Union types with `X | Y` syntax (Python 3.10+)
- Pydantic v2 model definitions
- Type hints with `from __future__ import annotations` patterns

Ensure your consuming project runs on Python 3.10 or later.

### Updating after SDK changes

Simply recopy the source:

```bash
cp -r dev-portal/python/sdk/postman_sdk /path/to/your-project/
```

Or, if you've made local modifications, manually merge the changes.

### Caveats

- Any local modifications you make diverge from the upstream SDK. Track these carefully.
- If you place the package in a subdirectory (e.g., `lib/`), you need to manage `sys.path` or `PYTHONPATH`.
- Type checking tools (`mypy`, `pyright`) may need configuration to find the package if it's not in a standard location.
- This method does not register the package with pip, so `pip list` won't show it, and dependency metadata is not tracked.

---

## Usage Example (All Methods)

Regardless of which integration method you choose, the SDK API is the same:

```python
import asyncio
from postman_sdk import PostmanClient, ProvisioningService, ResetService

async def main():
    async with PostmanClient(api_key="your-api-key") as client:
        # Validate API key
        result = await client.validate_api_key()
        print(f"Authenticated as: {result['user'].username}")

        # List workspaces
        workspaces = await client.get_workspaces()

        # Get a specific workspace
        workspace = await client.get_workspace("workspace-id")
        print(f"Workspace: {workspace.name}")

        # Provision a new workspace from a template
        provisioner = ProvisioningService(client)
        provision_result = await provisioner.provision(
            source_workspace_id="template-workspace-id",
            workspace_name="My New Workspace",
        )
        print(f"Collection variables updated: {provision_result.collection_variables.success}")

        # Reset a workspace
        resetter = ResetService(client)
        reset_result = await resetter.reset("workspace-id")

asyncio.run(main())
```

### Framework examples

**FastAPI:**

```python
from fastapi import FastAPI, Depends
from postman_sdk import PostmanClient

app = FastAPI()

async def get_client():
    async with PostmanClient(api_key="your-api-key") as client:
        yield client

@app.get("/workspaces/{workspace_id}")
async def get_workspace(workspace_id: str, client: PostmanClient = Depends(get_client)):
    return await client.get_workspace(workspace_id)
```

**Flask:**

```python
import asyncio
from flask import Flask
from postman_sdk import PostmanClient

app = Flask(__name__)

@app.route("/workspaces/<workspace_id>")
def get_workspace(workspace_id):
    async def _fetch():
        async with PostmanClient(api_key="your-api-key") as client:
            return await client.get_workspace(workspace_id)
    return asyncio.run(_fetch())
```

---

## Troubleshooting

### "ModuleNotFoundError: No module named 'postman_sdk'"

- **Methods 1–3:** Ensure the package is installed in the active virtual environment. Run `pip list | grep postman` to check.
- **Method 4:** Verify the `vendor/` directory is on your `sys.path` or `PYTHONPATH`.
- **Method 5:** Ensure `postman_sdk/` is in the project root or on `sys.path`.

### "ModuleNotFoundError: No module named 'httpx'" or "No module named 'pydantic'"

The SDK depends on `httpx` and `pydantic` at runtime. Install them:

```bash
pip install httpx>=0.25.0 pydantic>=2.5.0
```

### "SyntaxError: invalid syntax" on `match` or `X | Y`

The SDK requires Python 3.10 or later. Check your version:

```bash
python --version
```

If you're on an older version, upgrade Python or use `pyenv` to manage multiple versions.

### Pydantic validation errors

The SDK uses Pydantic v2 models. If you have Pydantic v1 installed, you'll see incompatible validation errors. Upgrade:

```bash
pip install pydantic>=2.5.0
```

### Type checker can't find the SDK (Method 5 only)

If `mypy` or `pyright` can't resolve imports, add the SDK location to your type checker's configuration:

```toml
# pyproject.toml (mypy)
[tool.mypy]
mypy_path = "lib"

# pyrightconfig.json
{
  "extraPaths": ["lib"]
}
```
