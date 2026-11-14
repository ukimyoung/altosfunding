import type { KycTranslations } from './types';

export const kycKo: KycTranslations = {
    pageTitle: 'KYC 본인인증',
    pageSubtitle: '회원님의 본인인증을 완료해 주세요.',

    sectionTitle: '신원 인증 (KYC)',
    sectionSubtitle: '규정 준수 및 안전한 거래를 위해 신원을 인증해 주세요.',

    verificationStatus: '인증 상태',
    loadingStatus: 'KYC 상태를 불러오는 중입니다...',

    statusNotSubmitted: '미제출',
    statusChecking: '확인 중...',
    statusPending: '심사 중',
    statusApproved: '인증 완료',
    statusRejected: '거절됨',

    startVerification: '인증 시작하기',
    retryVerification: '재인증 시작하기',
    refreshStatus: '상태 새로고침',
    refreshing: '새로고침 중...',

    rejectionReason: '거절 사유',
    submittedMessage: '인증 정보가 제출되었습니다. 검토가 완료될 때까지 잠시 기다려 주세요.',
    accessTokenMissing: 'Sumsub 액세스 토큰이 반환되지 않았습니다.',
    startFailed: 'KYC 인증을 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    refreshFailed: 'KYC 상태를 새로고침할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    loadFailed: 'KYC 상태를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.',
    sdkLoadFailed: 'KYC 인증 화면을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
  };
