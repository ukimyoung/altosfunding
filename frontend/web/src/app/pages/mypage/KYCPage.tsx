import { useCallback, useEffect, useState } from 'react';
import SumsubWebSdk from '@sumsub/websdk-react';
import { AlertCircle, Loader2, RefreshCw, Shield } from 'lucide-react';
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

const getKycStatusClassName = (status: KycStatus | null) => {
  switch (status) {
    case 'APPROVED':
      return 'border-[#00FF94]/30 bg-[#00FF94]/10 text-[#00FF94]';
    case 'PENDING':
      return 'border-[#FFB800]/30 bg-[#FFB800]/10 text-[#FFB800]';
    case 'REJECTED':
      return 'border-red-500/30 bg-red-500/10 text-red-300';
    default:
      return 'border-[#2a2a3a] bg-[#1a1a24] text-gray-300';
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

export function KYCPage() {
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

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg bg-[#0052FF]/10 flex items-center justify-center">
            <Shield size={24} className="text-[#0052FF]" />
          </div>
          <div>
            <h1 className="text-2xl text-white font-medium">{text.sectionTitle}</h1>
            <p className="text-gray-400 text-sm mt-1">{text.sectionSubtitle}</p>
          </div>
        </div>
      </div>

      {/*
        Previous manual document upload flow is intentionally disabled.
        Sumsub WebSDK now owns the document capture and verification UI.
      */}

      <div className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex min-h-[420px] items-center justify-center p-8 text-gray-300">
            <div className="flex items-center gap-3">
              <Loader2 size={22} className="animate-spin text-[#00FF94]" />
              <span className="text-sm font-medium">{text.loadingStatus}</span>
            </div>
          </div>
        ) : statusErrorMessage ? (
          <div className="p-6">
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
              {statusErrorMessage}
            </div>
          </div>
        ) : accessToken ? (
          <div>
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
        ) : (
          <div className="p-6">
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-400">{text.verificationStatus}</p>

                {!hasSubmittedInSession && (
                  <div
                    className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${getKycStatusClassName(kycStatus)}`}
                  >
                    <AlertCircle size={14} />
                    {getKycStatusLabel(kycStatus, text)}
                  </div>
                )}
              </div>

              {kycStatus === 'REJECTED' && rejectReason && !hasSubmittedInSession && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={18} className="mt-0.5 flex-shrink-0 text-red-400" />
                    <div>
                      <p className="mb-1 text-sm font-semibold text-red-200">
                        {text.rejectionReason}
                      </p>
                      <p className="text-sm leading-6 text-gray-300">{rejectReason}</p>
                    </div>
                  </div>
                </div>
              )}

              {canStartVerification(kycStatus) && !hasSubmittedInSession && (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={handleStartVerification}
                    disabled={isStartingVerification}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#0052FF] to-[#0066FF] px-6 py-3 font-semibold text-white transition-all hover:shadow-lg hover:shadow-[#0052FF]/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isStartingVerification && <Loader2 size={18} className="animate-spin" />}
                    {kycStatus === 'REJECTED' ? text.retryVerification : text.startVerification}
                  </button>
                </div>
              )}

              {verificationErrorMessage && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                  {verificationErrorMessage}
                </div>
              )}

              {kycStatus === 'PENDING' && !submissionMessage && (
                <button
                  type="button"
                  onClick={handleRefreshStatus}
                  disabled={isRefreshingStatus}
                  className="inline-flex w-fit items-center gap-2 rounded-lg border border-[#FFB800]/30 px-4 py-2 text-sm font-medium text-[#FFB800] transition-colors hover:bg-[#FFB800]/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw size={15} className={isRefreshingStatus ? 'animate-spin' : undefined} />
                  {isRefreshingStatus ? text.refreshing : text.refreshStatus}
                </button>
              )}

              {submissionMessage && (
                <div className="space-y-4 rounded-lg border border-[#00FF94]/20 bg-[#00FF94]/10 p-4 text-sm text-[#00FF94]">
                  <p>{submissionMessage}</p>
                  <button
                    type="button"
                    onClick={handleRefreshStatus}
                    disabled={isRefreshingStatus}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#00FF94]/30 px-4 py-2 font-medium text-[#00FF94] transition-colors hover:bg-[#00FF94]/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw
                      size={15}
                      className={isRefreshingStatus ? 'animate-spin' : undefined}
                    />
                    {isRefreshingStatus ? text.refreshing : text.refreshStatus}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

