import type { RevenueThemeTokens } from "../../types/revenue";

interface RevenueEmptyCellProps {
  colspan: number;
  msg: string;
  t: RevenueThemeTokens;
}

export function RevenueEmptyCell({ colspan, msg, t }: RevenueEmptyCellProps) {
  return (
    <tr>
      <td colSpan={colspan} style={{
        textAlign: "center", padding: "56px 0",
        color: t.textHint, fontSize: 13,
        fontFamily: "'DM Sans','Noto Sans KR',sans-serif",
      }}>{msg}</td>
    </tr>
  );
}
