from fastapi import APIRouter

from app.api.v1.account import router as account_router
from app.api.v1.admin_users import router as admin_users_router
from app.api.v1.auth import router as auth_router
from app.api.v1.google import router as google_router

router = APIRouter(prefix="/api/v1")
router.include_router(auth_router)
router.include_router(account_router)
router.include_router(google_router)
router.include_router(admin_users_router)
