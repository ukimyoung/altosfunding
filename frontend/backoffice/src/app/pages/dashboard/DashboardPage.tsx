import { useState, type CSSProperties, type ElementType, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  Activity, AlertTriangle, ArrowDownCircle, ArrowUpCircle, BadgeCheck, CalendarClock, CheckCircle2, Clock, Gift,
  Landmark, MessageCircle, PlayCircle, Server, Tag, TrendingDown, TrendingUp, Trophy, Users, Wallet, XCircle,
} from "lucide-react";
import type { DashboardCompetition, DashboardRange, DashboardRevenueValue, DashboardSeries } from "@/api/dashboard";
import { DashboardBarChart } from "../../components/dashboard/DashboardBarChart";
import { DashboardTrendCard, PRODUCT_COLORS, formatBucketLabel } from "../../components/dashboard/DashboardTrendCard";
import { ROUTE_BY_PAGE_ID } from "../../config/navigation";
import { useAppShell } from "../../layouts/AppShell";
import { useDashboardSummaryQuery, useDashboardTrendsQuery } from "../../queries/dashboard";
import { tok, type Tok } from "../../theme/tokens";

// 백오피스 첫 화면. 구성: 시스템 상태 → 오늘 처리할 액션 → 핵심 매출 지표 → 매출 추이 → 대회 현황 → 계좌 생성 수 추이
// → 회원·계좌 지표 → 자금 흐름(전체 입금액·출금액, 입금액·출금액 추이).
// 기간 전환(오늘·어제·이번 주·이번 달)은 매출 지표와 '종료 대회'에 적용되고, 액션·시스템·모집/진행 대회는 항상 지금 값이다.
// 날짜는 모두 한국 시간(GMT+9).

const RANGES: { key: DashboardRange; label: string; compare: string }[] = [
  { key: "today", label: "오늘", compare: "전일 대비" },
  { key: "yesterday", label: "어제", compare: "전일 대비" },
  { key: "this_week", label: "이번 주", compare: "지난주 대비" },
  { key: "this_month", label: "이번 달", compare: "지난달 대비" },
];

const MONO = "'DM Mono',monospace";
const KR = "'Noto Sans KR',sans-serif";

const fmtMoney = (v: number | null | undefined) =>
  v == null ? "-" : `$${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const fmtMoneyAxis = (v: number) =>
  v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `$${Math.round(v)}`;
const fmtCount = (v: number) => v.toLocaleString("en-US");
const fmtCountAxis = (v: number) => (Number.isInteger(v) ? v.toLocaleString("en-US") : v.toFixed(1));

function fmtKst(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

function productSeries(s: DashboardSeries | undefined) {
  if (!s) return null;
  return {
    labels: s.labels,
    series: s.products.map((p, i) => ({
      label: p.label.replace(/^Challenge\s+/i, "").replace(/^Funded\s+/i, ""),
      color: PRODUCT_COLORS[i % PRODUCT_COLORS.length],
      values: p.values,
    })),
  };
}

// ─── 작은 조각들 ─────────────────────────────────────────────────────────────

function SectionTitle({ label, sub, right, t }: { label: string; sub?: string; right?: ReactNode; t: Tok }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 3, height: 15, borderRadius: 2, background: "#7C6AF7", flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: t.text, fontFamily: "'DM Sans','Noto Sans KR',sans-serif" }}>
          {label} {sub && <span style={{ color: t.textSec, fontWeight: 500 }}>({sub})</span>}
        </span>
      </div>
      {right}
    </div>
  );
}

function Delta({ value, compare, onHero, t }: { value: DashboardRevenueValue; compare: string; onHero?: boolean; t: Tok }) {
  const pct = value.change_pct;
  const muted = onHero ? "rgba(255,255,255,0.7)" : t.textHint;
  if (pct == null) {
    return (
      <div style={{ fontSize: 11, color: muted, marginTop: 6, fontFamily: KR }}>
        {compare} - <span style={{ fontFamily: MONO }}>(이전 {fmtMoney(value.prev_amount)})</span>
      </div>
    );
  }
  const up = pct >= 0;
  const color = onHero ? "#fff" : up ? "#16A34A" : "#DC2626";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 6 }}>
      {up ? <TrendingUp size={12} color={color} /> : <TrendingDown size={12} color={color} />}
      <span style={{ fontSize: 11, fontWeight: 600, color, fontFamily: MONO }}>{up ? "+" : ""}{pct}%</span>
      <span style={{ fontSize: 11, color: muted, fontFamily: KR }}>{compare}</span>
    </div>
  );
}

function ReadyBadge({ t }: { t: Tok }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color: t.textSec, background: t.surface2, border: `1px solid ${t.border2}`, borderRadius: 999, padding: "2px 8px", fontFamily: KR }}>
      준비 중
    </span>
  );
}

function ActionCard({
  Icon, count, label, sub, iconBg, iconColor, onClick, disabled, t,
}: {
  Icon: ElementType; count: number | null; label: string; sub?: string; iconBg: string; iconColor: string;
  onClick?: () => void; disabled?: boolean; t: Tok;
}) {
  const [hov, setHov] = useState(false);
  const clickable = !!onClick && !disabled;
  const highlight = count != null && count > 0;
  return (
    <div
      onClick={clickable ? onClick : undefined}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: t.surface, borderRadius: 12, padding: "16px 18px", cursor: clickable ? "pointer" : "default",
        border: hov && clickable ? "1px solid #7C6AF7" : `1px solid ${t.border2}`, transition: "border-color 0.15s",
        display: "flex", alignItems: "center", gap: 14, opacity: disabled ? 0.65 : 1,
      }}
    >
      <div style={{ width: 42, height: 42, borderRadius: 12, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={20} color={iconColor} />
      </div>
      <div style={{ minWidth: 0 }}>
        {disabled ? (
          <div style={{ marginBottom: 4 }}><ReadyBadge t={t} /></div>
        ) : (
          <div style={{ fontSize: 22, fontWeight: 800, color: highlight ? t.text : t.textHint, fontFamily: MONO, lineHeight: 1.1 }}>
            {count == null ? "-" : fmtCount(count)}
          </div>
        )}
        <div style={{ fontSize: 12, color: t.textSec, marginTop: 3, fontFamily: KR }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: "#D97706", marginTop: 2, fontFamily: MONO }}>{sub}</div>}
      </div>
    </div>
  );
}

function SystemPill({ ok, warn, label, value, t }: { ok: boolean; warn?: boolean; label: string; value: string; t: Tok }) {
  const color = ok ? "#16A34A" : warn ? "#D97706" : "#DC2626";
  const bg = ok ? "rgba(22,163,74,0.10)" : warn ? "rgba(217,119,6,0.12)" : "rgba(220,38,38,0.10)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: bg, border: `1px solid ${color}33` }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
      <span style={{ fontSize: 12, color: t.textSec, fontFamily: KR }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: "'DM Sans','Noto Sans KR',sans-serif" }}>{value}</span>
    </div>
  );
}

function CompetitionStat({
  Icon, label, value, sub, color, onClick, t,
}: { Icon: ElementType; label: string; value: string; sub: string; color: string; onClick?: () => void; t: Tok }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: t.surface, borderRadius: 12, padding: "16px 18px", cursor: onClick ? "pointer" : "default",
        border: hov && onClick ? "1px solid #7C6AF7" : `1px solid ${t.border2}`, transition: "border-color 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <Icon size={14} color={color} />
        <span style={{ fontSize: 11, fontWeight: 600, color: t.textSec, fontFamily: KR }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: t.text, fontFamily: MONO }}>{value}</div>
      <div style={{ fontSize: 11, color: t.textHint, marginTop: 4, fontFamily: KR }}>{sub}</div>
    </div>
  );
}

function CompetitionTable({
  title, rows, mode, empty, onRow, t,
}: { title: string; rows: DashboardCompetition[]; mode: "recruiting" | "active"; empty: string; onRow: () => void; t: Tok }) {
  const th: CSSProperties = {
    padding: "8px 14px", fontSize: 10, fontWeight: 700, color: t.textSec, textAlign: "left", background: t.surface2,
    whiteSpace: "nowrap", borderBottom: `1px solid ${t.border2}`, letterSpacing: "0.04em", fontFamily: KR,
  };
  const td: CSSProperties = { padding: "10px 14px", fontSize: 12, color: t.text, borderBottom: `1px solid ${t.border}`, fontFamily: KR };
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${t.border}`, fontSize: 13, fontWeight: 700, color: t.text, fontFamily: KR }}>
        {title} <span style={{ color: t.textHint, fontWeight: 500, fontFamily: MONO }}>{rows.length}</span>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>상품</th>
            <th style={th}>대회</th>
            <th style={{ ...th, textAlign: "right" }}>참가 계좌</th>
            <th style={{ ...th, textAlign: "right" }}>{mode === "recruiting" ? "시작 (GMT+9)" : "종료 예정 (GMT+9)"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={4} style={{ ...td, textAlign: "center", color: t.textHint, borderBottom: "none" }}>{empty}</td></tr>
          ) : rows.map((r, i) => (
            <tr
              key={r.challenge_id}
              onClick={onRow}
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = t.surface2)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <td style={{ ...td, fontWeight: 600, borderBottom: i < rows.length - 1 ? td.borderBottom : "none" }}>
                {r.product_name.replace(/^Challenge\s+/i, "")}
              </td>
              <td style={{ ...td, color: t.textSec, borderBottom: i < rows.length - 1 ? td.borderBottom : "none" }}>{r.name}</td>
              <td style={{ ...td, textAlign: "right", fontFamily: MONO, borderBottom: i < rows.length - 1 ? td.borderBottom : "none" }}>
                {fmtCount(r.participants)}{r.group_size ? <span style={{ color: t.textHint }}> / {r.group_size}</span> : null}
              </td>
              <td style={{ ...td, textAlign: "right", fontFamily: MONO, color: t.textSec, borderBottom: i < rows.length - 1 ? td.borderBottom : "none" }}>
                {fmtKst(mode === "recruiting" ? r.start_at : r.end_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChangeBadge({ pct, compare, t }: { pct: number | null; compare: string; t: Tok }) {
  if (pct == null) return <span style={{ fontSize: 10, color: t.textHint, fontFamily: KR }}>{compare} -</span>;
  const up = pct >= 0;
  const color = up ? "#16A34A" : "#DC2626";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      {up ? <TrendingUp size={11} color={color} /> : <TrendingDown size={11} color={color} />}
      <span style={{ fontSize: 11, fontWeight: 600, color, fontFamily: MONO }}>{up ? "+" : ""}{pct}%</span>
      <span style={{ fontSize: 10, color: t.textHint, fontFamily: KR }}>{compare}</span>
    </span>
  );
}

function MetricRow({
  Icon, label, value, extra, sub, t,
}: { Icon: ElementType; label: string; value: string; extra?: ReactNode; sub?: string; t: Tok }) {
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: t.accentBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={17} color="#7C6AF7" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: t.textSec, marginBottom: 2, fontFamily: KR }}>{label}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: t.text, fontFamily: MONO }}>{value}</span>
          {extra}
        </div>
        {sub && <div style={{ fontSize: 11, color: t.textHint, marginTop: 2, fontFamily: KR }}>{sub}</div>}
      </div>
    </div>
  );
}

function FundCard({ Icon, label, amount, color, bg, t }: { Icon: ElementType; label: string; amount: number | undefined; color: string; bg: string; t: Tok }) {
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 12, padding: "18px 20px", display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={22} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: t.textSec, marginBottom: 6, fontFamily: KR }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 800, color, fontFamily: MONO }}>{fmtMoney(amount)}</div>
        <div style={{ fontSize: 11, color: t.textHint, marginTop: 4, fontFamily: KR }}>승인 완료 누적 · 출금은 수수료 포함 신청 금액</div>
      </div>
    </div>
  );
}

// ─── 페이지 ─────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { dark } = useAppShell();
  const t = tok(dark);
  const navigate = useNavigate();
  const [range, setRange] = useState<DashboardRange>("today");
  const { data, isError, isFetching } = useDashboardSummaryQuery(range);
  const rangeInfo = RANGES.find((r) => r.key === range) ?? RANGES[0];
  const go = (pageId: string) => navigate(ROUTE_BY_PAGE_ID[pageId]);

  const card: CSSProperties = { background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 12 };
  const sys = data?.system;
  const actions = data?.actions;
  const revenue = data?.revenue;
  const comp = data?.competitions;
  const members = data?.members;
  const accounts = data?.accounts;
  const funds = data?.funds;
  // 최근 7일 신규 가입 막대 차트 (기간 전환과 상관없이 오늘까지 7일)
  const signupTrend = useDashboardTrendsQuery({ metric: "signups", period: "daily" }).data?.signups;
  const periodText = data
    ? data.start_date === data.end_date ? data.start_date : `${data.start_date} ~ ${data.end_date}`
    : "";

  const mt4Pill = (server: "DEMO" | "LIVE", label: string) => {
    const v = sys?.mt4?.[server];
    if (!v) return <SystemPill key={server} ok={false} warn label={label} value="확인 전" t={t} />;
    if (v === "미설정") return <SystemPill key={server} ok={false} warn label={label} value="미설정" t={t} />;
    return <SystemPill key={server} ok={v === "OK"} label={label} value={v === "OK" ? "정상" : v} t={t} />;
  };

  return (
    <div style={{ padding: "24px 28px 48px", background: t.pageBg, minHeight: "100vh", fontFamily: "'DM Sans','Noto Sans KR',sans-serif" }}>
      {/* ── 헤더 + 기간 전환 ── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, margin: 0 }}>대시보드</h1>
          <p style={{ fontSize: 13, color: t.textSec, margin: "4px 0 0", fontFamily: KR }}>
            Altos Funding 운영 및 매출 현황 요약 · {rangeInfo.label} 기준
            {periodText && <span style={{ fontFamily: MONO, color: t.textHint }}> ({periodText}, GMT+9)</span>}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {data && (
            <span style={{ fontSize: 11, color: t.textHint, fontFamily: KR }}>
              {isFetching ? "갱신 중…" : `${fmtKst(data.generated_at)} 기준 · 1분마다 자동 갱신`}
            </span>
          )}
          <div style={{ display: "flex", background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 10, padding: 3, gap: 2 }}>
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                style={{
                  height: 30, padding: "0 14px", borderRadius: 7, border: "none", cursor: "pointer",
                  background: range === r.key ? "#7C6AF7" : "transparent", color: range === r.key ? "#fff" : t.textSec,
                  fontSize: 12, fontWeight: 600, fontFamily: KR, transition: "all 0.15s",
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isError && (
        <div style={{ ...card, padding: "14px 18px", marginBottom: 16, color: "#DC2626", fontSize: 13, fontFamily: KR }}>
          대시보드 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </div>
      )}

      {/* ── 시스템 상태 ── */}
      <div style={{ ...card, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 4 }}>
          <Server size={14} color={t.textSec} />
          <span style={{ fontSize: 12, fontWeight: 700, color: t.text, fontFamily: KR }}>시스템 상태</span>
        </div>
        <SystemPill ok={!!sys?.worker_alive} label="Worker" value={sys ? (sys.worker_alive ? "정상" : "응답 없음") : "-"} t={t} />
        {mt4Pill("DEMO", "MT4 챌린지(Demo)")}
        {mt4Pill("LIVE", "MT4 펀디드(Live)")}
        <SystemPill ok={(sys?.failed_jobs ?? 0) === 0} label="실패한 작업" value={`${sys?.failed_jobs ?? 0}건`} t={t} />
        <SystemPill ok warn={(sys?.provisioning_accounts ?? 0) > 0} label="계좌 발급 중" value={`${sys?.provisioning_accounts ?? 0}건`} t={t} />
      </div>

      {/* ── 오늘 처리할 액션 ── */}
      <SectionTitle label="오늘 처리할 액션" sub="지금 기준" t={t} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 24 }}>
        <ActionCard Icon={Clock} count={actions?.withdraw_pending_count ?? null} label="출금 승인 대기"
          sub={actions && actions.withdraw_pending_count > 0 ? fmtMoney(actions.withdraw_pending_amount) : undefined}
          iconBg="rgba(217,119,6,0.15)" iconColor="#D97706" onClick={() => go("transaction-approval")} t={t} />
        <ActionCard Icon={Wallet} count={actions?.deposit_pending_count ?? null} label="입금 승인 대기"
          iconBg="rgba(22,163,74,0.12)" iconColor="#16A34A" onClick={() => go("transaction-approval")} t={t} />
        <ActionCard Icon={MessageCircle} count={actions?.contacts_unanswered ?? null} label="1:1 문의 미답변"
          iconBg="rgba(220,38,38,0.12)" iconColor="#DC2626" onClick={() => go("inquiry")} t={t} />
        <ActionCard Icon={BadgeCheck} count={actions?.kyc_pending ?? null} label="KYC 승인 대기"
          iconBg="rgba(37,99,235,0.12)" iconColor="#2563EB" onClick={() => go("member-list")} t={t} />
        <ActionCard Icon={Gift} count={actions?.rewards_pending_count ?? null} label="리워드 승인 대기"
          iconBg="rgba(124,106,247,0.14)" iconColor="#7C6AF7" onClick={() => go("reward-referral")} t={t} />
        <ActionCard Icon={AlertTriangle} count={actions?.rule_violations_open ?? null} label="미처리 룰 위반"
          iconBg="rgba(220,38,38,0.12)" iconColor="#DC2626" onClick={() => go("violations")} t={t} />
        <ActionCard Icon={Tag} count={null} label="쿠폰 소진 임박" disabled
          iconBg="rgba(22,163,74,0.12)" iconColor="#16A34A" t={t} />
      </div>

      {/* ── 핵심 매출 지표 ── */}
      <SectionTitle
        label="핵심 매출 지표" sub={rangeInfo.label} t={t}
        right={
          <button onClick={() => go("revenue")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#7C6AF7", fontWeight: 600, fontFamily: KR, padding: 0 }}>
            매출 현황 자세히 보기 →
          </button>
        }
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 24 }}>
        <div style={{ ...card, padding: "18px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.textSec, marginBottom: 8, fontFamily: KR }}>챌린지 매출</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: t.text, fontFamily: MONO }}>{fmtMoney(revenue?.challenge.amount)}</div>
          {revenue && <Delta value={revenue.challenge} compare={rangeInfo.compare} t={t} />}
        </div>
        <div style={{ ...card, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: t.textSec, fontFamily: KR }}>펀디드 정산(회사)</span>
            <ReadyBadge t={t} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: t.textHint, fontFamily: MONO }}>-</div>
          <div style={{ fontSize: 11, color: t.textHint, marginTop: 6, fontFamily: KR }}>펀디드 수익 출금·분배 기능 이후 집계됩니다</div>
        </div>
        <div style={{ background: "linear-gradient(135deg, #7C6AF7 0%, #5B4EE0 100%)", borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.75)", marginBottom: 8, fontFamily: KR }}>합산 총 매출</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", fontFamily: MONO }}>{fmtMoney(revenue?.total.amount)}</div>
          {revenue && <Delta value={revenue.total} compare={rangeInfo.compare} onHero t={t} />}
        </div>
      </div>

      {/* ── 매출 추이 ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
        <DashboardTrendCard
          title="총매출 추이" metric="revenue" caption="챌린지 + 펀디드 합산 매출 (펀디드 준비 중)"
          pick={(d) => d.revenue ? { labels: d.revenue.labels, series: [{ label: "총매출", color: "#7C6AF7", values: d.revenue.totals }] } : null}
          formatAxis={fmtMoneyAxis} formatValue={fmtMoney} area pointLabels emptyText="이 구간에는 매출이 없습니다" t={t}
        />
        <DashboardTrendCard
          title="상품별 매출 추이" metric="revenue" caption="챌린지 상품별 매출"
          pick={(d) => productSeries(d.revenue)}
          formatAxis={fmtMoneyAxis} formatValue={fmtMoney} legend emptyText="이 구간에는 매출이 없습니다" t={t}
        />
      </div>

      {/* ── 대회 현황 ── */}
      <SectionTitle label="대회 현황" t={t} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 12 }}>
        <CompetitionStat Icon={CalendarClock} color="#2563EB" label="모집 중 대회"
          value={comp ? `${comp.recruiting.length}개` : "-"}
          sub={comp ? `참가 계좌 ${fmtCount(comp.recruiting_participants)}` : ""} onClick={() => go("competition-list")} t={t} />
        <CompetitionStat Icon={PlayCircle} color="#16A34A" label="진행 중 대회"
          value={comp ? `${comp.active.length}개` : "-"}
          sub={comp ? `참가 계좌 ${fmtCount(comp.active_participants)}` : ""} onClick={() => go("competition-list")} t={t} />
        <CompetitionStat Icon={Trophy} color="#D97706" label={`${rangeInfo.label} 종료 대회`}
          value={comp ? `${comp.ended.competitions}개` : "-"}
          sub={comp ? `참가 ${fmtCount(comp.ended.participants)} · 합격 ${fmtCount(comp.ended.passed)} · 탈락 ${fmtCount(comp.ended.failed)}` : ""}
          onClick={() => go("leaderboard")} t={t} />
        <CompetitionStat Icon={comp?.pass_rate.rate != null ? CheckCircle2 : XCircle} color="#7C6AF7"
          label={`최근 ${comp?.pass_rate.days ?? 30}일 합격률`}
          value={comp?.pass_rate.rate != null ? `${comp.pass_rate.rate}%` : "-"}
          sub={comp ? `합격 ${fmtCount(comp.pass_rate.passed)} · 탈락 ${fmtCount(comp.pass_rate.failed)}` : ""} t={t} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginBottom: 16 }}>
        <CompetitionTable title="모집 중 대회" mode="recruiting" rows={comp?.recruiting ?? []}
          empty="모집 중인 대회가 없습니다" onRow={() => go("competition-list")} t={t} />
        <CompetitionTable title="진행 중 대회" mode="active" rows={comp?.active ?? []}
          empty="진행 중인 대회가 없습니다" onRow={() => go("competition-list")} t={t} />
      </div>

      {/* ── 계좌 생성 수 추이 ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <DashboardTrendCard
          title="챌린지 계좌 생성 수 추이" metric="accounts" caption="상품별 발급 계좌 수"
          pick={(d) => productSeries(d.challenge)}
          formatAxis={fmtCountAxis} formatValue={(v) => `${fmtCount(v)}개`} legend integer emptyText="이 구간에 생성된 계좌가 없습니다" t={t}
        />
        <DashboardTrendCard
          title="펀디드 계좌 생성 수 추이" metric="accounts" caption="상품별 발급 계좌 수"
          pick={(d) => productSeries(d.funded)}
          formatAxis={fmtCountAxis} formatValue={(v) => `${fmtCount(v)}개`} legend integer emptyText="이 구간에 생성된 계좌가 없습니다" t={t}
        />
      </div>

      {/* ── 회원 · 계좌 지표 ── */}
      <div style={{ marginTop: 24 }}>
        <SectionTitle label="회원 · 계좌 지표" sub={rangeInfo.label} t={t} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 14, marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          <MetricRow Icon={Users} label="누적 가입자" value={members ? fmtCount(members.total_users) : "-"}
            extra={members && <ChangeBadge pct={members.total_change_pct} compare={rangeInfo.compare} t={t} />} t={t} />
          <MetricRow Icon={Activity} label={`${rangeInfo.label} 신규 가입자`} value={members ? fmtCount(members.new_signups) : "-"}
            extra={members && <ChangeBadge pct={members.new_signups_change_pct} compare={rangeInfo.compare} t={t} />} t={t} />
          <MetricRow Icon={TrendingUp} label="진행 중 챌린지 계좌" value={accounts ? fmtCount(accounts.challenge_active) : "-"}
            sub={accounts ? `${rangeInfo.label} 발급 ${fmtCount(accounts.challenge_issued)}개` : undefined}
            extra={accounts && <ChangeBadge pct={accounts.challenge_issued_change_pct} compare={`발급 ${rangeInfo.compare}`} t={t} />} t={t} />
          <MetricRow Icon={Landmark} label="펀디드 활성 계좌" value={accounts ? fmtCount(accounts.funded_active) : "-"}
            sub={accounts ? `${rangeInfo.label} 발급 ${fmtCount(accounts.funded_issued)}개 · 거래 정지 중 ${fmtCount(accounts.funded_halted)}개` : undefined}
            extra={accounts && <ChangeBadge pct={accounts.funded_issued_change_pct} compare={`발급 ${rangeInfo.compare}`} t={t} />} t={t} />
        </div>
        <div style={{ ...card, padding: "18px 18px 10px" }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>최근 7일 신규 가입 추이</div>
            <div style={{ fontSize: 11, color: t.textSec, marginTop: 2, fontFamily: KR }}>일별 신규 가입자 수 (GMT+9)</div>
          </div>
          {signupTrend ? (
            <DashboardBarChart labels={signupTrend.labels.map((l) => formatBucketLabel(l, "daily"))} values={signupTrend.totals} t={t} />
          ) : (
            <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: t.textHint }}>불러오는 중…</div>
          )}
        </div>
      </div>

      {/* ── 자금 흐름 ── */}
      <SectionTitle label="자금 흐름" t={t}
        right={
          <button onClick={() => go("transaction-history")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#7C6AF7", fontWeight: 600, fontFamily: KR, padding: 0 }}>
            입출금 내역 보기 →
          </button>
        }
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginBottom: 16 }}>
        <FundCard Icon={ArrowDownCircle} label="전체 입금액" amount={funds?.total_deposit_amount} color="#16A34A" bg="rgba(22,163,74,0.12)" t={t} />
        <FundCard Icon={ArrowUpCircle} label="전체 출금액" amount={funds?.total_withdraw_amount} color="#D97706" bg="rgba(217,119,6,0.14)" t={t} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <DashboardTrendCard
          title="입금액 추이" metric="funds" caption="승인 완료 입금액 (승인 시각 기준)"
          pick={(d) => d.deposit ? { labels: d.deposit.labels, series: [{ label: "입금액", color: "#16A34A", values: d.deposit.totals }] } : null}
          formatAxis={fmtMoneyAxis} formatValue={fmtMoney} area pointLabels emptyText="이 구간에 승인된 입금이 없습니다" t={t}
        />
        <DashboardTrendCard
          title="출금액 추이" metric="funds" caption="승인 완료 출금액 (승인 시각 기준, 수수료 포함)"
          pick={(d) => d.withdraw ? { labels: d.withdraw.labels, series: [{ label: "출금액", color: "#D97706", values: d.withdraw.totals }] } : null}
          formatAxis={fmtMoneyAxis} formatValue={fmtMoney} area pointLabels emptyText="이 구간에 승인된 출금이 없습니다" t={t}
        />
      </div>
    </div>
  );
}
