// ─────────────────────────────────────────────────────────────────────────────
// Shared item shapes used by the landing page sections
// ─────────────────────────────────────────────────────────────────────────────

export interface StepItem {
  title: string;
  description: string;
}

export interface FeatureItem {
  title: string;
  description: string;
}

export interface TestimonialItem {
  quote: string;
}

export interface AccountTooltips {
  profitTarget: string;
  maxDrawdownEod: string;
  dailyLossLimit: string;
  maxContracts: string;
  consistency: string;
  tradingPeriod: string;
  profitSplit: string;
}

export interface AccountLabels {
  profitTarget: string;
  maxDrawdownEod: string;
  maxContracts: string;
  consistency: string;
  phase: string;
  tradingPeriod: string;
  dailyLossLimit: string;
  maxDrawdown: string;
  profitSplit: string;
  activationFee: string;
  consistencyRule: string;
  none: string;
  getStarted: string;
  mostPopular: string;
  bestValue: string;
  fundingCapital: string;
  oneTimeFee: string;
  challengeStage: string;
  fundedStage: string;
  topPerformance: string;
  topPerformanceSub: string;
  tooltips: AccountTooltips;
}

// ─────────────────────────────────────────────────────────────────────────────
// LandingTranslations — the flat namespace consumed by landing page components
// via T.nav, T.hero, T.howItWorks, T.features, T.accounts, T.testimonials,
// T.faqSection, and T.footer (accessed through useLocale → T).
// ─────────────────────────────────────────────────────────────────────────────

export interface LandingTranslations {
  nav: {
    home: string;
    howItWorks: string;
    pricing: string;
    testimonials: string;
    faq: string;
    login: string;
    getStarted: string;
    language: string;
  };

  hero: {
    tagline: string;
    titlePart1: string;
    titlePart2: string;
    subtitle: string;
    cta1: string;
    cta2: string;
    statCapitalLabel: string;
    statSplitLabel: string;
    statPayoutLabel: string;
  };

  howItWorks: {
    title: string;
    subtitle: string;
    cta: string;
    steps: StepItem[];
  };

  features: {
    title: string;
    subtitle: string;
    items: FeatureItem[];
  };

  accounts: {
    title: string;
    subtitle: string;
    labels: AccountLabels;
    tierNames: string[];
  };

  testimonials: {
    title: string;
    subtitle: string;
    trustBadge: string;
    items: TestimonialItem[];
  };

  faqSection: {
    title: string;
    subtitle: string;
    seeMore: string;
  };

  footer: {
    brand: string;
    legalCol: string;
    resourcesCol: string;
    companyCol: string;
    disclaimer: string;
    privacyPolicy: string;
    terms: string;
    helpCenter: string;
    faqLink: string;
    aboutUs: string;
    contactUs: string;
    allRights: string;
    privacyPolicyBottom: string;
    termsOfService: string;
    riskDisclosure: string;
    riskWarningTitle: string;
    riskWarningBody: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Content
// ─────────────────────────────────────────────────────────────────────────────
