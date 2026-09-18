import { NextResponse } from "next/server";
import { flushDatabaseRecords } from "@/lib/db";

export async function POST() {
  try {
    const result = await flushDatabaseRecords();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
