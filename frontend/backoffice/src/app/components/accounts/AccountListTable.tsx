import type { AccountStatus, AccountTier, AdminAccount } from '@/api/account';
import type React from 'react';
import type { Account } from '../../types/account';
import { tok } from '../../theme/tokens';
import { DataTable } from '../shared/DataTable';
import { UserTypeBadge } from '../shared/Badge';
import { AcctStatusBadge } from './AccountStatusBadge';
import { formatKstDateTime, formatSignedUsdMoney, formatUsdMoney } from '../../utils/utils';
import { challengeTierLabel } from '../../utils/revenue';

const emptyValue = '-';

export type AccountListTableRow = {
  id: string;
  mt4Login?: string | number | null;
  drawerAccount: Account;
  accountNumber: string;
  user: string;
  email: string;
  userType: 'VIP' | 'Normal';
  accountType: string;
  capital: string;
  balance: string;
  profit: string;
  profitRate: string;
  profitPos: boolean;
  period: string;
  issuedDate: string;
  initialBalance: string;
  currentBalance: string;
  leverage: string;
  status: string;
  rawStatus: AccountStatus;
};

interface AccountListTableProps {
  dark: boolean;
  tier: AccountTier;
  accounts: AdminAccount[];
  footer?: React.ReactNode;
  isLoading?: boolean;
  emptyText?: string;
  context?: 'management' | 'memberDetail';
  onRowClick?: (row: AccountListTableRow) => void;
}

const display = (value: unknown) =>
  value === undefined || value === null || value === '' ? emptyValue : String(value);

const formatAccountType = (value: unknown) => {
  const displayed = display(value);
  if (displayed === emptyValue || displayed.startsWith('$')) return displayed;
  return `$${displayed}`;
};

const formatProfitRate = (profit: number, capital: number) => {
  if (!Number.isFinite(profit) || !Number.isFinite(capital) || capital <= 0) {
    return '0.00%';
  }

  const value = (profit / capital) * 100;
  if (value > 0) return `+${value.toFixed(2)}%`;
  if (value < 0) return `${value.toFixed(2)}%`;
  return '0.00%';
};

const formatAccountPeriod = (account: AdminAccount) => {
  const startAt = formatKstDateTime(account.start_at);

  if (account.tier !== 'CHALLENGE') {
    return `${startAt} (GMT+9)`;
  }

  return `${startAt} ~ ${account.end_at ? formatKstDateTime(account.end_at) : emptyValue} (GMT+9)`;
};

const getAccountId = (account: AdminAccount) =>
  account.mt4_login ? String(account.mt4_login) : display(account.account_id);

const getTierLabel = (tier: AccountTier) => {
  if (tier === 'CHALLENGE') return 'Challenge';
  if (tier === 'FUNDED') return 'Funded';
  if (tier === 'LIVE') return 'Live';
  return 'Demo';
};

const getDrawerStatus = (status: AccountStatus) => {
  if (status === 'ACTIVE') return 'Active';
  if (status === 'IN_PROGRESS') return 'Active';
  if (status === 'PASSED') return 'Active';
  if (status === 'PENDING_PAYOUT') return 'Active';
  if (status === 'INACTIVE' || status === 'PENDING') return 'Inactive';
  if (status === 'BANNED') return 'Banned';
  if (status === 'CLOSED' || status === 'FAILED') return 'Closed';
  return status;
};

const getListStatus = (status: AccountStatus) => {
  if (status === 'PENDING') return '대기';
  if (status === 'ACTIVE') return '활성';
  if (status === 'IN_PROGRESS') return '진행중';
  if (status === 'PENDING_PAYOUT') return '보상금 출금중';
  if (status === 'CLOSED') return '종료';
  if (status === 'PASSED') return '통과';
  if (status === 'FAILED') return '실패';
  if (status === 'INACTIVE') return '비활성';
  if (status === 'BANNED') return '영구정지';
  return status;
};

const toAccountListTableRow = (account: AdminAccount): AccountListTableRow => {
  const id = getAccountId(account);
  // Core는 상품명('Challenge ' 제외)을 계좌 유형으로 보여 준다. 상품명이 없으면 기존처럼 type_code.
  const accountType = account.product_name
    ? challengeTierLabel(account.product_name)
    : formatAccountType(account.type_code);
  const profit = formatSignedUsdMoney(account.total_profit);
  const balance = formatUsdMoney(account.balance);
  const period = formatAccountPeriod(account);

  return {
    id,
    mt4Login: account.mt4_login,
    drawerAccount: {
      id,
      accountId: account.account_id,
      mt4Login: account.mt4_login,
      size: accountType,
      type: getTierLabel(account.tier),
      period,
      balance,
      profit,
      profitColor: profit.startsWith('-')
        ? '#DC2626'
        : profit.startsWith('+')
          ? '#16A34A'
          : '#6B7280',
      status: getDrawerStatus(account.status),
    },
    accountNumber: id,
    user: display(account.user_name),
    email: display(account.user_email),
    userType: (account.user_grade ?? '').toUpperCase() === 'VIP' ? 'VIP' : 'Normal',
    accountType,
    capital: formatUsdMoney(account.capital),
    balance,
    profit,
    profitRate: formatProfitRate(account.total_profit, account.capital),
    profitPos: !profit.startsWith('-'),
    period,
    issuedDate: formatKstDateTime(account.created_at),
    initialBalance: formatUsdMoney(account.capital),
    currentBalance: balance,
    leverage: (() => {
      const value = account.leverage_override ?? account.leverage;
      return value === null || value === undefined ? emptyValue : `x${value}`;
    })(),
    status: getListStatus(account.status),
    rawStatus: account.status,
  };
};

const getColumns = (tier: AccountTier, context: AccountListTableProps['context']) => {
  const isMemberDetail = context === 'memberDetail';

  if (tier === 'LIVE') {
    if (isMemberDetail) {
      return [
        { key: 'accountNumber', label: '계좌번호', width: '25%' },
        { key: 'balance', label: '잔고', width: '25%' },
        { key: 'issuedDate', label: '발급일', width: '25%' },
        { key: 'status', label: '상태', width: '25%' },
      ];
    }

    return [
      { key: 'accountNumber', label: '계좌번호', width: '25%' },
      { key: 'balance', label: '잔고', width: '25%' },
      { key: 'issuedDate', label: '발급일', width: '25%' },
      { key: 'status', label: '상태', width: '25%' },
    ];
  }

  if (tier === 'DEMO') {
    if (isMemberDetail) {
      return [
        { key: 'accountNumber', label: '계좌번호', width: '18%' },
        { key: 'currentBalance', label: '현재잔고', width: '18%' },
        { key: 'initialBalance', label: '초기잔고', width: '18%' },
        { key: 'leverage', label: '레버리지', width: '14%' },
        { key: 'createdDate', label: '생성일', width: '18%' },
        { key: 'status', label: '상태', width: '14%' },
      ];
    }

    return [
      { key: 'accountNumber', label: '계좌번호', width: '18%' },
      { key: 'currentBalance', label: '현재잔고', width: '18%' },
      { key: 'initialBalance', label: '초기잔고', width: '18%' },
      { key: 'leverage', label: '레버리지', width: '14%' },
      { key: 'createdDate', label: '생성일', width: '18%' },
      { key: 'status', label: '상태', width: '14%' },
    ];
  }

  return tier === 'CHALLENGE'
    ? [
        { key: 'account', label: '계좌번호', width: '13%' },
        { key: 'userType', label: '회원 등급', width: '9%' },
        { key: 'type', label: '계좌 유형', width: '12%' },
        { key: 'balance', label: '잔고', width: '11%' },
        { key: 'capital', label: '자본금', width: '11%' },
        { key: 'profit', label: '수익', width: '10%' },
        { key: 'profitRate', label: '수익률', width: '9%' },
        { key: 'period', label: '챌린지 기간', width: '17%' },
        { key: 'status', label: '상태', width: '8%' },
      ]
    : [
        { key: 'account', label: '계좌번호', width: '13%' },
        { key: 'userType', label: '회원 등급', width: '9%' },
        { key: 'type', label: '계좌 유형', width: '12%' },
        { key: 'balance', label: '잔고', width: '11%' },
        { key: 'capital', label: '펀디드 자본금', width: '12%' },
        { key: 'profit', label: '수익', width: '10%' },
        { key: 'profitRate', label: '수익률', width: '9%' },
        { key: 'period', label: '펀디드 시작일', width: '16%' },
        { key: 'status', label: '상태', width: '8%' },
      ];
};

export function AccountListTable({
  dark,
  tier,
  accounts,
  footer,
  isLoading = false,
  emptyText = '조회 결과가 없습니다.',
  context = 'management',
  onRowClick,
}: AccountListTableProps) {
  const t = tok(dark);
  const rows = accounts.map(toAccountListTableRow);

  return (
    <DataTable
      columns={getColumns(tier, context)}
      rows={rows}
      isLoading={isLoading}
      rowKey={(row) => `${row.id}-${row.mt4Login ?? ''}`}
      onRowClick={onRowClick}
      rowStyle={(_, index, isHovered) => ({
        height: 56,
        background: isHovered ? t.surface2 : 'transparent',
        borderBottom: index < rows.length - 1 ? `1px solid ${t.border}` : 'none',
        cursor: onRowClick ? 'pointer' : 'default',
        transition: 'background 0.1s',
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
          {emptyText}
        </div>
      }
      footer={footer}
      rowRenderer={(row) => {
        if (tier === 'LIVE') {
          return (
            <LiveRow
              row={row}
              text={t.text}
              textSec={t.textSec}
            />
          );
        }

        if (tier === 'DEMO') {
          return (
            <DemoRow
              row={row}
              text={t.text}
              textSec={t.textSec}
            />
          );
        }

        return <ChallengeFundedRow row={row} tier={tier} t={t} />;
      }}
    />
  );
}

function AccountCell({ row }: { row: AccountListTableRow }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: 'inherit' }}>
        {row.accountNumber}
      </span>
      <span style={{ fontSize: 10, color: 'inherit', opacity: 0.72 }}>{row.user}</span>
      <span style={{ fontSize: 10, color: 'inherit', opacity: 0.72 }}>{row.email}</span>
    </div>
  );
}

function ChallengeFundedRow({
  row,
  tier,
  t,
}: {
  row: AccountListTableRow;
  tier: AccountTier;
  t: ReturnType<typeof tok>;
}) {
  return (
    <>
      <td style={{ padding: '0 16px', color: t.text }}>
        <AccountCell row={row} />
      </td>
      <td style={{ padding: '0 16px' }}>
        <UserTypeBadge type={row.userType} t={t} />
      </td>
      <td style={{ padding: '0 16px' }}>
        <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: t.textSec }}>
          {row.accountType}
        </span>
      </td>
      <td style={{ padding: '0 16px' }}>
        <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: t.textSec }}>
          {row.balance}
        </span>
      </td>
      <td style={{ padding: '0 16px' }}>
        <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: t.textSec }}>
          {row.capital}
        </span>
      </td>
      <td style={{ padding: '0 16px' }}>
        <PerformanceText value={row.profit} positive={row.profitPos} />
      </td>
      <td style={{ padding: '0 16px' }}>
        <PerformanceText value={row.profitRate} positive={row.profitPos} />
      </td>
      <td style={{ padding: '0 16px' }}>
        <span
          style={{
            fontSize: 9.5,
            fontFamily: "'DM Mono',monospace",
            color: t.textSec,
            whiteSpace: 'nowrap',
          }}
        >
          {row.period}
        </span>
      </td>
      <td style={{ padding: '0 16px' }}>
        <AcctStatusBadge status={row.status} />
      </td>
    </>
  );
}

function LiveRow({
  row,
  text,
  textSec,
}: {
  row: AccountListTableRow;
  text: string;
  textSec: string;
}) {
  return (
    <>
      <td style={{ padding: '0 16px', color: text }}>
        <AccountCell row={row} />
      </td>
      <td style={{ padding: '0 16px', fontSize: 13, color: text, fontFamily: "'DM Mono', monospace" }}>
        {row.balance}
      </td>
      <DateCell value={row.issuedDate} color={textSec} />
      <StatusCell status={row.status} />
    </>
  );
}

function DemoRow({
  row,
  text,
  textSec,
}: {
  row: AccountListTableRow;
  text: string;
  textSec: string;
}) {
  return (
    <>
      <td style={{ padding: '0 16px', color: text }}>
        <AccountCell row={row} />
      </td>
      <td style={{ padding: '0 16px', fontSize: 13, color: text, fontFamily: "'DM Mono', monospace" }}>
        {row.currentBalance}
      </td>
      <td style={{ padding: '0 16px', fontSize: 13, color: text, fontFamily: "'DM Mono', monospace" }}>
        {row.initialBalance}
      </td>
      <td style={{ padding: '0 16px', fontSize: 13, color: text, fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
        {row.leverage}
      </td>
      <DateCell value={row.issuedDate} color={textSec} />
      <StatusCell status={row.status} />
    </>
  );
}

function DateCell({ value, color }: { value: string; color: string }) {
  return (
    <td
      style={{
        padding: '0 16px',
        fontSize: 12,
        color,
        fontFamily: "'DM Mono', monospace",
        whiteSpace: 'nowrap',
      }}
    >
      {value}
    </td>
  );
}

function StatusCell({ status }: { status: string }) {
  return (
    <td style={{ padding: '0 16px' }}>
      <AcctStatusBadge status={status} />
    </td>
  );
}

function PerformanceText({ value, positive }: { value: string; positive: boolean }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontFamily: "'DM Mono',monospace",
        color: positive ? '#16A34A' : '#DC2626',
      }}
    >
      {value}
    </span>
  );
}
