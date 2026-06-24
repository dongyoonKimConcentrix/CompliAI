import { prisma } from "@/lib/prisma";

export const SETTING_KEYS = {
  SARCASM_THRESHOLD: "SARCASM_THRESHOLD",
} as const;

const DEFAULT_THRESHOLD = 70;

export async function ensureDefaultSettings() {
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEYS.SARCASM_THRESHOLD },
    create: { key: SETTING_KEYS.SARCASM_THRESHOLD, value: String(DEFAULT_THRESHOLD) },
    update: {},
  });
}

export async function getSarcasmThreshold(): Promise<number> {
  await ensureDefaultSettings();
  const setting = await prisma.appSetting.findUnique({
    where: { key: SETTING_KEYS.SARCASM_THRESHOLD },
  });
  const parsed = parseInt(setting?.value ?? String(DEFAULT_THRESHOLD), 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_THRESHOLD;
}

export async function setSarcasmThreshold(value: number, adminId: string) {
  if (value < 0 || value > 100) {
    throw new Error("임계치는 0~100 사이여야 합니다.");
  }
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEYS.SARCASM_THRESHOLD },
    create: {
      key: SETTING_KEYS.SARCASM_THRESHOLD,
      value: String(value),
      updatedBy: adminId,
    },
    update: {
      value: String(value),
      updatedBy: adminId,
    },
  });
}

export function needsModerationReview(
  sarcasmScore: number,
  aggression: boolean,
  threshold: number
): boolean {
  return sarcasmScore >= threshold || aggression;
}
