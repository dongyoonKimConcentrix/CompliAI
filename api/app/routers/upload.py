from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pathlib import Path
import os
import time

from app.config import get_settings
from app.deps import AuthUser, DBSession, require_cron_secret
from app.services.monthly import run_monthly_winner_email_job

upload_router = APIRouter(tags=["Upload"])
cron_router = APIRouter(tags=["Cron"])
files_router = APIRouter(tags=["Files"])

ALLOWED = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MIME = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp",
}


@upload_router.post("/api/upload")
async def upload(user: AuthUser, file: UploadFile = File(...)):
    if file.content_type not in ALLOWED:
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드 가능합니다.")
    settings = get_settings()
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    ext = (file.filename or "jpg").rsplit(".", 1)[-1].lower()
    ext = "".join(ch for ch in ext if ch.isalnum()) or "jpg"
    filename = f"{int(time.time() * 1000)}-{os.urandom(4).hex()}.{ext}"
    dest = upload_dir / filename
    dest.write_bytes(await file.read())
    return {"url": f"/uploads/{filename}"}


@files_router.get("/uploads/{filename}")
def serve_upload(filename: str):
    if not filename or ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="잘못된 파일명입니다.")
    settings = get_settings()
    path = Path(settings.upload_dir) / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    ext = filename.rsplit(".", 1)[-1].lower()
    return FileResponse(path, media_type=MIME.get(ext, "application/octet-stream"))


@cron_router.post("/api/cron/monthly-winner", dependencies=[Depends(require_cron_secret)])
def cron_monthly(session: DBSession):
    return run_monthly_winner_email_job(session, triggered_by="cron")
