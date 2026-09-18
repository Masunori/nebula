import { NextRequest, NextResponse } from "next/server";
import { commitDatabaseChanges } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const changes = body.changes || [];
    const result = await commitDatabaseChanges(changes);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
