from fastapi import APIRouter

from app.api.v1.account import router as account_router
from app.api.v1.admin_users import router as admin_users_router
from app.api.v1.announcements import admin_router as admin_announcements_router
from app.api.v1.announcements import public_router as announcements_router
from app.api.v1.auth import router as auth_router
from app.api.v1.catalog import router as catalog_router
from app.api.v1.challenges import router as challenges_router
from app.api.v1.contacts import admin_router as admin_contacts_router
from app.api.v1.contacts import public_router as support_router
from app.api.v1.google import router as google_router
from app.api.v1.kyc import router as kyc_router
from app.api.v1.rewards import admin_router as admin_rewards_router
from app.api.v1.rewards import router as rewards_router

router = APIRouter(prefix="/api/v1")
router.include_router(auth_router)
router.include_router(account_router)
router.include_router(google_router)
router.include_router(admin_users_router)
router.include_router(catalog_router)
router.include_router(challenges_router)
router.include_router(kyc_router)
router.include_router(admin_announcements_router)
router.include_router(announcements_router)
router.include_router(rewards_router)
router.include_router(admin_rewards_router)
router.include_router(support_router)
router.include_router(admin_contacts_router)
