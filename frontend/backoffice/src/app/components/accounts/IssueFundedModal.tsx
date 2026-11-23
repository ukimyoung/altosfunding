import { ModalCloseBtn } from '../shared/ModalCloseButton';
import { tok } from '../../theme/tokens';

// 펀디드 계좌 발급 확인 (합격한 챌린지 계좌, Leaderboard '펀디드계좌' 열)
export function IssueFundedModal({
  dark,
  accountNumber,
  manual,
  onCancel,
  onConfirm,
}: {
  dark: boolean;
  /** 챌린지 계좌번호 (MT4) */
  accountNumber: string;
  manual: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = tok(dark);
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 120,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 380,
          background: t.surface,
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          fontFamily: "'Noto Sans KR','DM Sans',sans-serif",
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>펀디드 계좌 발급</span>
          <div style={{ flex: 1 }} />
          <ModalCloseBtn onClick={onCancel} t={t} />
        </div>
        <div style={{ fontSize: 12, color: t.textSec, lineHeight: 1.7 }}>
          챌린지 계좌{' '}
          <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 600, color: t.text }}>
            {accountNumber}
          </span>
          로 펀디드 계좌를 <span style={{ fontWeight: 600, color: t.text }}>지금 발급</span>
          합니다.
          <br />
          MT4 라이브 서버에 계좌를 만들고 자본금을 넣은 뒤, 트레이더에게 발급 안내 메일을 보냅니다.
          {!manual && (
            <>
              <br />
              <span style={{ color: '#D97706' }}>
                자동 발급 상품입니다. 자동 발급 시각을 기다리지 않고 바로 발급합니다.
              </span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18 }}>
          <button
            onClick={onCancel}
            style={{
              height: 36,
              padding: '0 20px',
              borderRadius: 8,
              border: `1px solid ${t.border2}`,
              background: 'transparent',
              color: t.textSec,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            style={{
              height: 36,
              padding: '0 20px',
              borderRadius: 8,
              border: 'none',
              background: t.accent,
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            발급하기
          </button>
        </div>
      </div>
    </div>
  );
}
