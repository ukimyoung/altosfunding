import type { SignUpTranslations } from './types';

export const signUpEn: SignUpTranslations = {
    langEnglish: 'English',
    langKorean: '한국어',

    // Step 1
    pageTitle: 'Create Account',
    pageSubtitle: 'Get started with your trading journey',
    signInWithGoogle: 'Sign in with Google',
    orDivider: 'OR',

    labelFullName: 'Full Name',
    labelEmail: 'Email Address',
    labelPassword: 'Password',
    labelConfirmPassword: 'Confirm Password',

    placeholderFullName: 'John Doe',
    placeholderEmail: 'john@example.com',
    placeholderPassword: 'Min. 8 characters',
    placeholderConfirmPassword: 'Re-enter your password',

    agreeToTermsPrefix: 'I agree to the ',
    termsLink: 'Terms of Service',
    agreeTermsConnector: ' and ',
    privacyLink: 'Privacy Policy',
    agreeToTermsSuffix: '',

    newsletterConsent:
      'I want to receive Altos Funding newsletters, special offers, and updates',

    notARobot: "I'm not a robot",

    signUpBtn: 'Sign Up',
    nextBtn: 'Next',
    alreadyHaveAccount: 'Already have an account?',
    signIn: 'Sign In',
    checkingSession: 'Checking session...',
    termsRecaptchaPrefix: 'This site is protected by reCAPTCHA and the Google ',
    googlePrivacyPolicy: 'Privacy Policy',
    termsRecaptchaConnector: ' and ',
    googleTermsOfService: 'Terms of Service',
    termsRecaptchaSuffix: ' apply.',

    errFullNameRequired: 'Full name is required',
    errEmailRequired: 'Email address is required',
    errEmailInvalid: 'Please enter a valid email address',
    errPasswordRequired: 'Password is required',
    errPasswordLength: 'Password must be at least 8 characters',
    errConfirmPasswordRequired: 'Please confirm your password',
    errPasswordMatch: 'Passwords do not match',
    errAgreeTerms: 'You must agree to the Terms of Service and Privacy Policy to continue',

    // Step 2
    step2Title: 'Before You Start',
    step2Subtitle: 'Please complete these fields to proceed',

    placeholderFirstName: 'First name',
    placeholderLastName: 'Last name',
    placeholderAddress: '123 Main St',
    placeholderAddressLine2: 'Address Line 2 (Apt, Suite, etc.)',
    placeholderCity: 'City',
    placeholderSelectState: 'Select State',
    placeholderPostalCode: 'Postal Code',
    placeholderPhoneNumber: 'Phone number',
    phoneCountryAria: 'Phone country',
    searchCountries: 'Search',
    noCountriesFound: 'No countries found',

    agreeMarketing:
      'I agree to receive important updates and marketing messages from Altos Funding via automated text messages',
    agreeMarketingNote: 'Message and data rates may apply. Message frequency varies',
    confirmIdMatch:
      'I confirm that my name is correct and matches my government issued ID*',

    submitBtn: 'Submit',
    backToStep1: '← Back to Step 1',

    // Step 3
    step3Title: 'Email Verification',
    step3Subtitle: 'Please enter the 6-digit code sent to your email.',
    step3ResendPrompt: "Didn't receive the code?",
    sendingCode: 'SENDING...',
    resendCode: 'CLICK HERE TO RESEND',
    verifyingCode: 'Verifying code...',
    codeVerified: 'Email verification completed.',
    errRecaptchaNotReady: 'reCAPTCHA is not ready yet. Please try again.',
    errRecaptchaFailed: 'reCAPTCHA verification failed. Please try again.',
    errSendCodeFailed: 'Failed to send verification code. Please try again.',
    errInvalidCode: 'Verification code is invalid. Please try again.',
    errCompleteVerification: 'Please complete email verification before continuing.',
    errSignUpFailed: 'Sign up failed. Please try again.',
    signUpCompleteTitle: 'Sign Up Complete',
    signUpCompleteMessage: 'Your account has been created successfully. Redirecting to login...',
    creatingAccount: 'Creating Account...',
    createAccount: 'Create Account',
    verifyBtn: 'Verify & Continue',
  };
