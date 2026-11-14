export interface ReferralTranslations {
  // Invite banner
  inviteTitle: string;
  inviteSubtitle: string;

  // Stat cards
  totalInvitedFriends: string;
  pendingReferrals: string;
  totalEarnedRewards: string;

  // Referral link & code
  yourReferralLink: string;
  copyLink: string;
  copied: string;
  yourReferralCode: string;
  copyCode: string;

  // How it works box
  howItWorks: string;
  howItWorksBody: string; // contains inline $50 highlight — rendered as JSX in component
  howItWorksRewardHighlight: string;

  // Referral list table
  referralList: string;
  referralListSubtitle: string;

  // Table column headers
  colName: string;
  colRegisterDate: string;
  colTotalChallengeCount: string;
  colStatus: string;

  // Status badge labels
  statusActive: string;
  statusInactive: string;
  statusPending: string;

  // Mobile card label
  totalChallenges: string;

  // Empty state
  loadingReferrals: string;
  noReferralsFound: string;
  noReferralsHint: string;

  // Pagination — template: "{from}-{to} / 총 {total}건 조회 중"
  showingReferrals: string;
  previous: string;
  next: string;
}
