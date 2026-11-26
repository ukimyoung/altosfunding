import { useEffect, useState } from 'react';
import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';
import { useLoginMutation } from '@/app/queries/auth';
import { useMeQuery } from '@/app/queries/profile';
import { AppBrand } from '../../components/shared/AppBrand';
import { LanguageSelector } from '../../components/shared/LanguageSelector';
import { Toast } from '../../components/shared/Toast';
import { ImageWithFallback } from '../../components/shared/figma/ImageWithFallback';
import { Link, useLocation, useNavigate } from 'react-router';
import {
  clearGoogleAuthInProgress,
  navigateToGoogleAuth,
} from '../../utils/auth/googleAuth';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import {
  getApiErrorCode,
  getApiErrorData,
  getApiErrorMessage,
} from '@altosfunding/shared/api/errors';
import { useLocale } from '@/app/i18n/LocaleContext';

type LoginLocationState = {
  toast?: {
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  };
};

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const { T } = useLocale();
  const text = T.login;
  const { data: me, isLoading: isCheckingSession } = useMeQuery();
  const { mutateAsync: submitLogin, isPending: isSubmitting } = useLoginMutation();
  const rememberedEmailKey = 'rememberedEmail';
  const rememberMeKey = 'rememberMeEnabled';
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loginToast, setLoginToast] = useState<LoginLocationState['toast'] | null>(null);
  const [showLoginToast, setShowLoginToast] = useState(false);
  const [formData, setFormData] = useState({
    email: localStorage.getItem(rememberedEmailKey) ?? '',
    password: '',
    rememberMe:
      localStorage.getItem(rememberMeKey) === 'true' ||
      Boolean(localStorage.getItem(rememberedEmailKey)),
  });

  const isLoginValid = formData.email.trim() !== '' && formData.password.trim() !== '';

  const getRecaptchaToken = async (action: string) => {
    if (!executeRecaptcha) {
      throw new Error(text.recaptchaNotReady);
    }

    const token = await executeRecaptcha(action);

    if (!token) {
      throw new Error(text.recaptchaFailed);
    }

    return token;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!isLoginValid) {
      return;
    }

    try {
      const recaptchaToken = await getRecaptchaToken('login');

      const loginResponse = await submitLogin({
        email: formData.email,
        password: formData.password,
        recaptcha_token: recaptchaToken,
      });

      if (formData.rememberMe) {
        localStorage.setItem(rememberedEmailKey, formData.email);
        localStorage.setItem(rememberMeKey, 'true');
      } else {
        localStorage.removeItem(rememberedEmailKey);
        localStorage.removeItem(rememberMeKey);
      }

      if (loginResponse.requires_2fa) {
        navigate('/login/2fa', { replace: true, state: { fromLogin: true } });
        return;
      }

      navigate('/my-page', { replace: true });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorCode = getApiErrorCode(error);

        // 제휴사 회원(Member ID) 로그인 분기
        if (errorCode === 'partner_activation_required') {
          const data = getApiErrorData<{ member_id?: string; masked_email?: string }>(error);
          navigate('/partner-activation', {
            state: {
              fromLogin: true,
              memberId: data?.member_id ?? formData.email.trim(),
              maskedEmail: data?.masked_email ?? '',
            },
          });
          return;
        }

        if (errorCode === 'partner_email_required') {
          window.alert(text.partnerEmailRequired);
          return;
        }

        if (errorCode === 'partner_use_member_id') {
          setErrorMessage(text.partnerUseMemberId);
          return;
        }

        if (errorCode === 'account_deactivated') {
          setErrorMessage(text.accountDeactivated);
          return;
        }

        if (error.response?.status === 404) {
          setErrorMessage(text.noAccountFound);
          return;
        }

        if (error.response?.status === 409) {
          const message =
            typeof error.response.data === 'object' &&
            error.response.data &&
            'message' in error.response.data &&
            typeof error.response.data.message === 'string'
              ? error.response.data.message
              : '';

          if (message.includes('2FA') && message.includes('/auth/2fa/login')) {
            navigate('/login/2fa', { replace: true, state: { fromLogin: true } });
            return;
          }

          setErrorMessage(text.incorrectPassword);
          return;
        }

        const message =
          typeof error.response?.data === 'object' &&
          error.response.data &&
          'message' in error.response.data &&
          typeof error.response.data.message === 'string'
            ? error.response.data.message
            : '';

        if (message.includes('2FA') && message.includes('/auth/2fa/login')) {
          navigate('/login/2fa', { replace: true, state: { fromLogin: true } });
          return;
        }
      }

      const message = getApiErrorMessage(error, text.loginFailed);
      setErrorMessage(message.includes('reCAPTCHA') ? message : text.loginFailed);
    }
  };

  const handleGoogleSignIn = () => {
    navigateToGoogleAuth();
  };

  useEffect(() => {
    clearGoogleAuthInProgress();

    const storedEmail = localStorage.getItem(rememberedEmailKey);
    const storedRememberMe = localStorage.getItem(rememberMeKey) === 'true';

    if (storedEmail) {
      setFormData((prev) => ({
        ...prev,
        email: storedEmail,
        rememberMe: true,
      }));
    } else if (storedRememberMe) {
      setFormData((prev) => ({
        ...prev,
        rememberMe: true,
      }));
    }
  }, []);

  useEffect(() => {
    const toast = (location.state as LoginLocationState | null)?.toast;

    if (!toast) {
      return;
    }

    setLoginToast(toast);
    setShowLoginToast(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (me) {
      navigate('/my-page', { replace: true });
    }
  }, [me, navigate]);

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-white">
        {text.checkingSession}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex">
      {loginToast && (
        <Toast
          type={loginToast.type}
          title={loginToast.title}
          message={loginToast.message}
          isVisible={showLoginToast}
          onClose={() => setShowLoginToast(false)}
          duration={5000}
          position="top"
        />
      )}

      {/* Left Side - 3D Visualization */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#0a0a0f] via-[#0a0a1f] to-[#0a0a0f]">
        {/* Logo */}
        <div className="absolute top-8 left-8 flex items-center gap-2 z-10">
          <Link to="/" className="flex items-center gap-2">
            <AppBrand />
          </Link>
        </div>

        {/* 3D Background */}
        <div className="absolute inset-0 flex items-center justify-center">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1693344047149-2eefd915ddfc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHwzRCUyMGdlb21ldHJpYyUyMGFic3RyYWN0JTIwZGFyayUyMGZpbnRlY2h8ZW58MXx8fHwxNzczMzA1MTA1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
            alt="3D Background"
            className="w-full h-full object-cover opacity-40"
          />
        </div>

        {/* Animated Spheres */}
        <motion.div
          animate={{
            y: [0, -30, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute top-1/4 left-1/4 w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 opacity-60 blur-xl"
        />
        <motion.div
          animate={{
            y: [0, 20, 0],
            x: [0, 10, 0],
            scale: [1, 1.15, 1],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.5,
          }}
          className="absolute top-1/2 left-1/3 w-32 h-32 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 opacity-50 blur-2xl"
        />
        <motion.div
          animate={{
            y: [0, -15, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 4.5,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 1,
          }}
          className="absolute bottom-1/3 right-1/3 w-28 h-28 rounded-full bg-gradient-to-br from-[#0052FF] to-[#00FF94] opacity-40 blur-2xl"
        />

        {/* Glowing bars effect */}
        <div className="absolute inset-0 flex items-center justify-center gap-8">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ height: 100 }}
              animate={{
                height: [100, 200 + Math.random() * 150, 100],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.2,
              }}
              className="w-12 bg-gradient-to-t from-[#1a1a2e] to-[#2a2a3e] rounded-t-lg"
              style={{
                boxShadow: '0 0 20px rgba(0, 82, 255, 0.3)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <div className="flex justify-end mb-6">
            <LanguageSelector />
          </div>

          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Link to="/" className="flex items-center gap-2">
              <AppBrand />
            </Link>
          </div>

          <h1 className="text-4xl text-white mb-8">{text.pageTitle}</h1>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Google Sign In */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full px-6 py-3 bg-white text-gray-800 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {text.signInWithGoogle}
            </button>

            {/* Divider */}
            <div className="relative flex items-center my-6">
              <div className="flex-1 border-t border-[#2a2a3a]"></div>
              <span className="px-4 text-sm text-gray-500">{text.orDivider}</span>
              <div className="flex-1 border-t border-[#2a2a3a]"></div>
            </div>

            {/* Email or Member ID (제휴사 회원은 Member ID로 로그인) */}
            <input
              type="text"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={text.placeholderEmail}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#0052FF] transition-colors"
              required
            />

            {/* Password */}
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="current-password"
                autoComplete="current-password"
                placeholder={text.placeholderPassword}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#0052FF] transition-colors"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={formData.rememberMe}
                  onChange={(e) => {
                    const checked = e.target.checked;

                    if (checked) {
                      localStorage.setItem(rememberMeKey, 'true');
                    } else {
                      localStorage.removeItem(rememberedEmailKey);
                      localStorage.removeItem(rememberMeKey);
                    }

                    setFormData({ ...formData, rememberMe: checked });
                  }}
                  className="w-4 h-4 bg-[#1a1a24] border border-[#2a2a3a] rounded accent-[#0052FF]"
                />
                <span className="text-sm text-gray-300">{text.rememberMe}</span>
              </label>
              <Link
                to="/forgot-password"
                className="text-sm text-[#FFB800] hover:text-[#FFC933] transition-colors"
              >
                {text.forgotPassword}
              </Link>
            </div>

            {errorMessage ? (
              <p className="text-sm text-red-400 text-center">{errorMessage}</p>
            ) : null}

            <p className="text-[11px] leading-5 text-gray-500 text-center">
              {text.recaptchaNoticePrefix}{' '}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                {text.privacyPolicy}
              </a>{' '}
              {text.recaptchaNoticeMiddle}{' '}
              <a
                href="https://policies.google.com/terms"
                target="_blank"
                rel="noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                {text.termsOfService}
              </a>{' '}
              {text.recaptchaNoticeSuffix}
            </p>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!isLoginValid || isSubmitting}
              className="w-full px-6 py-3 bg-gradient-to-r from-[#FFB800] via-[#0052FF] to-[#0052FF] text-white rounded-lg hover:shadow-lg hover:shadow-[#0052FF]/50 transition-all mt-6 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? text.signingIn : text.signInBtn}
            </button>

            {/* Sign Up Link */}
            <p className="text-center text-sm text-gray-400 mt-6">
              {text.noAccount}{' '}
              <Link to="/signup" className="text-[#FFB800] hover:text-[#FFC933] transition-colors">
                {text.signUp}
              </Link>
            </p>

            {/* 제휴사 회원 첫 이용 (계정 활성화) */}
            <p className="text-center text-sm text-gray-400 -mt-2">
              {text.partnerFirstTimePrompt}{' '}
              <Link
                to="/partner-activation"
                className="text-[#FFB800] hover:text-[#FFC933] transition-colors"
              >
                {text.partnerActivateLink}
              </Link>
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
