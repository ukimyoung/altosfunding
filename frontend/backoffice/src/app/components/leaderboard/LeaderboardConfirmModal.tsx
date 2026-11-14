interface LeaderboardConfirmModalProps {
  dark: boolean;
  title: string;
  message: string;
  cancelLabel?: string;
  confirmLabel: string;
  confirmColor: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function LeaderboardConfirmModal({
  dark,
  title,
  message,
  cancelLabel = '취소',
  confirmLabel,
  confirmColor,
  onCancel,
  onConfirm,
}: LeaderboardConfirmModalProps) {
  const t = {
    surface: dark ? '#0F1829' : '#ffffff',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    surface2: dark ? '#1A2035' : '#F4F5F7',
  };

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: t.surface,
          borderRadius: 12,
          width: 400,
          padding: 24,
          border: `1px solid ${t.border}`,
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: t.text,
            marginBottom: 12,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 13,
            color: t.textSec,
            lineHeight: 1.6,
            marginBottom: 24,
          }}
        >
          {message}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              height: 36,
              padding: '0 16px',
              borderRadius: 8,
              border: 'none',
              background: t.surface2,
              color: t.textSec,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              height: 36,
              padding: '0 16px',
              borderRadius: 8,
              border: 'none',
              background: confirmColor,
              color: '#fff',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
