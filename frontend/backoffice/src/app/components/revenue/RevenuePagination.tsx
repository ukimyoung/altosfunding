import type { CSSProperties } from "react";
import { REVENUE_PAGE_SIZE } from "../../constants/revenue";
import type { RevenueThemeTokens } from "../../types/revenue";

interface RevenuePaginationProps {
  total: number;
  page: number;
  onPage: (page: number) => void;
  t: RevenueThemeTokens;
}

export function RevenuePagination({ total, page, onPage, t }: RevenuePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / REVENUE_PAGE_SIZE));
  if (total <= 0) return null;

  const start = (page - 1) * REVENUE_PAGE_SIZE + 1;
  const end = Math.min(page * REVENUE_PAGE_SIZE, total);

  const pageNums: number[] = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(totalPages, page + 2); p++) {
    pageNums.push(p);
  }

  const btnBase: CSSProperties = {
    width: 32, height: 32, borderRadius: 6, fontSize: 13,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", fontFamily: "'DM Sans','Noto Sans KR',sans-serif",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 4px 2px" }}>
      <span style={{ fontSize: 13, color: t.textSec, fontFamily: "'DM Sans','Noto Sans KR',sans-serif" }}>
        총 {total}개 중 {start} - {end}개 표시
      </span>
      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={() => onPage(Math.max(1, page - 1))}
            disabled={page === 1}
            style={{ ...btnBase, border: `1px solid ${t.border}`, background: t.surface, color: t.text, opacity: page === 1 ? 0.4 : 1, cursor: page === 1 ? "not-allowed" : "pointer" }}
          >‹</button>
          {pageNums.map(p => (
            <button key={p} onClick={() => onPage(p)} style={{
              ...btnBase,
              border: `1px solid ${p === page ? t.accent : t.border}`,
              background: p === page ? t.accent : t.surface,
              color: p === page ? "#fff" : t.text,
              fontWeight: p === page ? 600 : 400,
            }}>{p}</button>
          ))}
          <button
            onClick={() => onPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            style={{ ...btnBase, border: `1px solid ${t.border}`, background: t.surface, color: t.text, opacity: page === totalPages ? 0.4 : 1, cursor: page === totalPages ? "not-allowed" : "pointer" }}
          >›</button>
        </div>
      )}
    </div>
  );
}
