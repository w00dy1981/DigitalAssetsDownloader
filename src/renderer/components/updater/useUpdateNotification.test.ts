/** @jest-environment jsdom */

import { createElement } from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { UpdateNotificationBanner } from './UpdateNotificationBanner';
import { useUpdateNotification } from './useUpdateNotification';

test('handles updater events, user actions, and subscription cleanup', async () => {
  const unsubscribe = jest.fn();
  const api = {
    onUpdateChecking: jest.fn(() => unsubscribe),
    onUpdateAvailable: jest.fn<
      typeof unsubscribe,
      [(info: { version: string }) => void]
    >(() => unsubscribe),
    onUpdateNotAvailable: jest.fn(() => unsubscribe),
    onUpdateDownloadProgress: jest.fn<
      typeof unsubscribe,
      [(info: { percent: number }) => void]
    >(() => unsubscribe),
    onUpdateDownloaded: jest.fn<
      typeof unsubscribe,
      [(info: { version: string }) => void]
    >(() => unsubscribe),
    onUpdateError: jest.fn(() => unsubscribe),
    downloadUpdate: jest.fn().mockResolvedValue(undefined),
    installUpdate: jest.fn().mockResolvedValue(undefined),
  };
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: api,
  });

  function Updates() {
    const { notice, download, install, dismiss } = useUpdateNotification();
    return (
      notice &&
      createElement(UpdateNotificationBanner, {
        currentVersion: '1.0.0',
        notice,
        onDownload: download,
        onInstall: install,
        onDismiss: dismiss,
      })
    );
  }

  const { unmount } = render(createElement(Updates));
  const available = api.onUpdateAvailable.mock.calls[0][0];
  const progress = api.onUpdateDownloadProgress.mock.calls[0][0];
  const downloaded = api.onUpdateDownloaded.mock.calls[0][0];

  expect(screen.queryByRole('status')).toBeNull();
  act(() => available({ version: '2.0.0' }));
  expect(screen.getByText('New version available: v2.0.0')).toBeVisible();

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Download Update' }));
  });
  expect(api.downloadUpdate).toHaveBeenCalledTimes(1);
  act(() => progress({ percent: 33 }));
  expect(screen.getByRole('progressbar')).toHaveValue(33);

  fireEvent.click(screen.getByRole('button', { name: 'Remind Me Later' }));
  act(() => progress({ percent: 55 }));
  expect(screen.queryByRole('status')).toBeNull();

  act(() => downloaded({ version: '2.0.0' }));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Install & Restart' }));
  });
  expect(api.installUpdate).toHaveBeenCalledTimes(1);

  unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(6);
});
