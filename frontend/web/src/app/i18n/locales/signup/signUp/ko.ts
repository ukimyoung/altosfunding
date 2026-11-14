import type { SignUpTranslations } from './types';

export const signUpKo: SignUpTranslations = {
    langEnglish: 'English',
    langKorean: '한국어',

    // Step 1
    pageTitle: '회원가입',
    pageSubtitle: '트레이딩 여정을 함께 시작해 보세요.',
    signInWithGoogle: '구글 계정으로 로그인',
    orDivider: '또는',

    labelFullName: '이름',
    labelEmail: '이메일 주소',
    labelPassword: '비밀번호',
    labelConfirmPassword: '비밀번호 확인',

    placeholderFullName: '홍길동',
    placeholderEmail: 'example@email.com',
    placeholderPassword: '최소 8자 이상',
    placeholderConfirmPassword: '비밀번호를 다시 입력해 주세요',

    agreeToTermsPrefix: '',
    termsLink: '서비스 이용약관',
    agreeTermsConnector: ' 및 ',
    privacyLink: '개인정보처리방침',
    agreeToTermsSuffix: '에 동의합니다.',

    newsletterConsent:
      'Altos Funding의 뉴스레터, 특별 혜택 및 업데이트 수신에 동의합니다.',

    notARobot: '저는 로봇이 아닙니다',

    signUpBtn: '회원가입 하기',
    nextBtn: '다음',
    alreadyHaveAccount: '이미 계정이 있으신가요?',
    signIn: '로그인',
    checkingSession: '세션 확인 중...',
    termsRecaptchaPrefix: '이 사이트는 reCAPTCHA로 보호되며 Google ',
    googlePrivacyPolicy: '개인정보처리방침',
    termsRecaptchaConnector: ' 및 ',
    googleTermsOfService: '서비스 약관',
    termsRecaptchaSuffix: '이 적용됩니다.',

    errFullNameRequired: '이름을 입력해 주세요.',
    errEmailRequired: '이메일 주소를 입력해 주세요.',
    errEmailInvalid: '유효한 이메일 주소를 입력해 주세요.',
    errPasswordRequired: '비밀번호를 입력해 주세요.',
    errPasswordLength: '비밀번호는 최소 8자 이상이어야 합니다.',
    errConfirmPasswordRequired: '비밀번호를 한 번 더 입력해 주세요.',
    errPasswordMatch: '비밀번호가 일치하지 않습니다.',
    errAgreeTerms: '계속하려면 서비스 이용약관 및 개인정보처리방침에 동의해야 합니다.',

    // Step 2
    step2Title: '시작하기 전에',
    step2Subtitle: '계속 진행하려면 아래 필드를 모두 입력해 주세요.',

    placeholderFirstName: '이름',
    placeholderLastName: '성',
    placeholderAddress: '주소를 입력해 주세요',
    placeholderAddressLine2: '상세 주소 (동, 호수 등)',
    placeholderCity: '도시',
    placeholderSelectState: '주/도를 선택해 주세요',
    placeholderPostalCode: '우편번호',
    placeholderPhoneNumber: '전화번호',
    phoneCountryAria: '전화번호 국가',
    searchCountries: '검색',
    noCountriesFound: '국가를 찾을 수 없습니다',

    agreeMarketing:
      '자동화된 문자 메시지를 통해 Altos Funding의 중요 업데이트 및 마케팅 정보 수신에 동의합니다.',
    agreeMarketingNote: '메시지 및 데이터 요금이 적용될 수 있습니다. 발송 빈도는 다를 수 있습니다.',
    confirmIdMatch:
      '입력한 이름이 정확하며 정부 발급 신분증과 일치함을 확인합니다.*',

    submitBtn: '제출',
    backToStep1: '← 1단계로 돌아가기',

    // Step 3
    step3Title: '이메일 인증',
    step3Subtitle: '이메일로 발송된 6자리 인증 코드를 입력해 주세요.',
    step3ResendPrompt: '코드를 받지 못하셨나요?',
    sendingCode: '발송 중...',
    resendCode: '여기를 클릭하여 재발송',
    verifyingCode: '인증 코드 확인 중...',
    codeVerified: '이메일 인증이 완료되었습니다.',
    errRecaptchaNotReady: 'reCAPTCHA가 아직 준비되지 않았습니다. 다시 시도해 주세요.',
    errRecaptchaFailed: 'reCAPTCHA 인증에 실패했습니다. 다시 시도해 주세요.',
    errSendCodeFailed: '인증 코드를 발송하지 못했습니다. 다시 시도해 주세요.',
    errInvalidCode: '인증 코드가 올바르지 않습니다. 다시 시도해 주세요.',
    errCompleteVerification: '계속하려면 이메일 인증을 완료해 주세요.',
    errSignUpFailed: '회원가입에 실패했습니다. 다시 시도해 주세요.',
    signUpCompleteTitle: '회원가입 완료',
    signUpCompleteMessage: '계정이 성공적으로 생성되었습니다. 로그인 페이지로 이동합니다...',
    creatingAccount: '계정 생성 중...',
    createAccount: '계정 만들기',
    verifyBtn: '인증 및 계속하기',
  };
