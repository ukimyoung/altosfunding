import { Fragment, createElement, useEffect } from 'react';
import { Navigate, Outlet, createBrowserRouter, useLocation } from 'react-router';
import { RootLayout } from './layouts/RootLayout';
import { SignUpLayout } from './layouts/SignUpLayout';
import { Home } from './pages/Home';
import { SignUp } from './pages/auth/SignUp';
import { SignUpStep2 } from './pages/auth/SignUpStep2';
import { SignUpStep3 } from './pages/auth/SignUpStep3';
import { Login } from './pages/auth/Login';
import { LoginTwoFactor } from './pages/auth/LoginTwoFactor';
import { MyPage } from './pages/mypage/MyPage';
import { EditProfilePage } from './pages/mypage/EditProfilePage';
import { LandingLayout } from './layouts/LadingLayout';
import { DisclaimerPage } from './pages/legal/DisclaimerPage';
import { PrivacyPolicyPage } from './pages/legal/PrivacyPolicyPage';
import { TermsPage } from './pages/legal/TermsPage';
import { HelpCenterPage } from './pages/help/HelpCenterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ForgotPasswordSuccessPage } from './pages/auth/ForgotPasswordSuccessPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { AboutUsPage } from './pages/AboutUsPage';
import { NotFoundPage } from './pages/NotFoundPage';

function MyPageIndexRedirect() {
  return Navigate({ to: '/my-page/start-new-challenge', replace: true });
}

function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      return;
    }

    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname, hash]);

  return null;
}

function AppRouteLayout() {
  return createElement(Fragment, null, createElement(ScrollToTop), createElement(Outlet));
}

export const router = createBrowserRouter([
  {
    Component: AppRouteLayout,
    children: [
      {
        path: '/',
        Component: LandingLayout,
        children: [
          {
            index: true,
            Component: Home,
          },
        ],
      },
      {
        path: '/signup',
        Component: SignUpLayout,
        children: [
          {
            index: true,
            Component: SignUp,
          },
          {
            path: 'step-2',
            Component: SignUpStep2,
          },
          {
            path: 'step-3',
            Component: SignUpStep3,
          },
        ],
      },
      {
        path: '/login',
        Component: SignUpLayout,
        children: [
          {
            index: true,
            Component: Login,
          },
          {
            path: '2fa',
            Component: LoginTwoFactor,
          },
        ],
      },
      {
        path: '/my-page',
        Component: RootLayout,
        children: [
          {
            index: true,
            Component: MyPageIndexRedirect,
          },
          {
            path: '*',
            Component: MyPage,
          },
        ],
      },
      {
        path: '/edit-profile',
        Component: RootLayout,
        children: [
          {
            index: true,
            Component: EditProfilePage,
          },
        ],
      },
      {
        path: '/help-center',
        Component: HelpCenterPage,
      },
      {
        path: '/help-center/:slug',
        Component: HelpCenterPage,
      },
      {
        path: '/about-us',
        Component: AboutUsPage,
      },
      {
        path: '/disclaimer',
        Component: DisclaimerPage,
      },
      {
        path: '/privacy-policy',
        Component: PrivacyPolicyPage,
      },
      {
        path: '/terms',
        Component: TermsPage,
      },
      {
        path: '/terms-of-service',
        Component: TermsPage,
      },
      {
        path: '/forgot-password',
        Component: SignUpLayout,
        children: [
          {
            index: true,
            Component: ForgotPasswordPage,
          },
        ],
      },
      {
        path: '/forgot-password/success',
        Component: SignUpLayout,
        children: [
          {
            index: true,
            Component: ForgotPasswordSuccessPage,
          },
        ],
      },
      {
        path: '/reset-password',
        Component: SignUpLayout,
        children: [
          {
            index: true,
            Component: ResetPasswordPage,
          },
        ],
      },
      {
        path: '*',
        Component: NotFoundPage,
      },
    ],
  },
]);
