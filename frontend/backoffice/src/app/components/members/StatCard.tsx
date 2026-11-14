import type * as React from "react";
import type { ReactNode } from "react";
import type { Tok } from "../../theme/tokens";

export function StatCard({ t, label, children }: { t: Tok; label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: t.textHint, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'DM Sans','Noto Sans KR',sans-serif" }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column" }}>{children}</div>
    </div>
  );
}
