import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { AppBrand } from '../../components/shared/AppBrand';
import { ImageWithFallback } from '../../components/shared/figma/ImageWithFallback';
import { SuccessNotification } from '../../components/shared/SuccessNotification';
import {
  useRegisterMutation,
  useSendVerificationEmailMutation,
  useVerifyVerificationEmailMutation,
} from '@/app/queries/auth';
import { buildRegisterPayload } from '@/api/signup';
import { useSignUpFlow } from './SignUpFlowContext';
import { useLocale } from '@/app/i18n/LocaleContext';
import { LanguageSelector } from '../../components/shared/LanguageSelector';

const SIGNUP_SUCCESS_REDIRECT_DELAY_MS = 1500;

export function SignUpStep3() {
  const navigate = useNavigate();
  const { T } = useLocale();
  const text = T.signup;
  const { executeRecaptcha } = useGoogleReCaptcha();
  const { mutateAsync: sendVerificationEmail, isPending: isSendingCode } =
    useSendVerificationEmailMutation();
  const { mutateAsync: verifyVerificationEmail, isPending: isVerifyingCode } =
    useVerifyVerificationEmailMutation();
  const { mutateAsync: registerAccount, isPending: isSubmitting } = useRegisterMutation();
  const { resetSignUpFlow, step1Data, step2Data, referralCode } = useSignUpFlow();

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isCodeVerified, setIsCodeVerified] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [showSignupSuccessNotification, setShowSignupSuccessNotification] = useState(false);

  // Step3 진입 시 이메일 인증코드 발송 API가 한 번만 호출되도록 막는다.
  const hasRequestedCodeRef = useRef(false);

  // 같은 6자리 코드로 verify API가 중복 호출되지 않도록 마지막 검증 코드를 기억한다.
  const lastRequestedVerificationRef = useRef('');

  // 회원가입 성공 후 컨텍스트 초기화 때문에 guard가 다시 동작하지 않도록 막는다.
  const hasCompletedSignupRef = useRef(false);
  const signupSuccessRedirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Step1을 정상적으로 거쳤는지 확인하기 위한 최소 조건이다.
  const hasStep1Data =
    step1Data.email.trim() !== '' &&
    step1Data.password.trim() !== '';

  // Step2 필수값이 있어야 Step3에 머무를 수 있다.
  const hasStep2Data =
    step2Data.firstName.trim() !== '' &&
    step2Data.lastName.trim() !== '' &&
    step2Data.address.trim() !== '' &&
    step2Data.city.trim() !== '' &&
    step2Data.postalCode.trim() !== '' &&
    step2Data.phoneNumber.trim() !== '';

  const getRecaptchaToken = async (action: string) => {
    if (!executeRecaptcha) {
      throw new Error(text.errRecaptchaNotReady);
    }

    const token = await executeRecaptcha(action);

    if (!token) {
      throw new Error(text.errRecaptchaFailed);
    }

    return token;
  };

  useEffect(() => {
    inputRefs.current[0]?.focus();

    if (hasCompletedSignupRef.current) {
      return;
    }

    if (!hasStep1Data) {
      navigate('/signup', { replace: true });
      return;
    }

    if (!hasStep2Data) {
      navigate('/signup/step-2', { replace: true });
    }
  }, [hasStep1Data, hasStep2Data, navigate]);

  useEffect(
    () => () => {
      if (signupSuccessRedirectTimerRef.current) {
        clearTimeout(signupSuccessRedirectTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!hasStep1Data || !hasStep2Data || hasRequestedCodeRef.current || !executeRecaptcha) {
      return;
    }

    hasRequestedCodeRef.current = true;
    void handleSendVerificationCode();
  }, [hasStep1Data, hasStep2Data, executeRecaptcha]);

  useEffect(() => {
    const joinedCode = code.join('');

    if (joinedCode.length !== 6) {
      setIsCodeVerified(false);
      setVerificationMessage('');
      lastRequestedVerificationRef.current = '';

      if (joinedCode.length === 0) {
        setErrorMessage('');
      }

      return;
    }

    if (lastRequestedVerificationRef.current === joinedCode) {
      return;
    }

    lastRequestedVerificationRef.current = joinedCode;
    void handleVerifyCode(joinedCode);
  }, [code]);

  const handleChange = (index: number, value: string) => {
    if (value && !/^\d+$/.test(value)) {
      return;
    }

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setIsCodeVerified(false);
    setVerificationMessage('');

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newCode = [...code];

    for (let i = 0; i < pastedData.length; i += 1) {
      newCode[i] = pastedData[i];
    }

    setCode(newCode);
    setIsCodeVerified(false);
    setVerificationMessage('');

    const nextIndex = Math.min(pastedData.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleSendVerificationCode = async () => {
    try {
      setErrorMessage('');
      setVerificationMessage('');
      setIsCodeVerified(false);
      lastRequestedVerificationRef.current = '';

      const recaptchaToken = await getRecaptchaToken('signup_send_verification');

      await sendVerificationEmail({
        email: step1Data.email,
        purpose: 'SIGNUP',
        recaptcha_token: recaptchaToken,
      });
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(
          error.message.includes('reCAPTCHA')
            ? error.message
            : text.errSendCodeFailed,
        );
      } else {
        setErrorMessage(text.errSendCodeFailed);
      }
    }
  };

  const handleVerifyCode = async (verificationCode: string) => {
    try {
      setErrorMessage('');
      setVerificationMessage('');

      await verifyVerificationEmail({
        email: step1Data.email,
        code: verificationCode,
        purpose: 'SIGNUP',
      });

      setIsCodeVerified(true);
      setVerificationMessage(text.codeVerified);
    } catch {
      setIsCodeVerified(false);
      setErrorMessage(text.errInvalidCode);
    }
  };

  const handleResend = () => {
    void handleSendVerificationCode();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!isCodeVerified) {
      setErrorMessage(text.errCompleteVerification);
      return;
    }

    try {
      hasCompletedSignupRef.current = true;

      await registerAccount(
        buildRegisterPayload({
          step1: step1Data,
          step2: step2Data,
          referralCode,
        }),
      );

      setShowSignupSuccessNotification(true);
      resetSignUpFlow();
      signupSuccessRedirectTimerRef.current = setTimeout(() => {
        navigate('/login', { replace: true });
      }, SIGNUP_SUCCESS_REDIRECT_DELAY_MS);
    } catch (error) {
      hasCompletedSignupRef.current = false;

      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(text.errSignUpFailed);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex">
      <SuccessNotification
        isVisible={showSignupSuccessNotification}
        title={text.signUpCompleteTitle}
        message={text.signUpCompleteMessage}
        placement="center"
      />

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
          animate={{ y: [0, -30, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/4 left-1/4 w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 opacity-60 blur-xl"
        />
        <motion.div
          animate={{ y: [0, 20, 0], x: [0, 10, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          className="absolute top-1/2 left-1/3 w-32 h-32 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 opacity-50 blur-2xl"
        />
        <motion.div
          animate={{ y: [0, -15, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute bottom-1/3 right-1/3 w-28 h-28 rounded-full bg-gradient-to-br from-[#0052FF] to-[#00FF94] opacity-40 blur-2xl"
        />
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 bg-[#0f0f17]">
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

          <div className="flex items-center gap-2 mb-12">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#0052FF] flex items-center justify-center text-white text-sm">
                1
              </div>
              <div className="w-12 h-0.5 bg-[#0052FF]" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#0052FF] flex items-center justify-center text-white text-sm">
                2
              </div>
              <div className="w-12 h-0.5 bg-[#0052FF]" />
            </div>
            <div className="w-8 h-8 rounded-full bg-[#0052FF] flex items-center justify-center text-white text-sm border-2 border-[#0052FF]">
              3
            </div>
          </div>

          <h1 className="text-4xl text-white mb-3">{text.step3Title}</h1>
          <p className="text-gray-400 text-sm mb-2">
            {text.step3Subtitle} {text.step3ResendPrompt}
          </p>
          <button
            type="button"
            onClick={handleResend}
            disabled={isSendingCode || showSignupSuccessNotification}
            className="text-[#FFB800] hover:text-[#FFC933] text-sm font-medium mb-8 transition-colors"
          >
            {isSendingCode ? text.sendingCode : text.resendCode}
          </button>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="flex items-center justify-center gap-3">
              {code.map((digit, index) => (
                <div key={index} className="flex items-center gap-3">
                  <input
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    disabled={showSignupSuccessNotification}
                    className="w-12 h-14 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg text-white text-center text-xl focus:outline-none focus:border-[#0052FF] transition-colors"
                    required
                  />
                  {index < 5 && <span className="text-gray-600 text-xl">-</span>}
                </div>
              ))}
            </div>

            {isVerifyingCode ? (
              <p className="text-sm text-[#FFB800] text-center">{text.verifyingCode}</p>
            ) : null}

            {verificationMessage ? (
              <p className="text-sm text-green-400 text-center">{verificationMessage}</p>
            ) : null}

            {errorMessage ? (
              <p className="text-sm text-red-400 text-center">{errorMessage}</p>
            ) : null}

            <p className="text-[11px] leading-5 text-gray-500 text-center">
              {text.termsRecaptchaPrefix}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                {text.googlePrivacyPolicy}
              </a>{' '}
              {text.termsRecaptchaConnector}
              <a
                href="https://policies.google.com/terms"
                target="_blank"
                rel="noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                {text.googleTermsOfService}
              </a>{' '}
              {text.termsRecaptchaSuffix}
            </p>

            <button
              type="submit"
              disabled={
                isSubmitting ||
                isVerifyingCode ||
                !isCodeVerified ||
                showSignupSuccessNotification
              }
              className={`w-full px-6 py-3 text-white rounded-lg transition-all ${
                isSubmitting ||
                isVerifyingCode ||
                !isCodeVerified ||
                showSignupSuccessNotification
                  ? 'bg-[#2a2a3a] text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#FFB800] via-[#0052FF] to-[#0052FF] hover:shadow-lg hover:shadow-[#0052FF]/50'
              }`}
            >
              {isSubmitting ? text.creatingAccount : text.createAccount}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

