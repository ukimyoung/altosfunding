"""매출 현황 > 챌린지 매출: 기간·상품(Prime 포함)별 집계, 한국 시간 경계, 환불·미완료 제외, 비활성 상품 열."""

from datetime import UTC, datetime, timedelta

from tests.conftest import run_sql
from tests.test_admin_users import _create, admin_headers  # noqa: F401
from tests.test_catalog import _product
from tests.test_login import _login, member  # noqa: F401

URL = "/api/v1/admin/reports/sales/challenge"
TIERS = [("Challenge Starter", 100), ("Challenge Professional", 300), ("Challenge Elite", 500), ("Challenge Prime", 1000)]


def _setup(client, admin_headers):  # noqa: F811
    products = {}
    for i, (name, price) in enumerate(TIERS):
        res = _product(client, admin_headers, name=name, price_usdt=price,
                       mt4_login_pool_start=1000000 + i * 1000, mt4_login_pool_end=1000999 + i * 1000)
        assert res.status_code == 200, res.text
        pid = res.json()["product_id"]
        start = datetime.now(UTC) + timedelta(days=1)
        ch = client.post("/api/v1/admin/challenges", headers=admin_headers, json={
            "product_id": pid, "name": f"{name} #1",
            "start_at": start.isoformat(), "end_at": (start + timedelta(days=5)).isoformat(),
        })
        assert ch.status_code == 200, ch.text
        products[name.split()[-1]] = {"pid": pid, "cid": ch.json()["challenge_id"], "price": price}
    _create(client, admin_headers, email="kim@example.com", first_name="김", last_name="철수")
    _create(client, admin_headers, email="lee@example.com", first_name="이", last_name="영희")
    return products


_seq = 0


def _order(p, email, created_at, qty=1, status="COMPLETED", refunded_qty=0):
    global _seq
    _seq += 1
    total = p["price"] * qty
    run_sql(
        """insert into core.challenge_orders (id, user_id, challenge_id, product_id, product_name, quantity,
               original_unit_price, unit_price, original_price, total_price, issued_quantity,
               refunded_quantity, refunded_amount, status, created_at)
           select $1, u.id, $2, $3, 'x', $4, $5, $5, $6, $6, $7, $8, $9, $10, $11
             from core.users u where u.email = $12""",
        f"ORD-T-{_seq:04d}", p["cid"], p["pid"], qty, p["price"], total,
        qty - refunded_qty if status == "COMPLETED" else 0, refunded_qty, p["price"] * refunded_qty,
        status, created_at, email,
    )


def _utc(s: str) -> datetime:
    return datetime.fromisoformat(s).replace(tzinfo=UTC)


def test_challenge_sales_by_tier_including_prime(client, admin_headers):  # noqa: F811
    p = _setup(client, admin_headers)
    # 2026-10-31 15:30 UTC = 11-01 00:30 KST → 11월에 들어간다
    _order(p["Starter"], "kim@example.com", _utc("2026-10-31T15:30:00"), qty=2)
    _order(p["Prime"], "kim@example.com", _utc("2026-11-02T03:00:00"))
    _order(p["Prime"], "lee@example.com", _utc("2026-11-10T03:00:00"), qty=3, refunded_qty=1)  # 1개 환불
    _order(p["Elite"], "lee@example.com", _utc("2026-10-10T03:00:00"))
    _order(p["Professional"], "lee@example.com", _utc("2026-11-11T03:00:00"), status="PENDING")  # 발급 중 → 제외
    _order(p["Professional"], "lee@example.com", _utc("2026-11-12T03:00:00"), status="REFUNDED")  # 전액 환불 → 제외

    res = client.get(URL, headers=admin_headers, params={"period": "monthly"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert [c["label"] for c in body["columns"]] == [n for n, _ in TIERS]  # 가격순, Prime 포함
    assert [i["date"] for i in body["items"]] == ["2026-10", "2026-11"]
    nov = body["items"][1]
    assert nov["products"][p["Starter"]["pid"]] == {"quantity": 2, "amount": 200}
    assert nov["products"][p["Prime"]["pid"]] == {"quantity": 3, "amount": 3000}
    assert nov["products"][p["Professional"]["pid"]] == {"quantity": 0, "amount": 0}
    assert nov["subtotal"] == {"quantity": 5, "amount": 3200}
    assert body["summary"]["quantity"] == 6 and body["summary"]["amount"] == 3700
    assert body["summary"]["by_product"][p["Prime"]["pid"]] == {"quantity": 3, "amount": 3000}

    # 주별: 월요일 날짜(한국 시간)로 묶는다. 11-01(일) KST는 10-26 주.
    weekly = client.get(URL, headers=admin_headers, params={"period": "weekly"}).json()
    assert [i["date"] for i in weekly["items"]] == ["2026-10-05", "2026-10-26", "2026-11-02", "2026-11-09"]

    # 일별: 한국 시간 날짜. 10-31 15:30 UTC는 11-01 KST.
    daily = client.get(URL, headers=admin_headers,
                       params={"period": "daily", "start_date": "2026-11-01", "end_date": "2026-11-30"}).json()
    assert [i["date"] for i in daily["items"]] == ["2026-11-01", "2026-11-02", "2026-11-10"]
    assert daily["items"][0]["products"][p["Starter"]["pid"]] == {"quantity": 2, "amount": 200}
    assert daily["summary"]["quantity"] == 5 and daily["summary"]["amount"] == 3200

    # 기간: 한국 시간 날짜 기준 (11-01 KST부터)
    ranged = client.get(URL, headers=admin_headers,
                        params={"period": "yearly", "start_date": "2026-11-01", "end_date": "2026-11-02"}).json()
    assert ranged["items"][0]["date"] == "2026" and ranged["summary"]["quantity"] == 3

    # 회원 검색: 이메일·이름
    lee = client.get(URL, headers=admin_headers, params={"period": "monthly", "keyword": "영희"}).json()
    assert lee["summary"] == {"quantity": 3, "amount": 2500, "by_product": lee["summary"]["by_product"]}
    missing = client.get(URL, headers=admin_headers, params={"period": "monthly", "keyword": "nobody"})
    assert missing.status_code == 400 and missing.json()["error_code"] == "user_not_found"

    # 판매 후 비활성화한 상품도 매출이 있으면 열로 남는다
    run_sql("update core.products set is_active = false where id = $1", p["Elite"]["pid"])
    after = client.get(URL, headers=admin_headers, params={"period": "monthly"}).json()
    assert [c["label"] for c in after["columns"]] == ["Challenge Starter", "Challenge Professional", "Challenge Prime", "Challenge Elite"]
    assert after["summary"]["amount"] == 3700
    only_nov = client.get(URL, headers=admin_headers, params={"period": "monthly", "start_date": "2026-11-01"}).json()
    assert p["Elite"]["pid"] not in [c["product_id"] for c in only_nov["columns"]]


def test_challenge_sales_requires_admin(client, member):  # noqa: F811
    token = _login(client).json()["access_token"]
    res = client.get(URL, headers={"Authorization": f"Bearer {token}"}, params={"period": "monthly"})
    assert res.status_code == 403
