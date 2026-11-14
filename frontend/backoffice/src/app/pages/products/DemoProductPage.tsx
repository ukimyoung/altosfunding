import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Plus } from 'lucide-react';
import {
  LiveDemoProductModal,
  type LiveDemoProduct,
} from '../../components/products/LiveDemoProductModal';
import { Toast } from '../../components/shared/Toast';
import { useAppShell } from '../../layouts/AppShell';
import { ROUTE_BY_PAGE_ID } from '../../config/navigation';
import {
  useCreateCatalogProductMutation,
  useListCatalogProductsQuery,
  useUpdateCatalogProductMutation,
  useUpdateCatalogProductStatusMutation,
} from '../../queries/catalogProducts';
import {
  getCatalogProductUpdateValue,
  mapCatalogProductToLiveDemoProduct,
} from '../../utils/catalogProductMappers';
import {
  TablePagination,
  buildPaginationItems,
  buildPaginationSummary,
  getPaginationRange,
} from '../../components/shared/DataTable';

const PAGE_SIZE = 20;

export function DemoProductPage() {
  const { dark } = useAppShell();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = Number(searchParams.get('page') ?? '1') || 1;
  const listParams = {
    tier_type: 'DEMO',
    page: currentPage,
    size: PAGE_SIZE,
  } as const;
  const { data: productData, refetch: refetchProducts } = useListCatalogProductsQuery(listParams);
  const createProductMutation = useCreateCatalogProductMutation();
  const updateProductMutation = useUpdateCatalogProductMutation();
  const updateStatusMutation = useUpdateCatalogProductStatusMutation();
  const [products, setProducts] = useState<LiveDemoProduct[]>([]);
  const [modal, setModal] = useState<{ product: LiveDemoProduct | null; open: boolean }>({
    product: null,
    open: false,
  });
  const [confirmModal, setConfirmModal] = useState<{
    type: 'suspend' | 'activate';
    productId: string;
  } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);

  useEffect(() => {
    setProducts((productData?.items ?? []).map(mapCatalogProductToLiveDemoProduct));
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
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    textHint: dark ? '#5A6080' : '#A0A0AA',
    border2: dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)',
    pageBg: dark ? '#0A0F1E' : '#F4F5F7',
    accent: '#7C6AF7',
  };

  const handleToggleStatus = (id: string) => {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    setConfirmModal({ type: product.status === 'ACTIVE' ? 'suspend' : 'activate', productId: id });
  };

  const handleConfirm = () => {
    if (!confirmModal) return;
    const isSuspending = confirmModal.type === 'suspend';
    updateStatusMutation.mutate({
      productId: confirmModal.productId,
      payload: { is_active: !isSuspending },
    }, {
      onSuccess: () => {
        setConfirmModal(null);
        setToast({
          message: isSuspending ? '상품 사용이 중지되었습니다.' : '상품 사용이 재개되었습니다.',
          type: isSuspending ? 'warning' : 'success',
        });
      },
      onError: () => {
        setToast({ message: '상품 상태 변경에 실패했습니다.', type: 'warning' });
      },
    });
  };

  const handleSave = (draft: LiveDemoProduct) => {
    const exists = products.find((product) => product.id === draft.id);
    if (!exists) {
      createProductMutation.mutate(
        {
          name: draft.productName,
          price_usdt: draft.amount,
          tier_type: 'DEMO',
          mt4_group: draft.mtsGroupId,
          capital: draft.capital,
          leverage: draft.leverage,
          duration_days: draft.tradingPeriod,
          margin_call_pct: draft.marginCall,
          stop_out_pct: draft.stopOut,
          mt4_login_pool_start: draft.accountRangeStart,
          mt4_login_pool_end: draft.accountRangeEnd,
          ruleset_id: draft.ruleset,
        },
        {
          onSuccess: () => {
            setModal({ product: null, open: false });
            setToast({ message: '상품이 추가되었습니다.', type: 'success' });
            void refetchProducts();
          },
          onError: () => setToast({ message: '상품 추가에 실패했습니다.', type: 'warning' }),
        },
      );
      return;
    }
    updateProductMutation.mutate(
      {
        productId: draft.id,
        payload: {
          name: getCatalogProductUpdateValue(draft.productName, exists.productName),
          price_usdt: getCatalogProductUpdateValue(draft.amount, exists.amount),
          mt4_group: getCatalogProductUpdateValue(draft.mtsGroupId, exists.mtsGroupId),
          capital: getCatalogProductUpdateValue(draft.capital, exists.capital),
          leverage: getCatalogProductUpdateValue(draft.leverage, exists.leverage),
          duration_days: getCatalogProductUpdateValue(draft.tradingPeriod, exists.tradingPeriod),
          margin_call_pct: getCatalogProductUpdateValue(draft.marginCall, exists.marginCall),
          stop_out_pct: getCatalogProductUpdateValue(draft.stopOut, exists.stopOut),
          mt4_login_pool_start: getCatalogProductUpdateValue(
            draft.accountRangeStart,
            exists.accountRangeStart,
          ),
          mt4_login_pool_end: getCatalogProductUpdateValue(
            draft.accountRangeEnd,
            exists.accountRangeEnd,
          ),
          ruleset_id: getCatalogProductUpdateValue(draft.ruleset, exists.ruleset),
        },
      },
      {
        onSuccess: () => {
          setModal({ product: null, open: false });
          setToast({ message: '수정이 완료되었습니다.', type: 'success' });
          void refetchProducts();
        },
        onError: () => setToast({ message: '상품 수정에 실패했습니다.', type: 'warning' }),
      },
    );
  };

  return (
    <div style={{ padding: 32, background: t.pageBg, minHeight: '100vh' }}>
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
            데모 상품 템플릿
          </h1>
          <p style={{ fontSize: 13, color: t.textSec, margin: 0 }}>
            데모 계좌용 MTS 그룹별 속성을 설정합니다.
          </p>
        </div>
        <button
          onClick={() => setModal({ product: null, open: true })}
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

      <ProductTable products={products} dark={dark} onEdit={(product) => setModal({ product, open: true })} onToggleStatus={handleToggleStatus} />
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

      <LiveDemoProductModal
        type="demo"
        product={modal.product}
        isOpen={modal.open}
        onClose={() => setModal({ product: null, open: false })}
        onSave={handleSave}
        onNavigate={(navId) => navigate(ROUTE_BY_PAGE_ID[navId] ?? ROUTE_BY_PAGE_ID['demo-product'])}
        dark={dark}
      />

      {confirmModal && (
        <ConfirmModal
          type={confirmModal.type}
          dark={dark}
          onCancel={() => setConfirmModal(null)}
          onConfirm={handleConfirm}
          isPending={updateStatusMutation.isPending}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} dark={dark} onDone={() => setToast(null)} />}
    </div>
  );
}

function ProductTable({
  products,
  dark,
  onEdit,
  onToggleStatus,
}: {
  products: LiveDemoProduct[];
  dark: boolean;
  onEdit: (product: LiveDemoProduct) => void;
  onToggleStatus: (id: string) => void;
}) {
  const t = {
    surface: dark ? '#0F1829' : '#ffffff',
    surface2: dark ? '#1A2035' : '#F4F5F7',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    accent: '#7C6AF7',
  };

  return (
    <div style={{ background: t.surface, borderRadius: 12, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: t.surface2, borderBottom: `1px solid ${t.border}` }}>
            {['그룹 아이디', '레버리지', '마진콜', 'Stop Out', '적용 룰셋', '관리'].map((header) => (
              <th
                key={header}
                style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: t.textSec, whiteSpace: 'nowrap' }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const isSuspended = product.status === 'SUSPENDED';
            return (
              <tr
                key={product.id}
                style={{
                  borderBottom: `1px solid ${t.border}`,
                  background: isSuspended ? (dark ? 'rgba(113,113,122,0.07)' : 'rgba(113,113,122,0.04)') : 'transparent',
                  opacity: isSuspended ? 0.75 : 1,
                }}
              >
                <td style={{ padding: 16, fontSize: 13, fontWeight: 500, color: t.text, fontFamily: "'DM Mono', monospace" }}>
                  {product.mtsGroupId || '-'}
                </td>
                <td style={{ padding: 16, fontSize: 13, color: t.text }}>{product.leverage == null ? '-' : `x${product.leverage}`}</td>
                <td style={{ padding: 16, fontSize: 13, color: t.text }}>{product.marginCall == null ? '-' : `${product.marginCall}%`}</td>
                <td style={{ padding: 16, fontSize: 13, color: t.text }}>{product.stopOut == null ? '-' : `${product.stopOut}%`}</td>
                <td style={{ padding: 16, fontSize: 13, color: t.text }}>
                  {product.rulesetName || product.ruleset || '-'}
                </td>
                <td style={{ padding: 16 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => onEdit(product)}
                      style={{ height: 32, padding: '0 12px', borderRadius: 6, border: `1px solid ${t.border}`, background: 'transparent', color: t.text, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                    >
                      수정
                    </button>
                    <button
                      onClick={() => onToggleStatus(product.id)}
                      style={{
                        height: 32,
                        padding: '0 12px',
                        borderRadius: 6,
                        border: isSuspended ? `1px solid ${t.accent}` : '1px solid #DC2626',
                        background: 'transparent',
                        color: isSuspended ? t.accent : '#DC2626',
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
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

function ConfirmModal({
  type,
  dark,
  onCancel,
  onConfirm,
  isPending,
}: {
  type: 'suspend' | 'activate';
  dark: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  const t = {
    surface: dark ? '#0F1829' : '#ffffff',
    surface2: dark ? '#1A2035' : '#F4F5F7',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
  };
  const isSuspend = type === 'suspend';

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div onClick={(event) => event.stopPropagation()} style={{ background: t.surface, borderRadius: 12, width: 400, padding: 24, border: `1px solid ${t.border}` }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 12 }}>
          {isSuspend ? '상품을 사용중지 하시겠습니까?' : '상품을 재개하시겠습니까?'}
        </div>
        <div style={{ fontSize: 13, color: t.textSec, lineHeight: 1.6, marginBottom: 24 }}>
          {isSuspend ? '사용중지 후 해당 그룹의 신규 계좌 개설이 중단됩니다.' : '재개 후 해당 그룹의 신규 계좌 개설이 즉시 재개됩니다.'}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: t.surface2, color: t.textSec, fontSize: 13, cursor: 'pointer' }}>
            취소
          </button>
          <button disabled={isPending} onClick={onConfirm} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: isSuspend ? '#DC2626' : '#16A34A', color: '#fff', fontSize: 13, fontWeight: 500, cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.7 : 1 }}>
            {isSuspend ? '사용 중지' : '사용 재개'}
          </button>
        </div>
      </div>
    </div>
  );
}
