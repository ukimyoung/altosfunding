// 상세 정보 영역에서 label/value 쌍을 일관된 스타일로 보여주는 공통 필드입니다.

export function InfoField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: "var(--hint)", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'DM Sans',sans-serif" }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--txt)", fontFamily: mono ? "'DM Mono',monospace" : "'Noto Sans KR','DM Sans',sans-serif" }}>{value}</span>
    </div>
  );
}
