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

  // Partner member (Member ID) login & activation
  partnerUseMemberId: string;
  partnerEmailRequired: string;
  accountDeactivated: string;
  partnerFirstTimePrompt: string;
  partnerActivateLink: string;
  paTitle: string;
  paSubtitle: string;
  paFromLogin: string;
  paMemberIdLabel: string;
  paMemberIdPlaceholder: string;
  paSendCode: string;
  paSendingCode: string;
  paResendCode: string;
  paCodeSentTo: string;
  paRegisteredEmail: string;
  paCodeLabel: string;
  paCodePlaceholder: string;
  paPasswordLabel: string;
  paPasswordPlaceholder: string;
  paPasswordConfirmPlaceholder: string;
  paErrPasswordLength: string;
  paErrPasswordMismatch: string;
  paAgreeTermsPrefix: string;
  paTermsLink: string;
  paAgreeTermsConnector: string;
  paPrivacyLink: string;
  paAgreeTermsSuffix: string;
  paNewsletter: string;
  paSubmit: string;
  paSubmitting: string;
  paBackToLogin: string;
  paErrNotFound: string;
  paErrAlreadyActivated: string;
  paErrInvalidCode: string;
  paErrCodeExpired: string;
  paErrTooManyAttempts: string;
  paErrTerms: string;
  paErrFailed: string;

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
