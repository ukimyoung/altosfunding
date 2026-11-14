import { useEffect, useState } from 'react';
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
import { completePayment } from '@/api/orders';
import type { Product } from '@/api/products';
import { useListProductsQuery } from '@/app/queries/products';
import { useMyAssetQuery } from '@/app/queries/assets';
import { useMeQuery } from '@/app/queries/profile';
import { hasRequiredProfileName } from '@/app/utils/profile';
import { useLocale } from '@/app/i18n/LocaleContext';
import { BannerPopup } from '@/app/components/shared/BannerPopup';

type AccountType = {
  id: string;
  challengeId?: string;
  name: string;
  price: number;
  originalFee: string;
  capital: number;
  templateId?: 'starter' | 'pro' | 'elite';
  challengeStage: {
    profitTarget: string;
    maxDrawdown: string;
    dailyLossLimit: string | null;
    maxContracts: string;
    consistency: string;
    tradingPeriod: string;
  };
  fundedStage: {
    profitTarget: string | null;
    maxDrawdown: string;
    dailyLossLimit: string;
    maxContracts: string;
    consistency: string | null;
    profitSplit: string;
  };
  isRecommended?: boolean;
};

type AccountTemplate = Omit<
  AccountType,
  'id' | 'challengeId' | 'price' | 'capital' | 'isRecommended'
> & {
  id: 'starter' | 'pro' | 'elite';
};

const accountTemplates: AccountTemplate[] = [
  {
    id: 'starter',
    templateId: 'starter',
    name: 'Starter',
    originalFee: '$150',
    challengeStage: {
      profitTarget: '$1,500',
      maxDrawdown: '$1,500',
      dailyLossLimit: null,
      maxContracts: '2 Mini (20 Micro)',
      consistency: '40%',
      tradingPeriod: '5 Days',
    },
    fundedStage: {
      profitTarget: null,
      maxDrawdown: '$1,500',
      dailyLossLimit: '$500',
      maxContracts: '2 Mini (20 Micro)',
      consistency: null,
      profitSplit: '80/20',
    },
  },
  {
    id: 'pro',
    templateId: 'pro',
    name: 'Professional',
    originalFee: '$200',
    challengeStage: {
      profitTarget: '$3,000',
      maxDrawdown: '$2,000',
      dailyLossLimit: null,
      maxContracts: '4 Mini (40 Micro)',
      consistency: '40%',
      tradingPeriod: '5 Days',
    },
    fundedStage: {
      profitTarget: null,
      maxDrawdown: '$2,000',
      dailyLossLimit: '$1,000',
      maxContracts: '4 Mini (40 Micro)',
      consistency: null,
      profitSplit: '80/20',
    },
  },
  {
    id: 'elite',
    templateId: 'elite',
    name: 'Elite',
    originalFee: '$270',
    challengeStage: {
      profitTarget: '$6,000',
      maxDrawdown: '$3,500',
      dailyLossLimit: null,
      maxContracts: '6 Mini (60 Micro)',
      consistency: '40%',
      tradingPeriod: '5 Days',
    },
    fundedStage: {
      profitTarget: null,
      maxDrawdown: '$3,500',
      dailyLossLimit: '$2,000',
      maxContracts: '6 Mini (60 Micro)',
      consistency: null,
      profitSplit: '80/20',
    },
  },
];

const formatCapital = (capital: number) => `$${capital.toLocaleString('en-US')}`;

const getAccountTemplateForProduct = (product: Product, index: number) => {
  const productText = `${product.product_id} ${product.challenge_name}`.toLowerCase();
  const matchedTemplate = accountTemplates.find(
    (template) =>
      productText.includes(template.id) || productText.includes(template.name.toLowerCase()),
  );

  return matchedTemplate ?? accountTemplates[index] ?? accountTemplates[0];
};

const mergeAccountTypesWithProducts = (products: Product[]) => {
  return products.map((product, index) => {
    const template = getAccountTemplateForProduct(product, index);

    return {
      ...template,
      id: product.product_id,
      challengeId: product.challenge_id,
      name: template.name,
      price: product.price_usdt,
      capital: product.capital,
      isRecommended: product.is_recommended,
    };
  });
};

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
  const tierNames: Record<string, string> = text.tierNames;
  const getAccountDisplayName = (account: AccountType) =>
    account.templateId ? tierNames[account.templateId] : account.name;
  const formatAccountTextValue = (value: string) => {
    if (value === 'None' || value === 'Non') return text.none;
    if (value === '5 Days') return text.fiveDays;
    return value;
  };
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [showPaymentSuccessToast, setShowPaymentSuccessToast] = useState<boolean>(false);
  const [showInsufficientFundsToast, setShowInsufficientFundsToast] = useState<boolean>(false);
  const [isCompletingPayment, setIsCompletingPayment] = useState<boolean>(false);
  const [isValidatingChallenge, setIsValidatingChallenge] = useState<boolean>(false);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [apiErrorMessage, setApiErrorMessage] = useState<string>('');
  const [discountCode, setDiscountCode] = useState('');
  const [couponPreview, setCouponPreview] = useState<ValidateCouponResponse | null>(null);
  const [discountMessage, setDiscountMessage] = useState('');
  const [discountStatus, setDiscountStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    'idle',
  );
  const {
    data: challengeSummary,
    isLoading: isChallengeSummaryLoading,
    refetch: refetchChallengeSummary,
  } = useListProductsQuery();
  const { data: myAssetSummary, refetch: refetchMyAsset } = useMyAssetQuery();
  const { data: me } = useMeQuery();
  const sortedChallenges = mergeAccountTypesWithProducts(challengeSummary?.challenges ?? []);

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
    if (!sortedChallenges.length) {
      return;
    }

    const hasSelectedChallenge = sortedChallenges.some(
      (challenge) => challenge.id === selectedAccount,
    );

    if (!hasSelectedChallenge) {
      setSelectedAccount(
        sortedChallenges.find((challenge) => challenge.isRecommended)?.id ?? sortedChallenges[0].id,
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
    const latestChallenges = mergeAccountTypesWithProducts(
      refreshedChallengeSummary.data?.challenges ?? [],
    );

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

      if (latestSelectedAccount.challengeId !== selectedAccountData.challengeId) {
        setApiErrorMessage(text.challengeChanged);
        return;
      }
    } catch {
      setApiErrorMessage(text.refreshFailed);
      return;
    } finally {
      setIsValidatingChallenge(false);
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
    if (!selectedAccountData) {
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

      await completePayment({
        challenge_id: selectedAccountData.challengeId,
        mt4_login: 0,
        quantity,
        ...(couponPreview?.coupon_code ? { coupon_code: couponPreview.coupon_code } : {}),
      });
      await refetchMyAsset();

      setShowPaymentSuccessToast(true);
      setShowPaymentModal(false);
      resetDiscount();
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
              <div className="grid gap-6 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
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
              <div className="grid gap-6 md:grid-cols-3">
                {sortedChallenges.map((account, index) => {
                  return (
                    <motion.div
                      key={account.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => setSelectedAccount(account.id)}
                      className={`relative cursor-pointer rounded-2xl border-2 bg-[#0f0f17] p-6 transition-all hover:scale-105 ${
                        selectedAccount === account.id
                          ? 'border-[#0052FF] shadow-lg shadow-[#0052FF]/20'
                          : 'border-[#2a2a3a] hover:border-[#0052FF]/50'
                      }`}
                    >
                      {account.isRecommended && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <div className="whitespace-nowrap rounded-full bg-gradient-to-r from-[#0052FF] to-[#00FF94] px-4 py-1 text-xs font-bold text-white">
                            {text.mostPopular}
                          </div>
                        </div>
                      )}
                      {selectedAccount === account.id && (
                        <div className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-[#0052FF]">
                          <Check size={18} className="text-white" />
                        </div>
                      )}
                      <div className="relative mb-4 flex flex-col items-center text-center">
                        <h3 className="mb-2 text-2xl font-bold text-white">
                          {getAccountDisplayName(account)}
                        </h3>
                        <p className="mb-1 text-xs text-gray-500">{text.fundingCapital}</p>
                        <span className="text-3xl font-bold text-[#00FF94]">
                          {formatCapital(account.capital)}
                        </span>
                      </div>

                      <div className="space-y-6">
                        <div>
                          <h3 className="mb-4 text-base font-bold text-white">
                            {text.challengeStage}
                          </h3>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <span className="shrink-0 text-sm text-gray-400">{text.profitTarget}</span>
                              <span className="text-sm font-bold text-white">{account.challengeStage.profitTarget}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="shrink-0 text-sm text-gray-400">{text.maxDrawdownEod}</span>
                              <span className="text-sm font-bold text-white">{account.challengeStage.maxDrawdown}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="shrink-0 text-sm text-gray-400">{text.dailyLossLimit}</span>
                              <span className="text-sm font-bold text-white">
                                {account.challengeStage.dailyLossLimit ?? text.none}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="shrink-0 text-sm text-gray-400">{text.maxContracts}</span>
                              <span className="text-sm font-bold text-white">{account.challengeStage.maxContracts}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="shrink-0 text-sm text-gray-400">{text.consistency}</span>
                              <span className="text-sm font-bold text-white">{account.challengeStage.consistency}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="shrink-0 text-sm text-gray-400">{text.tradingPeriod}</span>
                              <span className="text-sm font-bold text-white">
                                {formatAccountTextValue(account.challengeStage.tradingPeriod)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="mb-4 text-base font-bold text-white">
                            {text.fundedStage}
                          </h3>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <span className="shrink-0 text-sm text-gray-400">{text.profitTarget}</span>
                              <span className="text-sm font-bold text-white">
                                {account.fundedStage.profitTarget ?? text.none}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="shrink-0 text-sm text-gray-400">{text.maxDrawdownEod}</span>
                              <span className="text-sm font-bold text-white">{account.fundedStage.maxDrawdown}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="shrink-0 text-sm text-gray-400">{text.dailyLossLimit}</span>
                              <span className="text-sm font-bold text-white">{account.fundedStage.dailyLossLimit}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="shrink-0 text-sm text-gray-400">{text.maxContracts}</span>
                              <span className="text-sm font-bold text-white">{account.fundedStage.maxContracts}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="shrink-0 text-sm text-gray-400">{text.consistency}</span>
                              <span className="text-sm font-bold text-white">
                                {account.fundedStage.consistency ?? text.none}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="shrink-0 text-sm text-gray-400">{text.profitSplit}</span>
                              <span className="text-sm font-bold text-white">{account.fundedStage.profitSplit}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 border-t border-[#2a2a3a] pt-5">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm text-gray-400">{text.oneTimeFee}</span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm text-gray-500 line-through">
                              {account.originalFee}
                            </span>
                            <span className="text-2xl font-bold text-white">${account.price}</span>
                            <span className="text-sm text-gray-400">USDT</span>
                          </div>
                        </div>
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
                      <span className="text-[#00FF94] font-semibold">${selectedAccountFee}</span>
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
                  <div className="text-3xl font-bold text-[#00FF94]">{totalAmount} USDT</div>
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
