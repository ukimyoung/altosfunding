"""챌린지 회차·자동 생성 스케줄·휴장일 API. 경로와 응답 형태는 기존 서버와 같다 (휴장일·내부 작업은 새로 추가)."""

import hmac
import math
import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Header, Query

from app.api.v1.auth import Session
from app.config import settings
from app.deps import AdminUser
from app.errors import AppError
from app.schemas.challenge import (
    ChallengeCloseRequest,
    ChallengeCreate,
    ChallengeGroupedPage,
    ChallengeOut,
    ChallengePage,
    ChallengeStatus,
    ChallengeEvaluationOut,
    DailyLeaderboardResponse,
    LeaderboardChallenge,
    LeaderboardSummaryResponse,
    ChallengeOffersResponse,
    ChallengeSummaryResponse,
    HolidayCreate,
    HolidayOut,
    HolidayUpdate,
    JobRunResponse,
    ScheduleCreate,
    ScheduleOut,
    SchedulePage,
    ScheduleStatus,
    ScheduleTriggerResponse,
    ScheduleUpdate,
)
from app.services import challenge as svc
from app.services import challenge_order
from app.services import challenge_evaluation, leaderboard

router = APIRouter(tags=["challenges"])

Page = Annotated[int, Query(ge=1)]
Size = Annotated[int, Query(ge=1, le=100)]


def _pages(total: int, size: int) -> int:
    return math.ceil(total / size) if total else 0


def _now() -> datetime:
    return datetime.now(UTC)


async def _out(session, challenge) -> ChallengeOut:
    await session.refresh(challenge)
    return ChallengeOut.model_validate(challenge)


async def _schedule_out(session, schedule) -> ScheduleOut:
    await session.refresh(schedule)
    return ScheduleOut.model_validate(schedule)


# ── 사용자 웹 ───────────────────────────────────────────────


@router.get("/challenges/summary", response_model=ChallengeSummaryResponse, summary="참가할 수 있는 챌린지 회차 (로그인 불필요)")
async def challenges_summary(session: Session) -> ChallengeSummaryResponse:
    return ChallengeSummaryResponse(**await svc.summary(session))


@router.get(
    "/challenges/products",
    response_model=ChallengeOffersResponse,
    summary="Start New Challenge 상품 카드 (로그인 불필요)",
)
async def challenge_offers(session: Session) -> ChallengeOffersResponse:
    """판매 중인 챌린지 상품과 룰셋·펀디드 단계 조건, 지금 신청할 수 있는 모집 중 회차."""
    return ChallengeOffersResponse(items=await svc.offers(session))


# ── 관리자: 회차 ────────────────────────────────────────────


@router.get("/admin/challenges/active-dates", response_model=list[str], summary="회차가 있는 시작일 목록 (YYYYMMDD, UTC)")
async def challenge_active_dates(admin: AdminUser, session: Session) -> list[str]:
    return await svc.active_dates(session)


@router.get("/admin/challenges/grouped", response_model=ChallengeGroupedPage, summary="기간별로 묶은 회차 목록")
async def challenge_grouped(
    admin: AdminUser,
    session: Session,
    status: ChallengeStatus | None = None,
    date: Annotated[str | None, Query(description="시작일 (YYYYMMDD 또는 YYYY-MM-DD, UTC)")] = None,
    date_from: Annotated[str | None, Query(description="시작일 범위 시작 (한국 시간, YYYY-MM-DD)")] = None,
    date_to: Annotated[str | None, Query(description="시작일 범위 끝, 포함 (한국 시간, YYYY-MM-DD)")] = None,
    page: Page = 1,
    size: Size = 20,
) -> ChallengeGroupedPage:
    items, total = await svc.grouped(
        session, status=status, date=date, date_from=date_from, date_to=date_to, page=page, size=size
    )
    return ChallengeGroupedPage(items=items, total=total, page=page, size=size, pages=_pages(total, size))


def _leaderboard_challenges(challenges) -> list[LeaderboardChallenge]:
    return [
        LeaderboardChallenge(
            id=c.challenge_id, name=c.name, status=c.status, product_id=c.product_id,
            start_at=c.start_at, end_at=c.end_at, cutoff_at=leaderboard.cutoff(c),
        )
        for c in challenges
    ]


@router.get(
    "/admin/challenges/leaderboard/end-dates",
    response_model=list[str],
    summary="Leaderboard 날짜 목록: 대회 종료일 (한국 시간 YYYYMMDD, 최근 순)",
)
async def leaderboard_end_dates(admin: AdminUser, session: Session) -> list[str]:
    return await leaderboard.end_dates(session)


@router.get(
    "/admin/challenges/leaderboard/daily",
    response_model=DailyLeaderboardResponse,
    summary="Leaderboard: 같은 날(한국 시간) 끝나는 대회 계좌의 수익률 순위 (종료된 대회는 종료 시각 기준)",
)
async def daily_leaderboard(
    admin: AdminUser,
    session: Session,
    date: Annotated[str, Query(description="대회 종료일 (YYYYMMDD 또는 YYYY-MM-DD, 한국 시간)")],
    product_id: str | None = None,
    grade: Annotated[str | None, Query(description="NORMAL | VIP | VVIP (없으면 전체)")] = None,
) -> DailyLeaderboardResponse:
    grade = grade.upper() if grade else None
    if grade and grade not in leaderboard.GRADES:
        raise AppError(400, "invalid_grade", "grade는 NORMAL, VIP, VVIP 중 하나여야 합니다.")
    challenges, entries = await leaderboard.build(session, date, product_id=product_id, now=_now())
    entries = leaderboard.filter_grade(entries, grade)
    return DailyLeaderboardResponse(
        date=date, product_id=product_id, grade=grade, total=len(entries),
        challenges=_leaderboard_challenges(challenges), entries=entries,
    )


def _account_uuid(account_id: str) -> uuid.UUID:
    try:
        return uuid.UUID(account_id)
    except ValueError as exc:
        raise AppError(404, "account_not_found", "챌린지 계좌를 찾을 수 없습니다.") from exc


@router.post(
    "/admin/challenges/leaderboard/accounts/{account_id}/evaluate",
    response_model=ChallengeEvaluationOut,
    summary="Leaderboard '확인하기': 거래 내역을 룰셋으로 확인해 통과 여부 판정 (결과만 기록)",
)
async def evaluate_account(account_id: str, admin: AdminUser, session: Session) -> ChallengeEvaluationOut:
    evaluation = await challenge_evaluation.evaluate(session, _account_uuid(account_id), admin.id, _now())
    await session.commit()
    await session.refresh(evaluation)
    return ChallengeEvaluationOut.model_validate(evaluation)


@router.get(
    "/admin/challenges/leaderboard/accounts/{account_id}/evaluation",
    response_model=ChallengeEvaluationOut | None,
    summary="Leaderboard: 계좌의 마지막 판정 결과 (없으면 null)",
)
async def latest_evaluation(account_id: str, admin: AdminUser, session: Session) -> ChallengeEvaluationOut | None:
    evaluation = await challenge_evaluation.latest(session, _account_uuid(account_id))
    return ChallengeEvaluationOut.model_validate(evaluation) if evaluation else None


@router.get(
    "/admin/challenges/summary-stats",
    response_model=LeaderboardSummaryResponse,
    summary="Leaderboard 상단 통계 (참가 계좌·승격 대상·VIP 달성·탈락)",
)
async def leaderboard_summary_stats(
    admin: AdminUser,
    session: Session,
    target_date: Annotated[str, Query(description="대회 종료일 (YYYY-MM-DD 또는 YYYYMMDD, 한국 시간)")],
) -> LeaderboardSummaryResponse:
    challenges, entries = await leaderboard.build(session, target_date, now=_now())
    return LeaderboardSummaryResponse(
        target_date=target_date, challenges=_leaderboard_challenges(challenges),
        stats=leaderboard.summary_stats(entries),
    )


@router.get("/admin/challenges", response_model=ChallengePage, summary="회차 목록")
async def list_challenges(
    admin: AdminUser,
    session: Session,
    status: ChallengeStatus | None = None,
    date: Annotated[str | None, Query(description="시작일 (YYYYMMDD 또는 YYYY-MM-DD, UTC)")] = None,
    product_id: str | None = None,
    schedule_id: int | None = None,
    page: Page = 1,
    size: Size = 20,
) -> ChallengePage:
    items, total = await svc.list_challenges(
        session, status=status, date=date, product_id=product_id, schedule_id=schedule_id, page=page, size=size
    )
    return ChallengePage(
        items=[ChallengeOut.model_validate(c) for c in items], total=total, page=page, size=size,
        pages=_pages(total, size),
    )


@router.post("/admin/challenges", response_model=ChallengeOut, summary="회차 직접 생성")
async def create_challenge(body: ChallengeCreate, admin: AdminUser, session: Session) -> ChallengeOut:
    challenge = await svc.create_challenge(session, body.model_dump())
    await session.commit()
    return await _out(session, challenge)


@router.get("/admin/challenges/{challenge_id}", response_model=ChallengeOut, summary="회차 상세")
async def get_challenge(challenge_id: str, admin: AdminUser, session: Session) -> ChallengeOut:
    return ChallengeOut.model_validate(await svc.get_challenge(session, challenge_id))


@router.post("/admin/challenges/{challenge_id}/start", response_model=ChallengeOut, summary="회차 바로 시작")
async def start_challenge(challenge_id: str, admin: AdminUser, session: Session) -> ChallengeOut:
    challenge = await svc.get_challenge(session, challenge_id, lock=True)
    svc.start_challenge(challenge, _now())
    await challenge_order.on_challenge_status_changed(session, challenge)
    await session.commit()
    return await _out(session, challenge)


@router.post("/admin/challenges/{challenge_id}/close", response_model=ChallengeOut, summary="회차 종료 또는 취소")
async def close_challenge(
    challenge_id: str, admin: AdminUser, session: Session, body: ChallengeCloseRequest | None = None
) -> ChallengeOut:
    """cancel_reason을 비우면 진행 중 회차를 종료(CLOSED)하고, 넣으면 그 사유로 취소(CANCELLED)한다."""
    challenge = await svc.get_challenge(session, challenge_id, lock=True)
    svc.close_challenge(challenge, _now(), body.cancel_reason if body else None)
    await challenge_order.on_challenge_status_changed(session, challenge)
    await session.commit()
    return await _out(session, challenge)


# ── 관리자: 자동 생성 스케줄 ────────────────────────────────


@router.get("/admin/schedules", response_model=SchedulePage, summary="자동 생성 스케줄 목록")
async def list_schedules(
    admin: AdminUser,
    session: Session,
    status: ScheduleStatus | None = None,
    product_id: str | None = None,
    page: Page = 1,
    size: Size = 20,
) -> SchedulePage:
    items, total = await svc.list_schedules(session, status=status, product_id=product_id, page=page, size=size)
    return SchedulePage(
        items=[ScheduleOut.model_validate(s) for s in items], total=total, page=page, size=size,
        pages=_pages(total, size),
    )


@router.post("/admin/schedules", response_model=ScheduleOut, summary="자동 생성 스케줄 만들기")
async def create_schedule(body: ScheduleCreate, admin: AdminUser, session: Session) -> ScheduleOut:
    """next_run_at을 비우면 다음 주기 작업 때 첫 회차를 만든다."""
    schedule = await svc.create_schedule(session, body.model_dump())
    await session.commit()
    return await _schedule_out(session, schedule)


@router.post("/admin/schedules/run-due", response_model=JobRunResponse, summary="주기 작업 지금 한 번 실행")
async def run_due_now(admin: AdminUser, session: Session) -> JobRunResponse:
    """외부 스케줄러를 붙이기 전, 테스트 서버에서 손으로 돌릴 때 쓴다."""
    counts = await svc.run_due_jobs(session)
    await session.commit()
    return JobRunResponse(**counts)


@router.get("/admin/schedules/{schedule_id}", response_model=ScheduleOut, summary="스케줄 상세")
async def get_schedule(schedule_id: int, admin: AdminUser, session: Session) -> ScheduleOut:
    return ScheduleOut.model_validate(await svc.get_schedule(session, schedule_id))


@router.patch("/admin/schedules/{schedule_id}", response_model=ScheduleOut, summary="스케줄 수정")
async def update_schedule(schedule_id: int, body: ScheduleUpdate, admin: AdminUser, session: Session) -> ScheduleOut:
    """바꾼 값은 다음에 만드는 회차부터 적용된다. status로 ACTIVE·PAUSED를 바꾼다."""
    schedule = await svc.get_schedule(session, schedule_id, lock=True)
    with session.no_autoflush:
        await svc.update_schedule(session, schedule, body.model_dump(exclude_unset=True))
    await session.commit()
    return await _schedule_out(session, schedule)


@router.delete("/admin/schedules/{schedule_id}", response_model=ScheduleOut, summary="스케줄 중지")
async def deactivate_schedule(schedule_id: int, admin: AdminUser, session: Session) -> ScheduleOut:
    """지우지 않고 PAUSED로 바꾼다. 이미 만든 회차는 그대로 진행된다."""
    schedule = await svc.get_schedule(session, schedule_id, lock=True)
    if schedule.status == "ACTIVE":
        schedule.status = "PAUSED"
    await session.commit()
    return await _schedule_out(session, schedule)


@router.post("/admin/schedules/{schedule_id}/trigger", response_model=ScheduleTriggerResponse, summary="다음 회차 지금 만들기")
async def trigger_schedule(schedule_id: int, admin: AdminUser, session: Session) -> ScheduleTriggerResponse:
    """next_run_at을 기다리지 않고 다음 회차를 만든다. 모집 중인 회차가 있으면 만들지 않는다."""
    schedule = await svc.get_schedule(session, schedule_id, lock=True)
    challenge, reason = await svc.run_schedule(session, schedule, _now(), await svc.active_holidays(session))
    await session.commit()
    return ScheduleTriggerResponse(
        created=challenge is not None,
        challenge=await _out(session, challenge) if challenge else None,
        reason=reason,
        schedule=await _schedule_out(session, schedule),
    )


# ── 관리자: 휴장일 ──────────────────────────────────────────


@router.get("/admin/holidays", response_model=list[HolidayOut], summary="휴장일 목록")
async def list_holidays(admin: AdminUser, session: Session, year: int | None = None) -> list[HolidayOut]:
    return [HolidayOut.model_validate(h) for h in await svc.list_holidays(session, year)]


@router.post("/admin/holidays", response_model=HolidayOut, summary="휴장일 추가")
async def create_holiday(body: HolidayCreate, admin: AdminUser, session: Session) -> HolidayOut:
    holiday = await svc.create_holiday(session, body.model_dump())
    await session.commit()
    await session.refresh(holiday)
    return HolidayOut.model_validate(holiday)


@router.patch("/admin/holidays/{holiday_id}", response_model=HolidayOut, summary="휴장일 수정")
async def update_holiday(holiday_id: int, body: HolidayUpdate, admin: AdminUser, session: Session) -> HolidayOut:
    holiday = await svc.get_holiday(session, holiday_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(holiday, field, value)
    svc.check_holiday_period(holiday.start_at, holiday.end_at)
    await session.commit()
    await session.refresh(holiday)
    return HolidayOut.model_validate(holiday)


@router.delete("/admin/holidays/{holiday_id}", status_code=204, summary="휴장일 삭제")
async def delete_holiday(holiday_id: int, admin: AdminUser, session: Session) -> None:
    await session.delete(await svc.get_holiday(session, holiday_id))
    await session.commit()


# ── 내부: 주기 작업 ─────────────────────────────────────────


@router.post("/internal/jobs/challenges", response_model=JobRunResponse, summary="주기 작업 (외부 스케줄러용)")
async def run_challenge_jobs(
    session: Session, x_system_api_key: Annotated[str | None, Header()] = None
) -> JobRunResponse:
    """외부 스케줄러(cron)가 1분마다 부른다. X-System-Api-Key 헤더가 SYSTEM_API_KEY와 같아야 한다."""
    if not settings.system_api_key:
        raise AppError(503, "system_api_key_not_configured", "SYSTEM_API_KEY가 설정되지 않았습니다.")
    if not x_system_api_key or not hmac.compare_digest(x_system_api_key, settings.system_api_key):
        raise AppError(403, "invalid_system_api_key", "Permission denied")
    counts = await svc.run_due_jobs(session)
    await session.commit()
    return JobRunResponse(**counts)
