export interface SignUpTranslations {
  // Language switcher labels
  langEnglish: string;
  langKorean: string;

  // ── Step 1 — Account Creation ─────────────────────────────────────────────

  pageTitle: string;
  pageSubtitle: string;
  signInWithGoogle: string;
  orDivider: string;

  // Field labels
  labelFullName: string;
  labelEmail: string;
  labelPassword: string;
  labelConfirmPassword: string;

  // Placeholders
  placeholderFullName: string;
  placeholderEmail: string;
  placeholderPassword: string;
  placeholderConfirmPassword: string;

  // Terms checkbox — split so links can be rendered as <a> elements
  agreeToTermsPrefix: string;
  termsLink: string;
  agreeTermsConnector: string;
  privacyLink: string;
  agreeToTermsSuffix: string;

  // Newsletter consent
  newsletterConsent: string;

  // reCAPTCHA
  notARobot: string;

  // Submit + navigation
  signUpBtn: string;
  nextBtn: string;
  alreadyHaveAccount: string;
  signIn: string;
  checkingSession: string;
  termsRecaptchaPrefix: string;
  googlePrivacyPolicy: string;
  termsRecaptchaConnector: string;
  googleTermsOfService: string;
  termsRecaptchaSuffix: string;

  // Validation messages
  errFullNameRequired: string;
  errEmailRequired: string;
  errEmailInvalid: string;
  errPasswordRequired: string;
  errPasswordLength: string;
  errConfirmPasswordRequired: string;
  errPasswordMatch: string;
  errAgreeTerms: string;

  // ── Step 2 — Personal Information ────────────────────────────────────────

  step2Title: string;
  step2Subtitle: string;

  placeholderFirstName: string;
  placeholderLastName: string;
  placeholderAddress: string;
  placeholderAddressLine2: string;
  placeholderCity: string;
  placeholderSelectState: string;
  placeholderPostalCode: string;
  placeholderPhoneNumber: string;
  phoneCountryAria: string;
  searchCountries: string;
  noCountriesFound: string;

  agreeMarketing: string;
  agreeMarketingNote: string;
  confirmIdMatch: string;

  submitBtn: string;
  backToStep1: string;

  // ── Step 3 — Email Verification ──────────────────────────────────────────

  step3Title: string;
  step3Subtitle: string;
  step3ResendPrompt: string;
  sendingCode: string;
  resendCode: string;
  verifyingCode: string;
  codeVerified: string;
  errRecaptchaNotReady: string;
  errRecaptchaFailed: string;
  errSendCodeFailed: string;
  errInvalidCode: string;
  errCompleteVerification: string;
  errSignUpFailed: string;
  signUpCompleteTitle: string;
  signUpCompleteMessage: string;
  creatingAccount: string;
  createAccount: string;
  verifyBtn: string;
}
