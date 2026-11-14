export interface MyAssetTranslations {
  // Dashboard summary cards
  totalAsset: string;
  availableForWithdrawal: string;
  deposit: string;
  withdraw: string;
  checking: string;
  submitting: string;
  sending: string;
  liveBadge: string;
  thisWeek: string;
  thisMonth: string;

  // Live Trading Account card
  liveTrading: string;
  mt4Mt5Balance: string;
  accountManagement: string;
  accountManagementBody: string;

  // Transfer button (mobile + desktop tooltip)
  transferBetweenAccounts: string;

  // Search & Filter panel
  searchAndFilter: string;
  fromDate: string;
  toDate: string;
  category: string;
  status: string;
  allTransactions: string;
  depositsOnly: string;
  withdrawalsOnly: string;
  allStatus: string;
  search: string;
  reset: string;
  resetFilters: string;

  // History table
  depositWithdrawHistory: string;
  depositWithdrawHistorySub: string;
  colDate: string;
  colType: string;
  colDeposit: string;
  colWithdraw: string;
  colWithdrawSub: string;        // "(Fee / Net Amount Received)"
  colAddress: string;
  colNetwork: string;
  colTxid: string;
  colStatus: string;

  // Type badge labels
  typeReward: string;
  typeExternalWallet: string;
  typePayout: string;
  typeLiveTrading: string;
  typeChallengePurchase: string;

  // Status badge labels
  statusCompleted: string;
  statusPending: string;
  statusFailed: string;

  // Failure tooltip
  failureReason: string;

  // Pagination
  previous: string;
  next: string;
  noTransactionHistory: string;
  transactions: string;
  endOfAssetHistory: string;
  showingAssetRange: string;

  // Network availability and request errors
  loadingAvailableNetworks: string;
  failedLoadAvailableNetworks: string;
  noActiveNetworks: string;
  noDepositNetworkAvailable: string;
  noWithdrawalNetworkAvailable: string;
  selectedNetworkNoDepositAddress: string;
  depositRequestFailed: string;
  withdrawRequestFailed: string;
  transferRequestFailed: string;
  sendEmailCodeFailed: string;
  emailMissing: string;
  liveAccountInfoMissing: string;

  // Required-action modals
  kycRequiredTitle: string;
  kycRequiredSubtitle: string;
  kycRequiredMessage: string;
  kycRequiredImportant: string;
  goToKyc: string;
  unablePrepareWithdrawalTitle: string;
  unablePrepareWithdrawalSubtitle: string;
  unablePrepareWithdrawalMessage: string;
  close: string;
  liveAccountRequiredTitle: string;
  liveAccountRequiredSubtitle: string;
  liveAccountRequiredMessage: string;
  goToMyAccount: string;
  liveAccountRequiredImportant: string;
  ok: string;

  // Toast notifications
  depositSuccessTitle: string;
  depositSuccessBody: string;
  withdrawSuccessTitle: string;
  withdrawSuccessBody: string;
  transferSuccessTitle: string;
  transferSuccessBody: string;

  // Deposit modal
  depositUsdt: string;
  depositUsdtSub: string;
  depositAmount: string;
  depositAmountPlaceholder: string;
  depositMinimum: string;
  selectNetwork: string;
  scanQrCode: string;
  depositAddress: string;
  transactionId: string;
  txidPlaceholder: string;
  txidHint: string;
  importantInfo: string;
  depositInfo1: string;           // "Only send USDT to this address via {network} network"
  depositInfo2: string;
  depositInfo3: string;
  depositInfo4: string;
  depositQrAlt: string;           // "{network} USDT deposit QR code"
  selectSupportedNetworkQr: string;
  cancel: string;

  // Deposit validation errors
  errDepositRequired: string;
  errDepositPositive: string;
  errDepositMinimum: string;      // "Minimum deposit amount is {min} USDT"
  errTxidRequired: string;

  // Withdraw modal
  withdrawUsdt: string;
  withdrawUsdtSub: string;
  availableBalance: string;
  withdrawAmount: string;
  withdrawAmountPlaceholder: string;
  withdrawMinimum: string;
  useMax: string;
  walletAddressLabel: string;     // "{network} Wallet Address"
  walletAddressPlaceholder: string; // "Enter your {network} wallet address"
  walletAddressWarning: string;
  withdrawInfo1: string;
  withdrawInfo2: string;
  withdrawInfo3: string;
  withdrawInfo4: string;
  requestWithdrawal: string;

  // Withdraw summary section
  withdrawalSummary: string;
  withdrawalAmount: string;
  networkFee: string;             // "Network Fee ({network})"
  totalToReceive: string;

  // Withdraw validation errors
  errAddressRequired: string;
  errAddressErc20: string;
  errAddressPolygon: string;
  errAddressTrc20: string;
  errAmountRequired: string;
  errAmountPositive: string;
  errInsufficientBalance: string;
  errWithdrawMinimum: string;     // "Minimum withdrawal amount is {min} USDT"

  // Transfer modal
  transferFunds: string;
  transferFundsSub: string;
  transferDirection: string;
  transferFrom: string;
  transferTo: string;
  availableBalanceLabel: string;
  currentBalance: string;
  transferAmount: string;
  transferAmountPlaceholder: string;
  transferMinimum: string;
  transferInfo: string;
  transferInfo1: string;
  transferInfo2: string;
  transferInfo3: string;
  transferInfo4: string;
  confirmTransfer: string;

  // Transfer select options (displayed in dropdowns)
  optionTotalAsset: string;
  optionLiveTrading: string;

  // Transfer validation errors
  errTransferRequired: string;
  errTransferPositive: string;
  errTransferInsufficient: string;
  errTransferMinimum: string;     // "Minimum transfer amount is {min} USDT"

  // Security verification modal
  securityVerification: string;
  securityVerificationSub: string;
  emailVerificationCode: string;
  emailCodePlaceholder: string;
  sendCode: string;
  authenticatorCode: string;
  authenticatorCodePlaceholder: string;
  authenticatorCodeHint: string;
  confirmWithdrawal: string;

  // Security verification errors
  errEmailCodeRequired: string;
  errEmailCodeInvalid: string;
  errAuthCodeRequired: string;
  errAuthCodeInvalid: string;
  closeFailureReasonTooltip: string;
}
