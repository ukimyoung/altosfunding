"""기존 서버(알림 서비스 templates/email/altos/en)에서 옮겨 온 메일 템플릿 33종.

영문 본문은 기존 파일의 content 블록을 그대로 쓰고, 제목과 한국어 본문은 새로 작성했다.
(기존 서버는 제목을 DB template_subjects 테이블에 두어 소스에 없었다.)
이 템플릿들은 각 기능이 Core로 옮겨질 때 템플릿 코드로 연결해 발송한다.
"""

from typing import Any

LEGACY_TEMPLATES: dict[str, dict[str, Any]] = {
    "user_registered": {
        "name": "회원가입 환영",
        "description": "회원가입 완료 직후",
        "variables": ["user_name", "login_url"],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Welcome to Altos Funding",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Welcome to Altos Funding!</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>Welcome to Altos Funding—your ultimate prop trading partner. We are thrilled to have you on board!</p>\n"
                    "<p>We are fully committed to backing your talent. May your charts be green and your execution flawless.</p>\n"
                    "<p>Let's secure that funding!</p>\n"
                    '<div style="text-align:center;margin:24px 0;">\n'
                    '<a href="{{ login_url }}" style="background:#1a1a2e;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">Get Started</a>\n'
                    "</div>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] 알토스 펀딩 가입을 환영합니다",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">알토스 펀딩에 오신 것을 환영합니다!</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>최고의 프롭 트레이딩 파트너, 알토스 펀딩에 오신 것을 환영합니다. 함께하게 되어 정말 기쁩니다!</p>\n"
                    "<p>회원님의 실력을 전폭적으로 지원하겠습니다. 차트는 늘 초록빛이고 매매는 완벽하기를 바랍니다.</p>\n"
                    "<p>이제 펀딩을 향해 출발해 보세요!</p>\n"
                    '<div style="text-align:center;margin:24px 0;">\n'
                    '<a href="{{ login_url }}" style="background:#1a1a2e;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">시작하기</a>\n'
                    "</div>"
                ),
            },
        },
    },
    "user_suspended": {
        "name": "회원 일시 정지",
        "description": "관리자가 회원을 일시 정지했을 때",
        "variables": ["user_name", "reason"],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Your account has been temporarily suspended",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Account Temporarily Suspended</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>Your account has been temporarily suspended for the following reasons.</p>\n"
                    "<p>• Reason : {{ reason }}</p>\n"
                    "<p>Please contact our support team if you believe this is an error or need further information.</p>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] 계정이 일시 정지되었습니다",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">계정 일시 정지</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>아래 사유로 회원님의 계정이 일시 정지되었습니다.</p>\n"
                    "<p>• 사유 : {{ reason }}</p>\n"
                    "<p>착오라고 생각되시거나 자세한 내용이 필요하시면 고객센터로 문의해 주세요.</p>"
                ),
            },
        },
    },
    "user_banned": {
        "name": "회원 영구 정지",
        "description": "관리자가 회원을 영구 정지했을 때",
        "variables": ["user_name", "reason"],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Your account has been permanently banned",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Account Permanently Banned</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>Your account has been permanently banned due to a violation of our terms of service.</p>\n"
                    "<p>• Reason : {{ reason }}</p>\n"
                    "<p>Please contact our support team if you believe this is an error or need further information.</p>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] 계정이 영구 정지되었습니다",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">계정 영구 정지</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>이용 약관 위반으로 회원님의 계정이 영구 정지되었습니다.</p>\n"
                    "<p>• 사유 : {{ reason }}</p>\n"
                    "<p>착오라고 생각되시거나 자세한 내용이 필요하시면 고객센터로 문의해 주세요.</p>"
                ),
            },
        },
    },
    "user_reactivated": {
        "name": "회원 정지 해제",
        "description": "정지된 회원을 다시 활성화했을 때",
        "variables": ["user_name"],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Your account has been reactivated",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Account Reactivated</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>Your account has been reactivated. You can now log in and access all platform features.</p>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] 계정이 다시 활성화되었습니다",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">계정 활성화</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>회원님의 계정이 다시 활성화되었습니다. 이제 로그인해 모든 기능을 이용할 수 있습니다.</p>"
                ),
            },
        },
    },
    "user_withdrawn": {
        "name": "회원 탈퇴 완료",
        "description": "회원 탈퇴 처리 직후",
        "variables": ["user_name"],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Your account has been closed",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Account Withdrawal Confirmed</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>Your account withdrawal request has been processed. Your account has been closed.</p>\n"
                    "<p>We're sorry to see you go. If you change your mind, you're always welcome to rejoin. Thank you for trading with us.</p>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] 회원 탈퇴가 완료되었습니다",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">회원 탈퇴 완료</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>회원 탈퇴 신청이 처리되어 계정이 종료되었습니다.</p>\n"
                    "<p>떠나신다니 아쉽습니다. 마음이 바뀌시면 언제든 다시 가입하실 수 있습니다. 그동안 함께해 주셔서 감사합니다.</p>"
                ),
            },
        },
    },
    "kyc_approved": {
        "name": "KYC 승인",
        "description": "본인 인증(KYC) 승인 시",
        "variables": ["user_name"],
        "locales": {
            "en": {
                "subject": "[Altos Funding] KYC verification approved",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">KYC Verification Approved</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>Your identity verification (KYC) has been successfully approved. You now have full access to all Altos Funding features.</p>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] 본인 인증(KYC)이 승인되었습니다",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">본인 인증(KYC) 승인</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>본인 인증(KYC)이 승인되었습니다. 이제 알토스 펀딩의 모든 기능을 이용할 수 있습니다.</p>"
                ),
            },
        },
    },
    "kyc_rejected": {
        "name": "KYC 거절",
        "description": "본인 인증(KYC) 거절 시",
        "variables": ["user_name", "reason"],
        "locales": {
            "en": {
                "subject": "[Altos Funding] KYC verification rejected",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">KYC Verification Rejected</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>Unfortunately, your KYC verification could not be approved.</p>\n"
                    "<p>• Reason : {{ reason }}</p>\n"
                    "<p>Please resubmit with the correct documents. Contact support if you need assistance.</p>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] 본인 인증(KYC)이 거절되었습니다",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">본인 인증(KYC) 거절</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>아쉽게도 본인 인증(KYC)이 승인되지 않았습니다.</p>\n"
                    "<p>• 사유 : {{ reason }}</p>\n"
                    "<p>올바른 서류로 다시 제출해 주세요. 도움이 필요하시면 고객센터로 문의해 주세요.</p>"
                ),
            },
        },
    },
    "deposit_confirmed": {
        "name": "입금 승인",
        "description": "관리자가 입금 신청을 승인했을 때",
        "variables": ["amount", "user_name", "processed_at", "tx_id"],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Your deposit of {{ amount }} USDT is complete",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Deposit Successful</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>Your deposit request has been completed.</p>\n"
                    "<p><strong>Deposit Details</strong></p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Deposit Amount:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Date:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ processed_at }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>TxID:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ tx_id }}</td></tr>\n'
                    "</table>\n"
                    "<p>You can check your deposit history in My Profile &gt; My Asset.</p>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] {{ amount }} USDT 입금이 완료되었습니다",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">입금 완료</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>입금 신청이 완료되었습니다.</p>\n"
                    "<p><strong>입금 정보</strong></p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>입금액:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>처리 일시:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ processed_at }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>TxID:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ tx_id }}</td></tr>\n'
                    "</table>\n"
                    "<p>입금 내역은 My Profile &gt; My Asset에서 확인할 수 있습니다.</p>"
                ),
            },
        },
    },
    "deposit_rejected": {
        "name": "입금 거절",
        "description": "관리자가 입금 신청을 거절했을 때",
        "variables": ["user_name", "amount", "processed_at", "tx_id", "reason"],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Your deposit request was rejected",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Deposit Rejected</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>Your deposit request has been rejected.</p>\n"
                    "<p><strong>Deposit Details</strong></p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Deposit Amount:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Date:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ processed_at }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>TxID:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ tx_id }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Rejected Reason:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reason }}</td></tr>\n'
                    "</table>\n"
                    "<p>Please review the rejection reason and resubmit your request. If you need assistance, contact support.</p>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] 입금 신청이 거절되었습니다",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">입금 거절</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>입금 신청이 거절되었습니다.</p>\n"
                    "<p><strong>입금 정보</strong></p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>입금액:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>처리 일시:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ processed_at }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>TxID:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ tx_id }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>거절 사유:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reason }}</td></tr>\n'
                    "</table>\n"
                    "<p>거절 사유를 확인하신 뒤 다시 신청해 주세요. 도움이 필요하시면 고객센터로 문의해 주세요.</p>"
                ),
            },
        },
    },
    "withdrawal_requested": {
        "name": "출금 신청 접수",
        "description": "회원이 출금을 신청한 직후",
        "variables": ["recipient_email", "payout_id", "amount"],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Withdrawal request received",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Withdrawal Request Received</h2>\n'
                    "<p>Dear {{ recipient_email }},</p>\n"
                    "<p>Your withdrawal request has been received and is now under review.</p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Request No:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ payout_id }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Amount:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>\n'
                    "</table>\n"
                    "<p>You will receive another email once your request has been processed.</p>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] 출금 신청이 접수되었습니다",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">출금 신청 접수</h2>\n'
                    "<p>{{ recipient_email }}님, 안녕하세요.</p>\n"
                    "<p>출금 신청이 접수되어 검토 중입니다.</p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>신청 번호:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ payout_id }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>금액:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>\n'
                    "</table>\n"
                    "<p>처리가 끝나면 다시 메일로 안내드립니다.</p>"
                ),
            },
        },
    },
    "withdrawal_confirmed": {
        "name": "출금 승인",
        "description": "관리자가 출금 신청을 승인(송금 완료)했을 때",
        "variables": [
            "amount",
            "user_name",
            "fee",
            "received_amount",
            "tx_id",
            "processed_at",
        ],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Your withdrawal of {{ amount }} USDT is complete",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Withdrawal Successful</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>Your withdrawal request has been completed.</p>\n"
                    "<p><strong>Withdrawal Details</strong></p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Withdrawal Amount:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Fee:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ fee }} USDT</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Amount Received:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ received_amount }} USDT</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>TxID:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ tx_id }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Date:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ processed_at }}</td></tr>\n'
                    "</table>\n"
                    "<p>You can check your withdrawal history in My Profile &gt; My Asset.</p>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] {{ amount }} USDT 출금이 완료되었습니다",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">출금 완료</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>출금 신청이 완료되었습니다.</p>\n"
                    "<p><strong>출금 정보</strong></p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>출금 금액:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>수수료:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ fee }} USDT</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>실수령액:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ received_amount }} USDT</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>TxID:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ tx_id }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>처리 일시:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ processed_at }}</td></tr>\n'
                    "</table>\n"
                    "<p>출금 내역은 My Profile &gt; My Asset에서 확인할 수 있습니다.</p>"
                ),
            },
        },
    },
    "withdrawal_rejected": {
        "name": "출금 거절",
        "description": "관리자가 출금 신청을 거절했을 때",
        "variables": [
            "user_name",
            "amount",
            "fee",
            "received_amount",
            "processed_at",
            "reason",
        ],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Your withdrawal request was rejected",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Withdrawal Rejected</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>Your withdrawal request has been rejected.</p>\n"
                    "<p><strong>Withdrawal Details</strong></p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Withdrawal Amount:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Fee:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ fee }} USDT</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Amount Received:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ received_amount }} USDT</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Date:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ processed_at }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Rejected Reason:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reason }}</td></tr>\n'
                    "</table>\n"
                    "<p>Please review the rejection reason and resubmit your request. If you need assistance, contact support.</p>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] 출금 신청이 거절되었습니다",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">출금 거절</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>출금 신청이 거절되었습니다.</p>\n"
                    "<p><strong>출금 정보</strong></p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>출금 금액:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>수수료:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ fee }} USDT</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>실수령액:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ received_amount }} USDT</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>처리 일시:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ processed_at }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>거절 사유:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reason }}</td></tr>\n'
                    "</table>\n"
                    "<p>거절 사유를 확인하신 뒤 다시 신청해 주세요. 도움이 필요하시면 고객센터로 문의해 주세요.</p>"
                ),
            },
        },
    },
    "payout_approved": {
        "name": "펀디드 수익 출금 승인",
        "description": "펀디드 계좌 수익 출금(Payout) 승인 시",
        "variables": ["user_name", "mt4_login", "amount", "processed_at", "payout_id"],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Your funded payout is complete",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Funded Payout Successful</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>Your withdrawal request has been completed.</p>\n"
                    "<p><strong>Funded Payout Details</strong></p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Account:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Payout Amount:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Date:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ processed_at }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Request No:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ payout_id }}</td></tr>\n'
                    "</table>\n"
                    "<p>You can check your payout history in My Profile &gt; My Asset.</p>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] 펀디드 수익 출금이 완료되었습니다",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">펀디드 수익 출금 완료</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>출금 신청이 완료되었습니다.</p>\n"
                    "<p><strong>펀디드 출금 정보</strong></p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>계좌:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>출금 금액:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>처리 일시:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ processed_at }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>신청 번호:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ payout_id }}</td></tr>\n'
                    "</table>\n"
                    "<p>출금 내역은 My Profile &gt; My Asset에서 확인할 수 있습니다.</p>"
                ),
            },
        },
    },
    "payout_rejected": {
        "name": "펀디드 수익 출금 거절",
        "description": "펀디드 계좌 수익 출금(Payout) 거절 시",
        "variables": [
            "user_name",
            "mt4_login",
            "amount",
            "processed_at",
            "payout_id",
            "reason",
        ],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Your funded payout request was rejected",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Funded Payout Rejected</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>Your funded payout request has been rejected.</p>\n"
                    "<p><strong>Funded Payout Details</strong></p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Account:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Payout Amount:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Date:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ processed_at }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Request No:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ payout_id }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Rejected Reason:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reason }}</td></tr>\n'
                    "</table>\n"
                    "<p>Please review the rejection reason and resubmit your request. If you need assistance, contact support.</p>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] 펀디드 수익 출금 신청이 거절되었습니다",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">펀디드 수익 출금 거절</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>펀디드 수익 출금 신청이 거절되었습니다.</p>\n"
                    "<p><strong>펀디드 출금 정보</strong></p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>계좌:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>출금 금액:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>처리 일시:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ processed_at }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>신청 번호:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ payout_id }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>거절 사유:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reason }}</td></tr>\n'
                    "</table>\n"
                    "<p>거절 사유를 확인하신 뒤 다시 신청해 주세요. 도움이 필요하시면 고객센터로 문의해 주세요.</p>"
                ),
            },
        },
    },
    "challenge_applied": {
        "name": "챌린지 구매 완료",
        "description": "챌린지 티켓 결제 완료 직후",
        "variables": ["user_name", "challenge_name", "quantity", "amount"],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Challenge ticket purchased",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Challenge Ticket Purchased</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>Your challenge ticket has been successfully purchased.</p>\n"
                    "<p><strong>Purchase Details</strong></p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Challenge Type:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ challenge_name }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Quantity:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ quantity }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Total Amount:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>\n'
                    "</table>\n"
                    "<p>You will receive a separate email once your challenge account has been created.</p>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] 챌린지 티켓 구매가 완료되었습니다",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">챌린지 티켓 구매 완료</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>챌린지 티켓 구매가 완료되었습니다.</p>\n"
                    "<p><strong>구매 정보</strong></p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>챌린지 유형:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ challenge_name }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>수량:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ quantity }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>총 금액:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ amount }} USDT</td></tr>\n'
                    "</table>\n"
                    "<p>챌린지 계좌가 생성되면 별도 메일로 안내드립니다.</p>"
                ),
            },
        },
    },
    "challenge_account_issued": {
        "name": "챌린지 계좌 발급",
        "description": "챌린지 MT4 계좌가 발급됐을 때",
        "variables": [
            "user_name",
            "mt4_login",
            "mt4_password",
            "start_date",
            "end_date",
        ],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Your challenge account has been issued",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Challenge Account</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>Your challenge's account &amp; password has been successfully issued.</p>\n"
                    "<p><strong>Account Details</strong></p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login Account:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Password:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_password }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Period:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ start_date }} – {{ end_date }} (GMT)</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Server:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">MexnLimited-Demo</td></tr>\n'
                    "</table>\n"
                    "<p>You can now log in to MT4 and start trading. Good luck!</p>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] 챌린지 계좌가 발급되었습니다",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">챌린지 계좌 발급</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>챌린지 계좌와 비밀번호가 발급되었습니다.</p>\n"
                    "<p><strong>계좌 정보</strong></p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인 계정:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>비밀번호:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_password }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>기간:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ start_date }} – {{ end_date }} (GMT)</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>서버:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">MexnLimited-Demo</td></tr>\n'
                    "</table>\n"
                    "<p>이제 MT4에 로그인해 거래를 시작할 수 있습니다. 행운을 빕니다!</p>"
                ),
            },
        },
    },
    "challenge_started_notify": {
        "name": "챌린지 시작 예정 안내",
        "description": "챌린지 거래 시작 전 계좌 정보 안내",
        "variables": ["user_name", "challenge_name", "mt4_login", "mt4_password"],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Your challenge is starting soon",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Your Challenge Is Starting Soon</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>Your challenge account is ready. Please use the credentials below to log in to MT4 before trading begins.</p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Challenge:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ challenge_name }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Password:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_password }}</td></tr>\n'
                    "</table>\n"
                    "<p>Good luck with your challenge!</p>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] 챌린지가 곧 시작됩니다",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">챌린지가 곧 시작됩니다</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>챌린지 계좌가 준비되었습니다. 거래가 시작되기 전에 아래 정보로 MT4에 로그인해 주세요.</p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>챌린지:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ challenge_name }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>비밀번호:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_password }}</td></tr>\n'
                    "</table>\n"
                    "<p>챌린지에서 좋은 결과 있기를 바랍니다!</p>"
                ),
            },
        },
    },
    "challenge_started": {
        "name": "챌린지 거래 시작",
        "description": "챌린지 거래가 시작됐을 때",
        "variables": ["user_name", "challenge_name", "mt4_login", "account_type"],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Your challenge trading has started",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Challenge Trading Started</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>Your challenge account is now active and trading has started.</p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Challenge:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ challenge_name }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Account Type:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ account_type }}</td></tr>\n'
                    "</table>\n"
                    "<p>Good luck with your challenge!</p>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] 챌린지 거래가 시작되었습니다",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">챌린지 거래 시작</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>챌린지 계좌가 활성화되어 거래가 시작되었습니다.</p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>챌린지:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ challenge_name }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>계좌 유형:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ account_type }}</td></tr>\n'
                    "</table>\n"
                    "<p>챌린지에서 좋은 결과 있기를 바랍니다!</p>"
                ),
            },
        },
    },
    "challenge_closed_notify": {
        "name": "챌린지 종료",
        "description": "챌린지 계좌가 종료됐을 때",
        "variables": [
            "user_name",
            "challenge_name",
            "mt4_login",
            "challenge_phase",
            "start_date",
            "end_date",
            "final_balance",
            "profit_pct",
        ],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Your challenge has been closed",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Challenge Closed</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>Your challenge account has been closed.</p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Challenge:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ challenge_name }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Phase:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ challenge_phase }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Period:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ start_date }} – {{ end_date }} (GMT)</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Final Balance:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ final_balance }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Profit:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ profit_pct }}%</td></tr>\n'
                    "</table>\n"
                    "<p>Please check your dashboard for detailed results.</p>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] 챌린지가 종료되었습니다",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">챌린지 종료</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>회원님의 챌린지 계좌가 종료되었습니다.</p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>챌린지:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ challenge_name }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>단계:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ challenge_phase }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>기간:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ start_date }} – {{ end_date }} (GMT)</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>최종 잔고:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ final_balance }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>수익률:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ profit_pct }}%</td></tr>\n'
                    "</table>\n"
                    "<p>자세한 결과는 대시보드에서 확인해 주세요.</p>"
                ),
            },
        },
    },
    "challenge_passed": {
        "name": "챌린지 합격",
        "description": "챌린지 결과 합격 시",
        "variables": [
            "user_name",
            "challenge_name",
            "mt4_login",
            "start_date",
            "end_date",
        ],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Congratulations! You passed the challenge",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Challenge Result Notification</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>Congratulations on ranking in the <strong>top 10%</strong> of all Challenge participants!</p>\n"
                    "<p><strong>Account Details</strong></p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Challenge Type:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ challenge_name }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login Account:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Period:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ start_date }} – {{ end_date }} (GMT)</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Result:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">Pass</td></tr>\n'
                    "</table>\n"
                    "<p>Your funded account information will be sent to your email within <strong>24 hours</strong>. If you do not receive the email within this period, please contact us at support.</p>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] 축하합니다! 챌린지에 합격했습니다",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">챌린지 결과 안내</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>전체 챌린지 참가자 중 <strong>상위 10%</strong>에 드신 것을 축하드립니다!</p>\n"
                    "<p><strong>계좌 정보</strong></p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>챌린지 유형:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ challenge_name }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인 계정:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>기간:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ start_date }} – {{ end_date }} (GMT)</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>결과:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">합격</td></tr>\n'
                    "</table>\n"
                    "<p>펀디드 계좌 정보는 <strong>24시간</strong> 안에 메일로 보내 드립니다. 이 기간 안에 메일을 받지 못하시면 고객센터로 문의해 주세요.</p>"
                ),
            },
        },
    },
    "challenge_failed": {
        "name": "챌린지 불합격",
        "description": "챌린지 결과 불합격 시",
        "variables": [
            "user_name",
            "challenge_name",
            "mt4_login",
            "start_date",
            "end_date",
        ],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Challenge result notification",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Challenge Result Notification</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>Unfortunately, you did not meet the required criteria for the Challenge, and your participation has been disqualified.</p>\n"
                    "<p><strong>Account Details</strong></p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Challenge Type:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ challenge_name }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login Account:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Period:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ start_date }} – {{ end_date }} (GMT)</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Result:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">Fail</td></tr>\n'
                    "</table>\n"
                    "<p>Don't give up! You can purchase a new challenge ticket and try again.</p>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] 챌린지 결과 안내",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">챌린지 결과 안내</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>아쉽게도 챌린지 기준을 충족하지 못해 불합격 처리되었습니다.</p>\n"
                    "<p><strong>계좌 정보</strong></p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>챌린지 유형:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ challenge_name }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인 계정:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>기간:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ start_date }} – {{ end_date }} (GMT)</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>결과:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">불합격</td></tr>\n'
                    "</table>\n"
                    "<p>포기하지 마세요! 새 챌린지 티켓을 구매해 다시 도전할 수 있습니다.</p>"
                ),
            },
        },
    },
    "account_violated": {
        "name": "규정 위반 감지",
        "description": "거래 규칙 위반으로 계좌가 실패 처리됐을 때",
        "variables": ["user_name", "account_type", "mt4_login", "message", "rule_key"],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Rule violation detected on your account",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Account Rule Violation Detected</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>A rule violation was detected on your {{ account_type }} account.</p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Violation Reason:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ message }} ({{ rule_key }})</td></tr>\n'
                    "</table>\n"
                    "<p>Consequently, your account has been marked as FAILED and trading has been locked.</p>\n"
                    "<p>Please check your dashboard for more details.</p>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] 계좌에서 규정 위반이 감지되었습니다",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">계좌 규정 위반 감지</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>회원님의 {{ account_type }} 계좌에서 규정 위반이 감지되었습니다.</p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>위반 사유:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ message }} ({{ rule_key }})</td></tr>\n'
                    "</table>\n"
                    "<p>이에 따라 계좌가 실패(FAILED) 처리되었고 거래가 잠겼습니다.</p>\n"
                    "<p>자세한 내용은 대시보드에서 확인해 주세요.</p>"
                ),
            },
        },
    },
    "margin_call_warning": {
        "name": "마진콜 경고",
        "description": "계좌 손실이 위험 수준에 가까워졌을 때",
        "variables": [
            "user_name",
            "mt4_login",
            "rule_key",
            "message",
            "current_equity",
            "remaining",
            "dashboard_url",
        ],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Margin call warning",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Margin Call Warning</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>A risk warning was triggered on your trading account.</p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Rule:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ rule_key }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Message:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ message }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Current Equity:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ current_equity }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Remaining Buffer:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ remaining }}</td></tr>\n'
                    "</table>\n"
                    "<p>Please review your positions and risk exposure immediately.</p>\n"
                    "{% if dashboard_url %}\n"
                    '<div style="text-align:center;margin:24px 0;">\n'
                    '<a href="{{ dashboard_url }}" style="background:#1a1a2e;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">Open Dashboard</a>\n'
                    "</div>\n"
                    "{% endif %}"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] 마진콜 경고",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">마진콜 경고</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>회원님의 거래 계좌에서 위험 경고가 발생했습니다.</p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>규칙:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ rule_key }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>내용:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ message }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>현재 Equity:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ current_equity }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>남은 여유분:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ remaining }}</td></tr>\n'
                    "</table>\n"
                    "<p>보유 포지션과 위험 노출을 즉시 확인해 주세요.</p>\n"
                    "{% if dashboard_url %}\n"
                    '<div style="text-align:center;margin:24px 0;">\n'
                    '<a href="{{ dashboard_url }}" style="background:#1a1a2e;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">대시보드 열기</a>\n'
                    "</div>\n"
                    "{% endif %}"
                ),
            },
        },
    },
    "account_suspended": {
        "name": "거래 계좌 일시 정지",
        "description": "거래 계좌(MT4)를 일시 정지했을 때",
        "variables": ["user_name", "mt4_login", "reason"],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Your trading account has been suspended",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Account Temporarily Suspended</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>Your trading account has been temporarily suspended.</p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Reason:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reason }}</td></tr>\n'
                    "</table>\n"
                    "<p>Your trading access has been temporarily restricted. If you have any questions or believe this is an error, please contact our support team.</p>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] 거래 계좌가 일시 정지되었습니다",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">계정 일시 정지</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>회원님의 거래 계좌가 일시 정지되었습니다.</p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>사유:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reason }}</td></tr>\n'
                    "</table>\n"
                    "<p>거래가 일시적으로 제한되었습니다. 문의 사항이 있거나 착오라고 생각되시면 고객센터로 문의해 주세요.</p>"
                ),
            },
        },
    },
    "account_banned": {
        "name": "거래 계좌 영구 정지",
        "description": "거래 계좌(MT4)를 영구 정지했을 때",
        "variables": ["user_name", "mt4_login", "reason"],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Your trading account has been banned",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Account Permanently Banned</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>Your trading account has been permanently banned due to a violation of our terms of service.</p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Reason:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reason }}</td></tr>\n'
                    "</table>\n"
                    "<p>Please contact our support team if you believe this is an error or need further information.</p>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] 거래 계좌가 영구 정지되었습니다",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">계정 영구 정지</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>이용 약관 위반으로 회원님의 거래 계좌가 영구 정지되었습니다.</p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>사유:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reason }}</td></tr>\n'
                    "</table>\n"
                    "<p>착오라고 생각되시거나 자세한 내용이 필요하시면 고객센터로 문의해 주세요.</p>"
                ),
            },
        },
    },
    "funding_account_issued": {
        "name": "펀디드 계좌 발급",
        "description": "펀디드 MT4 계좌가 발급됐을 때",
        "variables": [
            "user_name",
            "mt4_login",
            "mt4_password",
            "end_date",
            "start_date",
        ],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Your funded account has been issued",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Funded Account Issued</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>Your funded's account &amp; password has been successfully issued.</p>\n"
                    "<p><strong>Account Details</strong></p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login Account:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Password:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_password }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Start Date:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{% if end_date %}{{ start_date }} – {{ end_date }} (GMT){% else %}{{ start_date }} (GMT){% endif %}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Server:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">MexnLimited-Live</td></tr>\n'
                    "</table>\n"
                    "<p>You can now log in to MT4 and start trading. Good luck!</p>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] 펀디드 계좌가 발급되었습니다",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">펀디드 계좌 발급</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>펀디드 계좌와 비밀번호가 발급되었습니다.</p>\n"
                    "<p><strong>계좌 정보</strong></p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인 계정:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>비밀번호:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_password }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>시작일:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{% if end_date %}{{ start_date }} – {{ end_date }} (GMT){% else %}{{ start_date }} (GMT){% endif %}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>서버:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">MexnLimited-Live</td></tr>\n'
                    "</table>\n"
                    "<p>이제 MT4에 로그인해 거래를 시작할 수 있습니다. 행운을 빕니다!</p>"
                ),
            },
        },
    },
    "funding_started_notify": {
        "name": "펀디드 시작 예정 안내",
        "description": "펀디드 거래 시작 전 계좌 정보 안내",
        "variables": [
            "user_name",
            "funding_name",
            "mt4_login",
            "mt4_password",
            "mt4_server",
        ],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Your funded account is starting soon",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Your Funded Account Is Starting Soon</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>Your funded account is ready. Please use the credentials below to log in to MT4.</p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Funded Program:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ funding_name }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Password:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_password }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Server:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_server }}</td></tr>\n'
                    "</table>\n"
                    "<p>Good luck with your funded trading!</p>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] 펀디드 계좌 거래가 곧 시작됩니다",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">펀디드 계좌 거래가 곧 시작됩니다</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>펀디드 계좌가 준비되었습니다. 아래 정보로 MT4에 로그인해 주세요.</p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>펀디드 프로그램:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ funding_name }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>비밀번호:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_password }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>서버:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_server }}</td></tr>\n'
                    "</table>\n"
                    "<p>펀디드 거래에서 좋은 결과 있기를 바랍니다!</p>"
                ),
            },
        },
    },
    "funding_started": {
        "name": "펀디드 거래 시작",
        "description": "펀디드 거래가 시작됐을 때",
        "variables": ["user_name", "funding_name", "mt4_login", "account_type"],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Your funded trading has started",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Funded Trading Started</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>Your funded account is now active and trading has started.</p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Program:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ funding_name }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Account Type:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ account_type }}</td></tr>\n'
                    "</table>\n"
                    "<p>Good luck with your funded trading!</p>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] 펀디드 거래가 시작되었습니다",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">펀디드 거래 시작</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>펀디드 계좌가 활성화되어 거래가 시작되었습니다.</p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>프로그램:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ funding_name }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>계좌 유형:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ account_type }}</td></tr>\n'
                    "</table>\n"
                    "<p>펀디드 거래에서 좋은 결과 있기를 바랍니다!</p>"
                ),
            },
        },
    },
    "funding_suspended": {
        "name": "펀디드 계좌 일시 정지",
        "description": "펀디드 계좌를 일시 정지했을 때",
        "variables": ["user_name", "funding_name", "mt4_login", "reason"],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Your funded account has been suspended",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Funded Account Suspended</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>Your funded account has been temporarily suspended.</p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Funded Program:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ funding_name }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Reason:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reason }}</td></tr>\n'
                    "</table>\n"
                    "<p>If you have any questions, please contact our support team.</p>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] 펀디드 계좌가 일시 정지되었습니다",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">펀디드 계좌 일시 정지</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>회원님의 펀디드 계좌가 일시 정지되었습니다.</p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>펀디드 프로그램:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ funding_name }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>사유:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reason }}</td></tr>\n'
                    "</table>\n"
                    "<p>문의 사항이 있으시면 고객센터로 문의해 주세요.</p>"
                ),
            },
        },
    },
    "funding_terminated": {
        "name": "펀디드 계좌 해지",
        "description": "펀디드 계좌가 해지됐을 때",
        "variables": ["user_name", "funding_name", "mt4_login", "reason"],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Your funded account has been terminated",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Funded Account Terminated</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>Your funded account has been terminated.</p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Funded Program:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ funding_name }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Reason:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reason }}</td></tr>\n'
                    "</table>\n"
                    "<p>Please contact our support team if you need further information.</p>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] 펀디드 계좌가 해지되었습니다",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">펀디드 계좌 해지</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>회원님의 펀디드 계좌가 해지되었습니다.</p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>펀디드 프로그램:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ funding_name }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>사유:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reason }}</td></tr>\n'
                    "</table>\n"
                    "<p>자세한 내용이 필요하시면 고객센터로 문의해 주세요.</p>"
                ),
            },
        },
    },
    "funding_closed_notify": {
        "name": "펀디드 계좌 종료",
        "description": "펀디드 계좌가 종료됐을 때",
        "variables": ["user_name", "mt4_login"],
        "locales": {
            "en": {
                "subject": "[Altos Funding] Your funded account has been closed",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">Funded Account Closed</h2>\n'
                    "<p>Dear {{ user_name }},</p>\n"
                    "<p>Your funded account (Login: {{ mt4_login }}) has been closed.</p>\n"
                    "<p>Please refer to your dashboard for the detailed settlement reports.</p>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding] 펀디드 계좌가 종료되었습니다",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">펀디드 계좌 종료</h2>\n'
                    "<p>{{ user_name }}님, 안녕하세요.</p>\n"
                    "<p>회원님의 펀디드 계좌(로그인: {{ mt4_login }})가 종료되었습니다.</p>\n"
                    "<p>자세한 정산 내역은 대시보드에서 확인해 주세요.</p>"
                ),
            },
        },
    },
    "mts_operation_failed": {
        "name": "MT4 작업 실패 (관리자 알림)",
        "description": "MT4 계좌 생성·변경 작업 실패 시 관리자에게 발송",
        "variables": [
            "operation",
            "mt4_login",
            "context",
            "reference_id",
            "severity",
            "error_message",
        ],
        "locales": {
            "en": {
                "subject": "[Altos Funding][Alert] MT4 operation failed: {{ operation }}",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">MTS Operation Failed</h2>\n'
                    "<p>An MT4/MTS operation has failed and requires immediate attention.</p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 Login:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Operation:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ operation }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Context:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ context }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Reference ID:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reference_id }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Severity:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ severity }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>Error:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ error_message }}</td></tr>\n'
                    "</table>"
                ),
            },
            "ko": {
                "subject": "[Altos Funding][알림] MT4 작업 실패: {{ operation }}",
                "html": (
                    '<h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px 0;">MT4 작업 실패</h2>\n'
                    "<p>MT4/MTS 작업이 실패했습니다. 즉시 확인이 필요합니다.</p>\n"
                    '<table width="100%" style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0;">\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>MT4 로그인:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ mt4_login }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>작업:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ operation }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>상황:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ context }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>참조 ID:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ reference_id }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>심각도:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ severity }}</td></tr>\n'
                    '<tr><td style="background:#f5f4fb;font-weight:600;width:40%;padding:7px 12px;border:1px solid #e8e6f0;"><strong>오류:</strong></td><td style="padding:7px 12px;border:1px solid #e8e6f0;">{{ error_message }}</td></tr>\n'
                    "</table>"
                ),
            },
        },
    },
    "manual_broadcast": {
        "name": "수동 발송 (공통)",
        "description": "백오피스 수동 발송 시 본문을 감싸는 템플릿",
        "variables": ["subject", "body_html", "is_marketing", "unsubscribe_url"],
        "locales": {
            "en": {
                "subject": "{{ subject }}",
                "html": (
                    "{{ body_html | safe }}\n"
                    "{% if is_marketing %}\n"
                    "<hr/>\n"
                    '<p style="font-size:12px;color:#666;">\n'
                    'If you no longer wish to receive these emails, click <a href="{{ unsubscribe_url }}">Unsubscribe</a>.\n'
                    "</p>\n"
                    "{% endif %}"
                ),
            },
            "ko": {
                "subject": "{{ subject }}",
                "html": (
                    "{{ body_html | safe }}\n"
                    "{% if is_marketing %}\n"
                    "<hr/>\n"
                    '<p style="font-size:12px;color:#666;">\n'
                    '더 이상 이 메일을 받고 싶지 않으시면 <a href="{{ unsubscribe_url }}">수신 거부</a>를 눌러 주세요.\n'
                    "</p>\n"
                    "{% endif %}"
                ),
            },
        },
    },
}
