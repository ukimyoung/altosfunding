import { AppBrand } from '../../components/shared/AppBrand';
import { SecurityPage } from './SecurityPage';
import { KYCPage } from './KYCPage';
import { DownloadPlatformPage } from './DownloadPlatformPage';
import { AnnouncementsPage } from './AnnouncementsPage';
import { AnnouncementDetailPage } from './AnnouncementDetailPage';
import { ContactUsPage } from './ContactUsPage';
import { MyAccountPage } from './MyAccountPage';
import { MyAssetPage } from './MyAssetPage';
import { RewardDashboardPage } from './RewardDashboardPage';
import { FundedAccountPage } from './FundedAccountPage';
import { ReferralPage } from './ReferralPage';
import { PurchaseHistoryPage } from './PurchaseHistoryPage';
import { StartNewChallengePage } from './StartNewChallengePage';
import { ChallengeAccountPage } from './ChallengeAccountPage';
import { Link, useLocation, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { useMediaQuery } from 'usehooks-ts';
import { useLogoutMutation } from '@/app/queries/auth';
// 현재 MyPage 레이아웃에서는 자산 요약값을 렌더링하지 않음.
// 사용하지 않는 my-asset 중복 호출을 막기 위해 이 쿼리는 비활성 상태로 둔다.
// import { useAssetSummaryQuery } from '@/app/queries/assets';
import { useMeQuery } from '@/app/queries/profile';
import {
  Home,
  TrendingUp,
  Trophy,
  Award,
  ShoppingCart,
  User,
  Download,
  Bell,
  HelpCircle,
  MessageSquare,
  Check,
  ChevronRight,
  ChevronDown,
  DollarSign,
  Activity,
  Target,
  Clock,
  Menu,
  Gift,
  ChevronUp,
  Globe,
  LogOut,
  SearchX,
} from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import axios from 'axios';
import { clearGoogleAuthInProgress } from '@/app/utils/auth/googleAuth';
import { useLocale } from '@/app/i18n/LocaleContext';
import { useContentLanguagesQuery } from '@/app/queries/support';
import { DEFAULT_LANGUAGE_OPTIONS, getDisplayLanguageOptions } from '@/app/i18n/languageOptions';

type SubMenuItem = {
  id: string;
  label: string;
  path: string;
};

type MenuItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  subItems?: SubMenuItem[];
};

const getUserDisplayName = (me: { first_name?: string; last_name?: string } | null | undefined) => {
  if (!me) {
    return '-';
  }

  return [me.first_name, me.last_name].filter(Boolean).join(' ') || '-';
};

// MyPage에서 잔액 요약을 다시 노출할 때만 필요한 포맷 함수.
// const formatUsd = (value: number) =>
//   `$${value.toLocaleString('en-US', {
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2,
//   })}`;

export function MyPage() {
  const [activeMenu, setActiveMenu] = useState('home');
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [hasAvatarImageError, setHasAvatarImageError] = useState(false);
  const [isUnknownMyPagePath, setIsUnknownMyPagePath] = useState(false);
  const { locale, setLocale, T } = useLocale();
  const text = T.dashboard;
  const { data: me, error: meError, isLoading: isLoadingMe } = useMeQuery();
  const { data: contentLanguages } = useContentLanguagesQuery();
  // 자산/이체/라이브 계좌 금액은 MyAssetPage에서 사용한다.
  // MyPage에서는 현재 사용하지 않으므로 불필요한 조회를 막기 위해 주석 처리한다.
  // const { data: assetSummary, isLoading: isAssetSummaryLoading } = useAssetSummaryQuery();
  const { mutateAsync: performLogout, isPending: isLoggingOut } = useLogoutMutation();
  const userDisplayName = getUserDisplayName(me);
  const shouldShowAvatarImage = !!me?.avatar_url && !hasAvatarImageError;
  // const accountBalanceText = isAssetSummaryLoading
  //   ? 'Loading...'
  //   : formatUsd(assetSummary?.total_balance ?? 0);
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const myPageLanguages = useMemo(
    () => getDisplayLanguageOptions(contentLanguages),
    [contentLanguages],
  );
  const currentLanguage =
    myPageLanguages.find((language) => language.code === locale) ?? DEFAULT_LANGUAGE_OPTIONS[0];

  const menuItems: MenuItem[] = [
    // Home 화면 주석처리
    // { id: 'home', label: 'Home', icon: <Home size={20} />, path: '/my-page' },
    {
      id: 'new-challenge',
      label: text.nav.newChallenge,
      icon: <TrendingUp size={20} />,
      path: '/my-page/start-new-challenge',
    },
    {
      id: 'challenge',
      label: text.nav.challenge,
      icon: <Trophy size={20} />,
      path: '/my-page/challenge',
    },
    {
      id: 'funded',
      label: text.nav.funded,
      icon: <Award size={20} />,
      path: '/my-page/funded',
    },
    {
      id: 'purchase-history',
      label: text.nav.purchaseHistory,
      icon: <ShoppingCart size={20} />,
      path: '/my-page/purchase-history',
    },
    {
      id: 'reward-center',
      label: text.nav.reward,
      icon: <Gift size={20} />,
      path: '/my-page/reward',
      subItems: [
        { id: 'reward-dashboard', label: text.nav.rewardSub, path: '/my-page/reward' },
        { id: 'referral', label: text.nav.referral, path: '/my-page/referral' },
      ],
    },
    {
      id: 'my-profile',
      label: text.nav.myProfile,
      icon: <User size={20} />,
      path: '/my-page/my-profile',
      subItems: [
        { id: 'my-account', label: text.nav.myAccount, path: '/my-page/my-account' },
        { id: 'my-asset', label: text.nav.myAsset, path: '/my-page/my-asset' },
        { id: 'security', label: text.nav.security, path: '/my-page/security' },
        { id: 'kyc', label: text.nav.kyc, path: '/my-page/kyc' },
      ],
    },
    {
      id: 'announcements',
      label: text.nav.announcements,
      icon: <Bell size={20} />,
      path: '/my-page/announcements',
    },
    {
      id: 'download-platform',
      label: text.nav.downloadPlatform,
      icon: <Download size={20} />,
      path: '/my-page/download-platform',
    },
    {
      id: 'help-center',
      label: text.nav.helpCenter,
      icon: <HelpCircle size={20} />,
      path: '/help-center',
    },
    {
      id: 'contact-us',
      label: text.nav.contactUs,
      icon: <MessageSquare size={20} />,
      path: '/my-page/contact-us',
    },
  ];

  const toggleExpanded = (menuId: string) => {
    setExpandedMenus((prev) =>
      prev.includes(menuId) ? prev.filter((id) => id !== menuId) : [...prev, menuId],
    );
  };

  const handleMenuClick = (menuId: string, path: string, hasSubItems: boolean) => {
    if (hasSubItems) {
      toggleExpanded(menuId);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      navigate({ pathname: path, search: '' });
      setIsMobileSidebarOpen(false);
    }
  };

  const handleSubMenuClick = (menuId: string, path: string) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    navigate({ pathname: path, search: '' });
    setIsMobileSidebarOpen(false);
  };

  const location = useLocation();
  const navigate = useNavigate();
  const meErrorMessage = axios.isAxiosError(meError)
    ? meError.response?.status === 401
      ? ''
      : meError.message
    : meError instanceof Error
      ? meError.message
      : '';

  useEffect(() => {
    if (!me) {
      return;
    }

    clearGoogleAuthInProgress();

    const searchParams = new URLSearchParams(location.search);

    if (!searchParams.has('login_success')) {
      return;
    }

    searchParams.delete('login_success');

    navigate(
      {
        pathname: location.pathname,
        search: searchParams.toString(),
      },
      { replace: true },
    );
  }, [location.pathname, location.search, me, navigate]);

  useEffect(() => {
    if (!meError) {
      return;
    }

    if (axios.isAxiosError(meError) && meError.response?.status === 401) {
      navigate('/login', { replace: true });
    }
  }, [meError, navigate]);

  useEffect(() => {
    setHasAvatarImageError(false);
  }, [me?.avatar_url]);

  // Map URLs to menu IDs
  useEffect(() => {
    const pathToMenuMap: Record<string, string> = {
      '/my-page': 'home',
      '/my-page/start-new-challenge': 'new-challenge',
      '/my-page/challenge': 'challenge',
      '/my-page/funded': 'funded',
      '/my-page/purchase-history': 'purchase-history',
      '/my-page/reward': 'reward-dashboard',
      '/my-page/referral': 'referral',
      '/my-page/my-profile': 'my-account',
      '/my-page/my-account': 'my-account',
      '/my-page/my-asset': 'my-asset',
      '/my-page/security': 'security',
      '/my-page/kyc': 'kyc',
      '/my-page/announcements': 'announcements',
      '/my-page/download-platform': 'download-platform',
      '/help-center': 'help-center',
      '/my-page/contact-us': 'contact-us',
    };

    const currentPath = location.pathname;
    const menuId =
      pathToMenuMap[currentPath] ??
      (currentPath.startsWith('/my-page/funded/')
        ? 'funded'
        : currentPath.match(/^\/my-page\/announcements\/\d+$/)
          ? 'announcements'
          : '');

    setIsUnknownMyPagePath(!menuId);

    if (menuId) {
      setActiveMenu(menuId);
      setIsMobileSidebarOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Auto-expand parent menu if it's a submenu item
      if (['my-account', 'my-asset', 'security', 'kyc'].includes(menuId)) {
        setExpandedMenus((prev) => (prev.includes('my-profile') ? prev : [...prev, 'my-profile']));
      } else if (['reward-dashboard', 'referral'].includes(menuId)) {
        setExpandedMenus((prev) =>
          prev.includes('reward-center') ? prev : [...prev, 'reward-center'],
        );
      }
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobile) {
      document.body.style.overflow = '';
      return;
    }

    document.body.style.overflow = isMobileSidebarOpen ? 'hidden' : '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobile, isMobileSidebarOpen]);

  useEffect(() => {
    if (!isMobile) {
      setShowScrollToTop(false);
      return;
    }

    const handleScroll = () => {
      setShowScrollToTop(window.scrollY > 320);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isMobile]);

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    try {
      await performLogout();
    } catch (error) {
      console.error('Failed to logout:', error);
    } finally {
      setIsMobileSidebarOpen(false);
      navigate('/login', { replace: true });
    }
  };

  const getTopBarTitle = () => {
    if (isUnknownMyPagePath) {
      return T.notFound.title;
    }

    switch (activeMenu) {
      case 'my-account':
        return text.topBar.titles.myAccount;
      case 'my-asset':
        return text.topBar.titles.myAsset;
      case 'security':
        return text.topBar.titles.security;
      case 'kyc':
        return text.topBar.titles.kyc;
      case 'reward-dashboard':
        return text.topBar.titles.rewardDashboard;
      case 'referral':
        return text.topBar.titles.referral;
      case 'purchase-history':
        return text.topBar.titles.purchaseHistory;
      case 'new-challenge':
        return text.topBar.titles.newChallenge;
      case 'challenge':
        return text.topBar.titles.alphaAccount;
      case 'funded':
        return text.topBar.titles.omegaAccount;
      case 'announcements':
        return text.topBar.titles.announcements;
      case 'download-platform':
        return text.topBar.titles.downloadPlatform;
      case 'contact-us':
        return text.topBar.titles.contactUs;
      default:
        return text.topBar.titles.home;
    }
  };

  const getTopBarSubtitle = () => {
    if (isUnknownMyPagePath) {
      return T.notFound.description;
    }

    switch (activeMenu) {
      case 'my-account':
        return text.topBar.subtitles.myAccount;
      case 'my-asset':
        return text.topBar.subtitles.myAsset;
      case 'security':
        return text.topBar.subtitles.security;
      case 'kyc':
        return text.topBar.subtitles.kyc;
      case 'reward-dashboard':
        return text.topBar.subtitles.rewardDashboard;
      case 'referral':
        return text.topBar.subtitles.referral;
      case 'purchase-history':
        return text.topBar.subtitles.purchaseHistory;
      case 'new-challenge':
        return text.topBar.subtitles.newChallenge;
      case 'challenge':
        return text.topBar.subtitles.alphaAccount;
      case 'funded':
        return text.topBar.subtitles.omegaAccount;
      case 'announcements':
        return text.topBar.subtitles.announcements;
      case 'download-platform':
        return text.topBar.subtitles.downloadPlatform;
      case 'contact-us':
        return text.topBar.subtitles.contactUs;
      default:
        return text.topBar.subtitles.home.replace('John', userDisplayName);
    }
  };

  return (
    <div className="min-h-screen bg-[#16161f] flex">
      {/* Mobile Overlay (when sidebar is open on mobile) */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Fixed Left Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          x: isMobile ? (isMobileSidebarOpen ? 0 : -256) : 0,
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="bg-[#0a0a12] border-r border-white/25 fixed top-0 left-0 h-screen w-64 flex flex-col overflow-y-auto z-40 shadow-[4px_0_24px_0_rgba(0,0,0,0.4)]"
      >
        <div className="p-4 border-b border-gray-400/10 bg-[#0a0a12]">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <AppBrand
              logoWrapClassName="w-8 h-8 flex-shrink-0"
              imageClassName="w-8 h-8 object-contain brightness-0 invert"
              textClassName="text-lg text-white font-medium whitespace-nowrap overflow-hidden text-ellipsis"
            />
          </Link>
        </div>

        {/* Navigation Menu */}
        {/* 가로 스크롤 삭제위해 overflow-y-auto 제거 > 문제 생기면 추가*/}
        <nav className="flex-1 py-6 px-3">
          <ul className="space-y-1">
            {menuItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => handleMenuClick(item.id, item.path, !!item.subItems)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all relative ${
                    activeMenu === item.id
                      ? 'bg-[#0052FF] text-white shadow-lg shadow-[#0052FF]/20'
                      : 'text-gray-400 hover:text-white hover:bg-[#1a1a24]'
                  }`}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  <span className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                    {item.label}
                  </span>
                  {item.subItems &&
                    (expandedMenus.includes(item.id) ? (
                      <ChevronDown size={16} className="ml-auto flex-shrink-0" />
                    ) : (
                      <ChevronRight size={16} className="ml-auto flex-shrink-0" />
                    ))}
                  {!item.subItems && activeMenu === item.id && (
                    <ChevronRight size={16} className="ml-auto flex-shrink-0" />
                  )}
                </button>
                {item.subItems && expandedMenus.includes(item.id) && (
                  <motion.ul
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-1 space-y-1 relative"
                  >
                    {/* Vertical connector line */}
                    <div className="absolute left-[28px] top-0 bottom-0 w-px bg-gradient-to-b from-[#2a2a3a] via-[#2a2a3a] to-transparent"></div>

                    {item.subItems.map((subItem, index) => (
                      <li key={subItem.id} className="relative">
                        {/* L-shaped connector */}
                        <div className="absolute left-[28px] top-[18px] w-[16px] h-px bg-[#2a2a3a]"></div>

                        <button
                          onClick={() => handleSubMenuClick(subItem.id, subItem.path)}
                          className={`w-full flex items-center gap-3 pl-[52px] pr-4 py-2.5 rounded-lg text-[13px] font-normal transition-all relative ${
                            activeMenu === subItem.id
                              ? 'bg-[#0052FF]/20 text-white'
                              : 'text-gray-500 hover:text-white hover:bg-[#1a1a24]'
                          }`}
                        >
                          {/* Active indicator dot */}
                          {activeMenu === subItem.id && (
                            <div className="absolute left-[24px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#0052FF]"></div>
                          )}

                          <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                            {subItem.label}
                          </span>

                          {/* Active chevron */}
                          {activeMenu === subItem.id && (
                            <ChevronRight
                              size={14}
                              className="ml-auto flex-shrink-0 text-[#0052FF]"
                            />
                          )}
                        </button>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* Language Selector */}
        <div className="border-t border-[#1a1a24] px-3 py-3">
          <div className="relative">
            <p className="text-gray-500 text-[11px] uppercase tracking-widest mb-2 px-1 select-none">
              {text.sidebar.language}
            </p>
            <button
              type="button"
              onClick={() => setShowLangMenu((value) => !value)}
              onBlur={() => setTimeout(() => setShowLangMenu(false), 120)}
              aria-haspopup="listbox"
              aria-expanded={showLangMenu}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all text-left ${
                showLangMenu
                  ? 'bg-[#0f0f1a] border-[#0052FF]/60 shadow-sm shadow-[#0052FF]/20'
                  : 'bg-[#12121a] border-[#2a2a3a] hover:border-[#0052FF]/40 hover:bg-[#0f0f1a]'
              }`}
            >
              <Globe size={14} className="text-gray-400 shrink-0" />
              <span className="text-base leading-none shrink-0 text-gray-100">{currentLanguage.flag}</span>
              <span className="flex-1 text-sm text-white font-medium truncate">
                {currentLanguage.name}
              </span>
              <ChevronDown
                size={13}
                className={`text-gray-400 shrink-0 transition-transform duration-200 ${
                  showLangMenu ? 'rotate-180' : ''
                }`}
              />
            </button>

            <AnimatePresence>
              {showLangMenu && (
                <motion.ul
                  role="listbox"
                  aria-label={text.sidebar.language}
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute bottom-full left-0 right-0 mb-1.5 bg-[#0d0d18] border border-[#2a2a3a] rounded-xl shadow-2xl shadow-black/60 overflow-y-auto max-h-60 z-[60] py-1"
                >
                  {myPageLanguages.map((language) => {
                    const selected = locale === language.code;

                    return (
                      <li key={language.code} role="option" aria-selected={selected}>
                        <button
                          type="button"
                          onMouseDown={() => {
                            setLocale(language.code);
                            setShowLangMenu(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left ${
                            selected
                              ? 'bg-[#0052FF]/15 text-white'
                              : 'text-gray-300 hover:bg-[#1a1a28] hover:text-white'
                          }`}
                        >
                          <span className="text-base leading-none shrink-0 text-gray-100">{language.flag}</span>
                          <span className="flex-1 text-sm font-medium">{language.name}</span>
                          <span className="text-xs text-gray-500 shrink-0">{language.short}</span>
                          {selected && <Check size={13} className="text-[#0052FF] shrink-0" />}
                        </button>
                      </li>
                    );
                  })}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* User Section */}
        <div className="p-4 border-t border-[#1a1a24]">
          <div
            className="flex items-center gap-3 px-3 py-2 cursor-pointer"
            onClick={() => handleMenuClick('my-account', '/my-page/my-account', false)}
          >
            {isLoadingMe ? (
              <div className="w-10 h-10 rounded-full bg-[#1a1a24] animate-pulse flex-shrink-0" />
            ) : shouldShowAvatarImage ? (
              <img
                src={me.avatar_url}
                alt={userDisplayName}
                onError={() => setHasAvatarImageError(true)}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0052FF] to-[#00FF94] flex items-center justify-center text-white font-medium flex-shrink-0">
                {userDisplayName[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{userDisplayName}</p>
              <p className="text-gray-500 text-xs truncate">
                {meErrorMessage || me?.email || 'Loading...'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="mt-2 flex w-full items-center justify-center gap-3 px-3 py-2 text-gray-400 hover:text-gray-300 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut size={15} strokeWidth={1.8} className="flex-shrink-0" />
            <span className="text-xs tracking-[0.1em]">
              {isLoggingOut ? text.sidebar.loggingOut : text.sidebar.logOut}
            </span>
          </button>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <motion.main
        initial={false}
        // 모바일에서 사이드바가 닫혀있을 경우 marginLeft 0으로 설정
        animate={{
          marginLeft: isMobile ? 0 : '256px',
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="flex-1 w-full"
      >
        {/* Top Bar */}
        <div className="bg-[#0f0f17] border-b border-[#1a1a24] px-4 sm:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden w-10 h-10 flex items-center justify-center rounded-lg bg-[#0052FF] text-white hover:bg-[#0052FF]/90 transition-colors mr-4"
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>

            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl text-white font-medium">{getTopBarTitle()}</h1>
              <p className="text-gray-400 text-sm mt-1">{getTopBarSubtitle()}</p>
            </div>
          </div>
        </div>

        {/* Conditional Content Rendering */}
        {isUnknownMyPagePath ? (
          <div className="flex min-h-[calc(100vh-73px)] items-center justify-center p-8">
            <section className="w-full max-w-xl text-center">
              <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl border border-[#2a2a3a] bg-[#0f0f17] sm:mb-8 sm:h-16 sm:w-16">
                <SearchX size={30} className="text-[#00FF94] sm:h-8 sm:w-8" />
              </div>
              <p className="mb-3 text-sm font-semibold tracking-[0.18em] text-[#00FF94]">
                {T.notFound.code}
              </p>
              <h2 className="mx-auto mb-4 max-w-[18rem] text-3xl font-bold leading-tight text-white [word-break:keep-all] sm:max-w-none sm:text-5xl">
                {T.notFound.title}
              </h2>
              <p className="mx-auto max-w-sm text-sm leading-6 text-gray-400 [word-break:keep-all] sm:max-w-md sm:text-base">
                {T.notFound.description}
              </p>
            </section>
          </div>
        ) : activeMenu === 'my-account' ? (
          <MyAccountPage />
        ) : activeMenu === 'my-asset' ? (
          <MyAssetPage />
        ) : activeMenu === 'security' ? (
          <SecurityPage />
        ) : activeMenu === 'kyc' ? (
          <KYCPage />
        ) : activeMenu === 'download-platform' ? (
          <DownloadPlatformPage />
        ) : activeMenu === 'announcements' ? (
          location.pathname.match(/^\/my-page\/announcements\/\d+$/) ? (
            <AnnouncementDetailPage />
          ) : (
            <AnnouncementsPage />
          )
        ) : activeMenu === 'contact-us' ? (
          <ContactUsPage />
        ) : activeMenu === 'reward-dashboard' ? (
          <RewardDashboardPage />
        ) : activeMenu === 'referral' ? (
          <ReferralPage />
        ) : activeMenu === 'purchase-history' ? (
          <PurchaseHistoryPage />
        ) : activeMenu === 'new-challenge' ? (
          <StartNewChallengePage />
        ) : activeMenu === 'challenge' ? (
          <ChallengeAccountPage />
        ) : activeMenu === 'funded' ? (
          <FundedAccountPage />
        ) : (
          /* Dashboard Content */
          <div className="p-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0 }}
                className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl p-6 hover:border-[#0052FF]/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-[#0052FF]/10 flex items-center justify-center">
                    <DollarSign size={24} className="text-[#0052FF]" />
                  </div>
                  <span className="text-[#00FF94] text-xs font-medium px-2 py-1 bg-[#00FF94]/10 rounded">
                    +12.5%
                  </span>
                </div>
                <h3 className="text-gray-400 text-sm mb-1">Total Profit</h3>
                <p className="text-white text-2xl font-medium">$3,240</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl p-6 hover:border-[#0052FF]/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-[#00FF94]/10 flex items-center justify-center">
                    <Activity size={24} className="text-[#00FF94]" />
                  </div>
                  <span className="text-[#00FF94] text-xs font-medium px-2 py-1 bg-[#00FF94]/10 rounded">
                    Active
                  </span>
                </div>
                <h3 className="text-gray-400 text-sm mb-1">Win Rate</h3>
                <p className="text-white text-2xl font-medium">68.5%</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl p-6 hover:border-[#0052FF]/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-[#FFB800]/10 flex items-center justify-center">
                    <Target size={24} className="text-[#FFB800]" />
                  </div>
                  <span className="text-gray-400 text-xs font-medium px-2 py-1 bg-[#1a1a24] rounded">
                    12/20
                  </span>
                </div>
                <h3 className="text-gray-400 text-sm mb-1">Challenge Progress</h3>
                <p className="text-white text-2xl font-medium">60%</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
                className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl p-6 hover:border-[#0052FF]/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Clock size={24} className="text-purple-400" />
                  </div>
                  <span className="text-gray-400 text-xs font-medium px-2 py-1 bg-[#1a1a24] rounded">
                    15 days
                  </span>
                </div>
                <h3 className="text-gray-400 text-sm mb-1">Time Remaining</h3>
                <p className="text-white text-2xl font-medium">15d 6h</p>
              </motion.div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Activity */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.4 }}
                className="lg:col-span-2 bg-[#0f0f17] border border-[#1a1a24] rounded-xl p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-white text-lg font-medium">Recent Activity</h2>
                  <button className="text-[#0052FF] text-sm hover:text-[#0052FF]/80 transition-colors">
                    View All
                  </button>
                </div>

                <div className="space-y-4">
                  {[
                    {
                      action: 'Trade Closed',
                      pair: 'EUR/USD',
                      profit: '+$125.50',
                      time: '2 hours ago',
                      positive: true,
                    },
                    {
                      action: 'Trade Closed',
                      pair: 'GBP/USD',
                      profit: '-$45.20',
                      time: '5 hours ago',
                      positive: false,
                    },
                    {
                      action: 'Trade Opened',
                      pair: 'USD/JPY',
                      profit: 'Pending',
                      time: '1 day ago',
                      positive: null,
                    },
                    {
                      action: 'Trade Closed',
                      pair: 'AUD/USD',
                      profit: '+$89.00',
                      time: '1 day ago',
                      positive: true,
                    },
                    {
                      action: 'Payout Processed',
                      pair: 'Withdrawal',
                      profit: '+$500.00',
                      time: '2 days ago',
                      positive: true,
                    },
                  ].map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-[#1a1a24] rounded-lg hover:bg-[#1a1a24]/70 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            item.positive === null
                              ? 'bg-gray-500/10'
                              : item.positive
                                ? 'bg-[#00FF94]/10'
                                : 'bg-red-500/10'
                          }`}
                        >
                          <Activity
                            size={18}
                            className={
                              item.positive === null
                                ? 'text-gray-400'
                                : item.positive
                                  ? 'text-[#00FF94]'
                                  : 'text-red-400'
                            }
                          />
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{item.action}</p>
                          <p className="text-gray-400 text-xs mt-0.5">{item.pair}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-sm font-medium ${
                            item.positive === null
                              ? 'text-gray-400'
                              : item.positive
                                ? 'text-[#00FF94]'
                                : 'text-red-400'
                          }`}
                        >
                          {item.profit}
                        </p>
                        <p className="text-gray-500 text-xs mt-0.5">{item.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Quick Actions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.5 }}
                className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl p-6"
              >
                <h2 className="text-white text-lg font-medium mb-6">Quick Actions</h2>

                <div className="space-y-3">
                  <button className="w-full px-4 py-3 bg-gradient-to-r from-[#0052FF] to-[#0052FF]/80 text-white rounded-lg hover:shadow-lg hover:shadow-[#0052FF]/30 transition-all text-sm font-medium">
                    Start New Challenge
                  </button>
                  <button className="w-full px-4 py-3 bg-[#1a1a24] text-white rounded-lg hover:bg-[#2a2a3a] transition-colors text-sm font-medium">
                    Download MT4
                  </button>
                  <button className="w-full px-4 py-3 bg-[#1a1a24] text-white rounded-lg hover:bg-[#2a2a3a] transition-colors text-sm font-medium">
                    Request Payout
                  </button>
                  <button className="w-full px-4 py-3 bg-[#1a1a24] text-white rounded-lg hover:bg-[#2a2a3a] transition-colors text-sm font-medium">
                    View Rules
                  </button>
                </div>

                <div className="mt-6 pt-6 border-t border-[#1a1a24]">
                  <h3 className="text-white text-sm font-medium mb-4">Account Details</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-xs">Account Type</span>
                      <span className="text-white text-sm font-medium">$25K Challenge</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-xs">Profit Target</span>
                      <span className="text-white text-sm font-medium">$2,500</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-xs">Max Drawdown</span>
                      <span className="text-white text-sm font-medium">$2,000</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-xs">Status</span>
                      <span className="text-[#00FF94] text-sm font-medium flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#00FF94]"></span>
                        Active
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Progress Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.6 }}
              className="mt-6 bg-[#0f0f17] border border-[#1a1a24] rounded-xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white text-lg font-medium">Challenge Progress</h2>
                <span className="text-gray-400 text-sm">12 of 20 trading days</span>
              </div>

              <div className="relative">
                <div className="h-3 bg-[#1a1a24] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '60%' }}
                    transition={{ duration: 1, delay: 0.7 }}
                    className="h-full bg-gradient-to-r from-[#0052FF] to-[#00FF94] rounded-full"
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-gray-400 text-xs">Start</span>
                  <span className="text-[#00FF94] text-xs font-medium">60% Complete</span>
                  <span className="text-gray-400 text-xs">Target</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="text-center">
                  <p className="text-gray-400 text-xs mb-1">Starting Balance</p>
                  <p className="text-white text-lg font-medium">$25,000</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 text-xs mb-1">Current Balance</p>
                  <p className="text-[#00FF94] text-lg font-medium">$28,240</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 text-xs mb-1">Profit Target</p>
                  <p className="text-white text-lg font-medium">$27,500</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </motion.main>

      <AnimatePresence>
        {isMobile && showScrollToTop && !isMobileSidebarOpen && (
          <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2 }}
            onClick={handleScrollToTop}
            className="fixed right-4 bottom-4 z-30 lg:hidden w-12 h-12 rounded-full bg-[#0052FF] text-white shadow-[0_12px_30px_rgba(0,82,255,0.35)] hover:bg-[#0047db] transition-colors flex items-center justify-center"
            aria-label="Scroll to top"
          >
            <ChevronUp size={22} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

