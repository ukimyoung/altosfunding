"""관리자 제휴 프로그램(IB) API: 파트너·레벨 비율·마케팅 비율·조직도·재배치, IB 추천인의 $40 리워드 생략."""

from datetime import UTC, datetime, timedelta
from itertools import pairwise

import pytest

from tests.conftest import run_sql
from tests.test_admin_users import _create, admin_headers  # noqa: F401
from tests.test_challenge_orders import (  # noqa: F401
    BUYER,
    _join,
    _work,
    buyer,
    fake_mt4,
    round_,
)
from tests.test_login import _login, member  # noqa: F401
from tests.test_member_relations import _id

API = "/api/v1/admin/affiliate"


@pytest.fixture
def tree(client, admin_headers):  # noqa: F811
    """a ← b ← c ← d (placement·sponsor 모두 앞 사람). a, b, d는 IB, c는 일반 회원."""
    emails = [f"{n}@example.com" for n in "abcd"]
    for email in emails:
        _create(client, admin_headers, email=email, first_name=email[0].upper())
    for upper, lower in pairwise(emails):
        run_sql(
            "update core.member_relations set sponsor_id = (select id from core.users where email = $1),"
            " placement_parent_id = (select id from core.users where email = $1)"
            " where member_id = (select id from core.users where email = $2)",
            upper, lower,
        )
    for email, level in (("a@example.com", 20), ("b@example.com", 18), ("d@example.com", 10)):
        res = client.post(f"{API}/partners", headers=admin_headers, json={"user_id": str(_id(email)), "level": level})
        assert res.status_code == 200, res.text
    return emails


def test_non_admin_forbidden(client, member):  # noqa: F811
    token = _login(client).json()["access_token"]
    assert client.get(f"{API}/partners", headers={"Authorization": f"Bearer {token}"}).status_code == 403


def test_partners_list_detail_and_status_rules(client, admin_headers, tree):  # noqa: F811
    a, b, c, d = tree
    again = client.post(f"{API}/partners", headers=admin_headers, json={"user_id": str(_id(a)), "level": 5})
    assert again.status_code == 409 and again.json()["error_code"] == "already_ib"

    body = client.get(f"{API}/partners", headers=admin_headers).json()
    assert body["summary"] == {"total": 3, "active": 3, "inactive": 0, "banned": 0}
    items = {i["email"]: i for i in body["items"]}
    assert items[a]["upline"] is None and items[a]["downline_count"] == 3
    assert [x["email"] for x in items[a]["downline_ibs"]] == [b]
    assert items[b]["upline"]["email"] == a and items[b]["downline_ib_count"] == 0  # c는 IB 아님
    assert items[d]["upline"]["email"] == c
    assert client.get(f"{API}/partners", headers=admin_headers, params={"keyword": "d@exa"}).json()["total"] == 1

    url = f"{API}/partners/{_id(b)}"
    res = client.patch(url, headers=admin_headers, json={"level": 19, "status": "INACTIVE", "reason": "휴면"})
    assert res.status_code == 200 and (res.json()["level"], res.json()["status"]) == (19, "INACTIVE")
    assert client.patch(url, headers=admin_headers, json={"status": "BANNED"}).status_code == 200
    blocked = client.patch(url, headers=admin_headers, json={"status": "ACTIVE"})
    assert blocked.status_code == 409 and blocked.json()["error_code"] == "ib_banned"
    detail = client.get(url, headers=admin_headers).json()
    assert [h["change_type"] for h in detail["history"]] == ["UPDATE", "UPDATE", "CREATE"]
    assert detail["history"][1]["reason"] == "휴면"
    summary = client.get(f"{API}/partners", headers=admin_headers).json()["summary"]
    assert summary == {"total": 3, "active": 2, "inactive": 0, "banned": 1}
    filtered = client.get(f"{API}/partners", headers=admin_headers, params={"status": "BANNED"}).json()
    assert [i["email"] for i in filtered["items"]] == [b]

    cand = client.get(f"{API}/partners/candidates", headers=admin_headers, params={"keyword": "c@exa"}).json()
    assert cand["items"][0]["is_ib"] is False and cand["items"][0]["upline"]["email"] == b


def _rates(value_by_level):
    return [{"level": lv, "rate": value_by_level(lv)} for lv in range(1, 41)]


def test_level_rates_and_marketing_policy(client, admin_headers):  # noqa: F811
    cur = client.get(f"{API}/level-rates", headers=admin_headers).json()
    assert cur["current"]["version"] == 1 and cur["marketing_rate"] == 20
    assert len(cur["current"]["rates"]) == 40 and {r["rate"] for r in cur["current"]["rates"]} == {0}

    over = client.put(f"{API}/level-rates", headers=admin_headers, json={"rates": _rates(lambda lv: 21 if lv == 40 else 1)})
    assert over.status_code == 422 and over.json()["error_code"] == "level_rate_exceeds_marketing"
    missing = client.put(f"{API}/level-rates", headers=admin_headers, json={"rates": _rates(lambda lv: 1)[:39]})
    assert missing.status_code == 422 and missing.json()["error_code"] == "invalid_levels"
    ok = client.put(f"{API}/level-rates", headers=admin_headers, json={"rates": _rates(lambda lv: lv / 2), "reason": "초기 설정"})
    assert ok.status_code == 200, ok.text
    body = ok.json()
    assert body["current"]["version"] == 2 and body["current"]["rates"][39]["rate"] == 20
    assert [h["version"] for h in body["history"]] == [2, 1]

    # 레벨 최고 비율(20%)보다 낮은 마케팅 비율은 막는다
    low = client.post(f"{API}/marketing-policy", headers=admin_headers, json={"rate": 15, "reason": "축소"})
    assert low.status_code == 409 and low.json()["error_code"] == "level_rate_exceeds_marketing"
    no_reason = client.post(f"{API}/marketing-policy", headers=admin_headers, json={"rate": 25, "reason": " "})
    assert no_reason.status_code == 422
    past = (datetime.now(UTC) - timedelta(hours=1)).isoformat()
    old = client.post(f"{API}/marketing-policy", headers=admin_headers, json={"rate": 25, "reason": "x", "effective_from": past})
    assert old.status_code == 422 and old.json()["error_code"] == "effective_from_in_past"

    future = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    res = client.post(f"{API}/marketing-policy", headers=admin_headers, json={"rate": 25, "reason": "프로모션", "effective_from": future})
    assert res.status_code == 200, res.text
    m = res.json()
    assert m["current"]["rate"] == 20 and [s["rate"] for s in m["scheduled"]] == [25]
    assert m["history"][0]["reason"] == "프로모션" and m["history"][0]["actor_name"]
    # 예약된 25% 구간에서는 22%까지 레벨 비율을 올릴 수 있지만, 지금(20%) 시작은 안 된다
    up = _rates(lambda lv: 22 if lv == 40 else 1)
    assert client.put(f"{API}/level-rates", headers=admin_headers, json={"rates": up}).status_code == 422
    later = (datetime.now(UTC) + timedelta(days=2)).isoformat()
    assert client.put(f"{API}/level-rates", headers=admin_headers, json={"rates": up, "effective_from": later}).status_code == 200


def test_network_and_relocate(client, admin_headers, tree):  # noqa: F811
    a, _b, c, d = tree
    net = client.get(f"{API}/network", headers=admin_headers, params={"keyword": a}).json()
    assert net["total"] == 4
    root = net["root"]
    assert root["email"] == a and root["is_ib"] and root["level"] == 20
    node_c = root["children"][0]["children"][0]
    assert node_c["email"] == c and node_c["is_ib"] is False and node_c["children"][0]["email"] == d

    res = client.post(f"{API}/network/relocate", headers=admin_headers, json={"member_id": str(_id(d)), "new_parent_id": str(_id(a)), "reason": " "})
    assert res.status_code == 422 and res.json()["error_code"] == "reason_required"
    res = client.post(f"{API}/network/relocate", headers=admin_headers, json={"member_id": str(_id(c)), "new_parent_id": str(_id(a)), "reason": "x"})
    assert res.json()["error_code"] == "relocate_member_not_ib"
    res = client.post(f"{API}/network/relocate", headers=admin_headers, json={"member_id": str(_id(d)), "new_parent_id": str(_id(c)), "reason": "x"})
    assert res.json()["error_code"] == "relocate_parent_not_ib"
    res = client.post(f"{API}/network/relocate", headers=admin_headers, json={"member_id": str(_id(a)), "new_parent_id": str(_id(d)), "reason": "x"})
    assert res.json()["error_code"] == "relation_cycle"

    res = client.post(f"{API}/network/relocate", headers=admin_headers, json={"member_id": str(_id(d)), "new_parent_id": str(_id(a)), "reason": "조직 정리"})
    assert res.status_code == 200, res.text
    assert res.json()["upline"]["email"] == a
    rel = run_sql("select sponsor_id from core.member_relations where member_id = $1", _id(d))[0]
    assert str(rel["sponsor_id"]) == str(_id(c))  # 추천인은 그대로
    hist = run_sql("select change_type, reason from core.member_relation_history where member_id = $1 order by id desc limit 1", _id(d))[0]
    assert (hist["change_type"], hist["reason"]) == ("PLACEMENT_CHANGE", "조직 정리")


def test_ib_sponsor_gets_no_referral_reward(client, admin_headers, buyer, round_, fake_mt4):  # noqa: F811
    _create(client, admin_headers, email="ib@example.com")
    run_sql(
        "update core.member_relations set sponsor_id = (select id from core.users where email = $1)"
        " where member_id = (select id from core.users where email = $2)",
        "ib@example.com", BUYER,
    )
    res = client.post(f"{API}/partners", headers=admin_headers, json={"user_id": str(_id("ib@example.com")), "level": 3, "status": "INACTIVE"})
    assert res.status_code == 200, res.text
    assert _join(client, buyer, round_["challenge_id"]).status_code == 201
    _work()
    assert run_sql("select count(*) as n from core.reward_records")[0]["n"] == 0
