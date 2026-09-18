import { NextResponse } from "next/server";
import { ingestDatabaseRecords } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { table, records } = body;

    if (!table || !Array.isArray(records)) {
      return NextResponse.json(
        { error: "Invalid ingest payload. 'table' and 'records' array required." },
        { status: 400 }
      );
    }

    const result = await ingestDatabaseRecords(table, records);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
