# Postman SDK for TypeScript

A fully-typed TypeScript SDK for the Postman API with workspace provisioning, reset, and management capabilities.

## Installation

```bash
npm install @postman/sdk
# or
yarn add @postman/sdk
# or
pnpm add @postman/sdk
```

## Quick Start

```typescript
import { PostmanClient, ProvisioningService } from '@postman/sdk';

const client = new PostmanClient({
  apiKey: process.env.POSTMAN_API_KEY!,
});

// Validate API key
const { valid, user } = await client.validateApiKey();
console.log(`Authenticated as: ${user?.username}`);

// Get workspaces
const workspace = await client.getWorkspace('workspace-id');
```

## Features

- Full TypeScript type safety
- All Postman API endpoints
- High-level services for provisioning and reset workflows
- Automatic retry with exponential backoff
- Progress callbacks for long-running operations

---

## Frontend Integration Patterns

### React Integration

**Direct Hook Pattern**

```tsx
// hooks/usePostmanWorkspace.ts
import { useState, useEffect } from 'react';
import { PostmanClient, Workspace } from '@postman/sdk';

const client = new PostmanClient({ apiKey: process.env.NEXT_PUBLIC_POSTMAN_API_KEY! });

export function usePostmanWorkspace(workspaceId: string) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchWorkspace() {
      try {
        setLoading(true);
        const data = await client.getWorkspace(workspaceId);
        setWorkspace(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }
    fetchWorkspace();
  }, [workspaceId]);

  return { workspace, loading, error };
}

// Usage in component
function WorkspaceCard({ workspaceId }: { workspaceId: string }) {
  const { workspace, loading, error } = usePostmanWorkspace(workspaceId);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div className="workspace-card">
      <h2>{workspace?.name}</h2>
      <p>Type: {workspace?.type}</p>
    </div>
  );
}
```

**With React Query**

```tsx
// queries/workspace.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PostmanClient, CreateWorkspaceRequest } from '@postman/sdk';

const client = new PostmanClient({ apiKey: process.env.NEXT_PUBLIC_POSTMAN_API_KEY! });

export function useWorkspace(workspaceId: string) {
  return useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => client.getWorkspace(workspaceId),
  });
}

export function useCollections(workspaceId: string) {
  return useQuery({
    queryKey: ['collections', workspaceId],
    queryFn: () => client.getCollections(workspaceId),
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (request: CreateWorkspaceRequest) => client.createWorkspace(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}
```

---

### Next.js Integration

**Server Components (App Router)**

```tsx
// app/workspace/[id]/page.tsx
import { PostmanClient } from '@postman/sdk';

const client = new PostmanClient({ apiKey: process.env.POSTMAN_API_KEY! });

export default async function WorkspacePage({ params }: { params: { id: string } }) {
  const workspace = await client.getWorkspace(params.id);
  const collections = await client.getCollections(params.id);

  return (
    <div>
      <h1>{workspace?.name}</h1>
      <h2>Collections ({collections.length})</h2>
      <ul>
        {collections.map((c) => (
          <li key={c.uid}>{c.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

**API Route Pattern**

```typescript
// app/api/workspaces/route.ts
import { NextResponse } from 'next/server';
import { PostmanClient } from '@postman/sdk';

const client = new PostmanClient({ apiKey: process.env.POSTMAN_API_KEY! });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('id');

  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
  }

  const workspace = await client.getWorkspace(workspaceId);
  return NextResponse.json(workspace);
}

export async function POST(request: Request) {
  const body = await request.json();
  const result = await client.createWorkspace(body);
  return NextResponse.json(result);
}
```

**Server Actions**

```typescript
// app/actions/workspace.ts
'use server';

import { PostmanClient, ProvisioningService } from '@postman/sdk';
import { revalidatePath } from 'next/cache';

const client = new PostmanClient({ apiKey: process.env.POSTMAN_API_KEY! });

export async function provisionWorkspace(formData: FormData) {
  const name = formData.get('name') as string;
  const sourceWorkspaceId = formData.get('sourceWorkspaceId') as string;

  const provisioner = new ProvisioningService({
    client,
    sourceWorkspaceId,
    targetWorkspaceName: name,
  });

  const result = await provisioner.provision();
  revalidatePath('/workspaces');
  return result;
}
```

---

### Vue 3 Integration

**Composables Pattern**

```typescript
// composables/usePostman.ts
import { ref, onMounted } from 'vue';
import { PostmanClient, Workspace, Collection } from '@postman/sdk';

const client = new PostmanClient({ apiKey: import.meta.env.VITE_POSTMAN_API_KEY });

export function useWorkspace(workspaceId: string) {
  const workspace = ref<Workspace | null>(null);
  const loading = ref(true);
  const error = ref<Error | null>(null);

  onMounted(async () => {
    try {
      workspace.value = await client.getWorkspace(workspaceId);
    } catch (err) {
      error.value = err as Error;
    } finally {
      loading.value = false;
    }
  });

  return { workspace, loading, error };
}

export function useCollections(workspaceId: string) {
  const collections = ref<Collection[]>([]);
  const loading = ref(true);

  onMounted(async () => {
    try {
      collections.value = await client.getCollections(workspaceId);
    } finally {
      loading.value = false;
    }
  });

  return { collections, loading };
}
```

**Component Usage**

```vue
<script setup lang="ts">
import { useWorkspace, useCollections } from '@/composables/usePostman';

const props = defineProps<{ workspaceId: string }>();

const { workspace, loading: workspaceLoading } = useWorkspace(props.workspaceId);
const { collections, loading: collectionsLoading } = useCollections(props.workspaceId);
</script>

<template>
  <div v-if="workspaceLoading">Loading...</div>
  <div v-else>
    <h1>{{ workspace?.name }}</h1>
    <ul>
      <li v-for="collection in collections" :key="collection.uid">
        {{ collection.name }}
      </li>
    </ul>
  </div>
</template>
```

---

### Angular Integration

**Injectable Service**

```typescript
// services/postman.service.ts
import { Injectable } from '@angular/core';
import { PostmanClient, Workspace, Collection } from '@postman/sdk';
import { from, Observable } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class PostmanService {
  private client: PostmanClient;

  constructor() {
    this.client = new PostmanClient({ apiKey: environment.postmanApiKey });
  }

  getWorkspace(workspaceId: string): Observable<Workspace | null> {
    return from(this.client.getWorkspace(workspaceId));
  }

  getCollections(workspaceId: string): Observable<Collection[]> {
    return from(this.client.getCollections(workspaceId));
  }

  createWorkspace(name: string, type: 'partner' | 'team' | 'private') {
    return from(this.client.createWorkspace({ name, type }));
  }
}

// Component usage
@Component({
  selector: 'app-workspace',
  template: `
    <div *ngIf="workspace$ | async as workspace">
      <h1>{{ workspace.name }}</h1>
    </div>
  `,
})
export class WorkspaceComponent implements OnInit {
  workspace$!: Observable<Workspace | null>;

  constructor(
    private postmanService: PostmanService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    const workspaceId = this.route.snapshot.paramMap.get('id')!;
    this.workspace$ = this.postmanService.getWorkspace(workspaceId);
  }
}
```

---

### Svelte/SvelteKit Integration

**Store Pattern**

```typescript
// stores/postman.ts
import { writable, derived } from 'svelte/store';
import { PostmanClient, Workspace, Collection } from '@postman/sdk';

const client = new PostmanClient({ apiKey: import.meta.env.VITE_POSTMAN_API_KEY });

export const currentWorkspaceId = writable<string | null>(null);

export const workspace = derived(
  currentWorkspaceId,
  ($workspaceId, set) => {
    if ($workspaceId) {
      client.getWorkspace($workspaceId).then(set);
    } else {
      set(null);
    }
  },
  null as Workspace | null
);

export const collections = derived(
  currentWorkspaceId,
  ($workspaceId, set) => {
    if ($workspaceId) {
      client.getCollections($workspaceId).then(set);
    } else {
      set([]);
    }
  },
  [] as Collection[]
);
```

**SvelteKit Load Function**

```typescript
// routes/workspace/[id]/+page.server.ts
import { PostmanClient } from '@postman/sdk';
import { POSTMAN_API_KEY } from '$env/static/private';

const client = new PostmanClient({ apiKey: POSTMAN_API_KEY });

export async function load({ params }) {
  const [workspace, collections] = await Promise.all([
    client.getWorkspace(params.id),
    client.getCollections(params.id),
  ]);

  return { workspace, collections };
}
```

---

## API Reference

### PostmanClient

Main SDK client with all API methods.

```typescript
const client = new PostmanClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.getpostman.com', // optional
  timeout: 30000, // optional
  retryAttempts: 3, // optional
  retryDelay: 1000, // optional
});
```

**Methods:**

| Method | Description |
|--------|-------------|
| `validateApiKey()` | Validate API key and get user info |
| `getWorkspace(id)` | Get workspace details |
| `createWorkspace(request)` | Create new workspace |
| `getCollections(workspaceId)` | Get all collections |
| `forkCollection(uid, label, targetWorkspaceId)` | Fork a collection |
| `getEnvironments(workspaceId)` | Get all environments |
| `createEnvironment(name, values, workspaceId)` | Create environment |
| `getMocks(workspaceId)` | Get all mock servers |
| `createMock(request)` | Create mock server |
| `getSpecs(workspaceId)` | Get all specs |
| `createSpec(workspaceId, name, type, files)` | Create spec |
| `invitePartner(workspaceId, email, roleId)` | Invite partner |

### ProvisioningService

High-level provisioning workflow.

```typescript
const provisioner = new ProvisioningService({
  client,
  sourceWorkspaceId: 'source-id',
  targetWorkspaceName: 'New Workspace',
  adminUserIds: ['user-1', 'user-2'],
  partnerEmails: ['partner@example.com'],
  onProgress: (event) => console.log(event.message),
});

const result = await provisioner.provision();
```

### ResetService

High-level reset workflow.

```typescript
const resetter = new ResetService({
  client,
  workspaceId: 'workspace-to-reset',
  onProgress: (event) => console.log(event.message),
});

const result = await resetter.reset();
```

---

## License

MIT
