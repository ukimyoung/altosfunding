import type { CSSProperties } from "react";
import type { FundedRevenueRow, FundedRevenueSummary, RevenueSearchState, RevenueThemeTokens } from "../../types/revenue";
import { formatRevenueAmount, formatRevenueQuantity } from "../../utils/revenue";
import { RevenueEmptyCell } from "./RevenueEmptyCell";

interface FundedRevenueTableProps {
  state: RevenueSearchState;
  rows: FundedRevenueRow[];
  allRows: FundedRevenueRow[];
  summary: FundedRevenueSummary | null;
  traderPct: number;
  companyPct: number;
  query: string;
  t: RevenueThemeTokens;
}

export function FundedRevenueTable({ state, rows, allRows, summary, traderPct, companyPct, query, t }: FundedRevenueTableProps) {
  const thBase: CSSProperties = {
    padding: "10px 14px", fontSize: 12, fontWeight: 600,
    color: t.textSec, whiteSpace: "nowrap",
    borderBottom: `1px solid ${t.border}`,
    fontFamily: "'DM Sans','Noto Sans KR',sans-serif",
    background: t.surface2,
  };
  const numCell: CSSProperties = {
    textAlign: "right", padding: "9px 14px",
    fontFamily: "ui-monospace,'DM Mono',monospace",
    fontSize: 13, color: t.text,
    borderBottom: `1px solid ${t.border}`,
  };

  const total = summary ?? allRows.reduce((acc, r) => ({
    reqCount:   acc.reqCount   + r.reqCount,
    reqAmt:     acc.reqAmt     + r.reqAmt,
    traderAmt:  acc.traderAmt  + r.traderAmt,
    companyAmt: acc.companyAmt + r.companyAmt,
  }), { reqCount:0, reqAmt:0, traderAmt:0, companyAmt:0 });

  const tfootCell: CSSProperties = {
    ...numCell, fontWeight: 700, background: t.tfoot, borderBottom: "none",
  };

  const emptyMsg =
    state === "idle"       ? "검색 조건을 설정하고 조회 버튼을 눌러주세요." :
    state === "loading"    ? "조회 중입니다." :
    state === "no_period"  ? "일별 / 주별 / 월별 / 연별 중 하나를 선택해주세요." :
    state === "not_found"  ? `'${query}'에 해당하는 유저를 찾을 수 없습니다.` :
    state === "no_data"    ? "데이터가 없습니다." :
    state === "error"      ? "매출 현황을 불러오지 못했습니다." : "";

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...thBase, textAlign: "left", width: "16%" }}>일자</th>
            <th style={{ ...thBase, textAlign: "right" }}>출금요청건수</th>
            <th style={{ ...thBase, textAlign: "right" }}>출금요청 금액</th>
            <th style={{ ...thBase, textAlign: "right" }}>트레이더 ({formatRevenueQuantity(traderPct)}%)</th>
            <th style={{ ...thBase, textAlign: "right" }}>회사 ({formatRevenueQuantity(companyPct)}%)</th>
          </tr>
        </thead>
        <tbody>
          {state !== "results" ? (
            <RevenueEmptyCell colspan={5} msg={emptyMsg} t={t} />
          ) : (
            rows.map(r => (
              <tr key={r.label}>
                <td style={{ ...numCell, textAlign: "left", fontFamily: "ui-monospace,'DM Mono',monospace" }}>{r.label}</td>
                <td style={numCell}>{formatRevenueQuantity(r.reqCount)}</td>
                <td style={numCell}>{formatRevenueAmount(r.reqAmt)}</td>
                <td style={{ ...numCell, color: "#DC2626" }}>{formatRevenueAmount(r.traderAmt)}</td>
                <td style={{ ...numCell, color: "#16A34A" }}>{formatRevenueAmount(r.companyAmt)}</td>
              </tr>
            ))
          )}
        </tbody>
        {state === "results" && (
          <tfoot>
            <tr>
              <td style={{ ...tfootCell, textAlign: "left", fontFamily: "'DM Sans','Noto Sans KR',sans-serif" }}>합계</td>
              <td style={tfootCell}>{formatRevenueQuantity(total.reqCount)}</td>
              <td style={tfootCell}>{formatRevenueAmount(total.reqAmt)}</td>
              <td style={{ ...tfootCell, color: "#DC2626" }}>{formatRevenueAmount(total.traderAmt)}</td>
              <td style={{ ...tfootCell, color: "#16A34A" }}>{formatRevenueAmount(total.companyAmt)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
