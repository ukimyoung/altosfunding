import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  accountsQueryKeys,
  useAccountsQuery,
  useUpdateAccountPasswordMutation,
} from '@/app/queries/accounts';
import { useMeQuery } from '@/app/queries/profile';
import { getApiErrorMessage } from '@/app/queries/errors';
import { createLiveAccount } from '@/api/live';
import { hasRequiredProfileName } from '@/app/utils/profile';
import { useLocale } from '@/app/i18n/LocaleContext';
import { Toast } from './Toast';
import {
  Server,
  Key,
  Shield,
  Eye,
  EyeOff,
  Copy,
  Check,
  CheckCircle,
  AlertCircle,
  Clock,
  X
} from 'lucide-react';

const formatMyAccountText = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );

export function TradingAccountSection() {
  const queryClient = useQueryClient();
  const { T } = useLocale();
  const text = T.myAccount;
  const mt4Server = 'MexnLimited-Live';
  const [hasTradingAccount, setHasTradingAccount] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [mt4AccountId, setMt4AccountId] = useState('');
  const [mt4Password, setMt4Password] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | ''>('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [toastTitle, setToastTitle] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const liveAccountsParams = { tier: 'LIVE' as const, page: 1, size: 20 };
  const { data: me } = useMeQuery();
  const { data: liveAccountsResponse } = useAccountsQuery(liveAccountsParams);
  const updateAccountPasswordMutation = useUpdateAccountPasswordMutation();
  const createLiveAccountMutation = useMutation({
    mutationFn: createLiveAccount,
    onSuccess: (created) => {
      setMt4AccountId(String(created.mt4_login));
      setMt4Password('-');
      setHasTradingAccount(true);
      setIsCreatingAccount(false);
      setShowSuccessModal(true);
      void queryClient.invalidateQueries({
        queryKey: accountsQueryKeys.list(liveAccountsParams),
      });
      void queryClient.refetchQueries({
        queryKey: accountsQueryKeys.list(liveAccountsParams),
      });
    },
    onError: () => {
      setIsCreatingAccount(false);
    },
  });

  const primaryLiveAccount = liveAccountsResponse?.items?.[0];
  const liveAccountStatus = String(primaryLiveAccount?.status ?? '').toUpperCase();

  const getLiveStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return {
          label: text.accountActive,
          wrapperClass: 'bg-[#00FF94]/10 border-[#00FF94]/30',
          textClass: 'text-[#00FF94]',
        };
      case 'PENDING':
        return {
          label: text.accountPending,
          wrapperClass: 'bg-[#FFB800]/10 border-[#FFB800]/30',
          textClass: 'text-[#FFB800]',
        };
      case 'INACTIVE':
        return {
          label: text.accountInactive,
          wrapperClass: 'bg-gray-500/10 border-gray-500/30',
          textClass: 'text-gray-300',
        };
      default:
        return {
          label: status
            ? formatMyAccountText(text.accountStatusTemplate, { status })
            : text.accountStatusUnknown,
          wrapperClass: 'bg-[#0052FF]/10 border-[#0052FF]/30',
          textClass: 'text-[#7FA8FF]',
        };
    }
  };

  const handleCopy = async (copyText: string, fieldName: string) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = copyText;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        const successful = document.execCommand('copy');
        textArea.remove();
        
        if (successful) {
          setCopiedField(fieldName);
          setTimeout(() => {
            setCopiedField(null);
          }, 2000);
        }
      } catch (err) {
        textArea.remove();
        console.error('Failed to copy:', err);
      }
    } catch (error) {
      console.error('Failed to copy to clipboard', error);
    }
  };

  const handleCreateTradingAccount = () => {
    if (!hasRequiredProfileName(me)) {
      setToastType('error');
      setToastTitle(text.requestFailed);
      setToastMessage(text.profileNameRequired);
      setShowToast(true);
      return;
    }

    setIsCreatingAccount(true);
    createLiveAccountMutation.mutate({ product_id: 'LIVE_STD' });
  };

  const validatePassword = (password: string) => {
    if (password.length < 8) {
      setPasswordStrength('');
      return text.errorPasswordLength;
    }

    const hasNumber = /\d/.test(password);
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const hasLetter = /[a-zA-Z]/.test(password);

    if (!hasNumber || !hasSymbol || !hasLetter) {
      setPasswordStrength('weak');
      return text.errorPasswordFormat;
    }

    // Calculate strength
    if (password.length >= 12 && /[A-Z]/.test(password) && /[a-z]/.test(password)) {
      setPasswordStrength('strong');
    } else if (password.length >= 10) {
      setPasswordStrength('medium');
    } else {
      setPasswordStrength('weak');
    }

    return '';
  };

  const syncPasswordValidation = (nextNewPassword: string, nextConfirmPassword: string) => {
    if (!nextNewPassword) {
      setPasswordError('');
      setPasswordStrength('');
      return;
    }

    const ruleError = validatePassword(nextNewPassword);
    if (ruleError) {
      setPasswordError(ruleError);
      return;
    }

    if (nextConfirmPassword && nextNewPassword !== nextConfirmPassword) {
      setPasswordError(text.errorPasswordMatch);
      return;
    }

    setPasswordError('');
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewPassword(value);
    syncPasswordValidation(value, confirmPassword);
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setConfirmPassword(value);
    syncPasswordValidation(newPassword, value);
  };

  const handleChangePassword = () => {
    if (updateAccountPasswordMutation.isPending) {
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(text.errorPasswordMatch);
      return;
    }

    const ruleError = validatePassword(newPassword);
    if (ruleError) {
      setPasswordError(ruleError);
      return;
    }

    const accountId = primaryLiveAccount?.account_id;

    if (!accountId) {
      setToastType('error');
      setToastTitle(text.errorTitle);
      setToastMessage(text.liveAccountIdMissing);
      setShowToast(true);
      return;
    }

    updateAccountPasswordMutation.mutate(
      {
        accountId,
        payload: {
          new_password: newPassword,
          password_type: 'main',
        },
      },
      {
        onSuccess: () => {
          setMt4Password(newPassword);
          setShowChangePassword(false);
          setNewPassword('');
          setConfirmPassword('');
          setPasswordError('');
          setPasswordStrength('');
          setToastType('success');
          setToastTitle(text.successTitle);
          setToastMessage(text.tradingPasswordUpdated);
          setShowToast(true);
        },
        onError: (error) => {
          const message = getApiErrorMessage(error, text.tradingPasswordUpdateFailed);
          setToastType('error');
          setToastTitle(text.errorTitle);
          setToastMessage(message);
          setShowToast(true);
        },
      },
    );
  };

  useEffect(() => {
    if (!primaryLiveAccount) {
      return;
    }

    setHasTradingAccount(true);
    setMt4AccountId(String(primaryLiveAccount.mt4_login ?? '-'));
    setMt4Password(
      typeof primaryLiveAccount.mt4_password === 'string' && primaryLiveAccount.mt4_password
        ? primaryLiveAccount.mt4_password
        : '-',
    );
  }, [primaryLiveAccount]);

  return (
    <>
      <Toast
        type={toastType}
        title={toastTitle}
        message={toastMessage}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
        duration={2500}
        position="top"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl p-8 mb-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#0052FF] to-[#00FF94] flex items-center justify-center">
              <Server size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl text-white font-medium mb-1">
                {text.tradingAccountInformation}
              </h2>
              <p className="text-gray-400 text-sm flex items-center gap-2">
                {text.tradingAccountSubPrefix}{' '}
                <span className="inline-flex items-center px-2 py-0.5 bg-[#00FF94] rounded text-[#0a0a0f] text-xs font-semibold">
                  LIVE
                </span>
                {' '}{text.tradingAccountSub}
              </p>
            </div>
          </div>
          {hasTradingAccount && (
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 border rounded-lg ${
                getLiveStatusBadge(liveAccountStatus).wrapperClass
              }`}
            >
              <CheckCircle size={16} className={getLiveStatusBadge(liveAccountStatus).textClass} />
              <span
                className={`${getLiveStatusBadge(liveAccountStatus).textClass} text-sm font-medium`}
              >
                {getLiveStatusBadge(liveAccountStatus).label}
              </span>
            </div>
          )}
        </div>

        {!hasTradingAccount ? (
          /* Initial State - Create Account Button */
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#0052FF]/10 flex items-center justify-center">
              <Shield size={40} className="text-[#0052FF]" />
            </div>
            <h3 className="text-white text-xl font-medium mb-2">{text.noTradingAccountYet}</h3>
            <p className="text-gray-400 text-sm mb-8 max-w-md mx-auto flex items-center justify-center gap-2 flex-wrap">
              {text.noTradingAccountDescPrefix}{' '}
              <span className="inline-flex items-center px-2 py-0.5 bg-[#00FF94] rounded text-[#0a0a0f] text-xs font-semibold">
                LIVE
              </span>
              {' '}{text.noTradingAccountDesc}
            </p>
            <button
              onClick={handleCreateTradingAccount}
              disabled={isCreatingAccount}
              className="px-8 py-4 bg-gradient-to-r from-[#0052FF] to-[#00FF94] text-white rounded-lg font-semibold hover:shadow-lg hover:shadow-[#0052FF]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
            >
              {isCreatingAccount ? (
                <>
                  <Clock size={20} className="animate-spin" />
                  {text.creatingAccount}
                </>
              ) : (
                <>
                  <Key size={20} />
                  {text.tradingAccountCreationLive}
                </>
              )}
            </button>
          </div>
        ) : (
          /* Account Created State */
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              {/* MT4 Account ID */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#0052FF]/10 flex items-center justify-center flex-shrink-0">
                  <Server size={20} className="text-[#0052FF]" />
                </div>
                <div className="flex-1">
                  <p className="text-gray-400 text-xs mb-2">{text.mt4AccountId}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-white text-sm font-medium font-mono">{mt4AccountId}</p>
                    <button
                      onClick={() => handleCopy(mt4AccountId, 'MT4 Account ID')}
                      className="text-gray-400 hover:text-[#0052FF] transition-colors"
                    >
                      {copiedField === 'MT4 Account ID' ? (
                        <Check size={16} className="text-[#00FF94]" />
                      ) : (
                        <Copy size={16} />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* MT4 Password */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#0052FF]/10 flex items-center justify-center flex-shrink-0">
                  <Key size={20} className="text-[#0052FF]" />
                </div>
                <div className="flex-1">
                  <p className="text-gray-400 text-xs mb-2">{text.mt4Password}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-white text-sm font-medium font-mono">
                      {showPassword ? mt4Password : '••••••••••••'}
                    </p>
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-gray-400 hover:text-[#0052FF] transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button
                      onClick={() => handleCopy(mt4Password, 'MT4 Password')}
                      className="text-gray-400 hover:text-[#0052FF] transition-colors"
                    >
                      {copiedField === 'MT4 Password' ? (
                        <Check size={16} className="text-[#00FF94]" />
                      ) : (
                        <Copy size={16} />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Server */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#0052FF]/10 flex items-center justify-center flex-shrink-0">
                  <Shield size={20} className="text-[#0052FF]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-400 text-xs mb-2">{text.mt4Server}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-white text-sm font-medium font-mono truncate">
                      {mt4Server}
                    </p>
                    <button
                      onClick={() => handleCopy(mt4Server, 'MT4 Server')}
                      className="shrink-0 text-gray-400 hover:text-[#0052FF] transition-colors"
                      title={text.copyServer}
                    >
                      {copiedField === 'MT4 Server' ? (
                        <Check size={16} className="text-[#00FF94]" />
                      ) : (
                        <Copy size={16} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Change Password Button */}
            <div className="flex items-center justify-between pt-6 border-t border-[#1a1a24]">
              <p className="text-gray-400 text-sm">{text.needToUpdatePassword}</p>
              <button
                onClick={() => setShowChangePassword(!showChangePassword)}
                className="flex items-center gap-2 px-4 py-2 bg-[#1a1a24] text-white rounded-lg hover:bg-[#2a2a3a] transition-colors"
              >
                <Key size={18} />
                <span className="text-sm font-medium">
                  {showChangePassword ? text.cancelChangePassword : text.changePassword}
                </span>
              </button>
            </div>

            {/* Change Password Form (Expandable) */}
            <AnimatePresence>
              {showChangePassword && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="mt-6 p-6 bg-[#1a1a24] border border-[#2a2a3a] rounded-xl">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <Shield size={18} className="text-[#0052FF]" />
                      {text.changeMt4Password}
                    </h3>

                    <div className="space-y-4">
                      {/* New Password */}
                      <div>
                        <label className="block text-gray-400 text-sm mb-2">
                          {text.newPassword}
                        </label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={handlePasswordChange}
                            placeholder={text.newPasswordPlaceholder}
                            className="w-full bg-[#16161f] border border-[#2a2a3a] rounded-lg px-4 py-3 pr-12 text-white text-sm focus:outline-none focus:border-[#0052FF] transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                          >
                            {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        {passwordStrength && (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-[#16161f] rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{
                                  width:
                                    passwordStrength === 'weak'
                                      ? '33%'
                                      : passwordStrength === 'medium'
                                      ? '66%'
                                      : '100%',
                                }}
                                className={`h-full rounded-full ${
                                  passwordStrength === 'weak'
                                    ? 'bg-red-500'
                                    : passwordStrength === 'medium'
                                    ? 'bg-[#FFB800]'
                                    : 'bg-[#00FF94]'
                                }`}
                              />
                            </div>
                            <span
                              className={`text-xs font-medium ${
                                passwordStrength === 'weak'
                                  ? 'text-red-400'
                                  : passwordStrength === 'medium'
                                  ? 'text-[#FFB800]'
                                  : 'text-[#00FF94]'
                              }`}
                            >
                              {passwordStrength === 'weak'
                                ? text.strengthWeak
                                : passwordStrength === 'medium'
                                  ? text.strengthMedium
                                  : text.strengthStrong}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Confirm Password */}
                      <div>
                        <label className="block text-gray-400 text-sm mb-2">
                          {text.confirmPassword}
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={handleConfirmPasswordChange}
                            placeholder={text.confirmPasswordPlaceholder}
                            className="w-full bg-[#16161f] border border-[#2a2a3a] rounded-lg px-4 py-3 pr-12 text-white text-sm focus:outline-none focus:border-[#0052FF] transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                          >
                            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>

                      {/* Error Message */}
                      {passwordError && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                        >
                          <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                          <p className="text-red-400 text-sm">{passwordError}</p>
                        </motion.div>
                      )}

                      {/* Security Requirements */}
                      <div className="p-4 bg-[#0052FF]/5 border border-[#0052FF]/20 rounded-lg">
                        <p className="text-white text-xs font-medium mb-2">
                          {text.passwordRequirementsTitle}
                        </p>
                        <ul className="space-y-1 text-gray-400 text-xs">
                          <li className="flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-[#0052FF]"></span>
                            {text.pwReqLength}
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-[#0052FF]"></span>
                            {text.pwReqNumber}
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-[#0052FF]"></span>
                            {text.pwReqSymbol}
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-[#0052FF]"></span>
                            {text.pwReqCase}
                          </li>
                        </ul>
                      </div>

                      {/* Submit Button */}
                      <button
                        onClick={handleChangePassword}
                        disabled={
                          !newPassword ||
                          !confirmPassword ||
                          !!passwordError ||
                          updateAccountPasswordMutation.isPending
                        }
                        className="w-full px-6 py-3 bg-[#0052FF] text-white rounded-lg font-semibold hover:bg-[#0052FF]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Key size={18} />
                        {updateAccountPasswordMutation.isPending
                          ? text.updating
                          : text.updatePassword}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
              onClick={() => setShowSuccessModal(false)}
            />
            
            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="bg-[#0f0f17] border border-[#1a1a24] rounded-2xl shadow-2xl max-w-md w-full"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header with Close Button */}
                <div className="absolute top-4 right-4 z-10">
                  <button 
                    className="w-8 h-8 rounded-lg bg-[#1a1a24] hover:bg-[#2a2a3a] text-gray-400 hover:text-white transition-colors flex items-center justify-center" 
                    onClick={() => setShowSuccessModal(false)}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Content */}
                <div className="px-8 py-12 text-center">
                  {/* Success Icon */}
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ 
                      duration: 0.6, 
                      ease: 'easeOut',
                      type: 'spring',
                      stiffness: 200,
                      damping: 15
                    }}
                    className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#00FF94] to-[#00FF94]/70 flex items-center justify-center relative"
                  >
                    <motion.div
                      initial={{ scale: 1, opacity: 0.5 }}
                      animate={{ scale: 1.3, opacity: 0 }}
                      transition={{ 
                        duration: 1.5,
                        repeat: Infinity,
                        ease: 'easeOut'
                      }}
                      className="absolute inset-0 rounded-full border-4 border-[#00FF94]"
                    />
                    <CheckCircle size={48} className="text-white" strokeWidth={2.5} />
                  </motion.div>

                  {/* Heading */}
                  <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                    className="text-white text-2xl font-bold mb-3"
                  >
                    {text.tradingAccountCreatedTitle}
                  </motion.h2>

                  {/* Message */}
                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.4 }}
                    className="text-gray-400 text-sm mb-8"
                  >
                    {text.tradingAccountCreatedBody}
                  </motion.p>

                  {/* Confirm Button */}
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.4 }}
                    onClick={() => setShowSuccessModal(false)}
                    className="w-full px-6 py-4 bg-[#0052FF] text-white rounded-xl font-semibold hover:bg-[#0052FF]/90 transition-all hover:shadow-lg hover:shadow-[#0052FF]/30"
                  >
                    {text.confirm}
                  </motion.button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
