import type { CSSProperties } from "react";
import { REVENUE_PERIODS } from "../../constants/revenue";
import { DateRangeFilter } from "../shared/TableFilters";
import type { RevenuePeriod, RevenueThemeTokens } from "../../types/revenue";

interface RevenueFilterBarProps {
  query: string;
  setQuery: (value: string) => void;
  from: string;
  setFrom: (value: string) => void;
  to: string;
  setTo: (value: string) => void;
  period: RevenuePeriod | null;
  setPeriod: (value: RevenuePeriod | null) => void;
  onSearch: () => void;
  t: RevenueThemeTokens;
}

export function RevenueFilterBar({
  query,
  setQuery,
  from,
  setFrom,
  to,
  setTo,
  period,
  setPeriod,
  onSearch,
  t,
}: RevenueFilterBarProps) {
  const inputStyle: CSSProperties = {
    height: 36, padding: "0 10px", borderRadius: 8,
    border: `1px solid ${t.border2}`,
    background: t.surface,
    color: t.text, fontSize: 13,
    fontFamily: "'DM Sans','Noto Sans KR',sans-serif",
    outline: "none",
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <input
        value={query} onChange={e => setQuery(e.target.value)}
        onKeyDown={e => e.key === "Enter" && onSearch()}
        placeholder="이름 or 이메일"
        style={{ ...inputStyle, width: 180 }}
      />
      <DateRangeFilter
        startValue={from}
        onStartChange={setFrom}
        endValue={to}
        onEndChange={setTo}
        startMax={to || undefined}
        endMin={from || undefined}
        startWidth={150}
        endWidth={150}
        height={36}
        fontSize={13}
        fontFamily="'DM Sans','Noto Sans KR',sans-serif"
        background={t.surface}
        borderColor={t.border2}
        textColor={t.text}
        separator={<span style={{ color: t.textHint, fontSize: 14 }}>~</span>}
      />
      {REVENUE_PERIODS.map(p => {
        const active = period === p;
        return (
          <button key={p} onClick={() => setPeriod(active ? null : p)} style={{
            height: 36, padding: "0 14px", borderRadius: 8, cursor: "pointer",
            border: `1px solid ${active ? "transparent" : t.border2}`,
            background: active ? "#7C6AF7" : "transparent",
            color: active ? "#fff" : t.textSec,
            fontSize: 13, fontWeight: 500,
            fontFamily: "'DM Sans','Noto Sans KR',sans-serif",
            transition: "all 0.15s",
          }}>{p}</button>
        );
      })}
      <button onClick={onSearch} style={{
        height: 36, padding: "0 18px", borderRadius: 8, border: "none",
        background: "#7C6AF7", color: "#fff", cursor: "pointer",
        fontSize: 13, fontWeight: 600,
        fontFamily: "'DM Sans','Noto Sans KR',sans-serif",
      }}>조회</button>
    </div>
  );
}
