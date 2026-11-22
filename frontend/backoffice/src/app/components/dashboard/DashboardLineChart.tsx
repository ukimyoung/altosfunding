import { useEffect, useRef, useState } from "react";
import type { Tok } from "../../theme/tokens";

// 대시보드 추이 차트 (SVG). Figma Make 대시보드의 선 차트 모양을 따른다:
// 가로 눈금선 4개 + 값 라벨, 보라 선 + 아래 채움(단일 계열), 점 표시, 마우스를 올리면 해당 칸 값 표시.

export interface LineSeries {
  label: string;
  color: string;
  values: number[];
}

interface Props {
  labels: string[];
  series: LineSeries[];
  t: Tok;
  height?: number;
  /** 축 눈금 표기 (예: $7k) */
  formatAxis: (v: number) => string;
  /** 점 라벨·툴팁 표기 (예: $7,120) */
  formatValue: (v: number) => string;
  /** 단일 계열일 때 선 아래를 채운다 */
  area?: boolean;
  /** 점 위에 값 라벨을 그린다 (칸이 많으면 자동으로 생략) */
  pointLabels?: boolean;
  emptyText?: string;
  /** 개수처럼 정수만 있는 값: 눈금 간격을 1 이상 정수로 */
  integer?: boolean;
}

const PAD = { top: 26, right: 16, bottom: 26, left: 52 };
const GRID_LINES = 4;

function niceStep(max: number): number {
  const raw = max / GRID_LINES;
  const pow = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * pow >= raw) return m * pow;
  }
  return 10 * pow;
}

export function DashboardLineChart({
  labels, series, t, height = 220, formatAxis, formatValue, area = false, pointLabels = false, emptyText, integer = false,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = labels.length;
  const max = Math.max(0, ...series.flatMap((s) => s.values));
  const step = max > 0 ? (integer ? Math.max(1, Math.ceil(niceStep(max))) : niceStep(max)) : 1;
  const top = step * GRID_LINES;
  const plotW = Math.max(width - PAD.left - PAD.right, 10);
  const plotH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1));
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / 64))));
  const showPointLabels = pointLabels && series.length === 1 && n <= 16;
  const allZero = max === 0;
  const font = "'DM Mono',monospace";

  return (
    <div ref={ref} style={{ position: "relative", width: "100%", height }} onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} style={{ display: "block" }}>
          <defs>
            {series.map((s, si) => (
              <linearGradient key={si} id={`dash-area-${si}-${s.color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={s.color} stopOpacity={0.22} />
                <stop offset="95%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {Array.from({ length: GRID_LINES + 1 }, (_, i) => {
            const v = step * i;
            return (
              <g key={i}>
                <line x1={PAD.left} x2={PAD.left + plotW} y1={y(v)} y2={y(v)} stroke={t.border} />
                <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill={t.textHint} fontFamily={font}>
                  {formatAxis(v)}
                </text>
              </g>
            );
          })}
          {labels.map((label, i) =>
            i % labelEvery === 0 || i === n - 1 ? (
              <text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize={11} fill={t.textHint} fontFamily={font}>
                {label}
              </text>
            ) : null,
          )}
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke={t.border2} strokeDasharray="3 3" />
          )}
          {series.map((s, si) => {
            if (n === 0) return null;
            const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
            return (
              <g key={si}>
                {area && series.length === 1 && (
                  <polygon
                    points={`${x(0)},${y(0)} ${pts} ${x(n - 1)},${y(0)}`}
                    fill={`url(#dash-area-${si}-${s.color.replace("#", "")})`}
                  />
                )}
                <polyline points={pts} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
                {n <= 40 &&
                  s.values.map((v, i) => (
                    <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 5 : 3.5} fill={s.color} stroke="#fff" strokeWidth={1.5} />
                  ))}
                {showPointLabels &&
                  s.values.map((v, i) => (
                    <text key={`l${i}`} x={x(i)} y={y(v) - 10} textAnchor="middle" fontSize={10} fontWeight={600} fill={s.color} fontFamily={font}>
                      {formatAxis(v)}
                    </text>
                  ))}
              </g>
            );
          })}
          {labels.map((_, i) => {
            const half = n <= 1 ? plotW / 2 : plotW / (n - 1) / 2;
            return (
              <rect
                key={i} x={x(i) - half} y={PAD.top} width={half * 2} height={plotH}
                fill="transparent" onMouseEnter={() => setHover(i)}
              />
            );
          })}
        </svg>
      )}
      {allZero && emptyText && (
        <div style={{ position: "absolute", left: PAD.left, right: PAD.right, top: PAD.top + plotH / 2 - 24, textAlign: "center", fontSize: 12, color: t.textHint, fontFamily: "'Noto Sans KR',sans-serif", pointerEvents: "none" }}>
          {emptyText}
        </div>
      )}
      {hover !== null && width > 0 && (
        <div
          style={{
            position: "absolute", top: PAD.top, pointerEvents: "none", zIndex: 2,
            left: Math.min(x(hover) + 12, width - 180), minWidth: 120,
            background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 8, padding: "8px 12px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          }}
        >
          <div style={{ fontSize: 11, color: t.textSec, marginBottom: 4, fontFamily: font }}>{labels[hover]}</div>
          {series.map((s, si) => (
            <div key={si} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              {series.length > 1 && <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }} />}
              {series.length > 1 && <span style={{ fontSize: 11, color: t.textSec }}>{s.label}</span>}
              <span style={{ fontSize: 12, fontWeight: 700, color: s.color, fontFamily: font, marginLeft: series.length > 1 ? "auto" : 0 }}>
                {formatValue(s.values[hover] ?? 0)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
