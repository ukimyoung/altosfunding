import { useState, type CSSProperties } from "react";
import type { DashboardTrendParams, DashboardTrendPeriod, DashboardTrends } from "@/api/dashboard";
import { useDashboardTrendsQuery } from "../../queries/dashboard";
import type { Tok } from "../../theme/tokens";
import { DateRangeFilter } from "../shared/TableFilters";
import { DashboardLineChart, type LineSeries } from "./DashboardLineChart";

// 추이 차트 카드. 컨트롤 순서: [날짜 From ~ To] [일별] [주별] [월별] [검색].
// 구간·주기를 고른 뒤 '검색'을 눌러야 결과가 바뀐다. 기본값은 날짜 미선택 = 최근 7일(일별).

export const PRODUCT_COLORS = ["#6436ea", "#00b894", "#2563eb", "#D97706", "#DC2626", "#0891B2", "#DB2777"];

const PERIODS: { key: DashboardTrendPeriod; label: string; recent: string }[] = [
  { key: "daily", label: "일별", recent: "최근 7일" },
  { key: "weekly", label: "주별", recent: "최근 8주" },
  { key: "monthly", label: "월별", recent: "최근 6개월" },
];

export function formatBucketLabel(label: string, period: DashboardTrendPeriod): string {
  if (period === "monthly") {
    const [y, m] = label.split("-");
    return `${y.slice(2)}.${m}`;
  }
  const [, m, d] = label.split("-");
  return period === "weekly" ? `${Number(m)}/${Number(d)}~` : `${Number(m)}/${Number(d)}`;
}

interface Props {
  title: string;
  metric: DashboardTrendParams["metric"];
  /** 응답에서 차트에 그릴 계열을 고른다 */
  pick: (data: DashboardTrends) => { labels: string[]; series: LineSeries[] } | null;
  /** 제목 아래 설명 뒤에 붙는 문구 (예: "챌린지 매출") */
  caption: string;
  formatAxis: (v: number) => string;
  formatValue: (v: number) => string;
  area?: boolean;
  pointLabels?: boolean;
  legend?: boolean;
  emptyText: string;
  integer?: boolean;
  t: Tok;
}

export function DashboardTrendCard({
  title, metric, pick, caption, formatAxis, formatValue, area, pointLabels, legend, emptyText, integer, t,
}: Props) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [period, setPeriod] = useState<DashboardTrendPeriod>("daily");
  const [applied, setApplied] = useState<DashboardTrendParams>({ metric, period: "daily" });

  const query = useDashboardTrendsQuery(applied);
  const data = query.data;
  const picked = data ? pick(data) : null;
  const periodInfo = PERIODS.find((p) => p.key === applied.period) ?? PERIODS[0];
  const rangeText = applied.start_date || applied.end_date
    ? `${data?.start_date ?? applied.start_date ?? ""} ~ ${data?.end_date ?? applied.end_date ?? ""}`
    : periodInfo.recent;

  const onSearch = () => setApplied({ metric, period, start_date: from || null, end_date: to || null });

  const card: CSSProperties = {
    background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 12, padding: "20px 20px 16px",
  };
  const font = "'DM Sans','Noto Sans KR',sans-serif";

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{title}</div>
          <div style={{ fontSize: 11, color: t.textSec, marginTop: 3, fontFamily: "'Noto Sans KR',sans-serif" }}>
            {rangeText} · {periodInfo.label} · {caption}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <DateRangeFilter
            startValue={from}
            onStartChange={setFrom}
            endValue={to}
            onEndChange={setTo}
            startMax={to || undefined}
            endMin={from || undefined}
            startWidth={136}
            endWidth={136}
            height={32}
            fontSize={12}
            fontFamily={font}
            background={t.surface}
            borderColor={t.border2}
            textColor={t.text}
            separator={<span style={{ color: t.textHint, fontSize: 13 }}>~</span>}
          />
          <div style={{ display: "flex", background: t.surface2, borderRadius: 8, padding: 3, gap: 2 }}>
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                style={{
                  height: 26, padding: "0 12px", borderRadius: 6, border: "none", cursor: "pointer",
                  background: period === p.key ? "#7C6AF7" : "transparent",
                  color: period === p.key ? "#fff" : t.textSec,
                  fontSize: 12, fontWeight: 600, fontFamily: "'Noto Sans KR',sans-serif", transition: "all 0.15s",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={onSearch}
            style={{
              height: 32, padding: "0 16px", borderRadius: 8, border: "none", background: "#7C6AF7", color: "#fff",
              cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: font,
            }}
          >
            검색
          </button>
        </div>
      </div>

      {legend && picked && picked.series.length > 0 && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 4 }}>
          {picked.series.map((s) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.color }} />
              <span style={{ fontSize: 11, color: t.textSec, fontFamily: font }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {query.isError ? (
        <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#DC2626", fontFamily: "'Noto Sans KR',sans-serif" }}>
          데이터를 불러오지 못했습니다. 날짜 구간을 확인해 주세요.
        </div>
      ) : picked ? (
        <DashboardLineChart
          labels={picked.labels.map((l) => formatBucketLabel(l, data?.period ?? "daily"))}
          series={picked.series}
          t={t}
          formatAxis={formatAxis}
          formatValue={formatValue}
          area={area}
          pointLabels={pointLabels}
          emptyText={emptyText}
          integer={integer}
        />
      ) : (
        <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: t.textHint }}>
          불러오는 중…
        </div>
      )}
    </div>
  );
}
