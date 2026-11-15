"""백오피스 회원 관리. 경로·요청·응답은 기존 서버와 같다."""

import math
import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.v1.auth import Session
from app.deps import AdminUser
from app.errors import AppError
from app.models import User
from app.schemas.auth import (
    AdminPasswordResetRequest,
    AdminProfileUpdateRequest,
    AdminUserCreateRequest,
    BanRequest,
    StatusHistoryOut,
    StatusHistoryPage,
    SuspendRequest,
    UserOut,
    UserPage,
)
from app.services import user_admin

router = APIRouter(prefix="/admin/users", tags=["admin-users"])

Page = Annotated[int, Query(ge=1)]
Size = Annotated[int, Query(ge=1, le=100)]


def _pages(total: int, size: int) -> int:
    return math.ceil(total / size) if total else 0


async def _get_user(session, user_id: uuid.UUID, *, lock: bool = False) -> User:
    user = await session.get(User, user_id, with_for_update=lock)
    if user is None:
        raise AppError(404, "not_found", "user not found")
    return user


@router.get("/summary", summary="회원 목록 상단 요약 통계")
async def users_summary(admin: AdminUser, session: Session) -> dict:
    return await user_admin.summary(session)


@router.get("", response_model=UserPage, summary="회원 목록")
async def list_users(
    admin: AdminUser,
    session: Session,
    keyword: str | None = None,
    status: str | None = None,
    grade: str | None = None,
    kyc_status: str | None = None,
    is_active: bool | None = None,
    page: Page = 1,
    size: Size = 20,
) -> UserPage:
    """keyword는 이메일, 회원 번호, 이름, 전화번호, 초대 코드에서 찾는다. 탈퇴 회원은 status=WITHDRAWN일 때만 보인다."""
    items, total = await user_admin.list_users(
        session, keyword=keyword, status=status, grade=grade, kyc_status=kyc_status,
        is_active=is_active, page=page, size=size,
    )
    return UserPage(items=items, total=total, page=page, size=size, pages=_pages(total, size))


@router.post("", response_model=UserOut, status_code=status.HTTP_200_OK, summary="회원 직접 생성")
async def create_user(body: AdminUserCreateRequest, admin: AdminUser, session: Session) -> UserOut:
    """관리자가 만든 회원은 이메일 인증을 마친 상태로 만들어진다."""
    user = await user_admin.create_user(session, body.model_dump(), admin)
    await session.commit()
    return await user_admin.user_out(session, user, for_admin=True)


@router.get("/{user_id}", response_model=UserOut, summary="회원 상세")
async def get_user(user_id: uuid.UUID, admin: AdminUser, session: Session) -> UserOut:
    return await user_admin.user_out(session, await _get_user(session, user_id), for_admin=True)


@router.patch("/{user_id}/profile", response_model=UserOut, summary="회원 정보 수정")
async def update_user(
    user_id: uuid.UUID, body: AdminProfileUpdateRequest, admin: AdminUser, session: Session
) -> UserOut:
    user = await _get_user(session, user_id, lock=True)
    await user_admin.update_user(session, user, body.model_dump(exclude_unset=True), admin)
    await session.commit()
    return await user_admin.user_out(session, user, for_admin=True)


async def _change(session, user_id: uuid.UUID, to_status: str, reason: str | None, admin: User) -> dict:
    user = await _get_user(session, user_id, lock=True)
    await user_admin.change_status(session, user, to_status, reason, admin.id)
    await session.commit()
    return {"ok": True, "user_id": str(user.id), "status": user.status}


@router.post("/{user_id}/suspend", summary="회원 비활성 (로그인 차단)")
async def suspend_user(user_id: uuid.UUID, body: SuspendRequest, admin: AdminUser, session: Session) -> dict:
    return await _change(session, user_id, "INACTIVE", body.reason, admin)


@router.post("/{user_id}/ban", summary="회원 영구 정지")
async def ban_user(user_id: uuid.UUID, body: BanRequest, admin: AdminUser, session: Session) -> dict:
    """MT4 계좌 차단은 트레이딩 계좌 기능을 옮길 때 함께 연결한다."""
    if body.admin_note is not None:
        user = await _get_user(session, user_id, lock=True)
        user.admin_note = body.admin_note
    return await _change(session, user_id, "BANNED", body.reason, admin)


@router.post("/{user_id}/activate", summary="회원 활성 복귀")
async def activate_user(user_id: uuid.UUID, admin: AdminUser, session: Session) -> dict:
    return await _change(session, user_id, "ACTIVE", "관리자 활성화", admin)


@router.post("/{user_id}/withdraw", summary="회원 탈퇴 처리 (개인정보 익명화)")
async def withdraw_user(user_id: uuid.UUID, admin: AdminUser, session: Session) -> dict:
    user = await _get_user(session, user_id, lock=True)
    if user.role == "ADMIN":
        raise AppError(400, "cannot_block_admin", "관리자 계정은 탈퇴 처리할 수 없습니다.")
    await user_admin.withdraw(session, user, "관리자 탈퇴 처리", admin.id)
    await session.commit()
    return {"ok": True, "user_id": str(user.id), "status": user.status}


@router.post("/{user_id}/reset-password", summary="회원 비밀번호 강제 재설정")
async def reset_user_password(
    user_id: uuid.UUID, body: AdminPasswordResetRequest, admin: AdminUser, session: Session
) -> dict:
    """새 비밀번호로 바꾸고 그 회원의 모든 기기 로그인을 끊는다."""
    user = await _get_user(session, user_id, lock=True)
    if user.status == "WITHDRAWN":
        raise AppError(409, "account_already_withdrawn", "Account is already withdrawn")
    await user_admin.set_password(session, user, body.new_password)
    await session.commit()
    return {"ok": True}


@router.get("/{user_id}/status-history", response_model=StatusHistoryPage, summary="회원 상태 변경 이력")
async def user_status_history(
    user_id: uuid.UUID, admin: AdminUser, session: Session, page: Page = 1, size: Size = 20
) -> StatusHistoryPage:
    await _get_user(session, user_id)
    rows, total = await user_admin.status_history(session, user_id, page, size)
    items = [
        StatusHistoryOut(
            id=r.id, user_id=str(r.user_id), from_status=r.from_status, to_status=r.to_status,
            reason=r.reason, changed_by=str(r.changed_by) if r.changed_by else None, created_at=r.created_at,
        )
        for r in rows
    ]
    return StatusHistoryPage(items=items, total=total, page=page, size=size, pages=_pages(total, size))
