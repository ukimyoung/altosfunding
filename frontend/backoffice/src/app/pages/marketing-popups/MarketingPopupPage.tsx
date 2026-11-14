import { useEffect, useState } from "react";
import { DeleteConfirm } from "../../components/marketing-popups/DeleteConfirm";
import { PopupModal } from "../../components/marketing-popups/PopupModal";
import { ReorderModal } from "../../components/marketing-popups/ReorderModal";
import { Toast } from "../../components/shared/Toast";
import { useAppShell } from "../../layouts/AppShell";
import {
  useCreateMarketingPopupMutation,
  useDeleteMarketingPopupMutation,
  useMarketingPopupsQuery,
  useReorderMarketingPopupsMutation,
  useUpdateMarketingPopupMutation,
} from "../../queries/marketingPopups";
import type {
  DisplayLocation,
  MarketingPopupToastType,
  MarketingPopupTheme,
  PopupBanner,
  PopupBannerSubmit,
} from "../../types/marketingPopup";

interface MarketingPopupPageProps {
  dark: boolean;
  onToast: (message: string, type?: MarketingPopupToastType) => void;
}

type ToastState = {
  message: string;
  type: MarketingPopupToastType;
};

function getMarketingPopupTheme(dark: boolean): MarketingPopupTheme {
  return {
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
}

function getDisplayLocationLabel(loc: DisplayLocation) {
  return loc === "before_login" ? "로그인 전" : "로그인 후";
}

function MarketingPopupPageContent({ dark, onToast }: MarketingPopupPageProps) {
  const [showModal, setShowModal]       = useState(false);
  const [editing, setEditing]           = useState<PopupBanner | null>(null);
  const [deleteId, setDeleteId]         = useState<string | null>(null);
  const [showReorder, setShowReorder]   = useState(false);
  const marketingPopupsQuery = useMarketingPopupsQuery();
  const createMarketingPopupMutation = useCreateMarketingPopupMutation();
  const updateMarketingPopupMutation = useUpdateMarketingPopupMutation();
  const reorderMarketingPopupsMutation = useReorderMarketingPopupsMutation();
  const deleteMarketingPopupMutation = useDeleteMarketingPopupMutation();
  const banners = marketingPopupsQuery.data ?? [];

  useEffect(() => {
    if (marketingPopupsQuery.isError) {
      onToast("팝업 배너 목록을 불러오지 못했습니다.", "warning");
    }
  }, [marketingPopupsQuery.isError]);

  const t = getMarketingPopupTheme(dark);

  const openAdd  = () => { setEditing(null); setShowModal(true); };
  const openEdit = (b: PopupBanner) => { setEditing(b); setShowModal(true); };

  const handleReorderSave = async (ordered: PopupBanner[]) => {
    if (reorderMarketingPopupsMutation.isPending) return;

    try {
      const payload = ordered.map((popup, index) => ({
        id: Number(popup.id),
        display_order: index,
      }));
      if (payload.some((popup) => !Number.isInteger(popup.id))) {
        throw new Error('Invalid marketing popup ID');
      }

      await reorderMarketingPopupsMutation.mutateAsync(payload);
      setShowReorder(false);
      onToast("노출 순서가 저장되었습니다.", "success");
    } catch {
      onToast("노출 순서를 저장하지 못했습니다.", "warning");
    }
  };

  const handleSave = async (data: PopupBannerSubmit) => {
    if (
      createMarketingPopupMutation.isPending
      || updateMarketingPopupMutation.isPending
    ) return;

    const exposureLocation = data.locations.length === 2
      ? "ALL"
      : data.locations[0] === "before_login"
        ? "BEFORE_LOGIN"
        : "AFTER_LOGIN";

    if (editing) {
      try {
        await updateMarketingPopupMutation.mutateAsync({
          popupId: editing.id,
          payload: {
            title: data.title,
            landing_url: data.landingUrl,
            exposure_location: exposureLocation,
            status: data.status === "active" ? "PUBLISHED" : "DRAFT",
          },
        });
        onToast("배너가 수정되었습니다.", "success");
      } catch {
        onToast("배너를 수정하지 못했습니다.", "warning");
        return;
      }
    } else {
      if (!data.imageFile) return;

      try {
        await createMarketingPopupMutation.mutateAsync({
          title: data.title,
          image: data.imageFile,
          landing_url: data.landingUrl,
          exposure_location: exposureLocation,
          status: data.status === "active" ? "PUBLISHED" : "DRAFT",
          display_order: 0,
        });

        onToast("배너가 등록되었습니다.", "success");
      } catch {
        onToast("배너를 등록하지 못했습니다.", "warning");
        return;
      }
    }
    setShowModal(false);
  };

  const handleDelete = async () => {
    if (!deleteId || deleteMarketingPopupMutation.isPending) return;

    try {
      await deleteMarketingPopupMutation.mutateAsync(deleteId);
      setDeleteId(null);
      onToast("배너가 삭제되었습니다.");
    } catch {
      onToast("배너를 삭제하지 못했습니다.", "warning");
    }
  };

  return (
    <div style={{ background: t.pageBg, minHeight: "100%", fontFamily: "'DM Sans','Noto Sans KR',sans-serif" }}>
      {/* Page header */}
      <div style={{ padding: "28px 32px 20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, margin: 0, marginBottom: 4 }}>마케팅 팝업 관리</h1>
          <p style={{ fontSize: 13, color: t.textSec, margin: 0 }}>
            프론트 화면에 노출되는 팝업 배너를 등록하고 노출 순서를 관리합니다.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => setShowReorder(true)}
            style={{ height: 40, padding: "0 18px", borderRadius: 10, border: `1px solid ${t.border2}`, background: "transparent", color: t.text, fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}
          >노출 순서 조정</button>
          <button
            onClick={openAdd}
            style={{ height: 40, padding: "0 20px", borderRadius: 10, border: "none", background: t.accent, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> 배너 등록
          </button>
        </div>
      </div>

      {/* Table card */}
      <div style={{ margin: "0 32px 32px", background: t.surface, borderRadius: 14, border: `1px solid ${t.border}`, overflow: "hidden" }}>
        {banners.length === 0 ? (
          <div style={{ padding: "72px 0", textAlign: "center", color: t.textHint, fontSize: 14 }}>
            등록된 팝업 배너가 없습니다.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: t.surface2, borderBottom: `1px solid ${t.border}` }}>
                {["순서", "제목", "썸네일", "랜딩 URL", "노출 위치", "상태", "관리"].map((h, i) => (
                  <th key={h} style={{
                    padding: "12px 16px", fontSize: 11, fontWeight: 700, color: t.textSec,
                    textAlign: i === 0 ? "center" : "left", whiteSpace: "nowrap",
                    letterSpacing: "0.04em", textTransform: "uppercase",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {banners.map((b, idx) => (
                  <tr
                    key={b.id}
                    onMouseEnter={e => e.currentTarget.style.background = t.surface2}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    style={{ borderBottom: `1px solid ${t.border}`, transition: "background 0.1s" }}
                  >
                    {/* 순서 */}
                    <td style={{ padding: "14px 16px", textAlign: "center", width: 60 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: t.textSec }}>{idx + 1}</span>
                    </td>

                    {/* 제목 */}
                    <td style={{ padding: "14px 16px", maxWidth: 200 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }} title={b.title}>
                        {b.title}
                      </span>
                    </td>

                    {/* 썸네일 */}
                    <td style={{ padding: "10px 16px", width: 70 }}>
                      <div style={{ width: 48, height: 60, borderRadius: 8, overflow: "hidden", border: `1px solid ${t.border2}`, flexShrink: 0 }}>
                        <img src={b.imageUrl} alt="thumb" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    </td>

                    {/* 랜딩 URL */}
                    <td style={{ padding: "14px 16px", maxWidth: 220 }}>
                      <a href={b.landingUrl} target="_blank" rel="noreferrer"
                        style={{ fontSize: 12, color: t.accent, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}
                        title={b.landingUrl}
                      >{b.landingUrl}</a>
                    </td>

                    {/* 노출 위치 */}
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {b.locations.map(loc => (
                          <span
                            key={loc}
                            style={{
                              fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20,
                              background: loc === "before_login" ? "rgba(59,130,246,0.12)" : "rgba(124,106,247,0.12)",
                              color: loc === "before_login" ? "#3B82F6" : t.accent,
                              border: `1px solid ${loc === "before_login" ? "rgba(59,130,246,0.25)" : t.accentBd}`,
                              whiteSpace: "nowrap",
                            }}
                          >{getDisplayLocationLabel(loc)}</span>
                        ))}
                      </div>
                    </td>

                    {/* 상태 */}
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{
                        fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
                        background: b.status === "active" ? "rgba(34,197,94,0.12)" : t.surface3,
                        color: b.status === "active" ? "#16A34A" : t.textSec,
                        border: `1px solid ${b.status === "active" ? "rgba(34,197,94,0.25)" : t.border2}`,
                      }}>
                        {b.status === "active" ? "게시중" : "종료"}
                      </span>
                    </td>

                    {/* 관리 */}
                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => openEdit(b)}
                          style={{ height: 30, padding: "0 12px", borderRadius: 6, border: `1px solid ${t.border2}`, background: "transparent", color: t.text, fontSize: 12, cursor: "pointer" }}
                        >수정</button>
                        <button
                          onClick={() => setDeleteId(b.id)}
                          style={{ height: 30, padding: "0 12px", borderRadius: 6, border: "1px solid rgba(220,38,38,0.3)", background: "rgba(220,38,38,0.06)", color: "#DC2626", fontSize: 12, cursor: "pointer" }}
                        >삭제</button>
                      </div>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {showReorder && <ReorderModal dark={dark} items={[...banners]} onClose={() => setShowReorder(false)} onSave={handleReorderSave} />}
      {showModal && (
        <PopupModal
          dark={dark}
          editing={editing}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          onToast={onToast}
          t={t}
        />
      )}
      {deleteId && (
        <DeleteConfirm
          onConfirm={handleDelete}
          onClose={() => setDeleteId(null)}
          t={t}
        />
      )}
    </div>
  );
}

export function MarketingPopupPage() {
  const { dark } = useAppShell();
  const [toast, setToast] = useState<ToastState | null>(null);

  const handleToast = (message: string, type: MarketingPopupToastType = "success") => {
    setToast({ message, type });
  };

  return (
    <>
      <MarketingPopupPageContent dark={dark} onToast={handleToast} />
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          dark={dark}
          onDone={() => setToast(null)}
        />
      )}
    </>
  );
}
