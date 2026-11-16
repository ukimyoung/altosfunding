import { useEffect, useState } from "react";
import { ArrowUpRight, ChevronDown, type LucideIcon } from "lucide-react";
import { NAV } from "../../config/navigation";
import { tok, type Tok } from "../../theme/tokens";

// 앱 좌측 고정 사이드바입니다.
// 메뉴 구조는 config/navigation.ts의 NAV 설정을 기준으로 렌더링합니다.

function NavRow({ label, icon: Icon, isActive, expandable, external, isExpanded, t, onClick }: { label: string; icon?: LucideIcon; isActive: boolean; expandable?: boolean; external?: boolean; isExpanded?: boolean; t: Tok; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left", marginBottom: 1, transition: "background 0.1s", background: isActive ? t.accentBg : hov ? t.surface2 : "transparent", color: isActive ? t.accent : t.textHint }}>
      {Icon && <Icon size={16} strokeWidth={isActive ? 2 : 1.75} />}
      <span style={{ flex: 1, fontSize: 12, fontWeight: isActive ? 500 : 400, fontFamily: "'Noto Sans KR','DM Sans',sans-serif", lineHeight: 1.4 }}>{label}</span>
      {external && <ArrowUpRight size={13} strokeWidth={1.75} style={{ opacity: 0.5 }} />}
      {expandable && <ChevronDown size={14} strokeWidth={1.75} style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.18s" }} />}
    </button>
  );
}

function SubRow({ label, isActive, t, onClick }: { label: string; isActive: boolean; t: Tok; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, paddingLeft: 34, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left", marginBottom: 1, transition: "background 0.1s", background: isActive ? t.accentBg : hov ? t.surface2 : "transparent", color: isActive ? t.accent : t.textHint }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", opacity: isActive ? 1 : 0.5, flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: isActive ? 500 : 400, fontFamily: "'Noto Sans KR',sans-serif", lineHeight: 1.4 }}>{label}</span>
    </button>
  );
}

export function Sidebar({ activeId, onSelect, dark }: { activeId: string; onSelect: (id: string) => void; dark: boolean }) {
  const t = tok(dark);
  const productActive = activeId === "challenge-product" || activeId === "funded-product" || activeId === "live-product" || activeId === "demo-product" || activeId === "ruleset-management";
  const accountActive = activeId === "challenge-account" || activeId === "funded-account" || activeId === "live-account" || activeId === "demo-account";
  const systemSettingsActive = activeId === "supported-languages";
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "product-template": productActive,
    "account-mgmt": accountActive,
    "system-settings": systemSettingsActive,
  });
  useEffect(() => {
    if (productActive) {
      setExpanded((p) => ({ ...p, "product-template": true }));
    }
    if (accountActive) {
      setExpanded((p) => ({ ...p, "account-mgmt": true }));
    }
    if (systemSettingsActive) {
      setExpanded((p) => ({ ...p, "system-settings": true }));
    }
  }, [accountActive, productActive, systemSettingsActive]);
  const toggle = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));
  return (
    <aside style={{ width: 220, minHeight: "100vh", backgroundColor: t.sidebarBg, borderRight: `1px solid ${t.border}`, position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 40, display: "flex", flexDirection: "column", overflowY: "auto", scrollbarWidth: "none", fontFamily: "'DM Sans','Noto Sans KR',sans-serif" }}>
      <div style={{ padding: "20px 18px 16px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "#7C6AF7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 16, lineHeight: 1, fontFamily: "'DM Sans',sans-serif" }}>A</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: t.text, lineHeight: 1.3, letterSpacing: "-0.01em" }}>Altos Funding</span>
          <span style={{ fontSize: 10, fontWeight: 400, color: t.textHint, lineHeight: 1.3, fontFamily: "'Noto Sans KR',sans-serif" }}>관리자 콘솔</span>
        </div>
      </div>
      <nav style={{ padding: 10, flex: 1 }}>
        {NAV.map((section, si) => (
          <div key={si} style={{ marginBottom: 2 }}>
            {section.sectionLabel && <div style={{ fontSize: 10, fontWeight: 500, color: t.textHint, letterSpacing: "0.07em", textTransform: "uppercase", padding: "12px 8px 4px", fontFamily: "'DM Sans',sans-serif" }}>{section.sectionLabel}</div>}
            {!section.sectionLabel && si > 0 && <div style={{ height: 1, background: t.border, margin: "8px 0" }} />}
            {section.items.map((item) => {
              const childActive = item.children?.some((c) => c.id === activeId) ?? false;
              const isActive = activeId === item.id || (activeId === "member-detail" && item.id === "member-list");
              const isExp = expanded[item.id];
              return (
                <div key={item.id}>
                  <NavRow label={item.label} icon={item.icon} isActive={isActive || (!item.expandable && childActive)} expandable={item.expandable} external={item.external} isExpanded={isExp} t={t} onClick={() => item.expandable ? toggle(item.id) : onSelect(item.id)} />
                  {item.expandable && isExp && item.children?.map((child) => (
                    <SubRow key={child.id} label={child.label} isActive={activeId === child.id} t={t} onClick={() => onSelect(child.id)} />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
