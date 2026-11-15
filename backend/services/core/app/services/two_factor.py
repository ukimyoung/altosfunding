"""2FA (Google Authenticator 등 TOTP 앱) 설정·확인과 백업 코드.

- TOTP 비밀키는 암호화해서 저장하고, 백업 코드는 해시만 저장한다.
- 같은 TOTP 코드는 한 번만 쓸 수 있다.
- 코드를 연속으로 틀리면 잠시 잠근다.
"""

import secrets
import string
import time
from datetime import UTC, datetime, timedelta

import pyotp
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.errors import AppError
from app.models import User, UserBackupCode
from app.security import decrypt_text, encrypt_text, sha256_hex

ISSUER = "AltosFunding"
BACKUP_CODE_COUNT = 10
_BACKUP_CHARSET = string.ascii_uppercase + string.digits


def _now() -> datetime:
    return datetime.now(UTC)


def _generate_backup_code() -> str:
    parts = (4, 5, 4)
    return "-".join("".join(secrets.choice(_BACKUP_CHARSET) for _ in range(n)) for n in parts)


def _hash_backup_code(code: str) -> str:
    return sha256_hex(code.replace("-", "").strip().upper())


async def _replace_backup_codes(session: AsyncSession, user: User) -> list[str]:
    await session.execute(delete(UserBackupCode).where(UserBackupCode.user_id == user.id))
    codes = [_generate_backup_code() for _ in range(BACKUP_CODE_COUNT)]
    session.add_all(UserBackupCode(user_id=user.id, code_hash=_hash_backup_code(c)) for c in codes)
    return codes


def _totp(user: User) -> pyotp.TOTP:
    if not user.totp_secret_encrypted:
        raise AppError(400, "2fa_not_configured", "2FA is not configured for this account")
    return pyotp.TOTP(decrypt_text(user.totp_secret_encrypted))


def _check_totp(user: User, code: str) -> bool:
    """앞뒤 30초까지 허용하고, 이미 쓴 구간의 코드는 거절한다."""
    code = code.strip()
    if not (code.isdigit() and len(code) == 6):
        return False
    totp = _totp(user)
    current_step = int(time.time()) // totp.interval
    for step in (current_step - 1, current_step, current_step + 1):
        if user.totp_last_used_step is not None and step <= user.totp_last_used_step:
            continue
        if secrets.compare_digest(totp.generate_otp(step), code):
            user.totp_last_used_step = step
            return True
    return False


async def _use_backup_code(session: AsyncSession, user: User, code: str) -> bool:
    backup = await session.scalar(
        select(UserBackupCode)
        .where(
            UserBackupCode.user_id == user.id,
            UserBackupCode.code_hash == _hash_backup_code(code),
            UserBackupCode.used_at.is_(None),
        )
        .with_for_update()
    )
    if backup is None:
        return False
    backup.used_at = _now()
    return True


def _ensure_not_locked(user: User) -> None:
    if user.two_factor_locked_until and user.two_factor_locked_until > _now():
        raise AppError(
            429, "2fa_locked", "2FA 코드를 여러 번 틀려 잠시 잠겼습니다. 잠시 후 다시 시도해 주세요."
        )


async def _record_failure(session: AsyncSession, user: User) -> None:
    user.two_factor_failed_count += 1
    if user.two_factor_failed_count >= settings.two_factor_max_failures:
        user.two_factor_locked_until = _now() + timedelta(minutes=settings.two_factor_lock_minutes)
        user.two_factor_failed_count = 0
    await session.commit()


async def verify_code(
    session: AsyncSession, user: User, code: str, allow_backup_code: bool = True
) -> None:
    """TOTP 코드(또는 백업 코드)를 확인한다. 틀리면 AppError. 커밋은 호출한 쪽에서 한다."""
    _ensure_not_locked(user)
    ok = _check_totp(user, code)
    if not ok and allow_backup_code:
        ok = await _use_backup_code(session, user, code)
    if not ok:
        await _record_failure(session, user)
        raise AppError(400, "invalid_2fa_code", "Invalid 2FA code or backup code")
    user.two_factor_failed_count = 0
    user.two_factor_locked_until = None


async def setup(session: AsyncSession, user: User) -> dict:
    """비밀키와 백업 코드를 새로 만든다. verify를 통과해야 2FA가 켜진다."""
    if user.is_2fa_enabled:
        raise AppError(400, "2fa_already_enabled", "2FA is already enabled. Disable it first to reconfigure.")
    secret = pyotp.random_base32(32)
    user.totp_secret_encrypted = encrypt_text(secret)
    user.totp_last_used_step = None
    codes = await _replace_backup_codes(session, user)
    await session.commit()
    return {
        "secret": secret,
        "qr_uri": pyotp.TOTP(secret).provisioning_uri(name=user.email, issuer_name=ISSUER),
        "backup_codes": codes,
    }


async def enable(session: AsyncSession, user: User, code: str) -> None:
    if user.is_2fa_enabled:
        raise AppError(400, "2fa_already_enabled", "2FA is already enabled")
    if not user.totp_secret_encrypted:
        raise AppError(400, "2fa_not_setup", "2FA setup required first. Call POST /auth/2fa/setup")
    # 켜기 전에는 앱에 제대로 등록했는지 TOTP 코드로만 확인한다.
    await verify_code(session, user, code, allow_backup_code=False)
    user.is_2fa_enabled = True
    await session.commit()


async def disable(session: AsyncSession, user: User, code: str) -> None:
    if not user.is_2fa_enabled:
        raise AppError(400, "2fa_not_enabled", "2FA is not currently enabled")
    await verify_code(session, user, code)
    user.is_2fa_enabled = False
    user.totp_secret_encrypted = None
    user.totp_last_used_step = None
    await session.execute(delete(UserBackupCode).where(UserBackupCode.user_id == user.id))
    await session.commit()


async def regenerate_backup_codes(session: AsyncSession, user: User, code: str) -> list[str]:
    if not user.is_2fa_enabled:
        raise AppError(400, "2fa_not_enabled", "2FA must be enabled to regenerate backup codes")
    # 백업 코드로 백업 코드를 다시 만들 수는 없다.
    await verify_code(session, user, code, allow_backup_code=False)
    codes = await _replace_backup_codes(session, user)
    await session.commit()
    return codes
