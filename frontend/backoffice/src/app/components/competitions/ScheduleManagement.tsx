import { useMemo, useState } from "react";
import { Pause, Play, Plus, X, Zap } from "lucide-react";
import type { ChallengeSchedule, Holiday, ScheduleInput } from "../../../api/challengeSchedule";
import { getScheduleApiErrorMessage } from "../../../api/challengeSchedule";
import { useListCatalogProductsQuery } from "../../queries/catalogProducts";
import {
  useCreateHolidayMutation,
  useDeleteHolidayMutation,
  useHolidaysQuery,
  useSaveScheduleMutation,
  useSchedulesQuery,
  useSetScheduleActiveMutation,
  useTriggerScheduleMutation,
  useUpdateHolidayMutation,
} from "../../queries/challengeSchedules";
import { formatKstDateTime } from "../../utils/utils";

// 대회 > 스케줄 관리
// 스케줄은 "어떤 상품으로, 어떤 주기로 대회를 만들지" 정하는 규칙이다. 한 번 등록해 두면
// Background Worker가 1분마다 확인해 대회를 만들고 시작·종료한다 (모집 중 대회는 스케줄마다 1개).

interface ScheduleManagementProps {
  dark: boolean;
  onToast: (message: string, type?: "success" | "warning") => void;
}

type Theme = Record<string, string>;

const FONT = "'Inter','DM Sans','Noto Sans KR',sans-serif";
const MONO = "'DM Mono',monospace";
const ACCENT = "#7C6AF7";

const STATUS: Record<string, { label: string; bg: string; color: string; border: string }> = {
  ACTIVE: { label: "활성", bg: "rgba(22,163,74,0.1)", color: "#16A34A", border: "rgba(22,163,74,0.2)" },
  PAUSED: { label: "일시중지", bg: "rgba(217,119,6,0.1)", color: "#D97706", border: "rgba(217,119,6,0.2)" },
  COMPLETED: { label: "완료", bg: "rgba(113,113,122,0.1)", color: "#71717A", border: "rgba(113,113,122,0.2)" },
};

const TRIGGER_REASON: Record<string, string> = {
  pending_exists: "이미 모집 중인 대회가 있어 새로 만들지 않았습니다.",
  max_occurrences_reached: "최대 회차에 도달해 더 만들 수 없습니다.",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "22:00:00" → "22:00" */
const hhmm = (value: string) => value.slice(0, 5);

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Date를 "YYYY-MM-DD HH:MM" (UTC 기준 필드)로 */
function ymdhm(d: Date) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/** ISO 시각 → "YYYY-MM-DD HH:MM" (UTC) */
const utcText = (iso: string) => ymdhm(new Date(iso));

/** ISO 시각 → "YYYY-MM-DD HH:MM" (KST) */
const kstText = (iso: string) => ymdhm(new Date(new Date(iso).getTime() + 9 * 3600 * 1000));

/** datetime-local 입력값("2026-12-24T14:00")을 UTC 시각으로 보고 ISO로 바꾼다. */
const utcInputToIso = (value: string) => `${value}:00Z`;

/** UTC 시각(HH:MM)을 한국 시각으로 바꿔 보여 준다. 날짜가 넘어가면 (+1일)을 붙인다. */
function kstLabel(utc: string) {
  const [h, m] = utc.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  const total = h + 9;
  return `KST ${String(total % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}${total >= 24 ? " (+1일)" : ""}`;
}

/** Core의 render_name과 같은 규칙으로 대회 이름을 미리 보여 준다. */
function previewName(template: string, seq: number, startAt: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const values: Record<string, string> = {
    seq: String(seq),
    date: `${startAt.getUTCFullYear()}-${pad(startAt.getUTCMonth() + 1)}-${pad(startAt.getUTCDate())}`,
    month: `${startAt.getUTCFullYear()}-${pad(startAt.getUTCMonth() + 1)}`,
    day: pad(startAt.getUTCDate()),
    weekday: WEEKDAYS[startAt.getUTCDay()],
  };
  let invalid = false;
  const name = template.replace(/\{([^{}]*)\}/g, (_, key: string) => {
    if (key in values) return values[key];
    invalid = true;
    return `{${key}}`;
  });
  return invalid ? null : name;
}

function StatusBadge({ status }: { status: string }) {
  const conf = STATUS[status] ?? STATUS.COMPLETED;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 12, background: conf.bg, color: conf.color, border: `1px solid ${conf.border}`, whiteSpace: "nowrap" }}>
      {conf.label}
    </span>
  );
}

// ─── 스케줄 등록/수정 모달 ────────────────────────────────────────────────────

interface ScheduleForm {
  product_id: string;
  name_template: string;
  interval_days: string;
  duration_days: string;
  start_time: string;
  end_time: string;
  exclude_holiday: boolean;
  group_size: string;
  max_occurrences: string;
  description: string;
}

function toForm(schedule: ChallengeSchedule | null): ScheduleForm {
  return {
    product_id: schedule?.product_id ?? "",
    name_template: schedule?.name_template ?? "Daily #{seq} ({date})",
    interval_days: String(schedule?.interval_days ?? 1),
    duration_days: String(schedule?.duration_days ?? 1),
    start_time: schedule ? hhmm(schedule.start_time) : "22:00",
    end_time: schedule ? hhmm(schedule.end_time) : "21:00",
    exclude_holiday: schedule?.exclude_holiday ?? true,
    group_size: schedule?.group_size != null ? String(schedule.group_size) : "",
    max_occurrences: schedule?.max_occurrences != null ? String(schedule.max_occurrences) : "",
    description: schedule?.description ?? "",
  };
}

interface ScheduleModalProps {
  t: Theme;
  schedule: ChallengeSchedule | null;
  products: { id: string; label: string }[];
  saving: boolean;
  onClose: () => void;
  onSave: (payload: ScheduleInput) => void;
}

function ScheduleModal({ t, schedule, products, saving, onClose, onSave }: ScheduleModalProps) {
  const [form, setForm] = useState<ScheduleForm>(() => toForm(schedule));
  const set = <K extends keyof ScheduleForm>(key: K, value: ScheduleForm[K]) => setForm(prev => ({ ...prev, [key]: value }));

  const inputStyle: React.CSSProperties = {
    height: 38, padding: "0 12px", borderRadius: 8, border: `1px solid ${t.border2}`, background: t.surface2,
    color: t.text, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box", fontFamily: FONT,
  };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: t.textSec, marginBottom: 5, display: "block" };
  const helperStyle: React.CSSProperties = { fontSize: 11, color: t.textHint, marginTop: 4, lineHeight: 1.5 };

  const seq = (schedule?.created_count ?? 0) + 1;
  const preview = previewName(form.name_template, seq, new Date());
  const intervalDays = Number(form.interval_days);

  function handleSave() {
    const intOf = (value: string) => (value.trim() === "" ? NaN : Number(value));
    const interval = intOf(form.interval_days);
    const duration = intOf(form.duration_days);
    const groupSize = form.group_size.trim() === "" ? null : intOf(form.group_size);
    const maxOcc = form.max_occurrences.trim() === "" ? null : intOf(form.max_occurrences);
    if (!form.product_id) { alert("챌린지 상품을 선택해주세요."); return; }
    if (!form.name_template.trim()) { alert("대회 이름 규칙을 입력해주세요."); return; }
    if (preview === null) { alert("대회 이름 규칙에는 {seq} {date} {month} {day} {weekday}만 쓸 수 있습니다."); return; }
    if (!Number.isInteger(interval) || interval < 0) { alert("생성 주기는 0 이상의 정수로 입력해주세요."); return; }
    if (!Number.isInteger(duration) || duration < 1) { alert("진행 기간은 1일 이상으로 입력해주세요."); return; }
    if (!/^\d{2}:\d{2}$/.test(form.start_time) || !/^\d{2}:\d{2}$/.test(form.end_time)) { alert("시작·종료 시각을 입력해주세요."); return; }
    if (groupSize !== null && (!Number.isInteger(groupSize) || groupSize < 1)) { alert("그룹 인원은 1 이상의 정수로 입력하거나 비워두세요."); return; }
    if (maxOcc !== null && (!Number.isInteger(maxOcc) || maxOcc < 1)) { alert("최대 회차는 1 이상의 정수로 입력하거나 비워두세요."); return; }
    if (schedule && maxOcc !== null && maxOcc < schedule.created_count) {
      alert(`이미 ${schedule.created_count}회차까지 만들었습니다. 최대 회차는 그 이상이어야 합니다.`); return;
    }
    onSave({
      product_id: form.product_id,
      name_template: form.name_template.trim(),
      interval_days: interval,
      duration_days: duration,
      start_time: `${form.start_time}:00`,
      end_time: `${form.end_time}:00`,
      exclude_holiday: form.exclude_holiday,
      group_size: groupSize,
      max_occurrences: maxOcc,
      description: form.description.trim() || null,
    });
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}>
      <div style={{ width: 560, maxHeight: "90vh", background: t.surface, borderRadius: 16, border: `1px solid ${t.border2}`, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{schedule ? "스케줄 수정" : "스케줄 등록"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: t.textSec, display: "flex", alignItems: "center" }}><X size={18} /></button>
        </div>

        <div style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          {schedule && (
            <div style={{ fontSize: 12, color: t.textSec, background: t.accentBg, border: `1px solid ${t.accentBd}`, borderRadius: 8, padding: "10px 12px", lineHeight: 1.6 }}>
              바꾼 내용은 다음에 만드는 대회부터 적용됩니다. 이미 만들어진 대회(모집 중·진행 중)는 그대로입니다.
            </div>
          )}

          <div>
            <label style={labelStyle}>챌린지 상품 *</label>
            <select value={form.product_id} onChange={e => set("product_id", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="">상품을 선택하세요</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>대회 이름 규칙 *</label>
            <input value={form.name_template} onChange={e => set("name_template", e.target.value)} placeholder="Daily #{seq} ({date})" style={inputStyle} />
            <p style={helperStyle}>
              {"{seq}"} 회차 번호, {"{date}"} 시작일(2026-11-18), {"{month}"} 시작 월, {"{day}"} 시작일(18), {"{weekday}"} 요일(Mon)
              <br />미리보기: <b style={{ color: preview ? t.text : "#DC2626" }}>{preview ?? "쓸 수 없는 항목이 있습니다"}</b>
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>생성 주기 (일) *</label>
              <input type="number" min="0" step="1" value={form.interval_days} onChange={e => set("interval_days", e.target.value)} style={inputStyle} />
              <p style={helperStyle}>{intervalDays === 0 ? "앞 대회가 끝나면 바로 다음 대회 시작" : `앞 대회 시작 ${form.interval_days || "N"}일 뒤 다음 대회 시작`}</p>
            </div>
            <div>
              <label style={labelStyle}>진행 기간 (일) *</label>
              <input type="number" min="1" step="1" value={form.duration_days} onChange={e => set("duration_days", e.target.value)} style={inputStyle} />
              <p style={helperStyle}>시작일부터 N일 뒤 종료 시각에 끝남</p>
            </div>
            <div>
              <label style={labelStyle}>시작 시각 (UTC) *</label>
              <input type="time" value={form.start_time} onChange={e => set("start_time", e.target.value)} style={inputStyle} />
              <p style={helperStyle}>{kstLabel(form.start_time)}</p>
            </div>
            <div>
              <label style={labelStyle}>종료 시각 (UTC) *</label>
              <input type="time" value={form.end_time} onChange={e => set("end_time", e.target.value)} style={inputStyle} />
              <p style={helperStyle}>{kstLabel(form.end_time)}</p>
            </div>
            <div>
              <label style={labelStyle}>그룹 인원</label>
              <input type="number" min="1" step="1" value={form.group_size} onChange={e => set("group_size", e.target.value)} placeholder="비우면 무제한" style={inputStyle} />
              <p style={helperStyle}>대회 하나의 정원. 비우면 인원 제한 없이 참가</p>
            </div>
            <div>
              <label style={labelStyle}>최대 회차</label>
              <input type="number" min="1" step="1" value={form.max_occurrences} onChange={e => set("max_occurrences", e.target.value)} placeholder="비우면 무제한" style={inputStyle} />
              <p style={helperStyle}>이 회차까지 만들면 자동으로 완료</p>
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: 13, color: t.text }}>
            <input type="checkbox" checked={form.exclude_holiday} onChange={e => set("exclude_holiday", e.target.checked)} style={{ accentColor: ACCENT, width: 15, height: 15, marginTop: 2 }} />
            <span>
              주말·휴장일 제외
              <span style={{ display: "block", fontSize: 11, color: t.textHint, marginTop: 2 }}>토·일(UTC)과 아래 휴장 기간에는 대회를 시작하지 않고, 진행 기간도 영업일만 셉니다.</span>
            </span>
          </label>

          <div>
            <label style={labelStyle}>메모</label>
            <input value={form.description} onChange={e => set("description", e.target.value)} placeholder="관리자용 메모 (선택)" style={inputStyle} />
          </div>
        </div>

        <div style={{ padding: "14px 24px", borderTop: `1px solid ${t.border}`, display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ height: 38, padding: "0 20px", borderRadius: 8, border: `1px solid ${t.border2}`, background: "transparent", color: t.textSec, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: FONT }}>취소</button>
          <button onClick={handleSave} disabled={saving} style={{ height: 38, padding: "0 24px", borderRadius: 8, border: "none", background: ACCENT, color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1, fontFamily: FONT }}>{saving ? "저장 중..." : "저장"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── 휴장일 카드 ──────────────────────────────────────────────────────────────

function HolidayCard({ t, onToast }: { t: Theme; onToast: ScheduleManagementProps["onToast"] }) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [name, setName] = useState("");
  const holidaysQuery = useHolidaysQuery(year);
  const createMutation = useCreateHolidayMutation();
  const updateMutation = useUpdateHolidayMutation();
  const deleteMutation = useDeleteHolidayMutation();
  const busy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const holidays: Holiday[] = holidaysQuery.data ?? [];

  const inputStyle: React.CSSProperties = {
    height: 36, padding: "0 10px", borderRadius: 8, border: `1px solid ${t.border2}`, background: t.surface2,
    color: t.text, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: FONT,
  };
  const thStyle: React.CSSProperties = { padding: "10px 14px", fontSize: 11, fontWeight: 700, color: t.textSec, textAlign: "left", whiteSpace: "nowrap", background: t.surface3, borderBottom: `1px solid ${t.border2}` };
  const tdStyle: React.CSSProperties = { padding: "10px 14px", fontSize: 13, color: t.text, borderBottom: `1px solid ${t.border}` };
  const linkBtn = (color: string): React.CSSProperties => ({ background: "none", border: "none", cursor: busy ? "default" : "pointer", fontSize: 13, color, padding: 0, fontFamily: FONT, fontWeight: 500, opacity: busy ? 0.5 : 1 });

  async function handleAdd() {
    if (!from || !to) { alert("휴장 시작(From)과 종료(To) 날짜·시각을 모두 선택해주세요."); return; }
    if (to <= from) { alert("종료(To)는 시작(From)보다 뒤여야 합니다."); return; }
    if (!name.trim()) { alert("휴장일 이름을 입력해주세요."); return; }
    try {
      await createMutation.mutateAsync({ start_at: utcInputToIso(from), end_at: utcInputToIso(to), name: name.trim() });
      onToast("휴장 기간이 추가되었습니다.");
      setFrom(""); setTo(""); setName("");
      const added = Number(from.slice(0, 4));
      if (added !== year) setYear(added);
    } catch (error) {
      onToast(getScheduleApiErrorMessage(error, "휴장일을 추가하지 못했습니다."), "warning");
    }
  }

  async function handleToggle(h: Holiday) {
    try {
      await updateMutation.mutateAsync({ id: h.id, is_active: !h.is_active });
      onToast(h.is_active ? "휴장일 적용을 껐습니다." : "휴장일 적용을 켰습니다.");
    } catch (error) {
      onToast(getScheduleApiErrorMessage(error, "저장하지 못했습니다."), "warning");
    }
  }

  async function handleDelete(h: Holiday) {
    if (!window.confirm(`${utcText(h.start_at)} ~ ${utcText(h.end_at)} (UTC) ${h.name} 휴장일을 삭제하시겠습니까?`)) return;
    try {
      await deleteMutation.mutateAsync(h.id);
      onToast("휴장일이 삭제되었습니다.");
    } catch (error) {
      onToast(getScheduleApiErrorMessage(error, "삭제하지 못했습니다."), "warning");
    }
  }

  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>휴장일</span>
          <div style={{ fontSize: 11, color: t.textHint, marginTop: 2 }}>'주말·휴장일 제외'를 켠 스케줄은 대회 시작 시각이 이 기간에 걸리면 다음 영업일 같은 시각으로 미룹니다. 시각은 UTC로 입력합니다.</div>
        </div>
        <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ ...inputStyle, cursor: "pointer" }}>
          {[thisYear - 1, thisYear, thisYear + 1].map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
      </div>

      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="datetime-local" aria-label="휴장 시작 (UTC)" value={from} onChange={e => { setFrom(e.target.value); if (!to || to <= e.target.value) setTo(""); }} style={{ ...inputStyle, width: 200 }} />
            <span style={{ color: t.textSec, fontSize: 13 }}>~</span>
            <input type="datetime-local" aria-label="휴장 종료 (UTC)" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} style={{ ...inputStyle, width: 200 }} />
          </div>
          <div style={{ fontSize: 11, color: t.textHint, marginTop: 4 }}>
            From ~ To (UTC){from && to ? ` · KST ${kstText(utcInputToIso(from))} ~ ${kstText(utcInputToIso(to))}` : ""}
          </div>
        </div>
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void handleAdd(); }} placeholder="예: Christmas Day" maxLength={100} style={{ ...inputStyle, flex: 1, minWidth: 160 }} />
        <button onClick={() => void handleAdd()} disabled={busy} style={{ height: 36, padding: "0 14px", borderRadius: 8, border: "none", background: ACCENT, color: "#fff", fontSize: 13, fontWeight: 600, cursor: busy ? "default" : "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: FONT, opacity: busy ? 0.6 : 1 }}>
          <Plus size={14} /> 추가
        </button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={thStyle}>기간 (UTC)</th>
            <th style={thStyle}>이름</th>
            <th style={thStyle}>적용</th>
            <th style={thStyle}>관리</th>
          </tr>
        </thead>
        <tbody>
          {holidaysQuery.isLoading ? (
            <tr><td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: t.textHint, padding: "28px 14px" }}>불러오는 중입니다.</td></tr>
          ) : holidaysQuery.isError ? (
            <tr><td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: "#DC2626", padding: "28px 14px" }}>휴장일을 불러오지 못했습니다.</td></tr>
          ) : holidays.length === 0 ? (
            <tr><td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: t.textHint, padding: "28px 14px" }}>{year}년에 등록된 휴장일이 없습니다.</td></tr>
          ) : holidays.map(h => (
            <tr key={h.id}>
              <td style={{ ...tdStyle, color: h.is_active ? t.text : t.textHint }}>
                <div style={{ fontFamily: MONO }}>{utcText(h.start_at)} ~ {utcText(h.end_at)}</div>
                <div style={{ fontSize: 11, color: t.textHint, marginTop: 2 }}>KST {kstText(h.start_at)} ~ {kstText(h.end_at)}</div>
              </td>
              <td style={{ ...tdStyle, color: h.is_active ? t.text : t.textHint }}>{h.name}</td>
              <td style={tdStyle}>
                <button onClick={() => !busy && void handleToggle(h)} style={linkBtn(h.is_active ? "#16A34A" : t.textHint)}>{h.is_active ? "적용 중" : "꺼짐"}</button>
              </td>
              <td style={tdStyle}>
                <button onClick={() => !busy && void handleDelete(h)} style={linkBtn("#DC2626")}>삭제</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ScheduleManagement({ dark, onToast }: ScheduleManagementProps) {
  const t: Theme = {
    surface:  dark ? "#0F1829" : "#ffffff",
    surface2: dark ? "#1A2035" : "#F4F5F7",
    surface3: dark ? "#232C44" : "#E8EAF0",
    border:   dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.09)",
    border2:  dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.14)",
    text:     dark ? "#E8EAF0" : "#1A1A1A",
    textSec:  dark ? "#8B8FA8" : "#4A4A58",
    textHint: dark ? "#5A6080" : "#A0A0AA",
    pageBg:   dark ? "#0A0F1E" : "#F4F5F7",
    accentBg: "rgba(124,106,247,0.08)",
    accentBd: "rgba(124,106,247,0.2)",
  };

  const schedulesQuery = useSchedulesQuery();
  const productsQuery = useListCatalogProductsQuery({ tier_type: "CHALLENGE", page: 1, size: 100 });
  const saveMutation = useSaveScheduleMutation();
  const activeMutation = useSetScheduleActiveMutation();
  const triggerMutation = useTriggerScheduleMutation();
  const [modal, setModal] = useState<{ schedule: ChallengeSchedule | null } | null>(null);

  const schedules = schedulesQuery.data?.items ?? [];
  const productName = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of productsQuery.data?.items ?? []) map.set(p.product_id, p.name ?? p.product_id);
    return map;
  }, [productsQuery.data]);
  const productOptions = (productsQuery.data?.items ?? []).map(p => ({
    id: p.product_id,
    label: `${p.product_id} · ${p.name ?? "-"}${p.is_active ? "" : " (비활성)"}`,
  }));

  const counts = {
    ACTIVE: schedules.filter(s => s.status === "ACTIVE").length,
    PAUSED: schedules.filter(s => s.status === "PAUSED").length,
    COMPLETED: schedules.filter(s => s.status === "COMPLETED").length,
  };
  const busy = saveMutation.isPending || activeMutation.isPending || triggerMutation.isPending;

  async function handleSave(payload: ScheduleInput) {
    if (!modal) return;
    try {
      await saveMutation.mutateAsync({ id: modal.schedule?.id ?? null, payload });
      onToast(modal.schedule ? "스케줄이 수정되었습니다." : "스케줄이 등록되었습니다. 1분 안에 첫 대회가 만들어집니다.");
      setModal(null);
    } catch (error) {
      onToast(getScheduleApiErrorMessage(error, "저장하지 못했습니다."), "warning");
    }
  }

  async function handleActive(s: ChallengeSchedule, active: boolean) {
    const message = active
      ? "스케줄을 다시 활성화하시겠습니까?\n1분 안에 다음 대회가 만들어집니다."
      : "스케줄을 일시중지하시겠습니까?\n새 대회는 더 만들지 않고, 이미 만들어진 대회는 그대로 진행됩니다.";
    if (!window.confirm(message)) return;
    try {
      await activeMutation.mutateAsync({ id: s.id, active });
      onToast(active ? "스케줄을 다시 활성화했습니다." : "스케줄을 일시중지했습니다.");
    } catch (error) {
      onToast(getScheduleApiErrorMessage(error, "저장하지 못했습니다."), "warning");
    }
  }

  async function handleTrigger(s: ChallengeSchedule) {
    try {
      const result = await triggerMutation.mutateAsync(s.id);
      if (result.created && result.challenge) {
        onToast(`대회를 만들었습니다: ${result.challenge.name}`);
      } else {
        onToast(TRIGGER_REASON[result.reason ?? ""] ?? "대회를 만들지 않았습니다.", "warning");
      }
    } catch (error) {
      onToast(getScheduleApiErrorMessage(error, "대회를 만들지 못했습니다."), "warning");
    }
  }

  const thStyle: React.CSSProperties = { padding: "10px 14px", fontSize: 11, fontWeight: 700, color: t.textSec, textAlign: "left", whiteSpace: "nowrap", background: t.surface3, borderBottom: `1px solid ${t.border2}` };
  const tdStyle: React.CSSProperties = { padding: "12px 14px", fontSize: 13, color: t.text, borderBottom: `1px solid ${t.border}`, verticalAlign: "middle", whiteSpace: "nowrap" };
  const subStyle: React.CSSProperties = { fontSize: 11, color: t.textHint, marginTop: 2 };
  const linkBtn = (color: string): React.CSSProperties => ({ background: "none", border: "none", cursor: busy ? "default" : "pointer", fontSize: 13, color, padding: 0, fontFamily: FONT, fontWeight: 500, opacity: busy ? 0.5 : 1, display: "inline-flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" });

  return (
    <div style={{ padding: "24px 28px 48px", fontFamily: FONT, minHeight: "100vh", background: t.pageBg }}>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, margin: 0 }}>스케줄 관리</h1>
          <p style={{ fontSize: 13, color: t.textSec, marginTop: 4, marginBottom: 0 }}>
            상품별로 대회를 만드는 규칙을 한 번 등록하면, 시스템이 1분마다 확인해 대회를 자동으로 만들고 시작·종료합니다.
          </p>
        </div>
        <button onClick={() => setModal({ schedule: null })} disabled={busy} style={{ height: 38, padding: "0 18px", borderRadius: 8, border: "none", background: ACCENT, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: FONT }}>
          <Plus size={14} /> 스케줄 등록
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "활성 스케줄", value: counts.ACTIVE, caption: "대회를 자동으로 만드는 중" },
          { label: "일시중지", value: counts.PAUSED, caption: "새 대회를 만들지 않음" },
          { label: "완료", value: counts.COMPLETED, caption: "최대 회차 도달" },
        ].map(card => (
          <div key={card.label} style={{ background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: t.textSec, marginBottom: 8 }}>{card.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: t.text }}>
              {schedulesQuery.data ? card.value : "—"}
              {schedulesQuery.data && <span style={{ fontSize: 14, fontWeight: 500, color: t.textSec, marginLeft: 3 }}>개</span>}
            </div>
            <div style={{ fontSize: 11, color: t.textHint, marginTop: 4 }}>{card.caption}</div>
          </div>
        ))}
      </div>

      <div style={{ background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 14, overflow: "hidden", marginBottom: 24 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1080 }}>
            <thead>
              <tr>
                <th style={thStyle}>No.</th>
                <th style={thStyle}>상품</th>
                <th style={thStyle}>대회 이름 규칙</th>
                <th style={thStyle}>주기 / 기간</th>
                <th style={thStyle}>시작 / 종료 (UTC)</th>
                <th style={thStyle}>만든 회차</th>
                <th style={thStyle}>다음 대회 생성</th>
                <th style={thStyle}>상태</th>
                <th style={thStyle}>관리</th>
              </tr>
            </thead>
            <tbody>
              {schedulesQuery.isLoading ? (
                <tr><td colSpan={9} style={{ ...tdStyle, textAlign: "center", color: t.textHint, padding: "40px 14px" }}>스케줄을 불러오는 중입니다.</td></tr>
              ) : schedulesQuery.isError ? (
                <tr><td colSpan={9} style={{ ...tdStyle, textAlign: "center", color: "#DC2626", padding: "40px 14px" }}>스케줄을 불러오지 못했습니다.</td></tr>
              ) : schedules.length === 0 ? (
                <tr><td colSpan={9} style={{ ...tdStyle, textAlign: "center", color: t.textHint, padding: "40px 14px" }}>
                  등록된 스케줄이 없습니다. '스케줄 등록'으로 챌린지 상품별 대회 규칙을 추가하세요.
                </td></tr>
              ) : schedules.map(s => (
                <tr key={s.id}>
                  <td style={{ ...tdStyle, color: t.textSec, fontFamily: MONO }}>{s.id}</td>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{productName.get(s.product_id) ?? s.product_id}</div>
                    <div style={{ ...subStyle, fontFamily: MONO }}>{s.product_id}</div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontFamily: MONO, fontSize: 12, whiteSpace: "normal", minWidth: 140 }}>{s.name_template}</div>
                    {s.description && <div style={subStyle}>{s.description}</div>}
                  </td>
                  <td style={tdStyle}>
                    <div>{s.interval_minutes ? `${s.interval_minutes}분마다 (테스트)` : s.interval_days === 0 ? "종료 후 바로" : `${s.interval_days}일마다`}</div>
                    <div style={subStyle}>{s.duration_minutes ? `${s.duration_minutes}분 진행` : `${s.duration_days}일 진행`}{s.exclude_holiday ? " · 주말·휴장일 제외" : ""}</div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontFamily: MONO }}>{hhmm(s.start_time)} ~ {hhmm(s.end_time)}</div>
                    <div style={subStyle}>{kstLabel(hhmm(s.start_time))} ~ {kstLabel(hhmm(s.end_time)).replace("KST ", "")}</div>
                  </td>
                  <td style={{ ...tdStyle, fontFamily: MONO }}>
                    {s.created_count}{s.max_occurrences != null ? ` / ${s.max_occurrences}` : ""}
                    <div style={{ ...subStyle, fontFamily: FONT }}>{s.group_size != null ? `정원 ${s.group_size}명` : "정원 무제한"}</div>
                  </td>
                  <td style={tdStyle}>
                    {s.status !== "ACTIVE" ? <span style={{ color: t.textHint }}>-</span>
                      : s.next_run_at ? <><div>{formatKstDateTime(s.next_run_at)}</div><div style={subStyle}>모집 중 대회가 시작될 때</div></>
                      : <span style={{ color: t.textSec }}>1분 안에 생성</span>}
                  </td>
                  <td style={tdStyle}><StatusBadge status={s.status} /></td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 12 }}>
                      <button onClick={() => !busy && setModal({ schedule: s })} style={linkBtn(ACCENT)}>수정</button>
                      {s.status === "ACTIVE" && (
                        <button onClick={() => !busy && void handleActive(s, false)} style={linkBtn("#D97706")}><Pause size={12} />중지</button>
                      )}
                      {s.status === "PAUSED" && (
                        <button onClick={() => !busy && void handleActive(s, true)} style={linkBtn("#16A34A")}><Play size={12} />재개</button>
                      )}
                      {s.status === "ACTIVE" && (
                        <button onClick={() => !busy && void handleTrigger(s)} title="모집 중인 대회가 없을 때 다음 대회를 지금 만듭니다." style={linkBtn(t.textSec)}><Zap size={12} />지금 만들기</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <HolidayCard t={t} onToast={onToast} />

      <p style={{ fontSize: 11, color: t.textHint, marginTop: 14, lineHeight: 1.6 }}>
        스케줄마다 모집 중인 대회는 하나만 있습니다. 그 대회가 시작되면 다음 대회가 자동으로 만들어지고, 종료 시각이 되면 자동으로 종료됩니다.
        관리자가 매일 등록할 필요는 없습니다.
      </p>

      {modal && (
        <ScheduleModal
          key={modal.schedule?.id ?? "new"}
          t={t}
          schedule={modal.schedule}
          products={productOptions}
          saving={saveMutation.isPending}
          onClose={() => setModal(null)}
          onSave={payload => void handleSave(payload)}
        />
      )}
    </div>
  );
}
