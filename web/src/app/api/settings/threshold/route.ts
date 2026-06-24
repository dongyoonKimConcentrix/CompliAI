import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getSarcasmThreshold } from "@/lib/settings";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const threshold = await getSarcasmThreshold();
  return NextResponse.json({ threshold });
}
