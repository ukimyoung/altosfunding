from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr

from app.broker import AccountType, BrokerClient, MT4Account, get_broker_client

router = APIRouter(prefix="/accounts", tags=["accounts"])


class CreateAccountRequest(BaseModel):
    account_type: AccountType
    name: str
    email: EmailStr
    balance: float


@router.post("", response_model=MT4Account)
async def create_account(
    body: CreateAccountRequest, broker: BrokerClient = Depends(get_broker_client)
) -> MT4Account:
    return await broker.create_account(body.account_type, body.name, body.email, body.balance)
