"""파일 API.

POST /admin/files     관리자 이미지 올리기 (수동 발송 메일 본문 등). multipart 'file'
GET  /files/{id}      공개 이미지 주소 (메일 수신자가 로그인 없이 본다)
"""

from typing import Annotated

from fastapi import APIRouter, File, Query, Request, Response, UploadFile

from app.deps import AdminUser, Session
from app.services import files as svc

router = APIRouter(tags=["files"])


@router.post("/admin/files", summary="이미지 올리기 (관리자)")
async def upload_file(
    request: Request,
    admin: AdminUser,
    session: Session,
    file: Annotated[UploadFile, File()],
    storage: Annotated[str | None, Query(description="무시됨 (항상 DB에 저장)")] = None,
    ref_domain: Annotated[str | None, Query()] = None,
    ref_id: Annotated[str | None, Query()] = None,
) -> dict:
    """PNG·JPG·GIF·WEBP, 5MB까지. 돌려준 url을 메일 본문 <img src>에 쓴다."""
    data = await file.read(svc.MAX_IMAGE_BYTES + 1)
    saved = await svc.save_image(
        session,
        filename=file.filename or "image",
        data=data,
        ref_domain=ref_domain,
        ref_id=ref_id,
        admin_id=admin.id,
    )
    await session.commit()
    url = f"{svc.public_base_url(str(request.base_url))}/api/v1/files/{saved.id}"
    return {
        "id": str(saved.id),
        "storage": "local",
        "url": url,
        "original_filename": saved.original_filename,
        "content_type": saved.content_type,
        "size_bytes": saved.size_bytes,
        "ref_domain": saved.ref_domain,
        "ref_id": saved.ref_id,
        "created_at": saved.created_at.isoformat(),
        "created_by": str(saved.created_by) if saved.created_by else None,
    }


@router.get("/files/{file_id}", summary="이미지 보기 (공개)", response_class=Response)
async def get_file(file_id: str, session: Session) -> Response:
    file = await svc.get_file(session, file_id)
    return Response(
        content=file.data,
        media_type=file.content_type,
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": "inline",
        },
    )
