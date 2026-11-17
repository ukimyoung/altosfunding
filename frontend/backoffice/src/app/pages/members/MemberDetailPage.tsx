import { useEffect, useMemo, useState } from 'react';
import type * as React from 'react';
import { ArrowLeft, Check, X } from 'lucide-react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ROUTE_BY_PAGE_ID } from '../../config/navigation';
import { useAppShell } from '../../layouts/AppShell';
import type { Account } from '../../types/account';
import { AccountDetailDrawer } from '../../components/accounts/AccountDetailDrawer';
import { AccountListTable } from '../../components/accounts/AccountListTable';
import { Badge, StatusBadge, UserTypeBadge } from '../../components/shared/Badge';
import { Toast } from '../../components/shared/Toast';
import { PartnerPerformanceTab } from '../../components/members/PartnerPerformanceTab';
import {
  TablePagination,
  buildPaginationItems,
  buildPaginationSummary,
  getPaginationRange,
} from '../../components/shared/DataTable';
import { tok } from '../../theme/tokens';
import { MemberEditDrawer, MemberReadOnlyField } from '../../components/members/MemberEditDrawer';
import {
  MemberBannedModal,
  MemberDeactivateModal,
  MemberReactivateModal,
  MemberWithdrawModal,
} from '../../components/members/MemberStatusModals';
import {
  useActivateUserMutation,
  useBanUserMutation,
  useGetUserDetailQuery,
  useGetUserPartnerStatsQuery,
  useSuspendUserMutation,
  useUpdateUserMutation,
  useWithdrawUserMutation,
} from '../../queries/users';
import { accountsQueryKeys, useListUserAccountsQuery } from '../../queries/accounts';
import { useListWalletRequestHistoryQuery } from '../../queries/wallet';
import { formatKstDateTime, formatUsdMoney, phoneRender } from '../../utils/utils';
import { getWalletStatusBadge } from '../../utils/walletDisplay';
import type { AccountTier, ListAccountsResponse } from '@/api/account';
import { getUserApiErrorMessage, type UpdateUserRequest, type UserKycStatus } from '@/api/user';

const emptyValue = '-';
const accountPageSize = 20;
const withdrawPageSize = 20;

type AccountTab = AccountTier | 'withdraw' | 'partner';

const ACCOUNT_TABS: Array<{ value: AccountTab; label: string }> = [
  { value: 'CHALLENGE', label: '챌린지' },
  { value: 'FUNDED', label: '펀디드' },
  { value: 'LIVE', label: '라이브' },
  { value: 'DEMO', label: '데모' },
  { value: 'withdraw', label: 'Withdraw History' },
  { value: 'partner', label: '파트너 실적' },
];

const getDisplayName = (user?: {
  first_name?: string | null;
  last_name?: string | null;
}) => {
  if (!user) return emptyValue;

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return fullName || emptyValue;
};

const getInitials = (name: string) => {
  if (!name || name === emptyValue) return 'U';

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
};

const getUserType = (grade?: string | null): 'VIP' | 'Normal' =>
  String(grade).toUpperCase() === 'VIP' ? 'VIP' : 'Normal';

const getMemberStatus = (status?: string | null, isActive?: boolean | null) => {
  const normalized = String(status ?? '').toUpperCase();
  if (normalized === 'BANNED') return 'Banned';
  if (normalized === 'INACTIVE') return 'Inactive';
  if (isActive === false) return 'Inactive';

  return 'Active';
};

const joinAddress = (...parts: Array<string | null | undefined>) =>
  parts.filter(Boolean).join(', ') || emptyValue;

const formatMemberDate = (value?: string | null) => {
  if (!value) return emptyValue;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

function KycReadOnly({
  status,
  rejectReason,
  submittedAt,
  approvedAt,
  rejectedAt,
  t,
}: {
  status?: UserKycStatus | null;
  rejectReason?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  t: ReturnType<typeof tok>;
}) {
  const normalized = status ?? 'NONE';
  const formatKycDate = (value?: string | null) => {
    if (!value) return emptyValue;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? '';

    return `${get('year')}-${get('month')}-${get('day')}`;
  };
  const formatKycDateWithTimezone = (value?: string | null) => {
    const formatted = formatKycDate(value);
    return formatted === emptyValue ? emptyValue : `${formatted} (GMT+9)`;
  };
  const statusRow = (
    bg: string,
    border: string,
    icon: React.ReactNode,
    label: string,
    labelColor: string,
    right: string,
  ) => (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 8,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      {icon}
      <span
        style={{
          flex: 1,
          fontSize: 12,
          fontWeight: 600,
          color: labelColor,
          fontFamily: "'Noto Sans KR',sans-serif",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 10, color: t.textHint, whiteSpace: 'nowrap' }}>{right}</span>
    </div>
  );

  if (normalized === 'APPROVED') {
    return statusRow(
      'rgba(22,163,74,0.07)',
      'rgba(22,163,74,0.2)',
      <Check size={14} strokeWidth={2.5} style={{ color: '#16A34A', flexShrink: 0 }} />,
      'Approved',
      '#16A34A',
      `승인일: ${formatKycDateWithTimezone(approvedAt)}`,
    );
  }

  if (normalized === 'REJECTED') {
    return (
      <div>
        {statusRow(
          'rgba(220,38,38,0.06)',
          'rgba(220,38,38,0.2)',
          <X size={14} strokeWidth={2.5} style={{ color: '#DC2626', flexShrink: 0 }} />,
          'Rejected',
          '#DC2626',
          `반려일: ${formatKycDateWithTimezone(rejectedAt)}`,
        )}
        <div
          style={{
            marginTop: 10,
            padding: '12px 14px',
            background: t.surface2,
            border: '1px solid rgba(220,38,38,0.15)',
            borderRadius: 8,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#DC2626',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 6,
              fontFamily: "'DM Sans',sans-serif",
            }}
          >
            Rejection Reason
          </div>
          <p style={{ margin: 0, fontSize: 12, color: t.textSec, lineHeight: 1.65 }}>
            {rejectReason || '반려 사유 정보가 없습니다.'}
          </p>
        </div>
      </div>
    );
  }

  if (normalized === 'PENDING') {
    return statusRow(
      'rgba(251,191,36,0.06)',
      'rgba(217,119,6,0.25)',
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          border: '1.5px dashed #D97706',
          flexShrink: 0,
        }}
      />,
      'Unverified',
      '#D97706',
      `제출일: ${formatKycDateWithTimezone(submittedAt)} · 솔루션 검토 중`,
    );
  }

  return statusRow(
    t.surface2,
    t.border,
    <div
      style={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: t.textHint,
        flexShrink: 0,
      }}
    />,
    'None',
    t.textHint,
    'KYC 인증을 시도하지 않은 상태',
  );
}

export function MemberDetailPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { memberId } = useParams();
  const { dark } = useAppShell();
  const { data: user, refetch: refetchUserDetail } = useGetUserDetailQuery(memberId);
  const suspendUserMutation = useSuspendUserMutation();
  const banUserMutation = useBanUserMutation();
  const withdrawUserMutation = useWithdrawUserMutation();
  const activateUserMutation = useActivateUserMutation();
  const updateUserMutation = useUpdateUserMutation();
  const [acctTab, setAcctTab] = useState<AccountTab>('CHALLENGE');
  const [accountPage, setAccountPage] = useState(1);
  const [withdrawPage, setWithdrawPage] = useState(1);
  const partnerStatsQuery = useGetUserPartnerStatsQuery(
    memberId,
    { page: 1, size: 20 },
    acctTab === 'partner',
  );
  const selectedAccountTier = acctTab === 'withdraw' || acctTab === 'partner' ? null : acctTab;
  const accountParams = useMemo(
    () => ({ page: accountPage, size: accountPageSize, tier: selectedAccountTier }),
    [accountPage, selectedAccountTier],
  );
  const withdrawParams = useMemo(
    () => ({
      keyword: user?.email || undefined,
      direction: 'OUT',
      page: withdrawPage,
      size: withdrawPageSize,
    }),
    [user?.email, withdrawPage],
  );
  const {
    data: accountData,
    isLoading: isAccountLoading,
    isPlaceholderData,
    refetch: refetchAccounts,
  } = useListUserAccountsQuery(
    memberId,
    accountParams,
    acctTab !== 'withdraw' && acctTab !== 'partner',
  );
  const withdrawQuery = useListWalletRequestHistoryQuery(
    withdrawParams,
    acctTab === 'withdraw' && Boolean(user?.email),
  );
  const myAccounts = accountData?.items ?? [];
  const accountTotalRows = accountData?.total ?? myAccounts.length;
  const responseAccountPageSize = accountData?.size ?? accountPageSize;
  const accountTotalPages = Math.max(
    1,
    accountData?.pages ?? Math.ceil(accountTotalRows / responseAccountPageSize),
  );
  const responseAccountPage =
    !isPlaceholderData && accountData ? accountData.page : accountPage;
  const safeAccountPage = Math.min(Math.max(1, responseAccountPage), accountTotalPages);
  const accountPaginationRange = getPaginationRange({
    totalItems: accountTotalRows,
    currentPage: safeAccountPage,
    pageSize: responseAccountPageSize,
    currentPageItemCount: myAccounts.length,
  });
  const visibleWithdrawRows = withdrawQuery.data?.items ?? [];
  const withdrawTotalRows = withdrawQuery.data?.total ?? visibleWithdrawRows.length;
  const responseWithdrawPageSize = withdrawQuery.data?.size ?? withdrawPageSize;
  const withdrawTotalPages = Math.max(
    1,
    withdrawQuery.data?.pages ?? Math.ceil(withdrawTotalRows / responseWithdrawPageSize),
  );
  const responseWithdrawPage =
    !withdrawQuery.isPlaceholderData && withdrawQuery.data ? withdrawQuery.data.page : withdrawPage;
  const safeWithdrawPage = Math.min(Math.max(1, responseWithdrawPage), withdrawTotalPages);
  const withdrawPaginationRange = getPaginationRange({
    totalItems: withdrawTotalRows,
    currentPage: safeWithdrawPage,
    pageSize: responseWithdrawPageSize,
    currentPageItemCount: visibleWithdrawRows.length,
  });
  const memberName = getDisplayName(user);
  const member = {
    name: memberName,
    email: user?.email ?? emptyValue,
    uid: user?.uid ?? emptyValue,
    userType: getUserType(user?.grade),
    nation: user?.country ?? emptyValue,
    status: getMemberStatus(user?.status, user?.is_active),
    regDate: formatMemberDate(user?.created_at),
    initials: getInitials(memberName),
    phone: user?.phone ? phoneRender(user.phone) : emptyValue,
    stateProvince: user?.state_province ?? emptyValue,
    address: joinAddress(
      user?.address_line1,
      user?.address_line2,
      user?.city,
      user?.state_province,
      user?.zip_code,
    ),
  };
  const t = tok(dark);
  const [confirmModal, setConfirmModal] = useState<
    'inactive' | 'reactivate' | 'banned' | 'withdraw' | null
  >(null);
  const [drawerAcct, setDrawerAcct] = useState<Account | null>(null);
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);

  const showToast = (message: string, type: 'success' | 'warning' = 'success') =>
    setToast({ message, type });

  useEffect(() => {
    if (accountData && !isPlaceholderData && accountPage !== safeAccountPage) {
      setAccountPage(safeAccountPage);
    }
  }, [accountData, accountPage, isPlaceholderData, safeAccountPage]);

  useEffect(() => {
    if (
      withdrawQuery.data &&
      !withdrawQuery.isPlaceholderData &&
      withdrawPage !== safeWithdrawPage
    ) {
      setWithdrawPage(safeWithdrawPage);
    }
  }, [safeWithdrawPage, withdrawPage, withdrawQuery.data, withdrawQuery.isPlaceholderData]);

  const handleAccountTabChange = (tab: AccountTab) => {
    setAcctTab(tab);
    setAccountPage(1);
    setWithdrawPage(1);
  };

  if (!memberId) {
    return <Navigate to={ROUTE_BY_PAGE_ID['member-list']} replace />;
  }

  const card: React.CSSProperties = {
    background: t.surface,
    border: `1px solid ${t.border}`,
    borderRadius: 12,
    padding: 20,
  };

  const actionBtn = (
    label: string,
    bg: string,
    color: string,
    onClick: () => void,
    border?: string,
  ) => (
    <button
      onClick={onClick}
      style={{
        height: 34,
        padding: '0 14px',
        borderRadius: 8,
        border: border ? `1px solid ${border}` : 'none',
        background: bg,
        color,
        fontSize: 12,
        fontWeight: 500,
        fontFamily: "'Noto Sans KR',sans-serif",
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );

  const handleReasonConfirm = async (type: 'inactive' | 'banned', reason: string) => {
    if (type === 'inactive') {
      await suspendUserMutation.mutateAsync({
        userId: memberId,
        payload: { reason },
      });
      await refetchUserDetail();

      setConfirmModal(null);
      showToast('회원계정이 비활성 처리되었습니다');
      return;
    }

    if (!reason) {
      showToast('영구정지 사유를 입력해주세요', 'warning');
      return;
    }

    await banUserMutation.mutateAsync({
      userId: memberId,
      payload: { reason },
    });
    await refetchUserDetail();

    setConfirmModal(null);
    showToast('회원이 영구정지 처리되었습니다');
  };

  const handleWithdrawUser = async () => {
    await withdrawUserMutation.mutateAsync(memberId);
    await refetchUserDetail();
    setConfirmModal(null);
    showToast('회원탈퇴 처리가 완료되었습니다');
  };

  const handleActivateUser = async () => {
    await activateUserMutation.mutateAsync(memberId);
    await refetchUserDetail();
    setConfirmModal(null);
    showToast('회원계정이 활성 복귀되었습니다');
  };

  const handleUpdateUser = async (payload: UpdateUserRequest) => {
    try {
      await updateUserMutation.mutateAsync({ userId: memberId, payload });
    } catch (error) {
      showToast(getUserApiErrorMessage(error, '저장에 실패했습니다.'), 'warning');
      return;
    }
    await refetchUserDetail();
    setShowEditDrawer(false);
    showToast('저장되었습니다');
  };

  return (
    <div style={{ padding: '28px 28px 48px', fontFamily: "'DM Sans','Noto Sans KR',sans-serif" }}>
      {/* ── Back button (standalone) ── */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => navigate(ROUTE_BY_PAGE_ID['member-list'])}
          style={{
            height: 36,
            padding: '0 14px',
            borderRadius: 8,
            border: `1px solid ${t.border2}`,
            background: 'transparent',
            color: t.textSec,
            fontSize: 12,
            fontWeight: 500,
            fontFamily: "'Noto Sans KR',sans-serif",
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <ArrowLeft size={14} strokeWidth={2} />
          목록으로
        </button>
      </div>

      {/* ── Member Header Card (action buttons inside, bottom-right) ── */}
      <div
        style={{
          ...card,
          borderRadius: 16,
          padding: 24,
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        {/* Left: avatar + info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: '#7C6AF7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: '#fff',
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              {member.initials}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  color: t.text,
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >
                {member.name}
              </span>
              <UserTypeBadge type={member.userType} t={t} />
              <StatusBadge status={member.status} t={t} />
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[`UID : ${member.uid}`, `Email : ${member.email}`, `가입일: ${member.regDate}`].map(
                (info, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 12,
                      color: t.textSec,
                      fontFamily: i === 0 ? "'DM Mono',monospace" : "'Noto Sans KR',sans-serif",
                    }}
                  >
                    {info}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
        {/* Right: action buttons */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
          {member.status === 'Inactive'
            ? actionBtn('활성 복귀', 'rgba(22,163,74,0.1)', '#16A34A', () =>
                setConfirmModal('reactivate'),
              )
            : actionBtn('비활성 처리', 'rgba(217,119,6,0.1)', '#D97706', () =>
                setConfirmModal('inactive'),
              )}
          {actionBtn('영구정지 처리', 'rgba(220,38,38,0.1)', '#DC2626', () =>
            setConfirmModal('banned'),
          )}
          {actionBtn(
            '회원탈퇴 처리',
            t.surface2,
            t.textSec,
            () => setConfirmModal('withdraw'),
            t.border2,
          )}
        </div>
      </div>

      {/* ── 2-col grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* 기본 인적사항 */}
        <div style={card}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: t.text,
                fontFamily: "'Noto Sans KR',sans-serif",
              }}
            >
              기본 인적사항
            </span>
            <button
              style={{
                height: 30,
                padding: '0 10px',
                borderRadius: 8,
                border: `1px solid ${t.border2}`,
                background: 'transparent',
                color: t.textSec,
                fontSize: 11,
                fontFamily: "'Noto Sans KR',sans-serif",
                cursor: 'pointer',
              }}
              onClick={() => setShowEditDrawer(true)}
            >
              정보 수정
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <MemberReadOnlyField label="이름" value={member.name} t={t} />
            <MemberReadOnlyField label="이메일" value={member.email} t={t} />
          </div>
          <div style={{ height: 1, background: t.border, marginBottom: 16 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <MemberReadOnlyField label="전화번호" value={member.phone} t={t} />
            <MemberReadOnlyField label="국가" value={member.nation} t={t} />
          </div>
          <div style={{ height: 1, background: t.border, marginBottom: 16 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <MemberReadOnlyField label="주" value={member.stateProvince} t={t} />
            <MemberReadOnlyField label="도시" value={user?.city ?? emptyValue} t={t} />
          </div>
          <div style={{ height: 1, background: t.border, marginBottom: 16 }} />
          <MemberReadOnlyField label="주소" value={member.address} t={t} />
        </div>

        {/* KYC 인증 현황 */}
        <div style={card}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: t.text,
                fontFamily: "'Noto Sans KR',sans-serif",
              }}
            >
              KYC 인증 현황
            </div>
            <span
              style={{
                fontSize: 10,
                color: t.textHint,
                fontFamily: "'Noto Sans KR',sans-serif",
              }}
            >
              솔루션 자동 처리 · 읽기 전용
            </span>
          </div>
          <KycReadOnly
            status={user?.kyc_status}
            rejectReason={user?.kyc_reject_reason}
            submittedAt={user?.kyc_submitted_at}
            approvedAt={user?.kyc_approved_at}
            rejectedAt={user?.kyc_rejected_at}
            t={t}
          />
        </div>
      </div>

      {/* ── Account Section ── */}
      <div
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 12,
          overflow: 'hidden',
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', padding: '0 16px', borderBottom: `1px solid ${t.border}` }}>
          {ACCOUNT_TABS.map((tab) => {
            const active = acctTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => handleAccountTabChange(tab.value)}
                style={{
                  padding: '12px 16px',
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: "'DM Sans',sans-serif",
                  cursor: 'pointer',
                  background: 'transparent',
                  border: 'none',
                  color: active ? t.accent : t.textHint,
                  borderBottom: `2px solid ${active ? t.accent : 'transparent'}`,
                  marginBottom: -1,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {acctTab === 'partner' ? (
          <PartnerPerformanceTab
            data={partnerStatsQuery.data}
            isLoading={partnerStatsQuery.isLoading}
            isError={partnerStatsQuery.isError}
            t={t}
          />
        ) : acctTab !== 'withdraw' ? (
          <>
            <AccountListTable
              dark={dark}
              tier={acctTab}
              accounts={myAccounts}
              isLoading={isAccountLoading}
              emptyText="No accounts found."
              context="memberDetail"
              onRowClick={(row) => setDrawerAcct(row.drawerAccount)}
              footer={
                <TablePagination
                  summary={buildPaginationSummary({
                    totalItems: accountTotalRows,
                    start: accountPaginationRange.start,
                    end: accountPaginationRange.end,
                  })}
                  containerStyle={{ padding: '12px 16px' }}
                  borderColor={t.border}
                  textColor={t.textHint}
                  activeBackground={t.accent}
                  inactiveBackground={t.surface2}
                  inactiveBorderColor={t.border2}
                  items={buildPaginationItems({
                    currentPage: safeAccountPage,
                    totalPages: accountTotalPages,
                    onPageChange: setAccountPage,
                  })}
                />
              }
            />
          </>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '18%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '20%' }} />
                <col />
              </colgroup>
              <thead>
                <tr
                  style={{
                    background: t.surface2,
                    height: 40,
                    borderBottom: `1px solid ${t.border}`,
                  }}
                >
                  {['Date', 'Type', 'Amount', 'Fee', 'Network', 'Address', 'Status'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '0 16px',
                        textAlign: 'left',
                        fontSize: 10,
                        fontWeight: 600,
                        color: t.textHint,
                        letterSpacing: '0.07em',
                        textTransform: 'uppercase',
                        fontFamily: "'DM Sans',sans-serif",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleWithdrawRows.map((row, i) => {
                  const statusLabel = row.display_status ?? row.status;
                  const sc = getWalletStatusBadge(statusLabel);
                  const amount = Math.abs(row.amount);
                  const amountLabel =
                    row.direction === 'OUT'
                      ? `-${formatUsdMoney(amount)}`
                      : formatUsdMoney(amount);
                  const feeLabel = formatUsdMoney(Math.abs(row.fee));

                  return (
                    <tr
                      key={`${row.source}-${row.id}`}
                      style={{
                        height: 52,
                        borderBottom:
                          i < visibleWithdrawRows.length - 1 ? `1px solid ${t.border}` : 'none',
                      }}
                    >
                      <td style={{ padding: '0 16px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontFamily: "'DM Mono',monospace",
                            color: t.textSec,
                          }}
                        >
                          {formatKstDateTime(row.created_at)}
                        </span>
                      </td>
                      <td style={{ padding: '0 16px' }}>
                        <span style={{ fontSize: 11, color: t.textSec }}>
                          {row.display_tx_type}
                        </span>
                      </td>
                      <td style={{ padding: '0 16px' }}>
                        <span
                          style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: t.text }}
                        >
                          {amountLabel}
                        </span>
                      </td>
                      <td style={{ padding: '0 16px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontFamily: "'DM Mono',monospace",
                            color: t.textSec,
                          }}
                        >
                          {feeLabel}
                        </span>
                      </td>
                      <td style={{ padding: '0 16px' }}>
                        <span style={{ fontSize: 11, color: t.textSec }}>
                          {row.network || emptyValue}
                        </span>
                      </td>
                      <td style={{ padding: '0 16px' }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontFamily: "'DM Mono',monospace",
                            color: t.textHint,
                          }}
                        >
                          {row.wallet_address || emptyValue}
                        </span>
                      </td>
                      <td style={{ padding: '0 16px' }}>
                        <Badge label={statusLabel} bg={sc.bg} color={sc.color} border={sc.border} />
                      </td>
                    </tr>
                  );
                })}
                {visibleWithdrawRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        padding: 24,
                        textAlign: 'center',
                        color: t.textHint,
                        fontSize: 12,
                      }}
                    >
                      {withdrawQuery.isLoading
                        ? 'Withdraw history is loading.'
                        : withdrawQuery.isError
                          ? 'Failed to load withdraw history.'
                          : 'No withdraw history found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <TablePagination
              summary={buildPaginationSummary({
                totalItems: withdrawTotalRows,
                start: withdrawPaginationRange.start,
                end: withdrawPaginationRange.end,
              })}
              containerStyle={{ padding: '12px 16px' }}
              borderColor={t.border}
              textColor={t.textHint}
              activeBackground={t.accent}
              inactiveBackground={t.surface2}
              inactiveBorderColor={t.border2}
              items={buildPaginationItems({
                currentPage: safeWithdrawPage,
                totalPages: withdrawTotalPages,
                onPageChange: setWithdrawPage,
              })}
            />
          </>
        )}
      </div>

      {/* ── Confirmation Modals ── */}
      {confirmModal === 'inactive' && (
        <MemberDeactivateModal
          dark={dark}
          onCancel={() => setConfirmModal(null)}
          onConfirm={(reason) => handleReasonConfirm('inactive', reason)}
        />
      )}
      {confirmModal === 'reactivate' && (
        <MemberReactivateModal
          dark={dark}
          onCancel={() => setConfirmModal(null)}
          onConfirm={handleActivateUser}
        />
      )}
      {confirmModal === 'banned' && (
        <MemberBannedModal
          dark={dark}
          onCancel={() => setConfirmModal(null)}
          onConfirm={(reason) => handleReasonConfirm('banned', reason)}
        />
      )}
      {confirmModal === 'withdraw' && (
        <MemberWithdrawModal
          dark={dark}
          onCancel={() => setConfirmModal(null)}
          onConfirm={handleWithdrawUser}
        />
      )}

      {/* ── Account Drawer ── */}
      {drawerAcct && (
        <AccountDetailDrawer
          acct={drawerAcct}
          dark={dark}
          onStatusChanged={async (accountId, status) => {
            await refetchAccounts();
            if (!memberId) return;
            queryClient.setQueryData<ListAccountsResponse>(
              accountsQueryKeys.listUserAccounts(memberId, accountParams),
              (current) =>
                current
                  ? {
                      ...current,
                      items: current.items.map((account) =>
                        account.account_id === accountId ? { ...account, status } : account,
                      ),
                    }
                  : current,
            );
          }}
          onClose={() => setDrawerAcct(null)}
        />
      )}
      {showEditDrawer && user && (
        <MemberEditDrawer
          user={user}
          dark={dark}
          onClose={() => setShowEditDrawer(false)}
          onSave={handleUpdateUser}
          saving={updateUserMutation.isPending}
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
