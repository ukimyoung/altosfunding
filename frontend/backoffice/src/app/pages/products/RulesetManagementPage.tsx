import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import type { AdminRuleset, UpsertRulesetPayload } from "@/api/ruleset";
import { RulesetModal } from "../../components/products/RulesetModal";
import { useAppShell } from "../../layouts/AppShell";
import { Toast } from "../../components/shared/Toast";
import {
  useCreateRulesetMutation,
  useGetRulesetDetailQuery,
  useListRulesetsQuery,
  useUpdateRulesetMutation,
} from "../../queries/rulesets";

const formatPercent = (value: number | null | undefined) =>
  typeof value === "number" ? `${value}%` : "-";
const formatDays = (value: number | null | undefined) =>
  typeof value === "number" ? `${value}일` : "-";

export function RulesetManagementPage() {
  const { dark } = useAppShell();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRulesetId, setEditingRulesetId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "warning" } | null>(null);

  const { data: rulesetsData } = useListRulesetsQuery({ page: 1, size: 100 });
  const {
    data: rulesetDetail,
    isFetching: isRulesetDetailFetching,
    isError: isRulesetDetailError,
  } = useGetRulesetDetailQuery(
    editingRulesetId,
    Boolean(editingRulesetId),
  );
  const createRulesetMutation = useCreateRulesetMutation();
  const updateRulesetMutation = useUpdateRulesetMutation();

  const rulesets = rulesetsData?.items ?? [];
  const modalRuleset = editingRulesetId ? rulesetDetail ?? null : null;

  useEffect(() => {
    if (
      editingRulesetId
      && !isRulesetDetailFetching
      && rulesetDetail?.id === editingRulesetId
    ) {
      setIsModalOpen(true);
    }
  }, [editingRulesetId, isRulesetDetailFetching, rulesetDetail]);

  useEffect(() => {
    if (!editingRulesetId || isRulesetDetailFetching || !isRulesetDetailError) return;

    setToast({ message: "룰셋 상세 조회 중 오류가 발생했습니다", type: "warning" });
    setEditingRulesetId(null);
  }, [editingRulesetId, isRulesetDetailError, isRulesetDetailFetching]);

  const t = {
    surface: dark ? "#0F1829" : "#ffffff",
    surface2: dark ? "#1A2035" : "#F4F5F7",
    border: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.09)",
    text: dark ? "#E8EAF0" : "#1A1A1A",
    textSec: dark ? "#8B8FA8" : "#4A4A58",
    textHint: dark ? "#5A6080" : "#A0A0AA",
    pageBg: dark ? "#0A0F1E" : "#F4F5F7",
    accent: "#7C6AF7",
  };

  const handleAddRuleset = () => {
    setEditingRulesetId(null);
    setIsModalOpen(true);
  };

  const handleEditRuleset = (ruleset: AdminRuleset) => {
    setEditingRulesetId(ruleset.id);
  };

  const handleSaveRuleset = (payload: UpsertRulesetPayload) => {
    const mutation = payload.id ? updateRulesetMutation : createRulesetMutation;

    mutation.mutate(payload, {
      onSuccess: () => {
        setToast({
          message: payload.id ? "룰셋이 수정되었습니다" : "룰셋이 추가되었습니다",
          type: "success",
        });
        setIsModalOpen(false);
        setEditingRulesetId(null);
      },
      onError: () => {
        setToast({ message: "룰셋 저장 중 오류가 발생했습니다", type: "warning" });
      },
    });
  };

  return (
    <div style={{ padding: 32, background: t.pageBg, minHeight: "100vh" }}>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: t.text, margin: 0, marginBottom: 8 }}>
            룰셋 관리
          </h1>
          <p style={{ fontSize: 13, color: t.textSec, margin: 0 }}>
            챌린지 및 펀디드 상품에 적용할 룰셋을 관리합니다
          </p>
        </div>
        <button
          onClick={handleAddRuleset}
          style={{
            height: 36,
            padding: "0 16px",
            borderRadius: 8,
            border: "none",
            background: t.accent,
            color: "#fff",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Plus size={16} />
          룰셋 추가
        </button>
      </div>

      {/* Rulesets Table */}
      <div style={{
        background: t.surface,
        borderRadius: 12,
        border: `1px solid ${t.border}`,
        overflow: "hidden",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: t.surface2, borderBottom: `1px solid ${t.border}` }}>
              {["룰셋 명", "일일 손실", "최대 손실", "수익 목표", "최소 거래일", "미활동 일수", "연결 상품", "관리"].map(h => (
                <th key={h} style={{
                  padding: "12px 16px",
                  textAlign: "left",
                  fontSize: 11,
                  fontWeight: 600,
                  color: t.textSec,
                  whiteSpace: "nowrap",
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rulesets.map(ruleset => {
              return (
                <tr key={ruleset.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                  <td style={{ padding: "16px", fontSize: 13, fontWeight: 500, color: t.text }}>
                    {ruleset.name}
                  </td>
                  <td style={{ padding: "16px", fontSize: 13, color: t.textSec }}>
                    {formatPercent(ruleset.daily_loss_limit_pct)}
                  </td>
                  <td style={{ padding: "16px", fontSize: 13, color: t.textSec }}>
                    {formatPercent(ruleset.max_dd_normal_pct)}
                  </td>
                  <td style={{ padding: "16px", fontSize: 13, color: t.textSec }}>
                    {formatPercent(ruleset.profit_target_pct)}
                  </td>
                  <td style={{ padding: "16px", fontSize: 13, color: t.textSec }}>
                    {formatDays(ruleset.min_trading_days)}
                  </td>
                  <td style={{ padding: "16px", fontSize: 13, color: t.textSec }}>
                    {formatDays(ruleset.inactivity_days)}
                  </td>
                  <td style={{ padding: "16px" }}>
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "4px 10px",
                      borderRadius: 9999,
                      fontSize: 11,
                      fontWeight: 600,
                      background: t.surface2,
                      color: t.textSec,
                      border: `1px solid ${t.border}`,
                    }}>
                      {ruleset.connected_products_count}개
                    </span>
                  </td>
                  <td style={{ padding: "16px" }}>
                    <button
                      onClick={() => handleEditRuleset(ruleset)}
                      disabled={isRulesetDetailFetching && editingRulesetId === ruleset.id}
                      style={{
                        height: 32,
                        padding: "0 12px",
                        borderRadius: 6,
                        border: `1px solid ${t.border}`,
                        background: t.surface2,
                        color: t.text,
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: isRulesetDetailFetching && editingRulesetId === ruleset.id
                          ? "wait"
                          : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isRulesetDetailFetching && editingRulesetId === ruleset.id
                        ? "불러오는 중"
                        : "편집"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Ruleset Modal */}
      <RulesetModal
        ruleset={modalRuleset}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingRulesetId(null);
        }}
        onSave={handleSaveRuleset}
        dark={dark}
      />
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          dark={dark}
          onDone={() => setToast(null)}
        />
      )}
    </div>
  );
}
