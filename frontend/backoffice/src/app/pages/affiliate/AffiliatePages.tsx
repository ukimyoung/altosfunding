// 재무/정산 > 제휴 프로그램 화면들 (Figma Make 백오피스 1124 디자인, Core /admin/affiliate API 연결).
import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import {
  AffiliateCommissionDetailPage as CommissionDetail,
  AffiliateCommissionFlowPage as CommissionFlow,
  AffiliateCommissionRatePage as CommissionRate,
  AffiliateNetworkPage as Network,
  IbPartnerManagementPage as IbPartnerManagement,
} from "../../components/affiliate/AffiliateProgramPages";
import { Toast } from "../../components/shared/Toast";
import { useAppShell } from "../../layouts/AppShell";

type ToastState = { message: string; type: "success" | "warning" } | null;
type ToastHandler = (message: string, type?: "success" | "warning") => void;

function WithToast({ render }: { render: (dark: boolean, onToast: ToastHandler) => ReactNode }) {
  const { dark } = useAppShell();
  const [toast, setToast] = useState<ToastState>(null);
  // 화면이 onToast를 effect 의존성으로 써도 다시 불리지 않도록 고정한다.
  const onToast = useCallback<ToastHandler>((message, type = "success") => setToast({ message, type }), []);
  return (
    <>
      {render(dark, onToast)}
      {toast && <Toast message={toast.message} type={toast.type} dark={dark} onDone={() => setToast(null)} />}
    </>
  );
}

export function IbPartnerManagementPage() {
  return <WithToast render={(dark, onToast) => <IbPartnerManagement dark={dark} onToast={onToast} />} />;
}

export function AffiliateNetworkPage() {
  return <WithToast render={(dark, onToast) => <Network dark={dark} onToast={onToast} />} />;
}

export function AffiliateCommissionDetailPage() {
  return <WithToast render={(dark, onToast) => <CommissionDetail dark={dark} onToast={onToast} />} />;
}

export function AffiliateCommissionFlowPage() {
  return <WithToast render={(dark, onToast) => <CommissionFlow dark={dark} onToast={onToast} />} />;
}

export function AffiliateCommissionRatePage() {
  return <WithToast render={(dark, onToast) => <CommissionRate dark={dark} onToast={onToast} />} />;
}
