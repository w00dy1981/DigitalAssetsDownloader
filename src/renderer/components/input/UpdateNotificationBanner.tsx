import type { UpdateInfo } from 'electron-updater';

interface UpdateNotificationBannerProps {
  currentVersion: string;
  updateInfo: UpdateInfo;
  statusMessage?: string | null;
  isChecking?: boolean;
  isDownloading?: boolean;
  isDownloaded?: boolean;
  downloadProgress?: number | null;
  onDownload?: () => void | Promise<void>;
  onInstall?: () => void | Promise<void>;
  onDismiss?: () => void;
}

export const UpdateNotificationBanner: React.FC<
  UpdateNotificationBannerProps
> = ({
  currentVersion,
  updateInfo,
  statusMessage,
  isChecking = false,
  isDownloading = false,
  isDownloaded = false,
  downloadProgress,
  onDownload,
  onInstall,
  onDismiss,
}) => {
  const progressValue = Math.max(0, Math.min(100, downloadProgress ?? 0));

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1a6fd6 0%, #4c8af0 100%)',
        border: '1px solid #1456a3',
        borderRadius: '12px',
        padding: '18px',
        marginBottom: '20px',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      <div>
        <strong style={{ fontSize: '1.1rem' }}>
          New version available: v{updateInfo.version}
        </strong>
        <div style={{ fontSize: '0.95rem', opacity: 0.9, marginTop: '4px' }}>
          Current version: v{currentVersion}
        </div>
        <div role="status" style={{ fontSize: '0.9rem', marginTop: '8px' }}>
          {statusMessage || (isChecking ? 'Checking for updates...' : '')}
        </div>
        {isDownloading && (
          <progress
            aria-label="Update download progress"
            value={
              downloadProgress === null || downloadProgress === undefined
                ? undefined
                : progressValue
            }
            max={100}
            style={{ width: '100%', marginTop: '10px' }}
          />
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {isDownloaded ? (
          <button type="button" className="btn btn-success" onClick={onInstall}>
            Install & Restart
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-light"
            onClick={onDownload}
            disabled={isDownloading}
          >
            {isDownloading ? 'Downloading…' : 'Download Update'}
          </button>
        )}
        <button
          className="btn btn-outline-light"
          onClick={onDismiss}
          style={{ minWidth: '140px' }}
        >
          Remind Me Later
        </button>
      </div>
    </div>
  );
};
