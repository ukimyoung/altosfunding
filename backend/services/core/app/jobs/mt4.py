"""MT4 작업 처리기 (Worker가 core.jobs에서 꺼내 실행한다).

mt4.provision_challenge_account — 챌린지·데모 계좌 1개 발급 (데모는 주문·대회 없이 바로 거래 가능, 발급 메일 없음)
  1) MT4 번호 할당: 상품 범위(mt4_login_pool_start~end)에서 카운터(last_mt4_login)를 원자적으로 +1 하고,
     core.mt4_account_issued_history에 RESERVED로 기록(번호마다 한 줄, 중복 불가) → MT4 GET이 404면 확정.
     MT4에 이미 있으면 BLACKLISTED로 남기고 다음 번호. 범위를 넘으면 실패(환불).
  2) MT4 계좌 생성 (대회 시작 전이면 읽기 전용으로 만든다). 요청 직전에 시도 시각을 커밋해 두고,
     응답을 못 받았으면(타임아웃·5xx) 다음 시도 때 GET으로 생성 여부를 먼저 확인한다.
     "이미 있는 번호" 거부면 그 번호를 BLACKLISTED로 두고 새 번호로 다시 시도한다.
  3) 자본금 입금. 이전 시도가 응답 없이 끝났으면 잔고를 먼저 확인해 두 번 넣지 않는다.
  4) 발급 완료: 주문 반영·매출 분개·발급 메일 작업 (app.services.challenge_order.mark_issued)
  재시도를 다 쓰면(약 1시간) 자동 환불하고, MT4에 계좌가 생겼을 수 있으면 번호를 ORPHANED(정리 대상)로 남긴다.

mt4.set_read_only — 대회 시작·종료 때 계좌 거래 잠금 해제·잠금
notify.challenge_account_issued — 계좌 발급 메일 (계좌 번호·비밀번호)
"""

import logging
import secrets
import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Challenge, Job, Mt4AccountIssuedHistory, Product, TradingAccount, User
from app.security import decrypt_text, encrypt_text
from app.services import challenge_order as orders
from app.services import jobs, mt4, notify
from app.services.email import get_email_sender

logger = logging.getLogger(__name__)

# 한 번의 시도에서 "이미 있는 번호" 거부를 받고 새 번호로 다시 해 보는 횟수 (기존 서버와 같음)
MAX_CREATE_REJECTS = 5
# 번호 하나를 정할 때 건너뛸 수 있는 최대 횟수 (기존 서버와 같음)
MAX_LOGIN_TRIES = 200
# 헷갈리기 쉬운 문자(0 O o 1 l L I i)를 뺀 영문 대소문자 + 숫자 (기존 서버와 같음)
PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"
DEFAULT_MT4_NAME = "Altos Trader"


def _now() -> datetime:
    return datetime.now(UTC)


def generate_password(length: int = 8) -> str:
    """MT4는 영문·숫자를 섞은 비밀번호를 요구한다."""
    while True:
        pwd = "".join(secrets.choice(PASSWORD_ALPHABET) for _ in range(length))
        if any(c.isdigit() for c in pwd) and any(c.isupper() for c in pwd) and any(c.islower() for c in pwd):
            return pwd


def mt4_name(user: User) -> str:
    """MT4 계좌 이름. 이름이 없으면 이메일 앞부분 → 회원번호 (기존 서버와 같음)."""
    full = " ".join(p.strip() for p in (user.first_name, user.last_name) if p and p.strip())
    if full:
        return full
    if user.email and "@" in user.email:
        return user.email.split("@", 1)[0]
    return user.uid or DEFAULT_MT4_NAME


def _is_ours(info: dict, account: TradingAccount, user: User) -> bool:
    """MT4에 있는 계좌가 이 발급 건으로 만든 것인지 (생성 때 회원 email을 넣는다).

    comment에는 상품명을 넣으므로 회원 구분에 쓸 수 없다. 예전에 comment에 회원번호를 넣어 만든 계좌는 회원번호로도 확인한다.
    """
    email = str(info.get("email") or "").strip().lower()
    comment = str(info.get("comment") or "").strip()
    return (bool(email) and email == user.email.lower()) or (bool(comment) and comment == user.uid)


def _account_id(job: Job) -> uuid.UUID:
    try:
        return uuid.UUID(str(job.payload.get("account_id")))
    except (TypeError, ValueError) as exc:
        raise jobs.PermanentJobError(f"account_id가 올바르지 않습니다: {job.payload}") from exc


async def _set_login_status(session: AsyncSession, account: TradingAccount, login: int, status: str, reason: str) -> None:
    stmt = insert(Mt4AccountIssuedHistory).values(
        mt4_server=account.mt4_server, mt4_login=login, product_id=account.product_id,
        account_id=account.id if status in ("RESERVED", "IN_USE") else None, status=status, reason=reason,
    )
    await session.execute(
        stmt.on_conflict_do_update(
            index_elements=[Mt4AccountIssuedHistory.mt4_server, Mt4AccountIssuedHistory.mt4_login],
            # 관리자가 등록한 번호였더라도 발급 과정에서 실제로 쓰였거나 MT4에 생겼으면 시스템 기록으로 바꾼다.
            set_={"status": status, "reason": reason, "source": "SYSTEM", "created_by": None},
        )
    )


async def _reserve_login(session: AsyncSession, client: mt4.Mt4Client, account: TradingAccount) -> int:
    """상품 범위에서 다음 번호를 정해 계좌에 할당하고 커밋한다."""
    for _ in range(MAX_LOGIN_TRIES):
        # 카운터는 바로 커밋한다 (상품 행 잠금을 MT4 호출 동안 잡고 있지 않도록). 번호는 되돌리지 않는다.
        row = (
            await session.execute(
                text(
                    "update core.products set last_mt4_login = coalesce(last_mt4_login, mt4_login_pool_start - 1) + 1 "
                    "where id = :pid returning last_mt4_login, mt4_login_pool_start, mt4_login_pool_end"
                ),
                {"pid": account.product_id},
            )
        ).one()
        await session.commit()
        login, pool_start, pool_end = row
        if login > pool_end:
            raise jobs.PermanentJobError(f"MT4 계좌번호 범위({pool_start}~{pool_end})를 다 썼습니다 (상품 {account.product_id}).")
        if login < pool_start:
            continue
        # 이미 기록된 번호(다른 계좌가 쓰는 번호, 블랙리스트)는 건너뛴다.
        inserted = await session.scalar(
            insert(Mt4AccountIssuedHistory)
            .values(
                mt4_server=account.mt4_server, mt4_login=login, product_id=account.product_id,
                account_id=account.id, status="RESERVED",
            )
            .on_conflict_do_nothing()
            .returning(Mt4AccountIssuedHistory.mt4_login)
        )
        if inserted is None:
            await session.commit()
            continue
        try:
            existing = await client.get_account(login)
        except mt4.Mt4Error:
            await session.rollback()  # 번호 기록을 지우고(카운터는 이미 지나감) 나중에 다시 시도
            raise
        if existing is not None:
            await _set_login_status(session, account, login, "BLACKLISTED", "MT4에 이미 있는 번호")
            await session.commit()
            logger.warning("MT4 %s 번호 %s는 이미 있어 건너뜀", account.mt4_server, login)
            continue
        account.mt4_login = login
        account.mt4_create_attempted_at = None
        await session.commit()
        return login
    raise mt4.Mt4Error("reserve_login", f"번호를 {MAX_LOGIN_TRIES}번 건너뛰었습니다. 범위·MT4 상태를 확인하세요.")


async def _drop_login(session: AsyncSession, account: TradingAccount, reason: str) -> None:
    """할당한 번호를 쓰지 않기로 하고(블랙리스트) 계좌에서 뗀다."""
    if account.mt4_login is not None:
        await _set_login_status(session, account, account.mt4_login, "BLACKLISTED", reason)
    account.mt4_login = None
    account.mt4_create_attempted_at = None
    await session.commit()


async def _ensure_created(
    session: AsyncSession, client: mt4.Mt4Client, account: TradingAccount, product: Product, user: User
) -> None:
    # 지난 시도에서 생성 요청 뒤 응답을 못 받았으면, 생겼는지 먼저 본다.
    if account.mt4_login is not None and account.mt4_create_attempted_at is not None:
        info = await client.get_account(account.mt4_login)
        if info is not None:
            if _is_ours(info, account, user):
                account.mt4_created_at = _now()
                await _set_login_status(session, account, account.mt4_login, "IN_USE", "MT4 계좌 생성됨 (응답 없던 요청 확인)")
                await session.commit()
                return
            await _drop_login(session, account, "MT4에 다른 계좌로 이미 있는 번호")
        else:
            account.mt4_create_attempted_at = None
            await session.commit()

    rejects = 0
    while account.mt4_created_at is None:
        if account.mt4_login is None:
            await _reserve_login(session, client, account)
        if account.password_encrypted is None:
            account.password_encrypted = encrypt_text(generate_password())
            account.investor_password_encrypted = encrypt_text(generate_password())
        challenge = await session.get(Challenge, account.challenge_id) if account.challenge_id else None
        # 데모 계좌(대회 없음)는 바로 거래할 수 있게 만든다. 챌린지는 대회가 진행 중일 때만.
        read_only = account.challenge_id is not None and not (challenge is not None and challenge.status == "ACTIVE")
        account.mt4_create_attempted_at = _now()
        await session.commit()
        login = account.mt4_login
        try:
            created = await client.create_account(
                login=login,
                name=mt4_name(user),
                group=account.mt4_group,
                leverage=account.leverage,
                password=decrypt_text(account.password_encrypted),
                investor_password=decrypt_text(account.investor_password_encrypted),
                email=user.email,
                comment=product.name,
                pool_start=product.mt4_login_pool_start,
                pool_end=product.mt4_login_pool_end,
                read_only=read_only,
            )
        except mt4.Mt4Error as exc:
            if exc.no_response or exc.status != 400:
                raise  # 다음 시도 때 GET으로 확인하고 이어서 한다 (403 등 설정 문제도 고쳐지면 이어진다)
            kind = mt4.classify_create_rejection(exc)
            if kind in (mt4.INVALID_NAME, mt4.DUPLICATE_UID):
                account.mt4_create_attempted_at = None
                await session.commit()
                raise jobs.PermanentJobError(f"MT4 계좌 생성 거부 ({kind}): {exc}") from exc
            occupied = await client.get_account(login) is not None
            if kind == mt4.DUPLICATE_LOGIN or occupied:
                await _drop_login(session, account, f"MT4 생성 거부 ({kind})")
                rejects += 1
                if rejects >= MAX_CREATE_REJECTS:
                    raise mt4.Mt4Error("create_account", f"이미 있는 번호 거부가 {rejects}번 이어졌습니다.") from exc
                continue
            account.mt4_create_attempted_at = None
            await session.commit()
            raise jobs.PermanentJobError(f"MT4 계좌 생성 거부: {exc}") from exc

        if created.login != login:
            # 요청한 번호와 다른 번호로 만들어졌다. 만들어진 계좌는 정리 대상으로 남기고 실패로 처리한다.
            await _set_login_status(session, account, created.login, "ORPHANED", f"요청 {login}과 다른 번호로 생성됨")
            await session.commit()
            raise jobs.PermanentJobError(f"MT4가 요청한 번호({login})와 다른 번호({created.login})로 계좌를 만들었습니다.")
        account.mt4_created_at = _now()
        await _set_login_status(session, account, login, "IN_USE", "MT4 계좌 생성됨")
        await session.commit()


async def _ensure_capital(session: AsyncSession, client: mt4.Mt4Client, account: TradingAccount) -> None:
    if account.capital_deposited_at is not None:
        return
    if account.capital_deposit_attempted_at is not None:
        # 지난 입금 요청의 응답을 못 받았다 → 잔고를 보고 이미 들어갔으면 다시 넣지 않는다.
        info = await client.get_account(account.mt4_login)
        if info is not None and Decimal(str(info.get("balance") or 0)) >= account.capital - Decimal("0.01"):
            account.capital_deposited_at = _now()
            await session.commit()
            return
    account.capital_deposit_attempted_at = _now()
    await session.commit()
    comment = (
        f"Challenge {account.challenge_id} capital" if account.challenge_id
        else f"{account.tier.title()} initial capital"
    )
    order_id = await client.balance_operation(account.mt4_login, float(account.capital), comment)
    account.capital_order_id = order_id
    account.capital_deposited_at = _now()
    await session.commit()


@jobs.handler(orders.PROVISION_JOB)
async def provision_challenge_account(session: AsyncSession, job: Job) -> dict | None:
    account = await session.get(TradingAccount, _account_id(job))
    if account is None:
        raise jobs.PermanentJobError("계좌가 없습니다.")
    if account.provision_status != orders.QUEUED:
        return {"skipped": account.provision_status}
    product = await session.get(Product, account.product_id)
    user = await session.get(User, account.user_id)
    if product is None or user is None:
        raise jobs.PermanentJobError("상품 또는 회원이 없습니다.")
    client = mt4.client_for(account.mt4_server)

    await _ensure_created(session, client, account, product, user)
    await _ensure_capital(session, client, account)
    await session.refresh(account, with_for_update=True)
    if account.provision_status != orders.QUEUED:
        return {"skipped": account.provision_status}
    await orders.mark_issued(session, account)
    return {"mt4_login": account.mt4_login}


@jobs.on_failed(orders.PROVISION_JOB)
async def refund_failed_provision(session: AsyncSession, job: Job, error: str) -> None:
    account = await session.get(TradingAccount, _account_id(job), with_for_update=True, populate_existing=True)
    if account is None:
        return
    first_line = error.strip().splitlines()[0] if error.strip() else "발급 실패"
    await orders.refund_account(session, account, first_line)


@jobs.handler(orders.READ_ONLY_JOB)
async def set_read_only(session: AsyncSession, job: Job) -> dict | None:
    account = await session.get(TradingAccount, _account_id(job), with_for_update=True)
    if account is None:
        raise jobs.PermanentJobError("계좌가 없습니다.")
    read_only = bool(job.payload.get("read_only"))
    if account.mt4_login is None or account.provision_status != orders.DONE:
        return {"skipped": "not_issued"}
    # 그 사이 계좌 상태가 또 바뀌었으면(예: 시작 직후 취소) 새로 들어온 작업이 맞춘다.
    if read_only != (account.status not in orders.TRADABLE_STATUSES):
        return {"skipped": "stale"}
    await mt4.client_for(account.mt4_server).set_read_only(account.mt4_login, read_only)
    account.is_read_only = read_only
    return {"mt4_login": account.mt4_login, "read_only": read_only}


@jobs.handler(orders.ISSUED_MAIL_JOB)
async def send_account_issued_mail(session: AsyncSession, job: Job) -> dict | None:
    account = await session.get(TradingAccount, _account_id(job))
    if account is None or account.provision_status != orders.DONE or account.password_encrypted is None:
        return {"skipped": True}
    user = await session.get(User, account.user_id)
    challenge = await session.get(Challenge, account.challenge_id) if account.challenge_id else None
    sent = await notify.to_user(
        session,
        get_email_sender(),
        user,
        "challenge_account_issued",
        {
            "mt4_login": account.mt4_login,
            "mt4_password": decrypt_text(account.password_encrypted),
            "mt4_server": mt4.server_name(account.mt4_server),
            "challenge_name": challenge.name if challenge else "",
            "start_date": account.start_at.strftime("%Y-%m-%d %H:%M") if account.start_at else "-",
            "end_date": account.end_at.strftime("%Y-%m-%d %H:%M") if account.end_at else "-",
        },
        meta={"account_id": str(account.id)},
    )
    return {"sent": sent}
