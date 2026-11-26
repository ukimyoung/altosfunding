import { useEffect, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, KeyRound } from 'lucide-react';
import { motion } from 'motion/react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getApiErrorCode, getApiErrorMessage } from '@altosfunding/shared/api/errors';
import { AppBrand } from '../../components/shared/AppBrand';
import { LanguageSelector } from '../../components/shared/LanguageSelector';
import { useLocale } from '@/app/i18n/LocaleContext';
import { profileQueryKey } from '@/app/queries/profile';
import { completePartnerActivation, sendPartnerActivationCode } from '@/api/partner';

type PartnerActivationState = {
  fromLogin?: boolean;
  memberId?: string;
  maskedEmail?: string;
};

const inputClass =
  'w-full px-4 py-3 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#0052FF] transition-colors disabled:opacity-60';

/**
 * 제휴사(10Power·xnsoft) 회원 계정 활성화.
 * Member ID → 제휴사 등록 이메일로 인증코드 받기 → 코드·비밀번호·약관 동의 → 계정 생성 후 바로 로그인.
 */
export function PartnerActivationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const { T } = useLocale();
  const text = T.login;
  // 로그인에서 넘겨준 값은 처음 한 번만 읽어 둔다 (아래에서 history state를 지운다).
  const [initial] = useState<PartnerActivationState>(
    () => (location.state as PartnerActivationState | null) ?? {},
  );

  const [memberId, setMemberId] = useState(initial.memberId ?? '');
  const [sentTo, setSentTo] = useState<{ email: string; minutes: number } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [subscribeNewsletter, setSubscribeNewsletter] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const sendCode = useMutation({ mutationFn: sendPartnerActivationCode });
  const complete = useMutation({ mutationFn: completePartnerActivation });

  const isPasswordTooShort = password.length > 0 && password.length < 8;
  const isPasswordMismatch = passwordConfirm.length > 0 && password !== passwordConfirm;
  const canSubmit =
    sentTo !== null &&
    /^\d{6}$/.test(code) &&
    password.length >= 8 &&
    password === passwordConfirm &&
    agreeToTerms &&
    !complete.isPending;

  const errorText = (error: unknown) => {
    switch (getApiErrorCode(error)) {
      case 'not_found':
        return text.paErrNotFound;
      case 'partner_already_activated':
        return text.paErrAlreadyActivated;
      case 'partner_email_required':
        return text.partnerEmailRequired;
      case 'account_deactivated':
        return text.accountDeactivated;
      case 'invalid_verification_code':
        return text.paErrInvalidCode;
      case 'verification_code_expired':
        return text.paErrCodeExpired;
      case 'verification_too_many_attempts':
        return text.paErrTooManyAttempts;
      case 'tos_not_accepted':
        return text.paErrTerms;
      case 'rate_limit_exceeded':
      case 'recaptcha_failed':
        return getApiErrorMessage(error, text.paErrFailed);
      default:
        return error instanceof Error && error.message.includes('reCAPTCHA')
          ? error.message
          : text.paErrFailed;
    }
  };

  const handleSendCode = async () => {
    const value = memberId.trim();
    if (!value) return;
    setErrorMessage('');

    try {
      if (!executeRecaptcha) throw new Error(text.recaptchaNotReady);
      const recaptchaToken = await executeRecaptcha('partner_activation');
      if (!recaptchaToken) throw new Error(text.recaptchaFailed);

      const result = await sendCode.mutateAsync({ member_id: value, recaptcha_token: recaptchaToken });
      // 서버가 돌려준 정확한 Member ID(대소문자)로 맞춘다.
      setMemberId(result.member_id);
      setSentTo({ email: result.masked_email, minutes: result.expiry_minutes });
      setCode('');
    } catch (error) {
      if (getApiErrorCode(error) === 'partner_email_required') {
        window.alert(text.partnerEmailRequired);
        return;
      }
      setErrorMessage(errorText(error));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !sentTo) return;
    setErrorMessage('');

    try {
      await complete.mutateAsync({
        member_id: memberId.trim(),
        code,
        password,
        agree_to_terms: agreeToTerms,
        subscribe_newsletter: subscribeNewsletter,
      });
      await queryClient.invalidateQueries({ queryKey: profileQueryKey });
      navigate('/my-page', { replace: true });
    } catch (error) {
      setErrorMessage(errorText(error));
    }
  };

  // 로그인에서 넘어온 경우 기억해 둔 상태를 한 번만 쓰고 지운다 (새로고침 시 다시 보이지 않게).
  useEffect(() => {
    if (location.state) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex">
      {/* Left decorative panel — mirrors Login */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#0a0a0f] via-[#0a0a1f] to-[#0a0a0f]">
        <div className="absolute top-8 left-8 flex items-center gap-2 z-10">
          <Link to="/" className="flex items-center gap-2">
            <AppBrand />
          </Link>
        </div>
        <motion.div
          animate={{ y: [0, -20, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full bg-gradient-to-br from-[#FFB800] to-[#0052FF] opacity-30 blur-3xl"
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
          transition={{ duration: 0.5 }}
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

          <div className="w-14 h-14 rounded-2xl bg-[#FFB800]/15 border border-[#FFB800]/30 flex items-center justify-center mb-6">
            <KeyRound size={26} className="text-[#FFB800]" />
          </div>

          <h1 className="text-4xl text-white mb-3">{text.paTitle}</h1>
          <p className="text-gray-400 text-sm leading-relaxed mb-6">
            {initial.fromLogin ? text.paFromLogin : text.paSubtitle}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Member ID + 코드 받기 */}
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">{text.paMemberIdLabel}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={memberId}
                  onChange={(e) => {
                    setMemberId(e.target.value);
                    setSentTo(null);
                  }}
                  placeholder={text.paMemberIdPlaceholder}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={!memberId.trim() || memberId.includes('@') || sendCode.isPending}
                  className="shrink-0 px-4 py-3 rounded-lg border border-[#FFB800]/60 text-[#FFB800] text-sm hover:bg-[#FFB800]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendCode.isPending
                    ? text.paSendingCode
                    : sentTo
                      ? text.paResendCode
                      : text.paSendCode}
                </button>
              </div>
              {sentTo ? (
                <p className="mt-2 text-xs text-green-400">
                  {text.paCodeSentTo
                    .replace('{email}', sentTo.email)
                    .replace('{minutes}', String(sentTo.minutes))}
                </p>
              ) : initial.maskedEmail ? (
                <p className="mt-2 text-xs text-gray-500">
                  {text.paRegisteredEmail.replace('{email}', initial.maskedEmail)}
                </p>
              ) : null}
            </div>

            {sentTo ? (
              <>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">{text.paCodeLabel}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder={text.paCodePlaceholder}
                    className={`${inputClass} tracking-[0.4em]`}
                  />
                </div>

                <div className="space-y-3">
                  <label className="block text-sm text-gray-400">{text.paPasswordLabel}</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="new-password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={text.paPasswordPlaceholder}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder={text.paPasswordConfirmPlaceholder}
                    className={inputClass}
                  />
                  {isPasswordTooShort ? (
                    <p className="text-sm text-red-400">{text.paErrPasswordLength}</p>
                  ) : isPasswordMismatch ? (
                    <p className="text-sm text-red-400">{text.paErrPasswordMismatch}</p>
                  ) : null}
                </div>

                <div className="space-y-3 pt-1">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreeToTerms}
                      onChange={(e) => setAgreeToTerms(e.target.checked)}
                      className="mt-1 w-4 h-4 bg-[#1a1a24] border border-[#2a2a3a] rounded accent-[#0052FF]"
                    />
                    <span className="text-sm text-gray-400">
                      {text.paAgreeTermsPrefix}
                      <Link to="/terms" className="text-[#0052FF] hover:text-[#00FF94] transition-colors">
                        {text.paTermsLink}
                      </Link>
                      {text.paAgreeTermsConnector}
                      <Link
                        to="/privacy-policy"
                        className="text-[#0052FF] hover:text-[#00FF94] transition-colors"
                      >
                        {text.paPrivacyLink}
                      </Link>
                      {text.paAgreeTermsSuffix}
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={subscribeNewsletter}
                      onChange={(e) => setSubscribeNewsletter(e.target.checked)}
                      className="mt-1 w-4 h-4 bg-[#1a1a24] border border-[#2a2a3a] rounded accent-[#0052FF]"
                    />
                    <span className="text-sm text-gray-400">{text.paNewsletter}</span>
                  </label>
                </div>
              </>
            ) : null}

            {errorMessage ? <p className="text-sm text-red-400 text-center">{errorMessage}</p> : null}

            {sentTo ? (
              <button
                type="submit"
                disabled={!canSubmit}
                className={`w-full px-6 py-3 text-white rounded-lg transition-all mt-4 ${
                  canSubmit
                    ? 'bg-gradient-to-r from-[#FFB800] via-[#0052FF] to-[#0052FF] hover:shadow-lg hover:shadow-[#0052FF]/50'
                    : 'bg-[#2a2a3a] text-gray-500 cursor-not-allowed'
                }`}
              >
                {complete.isPending ? text.paSubmitting : text.paSubmit}
              </button>
            ) : null}
          </form>

          <div className="mt-8 flex items-center justify-center">
            <Link
              to="/login"
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              <ArrowLeft size={14} />
              {text.paBackToLogin}
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
