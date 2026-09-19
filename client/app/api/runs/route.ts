import { NextResponse } from "next/server";

const SERVER_BASE =
  process.env.API_INTERNAL_URL ||
  process.env.SERVER_URL ||
  "http://127.0.0.1:8000";

export async function GET() {
  try {
    const res = await fetch(`${SERVER_BASE}/api/runs`);
    if (!res.ok) {
      return NextResponse.json([], { status: 200 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
