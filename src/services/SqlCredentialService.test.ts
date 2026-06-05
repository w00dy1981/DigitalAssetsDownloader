import {
  buildSqlCredentialAccount,
  SqlCredentialService,
} from './SqlCredentialService';

const mockPasswords = new Map<string, string>();
let mockGetError: Error | null = null;
let mockSetError: Error | null = null;
let mockDeleteError: Error | null = null;

jest.mock('@napi-rs/keyring', () => ({
  Entry: jest.fn().mockImplementation((service: string, account: string) => ({
    getPassword: jest.fn(() => {
      if (mockGetError) throw mockGetError;
      return mockPasswords.get(`${service}:${account}`) ?? null;
    }),
    setPassword: jest.fn((password: string) => {
      if (mockSetError) throw mockSetError;
      mockPasswords.set(`${service}:${account}`, password);
    }),
    deletePassword: jest.fn(() => {
      if (mockDeleteError) throw mockDeleteError;
      return mockPasswords.delete(`${service}:${account}`);
    }),
  })),
}));

describe('SqlCredentialService', () => {
  const identity = {
    server: 'SQL-SERVER',
    database: 'Baker',
    username: 'DigitalAssetsDownloader',
  };

  beforeEach(() => {
    mockPasswords.clear();
    mockGetError = null;
    mockSetError = null;
    mockDeleteError = null;
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

  it('saves, loads, checks, and deletes a SQL password', () => {
    const service = new SqlCredentialService();

    expect(service.hasSavedPassword(identity)).toBe(false);

    service.savePassword({ identity, password: 'secret-password' });

    expect(service.hasSavedPassword(identity)).toBe(true);
    expect(service.loadSavedPassword(identity)).toBe('secret-password');

    service.deleteSavedPassword({ identity });

    expect(service.hasSavedPassword(identity)).toBe(false);
    expect(service.loadSavedPassword(identity)).toBeNull();
  });

  it('does not mix passwords between SQL identities', () => {
    const service = new SqlCredentialService();
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
    const service = new SqlCredentialService();

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

  it('surfaces credential-store failures without exposing the password', () => {
    const service = new SqlCredentialService();
    mockSetError = new Error('native keyring failure');

    expect(() =>
      service.savePassword({ identity, password: 'secret-password' })
    ).toThrow('Secure credential storage is unavailable');
  });
});
