const DISPLAY_ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const DISPLAY_ID_LENGTH = 8;

export function generateDisplayId(): string {
  let id = "";
  for (let i = 0; i < DISPLAY_ID_LENGTH; i++) {
    id += DISPLAY_ID_CHARS[Math.floor(Math.random() * DISPLAY_ID_CHARS.length)];
  }
  return id;
}

export async function createUniqueDisplayId(
  exists: (id: string) => Promise<boolean>
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const id = generateDisplayId();
    if (!(await exists(id))) return id;
  }
  throw new Error("익명 ID 생성에 실패했습니다.");
}
