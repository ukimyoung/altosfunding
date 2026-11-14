import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import axios from 'axios';
import {
  Shield,
  Lock,
  Smartphone,
  Check,
  X,
  Eye,
  EyeOff,
  Key,
  AlertCircle,
  ExternalLink,
  Download,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Toast } from '../../components/shared/Toast';
import { useLoginMutation, useLogoutMutation } from '@/app/queries/auth';
import { useMeQuery } from '@/app/queries/profile';
import {
  useTwoFactorDisableMutation,
  useTwoFactorBackupCodesRegenerateMutation,
  useTwoFactorSetupMutation,
  useTwoFactorVerifyMutation,
  useUpdatePasswordMutation,
  useUpdateWithdrawEmailMutation,
} from '@/app/queries/security';
import { getApiErrorMessage, isUnauthorizedError } from '@altosfunding/shared/api/errors';
import { useLocale } from '@/app/i18n/LocaleContext';

type PasswordFormData = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type PasswordValidation = {
  currentPasswordError: string;
  newPasswordError: string;
  confirmPasswordError: string;
  passwordsMatch: boolean;
  passwordStrength: 'weak' | 'medium' | 'strong' | '';
};

const emptyPasswordForm: PasswordFormData = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

const emptyPasswordValidation: PasswordValidation = {
  currentPasswordError: '',
  newPasswordError: '',
  confirmPasswordError: '',
  passwordsMatch: false,
  passwordStrength: '',
};

type TwoFactorFlowMode = 'setup' | 'verify' | 'manual' | 'disable' | null;

const formatLoginTimestamp = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

export function SecurityPage() {
  const navigate = useNavigate();
  const { T } = useLocale();
  const text = T.security;
  const { data: me, error: meError, isLoading: isLoadingProfile } = useMeQuery();
  const { mutateAsync: verifyCurrentPassword } = useLoginMutation();
  const { mutateAsync: savePassword, isPending: isUpdatingPassword } = useUpdatePasswordMutation();
  const { mutateAsync: performLogout } = useLogoutMutation();
  const { mutateAsync: setupTwoFactor, isPending: isSettingUpTwoFactor } =
    useTwoFactorSetupMutation();
  const { mutateAsync: verifyTwoFactor, isPending: isVerifyingTwoFactor } =
    useTwoFactorVerifyMutation();
  const { mutateAsync: regenerateBackupCodes, isPending: isRegeneratingBackupCodes } =
    useTwoFactorBackupCodesRegenerateMutation();
  const { mutateAsync: disableTwoFactor, isPending: isDisablingTwoFactor } =
    useTwoFactorDisableMutation();
  const { mutateAsync: updateWithdrawEmail, isPending: isUpdatingWithdrawEmail } =
    useUpdateWithdrawEmailMutation();
  const [twoFactorFlowMode, setTwoFactorFlowMode] = useState<TwoFactorFlowMode>(null);
  const [twoFactorSetupData, setTwoFactorSetupData] = useState<{
    secret: string;
    qr_uri: string;
  } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState(['', '', '', '', '', '']);
  const [twoFactorDisableCode, setTwoFactorDisableCode] = useState('');
  const twoFactorCodeInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [emailVerificationEnabled, setEmailVerificationEnabled] = useState(false);
  const [showBackupCodesModal, setShowBackupCodesModal] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const [passwordForm, setPasswordForm] = useState<PasswordFormData>(emptyPasswordForm);
  const [passwordValidation, setPasswordValidation] =
    useState<PasswordValidation>(emptyPasswordValidation);
  const isTwoFactorEnabled = Boolean(me?.is_2fa_enabled);
  const isEmailVerificationEnabled = emailVerificationEnabled;
  // Confirmation modal states
  const [showDisableConfirmation, setShowDisableConfirmation] = useState(false);
  const [pendingDisableAction, setPendingDisableAction] = useState<'email' | null>(null);

  const extractBackupCodes = (value: unknown) => {
    if (Array.isArray(value)) {
      return value.map((item) => String(item)).filter(Boolean);
    }

    if (value && typeof value === 'object') {
      const maybeCodes = (value as { backup_codes?: unknown; codes?: unknown }).backup_codes;
      const maybeAltCodes = (value as { backup_codes?: unknown; codes?: unknown }).codes;
      const source = Array.isArray(maybeCodes)
        ? maybeCodes
        : Array.isArray(maybeAltCodes)
          ? maybeAltCodes
          : [];

      return source.map((item) => String(item)).filter(Boolean);
    }

    return [];
  };

  const closeBackupCodesModal = () => {
    setShowBackupCodesModal(false);
    setBackupCodes([]);
  };

  useEffect(() => {
    if (!meError) {
      return;
    }

    if (isUnauthorizedError(meError)) {
      navigate('/login', { replace: true });
      return;
    }

    setToastType('error');
    setToastMessage(text.errProfileLoadFailed);
    setShowToast(true);
  }, [text.errProfileLoadFailed, meError, navigate]);

  useEffect(() => {
    if (typeof me?.is_email_enabled === 'boolean') {
      setEmailVerificationEnabled(me.is_email_enabled);
    }
  }, [me?.is_email_enabled]);

  const validatePassword = (password: string) => {
    if (password.length < 8) {
      return 'weak';
    } else if (password.length < 12) {
      return 'medium';
    } else {
      return 'strong';
    }
  };

  const getPasswordValidation = (data: PasswordFormData, showRequiredErrors: boolean) => {
    let currentPasswordError = '';
    let newPasswordError = '';
    let confirmPasswordError = '';
    let passwordsMatch = false;
    let passwordStrength: PasswordValidation['passwordStrength'] = '';

    if (showRequiredErrors && data.currentPassword.trim() === '') {
      currentPasswordError = text.currentPasswordRequired;
    }

    if (showRequiredErrors && data.newPassword.trim() === '') {
      newPasswordError = text.newPasswordRequired;
    } else if (data.newPassword !== '' && data.newPassword.length < 8) {
      newPasswordError = text.passwordMinLength;
    } else {
      passwordStrength = data.newPassword === '' ? '' : validatePassword(data.newPassword);
    }

    if (showRequiredErrors && data.confirmPassword.trim() === '') {
      confirmPasswordError = text.confirmPasswordRequired;
    } else if (data.confirmPassword !== '' && data.newPassword !== data.confirmPassword) {
      confirmPasswordError = text.passwordsDoNotMatch;
    } else if (
      data.confirmPassword !== '' &&
      data.newPassword === data.confirmPassword &&
      newPasswordError === ''
    ) {
      passwordsMatch = true;
    }

    return {
      currentPasswordError,
      newPasswordError,
      confirmPasswordError,
      passwordsMatch,
      passwordStrength,
    };
  };

  const handlePasswordInputChange = (field: keyof PasswordFormData, value: string) => {
    const nextPasswordForm = {
      ...passwordForm,
      [field]: value,
    };

    setPasswordForm(nextPasswordForm);
    setPasswordValidation(getPasswordValidation(nextPasswordForm, false));
  };

  const resetPasswordForm = () => {
    setPasswordForm(emptyPasswordForm);
    setPasswordValidation(emptyPasswordValidation);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isUpdatingPassword) {
      return;
    }

    const validation = getPasswordValidation(passwordForm, true);
    setPasswordValidation(validation);

    if (
      validation.currentPasswordError ||
      validation.newPasswordError ||
      validation.confirmPasswordError
    ) {
      setToastType('error');
      setToastMessage(text.checkPasswordFields);
      setShowToast(true);
      return;
    }

    const email = me?.email || '';

    if (!email) {
      setToastType('error');
      setToastMessage(text.missingEmail);
      setShowToast(true);
      return;
    }

    try {
      try {
        await verifyCurrentPassword({
          email,
          password: passwordForm.currentPassword,
        });
      } catch (error) {
        if (axios.isAxiosError(error) && [401, 404, 409].includes(error.response?.status ?? 0)) {
          setPasswordValidation((prev) => ({
            ...prev,
            currentPasswordError: text.currentPasswordIncorrect,
          }));
          return;
        }

        throw error;
      }

      await savePassword({
        old_password: passwordForm.currentPassword,
        new_password: passwordForm.newPassword,
      });

      resetPasswordForm();

      await performLogout();
      navigate('/login', {
        replace: true,
        state: {
          toast: {
            type: 'success',
            title: text.toastSuccess,
            message: text.passwordUpdatedSignInAgain,
          },
        },
      });
    } catch (error) {
      const message = getApiErrorMessage(error, text.passwordUpdateFailed);

      setToastType('error');
      setToastMessage(message);
      setShowToast(true);
    }
  };

  const resetTwoFactorFlow = () => {
    setTwoFactorFlowMode(null);
    setTwoFactorSetupData(null);
    setTwoFactorCode(['', '', '', '', '', '']);
    setTwoFactorDisableCode('');
  };

  const handleDownloadBackupCodes = () => {
    if (backupCodes.length === 0) {
      setToastType('error');
      setToastMessage(text.errBackupCodesUnavailable);
      setShowToast(true);
      return;
    }

    const content = backupCodes.join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '2fa-backup-codes.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const openTwoFactorSetup = async () => {
    setTwoFactorFlowMode('setup');
    setTwoFactorSetupData(null);
    setTwoFactorCode(['', '', '', '', '', '']);

    try {
      const response = await setupTwoFactor();
      setTwoFactorSetupData(response);
    } catch (error) {
      setToastType('error');
      setToastMessage(getApiErrorMessage(error, text.errStart2faFailed));
      setShowToast(true);
      resetTwoFactorFlow();
    }
  };

  const handleVerifyTwoFactor = async () => {
    const verificationCode = twoFactorCode.join('');

    if (verificationCode.length !== 6) {
      setToastType('error');
      setToastMessage(text.errGoogleCodeLength);
      setShowToast(true);
      return;
    }

    try {
      await verifyTwoFactor({ code: verificationCode });
      const backupCodesResponse = await regenerateBackupCodes({ code: verificationCode });
      const nextBackupCodes = extractBackupCodes(backupCodesResponse);

      if (nextBackupCodes.length === 0) {
        setToastType('error');
        setToastMessage(text.errBackupCodesGenerateFailed);
        setShowToast(true);
        resetTwoFactorFlow();
        return;
      }

      setBackupCodes(nextBackupCodes);
      setToastType('success');
      setToastMessage(text.toastGoogleEnabled);
      setShowToast(true);
      resetTwoFactorFlow();
      setShowBackupCodesModal(true);
    } catch (error) {
      setToastType('error');
      setToastMessage(getApiErrorMessage(error, text.errVerify2faFailed));
      setShowToast(true);
    }
  };

  const openDisableTwoFactor = () => {
    setTwoFactorFlowMode('disable');
    setTwoFactorSetupData(null);
    setTwoFactorCode(['', '', '', '', '', '']);
    setTwoFactorDisableCode('');
  };

  const handleDisableTwoFactor = async () => {
    const code = twoFactorDisableCode.trim();

    if (!code) {
      setToastType('error');
      setToastMessage(text.errAuthOrBackupCodeRequired);
      setShowToast(true);
      return;
    }

    try {
      await disableTwoFactor({ code });
      setToastType('success');
      setToastMessage(text.toastGoogleDisabled);
      setShowToast(true);
      resetTwoFactorFlow();
    } catch (error) {
      setToastType('error');
      setToastMessage(getApiErrorMessage(error, text.errDisable2faFailed));
      setShowToast(true);
    }
  };

  const handleToggleEmailVerification = async () => {
    if (isUpdatingWithdrawEmail) {
      return;
    }

    const next = !emailVerificationEnabled;

    if (!next) {
      setPendingDisableAction('email');
      setShowDisableConfirmation(true);
      return;
    }

    try {
      const response = await updateWithdrawEmail({ enabled: true });
      setEmailVerificationEnabled(response.is_email_enabled ?? true);
      setToastType('success');
      setToastMessage(text.toastEmailEnabled);
      setShowToast(true);
    } catch (error) {
      setToastType('error');
      setToastMessage(getApiErrorMessage(error, text.errEnableEmailFailed));
      setShowToast(true);
    }
  };

  const handleTwoFactorCodeChange = (index: number, value: string) => {
    if (value && !/^\d+$/.test(value)) {
      return;
    }

    const nextCode = [...twoFactorCode];
    nextCode[index] = value.slice(-1);
    setTwoFactorCode(nextCode);

    if (value && index < 5) {
      twoFactorCodeInputRefs.current[index + 1]?.focus();
    }
  };

  const handleTwoFactorCodeKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === 'Backspace' && !twoFactorCode[index] && index > 0) {
      twoFactorCodeInputRefs.current[index - 1]?.focus();
    }
  };

  const handleTwoFactorCodePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();

    const pastedCode = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pastedCode) {
      return;
    }

    const nextCode = ['', '', '', '', '', ''];

    pastedCode.split('').forEach((digit, index) => {
      nextCode[index] = digit;
    });

    setTwoFactorCode(nextCode);
    const nextIndex = Math.min(pastedCode.length, 5);
    twoFactorCodeInputRefs.current[nextIndex]?.focus();
  };

  const handleConfirmDisable = async () => {
    if (pendingDisableAction !== 'email' || isUpdatingWithdrawEmail) {
      return;
    }

    if (pendingDisableAction === 'email') {
      try {
        const response = await updateWithdrawEmail({ enabled: false });
        setEmailVerificationEnabled(response.is_email_enabled ?? false);
        setToastType('success');
        setToastMessage(text.toastEmailDisabled);
        setShowToast(true);
      } catch (error) {
        setToastType('error');
        setToastMessage(getApiErrorMessage(error, text.errDisableEmailFailed));
        setShowToast(true);
      }
    }

    setShowDisableConfirmation(false);
    setPendingDisableAction(null);
  };

  const handleCancelDisable = () => {
    setShowDisableConfirmation(false);
    setPendingDisableAction(null);
  };

  return (
    <>
      <Toast
        type={toastType}
        title={toastType === 'success' ? text.toastSuccess : text.toastError}
        message={toastMessage}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
        duration={2000}
        position="top"
      />

      <div className="p-8 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-lg bg-[#0052FF]/10 flex items-center justify-center">
              <Shield size={24} className="text-[#0052FF]" />
            </div>
            <div>
              <h1 className="text-2xl text-white font-medium">{text.sectionTitle}</h1>
              <p className="text-gray-400 text-sm mt-1">{text.sectionSubtitle}</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Two-Factor Authentication Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl p-6"
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-[#00FF94]/10 flex items-center justify-center flex-shrink-0">
                  <Smartphone size={24} className="text-[#00FF94]" />
                </div>
                <div>
                  <h2 className="text-white text-lg font-medium mb-1">
                    {text.twoFaTitle}
                  </h2>
                  <p className="text-gray-400 text-sm mb-4">{text.twoFaDesc}</p>

                  {isTwoFactorEnabled ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-[#00FF94]/10 border border-[#00FF94]/20 rounded-lg w-fit mb-4">
                      <Check size={16} className="text-[#00FF94]" />
                      <span className="text-[#00FF94] text-sm font-medium">
                        {text.twoFaCurrentlyEnabled}
                      </span>
                    </div>
                  ) : null}

                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-[#0052FF]/10 flex items-center justify-center">
                      <Smartphone size={18} className="text-[#0052FF]" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{text.authenticatorApp}</p>
                      <p className="text-gray-400 text-xs">{text.connectedViaGoogle}</p>
                    </div>
                  </div>

                  <div className="mb-4 rounded-xl border border-[#1a1a24] bg-[#12121a] p-4">
                    <p className="text-white text-sm font-medium mb-2">
                      {text.needAuthApp}
                    </p>
                    <p className="text-gray-400 text-xs mb-4">{text.needAuthAppDesc}</p>
                    <div className="flex flex-wrap gap-3">
                      <a
                        href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1a1a24] text-white rounded-lg text-sm font-medium hover:bg-[#2a2a3a] transition-colors"
                      >
                        <ExternalLink size={14} />
                        {text.googlePlay}
                      </a>
                      <a
                        href="https://apps.apple.com/app/google-authenticator/id388497605"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1a1a24] text-white rounded-lg text-sm font-medium hover:bg-[#2a2a3a] transition-colors"
                      >
                        <ExternalLink size={14} />
                        {text.appStore}
                      </a>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {!isTwoFactorEnabled ? (
                      <button
                        onClick={openTwoFactorSetup}
                        className="px-4 py-2 bg-[#0052FF] text-white text-sm rounded-lg hover:bg-[#0066FF] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {text.configure2fa}
                      </button>
                    ) : null}

                    {isTwoFactorEnabled ? (
                      <button
                        onClick={openDisableTwoFactor}
                        className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors text-sm font-medium"
                      >
                        {text.disable2fa}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Email Verification Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl p-6"
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-[#0052FF]/10 flex items-center justify-center flex-shrink-0">
                  <Shield size={24} className="text-[#0052FF]" />
                </div>
                <div>
                  <h2 className="text-white text-lg font-medium mb-1">{text.emailVerification}</h2>
                  <p className="text-gray-400 text-sm mb-4">{text.emailVerificationActiveDesc}</p>

                  <div
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg w-fit mb-4 ${
                      isEmailVerificationEnabled
                        ? 'bg-[#00FF94]/10 border border-[#00FF94]/20 text-[#00FF94]'
                        : 'bg-[#2a2a3a] border border-[#2a2a3a] text-gray-400'
                    }`}
                  >
                    {isEmailVerificationEnabled ? <Check size={16} /> : <X size={16} />}
                    <span className="text-sm font-medium">
                      {isEmailVerificationEnabled ? text.enabled : text.disabled}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0">
                <button
                  onClick={() => void handleToggleEmailVerification()}
                  disabled={isUpdatingWithdrawEmail}
                  className={`relative w-14 h-7 rounded-full transition-colors ${
                    isEmailVerificationEnabled ? 'bg-[#00FF94]' : 'bg-[#2a2a3a]'
                  } disabled:cursor-not-allowed disabled:opacity-70`}
                >
                  <motion.div
                    animate={{ x: isEmailVerificationEnabled ? 28 : 2 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-lg"
                  />
                </button>
              </div>
            </div>
          </motion.div>

          {/* Change Password Section */}
          {!isLoadingProfile && me?.can_change_password === true && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl p-6"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-lg bg-[#0052FF]/10 flex items-center justify-center flex-shrink-0">
                  <Lock size={24} className="text-[#0052FF]" />
                </div>
                <div>
                  <h2 className="text-white text-lg font-medium mb-1">{text.changePassword}</h2>
                  <p className="text-gray-400 text-sm">{text.changePasswordDesc}</p>
                </div>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-4">
                {/* Current Password */}
                <div>
                  <label className="text-white text-sm font-medium mb-2 block">
                    {text.currentPassword}
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={passwordForm.currentPassword}
                      onChange={(e) => handlePasswordInputChange('currentPassword', e.target.value)}
                      className="w-full px-4 py-3 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#0052FF] transition-colors pr-12"
                      placeholder={text.currentPasswordPlaceholder}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    >
                      {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {passwordValidation.currentPasswordError && (
                    <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                      <X size={14} />
                      {passwordValidation.currentPasswordError}
                    </p>
                  )}
                </div>

                {/* New Password */}
                <div>
                  <label className="text-white text-sm font-medium mb-2 block">{text.newPassword}</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(e) => handlePasswordInputChange('newPassword', e.target.value)}
                      className="w-full px-4 py-3 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#0052FF] transition-colors pr-12"
                      placeholder={text.newPasswordMinPlaceholder}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {passwordValidation.newPasswordError && (
                    <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                      <X size={14} />
                      {passwordValidation.newPasswordError}
                    </p>
                  )}
                  {passwordValidation.passwordStrength && !passwordValidation.newPasswordError && (
                    <p
                      className={`text-sm mt-1 flex items-center gap-1 ${
                        passwordValidation.passwordStrength === 'weak'
                          ? 'text-orange-500'
                          : passwordValidation.passwordStrength === 'medium'
                            ? 'text-yellow-500'
                            : 'text-[#00FF94]'
                      }`}
                    >
                      <Check size={14} />
                      {passwordValidation.passwordStrength === 'weak'
                        ? text.weakPasswordStrength
                        : passwordValidation.passwordStrength === 'medium'
                          ? text.mediumPasswordStrength
                          : text.strongPasswordStrength}
                    </p>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="text-white text-sm font-medium mb-2 block">
                    {text.confirmNewPassword}
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => handlePasswordInputChange('confirmPassword', e.target.value)}
                      className="w-full px-4 py-3 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#0052FF] transition-colors pr-12"
                      placeholder={text.confirmNewPasswordPlaceholder}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {passwordValidation.confirmPasswordError && (
                    <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                      <X size={14} />
                      {passwordValidation.confirmPasswordError}
                    </p>
                  )}
                  {passwordValidation.passwordsMatch &&
                    passwordForm.confirmPassword.trim() !== '' && (
                      <p className="text-[#00FF94] text-sm mt-1 flex items-center gap-1">
                        <Check size={14} />
                        {text.passwordsMatch}
                      </p>
                    )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isLoadingProfile || isUpdatingPassword}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#0052FF] to-[#0052FF]/80 text-white rounded-lg hover:shadow-lg hover:shadow-[#0052FF]/30 transition-all font-medium disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Key size={18} />
                    <span>{isUpdatingPassword ? text.updating : text.updatePassword}</span>
                  </button>
                  <button
                    type="button"
                    onClick={resetPasswordForm}
                    className="px-6 py-3 bg-[#1a1a24] text-white rounded-lg hover:bg-[#2a2a3a] transition-colors font-medium"
                  >
                    {text.cancel}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </div>

        <AnimatePresence>
          {twoFactorFlowMode && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
                onClick={resetTwoFactorFlow}
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 20 }}
                transition={{ type: 'spring', damping: 28, stiffness: 260 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
              >
                <div
                  className="w-full max-w-2xl overflow-hidden rounded-3xl border border-[#1a1a24] bg-[#07070d] shadow-2xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex justify-end p-5">
                    <button
                      onClick={resetTwoFactorFlow}
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
                      aria-label={text.close2faDialog}
                    >
                      <X size={24} />
                    </button>
                  </div>

                  {twoFactorFlowMode === 'setup' ? (
                    <div className="px-8 pb-8 pt-0">
                      <h2 className="text-3xl font-semibold text-white">
                        {text.linkAppTitle}
                      </h2>
                      <p className="mt-4 max-w-xl text-sm leading-6 text-gray-400">
                        {text.linkAppDesc}
                      </p>

                      <div className="mt-8 flex justify-center">
                        <div className="rounded-2xl bg-white p-4 shadow-xl">
                          {isSettingUpTwoFactor ? (
                            <div className="flex h-[180px] w-[180px] items-center justify-center text-sm text-gray-500">
                              {text.generatingQrCode}
                            </div>
                          ) : (
                            <QRCodeSVG
                              value={twoFactorSetupData?.qr_uri || ''}
                              size={180}
                              level="H"
                              includeMargin
                            />
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setTwoFactorFlowMode('manual')}
                        className="mx-auto mt-8 block text-sm font-semibold uppercase tracking-[0.2em] text-[#f0c86b] transition-colors hover:text-[#ffd86b]"
                      >
                        {text.cannotScanQr}
                      </button>

                      <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
                        <button
                          onClick={resetTwoFactorFlow}
                          className="rounded-2xl bg-[#1a1a24] px-6 py-4 font-semibold text-white transition-colors hover:bg-[#242433]"
                        >
                          {text.cancel}
                        </button>
                        <button
                          onClick={() => setTwoFactorFlowMode('verify')}
                          disabled={isSettingUpTwoFactor || twoFactorSetupData === null}
                          className="rounded-2xl bg-[#0052FF] px-6 py-4 font-semibold text-white transition-transform hover:scale-[1.02] hover:bg-[#0066FF] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                        >
                          {text.next}
                        </button>
                      </div>
                    </div>
                  ) : twoFactorFlowMode === 'verify' ? (
                    <div className="px-8 pb-8 pt-0">
                      <h2 className="text-3xl font-semibold text-white">{text.verifyAccountTitle}</h2>
                      <p className="mt-4 max-w-xl text-sm leading-6 text-gray-400">
                        {text.verifyAccountDesc}
                      </p>

                      <div className="mt-10 flex items-center justify-center gap-2 sm:gap-3">
                        {twoFactorCode.map((digit, index) => (
                          <input
                            key={index}
                            ref={(element) => {
                              twoFactorCodeInputRefs.current[index] = element;
                            }}
                            value={digit}
                            onChange={(event) =>
                              handleTwoFactorCodeChange(index, event.target.value)
                            }
                            onKeyDown={(event) => handleTwoFactorCodeKeyDown(index, event)}
                            onPaste={handleTwoFactorCodePaste}
                            inputMode="numeric"
                            maxLength={1}
                            className="h-14 w-14 rounded-xl border border-[#2a2a3a] bg-[#1a1a24] text-center font-mono text-2xl text-white outline-none transition-colors focus:border-[#0052FF]"
                          />
                        ))}
                      </div>

                      <div className="mt-12 flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
                        <button
                          onClick={() => setTwoFactorFlowMode('setup')}
                          className="rounded-2xl bg-[#1a1a24] px-6 py-4 font-semibold text-white transition-colors hover:bg-[#242433]"
                        >
                          {text.back}
                        </button>
                        <button
                          onClick={() => void handleVerifyTwoFactor()}
                          disabled={isVerifyingTwoFactor || isRegeneratingBackupCodes}
                          className="rounded-2xl bg-[#0052FF] px-6 py-4 font-semibold text-white transition-transform hover:scale-[1.02] hover:bg-[#0066FF] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                        >
                          {isVerifyingTwoFactor || isRegeneratingBackupCodes
                            ? text.verifying
                            : text.verify}
                        </button>
                      </div>
                    </div>
                  ) : twoFactorFlowMode === 'manual' ? (
                    <div className="px-8 pb-8 pt-0">
                      <h2 className="text-3xl font-semibold text-white">
                        {text.manualSecretTitle}
                      </h2>
                      <p className="mt-4 max-w-xl text-sm leading-6 text-gray-400">
                        {text.manualSecretDesc}
                      </p>

                      <div className="mt-8 rounded-2xl bg-[#3c3f4a] px-6 py-4 text-center">
                        <p className="break-all font-mono text-base font-semibold tracking-wider text-[#aab0bf]">
                          {twoFactorSetupData?.secret || text.loading}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setTwoFactorFlowMode('setup')}
                        className="mx-auto mt-8 block text-sm font-semibold uppercase tracking-[0.2em] text-[#f0c86b] transition-colors hover:text-[#ffd86b]"
                      >
                        {text.tryQrAgain}
                      </button>

                      <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
                        <button
                          onClick={resetTwoFactorFlow}
                          className="rounded-2xl bg-[#1a1a24] px-6 py-4 font-semibold text-white transition-colors hover:bg-[#242433]"
                        >
                          {text.cancel}
                        </button>
                        <button
                          onClick={() => setTwoFactorFlowMode('verify')}
                          disabled={!twoFactorSetupData?.secret}
                          className="rounded-2xl bg-[#0052FF] px-6 py-4 font-semibold text-white transition-transform hover:scale-[1.02] hover:bg-[#0066FF] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                        >
                          {text.next}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="px-8 pb-8 pt-0">
                      <h2 className="text-3xl font-semibold text-white">
                        {text.disable2faTitle}
                      </h2>
                      <p className="mt-4 max-w-xl text-sm leading-6 text-gray-400">
                        {text.disable2faDesc}
                      </p>

                      <div className="mt-8">
                        <label className="mb-2 block text-sm font-medium text-white">
                          {text.authOrBackupCode}
                        </label>
                        <input
                          type="text"
                          value={twoFactorDisableCode}
                          onChange={(e) => setTwoFactorDisableCode(e.target.value)}
                          placeholder={text.authOrBackupCodePlaceholder}
                          className="w-full rounded-xl border border-[#2a2a3a] bg-[#1a1a24] px-4 py-3 text-white placeholder:text-gray-500 focus:border-[#0052FF] focus:outline-none"
                        />
                      </div>

                      <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
                        <button
                          onClick={resetTwoFactorFlow}
                          className="rounded-2xl bg-[#1a1a24] px-6 py-4 font-semibold text-white transition-colors hover:bg-[#242433]"
                        >
                          {text.cancel}
                        </button>
                        <button
                          onClick={() => void handleDisableTwoFactor()}
                          disabled={isDisablingTwoFactor}
                          className="rounded-2xl bg-red-500 px-6 py-4 font-semibold text-white transition-transform hover:scale-[1.02] hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                        >
                          {isDisablingTwoFactor ? text.disabling : text.disable2fa}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showBackupCodesModal && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
                onClick={closeBackupCodesModal}
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.3, type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
              >
                <div
                  className="w-full max-w-xl overflow-hidden rounded-3xl border border-[#1a1a24] bg-[#07070d] shadow-2xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex justify-end p-5">
                    <button
                      onClick={closeBackupCodesModal}
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
                      aria-label={text.closeBackupCodesDialog}
                    >
                      <X size={24} />
                    </button>
                  </div>

                  <div className="px-8 pb-8 pt-0 text-center">
                    <h2 className="text-3xl font-semibold text-white">
                      {text.backupCodesConfiguredTitle}
                    </h2>

                    <div className="mt-8 flex justify-center">
                      <div className="flex h-48 w-full items-center justify-center rounded-2xl border border-[#1f2b4d] bg-gradient-to-br from-[#0c1a3a] via-[#0b1228] to-[#07070d]">
                        <div className="flex items-center gap-6">
                          <div className="h-10 w-10 rounded-full bg-[#4f8cff]" />
                          <div className="relative flex h-28 w-28 items-center justify-center rounded-2xl bg-[#4f8cff]/90 shadow-2xl shadow-[#4f8cff]/20">
                            <Shield size={64} className="text-white" />
                          </div>
                          <div className="h-4 w-4 rounded-full bg-[#e7b95f]" />
                        </div>
                      </div>
                    </div>

                    <p className="mt-6 text-sm font-medium text-gray-400">
                      {text.backupCodesConfiguredDesc}
                    </p>
                    <p className="mt-4 text-base leading-7 text-[#e6c36a]">
                      {text.backupCodesWarning}
                    </p>

                    <button
                      type="button"
                      onClick={handleDownloadBackupCodes}
                      disabled={backupCodes.length === 0}
                      className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-[#e6c36a] px-6 py-3 text-sm font-semibold uppercase tracking-wide text-[#e6c36a] transition-colors hover:bg-[#e6c36a]/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Download size={16} />
                      {text.downloadBackupCodes}
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Disable Security Feature Confirmation Modal */}
        <AnimatePresence>
          {showDisableConfirmation && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                onClick={handleCancelDisable}
              />

              {/* Modal */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.3, type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-[#0f0f17] border border-red-500/30 rounded-2xl shadow-2xl shadow-red-500/20 max-w-md w-full">
                  {/* Modal Header */}
                  <div className="px-8 py-6 border-b border-red-500/20 bg-gradient-to-r from-red-500/10 to-red-600/10">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                        <AlertCircle size={24} className="text-red-400" />
                      </div>
                      <div>
                        <h2 className="text-xl text-white font-medium">
                          {text.confirmSecurityChange}
                        </h2>
                        <p className="text-gray-400 text-sm mt-0.5">
                          {text.confirmSecurityChangeSubtitle}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Modal Body */}
                  <div className="p-8">
                    <p className="text-gray-300 text-sm leading-relaxed mb-4">
                      {text.confirmSecurityChangeBody}
                    </p>
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-red-300 text-sm leading-relaxed">
                        {text.confirmSecurityChangeWarning}
                      </p>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="px-8 py-6 border-t border-red-500/20 bg-gradient-to-r from-[#0f0f17] to-[#12121a] flex justify-end gap-3">
                    <button
                      onClick={handleCancelDisable}
                      disabled={isUpdatingWithdrawEmail}
                      className="px-6 py-2.5 bg-[#1a1a24] text-gray-300 rounded-lg hover:bg-[#2a2a3a] hover:text-white transition-colors font-medium"
                    >
                      {text.cancel}
                    </button>
                    <button
                      onClick={() => void handleConfirmDisable()}
                      disabled={isUpdatingWithdrawEmail}
                      className="px-6 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <AlertCircle size={18} />
                      <span>{isUpdatingWithdrawEmail ? text.saving : text.yesDisable}</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

