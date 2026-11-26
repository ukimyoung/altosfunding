import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { getMemberDetailRoute } from '../../config/navigation';
import { useAppShell } from '../../layouts/AppShell';
import { Badge, KycBadge, StatusBadge, UserTypeBadge } from '../../components/shared/Badge';
import { Toast } from '../../components/shared/Toast';
import {
  DataTable,
  TablePagination,
  buildPaginationItems,
  buildPaginationSummary,
  getPaginationRange,
} from '../../components/shared/DataTable';
import {
  ActionButton,
  SEARCH_DEBOUNCE_MS,
  SearchField,
  SelectFilter,
  TableFilterBar,
} from '../../components/shared/TableFilters';
import { tok } from '../../theme/tokens';
import { AddUserModal } from '../../components/members/AddUserModal';
import { StatCard } from '../../components/members/StatCard';
import { useCreateUserMutation, useListUsersQuery, useUserSummaryQuery } from '../../queries/users';
import { formatKstDateTime, formatNumber, formatUsdMoney } from '../../utils/utils';
import { getUserApiErrorMessage } from '@/api/user';
import type {
  CreateUserRequest,
  User,
  UserGrade,
  UserKycStatus,
  UserStatus,
} from '../../../api/user';

type MemberRow = {
  id: string;
  name: string;
  email: string;
  uid: string;
  partnerMemberId: string | null;
  userType: 'VIP' | 'Normal';
  nation: string;
  kyc: string;
  accountCount: string;
  totalAssets: string;
  regDate: string;
  lastLogin: string;
  status: string;
};

const PAGE_SIZE = 20;

type ToastState = {
  message: string;
  type: 'success' | 'warning';
};

const formatDateTime = (value: unknown) => {
  if (typeof value !== 'string' || value.length === 0) {
    return '-';
  }

  return formatKstDateTime(value);
};

const formatMoney = (value: unknown) => {
  const amount = typeof value === 'number' ? value : Number(value ?? 0);

  return formatUsdMoney(Number.isFinite(amount) ? amount : 0, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const mapKycStatus = (status: string | null | undefined) => {
  const normalized = status?.toUpperCase();

  if (normalized === 'APPROVED') {
    return 'APPROVED';
  }
  if (normalized === 'PENDING') {
    return 'Unverified';
  }
  if (normalized === 'REJECTED') {
    return 'Rejected';
  }

  return 'Unverified';
};

const mapKycFilterToParam = (status: string): UserKycStatus | undefined => {
  if (status === 'APPROVED') return 'APPROVED';
  if (status === 'PENDING') return 'PENDING';
  if (status === 'REJECTED') return 'REJECTED';
  if (status === 'NONE') return 'NONE';

  return undefined;
};

const mapStatus = (user: User) => {
  const normalized = String(user.status ?? '').toUpperCase();

  if (normalized === 'BANNED') {
    return 'Banned';
  }
  if (normalized === 'INACTIVE') {
    return 'Inactive';
  }
  if (user.is_active === false) {
    return 'Inactive';
  }

  return 'Active';
};

const mapUserToRow = (user: User): MemberRow => {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  const name = fullName || '-';
  const nation = user.country || '-';
  const challengeCount = user.challenge_account_count ?? 0;
  const fundedCount = user.funded_account_count ?? 0;
  const liveCount = user.live_account_count ?? 0;
  const demoCount = user.demo_account_count ?? 0;

  return {
    id: user.id,
    name,
    email: user.email,
    uid: user.uid || '-',
    partnerMemberId: user.partner_member_id ?? null,
    userType: String(user.grade).toUpperCase() === 'VIP' ? 'VIP' : 'Normal',
    nation,
    kyc: mapKycStatus(user.kyc_status),
    accountCount: `챌린지 ${challengeCount} / 펀디드 ${fundedCount} / 라이브 ${liveCount} / 데모 ${demoCount}`,
    totalAssets: formatMoney(user.total_assets),
    regDate: formatDateTime(user.created_at),
    lastLogin: formatDateTime(user.last_login_at),
    status: mapStatus(user),
  };
};

export function MemberListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { dark } = useAppShell();
  const t = tok(dark);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const search = searchParams.get('search') ?? '';
  const grade = searchParams.get('grade') ?? 'all';
  const kycStatus = searchParams.get('kycStatus') ?? 'all';
  const status = searchParams.get('status') ?? 'all';
  const currentPage = Number(searchParams.get('page') ?? '1') || 1;
  const [searchDraft, setSearchDraft] = useState(search);

  const updateParams = (updates: Record<string, string | number | null | undefined>) => {
    const next = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '' || value === 'all') {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });

    setSearchParams(next, { replace: true });
  };

  const usersQueryParams = useMemo(
    () => ({
      keyword: search || undefined,
      status: status === 'all' ? undefined : (status as UserStatus),
      grade: grade === 'all' ? undefined : (grade as UserGrade),
      kyc_status: mapKycFilterToParam(kycStatus),
      page: currentPage,
      size: PAGE_SIZE,
    }),
    [currentPage, grade, kycStatus, search, status],
  );

  const { data, isError, isFetching, isLoading, isPlaceholderData } =
    useListUsersQuery(usersQueryParams);
  const { data: summary } = useUserSummaryQuery();
  const createUserMutation = useCreateUserMutation();
  const visibleMembers = useMemo(() => (data?.items ?? []).map(mapUserToRow), [data?.items]);
  const totalCount = data?.total ?? 0;
  const totalPages = Math.max(1, data?.pages ?? 1);
  const pageSize = data?.size ?? PAGE_SIZE;
  const responsePage = !isPlaceholderData && data ? data.page : currentPage;
  const safeCurrentPage = Math.min(Math.max(1, responsePage), totalPages);
  const paginationRange = getPaginationRange({
    totalItems: totalCount,
    currentPage: safeCurrentPage,
    pageSize,
    currentPageItemCount: visibleMembers.length,
  });
  const summaryTotalCount = summary?.total_users ?? 0;
  const vipPercent =
    typeof summary?.vip_users === 'number' && summaryTotalCount > 0
      ? Math.round((summary.vip_users / summaryTotalCount) * 100)
      : 0;
  const normalPercent =
    typeof summary?.normal_users === 'number' && summaryTotalCount > 0
      ? Math.round((summary.normal_users / summaryTotalCount) * 100)
      : 0;

  const handleAddUserConfirm = (payload: CreateUserRequest) => {
    createUserMutation.mutate(payload, {
      onSuccess: () => {
        setShowAddUserModal(false);
        setToast({ message: '회원이 추가되었습니다.', type: 'success' });
      },
      onError: (error) => {
        setToast({ message: getUserApiErrorMessage(error, '회원 추가에 실패했습니다.'), type: 'warning' });
      },
    });
  };

  useEffect(() => {
    if (data && !isPlaceholderData && currentPage !== safeCurrentPage) {
      updateParams({ page: safeCurrentPage });
    }
  }, [currentPage, data, isPlaceholderData, safeCurrentPage]);

  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  useEffect(() => {
    const query = searchDraft.trim();
    if (query === search) return;

    const timer = window.setTimeout(() => {
      updateParams({ search: query.length >= 2 ? query : null, page: 1 });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchDraft, search]);

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}
      >
        <StatCard t={t} label="전체 회원 수">
          <span
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: t.text,
              fontFamily: "'DM Mono',monospace",
            }}
          >
            {formatNumber(summary?.total_users)}
          </span>
        </StatCard>
        <StatCard t={t} label="활성 트레이더">
          <span
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: '#16A34A',
              fontFamily: "'DM Mono',monospace",
            }}
          >
            {formatNumber(summary?.active_users)}
          </span>
        </StatCard>
        <StatCard t={t} label="User Type">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Badge label="VIP" bg={t.accentBg} color={t.accent} border={t.accentBd} />
              <span
                style={{
                  fontSize: 13,
                  fontFamily: "'DM Mono',monospace",
                  color: t.text,
                  fontWeight: 500,
                }}
              >
                {formatNumber(summary?.vip_users)}
              </span>
              <span style={{ fontSize: 11, color: t.textHint }}>({vipPercent}%)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Badge label="Normal" bg={t.surface2} color={t.textSec} border={t.border2} />
              <span
                style={{
                  fontSize: 13,
                  fontFamily: "'DM Mono',monospace",
                  color: t.text,
                  fontWeight: 500,
                }}
              >
                {formatNumber(summary?.normal_users)}
              </span>
              <span style={{ fontSize: 11, color: t.textHint }}>({normalPercent}%)</span>
            </div>
            <div
              style={{
                height: 4,
                borderRadius: 2,
                background: t.surface3,
                overflow: 'hidden',
                marginTop: 2,
              }}
            >
              <div
                style={{
                  width: `${vipPercent}%`,
                  height: '100%',
                  background: t.accent,
                  borderRadius: 2,
                }}
              />
            </div>
          </div>
        </StatCard>
        <StatCard t={t} label="신규 가입">
          <span
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: t.text,
              fontFamily: "'DM Mono',monospace",
            }}
          >
            {formatNumber(summary?.yesterday_signups)}
          </span>
          <span style={{ fontSize: 10, color: t.textHint, marginTop: 2 }}>전일 기준</span>
        </StatCard>
        <StatCard t={t} label="KYC 인증 대기">
          <span
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: '#D97706',
              fontFamily: "'DM Mono',monospace",
            }}
          >
            {formatNumber(summary?.kyc.pending)}
          </span>
        </StatCard>
      </div>
      <TableFilterBar
        background={t.surface}
        borderColor={t.border}
        actions={
          <ActionButton
            onClick={() => setShowAddUserModal(true)}
            background={t.accent}
            style={{ fontFamily: "'Noto Sans KR',sans-serif" }}
          >
            <Plus size={14} strokeWidth={2} /> 회원 추가
          </ActionButton>
        }
      >
        <SearchField
          value={searchDraft}
          onChange={setSearchDraft}
          placeholder="이름, 이메일, UID, Member ID로 검색"
          minWidth={180}
          background={t.surface2}
          borderColor={t.border2}
          textColor={t.text}
          iconColor={t.text}
        />
        <SelectFilter
          value={grade}
          onChange={(value) => updateParams({ grade: value, page: 1 })}
          width={130}
          background={t.surface2}
          borderColor={t.border2}
          textColor={t.textSec}
          iconColor={t.text}
          options={[
            { value: 'all', label: '회원 등급: 전체' },
            { value: 'VIP', label: 'VIP' },
            { value: 'NORMAL', label: 'Normal' },
          ]}
        />
        <SelectFilter
          value={kycStatus}
          onChange={(value) => updateParams({ kycStatus: value, page: 1 })}
          width={140}
          background={t.surface2}
          borderColor={t.border2}
          textColor={t.textSec}
          iconColor={t.text}
          options={[
            { value: 'all', label: 'KYC: 전체' },
            { value: 'APPROVED', label: '인증' },
            { value: 'REJECTED', label: '반려' },
            { value: 'PENDING', label: '대기' },
            { value: 'NONE', label: '미인증' },
          ]}
        />
        <SelectFilter
          value={status}
          onChange={(value) => updateParams({ status: value, page: 1 })}
          width={130}
          background={t.surface2}
          borderColor={t.border2}
          textColor={t.textSec}
          iconColor={t.text}
          options={[
            { value: 'all', label: '상태: 전체' },
            { value: 'ACTIVE', label: '활성' },
            { value: 'INACTIVE', label: '비활성' },
            { value: 'BANNED', label: '영구정지' },
          ]}
        />
      </TableFilterBar>

      <DataTable
        columns={[
          { key: 'user', label: '유저', width: '21%' },
          { key: 'userType', label: '회원 등급', width: '8%' },
          { key: 'nation', label: '국가', width: '8%' },
          { key: 'kyc', label: 'KYC 상태', width: '9%' },
          { key: 'accountCount', label: '보유 계좌 수', width: '13%' },
          { key: 'totalAssets', label: '총 자산', width: '11%' },
          { key: 'regDate', label: '가입일', width: '12%' },
          { key: 'lastLogin', label: '최종 로그인', width: '10%' },
          { key: 'status', label: '상태' },
        ]}
        rows={visibleMembers}
        isLoading={isLoading}
        rowKey={(m) => m.id}
        onRowClick={(m) => navigate(getMemberDetailRoute(m.id))}
        rowStyle={(_, i, isHovered) => ({
          height: 56,
          background: isHovered ? t.surface2 : 'transparent',
          borderBottom: i < visibleMembers.length - 1 ? `1px solid ${t.border}` : 'none',
          cursor: 'pointer',
          transition: 'background 0.1s',
          opacity: isFetching && !isLoading ? 0.72 : 1,
        })}
        shellStyle={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 12,
          overflow: 'hidden',
        }}
        tableStyle={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}
        headerRowStyle={{
          background: t.surface2,
          height: 40,
          borderBottom: `1px solid ${t.border}`,
        }}
        headerCellStyle={{
          padding: '0 16px',
          textAlign: 'left',
          fontSize: 10,
          fontWeight: 600,
          color: t.textHint,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          fontFamily: "'DM Sans',sans-serif",
          whiteSpace: 'nowrap',
        }}
        emptyState={
          <div style={{ padding: 24, textAlign: 'center', color: t.textHint, fontSize: 12 }}>
            {isLoading
              ? '회원 목록을 불러오는 중입니다.'
              : isError
                ? '회원 목록을 불러오지 못했습니다.'
                : '조회 결과가 없습니다.'}
          </div>
        }
        footer={
          <TablePagination
            summary={buildPaginationSummary({
              totalItems: totalCount,
              start: paginationRange.start,
              end: paginationRange.end,
              unit: '명',
            })}
            containerStyle={{ padding: '12px 16px' }}
            borderColor={t.border}
            textColor={t.textHint}
            activeBackground={t.accent}
            inactiveBackground={t.surface2}
            inactiveBorderColor={t.border2}
            items={buildPaginationItems({
              currentPage: safeCurrentPage,
              totalPages,
              onPageChange: (page) => updateParams({ page }),
            })}
          />
        }
        rowRenderer={(m: MemberRow) => (
          <>
            <td style={{ padding: '0 16px', verticalAlign: 'middle' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: t.text,
                    fontFamily: "'DM Sans',sans-serif",
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {m.name}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: t.textHint,
                    fontFamily: "'DM Sans',sans-serif",
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {m.email}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: t.textHint,
                    fontFamily: "'DM Mono',monospace",
                    whiteSpace: 'nowrap',
                  }}
                >
                  UID : {m.uid}
                </span>
                {m.partnerMemberId ? (
                  <span
                    title="제휴사 회원 (Member ID로 로그인)"
                    style={{
                      alignSelf: 'flex-start',
                      marginTop: 2,
                      padding: '1px 6px',
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 600,
                      background: 'rgba(217,119,6,0.12)',
                      color: '#D97706',
                      fontFamily: "'DM Mono',monospace",
                      whiteSpace: 'nowrap',
                    }}
                  >
                    제휴 · {m.partnerMemberId}
                  </span>
                ) : null}
              </div>
            </td>
            <td style={{ padding: '0 16px', verticalAlign: 'middle' }}>
              <UserTypeBadge type={m.userType} t={t} />
            </td>
            <td style={{ padding: '0 16px', verticalAlign: 'middle' }}>
              <span
                style={{ fontSize: 12, color: t.textSec, fontFamily: "'Noto Sans KR',sans-serif" }}
              >
                {m.nation}
              </span>
            </td>
            <td style={{ padding: '0 16px', verticalAlign: 'middle' }}>
              <KycBadge status={m.kyc} t={t} />
            </td>
            <td style={{ padding: '0 16px', verticalAlign: 'middle' }}>
              <span style={{ fontSize: 11, color: t.textSec, fontFamily: "'DM Mono',monospace" }}>
                {m.accountCount}
              </span>
            </td>
            <td style={{ padding: '0 16px', verticalAlign: 'middle' }}>
              <span style={{ fontSize: 11, color: t.textSec, fontFamily: "'DM Mono',monospace" }}>
                {m.totalAssets}
              </span>
            </td>
            <td style={{ padding: '0 16px', verticalAlign: 'middle' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span
                  style={{
                    fontSize: 11,
                    color: t.textSec,
                    fontFamily: "'DM Mono',monospace",
                    whiteSpace: 'nowrap',
                  }}
                >
                  {m.regDate}
                </span>
                <span style={{ fontSize: 9, color: t.textHint }}>(GMT +9)</span>
              </div>
            </td>
            <td style={{ padding: '0 16px', verticalAlign: 'middle' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span
                  style={{
                    fontSize: 11,
                    color: t.textSec,
                    fontFamily: "'DM Mono',monospace",
                    whiteSpace: 'nowrap',
                  }}
                >
                  {m.lastLogin}
                </span>
                <span style={{ fontSize: 9, color: t.textHint }}>(GMT +9)</span>
              </div>
            </td>
            <td style={{ padding: '0 16px', verticalAlign: 'middle' }}>
              <StatusBadge status={m.status} t={t} />
            </td>
          </>
        )}
      />

      {showAddUserModal && (
        <AddUserModal
          dark={dark}
          onClose={() => setShowAddUserModal(false)}
          onConfirm={handleAddUserConfirm}
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
