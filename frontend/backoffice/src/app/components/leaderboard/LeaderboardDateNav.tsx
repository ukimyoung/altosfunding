import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useActiveChallengeDatesQuery } from '../../queries/challenges';
import { LeaderboardStatus } from '../../types/leaderboard';
import { STATUS_CONFIG } from '../../constants/leaderboard';

interface LeaderboardDateNavProps {
  dark: boolean;
  currentDate: string;
  status: LeaderboardStatus | null;
  participantCount: number;
  onDateChange: (date: string) => void;
  onInvalidDateSelect?: (date: string) => void;
  // onEndCompetition: () => void;
}

export function LeaderboardDateNav({
  dark,
  currentDate,
  status,
  participantCount,
  onDateChange,
  onInvalidDateSelect,
  // onEndCompetition,
}: LeaderboardDateNavProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const { data: activeDates = [] } = useActiveChallengeDatesQuery();

  const t = {
    surface: dark ? '#0F1829' : '#ffffff',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    textHint: dark ? '#5A6080' : '#A0A0AA',
  };

  const toInputDate = (value: string) => {
    if (!value) return '';
    if (value.includes('-')) return value;
    if (value.length !== 8) return value;
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  };

  const toApiDate = (value: string) => value.replace(/-/g, '');

  const normalizedActiveDates = useMemo(
    () => activeDates.map(toInputDate).filter(Boolean),
    [activeDates],
  );

  const statusCfg = status ? STATUS_CONFIG[status] : null;
  const activeDateSet = useMemo(() => new Set(normalizedActiveDates), [normalizedActiveDates]);
  const currentIndex = normalizedActiveDates.indexOf(currentDate);
  const latestDate = normalizedActiveDates[0];
  const oldestDate = normalizedActiveDates[normalizedActiveDates.length - 1];
  const canGoPrev = currentIndex >= 0 && currentIndex < normalizedActiveDates.length - 1;
  const canGoNext = currentIndex > 0;

  useEffect(() => {
    if (normalizedActiveDates.length === 0) {
      return;
    }

    if (!activeDateSet.has(currentDate) && latestDate) {
      onDateChange(latestDate);
    }
  }, [activeDateSet, currentDate, latestDate, normalizedActiveDates.length, onDateChange]);

  const goPrev = () => {
    if (!canGoPrev) return;
    onDateChange(normalizedActiveDates[currentIndex + 1]);
  };

  const goNext = () => {
    if (!canGoNext) return;
    onDateChange(normalizedActiveDates[currentIndex - 1]);
  };

  const openPicker = () => {
    const input = dateInputRef.current;
    if (!input) return;

    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        background: t.surface,
        borderBottom: `1px solid ${t.border}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Prev Day */}
        <button
          onClick={goPrev}
          disabled={!canGoPrev}
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            border: `1px solid ${t.border}`,
            background: 'transparent',
            color: canGoPrev ? t.text : t.textHint,
            cursor: canGoPrev ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: canGoPrev ? 1 : 0.5,
          }}
        >
          <ChevronLeft size={16} />
        </button>

        {/* Date Input */}
        <div style={{ position: 'relative' }} onClick={openPicker}>
          <input
            ref={dateInputRef}
            type="date"
            value={currentDate}
            min={oldestDate}
            max={latestDate}
            onChange={(e) => {
              const nextDate = e.target.value;
              if (!nextDate) {
                return;
              }

              if (activeDateSet.size > 0 && !activeDateSet.has(nextDate)) {
                onInvalidDateSelect?.(nextDate);
                return;
              }

              onDateChange(toInputDate(toApiDate(nextDate)));
            }}
            style={{
              height: 32,
              padding: '0 12px 0 12px',
              paddingRight: 32,
              borderRadius: 6,
              border: `1px solid ${t.border}`,
              background: t.surface,
              color: t.text,
              fontSize: 13,
              fontFamily: "'DM Mono', monospace",
              fontWeight: 500,
              cursor: 'pointer',
            }}
          />
        </div>

        {/* Next Day */}
        <button
          onClick={goNext}
          disabled={!canGoNext}
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            border: `1px solid ${t.border}`,
            background: 'transparent',
            color: canGoNext ? t.text : t.textHint,
            cursor: canGoNext ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: canGoNext ? 1 : 0.5,
          }}
        >
          <ChevronRight size={16} />
        </button>

        {/* Status Badge */}
        {statusCfg ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 12px',
              borderRadius: 9999,
              fontSize: 11,
              fontWeight: 600,
              background: statusCfg.bg,
              color: statusCfg.color,
              border: `1px solid ${statusCfg.border}`,
            }}
          >
            {statusCfg.icon} {statusCfg.label}
          </span>
        ) : null}

        {/* Participant Count */}
        {/* <span style={{ fontSize: 13, color: t.textHint }}>{participantCount}명 참여</span> */}
      </div>

      {/* End Competition Button */}
      {/*
      <button
        onClick={onEndCompetition}
        style={{
          height: 32,
          padding: '0 16px',
          borderRadius: 6,
          border: '1px solid #DC2626',
          background: 'transparent',
          color: '#DC2626',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        🛑 대회 종료
      </button>
      */}
    </div>
  );
}
