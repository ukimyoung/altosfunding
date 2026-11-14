export interface PurchaseHistoryTranslations {
  // Page header
  pageTitle: string;
  pageSubtitle: string;
  billingTransactions: string;

  // Summary cards
  totalAmountSpent: string;
  activeSubscriptions: string;

  // Filters
  filters: string;
  searchLabel: string;
  searchPlaceholder: string;
  selectDateRange: string;
  fromDateLabel: string;
  toDateLabel: string;
  fromPrefix: string;
  toPrefix: string;
  clearDates: string;
  resetFilters: string;
  applyDates: string;
  allStatus: string;
  statusCompleted: string;
  statusProcessing: string;
  statusFailed: string;
  statusPending: string;
  statusRefunded: string;

  // Table column headers
  colOrderNo: string;
  colDateOfPurchase: string;
  colChallengeAccountType: string;
  accountTypeStarter: string;
  accountTypeProfessional: string;
  accountTypeElite: string;
  colQuantity: string;
  colAmountPaid: string;
  colStatus: string;

  // Table cell sub-labels
  unitsLabel: string;

  // Mobile card labels
  accountTypeLabel: string;
  quantityLabel: string;
  amountPaidLabel: string;

  // Pagination
  showingPurchases: string; // "Showing {from}-{to} of {total} purchases"
  previous: string;
  next: string;
  purchasesLabel: string;
  emptyMessage: string;
  endOfResults: string;
}
