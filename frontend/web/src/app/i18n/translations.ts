// 새 언어를 추가할 때는 Locale에 코드를 추가한 뒤,
// src/app/i18n/locales 하위 각 도메인에 {locale}.ts를 만들고 index.ts record에 연결한다.
// 화면에 노출하려면 languageOptions.ts의 지원 언어 목록과 표시 메타데이터도 함께 추가한다.
export type Locale = 'en' | 'ko';

// ─── Landing page ─────────────────────────────────────────────────────────────
export type {
  LandingTranslations,
  StepItem,
  FeatureItem,
  TestimonialItem,
  AccountLabels,
} from './locales/landing';
import { landingTranslations, type LandingTranslations } from './locales/landing';

// ─── My Page sub-menus ────────────────────────────────────────────────────────
export type { StartNewChallengeTranslations } from './locales/mypage/startNewChallenge/index';
import { startNewChallengeTranslations } from './locales/mypage/startNewChallenge/index';

export type { ChallengeTranslations } from './locales/mypage/challenge/index';
import { challengeTranslations } from './locales/mypage/challenge/index';

export type { FundedTranslations } from './locales/mypage/funded/index';
import { fundedTranslations } from './locales/mypage/funded/index';

export type { PurchaseHistoryTranslations } from './locales/mypage/purchaseHistory/index';
import { purchaseHistoryTranslations } from './locales/mypage/purchaseHistory/index';

export type { RewardTranslations } from './locales/mypage/reward/index';
import { rewardTranslations } from './locales/mypage/reward/index';

export type { ReferralTranslations } from './locales/mypage/referral/index';
import { referralTranslations } from './locales/mypage/referral/index';
import { affiliateTranslations } from './locales/mypage/affiliate/index';

export type { MyAccountTranslations } from './locales/mypage/myAccount/index';
import { myAccountTranslations } from './locales/mypage/myAccount/index';

export type { MyAssetTranslations } from './locales/mypage/myAsset/index';
import { myAssetTranslations } from './locales/mypage/myAsset/index';

export type { SecurityTranslations } from './locales/mypage/security/index';
import { securityTranslations } from './locales/mypage/security/index';

export type { KycTranslations } from './locales/mypage/kyc/index';
import { kycTranslations } from './locales/mypage/kyc/index';

export type { AnnouncementsTranslations } from './locales/mypage/announcements/index';
import { announcementsTranslations } from './locales/mypage/announcements/index';

export type { DownloadPlatformTranslations } from './locales/mypage/downloadPlatform/index';
import { downloadPlatformTranslations } from './locales/mypage/downloadPlatform/index';

export type { ContactUsTranslations } from './locales/mypage/contactUs/index';
import { contactUsTranslations } from './locales/mypage/contactUs/index';

export type { LoginTranslations } from './locales/login';
import { loginTranslations } from './locales/login';

export type { SignUpTranslations } from './locales/signup/signUp/index';
import { signUpTranslations } from './locales/signup/signUp/index';

// ─── Dashboard shared interfaces ──────────────────────────────────────────────

export interface DashboardNav {
  home: string;
  newChallenge: string;
  challenge: string;
  funded: string;
  purchaseHistory: string;
  reward: string;
  rewardSub: string;
  referral: string;
  affiliate: string;
  affiliatePerformance: string;
  affiliateDetail: string;
  myProfile: string;
  myAccount: string;
  myAsset: string;
  security: string;
  kyc: string;
  announcements: string;
  downloadPlatform: string;
  helpCenter: string;
  contactUs: string;
}

export interface DashboardTopBar {
  titles: {
    home: string;
    myAccount: string;
    myAsset: string;
    security: string;
    kyc: string;
    announcements: string;
    rewardDashboard: string;
    referral: string;
    affiliate: string;
    affiliatePerformance: string;
    affiliateDetail: string;
    purchaseHistory: string;
    newChallenge: string;
    alphaAccount: string;
    omegaAccount: string;
    downloadPlatform: string;
    contactUs: string;
  };
  subtitles: {
    home: string;
    myAccount: string;
    myAsset: string;
    security: string;
    kyc: string;
    announcements: string;
    rewardDashboard: string;
    referral: string;
    affiliate: string;
    affiliatePerformance: string;
    affiliateDetail: string;
    purchaseHistory: string;
    newChallenge: string;
    alphaAccount: string;
    omegaAccount: string;
    downloadPlatform: string;
    contactUs: string;
  };
  accountBalance: string;
}

export interface DashboardSidebar {
  expandSidebar: string;
  collapseSidebar: string;
  language: string;
  logOut: string;
  loggingOut: string;
  switchToKr: string;
  switchToEn: string;
}

export interface NotFoundTranslations {
  code: string;
  title: string;
  description: string;
}

export interface MarketingPopupTranslations {
  viewDetails: string;
  doNotShowAgainToday: string;
  close: string;
}

// ─── Root Translations interface ──────────────────────────────────────────────
// Extends LandingTranslations so landing page components continue to access
// T.nav, T.hero, T.howItWorks, T.features, T.accounts, T.testimonials,
// T.faqSection, and T.footer without any changes.

export interface Translations extends LandingTranslations {
  marketingPopup: MarketingPopupTranslations;
  startNewChallenge: import('./locales/mypage/startNewChallenge/index').StartNewChallengeTranslations;
  challenge: import('./locales/mypage/challenge/index').ChallengeTranslations;
  funded: import('./locales/mypage/funded/index').FundedTranslations;
  purchaseHistory: import('./locales/mypage/purchaseHistory/index').PurchaseHistoryTranslations;
  reward: import('./locales/mypage/reward/index').RewardTranslations;
  referral: import('./locales/mypage/referral/index').ReferralTranslations;
  affiliate: import('./locales/mypage/affiliate/index').AffiliateTranslations;
  myAccount: import('./locales/mypage/myAccount/index').MyAccountTranslations;
  myAsset: import('./locales/mypage/myAsset/index').MyAssetTranslations;
  security: import('./locales/mypage/security/index').SecurityTranslations;
  kyc: import('./locales/mypage/kyc/index').KycTranslations;
  announcements: import('./locales/mypage/announcements/index').AnnouncementsTranslations;
  downloadPlatform: import('./locales/mypage/downloadPlatform/index').DownloadPlatformTranslations;
  contactUs: import('./locales/mypage/contactUs/index').ContactUsTranslations;
  login: import('./locales/login').LoginTranslations;
  signup: import('./locales/signup/signUp/index').SignUpTranslations;
  notFound: NotFoundTranslations;
  dashboard: {
    nav: DashboardNav;
    topBar: DashboardTopBar;
    sidebar: DashboardSidebar;
  };
}

// ─── translations record ──────────────────────────────────────────────────────

export const translations: Record<Locale, Translations> = {
  en: {
    // Landing page sections
    ...landingTranslations.en,
    marketingPopup: {
      viewDetails: 'View Details',
      doNotShowAgainToday: 'Do not show again today',
      close: 'Close',
    },

    // My Page sub-menu locales
    startNewChallenge: startNewChallengeTranslations.en,
    challenge: challengeTranslations.en,
    funded: fundedTranslations.en,
    purchaseHistory: purchaseHistoryTranslations.en,
    reward: rewardTranslations.en,
    referral: referralTranslations.en,
    affiliate: affiliateTranslations.en,
    myAccount: myAccountTranslations.en,
    myAsset: myAssetTranslations.en,
    security: securityTranslations.en,
    kyc: kycTranslations.en,
    announcements: announcementsTranslations.en,
    downloadPlatform: downloadPlatformTranslations.en,
    contactUs: contactUsTranslations.en,
    login: loginTranslations.en,
    signup: signUpTranslations.en,
    notFound: {
      code: '404',
      title: 'Page Not Found',
      description: 'The page you are looking for does not exist or may have been moved.',
    },

    dashboard: {
      nav: {
        home: 'Home',
        newChallenge: 'Start New Challenge',
        challenge: 'Challenge',
        funded: 'Funded',
        purchaseHistory: 'Purchase History',
        reward: 'Reward',
        rewardSub: 'Reward',
        referral: 'Referral',
        affiliate: 'Affiliate Program',
        affiliatePerformance: 'Affiliate Performance',
        affiliateDetail: 'Performance Detail',
        myProfile: 'My Profile',
        myAccount: 'My Account',
        myAsset: 'My Asset',
        security: 'Security',
        kyc: 'KYC',
        announcements: 'Announcements',
        downloadPlatform: 'Download Platform',
        helpCenter: 'Help Center',
        contactUs: 'Contact Us',
      },
      topBar: {
        titles: {
          home: 'Dashboard',
          myAccount: 'My Account',
          myAsset: 'My Asset',
          security: 'Security',
          kyc: 'KYC Verification',
          announcements: 'Announcements',
          rewardDashboard: 'Rewards',
          referral: 'Referral Network',
          affiliate: 'Affiliate Program',
          affiliatePerformance: 'Affiliate Performance',
          affiliateDetail: 'Performance Detail',
          purchaseHistory: 'Purchase History',
          newChallenge: 'Start New Challenge',
          alphaAccount: 'Challenge Account',
          omegaAccount: 'Funded Account',
          downloadPlatform: 'Download MetaTrader 4',
          contactUs: 'Contact Us',
        },
        subtitles: {
          home: 'Welcome back, John!',
          myAccount: 'Manage your profile and referral rewards',
          myAsset: 'Track and manage your total assets, balances, and transactions',
          security: 'Manage your account security settings',
          kyc: 'Complete your identity verification',
          announcements: 'Browse critical updates, new features, and important notices',
          rewardDashboard: 'Track and manage your earnings and bonuses',
          referral: 'Grow your network and earn referral rewards',
          affiliate: 'Manage your multi-level IB network and commission performance',
          affiliatePerformance: 'Track IB levels, commissions, and your downline network',
          affiliateDetail: 'Review granular affiliate performance and commission records',
          purchaseHistory: 'View all your challenge purchases and payment history',
          newChallenge: 'Select your account type and begin your trading journey',
          alphaAccount:
            'Monitor and manage all your active and completed Challenge Account challenges',
          omegaAccount: 'Track and manage your Funded Account earnings and bonuses',
          downloadPlatform: 'Professional trading platform by MetaQuotes',
          contactUs: "We're here to help. Send us a message and we'll respond as soon as possible",
        },
        accountBalance: 'Account Balance',
      },
      sidebar: {
        expandSidebar: 'Expand Sidebar',
        collapseSidebar: 'Collapse Sidebar',
        language: 'Language',
        logOut: 'LOG OUT',
        loggingOut: 'LOGGING OUT...',
        switchToKr: 'EN → KR',
        switchToEn: 'KR → EN',
      },
    },
  },

  ko: {
    // Landing page sections
    ...landingTranslations.ko,
    marketingPopup: {
      viewDetails: '자세히 보기',
      doNotShowAgainToday: '오늘 하루 보지 않기',
      close: '닫기',
    },

    // My Page sub-menu locales
    startNewChallenge: startNewChallengeTranslations.ko,
    challenge: challengeTranslations.ko,
    funded: fundedTranslations.ko,
    purchaseHistory: purchaseHistoryTranslations.ko,
    reward: rewardTranslations.ko,
    referral: referralTranslations.ko,
    affiliate: affiliateTranslations.ko,
    myAccount: myAccountTranslations.ko,
    myAsset: myAssetTranslations.ko,
    security: securityTranslations.ko,
    kyc: kycTranslations.ko,
    announcements: announcementsTranslations.ko,
    downloadPlatform: downloadPlatformTranslations.ko,
    contactUs: contactUsTranslations.ko,
    login: loginTranslations.ko,
    signup: signUpTranslations.ko,
    notFound: {
      code: '404',
      title: '페이지를 찾을 수 없습니다',
      description: '요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.',
    },

    dashboard: {
      nav: {
        home: '홈',
        newChallenge: '새 챌린지 시작',
        challenge: '챌린지',
        funded: '펀딩',
        purchaseHistory: '구매 내역',
        reward: '리워드',
        rewardSub: '리워드',
        referral: '레퍼럴',
        affiliate: '제휴프로그램',
        affiliatePerformance: '제휴 성과',
        affiliateDetail: '성과 상세',
        myProfile: '내 프로필',
        myAccount: '내 계정',
        myAsset: '내 자산',
        security: '보안',
        kyc: 'KYC',
        announcements: '공지사항',
        downloadPlatform: '플랫폼 다운로드',
        helpCenter: '도움말 센터',
        contactUs: '문의하기',
      },
      topBar: {
        titles: {
          home: '대시보드',
          myAccount: '내 계정',
          myAsset: '내 자산',
          security: '보안',
          kyc: 'KYC 인증',
          announcements: '공지사항',
          rewardDashboard: '리워드',
          referral: '레퍼럴 네트워크',
          affiliate: '제휴프로그램',
          affiliatePerformance: '제휴 성과',
          affiliateDetail: '성과 상세',
          purchaseHistory: '구매 내역',
          newChallenge: '새 챌린지 시작',
          alphaAccount: '챌린지 계좌',
          omegaAccount: '펀딩 계좌',
          downloadPlatform: 'MetaTrader 4 다운로드',
          contactUs: '문의하기',
        },
        subtitles: {
          home: '돌아오신 것을 환영합니다, John님!',
          myAccount: '프로필 및 레퍼럴 리워드를 관리하세요',
          myAsset: '총 자산, 잔액, 거래 내역을 추적 및 관리하세요',
          security: '계정 보안 설정을 관리하세요',
          kyc: '본인 인증을 완료하세요',
          announcements: '중요 업데이트, 새 기능, 공지사항을 확인하세요',
          rewardDashboard: '수익 및 보너스를 추적 및 관리하세요',
          referral: '네트워크를 늘리고 레퍼럴 리워드를 획득하세요',
          affiliate: '다단계 IB 네트워크와 커미션 성과를 관리하세요',
          affiliatePerformance: 'IB 레벨, 커미션, 하위 네트워크 성과를 확인하세요',
          affiliateDetail: '세부 제휴 성과와 커미션 기록을 확인하세요',
          purchaseHistory: '모든 챌린지 구매 및 결제 내역을 확인하세요',
          newChallenge: '계정 유형을 선택하고 트레이딩 여정을 시작하세요',
          alphaAccount: '모든 활성 및 완료된 챌린지 계좌를 모니터링하세요',
          omegaAccount: '펀딩 계좌의 수익 및 보너스를 추적 및 관리하세요',
          downloadPlatform: 'MetaQuotes의 전문 트레이딩 플랫폼',
          contactUs: '도움이 필요하신가요? 메시지를 보내주시면 최대한 빠르게 답변드리겠습니다',
        },
        accountBalance: '계좌 잔액',
      },
      sidebar: {
        expandSidebar: '사이드바 펼치기',
        collapseSidebar: '사이드바 접기',
        language: '언어',
        logOut: '로그아웃',
        loggingOut: '로그아웃 중...',
        switchToKr: 'EN → KR',
        switchToEn: 'KR → EN',
      },
    },
  },
};
