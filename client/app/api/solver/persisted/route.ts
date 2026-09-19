import { NextResponse } from "next/server";

const SERVER_BASE =
  process.env.API_INTERNAL_URL ||
  process.env.SERVER_URL ||
  "http://127.0.0.1:8000";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const scenario = searchParams.get("scenario") || "A";

    const res = await fetch(`${SERVER_BASE}/api/solver/current?scenario=${encodeURIComponent(scenario)}`, {
      method: "GET",
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ has_solution: false, scenario }, { status: 200 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ has_solution: false, error: error.message }, { status: 200 });
  }
}
