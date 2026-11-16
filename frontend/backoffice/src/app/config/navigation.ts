// 앱 내부 화면 이동에 필요한 메뉴, breadcrumb, URL-pageId 매핑을 한곳에서 관리합니다.
// routes.ts는 이 파일의 경로 목록을 가져와 React Router 설정만 구성합니다.

import {
  LayoutDashboard,
  Tag,
  Trophy,
  Users,
  Wallet,
  AlertTriangle,
  CreditCard,
  BarChart2,
  Gift,
  HelpCircle,
  MessageCircle,
  Star,
  Settings,
  Wallet2,
  Mail,
  Image,
  Bell,
  Ticket,
  MonitorSmartphone,
  Percent,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavItem = {
  id: string;
  label: string;
  icon?: LucideIcon;
  external?: boolean;
  expandable?: boolean;
  children?: { id: string; label: string }[];
};

export type NavSection = { sectionLabel?: string; items: NavItem[] };

export const ROOT_ROUTE = '/';
export const LOGIN_ROUTE = '/login';
export const DEFAULT_PAGE_ID = 'member-list';

export const NAV: NavSection[] = [
  { items: [{ id: 'dashboard', label: '대시보드', icon: LayoutDashboard }] },
  {
    sectionLabel: '챌린지 관리',
    items: [
      {
        id: 'product-template',
        label: '상품 템플릿',
        icon: Tag,
        expandable: true,
        children: [
          { id: 'challenge-product', label: '챌린지 상품' },
          { id: 'funded-product', label: '펀디드 상품' },
          { id: 'live-product', label: '라이브 상품' },
          { id: 'demo-product', label: '데모 상품' },
          { id: 'ruleset-management', label: '룰셋 관리' },
        ],
      },
    ],
  },
  {
    sectionLabel: '대회',
    items: [
      { id: 'competition-list', label: '대회 목록', icon: Trophy },
      { id: 'leaderboard', label: 'Leaderboard', icon: Trophy, external: true },
    ],
  },
  {
    sectionLabel: '트레이더 관리',
    items: [
      { id: 'member-list', label: '회원 목록', icon: Users },
      {
        id: 'account-mgmt',
        label: '계좌 관리',
        icon: Wallet,
        expandable: true,
        children: [
          { id: 'challenge-account', label: '챌린지 계좌관리' },
          { id: 'funded-account', label: '펀디드 계좌관리' },
          { id: 'live-account', label: '라이브 계좌관리' },
          { id: 'demo-account', label: '데모 계좌관리' },
        ],
      },
      { id: 'violations', label: '규정 위반 이력', icon: AlertTriangle },
    ],
  },
  {
    sectionLabel: '재무/정산',
    items: [
      { id: 'revenue', label: '매출 현황', icon: BarChart2 },
      { id: 'purchase-history', label: '전체구매/결제이력', icon: CreditCard },
      { id: 'transaction-history', label: '입출금 내역', icon: Wallet2 },
      { id: 'transaction-approval', label: '입출금 승인 관리', icon: Wallet2 },
      // { id: 'asset-settlement', label: '어셋현황 및 정산요청', icon: BarChart2 },
    ],
  },
  {
    sectionLabel: '운영 관리',
    items: [
      { id: 'notice-list', label: '공지사항', icon: Bell },
      { id: 'marketing-popup', label: '마케팅 팝업 관리', icon: Image },
      { id: 'reward-referral', label: '리워드/래퍼럴 관리', icon: Gift },
      { id: 'coupon-management', label: '쿠폰 관리', icon: Ticket },
      { id: 'demo-option-management', label: '데모 계정 관리', icon: MonitorSmartphone },
      { id: 'inquiry', label: '문의하기', icon: MessageCircle },
      { id: 'faq', label: 'FAQ', icon: HelpCircle },
      { id: 'email-notification', label: '이메일/알림 관리', icon: Mail },
      { id: 'profit-split-settings', label: '수익 분배 / 출금 수수료 설정', icon: Percent },
    ],
  },
  // 출시 시점 제외 faq, inquiry, review, promotions
  // {
  //   items: [
  //     { id: 'reviews', label: '사용자 후기', icon: Star },
  //     { id: 'promotions', label: '프로모션/쿠폰 관리', icon: Ticket },
  //   ],
  // },
  {
    sectionLabel: '시스템',
    items: [
      {
        id: 'system-settings',
        label: '시스템 설정',
        icon: Settings,
        expandable: true,
        children: [
          { id: 'supported-languages', label: '지원 언어 관리' },
          // '수익 분배 / 출금 수수료 설정'은 '운영 관리 > 이메일/알림 관리' 아래로 이동
          // { id: 'profit-split-settings', label: '수익 분배 / 출금 수수료 설정' },
        ],
      },
    ],
  },
];

export const BC: Record<string, { parts: string[] }> = {
  dashboard: { parts: ['홈', '대시보드'] },
  'product-template': { parts: ['챌린지 관리', '상품 템플릿'] },
  'challenge-product': { parts: ['챌린지 관리', '챌린지 상품'] },
  'funded-product': { parts: ['챌린지 관리', '펀디드 상품'] },
  'live-product': { parts: ['챌린지 관리', '라이브 상품'] },
  'demo-product': { parts: ['챌린지 관리', '데모 상품'] },
  'ruleset-management': { parts: ['챌린지 관리', '룰셋 관리'] },
  'competition-list': { parts: ['대회', '대회 목록'] },
  leaderboard: { parts: ['대회', 'Leaderboard'] },
  'member-list': { parts: ['트레이더 관리', '회원 목록'] },
  'member-detail': { parts: ['트레이더 관리', '회원 목록', '회원 정보 상세'] },
  'account-mgmt': { parts: ['트레이더 관리', '계좌 관리'] },
  'challenge-account': { parts: ['트레이더 관리', '챌린지 계좌 관리'] },
  'funded-account': { parts: ['트레이더 관리', '펀디드 계좌 관리'] },
  'live-account': { parts: ['트레이더 관리', '라이브 계좌 관리'] },
  'demo-account': { parts: ['트레이더 관리', '데모 계좌 관리'] },
  violations: { parts: ['트레이더 관리', '규정 위반 이력'] },
  revenue: { parts: ['재무/정산', '매출 현황'] },
  'purchase-history': { parts: ['재무/정산', '전체구매/결제이력'] },
  'transaction-history': { parts: ['재무/정산', '입출금 내역'] },
  'transaction-approval': { parts: ['재무/정산', '입출금 승인 관리'] },
  // 'asset-settlement': { parts: ['재무/정산', '어셋현황 및 정산요청'] },
  'notice-list': { parts: ['운영 관리', '공지사항'] },
  'marketing-popup': { parts: ['운영 관리', '마케팅 팝업 관리'] },
  'reward-referral': { parts: ['운영 관리', '리워드/래퍼럴 관리'] },
  'coupon-management': { parts: ['운영 관리', '쿠폰 관리'] },
  'demo-option-management': { parts: ['운영 관리', '데모 계정 관리'] },
  inquiry: { parts: ['운영 관리', '문의하기'] },
  faq: { parts: ['운영 관리', 'FAQ'] },
  'email-notification': { parts: ['운영 관리', '이메일/알림 관리'] },
  'profit-split-settings': { parts: ['운영 관리', '수익 분배 / 출금 수수료 설정'] },
  // 출시 시점 제외 faq, inquiry, review, promotions
  // faq: { parts: ['지원', 'FAQ'] },
  // inquiry: { parts: ['지원', '1:1 문의'] },
  // reviews: { parts: ['지원', '사용자 후기'] },
  // promotions: { parts: ['지원', '프로모션/쿠폰 관리'] },
  'system-settings': { parts: ['시스템', '시스템 설정'] },
  'supported-languages': { parts: ['시스템', '시스템 설정', '지원 언어 관리'] },
};

export const ROUTE_BY_PAGE_ID: Record<string, string> = {
  dashboard: '/dashboard',
  'product-template': '/product-template',
  'challenge-product': '/challenge-product',
  'funded-product': '/funded-product',
  'live-product': '/live-product',
  'demo-product': '/demo-product',
  'ruleset-management': '/ruleset-management',
  'competition-list': '/competition-list',
  leaderboard: '/leaderboard',
  'member-list': '/member-list',
  'member-detail': '/member-list/:memberId',
  'challenge-account': '/challenge-account',
  'funded-account': '/funded-account',
  'live-account': '/live-account',
  'demo-account': '/demo-account',
  violations: '/violations',
  revenue: '/revenue',
  'purchase-history': '/purchase-history',
  'transaction-history': '/transaction-history',
  'transaction-approval': '/transaction-approval',
  'asset-settlement': '/asset-settlement',
  'notice-list': '/notice-list',
  'marketing-popup': '/marketing-popup',
  'reward-referral': '/reward-referral',
  'coupon-management': '/coupon-management',
  'demo-option-management': '/demo-option-management',
  inquiry: '/inquiry',
  faq: '/faq',
  'email-notification': '/email-notification',
  'profit-split-settings': '/profit-split-settings',
  // 출시 시점 제외 faq, inquiry, review, promotions
  // faq: '/faq',
  // inquiry: '/inquiry',
  // reviews: '/reviews',
  // promotions: '/promotions',
  'system-settings': '/system-settings',
  'supported-languages': '/system-settings/supported-languages',
};

export type PageId = keyof typeof ROUTE_BY_PAGE_ID;

export const DEFAULT_APP_ROUTE = ROUTE_BY_PAGE_ID[DEFAULT_PAGE_ID];

export const PAGE_ID_BY_ROUTE = Object.fromEntries(
  Object.entries(ROUTE_BY_PAGE_ID).map(([pageId, path]) => [path, pageId]),
) as Record<string, string>;

const MEMBER_DETAIL_ROUTE_RE = /^\/member-list\/([^/]+)$/;

export function getMemberDetailRoute(memberId: number | string) {
  return `/member-list/${encodeURIComponent(String(memberId))}`;
}

export function getPageIdFromPath(pathname: string) {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (MEMBER_DETAIL_ROUTE_RE.test(normalized)) return 'member-detail';
  return PAGE_ID_BY_ROUTE[normalized] ?? DEFAULT_PAGE_ID;
}
