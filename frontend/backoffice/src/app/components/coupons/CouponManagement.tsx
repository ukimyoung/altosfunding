import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { Plus, X, ChevronRight } from "lucide-react";
import { useCouponDetailQuery, useCouponsQuery, useCouponStatsQuery, useCouponUsagesQuery, useCreateCouponMutation, useDeleteCouponMutation, useUpdateCouponMutation } from "../../queries/coupons";
import { useListUsersQuery } from "../../queries/users";
import type { Coupon, CouponStatus, Member } from "../../types/coupon";
import type { AdminCouponStatus, CouponWriteRequest } from "../../../api/coupon";
import { avatarChar, computeCouponStatus, formatDateKST, generateCouponCode, mapAdminCoupon, mapCouponUsage } from "../../utils/coupon";
import { SEARCH_DEBOUNCE_MS } from "../shared/TableFilters";

interface CouponManagementProps {
  dark: boolean;
  onToast: (message: string, type?: "success" | "warning") => void;
}

// ─── Types ────────────────────────────────────────────────────────────────────


// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CouponStatus }) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    "활성":    { bg: "rgba(22,163,74,0.1)",   color: "#16A34A", border: "rgba(22,163,74,0.2)" },
    "비활성":  { bg: "rgba(113,113,122,0.1)", color: "#71717A", border: "rgba(113,113,122,0.2)" },
    "기간만료":{ bg: "rgba(220,38,38,0.08)",  color: "#DC2626", border: "rgba(220,38,38,0.18)" },
    "소진됨":  { bg: "rgba(217,119,6,0.1)", color: "#D97706", border: "rgba(217,119,6,0.2)" },
  };
  const s = styles[status];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 12, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: "nowrap" }}>
      {status}
    </span>
  );
}

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "rgba(124,106,247,0.18)", color: "#7C6AF7", fontSize: size * 0.42, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {avatarChar(name)}
    </div>
  );
}

// ─── Coupon Modal ─────────────────────────────────────────────────────────────

interface ModalProps {
  dark: boolean;
  t: Record<string, string>;
  editing: Coupon | null;
  coupons: Coupon[];
  onClose: () => void;
  onSave: (data: Omit<Coupon, "id" | "usageHistory">) => void;
}

function CouponModal({ dark, t, editing, coupons, onClose, onSave }: ModalProps) {
  const [code, setCode]         = useState(editing?.code ?? "");
  const [name, setName]         = useState(editing?.name ?? "");
  const [discountValue, setDiscountValue] = useState(editing ? String(editing.discountValue) : "");
  const [commissionRate, setCommissionRate] = useState(editing ? String(editing.commissionRate) : "");
  const [scopeAll, setScopeAll] = useState(editing?.scopeAll ?? true);
  const [scopeProducts, setScopeProducts] = useState<("Starter" | "Professional" | "Elite")[]>(editing?.scopeProducts ?? ["Starter", "Professional", "Elite"]);
  const [maxUses, setMaxUses]   = useState(editing ? String(editing.maxUses) : "");
  const [startDate, setStartDate] = useState(editing?.startDate === "—" ? "" : editing?.startDate ?? "");
  const [endDate, setEndDate]   = useState(editing?.endDate === "—" ? "" : editing?.endDate ?? "");
  const [status, setStatus]     = useState<"active" | "inactive">(editing?.status ?? "active");

  // Partner member search
  const [selectedPartner, setSelectedPartner] = useState<Member | null>(
    editing
      ? (editing.partnerId
          ? { id: editing.partnerId, name: editing.partnerName ?? editing.partnerEmail ?? editing.partnerId, email: editing.partnerEmail ?? "" }
          : null)
      : null
  );
  const [partnerQ, setPartnerQ]   = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const partnerSearchQuery = useListUsersQuery({
    keyword: partnerQ.trim() || null,
    page: 1,
    size: 20,
  });
  const partnerResults: Member[] = partnerQ.trim().length > 0
    ? (partnerSearchQuery.data?.items ?? []).map((user) => ({
        id: user.id,
        name: [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.email,
        email: user.email,
      }))
    : [];

  useEffect(() => {
    setShowDropdown(partnerResults.length > 0);
  }, [partnerQ, partnerResults.length]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const inputStyle: React.CSSProperties = {
    height: 38, padding: "0 12px", borderRadius: 8,
    border: `1px solid ${t.border2}`, background: t.surface2,
    color: t.text, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box",
    fontFamily: "'Inter','DM Sans','Noto Sans KR',sans-serif",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: t.textSec, marginBottom: 5, display: "block",
  };
  const helperStyle: React.CSSProperties = { fontSize: 11, color: t.textHint, marginTop: 4 };

  function toggleScope(p: "Starter" | "Professional" | "Elite") {
    setScopeProducts(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  }

  function handleSave() {
    if (!code.trim()) { alert("쿠폰 코드를 입력해주세요."); return; }
    if (!name.trim()) { alert("쿠폰명을 입력해주세요."); return; }
    if (!selectedPartner) { alert("담당 파트너를 회원 검색으로 지정해주세요."); return; }
    const cr = parseFloat(commissionRate);
    if (!commissionRate || isNaN(cr) || cr <= 0) { alert("담당 파트너 커미션율을 입력해주세요."); return; }
    if (cr > 100) { alert("커미션율은 100%를 초과할 수 없습니다."); return; }
    const dv = parseFloat(discountValue);
    if (!discountValue || isNaN(dv) || dv <= 0) { alert("할인율을 올바른 양수로 입력해주세요."); return; }
    if (dv > 100) { alert("할인율은 100%를 초과할 수 없습니다."); return; }
    if (!scopeAll && scopeProducts.length === 0) { alert("적용 대상 상품을 하나 이상 선택해주세요."); return; }
    const mu = parseInt(maxUses, 10);
    if (!maxUses || isNaN(mu) || mu <= 0) { alert("총 사용 가능 횟수를 올바른 양수로 입력해주세요."); return; }
    if (!startDate || !endDate) { alert("유효 기간 시작일과 종료일을 모두 입력해주세요."); return; }
    if (startDate && endDate && startDate > endDate) { alert("시작일이 종료일보다 늦을 수 없습니다."); return; }
    const upperCode = code.trim().toUpperCase();
    const duplicate = coupons.find(c => c.code === upperCode && c.id !== (editing?.id ?? ""));
    if (duplicate) { alert("이미 존재하는 쿠폰 코드입니다. 다른 코드를 입력해주세요."); return; }

    onSave({
      code: upperCode,
      name: name.trim(),
      partnerId: selectedPartner?.id ?? editing?.partnerId ?? "",
      discountValue: dv,
      commissionRate: cr,
      scopeAll,
      scopeProducts: scopeAll ? ["Starter", "Professional", "Elite"] : scopeProducts,
      maxUses: mu,
      perUserLimit: "once",
      startDate,
      endDate,
      status,
    });
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}>
      <div style={{ width: 560, maxHeight: "90vh", background: t.surface, borderRadius: 16, border: `1px solid ${t.border2}`, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{editing ? "쿠폰 수정" : "쿠폰 발행"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: t.textSec, display: "flex", alignItems: "center" }}><X size={18} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* 쿠폰 코드 */}
          <div>
            <label style={labelStyle}>쿠폰 코드 *</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={code} onChange={e => setCode(e.target.value)} disabled={Boolean(editing)} placeholder="예: JOHNTRADER10" style={{ ...inputStyle, cursor: editing ? "not-allowed" : "text" }} />
              <button
                onClick={() => setCode(generateCouponCode(selectedPartner))}
                disabled={Boolean(editing)}
                style={{ height: 38, padding: "0 14px", borderRadius: 8, border: `1px solid ${t.border2}`, background: t.surface2, color: t.textSec, fontSize: 12, fontWeight: 600, cursor: editing ? "not-allowed" : "pointer", whiteSpace: "nowrap", fontFamily: "'Inter',sans-serif" }}
              >자동 생성</button>
            </div>
            <p style={helperStyle}>유저가 결제 시 직접 입력하는 코드입니다. 영문 대문자/숫자 조합을 권장합니다.</p>
          </div>

          {/* 쿠폰명 */}
          <div>
            <label style={labelStyle}>쿠폰명 (관리자 식별용) *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="예: 존트레이더 유튜브 7월" style={inputStyle} />
          </div>

          {/* 담당 파트너 */}
          <div>
            <label style={labelStyle}>담당 파트너 *</label>
            <div style={{ position: "relative" }} ref={dropdownRef}>
              {!selectedPartner ? (
                <>
                  <input
                    value={partnerQ}
                    onChange={e => setPartnerQ(e.target.value)}
                    placeholder="회원 이름 또는 이메일로 검색"
                    style={inputStyle}
                    onFocus={() => { if (partnerResults.length > 0) setShowDropdown(true); }}
                  />
                  {showDropdown && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.18)", zIndex: 10, maxHeight: 200, overflowY: "auto" }}>
                      {partnerResults.map(m => (
                        <button key={m.id} onClick={() => { setSelectedPartner(m); setPartnerQ(""); setShowDropdown(false); }}
                          style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}
                          onMouseEnter={e => (e.currentTarget.style.background = t.surface2)}
                          onMouseLeave={e => (e.currentTarget.style.background = "none")}
                        >
                          <Avatar name={m.name} size={28} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{m.name}</div>
                            <div style={{ fontSize: 11, color: t.textSec }}>{m.email}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: t.accentBg, border: `1px solid ${t.accentBd}`, borderRadius: 8 }}>
                  <Avatar name={selectedPartner.name} size={30} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{selectedPartner.name}</div>
                    <div style={{ fontSize: 11, color: t.textSec }}>{selectedPartner.email}</div>
                  </div>
                  <button onClick={() => setSelectedPartner(null)} style={{ background: "none", border: "none", cursor: "pointer", color: t.textSec, display: "flex", padding: 2 }}><X size={14} /></button>
                </div>
              )}
            </div>
            <p style={helperStyle}>쿠폰을 배포할 담당자를 회원 목록에서 검색하여 지정합니다 (인플루언서도 우리 서비스의 회원이어야 합니다).</p>
          </div>

          {/* 담당 파트너 커미션율 */}
          <div>
            <label style={labelStyle}>담당 파트너 커미션율 *</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="number" min="1" max="100" value={commissionRate} onChange={e => setCommissionRate(e.target.value)} placeholder="5" style={{ ...inputStyle, width: 160 }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: t.textSec }}>%</span>
            </div>
            <p style={helperStyle}>결제 완료 시 담당 파트너에게 지급될 커미션 비율입니다. 결제 금액(할인 적용 후 실 결제 금액) 기준으로 자동 계산되어 지급됩니다.</p>
          </div>

          {/* 할인율 */}
          <div>
            <label style={labelStyle}>할인율 *</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="number" min="1" max="100" value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder="10" style={{ ...inputStyle, width: 160 }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: t.textSec }}>%</span>
            </div>
            <p style={helperStyle}>쿠폰 할인은 정률(%) 방식만 지원합니다.</p>
          </div>

          {/* 적용 대상 */}
          <div>
            <label style={labelStyle}>적용 대상</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: t.text }}>
              <input type="checkbox" checked={scopeAll} onChange={e => setScopeAll(e.target.checked)} style={{ accentColor: "#7C6AF7", width: 15, height: 15 }} />
              전체 상품 (Starter / Professional / Elite)
            </label>
            {!scopeAll && (
              <div style={{ display: "flex", gap: 16, marginTop: 10, paddingLeft: 4 }}>
                {(["Starter", "Professional", "Elite"] as const).map(p => (
                  <label key={p} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, color: t.text }}>
                    <input type="checkbox" checked={scopeProducts.includes(p)} onChange={() => toggleScope(p)} style={{ accentColor: "#7C6AF7", width: 15, height: 15 }} />
                    {p}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* 총 사용 가능 횟수 + 1인당 사용 제한 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>총 사용 가능 횟수 *</label>
              <input type="number" min="1" value={maxUses} onChange={e => setMaxUses(e.target.value)} placeholder="예: 100" style={inputStyle} />
              <p style={helperStyle}>결제 완료 시 차감 (미완료 건 미포함)</p>
            </div>
            <div>
              <label style={labelStyle}>1인당 사용 제한</label>
              <select value="once" disabled aria-disabled="true" style={{ ...inputStyle, cursor: "not-allowed" }}>
                <option value="once">1회 (기본, 중복 사용 방지)</option>
              </select>
              <p style={helperStyle}>User ID 기준으로 판별</p>
            </div>
          </div>

          {/* 유효 기간 */}
          <div>
            <label style={labelStyle}>유효 기간 *</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...inputStyle, width: "auto", flex: 1 }} />
              <span style={{ color: t.textHint, fontSize: 13 }}>~</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ ...inputStyle, width: "auto", flex: 1 }} />
            </div>
          </div>

          {/* 상태 */}
          <div>
            <label style={labelStyle}>상태</label>
            <select value={status} onChange={e => setStatus(e.target.value as "active" | "inactive")} style={{ ...inputStyle, width: 180, cursor: "pointer" }}>
              <option value="active">활성</option>
              <option value="inactive">비활성</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: `1px solid ${t.border}`, display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ height: 38, padding: "0 20px", borderRadius: 8, border: `1px solid ${t.border2}`, background: "transparent", color: t.textSec, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter','DM Sans','Noto Sans KR',sans-serif" }}>취소</button>
          <button onClick={handleSave} style={{ height: 38, padding: "0 24px", borderRadius: 8, border: "none", background: "#7C6AF7", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter','DM Sans','Noto Sans KR',sans-serif" }}>저장</button>
        </div>
      </div>
    </div>
  );
}

// ─── Usage Drawer ─────────────────────────────────────────────────────────────

export function UsageDrawer({ coupon, t, onClose, headerMode = "coupon" }: { coupon: Pick<Coupon, "id" | "code" | "name" | "maxUses">; t: Record<string, string>; onClose: () => void; headerMode?: "coupon" | "usage-only" }) {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const usageQuery = useCouponUsagesQuery(Number(coupon.id), { page, size: PAGE_SIZE });
  const pageData = usageQuery.data?.items.map(mapCouponUsage) ?? [];
  const total = usageQuery.data?.total ?? 0;
  const totalPages = usageQuery.data?.pages ?? 0;
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  const pageBtnStyle = (active: boolean, disabled?: boolean): React.CSSProperties => ({
    width: 28, height: 28, borderRadius: 6, border: active ? "none" : `1px solid ${t.border2}`,
    background: active ? "#7C6AF7" : t.surface2, color: active ? "#fff" : disabled ? t.textHint : t.textSec,
    fontSize: 12, fontFamily: "'DM Sans',sans-serif", cursor: disabled ? "default" : "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", padding: 0, opacity: disabled ? 0.4 : 1,
  });

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 900 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 480, maxWidth: "100vw", background: t.surface, borderLeft: `1px solid ${t.border2}`, zIndex: 901, display: "flex", flexDirection: "column", boxShadow: "-16px 0 48px rgba(0,0,0,0.22)" }}>
        {/* Header */}
        <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: "'DM Mono',monospace" }}>{coupon.code} 사용 이력</div>
              <div style={{ fontSize: 12, color: t.textSec, marginTop: 4 }}>
                {headerMode === "usage-only"
                  ? `총 ${total}건 사용`
                  : `${coupon.name} · 총 ${total}건 / ${coupon.maxUses}건 한도`}
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: t.textSec }}><X size={18} /></button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          {usageQuery.isLoading ? (
            <div style={{ textAlign: "center", color: t.textHint, fontSize: 13, paddingTop: 48 }}>사용 이력을 불러오는 중입니다.</div>
          ) : usageQuery.isError ? (
            <div style={{ textAlign: "center", color: "#DC2626", fontSize: 13, paddingTop: 48 }}>사용 이력을 불러오지 못했습니다.</div>
          ) : total === 0 ? (
            <div style={{ textAlign: "center", color: t.textHint, fontSize: 13, paddingTop: 48 }}>아직 사용 이력이 없습니다.</div>
          ) : pageData.map((entry, i) => (
            <div key={entry.id ?? i} style={{ padding: "12px 14px", background: t.surface2, borderRadius: 10, border: `1px solid ${t.border}` }}>
              {/* Name row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 2 }}>
                <span style={{ minWidth: 0, flex: 1, overflowWrap: "anywhere", fontSize: 13, fontWeight: 600, color: t.text }}>{entry.userName}</span>
                <span style={{ flexShrink: 0, whiteSpace: "nowrap", fontSize: 12, color: "#16A34A", fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>
                  ${entry.finalAmountUsd ?? Math.round(entry.originalAmountUsd * (1 - entry.discountApplied / 100))}
                  <span style={{ fontSize: 10, fontWeight: 500, color: t.textSec, marginLeft: 4 }}>실 결제 금액</span>
                </span>
              </div>
              {/* Email */}
              <div style={{ fontSize: 11, color: t.textSec, marginBottom: 8 }}>{entry.userEmail}</div>
              {/* Price breakdown */}
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 7, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: t.textHint }}>
                  결제 전 금액 <span style={{ fontFamily: "'DM Mono',monospace", color: t.textSec }}>${entry.originalAmountUsd}</span>
                </span>
                <span style={{ color: t.border2, fontSize: 10 }}>·</span>
                <span style={{ fontSize: 11, color: t.textHint }}>
                  할인 적용 <span style={{ fontFamily: "'DM Mono',monospace", color: "#DC2626" }}>-${entry.discountAmountUsd ?? Math.round(entry.originalAmountUsd * entry.discountApplied / 100)} ({entry.discountApplied}%)</span>
                </span>
              </div>
              {/* Timestamp + order */}
              <div style={{ fontSize: 11, color: t.textHint, fontFamily: "'DM Mono',monospace" }}>
                {formatDateKST(entry.datetime)} · 주문 {entry.orderNo}
              </div>
            </div>
          ))}
        </div>

        {/* Pagination footer */}
        {total > 0 && (
          <div style={{ padding: "10px 20px", borderTop: `1px solid ${t.border}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: t.textHint, fontFamily: "'Noto Sans KR',sans-serif" }}>
              총 {total}건 중 {start}–{end}건 표시
            </span>
            {totalPages > 1 && (
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pageBtnStyle(false, page === 1)}>‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)} style={pageBtnStyle(p === page)}>{p}</button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pageBtnStyle(false, page === totalPages)}>›</button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function CouponManagement({ dark, onToast }: CouponManagementProps) {
  const t = {
    surface:  dark ? "#0F1829" : "#ffffff",
    surface2: dark ? "#1A2035" : "#F4F5F7",
    surface3: dark ? "#232C44" : "#E8EAF0",
    border:   dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.09)",
    border2:  dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.14)",
    text:     dark ? "#E8EAF0" : "#1A1A1A",
    textSec:  dark ? "#8B8FA8" : "#4A4A58",
    textHint: dark ? "#5A6080" : "#A0A0AA",
    pageBg:   dark ? "#0A0F1E" : "#F4F5F7",
    accent:   "#7C6AF7",
    accentBg: "rgba(124,106,247,0.12)",
    accentBd: "rgba(124,106,247,0.2)",
  };

  const [searchQ, setSearchQ] = useState("");
  const [debouncedSearchQ, setDebouncedSearchQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"전체 상태" | CouponStatus>("전체 상태");
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [editingCouponId, setEditingCouponId] = useState<number | null>(null);
  const [drawerCoupon, setDrawerCoupon] = useState<Coupon | null>(null);
  const statusParamMap: Record<CouponStatus, AdminCouponStatus> = {
    "활성": "ACTIVE",
    "비활성": "INACTIVE",
    "기간만료": "EXPIRED",
    "소진됨": "EXHAUSTED",
  };
  const statusParam: AdminCouponStatus | undefined = statusParamMap[statusFilter as CouponStatus];
  const couponListQuery = useCouponsQuery({
    keyword: debouncedSearchQ || undefined,
    status: statusParam,
    page: 1,
    size: 100,
  });
  const couponStatsQuery = useCouponStatsQuery();
  const couponDetailQuery = useCouponDetailQuery(editingCouponId);
  const createCouponMutation = useCreateCouponMutation();
  const updateCouponMutation = useUpdateCouponMutation();
  const deleteCouponMutation = useDeleteCouponMutation();

  const coupons = couponListQuery.data?.items.map(mapAdminCoupon) ?? [];

  useEffect(() => {
    const query = searchQ.trim();
    const timer = window.setTimeout(() => {
      setDebouncedSearchQ(query.length >= 2 ? query : "");
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchQ]);

  useEffect(() => {
    if (
      editingCouponId == null
      || couponDetailQuery.isFetching
      || !couponDetailQuery.data
    ) return;
    setEditingCoupon(mapAdminCoupon(couponDetailQuery.data));
    setShowModal(true);
    setEditingCouponId(null);
  }, [couponDetailQuery.data, couponDetailQuery.isFetching, editingCouponId]);

  useEffect(() => {
    if (editingCouponId == null || !couponDetailQuery.isError) return;
    onToast("쿠폰 상세 정보를 불러오지 못했습니다.", "warning");
    setEditingCouponId(null);
  }, [couponDetailQuery.isError, editingCouponId, onToast]);

  const thStyle: React.CSSProperties = {
    padding: "10px 14px", fontSize: 11, fontWeight: 700, color: t.textSec,
    textAlign: "left", whiteSpace: "nowrap", background: t.surface3,
    borderBottom: `1px solid ${t.border2}`, letterSpacing: "0.05em",
  };
  const tdStyle: React.CSSProperties = {
    padding: "12px 14px", fontSize: 13, color: t.text, borderBottom: `1px solid ${t.border}`, verticalAlign: "middle",
  };

  // Derived stat values
  const totalCoupons = couponStatsQuery.data?.total_coupons ?? "—";
  const activeCoupons = couponStatsQuery.data?.active_coupons ?? "—";
  const totalUses = couponStatsQuery.data?.total_usage_count ?? "—";
  const totalDiscount = couponStatsQuery.data
    ? `$${Number(couponStatsQuery.data.total_discount_amount).toLocaleString()}`
    : "—";

  // Filtered list
  const filtered = coupons;

  async function handleSave(data: Omit<Coupon, "id" | "usageHistory">) {
    const appliesToAllProducts = data.scopeAll || data.scopeProducts.length === 3;
    const writePayload: CouponWriteRequest = {
      name: data.name,
      partner_id: data.partnerId,
      discount_rate: data.discountValue / 100,
      commission_rate: data.commissionRate / 100,
      applicable_tiers: appliesToAllProducts
        ? []
        : data.scopeProducts.map((product) => product.toUpperCase()),
      max_uses: data.maxUses,
      per_user_limit: 1,
      valid_from: data.startDate ? `${data.startDate}T00:00:00Z` : null,
      valid_until: data.endDate ? `${data.endDate}T23:59:59Z` : null,
      is_active: data.status === "active",
    };

    if (editingCoupon) {
      try {
        await updateCouponMutation.mutateAsync({
          couponId: Number(editingCoupon.id),
          payload: writePayload,
        });
        onToast("쿠폰이 수정되었습니다.", "success");
        setShowModal(false);
        setEditingCoupon(null);
      } catch {
        onToast("쿠폰 수정에 실패했습니다.", "warning");
      }
      return;
    }
    const createPayload = {
      code: data.code,
      ...writePayload,
    };
    try {
      await createCouponMutation.mutateAsync(createPayload);
      onToast("쿠폰이 발행되었습니다.", "success");
      setShowModal(false);
      setEditingCoupon(null);
    } catch (error) {
      const errorData = axios.isAxiosError<{
        code?: string;
        error_code?: string;
        detail?: { code?: string; error_code?: string };
      }>(error)
        ? error.response?.data
        : undefined;
      const errorCode = errorData?.code
        ?? errorData?.error_code
        ?? errorData?.detail?.code
        ?? errorData?.detail?.error_code;
      onToast(
        errorCode === "duplicate_coupon_code"
          ? "이미 사용 중인 쿠폰 코드입니다."
          : "쿠폰 발행에 실패했습니다.",
        "warning",
      );
    }
  }

  async function handleDelete(coupon: Coupon) {
    const count = coupon.usedCount ?? 0;
    if (count > 0) {
      alert(`이 쿠폰은 사용 이력이 ${count}건 있어 삭제할 수 없습니다.`);
      return;
    }
    if (window.confirm("이 쿠폰을 삭제하시겠습니까?")) {
      try {
        await deleteCouponMutation.mutateAsync(Number(coupon.id));
        onToast("쿠폰이 삭제되었습니다.", "success");
      } catch {
        onToast("쿠폰 삭제에 실패했습니다.", "warning");
      }
    }
  }

  const inputStyle: React.CSSProperties = {
    height: 38, padding: "0 12px", borderRadius: 8,
    border: `1px solid ${t.border2}`, background: t.surface2,
    color: t.text, fontSize: 13, outline: "none",
    fontFamily: "'Inter','DM Sans','Noto Sans KR',sans-serif",
  };

  return (
    <div style={{ padding: "24px 28px 48px", fontFamily: "'Inter','DM Sans','Noto Sans KR',sans-serif", minHeight: "100vh", background: t.pageBg }}>

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, margin: 0 }}>쿠폰 관리</h1>
        <p style={{ fontSize: 13, color: t.textSec, marginTop: 4, marginBottom: 0 }}>인플루언서/파트너 영업용 할인 쿠폰을 발행하고 사용 현황을 관리합니다.</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "발행된 쿠폰",    value: totalCoupons,  caption: "전체 등록 건수",  color: t.text,    suffix: typeof totalCoupons === "number" ? "건" : "" },
          { label: "활성 쿠폰",      value: activeCoupons, caption: "현재 사용 가능",  color: "#16A34A", suffix: typeof activeCoupons === "number" ? "건" : "" },
          { label: "총 사용 횟수",   value: totalUses,   caption: "전체 쿠폰 합산",  color: t.text,    suffix: typeof totalUses === "number" ? "회" : "" },
          { label: "할인 적용 총액", value: totalDiscount, caption: "누적 할인 금액", color: t.text, suffix: "" },
        ].map(card => (
          <div key={card.label} style={{ background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: t.textSec, marginBottom: 8, letterSpacing: "0.04em" }}>{card.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: card.color, letterSpacing: "-0.5px" }}>
              {typeof card.value === "number" ? card.value.toLocaleString() : card.value}
              {card.suffix && <span style={{ fontSize: 14, fontWeight: 500, color: t.textSec, marginLeft: 3 }}>{card.suffix}</span>}
            </div>
            <div style={{ fontSize: 11, color: t.textHint, marginTop: 4 }}>{card.caption}</div>
          </div>
        ))}
      </div>

      {/* Main card */}
      <div style={{ background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 14, overflow: "hidden" }}>

        {/* Toolbar */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>쿠폰 목록</span>
          <button onClick={() => { setEditingCoupon(null); setShowModal(true); }} style={{
            height: 36, padding: "0 16px", borderRadius: 8, border: "none", background: "#7C6AF7",
            color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6, fontFamily: "'Inter','DM Sans','Noto Sans KR',sans-serif",
          }}>
            <Plus size={14} /> 쿠폰 발행
          </button>
        </div>

        {/* Search & filter bar */}
        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", gap: 10, alignItems: "center" }}>
          <input
            value={searchQ} onChange={e => setSearchQ(e.target.value)}
            placeholder="쿠폰 코드 또는 파트너명 검색"
            style={{ ...inputStyle, flex: 1 }}
          />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} style={{ ...inputStyle, width: 150, cursor: "pointer", flexShrink: 0 }}>
            {(["전체 상태", "활성", "비활성", "기간만료", "소진됨"] as const).map(o => <option key={o}>{o}</option>)}
          </select>
          <button onClick={() => { setSearchQ(""); setStatusFilter("전체 상태"); }} style={{ height: 38, padding: "0 14px", borderRadius: 8, border: `1px solid ${t.border2}`, background: "transparent", color: t.textSec, fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, fontFamily: "'Inter','DM Sans','Noto Sans KR',sans-serif" }}>초기화</button>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <colgroup>
              <col style={{ width: "14%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "16%" }} />
            </colgroup>
            <thead>
              <tr>
                <th style={thStyle}>쿠폰 코드</th>
                <th style={thStyle}>담당 파트너</th>
                <th style={thStyle}>할인</th>
                <th style={thStyle}>사용 현황</th>
                <th style={thStyle}>유효 기간</th>
                <th style={thStyle}>상태</th>
                <th style={thStyle}>관리</th>
              </tr>
            </thead>
            <tbody>
              {couponListQuery.isLoading ? (
                <tr><td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: t.textHint, padding: "40px 14px" }}>쿠폰 목록을 불러오는 중입니다.</td></tr>
              ) : couponListQuery.isError ? (
                <tr><td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: "#DC2626", padding: "40px 14px" }}>쿠폰 목록을 불러오지 못했습니다.</td></tr>
              ) : coupons.length === 0 ? (
                <tr><td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: t.textHint, padding: "40px 14px" }}>발행된 쿠폰이 없습니다.</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: t.textHint, padding: "40px 14px" }}>검색 결과가 없습니다.</td></tr>
              ) : filtered.map(coupon => {
                const used = coupon.usedCount ?? coupon.usageHistory.length;
                const pct = Math.min(100, (used / coupon.maxUses) * 100);
                const status = computeCouponStatus(coupon);
                const scopeLabel = coupon.scopeAll
                  ? "전체"
                  : coupon.scopeProducts.join("/");

                return (
                  <tr key={coupon.id} style={{ transition: "background 0.1s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = t.surface2)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* 쿠폰 코드 */}
                    <td style={tdStyle}>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 13, color: t.text, letterSpacing: "0.02em" }}>{coupon.code}</span>
                      <div style={{ fontSize: 11, color: t.textHint, marginTop: 2 }}>{coupon.name}</div>
                    </td>

                    {/* 담당 파트너 */}
                    <td style={tdStyle}>
                      <span style={{ fontSize: 13, color: t.text }}>{coupon.partnerName ?? coupon.partnerEmail ?? "—"}</span>
                      <div style={{ fontSize: 11, color: t.textHint, marginTop: 2 }}>커미션 {coupon.commissionRate}%</div>
                    </td>

                    {/* 할인 */}
                    <td style={tdStyle}>
                      <span style={{ fontSize: 13, color: t.text }}>{coupon.discountValue}%</span>
                      <span style={{ fontSize: 11, color: t.textSec, marginLeft: 4 }}>({scopeLabel})</span>
                    </td>

                    {/* 사용 현황 */}
                    <td style={tdStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          onClick={() => setDrawerCoupon(coupon)}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 13, color: "#7C6AF7", textDecoration: "underline", fontFamily: "'DM Mono',monospace", fontWeight: 600, whiteSpace: "nowrap" }}
                        >
                          {used} / {coupon.maxUses}
                        </button>
                        <div style={{ width: 56, height: 5, borderRadius: 3, background: t.surface3, overflow: "hidden", flexShrink: 0 }}>
                          <div style={{ height: "100%", width: `${pct}%`, borderRadius: 3, background: pct >= 90 ? "#DC2626" : pct >= 60 ? "#D97706" : "#7C6AF7", transition: "width 0.3s" }} />
                        </div>
                      </div>
                    </td>

                    {/* 유효 기간 */}
                    <td style={tdStyle}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: t.textSec, lineHeight: 1.6 }}>
                        {coupon.startDate}<br />~ {coupon.endDate}
                      </div>
                    </td>

                    {/* 상태 */}
                    <td style={tdStyle}><StatusBadge status={status} /></td>

                    {/* 관리 */}
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={() => setEditingCouponId(Number(coupon.id))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#7C6AF7", padding: 0, fontFamily: "'Inter','DM Sans','Noto Sans KR',sans-serif", fontWeight: 500 }}>수정</button>
                        <button onClick={() => handleDelete(coupon)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#DC2626", padding: 0, fontFamily: "'Inter','DM Sans','Noto Sans KR',sans-serif", fontWeight: 500 }}>삭제</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <CouponModal
          dark={dark} t={t}
          editing={editingCoupon}
          coupons={coupons}
          onClose={() => { setShowModal(false); setEditingCoupon(null); }}
          onSave={handleSave}
        />
      )}

      {/* Usage drawer */}
      {drawerCoupon && (
        <UsageDrawer
          key={drawerCoupon.id}
          coupon={drawerCoupon}
          t={t}
          onClose={() => setDrawerCoupon(null)}
        />
      )}
    </div>
  );
}
