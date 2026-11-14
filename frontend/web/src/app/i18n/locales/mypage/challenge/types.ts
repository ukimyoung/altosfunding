export interface ChallengeTranslations {
  // Page header / dashboard title
  dashboardTitle: string;

  // Summary stat cards
  totalLabel: string;
  totalChallenges: string;
  allTimeParticipation: string;
  typesLabel: string;
  accountTypes: string;
  accountTypeStarter: string;
  accountTypeProfessional: string;
  accountTypeElite: string;
  accountTypePrime: string;
  activeLabel: string;
  totalActiveChallenges: string;
  currentlyInProgress: string;

  // Account status values
  statusInProgress: string;
  statusPassed: string;
  statusFailed: string;
  statusInactive: string;
  statusActive: string;
  statusPending: string;
  statusBanned: string;
  statusClosed: string;
  statusAll: string;

  // Search & filter panel
  searchAndFilter: string;
  search: string;
  accountIdLabel: string;
  searchPlaceholder: string;
  accountTypeLabel: string;
  startDateLabel: string;
  endDateLabel: string;
  statusLabel: string;
  resetFilters: string;

  // Table section
  challengeAccounts: string;
  showingOf: string; // "Showing {count} of {total} Challenge Accounts"
  challengeAccountsUnit: string;
  noChallengeAccountsMatching: string;
  endOfChallengeAccounts: string;

  // Table column headers
  colAccountId: string;
  colAccountType: string;
  colCapital: string;
  colChallengePeriod: string;
  colBalance: string;
  colProfit: string;
  colStatus: string;
  colAction: string;

  // Action buttons
  details: string;
  viewDetails: string;

  // Pagination
  previous: string;
  next: string;
  showingRange: string; // "Showing {from} - {to} of {total} challenges"
  challengesUnit: string;

  // Mobile card labels
  periodLabel: string;

  // Empty state
  noChallengesFound: string;
  noChallengesHint: string;

  // Modal — header
  accountDetail: string;
  close: string;
  copied: string;
  copyAccountNumber: string;
  copyPassword: string;
  banReason: string;
  closeBanReasonTooltip: string;

  // Modal — credentials (Phase 1)
  tradingCredentials: string;
  accountNumber: string;
  loginId: string;
  password: string;
  server: string;
  platform: string;
  accountStatus: string;

  // Modal — financial metrics (Phase 2)
  financialMetrics: string;
  startingBalance: string;
  currentBalance: string;
  currentEquity: string;
  capital: string;
  accountBalance: string;
  totalProfit: string;
  currentProfitLoss: string;

  dailyLossLimitSection: string;
  dailyMaxLossAllowed: string;
  currentDailyLoss: string;

  maxTotalDrawdownSection: string;
  maxDrawdownAllowed: string;
  currentMaxDrawdown: string;

  profitTarget: string;

  // Modal — objectives status (Phase 3)
  objectivesStatus: string;
  minTradingDays: string;
  currentTradingDays: string;
  timeRemaining: string;
  noTimeLimit: string;
  objectiveInProgress: string;
  objectivePassed: string;
  objectiveViolated: string;

  // Trading history table
  tradingHistory: string;
  tradingHistoryNote: string;
  loadingTradingHistory: string;
  loadTradingHistoryFailed: string;
  noTradingHistoryAvailable: string;
  actionBuy: string;
  actionSell: string;
  actionBalance: string;
  entryIn: string;
  entryOut: string;
  colDeal: string;
  colSymbol: string;
  colDate: string;
  colTrade: string;
  colEntry: string;
  colVolume: string;
  colPrice: string;
  colProfitShort: string;
}
