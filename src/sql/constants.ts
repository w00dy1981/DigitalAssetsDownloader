// SQL Server input configuration
export const SQL_CONSTANTS = {
  DEFAULT_DATABASE: 'Baker',
  DEFAULT_USERNAME: 'DigitalAssetsDownloader',
  PREVIEW_ROW_LIMIT: 50,
  FULL_LOAD_ROW_LIMIT: 10000,
  QUERY_TIMEOUT_MS: 30000,
  CONNECTION_TIMEOUT_MS: 15000,
} as const;
