"""공통 에러 응답.

기존 서버와 같은 형태를 유지한다. 기존 서버는 최상위에 error_code, message_key, message를 두었고,
일부 프론트 화면(비밀번호 찾기 등)은 `detail.error_code`, `detail.message`를 읽으므로 두 곳 모두 채운다.
error_code는 기존 서버와 같은 소문자 snake_case를 쓴다 (예: email_already_exists).

    {
      "error_code": "email_already_exists",
      "message_key": "error.email_already_exists",
      "message": "...",
      "detail": {"error_code": "email_already_exists", "message": "..."}
    }
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, status_code: int, error_code: str, message: str, data: dict | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.error_code = error_code
        self.message = message
        # 화면이 다음 단계에 쓸 값 (예: 제휴 계정 활성화에 필요한 가린 이메일). 있으면 data로 함께 준다.
        self.data = data


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        content = {
            "error_code": exc.error_code,
            "message_key": f"error.{exc.error_code}",
            "message": exc.message,
            "detail": {"error_code": exc.error_code, "message": exc.message},
        }
        if exc.data:
            content["data"] = exc.data
            content["detail"]["data"] = exc.data
        return JSONResponse(status_code=exc.status_code, content=content)
