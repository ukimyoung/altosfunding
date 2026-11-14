import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useMeQuery } from '@/app/queries/profile';
import { AppBrand } from '../../components/shared/AppBrand';
import { ImageWithFallback } from '../../components/shared/figma/ImageWithFallback';
import { useSignUpFlow } from './SignUpFlowContext';
import { navigateToGoogleAuth } from '../../utils/auth/googleAuth';
import { useLocale } from '@/app/i18n/LocaleContext';
import { LanguageSelector } from '../../components/shared/LanguageSelector';

export function SignUp() {
  const navigate = useNavigate();
  const { T } = useLocale();
  const text = T.signup;
  const [searchParams] = useSearchParams();
  const { data: me, isLoading: isCheckingSession } = useMeQuery();
  const { step1Data, setStep1Data, referralCode, setReferralCode } = useSignUpFlow();
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordTooShort = step1Data.password.length > 0 && step1Data.password.length < 8;

  useEffect(() => {
    const referralFromUrl = searchParams.get('ref')?.trim() ?? '';

    if (referralFromUrl && referralFromUrl !== referralCode) {
      setReferralCode(referralFromUrl);
    }
  }, [referralCode, searchParams, setReferralCode]);

  const isStep1Valid =
    step1Data.email.trim() !== '' &&
    step1Data.password.length >= 8 &&
    step1Data.agreeToTerms;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isStep1Valid) {
      return;
    }

    navigate('/signup/step-2');
  };

  const handleGoogleSignIn = () => {
    navigateToGoogleAuth();
  };

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
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#0a0a0f] via-[#0a0a1f] to-[#0a0a0f]">
        <div className="absolute top-8 left-8 flex items-center gap-2 z-10">
          <Link to="/" className="flex items-center gap-2">
            <AppBrand />
          </Link>
        </div>

        <div className="absolute inset-0 flex items-center justify-center">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1693344047149-2eefd915ddfc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHwzRCUyMGdlb21ldHJpYyUyMGFic3RyYWN0JTIwZGFyayUyMGZpbnRlY2h8ZW58MXx8fHwxNzczMzA1MTA1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
            alt="3D Background"
            className="w-full h-full object-cover opacity-40"
          />
        </div>

        <motion.div
          animate={{ y: [0, -20, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full bg-gradient-to-br from-[#0052FF] to-[#00FF94] opacity-30 blur-3xl"
        />
        <motion.div
          animate={{ y: [0, 20, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute bottom-1/3 right-1/4 w-40 h-40 rounded-full bg-gradient-to-br from-[#00FF94] to-[#0052FF] opacity-20 blur-3xl"
        />
      </div>

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

          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Link to="/" className="flex items-center gap-2">
              <AppBrand />
            </Link>
          </div>

          <div className="flex items-center gap-2 mb-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#0052FF] flex items-center justify-center text-white text-sm border-2 border-[#0052FF]">
                1
              </div>
              <div className="w-12 h-0.5 bg-[#2a2a3a]" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#1a1a24] border border-[#2a2a3a] flex items-center justify-center text-gray-500 text-sm">
                2
              </div>
              <div className="w-12 h-0.5 bg-[#2a2a3a]" />
            </div>
            <div className="w-8 h-8 rounded-full bg-[#1a1a24] border border-[#2a2a3a] flex items-center justify-center text-gray-500 text-sm">
              3
            </div>
          </div>

          <h1 className="text-4xl text-white mb-8">{text.pageTitle}</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div className="relative flex items-center my-6">
              <div className="flex-1 border-t border-[#2a2a3a]" />
              <span className="px-4 text-sm text-gray-500">{text.orDivider}</span>
              <div className="flex-1 border-t border-[#2a2a3a]" />
            </div>

            <input
              type="email"
              placeholder={text.labelEmail}
              value={step1Data.email}
              onChange={(e) => setStep1Data({ ...step1Data, email: e.target.value })}
              className="w-full px-4 py-3 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#0052FF] transition-colors"
              required
            />

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="new-password"
                autoComplete="new-password"
                placeholder={text.labelPassword}
                value={step1Data.password}
                onChange={(e) => setStep1Data({ ...step1Data, password: e.target.value })}
                minLength={8}
                className={`w-full px-4 py-3 bg-[#1a1a24] border rounded-lg text-white placeholder-gray-500 focus:outline-none transition-colors ${
                  isPasswordTooShort
                    ? 'border-red-400 focus:border-red-400'
                    : 'border-[#2a2a3a] focus:border-[#0052FF]'
                }`}
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
            {isPasswordTooShort ? (
              <p className="text-sm text-red-400">{text.errPasswordLength}</p>
            ) : null}

            <div className="space-y-3">
              <label className="flex items-start gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={step1Data.agreeToTerms}
                  onChange={(e) => setStep1Data({ ...step1Data, agreeToTerms: e.target.checked })}
                  className="mt-1 w-4 h-4 bg-[#1a1a24] border border-[#2a2a3a] rounded accent-[#0052FF]"
                  required
                />
                <span className="text-sm text-gray-400">
                  {text.agreeToTermsPrefix}
                  <Link to="/terms" className="text-[#0052FF] hover:text-[#00FF94] transition-colors">
                    {text.termsLink}
                  </Link>
                  {text.agreeTermsConnector}
                  <Link
                    to="/privacy-policy"
                    className="text-[#0052FF] hover:text-[#00FF94] transition-colors"
                  >
                    {text.privacyLink}
                  </Link>
                  {text.agreeToTermsSuffix}
                </span>
              </label>

              <label className="flex items-start gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={step1Data.subscribeNewsletter}
                  onChange={(e) =>
                    setStep1Data({ ...step1Data, subscribeNewsletter: e.target.checked })
                  }
                  className="mt-1 w-4 h-4 bg-[#1a1a24] border border-[#2a2a3a] rounded accent-[#0052FF]"
                />
                <span className="text-sm text-gray-400">
                  {text.newsletterConsent}
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={!isStep1Valid}
              className={`w-full px-6 py-3 text-white rounded-lg transition-all mt-6 ${
                isStep1Valid
                  ? 'bg-gradient-to-r from-[#0052FF] to-[#00FF94] hover:shadow-lg hover:shadow-[#0052FF]/50'
                  : 'bg-[#2a2a3a] text-gray-500 cursor-not-allowed'
              }`}
            >
              {text.nextBtn}
            </button>

            <p className="text-center text-sm text-gray-400 mt-4">
              {text.alreadyHaveAccount}{' '}
              <Link to="/login" className="text-[#0052FF] hover:text-[#00FF94] transition-colors">
                {text.signIn}
              </Link>
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
