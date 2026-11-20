import { motion } from 'motion/react';
import { X, Copy } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAccountEvaluationQuery, useAccountTradeHistoryQuery } from '@/app/queries/accounts';
import type { AccountEvaluationCheck } from '@/api/accounts';
import { formatBrowserGmtOffset, formatDateTimeByBrowserTimeZone } from '@/app/utils/date';
import { useLocale } from '@/app/i18n/LocaleContext';

type Trade = {
  deal: string;
  symbol: string;
  date: string;
  rawDate?: string;
  action: 'Buy' | 'Sell' | 'Balance';
  entry: 'In' | 'Out';
  volume: number;
  price: number;
  profit: number;
};

type ChallengeDetail = {
  accountNumber: string;
  accountId: string;
  capital: number;
  accountBalance: number;
  totalProfit: number;
  accountStatus: string;
  password: string;
  trades: Trade[];
};

interface ChallengeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  challengeDetail: ChallengeDetail;
  onTradeHistorySettled?: () => void;
}

const formatCredentialPassword = (password: string) => {
  const trimmedPassword = password.trim();

  return /[A-Za-z0-9]/.test(trimmedPassword) ? trimmedPassword : '-';
};

const isValidCredentialValue = (value: string) => /[A-Za-z0-9]/.test(value.trim());

type ChallengeText = ReturnType<typeof useLocale>['T']['challenge'];

const fillTemplate = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

const formatUsd = (value: unknown) =>
  typeof value === 'number'
    ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '-';

const formatPlain = (value: unknown) =>
  typeof value === 'number' ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '-';

/** 룰별 결과 한 줄: 'Name : detail'. 숫자 값(values)이 없는 이전 판정은 Core가 저장한 문구를 그대로 쓴다. */
const describeRuleCheck = (check: AccountEvaluationCheck, text: ChallengeText): [string, string | null] => {
  const v = check.values ?? null;
  switch (check.key) {
    case 'profit_target':
      return [
        text.ruleProfitTarget,
        v ? fillTemplate(text.ruleProfitTargetDetail, { profit: formatUsd(v.profit), target: formatUsd(v.target) }) : check.detail,
      ];
    case 'min_trading_days':
      return [
        text.ruleMinTradingDays,
        v ? fillTemplate(text.ruleMinTradingDaysDetail, { days: formatPlain(v.days), required: formatPlain(v.required) }) : check.detail,
      ];
    case 'max_drawdown': {
      if (!v) return [text.ruleMaxDrawdown, check.detail];
      if (typeof v.violated_at === 'string') {
        const at = `${formatDateTimeByBrowserTimeZone(v.violated_at)} ${formatBrowserGmtOffset(v.violated_at)}`.trim();
        return [
          text.ruleMaxDrawdown,
          fillTemplate(text.ruleMaxDrawdownViolated, { at, equity: formatUsd(v.equity), floor: formatUsd(v.floor) }),
        ];
      }
      return [
        text.ruleMaxDrawdown,
        typeof v.floor === 'number'
          ? fillTemplate(text.ruleMaxDrawdownOkWithFloor, { dd: formatUsd(v.dd), floor: formatUsd(v.floor) })
          : fillTemplate(text.ruleMaxDrawdownOk, { dd: formatUsd(v.dd) }),
      ];
    }
    case 'consistency': {
      if (!v) return [text.ruleConsistency, check.detail];
      if (v.skipped) return [text.ruleConsistency, fillTemplate(text.ruleConsistencySkipped, { total: formatUsd(v.total) })];
      return [
        text.ruleConsistency,
        fillTemplate(text.ruleConsistencyDetail, {
          best: formatUsd(v.best),
          bestDay: typeof v.best_day === 'string' ? ` (${v.best_day})` : '',
          total: formatUsd(v.total),
          ratio: typeof v.ratio === 'number' ? v.ratio.toFixed(2) : '-',
          limit: formatPlain(v.limit),
        }),
      ];
    }
    default:
      return [check.label, check.detail];
  }
};

export function ChallengeDetailModal({
  isOpen,
  onClose,
  challengeDetail,
  onTradeHistorySettled,
}: ChallengeDetailModalProps) {
  const { T } = useLocale();
  const text = T.challenge;
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const hasNotifiedTradeSettledRef = useRef(false);
  const {
    data: tradeHistoryResponse,
    isLoading: isTradeHistoryLoading,
    isError: isTradeHistoryError,
  } = useAccountTradeHistoryQuery(challengeDetail.accountId, isOpen);
  // 대회 기간이 끝나고 판정이 난 뒤에만 값이 온다 (그 전에는 null → 표시 안 함)
  const { data: evaluation } = useAccountEvaluationQuery(challengeDetail.accountId, isOpen);
  const displayPassword = useMemo(
    () => formatCredentialPassword(challengeDetail.password),
    [challengeDetail.password],
  );
  const canCopyAccountNumber = useMemo(
    () => isValidCredentialValue(challengeDetail.accountNumber),
    [challengeDetail.accountNumber],
  );
  const canCopyPassword = useMemo(
    () => isValidCredentialValue(challengeDetail.password),
    [challengeDetail.password],
  );

  useEffect(() => {
    if (isTradeHistoryLoading || hasNotifiedTradeSettledRef.current) {
      return;
    }

    hasNotifiedTradeSettledRef.current = true;
    onTradeHistorySettled?.();
  }, [isTradeHistoryLoading, onTradeHistorySettled]);

  useEffect(() => {
    if (!isOpen) {
      hasNotifiedTradeSettledRef.current = false;
    }
  }, [isOpen, challengeDetail.accountId]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, field: string) => {
    // Try modern Clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setCopiedField(field);
          setTimeout(() => setCopiedField(null), 2000);
        })
        .catch(() => {
          // Fallback to legacy method
          fallbackCopyToClipboard(text, field);
        });
    } else {
      // Use fallback if Clipboard API not available
      fallbackCopyToClipboard(text, field);
    }
  };

  const fallbackCopyToClipboard = (text: string, field: string) => {
    // Create temporary textarea element
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '2em';
    textarea.style.height = '2em';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    textarea.setAttribute('readonly', '');
    textarea.style.opacity = '0';

    document.body.appendChild(textarea);

    // Select and copy
    textarea.focus();
    textarea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
      }
    } catch (err) {
      console.error('Fallback copy failed:', err);
    }

    document.body.removeChild(textarea);
  };

  const getActionColor = (action: 'Buy' | 'Sell' | 'Balance') => {
    switch (action) {
      case 'Buy':
        return 'bg-[#00FF94]/10 text-[#00FF94] border-[#00FF94]/30';
      case 'Sell':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'Balance':
        return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    }
  };

  const formatProfit = (profit: number) => {
    const amount = `$${Math.abs(profit).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

    if (profit > 0) return `+${amount}`;
    if (profit < 0) return `-${amount}`;
    return amount;
  };

  const calculateNetProfit = (profit: number, fee: number, swap: number) => profit + fee + swap;

  const trades = useMemo<Trade[]>(() => {
    const apiTrades: Trade[] =
      tradeHistoryResponse?.items.map((trade) => ({
        deal: String(trade.deal_id),
        symbol: trade.symbol || '-',
        date: formatDateTimeByBrowserTimeZone(trade.date) || '-',
        rawDate: trade.date,
        action:
          trade.action.toUpperCase() === 'BUY'
            ? 'Buy'
            : trade.action.toUpperCase() === 'SELL'
              ? 'Sell'
              : 'Balance',
        entry: trade.entry === 'Out' ? 'Out' : 'In',
        volume: trade.volume ?? 0,
        price: trade.price ?? 0,
        profit: calculateNetProfit(trade.profit ?? 0, trade.fee ?? 0, trade.swap ?? 0),
      })) ?? [];

    return apiTrades;
  }, [tradeHistoryResponse]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-6xl max-h-[90vh] bg-[#0f0f17] border border-[#2a2a3a] rounded-xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-[#2a2a3a] bg-[#16161f]">
          <h2 className="text-2xl font-bold text-white">{text.accountDetail}</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#1a1a24] transition-colors"
          >
            <X size={24} className="text-gray-400 hover:text-white transition-colors" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-180px)] px-8 py-6">
          {/* Summary Header Cards */}
          <div className="bg-[#16161f] border border-[#2a2a3a] rounded-xl p-6 mb-6">
            {/* Primary Row - Credentials (Prominent) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-[#2a2a3a]">
              {/* Account Number */}
              <div>
                <p className="text-gray-500 text-xs mb-3 uppercase tracking-wider">
                  {text.accountNumber}
                </p>
                <div className="flex items-center gap-3">
                  <p className="text-white text-xl font-bold font-mono">
                    {challengeDetail.accountNumber}
                  </p>
                  {canCopyAccountNumber ? (
                    <button
                      onClick={() => copyToClipboard(challengeDetail.accountNumber, 'accountNumber')}
                      className="p-2 hover:bg-[#1a1a24] rounded-lg transition-colors group"
                      title={text.copyAccountNumber}
                    >
                      <Copy
                        size={18}
                        className={
                          copiedField === 'accountNumber'
                            ? 'text-[#00FF94]'
                            : 'text-gray-400 group-hover:text-white transition-colors'
                        }
                      />
                    </button>
                  ) : null}
                </div>
                {canCopyAccountNumber && copiedField === 'accountNumber' && (
                  <p className="text-[#00FF94] text-sm mt-2 font-medium">{text.copied}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <p className="text-gray-500 text-xs mb-3 uppercase tracking-wider">
                  {text.password}
                </p>
                <div className="flex items-center gap-3">
                  <p className="text-white text-xl font-bold font-mono">
                    {displayPassword}
                  </p>
                  {canCopyPassword ? (
                    <button
                      onClick={() => copyToClipboard(displayPassword, 'passwordTop')}
                      className="p-2 hover:bg-[#1a1a24] rounded-lg transition-colors group"
                      title={text.copyPassword}
                    >
                      <Copy
                        size={18}
                        className={
                          copiedField === 'passwordTop'
                            ? 'text-[#00FF94]'
                            : 'text-gray-400 group-hover:text-white transition-colors'
                        }
                      />
                    </button>
                  ) : null}
                </div>
                {canCopyPassword && copiedField === 'passwordTop' && (
                  <p className="text-[#00FF94] text-sm mt-2 font-medium">{text.copied}</p>
                )}
              </div>
            </div>

            {/* Secondary Row - Financial Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
              {/* Capital */}
              <div>
                <p className="text-gray-500 text-xs mb-2 uppercase tracking-wider">{text.capital}</p>
                <p className="text-white font-semibold text-lg">
                  $ {challengeDetail.capital.toLocaleString()}
                </p>
              </div>

              {/* Account Balance */}
              <div>
                <p className="text-gray-500 text-xs mb-2 uppercase tracking-wider">
                  {text.accountBalance}
                </p>
                <p
                  className={`font-semibold text-lg ${challengeDetail.accountBalance >= 0 ? 'text-white' : 'text-red-400'}`}
                >
                  $ {challengeDetail.accountBalance.toLocaleString()}
                </p>
              </div>

              {/* Total Profit */}
              <div>
                <p className="text-gray-500 text-xs mb-2 uppercase tracking-wider">
                  {text.totalProfit}
                </p>
                <p
                  className={`font-semibold text-lg ${challengeDetail.totalProfit >= 0 ? 'text-[#00FF94]' : 'text-red-400'}`}
                >
                  {formatProfit(challengeDetail.totalProfit)}
                </p>
              </div>
            </div>
          </div>

          {/* Challenge Result (rule checks, after the challenge period ends) */}
          {evaluation && evaluation.checks.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-white font-semibold text-lg">{text.ruleResultsTitle}</h3>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    evaluation.result === 'PASSED'
                      ? 'bg-[#00FF94]/10 text-[#00FF94]'
                      : 'bg-red-500/10 text-red-400'
                  }`}
                >
                  {evaluation.result === 'PASSED' ? text.ruleResultPassed : text.ruleResultFailed}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {evaluation.checks.map((check) => {
                  const [name, detail] = describeRuleCheck(check, text);
                  return (
                    <div
                      key={check.key}
                      className="flex items-start justify-between gap-4 bg-[#16161f] border border-[#2a2a3a] rounded-xl px-4 py-3 text-sm"
                    >
                      <span className="text-white">
                        {name}
                        {detail ? <span className="text-gray-400"> : {detail}</span> : null}
                      </span>
                      <span
                        className={`font-semibold whitespace-nowrap ${check.passed ? 'text-[#00FF94]' : 'text-red-400'}`}
                      >
                        {check.passed ? text.rulePassed : text.ruleViolated}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Trading History */}
          <div className="mb-6">
            <div className="flex items-baseline gap-2 flex-wrap mb-4">
              <h3 className="text-white font-semibold text-lg">{text.tradingHistory}</h3>
              <span className="text-gray-400 text-xs">{text.tradingHistoryNote}</span>
            </div>

            <div className="bg-[#16161f] border border-[#2a2a3a] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#2a2a3a] bg-[#0f0f17]">
                      <th className="text-left text-gray-400 text-xs font-medium px-6 py-4 uppercase tracking-wider">
                        {text.colDeal}
                      </th>
                      <th className="text-left text-gray-400 text-xs font-medium px-6 py-4 uppercase tracking-wider">
                        {text.colSymbol}
                      </th>
                      <th className="text-left text-gray-400 text-xs font-medium px-6 py-4 uppercase tracking-wider">
                        {text.colDate}
                      </th>
                      <th className="text-center text-gray-400 text-xs font-medium px-6 py-4 uppercase tracking-wider">
                        {text.colTrade}
                      </th>
                      <th className="text-center text-gray-400 text-xs font-medium px-6 py-4 uppercase tracking-wider">
                        {text.colEntry}
                      </th>
                      <th className="text-right text-gray-400 text-xs font-medium px-6 py-4 uppercase tracking-wider">
                        {text.colVolume}
                      </th>
                      <th className="text-right text-gray-400 text-xs font-medium px-6 py-4 uppercase tracking-wider">
                        {text.colPrice}
                      </th>
                      <th className="text-right text-gray-400 text-xs font-medium px-6 py-4 uppercase tracking-wider">
                        {text.colProfitShort}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {isTradeHistoryLoading ? (
                      <tr className="border-b border-[#2a2a3a]">
                        <td className="px-6 py-6 text-gray-400 text-sm" colSpan={8}>
                          {text.loadingTradingHistory}
                        </td>
                      </tr>
                    ) : isTradeHistoryError ? (
                      <tr className="border-b border-[#2a2a3a]">
                        <td className="px-6 py-6 text-red-400 text-sm" colSpan={8}>
                          {text.loadTradingHistoryFailed}
                        </td>
                      </tr>
                    ) : trades.length > 0 ? (
                      trades.map((trade, index) => (
                        <tr
                          key={`${trade.deal}-${index}`}
                          className="border-b border-[#2a2a3a] hover:bg-[#1a1a24] transition-colors"
                        >
                          <td className="px-6 py-4">
                            <span className="text-white text-sm font-mono">{trade.deal}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-gray-300 text-sm font-medium">
                              {trade.symbol || '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="whitespace-nowrap">
                              <span className="text-gray-400 text-sm">{trade.date}</span>
                              {trade.rawDate && (
                                <p className="text-gray-500 text-xs mt-1">
                                  {formatBrowserGmtOffset(trade.rawDate)}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-medium border ${getActionColor(trade.action)}`}
                              >
                                {trade.action}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-gray-300 text-sm">{trade.entry}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-white text-sm">{trade.volume.toFixed(2)}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-white text-sm">{trade.price.toFixed(2)}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span
                              className={`text-sm font-semibold ${trade.profit >= 0 ? 'text-[#00FF94]' : 'text-red-400'}`}
                            >
                              {formatProfit(trade.profit)}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr className="border-b border-[#2a2a3a]">
                        <td className="px-6 py-6 text-gray-400 text-sm" colSpan={8}>
                          {text.noTradingHistoryAvailable}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-[#2a2a3a] bg-[#16161f] flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[#0052FF] hover:bg-[#0066FF] text-white rounded-lg transition-colors font-medium"
          >
            {text.close}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

