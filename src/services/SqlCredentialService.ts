import { createHash } from 'crypto';
import { Entry } from '@napi-rs/keyring';
import {
  SqlCredentialIdentity,
  SqlPasswordDeleteRequest,
  SqlPasswordSaveRequest,
} from '@/shared/types';

const SQL_PASSWORD_SERVICE = 'com.digitalassetdownloader.app.sql-password';

export function buildSqlCredentialAccount(
  identity: SqlCredentialIdentity
): string {
  const normalizedIdentity = {
    server: identity.server.trim().toLowerCase(),
    database: identity.database.trim().toLowerCase(),
    username: identity.username.trim().toLowerCase(),
  };

  return createHash('sha256')
    .update(JSON.stringify(normalizedIdentity))
    .digest('hex');
}

export class SqlCredentialService {
  loadSavedPassword(identity: SqlCredentialIdentity): string | null {
    const entry = this.createEntry(identity);
    try {
      return entry.getPassword();
    } catch (error) {
      if (this.isNoEntryError(error)) return null;
      throw this.toCredentialError();
    }
  }

  hasSavedPassword(identity: SqlCredentialIdentity): boolean {
    return this.loadSavedPassword(identity) !== null;
  }

  savePassword(request: SqlPasswordSaveRequest): { success: true } {
    if (!request.password) {
      throw new Error('SQL password is required.');
    }

    const entry = this.createEntry(request.identity);
    try {
      entry.setPassword(request.password);
      return { success: true };
    } catch {
      throw this.toCredentialError();
    }
  }

  deleteSavedPassword(request: SqlPasswordDeleteRequest): { success: true } {
    const entry = this.createEntry(request.identity);
    try {
      entry.deletePassword();
      return { success: true };
    } catch (error) {
      if (this.isNoEntryError(error)) return { success: true };
      throw this.toCredentialError();
    }
  }

  private createEntry(identity: SqlCredentialIdentity): Entry {
    this.validateIdentity(identity);
    return new Entry(SQL_PASSWORD_SERVICE, buildSqlCredentialAccount(identity));
  }

  private validateIdentity(identity: SqlCredentialIdentity): void {
    if (!identity.server?.trim()) {
      throw new Error('SQL Server name is required.');
    }
    if (!identity.database?.trim()) {
      throw new Error('SQL database is required.');
    }
    if (!identity.username?.trim()) {
      throw new Error('SQL username is required.');
    }
  }

  private toCredentialError(): Error {
    return new Error(
      'Secure credential storage is unavailable or could not be accessed.'
    );
  }

  private isNoEntryError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /noentry|no entry|not found/i.test(message);
  }
}
