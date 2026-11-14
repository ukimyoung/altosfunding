export interface ContactUsTranslations {
  // Page section-box header
  pageTitle: string;
  pageSubtitle: string;

  // Form card header
  formTitle: string;
  formSubtitle: string;

  // Form field labels (asterisk rendered separately in JSX)
  labelName: string;
  labelEmail: string;
  labelCategory: string;
  labelSubject: string;
  labelMessage: string;

  // Form field placeholders
  placeholderName: string;
  placeholderEmail: string;
  placeholderCategoryDefault: string;
  placeholderSubject: string;
  placeholderMessage: string;

  // Validation and error messages
  invalidEmail: string;
  recaptchaNotReady: string;
  recaptchaFailed: string;
  submitFailed: string;

  // Inquiry category dropdown options
  catBillingPayments: string;
  catTechnicalSupport: string;
  catAccountManagement: string;
  catKycVerification: string;
  catTradingQuestions: string;
  catPayoutRequests: string;
  catGeneralInquiry: string;

  // Character counter (used as "{count} / 1000 {characters}")
  characters: string;

  // Submit button states
  sendMessage: string;
  sending: string;

  // Success state (shown after submission)
  successTitle: string;
  successMessage: string;

  // Toast notification
  toastTitle: string;
  toastMessage: string;

  // Landing contact modal
  modalSubtitle: string;
  dismiss: string;
  close: string;

  // Footer disclaimer — split so links can be rendered as <a> elements
  footerNoticePrefix: string;
  footerPrivacyPolicy: string;
  footerNoticeAnd: string;
  footerTermsOfService: string;
  footerNoticeSuffix: string;
}
