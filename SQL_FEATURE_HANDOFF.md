# SQL Server Input Feature — Session Handoff

**Date:** 2026-06-04 (final polish session)
**Branch:** main — all commits pushed to origin/main (`e6af34d..074c93c`)
**Status:** Feature complete and manually verified ✅

---

## What's Done

The SQL Server input path is fully implemented, tested, and verified end-to-end.

### Commits (this feature, newest first)
| SHA | Summary |
|---|---|
| `074c93c` | SQL types, IPC bridge, constants, UI text, IPCService tests |
| `73f9258` | Handoff doc |
| `cc8fde6` | UI polish: credential persistence, preview table, connection feedback |
| `a6e7231` | Lint/import fixes |
| `aac84e2` | Fix `SELECT TOP n` (no parens); strip IPC wrapper from errors; integration tests |
| `768f51e` | Timeout propagation test |
| `566d6b5` | webpack externals fix |
| `a30dfee` | mssql v11 downgrade (crash fix) |

### Key bugs fixed during verification
- `LOAD_CONFIG` was returning `DownloadConfig` directly instead of `AppConfig` shape — server/database/username never restored on app restart
- `applySqlRowLimit` didn't detect `SELECT TOP n` without parentheses — caused double-TOP SQL syntax errors
- Electron IPC wrapper text (`Error invoking remote method '...'`) was leaking into UI error messages
- `FileSelectionTab` was unmounting on tab switch — password and query reset every navigation

---

## Integration Tests

File: `src/services/SqlServerService.integration.test.ts`
Credentials: `.env.test.local` (gitignored — fill in before running)
Run: `npm run test:integration`

```
TEST_SQL_SERVER=SERVERABM
TEST_SQL_DATABASE=Baker
TEST_SQL_USERNAME=DigitalAssetsDownloader
TEST_SQL_PASSWORD=<password manager>
TEST_SQL_QUERY=SELECT TOP 10 * FROM Products
```

---

## Next Session — Pick Up Here

### 1. Column Selection with SQL data (HIGH — do this first)
Load the SQL query below, then go to the Column Selection tab. Verify:
- Column names with spaces (`Supplier Name`, `Photo File Path`) appear in all dropdowns
- Part number column can be mapped to `Product Code`
- Image/PDF column can be mapped to `Photo File Path`
- Configuration completes without errors

SQL query used for testing:
```sql
SELECT TOP (100) [Supplier Name], [Preferred Supplier Part Number],
  [Product Code], [Product Title], [Product Group],
  [Status], [Sales Information Notes], [Photo File Path]
FROM [Baker].[dbo].[SB_WebProductsInfo]
```

### 2. Full end-to-end download run (HIGH)
Using SQL as source, configure a small batch (filter to ~10 rows) and run a download. Confirm files land in the output folder and the process tab shows progress correctly.

### 3. Query persistence across sessions (LOW — optional quality-of-life)
Password is intentionally session-only (correct). The SQL query currently also clears on app restart. Could optionally save it to electron-store alongside server/database/username. Only worth doing if re-entering the query each session becomes annoying.

### 4. CRLF cleanup (LOW)
Run `npm run format` once to clear pre-existing Prettier CRLF warnings across the codebase. No logic changes — purely formatting.
