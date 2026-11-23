import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Plus, AlertCircle } from 'lucide-react';
import type { ChallengeProduct } from '../../types/product';
import { PRODUCT_STATUS } from '../../constants/status';
import { ChallengeProductModal } from '../../components/products/ChallengeProductModal';
import { useAppShell } from '../../layouts/AppShell';
import { Toast } from '../../components/shared/Toast';
import { ROUTE_BY_PAGE_ID } from '../../config/navigation';
import {
  useCreateCatalogProductMutation,
  useListCatalogProductsQuery,
  useUpdateCatalogProductMutation,
  useUpdateCatalogProductStatusMutation,
} from '../../queries/catalogProducts';
import {
  getCatalogProductUpdateValue,
  mapCatalogProductToChallengeProduct,
} from '../../utils/catalogProductMappers';
import {
  TablePagination,
  buildPaginationItems,
  buildPaginationSummary,
  getPaginationRange,
} from '../../components/shared/DataTable';

const PAGE_SIZE = 20;

const formatUsd = (value: number | null | undefined) =>
  value == null ? '-' : `$${Number(value).toLocaleString('en-US')}`;

export function ChallengeProductPage() {
  const { dark } = useAppShell();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = Number(searchParams.get('page') ?? '1') || 1;
  const listParams = {
    tier_type: 'CHALLENGE',
    page: currentPage,
    size: PAGE_SIZE,
  } as const;
  const { data: productData, refetch: refetchProducts } = useListCatalogProductsQuery(listParams);
  const createProductMutation = useCreateCatalogProductMutation();
  const updateProductMutation = useUpdateCatalogProductMutation();
  const updateStatusMutation = useUpdateCatalogProductStatusMutation();
  const [products, setProducts] = useState<ChallengeProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ChallengeProduct | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    type: 'suspend' | 'activate';
    productId: string;
  } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);

  useEffect(() => {
    setProducts((productData?.items ?? []).map(mapCatalogProductToChallengeProduct));
  }, [productData]);

  const totalRows = productData?.total ?? products.length;
  const responsePageSize = productData?.size ?? PAGE_SIZE;
  const totalPages = Math.max(1, productData?.pages ?? 1);
  const safeCurrentPage = Math.min(Math.max(1, productData?.page ?? currentPage), totalPages);
  const paginationRange = getPaginationRange({
    totalItems: totalRows,
    currentPage: safeCurrentPage,
    pageSize: responsePageSize,
    currentPageItemCount: products.length,
  });
  const setPage = (page: number) => {
    const next = new URLSearchParams(searchParams);
    page === 1 ? next.delete('page') : next.set('page', String(page));
    setSearchParams(next, { replace: true });
  };

  const t = {
    surface: dark ? '#0F1829' : '#ffffff',
    surface2: dark ? '#1A2035' : '#F4F5F7',
    surface3: dark ? '#232C44' : '#E8EAF0',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    border2: dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    textHint: dark ? '#5A6080' : '#A0A0AA',
    pageBg: dark ? '#0A0F1E' : '#F4F5F7',
    accent: '#7C6AF7',
    accentBg: 'rgba(124,106,247,0.12)',
  };

  const handleAddProduct = () => {
    setSelectedProduct(null);
    setIsModalOpen(true);
  };

  const handleEditProduct = (product: ChallengeProduct, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleRowClick = (product: ChallengeProduct) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleToggleStatus = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const product = products.find((p) => p.id === id);
    if (!product) return;

    setConfirmModal({
      type: product.status === 'ACTIVE' ? 'suspend' : 'activate',
      productId: id,
    });
  };

  const handleConfirmStatusChange = () => {
    if (!confirmModal) return;

    const isSuspending = confirmModal.type === 'suspend';
    updateStatusMutation.mutate({
      productId: confirmModal.productId,
      payload: { is_active: !isSuspending },
    }, {
      onSuccess: () => {
        setConfirmModal(null);
        setToast({
          message: isSuspending ? '상품이 사용중지 되었습니다' : '상품이 재활성화 되었습니다',
          type: isSuspending ? 'warning' : 'success',
        });
      },
      onError: () => {
        setToast({ message: '상품 상태 변경에 실패했습니다', type: 'warning' });
      },
    });
  };

  const handleSaveProduct = (product: ChallengeProduct) => {
    const exists = products.find((p) => p.id === product.id);
    if (exists) {
      updateProductMutation.mutate(
        {
          productId: product.id,
          payload: {
            name: getCatalogProductUpdateValue(product.productName, exists.productName),
            price_usdt: getCatalogProductUpdateValue(product.amount, exists.amount),
            is_most_popular:
              product.mostPopular === exists.mostPopular ? undefined : product.mostPopular,
            discount_price_usdt: getCatalogProductUpdateValue(
              product.discountAmount ?? null,
              exists.discountAmount ?? null,
            ),
            mt4_group: getCatalogProductUpdateValue(product.mtsGroupId, exists.mtsGroupId),
            capital: getCatalogProductUpdateValue(product.capital, exists.capital),
            leverage: getCatalogProductUpdateValue(product.leverage, exists.leverage),
            duration_days: getCatalogProductUpdateValue(product.tradingPeriod, exists.tradingPeriod),
            margin_call_pct: getCatalogProductUpdateValue(
              product.marginCall === '' ? null : Number(product.marginCall),
              exists.marginCall === '' ? null : Number(exists.marginCall),
            ),
            stop_out_pct: getCatalogProductUpdateValue(
              product.stopOut === '' ? null : Number(product.stopOut),
              exists.stopOut === '' ? null : Number(exists.stopOut),
            ),
            funding_start_delay_hours: getCatalogProductUpdateValue(
              product.creationDelayHours ?? null,
              exists.creationDelayHours ?? null,
            ),
            funded_issue_method:
              product.fundedIssueMethod === exists.fundedIssueMethod
                ? undefined
                : product.fundedIssueMethod,
            mt4_login_pool_start: getCatalogProductUpdateValue(
              product.accountRangeStart,
              exists.accountRangeStart,
            ),
            mt4_login_pool_end: getCatalogProductUpdateValue(
              product.accountRangeEnd,
              exists.accountRangeEnd,
            ),
            ruleset_id: getCatalogProductUpdateValue(product.ruleset ?? '', exists.ruleset ?? ''),
          },
        },
        {
          onSuccess: () => {
            setIsModalOpen(false);
            setToast({ message: '수정이 완료되었습니다.', type: 'success' });
            void refetchProducts();
          },
          onError: () => setToast({ message: '상품 수정에 실패했습니다.', type: 'warning' }),
        },
      );
    } else {
      createProductMutation.mutate(
        {
          name: product.productName,
          price_usdt: product.amount,
          discount_price_usdt: product.discountAmount ?? null,
          is_most_popular: product.mostPopular,
          tier_type: 'CHALLENGE',
          mt4_group: product.mtsGroupId,
          capital: product.capital,
          leverage: product.leverage,
          duration_days: product.tradingPeriod,
          margin_call_pct: product.marginCall === '' ? null : Number(product.marginCall),
          stop_out_pct: product.stopOut === '' ? null : Number(product.stopOut),
          funding_start_delay_hours: product.creationDelayHours,
          funded_issue_method: product.fundedIssueMethod ?? 'AUTO',
          mt4_login_pool_start: product.accountRangeStart,
          mt4_login_pool_end: product.accountRangeEnd,
          ruleset_id: product.ruleset ?? '',
        },
        {
          onSuccess: () => {
            setIsModalOpen(false);
            setToast({ message: '상품이 추가되었습니다', type: 'success' });
            void refetchProducts();
          },
          onError: () => setToast({ message: '상품 추가에 실패했습니다', type: 'warning' }),
        },
      );
    }
  };

  return (
    <div style={{ padding: 32, background: t.pageBg, minHeight: '100vh' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <div>
            <h1
              style={{ fontSize: 24, fontWeight: 600, color: t.text, margin: 0, marginBottom: 8 }}
            >
              챌린지 상품 템플릿
            </h1>
            <p style={{ fontSize: 13, color: t.textSec, margin: 0 }}>
              티어별 챌린지 상품 속성을 설정합니다. 변경사항은 신규 구매분부터 적용됩니다.
            </p>
          </div>
          <button
            onClick={handleAddProduct}
            style={{
              height: 36,
              padding: '0 16px',
              borderRadius: 8,
              border: 'none',
              background: t.accent,
              color: '#fff',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Plus size={16} />
            상품 추가
          </button>
        </div>

        {/* Warning Banner */}
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            background: 'rgba(217,119,6,0.1)',
            border: '1px solid rgba(217,119,6,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <AlertCircle size={16} style={{ color: '#D97706', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: '#D97706' }}>
            상품 수정은 신규 구매분부터 적용됩니다. 진행 중인 계좌에는 영향을 주지 않습니다.
          </span>
        </div>
      </div>

      {/* Product Table */}
      <ChallengeProductTable
        products={products}
        onRowClick={handleRowClick}
        onEdit={handleEditProduct}
        onToggleStatus={handleToggleStatus}
        dark={dark}
      />

      {/* Modal */}
      <ChallengeProductModal
        product={selectedProduct}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProduct}
        onNavigate={(navId) => navigate(ROUTE_BY_PAGE_ID[navId] ?? ROUTE_BY_PAGE_ID['challenge-product'])}
        dark={dark}
      />
      <TablePagination
        summary={buildPaginationSummary({
          totalItems: totalRows,
          start: paginationRange.start,
          end: paginationRange.end,
        })}
        borderColor={t.border}
        textColor={t.textHint}
        activeBackground={t.accent}
        inactiveBackground={t.surface2}
        inactiveBorderColor={t.border2}
        items={buildPaginationItems({
          currentPage: safeCurrentPage,
          totalPages,
          onPageChange: setPage,
        })}
      />

      {/* Confirmation Modal */}
      {confirmModal && (
        <ConfirmStatusModal
          type={confirmModal.type}
          dark={dark}
          onCancel={() => setConfirmModal(null)}
          onConfirm={handleConfirmStatusChange}
          isPending={updateStatusMutation.isPending}
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

// Challenge Product Table Component
interface ChallengeProductTableProps {
  products: ChallengeProduct[];
  onRowClick: (product: ChallengeProduct) => void;
  onEdit: (product: ChallengeProduct, e: React.MouseEvent) => void;
  onToggleStatus: (id: string, e: React.MouseEvent) => void;
  dark: boolean;
}

function ChallengeProductTable({
  products,
  onRowClick,
  onEdit,
  onToggleStatus,
  dark,
}: ChallengeProductTableProps) {
  const t = {
    surface: dark ? '#0F1829' : '#ffffff',
    surface2: dark ? '#1A2035' : '#F4F5F7',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    textHint: dark ? '#5A6080' : '#A0A0AA',
  };

  return (
    <div
      style={{
        background: t.surface,
        borderRadius: 12,
        border: `1px solid ${t.border}`,
        overflow: 'hidden',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: t.surface2, borderBottom: `1px solid ${t.border}` }}>
            {[
              // 최신 디자인(Make 1114) 컬럼. 이전 '상품 / 티어', '마진콜', 'Stop Out' 컬럼은 목록에서 숨김(수정 팝업에서 관리)
              '상품명',
              '원가격',
              '할인가격',
              '자본금',
              '레버리지',
              'Trading 기간',
              '적용 룰셋',
              '상태',
              '관리',
            ].map((h) => (
              <th
                key={h}
                style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: 11,
                  fontWeight: 600,
                  color: t.textSec,
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const statusConfig = PRODUCT_STATUS[product.status];
            const isSuspended = product.status === 'SUSPENDED';

            return (
              <tr
                key={product.id}
                onClick={() => onRowClick(product)}
                style={{
                  borderBottom: `1px solid ${t.border}`,
                  cursor: 'pointer',
                  background: isSuspended
                    ? dark
                      ? 'rgba(113,113,122,0.07)'
                      : 'rgba(113,113,122,0.04)'
                    : 'transparent',
                  opacity: isSuspended ? 0.75 : 1,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!isSuspended) e.currentTarget.style.background = t.surface2;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isSuspended
                    ? dark
                      ? 'rgba(113,113,122,0.07)'
                      : 'rgba(113,113,122,0.04)'
                    : 'transparent';
                }}
              >
                <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: t.text }}>
                  {product.productName || '-'}
                </td>
                <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 500, color: t.text }}>
                  {formatUsd(product.amount)}
                </td>
                <td
                  style={{
                    padding: '14px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: product.discountAmount == null ? t.textHint : '#DC2626',
                  }}
                >
                  {formatUsd(product.discountAmount)}
                </td>
                <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 500, color: t.text }}>
                  {formatUsd(product.capital)}
                </td>
                <td style={{ padding: '14px 16px', fontSize: 13, color: t.text }}>
                  {product.leverage == null ? '-' : `x ${product.leverage}`}
                </td>
                <td style={{ padding: '14px 16px', fontSize: 13, color: t.text }}>
                  {product.tradingPeriod == null ? '-' : `${product.tradingPeriod} 영업일`}
                </td>
                {/* 이전 디자인 컬럼(마진콜·Stop Out): 최신 디자인에서 목록 미노출
                <td
                  style={{
                    padding: '14px 16px',
                    fontSize: 13,
                    color: product.marginCall ? t.text : t.textHint,
                  }}
                >
                  {product.marginCall ? `${product.marginCall}%` : '-'}
                </td>
                <td
                  style={{
                    padding: '14px 16px',
                    fontSize: 13,
                    color: product.stopOut ? t.text : t.textHint,
                  }}
                >
                  {product.stopOut ? `${product.stopOut}%` : '-'}
                </td>
                */}
                <td style={{ padding: '14px 16px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '3px 10px',
                      borderRadius: 9999,
                      fontSize: 11,
                      fontWeight: 500,
                      background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                      color: t.textSec,
                      border: `1px solid ${t.border}`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {product.rulesetName || product.ruleset || '-'}
                  </span>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '3px 10px',
                      borderRadius: 9999,
                      fontSize: 11,
                      fontWeight: 600,
                      background: statusConfig.bg,
                      color: statusConfig.color,
                      border: `1px solid ${statusConfig.border}`,
                    }}
                  >
                    {statusConfig.label}
                  </span>
                </td>
                <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={(e) => onEdit(product, e)}
                      style={{
                        height: 32,
                        padding: '0 12px',
                        borderRadius: 6,
                        border: `1px solid ${t.border}`,
                        background: 'transparent',
                        color: t.text,
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      수정
                    </button>
                    <button
                      onClick={(e) => onToggleStatus(product.id, e)}
                      style={{
                        height: 32,
                        padding: '0 12px',
                        borderRadius: 6,
                        border: isSuspended ? `1px solid #7C6AF7` : '1px solid #DC2626',
                        background: 'transparent',
                        color: isSuspended ? '#7C6AF7' : '#DC2626',
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isSuspended ? '사용 재개' : '사용 중지'}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Confirmation Modal Component
interface ConfirmStatusModalProps {
  type: 'suspend' | 'activate';
  dark: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

function ConfirmStatusModal({ type, dark, onCancel, onConfirm, isPending }: ConfirmStatusModalProps) {
  const t = {
    surface: dark ? '#0F1829' : '#ffffff',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    surface2: dark ? '#1A2035' : '#F4F5F7',
  };

  const isSuspend = type === 'suspend';
  const title = isSuspend ? '상품을 사용중지 하시겠습니까?' : '상품을 재활성화 하시겠습니까?';
  const body = isSuspend
    ? '사용중지 후 해당 티어 신규 구매가 불가합니다. 진행 중인 계좌에는 영향을 주지 않습니다.'
    : '재활성화 후 해당 티어 신규 구매가 즉시 재개됩니다.';
  const confirmLabel = isSuspend ? '사용중지' : '재활성화';
  const confirmBg = isSuspend ? '#D97706' : '#16A34A';

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: t.surface,
          borderRadius: 12,
          width: 400,
          padding: 24,
          border: `1px solid ${t.border}`,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 12 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: t.textSec, lineHeight: 1.6, marginBottom: 24 }}>
          {body}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              height: 36,
              padding: '0 16px',
              borderRadius: 8,
              border: 'none',
              background: t.surface2,
              color: t.textSec,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            style={{
              height: 36,
              padding: '0 16px',
              borderRadius: 8,
              border: 'none',
              background: confirmBg,
              color: '#fff',
              fontSize: 13,
              fontWeight: 500,
              cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.7 : 1,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
