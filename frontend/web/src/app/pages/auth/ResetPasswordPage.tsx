import { useEffect, useState } from 'react';
import axios from 'axios';
import { Eye, EyeOff, Lock, CheckCircle, XCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useSearchParams } from 'react-router';
import { AppBrand } from '../../components/shared/AppBrand';
import { useResetPasswordMutation } from '@/app/queries/auth';

interface Rule {
  label: string;
  test: (pw: string) => boolean;
}

const PASSWORD_RULES: Rule[] = [
  { label: 'At least 8 characters', test: pw => pw.length >= 8 },
  { label: 'At least one letter', test: pw => /[a-zA-Z]/.test(pw) },
  { label: 'At least one number', test: pw => /\d/.test(pw) },
  { label: 'At least one special character (!@#$…)', test: pw => /[^a-zA-Z0-9]/.test(pw) },
];

type Stage = 'form' | 'success' | 'invalid';

export function ResetPasswordPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [token] = useState(() => searchParams.get('token'));
  const { mutateAsync: submitResetPassword, isPending: isSubmitting } =
    useResetPasswordMutation();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [stage, setStage] = useState<Stage>('form');
  const [submitError, setSubmitError] = useState('');
  const [invalidLinkMessage, setInvalidLinkMessage] = useState(
    'This password reset link has expired or is no longer valid. Reset links are only active for 30 minutes. Please request a new one.',
  );

  const rulesPassed = PASSWORD_RULES.every(r => r.test(password));
  const passwordsMatch = password === confirm;
  const confirmError = confirmTouched && confirm.length > 0 && !passwordsMatch;
  const canSubmit = rulesPassed && password.length <= 128 && passwordsMatch && confirm.length > 0;

  useEffect(() => {
    if (!searchParams.has('token')) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete('token');
    setSearchParams(nextSearchParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmTouched(true);

    if (!token || !canSubmit) {
      return;
    }

    setSubmitError('');

    try {
      await submitResetPassword({
        token,
        new_password: password,
      });

      setStage('success');
    } catch (resetRequestError) {
      if (axios.isAxiosError(resetRequestError)) {
        const detail =
          resetRequestError.response?.data &&
          typeof resetRequestError.response.data === 'object' &&
          'detail' in resetRequestError.response.data &&
          resetRequestError.response.data.detail &&
          typeof resetRequestError.response.data.detail === 'object'
            ? resetRequestError.response.data.detail
            : undefined;
        const errorCode =
          detail && 'error_code' in detail && typeof detail.error_code === 'string'
            ? detail.error_code
            : '';

        if (errorCode === 'invalid_reset_token') {
          setInvalidLinkMessage(
            'This password reset link is invalid or has already been used. Please request a new one.',
          );
          setStage('invalid');
          return;
        }

        if (errorCode === 'reset_token_expired') {
          setInvalidLinkMessage(
            'This password reset link has expired. Please request a new one.',
          );
          setStage('invalid');
          return;
        }

        if (resetRequestError.response?.status === 422) {
          setSubmitError('Password must be between 8 and 128 characters.');
          return;
        }
      }

      setSubmitError('Failed to reset your password. Please try again.');
    }
  };

  // ── Invalid / missing token ─────────────────────────────────────────────
  if (!token || stage === 'invalid') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="flex items-center gap-2 mb-10">
            <AppBrand
              logoWrapClassName="w-9 h-9"
              imageClassName="w-9 h-9 object-contain brightness-0 invert"
              textClassName="text-lg text-white"
            />
          </div>
          <div className="bg-[#0f0f1a] border border-red-500/30 rounded-2xl p-8 sm:p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-5">
              <AlertTriangle size={28} className="text-red-400" />
            </div>
            <h1 className="text-2xl text-white mb-3">Link Expired or Invalid</h1>
            <p className="text-gray-400 text-sm leading-relaxed mb-7">
              {invalidLinkMessage}
            </p>
            <Link
              to="/forgot-password"
              className="inline-flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-[#0052FF] to-[#00FF94] text-white rounded-lg hover:shadow-lg hover:shadow-[#0052FF]/40 transition-all text-sm"
            >
              Request a New Link
            </Link>
            <Link
              to="/login"
              className="flex items-center justify-center gap-1.5 mt-4 text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              <ArrowLeft size={13} /> Back to Login
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Success view ────────────────────────────────────────────────────────
  if (stage === 'success') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="flex items-center gap-2 mb-10">
            <AppBrand
              logoWrapClassName="w-9 h-9"
              imageClassName="w-9 h-9 object-contain brightness-0 invert"
              textClassName="text-lg text-white"
            />
          </div>
          <div className="bg-[#0f0f1a] border border-[#2a2a3a] rounded-2xl p-8 sm:p-10 text-center">
            <div className="flex justify-center mb-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
                className="w-20 h-20 rounded-full bg-[#00FF94]/10 border border-[#00FF94]/30 flex items-center justify-center"
              >
                <CheckCircle size={36} className="text-[#00FF94]" />
              </motion.div>
            </div>
            <h1 className="text-3xl text-white mb-3">Password Changed!</h1>
            <p className="text-gray-400 text-sm leading-relaxed mb-8">
              Your password has been updated successfully. You can now log in to your account with your new password.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center w-full py-3 bg-gradient-to-r from-[#0052FF] to-[#00FF94] text-white rounded-lg hover:shadow-lg hover:shadow-[#0052FF]/40 transition-all text-sm"
            >
              Go to Login
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Password form ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#0a0a0f] via-[#0a0a1f] to-[#0a0a0f]">
        <div className="absolute top-8 left-8 flex items-center gap-2 z-10">
          <AppBrand />
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
        <div className="absolute inset-0 flex items-center justify-center gap-8">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ height: 100 }}
              animate={{ height: [100, 180 + i * 20, 100], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 3 + i * 0.3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
              className="w-12 bg-gradient-to-t from-[#1a1a2e] to-[#2a2a3e] rounded-t-lg"
              style={{ boxShadow: '0 0 20px rgba(0,82,255,0.3)' }}
            />
          ))}
        </div>
        <div className="absolute bottom-16 left-12 right-12">
          <p className="text-2xl text-white leading-snug mb-2">Create a strong new password</p>
          <p className="text-gray-400 text-sm leading-relaxed">
            Use at least 8 characters with a mix of letters, numbers, and symbols.
          </p>
        </div>
      </div>

      {/* Right side — form */}
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
            <Lock size={26} className="text-[#0052FF]" />
          </div>

          <h1 className="text-4xl text-white mb-3">Create New Password</h1>
          <p className="text-gray-400 text-sm leading-relaxed mb-8">
            Please enter your new password below. Make sure it is secure and unique.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* New Password */}
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    setSubmitError('');
                  }}
                  placeholder="Enter new password"
                  className="w-full px-4 py-3 pr-11 bg-[#1a1a24] border border-[#2a2a3a] focus:border-[#0052FF] rounded-lg text-white placeholder-gray-500 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Strength rules */}
              <AnimatePresence>
                {password.length > 0 && (
                  <motion.ul
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 space-y-1.5 overflow-hidden"
                  >
                    {PASSWORD_RULES.map(rule => {
                      const passed = rule.test(password);
                      return (
                        <li key={rule.label} className={`flex items-center gap-2 text-xs transition-colors ${passed ? 'text-[#00FF94]' : 'text-red-400'}`}>
                          {passed
                            ? <CheckCircle size={12} className="shrink-0" />
                            : <XCircle size={12} className="shrink-0" />}
                          {rule.label}
                        </li>
                      );
                    })}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => {
                    setConfirm(e.target.value);
                    setConfirmTouched(true);
                    setSubmitError('');
                  }}
                  placeholder="Re-enter new password"
                  className={`w-full px-4 py-3 pr-11 bg-[#1a1a24] border rounded-lg text-white placeholder-gray-500 focus:outline-none transition-colors ${
                    confirmError ? 'border-red-500 focus:border-red-500' : 'border-[#2a2a3a] focus:border-[#0052FF]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <AnimatePresence>
                {confirmError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex items-center gap-1.5 mt-1.5 text-xs text-red-400"
                  >
                    <XCircle size={12} /> Passwords do not match.
                  </motion.p>
                )}
                {confirmTouched && confirm.length > 0 && passwordsMatch && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex items-center gap-1.5 mt-1.5 text-xs text-[#00FF94]"
                  >
                    <CheckCircle size={12} /> Passwords match.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {submitError ? (
              <p className="flex items-center gap-1.5 text-xs text-red-400">
                <XCircle size={12} />
                {submitError}
              </p>
            ) : null}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !canSubmit}
              className="w-full py-3 bg-gradient-to-r from-[#0052FF] to-[#00FF94] text-white rounded-lg hover:shadow-lg hover:shadow-[#0052FF]/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {isSubmitting ? 'Updating Password…' : 'Change Password'}
            </button>
          </form>

          <div className="mt-8 flex items-center justify-center">
            <Link
              to="/login"
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              <ArrowLeft size={14} /> Back to Login
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
