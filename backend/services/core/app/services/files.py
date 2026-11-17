"""관리자가 올린 파일 (메일 본문 이미지 등). DB(core.uploaded_files)에 저장하고 공개 주소로 내준다.

Render 무료 플랜은 디스크가 재배포 때 지워져서 로컬 파일 대신 DB에 둔다.
메일을 받은 사람이 로그인 없이 이미지를 봐야 하므로 GET /files/{id}는 공개다 (id는 추측할 수 없는 UUID).
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.errors import AppError
from app.models import UploadedFile

MAX_IMAGE_BYTES = 5 * 1024 * 1024
# 매직 바이트로 형식을 확인한다 (SVG·HTML은 받지 않는다).
_SIGNATURES = {
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/gif": (b"GIF87a", b"GIF89a"),
}


def detect_image_type(data: bytes) -> str | None:
    for content_type, signatures in _SIGNATURES.items():
        if any(data.startswith(s) for s in signatures):
            return content_type
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def public_base_url(request_base_url: str) -> str:
    return (settings.core_public_url or settings.render_external_url or request_base_url).rstrip("/")


async def save_image(
    session: AsyncSession,
    *,
    filename: str,
    data: bytes,
    ref_domain: str | None,
    ref_id: str | None,
    admin_id: uuid.UUID,
) -> UploadedFile:
    if not data:
        raise AppError(422, "empty_file", "빈 파일입니다.")
    if len(data) > MAX_IMAGE_BYTES:
        raise AppError(413, "file_too_large", "이미지는 5MB까지 올릴 수 있습니다.")
    content_type = detect_image_type(data)
    if content_type is None:
        raise AppError(415, "unsupported_file_type", "PNG, JPG, GIF, WEBP 이미지만 올릴 수 있습니다.")
    file = UploadedFile(
        ref_domain=(ref_domain or None) and ref_domain[:50],
        ref_id=(ref_id or None) and ref_id[:100],
        original_filename=(filename or "image")[:200],
        content_type=content_type,
        size_bytes=len(data),
        data=data,
        created_by=admin_id,
    )
    session.add(file)
    await session.flush()
    return file


async def get_file(session: AsyncSession, file_id: str) -> UploadedFile:
    try:
        fid = uuid.UUID(file_id)
    except ValueError:
        raise AppError(404, "file_not_found", "파일을 찾을 수 없습니다.") from None
    file = await session.get(UploadedFile, fid)
    if file is None:
        raise AppError(404, "file_not_found", "파일을 찾을 수 없습니다.")
    return file
