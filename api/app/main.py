from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi import HTTPException, Request

from app.routers import analyze
from app.routers.admin import router as admin_router
from app.routers.auth import router as auth_router
from app.routers.comments import router as comments_router
from app.routers.posts import router as posts_router
from app.routers.profile import router as profile_router
from app.routers.rankings import router as rankings_router
from app.routers.upload import cron_router, files_router, upload_router
from app.routers.users import router as users_router

app = FastAPI(
    title="CompliAI API",
    description=(
        "CompliAI 백엔드 REST API입니다. 인증, 게시글/댓글 CRUD, 비즈니스 로직, "
        "AI 뉘앙스 분석을 제공합니다. 프론트엔드(Next.js)는 이 API를 호출합니다."
    ),
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    detail = exc.detail
    if isinstance(detail, str):
        return JSONResponse({"error": detail}, status_code=exc.status_code)
    return JSONResponse({"error": detail}, status_code=exc.status_code)


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok"}


@app.get("/api/health", tags=["Health"])
def api_health_check():
    return {"status": "ok"}


app.include_router(auth_router)
app.include_router(posts_router)
app.include_router(comments_router)
app.include_router(users_router)
app.include_router(profile_router)
app.include_router(rankings_router)
app.include_router(admin_router)
app.include_router(upload_router)
app.include_router(files_router)
app.include_router(cron_router)
app.include_router(analyze.router)
