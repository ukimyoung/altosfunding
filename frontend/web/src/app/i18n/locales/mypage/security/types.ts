export interface SecurityTranslations {
  // Page / section header
  pageTitle: string;
  pageSubtitle: string;
  sectionTitle: string;
  sectionSubtitle: string;

  // Status badges
  enabled: string;
  disabled: string;

  // Google Authenticator card
  googleAuth: string;
  googleAuthDesc: string;

  // Google Auth setup flow
  setupGoogleAuth: string;
  step1Title: string;
  step1Desc: string;
  appStore: string;
  googlePlay: string;
  step2Title: string;
  manualKeyHint: string;
  step3Title: string;
  backupCodeWarning: string;
  step4Title: string;
  step4Desc: string;
  verifyAndEnable: string;

  // Google Auth enabled (active) state (security4)
  authenticatorApp: string;
  connectedViaGoogle: string;
  needAuthApp: string;
  needAuthAppDesc: string;
  disable2fa: string;
  configure2fa: string;

  // Google Auth validation errors
  errGoogleCodeRequired: string;
  errGoogleCodeLength: string;
  errGoogleCodeInvalid: string;
  errAuthOrBackupCodeRequired: string;
  errBackupCodesUnavailable: string;
  errBackupCodesGenerateFailed: string;
  errProfileLoadFailed: string;
  errStart2faFailed: string;
  errVerify2faFailed: string;
  errDisable2faFailed: string;
  errEnableEmailFailed: string;
  errDisableEmailFailed: string;

  // Email Verification card
  emailVerification: string;
  emailVerificationDesc: string;
  emailVerificationActiveDesc: string;

  // Email Verification setup flow
  setupEmailVerification: string;
  emailStep1Title: string;
  emailStep1Desc: string;
  emailStep2Title: string;
  emailStep2Desc: string;
  sendCode: string;
  resendIn: string; // "재발송 {timer}초 후"
  emailStep3Title: string;
  emailStep3Desc: string;

  // Email Verification validation errors
  errEmailCodeRequired: string;
  errEmailCodeLength: string;
  errEmailCodeInvalid: string;

  // 2FA enabled banner (security4)
  twoFaTitle: string;
  twoFaDesc: string;
  twoFaCurrentlyEnabled: string;

  // Change Password section
  changePassword: string;
  changePasswordDesc: string;
  currentPassword: string;
  currentPasswordPlaceholder: string;
  newPassword: string;
  newPasswordPlaceholder: string;
  newPasswordMinPlaceholder: string;
  newPasswordHint: string;
  confirmNewPassword: string;
  confirmNewPasswordPlaceholder: string;
  updatePassword: string;
  updating: string;
  cancel: string;
  currentPasswordRequired: string;
  newPasswordRequired: string;
  confirmPasswordRequired: string;
  passwordMinLength: string;
  passwordsDoNotMatch: string;
  passwordsMatch: string;
  weakPasswordStrength: string;
  mediumPasswordStrength: string;
  strongPasswordStrength: string;
  checkPasswordFields: string;
  missingEmail: string;
  currentPasswordIncorrect: string;
  passwordUpdatedSignInAgain: string;
  passwordUpdateFailed: string;

  // Disable confirmation modal
  confirmSecurityChange: string;
  confirmSecurityChangeSubtitle: string;
  confirmSecurityChangeBody: string;
  confirmSecurityChangeWarning: string;
  yesDisable: string;

  // Toast notifications
  toastSuccess: string;
  toastError: string;
  toastGoogleEnabled: string;
  toastGoogleDisabled: string;
  toastEmailEnabled: string;
  toastEmailDisabled: string;

  // 2FA modal flow
  close2faDialog: string;
  linkAppTitle: string;
  linkAppDesc: string;
  generatingQrCode: string;
  cannotScanQr: string;
  next: string;
  back: string;
  verifyAccountTitle: string;
  verifyAccountDesc: string;
  verify: string;
  verifying: string;
  manualSecretTitle: string;
  manualSecretDesc: string;
  loading: string;
  tryQrAgain: string;
  disable2faTitle: string;
  disable2faDesc: string;
  authOrBackupCode: string;
  authOrBackupCodePlaceholder: string;
  disabling: string;

  // Backup codes modal
  closeBackupCodesDialog: string;
  backupCodesConfiguredTitle: string;
  backupCodesConfiguredDesc: string;
  backupCodesWarning: string;
  downloadBackupCodes: string;

  saving: string;
}
