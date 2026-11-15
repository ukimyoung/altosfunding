import hashlib
import hmac
import secrets
import string

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

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
