import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  getMonthlyWinnerEmailStatus,
  runMonthlyWinnerEmailJob,
} from "@/lib/monthly-winner-email";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const status = await getMonthlyWinnerEmailStatus();
    return NextResponse.json(status);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "조회 실패" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const action = body.action as "test" | "send";

  if (action !== "test" && action !== "send") {
    return NextResponse.json(
      { error: "action은 test 또는 send 여야 합니다." },
      { status: 400 }
    );
  }

  try {
    const result = await runMonthlyWinnerEmailJob({
      force: action === "send",
      testEmail: action === "test" ? session!.user.email! : undefined,
      triggeredBy: "admin",
      skipTimeWindow: true,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "발송 실패" },
      { status: 500 }
    );
  }
}
