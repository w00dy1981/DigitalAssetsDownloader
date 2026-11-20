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
import type { LoadedInput } from '@/shared/types';
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
  previewSqlQuery: jest.fn(),
  loadSqlQueryData: jest.fn(),
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
    filePath,
    sourceType: 'file',
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

test('requires a fresh SQL preview and confirmation before loading rows', async () => {
  const result = {
    columns,
    rows,
    rowCount: 1,
    totalRowCount: 250,
    sourceLabel: 'Assets query',
  };
  api.loadSavedSqlPassword.mockResolvedValue('fixture-password');
  api.previewSqlQuery.mockResolvedValue(result);
  const summary: LoadedInput = {
    loadId: 1,
    columns,
    rowCount: 1,
    sheetName: 'SQL Query',
    filePath: result.sourceLabel,
    sourceType: 'sql',
    sourceLabel: result.sourceLabel,
  };
  api.loadSqlQueryData.mockResolvedValue(summary);
  api.saveSqlPassword.mockResolvedValue({ success: true });
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
  const onDataLoaded = jest.fn();

  try {
    render(
      createElement(InputSelectionTab, { currentData: null, onDataLoaded })
    );
    fireEvent.click(screen.getByRole('button', { name: 'SQL Server' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Password', { exact: true })).toHaveValue(
        'fixture-password'
      )
    );

    const query = screen.getByLabelText('SQL Query');
    const load = screen.getByRole('button', { name: 'Load SQL Data' });
    const preview = screen.getByRole('button', { name: 'Preview Query' });
    fireEvent.change(query, {
      target: { value: 'SELECT SKU, URL FROM Assets' },
    });
    expect(load).toBeDisabled();
    fireEvent.click(preview);
    expect(
      await screen.findByRole('cell', { name: 'ABC' })
    ).toBeInTheDocument();
    fireEvent.click(load);
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('250 rows'));
    expect(api.loadSqlQueryData).not.toHaveBeenCalled();

    fireEvent.change(query, {
      target: { value: 'SELECT SKU, URL FROM OtherAssets' },
    });
    expect(load).toBeDisabled();
    fireEvent.click(preview);
    await screen.findByRole('cell', { name: 'ABC' });
    confirm.mockReturnValue(true);
    fireEvent.click(load);
    await waitFor(() => expect(onDataLoaded).toHaveBeenCalledWith(summary));
    expect(api.loadSqlQueryData).toHaveBeenCalledWith(
      expect.objectContaining({
        ...identity,
        query: 'SELECT SKU, URL FROM OtherAssets',
      })
    );
  } finally {
    confirm.mockRestore();
  }
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
