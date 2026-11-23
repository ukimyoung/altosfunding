"""챌린지 합격 → 펀디드 계좌 자동 발급: 최종 판정 PASSED 뒤 연결된 펀디드 상품으로 LIVE 서버에 계좌를 만든다."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.config import settings
from app.services import challenge as challenge_svc
from tests.conftest import run_sql, sent_emails  # noqa: F401
from tests.test_admin_users import admin_headers  # noqa: F401
from tests.test_catalog import _product
from tests.test_challenge_orders import (  # noqa: F401
    BUYER,
    POOL_START,
    _work,
    buyer,
    fake_mt4,
    round_,
)
from tests.test_login import member  # noqa: F401
from tests.test_mt4_ingest import active, broker  # noqa: F401
from tests.test_trading_rules import _equity, _jobs, _ruleset, _run, _snapshot, _status

A, B = POOL_START, POOL_START + 1
FUNDED_POOL = 20000001


@pytest.fixture
def live(monkeypatch):
    monkeypatch.setattr(settings, "mt4_live_base_url", "https://mt4-live.test")
    monkeypatch.setattr(settings, "mt4_live_api_key", "live-key")


def _funded_product(client, admin, related_id, **extra):
    res = _product(
        client, admin, name="Funded 100K", tier_type="FUNDED", capital=100000, price_usdt=0,
        mt4_group="real\\funded", leverage=50, related_id=related_id,
        mt4_login_pool_start=FUNDED_POOL, mt4_login_pool_end=FUNDED_POOL + 9, **extra,
    )
    assert res.status_code == 200, res.text
    return res.json()["product_id"]


def _finish(round_, active):  # noqa: F811
    """A는 수익 목표 달성(합격), B는 미달(불합격) 상태로 대회를 끝내고 10분 뒤 자동 판정을 돌린다."""
    _ruleset(round_["product_id"], profit_target_amt=1000, min_trading_days=0, consistency_pct=0)
    now = datetime.now(UTC)
    for login, equity in ((A, 102000), (B, 100000)):
        _equity(active[login], equity, now)
        _snapshot(active[login], equity, now)
    _run(now)
    ended = now + timedelta(minutes=1)
    run_sql("update core.challenges set status = 'CLOSED', closed_at = $2 where id = $1", round_["challenge_id"], ended)
    run_sql("update core.trading_accounts set status = 'CLOSED' where challenge_id = $1 and status = 'ACTIVE'",
            round_["challenge_id"])
    assert _run(ended + timedelta(minutes=11))["evaluated"] == 2
    assert _status(active[A]) == "PASSED" and _status(active[B]) == "FAILED"
    return ended


def _funded_rows():
    return run_sql("select * from core.trading_accounts where tier = 'FUNDED' order by created_at")


def test_passed_account_gets_funded_account(client, admin_headers, round_, active, broker, live, sent_emails):  # noqa: F811
    funded_pid = _funded_product(client, admin_headers, round_["product_id"])
    run_sql("update core.products set funding_start_delay_hours = 2 where id = $1", round_["product_id"])
    ended = _finish(round_, active)

    # 합격한 A만 펀디드 계좌가 생긴다 (발급 대기). 발급 시각 = 종료 + 2시간 (주말·휴장이면 다음 영업일)
    rows = _funded_rows()
    assert len(rows) == 1
    f = rows[0]
    expected = challenge_svc.next_trading_datetime(ended + timedelta(hours=2), [])
    assert str(f["source_account_id"]) == active[A] and f["product_id"] == funded_pid
    assert f["status"] == "PENDING" and f["provision_status"] == "QUEUED" and f["mt4_server"] == "live"
    assert float(f["capital"]) == 100000 and f["leverage"] == 50 and f["mt4_group"] == "real\\funded"
    assert f["challenge_id"] is None and f["order_id"] is None and f["start_at"] == expected
    job = [j for j in _jobs("mt4.provision_challenge_account") if j["payload"]["account_id"] == str(f["id"])]
    assert len(job) == 1 and job[0]["run_at"] == expected and job[0]["status"] == "PENDING"

    # 발급 시각이 되면 LIVE 서버에 계좌를 만들고 자본금을 넣는다 → 바로 거래 가능 + 펀디드 발급 메일
    sent_emails.clear()
    _work(rounds=2)
    f = _funded_rows()[0]
    assert f["provision_status"] == "DONE" and f["status"] == "ACTIVE" and not f["is_read_only"]
    login = f["mt4_login"]
    assert FUNDED_POOL <= login <= FUNDED_POOL + 9
    acc = broker.fake.accounts[login]
    assert acc["isReadOnly"] is False and acc["balance"] == 100000 and acc["group"] == "real\\funded"
    assert "live-key" in broker.fake.api_key_seen
    hist = run_sql("select * from core.mt4_account_issued_history where mt4_server = 'live'")
    assert [(h["mt4_login"], h["status"]) for h in hist] == [(login, "IN_USE")]
    mails = [m for m in sent_emails if m["purpose"] == "funding_account_issued"]
    assert len(mails) == 1 and mails[0]["email"] == BUYER
    # 주문·매출 분개는 없다
    assert not run_sql("select 1 from core.journal_entries where entry_type like 'FUNDED%'")

    # 계좌 목록·상세에서 펀디드 계좌로 보이고, 합격한 챌린지 계좌를 가리킨다
    page = client.get("/api/v1/admin/accounts?tier=FUNDED", headers=admin_headers).json()
    assert page["total"] == 1 and page["items"][0]["source_account_id"] == active[A]

    # 다시 판정·수동 발급을 해도 두 번 만들지 않는다
    assert client.post(
        f"/api/v1/admin/challenges/leaderboard/accounts/{active[A]}/evaluate", headers=admin_headers
    ).status_code == 200
    res = client.post(f"/api/v1/admin/accounts/{active[A]}/issue-funded", headers=admin_headers)
    assert res.status_code == 200 and res.json()["account_id"] == str(f["id"])
    assert len(_funded_rows()) == 1
    # 불합격 계좌는 발급할 수 없다
    res = client.post(f"/api/v1/admin/accounts/{active[B]}/issue-funded", headers=admin_headers)
    assert res.status_code == 400 and res.json()["error_code"] == "account_not_passed"

    # 펀디드 계좌도 1분 룰 감시 대상 (Daily Loss, 잔고 수집 뒤)
    now = datetime.now(UTC)
    _equity(str(f["id"]), 100000, now)
    assert _run(now)["checked"] == 1


def test_no_linked_product_then_manual_issue(client, admin_headers, round_, active, broker, live):  # noqa: F811
    _finish(round_, active)
    # 연결된 펀디드 상품이 없으면 합격 처리만 하고 펀디드 계좌는 만들지 않는다
    assert _status(active[A]) == "PASSED" and not _funded_rows()
    res = client.post(f"/api/v1/admin/accounts/{active[A]}/issue-funded", headers=admin_headers)
    assert res.status_code == 400 and res.json()["error_code"] == "funded_product_not_linked"

    # 상품을 연결한 뒤 관리자가 수동 발급하면 지금 바로 발급한다 (생성 시점 설정과 상관없이)
    run_sql("update core.products set funding_start_delay_hours = 48 where id = $1", round_["product_id"])
    _funded_product(client, admin_headers, round_["product_id"])
    before = datetime.now(UTC)
    res = client.post(f"/api/v1/admin/accounts/{active[A]}/issue-funded", headers=admin_headers)
    assert res.status_code == 200, res.text
    out = res.json()
    assert out["tier"] == "FUNDED" and out["provision_status"] == "QUEUED"
    assert before - timedelta(seconds=5) <= datetime.fromisoformat(out["start_at"]) <= datetime.now(UTC)

    # 발급이 실패(FAILED)로 끝나면 다시 발급할 수 있다
    run_sql("update core.trading_accounts set provision_status = 'FAILED', status = 'CANCELLED' where id = $1",
            uuid.UUID(out["account_id"]))
    again = client.post(f"/api/v1/admin/accounts/{active[A]}/issue-funded", headers=admin_headers)
    assert again.status_code == 200 and again.json()["account_id"] != out["account_id"]
    _work(rounds=2)
    rows = _funded_rows()
    assert [r["provision_status"] for r in rows] == ["FAILED", "DONE"]


def test_manual_issue_product_skips_auto_issue(client, admin_headers, round_, active, broker, live):  # noqa: F811
    # 챌린지 상품이 수동 발급이면 합격해도 펀디드 계좌를 자동으로 만들지 않는다
    _funded_product(client, admin_headers, round_["product_id"])
    res = client.put(f"/api/v1/catalog/products/{round_['product_id']}", headers=admin_headers,
                     json={"funded_issue_method": "MANUAL", "funding_start_delay_hours": 48})
    assert res.status_code == 200, res.text
    _finish(round_, active)
    assert _status(active[A]) == "PASSED" and not _funded_rows()

    # 계좌 상세: 발급 방법과 아직 펀디드 계좌 없음
    detail = client.get(f"/api/v1/admin/accounts/{active[A]}", headers=admin_headers).json()
    assert detail["funded_issue_method"] == "MANUAL" and detail["funded_account_id"] is None

    # 관리자가 발급하면 지금 바로 발급 대기로 만들고, 상세에 펀디드 계좌가 보인다
    before = datetime.now(UTC)
    res = client.post(f"/api/v1/admin/accounts/{active[A]}/issue-funded", headers=admin_headers)
    assert res.status_code == 200, res.text
    out = res.json()
    assert out["tier"] == "FUNDED" and before - timedelta(seconds=5) <= datetime.fromisoformat(out["start_at"])
    detail = client.get(f"/api/v1/admin/accounts/{active[A]}", headers=admin_headers).json()
    assert detail["funded_account_id"] == out["account_id"] and detail["funded_provision_status"] == "QUEUED"

    # Leaderboard 행에도 발급된 펀디드 계좌가 보인다
    day = client.get("/api/v1/admin/challenges/leaderboard/end-dates", headers=admin_headers).json()[0]
    board = client.get("/api/v1/admin/challenges/leaderboard/daily", headers=admin_headers,
                       params={"date": day}).json()
    rows = {e["account_id"]: e for e in board["entries"]}
    assert rows[active[A]]["funded_account_id"] == out["account_id"]
    assert rows[active[A]]["funded_issue_method"] == "MANUAL"
    assert rows[active[A]]["funded_provision_status"] == "QUEUED"
    assert rows[active[B]]["funded_account_id"] is None

    # 한 번 더 눌러도 새로 만들지 않는다
    again = client.post(f"/api/v1/admin/accounts/{active[A]}/issue-funded", headers=admin_headers)
    assert again.json()["account_id"] == out["account_id"] and len(_funded_rows()) == 1


def test_issue_now_moves_queued_auto_issue_forward(client, admin_headers, round_, active, broker, live):  # noqa: F811
    # 자동 발급 상품: 합격하면 '종료 + 48시간'으로 발급 대기. 관리자가 '지금 발급'하면 예약을 지금으로 당긴다.
    _funded_product(client, admin_headers, round_["product_id"])
    run_sql("update core.products set funding_start_delay_hours = 48 where id = $1", round_["product_id"])
    _finish(round_, active)
    f = _funded_rows()[0]
    assert f["provision_status"] == "QUEUED" and f["start_at"] > datetime.now(UTC) + timedelta(hours=40)

    before = datetime.now(UTC)
    res = client.post(f"/api/v1/admin/accounts/{active[A]}/issue-funded", headers=admin_headers)
    assert res.status_code == 200, res.text
    assert res.json()["account_id"] == str(f["id"])  # 새로 만들지 않고 같은 계좌
    after = datetime.now(UTC)
    f = _funded_rows()[0]
    assert before - timedelta(seconds=5) <= f["start_at"] <= after
    job = [j for j in _jobs("mt4.provision_challenge_account") if j["payload"]["account_id"] == str(f["id"])][0]
    assert job["status"] == "PENDING" and job["run_at"] <= after

    # Worker가 바로 발급한다 (재시도 대기 건너뛰기용 run_at 조정 없이 1번)
    from app import db
    from app.jobs import mt4 as _handlers  # noqa: F401
    from app.worker import run_job_queue
    import asyncio

    db.get_engine()
    asyncio.run(run_job_queue(db._sessionmaker))
    assert _funded_rows()[0]["provision_status"] == "DONE"

    # 발급이 끝난 뒤 다시 눌러도 바뀌는 것이 없다
    res = client.post(f"/api/v1/admin/accounts/{active[A]}/issue-funded", headers=admin_headers)
    assert res.json()["account_id"] == str(f["id"]) and len(_funded_rows()) == 1
