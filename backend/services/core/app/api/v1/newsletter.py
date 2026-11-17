"""마케팅 메일 수신거부 (공개). 메일 본문의 '수신거부' 링크가 이 주소를 연다."""

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from app.deps import Session
from app.services import newsletter as svc

router = APIRouter(tags=["newsletter"])


@router.get("/newsletter/unsubscribe", summary="마케팅 메일 수신거부", response_class=HTMLResponse)
async def unsubscribe(session: Session, u: str = "", t: str = "") -> HTMLResponse:
    user = await svc.unsubscribe(session, u, t)
    await session.commit()
    return HTMLResponse(svc.result_page(user is not None, user.locale if user else None), status_code=200 if user else 400)
