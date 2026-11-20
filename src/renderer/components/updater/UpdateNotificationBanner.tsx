import type { UpdateNotice } from './useUpdateNotification';

interface UpdateNotificationBannerProps {
  currentVersion: string;
  notice: UpdateNotice;
  onDownload: () => Promise<void>;
  onInstall: () => Promise<void>;
  onDismiss: () => void;
}

export function UpdateNotificationBanner({
  currentVersion,
  notice,
  onDownload,
  onInstall,
  onDismiss,
}: UpdateNotificationBannerProps) {
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
          New version available: v{notice.version}
        </strong>
        <div style={{ fontSize: '0.95rem', opacity: 0.9, marginTop: '4px' }}>
          Current version: v{currentVersion}
        </div>
        <div role="status" style={{ fontSize: '0.9rem', marginTop: '8px' }}>
          {notice.message}
        </div>
        {notice.phase === 'downloading' && (
          <progress
            aria-label="Update download progress"
            value={
              notice.progress === undefined
                ? undefined
                : Math.max(0, Math.min(100, notice.progress))
            }
            max={100}
            style={{ width: '100%', marginTop: '10px' }}
          />
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {notice.phase === 'downloaded' ? (
          <button type="button" className="btn btn-success" onClick={onInstall}>
            Install & Restart
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-light"
            onClick={onDownload}
            disabled={notice.phase === 'downloading'}
          >
            {notice.phase === 'downloading'
              ? 'Downloading…'
              : 'Download Update'}
          </button>
        )}
        <button
          type="button"
          className="btn btn-outline-light"
          onClick={onDismiss}
          style={{ minWidth: '140px' }}
        >
          Remind Me Later
        </button>
      </div>
    </div>
  );
}
