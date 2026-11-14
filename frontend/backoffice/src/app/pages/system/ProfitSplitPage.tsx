import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useAppShell } from '../../layouts/AppShell';
import { buildPaginationItems } from '../../components/shared/DataTable';
import { Toast } from '../../components/shared/Toast';
import {
  useNetworkFeeSettingsQuery,
  useProfitSplitHistoryQuery,
  useProfitSplitSettingsQuery,
  useUpdateNetworkFeeSettingsMutation,
  useUpdateProfitSplitSettingsMutation,
} from '../../queries/payoutSettings';

type ToastType = 'success' | 'warning';

interface NetworkFee {
  id: string;
  name: string;
  description: string;
  fee: number;
}

const HISTORY_PER_PAGE = 10;

interface AddNetworkModalProps {
  dark: boolean;
  onClose: () => void;
  onAdd: (network: NetworkFee) => void;
}

function AddNetworkModal({ dark, onClose, onAdd }: AddNetworkModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fee, setFee] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const t = {
    surface: dark ? '#0F1829' : '#ffffff',
    surface2: dark ? '#1A2035' : '#F4F5F7',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    textHint: dark ? '#5A6080' : '#A0A0AA',
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = '네트워크 이름을 입력하세요.';
    if (!description.trim()) nextErrors.description = '설명을 입력하세요.';
    if (!fee || Number.isNaN(Number(fee)) || Number(fee) < 0) {
      nextErrors.fee = '올바른 수수료를 입력하세요.';
    }
    return nextErrors;
  };

  const handleAdd = () => {
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    onAdd({
      id: `net-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      fee: Number(fee),
    });
    onClose();
  };

  const fieldStyle = {
    width: '100%',
    height: 36,
    padding: '0 12px',
    borderRadius: 8,
    border: `1px solid ${t.border}`,
    background: t.surface2,
    color: t.text,
    fontSize: 13,
    boxSizing: 'border-box' as const,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          background: t.surface,
          borderRadius: 12,
          width: 420,
          padding: 24,
          border: `1px solid ${t.border}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>네트워크 추가</div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: t.textSec,
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: t.textSec, marginBottom: 6 }}>
            네트워크 이름 <span style={{ color: '#DC2626' }}>*</span>
          </div>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="예: BEP-20"
            style={fieldStyle}
          />
          {errors.name && (
            <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>{errors.name}</div>
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: t.textSec, marginBottom: 6 }}>
            설명 <span style={{ color: '#DC2626' }}>*</span>
          </div>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="예: BNB Chain 네트워크 USDT"
            style={fieldStyle}
          />
          {errors.description && (
            <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>{errors.description}</div>
          )}
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: t.textSec, marginBottom: 6 }}>
            수수료 <span style={{ color: '#DC2626' }}>*</span>
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type="number"
              value={fee}
              onChange={(event) => setFee(event.target.value)}
              placeholder="0"
              min={0}
              step={0.1}
              style={{ ...fieldStyle, flex: 1, paddingRight: 44 }}
            />
            <span
              style={{
                position: 'absolute',
                right: 12,
                fontSize: 12,
                color: t.textHint,
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              USDT
            </span>
          </div>
          {errors.fee && (
            <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>{errors.fee}</div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 36,
              padding: '0 16px',
              borderRadius: 8,
              border: 'none',
              background: t.surface2,
              color: t.textSec,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleAdd}
            style={{
              height: 36,
              padding: '0 20px',
              borderRadius: 8,
              border: 'none',
              background: '#7C6AF7',
              color: '#fff',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            추가
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProfitSplitPage() {
  const { dark } = useAppShell();
  const { data: profitSplitSettings } = useProfitSplitSettingsQuery();
  const { data: networkFeeSettings } = useNetworkFeeSettingsQuery();
  const updateProfitSplitSettings = useUpdateProfitSplitSettingsMutation();
  const updateNetworkFeeSettings = useUpdateNetworkFeeSettingsMutation();
  const [traderRatio, setTraderRatio] = useState(80);
  const [companyRatio, setCompanyRatio] = useState(20);
  const [networks, setNetworks] = useState<NetworkFee[]>([]);
  const [showAddNetwork, setShowAddNetwork] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [isProfitSplitDirty, setIsProfitSplitDirty] = useState(false);
  const [isNetworkFeesDirty, setIsNetworkFeesDirty] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const historyQueryParams = useMemo(
    () => ({
      page: historyPage,
      size: HISTORY_PER_PAGE,
    }),
    [historyPage],
  );
  const profitSplitHistoryQuery = useProfitSplitHistoryQuery(historyQueryParams);

  useEffect(() => {
    if (isProfitSplitDirty) return;
    if (typeof profitSplitSettings?.trader_pct !== 'number') return;
    setTraderRatio(profitSplitSettings.trader_pct);
    if (typeof profitSplitSettings.company_pct === 'number') {
      setCompanyRatio(profitSplitSettings.company_pct);
    }
  }, [isProfitSplitDirty, profitSplitSettings?.company_pct, profitSplitSettings?.trader_pct]);

  useEffect(() => {
    if (isNetworkFeesDirty) return;
    if (!networkFeeSettings) return;

    setNetworks(
      networkFeeSettings
        .filter((network) => network.is_active)
        .map((network) => ({
          id: network.name,
          name: network.name,
          description: network.desc,
          fee: network.fee,
        })),
    );
  }, [isNetworkFeesDirty, networkFeeSettings]);

  const exampleTotal = 10000;
  const traderReceives = (exampleTotal * traderRatio) / 100;
  const companyReceives = exampleTotal - traderReceives;
  const profitSplitHistory = profitSplitHistoryQuery.data?.items ?? [];
  const historyTotal = profitSplitHistoryQuery.data?.total ?? 0;
  const historyResponsePage =
    !profitSplitHistoryQuery.isPlaceholderData && profitSplitHistoryQuery.data
      ? profitSplitHistoryQuery.data.page
      : historyPage;
  const historyPageSize = profitSplitHistoryQuery.data?.size ?? HISTORY_PER_PAGE;
  const historyTotalPages = Math.max(1, profitSplitHistoryQuery.data?.pages ?? 1);
  const safeHistoryPage = Math.min(Math.max(1, historyResponsePage), historyTotalPages);
  const historyPaginationItems = buildPaginationItems({
    currentPage: safeHistoryPage,
    totalPages: historyTotalPages,
    onPageChange: setHistoryPage,
  });
  const hasInvalidNetwork = networks.some(
    (network) =>
      !network.name.trim() ||
      !network.description.trim() ||
      !Number.isFinite(network.fee) ||
      network.fee < 0,
  );

  useEffect(() => {
    if (!profitSplitHistoryQuery.data || profitSplitHistoryQuery.isPlaceholderData) return;
    if (historyPage !== safeHistoryPage) {
      setHistoryPage(safeHistoryPage);
    }
  }, [
    historyPage,
    profitSplitHistoryQuery.data,
    profitSplitHistoryQuery.isPlaceholderData,
    safeHistoryPage,
  ]);

  const t = {
    surface: dark ? '#0F1829' : '#ffffff',
    surface2: dark ? '#1A2035' : '#F4F5F7',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    border2: dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    textHint: dark ? '#5A6080' : '#A0A0AA',
    pageBg: dark ? '#0A0F1E' : '#F4F5F7',
    accent: '#7C6AF7',
    accentBg: dark ? 'rgba(124,106,247,0.12)' : 'rgba(124,106,247,0.08)',
  };

  const card = {
    background: t.surface,
    borderRadius: 14,
    border: `1px solid ${t.border}`,
    padding: '20px 24px',
  };

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
  };
  const formatPct = (value: number) =>
    value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const formatHistoryDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(date)
      .replace(/\. /g, '.')
      .replace(/\.$/, '');
  };

  const handleDeleteNetwork = (id: string) => {
    setIsNetworkFeesDirty(true);
    setNetworks((prev) => prev.filter((network) => network.id !== id));
  };

  const handleNetworkFeeChange = (id: string, newFee: number) => {
    setIsNetworkFeesDirty(true);
    setNetworks((prev) =>
      prev.map((network) => (network.id === id ? { ...network, fee: newFee } : network)),
    );
  };

  const handleSaveNetworkFees = () => {
    if (hasInvalidNetwork) {
      showToast('네트워크 이름, 설명, 0 이상의 수수료를 입력하세요.', 'warning');
      return;
    }

    const requestBody = {
      networks: networks.map((network) => ({
        name: network.name,
        desc: network.description,
        fee: network.fee,
        is_active: true,
      })),
    };

    updateNetworkFeeSettings.mutate(requestBody, {
      onSuccess: (data) => {
        setIsNetworkFeesDirty(false);
        setNetworks(
          data
            .filter((network) => network.is_active)
            .map((network) => ({
              id: network.name,
              name: network.name,
              description: network.desc,
              fee: network.fee,
            })),
        );
        showToast('네트워크별 출금 수수료 설정이 저장되었습니다.', 'success');
      },
      onError: () => {
        showToast('네트워크별 출금 수수료 저장에 실패했습니다.', 'warning');
      },
    });
  };

  const handleSaveProfitSplit = () => {
    updateProfitSplitSettings.mutate(
      { trader_pct: traderRatio },
      {
        onSuccess: (data) => {
          setIsProfitSplitDirty(false);
          setTraderRatio(data.trader_pct);
          setCompanyRatio(data.company_pct);
          showToast('기본 분배 비율이 저장되었습니다.', 'success');
        },
        onError: () => {
          showToast('기본 분배 비율 저장에 실패했습니다.', 'warning');
        },
      },
    );
  };

  return (
    <div style={{ padding: 32, background: t.pageBg, minHeight: 'calc(100vh - 52px)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 28,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: t.text, margin: 0, marginBottom: 8 }}>
            수익 분배 / 출금 수수료 설정
          </h1>
          <p style={{ fontSize: 13, color: t.textSec, margin: 0 }}>
            펀디드 계좌의 수익 배분 비율과 출금 수수료를 설정합니다.
          </p>
        </div>
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: '560px 1fr', gap: 20, alignItems: 'start' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={card}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>기본 분배 비율</div>
              <button
                type="button"
                onClick={handleSaveProfitSplit}
                disabled={updateProfitSplitSettings.isPending}
                style={{
                  height: 30,
                  padding: '0 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: t.accent,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: updateProfitSplitSettings.isPending ? 'not-allowed' : 'pointer',
                  opacity: updateProfitSplitSettings.isPending ? 0.65 : 1,
                }}
              >
                {updateProfitSplitSettings.isPending ? '저장 중' : '저장'}
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: 'flex',
                  height: 36,
                  borderRadius: 10,
                  overflow: 'hidden',
                  border: `1px solid ${t.border}`,
                }}
              >
                <div
                  style={{
                    width: `${traderRatio}%`,
                    background: t.accent,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'width 0.2s ease',
                  }}
                >
                  <span
                    style={{ fontSize: 12, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap' }}
                  >
                    트레이더 {traderRatio}%
                  </span>
                </div>
                <div
                  style={{
                    flex: 1,
                    background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'flex 0.2s ease',
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: t.textSec,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    회사 {companyRatio}%
                  </span>
                </div>
              </div>
            </div>

            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <span style={{ fontSize: 13, color: t.textSec }}>트레이더 수익 비율</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: t.accent }}>
                  {traderRatio}%
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={100}
                step={5}
                value={traderRatio}
                onChange={(event) => {
                  const nextTraderRatio = Number(event.target.value);
                  setIsProfitSplitDirty(true);
                  setTraderRatio(nextTraderRatio);
                  setCompanyRatio(100 - nextTraderRatio);
                }}
                style={{ width: '100%', accentColor: t.accent, cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 11, color: t.textHint }}>50%</span>
                <span style={{ fontSize: 11, color: t.textHint }}>100%</span>
              </div>
            </div>
          </div>

          <div
            style={{
              background: t.surface2,
              borderRadius: 14,
              border: `1px solid ${t.border}`,
              padding: '20px 24px',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 16 }}>
              💡 적용 예시
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 16,
              }}
            >
              <span style={{ fontSize: 13, color: t.textSec, flexShrink: 0 }}>
                트레이더 수익 $10,000 발생 시
              </span>
              <div style={{ display: 'flex', gap: 24 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: t.textHint, marginBottom: 3 }}>
                    트레이더 수령
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: t.accent,
                      fontFamily: "'DM Mono', monospace",
                    }}
                  >
                    ${traderReceives.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: t.textHint, marginTop: 2 }}>
                    {traderRatio}% 기준
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: t.textHint, marginBottom: 3 }}>회사 수령</div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: t.text,
                      fontFamily: "'DM Mono', monospace",
                    }}
                  >
                    ${companyReceives.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: t.textHint, marginTop: 2 }}>
                    {companyRatio}% 기준
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={card}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                네트워크별 출금 수수료
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowAddNetwork(true)}
                  style={{
                    height: 32,
                    padding: '0 14px',
                    borderRadius: 8,
                    border: `1px solid ${t.border2}`,
                    background: 'transparent',
                    color: t.textSec,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  + 네트워크 추가
                </button>
                <button
                  type="button"
                  onClick={handleSaveNetworkFees}
                  disabled={updateNetworkFeeSettings.isPending || hasInvalidNetwork}
                  style={{
                    height: 32,
                    padding: '0 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: t.accent,
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor:
                      updateNetworkFeeSettings.isPending || hasInvalidNetwork
                        ? 'not-allowed'
                        : 'pointer',
                    opacity: updateNetworkFeeSettings.isPending || hasInvalidNetwork ? 0.65 : 1,
                  }}
                >
                  {updateNetworkFeeSettings.isPending ? '저장 중' : '저장'}
                </button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: t.textSec, marginBottom: 20, lineHeight: 1.6 }}>
              외부 지갑 출금 시 네트워크별로 차감되는 수수료를 설정합니다.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {networks.map((network) => (
                <div
                  key={network.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderRadius: 10,
                    border: `1px solid ${t.border}`,
                    background: t.surface2,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 2 }}>
                      {network.name}
                    </div>
                    <div style={{ fontSize: 12, color: t.textHint }}>{network.description}</div>
                  </div>
                  <div
                    style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
                  >
                    <input
                      type="number"
                      value={Number.isFinite(network.fee) ? network.fee : ''}
                      onChange={(event) =>
                        handleNetworkFeeChange(
                          network.id,
                          event.target.value === '' ? Number.NaN : Number(event.target.value),
                        )
                      }
                      min={0}
                      step={0.1}
                      style={{
                        width: 100,
                        height: 32,
                        padding: '0 40px 0 8px',
                        borderRadius: 8,
                        border: `1px solid ${t.border}`,
                        background: t.surface,
                        color: t.text,
                        fontSize: 13,
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        right: 8,
                        fontSize: 11,
                        color: t.textHint,
                        pointerEvents: 'none',
                        userSelect: 'none',
                      }}
                    >
                      USDT
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteNetwork(network.id)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: t.textHint,
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.color = '#DC2626';
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.color = t.textHint;
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
              {networks.length === 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '24px 0',
                    fontSize: 13,
                    color: t.textHint,
                  }}
                >
                  등록된 네트워크가 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 16 }}>
              비율 변경 이력
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                gap: '0 12px',
                padding: '7px 10px',
                background: t.surface2,
                borderRadius: 8,
                marginBottom: 4,
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 600, color: t.textHint }}>변경</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: t.textHint }}>처리자</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: t.textHint }}>일시</div>
            </div>

            {profitSplitHistoryQuery.isLoading && (
              <div
                style={{
                  padding: '24px 0',
                  textAlign: 'center',
                  fontSize: 13,
                  color: t.textHint,
                }}
              >
                비율 변경 이력을 불러오는 중입니다.
              </div>
            )}
            {profitSplitHistoryQuery.isError && (
              <div
                style={{
                  padding: '24px 0',
                  textAlign: 'center',
                  fontSize: 13,
                  color: t.textHint,
                }}
              >
                비율 변경 이력을 불러오지 못했습니다.
              </div>
            )}
            {!profitSplitHistoryQuery.isLoading &&
              !profitSplitHistoryQuery.isError &&
              profitSplitHistory.length === 0 && (
                <div
                  style={{
                    padding: '24px 0',
                    textAlign: 'center',
                    fontSize: 13,
                    color: t.textHint,
                  }}
                >
                  비율 변경 이력이 없습니다.
                </div>
              )}
            {profitSplitHistory.map((log, index) => (
              <div
                key={log.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  gap: '0 12px',
                  alignItems: 'center',
                  padding: '10px 10px',
                  borderBottom:
                    index < profitSplitHistory.length - 1 ? `1px solid ${t.border}` : 'none',
                }}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '3px 9px',
                    borderRadius: 9999,
                    background: t.accentBg,
                    fontSize: 11,
                    fontWeight: 600,
                    color: t.accent,
                    fontFamily: "'DM Mono', monospace",
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatPct(log.old_pct)}% → {formatPct(log.new_pct)}%
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: t.textSec,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {log.admin_email}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: t.textHint,
                    fontFamily: "'DM Mono', monospace",
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatHistoryDate(log.changed_at)}
                </div>
              </div>
            ))}
            {historyTotal > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: `1px solid ${t.border}`,
                }}
              >
                <div style={{ fontSize: 11, color: t.textHint }}>
                  {(safeHistoryPage - 1) * historyPageSize + 1}-
                  {Math.min(safeHistoryPage * historyPageSize, historyTotal)} / {historyTotal}건
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {historyPaginationItems.map((item) => (
                    <button
                      type="button"
                      key={item.key}
                      onClick={item.onClick}
                      disabled={item.disabled}
                      style={{
                        width: 28,
                        height: 28,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 6,
                        border: `1px solid ${item.active ? t.accent : t.border}`,
                        background: item.active ? t.accent : t.surface,
                        color: item.active ? '#fff' : t.text,
                        cursor: item.disabled ? 'not-allowed' : 'pointer',
                        fontSize: 12,
                        fontWeight: item.active ? 600 : 400,
                        opacity: item.disabled ? 0.4 : 1,
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddNetwork && (
        <AddNetworkModal
          dark={dark}
          onClose={() => setShowAddNetwork(false)}
          onAdd={(network) => {
            setIsNetworkFeesDirty(true);
            setNetworks((prev) => [...prev, network]);
          }}
        />
      )}
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
