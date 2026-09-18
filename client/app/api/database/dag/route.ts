import { NextResponse } from "next/server";
import { getDAGReport } from "@/lib/db";

export async function GET() {
  try {
    const dag = await getDAGReport();
    return NextResponse.json(dag);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
