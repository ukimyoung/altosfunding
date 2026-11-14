import { useState } from 'react';
import axios from 'axios';
import { Mail, ArrowLeft, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { AppBrand } from '../../components/shared/AppBrand';
import { useForgotPasswordMutation } from '@/app/queries/auth';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const { mutateAsync: sendResetLink, isPending: isSubmitting } = useForgotPasswordMutation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

  const getRecaptchaToken = async () => {
    if (!executeRecaptcha) {
      throw new Error('reCAPTCHA is not ready yet. Please try again.');
    }

    const token = await executeRecaptcha('password_forgot');

    if (!token) {
      throw new Error('reCAPTCHA verification failed. Please try again.');
    }

    return token;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setError('');

    try {
      const normalizedEmail = email.trim();
      const recaptchaToken = await getRecaptchaToken();

      await sendResetLink({
        email: normalizedEmail,
        recaptcha_token: recaptchaToken,
      });

      // 등록 여부와 관계없이 동일한 성공 화면을 표시해 이메일 존재 여부를 노출하지 않는다.
      navigate('/forgot-password/success', { state: { email: normalizedEmail } });
    } catch (submitError) {
      if (submitError instanceof Error && submitError.message.includes('reCAPTCHA')) {
        setError(submitError.message);
        return;
      }

      if (axios.isAxiosError(submitError)) {
        const detail =
          submitError.response?.data &&
          typeof submitError.response.data === 'object' &&
          'detail' in submitError.response.data &&
          submitError.response.data.detail &&
          typeof submitError.response.data.detail === 'object'
            ? submitError.response.data.detail
            : undefined;
        const errorCode =
          detail && 'error_code' in detail && typeof detail.error_code === 'string'
            ? detail.error_code
            : '';

        if (errorCode === 'recaptcha_failed') {
          setError('reCAPTCHA verification failed. Please try again.');
          return;
        }

        if (errorCode === 'rate_limit_exceeded') {
          const rateLimitMessage =
            'message' in detail && typeof detail.message === 'string'
              ? detail.message
              : 'Please wait before requesting another reset link.';
          setError(rateLimitMessage);
          return;
        }

        if (submitError.response?.status === 422) {
          setError('Please enter a valid email address.');
          return;
        }
      }

      setError('Failed to send the reset link. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex">
      {/* Left decorative panel — mirrors Login */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#0a0a0f] via-[#0a0a1f] to-[#0a0a0f]">
        <div className="absolute top-8 left-8 flex items-center gap-2 z-10">
          <AppBrand />
        </div>

        {/* Animated blobs */}
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
        <div className="absolute inset-0 flex items-center justify-center gap-8">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ height: 100 }}
              animate={{ height: [100, 180 + i * 20, 100], opacity: [0.3, 0.6, 0.3] }}
              transition={{
                duration: 3 + i * 0.3,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.2,
              }}
              className="w-12 bg-gradient-to-t from-[#1a1a2e] to-[#2a2a3e] rounded-t-lg"
              style={{ boxShadow: '0 0 20px rgba(0,82,255,0.3)' }}
            />
          ))}
        </div>

        {/* Center copy */}
        <div className="absolute bottom-16 left-12 right-12">
          <p className="text-2xl text-white leading-snug mb-2">Secure account recovery</p>
          <p className="text-gray-400 text-sm leading-relaxed">
            We'll send a password reset link to your registered email. The link expires after 30
            minutes.
          </p>
        </div>
      </div>

      {/* Right side — form card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <AppBrand />
          </div>

          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-[#0052FF]/15 border border-[#0052FF]/30 flex items-center justify-center mb-6">
            <Mail size={26} className="text-[#0052FF]" />
          </div>

          <h1 className="text-4xl text-white mb-3">Reset Your Password</h1>
          <p className="text-gray-400 text-sm leading-relaxed mb-8">
            Enter your registered email address below, and we will send you a secure link to reset
            your password.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Email input */}
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                placeholder="name@example.com"
                className={`w-full px-4 py-3 bg-[#1a1a24] border rounded-lg text-white placeholder-gray-500 focus:outline-none transition-colors ${
                  error
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-[#2a2a3a] focus:border-[#0052FF]'
                }`}
              />
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1.5 mt-1.5 text-xs text-red-400"
                >
                  <AlertCircle size={12} />
                  {error}
                </motion.p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-gradient-to-r from-[#0052FF] to-[#00FF94] text-white rounded-lg hover:shadow-lg hover:shadow-[#0052FF]/40 transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {isSubmitting ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>

          {/* Back to login */}
          <div className="mt-8 flex items-center justify-center">
            <Link
              to="/login"
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              <ArrowLeft size={14} />
              Back to Login
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
