# SQL Server Input Feature — Session Handoff

**Date:** 2026-06-04 (updated after UI polish session)
**Branch:** main
**Feature:** SQL Server input path as alternative to Excel/CSV
**Verification Status:** All tasks complete ✅ — feature is shippable

---

## Session History

### Session 1 — Implementation
All SQL feature code implemented and unit-tested.

### Session 2 — Crash Fix
| Commit | Change |
|---|---|
| `71cc5ed` | Downgrade mssql `^12.5.5` → `^11.0.1` (Node 18.18.2 compatibility) |
| `ed08615` | Add mssql/electron-log/electron-updater to webpack externals |

### Session 3 — Verification & Polish
| Commit | Change |
|---|---|
| `49d3cb2` | Add `queryTimeoutMs` propagation test |
| `54f3604` | Fix `SELECT TOP n` (no parens) in `applySqlRowLimit`; strip IPC wrapper from UI errors; integration test infrastructure |
| `86129e8` | Fix lint — replace `require()` with import; Prettier formatting |
| `06ec6e5` | SQL UI polish — credential persistence, preview table, connection feedback |

---

## What Was Implemented

### UI — FileSelectionTab.tsx
| Item | Status |
|---|---|
| SQL Server toggle beside Excel/CSV | ✅ |
| Server, Database (default `Baker`), Username (default `DigitalAssetsDownloader`) fields | ✅ |
| Password field (session-only) | ✅ |
| Query textarea (session-only, 8-row) | ✅ |
| Persist server/database/username via electron-store | ✅ Fixed in `06ec6e5` — LOAD_CONFIG was returning wrong shape |
| Clear password after successful full load | ✅ |
| Clear password when switching away from SQL | ✅ |
| Preview shows scrollable dark-themed data table | ✅ Added in `06ec6e5` |
| Test Connection shows persistent success message | ✅ Added in `06ec6e5` |
| Tab navigation preserves password/query within session | ✅ Fixed in `06ec6e5` — FileSelectionTab kept mounted |
| Renderer-side validation (`validateSqlInputs()`) | ✅ |

### Services and IPC
| Item | Status |
|---|---|
| `SqlServerService.ts` main-process service | ✅ |
| `TEST_SQL_CONNECTION`, `PREVIEW_SQL_QUERY`, `LOAD_SQL_QUERY_DATA` IPC handlers | ✅ |
| IPC error wrapper stripped in `safeIPC` (clean error messages in UI) | ✅ Added in `54f3604` |
| `SELECT TOP n` (no parens) detection in `applySqlRowLimit` | ✅ Fixed in `54f3604` |
| Password never persisted; user-facing errors sanitized | ✅ |

### Tests
| Item | Status |
|---|---|
| `validateSqlQuery` — 22 dangerous-pattern cases | ✅ |
| `applySqlRowLimit` — plain SELECT, DISTINCT, WITH…SELECT, TOP(n), TOP n | ✅ |
| `SqlServerService.previewQuery` and `loadQueryData` execution tests | ✅ |
| `redactSqlRequest` — password redaction | ✅ |
| IPC wrapper tests for all three SQL channels | ✅ |
| Timeout propagation test | ✅ Added in `49d3cb2` |
| Integration tests (real SQL Server, auto-skip without creds) | ✅ Added in `54f3604` |

---

## Verification Status

| Check | Result |
|---|---|
| `npm run build` | ✅ Clean, zero TS errors |
| `npm test` | ✅ All SQL tests pass; pre-existing `pathSecurity.test.ts` Windows path failures unrelated |
| `npm run test:integration` | ✅ 4/4 pass against live SERVERABM |
| App launches | ✅ |
| Mode toggle, labels, validation (steps 1–5) | ✅ Manually verified |
| Credential persistence across sessions | ✅ Manually verified (step F) |
| Preview table renders data | ✅ Manually verified |
| Test Connection success message | ✅ Manually verified |

---

## Integration Test Credentials

File: `.env.test.local` (gitignored — never committed)

```
TEST_SQL_SERVER=SERVERABM
TEST_SQL_DATABASE=Baker
TEST_SQL_USERNAME=DigitalAssetsDownloader
TEST_SQL_PASSWORD=<see your password manager>
TEST_SQL_QUERY=SELECT TOP 10 * FROM Products
```

Run with: `npm run test:integration`

---

## Known Non-Issues (pre-existing, out of scope)

- `pathSecurity.test.ts` — Windows path format mismatches in test expectations
- `npm run lint` on full project — CRLF Prettier errors in unchanged files
- `webpack.main.config.js` — CRLF errors (pre-existing)
- `any` warnings in `main.ts`, `IPCService.ts`, `SqlServerService.ts` — pre-existing

---

## Next Steps (suggested)

### High priority
1. **Column Selection with SQL data** — after a SQL full load, walk through the Column Selection tab to confirm column mapping works correctly with SQL column names (spaces in names like `Supplier Name`, `Photo File Path`)
2. **Full download run** — configure a download using SQL data as source and run a small batch to confirm end-to-end flow

### Medium priority
3. **Query persistence across sessions** — currently password and query clear on app restart (by design for password; could optionally persist query to electron-store)
4. **SQL error UX** — consider showing query execution errors inline near the query textarea rather than at the top of the form

### Low priority
5. **Playwright UI tests** — automate the manual verification steps (steps 1–5) so regressions are caught without manual walkthroughs
6. **CRLF cleanup** — run `npm run format` across the codebase to resolve pre-existing Prettier CRLF warnings
