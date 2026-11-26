"""관리자 제휴사 회원 API: 제휴사(10Power·xnsoft)에서 가져온 회원 목록과 가져오기 실행·이력.

- GET  /admin/partner-members            회원 목록 (사이트·상태·계정 연결·구독 필터, Member ID·이름·이메일 검색)
- GET  /admin/partner-members/summary    상단 요약 (전체·상태별·계정 연결·구독 활성)
- GET  /admin/partner-members/sync       가져오기 설정·진행 상태 (실행 중 회차, 마지막 성공, 다음 자동 실행)
- POST /admin/partner-members/sync       가져오기 실행 {mode: INCREMENTAL(지금 가져오기) | FULL(전체 다시 가져오기)}
- GET  /admin/partner-members/sync-runs  가져오기 이력
- GET  /admin/partner-members/sync-runs/{id}  회차 상세 (실패 항목 포함)
"""

import math
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select

from app.config import settings
from app.deps import AdminUser, Session
from app.errors import AppError
from app.models import PartnerMember, PartnerMemberSyncRun, User
from app.services import partner_sync

router = APIRouter(prefix="/admin/partner-members", tags=["admin-partner-members"])

KST = timezone(timedelta(hours=9))
Page = Annotated[int, Query(ge=1)]
Size = Annotated[int, Query(ge=1, le=100)]


def _today_kst() -> date:
    return datetime.now(KST).date()


def _pages(total: int, size: int) -> int:
    return math.ceil(total / size) if total else 0


class PartnerMemberOut(BaseModel):
    member_id: str
    site: str
    name: str
    email: str | None
    phone: str | None
    sponsor_member_id: str | None
    status: str
    joined_at: datetime
    membership_expires_on: date | None
    # 명세대로 expires_on으로 지금 판정 (만료일 당일까지 활성, KST)
    membership_active: bool
    partner_updated_at: datetime
    last_synced_at: datetime
    # 연결된 Altos 계정 (활성화 전이면 null)
    user_id: uuid.UUID | None = None
    user_uid: str | None = None
    user_email: str | None = None
    user_status: str | None = None
    activated_at: datetime | None = None


class PartnerMemberPage(BaseModel):
    items: list[PartnerMemberOut]
    total: int
    page: int
    size: int
    pages: int


class SyncRunOut(BaseModel):
    id: int
    mode: str
    status: str
    requested_by: uuid.UUID | None
    requested_by_email: str | None = None
    since: datetime | None
    as_of: datetime | None
    pages: int
    fetched: int
    inserted: int
    updated: int
    unchanged: int
    failed: int
    deactivated: int
    reactivated: int
    error: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class SyncRunDetail(SyncRunOut):
    failures: list[dict]


class SyncRunPage(BaseModel):
    items: list[SyncRunOut]
    total: int
    page: int
    size: int
    pages: int


class SyncStatus(BaseModel):
    configured: bool
    mock: bool
    interval_minutes: int
    running: SyncRunOut | None
    last_succeeded: SyncRunOut | None
    next_auto_at: datetime | None


class SyncRequest(BaseModel):
    mode: Literal["INCREMENTAL", "FULL"] = "INCREMENTAL"


def _member_out(p: PartnerMember, user: User | None) -> PartnerMemberOut:
    return PartnerMemberOut(
        member_id=p.member_id,
        site=p.site,
        name=p.name,
        email=p.email,
        phone=p.phone,
        sponsor_member_id=p.sponsor_member_id,
        status=p.status,
        joined_at=p.joined_at,
        membership_expires_on=p.membership_expires_on,
        membership_active=bool(p.membership_expires_on and p.membership_expires_on >= _today_kst()),
        partner_updated_at=p.partner_updated_at,
        last_synced_at=p.last_synced_at,
        user_id=user.id if user else None,
        user_uid=user.uid if user else None,
        user_email=user.email if user else None,
        user_status=user.status if user else None,
        activated_at=user.created_at if user else None,
    )


def _run_out(run: PartnerMemberSyncRun, email: str | None = None, *, detail: bool = False) -> SyncRunOut:
    data = {c: getattr(run, c) for c in SyncRunOut.model_fields if c != "requested_by_email"}
    data["requested_by_email"] = email
    if detail:
        return SyncRunDetail(**data, failures=run.failures or [])
    return SyncRunOut(**data)


@router.get("", response_model=PartnerMemberPage, summary="제휴사 회원 목록")
async def list_partner_members(
    admin: AdminUser,
    session: Session,
    keyword: str | None = None,
    site: str | None = None,
    status: str | None = None,
    linked: bool | None = None,
    membership: Literal["active", "expired", "none"] | None = None,
    page: Page = 1,
    size: Size = 20,
) -> PartnerMemberPage:
    """keyword는 Member ID·이름·이메일·전화·추천인 ID에서 찾는다. linked=true면 Altos 계정이 있는 회원만."""
    conditions = []
    if keyword and keyword.strip():
        like = f"%{keyword.strip()}%"
        conditions.append(
            or_(
                PartnerMember.member_id.ilike(like),
                PartnerMember.name.ilike(like),
                PartnerMember.email.ilike(like),
                PartnerMember.phone.ilike(like),
                PartnerMember.sponsor_member_id.ilike(like),
            )
        )
    if site:
        conditions.append(PartnerMember.site == site)
    if status:
        conditions.append(PartnerMember.status == status)
    today = _today_kst()
    if membership == "active":
        conditions.append(PartnerMember.membership_expires_on >= today)
    elif membership == "expired":
        conditions.append(PartnerMember.membership_expires_on < today)
    elif membership == "none":
        conditions.append(PartnerMember.membership_expires_on.is_(None))
    if linked is True:
        conditions.append(User.id.is_not(None))
    elif linked is False:
        conditions.append(User.id.is_(None))

    join = and_(User.partner_member_id == PartnerMember.member_id)
    total = (
        await session.scalar(
            select(func.count()).select_from(PartnerMember).outerjoin(User, join).where(*conditions)
        )
        or 0
    )
    rows = await session.execute(
        select(PartnerMember, User)
        .outerjoin(User, join)
        .where(*conditions)
        .order_by(PartnerMember.joined_at.desc(), PartnerMember.member_id)
        .offset((page - 1) * size)
        .limit(size)
    )
    items = [_member_out(p, u) for p, u in rows.all()]
    return PartnerMemberPage(items=items, total=total, page=page, size=size, pages=_pages(total, size))


@router.get("/summary", summary="제휴사 회원 요약")
async def partner_members_summary(admin: AdminUser, session: Session) -> dict:
    today = _today_kst()
    row = (
        await session.execute(
            select(
                func.count(PartnerMember.member_id),
                func.count().filter(PartnerMember.status == "active"),
                func.count().filter(PartnerMember.status == "unconfirmed"),
                func.count().filter(PartnerMember.status == "suspended"),
                func.count().filter(PartnerMember.status == "deleted"),
                func.count(User.id),
                func.count().filter(PartnerMember.membership_expires_on >= today),
                func.count().filter(PartnerMember.email.is_(None)),
            )
            .select_from(PartnerMember)
            .outerjoin(User, User.partner_member_id == PartnerMember.member_id)
        )
    ).one()
    return {
        "total": row[0],
        "status": {"active": row[1], "unconfirmed": row[2], "suspended": row[3], "deleted": row[4]},
        "linked": row[5],
        "membership_active": row[6],
        "no_email": row[7],
    }


async def _emails(session, ids: set[uuid.UUID]) -> dict[uuid.UUID, str]:
    if not ids:
        return {}
    rows = await session.execute(select(User.id, User.email).where(User.id.in_(ids)))
    return dict(rows.all())


@router.get("/sync", response_model=SyncStatus, summary="가져오기 설정·진행 상태")
async def sync_status(admin: AdminUser, session: Session) -> SyncStatus:
    running = await partner_sync.active_run(session)
    last = await partner_sync.last_succeeded(session)
    interval = settings.partner_sync_interval_minutes
    next_auto_at = None
    if partner_sync.is_configured() and interval > 0:
        last_auto = await session.scalar(
            select(func.max(PartnerMemberSyncRun.created_at)).where(PartnerMemberSyncRun.requested_by.is_(None))
        )
        if last_auto is not None:
            next_auto_at = last_auto + timedelta(minutes=interval)
    emails = await _emails(session, {r.requested_by for r in (running, last) if r and r.requested_by})
    return SyncStatus(
        configured=partner_sync.is_configured(),
        mock=partner_sync.is_mock(),
        interval_minutes=interval,
        running=_run_out(running, emails.get(running.requested_by)) if running else None,
        last_succeeded=_run_out(last, emails.get(last.requested_by)) if last else None,
        next_auto_at=next_auto_at,
    )


@router.post("/sync", response_model=SyncRunOut, summary="가져오기 실행")
async def start_sync(body: SyncRequest, admin: AdminUser, session: Session) -> SyncRunOut:
    """INCREMENTAL = 지금 가져오기(바뀐 회원만), FULL = 전체 다시 가져오기. Worker가 곧 실행한다."""
    run = await partner_sync.start(session, body.mode, admin.id)
    await session.commit()
    await session.refresh(run)
    return _run_out(run, admin.email)


@router.get("/sync-runs", response_model=SyncRunPage, summary="가져오기 이력")
async def list_sync_runs(admin: AdminUser, session: Session, page: Page = 1, size: Size = 20) -> SyncRunPage:
    total = await session.scalar(select(func.count()).select_from(PartnerMemberSyncRun)) or 0
    runs = list(
        await session.scalars(
            select(PartnerMemberSyncRun)
            .order_by(PartnerMemberSyncRun.created_at.desc(), PartnerMemberSyncRun.id.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
    )
    emails = await _emails(session, {r.requested_by for r in runs if r.requested_by})
    items = [_run_out(r, emails.get(r.requested_by)) for r in runs]
    return SyncRunPage(items=items, total=total, page=page, size=size, pages=_pages(total, size))


@router.get("/sync-runs/{run_id}", response_model=SyncRunDetail, summary="가져오기 회차 상세")
async def get_sync_run(run_id: int, admin: AdminUser, session: Session) -> SyncRunOut:
    run = await session.get(PartnerMemberSyncRun, run_id)
    if run is None:
        raise AppError(404, "not_found", "sync run not found")
    emails = await _emails(session, {run.requested_by} if run.requested_by else set())
    return _run_out(run, emails.get(run.requested_by), detail=True)
