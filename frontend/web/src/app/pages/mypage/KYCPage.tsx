import { useCallback, useEffect, useState } from 'react';
import SumsubWebSdk from '@sumsub/websdk-react';
import { motion } from 'motion/react';
import { AlertCircle, Check, Clock, Loader2, RefreshCw, Shield, UserCheck, X } from 'lucide-react';
import {
  getKycStatus,
  getSumsubAccessToken,
  type KycStatus,
  type SumsubAccessTokenResponse,
} from '@/api/kyc';
import { useLocale } from '@/app/i18n/LocaleContext';
import type { KycTranslations } from '@/app/i18n/translations';

const getKycStatusLabel = (status: KycStatus | null, translations: KycTranslations) => {
  switch (status) {
    case 'APPROVED':
      return translations.statusApproved;
    case 'PENDING':
      return translations.statusPending;
    case 'REJECTED':
      return translations.statusRejected;
    case 'NONE':
      return translations.statusNotSubmitted;
    case null:
      return translations.statusChecking;
    default:
      return status
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
  }
};

// Same pill style as the Security page's Email Verification status badge.
const getKycStatusClassName = (status: KycStatus | null) => {
  switch (status) {
    case 'APPROVED':
      return 'bg-[#00FF94]/10 border border-[#00FF94]/20 text-[#00FF94]';
    case 'PENDING':
      return 'bg-[#FFB800]/10 border border-[#FFB800]/20 text-[#FFB800]';
    case 'REJECTED':
      return 'bg-red-500/10 border border-red-500/20 text-red-400';
    default:
      return 'bg-[#2a2a3a] border border-[#2a2a3a] text-gray-400';
  }
};

const KycStatusIcon = ({ status }: { status: KycStatus | null }) => {
  switch (status) {
    case 'APPROVED':
      return <Check size={16} />;
    case 'PENDING':
      return <Clock size={16} />;
    case null:
      return <Loader2 size={16} className="animate-spin" />;
    case 'REJECTED':
      return <X size={16} />;
    default:
      return <AlertCircle size={16} />;
  }
};

const parseAccessToken = (response: SumsubAccessTokenResponse, translations: KycTranslations) => {
  if (!response.ok || !response.token) {
    throw new Error(translations.accessTokenMissing);
  }

  return response.token;
};
const canStartVerification = (status: KycStatus | null) =>
  status === 'NONE' || status === 'REJECTED';

type KycVerificationSectionProps = {
  /** Entrance animation delay, matching the other cards on the Security page. */
  animationDelay?: number;
};

/**
 * Identity Verification (KYC) card shown on My Profile > Security,
 * below Email Verification. Uses the same card layout as Email Verification.
 */
export function KycVerificationSection({ animationDelay = 0 }: KycVerificationSectionProps) {
  const { locale, T } = useLocale();
  const text = T.kyc;
  const [accessToken, setAccessToken] = useState('');
  const [kycStatus, setKycStatus] = useState<KycStatus | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [hasSubmittedInSession, setHasSubmittedInSession] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [isStartingVerification, setIsStartingVerification] = useState(false);
  const [statusErrorMessage, setStatusErrorMessage] = useState('');
  const [verificationErrorMessage, setVerificationErrorMessage] = useState('');
  const [submissionMessage, setSubmissionMessage] = useState('');

  const requestAccessToken = useCallback(async () => {
    const response = await getSumsubAccessToken();
    const nextToken = parseAccessToken(response, text);
    setAccessToken(nextToken);

    return nextToken;
  }, [text]);

  const handleSumsubMessage = useCallback((messageType: string) => {
    if (
      messageType === 'idCheck.onApplicantSubmitted' ||
      messageType === 'idCheck.onApplicantResubmitted' ||
      messageType === 'idCheck.onApplicantVerificationCompleted'
    ) {
      setHasSubmittedInSession(true);
      setAccessToken('');
      setSubmissionMessage(text.submittedMessage);
    }
  }, [text.submittedMessage]);

  const handleStartVerification = async () => {
    try {
      setIsStartingVerification(true);
      setVerificationErrorMessage('');
      setSubmissionMessage('');
      setHasSubmittedInSession(false);
      await requestAccessToken();
    } catch {
      setVerificationErrorMessage(text.startFailed);
    } finally {
      setIsStartingVerification(false);
    }
  };

  const handleRefreshStatus = async () => {
    try {
      setIsRefreshingStatus(true);
      setStatusErrorMessage('');

      const statusResponse = await getKycStatus();
      setKycStatus(statusResponse.status);
      setRejectReason(statusResponse.reject_reason ?? '');

      if (statusResponse.status !== 'NONE') {
        setHasSubmittedInSession(false);
        setSubmissionMessage('');
      }
    } catch {
      setStatusErrorMessage(text.refreshFailed);
    } finally {
      setIsRefreshingStatus(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initializeKyc = async () => {
      try {
        setIsLoading(true);
        setStatusErrorMessage('');

        const statusResponse = await getKycStatus();

        if (!isMounted) {
          return;
        }

        setKycStatus(statusResponse.status);
        setRejectReason(statusResponse.reject_reason ?? '');
      } catch {
        if (isMounted) {
          setStatusErrorMessage(text.loadFailed);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeKyc();

    return () => {
      isMounted = false;
    };
  }, [text.loadFailed]);

  const showStartButton =
    !isLoading && !statusErrorMessage && !accessToken && canStartVerification(kycStatus) && !hasSubmittedInSession;
  const showRefreshButton =
    !isLoading &&
    !statusErrorMessage &&
    !accessToken &&
    (submissionMessage !== '' || (kycStatus === 'PENDING' && !hasSubmittedInSession));

  return (
    <motion.div
      id="kyc"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: animationDelay }}
      className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl p-6 scroll-mt-24"
    >
      {/*
        Previous manual document upload flow is intentionally disabled.
        Sumsub WebSDK now owns the document capture and verification UI.
      */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-[#0052FF]/10 flex items-center justify-center flex-shrink-0">
            <UserCheck size={24} className="text-[#0052FF]" />
          </div>
          <div>
            <h2 className="text-white text-lg font-medium mb-1">{text.sectionTitle}</h2>
            <p className="text-gray-400 text-sm mb-4">{text.sectionSubtitle}</p>

            {statusErrorMessage ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg w-fit mb-4 bg-red-500/10 border border-red-500/20 text-red-400">
                <AlertCircle size={16} />
                <span className="text-sm font-medium">{statusErrorMessage}</span>
              </div>
            ) : !hasSubmittedInSession ? (
              <div
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg w-fit mb-4 ${getKycStatusClassName(
                  isLoading ? null : kycStatus,
                )}`}
              >
                <KycStatusIcon status={isLoading ? null : kycStatus} />
                <span className="text-sm font-medium">
                  {getKycStatusLabel(isLoading ? null : kycStatus, text)}
                </span>
              </div>
            ) : null}

            {kycStatus === 'REJECTED' && rejectReason && !hasSubmittedInSession && (
              <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
                <p className="mb-1 text-sm font-medium text-red-300">{text.rejectionReason}</p>
                <p className="text-sm text-gray-300">{rejectReason}</p>
              </div>
            )}

            {submissionMessage && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg w-fit mb-4 bg-[#00FF94]/10 border border-[#00FF94]/20 text-[#00FF94]">
                <Check size={16} />
                <span className="text-sm font-medium">{submissionMessage}</span>
              </div>
            )}

            {verificationErrorMessage && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg w-fit mb-4 bg-red-500/10 border border-red-500/20 text-red-400">
                <AlertCircle size={16} />
                <span className="text-sm font-medium">{verificationErrorMessage}</span>
              </div>
            )}
          </div>
        </div>

        {(showStartButton || showRefreshButton) && (
          <div className="flex-shrink-0">
            {showStartButton ? (
              <button
                type="button"
                onClick={handleStartVerification}
                disabled={isStartingVerification}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#0052FF] text-white text-sm rounded-lg hover:bg-[#0066FF] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isStartingVerification && <Loader2 size={16} className="animate-spin" />}
                {kycStatus === 'REJECTED' ? text.retryVerification : text.startVerification}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRefreshStatus}
                disabled={isRefreshingStatus}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a1a24] text-white text-sm rounded-lg font-medium hover:bg-[#2a2a3a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <RefreshCw size={14} className={isRefreshingStatus ? 'animate-spin' : undefined} />
                {isRefreshingStatus ? text.refreshing : text.refreshStatus}
              </button>
            )}
          </div>
        )}
      </div>

      {accessToken && (
        <div className="mt-6 overflow-hidden rounded-xl border border-[#1a1a24]">
          <SumsubWebSdk
            accessToken={accessToken}
            expirationHandler={requestAccessToken}
            config={{
              lang: locale,
              theme: 'dark',
            }}
            options={{
              addViewportTag: false,
              adaptIframeHeight: true,
            }}
            onMessage={handleSumsubMessage}
            onError={() => {
              setVerificationErrorMessage(text.sdkLoadFailed);
              setAccessToken('');
            }}
          />
        </div>
      )}
    </motion.div>
  );
}

/**
 * Former standalone My Profile > KYC page.
 * The KYC menu is hidden; KYC now lives on the Security page (KycVerificationSection).
 * Kept for reference only, not routed.
 */
export function KYCPage() {
  const { T } = useLocale();
  const text = T.kyc;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg bg-[#0052FF]/10 flex items-center justify-center">
            <Shield size={24} className="text-[#0052FF]" />
          </div>
          <div>
            <h1 className="text-2xl text-white font-medium">{text.pageTitle}</h1>
            <p className="text-gray-400 text-sm mt-1">{text.pageSubtitle}</p>
          </div>
        </div>
      </div>
      <KycVerificationSection />
    </div>
  );
}
