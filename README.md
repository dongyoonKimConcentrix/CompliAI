# 🚀 CompliAI: AI-Mediated Peer Compliment Platform

**CompliAI**는 사내의 건강하고 긍정적인 **직원 간 칭찬 문화를 장려**하고, AI를 통해 **부정적 뉘앙스나 공격적인 글을 실시간으로 필터링**하여 청정하고 따뜻한 소통 환경을 유지하는 사내 익명 커뮤니티 플랫폼입니다.

1 vCPU / 1GB RAM의 극도로 제한된 클라우드 환경(Oracle Cloud E2.1 Micro)에서 안정적으로 구동되도록 튜닝되었으며, 무거운 AI 연산은 외부 OpenAI API(`gpt-4o-mini`)를 활용하고 단일 인스턴스 내에서 Docker 가상 네트워크망을 통한 올인원(All-in-One) 구조로 배포됩니다.

---

## 🛠 Tech Stack & Architecture

### 1. Infrastructure & Deployment
* **Cloud:** Oracle Cloud Infrastructure (VM.Standard.E2.1.Micro - 1 vCPU, 1GB RAM, OS: Ubuntu)
* **Virtualization:** Docker & Docker Compose (Single Instance / All-in-One Multi-Container)
* **Optimization:** Swap Memory 3GB 활성화, PostgreSQL 및 컨테이너 메모리 상한선(Limits) 제한

### 2. Frontend Layer (Port: 80)
* **Framework:** Next.js (App Router) — 화면, 로그인 상태, 게시판 UI
* **Auth state:** FastAPI JWT 쿠키를 `jose`로 검증 (미들웨어·세션)
* **UI & Styling:** daisyUI + Tailwind CSS
* **Server State:** TanStack Query v5
* **Client UI State:** Zustand

### 3. Backend / REST API (Port: 8000)
* **Framework:** FastAPI (인증, CRUD, 비즈니스 로직, DB 접근)
* **API Documentation:** Swagger UI (`/docs`)
* **Data Access:** SQLModel / SQLAlchemy → PostgreSQL
* **Auth:** JWT (HTTP-only 쿠키 + Bearer)
* **AI Engine:** OpenAI API (`gpt-4o-mini`)


### 4. Database Layer (Port: 5432 - Internal Only)
* **DBMS:** PostgreSQL (postgres:15-alpine 경량화 이미지)

---

## 📋 프로젝트 요구사항 (Project Requirements)

### 1. 회원가입 및 로그인 (Auth) - 필수
* **회원가입:**
  * 사내 직원 인증을 위한 이메일 중복 검사 및 이메일 인증 기능 (토큰 링크 또는 인증 코드 검증).
  * `bcrypt`를 사용한 비밀번호 단방향 해싱 암호화 저장.
* **로그인:**
  * 이메일/비밀번호 기반 로그인 (FastAPI JWT).
  * JWT 기반 토큰 인증. 프론트는 쿠키 세션으로 로그인 상태를 유지합니다.
  * 미인증 사용자의 접근을 제한하는 FastAPI 가드 및 Next.js Middleware.

### 2. 칭찬 게시판 (Board) - 필수
* **목적:** 동료를 칭찬하고 응원하는 글을 작성하는 공간.
* **권한:** 로그인한 인증된 사용자만 게시글 작성 가능.
* **소유권:** 익명성이 보장되나, 본인이 작성한 글만 수정 및 삭제 가능 (서버사이드 및 클라이언트 사이드 교차 검증).
* **기능:** 게시글 작성, 목록 조회, 상세 조회, 수정, 삭제 (CRUD).
* **페이징 (Paging):** * TanStack Query의 `useInfiniteQuery`를 활용한 서버 부하 감소용 무한 스크롤 페이징 구축.

### 3. 동료 댓글 (Comment) - 필수
* **권한:** 로그인한 사용자만 칭찬 게시글에 따뜻한 동조 댓글 작성 가능.
* **소유권:** 본인이 작성한 댓글만 수정 및 삭제 가능.
* **기능:** 댓글 작성, 게시글별 댓글 목록 조회, 댓글 삭제.

### 4. 핵심 AI 비즈니스 로직: 부정적 뉘앙스 필터링 (FastAPI) - 필수
* **부정적 뉘앙스 및 공격성 분석 알고리즘 (AI Evaluation):**
  * 게시글/댓글 작성 시 FastAPI가 OpenAI API(`gpt-4o-mini`)로 분석합니다 (`POST /api/analyze`, Swagger `/docs`).
  * 입력된 텍스트의 **'부정적 뉘앙스 점수(Sarcasm Score: 0~100)', '공격성 유무(Aggression: True/False)'**를 AI가 분석하도록 프롬프트를 설계합니다.
  * 입력된 텍스트의 **'부정적 뉘앙스 점수(Sarcasm Score: 0~100)', '공격성 유무(Aggression: True/False)'**를 AI가 분석하도록 프롬프트를 설계합니다.
  * **필터링 규칙:** 부정적 뉘앙스 점수가 특정 임계치를 넘거나 공격성이 `True`인 경우, 해당 글은 사내 문화를 해치는 글로 간주하여 블라인드 처리되거나 작성자에게 경고를 보냅니다.
  * **UX 최적화:** AI 분석 대기 시간(2~3초) 동안 브라우저가 멈추는 현상을 방지하기 위해 TanStack Query의 **낙관적 업데이트(Optimistic Updates)**를 사용하여 프론트엔드 UI에 칭찬 카드를 즉시 먼저 렌더링합니다. 분석 실패 혹은 필터링 차단 시 자연스럽게 롤백 처리합니다.

### 5. 추가 구현 사항 - 필수 반영
* **좋아요 기능:** 동료의 칭찬 글에 공감하는 좋아요 클릭/취소 토글 및 카운팅 데이터 구조 설계.
* **게시글 검색:** 제목, 본문, 작성자 타깃 키워드 검색 쿼리 구현.
* **파일 업로드:** 칭찬 글 내 감사 카드나 이미지/파일 첨부 기능.
* **사용자 프로필:** 프로필 이미지, 닉네임 수정 및 마이페이지(내가 쓴 칭찬 글/댓글 모아보기 데이터 캐싱 처리) 대시보드.
* **게시글 신고:** 부적절한 칭찬 글에 대한 사용자 신고 및 임계치 기반 작성자 공개.

#### 게시글 신고 (Report)

* **목적:** 커뮤니티에서 부적절한 게시글을 신고하고, 다수 신고 시 작성자 익명성을 해제해 책임 소재를 명확히 합니다.
* **권한:** 로그인한 사용자만 신고 가능. **본인 게시글은 신고 불가**.
* **중복 방지:** `(postId, userId)` 유니크 제약 — 동일 게시글에 1인 1회만 신고.
* **UI:** 게시판 카드·게시글 상세의 **신고** 버튼 (`PostReportButton`). 확인 후 신고되며, 이미 신고한 경우 `신고됨`으로 표시.
* **작성자 표시 규칙** (`getAuthorDisplayName`):
  * 기본: 익명 `displayId`만 표시
  * **신고 3회 이상**(`REPORT_THRESHOLD = 3`) **또는** 부정적 뉘앙스 점수가 임계치 이상이면  
    `displayId (email)` 형태로 **이메일까지 공개**

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/posts/[id]/report` | 내 신고 여부·신고 수 조회 (Auth) |
| POST | `/api/posts/[id]/report` | 게시글 신고 (Auth, 본인 글·중복 신고 거부) |

### 6. 관리자 화면 (Admin Dashboard) — 1단계 구현

#### 접근 권한
* `User.role`: `USER` | `ADMIN` (기본 `USER`)
* `/admin` 경로: 미들웨어 로그인 + 레이아웃에서 Admin 역할 검증
* Admin 지정 (로컬):

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'your@concentrix.com';
```

> 역할 변경 후 **재로그인**해야 JWT·네비바에 반영됩니다.

#### AI 임계치 (DB `app_settings`)
* 키: `SARCASM_THRESHOLD` (0~100, 기본 70)
* **웹** `/api/admin/settings` · **FastAPI** `app/services/settings.py`가 동일 DB 값 참조
* 관리자 UI: `/admin` → 숫자 입력 후 저장

#### 검토 대기열
* **등록 조건:** `sarcasmScore >= 임계치` 또는 `aggression === true` → `moderationStatus = PENDING`
* **관리자 액션:** `승인`(APPROVED) · `삭제`
* 게시글·댓글 작성/수정 시 자동 플래그 (최초 작성 월은 `createdAt` 유지)
* 월별 랭킹: `APPROVED` + 긍정 칭찬만 집계

#### API 구조

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/admin/settings` | 임계치 조회 (Admin) |
| PUT | `/api/admin/settings` | 임계치 저장 (Admin) |
| GET | `/api/admin/moderation?status=PENDING` | 대기열 목록 |
| PATCH | `/api/admin/moderation` | `{ type, id, action: approve\|delete }` |
| GET | `/api/settings/threshold` | 임계치 조회 (로그인 사용자) |

#### 화면 구조
* `/admin` — 임계치 설정 카드 + **월간 칭찬왕 메일** 카드 + 검토 대기열 카드
* 네비바 Admin 링크 (`role === ADMIN`일 때만)

#### 월간 칭찬왕 메일 자동 발송

* **스케줄:** 매월 **1일 09:00 KST** (GitHub Actions: `0 0 1 * *` UTC)
* **내용:** **직전 달** 랭킹 1등(동점 포함)을 인증 완료(`emailVerified`) 회원 전원에게 발송
* **1등 없음:** 메일 **미발송** (로그만 기록해 중복 실행 방지)
* **환경 변수:** `CRON_SECRET` — cron API Bearer 토큰

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/cron/monthly-winner` | Cron 발송 (`Authorization: Bearer CRON_SECRET`) |
| GET | `/api/admin/monthly-winner` | 상태 조회 (Admin) |
| POST | `/api/admin/monthly-winner` | `{ action: "test" \| "send" }` — 테스트(본인) / 수동 발송 |

**GitHub Actions 설정** (`.github/workflows/monthly-winner.yml`):

Repository → Settings → Secrets and variables → Actions:

| Secret | 값 |
|--------|-----|
| `NEXTAUTH_URL` | 배포 URL (예: `https://compliai.example.com`) |
| `CRON_SECRET` | `.env`의 `CRON_SECRET`과 동일 |

로컬에서 cron API 테스트:

```bash
curl -X POST "http://localhost:3000/api/cron/monthly-winner" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

> cron API는 KST 1일 09시가 아니면 `skipped: true`로 응답합니다. Admin **수동 발송**은 시간 제한 없이 동작합니다.

---

## 🚀 로컬 개발 실행 가이드

### 사전 요구사항

| 도구 | 버전 | 용도 |
|------|------|------|
| Node.js | 20+ | Next.js 프론트엔드 |
| Python | 3.12+ | FastAPI AI 백엔드 |
| PostgreSQL | 15+ | 데이터베이스 |

### 1. 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일에 실제 값을 입력합니다.

```env
NEXTAUTH_SECRET=your_nextauth_secret_here
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL=postgresql://myuser:mypassword@localhost:5432/compliai_db
FASTAPI_INTERNAL_URL=http://localhost:8000
OPENAI_API_KEY=sk-proj-your-actual-key-here
```

**SMTP 이메일 인증 (회원가입 시 인증 메일 발송)**

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=your-email@gmail.com
```

**월간 칭찬왕 메일 Cron**

```env
CRON_SECRET=your_random_cron_secret_here
```

> GitHub Actions 또는 외부 스케줄러가 `POST /api/cron/monthly-winner` 호출 시 `Authorization: Bearer CRON_SECRET` 헤더가 필요합니다.

> Gmail 사용 시 [앱 비밀번호](https://myaccount.google.com/apppasswords)를 `SMTP_PASSWORD`에 입력하세요.  
> SMTP 미설정 시 **개발 모드**에서만 터미널/화면에 인증 링크가 표시됩니다. **프로덕션**에서는 SMTP 설정이 필수입니다.

> `web/`, `api/` 폴더에서도 동일한 `.env`를 사용합니다. 루트 `.env`를 각 폴더에 복사하거나 심볼릭 링크로 연결하세요.

```bash
cp .env web/.env
cp .env api/.env
```

### 2. PostgreSQL 설치 및 DB 생성

**macOS (Homebrew)**

```bash
brew install postgresql@15
brew services start postgresql@15

# DB 및 사용자 생성
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"
psql postgres <<'SQL'
CREATE USER myuser WITH PASSWORD 'mypassword';
CREATE DATABASE compliai_db OWNER myuser;
GRANT ALL PRIVILEGES ON DATABASE compliai_db TO myuser;
SQL
```

**연결 확인**

```bash
psql "postgresql://myuser:mypassword@localhost:5432/compliai_db" -c "SELECT 1;"
```

### 3. DB 스키마 적용 (Prisma)

```bash
cd web
npm install
npx prisma db push
```

또는 루트에서:

```bash
npm run db:push
```

### 4. FastAPI 백엔드 실행 (터미널 1)

```bash
cd api
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip3 install -r requirements.txt

set -a && source .env && set +a  # 환경 변수 로드
python3 -m uvicorn app.main:app --reload --port 8000
```

- API Health: http://localhost:8000/health
- Swagger UI: http://localhost:8000/docs

### 5. Next.js 프론트엔드 실행 (터미널 2)

```bash
cd web
npm run dev
```

- 프론트엔드: http://localhost:3000

### 6. 실행 순서 요약

```
PostgreSQL 시작 → prisma db push → API 서버(8000) → Web 서버(3000)
```

| 서비스 | 포트 | 확인 URL |
|--------|------|----------|
| PostgreSQL | 5432 | `pg_isready -h localhost -p 5432` |
| FastAPI | 8000 | http://localhost:8000/health |
| Next.js | 3000 | http://localhost:3000 |

### 7. 루트 편의 스크립트

프로젝트 루트의 `package.json`에 아래 스크립트가 포함되어 있습니다.

```bash
npm run db:push    # Prisma 스키마 DB 반영
npm run dev:api    # FastAPI 개발 서버 (api/.env 필요)
npm run dev:web    # Next.js 개발 서버
```

### 8. 개발 시 참고사항

- **이메일 인증:** SMTP 설정 시 실제 인증 메일이 발송됩니다. SMTP 미설정 + 개발 모드에서는 터미널/회원가입 화면에 인증 링크가 표시됩니다.
- **인증 메일 재발송:** 로그인 페이지에서 미인증 계정으로 로그인 시도 시 재발송 버튼이 표시됩니다.
- **OpenAI API 키 미설정:** AI 분석은 키워드 기반 폴백 모드로 동작합니다.
- **Mac에서 `pip`/`uvicorn` not found:** `pip3`, `python3 -m uvicorn`을 사용하세요.
- **API 시작 시 DB 연결 오류:** PostgreSQL이 실행 중인지 확인하세요 (`brew services list`).

---

## 🐳 올인원 배포 가이드 (Docker Compose)

1GB RAM 타깃 시스템 다운(OOM Error) 방지를 위한 컨테이너 제약 설정입니다. 해당 명세를 엄격히 준수하여 인프라를 빌드하세요.

```yaml
version: '3.8'

services:
  # 1. Database 레이어
  db:
    image: postgres:15-alpine
    container_name: compliai_db
    restart: always
    environment:
      POSTGRES_USER: myuser
      POSTGRES_PASSWORD: mypassword
      POSTGRES_DB: compliai_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    # 1GB RAM 맞춤형 PostgreSQL 가벼운 버퍼 튜닝
    command: >
      postgres
      -c shared_buffers=32MB
      -c max_connections=10
      -c work_mem=2MB
    deploy:
      resources:
        limits:
          memory: 200M

  # 2. AI 백엔드 레이어 (Swagger 자동 명세)
  api:
    image: dongyoonkimconcentrix/compliai-api:latest
    container_name: compliai_api
    restart: always
    depends_on:
      - db
    environment:
      - DATABASE_URL=postgresql://myuser:mypassword@db:5432/compliai_db
      - OPENAI_API_KEY=sk-proj-your-actual-key-here
    ports:
      - "8000:8000"
    deploy:
      resources:
        limits:
          memory: 200M

  # 3. 프론트엔드 및 인증 레이어
  web:
    image: dongyoonkimconcentrix/compliai-web:latest
    container_name: compliai_web
    restart: always
    depends_on:
      - api
    environment:
      - FASTAPI_INTERNAL_URL=http://api:8000
      - DATABASE_URL=postgresql://myuser:mypassword@db:5432/compliai_db
      - NEXTAUTH_SECRET=your_nextauth_secret_here
    ports:
      - "80:3000"
    deploy:
      resources:
        limits:
          memory: 250M

volumes:
  postgres_data:
  uploads_data:
```

> 실제 설정은 프로젝트 루트 `docker-compose.yml`을 사용하세요. **프로덕션 VM에서는 빌드하지 않고** Docker Hub 이미지를 pull 합니다.

### CI/CD (GitHub Actions)

| 워크플로 | 트리거 | 역할 |
|---------|--------|------|
| `ci.yml` | push/PR → `main` | Web 빌드·lint·typecheck, API import 검증 |
| `deploy.yml` | push → `main` | GitHub에서 이미지 빌드·push → VM SSH 배포 |
| `monthly-winner.yml` | 매월 1일 cron | 칭찬왕 메일 발송 |

**Repository Secrets (Actions):**

| Secret | 용도 |
|--------|------|
| `DOCKERHUB_USERNAME` | Docker Hub 로그인 |
| `DOCKERHUB_TOKEN` | Docker Hub Access Token |
| `SSH_HOST` | 오라클 VM 공인 IP |
| `SSH_USER` | `ubuntu` |
| `SSH_PRIVATE_KEY` | SSH `.key` 파일 전체 내용 |
| `NEXTAUTH_URL` | `http://공인IP` (월간 메일 cron) |
| `CRON_SECRET` | `.env`와 동일 |

**배포 흐름:** `main` push → GitHub에서 `compliai-web/api/migrate` 이미지 빌드·push → VM에서 `git pull` + `scripts/deploy.sh` (pull만, 빌드 없음). 브라우저는 Next.js(80)로 UI를 보고, `/api/*`는 FastAPI로 프록시됩니다. Swagger는 `http://공인IP:8000/docs`.

**로컬에서 수동 빌드·push (Mac):**

```bash
export DOCKERHUB_USERNAME=your-username
export DOCKERHUB_TOKEN=your-token
npm run docker:build-push
# VM에서: bash scripts/deploy.sh
```

**로컬 Docker 전체 빌드 테스트:**

```bash
npm run docker:up   # docker-compose.local.yml 포함
```

### Oracle Cloud 배포 (단계별)

**사전:** OCI VM (Ubuntu, 1 vCPU / 1GB RAM) 생성, Security List에서 **80**, **8000**, **22** 인바운드 허용.

> **1GB VM에서는 이미지 빌드를 하지 마세요.** GitHub Actions 또는 Mac에서 빌드 후 Hub에 push합니다.

#### 1) VM 초기 설정 (최초 1회)

```bash
sudo bash scripts/oracle-setup.sh
# 재로그인 (docker 그룹 적용)
```

#### 2) 코드 배포

```bash
sudo mkdir -p /opt/compliai && sudo chown $USER:$USER /opt/compliai
cd /opt/compliai
git clone https://github.com/dongyoonKimConcentrix/CompliAI.git .
cp .env.example .env
nano .env
```

**프로덕션 `.env` 필수 항목:**

```env
NEXTAUTH_URL=http://YOUR_PUBLIC_IP
NEXTAUTH_SECRET=랜덤_긴_문자열
DATABASE_URL=postgresql://myuser:mypassword@db:5432/compliai_db
FASTAPI_INTERNAL_URL=http://api:8000
OPENAI_API_KEY=sk-...
SMTP_HOST=...
SMTP_USER=...
SMTP_PASSWORD=...
EMAIL_FROM=...
CRON_SECRET=랜덤_시크릿
```

> `DATABASE_URL` 호스트는 Docker 내부이므로 **`db`** 입니다.

#### 3) 최초 배포 (이미지가 Hub에 있어야 함)

**방법 A — GitHub Actions:** `main`에 push하면 `deploy.yml`이 자동 빌드·배포

**방법 B — Mac에서 수동:**

```bash
npm run docker:build-push   # Hub에 push
```

VM에서:

```bash
bash scripts/deploy.sh    # pull → prisma migrate → up
```

- Web: `http://공인IP` (포트 80)
- API: `http://공인IP:8000/docs`

#### 4) Admin 계정 지정

```bash
docker compose exec db psql -U myuser -d compliai_db \
  -c "UPDATE \"User\" SET role = 'ADMIN' WHERE email = 'your@email.com';"
```

#### 5) 이후 업데이트

`main` push 시 GitHub Actions가 자동 배포하거나, VM에서:

```bash
cd /opt/compliai && git pull && bash scripts/deploy.sh
```