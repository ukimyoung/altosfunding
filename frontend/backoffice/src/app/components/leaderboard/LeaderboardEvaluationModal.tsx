import type { ChallengeEvaluation } from '../../../api/challenge';
import { formatKstDateTime, formatSignedPercent, formatSignedUsdMoney } from '../../utils/utils';

interface LeaderboardEvaluationModalProps {
  dark: boolean;
  accountNumber: string;
  evaluation: ChallengeEvaluation;
  onClose: () => void;
}

/** '확인하기' 판정 결과: 통과 여부, 판정 기간·거래 수, 룰별 결과 */
export function LeaderboardEvaluationModal({
  dark,
  accountNumber,
  evaluation,
  onClose,
}: LeaderboardEvaluationModalProps) {
  const t = {
    surface: dark ? '#0F1829' : '#ffffff',
    surface2: dark ? '#1A2035' : '#F4F5F7',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
  };
  const passed = evaluation.result === 'PASSED';
  const resultColor = passed ? '#16A34A' : '#DC2626';
  const rows: [string, string][] = [
    ['판정 기간', `${formatKstDateTime(evaluation.period_start)} ~ ${formatKstDateTime(evaluation.period_end)} (GMT+9)`],
    ['수익률 / 수익금', `${formatSignedPercent(Math.round(evaluation.profit_rate * 100) / 100)} / ${formatSignedUsdMoney(evaluation.profit)}`],
    ['청산 거래 / 미결 포지션', `${evaluation.trades_count}건 / ${evaluation.open_positions}건`],
    ['룰셋', evaluation.ruleset_name ?? evaluation.ruleset_id ?? '연결된 룰셋 없음'],
    ['확인 시각', `${formatKstDateTime(evaluation.created_at)} (GMT+9)`],
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
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
          width: 460,
          maxWidth: 'calc(100vw - 32px)',
          padding: 24,
          border: `1px solid ${t.border}`,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 4 }}>
          챌린지 통과 여부 확인
        </div>
        <div style={{ fontSize: 13, color: t.textSec, marginBottom: 16, fontFamily: "'DM Mono', monospace" }}>
          {accountNumber}
        </div>

        <div
          style={{
            padding: '14px 16px',
            borderRadius: 10,
            background: passed ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)',
            border: `1px solid ${passed ? 'rgba(22,163,74,0.25)' : 'rgba(220,38,38,0.25)'}`,
            color: resultColor,
            fontSize: 15,
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          {passed ? '● 통과' : '✕ 실패'}
        </div>

        <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
          {rows.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
              <span style={{ color: t.textSec, whiteSpace: 'nowrap' }}>{label}</span>
              <span style={{ color: t.text, textAlign: 'right' }}>{value}</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, fontWeight: 600, color: t.textSec, marginBottom: 8 }}>룰별 결과</div>
        {evaluation.rules_applied === 0 ? (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: t.surface2,
              color: t.textSec,
              fontSize: 12,
              lineHeight: 1.6,
              marginBottom: 20,
            }}
          >
            룰셋 판정 로직이 아직 적용되지 않아 확인한 룰이 없습니다. (적용 후 다시 확인하면 룰별 결과가 표시됩니다)
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 6, marginBottom: 20 }}>
            {evaluation.checks.map((check) => (
              <div
                key={check.key}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: t.surface2,
                  fontSize: 12,
                }}
              >
                <span style={{ color: t.text }}>
                  {check.key === 'consistency' ? '일관성 (Consistency)' : check.label}
                  {check.detail ? <span style={{ color: t.textSec }}> : {check.detail}</span> : null}
                </span>
                <span style={{ color: check.passed ? '#16A34A' : '#DC2626', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {check.passed ? '통과' : '위반'}
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 36,
              padding: '0 20px',
              borderRadius: 8,
              border: 'none',
              background: t.surface2,
              color: t.text,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
