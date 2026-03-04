/**
 * Collection-related types
 */

/**
 * Collection summary (from list endpoint)
 */
export interface Collection {
  id: string;
  uid: string;
  name: string;
  owner?: string;
  createdAt?: string;
  updatedAt?: string;
  fork?: {
    label: string;
    createdAt: string;
    from: string;
  };
}

/**
 * Full collection details
 */
export interface CollectionDetails extends Collection {
  info: {
    name: string;
    description?: string;
    schema: string;
    _postman_id?: string;
  };
  item: CollectionItem[];
  auth?: CollectionAuth;
  variable?: CollectionVariable[];
  event?: CollectionEvent[];
}

/**
 * Collection item (folder or request)
 */
export interface CollectionItem {
  id?: string;
  name: string;
  description?: string;
  item?: CollectionItem[];
  request?: CollectionRequest;
  response?: CollectionResponse[];
  event?: CollectionEvent[];
}

/**
 * Collection request
 */
export interface CollectionRequest {
  method: string;
  url: string | CollectionUrl;
  header?: CollectionHeader[];
  body?: CollectionBody;
  auth?: CollectionAuth;
  description?: string;
}

/**
 * Collection URL
 */
export interface CollectionUrl {
  raw: string;
  protocol?: string;
  host?: string[];
  path?: string[];
  query?: Array<{ key: string; value: string; disabled?: boolean }>;
  variable?: Array<{ key: string; value: string }>;
}

/**
 * Collection header
 */
export interface CollectionHeader {
  key: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

/**
 * Collection body
 */
export interface CollectionBody {
  mode: 'raw' | 'formdata' | 'urlencoded' | 'file' | 'graphql';
  raw?: string;
  formdata?: Array<{ key: string; value: string; type?: string }>;
  urlencoded?: Array<{ key: string; value: string }>;
  options?: {
    raw?: {
      language?: string;
    };
  };
}

/**
 * Collection auth
 */
export interface CollectionAuth {
  type: string;
  bearer?: Array<{ key: string; value: string }>;
  basic?: Array<{ key: string; value: string }>;
  apikey?: Array<{ key: string; value: string }>;
}

/**
 * Collection variable
 */
export interface CollectionVariable {
  key: string;
  value: string;
  type?: string;
  disabled?: boolean;
}

/**
 * Collection event (pre-request/test scripts)
 */
export interface CollectionEvent {
  listen: 'prerequest' | 'test';
  script: {
    type: string;
    exec: string[];
  };
}

/**
 * Collection response (saved example)
 */
export interface CollectionResponse {
  id?: string;
  name: string;
  originalRequest?: CollectionRequest;
  status?: string;
  code?: number;
  header?: CollectionHeader[];
  body?: string;
}

/**
 * Fork collection request
 */
export interface ForkCollectionRequest {
  collectionUid: string;
  label: string;
  targetWorkspaceId: string;
}

/**
 * Fork collection result
 */
export interface ForkResult {
  success: boolean;
  collection?: Collection;
  error?: string;
}

/**
 * Collection mapping (source to target)
 */
export interface CollectionMapping {
  sourceUid: string;
  targetUid: string;
  name: string;
  mockUrl?: string;
}
