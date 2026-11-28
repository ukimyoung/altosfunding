"""개발용 가짜 제휴사 회원 조회 API.

제휴사(10Power) API 주소·키가 아직 없어서, PARTNER_MEMBERS_API_URL=mock 이면 실제 호출 대신 이 데이터를 돌려준다.
응답 모양·since·cursor·limit 동작은 명세('제휴사 회원 조회 API 명세', 2026-11-26)와 같다. live에서는 쓰지 않는다.

회원 25명(mock001~mock025): 이메일 공유 3명, 이메일 없음 1명, deleted·suspended·unconfirmed 각 1명, xnsoft 5명,
구독 만료일이 미래·과거·없음인 회원을 섞어 두었다.
"""

from datetime import UTC, date, datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))
_UPDATED_AT = datetime(2026, 11, 26, 9, 0, tzinfo=KST)


def _member(n: int) -> dict:
    member_id = f"mock{n:03d}"
    email: str | None = f"{member_id}@example.com"
    status = "active"
    if n <= 3:
        email = "mock-shared@example.com"  # 여러 회원이 함께 쓰는 이메일
    elif n == 4:
        email = None  # 이메일 없음 → 로그인 시 '이메일 등록이 필요합니다'
    if n == 5:
        status = "deleted"
    elif n == 6:
        status = "suspended"
    elif n == 7:
        status = "unconfirmed"
    if n % 4 == 0:
        expires_on = None
    elif n % 4 == 1:
        expires_on = date(2026, 12, 31)
    elif n % 4 == 2:
        expires_on = date(2026, 10, 31)  # 이미 만료
    else:
        expires_on = date(2027, 1, 15)
    today = datetime.now(KST).date()
    return {
        "member_id": member_id,
        "site": "xnsoft" if n > 20 else "10power",
        "name": f"MOCK USER {n:02d}",
        "email": email,
        "phone": None if n % 5 == 0 else f"010{n:04d}{n:04d}",
        "sponsor_id": None if n == 1 else f"mock{(n - 1) // 3 + 1:03d}",
        "account_status": status,
        "joined_at": (datetime(2025, 3, 2, 14, 0, tzinfo=KST) + timedelta(days=n * 7)).isoformat(),
        "membership": {
            "expires_on": expires_on.isoformat() if expires_on else None,
            "active": bool(expires_on and expires_on >= today),
        },
        "updated_at": (_UPDATED_AT + timedelta(minutes=n)).isoformat(),
    }


MEMBERS = [_member(n) for n in range(1, 26)]


def list_members(since: datetime | None, cursor: str | None, limit: int) -> dict:
    items = MEMBERS
    if since is not None:
        items = [m for m in items if datetime.fromisoformat(m["updated_at"]) > since]
    start = int(cursor) if cursor else 0
    page = items[start : start + limit]
    has_more = start + limit < len(items)
    return {
        "as_of": datetime.now(UTC).astimezone(KST).isoformat(timespec="seconds"),
        "has_more": has_more,
        "next_cursor": str(start + limit) if has_more else None,
        "items": page,
    }
