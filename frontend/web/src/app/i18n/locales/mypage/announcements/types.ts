export interface AnnouncementsTranslations {
  // Global shell — page title bar
  pageTitle: string;
  pageSubtitle: string;
  accountBalance: string;

  // Bell-icon section box inside the component
  sectionTitle: string;
  sectionSubtitle: string;

  // Search
  searchPlaceholder: string;
  noResults: string;
  loading: string;
  loadFailed: string;
  foundPrefix: string;
  resultSingular: string;
  resultPlural: string;

  // Table column headers
  colNo: string;
  colCategory: string;
  colTitle: string;
  colDate: string;

  // Category badge labels
  categoryRules: string;
  categoryMaintenance: string;
  categoryPolicy: string;
  categoryUpdate: string;

  // Announcement list titles keyed by announcement ID
  titles: { [id: number]: string };

  // Pagination
  show: string;
  rows: string;
  prev: string;
  next: string;
  showingPagination: string;

  // Detail view — header area
  backToAnnouncements: string;
  altosAdminTeam: string;

  // Detail view — announcement #2 body (Scheduled System Maintenance)
  a2Intro: string;
  a2Section1Title: string;
  a2Bullet1: string;
  a2Bullet2: string;
  a2Bullet3: string;
  a2Bullet4: string;
  a2Section2Title: string;
  a2Num1: string;
  a2Num2: string;
  a2Num3: string;
  a2Outro: string;

  // Detail view — bottom navigation
  backToList: string;
  previousPost: string;
  nextPost: string;

  // Not-found state
  notFound: string;
  notFoundDesc: string;
}
