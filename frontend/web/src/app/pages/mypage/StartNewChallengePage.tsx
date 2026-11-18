import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check,
  Plus,
  Minus,
  X,
  Wallet,
  CheckCircle,
  AlertCircle,
  Loader2,
  Tag,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { Toast } from '../../components/shared/Toast';
import { SuccessNotification } from '../../components/shared/SuccessNotification';
import { validateCoupon, type ValidateCouponResponse } from '@/api/coupons';
import { completePayment, getMyOrder, type OrderDetail } from '@/api/orders';
import type { ChallengeOffer, ChallengeOfferFunded, ChallengeOfferRules } from '@/api/products';
import { useListChallengeOffersQuery } from '@/app/queries/products';
import { useMyAssetQuery } from '@/app/queries/assets';
import { useMeQuery } from '@/app/queries/profile';
import { hasRequiredProfileName } from '@/app/utils/profile';
import { useLocale } from '@/app/i18n/LocaleContext';
import { BannerPopup } from '@/app/components/shared/BannerPopup';
import { InfoTooltip } from '@/app/components/shared/InfoTooltip';

// 카드 한 장 = 판매 중인 챌린지 상품 하나 (백오피스 챌린지 관리 > 상품 템플릿 > 챌린지 상품).
// 예전 하드코딩 템플릿(Starter/Pro/Elite/Prime) 대신 Core /challenges/products 값을 그대로 쓴다.
type AccountType = {
  id: string;
  /** 지금 신청할 수 있는 모집 중 회차. 없으면 카드를 선택할 수 없다. */
  challengeId?: string;
  name: string;
  /** 실제 결제 금액 (할인가격이 있으면 할인가격) */
  price: number;
  /** 할인 중일 때만 원가격 (취소선 표시용) */
  originalPrice: number | null;
  capital: number;
  leverage: number;
  durationDays: number;
  rules: ChallengeOfferRules | null;
  funded: ChallengeOfferFunded | null;
  /** MOST POPULAR 뱃지 (백오피스 챌린지 상품 팝업에서 체크) */
  isMostPopular: boolean;
  isAvailable: boolean;
};

const formatCapital = (capital: number) => `$${capital.toLocaleString('en-US')}`;

const formatMoney = (amount: number) =>
  `$${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

const formatPrice = (amount: number) =>
  amount.toLocaleString('en-US', { maximumFractionDigits: 2 });

const toAccountType = (offer: ChallengeOffer): AccountType => ({
  id: offer.product_id,
  challengeId: offer.open_challenge?.challenge_id,
  name: offer.name,
  price: offer.final_price_usdt,
  originalPrice:
    offer.discount_price_usdt != null && offer.discount_price_usdt < offer.price_usdt
      ? offer.price_usdt
      : null,
  capital: offer.capital,
  leverage: offer.leverage,
  durationDays: offer.duration_days,
  rules: offer.rules,
  funded: offer.funded,
  isMostPopular: offer.is_most_popular,
  isAvailable: Boolean(offer.open_challenge),
});

// 결제: Core가 통합 지갑에서 차감하고 주문을 만든 뒤 바로 응답한다. MT4 계좌는 Worker가 발급한다(발급 중 → 완료).
const PAYMENT_ENABLED = true;
// 쿠폰은 Core에 아직 없다. 기능이 들어오면 true로 바꾸면 결제 모달의 할인 코드 입력이 다시 보인다.
const COUPON_ENABLED = false;
// 결제 뒤 계좌 발급 상태를 확인하는 간격·최대 시간
const ORDER_POLL_MS = 3000;
const ORDER_POLL_LIMIT_MS = 3 * 60 * 1000;

const formatUsdt = (amount: number) =>
  `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDT`;

type ApiErrorResponse = {
  error_code?: string;
  message?: string;
  message_key?: string;
  detail?: unknown;
};

const getPaymentErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) {
    return fallbackMessage;
  }

  const data = error.response?.data;

  if (!data) {
    return fallbackMessage;
  }

  return data.message || data.error_code || data.message_key || fallbackMessage;
};

// const formatChallengeName = (challengeName: string) =>
//   challengeName.replace(/\s*\([^)]*\)\s*$/, '');

// const formatStartAt = (startAt: string) =>
//   new Intl.DateTimeFormat('en-US', {
//     month: 'short',
//     day: 'numeric',
//     hour: '2-digit',
//     minute: '2-digit',
//   }).format(new Date(startAt));

export function StartNewChallengePage() {
  const navigate = useNavigate();
  const { T } = useLocale();
  const text = T.startNewChallenge;
  const tooltips = text.tooltips;
  const getAccountDisplayName = (account: AccountType) => account.name;
  // 디자인대로 카드 제목은 상품명에서 'Challenge ' 접두어를 뺀 등급명만 (예: Challenge Elite → ELITE)
  const getCardTitle = (account: AccountType) =>
    account.name.replace(/^challenge\s+/i, '') || account.name;
  const formatDays = (days: number) => text.daysFormat.replace('{n}', String(days));
  // 금액이 0이거나 없으면 '없음'
  const formatLimit = (amount: number | null | undefined) =>
    amount ? formatMoney(amount) : text.none;
  const formatLeverage = (leverage: number) => `1:${leverage}`;
  // 최대 Mini·Micro 계약 수 (예: 1 Mini (10 Micro)). 둘 다 없으면 '없음'
  const formatContracts = (rules: ChallengeOfferRules | null | undefined) => {
    const mini = rules?.max_mini_contracts;
    const micro = rules?.max_micro_contracts;
    if (mini && micro) return `${mini} Mini (${micro} Micro)`;
    if (mini) return `${mini} Mini`;
    if (micro) return `${micro} Micro`;
    return text.none;
  };
  // 일관성(%). 0이거나 없으면 '없음'
  const formatPct = (pct: number | null | undefined) =>
    pct ? `${pct.toLocaleString('en-US', { maximumFractionDigits: 2 })}%` : text.none;
  const formatProfitSplit = (payoutRatio: number) =>
    `${formatPrice(payoutRatio)}/${formatPrice(100 - payoutRatio)}`;
  const profitSplitTooltip = (payoutRatio: number) =>
    tooltips.profitSplit
      .replace('{trader}', formatPrice(payoutRatio))
      .replace('{company}', formatPrice(100 - payoutRatio));
  const maxDrawdownLabel = (rules: ChallengeOfferRules | null) =>
    rules?.dd_calc_method === 'EOD' ? text.maxDrawdownEod : text.maxDrawdown;
  const maxDrawdownTooltip = (rules: ChallengeOfferRules | null) =>
    rules?.dd_calc_method === 'EOD' ? tooltips.maxDrawdownEod : tooltips.maxDrawdown;
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [showPaymentSuccessToast, setShowPaymentSuccessToast] = useState<boolean>(false);
  const [showInsufficientFundsToast, setShowInsufficientFundsToast] = useState<boolean>(false);
  const [isCompletingPayment, setIsCompletingPayment] = useState<boolean>(false);
  const [isValidatingChallenge, setIsValidatingChallenge] = useState<boolean>(false);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [apiErrorMessage, setApiErrorMessage] = useState<string>('');
  const [showPaymentComingSoon, setShowPaymentComingSoon] = useState<boolean>(false);
  const [discountCode, setDiscountCode] = useState('');
  const [couponPreview, setCouponPreview] = useState<ValidateCouponResponse | null>(null);
  const [discountMessage, setDiscountMessage] = useState('');
  const [discountStatus, setDiscountStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    'idle',
  );
  // 결제 결과 (계좌 발급 진행 상황)
  const [purchaseResult, setPurchaseResult] = useState<OrderDetail | null>(null);
  const pollStartedAt = useRef<number>(0);
  const {
    data: challengeOffers,
    isLoading: isChallengeSummaryLoading,
    refetch: refetchChallengeSummary,
  } = useListChallengeOffersQuery();
  const { data: myAssetSummary, refetch: refetchMyAsset } = useMyAssetQuery();
  const { data: me } = useMeQuery();
  const sortedChallenges = useMemo(
    () => (challengeOffers?.items ?? []).map(toAccountType),
    [challengeOffers],
  );

  const selectedAccountData = sortedChallenges.find(
    (challenge) => challenge.id === selectedAccount,
  );
  const selectedAccountFee = selectedAccountData ? selectedAccountData.price : 0;
  const baseAmount = selectedAccountFee * quantity;
  const discountAmount = couponPreview?.discount_amount ?? 0;
  const totalAmount = couponPreview?.final_amount ?? baseAmount;
  const totalAsset = myAssetSummary?.total_asset ?? 0;
  const remainingBalance = totalAsset - totalAmount;
  const amountNeeded = Math.max(totalAmount - totalAsset, 0);

  useEffect(() => {
    const available = sortedChallenges.filter((challenge) => challenge.isAvailable);
    const hasSelectedChallenge = available.some((challenge) => challenge.id === selectedAccount);

    if (!hasSelectedChallenge) {
      // MOST POPULAR 상품을 먼저, 없으면 신청할 수 있는 첫 상품을 고른다.
      setSelectedAccount(
        available.find((challenge) => challenge.isMostPopular)?.id ?? available[0]?.id ?? '',
      );
    }
  }, [selectedAccount, sortedChallenges]);

  useEffect(() => {
    if (!showPaymentSuccessToast) {
      return;
    }

    const timer = setTimeout(() => {
      setShowPaymentSuccessToast(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [showPaymentSuccessToast]);

  // 계좌 발급이 끝날 때까지 주문 상태를 다시 읽는다.
  useEffect(() => {
    if (!purchaseResult || purchaseResult.status !== 'PENDING') {
      return;
    }
    if (Date.now() - pollStartedAt.current > ORDER_POLL_LIMIT_MS) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const latest = await getMyOrder(purchaseResult.order_id);
        setPurchaseResult(latest);
        if (latest.status !== 'PENDING') {
          await refetchMyAsset();
        }
      } catch {
        // 다음 주기에 다시 시도한다.
        setPurchaseResult((prev) => (prev ? { ...prev } : prev));
      }
    }, ORDER_POLL_MS);

    return () => clearTimeout(timer);
  }, [purchaseResult, refetchMyAsset]);

  useEffect(() => {
    if (!showPaymentModal && !showInsufficientFundsToast) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showPaymentModal, showInsufficientFundsToast]);

  useEffect(() => {
    if (discountStatus === 'idle') {
      return;
    }

    setCouponPreview(null);
    setDiscountMessage('');
    setDiscountStatus('idle');
  }, [quantity, selectedAccountFee]);

  const handleQuantityChange = (delta: number) => {
    const newQuantity = quantity + delta;
    if (newQuantity >= 1 && newQuantity <= 10) {
      setQuantity(newQuantity);
    }
  };

  const handleVerifyCode = async () => {
    const couponCode = discountCode.trim();

    if (!couponCode || !selectedAccountData) {
      return;
    }

    setDiscountStatus('loading');

    try {
      const preview = await validateCoupon({
        coupon_code: couponCode,
        product_tier: selectedAccountData.name,
        unit_price: selectedAccountFee,
        quantity,
      });

      if (preview.valid) {
        setCouponPreview(preview);
        setDiscountMessage(preview.message);
        setDiscountStatus('success');
      } else {
        setCouponPreview(null);
        setDiscountMessage(text.discountInvalid);
        setDiscountStatus('error');
      }
    } catch (error) {
      setCouponPreview(null);
      setDiscountMessage(getPaymentErrorMessage(error, text.discountInvalid));
      setDiscountStatus('error');
    }
  };

  const resetDiscount = () => {
    setDiscountCode('');
    setCouponPreview(null);
    setDiscountMessage('');
    setDiscountStatus('idle');
  };

  const getLatestSelectedAccount = async () => {
    const refreshedChallengeSummary = await refetchChallengeSummary();
    const latestChallenges = (refreshedChallengeSummary.data?.items ?? []).map(toAccountType);

    return latestChallenges.find((challenge) => challenge.id === selectedAccount);
  };

  const handleProceedToPayment = async () => {
    if (!selectedAccountData) {
      return;
    }

    if (!hasRequiredProfileName(me)) {
      setApiErrorMessage(text.profileNameRequired);
      return;
    }

    try {
      setIsValidatingChallenge(true);
      const latestSelectedAccount = await getLatestSelectedAccount();

      if (!latestSelectedAccount?.challengeId) {
        setApiErrorMessage(text.challengeUnavailable);
        return;
      }

      // 상품 수정은 신규 구매분부터 적용되므로, 보고 있던 가격과 달라졌으면 다시 확인하게 한다.
      if (
        latestSelectedAccount.challengeId !== selectedAccountData.challengeId ||
        latestSelectedAccount.price !== selectedAccountData.price
      ) {
        setApiErrorMessage(text.challengeChanged);
        return;
      }
    } catch {
      setApiErrorMessage(text.refreshFailed);
      return;
    } finally {
      setIsValidatingChallenge(false);
    }

    if (!PAYMENT_ENABLED) {
      setShowPaymentComingSoon(true);
      return;
    }

    // [본 결제 모달 로직 - 테스트 종료 후 사용]
    setShowPaymentModal(true);
    return;

    // [테스트용 임시 로직 시작]
    // 실제 결제 모달/completePayment 흐름 대신 바로 챌린지 등록 API 호출
    // try {
    //   setIsCompletingPayment(true);

    //   await api.post('/v1/test/challenges/join-with-mapped-mts', {
    //     challenge_id: selectedAccountData.challengeId,
    //   });

    //   setShowPaymentSuccessToast(true);
    //   window.scrollTo({ top: 0, behavior: 'smooth' });
    // } catch {
    //   setApiErrorMessage('Unable to complete payment. Please try again.');
    // } finally {
    //   setIsCompletingPayment(false);
    // }
    // [테스트용 임시 로직 끝]
  };

  const handleCompletePayment = async () => {
    if (!selectedAccountData?.challengeId) {
      return;
    }

    if (totalAsset < totalAmount) {
      setShowPaymentModal(false);
      setShowInsufficientFundsToast(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      setIsCompletingPayment(true);

      const order = await completePayment({
        challenge_id: selectedAccountData.challengeId,
        quantity,
        ...(COUPON_ENABLED && couponPreview?.coupon_code
          ? { coupon_code: couponPreview.coupon_code }
          : {}),
      });
      await Promise.allSettled([refetchMyAsset(), refetchChallengeSummary()]);

      setShowPaymentSuccessToast(true);
      setShowPaymentModal(false);
      resetDiscount();
      pollStartedAt.current = Date.now();
      setPurchaseResult(order);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setApiErrorMessage(getPaymentErrorMessage(error, text.completePaymentError));
      await Promise.allSettled([refetchChallengeSummary(), refetchMyAsset()]);
    } finally {
      setIsCompletingPayment(false);
    }
  };

  const handleCancelPayment = () => {
    setShowPaymentModal(false);
    resetDiscount();
  };

  const handleGoToMyAsset = () => {
    setShowInsufficientFundsToast(false);
    navigate('/my-page/my-asset');
  };

  return (
    <>
      <BannerPopup exposureLocation="AFTER_LOGIN" />
      <Toast
        type="error"
        title={text.requestFailed}
        message={apiErrorMessage}
        isVisible={Boolean(apiErrorMessage)}
        onClose={() => setApiErrorMessage('')}
        duration={3000}
        position="top"
      />

      <Toast
        type="info"
        title={text.paymentComingSoonTitle}
        message={text.paymentComingSoonMsg}
        isVisible={showPaymentComingSoon}
        onClose={() => setShowPaymentComingSoon(false)}
        duration={3000}
        position="top"
      />

      <SuccessNotification
        isVisible={showPaymentSuccessToast}
        title={text.paymentSuccessful}
        message={text.paymentSuccessMsg}
      />

      <AnimatePresence>
        {showInsufficientFundsToast && (
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-red-500/50 bg-[#0f0f17] shadow-2xl shadow-red-950/40"
          >
            <div className="border-b border-red-500/30 bg-red-950/40 p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-red-500/40 bg-red-500/15">
                  <AlertCircle size={22} className="text-red-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{text.insufficientFunds}</h3>
                  <p className="mt-1 text-sm text-gray-400">{text.unableToComplete}</p>
                </div>
              </div>
            </div>

            <div className="space-y-5 p-6">
              <p className="text-sm leading-6 text-gray-300">{text.insufficientFundsMsg}</p>

              <div className="rounded-lg border border-red-500/30 bg-red-950/30 p-4">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-gray-400">{text.requiredAmount}</span>
                    <span className="font-bold text-white">{formatUsdt(totalAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-gray-400">{text.currentBalance}</span>
                    <span className="font-bold text-red-300">{formatUsdt(totalAsset)}</span>
                  </div>
                  <div className="h-px bg-red-500/30" />
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-semibold text-white">{text.amountNeeded}</span>
                    <span className="font-bold text-red-400">{formatUsdt(amountNeeded)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 border-t border-red-500/20 p-5">
              <button
                onClick={() => setShowInsufficientFundsToast(false)}
                className="flex-1 rounded-lg bg-[#1a1a24] py-3 font-semibold text-gray-300 transition-colors hover:bg-[#242436] hover:text-white"
              >
                {text.cancel}
              </button>
              <button
                onClick={handleGoToMyAsset}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0052FF] py-3 font-bold text-white transition-colors hover:bg-[#0066FF]"
              >
                <Wallet size={18} />
                {text.goToMyAsset}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCompletingPayment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="flex flex-col items-center gap-4 rounded-xl border border-[#2a2a3a] bg-[#0f0f17] px-8 py-7 shadow-2xl shadow-black/50">
              <Loader2 size={40} className="animate-spin text-[#00FF94]" />
              <div className="text-center">
                <p className="font-semibold text-white">{text.processing}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Purchase Result: 결제 뒤 MT4 계좌 발급 진행 상황 */}
      <AnimatePresence>
        {purchaseResult && (
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-[#00FF94]/40 bg-[#0f0f17] shadow-2xl shadow-black/50"
          >
            <div className="border-b border-[#00FF94]/20 bg-[#00FF94]/5 p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-[#00FF94]/40 bg-[#00FF94]/10">
                  <CheckCircle size={22} className="text-[#00FF94]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xl font-bold text-white">{text.purchaseResultTitle}</h3>
                  <p className="mt-1 truncate text-sm text-gray-400">
                    {text.orderNumber} {purchaseResult.order_id}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-6">
              <p className="text-sm leading-6 text-gray-300">
                {purchaseResult.status === 'PENDING'
                  ? text.purchaseResultMsg
                  : text.credentialsByEmail}
              </p>

              <div className="rounded-lg border border-[#2a2a3a] bg-[#16161f] p-4">
                <div className="mb-3 flex items-center justify-between gap-4 text-sm">
                  <span className="font-semibold text-white">{purchaseResult.product_name}</span>
                  <span className="text-gray-400">x {purchaseResult.quantity}</span>
                </div>
                <ul className="space-y-2 text-sm">
                  {purchaseResult.accounts.map((account, index) => (
                    <li
                      key={account.account_id}
                      className="flex items-center justify-between gap-4"
                    >
                      <span className="text-gray-400">
                        MT4 #{index + 1}
                        {account.mt4_login ? (
                          <span className="ml-2 font-mono text-white">{account.mt4_login}</span>
                        ) : null}
                      </span>
                      {account.provision_status === 'DONE' ? (
                        <span className="flex items-center gap-1 font-medium text-[#00FF94]">
                          <Check size={14} />
                          {text.accountIssued}
                        </span>
                      ) : account.provision_status === 'FAILED' ? (
                        <span className="flex items-center gap-1 font-medium text-red-400">
                          <X size={14} />
                          {text.accountIssueFailed}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-gray-400">
                          <Loader2 size={14} className="animate-spin" />
                          {text.accountIssuing}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {purchaseResult.refunded_quantity > 0 && (
                <p className="rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-xs leading-5 text-red-300">
                  {text.accountIssueRefunded
                    .replace('{n}', String(purchaseResult.refunded_quantity))
                    .replace('{amount}', formatPrice(purchaseResult.refunded_amount))}
                </p>
              )}
            </div>

            <div className="flex gap-3 border-t border-[#1a1a24] p-5">
              <button
                onClick={() => setPurchaseResult(null)}
                className="flex-1 rounded-lg bg-[#1a1a24] py-3 font-semibold text-gray-300 transition-colors hover:bg-[#242436] hover:text-white"
              >
                {text.close}
              </button>
              <button
                onClick={() => {
                  setPurchaseResult(null);
                  navigate('/my-page/my-account');
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0052FF] py-3 font-bold text-white transition-colors hover:bg-[#0066FF]"
              >
                {text.goToMyAccount}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#1a1a24] bg-[#0f0f17] shadow-2xl shadow-black/50">
                <div className="sticky top-0 z-10 flex items-center justify-between bg-gradient-to-r from-[#0052FF] to-[#00FF94] px-8 py-6">
                  <div>
                    <h2 className="mb-1 text-2xl font-bold text-white">
                      {text.completePaymentTitle}
                    </h2>
                    <p className="text-sm text-white/80">{text.completePaymentSub}</p>
                  </div>
                  <button
                    onClick={handleCancelPayment}
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white transition-all hover:bg-white/20"
                    aria-label={text.close}
                  >
                    <X size={20} className="transition-transform duration-300 hover:rotate-90" />
                  </button>
                </div>

                <div className="space-y-6 p-8">
                  <div className="rounded-xl border border-[#0052FF]/20 bg-gradient-to-br from-[#0052FF]/10 to-[#0052FF]/5 p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="mb-1 flex items-center gap-2 text-sm text-gray-400">
                          <Wallet size={16} />
                          {text.availableTotalAsset}
                        </p>
                        <p className="text-3xl font-bold text-white">
                          ${totalAsset.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDT
                        </p>
                      </div>
                      <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-[#0052FF]/20">
                        <Wallet size={32} className="text-[#0052FF]" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-3 block text-sm text-gray-400">
                      {text.challengeDetails}
                    </label>
                    <div className="rounded-xl border border-[#2a2a3a] bg-[#16161f] p-6">
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <span className="font-medium text-white">
                          {selectedAccountData
                            ? getAccountDisplayName(selectedAccountData)
                            : text.selected}{' '}
                          {text.account}
                        </span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-lg font-semibold text-white">
                            $
                            {selectedAccountFee.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                          <span className="text-sm font-normal text-white/50">USDT</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">{text.quantity}</span>
                        <span className="font-medium text-white">x {quantity}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#2a2a3a] bg-[#1a1a24] p-6">
                    <h3 className="mb-4 flex items-center gap-2 font-semibold text-white">
                      <CheckCircle size={18} className="text-[#00FF94]" />
                      {text.paymentSummary}
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">{text.challengeFee}</span>
                        <div className="flex items-baseline gap-1">
                          {discountAmount > 0 && (
                            <span className="text-xs text-gray-500 line-through">
                              $
                              {baseAmount.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                          )}
                          <span className="font-medium text-white">
                            ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-xs font-normal text-white/50">USDT</span>
                        </div>
                      </div>
                      {COUPON_ENABLED && (
                      <div className="space-y-2">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                          <Tag size={12} />
                          {text.discountCode}
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={discountCode}
                            onChange={(event) => {
                              setDiscountCode(event.target.value);
                              if (discountStatus !== 'idle') setDiscountStatus('idle');
                              if (couponPreview) setCouponPreview(null);
                              if (discountMessage) setDiscountMessage('');
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                void handleVerifyCode();
                              }
                            }}
                            placeholder={text.discountCodePlaceholder}
                            disabled={discountStatus === 'loading'}
                            className="min-w-0 flex-1 rounded-lg border border-[#2a2a3a] bg-[#16161f] px-3 py-2 text-sm text-white transition-colors placeholder-gray-600 focus:border-[#0052FF] focus:outline-none disabled:opacity-50"
                          />
                          <button
                            type="button"
                            onClick={() => void handleVerifyCode()}
                            disabled={!discountCode.trim() || discountStatus === 'loading'}
                            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#0052FF] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0052FF]/90 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {discountStatus === 'loading' ? (
                              <>
                                <Loader2 size={14} className="animate-spin" />
                                {text.verifyingCode}
                              </>
                            ) : (
                              text.verifyCode
                            )}
                          </button>
                        </div>
                        {discountStatus === 'success' && (
                          <motion.p
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-1.5 text-xs font-medium text-[#00FF94]"
                          >
                            <Check size={12} />
                            {discountMessage ||
                              text.discountApplied.replace(
                                '{rate}',
                                String((couponPreview?.discount_rate ?? 0) * 100),
                              )}
                          </motion.p>
                        )}
                        {discountStatus === 'error' && (
                          <motion.p
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-1.5 text-xs text-red-400"
                          >
                            <X size={12} />
                            {discountMessage || text.discountInvalid}
                          </motion.p>
                        )}
                      </div>
                      )}
                      {discountAmount > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-400">{text.discountAmount}</span>
                          <span className="font-medium text-[#00FF94]">
                            -{formatUsdt(discountAmount)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">{text.processingFee}</span>
                        <span className="font-medium text-[#00FF94]">{text.free}</span>
                      </div>
                      <div className="h-px bg-[#2a2a3a]" />
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-semibold text-white">{text.remainingBalance}</span>
                        <div className="flex items-baseline gap-1.5">
                          <span
                            className={`text-lg font-bold ${
                              remainingBalance >= 0 ? 'text-[#00FF94]' : 'text-red-400'
                            }`}
                          >
                            $
                            {remainingBalance.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                          <span className="text-sm font-normal text-white/50">USDT</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#0052FF]/20 bg-[#0052FF]/5 p-4">
                    <div className="flex gap-3">
                      <AlertCircle size={20} className="mt-0.5 flex-shrink-0 text-[#0052FF]" />
                      <div>
                        <p className="text-white text-sm font-medium mb-1">
                          {text.paymentInfoTitle}
                        </p>
                        <ul className="text-gray-400 text-xs space-y-1">
                          {text.paymentInfoItems.map((item) => (
                            <li key={item}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="sticky bottom-0 flex gap-4 border-t border-[#1a1a24] bg-[#0f0f17] px-8 py-6">
                  <button
                    onClick={handleCancelPayment}
                    className="flex-1 rounded-xl border-2 border-[#2a2a3a] bg-transparent py-4 font-semibold text-gray-400 transition-all hover:border-gray-600 hover:bg-[#1a1a24] hover:text-white"
                  >
                    {text.cancel}
                  </button>
                  <button
                    onClick={handleCompletePayment}
                    disabled={
                      isCompletingPayment || discountStatus === 'loading' || !selectedAccountData
                    }
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00FF94] to-[#00DD7F] py-4 font-bold text-[#0a0a12] transition-all hover:shadow-lg hover:shadow-[#00FF94]/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none"
                  >
                    {isCompletingPayment ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <CheckCircle size={20} />
                    )}
                    {isCompletingPayment ? text.processing : text.completePaymentBtn}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="p-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12">
            <h2 className="mb-6 text-2xl font-bold text-white">
              {text.chooseChallengeAccountType}
            </h2>
            {isChallengeSummaryLoading ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="animate-pulse rounded-2xl border border-[#2a2a3a] bg-[#0f0f17] p-6"
                  >
                    <div className="mb-4 h-7 w-36 rounded bg-[#1a1a24]" />
                    <div className="mb-6 h-10 w-24 rounded bg-[#1a1a24]" />
                    <div className="space-y-3">
                      <div className="h-4 rounded bg-[#1a1a24]" />
                      <div className="h-4 rounded bg-[#1a1a24]" />
                      <div className="h-4 rounded bg-[#1a1a24]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : sortedChallenges.length === 0 ? (
              <div className="rounded-2xl border border-[#2a2a3a] bg-[#0f0f17] p-6">
                <p className="font-semibold text-white">{text.noActiveChallenges}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                {sortedChallenges.map((account, index) => {
                  const isSelected = selectedAccount === account.id;
                  const funded = account.funded;
                  return (
                    <motion.div
                      key={account.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: account.isAvailable ? 1 : 0.55, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => account.isAvailable && setSelectedAccount(account.id)}
                      aria-disabled={!account.isAvailable}
                      className={`relative rounded-2xl border-2 bg-[#0f0f17] p-5 transition-all ${
                        account.isAvailable
                          ? 'cursor-pointer hover:scale-105'
                          : 'cursor-not-allowed'
                      } ${
                        isSelected
                          ? 'border-[#0052FF] shadow-lg shadow-[#0052FF]/20'
                          : account.isAvailable
                            ? 'border-[#2a2a3a] hover:border-[#0052FF]/50'
                            : 'border-[#2a2a3a]'
                      }`}
                    >
                      {account.isMostPopular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <div className="whitespace-nowrap rounded-full bg-gradient-to-r from-[#0052FF] to-[#00FF94] px-4 py-1 text-xs font-bold text-white">
                            {text.mostPopular}
                          </div>
                        </div>
                      )}

                      {/* Compact header: product name, then capital and one-time fee side by side */}
                      <div className="mb-4 border-b border-[#2a2a3a] pb-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="truncate text-xs uppercase tracking-wider text-gray-500">
                            {getCardTitle(account)}
                          </span>
                          {isSelected && (
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0052FF]">
                              <Check size={12} className="text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex items-end justify-between gap-2">
                          <div>
                            <div className="text-2xl font-bold leading-tight text-[#00FF94]">
                              {formatCapital(account.capital)}
                            </div>
                            <div className="mt-0.5 text-xs text-gray-400">{text.fundingCapital}</div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-baseline justify-end gap-1.5">
                              {account.originalPrice != null && (
                                <span className="text-base font-semibold text-gray-400 line-through">
                                  ${formatPrice(account.originalPrice)}
                                </span>
                              )}
                              <span className="text-2xl font-bold leading-tight text-white">
                                ${formatPrice(account.price)}
                              </span>
                            </div>
                            <div className="mt-0.5 text-xs text-gray-400">{text.oneTimeFee}</div>
                          </div>
                        </div>
                        {!account.isAvailable && (
                          <div className="mt-3 rounded-lg bg-[#1a1a24] px-3 py-1.5 text-center text-xs text-gray-400">
                            {text.noOpenRound}
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div>
                          <h3 className="mb-3 text-sm font-bold text-white">
                            {text.challengeStage}
                          </h3>
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-gray-400">
                                <InfoTooltip content={tooltips.profitTarget} />
                                {text.profitTarget}
                              </span>
                              <span className="text-right text-sm font-bold text-white">
                                {formatLimit(account.rules?.profit_target_amt)}
                              </span>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                              <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-gray-400">
                                <InfoTooltip content={maxDrawdownTooltip(account.rules)} />
                                {maxDrawdownLabel(account.rules)}
                              </span>
                              <span className="text-right text-sm font-bold text-white">
                                {account.rules ? formatMoney(account.rules.max_drawdown_amt) : '-'}
                              </span>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                              <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-gray-400">
                                <InfoTooltip content={tooltips.dailyLossLimit} />
                                {text.dailyLossLimit}
                              </span>
                              <span className="text-right text-sm font-bold text-white">
                                {formatLimit(account.rules?.daily_loss_limit_amt)}
                              </span>
                            </div>
                            {/* 레버리지는 디자인에 없어 숨김
                            <div className="flex items-start justify-between gap-3">
                              <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-gray-400">
                                <InfoTooltip content={tooltips.leverage} />
                                {text.leverage}
                              </span>
                              <span className="text-right text-sm font-bold text-white">
                                {formatLeverage(account.leverage)}
                              </span>
                            </div>
                            */}
                            <div className="flex items-start justify-between gap-3">
                              <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-gray-400">
                                <InfoTooltip content={tooltips.maxContracts} />
                                {text.maxContracts}
                              </span>
                              <span className="text-right text-sm font-bold text-white">
                                {formatContracts(account.rules)}
                              </span>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                              <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-gray-400">
                                <InfoTooltip content={tooltips.consistency} />
                                {text.consistency}
                              </span>
                              <span className="text-right text-sm font-bold text-white">
                                {formatPct(account.rules?.consistency_pct)}
                              </span>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                              <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-gray-400">
                                <InfoTooltip content={tooltips.tradingPeriod} />
                                {text.tradingPeriod}
                              </span>
                              <span className="text-right text-sm font-bold text-white">
                                {formatDays(account.durationDays)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 펀디드 단계: 연결된 펀디드 상품(없으면 자본금이 같은 펀디드 상품)이 있을 때만 */}
                        {funded && (
                          <div>
                            <h3 className="mb-3 text-sm font-bold text-white">
                              {text.fundedStage}
                            </h3>
                            <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-gray-400">
                                <InfoTooltip content={tooltips.profitTarget} />
                                {text.profitTarget}
                              </span>
                              <span className="text-right text-sm font-bold text-white">
                                {formatLimit(funded.rules?.profit_target_amt)}
                              </span>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                              <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-gray-400">
                                <InfoTooltip content={maxDrawdownTooltip(funded.rules)} />
                                {maxDrawdownLabel(funded.rules)}
                              </span>
                              <span className="text-right text-sm font-bold text-white">
                                {funded.rules ? formatMoney(funded.rules.max_drawdown_amt) : '-'}
                              </span>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                              <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-gray-400">
                                <InfoTooltip content={tooltips.dailyLossLimit} />
                                {text.dailyLossLimit}
                              </span>
                              <span className="text-right text-sm font-bold text-white">
                                {formatLimit(funded.rules?.daily_loss_limit_amt)}
                              </span>
                            </div>
                            {/* 레버리지는 디자인에 없어 숨김
                            <div className="flex items-start justify-between gap-3">
                              <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-gray-400">
                                <InfoTooltip content={tooltips.leverage} />
                                {text.leverage}
                              </span>
                              <span className="text-right text-sm font-bold text-white">
                                {formatLeverage(funded.leverage)}
                              </span>
                            </div>
                            */}
                            <div className="flex items-start justify-between gap-3">
                              <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-gray-400">
                                <InfoTooltip content={tooltips.maxContracts} />
                                {text.maxContracts}
                              </span>
                              <span className="text-right text-sm font-bold text-white">
                                {formatContracts(funded.rules)}
                              </span>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                              <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-gray-400">
                                <InfoTooltip content={tooltips.consistency} />
                                {text.consistency}
                              </span>
                              <span className="text-right text-sm font-bold text-white">
                                {formatPct(funded.rules?.consistency_pct)}
                              </span>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                              <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-gray-400">
                                <InfoTooltip content={profitSplitTooltip(funded.payout_ratio)} />
                                {text.profitSplit}
                              </span>
                              <span className="text-right text-sm font-bold text-white">
                                {formatProfitSplit(funded.payout_ratio)}
                              </span>
                            </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-6 rounded-2xl border border-[#2a2a3a] bg-[#0f0f17] p-6"
          >
            <h3 className="mb-4 text-xl font-bold text-white">{text.quantityLabel}</h3>
            <div className="flex items-center gap-4">
              <button
                onClick={() => handleQuantityChange(-1)}
                disabled={quantity <= 1}
                className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#2a2a3a] bg-[#16161f] text-white transition-colors hover:bg-[#1a1a24] disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Minus size={20} />
              </button>
              <div className="flex-1 text-center">
                <div className="text-4xl font-bold text-white">{quantity}</div>
                <div className="mt-1 text-sm text-gray-400">
                  {quantity > 1 ? text.accounts : text.account}
                </div>
              </div>
              <button
                onClick={() => handleQuantityChange(1)}
                disabled={quantity >= 10}
                className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#2a2a3a] bg-[#16161f] text-white transition-colors hover:bg-[#1a1a24] disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Plus size={20} />
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-2xl border border-[#0052FF]/30 bg-gradient-to-br from-[#0052FF]/10 to-[#00FF94]/10 p-8"
          >
            <h3 className="mb-6 text-2xl font-bold text-white">{text.orderSummary}</h3>
            <div className="mb-6 space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-[#2a2a3a]">
                <span className="text-gray-400">{text.challengeAccountType}</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-white font-semibold">
                    {selectedAccountData ? getAccountDisplayName(selectedAccountData) : '-'}{' '}
                  </span>
                  {selectedAccountData && (
                    <div className="flex items-baseline gap-1">
                      {selectedAccountData.originalPrice != null && (
                        <span className="text-xs text-gray-500 line-through">
                          ${formatPrice(selectedAccountData.originalPrice)}
                        </span>
                      )}
                      <span className="text-[#00FF94] font-semibold">
                        ${formatPrice(selectedAccountFee)}
                      </span>
                      <span className="text-white/50 text-xs font-normal">USDT</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between border-b border-[#2a2a3a] pb-4">
                <span className="text-gray-400">{text.quantity}</span>
                <span className="font-semibold text-white">{quantity}</span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-xl font-bold text-white">{text.totalAmount}</span>
                <div className="text-right">
                  <div className="text-3xl font-bold text-[#00FF94]">
                    ${formatPrice(totalAmount)} USDT
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={handleProceedToPayment}
              disabled={
                !selectedAccountData ||
                isChallengeSummaryLoading ||
                isCompletingPayment ||
                isValidatingChallenge
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0052FF] to-[#00FF94] py-5 text-lg font-bold text-white transition-all hover:shadow-lg hover:shadow-[#0052FF]/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none"
            >
              {(isCompletingPayment || isValidatingChallenge) && (
                <Loader2 size={22} className="animate-spin" />
              )}
              {isCompletingPayment
                ? text.processing
                : isValidatingChallenge
                  ? text.checking
                  : text.proceedToPayment}
            </button>
          </motion.div>
        </div>
      </div>
    </>
  );
}
