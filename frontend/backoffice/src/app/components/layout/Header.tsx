import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, LogOut, Moon, Sun } from "lucide-react";
import { BC } from "../../config/navigation";
import { useLogoutMutation } from "../../queries/auth";
import { useMeQuery } from "../../queries/profile";
import { tok } from "../../theme/tokens";

// 상단 고정 헤더입니다.
// 현재 pageId에 맞는 breadcrumb와 다크 모드 토글을 표시합니다.

export function Header({ pageId, dark, onToggleDark }: { pageId: string; dark: boolean; onToggleDark: () => void }) {
  const t = tok(dark);
  const parts = BC[pageId]?.parts ?? [pageId];
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { data: me } = useMeQuery();
  const logoutMutation = useLogoutMutation();

  const displayName = useMemo(() => {
    const fullName = [me?.first_name, me?.last_name].filter(Boolean).join(' ').trim();
    return fullName || '-';
  }, [me?.first_name, me?.last_name]);
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    try {
      await logoutMutation.mutateAsync();
    } finally {
      window.location.assign('/login');
    }
  };

  return (
    <header style={{ position: "fixed", top: 0, left: 220, right: 0, height: 52, backgroundColor: t.headerBg, borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: 24, paddingRight: 24, zIndex: 30, fontFamily: "'DM Sans','Noto Sans KR',sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {parts.map((p, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: i === parts.length - 1 ? 500 : 400, color: i === parts.length - 1 ? t.text : t.textHint, fontFamily: "'Noto Sans KR',sans-serif" }}>{p}</span>
            {i < parts.length - 1 && <ChevronRight size={12} strokeWidth={2} style={{ color: t.textHint }} />}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onToggleDark} style={{ height: 30, padding: "0 10px", borderRadius: 6, border: `1px solid ${dark ? "rgba(255,255,255,0.13)" : "rgba(0,0,0,0.13)"}`, background: dark ? "rgba(255,255,255,0.04)" : "#F8F9FA", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          {dark ? <Sun size={13} strokeWidth={1.75} style={{ color: t.textHint }} /> : <Moon size={13} strokeWidth={1.75} style={{ color: t.textHint }} />}
          <span style={{ fontSize: 11, color: t.textHint, fontFamily: "'Noto Sans KR',sans-serif", whiteSpace: "nowrap" }}>{dark ? "라이트 모드" : "다크 모드"}</span>
        </button>
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            style={{
              height: 30,
              padding: '0 10px 0 6px',
              borderRadius: 9999,
              border: `1px solid ${dark ? "rgba(255,255,255,0.13)" : "rgba(124,106,247,0.22)"}`,
              background: dark ? "rgba(255,255,255,0.04)" : "#F8F9FA",
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              color: t.text,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#7C6AF7',
                background: 'rgba(124,106,247,0.12)',
                border: '1px solid rgba(124,106,247,0.22)',
                padding: '0 10px',
                height: 22,
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: 9999,
                fontFamily: "'Noto Sans KR',sans-serif",
                whiteSpace: "nowrap",
                maxWidth: 96,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {displayName}
            </span>
          </button>

          {menuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                minWidth: 160,
                padding: 8,
                borderRadius: 12,
                background: t.headerBg,
                border: `1px solid ${t.border}`,
                boxShadow: dark ? '0 12px 28px rgba(0,0,0,0.35)' : '0 12px 28px rgba(15,23,42,0.12)',
                zIndex: 40,
              }}
            >
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                style={{
                  width: '100%',
                  height: 36,
                  padding: '0 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: dark ? 'rgba(255,255,255,0.04)' : '#F8F9FA',
                  color: t.text,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: isLoggingOut ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: "'Noto Sans KR',sans-serif",
                }}
              >
                <LogOut size={14} strokeWidth={2} style={{ color: t.textHint }} />
                {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
