"""공통 에러 응답.

기존 서버와 같은 형태를 유지한다. 프론트는 `detail.error_code`, `detail.message`를 읽고,
일부 화면은 최상위 `message`를 읽는다.

    {"detail": {"error_code": "EMAIL_ALREADY_REGISTERED", "message": "..."}, "message": "..."}
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, status_code: int, error_code: str, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.error_code = error_code
        self.message = message


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "detail": {"error_code": exc.error_code, "message": exc.message},
                "message": exc.message,
            },
        )
