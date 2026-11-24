// 재무/정산 > 제휴 프로그램 화면들 (Figma Make 백오피스 1124 디자인 그대로, 아직 API 미연결 예시 데이터).
import { useState } from "react";
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
  return (
    <>
      {render(dark, (message, type = "success") => setToast({ message, type }))}
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
  const { dark } = useAppShell();
  return <CommissionDetail dark={dark} />;
}

export function AffiliateCommissionFlowPage() {
  const { dark } = useAppShell();
  return <CommissionFlow dark={dark} />;
}

export function AffiliateCommissionRatePage() {
  return <WithToast render={(dark, onToast) => <CommissionRate dark={dark} onToast={onToast} />} />;
}
