import { NextResponse } from "next/server";

const SERVER_BASE =
  process.env.API_INTERNAL_URL ||
  process.env.SERVER_URL ||
  "http://127.0.0.1:8000";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const scenario = body.scenario || "A";
    const maxTime = body.max_time_seconds || 30;

    const res = await fetch(`${SERVER_BASE}/api/solver/solve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenario,
        max_time_seconds: maxTime,
        sync_db: true,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `Solver failed (${res.status}): ${errText}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const scenario = searchParams.get("scenario") || "A";
    const maxTime = searchParams.get("max_time_seconds") || "30";

    const res = await fetch(
      `${SERVER_BASE}/stub_solve?scenario=${scenario}&max_time_seconds=${maxTime}`
    );

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `Solver failed: ${errText}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
