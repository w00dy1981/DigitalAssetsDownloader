import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { safeStorage } from 'electron';
import {
  SqlCredentialIdentity,
  SqlPasswordDeleteRequest,
  SqlPasswordSaveRequest,
} from '@/shared/types';

interface SecureStringStorage {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(encryptedValue: Buffer): string;
}

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
  constructor(
    private readonly credentialDirectory: string,
    private readonly secureStorage: SecureStringStorage = safeStorage
  ) {}

  loadSavedPassword(identity: SqlCredentialIdentity): string | null {
    const credentialPath = this.getCredentialPath(identity);
    if (!fs.existsSync(credentialPath)) return null;

    this.ensureEncryptionAvailable();

    try {
      return this.secureStorage.decryptString(fs.readFileSync(credentialPath));
    } catch {
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

    const credentialPath = this.getCredentialPath(request.identity);
    this.ensureEncryptionAvailable();

    try {
      fs.mkdirSync(this.credentialDirectory, { recursive: true });
      fs.writeFileSync(
        credentialPath,
        this.secureStorage.encryptString(request.password)
      );
      return { success: true };
    } catch {
      throw this.toCredentialError();
    }
  }

  deleteSavedPassword(request: SqlPasswordDeleteRequest): { success: true } {
    const credentialPath = this.getCredentialPath(request.identity);

    try {
      if (fs.existsSync(credentialPath)) {
        fs.unlinkSync(credentialPath);
      }
      return { success: true };
    } catch {
      throw this.toCredentialError();
    }
  }

  private getCredentialPath(identity: SqlCredentialIdentity): string {
    this.validateIdentity(identity);
    return path.join(
      this.credentialDirectory,
      `${buildSqlCredentialAccount(identity)}.bin`
    );
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

  private ensureEncryptionAvailable(): void {
    if (!this.secureStorage.isEncryptionAvailable()) {
      throw this.toCredentialError();
    }
  }

  private toCredentialError(): Error {
    return new Error(
      'Secure credential storage is unavailable or could not be accessed.'
    );
  }
}
