/** @jest-environment jsdom */

import { createElement } from 'react';
import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { initialDownloadOptions } from '@/shared/downloadSettings';
import { defaultUserSettings } from '@/shared/userSettings';
import type { LoadedInput } from '@/shared/types';
import App from '../App';
import InputSelectionTab from './InputSelectionTab';

const api = {
  loadSqlConnectionDetails: jest.fn(),
  openFileDialog: jest.fn(),
  getSheetNames: jest.fn(),
  loadSheetData: jest.fn(),
  loadSavedSqlPassword: jest.fn(),
  deleteSavedSqlPassword: jest.fn(),
  saveSqlPassword: jest.fn(),
  testSqlConnection: jest.fn(),
  executeSqlQuery: jest.fn(),
  selectSqlResult: jest.fn(),
};
const identity = {
  server: 'sql.example',
  database: 'Assets',
  username: 'reader',
};
const rows = [{ SKU: 'ABC', URL: 'https://example.test/image.jpg' }];
const columns = ['SKU', 'URL'];

beforeEach(() => {
  jest.resetAllMocks();
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: api,
  });
  api.loadSqlConnectionDetails.mockResolvedValue(identity);
  api.loadSavedSqlPassword.mockResolvedValue(null);
});

test.each([
  ['/tmp/assets.csv', 'Sheet1'],
  ['/tmp/assets.xlsx', 'Downloads'],
])('loads %s using its selected sheet', async (filePath, sheetName) => {
  const onDataLoaded = jest.fn();
  api.openFileDialog.mockResolvedValue({
    canceled: false,
    filePaths: [filePath],
  });
  api.getSheetNames.mockResolvedValue(
    filePath.endsWith('.csv') ? ['Sheet1'] : ['Overview', 'Downloads']
  );
  const summary: LoadedInput = {
    loadId: 1,
    columns,
    rowCount: 1,
    sheetName,
    options: initialDownloadOptions(defaultUserSettings),
    sourceLabel: filePath,
  };
  api.loadSheetData.mockResolvedValue(summary);
  const { rerender } = render(
    createElement(InputSelectionTab, { currentData: null, onDataLoaded })
  );

  fireEvent.click(screen.getByRole('button', { name: 'Browse...' }));
  const sheet = await screen.findByLabelText('Select Sheet');
  if (filePath.endsWith('.xlsx')) {
    fireEvent.change(sheet, { target: { value: sheetName } });
  }
  expect(sheet).toHaveValue(sheetName);
  fireEvent.click(screen.getByRole('button', { name: 'Load Sheet' }));

  await waitFor(() => expect(onDataLoaded).toHaveBeenCalledWith(summary));
  rerender(
    createElement(InputSelectionTab, { currentData: summary, onDataLoaded })
  );
  expect(screen.getByText('1 data rows')).toBeInTheDocument();
});

test('selects the second returned table and opens mapping without rerunning SQL', async () => {
  api.executeSqlQuery.mockResolvedValue({
    executionId: 12,
    results: [
      { columns: ['Status'], rows: [{ Status: 'Ready' }], totalRowCount: 1 },
      { columns, rows, totalRowCount: 250 },
    ],
  });
  const summary = { columns, rowCount: 250, loadId: 14 };
  api.selectSqlResult.mockResolvedValue(summary);
  const onDataLoaded = jest.fn();
  render(createElement(InputSelectionTab, { currentData: null, onDataLoaded }));
  fireEvent.click(screen.getByRole('button', { name: 'SQL Server' }));
  fireEvent.change(await screen.findByLabelText('SQL Query'), {
    target: { value: 'EXEC Assets' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Run SQL' }));
  await screen.findByRole('cell', { name: 'Ready' });
  fireEvent.click(screen.getByRole('button', { name: 'Excel / CSV' }));
  fireEvent.click(screen.getByRole('button', { name: 'SQL Server' }));
  fireEvent.change(screen.getByLabelText('Result set'), {
    target: { value: '1' },
  });
  expect(screen.getByRole('cell', { name: 'ABC' })).toBeInTheDocument();
  expect(screen.getByText(/250 total rows/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Use Result' }));
  await waitFor(() => expect(onDataLoaded).toHaveBeenCalledWith(summary));
  expect(api.executeSqlQuery).toHaveBeenCalledTimes(1);
  expect(api.selectSqlResult).toHaveBeenCalledWith(12, 1);
});

test('clears the previous sheet when a replacement file cannot be read', async () => {
  api.openFileDialog
    .mockResolvedValueOnce({ canceled: false, filePaths: ['/tmp/first.xlsx'] })
    .mockResolvedValueOnce({
      canceled: false,
      filePaths: ['/tmp/broken.xlsx'],
    });
  api.getSheetNames
    .mockResolvedValueOnce(['Assets'])
    .mockRejectedValueOnce(new Error('Unreadable spreadsheet'));
  render(
    createElement(InputSelectionTab, {
      currentData: null,
      onDataLoaded: jest.fn(),
    })
  );

  const browse = screen.getByRole('button', { name: 'Browse...' });
  fireEvent.click(browse);
  expect(await screen.findByLabelText('Select Sheet')).toHaveValue('Assets');
  fireEvent.click(browse);

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Failed to read the selected spreadsheet.'
  );
  expect(screen.getByLabelText('Excel or CSV File')).toHaveValue(
    '/tmp/broken.xlsx'
  );
  expect(screen.queryByRole('button', { name: 'Load Sheet' })).toBeNull();
});

test('ignores a saved password returned after changing the connection', async () => {
  let completePreviousLookup: (value: string) => void = () => {};
  api.loadSavedSqlPassword.mockImplementationOnce(
    () =>
      new Promise<string>(resolve => {
        completePreviousLookup = resolve;
      })
  );
  render(
    createElement(InputSelectionTab, {
      currentData: null,
      onDataLoaded: jest.fn(),
    })
  );

  fireEvent.click(screen.getByRole('button', { name: 'SQL Server' }));
  const database = await screen.findByLabelText('Database');
  await waitFor(() => expect(api.loadSavedSqlPassword).toHaveBeenCalled());
  fireEvent.change(database, { target: { value: 'OtherAssets' } });

  await act(async () => completePreviousLookup('previous-connection-password'));
  expect(screen.getByLabelText('Password', { exact: true })).toHaveValue('');
  expect(
    screen.getByRole('checkbox', {
      name: 'Remember SQL password on this device',
    })
  ).not.toBeChecked();
  expect(
    screen.queryByRole('button', { name: 'Forget saved password' })
  ).toBeNull();
});

test('forgets the saved password and clears the session password when switching connections', async () => {
  api.loadSavedSqlPassword.mockResolvedValueOnce('fixture-password');
  api.deleteSavedSqlPassword.mockResolvedValue({ success: true });
  api.testSqlConnection.mockResolvedValue({ success: true });
  render(
    createElement(InputSelectionTab, {
      currentData: null,
      onDataLoaded: jest.fn(),
    })
  );

  fireEvent.click(screen.getByRole('button', { name: 'SQL Server' }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Forget saved password' })
  );
  await screen.findByText('Saved SQL password removed for this connection.');
  expect(api.deleteSavedSqlPassword).toHaveBeenCalledWith({
    identity: {
      server: identity.server,
      database: 'assets',
      username: identity.username,
    },
  });

  fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }));
  await screen.findByText('Connected to sql.example / Assets');
  expect(api.saveSqlPassword).not.toHaveBeenCalled();

  await act(async () => {
    fireEvent.change(screen.getByLabelText('Database'), {
      target: { value: 'OtherAssets' },
    });
  });
  const password = screen.getByLabelText('Password', { exact: true });
  expect(password).toHaveValue('');
  expect(
    screen.getByRole('checkbox', {
      name: 'Remember SQL password on this device',
    })
  ).not.toBeChecked();
});

test('keeps unfinished mapping edits across tabs and resets them for a new input', async () => {
  const subscribe = () => () => {};
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      ...api,
      onMenuOpenFile: subscribe,
      onMenuOpenSettings: subscribe,
      onUpdateChecking: subscribe,
      onUpdateAvailable: subscribe,
      onUpdateNotAvailable: subscribe,
      onUpdateDownloadProgress: subscribe,
      onUpdateDownloaded: subscribe,
      onUpdateError: subscribe,
      onDownloadComplete: subscribe,
      onDownloadProgress: subscribe,
    },
  });
  const sourceLabel = '/tmp/products.xlsx';
  api.openFileDialog.mockResolvedValue({
    canceled: false,
    filePaths: [sourceLabel],
  });
  api.getSheetNames.mockResolvedValue(['First', 'Second']);
  api.loadSheetData.mockImplementation(
    (_path: string, sheetName: string): LoadedInput => ({
      sourceLabel,
      sheetName,
      columns: ['Part', 'PDF'],
      rowCount: 1,
      loadId: sheetName === 'First' ? 1 : 2,
      options: {
        ...initialDownloadOptions(defaultUserSettings),
        pdfFolder: '/tmp/pdfs',
      },
    })
  );

  render(createElement(App));
  const button = (name: string | RegExp) =>
    screen.getByRole('button', { name });
  fireEvent.click(button('Browse...'));
  fireEvent.click(await screen.findByRole('button', { name: 'Load Sheet' }));
  fireEvent.change(await screen.findByLabelText(/Part Number Column/), {
    target: { value: 'Part' },
  });
  fireEvent.click(button('1. Input Selection'));
  fireEvent.click(button('2. Column Selection'));
  expect(screen.getByLabelText(/Part Number Column/)).toHaveValue('Part');
  expect(button('3. Process & Download')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('PDF URL Column'), {
    target: { value: 'PDF' },
  });
  fireEvent.click(button(/Next: Process/));
  fireEvent.change(screen.getByLabelText('Concurrent Downloads'), {
    target: { value: '7' },
  });
  fireEvent.click(button('2. Column Selection'));
  fireEvent.change(screen.getByLabelText('PDF URL Column'), {
    target: { value: '' },
  });
  fireEvent.click(button('3. Process & Download'));
  expect(button('Start Downloads')).toBeDisabled();
  expect(screen.getByLabelText('Concurrent Downloads')).toHaveValue(7);

  fireEvent.click(button('1. Input Selection'));
  fireEvent.change(screen.getByLabelText('Select Sheet'), {
    target: { value: 'Second' },
  });
  fireEvent.click(button('Load Sheet'));
  expect(await screen.findByLabelText(/Part Number Column/)).toHaveValue('');
  expect(button('3. Process & Download')).toBeDisabled();
});
