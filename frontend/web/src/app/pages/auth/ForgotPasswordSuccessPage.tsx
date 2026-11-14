import { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckCircle, Mail, ArrowLeft, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { AppBrand } from '../../components/shared/AppBrand';
import { useForgotPasswordMutation } from '@/app/queries/auth';

const RESEND_COOLDOWN = 60;

export function ForgotPasswordSuccessPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const { mutateAsync: sendResetLink, isPending: isResending } = useForgotPasswordMutation();
  const email = (location.state as { email?: string })?.email || 'your email address';

  const [cooldown, setCooldown] = useState(0);
  const [toastVisible, setToastVisible] = useState(false);
  const [resendError, setResendError] = useState('');

  useEffect(() => {
    if (!location.state?.email) {
      // Guard: don't allow direct navigation without email state
      navigate('/forgot-password', { replace: true });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || isResending || !location.state?.email) {
      return;
    }

    setResendError('');

    try {
      if (!executeRecaptcha) {
        throw new Error('reCAPTCHA is not ready yet. Please try again.');
      }

      const recaptchaToken = await executeRecaptcha('password_forgot');

      if (!recaptchaToken) {
        throw new Error('reCAPTCHA verification failed. Please try again.');
      }

      await sendResetLink({
        email: location.state.email,
        recaptcha_token: recaptchaToken,
      });

      setCooldown(RESEND_COOLDOWN);
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 3500);
    } catch (resendRequestError) {
      if (
        resendRequestError instanceof Error &&
        resendRequestError.message.includes('reCAPTCHA')
      ) {
        setResendError(resendRequestError.message);
        return;
      }

      if (axios.isAxiosError(resendRequestError)) {
        const detail =
          resendRequestError.response?.data &&
          typeof resendRequestError.response.data === 'object' &&
          'detail' in resendRequestError.response.data &&
          resendRequestError.response.data.detail &&
          typeof resendRequestError.response.data.detail === 'object'
            ? resendRequestError.response.data.detail
            : undefined;
        const errorCode =
          detail && 'error_code' in detail && typeof detail.error_code === 'string'
            ? detail.error_code
            : '';

        if (errorCode === 'recaptcha_failed') {
          setResendError('reCAPTCHA verification failed. Please try again.');
          return;
        }

        if (errorCode === 'rate_limit_exceeded') {
          const rateLimitMessage =
            'message' in detail && typeof detail.message === 'string'
              ? detail.message
              : 'Please wait before requesting another reset link.';
          setResendError(rateLimitMessage);
          return;
        }
      }

      setResendError('Failed to resend the reset link. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
      {/* Toast notification */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: toastVisible ? 1 : 0, y: toastVisible ? 0 : -20 }}
        transition={{ duration: 0.3 }}
        className="fixed top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
      >
        <div className="flex items-center gap-2.5 bg-[#1a1a28] border border-[#00FF94]/40 rounded-xl px-5 py-3 shadow-xl">
          <CheckCircle size={16} className="text-[#00FF94] shrink-0" />
          <span className="text-sm text-white whitespace-nowrap">
            Reset link has been resent successfully!
          </span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex items-center gap-2 mb-10">
          <AppBrand
            logoWrapClassName="w-9 h-9"
            imageClassName="w-9 h-9 object-contain brightness-0 invert"
            textClassName="text-lg text-white"
          />
        </div>

        {/* Card */}
        <div className="bg-[#0f0f1a] border border-[#2a2a3a] rounded-2xl p-8 sm:p-10">
          {/* Success icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-[#00FF94]/10 border border-[#00FF94]/30 flex items-center justify-center">
                <Mail size={32} className="text-[#00FF94]" />
              </div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 260, damping: 20 }}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#00FF94] flex items-center justify-center"
              >
                <CheckCircle size={16} className="text-[#0a0a0f]" />
              </motion.div>
            </div>
          </div>

          <h1 className="text-3xl text-white text-center mb-3">Check Your Email</h1>

          <p className="text-gray-400 text-sm leading-relaxed text-center mb-6">
            If an account exists for <span className="text-white">{email}</span>, password reset
            instructions have been sent. Please check your inbox and follow the instructions to
            reset your password.
          </p>

          <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-xl px-4 py-3 flex items-start gap-3 mb-8">
            <Mail size={15} className="text-gray-500 mt-0.5 shrink-0" />
            <div className="space-y-2 text-xs text-gray-500 leading-relaxed">
              <p>
                Don't forget to check your <span className="text-gray-300">spam or junk</span>{' '}
                folder if you don't see it within a few minutes. The link expires after{' '}
                <span className="text-gray-300">30 minutes</span>.
              </p>
              <p>
                If you signed up with Google, return to the login page and use{' '}
                <span className="text-gray-300">Sign in with Google</span>.
              </p>
            </div>
          </div>

          {/* Resend */}
          <div className="text-center mb-6">
            <p className="text-sm text-gray-500">
              Didn't receive the email?{' '}
              <button
                onClick={handleResend}
                disabled={cooldown > 0 || isResending}
                className="text-[#0052FF] hover:text-[#4d88ff] transition-colors disabled:text-gray-600 disabled:cursor-not-allowed"
              >
                {isResending
                  ? 'Resending...'
                  : cooldown > 0
                    ? `Resend in ${cooldown}s`
                    : 'Resend Link'}
              </button>
            </p>
            {resendError ? (
              <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-red-400">
                <AlertCircle size={12} />
                {resendError}
              </p>
            ) : null}
          </div>

          {/* Back to login */}
          <Link
            to="/login"
            className="flex items-center justify-center gap-2 w-full py-3 border border-[#2a2a3a] rounded-lg text-sm text-gray-400 hover:border-[#0052FF]/50 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Login
          </Link>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-600 mt-6">
          If you continue to have issues, contact{' '}
          <span className="text-gray-500">support@altosfunding.com</span>
        </p>
      </motion.div>
    </div>
  );
}
