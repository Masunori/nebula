import { NextResponse } from "next/server";
import { getParametersAndRules } from "@/lib/db";

export async function GET() {
  try {
    const rules = await getParametersAndRules();
    return NextResponse.json(rules);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
