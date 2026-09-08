# CompliAI 프로젝트 Q&A

프로젝트 코드베이스를 기준으로 작성한 기술 질문·답변 문서입니다. (코드 기준 최신화)

**아키텍처 요약**

| 레이어 | 기술 | 역할 |
|--------|------|------|
| `web/` | Next.js 15 App Router | 프론트엔드 (UI, 로그인 상태, 게시판) |
| `api/` | FastAPI | REST API + JWT 인증 + Prisma 스키마 DB + 비즈니스 로직 + AI 분석 |
| DB | PostgreSQL 15 (Docker) | User / Post / Comment 관계 |
| 배포 | Oracle Cloud VM + Docker Compose | `scripts/deploy.sh` |

---

## Backend

### JWT 인증 구현

#### JWT 토큰에는 어떤 정보를 포함하셨나요?

CompliAI의 JWT 인증은 **Python FastAPI**에서 발급합니다. `NEXTAUTH_SECRET`(또는 `JWT_SECRET`)으로 서명된 JWT가 HTTP-only 쿠키 `compliai_token`에 저장됩니다. Next.js는 화면과 미들웨어에서 이 쿠키를 검증합니다. FastAPI Swagger(`/docs`)에서는 Bearer 토큰으로도 호출할 수 있습니다.

로그인 방식은 **CredentialsProvider**(이메일/비밀번호)만 지원합니다. OAuth(소셜 로그인)는 없습니다.

**프로젝트에서 명시적으로 추가한 커스텀 클레임**

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | `string` | DB `User.id` (CUID) |
| `role` | `UserRole` | `USER` 또는 `ADMIN` |

`jwt` 콜백에서 로그인 시 `id`, `role`을 토큰에 주입하고, `session` 콜백을 통해 클라이언트/서버 세션 객체로 노출합니다.

```typescript
// web/src/lib/auth.ts
callbacks: {
  async jwt({ token, user }) {
    if (user) {
      token.id = user.id;
      token.role = user.role;
    }
    return token;
  },
  async session({ session, token }) {
    if (session.user && token.id) {
      session.user.id = token.id as string;
      session.user.role = token.role as typeof session.user.role;
    }
    return session;
  },
},
```

**JWT 클레임 (FastAPI 발급)**

| 필드 | 설명 |
|------|------|
| `sub` | 사용자 ID |
| `name` | 실명 |
| `email` | 이메일 |
| `role` | `USER` 또는 `ADMIN` |
| `iat` / `exp` | 발급·만료 (기본 30일) |

게시판 작성자 표시는 JWT가 아니라 DB `User.displayId`입니다. 이메일 인증·비밀번호 재설정은 JWT가 아닌 DB hex 토큰입니다. Cron은 `Authorization: Bearer CRON_SECRET`입니다.

---

## Database

### 테이블 관계

#### 테이블 간 관계를 어떤 기준으로 설계하셨나요?

**PostgreSQL 15** 단일 DB에 **Prisma 스키마**(`web/prisma/schema.prisma`) 하나로 구조를 정의합니다. `prisma/migrations/`는 없고 `prisma db push`로 동기화합니다. 배포 시 `scripts/migrate-db.sh`가 레거시 변환(`migrate-legacy.mjs`) 후 `db push`를 실행합니다.

**1. 소유권 + 칭찬 대상(FK) + 대댓글**

```
User
 ├── Post (authorId)              ← 작성자
 ├── Post (targetUserId)          ← 칭찬 받는 사람
 │    ├── Comment (postId, parentId?)  ← parentId로 대댓글(깊이 1)
 │    ├── Like (postId, userId)
 │    └── Report (postId, userId)
 ├── Comment (authorId)
 ├── Like (userId)
 └── Report (userId)
```

- 작성자 `authorId`, 칭찬 대상 `targetUserId`로 회원을 직접 지정합니다.
- UI 작성자는 `displayId` 익명 표시, 서버는 `authorId`로 소유권·신고·자기 칭찬을 검증합니다.
- 대댓글: `Comment.parentId` self-relation. 대댓글의 답글은 최상위 부모에 붙여 **1단 깊이**로 유지합니다 (`POST .../comments`).

**2. CASCADE 삭제**

| 관계 | FK | 삭제 정책 |
|------|-----|-----------|
| Post → User (작성자/칭찬 대상) | `authorId` / `targetUserId` | CASCADE |
| Comment → Post / User / Comment | `postId` / `authorId` / `parentId` | CASCADE |
| Like → Post / User | `postId`, `userId` | CASCADE |
| Report → Post / User | `postId`, `userId` | CASCADE |

회원 삭제(관리자·본인 탈퇴) 시 관련 게시글·댓글·좋아요·신고가 함께 삭제됩니다.

**3. 유니크 제약**

| 제약 | 설명 |
|------|------|
| `User.email` / `displayId` | 로그인·익명 ID 중복 방지 |
| `verificationToken` / `passwordResetToken` | 토큰 중복 방지 |
| `Like(postId, userId)` | 좋아요 1회 |
| `Report(postId, userId)` | 신고 1회 |
| `MonthlyAnnouncementLog(year, month)` | 월간 메일 중복 발송 방지 |

**4. User 필드 역할**

| 필드 | 용도 |
|------|------|
| `name` | 실명 — 칭찬 대상·랭킹 |
| `displayId` | 게시글·댓글 작성자 익명 ID |
| `email` | 로그인·인증·고위험 시 노출 |
| `profileImage` | DB/API만 존재, **UI 미사용** |
| `verificationToken` | 이메일 인증 (24시간) |
| `passwordResetToken` / `ExpiresAt` | 비밀번호 재설정 (1시간) |

**5. Post/Comment AI·검수 필드**

| 필드 | 용도 |
|------|------|
| `sarcasmScore` / `aggression` / `aiReport` | AI 분석 결과 |
| `moderationStatus` | `PENDING` / `APPROVED` 사용. enum의 `REJECTED`는 **코드 미사용** |
| `adminReviewedAt` / `adminReviewedBy` | 관리자 검수 이력 |
| `isBlinded` | 항상 `false`로 저장 — **실질 미사용** |

**6. 공유·로그 테이블**

| 테이블 | 역할 |
|--------|------|
| `AppSetting` | Web·FastAPI 공유 (`SARCASM_THRESHOLD`) |
| `MonthlyAnnouncementLog` | 칭찬왕 메일 발송 이력 |
| `AIAnalysisLog` | FastAPI 분석 로그 (콘텐츠와 느슨한 참조) |

**7. 이중 ORM**

- Next.js(Prisma): 핵심 CRUD
- FastAPI(SQLModel): `app_settings`, `ai_analysis_logs`

### DB 스키마 동기화·배포

| 환경 | 방식 |
|------|------|
| 로컬 | `npm run db:push` |
| 프로덕션 | `migrate-db.sh` → legacy + `db push` (deploy.sh가 자동 호출) |

---

## 비즈니스 로직

### 칭찬 대상·자기 칭찬 방지

- UI: `PraiseTargetSelect`로 인증 완료 `USER`를 이름 검색·선택
- API: `GET /api/users/praise-targets?q=` (본인·관리자 제외)
- 서버: `findValidPraiseTarget()` — 본인 칭찬 거부, USER·인증·이름 검증
- 랭킹: `authorId === targetUserId` 스킵

### AI 분석·검수 대기열

```
클라이언트 → Next.js API → FastAPI POST /analyze → Post/Comment에 결과 저장
```

**FastAPI** (`api/app/services/analyzer.py`)

1. 규칙 기반 폴백 (`SARCASM_PHRASES`, `CONTRAST_PATTERNS` 등)
2. OpenAI `gpt-4o-mini` JSON 분석 (키 없으면 스킵)
3. 병합: `score = max(rule, openai)`, aggression OR, 서술 필드는 AI 우선

**프롬프트** (`api/app/services/prompts.py`): 특정 문장 암기가 아니라 **구조 분해 루브릭**

1. 칭찬어를 뺀 실제 행동 추출  
2. behavior valence (positive/negative)  
3. 표면 포장(열정·효율·리더십 등)  
4. mismatch면 `sarcasm_score` 85+ · `aggression=true`  
5. 자가 검증(“당사자가 기분 나쁜가?” 등)

유저 메시지는 `ANALYSIS_USER_TEMPLATE`로 체크리스트를 강제합니다. 키워드 목록은 **OpenAI 실패 시 폴백**용입니다.

**검수 대기열** (`needsModerationReview`)

| 조건 | `moderationStatus` |
|------|-------------------|
| `sarcasmScore >= DB 임계치` 또는 `aggression` | `PENDING` |
| 그 외 | `APPROVED` |

**승인 / 삭제의 의미** (`PATCH /api/admin/moderation`)

| 액션 | 동작 |
|------|------|
| **승인** | `PENDING` → `APPROVED`, 검수 이력 기록. **게시판에서 숨기거나 점수를 바꾸지 않음**. 대기열에서만 제거. 랭킹 집계 대상이 될 수 있음(단, 점수가 여전히 높으면 랭킹 필터에 걸릴 수 있음) |
| **삭제** | Post/Comment 물리 삭제 |

- `PENDING` 글도 **게시판·상세에 그대로 노출**됩니다 (목록 API가 status로 필터하지 않음).
- 글/댓글은 AI 결과와 무관하게 **등록은 허용**됩니다.
- 댓글 수정(`PUT /api/comments/[id]`)은 AI 재분석 없이 `content`만 변경합니다.

**임계치 이중 기준 (주의)**

| 용도 | 출처 |
|------|------|
| 작성 시 검수·월간 랭킹 Prisma 필터 | DB `app_settings` (`getSarcasmThreshold()`) |
| 작성자 이메일 노출 UI · `isPositivePraise` · 배지 컴포넌트 | **하드코딩 70** (`web/src/lib/ai.ts`의 `SARCASM_THRESHOLD`) |

`useSarcasmThreshold` 훅은 정의만 있고 **현재 import되지 않습니다.**

### 익명 표시·이메일 노출

`getAuthorDisplayName()` (`web/src/lib/author-display.ts`)

| 조건 | 표시 |
|------|------|
| 일반 | `displayId` |
| 부정적 뉘앙스 ≥ 70 **또는** 신고 ≥ 3 | `displayId (email)` |

- 게시글: score + reportCount / 댓글: score만 (댓글 신고 없음)
- 칭찬 대상: 배지에 **실명** 표시

### 신고

- `GET/POST /api/posts/[id]/report`
- 1인 1회, 본인 글 불가
- 신고 ≥ 3 → 작성자 이메일 노출 (`REPORT_THRESHOLD = 3`)

### 대댓글

- `parentId`로 1단 스레드
- UI: 루트 + 들여쓴 답글, 「답글」 버튼
- 부모 삭제 시 대댓글 CASCADE 삭제

### 월간 랭킹

`getMonthlyRanking` + `buildLeaderboard`

- KST 월 범위
- Prisma: `sarcasmScore < DB임계치`, `aggression=false`, `moderationStatus=APPROVED`
- 추가: `isPositivePraise`(하드코딩 70) · 자기 칭찬 제외
- 점수: 칭찬 건수 × 10 + 좋아요 × 1
- API: `GET /api/rankings/monthly?year=&month=`

**월간 칭찬왕 메일**

- 직전 달 1등(동점 포함) → 인증 회원 전원
- GitHub Actions: 매월 1일 09:00 KST
- 관리자: `POST /api/admin/monthly-winner` (`test` / `send`)

### 관리자 화면 (`/admin`)

| 카드 | 내용 |
|------|------|
| 이번 달 칭찬 점수 1등 | `GET /api/rankings/monthly` — 1~3위 요약 |
| 가입 회원 | `GET/DELETE /api/admin/users` — 검색·삭제 (본인 삭제 불가, 마지막 ADMIN 보호) |
| AI 임계치 | `GET/PUT /api/admin/settings` |
| 월간 칭찬왕 메일 | 상태 조회·테스트/수동 발송 |
| 검토 대기열 | PENDING 승인/삭제 |

### 회원가입 이름 중복

`normalizeName` / `namesMatch` / `isDuplicateName` — fuzzy 중복 검사

---

## Frontend

### Store 상태관리

| 라이브러리 | 역할 |
|------------|------|
| TanStack Query v5 | 서버 상태·캐싱·낙관적 업데이트·무한 스크롤 |
| Zustand | 모달·테마 |
| FastAPI JWT 쿠키 | 로그인 세션 |

**주요 queryKey**

| queryKey | 데이터 |
|----------|--------|
| `["posts", query]` | 게시글 목록 |
| `["post", id]` | 상세 + 댓글(스레드) |
| `["like", id]` / `["report", postId]` | 좋아요·신고 |
| `["praise-targets", query]` | 칭찬 대상 검색 |
| `["profile"]` / `["mypage"]` | 프로필·마이페이지 |
| `["rankings", year, month]` | 월간 랭킹 |
| `["admin-settings"]` / `["admin-moderation"]` | 임계치·대기열 |
| `["admin-monthly-winner"]` | 칭찬왕 메일 상태 |
| `["admin-users"]` | 회원 목록 |
| `["admin-current-month-leader"]` | 이번 달 1등 |
| `["threshold"]` | 훅만 정의, 미사용 |

### API 연동

- 브라우저 → Next.js `/api/*` (FastAPI로 프록시)
- FastAPI가 REST·인증·DB·비즈니스 로직을 처리
- 인증: FastAPI JWT **쿠키** (`compliai_token`) 또는 Bearer
- API 가드: FastAPI `get_current_user` / 관리자 의존성

### 에러 처리

- React Query `onError` → Zustand 전역 모달
- 로그인·회원가입 등은 로컬 `error` state
- 댓글 낙관적 업데이트 실패 시 롤백

### 로그인·접근 제어

| 계층 | 방식 |
|------|------|
| Middleware | `/board`, `/posts/*`, `/mypage`, `/profile`, `/rankings`, `/admin` |
| Admin layout | DB `role` 재조회 |
| API Route | 401/403 |

공개: `/`, `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`

세션 JWT 기본 만료 **30일**. 이메일 인증 토큰 24시간, 비밀번호 재설정 1시간.

### 회원가입·비밀번호 재설정

- 가입: `name`, `@concentrix.com` email, password → `displayId` 자동 생성, bcrypt(12)
- 메일 인증: DB hex 토큰 링크
- 재설정: 1시간 토큰, 이메일 열거 방지(동일 성공 메시지)

### UI·에셋

- **아이콘**: `@fortawesome/react-fontawesome` **SVG** (`components/icon.tsx`). Safari Lockdown Mode는 웹폰트를 차단하므로 SVG로 전환함.
- **본문 폰트**: `public/fonts`에 GMarketSans self-host. Lockdown Mode에서는 시스템 폰트 폴백.
- 테마: daisyUI `apple` / `apple-dark` (Zustand)

---

## Infrastructure

### 프로덕션

| 컨테이너 | 포트 | 메모리 |
|----------|------|--------|
| `compliai_db` | 내부 | 200M |
| `compliai_api` | 8000 | 200M |
| `compliai_web` | 80→3000 | 250M |

- Volumes: `postgres_data`, `uploads_data` → `/app/public/uploads`
- Swagger: `http://공인IP:8000/docs` (OCI Security List 8000 필요)

### CI/CD

| Workflow | 트리거 | 내용 |
|----------|--------|------|
| `ci.yml` | push/PR → main | web tsc/lint/build, api import |
| `deploy.yml` | push → main | Hub 빌드 → VM `deploy.sh` |
| `monthly-winner.yml` | cron | 칭찬왕 메일 |

### 파일 업로드

- `POST /api/upload` → `public/uploads/`에 저장, URL `/uploads/{filename}` 반환
- **서빙**: `GET /uploads/[filename]` Route Handler가 디스크에서 읽어 응답  
  (Next.js **standalone**은 런타임에 생긴 `public` 파일을 정적 제공하지 않음)
- 허용: jpeg, png, gif, webp

### 전체 API 엔드포인트

| Method | Path | 인증 |
|--------|------|------|
| * | `/api/auth/[...nextauth]` | - |
| POST | `/api/auth/register` | - |
| POST | `/api/auth/verify` | - |
| POST | `/api/auth/resend-verification` | - |
| POST | `/api/auth/forgot-password` | - |
| POST | `/api/auth/reset-password` | - |
| GET/POST | `/api/posts` | Auth |
| GET/PUT/DELETE | `/api/posts/[id]` | Auth |
| GET/POST | `/api/posts/[id]/comments` | Auth |
| GET/POST | `/api/posts/[id]/like` | Auth |
| GET/POST | `/api/posts/[id]/report` | Auth |
| DELETE/PUT | `/api/comments/[id]` | Auth (본인) |
| GET | `/api/users/praise-targets` | Auth |
| GET | `/api/rankings/monthly` | Auth |
| GET/PUT/DELETE | `/api/profile` | Auth |
| GET | `/api/mypage` | Auth |
| POST | `/api/upload` | Auth |
| GET | `/uploads/[filename]` | - (파일 서빙) |
| GET | `/api/settings/threshold` | Auth |
| GET/PUT | `/api/admin/settings` | Admin |
| GET/PATCH | `/api/admin/moderation` | Admin |
| GET/POST | `/api/admin/monthly-winner` | Admin |
| GET/DELETE | `/api/admin/users` | Admin |
| POST | `/api/cron/monthly-winner` | CRON_SECRET |

**FastAPI**: `GET /health`, `POST /analyze`, `GET /docs`
