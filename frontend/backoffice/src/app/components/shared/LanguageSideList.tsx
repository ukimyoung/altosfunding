import type { SupportedLanguage } from '../../types/language';

type LanguageState = 'required' | 'filled' | 'empty';

interface LanguageSideListProps {
  dark: boolean;
  languages: SupportedLanguage[];
  selectedCode: string;
  onSelect: (code: string) => void;
  getState?: (language: SupportedLanguage) => LanguageState;
  title?: string;
  disabled?: boolean;
}

export function LanguageSideList({
  dark,
  languages,
  selectedCode,
  onSelect,
  getState,
  title = '언어 선택',
  disabled = false,
}: LanguageSideListProps) {
  const t = {
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    textHint: dark ? '#5A6080' : '#A0A0AA',
    accent: '#7C6AF7',
    accentBg: dark ? 'rgba(124,106,247,0.14)' : 'rgba(124,106,247,0.09)',
    success: '#16A34A',
    successBg: dark ? 'rgba(22,163,74,0.14)' : 'rgba(22,163,74,0.09)',
    emptyBg: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
  };

  const badgeStyle = (state: LanguageState) => {
    if (state === 'required') {
      return { label: '필수', background: t.accentBg, color: t.accent };
    }
    if (state === 'filled') {
      return { label: '입력됨', background: t.successBg, color: t.success };
    }
    return { label: '미입력', background: t.emptyBg, color: t.textHint };
  };

  return (
    <div
      style={{
        width: 210,
        flexShrink: 0,
        borderRight: `1px solid ${t.border}`,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '10px 14px 6px',
          fontSize: 10,
          fontWeight: 700,
          color: t.textHint,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </div>
      {languages.map((language) => {
        const isActive = language.code === selectedCode;
        const state = getState?.(language) ?? (language.required ? 'required' : 'empty');
        const badge = badgeStyle(state);

        return (
          <button
            key={language.code}
            type="button"
            onClick={() => onSelect(language.code)}
            disabled={disabled}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '11px 14px',
              background: isActive
                ? dark
                  ? 'rgba(124,106,247,0.13)'
                  : 'rgba(124,106,247,0.08)'
                : 'transparent',
              borderTop: 'none',
              borderRight: 'none',
              borderBottom: 'none',
              borderLeft: `3px solid ${isActive ? t.accent : 'transparent'}`,
              cursor: disabled ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              opacity: disabled ? 0.72 : 1,
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{language.flag}</span>
            <span
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? t.text : t.textSec,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {language.englishName ?? language.label}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: 99,
                background: badge.background,
                color: badge.color,
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              {badge.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
