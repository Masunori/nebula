import { NextResponse } from "next/server";
import { loadPresetDataset } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { preset, stateData } = body;

    const result = await loadPresetDataset(preset || "DEFAULT", stateData);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
