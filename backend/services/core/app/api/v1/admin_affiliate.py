"""관리자 제휴 프로그램(IB) API: IB 파트너, 레벨 커미션 비율, 마케팅 비율, 조직도·재배치."""

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.deps import AdminUser, Session
from app.errors import AppError
from app.services import affiliate as svc

router = APIRouter(prefix="/admin/affiliate", tags=["admin-affiliate"])


class PartnerCreate(BaseModel):
    user_id: uuid.UUID
    level: int = Field(ge=1, le=40)
    status: str = "ACTIVE"


class PartnerUpdate(BaseModel):
    level: int | None = Field(default=None, ge=1, le=40)
    status: str | None = None
    reason: str | None = None


class LevelRateItem(BaseModel):
    level: int
    rate: float


class LevelRatesSave(BaseModel):
    rates: list[LevelRateItem]
    effective_from: datetime | None = None
    reason: str | None = None


class MarketingCreate(BaseModel):
    rate: float
    effective_from: datetime | None = None
    reason: str


class RelocateBody(BaseModel):
    member_id: uuid.UUID
    new_parent_id: uuid.UUID
    reason: str


# ── IB 파트너 ──


@router.get("/partners", summary="IB 파트너 목록 (검색·상태·요약)")
async def list_partners(
    admin: AdminUser,
    session: Session,
    keyword: str | None = None,
    status: str | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=200)] = 20,
) -> dict:
    return await svc.list_partners(session, keyword=keyword, status=status, page=page, size=size)


@router.get("/partners/candidates", summary="IB로 추가할 회원 검색 (현재 placement Upline 포함)")
async def partner_candidates(admin: AdminUser, session: Session, keyword: str) -> dict:
    return {"items": await svc.candidates(session, keyword)}


@router.get("/partners/{user_id}", summary="IB 파트너 상세 (변경 이력 포함)")
async def get_partner(user_id: uuid.UUID, admin: AdminUser, session: Session) -> dict:
    return await svc.partner_detail(session, user_id)


@router.post("/partners", summary="IB 파트너 추가")
async def add_partner(body: PartnerCreate, admin: AdminUser, session: Session) -> dict:
    await svc.add_partner(session, user_id=body.user_id, level=body.level, status=body.status, actor=admin)
    await session.commit()
    return await svc.partner_detail(session, body.user_id)


@router.patch("/partners/{user_id}", summary="IB 레벨·상태 변경 (영구정지는 되돌릴 수 없음)")
async def update_partner(user_id: uuid.UUID, body: PartnerUpdate, admin: AdminUser, session: Session) -> dict:
    await svc.update_partner(
        session, user_id=user_id, level=body.level, status=body.status, reason=body.reason, actor=admin
    )
    await session.commit()
    return await svc.partner_detail(session, user_id)


# ── 레벨 커미션 비율 ──


@router.get("/level-rates", summary="레벨 커미션 비율 (현재·예약·이력)")
async def get_level_rates(admin: AdminUser, session: Session) -> dict:
    return await svc.level_rates_overview(session)


@router.put("/level-rates", summary="레벨 커미션 비율 저장 (40개 전체, 새 버전)")
async def save_level_rates(body: LevelRatesSave, admin: AdminUser, session: Session) -> dict:
    await svc.save_level_rates(
        session,
        rates=[i.model_dump() for i in body.rates],
        effective_from=body.effective_from,
        reason=body.reason,
        actor=admin,
    )
    await session.commit()
    return await svc.level_rates_overview(session)


# ── 마케팅 비율 ──


@router.get("/marketing-policy", summary="마케팅 비율 (현재·예약·변경 이력)")
async def get_marketing_policy(admin: AdminUser, session: Session) -> dict:
    return await svc.marketing_overview(session)


@router.post("/marketing-policy", summary="마케팅 비율 변경 (새 버전, 사유 필수)")
async def create_marketing_policy(body: MarketingCreate, admin: AdminUser, session: Session) -> dict:
    await svc.create_marketing_version(
        session, rate=body.rate, effective_from=body.effective_from, reason=body.reason, actor=admin
    )
    await session.commit()
    return await svc.marketing_overview(session)


# ── 조직도·재배치 ──


@router.get("/network", summary="수당 조직도 (placement 기준 하위 트리)")
async def get_network(
    admin: AdminUser, session: Session, user_id: uuid.UUID | None = None, keyword: str | None = None
) -> dict:
    root = None
    if user_id is not None:
        root = await session.get(svc.User, user_id)
    elif keyword:
        root = await svc.find_member(session, keyword)
    if root is None:
        raise AppError(404, "user_not_found", "회원을 찾을 수 없습니다.")
    return await svc.network(session, root)


@router.post("/network/relocate", summary="IB 재배치 (placement Upline 변경, 사유 필수)")
async def relocate(body: RelocateBody, admin: AdminUser, session: Session) -> dict:
    await svc.relocate(
        session, member_id=body.member_id, new_parent_id=body.new_parent_id, reason=body.reason, actor=admin
    )
    await session.commit()
    return await svc.partner_detail(session, body.member_id)
