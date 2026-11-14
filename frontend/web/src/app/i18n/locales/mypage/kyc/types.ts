export interface KycTranslations {
  // Page header (above card)
  pageTitle: string;
  pageSubtitle: string;

  // Card header row
  sectionTitle: string;
  sectionSubtitle: string;

  // Card body — status label
  verificationStatus: string;
  loadingStatus: string;

  // Status badge values
  statusNotSubmitted: string;
  statusChecking: string;
  statusPending: string;
  statusApproved: string;
  statusRejected: string;

  // CTA buttons
  startVerification: string;
  retryVerification: string;
  refreshStatus: string;
  refreshing: string;

  // Messages
  rejectionReason: string;
  submittedMessage: string;
  accessTokenMissing: string;
  startFailed: string;
  refreshFailed: string;
  loadFailed: string;
  sdkLoadFailed: string;
}
