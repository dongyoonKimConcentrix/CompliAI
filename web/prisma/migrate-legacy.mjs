/**
 * 기존 DB → 새 스키마 마이그레이션 (db push 전 실행)
 * node prisma/migrate-legacy.mjs && npx prisma db push --accept-data-loss
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

async function main() {
  const columns = await prisma.$queryRaw`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'User' AND column_name IN ('nickname', 'displayId', 'name')
  `;
  const colSet = new Set(columns.map((c) => c.column_name));

  if (!colSet.has("displayId")) {
    await prisma.$executeRaw`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "displayId" TEXT`;
  }

  const users = await prisma.$queryRaw`
    SELECT id, name, nickname, "displayId" FROM "User"
  `;

  for (const user of users) {
    const name = user.name?.trim() || user.nickname?.trim() || "이름없음";
    const displayId = user.displayId || (await ensureUniqueDisplayId());

    await prisma.$executeRaw`
      UPDATE "User"
      SET name = ${name}, "displayId" = ${displayId}
      WHERE id = ${user.id}
    `;
  }

  const postCols = await prisma.$queryRaw`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'Post' AND column_name IN ('targetName', 'targetUserId')
  `;
  const postColSet = new Set(postCols.map((c) => c.column_name));

  if (postColSet.has("targetName") && !postColSet.has("targetUserId")) {
    await prisma.$executeRaw`ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "targetUserId" TEXT`;

    const posts = await prisma.$queryRaw`
      SELECT id, "targetName" FROM "Post" WHERE "targetName" IS NOT NULL
    `;

    const allUsers = await prisma.$queryRaw`SELECT id, name FROM "User"`;

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

  console.log("Legacy migration complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
