import { NextResponse } from "next/server";

const FASTAPI_URL =
  process.env.API_INTERNAL_URL ||
  process.env.SERVER_URL ||
  "http://127.0.0.1:8000";

export async function GET() {
  try {
    const res = await fetch(`${FASTAPI_URL}/api/database/status`, {
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`FastAPI returned status ${res.status}`);
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      {
        connected: false,
        error: err.message,
        database: "nebula",
        schema: "nebula",
      },
      { status: 200 }
    );
  }
}
