/**
 * 기존 DB → 새 스키마 마이그레이션 (db push 전 실행)
 * idempotent — 이미 마이그레이션된 DB에서는 no-op에 가깝게 동작합니다.
 */
import { PrismaClient } from "@prisma/client";

const DISPLAY_ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

function generateDisplayId() {
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += DISPLAY_ID_CHARS[Math.floor(Math.random() * DISPLAY_ID_CHARS.length)];
  }
  return id;
}

const prisma = new PrismaClient();

async function ensureUniqueDisplayId() {
  for (let i = 0; i < 20; i++) {
    const id = generateDisplayId();
    const found = await prisma.$queryRaw`
      SELECT id FROM "User" WHERE "displayId" = ${id} LIMIT 1
    `.catch(() => []);
    if (!Array.isArray(found) || found.length === 0) return id;
  }
  throw new Error("displayId 생성 실패");
}

async function getUserColumns() {
  const columns = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'User' AND column_name IN ('nickname', 'displayId', 'name')
  `;
  return new Set(columns.map((c) => c.column_name));
}

async function getPostColumns() {
  const columns = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'Post' AND column_name IN ('targetName', 'targetUserId')
  `;
  return new Set(columns.map((c) => c.column_name));
}

async function migrateUsers(colSet) {
  if (!colSet.has("displayId")) {
    await prisma.$executeRaw`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "displayId" TEXT`;
  }

  const hasNickname = colSet.has("nickname");
  const users = hasNickname
    ? await prisma.$queryRaw<
        { id: string; name: string; nickname: string | null; displayId: string | null }[]
      >`SELECT id, name, nickname, "displayId" FROM "User"`
    : await prisma.$queryRaw<{ id: string; name: string; displayId: string | null }[]>`
        SELECT id, name, "displayId" FROM "User"`;

  for (const user of users) {
    const nickname = "nickname" in user ? user.nickname : null;
    const name = user.name?.trim() || nickname?.trim() || "이름없음";
    const displayId = user.displayId || (await ensureUniqueDisplayId());

    await prisma.$executeRaw`
      UPDATE "User"
      SET name = ${name}, "displayId" = ${displayId}
      WHERE id = ${user.id}
    `;
  }
}

async function migratePosts(postColSet) {
  if (!postColSet.has("targetUserId")) {
    await prisma.$executeRaw`ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "targetUserId" TEXT`;
  }

  if (!postColSet.has("targetName")) {
    return;
  }

  const posts = await prisma.$queryRaw<{ id: string; targetName: string }[]>`
    SELECT id, "targetName" FROM "Post" WHERE "targetName" IS NOT NULL
  `;

  const allUsers = await prisma.$queryRaw<{ id: string; name: string }[]>`
    SELECT id, name FROM "User"
  `;

  for (const post of posts) {
    const normalized = post.targetName.trim().replace(/\s+/g, "");
    const match = allUsers.find((u) => {
      const n = u.name.trim().replace(/\s+/g, "");
      return n === normalized || n.includes(normalized) || normalized.includes(n);
    });

    if (match) {
      await prisma.$executeRaw`
        UPDATE "Post" SET "targetUserId" = ${match.id} WHERE id = ${post.id}
      `;
    } else {
      await prisma.$executeRaw`DELETE FROM "Post" WHERE id = ${post.id}`;
    }
  }

  await prisma.$executeRaw`DELETE FROM "Post" WHERE "targetUserId" IS NULL`;
}

async function main() {
  const userCols = await getUserColumns();
  if (userCols.size === 0) {
    console.log("User table not found — skipping legacy migration.");
    return;
  }

  await migrateUsers(userCols);

  const postCols = await getPostColumns();
  if (postCols.size > 0) {
    await migratePosts(postCols);
  }

  console.log("Legacy migration complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
