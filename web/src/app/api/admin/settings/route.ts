import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getSarcasmThreshold, setSarcasmThreshold } from "@/lib/settings";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const threshold = await getSarcasmThreshold();
  return NextResponse.json({ threshold });
}

export async function PUT(request: Request) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const { threshold } = await request.json();
  const value = Number(threshold);

  if (!Number.isInteger(value) || value < 0 || value > 100) {
    return NextResponse.json({ error: "임계치는 0~100 정수여야 합니다." }, { status: 400 });
  }

  try {
    await setSarcasmThreshold(value, session!.user.id);
    return NextResponse.json({ threshold: value, message: "임계치가 저장되었습니다." });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "저장 실패" },
      { status: 400 }
    );
  }
}
