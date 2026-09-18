import { NextResponse } from "next/server";
import { getDatabaseOverview } from "@/lib/db";

export async function GET() {
  try {
    const overview = await getDatabaseOverview();
    return NextResponse.json(overview);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
