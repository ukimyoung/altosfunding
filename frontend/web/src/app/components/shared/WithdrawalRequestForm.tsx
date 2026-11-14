import { motion } from 'motion/react';
import { ArrowLeft, ChevronRight, Home, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { accountsQueryKeys, useAccountDetailQuery } from '@/app/queries/accounts';
import { payoutsQueryKeys, useCalculatePayoutQuery, useMyPayoutsQuery } from '@/app/queries/payouts';
import { createPayoutRequest } from '@/api/payouts';
import { formatDateByBrowserTimeZone } from '@/app/utils/date';
import { useInView } from 'react-intersection-observer';
import { useSearchParams } from 'react-router';
import { getApiErrorMessage } from '@altosfunding/shared/api/errors';
import { useLocale } from '@/app/i18n/LocaleContext';

type WithdrawalHistory = {
  no: number;
  requestedAmount: number;
  payoutFee: number;
  netAmountReceived: number;
  status: 'Pending' | 'Completed' | 'Failed';
  requestDate: string;
  completionDate: string | null;
};

const formatPayoutFee = (fee: number) =>
  fee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatCurrency = (amount: number | null | undefined, minimumFractionDigits = 2) =>
  typeof amount === 'number'
    ? `$${amount.toLocaleString('en-US', { minimumFractionDigits, maximumFractionDigits: 2 })}`
    : '-';

interface WithdrawalRequestFormProps {
  onClose: () => void;
  onPayoutSuccess: () => void;
}

export function WithdrawalRequestForm({ onClose, onPayoutSuccess }: WithdrawalRequestFormProps) {
  const { T } = useLocale();
  const text = T.funded;
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const accountId = searchParams.get('account') ?? '';
  const [formError, setFormError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileHistory, setMobileHistory] = useState<WithdrawalHistory[]>([]);
  const itemsPerPage = 20;
  const { ref: mobileLoadMoreRef, inView: mobileLoadMoreInView } = useInView({ threshold: 0.1 });
  const { data: accountDetail, isFetching: isFetchingAccountDetail } = useAccountDetailQuery(
    accountId,
    accountId.length > 0,
  );
  const payoutAmount =
    typeof accountDetail?.available_balance === 'number' ? accountDetail.available_balance : 0;
  const { data: calculatedPayout, isFetching: isFetchingCalculatedPayout } =
    useCalculatePayoutQuery(
      {
        account_id: accountId,
        amount: payoutAmount,
      },
      accountId.length > 0 && payoutAmount > 0,
    );
  const { data: payoutsResponse, isFetching } = useMyPayoutsQuery({
    account_id: accountId,
    page: currentPage,
    size: itemsPerPage,
  });

  const accountNumber =
    typeof accountDetail?.mt4_login === 'number' ? accountDetail.mt4_login.toString() : '-';
  const creationDate = formatDateByBrowserTimeZone(accountDetail?.created_at ?? '') || '-';
  const totalBalance = formatCurrency(accountDetail?.balance);
  const availableBalance = formatCurrency(accountDetail?.available_balance);
  const fundingAmount = formatCurrency(accountDetail?.capital);
  const totalCompletedPayout = formatCurrency(accountDetail?.total_completed_payout);
  const requestPayoutAmount = formatCurrency(calculatedPayout?.gross_profit);
  const requestPayoutFee = formatCurrency(calculatedPayout?.total_fee);
  const requestNetAmount = formatCurrency(calculatedPayout?.amount);
  const isAccountInformationLoading = isFetchingAccountDetail && !accountDetail;
  const isPayoutRequestLoading =
    isAccountInformationLoading || (isFetchingCalculatedPayout && !calculatedPayout);
  const canSubmit = accountId.length > 0 && !!calculatedPayout;
  const renderShowingPayoutRequests = () => {
    const values = {
      count: String(withdrawalHistory.length),
      total: String(payoutsResponse?.total ?? 0),
    };

    return text.showingPayoutRequests.split(/(\{count\}|\{total\})/g).map((part, index) => {
      if (part === '{count}') {
        return (
          <span key={`${part}-${index}`} className="text-white font-medium">
            {values.count}
          </span>
        );
      }

      if (part === '{total}') {
        return (
          <span key={`${part}-${index}`} className="text-white font-medium">
            {values.total}
          </span>
        );
      }

      return part;
    });
  };

  const withdrawalHistory: WithdrawalHistory[] = useMemo(() => {
    const mapStatus = (status: string): WithdrawalHistory['status'] => {
      const normalized = status.trim().toUpperCase();

      if (normalized === 'REQUESTED') {
        return 'Pending';
      }

      if (normalized === 'APPROVED' || normalized === 'EXECUTED') {
        return 'Completed';
      }

      if (normalized === 'REJECTED' || normalized === 'FAILED') {
        return 'Failed';
      }

      return 'Pending';
    };

    return (
      payoutsResponse?.items.map((item) => {
        const status = mapStatus(item.status);
        const netAmountReceived = status === 'Failed' ? 0 : item.amount;

        return {
          no: item.id,
          requestedAmount: item.gross_profit,
          payoutFee: item.total_fee,
          netAmountReceived,
          status,
          requestDate: formatDateByBrowserTimeZone(item.created_at) || '-',
          completionDate:
            formatDateByBrowserTimeZone(item.executed_at ?? item.approved_at ?? '') || null,
        };
      }) ?? []
    );
  }, [payoutsResponse]);

  useEffect(() => {
    if (!payoutsResponse) {
      return;
    }

    setMobileHistory((prev) => {
      if (currentPage === 1) {
        return withdrawalHistory;
      }

      const existing = new Set(prev.map((item) => item.no));
      const next = withdrawalHistory.filter((item) => !existing.has(item.no));
      return [...prev, ...next];
    });
  }, [currentPage, payoutsResponse, withdrawalHistory]);

  useEffect(() => {
    const hasMore = currentPage < (payoutsResponse?.pages ?? 1);

    if (mobileLoadMoreInView && hasMore && !isFetching) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [currentPage, isFetching, mobileLoadMoreInView, payoutsResponse?.pages]);

  // const handleCopyAddress = () => {
  //   const textArea = document.createElement('textarea');
  //   textArea.value = withdrawalAddress;
  //   textArea.style.position = 'fixed';
  //   textArea.style.opacity = '0';
  //   document.body.appendChild(textArea);
  //   textArea.select();

  //   try {
  //     document.execCommand('copy');
  //     setAddressCopied(true);
  //     setTimeout(() => setAddressCopied(false), 2000);
  //   } catch (err) {
  //     console.error('Failed to copy:', err);
  //   }

  //   document.body.removeChild(textArea);
  // };

  const payoutRequestMutation = useMutation({
    mutationFn: createPayoutRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: payoutsQueryKeys.all });
      onPayoutSuccess();
      setFormError('');
    },
    onError: (error) => {
      setFormError(getApiErrorMessage(error, text.submitPayoutFailed));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!calculatedPayout || !accountId) {
      return;
    }

    const payoutRequestPayload = {
      account_id: accountId,
      amount: calculatedPayout.gross_profit,
      currency: calculatedPayout.currency,
      network: calculatedPayout.network || '',
      wallet_address: '',
    };

    payoutRequestMutation.mutate(payoutRequestPayload);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Breadcrumb Navigation */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm mb-4">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-1"
          >
            <Home size={16} />
            <span>{text.breadcrumbDashboard}</span>
          </button>
          <ChevronRight size={16} className="text-gray-600" />
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            {text.breadcrumbFundedAccount}
          </button>
          <ChevronRight size={16} className="text-gray-600" />
          <span className="text-white font-medium">{text.breadcrumbRequestPayout}</span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-3xl font-bold mb-2">{text.requestPayoutTitle}</h1>
            <p className="text-gray-400 text-sm">{text.requestPayoutSubtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1a24] text-gray-400 hover:text-white hover:bg-[#2a2a3a] rounded-lg transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="font-medium">{text.back}</span>
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
        {/* Left Panel - Account Information Card */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="lg:col-span-2"
        >
          <div className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl p-6 sticky top-8">
            <h2 className="text-white text-lg font-semibold mb-6 pb-1 border-b border-[#1a1a24]">
              {text.accountInformation}
            </h2>

            {isAccountInformationLoading ? (
              <div className="flex min-h-[220px] items-center justify-center">
                <Loader2 size={28} className="animate-spin text-[#0052FF]" />
              </div>
            ) : (
              <>
                {/* Account Number */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5 mb-6 border-b border-[#1a1a24]">
                  <div>
                    <label className="text-gray-400 text-xs font-medium mb-2 block uppercase tracking-wider">
                      {text.accountIdField}
                    </label>
                    <p className="text-white text-xl font-bold font-mono">{accountNumber}</p>
                  </div>

                  {/* Creation Date */}
                  <div>
                    <label className="text-gray-400 text-xs font-medium mb-2 block uppercase tracking-wider">
                      {text.creationDate}
                    </label>
                    <p className="text-white text-base font-semibold">{creationDate}</p>
                  </div>
                </div>

                {/* Balance Information */}
                <div className="space-y-4 mb-6">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">
                      {text.totalBalance}
                    </span>
                    <span className="text-white text-lg font-bold">{totalBalance}</span>
                  </div>
                  {/* <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">
                  Pending Payout
                </span>
                <span className="text-[#FFB800] text-lg font-bold">
                  ${pendingPayout.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div> */}
                  <div className="flex items-center justify-between pb-4 border-b border-[#1a1a24]">
                    <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">
                      {text.availableBalanceField}
                    </span>
                    <span className="text-[#00FF94] text-lg font-bold">{availableBalance}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
                  {/* Funded Capital */}
                  <div>
                    <label className="text-gray-400 text-xs font-medium mb-2 block uppercase tracking-wider">
                      {text.fundedCapital}
                    </label>
                    <p className="text-white text-xl font-bold">{fundingAmount}</p>
                  </div>

                  {/* Total Completed Payout */}
                  <div>
                    <label className="text-gray-400 text-xs font-medium mb-2 block uppercase tracking-wider">
                      {text.totalCompletedPayout}
                    </label>
                    <p className="text-[#0052FF] text-xl font-bold">{totalCompletedPayout}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.div>

        {/* Right Panel - Withdrawal Form */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="lg:col-span-3"
        >
          <form
            onSubmit={handleSubmit}
            className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl p-8"
          >
            <h2 className="text-white text-lg font-semibold mb-6 pb-3 border-b border-[#1a1a24]">
              {text.payoutRequestForm}
            </h2>

            {isPayoutRequestLoading ? (
              <div className="flex min-h-[220px] items-center justify-center">
                <Loader2 size={28} className="animate-spin text-[#0052FF]" />
              </div>
            ) : (
              <>
                {/* Payout Amount Breakdown */}
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-6 p-5 bg-gradient-to-br from-[#0052FF]/10 to-[#0052FF]/5 border border-[#0052FF]/20 rounded-xl space-y-3"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-[#2a2a3a]">
                    <p className="text-gray-400 text-sm">{text.payoutAmountLabel}</p>
                    <p className="text-white text-lg font-semibold">{requestPayoutAmount}</p>
                  </div>
                  <div className="flex items-center justify-between pb-3 border-b border-[#2a2a3a]">
                    <p className="text-gray-400 text-sm">{text.colPayoutFee}</p>
                    <p className="text-red-400 text-lg font-semibold">
                      {calculatedPayout ? `-${requestPayoutFee}` : '-'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-gray-400 text-sm font-semibold uppercase tracking-wider">
                      {text.netAmountReceived}
                    </p>
                    <p className="text-[#00FF94] text-2xl font-bold">{requestNetAmount}</p>
                  </div>
                </motion.div>

                {formError && <p className="text-red-400 text-sm mb-6">{formError}</p>}

                {/* Submit Button */}
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-6 py-4 bg-[#1a1a24] text-white rounded-xl font-semibold hover:bg-[#2a2a3a] transition-colors border border-[#2a2a3a]"
                  >
                    {text.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={!canSubmit || payoutRequestMutation.isPending}
                    className="flex-1 px-6 py-4 bg-gradient-to-r from-[#0052FF] to-[#0052FF]/80 text-white rounded-xl font-bold text-base hover:shadow-lg hover:shadow-[#0052FF]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center justify-center gap-2"
                  >
                    {payoutRequestMutation.isPending ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        {text.processing}
                      </>
                    ) : (
                      text.submitPayoutRequest
                    )}
                  </button>
                </div>
              </>
            )}
          </form>
        </motion.div>
      </div>

      {/* Payout History Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-[#1a1a24]">
          <h2 className="text-white text-xl font-semibold mb-1">{text.payoutHistory}</h2>
          <p className="text-gray-400 text-sm">{text.payoutHistorySubtitle}</p>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#1a1a24]">
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {text.colRequestNo}
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {text.colPayoutAmount}
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {text.colPayoutFee}
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {text.colNetAmountReceived}
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {text.colStatus}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {text.colRequestDate}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {text.colCompletionDate}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a24]">
              {withdrawalHistory.map((item, index) => (
                <motion.tr
                  key={item.no}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.3 + index * 0.1 }}
                  className="hover:bg-[#1a1a24]/50 transition-colors"
                >
                  <td className="px-6 py-5 whitespace-nowrap">
                    <p className="text-white text-sm font-mono font-medium">#{item.no}</p>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap text-right">
                    <p className="text-white text-sm font-semibold">
                      $
                      {item.requestedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap text-right">
                    <p className="text-red-400 text-sm font-semibold">
                      {item.status === 'Failed' ? '-' : `$${formatPayoutFee(item.payoutFee)}`}
                    </p>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap text-right">
                    <p className="text-[#00FF94] text-sm font-semibold">
                      {item.netAmountReceived === 0
                        ? '-'
                        : `$${item.netAmountReceived.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                    </p>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <div className="flex justify-center">
                      <span
                        className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold ${
                          item.status === 'Pending'
                            ? 'bg-[#FFB800]/10 text-[#FFB800]'
                            : item.status === 'Failed'
                              ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                              : 'bg-[#00FF94]/10 text-[#00FF94]'
                        }`}
                      >
                        {item.status === 'Pending'
                          ? text.statusPending
                          : item.status === 'Failed'
                            ? text.statusFailed
                            : text.statusCompleted}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <p className="text-gray-400 text-sm">{item.requestDate}</p>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <p className="text-gray-400 text-sm">{item.completionDate || '-'}</p>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Desktop Pagination */}
        <div className="hidden md:flex p-6 border-t border-[#1a1a24] items-center justify-between flex-wrap gap-4">
          <p className="text-gray-400 text-sm">
            {renderShowingPayoutRequests()}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage <= 1}
              className="px-4 py-2 bg-[#1a1a24] text-gray-400 rounded-lg text-sm hover:bg-[#2a2a3a] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {text.previous}
            </button>
            <button className="px-4 py-2 bg-[#0052FF] text-white rounded-lg text-sm font-medium hover:bg-[#0052FF]/90 transition-colors">
              {currentPage}
            </button>
            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(payoutsResponse?.pages ?? 1, prev + 1))
              }
              disabled={currentPage >= (payoutsResponse?.pages ?? 1)}
              className="px-4 py-2 bg-[#1a1a24] text-gray-400 rounded-lg text-sm hover:bg-[#2a2a3a] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {text.next}
            </button>
          </div>
        </div>

        {/* Mobile Card View + Infinite Scroll */}
        <div className="md:hidden p-4 space-y-4">
          {mobileHistory.map((item, index) => (
              <motion.div
                key={`${item.no}-${index}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (index % itemsPerPage) * 0.05 }}
                className="bg-[#16161f] border border-[#2a2a3a] rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <p className="text-white text-sm font-mono font-medium">#{item.no}</p>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                      item.status === 'Pending'
                        ? 'bg-[#FFB800]/10 text-[#FFB800] border border-[#FFB800]/30'
                        : item.status === 'Failed'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                          : 'bg-[#00FF94]/10 text-[#00FF94] border border-[#00FF94]/30'
                    }`}
                  >
                    {item.status === 'Pending'
                      ? text.statusPending
                      : item.status === 'Failed'
                        ? text.statusFailed
                        : text.statusCompleted}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">{text.colPayoutAmount}</span>
                    <span className="text-white font-semibold">
                      ${item.requestedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{text.colPayoutFee}</span>
                    <span className="text-red-400 font-semibold">
                      {item.status === 'Failed' ? '-' : `-$${formatPayoutFee(item.payoutFee)}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{text.netAmountReceived}</span>
                    <span className="text-[#00FF94] font-semibold">
                      {item.netAmountReceived === 0
                        ? '-'
                        : `$${item.netAmountReceived.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                          })}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{text.colRequestDate}</span>
                    <span className="text-gray-300">{item.requestDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{text.colCompletionDate}</span>
                    <span className="text-gray-300">{item.completionDate || '-'}</span>
                  </div>
                </div>
              </motion.div>
          ))}

          <div ref={mobileLoadMoreRef} className="py-4 flex justify-center items-center">
            {isFetching ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Loader2 size={16} className="animate-spin text-[#0052FF]" />
                {text.loading}
              </div>
            ) : currentPage < (payoutsResponse?.pages ?? 1) ? (
              <div className="h-4" />
            ) : mobileHistory.length > 0 ? (
              <p className="text-gray-500 text-xs">{text.endOfPayoutHistory}</p>
            ) : null}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

