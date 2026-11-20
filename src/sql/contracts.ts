export interface SqlConnectionDetails {
  server: string;
  database: string;
  username: string;
}

export type SqlCredentialIdentity = SqlConnectionDetails;

export interface SqlPasswordSaveRequest {
  identity: SqlCredentialIdentity;
  password: string;
}

export interface SqlPasswordDeleteRequest {
  identity: SqlCredentialIdentity;
}

export interface SqlConnectionRequest extends SqlConnectionDetails {
  password: string;
  queryTimeoutMs?: number;
  connectionTimeoutMs?: number;
}

export interface SqlQueryRequest extends SqlConnectionRequest {
  query: string;
}

export interface SqlTable {
  columns: string[];
  rows: Record<string, string>[];
}

export interface SqlResultPreview extends SqlTable {
  totalRowCount: number;
}

export interface SqlExecution {
  executionId: number;
  results: SqlResultPreview[];
}
