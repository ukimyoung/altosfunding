import { useState, type CSSProperties } from "react";
import axios from "axios";
import { getChallengeSalesReport, getFundedSalesReport } from "@/api/revenue";
import { ChallengeRevenueTable } from "../../components/revenue/ChallengeRevenueTable";
import { FundedRevenueTable } from "../../components/revenue/FundedRevenueTable";
import { RevenueFilterBar } from "../../components/revenue/RevenueFilterBar";
import { RevenuePagination } from "../../components/revenue/RevenuePagination";
import { REVENUE_PAGE_SIZE } from "../../constants/revenue";
import { useAppShell } from "../../layouts/AppShell";
import type {
  ChallengeRevenueColumn,
  ChallengeRevenueRow,
  ChallengeRevenueSummary,
  FundedRevenueRow,
  FundedRevenueSummary,
  RevenuePeriod,
  RevenueSearchState,
  RevenueThemeTokens,
} from "../../types/revenue";
import {
  buildSalesReportParams,
  mapChallengeSalesReport,
  mapFundedSalesReport,
} from "../../utils/revenue";

// ─── Tokens ───────────────────────────────────────────────────────────────────

function tok(dark: boolean): RevenueThemeTokens {
  return {
    surface:   dark ? "#0F1829" : "#ffffff",
    surface2:  dark ? "#1A2035" : "#F4F5F7",
    surface3:  dark ? "#232C44" : "#E8EAF0",
    border:    dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.09)",
    border2:   dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.14)",
    text:      dark ? "#E8EAF0" : "#1A1A1A",
    textSec:   dark ? "#8B8FA8" : "#4A4A58",
    textHint:  dark ? "#5A6080" : "#A0A0AA",
    accent:    "#7C6AF7",
    accentBg:  "rgba(124,106,247,0.12)",
    tfoot:     dark ? "#1A2035" : "#F4F5F7",
  };
}

interface SalesReportApiError {
  error_code?: string;
  message_key?: string;
  message?: string;
  detail?: unknown;
}

function getRevenueErrorState(error: unknown): RevenueSearchState {
  if (!axios.isAxiosError<SalesReportApiError>(error)) return "error";
  const errorCode = error.response?.data?.error_code;
  if (errorCode === "period_required") return "no_period";
  if (errorCode === "user_not_found") return "not_found";
  return "error";
}
// ─── Main page ────────────────────────────────────────────────────────────────

export function RevenuePage() {
  const { dark } = useAppShell();
  const t = tok(dark);

  const [activeTab, setActiveTab] = useState<0 | 1>(0);

  // Challenge tab state
  const [cQuery,  setCQuery]  = useState("");
  const [cFrom,   setCFrom]   = useState("");
  const [cTo,     setCTo]     = useState("");
  const [cPeriod, setCPeriod] = useState<RevenuePeriod | null>(null);
  const [cState,  setCState]  = useState<RevenueSearchState>("idle");
  const [cRows,   setCRows]   = useState<ChallengeRevenueRow[]>([]);
  const [cColumns, setCColumns] = useState<ChallengeRevenueColumn[]>([]);
  const [cSummary, setCSummary] = useState<ChallengeRevenueSummary | null>(null);
  const [cPage,   setCPage]   = useState(1);

  // Funded tab state
  const [fQuery,  setFQuery]  = useState("");
  const [fFrom,   setFFrom]   = useState("");
  const [fTo,     setFTo]     = useState("");
  const [fPeriod, setFPeriod] = useState<RevenuePeriod | null>(null);
  const [fState,  setFState]  = useState<RevenueSearchState>("idle");
  const [fRows,   setFRows]   = useState<FundedRevenueRow[]>([]);
  const [fSummary, setFSummary] = useState<FundedRevenueSummary | null>(null);
  const [fTraderPct, setFTraderPct] = useState(80);
  const [fCompanyPct, setFCompanyPct] = useState(20);
  const [fPage,   setFPage]   = useState(1);

  const cPagedRows = cRows.slice((cPage - 1) * REVENUE_PAGE_SIZE, cPage * REVENUE_PAGE_SIZE);
  const fPagedRows = fRows.slice((fPage - 1) * REVENUE_PAGE_SIZE, fPage * REVENUE_PAGE_SIZE);

  async function handleChallengeSearch() {
    if (!cPeriod) { setCState("no_period"); return; }
    setCState("loading");
    try {
      const report = await getChallengeSalesReport(buildSalesReportParams(cPeriod, cQuery, cFrom, cTo));
      const mapped = mapChallengeSalesReport(report);
      setCColumns(mapped.columns);
      setCRows(mapped.rows);
      setCSummary(mapped.summary);
      setCPage(1);
      setCState(mapped.rows.length > 0 ? "results" : "no_data");
    } catch (error) {
      setCRows([]);
      setCSummary(null);
      setCPage(1);
      setCState(getRevenueErrorState(error));
    }
  }

  async function handleFundedSearch() {
    if (!fPeriod) { setFState("no_period"); return; }
    setFState("loading");
    try {
      const report = await getFundedSalesReport(buildSalesReportParams(fPeriod, fQuery, fFrom, fTo));
      const mapped = mapFundedSalesReport(report);
      setFRows(mapped.rows);
      setFSummary(mapped.summary);
      setFTraderPct(mapped.traderPct);
      setFCompanyPct(mapped.companyPct);
      setFPage(1);
      setFState(mapped.rows.length > 0 ? "results" : "no_data");
    } catch (error) {
      setFRows([]);
      setFSummary(null);
      setFPage(1);
      setFState(getRevenueErrorState(error));
    }
  }

  const tabStyle = (active: boolean): CSSProperties => ({
    padding: "12px 20px", fontSize: 14, fontWeight: active ? 600 : 400,
    color: active ? "#7C6AF7" : t.textSec,
    background: "none",
    borderTop: "none", borderLeft: "none", borderRight: "none",
    borderBottom: `2px solid ${active ? "#7C6AF7" : "transparent"}`,
    cursor: "pointer",
    fontFamily: "'DM Sans','Noto Sans KR',sans-serif",
    transition: "color 0.15s",
    whiteSpace: "nowrap",
  });

  const cardStyle: CSSProperties = {
    background: t.surface,
    borderRadius: 12,
    border: `1px solid ${t.border}`,
    padding: "18px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  };

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20, fontFamily: "'DM Sans','Noto Sans KR',sans-serif" }}>
      {/* Page header */}
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: t.text }}>매출 현황</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: t.textHint }}>
          챌린지 판매와 펀디드 정산 내역을 조회합니다. 모든 금액은 USDT 기준이며, 시각은 GMT+9입니다.
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ borderBottom: `1px solid ${t.border}`, display: "flex", gap: 0, marginBottom: -1 }}>
        <button style={tabStyle(activeTab === 0)} onClick={() => setActiveTab(0)}>챌린지 매출</button>
        <button style={tabStyle(activeTab === 1)} onClick={() => setActiveTab(1)}>펀디드 매출</button>
      </div>

      {/* Tab 1: Challenge Revenue */}
      {activeTab === 0 && (
        <div style={cardStyle}>
          <RevenueFilterBar
            query={cQuery} setQuery={setCQuery}
            from={cFrom}   setFrom={setCFrom}
            to={cTo}       setTo={setCTo}
            period={cPeriod} setPeriod={setCPeriod}
            onSearch={handleChallengeSearch}
            t={t}
          />
          <div style={{ borderRadius: 8, border: `1px solid ${t.border}`, overflow: "hidden" }}>
            <ChallengeRevenueTable state={cState} rows={cPagedRows} allRows={cRows} columns={cColumns} summary={cSummary} query={cQuery} t={t} />
          </div>
          {cState === "results" && (
            <RevenuePagination total={cRows.length} page={cPage} onPage={setCPage} t={t} />
          )}
        </div>
      )}

      {/* Tab 2: Funded Revenue */}
      {activeTab === 1 && (
        <div style={cardStyle}>
          <RevenueFilterBar
            query={fQuery} setQuery={setFQuery}
            from={fFrom}   setFrom={setFFrom}
            to={fTo}       setTo={setFTo}
            period={fPeriod} setPeriod={setFPeriod}
            onSearch={handleFundedSearch}
            t={t}
          />
          <div style={{ borderRadius: 8, border: `1px solid ${t.border}`, overflow: "hidden" }}>
            <FundedRevenueTable state={fState} rows={fPagedRows} allRows={fRows} summary={fSummary} traderPct={fTraderPct} companyPct={fCompanyPct} query={fQuery} t={t} />
          </div>
          {fState === "results" && (
            <RevenuePagination total={fRows.length} page={fPage} onPage={setFPage} t={t} />
          )}
        </div>
      )}
    </div>
  );
}
