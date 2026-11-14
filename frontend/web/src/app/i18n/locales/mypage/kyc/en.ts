import type { KycTranslations } from './types';

export const kycEn: KycTranslations = {
    pageTitle: 'KYC Verification',
    pageSubtitle: 'Complete your identity verification',

    sectionTitle: 'Identity Verification (KYC)',
    sectionSubtitle: 'Verify your identity to comply with regulatory requirements',

    verificationStatus: 'Verification status',
    loadingStatus: 'Loading KYC status...',

    statusNotSubmitted: 'Not Submitted',
    statusChecking: 'Checking...',
    statusPending: 'Under Review',
    statusApproved: 'Verified',
    statusRejected: 'Rejected',

    startVerification: 'Start Verification',
    retryVerification: 'Retry Verification',
    refreshStatus: 'Refresh Status',
    refreshing: 'Refreshing...',

    rejectionReason: 'Rejection Reason',
    submittedMessage:
      'Your verification has been submitted. Please wait while we review your information.',
    accessTokenMissing: 'Sumsub access token was not returned.',
    startFailed: 'Unable to start KYC verification. Please try again later.',
    refreshFailed: 'Unable to refresh KYC status. Please try again later.',
    loadFailed: 'Unable to load KYC status. Please try again later.',
    sdkLoadFailed: 'KYC verification failed to load. Please try again later.',
  };
