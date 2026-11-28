export interface FundedTranslations {
  // Dashboard header (user-spec Phase 1)
  dashboardTitle: string;
  liveAccountStatus: string;
  fundedAmount: string;
  currentEquity: string;
  totalPayoutsToDate: string;
  nextPayoutDate: string;

  // Summary stat cards
  completedLabel: string;
  completedPayoutAmount: string;
  pendingLabel: string;
  pendingRequestAmount: string;
  totalLabel: string;
  payoutRequest: string;

  // Profit split & payouts block (user-spec Phase 2)
  profitSplitPayouts: string;
  totalShareableProfit: string;
  tradersShare: string;
  companysShare: string;
  requestPayout: string;
  minimumPayoutThreshold: string;
  profitMeetsThreshold: string;
  payoutRequestPending: string;
  payoutApproved: string;
  payoutUnderReview: string;

  // Live account rules (user-spec Phase 3)
  liveAccountRules: string;
  dailyLossHardStop: string;
  maxTotalDrawdownLimit: string;
  currentDrawdownDistance: string;
  consistencyRuleStatus: string;

  // Active positions warning modal
  unableToRequestPayout: string;
  activePositionsDetected: string;
  activePositionsMsg: string;
  importantLabel: string;
  activePositionsNote: string;
  understood: string;

  // Search & Filter panel
  searchAndFilter: string;
  accountIdLabel: string;
  searchPlaceholder: string;
  fundingTypeLabel: string;
  fundingTypeStarter: string;
  fundingTypeProfessional: string;
  fundingTypeElite: string;
  fundingTypePrime: string;
  startDateLabel: string;
  endDateLabel: string;
  statusLabel: string;
  resetFilters: string;
  search: string;

  // Status filter options
  statusAll: string;
  statusPending: string;
  statusActive: string;
  statusInProgress: string;
  statusInactive: string;
  statusPendingPayout: string;
  statusUnderReview: string;
  statusPaid: string;
  statusCompleted: string;
  statusFailed: string;
  statusClosed: string;
  statusBanned: string;

  // Funded account history table
  fundedAccountHistoryTitle: string;
  fundedAccountHistorySubtitle: string;

  // Table column headers
  colAccountId: string;
  colAccountType: string;
  colFundedCapital: string;
  colStartDay: string;
  colBalance: string;
  colProfit: string;
  colStatus: string;
  colAction: string;
  colPayout: string;

  // Table actions
  details: string;
  payoutUnderReviewBadge: string;
  emptyFundedAccounts: string;
  emptyFundedAccountsHint: string;
  noFundedAccountsMatching: string;
  summaryLabel: string;
  endOfFundedAccounts: string;
  banReason: string;
  closeBanReasonTooltip: string;

  // Pagination
  showingAccounts: string; // "Showing 1-8 of 8 accounts"
  previous: string;
  next: string;

  // Mobile card
  fundedCapitalMobile: string;
  underReview: string;
  review: string;
  payout: string;

  // Withdrawal success modal (from reward balance path)
  requestSubmittedTitle: string;
  requestSubmittedMsg: string; // contains {amount} placeholder
  whatsNext: string;
  reviewingMsg: string;
  step1: string;
  step2: string;
  step3: string;
  viewHistory: string;
  close: string;

  // Withdrawal modal (reward balance path)
  withdrawRewardsTitle: string;
  withdrawRewardsSub: string;
  availableBalance: string;
  withdrawalAmountLabel: string;
  enterAmount: string;
  minimum: string;
  useMax: string;
  selectNetwork: string;
  tronNetwork: string;
  ethereumNetwork: string;
  feeLabel: string;
  walletAddressLabel: string; // "{network} Wallet Address"
  walletAddressPlaceholder: string; // "Enter your {network} wallet address"
  doubleCheckWarning: string;
  withdrawalSummary: string;
  networkFee: string; // "Network Fee ({network})"
  totalToReceive: string;
  importantInfo: string;
  infoItem1: string;
  infoItem2: string;
  infoItem3: string;
  infoItem4: string;
  cancel: string;
  requestWithdrawal: string;

  // Transfer modal
  transferTitle: string;
  transferSub: string;
  transferDirection: string;
  fromLabel: string;
  totalPayoutBalance: string;
  totalRewardBalance: string;
  availableLabel: string;
  toLabel: string;
  totalAsset: string;
  currentBalanceLabel: string;
  transferAmountLabel: string;
  transferSummary: string;
  transferAmountRow: string;
  transferFee: string;
  free: string;
  totalAssetWillReceive: string;
  transferInfo: string;
  transferInfoItem1: string;
  transferInfoItem2: string;
  transferInfoItem3: string;
  transferInfoItem4: string;
  confirmTransfer: string;

  // WithdrawalRequestForm — breadcrumb
  breadcrumbDashboard: string;
  breadcrumbFundedAccount: string;
  breadcrumbRequestPayout: string;

  // WithdrawalRequestForm — page header
  requestPayoutTitle: string;
  requestPayoutSubtitle: string;
  back: string;

  // WithdrawalRequestForm — account info panel
  accountInformation: string;
  accountIdField: string;
  creationDate: string;
  totalBalance: string;
  pendingPayoutField: string;
  availableBalanceField: string;
  fundedCapital: string;
  totalCompletedPayout: string;

  // WithdrawalRequestForm — payout form
  payoutRequestForm: string;
  payoutAmountLabel: string;
  payoutFeeLabel: string; // "Payout Fee (20%)"
  netAmountReceived: string;
  verificationCode: string;
  enterCode: string;
  sending: string;
  codeSent: string;
  sendCode: string;
  verificationNote: string;
  processing: string;
  submitPayoutRequest: string;

  // WithdrawalRequestForm — payout history
  payoutHistory: string;
  payoutHistorySubtitle: string;
  colRequestNo: string;
  colPayoutAmount: string;
  colPayoutFee: string;
  colNetAmountReceived: string;
  colRequestDate: string;
  colCompletionDate: string;
  statusPendingPayoutRow: string;
  statusCompletedPayout: string;
  statusRejectedPayout: string;
  showingRequests: string; // "Showing 1-{n} of {n} requests"
  showingPayoutRequests: string;

  // WithdrawalRequestForm — success modal
  payoutRequestReceived: string;
  payoutRequestReceivedBody: string;
  confirm: string;
  paymentUnderReview: string;
  paymentUnderReviewBody: string;
  submitPayoutFailed: string;
  loading: string;
  endOfPayoutHistory: string;
}
