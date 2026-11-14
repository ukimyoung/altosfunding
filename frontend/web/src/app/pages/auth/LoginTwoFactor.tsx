import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Shield, ArrowLeft } from 'lucide-react';
import { useTwoFactorLoginMutation } from '@/app/queries/auth';
import { getApiErrorMessage } from '@altosfunding/shared/api/errors';
import { AppBrand } from '../../components/shared/AppBrand';
import { LanguageSelector } from '../../components/shared/LanguageSelector';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../../components/ui/input-otp';
import { getMe } from '@/api/user';
import { profileQueryKey } from '@/app/queries/profile';
import { consumeGoogleAuthInProgress } from '@/app/utils/auth/googleAuth';
import { useLocale } from '@/app/i18n/LocaleContext';

export function LoginTwoFactor() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { T } = useLocale();
  const text = T.login;
  const { mutateAsync: loginTwoFactor, isPending: isVerifying } = useTwoFactorLoginMutation();
  const [accessSource] = useState<'route' | 'google' | 'blocked'>(() => {
    if (location.state?.fromLogin) {
      return 'route';
    }

    return consumeGoogleAuthInProgress() ? 'google' : 'blocked';
  });
  const canAccess = accessSource !== 'blocked';
  const [code, setCode] = useState('');
  const [isBackupCodeMode, setIsBackupCodeMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (accessSource === 'google') {
      navigate(
        {
          pathname: location.pathname,
          search: location.search,
        },
        { replace: true, state: { fromLogin: true } },
      );
      return;
    }

    if (!canAccess) {
      navigate('/login', { replace: true });
    }
  }, [accessSource, canAccess, location.pathname, location.search, navigate]);

  if (!canAccess) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const normalizedCode = code.trim();

    if (!isBackupCodeMode && normalizedCode.length !== 6) {
      setErrorMessage(text.twoFactorInvalidCode);
      return;
    }

    if (isBackupCodeMode && normalizedCode === '') {
      setErrorMessage(text.twoFactorBackupRequired);
      return;
    }

    try {
      await loginTwoFactor({ code: normalizedCode });
      await queryClient.fetchQuery({
        queryKey: profileQueryKey,
        queryFn: getMe,
      });
      navigate('/my-page', { replace: true });
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, text.twoFactorVerifyFailed));
    }
  };

  const handleToggleBackupCodeMode = () => {
    setIsBackupCodeMode((prev) => !prev);
    setCode('');
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#0a0a0f] via-[#0a0a1f] to-[#0a0a0f]">
        <div className="absolute top-8 left-8 flex items-center gap-2 z-10">
          <AppBrand />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,82,255,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(0,255,148,0.12),transparent_30%)]" />
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="flex justify-end mb-6">
            <LanguageSelector />
          </div>

          <div className="lg:hidden flex items-center gap-2 mb-8">
            <AppBrand />
          </div>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mb-6 inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
          >
            <ArrowLeft size={16} />
            {text.twoFactorBackToLogin}
          </button>

          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#0052FF]/10">
              <Shield size={22} className="text-[#0052FF]" />
            </div>
            <div>
              <h1 className="text-3xl text-white font-semibold">{text.twoFactorTitle}</h1>
              <p className="text-sm text-gray-400">
                {isBackupCodeMode
                  ? text.twoFactorBackupDescription
                  : text.twoFactorAuthenticatorDescription}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {isBackupCodeMode ? (
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={text.twoFactorBackupPlaceholder}
                autoComplete="one-time-code"
                className="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a24] px-4 py-3 text-white placeholder-gray-500 transition-colors focus:border-[#0052FF] focus:outline-none"
              />
            ) : (
              <div className="flex justify-center">
                <InputOTP
                  value={code}
                  onChange={setCode}
                  maxLength={6}
                  containerClassName="gap-2"
                >
                  <InputOTPGroup className="gap-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <InputOTPSlot
                        key={index}
                        index={index}
                        className="h-12 w-12 rounded-xl border border-[#2a2a3a] bg-[#1a1a24] text-white"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
            )}

            {errorMessage ? (
              <p className="text-center text-sm text-red-400">{errorMessage}</p>
            ) : null}

            <button
              type="submit"
              disabled={isVerifying || (!isBackupCodeMode && code.length !== 6) || code.trim() === ''}
              className="w-full rounded-lg bg-[#0052FF] px-6 py-3 text-white transition-colors hover:bg-[#0066FF] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isVerifying ? text.twoFactorVerifying : text.twoFactorVerify}
            </button>

            <button
              type="button"
              onClick={handleToggleBackupCodeMode}
              className="w-full text-sm font-medium text-[#FFB800] transition-colors hover:text-[#FFC933]"
            >
              {isBackupCodeMode
                ? text.twoFactorBackToAuthenticator
                : text.twoFactorUseBackupCode}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
