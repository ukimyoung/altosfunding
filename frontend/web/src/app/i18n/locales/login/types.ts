export interface LoginTranslations {
  // Language switcher labels
  langEnglish: string;
  langKorean: string;
  language: string;

  // Page/session
  checkingSession: string;
  pageTitle: string;

  // Google OAuth button
  signInWithGoogle: string;

  // Divider
  orDivider: string;

  // Field labels
  labelEmail: string;
  labelPassword: string;

  // Placeholders
  placeholderEmail: string;
  placeholderPassword: string;

  // Remember me + forgot password
  rememberMe: string;
  forgotPassword: string;

  // reCAPTCHA
  notARobot: string;
  recaptchaNoticePrefix: string;
  privacyPolicy: string;
  recaptchaNoticeMiddle: string;
  termsOfService: string;
  recaptchaNoticeSuffix: string;

  // Submit
  signInBtn: string;
  signingIn: string;

  // Sign-up prompt
  noAccount: string;
  signUp: string;

  // Validation/server messages
  errEmailRequired: string;
  errEmailInvalid: string;
  errPasswordRequired: string;
  noAccountFound: string;
  incorrectPassword: string;
  loginFailed: string;
  recaptchaNotReady: string;
  recaptchaFailed: string;

  // 2FA login
  twoFactorBackToLogin: string;
  twoFactorTitle: string;
  twoFactorAuthenticatorDescription: string;
  twoFactorBackupDescription: string;
  twoFactorBackupPlaceholder: string;
  twoFactorInvalidCode: string;
  twoFactorBackupRequired: string;
  twoFactorVerifyFailed: string;
  twoFactorVerify: string;
  twoFactorVerifying: string;
  twoFactorUseBackupCode: string;
  twoFactorBackToAuthenticator: string;
}
