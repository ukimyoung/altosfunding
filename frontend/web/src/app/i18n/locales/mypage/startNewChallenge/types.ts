export interface StartNewChallengeTranslations {
  // Page header
  pageTitle: string;
  accountSizeTitle: string;
  accountSizeSubtitle: string;

  // Account tier names
  tierNames: { starter: string; pro: string; elite: string };

  // Card labels
  mostPopular: string;
  fundingCapital: string;
  oneTimeFee: string;
  evaluationPhase: string;
  fundedAccount: string;

  // Stage section headings
  challengeStage: string;
  fundedStage: string;

  // Row labels inside cards
  phase: string;
  tradingPeriod: string;
  dailyLossLimit: string;
  maxDrawdown: string;
  maxDrawdownEod: string;
  maxContracts: string;
  consistency: string;
  profitSplit: string;
  activationFee: string;
  consistencyRule: string;
  none: string;

  // Trading objectives block
  tradingObjectives: string;
  profitTarget: string;
  maxDailyLoss: string;
  maxTotalDrawdown: string;
  minTradingDays: string;
  noTimeLimit: string;
  leverageText: string;

  // Quantity selector
  quantityLabel: string;
  account: string;
  accounts: string;

  // Order summary
  orderSummary: string;
  challengeAccountType: string;
  quantity: string;
  totalAmount: string;
  proceedToPayment: string;
  chooseChallengeAccountType: string;
  selected: string;
  fiveDays: string;
  requestFailed: string;
  processing: string;
  checking: string;
  noActiveChallenges: string;
  completePaymentError: string;
  profileNameRequired: string;
  challengeUnavailable: string;
  challengeChanged: string;
  refreshFailed: string;

  // Refund note
  refundableRegFee: string;
  refundableRegFeeDesc: string;

  // Payment method selection
  selectPaymentMethod: string;
  cryptoPayment: string;
  creditDebitCard: string;
  enterBillingDetails: string;
  purchaseChallenge: string;

  // Payment modal
  completePaymentTitle: string;
  completePaymentSub: string;
  availableTotalAsset: string;
  challengeDetails: string;
  paymentSummary: string;
  challengeFee: string;
  processingFee: string;
  free: string;
  discountCode: string;
  discountCodePlaceholder: string;
  verifyCode: string;
  verifyingCode: string;
  discountApplied: string; // "{rate}% off applied"
  discountInvalid: string;
  discountAmount: string;
  remainingBalance: string;
  paymentInfoTitle: string;
  paymentInfoItems: string[];
  cancel: string;
  completePaymentBtn: string;

  // Insufficient funds modal
  insufficientFunds: string;
  unableToComplete: string;
  insufficientFundsMsg: string;
  requiredAmount: string;
  currentBalance: string;
  amountNeeded: string;
  close: string;
  goToMyAsset: string;

  // Success toast
  paymentSuccessful: string;
  paymentSuccessMsg: string;
}
