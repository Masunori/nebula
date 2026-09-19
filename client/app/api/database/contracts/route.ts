import { NextRequest, NextResponse } from "next/server";
import { getContracts } from "@/lib/db";

export async function GET() {
  try {
    const data = await getContracts();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
