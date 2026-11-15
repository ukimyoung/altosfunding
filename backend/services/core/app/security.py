import base64
import hashlib
import hmac
import secrets
import string

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from cryptography.fernet import Fernet

from app.config import settings

_password_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _password_hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def generate_numeric_code(length: int = 6) -> str:
    return "".join(secrets.choice(string.digits) for _ in range(length))


def hash_code(value: str) -> str:
    """인증코드처럼 짧은 값은 비밀 키를 섞은 HMAC으로 저장한다."""
    return hmac.new(settings.secret_key.encode(), value.encode(), hashlib.sha256).hexdigest()


def codes_match(value: str, expected_hash: str) -> bool:
    return hmac.compare_digest(hash_code(value), expected_hash)


# 0/O, 1/I처럼 헷갈리는 문자는 뺀다.
_HUMAN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_human_code(length: int) -> str:
    return "".join(secrets.choice(_HUMAN_ALPHABET) for _ in range(length))


def sha256_hex(value: str) -> str:
    """긴 무작위 토큰(재설정 링크, refresh token 등) 저장용 해시."""
    return hashlib.sha256(value.encode()).hexdigest()


def _fernet() -> Fernet:
    key = hashlib.sha256(f"{settings.secret_key}:field-encryption".encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def encrypt_text(value: str) -> str:
    """TOTP 비밀키처럼 원문을 다시 꺼내 써야 하는 값을 DB에 암호화해 저장한다."""
    return _fernet().encrypt(value.encode()).decode()


def decrypt_text(value: str) -> str:
    return _fernet().decrypt(value.encode()).decode()
