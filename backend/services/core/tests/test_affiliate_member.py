"""회원용 IB 조회 (/affiliate/me·network·commissions): IB만, 하위 회원 가림, 내 커미션만."""

from tests.test_admin_users import _create, admin_headers  # noqa: F401
from tests.test_challenge_orders import _join, buyer, fake_mt4, round_  # noqa: F401
from tests.test_ib_commission import ib_chain  # noqa: F401
from tests.test_login import _login, member  # noqa: F401

API = "/api/v1/affiliate"


def _find(node, email_prefix):
    if node["email"].startswith(email_prefix):
        return node
    for child in node["children"]:
        found = _find(child, email_prefix)
        if found:
            return found
    return None


def test_member_affiliate_views(client, admin_headers, buyer, round_, fake_mt4, ib_chain):  # noqa: F811
    assert _join(client, buyer, round_["challenge_id"]).status_code == 201  # 80 USDT

    # IB가 아니면 메뉴 없음 + 조회 403
    assert client.get(f"{API}/me", headers=ib_chain["plain"]).json() == {"is_ib": False}
    assert client.get(f"{API}/network", headers=ib_chain["plain"]).status_code == 403
    assert client.get(f"{API}/commissions", headers=ib_chain["plain"]).status_code == 403

    me = client.get(f"{API}/me", headers=ib_chain["chul"]).json()
    assert (me["is_ib"], me["level"], me["commission_rate"], me["total_commission"]) == (True, 16, 16, 4.8)
    assert (me["network_total"], me["network_active"]) == (3, 3)  # kim, plain, buyer

    tree = client.get(f"{API}/network", headers=ib_chain["chul"]).json()
    root = tree["root"]
    assert root["email"] == "chul@example.com" and root["commission"] == 4.8
    kim = root["children"][0]
    assert kim["email"] == "k***@example.com" and kim["name"].startswith("k***")
    assert (kim["is_ib"], kim["level"], kim["commission"]) == (True, 10, 4.8)  # 그 아래 구매로 내가 받은 몫
    assert "user_id" not in kim and "commission_total" not in kim
    plain = kim["children"][0]
    assert (plain["is_ib"], plain["commission"]) == (False, 4.8)

    rows = client.get(f"{API}/commissions", headers=ib_chain["chul"]).json()
    assert rows["total"] == 1 and rows["summary"]["net"] == 4.8
    item = rows["items"][0]
    assert (item["depth"], item["base_amount"], item["applied_rate"], item["amount"], item["status"]) == (3, 80, 6, 4.8, "COMPLETED")
    assert "***" in item["buyer"]["email"]

    order_id = item["order_id"]
    assert client.get(f"{API}/commissions", headers=ib_chain["chul"], params={"keyword": order_id}).json()["total"] == 1
    assert client.get(f"{API}/commissions", headers=ib_chain["chul"], params={"keyword": "nobody"}).json()["total"] == 0


def test_mask_name_and_email():
    from app.models import User
    from app.services.affiliate_member import mask_email, mask_name

    assert mask_name(User(first_name="홍", last_name="길동", uid="1")) == "홍*동"
    assert mask_name(User(first_name="이", last_name="순", uid="1")) == "이*"
    assert mask_name(User(first_name="Minseok", last_name="Kim", uid="1")) == "Min*** K."
    assert mask_email("minseok@naver.com") == "min***k@naver.com"
