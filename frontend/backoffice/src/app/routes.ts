/**
 * “어디로 이동할지의 URL 규칙”은 navigation.ts
 * “그 URL에서 뭘 렌더링할지”는 routes.ts
 * “언제 이동할지”는 각 페이지가 담당
 */

import { createElement } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import App from './App';
import { DEFAULT_APP_ROUTE, LOGIN_ROUTE, ROOT_ROUTE, ROUTE_BY_PAGE_ID } from './config/navigation';
import Login from './pages/auth/Login';
import { AccountManagementPage } from './pages/accounts/AccountManagementPage';
import { MemberDetailPage } from './pages/members/MemberDetailPage';
import { MemberListPage } from './pages/members/MemberListPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { ViolationHistoryPage } from './pages/violations/ViolationHistoryPage';
import { ChallengeProductPage } from './pages/products/ChallengeProductPage';
import { FundedProductPage } from './pages/products/FundedProductPage';
import { LiveProductPage } from './pages/products/LiveProductPage';
import { DemoProductPage } from './pages/products/DemoProductPage';
import { RulesetManagementPage } from './pages/products/RulesetManagementPage';
import { LiveAccountPage } from './pages/accounts/LiveAccountPage';
import { DemoAccountPage } from './pages/accounts/DemoAccountPage';
import { PurchaseHistoryPage } from './pages/purchases/PurchaseHistoryPage';
import { RevenuePage } from './pages/revenue/RevenuePage';
import { TransactionHistoryPage } from './pages/transactions/TransactionHistoryPage';
import { LeaderboardPage } from './pages/leaderboards/LeaderboardPage';
import { TransactionApprovalPage } from './pages/transactions/TransactionApprovalPage';
import { CompetitionListPage } from './pages/competitions/CompetitionListPage';
import { ScheduleManagementPage } from './pages/competitions/ScheduleManagementPage';
import { RewardReferralPage } from './pages/reward-referrals/RewardReferralPage';
import { CouponManagementPage } from './pages/coupons/CouponManagementPage';
import { DemoOptionsManagementPage } from './pages/demo-options/DemoOptionsManagementPage';
import { InquiryListPage } from './pages/inquiries/InquiryListPage';
import { FaqListPage } from './pages/faq/FaqListPage';
import { EmailNotificationPage } from './pages/email-notifications/EmailNotificationPage';
import { Mt4LoginManagementPage } from './pages/mt4-logins/Mt4LoginManagementPage';
import { NoticeListPage } from './pages/notice/NoticeListPage';
import { MarketingPopupPage } from './pages/marketing-popups/MarketingPopupPage';
import { ProfitSplitPage } from './pages/system/ProfitSplitPage';
import { SupportedLanguagesPage } from './pages/system/SupportedLanguagesPage';

function RedirectToLogin() {
  return createElement(Navigate, { to: LOGIN_ROUTE, replace: true });
}

function RedirectToDefaultAppRoute() {
  return createElement(Navigate, { to: DEFAULT_APP_ROUTE, replace: true });
}

function appPath(path: string) {
  return path.replace(/^\/+/, '');
}

const placeholderPageIds = [
  'dashboard',
  'product-template',
  'asset-settlement',
  // 출시 시점 제외 faq, inquiry, review, promotions
  // 'faq',
  // 'inquiry',
  // 'reviews',
  // 'promotions',
  'system-settings',
] as const;

export const router = createBrowserRouter([
  {
    path: ROOT_ROUTE,
    Component: RedirectToLogin,
  },
  {
    path: LOGIN_ROUTE,
    Component: Login,
  },
  {
    Component: App,
    children: [
      {
        path: appPath(ROUTE_BY_PAGE_ID['challenge-product']),
        Component: ChallengeProductPage,
      },
      {
        path: appPath(ROUTE_BY_PAGE_ID['funded-product']),
        Component: FundedProductPage,
      },
      {
        path: appPath(ROUTE_BY_PAGE_ID['live-product']),
        Component: LiveProductPage,
      },
      {
        path: appPath(ROUTE_BY_PAGE_ID['demo-product']),
        Component: DemoProductPage,
      },
      {
        path: appPath(ROUTE_BY_PAGE_ID['ruleset-management']),
        Component: RulesetManagementPage,
      },
      {
        path: appPath(ROUTE_BY_PAGE_ID['competition-list']),
        Component: CompetitionListPage,
      },
      {
        path: appPath(ROUTE_BY_PAGE_ID['competition-schedule']),
        Component: ScheduleManagementPage,
      },
      {
        path: appPath(ROUTE_BY_PAGE_ID['leaderboard']),
        Component: LeaderboardPage,
      },
      {
        path: appPath(ROUTE_BY_PAGE_ID['member-list']),
        Component: MemberListPage,
      },
      {
        path: appPath(ROUTE_BY_PAGE_ID['member-detail']),
        Component: MemberDetailPage,
      },
      {
        path: appPath(ROUTE_BY_PAGE_ID['challenge-account']),
        Component: AccountManagementPage,
      },
      {
        path: appPath(ROUTE_BY_PAGE_ID['funded-account']),
        Component: AccountManagementPage,
      },
      {
        path: appPath(ROUTE_BY_PAGE_ID['live-account']),
        Component: LiveAccountPage,
      },
      {
        path: appPath(ROUTE_BY_PAGE_ID['demo-account']),
        Component: DemoAccountPage,
      },
      {
        path: appPath(ROUTE_BY_PAGE_ID.violations),
        Component: ViolationHistoryPage,
      },
      {
        path: appPath(ROUTE_BY_PAGE_ID.revenue),
        Component: RevenuePage,
      },
      {
        path: appPath(ROUTE_BY_PAGE_ID['purchase-history']),
        Component: PurchaseHistoryPage,
      },
      {
        path: appPath(ROUTE_BY_PAGE_ID['transaction-history']),
        Component: TransactionHistoryPage,
      },
      {
        path: appPath(ROUTE_BY_PAGE_ID['transaction-approval']),
        Component: TransactionApprovalPage,
      },
      {
        path: appPath(ROUTE_BY_PAGE_ID['notice-list']),
        Component: NoticeListPage,
      },
      {
        path: appPath(ROUTE_BY_PAGE_ID['marketing-popup']),
        Component: MarketingPopupPage,
      },
      {
        path: appPath(ROUTE_BY_PAGE_ID['reward-referral']),
        Component: RewardReferralPage,
      },
      {
        path: appPath(ROUTE_BY_PAGE_ID['coupon-management']),
        Component: CouponManagementPage,
      },
      {
        path: appPath(ROUTE_BY_PAGE_ID['demo-option-management']),
        Component: DemoOptionsManagementPage,
      },
      {
        path: appPath(ROUTE_BY_PAGE_ID.inquiry),
        Component: InquiryListPage,
      },
      {
        path: appPath(ROUTE_BY_PAGE_ID.faq),
        Component: FaqListPage,
      },
      {
        path: appPath(ROUTE_BY_PAGE_ID['email-notification']),
        Component: EmailNotificationPage,
      },
      {
        path: appPath(ROUTE_BY_PAGE_ID['mt4-login-management']),
        Component: Mt4LoginManagementPage,
      },
      {
        path: appPath(ROUTE_BY_PAGE_ID['supported-languages']),
        Component: SupportedLanguagesPage,
      },
      {
        path: appPath(ROUTE_BY_PAGE_ID['profit-split-settings']),
        Component: ProfitSplitPage,
      },
      ...placeholderPageIds.map((pageId) => ({
        path: appPath(ROUTE_BY_PAGE_ID[pageId]),
        element: createElement(PlaceholderPage, { pageId }),
      })),
    ],
  },
  {
    path: '*',
    Component: RedirectToDefaultAppRoute,
  },
]);
