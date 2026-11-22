import { useEffect, useRef, useState } from "react";
import type { Tok } from "../../theme/tokens";

// 최근 N일 막대 차트 (Figma Make '최근 7일 신규 가입 추이'): 막대 위 값, 아래 날짜, 마지막 막대(오늘)만 진한 보라.

interface Props {
  labels: string[];
  values: number[];
  t: Tok;
  height?: number;
}

const PAD = { top: 22, right: 8, bottom: 24, left: 32 };
const GRID_LINES = 4;

export function DashboardBarChart({ labels, values, t, height = 180 }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = values.length;
  const max = Math.max(0, ...values);
  const step = Math.max(1, Math.ceil(max / GRID_LINES));
  const top = step * GRID_LINES;
  const plotW = Math.max(width - PAD.left - PAD.right, 10);
  const plotH = height - PAD.top - PAD.bottom;
  const slot = n ? plotW / n : plotW;
  const barW = Math.min(36, slot * 0.6);
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const font = "'DM Mono',monospace";

  return (
    <div ref={ref} style={{ width: "100%", height }}>
      {width > 0 && (
        <svg width={width} height={height} style={{ display: "block" }}>
          {Array.from({ length: GRID_LINES + 1 }, (_, i) => (
            <g key={i}>
              <line x1={PAD.left} x2={PAD.left + plotW} y1={y(step * i)} y2={y(step * i)} stroke={t.border} />
              <text x={PAD.left - 6} y={y(step * i) + 4} textAnchor="end" fontSize={10} fill={t.textHint} fontFamily={font}>
                {step * i}
              </text>
            </g>
          ))}
          {values.map((v, i) => {
            const cx = PAD.left + slot * i + slot / 2;
            const last = i === n - 1;
            return (
              <g key={i}>
                <rect
                  x={cx - barW / 2} y={y(v)} width={barW} height={Math.max(PAD.top + plotH - y(v), 0)} rx={4}
                  fill={last ? "#7C6AF7" : "rgba(124,106,247,0.22)"}
                />
                <text x={cx} y={y(v) - 6} textAnchor="middle" fontSize={11} fontWeight={700} fill="#7C6AF7" fontFamily={font}>
                  {v}
                </text>
                <text x={cx} y={height - 6} textAnchor="middle" fontSize={10} fill={t.textHint} fontFamily={font}>
                  {labels[i]}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
