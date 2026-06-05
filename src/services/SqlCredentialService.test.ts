import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildSqlCredentialAccount,
  SqlCredentialService,
} from './SqlCredentialService';

jest.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: jest.fn(() => true),
    encryptString: jest.fn((value: string) =>
      Buffer.from(`encrypted:${value}`, 'utf8')
    ),
    decryptString: jest.fn((value: Buffer) =>
      value.toString('utf8').replace(/^encrypted:/, '')
    ),
  },
}));

const createSecureStorage = (isAvailable = true) => ({
  isEncryptionAvailable: jest.fn(() => isAvailable),
  encryptString: jest.fn((value: string) =>
    Buffer.from(
      Buffer.from(`encrypted:${value}`, 'utf8').toString('base64'),
      'utf8'
    )
  ),
  decryptString: jest.fn((value: Buffer) =>
    Buffer.from(value.toString('utf8'), 'base64')
      .toString('utf8')
      .replace(/^encrypted:/, '')
  ),
});

describe('SqlCredentialService', () => {
  const identity = {
    server: 'SQL-SERVER',
    database: 'Baker',
    username: 'DigitalAssetsDownloader',
  };

  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dad-sql-credentials-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('builds a deterministic normalized credential account key', () => {
    expect(buildSqlCredentialAccount(identity)).toBe(
      buildSqlCredentialAccount({
        server: ' sql-server ',
        database: 'BAKER',
        username: 'digitalassetsdownloader',
      })
    );
  });

  it('saves, loads, checks, and deletes an encrypted SQL password file', () => {
    const secureStorage = createSecureStorage();
    const service = new SqlCredentialService(tempDir, secureStorage);

    expect(service.hasSavedPassword(identity)).toBe(false);

    service.savePassword({ identity, password: 'secret-password' });

    const credentialFile = path.join(
      tempDir,
      `${buildSqlCredentialAccount(identity)}.bin`
    );
    expect(fs.existsSync(credentialFile)).toBe(true);
    expect(fs.readFileSync(credentialFile, 'utf8')).not.toContain(
      'secret-password'
    );
    expect(service.hasSavedPassword(identity)).toBe(true);
    expect(service.loadSavedPassword(identity)).toBe('secret-password');

    service.deleteSavedPassword({ identity });

    expect(service.hasSavedPassword(identity)).toBe(false);
    expect(service.loadSavedPassword(identity)).toBeNull();
  });

  it('does not mix passwords between SQL identities', () => {
    const service = new SqlCredentialService(tempDir, createSecureStorage());
    const otherIdentity = { ...identity, database: 'OtherDb' };

    service.savePassword({ identity, password: 'first-password' });
    service.savePassword({
      identity: otherIdentity,
      password: 'second-password',
    });

    expect(service.loadSavedPassword(identity)).toBe('first-password');
    expect(service.loadSavedPassword(otherIdentity)).toBe('second-password');
  });

  it('requires complete connection identity and a password before saving', () => {
    const service = new SqlCredentialService(tempDir, createSecureStorage());

    expect(() =>
      service.savePassword({
        identity: { ...identity, server: '' },
        password: 'secret-password',
      })
    ).toThrow('SQL Server name is required.');

    expect(() => service.savePassword({ identity, password: '' })).toThrow(
      'SQL password is required.'
    );
  });

  it('surfaces unavailable secure storage without exposing the password', () => {
    const service = new SqlCredentialService(
      tempDir,
      createSecureStorage(false)
    );

    expect(() =>
      service.savePassword({ identity, password: 'secret-password' })
    ).toThrow('Secure credential storage is unavailable');
  });
});
