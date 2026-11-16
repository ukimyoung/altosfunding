from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class DepositCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    tx_hash: str = Field(max_length=200)
    network: str | None = Field(default=None, max_length=50)


class DepositCreated(BaseModel):
    ok: bool = True
    request_id: int
    amount: float
    tx_hash: str
    network: str | None
    status: str


class WithdrawCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    network: str = Field(max_length=50)
    wallet_address: str = Field(max_length=200)
    verification_code: str | None = Field(default=None, max_length=20)
    totp_code: str | None = Field(default=None, max_length=20)


class WithdrawCreated(BaseModel):
    ok: bool = True
    request_id: int
    amount: float
    fee: float
    network: str
    wallet_address: str
    status: str


class WalletOut(BaseModel):
    id: int
    wallet_type: str
    blockchain_address: str | None = None
    network: str | None = None
    balance_usdt: float
    is_active: bool


class MyAssetOut(BaseModel):
    total_asset: float
    total_live_balance: float = 0
    # Live 계좌는 지원하지 않아 항상 빈 목록 (기존 응답 형태 유지)
    live_accounts: list[dict] = []


class NetworkItem(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    desc: str = Field(default="", max_length=100)
    fee: float = Field(default=0, ge=0)
    is_active: bool = True


class NetworkFeesUpdate(BaseModel):
    networks: list[NetworkItem] = Field(max_length=50)


class ProfitSplitOut(BaseModel):
    trader_pct: float
    company_pct: float


class ProfitSplitUpdate(BaseModel):
    trader_pct: float = Field(ge=50, le=100)


class ProfitSplitHistoryItem(BaseModel):
    id: int
    old_pct: float | None
    new_pct: float
    admin_email: str | None
    changed_at: datetime


class ProfitSplitHistoryPage(BaseModel):
    items: list[ProfitSplitHistoryItem]
    total: int
    page: int
    size: int
    pages: int


class DepositRejectBody(BaseModel):
    reason: str = Field(max_length=500)


class WithdrawalApproveBody(BaseModel):
    tx_hash: str = Field(max_length=200)


class WithdrawalRejectBody(BaseModel):
    note: str = Field(max_length=500)


class RequestProcessed(BaseModel):
    ok: bool = True
    id: int
    status: Literal["APPROVED", "REJECTED"]
    amount: float
    fee: float = 0
    tx_hash: str | None = None
    reject_reason: str | None = None
