import { NextRequest, NextResponse } from "next/server";
import { getActivities } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const line = searchParams.get("line") || undefined;
    const priority = searchParams.get("priority") ? Number(searchParams.get("priority")) : undefined;
    const search = searchParams.get("search") || undefined;

    const data = await getActivities(line, priority, search);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
